import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { Connection, Model, Types, ClientSession, PipelineStage } from 'mongoose';
import { Inventory, InventoryDocument } from './schemas/inventory.schema';
import {
  InventoryTransaction,
  InventoryTransactionDocument,
} from './schemas/inventory-transaction.schema';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import {
  StockInDto,
  DamageStockDto,
  AdjustmentDto,
  ListInventoryDto,
  ListHistoryDto,
} from './dto';
import {
  InventoryDerivedValues,
  InventoryItemResponse,
  PaginatedInventoryResponse,
  PaginatedHistoryResponse,
} from './interfaces/inventory-details.interface';
import { InventoryTransactionType, SalesUnit } from '../../common/enums';

@Injectable()
export class InventoryService {
  private readonly logger = new Logger(InventoryService.name);

  constructor(
    @InjectConnection() private readonly connection: Connection,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    @InjectModel(InventoryTransaction.name)
    private readonly transactionModel: Model<InventoryTransactionDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // 1. GET /inventory (List with derived values)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns current physical stock list with derived quantities (fullBoxes,
   * loosePieces, totalSqFt) and low-stock flags (totalPieces <= minimumStockPieces).
   *
   * Supports pagination, lowStockOnly filtering, and text search across product fields.
   */
  async findAll(query: ListInventoryDto): Promise<PaginatedInventoryResponse> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const matchConditions: Record<string, unknown> = {};

    // If search term is provided, filter by product fields
    if (query.search && query.search.trim() !== '') {
      const regex = { $regex: query.search.trim(), $options: 'i' };
      const matchingProducts = await this.productModel
        .find({
          $or: [{ productName: regex }, { brand: regex }, { gallaNumber: regex }],
        })
        .select('_id')
        .exec();

      const matchingProductIds = matchingProducts.map((p) => p._id);
      matchConditions['productId'] = { $in: matchingProductIds };
    }

    // Build aggregation pipeline for accurate derived values and lowStock filter
    const pipeline: PipelineStage[] = [
      { $match: matchConditions },
      {
        $lookup: {
          from: 'products',
          localField: 'productId',
          foreignField: '_id',
          as: 'product',
        },
      },
      { $unwind: '$product' },
    ];

    if (query.lowStockOnly) {
      pipeline.push({
        $match: {
          $expr: {
            $lte: [
              '$totalPieces',
              {
                $multiply: [
                  {
                    $ifNull: [
                      '$product.minimumStockBoxes',
                      {
                        $floor: {
                          $divide: [
                            { $ifNull: ['$product.minimumStockPieces', 0] },
                            '$product.piecesPerBox',
                          ],
                        },
                      },
                    ],
                  },
                  '$product.piecesPerBox',
                ],
              },
            ],
          },
        },
      });
    }

    // Facet stage for paginated data and total count
    pipeline.push({
      $facet: {
        data: [{ $skip: skip }, { $limit: limit }],
        totalCount: [{ $count: 'count' }],
      },
    });

    const result = await this.inventoryModel.aggregate(pipeline).exec();
    const facetResult = result[0] || { data: [], totalCount: [] };
    const rawData = facetResult.data || [];
    const total = facetResult.totalCount[0]?.count || 0;

    const data: InventoryItemResponse[] = rawData.map((item: any) => {
      const derived = this.calculateDerived(item.totalPieces, item.product);
      return {
        _id: item._id.toString(),
        productId: item.product,
        totalPieces: item.totalPieces,
        fullBoxes: derived.fullBoxes,
        loosePieces: derived.loosePieces,
        totalSqFt: derived.totalSqFt,
        minimumStockBoxes: derived.minimumStockBoxes,
        isLowStock: derived.isLowStock,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      };
    });

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. GET /inventory/:productId (Single product stock)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns inventory details and derived unit values for a single product.
   */
  async findOneByProductId(productId: string): Promise<InventoryItemResponse> {
    const productObjectId = this.validateObjectId(productId, 'productId');

    const product = await this.productModel.findById(productObjectId).exec();
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    const inventory = await this.inventoryModel
      .findOne({ productId: productObjectId })
      .exec();

    if (!inventory) {
      throw new NotFoundException(
        `Inventory record not found for product id ${productId}`,
      );
    }

    const derived = this.calculateDerived(inventory.totalPieces, product);

    return {
      _id: inventory._id.toString(),
      productId: product,
      totalPieces: inventory.totalPieces,
      fullBoxes: derived.fullBoxes,
      loosePieces: derived.loosePieces,
      totalSqFt: derived.totalSqFt,
      minimumStockBoxes: derived.minimumStockBoxes,
      isLowStock: derived.isLowStock,
      createdAt: (inventory as any).createdAt,
      updatedAt: (inventory as any).updatedAt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. POST /inventory/stock-in (Receiving complete boxes)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Accepts complete boxes (quantity, unit = BOX).
   * Increments totalPieces += quantity * piecesPerBox and logs STOCK_IN transaction.
   *
   * Stock mutation and transaction recording happen inside ONE MongoDB session/transaction.
   * If either write fails, the entire transaction is rolled back by MongoDB.
   */
  async stockIn(
    dto: StockInDto,
    userId: string,
  ): Promise<InventoryItemResponse> {
    const productObjectId = this.validateObjectId(dto.productId, 'productId');
    const userObjectId = this.validateObjectId(userId, 'userId');

    const product = await this.productModel.findById(productObjectId).exec();
    if (!product) {
      throw new NotFoundException(`Product with id ${dto.productId} not found`);
    }

    if (dto.quantity <= 0 || !Number.isInteger(dto.quantity)) {
      throw new BadRequestException('quantity must be a positive integer');
    }

    const physicalPieces = dto.quantity * product.piecesPerBox;

    const updatedInventory = await this.runInTransaction(async (session) => {
      // 1. Atomically increment stock within transaction session
      const inventory = await this.inventoryModel
        .findOneAndUpdate(
          { productId: productObjectId },
          { $inc: { totalPieces: physicalPieces } },
          { new: true, session },
        )
        .exec();

      if (!inventory) {
        throw new NotFoundException(
          `Inventory record not found for product id ${dto.productId}`,
        );
      }

      // 2. Record immutable audit transaction within same transaction session
      await this.transactionModel.create(
        [
          {
            productId: productObjectId,
            transactionType: InventoryTransactionType.STOCK_IN,
            physicalPieces: physicalPieces,
            salesQuantity: Types.Decimal128.fromString(String(dto.quantity)),
            salesUnit: SalesUnit.BOX,
            createdBy: userObjectId,
          },
        ],
        { session },
      );

      return inventory;
    });

    const derived = this.calculateDerived(updatedInventory.totalPieces, product);

    return {
      _id: updatedInventory._id.toString(),
      productId: product,
      totalPieces: updatedInventory.totalPieces,
      fullBoxes: derived.fullBoxes,
      loosePieces: derived.loosePieces,
      totalSqFt: derived.totalSqFt,
      minimumStockBoxes: derived.minimumStockBoxes,
      isLowStock: derived.isLowStock,
      createdAt: (updatedInventory as any).createdAt,
      updatedAt: (updatedInventory as any).updatedAt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 4. POST /inventory/damage (Record damaged pieces/boxes)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Records damaged physical pieces or complete boxes with a mandatory reason.
   * Decrements stock and logs a DAMAGE inventory transaction.
   *
   * Stock mutation and transaction recording happen inside ONE MongoDB session/transaction.
   * Atomic conditional query ($gte) prevents stock from ever becoming negative.
   */
  async recordDamage(
    dto: DamageStockDto,
    userId: string,
  ): Promise<InventoryItemResponse> {
    const productObjectId = this.validateObjectId(dto.productId, 'productId');
    const userObjectId = this.validateObjectId(userId, 'userId');

    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException('Reason is mandatory for damaged stock');
    }

    if (dto.quantity <= 0 || !Number.isInteger(dto.quantity)) {
      throw new BadRequestException('quantity must be a positive integer');
    }

    const product = await this.productModel.findById(productObjectId).exec();
    if (!product) {
      throw new NotFoundException(`Product with id ${dto.productId} not found`);
    }

    const piecesToDeduct =
      dto.unit === SalesUnit.BOX
        ? dto.quantity * product.piecesPerBox
        : dto.quantity;

    const updatedInventory = await this.runInTransaction(async (session) => {
      // 1. Atomic decrement with $gte guard to eliminate race-condition overselling
      const inventory = await this.inventoryModel
        .findOneAndUpdate(
          { productId: productObjectId, totalPieces: { $gte: piecesToDeduct } },
          { $inc: { totalPieces: -piecesToDeduct } },
          { new: true, session },
        )
        .exec();

      if (!inventory) {
        const existing = await this.inventoryModel
          .findOne({ productId: productObjectId })
          .session(session)
          .exec();

        if (!existing) {
          throw new NotFoundException(
            `Inventory record not found for product id ${dto.productId}`,
          );
        }

        throw new BadRequestException(
          `Insufficient stock for damage deduction: current stock is ${existing.totalPieces} pieces, requested ${piecesToDeduct} pieces (${dto.quantity} ${dto.unit})`,
        );
      }

      // 2. Record immutable audit transaction within same transaction session
      await this.transactionModel.create(
        [
          {
            productId: productObjectId,
            transactionType: InventoryTransactionType.DAMAGE,
            physicalPieces: -piecesToDeduct, // Signed negative
            salesQuantity: Types.Decimal128.fromString(String(dto.quantity)),
            salesUnit: dto.unit,
            reason: dto.reason.trim(),
            createdBy: userObjectId,
          },
        ],
        { session },
      );

      return inventory;
    });

    const derived = this.calculateDerived(updatedInventory.totalPieces, product);

    return {
      _id: updatedInventory._id.toString(),
      productId: product,
      totalPieces: updatedInventory.totalPieces,
      fullBoxes: derived.fullBoxes,
      loosePieces: derived.loosePieces,
      totalSqFt: derived.totalSqFt,
      minimumStockBoxes: derived.minimumStockBoxes,
      isLowStock: derived.isLowStock,
      createdAt: (updatedInventory as any).createdAt,
      updatedAt: (updatedInventory as any).updatedAt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 5. POST /inventory/adjustment (Manual stock corrections)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Adjusts physical pieces with a mandatory reason.
   * Records an ADJUSTMENT inventory transaction (signed pieces).
   *
   * Stock mutation and transaction recording happen inside ONE MongoDB session/transaction.
   * Positive physicalPieces = stock surplus / found stock
   * Negative physicalPieces = stock shrinkage / missing stock (guarded with $gte)
   */
  async adjustStock(
    dto: AdjustmentDto,
    userId: string,
  ): Promise<InventoryItemResponse> {
    const productObjectId = this.validateObjectId(dto.productId, 'productId');
    const userObjectId = this.validateObjectId(userId, 'userId');

    if (dto.physicalPieces === 0) {
      throw new BadRequestException('physicalPieces cannot be zero');
    }

    if (!Number.isInteger(dto.physicalPieces)) {
      throw new BadRequestException('physicalPieces must be an integer');
    }

    if (!dto.reason || dto.reason.trim() === '') {
      throw new BadRequestException(
        'Reason is mandatory for inventory adjustments',
      );
    }

    const product = await this.productModel.findById(productObjectId).exec();
    if (!product) {
      throw new NotFoundException(`Product with id ${dto.productId} not found`);
    }

    const updatedInventory = await this.runInTransaction(async (session) => {
      let inventory: InventoryDocument | null;

      if (dto.physicalPieces > 0) {
        // Stock surplus: increment directly
        inventory = await this.inventoryModel
          .findOneAndUpdate(
            { productId: productObjectId },
            { $inc: { totalPieces: dto.physicalPieces } },
            { new: true, session },
          )
          .exec();

        if (!inventory) {
          throw new NotFoundException(
            `Inventory record not found for product id ${dto.productId}`,
          );
        }
      } else {
        // Stock shrinkage: decrement with guard so stock cannot go negative
        const piecesToDeduct = Math.abs(dto.physicalPieces);
        inventory = await this.inventoryModel
          .findOneAndUpdate(
            { productId: productObjectId, totalPieces: { $gte: piecesToDeduct } },
            { $inc: { totalPieces: dto.physicalPieces } },
            { new: true, session },
          )
          .exec();

        if (!inventory) {
          const existing = await this.inventoryModel
            .findOne({ productId: productObjectId })
            .session(session)
            .exec();

          if (!existing) {
            throw new NotFoundException(
              `Inventory record not found for product id ${dto.productId}`,
            );
          }

          throw new BadRequestException(
            `Insufficient stock: adjustment of ${dto.physicalPieces} pieces would result in negative stock (current: ${existing.totalPieces} pieces)`,
          );
        }
      }

      // Record immutable audit transaction within same transaction session
      await this.transactionModel.create(
        [
          {
            productId: productObjectId,
            transactionType: InventoryTransactionType.ADJUSTMENT,
            physicalPieces: dto.physicalPieces, // Signed value (+ or -)
            reason: dto.reason.trim(),
            createdBy: userObjectId,
          },
        ],
        { session },
      );

      return inventory;
    });

    const derived = this.calculateDerived(updatedInventory.totalPieces, product);

    return {
      _id: updatedInventory._id.toString(),
      productId: product,
      totalPieces: updatedInventory.totalPieces,
      fullBoxes: derived.fullBoxes,
      loosePieces: derived.loosePieces,
      totalSqFt: derived.totalSqFt,
      minimumStockBoxes: derived.minimumStockBoxes,
      isLowStock: derived.isLowStock,
      createdAt: (updatedInventory as any).createdAt,
      updatedAt: (updatedInventory as any).updatedAt,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // 6. GET /inventory/:productId/history (Audit trail)
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns paginated history of inventory transactions (STOCK_IN, SALE,
   * DAMAGE, ADJUSTMENT, SALE_REVERSAL) for the product.
   */
  async getHistory(
    productId: string,
    query: ListHistoryDto,
  ): Promise<PaginatedHistoryResponse> {
    const productObjectId = this.validateObjectId(productId, 'productId');

    const product = await this.productModel.findById(productObjectId).exec();
    if (!product) {
      throw new NotFoundException(`Product with id ${productId} not found`);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {
      productId: productObjectId,
    };

    if (query.transactionType) {
      filter['transactionType'] = query.transactionType;
    }

    const [data, total] = await Promise.all([
      this.transactionModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      this.transactionModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Transaction & Calculation Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Executes operations within a MongoDB ClientSession / transaction.
   * Guarantees all-or-nothing atomicity for stock mutations and transaction logging.
   */
  private async runInTransaction<T>(
    operation: (session: ClientSession) => Promise<T>,
  ): Promise<T> {
    const session = await this.connection.startSession();
    session.startTransaction();
    try {
      const result = await operation(session);
      await session.commitTransaction();
      return result;
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      await session.endSession();
    }
  }

  /**
   * Derives presentation metrics from canonical totalPieces and product configuration.
   * DATABASE.md Section 10:
   *   fullBoxes    = floor(T / P)
   *   loosePieces  = T % P
   *   areaPerPiece = A / P
   *   totalSqFt    = T * areaPerPiece
   *   isLowStock   = T <= minimumStockPieces
   */
  private calculateDerived(
    totalPieces: number,
    product: Product,
  ): InventoryDerivedValues {
    const piecesPerBox = product.piecesPerBox;
    const areaPerBox = parseFloat(product.areaPerBox.toString());

    const fullBoxes = Math.floor(totalPieces / piecesPerBox);
    const loosePieces = totalPieces % piecesPerBox;
    const areaPerPiece = areaPerBox / piecesPerBox;
    const totalSqFt =
      Math.round(totalPieces * areaPerPiece * 10000) / 10000;

    const minimumStockBoxes =
      product.minimumStockBoxes !== undefined
        ? product.minimumStockBoxes
        : product.minimumStockPieces !== undefined
          ? Math.floor(product.minimumStockPieces / piecesPerBox)
          : 0;

    const isLowStock = totalPieces <= minimumStockBoxes * piecesPerBox;

    return {
      fullBoxes,
      loosePieces,
      totalSqFt,
      isLowStock,
      minimumStockBoxes,
    };
  }

  /** Validates and parses MongoDB ObjectId safely */
  private validateObjectId(id: string, fieldName = 'id'): Types.ObjectId {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid ${fieldName}: ${id}`);
    }
    return new Types.ObjectId(id);
  }
}
