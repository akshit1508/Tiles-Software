import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import {
  InventoryTransaction,
  InventoryTransactionDocument,
} from '../inventory/schemas/inventory-transaction.schema';
import { InventoryTransactionType, SalesUnit } from '../../common/enums';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsDto } from './dto/list-products.dto';
import { CloudinaryService, UploadedImageResult } from '../cloudinary';

/** Mongoose duplicate-key error code */
const MONGO_DUPLICATE_KEY_CODE = 11000;

export interface PaginatedProducts {
  data: ProductDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Inventory.name) private readonly inventoryModel: Model<InventoryDocument>,
    @Optional()
    @InjectModel(InventoryTransaction.name)
    private readonly transactionModel?: Model<InventoryTransactionDocument>,
    @Optional()
    private readonly cloudinaryService?: CloudinaryService,
  ) {}

  /**
   * Uploads multiple product images to Cloudinary via CloudinaryService.
   */
  async uploadImages(files: Express.Multer.File[]): Promise<UploadedImageResult[]> {
    if (!this.cloudinaryService) {
      throw new BadRequestException('CloudinaryService is not available');
    }
    return this.cloudinaryService.uploadMultipleImages(files);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new tile product master record and initializes its corresponding
   * Inventory document based on initialStockBoxes * piecesPerBox.
   *
   * If initialStockBoxes > 0, also records an initial STOCK_IN inventory transaction
   * for an immutable audit trail.
   */
  async create(dto: CreateProductDto, userId?: string): Promise<ProductDocument> {
    const normalizedGallaNumber = dto.gallaNumber.trim().toUpperCase();

    const minimumStockBoxes =
      dto.minimumStockBoxes !== undefined
        ? dto.minimumStockBoxes
        : dto.minimumStockPieces !== undefined
          ? Math.floor(dto.minimumStockPieces / dto.piecesPerBox)
          : 0;
    const minimumStockPieces =
      dto.minimumStockPieces !== undefined
        ? dto.minimumStockPieces
        : minimumStockBoxes * dto.piecesPerBox;

    const initialStockBoxes =
      dto.initialStockBoxes !== undefined
        ? Math.max(0, dto.initialStockBoxes)
        : dto.incomingBoxes !== undefined
          ? Math.max(0, dto.incomingBoxes)
          : 0;
    const initialTotalPieces = initialStockBoxes * dto.piecesPerBox;

    // Prepare Decimal128 monetary/area values
    const productData = {
      brand: dto.brand,
      productName: dto.productName,
      gallaNumber: normalizedGallaNumber,
      category: dto.category,
      size: dto.size,
      finish: dto.finish,
      color: dto.color,
      piecesPerBox: dto.piecesPerBox,
      areaPerBox: Types.Decimal128.fromString(String(dto.areaPerBox)),
      purchasePrice: Types.Decimal128.fromString(String(dto.purchasePrice)),
      sellingPrice: Types.Decimal128.fromString(String(dto.sellingPrice)),
      minimumStockBoxes,
      minimumStockPieces,
      initialStockBoxes,
      incomingBoxes: initialStockBoxes,
      images: dto.images ?? [],
      isActive: true,
    };

    let product: ProductDocument;
    try {
      product = await this.productModel.create(productData);
    } catch (err: unknown) {
      this.handleMongoError(err, normalizedGallaNumber);
      throw err; // re-throw if not handled
    }

    // Initialize authoritative inventory with totalPieces derived from initialStockBoxes * piecesPerBox
    try {
      await this.inventoryModel.create({
        productId: product._id,
        totalPieces: initialTotalPieces,
      });

      // Record immutable STOCK_IN transaction if initialStockBoxes > 0 and transactionModel is available
      if (this.transactionModel && initialStockBoxes > 0) {
        const userObjectId =
          userId && Types.ObjectId.isValid(userId)
            ? new Types.ObjectId(userId)
            : new Types.ObjectId();

        await this.transactionModel.create({
          productId: product._id,
          transactionType: InventoryTransactionType.STOCK_IN,
          physicalPieces: initialTotalPieces,
          salesQuantity: Types.Decimal128.fromString(String(initialStockBoxes)),
          salesUnit: SalesUnit.BOX,
          reason: 'Initial stock on product creation',
          createdBy: userObjectId,
        });
      }
    } catch (inventoryErr: unknown) {
      // If inventory or transaction creation fails, clean up the product to avoid orphaned records
      this.logger.error(
        `Failed to initialize inventory for product ${product._id.toString()}, rolling back product creation.`,
      );
      await this.productModel.findByIdAndDelete(product._id);
      throw new BadRequestException('Failed to initialize product inventory. Please try again.');
    }

    return product;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // List
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a paginated list of products.
   * Defaults to isActive=true so deactivated products are hidden unless explicitly requested.
   */
  async findAll(query: ListProductsDto): Promise<PaginatedProducts> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    // Build filter — default isActive=true
    const filter: Record<string, unknown> = {
      isActive: query.isActive !== undefined ? query.isActive : true,
    };

    if (query.brand) {
      filter['brand'] = { $regex: query.brand, $options: 'i' };
    }
    if (query.category) {
      filter['category'] = { $regex: query.category, $options: 'i' };
    }

    const [data, total] = await Promise.all([
      this.productModel.find(filter).skip(skip).limit(limit).exec(),
      this.productModel.countDocuments(filter).exec(),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Find One
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Returns a product by its MongoDB ObjectId.
   * Throws 400 for malformed IDs, 404 if not found.
   */
  async findOne(id: string): Promise<ProductDocument> {
    this.validateObjectId(id);

    const product = await this.productModel.findById(id).exec();
    if (!product) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return product;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Update
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Partially updates a product.
   * If gallaNumber is being updated, normalizes it and checks for collision
   * with any OTHER existing product before persisting.
   * isActive cannot be changed through this method.
   */
  async update(id: string, dto: UpdateProductDto): Promise<ProductDocument> {
    this.validateObjectId(id);

    // gallaNumber normalization (DTO Transform handles it, but re-normalize for safety)
    let normalizedGallaNumber: string | undefined;
    if (dto.gallaNumber !== undefined) {
      normalizedGallaNumber = dto.gallaNumber.trim().toUpperCase();
    }

    const updateData: Record<string, unknown> = {};

    // Copy scalar string fields
    if (dto.brand !== undefined) updateData['brand'] = dto.brand;
    if (dto.productName !== undefined) updateData['productName'] = dto.productName;
    if (normalizedGallaNumber !== undefined) updateData['gallaNumber'] = normalizedGallaNumber;
    if (dto.category !== undefined) updateData['category'] = dto.category;
    if (dto.size !== undefined) updateData['size'] = dto.size;
    if (dto.finish !== undefined) updateData['finish'] = dto.finish;
    if (dto.color !== undefined) updateData['color'] = dto.color;
    if (dto.piecesPerBox !== undefined) updateData['piecesPerBox'] = dto.piecesPerBox;
    if (dto.minimumStockBoxes !== undefined) {
      updateData['minimumStockBoxes'] = dto.minimumStockBoxes;
      if (dto.piecesPerBox !== undefined) {
        updateData['minimumStockPieces'] = dto.minimumStockBoxes * dto.piecesPerBox;
      }
    } else if (dto.minimumStockPieces !== undefined) {
      updateData['minimumStockPieces'] = dto.minimumStockPieces;
      if (dto.piecesPerBox !== undefined) {
        updateData['minimumStockBoxes'] = Math.floor(dto.minimumStockPieces / dto.piecesPerBox);
      }
    }
    if (dto.images !== undefined) updateData['images'] = dto.images;

    // Decimal128 conversions for monetary/area fields
    if (dto.areaPerBox !== undefined) {
      updateData['areaPerBox'] = Types.Decimal128.fromString(String(dto.areaPerBox));
    }
    if (dto.purchasePrice !== undefined) {
      updateData['purchasePrice'] = Types.Decimal128.fromString(String(dto.purchasePrice));
    }
    if (dto.sellingPrice !== undefined) {
      updateData['sellingPrice'] = Types.Decimal128.fromString(String(dto.sellingPrice));
    }

    let updated: ProductDocument | null;
    try {
      updated = await this.productModel
        .findByIdAndUpdate(id, { $set: updateData }, { new: true, runValidators: true })
        .exec();
    } catch (err: unknown) {
      this.handleMongoError(err, normalizedGallaNumber ?? '');
      throw err;
    }

    if (!updated) {
      throw new NotFoundException(`Product with id ${id} not found`);
    }
    return updated;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Activate / Deactivate
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Sets isActive = true. Returns 409 if product is already active
   * to surface the invalid status transition rather than silently no-oping.
   */
  async activate(id: string): Promise<ProductDocument> {
    const product = await this.findOne(id);

    if (product.isActive) {
      throw new ConflictException(`Product with id ${id} is already active`);
    }

    product.isActive = true;
    return product.save();
  }

  /**
   * Sets isActive = false (soft deactivation). Products are NEVER hard-deleted.
   * Returns 409 if product is already inactive.
   */
  async deactivate(id: string): Promise<ProductDocument> {
    const product = await this.findOne(id);

    if (!product.isActive) {
      throw new ConflictException(`Product with id ${id} is already inactive`);
    }

    product.isActive = false;
    return product.save();
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────────

  /** Validates that the provided string is a valid MongoDB ObjectId. */
  private validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid product id: ${id}`);
    }
  }

  /**
   * Maps known MongoDB errors to NestJS HTTP exceptions.
   * Prevents raw database errors from leaking to API clients.
   */
  private handleMongoError(err: unknown, gallaNumber: string): void {
    if (
      err &&
      typeof err === 'object' &&
      'code' in err &&
      (err as { code: number }).code === MONGO_DUPLICATE_KEY_CODE
    ) {
      throw new ConflictException(
        `A product with gallaNumber "${gallaNumber}" already exists`,
      );
    }
  }
}
