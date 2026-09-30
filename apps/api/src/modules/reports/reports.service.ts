import {
  Injectable,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, PipelineStage } from 'mongoose';
import { Product, ProductDocument } from '../products/schemas/product.schema';
import { Inventory, InventoryDocument } from '../inventory/schemas/inventory.schema';
import { ReportsPdfService } from './reports-pdf.service';
import { TileStockReportQueryDto } from './dto';
import {
  TileStockReportResponse,
  TileStockReportItem,
  DistinctSizesResponse,
} from './interfaces/tile-stock-report.interface';
import { buildSizeRegex } from './utils/size-matcher.util';

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(Inventory.name)
    private readonly inventoryModel: Model<InventoryDocument>,
    private readonly reportsPdfService: ReportsPdfService,
  ) {}

  /**
   * Returns a deterministically sorted list of distinct tile sizes
   * from active products in the catalog.
   */
  async getDistinctSizes(): Promise<DistinctSizesResponse> {
    const rawDistinct = await this.productModel
      .distinct('size', { isActive: true })
      .exec();

    const sizes = (rawDistinct || [])
      .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
      .map((s) => s.trim())
      .filter((val, idx, arr) => arr.indexOf(val) === idx)
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    return { sizes };
  }

  /**
   * Generates a size-wise tile sample catalog and live physical stock report.
   *
   * Business Rules:
   * 1. Stock source: The `inventories` collection is the sole source of truth.
   *    Boxes across all physical Gallas are summed for each matched product.
   * 2. Tolerant size matching: Interchangeable dimension separators (*, x, X, ×)
   *    are supported, but unit distinctions (mm vs ft) are strictly preserved.
   * 3. Only active products are included.
   * 4. If availableOnly=true (default), products with 0 total boxes are excluded.
   * 5. Sorting: brand ASC, productName ASC, _id ASC (deterministic).
   * 6. Serial numbers: Generated sequentially (1-based) after final filtering/sorting.
   * 7. Pricing: Uses Product.sellingPrice (reference catalog price per box).
   * 8. Privacy: Internal warehouse Galla numbers are never exposed in report items.
   */
  async getTileStockReport(query: TileStockReportQueryDto): Promise<TileStockReportResponse> {
    const filterSize = query.size?.trim();
    if (!filterSize) {
      throw new BadRequestException('size is required');
    }

    const availableOnly = query.availableOnly !== false;
    const sizeRegex = buildSizeRegex(filterSize);

    // Efficient server-side aggregation:
    // Matches active products by size, lookups location stock records,
    // and calculates authoritative box sum across all Gallas.
    const pipeline: PipelineStage[] = [
      {
        $match: {
          isActive: true,
          size: { $regex: sizeRegex },
        },
      },
      {
        $lookup: {
          from: 'inventories',
          localField: '_id',
          foreignField: 'productId',
          as: 'locations',
        },
      },
      {
        $project: {
          _id: 1,
          brand: 1,
          productName: 1,
          category: 1,
          size: 1,
          finish: 1,
          color: 1,
          piecesPerBox: 1,
          sellingPrice: 1,
          images: 1,
          availableBoxes: {
            $ifNull: [{ $sum: '$locations.boxes' }, 0],
          },
        },
      },
    ];

    if (availableOnly) {
      pipeline.push({
        $match: {
          availableBoxes: { $gt: 0 },
        },
      });
    }

    pipeline.push({
      $sort: {
        brand: 1,
        productName: 1,
        _id: 1,
      },
    });

    const matchedProducts = await this.productModel.aggregate(pipeline).exec();

    const items: TileStockReportItem[] = (matchedProducts || []).map((p: any, index: number) => {
      // Selling price conversion from Decimal128 or number
      let sellingPricePerBox = 0;
      if (p.sellingPrice != null) {
        sellingPricePerBox = parseFloat(p.sellingPrice.toString()) || 0;
      }

      // Primary image extraction (first image in array or null)
      const imageUrl =
        Array.isArray(p.images) && p.images.length > 0 && p.images[0]?.url
          ? p.images[0].url
          : null;

      return {
        serialNumber: index + 1,
        productId: p._id.toString(),
        brand: p.brand,
        productName: p.productName,
        category: p.category,
        size: p.size,
        finish: p.finish,
        color: p.color,
        piecesPerBox: p.piecesPerBox,
        sellingPricePerBox,
        availableBoxes: p.availableBoxes || 0,
        imageUrl,
      };
    });

    const totalAvailableBoxes = items.reduce((sum, item) => sum + item.availableBoxes, 0);

    return {
      reportTitle: 'Goverdhan Traders - Tile Sample & Stock Report',
      filterSize,
      generatedAt: new Date().toISOString(),
      summary: {
        totalDesigns: items.length,
        totalAvailableBoxes,
      },
      items,
    };
  }
}

