import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Galla, GallaDocument } from './schemas/galla.schema';
import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import { CreateGallaDto, UpdateGallaDto, ListGallasDto } from './dto';

export interface GallaItemResponse {
  _id: string;
  gallaNumber: string;
  name?: string;
  description?: string;
  isActive: boolean;
  productCount: number;
  totalBoxes: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface GallaInventoryDetailResponse {
  galla: {
    _id: string;
    gallaNumber: string;
    name?: string;
    description?: string;
    isActive: boolean;
  };
  products: Array<{
    _id: string;
    productId: any;
    product?: any;
    boxes: number;
    totalPieces: number;
  }>;
  items?: Array<{
    _id: string;
    product: any;
    productId: any;
    boxes: number;
    totalPieces: number;
  }>;
  totalProducts: number;
  totalBoxes: number;
}

@Injectable()
export class GallasService {
  private readonly logger = new Logger(GallasService.name);

  constructor(
    @InjectModel(Galla.name)
    private readonly gallaModel: Model<GallaDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
  ) {}

  /**
   * Creates a new Galla storage location.
   * Galla Number must be unique within the Gallas collection.
   */
  async create(dto: CreateGallaDto): Promise<GallaDocument> {
    const normalizedNumber = dto.gallaNumber.trim().toUpperCase();

    const existing = await this.gallaModel
      .findOne({ gallaNumber: normalizedNumber })
      .exec();

    if (existing) {
      throw new ConflictException(
        `A Galla with code "${normalizedNumber}" already exists`,
      );
    }

    return this.gallaModel.create({
      gallaNumber: normalizedNumber,
      name: dto.name?.trim() || undefined,
      description: dto.description?.trim() || undefined,
      isActive: true,
    });
  }

  /**
   * Returns list of Gallas with live stock summary (productCount and totalBoxes)
   * aggregated from the location inventory records.
   */
  async findAll(query: ListGallasDto): Promise<GallaItemResponse[]> {
    const filter: Record<string, unknown> = {};

    if (typeof query.isActive === 'boolean') {
      filter.isActive = query.isActive;
    }

    if (query.search && query.search.trim() !== '') {
      const regex = { $regex: query.search.trim(), $options: 'i' };
      filter.$or = [{ gallaNumber: regex }, { name: regex }];
    }

    const gallas = await this.gallaModel
      .find(filter)
      .sort({ gallaNumber: 1 })
      .exec();

    if (gallas.length === 0) {
      return [];
    }

    const gallaIds = gallas.map((g) => g._id);

    // Aggregate inventory stats grouped by gallaId
    const stockStats = await this.inventoryModel.aggregate([
      {
        $match: {
          gallaId: { $in: gallaIds },
          boxes: { $gt: 0 },
        },
      },
      {
        $group: {
          _id: '$gallaId',
          productCount: { $addToSet: '$productId' },
          totalBoxes: { $sum: '$boxes' },
        },
      },
      {
        $project: {
          productCount: { $size: '$productCount' },
          totalBoxes: 1,
        },
      },
    ]);

    const statsMap = new Map<string, { productCount: number; totalBoxes: number }>();
    for (const stat of stockStats) {
      statsMap.set(stat._id.toString(), {
        productCount: stat.productCount,
        totalBoxes: stat.totalBoxes,
      });
    }

    return gallas.map((g) => {
      const stats = statsMap.get(g._id.toString()) || { productCount: 0, totalBoxes: 0 };
      return {
        _id: g._id.toString(),
        gallaNumber: g.gallaNumber,
        name: g.name,
        description: g.description,
        isActive: g.isActive,
        productCount: stats.productCount,
        totalBoxes: stats.totalBoxes,
        createdAt: (g as any).createdAt,
        updatedAt: (g as any).updatedAt,
      };
    });
  }

  /**
   * Finds a Galla by ID.
   */
  async findOne(id: string): Promise<GallaDocument> {
    this.validateObjectId(id);
    const galla = await this.gallaModel.findById(id).exec();
    if (!galla) {
      throw new NotFoundException(`Galla with id ${id} not found`);
    }
    return galla;
  }

  /**
   * Updates an existing Galla (name, description, active status).
   */
  async update(id: string, dto: UpdateGallaDto): Promise<GallaDocument> {
    this.validateObjectId(id);

    const galla = await this.gallaModel.findById(id).exec();
    if (!galla) {
      throw new NotFoundException(`Galla with id ${id} not found`);
    }

    if (dto.name !== undefined) {
      galla.name = dto.name?.trim() || undefined;
    }
    if (dto.description !== undefined) {
      galla.description = dto.description?.trim() || undefined;
    }
    if (dto.isActive !== undefined) {
      galla.isActive = dto.isActive;
    }

    return galla.save();
  }

  /**
   * Returns all products physically stored in this Galla with their box counts.
   * Galla 01:
   *   - Kajaria Royal Slate: 20 boxes
   *   - Somany Marble White: 15 boxes
   *   Total products: 2, Total stock: 35 boxes
   */
  async getGallaInventory(id: string): Promise<GallaInventoryDetailResponse> {
    const galla = await this.findOne(id);

    const locationItems = await this.inventoryModel
      .find({
        gallaId: galla._id,
        boxes: { $gt: 0 },
      })
      .populate('productId')
      .exec();

    const validItems = locationItems.filter((item) => item.productId !== null);

    const totalBoxes = validItems.reduce((sum, item) => sum + (item.boxes || 0), 0);
    const distinctProductIds = new Set(
      validItems.map((item) =>
        item.productId?._id ? item.productId._id.toString() : item.productId.toString(),
      ),
    );

    return {
      galla: {
        _id: galla._id.toString(),
        gallaNumber: galla.gallaNumber,
        name: galla.name,
        description: galla.description,
        isActive: galla.isActive,
      },
      items: validItems.map((item) => ({
        _id: item._id.toString(),
        product: item.productId,
        productId: item.productId,
        boxes: item.boxes || 0,
        totalPieces: item.totalPieces || 0,
      })),
      products: validItems.map((item) => ({
        _id: item._id.toString(),
        productId: item.productId,
        product: item.productId,
        boxes: item.boxes || 0,
        totalPieces: item.totalPieces || 0,
      })),
      totalProducts: distinctProductIds.size,
      totalBoxes,
    };
  }

  /**
   * Helper to find or automatically create a Galla by its code.
   * Useful for seamless migration and backward compatibility.
   */
  async findOrCreateByNumber(rawGallaNumber: string): Promise<GallaDocument> {
    const normalized = rawGallaNumber.trim().toUpperCase();
    let galla = await this.gallaModel.findOne({ gallaNumber: normalized }).exec();
    if (!galla) {
      galla = await this.gallaModel.create({
        gallaNumber: normalized,
        name: `Location ${normalized}`,
        isActive: true,
      });
    }
    return galla;
  }

  private validateObjectId(id: string): void {
    if (!Types.ObjectId.isValid(id)) {
      throw new BadRequestException(`Invalid Galla id: ${id}`);
    }
  }
}
