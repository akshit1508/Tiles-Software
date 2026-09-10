import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Product, ProductDocument } from './schemas/product.schema';
import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { ListProductsDto } from './dto/list-products.dto';

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
  ) {}

  // ─────────────────────────────────────────────────────────────────────────────
  // Create
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Creates a new product and initializes its associated Inventory document
   * with totalPieces = 0 (per API.md contract).
   *
   * gallaNumber is normalized (trim + uppercase) before persistence and must
   * be unique across all products.
   */
  async create(dto: CreateProductDto): Promise<ProductDocument> {
    const normalizedGallaNumber = dto.gallaNumber.trim().toUpperCase();

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
      minimumStockPieces: dto.minimumStockPieces ?? 0,
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

    // Initialize inventory with totalPieces = 0 (API.md contract)
    try {
      await this.inventoryModel.create({
        productId: product._id,
        totalPieces: 0,
      });
    } catch (inventoryErr: unknown) {
      // If inventory creation fails, we must clean up the product to avoid orphaned records.
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
    if (dto.minimumStockPieces !== undefined) updateData['minimumStockPieces'] = dto.minimumStockPieces;
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
