import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Reflector } from '@nestjs/core';
import { Types } from 'mongoose';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { ReportsService } from './reports.service';
import { ReportsPdfService } from './reports-pdf.service';
import { ReportsController } from './reports.controller';
import { Product } from '../products/schemas/product.schema';
import { Inventory } from '../inventory/schemas/inventory.schema';
import { TileStockReportQueryDto } from './dto/tile-stock-report.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { buildSizeRegex } from './utils/size-matcher.util';

describe('Reports Module — Size-Wise Tile Sample & Live Stock Backend Layer', () => {
  let service: ReportsService;
  let controller: ReportsController;
  let reflector: Reflector;

  let mockProductModel: {
    distinct: jest.Mock;
    aggregate: jest.Mock;
  };

  let mockInventoryModel: Record<string, unknown>;

  beforeEach(async () => {
    mockProductModel = {
      distinct: jest.fn(),
      aggregate: jest.fn(),
    };

    mockInventoryModel = {};

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        ReportsService,
        ReportsPdfService,
        Reflector,
        { provide: getModelToken(Product.name), useValue: mockProductModel },
        { provide: getModelToken(Inventory.name), useValue: mockInventoryModel },
      ],
    }).compile();

    service = module.get<ReportsService>(ReportsService);
    controller = module.get<ReportsController>(ReportsController);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Authorization & Guards
  // ───────────────────────────────────────────────────────────────────────────
  describe('Authorization & Security Guards', () => {
    it('1. Controller is protected with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', ReportsController);
      expect(guards).toBeDefined();
      expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
    });

    it('2. GET /reports/tile-stock/sizes requires UserRole.OWNER', () => {
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        ReportsController.prototype.getDistinctSizes,
      );
      expect(roles).toBeDefined();
      expect(roles).toEqual([UserRole.OWNER]);
    });

    it('3. GET /reports/tile-stock requires UserRole.OWNER', () => {
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        ReportsController.prototype.getTileStockReport,
      );
      expect(roles).toBeDefined();
      expect(roles).toEqual([UserRole.OWNER]);
    });

    it('4. Controller delegates GET /reports/tile-stock to service', async () => {
      const expectedResponse: any = {
        reportTitle: 'Goverdhan Traders - Tile Sample & Stock Report',
        filterSize: '16x16',
        generatedAt: new Date().toISOString(),
        summary: { totalDesigns: 1, totalAvailableBoxes: 20 },
        items: [],
      };
      jest.spyOn(service, 'getTileStockReport').mockResolvedValue(expectedResponse);

      const result = await controller.getTileStockReport({ size: '16x16' });
      expect(result).toBe(expectedResponse);
      expect(service.getTileStockReport).toHaveBeenCalledWith({ size: '16x16' });
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // DTO Validation
  // ───────────────────────────────────────────────────────────────────────────
  describe('DTO Validation (TileStockReportQueryDto)', () => {
    it('5. Rejects missing size with validation errors (HTTP 400)', async () => {
      const dto = plainToInstance(TileStockReportQueryDto, {});
      const errors = await validate(dto);
      expect(errors.length).toBeGreaterThan(0);
      const sizeError = errors.find((e) => e.property === 'size');
      expect(sizeError).toBeDefined();
    });

    it('6. Rejects empty string size with validation error', async () => {
      const dto = plainToInstance(TileStockReportQueryDto, { size: '   ' });
      const errors = await validate(dto);
      const sizeError = errors.find((e) => e.property === 'size');
      expect(sizeError).toBeDefined();
    });

    it('7. Accepts valid size and defaults availableOnly to true', async () => {
      const dto = plainToInstance(TileStockReportQueryDto, { size: '16x16' });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.availableOnly).toBe(true);
    });

    it('8. Transforms availableOnly="false" to boolean false', async () => {
      const dto = plainToInstance(TileStockReportQueryDto, {
        size: '16x16',
        availableOnly: 'false',
      });
      const errors = await validate(dto);
      expect(errors.length).toBe(0);
      expect(dto.availableOnly).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Size Matching Utility
  // ───────────────────────────────────────────────────────────────────────────
  describe('Size Matching Engine (buildSizeRegex)', () => {
    it('9. Matches identical size ("16x16")', () => {
      const regex = buildSizeRegex('16x16');
      expect(regex.test('16x16')).toBe(true);
    });

    it('10. Matches equivalent separator with asterisk ("16*16")', () => {
      const regex = buildSizeRegex('16x16');
      expect(regex.test('16*16')).toBe(true);
    });

    it('11. Matches uppercase and spaces ("16 X 16", "16 × 16")', () => {
      const regex = buildSizeRegex('16x16');
      expect(regex.test('16 X 16')).toBe(true);
      expect(regex.test('16 × 16')).toBe(true);
      expect(regex.test('16X16')).toBe(true);
      expect(regex.test('16 * 16')).toBe(true);
    });

    it('12. Bidirectional matching: input "600*600" matches stored "600x600"', () => {
      const regex = buildSizeRegex('600*600');
      expect(regex.test('600x600')).toBe(true);
      expect(regex.test('600*600')).toBe(true);
      expect(regex.test('600 X 600')).toBe(true);
    });

    it('13. Unit-bearing sizes are NOT incorrectly merged (16x16 mm vs 16x16 ft)', () => {
      const regexMm = buildSizeRegex('16x16 mm');
      expect(regexMm.test('16x16 mm')).toBe(true);
      expect(regexMm.test('16*16 MM')).toBe(true);
      expect(regexMm.test('16 X 16 mm')).toBe(true);

      // Must NOT match different unit or unitless
      expect(regexMm.test('16x16 ft')).toBe(false);
      expect(regexMm.test('16x16 inch')).toBe(false);
      expect(regexMm.test('16x16')).toBe(false);

      const regexPlain = buildSizeRegex('16x16');
      expect(regexPlain.test('16x16 mm')).toBe(false);
      expect(regexPlain.test('16x16 ft')).toBe(false);
    });

    it('14. Safely escapes regex metacharacters preventing regex injection', () => {
      const regex = buildSizeRegex('10x20 (Special.*)+?');
      expect(() => new RegExp(regex)).not.toThrow();
      expect(regex.test('10x20 (Special.*)+?')).toBe(true);
      expect(regex.test('10*20 (Special.*)+?')).toBe(true);
      expect(regex.test('10x20 anything')).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Distinct Sizes Endpoint
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /reports/tile-stock/sizes', () => {
    it('15. Returns distinct active product sizes sorted deterministically', async () => {
      mockProductModel.distinct.mockReturnValue({
        exec: jest.fn().mockResolvedValue(['600x600', '300x300', '4*4', '600*600', '2*2', '']),
      });

      const result = await service.getDistinctSizes();

      expect(mockProductModel.distinct).toHaveBeenCalledWith('size', { isActive: true });
      expect(result.sizes).toEqual(['2*2', '4*4', '300x300', '600*600', '600x600']);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Report Generation & Aggregation Logic
  // ───────────────────────────────────────────────────────────────────────────
  describe('GET /reports/tile-stock Data Generation', () => {
    const mockId1 = new Types.ObjectId();
    const mockId2 = new Types.ObjectId();
    const mockId3 = new Types.ObjectId();

    it('16. Only active products are matched in pipeline', async () => {
      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.getTileStockReport({ size: '16x16' });

      const pipeline = mockProductModel.aggregate.mock.calls[0][0];
      const matchStage = pipeline[0].$match;
      expect(matchStage.isActive).toBe(true);
      expect(matchStage.size).toBeDefined();
    });

    it('17. Product in multiple Gallas (20 boxes in Galla 01, 15 boxes in Galla 02) returns availableBoxes = 35', async () => {
      const mockAggregatedProducts = [
        {
          _id: mockId1,
          brand: 'Kajaria',
          productName: 'Royal Slate',
          category: 'Floor',
          size: '16x16',
          finish: 'Matte',
          color: 'Slate Grey',
          piecesPerBox: 8,
          sellingPrice: 850,
          images: [{ url: 'https://res.cloudinary.com/test/image1.jpg' }],
          availableBoxes: 35, // 20 + 15 summed across Gallas
        },
      ];

      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockAggregatedProducts),
      });

      const result = await service.getTileStockReport({ size: '16x16' });

      expect(result.items).toHaveLength(1);
      expect(result.items[0].availableBoxes).toBe(35);
      expect(result.summary.totalAvailableBoxes).toBe(35);
    });

    it('18. Product with zero stock: availableOnly=true (default) excludes zero-stock products', async () => {
      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: mockId1,
            brand: 'Kajaria',
            productName: 'Royal Slate',
            category: 'Floor',
            size: '16x16',
            finish: 'Matte',
            color: 'Grey',
            piecesPerBox: 8,
            sellingPrice: 850,
            images: [],
            availableBoxes: 10,
          },
        ]),
      });

      await service.getTileStockReport({ size: '16x16', availableOnly: true });

      const pipeline = mockProductModel.aggregate.mock.calls[0][0];
      const hasGtZeroMatch = pipeline.some(
        (stage: any) => stage.$match && stage.$match.availableBoxes?.$gt === 0,
      );
      expect(hasGtZeroMatch).toBe(true);
    });

    it('19. Product with zero stock: availableOnly=false includes zero-stock products with 0 boxes', async () => {
      const mockProducts = [
        {
          _id: mockId1,
          brand: 'Kajaria',
          productName: 'Zero Stock Design',
          category: 'Floor',
          size: '16x16',
          finish: 'Glossy',
          color: 'White',
          piecesPerBox: 10,
          sellingPrice: 500,
          images: [],
          availableBoxes: 0,
        },
      ];

      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue(mockProducts),
      });

      const result = await service.getTileStockReport({ size: '16x16', availableOnly: false });

      const pipeline = mockProductModel.aggregate.mock.calls[0][0];
      const hasGtZeroMatch = pipeline.some(
        (stage: any) => stage.$match && stage.$match.availableBoxes?.$gt === 0,
      );
      expect(hasGtZeroMatch).toBe(false);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].availableBoxes).toBe(0);
    });

    it('20. Product without images returns imageUrl: null (no throw, no secret leak)', async () => {
      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: mockId1,
            brand: 'Somany',
            productName: 'Marble White',
            category: 'Floor',
            size: '16x16',
            finish: 'Polished',
            color: 'Pure White',
            piecesPerBox: 8,
            sellingPrice: 920,
            images: [], // No images
            availableBoxes: 18,
          },
        ]),
      });

      const result = await service.getTileStockReport({ size: '16x16' });

      expect(result.items[0].imageUrl).toBeNull();
    });

    it('21. Product with multiple images uses images[0].url as primary display image', async () => {
      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: mockId1,
            brand: 'Somany',
            productName: 'Marble White',
            category: 'Floor',
            size: '16x16',
            finish: 'Polished',
            color: 'White',
            piecesPerBox: 8,
            sellingPrice: 920,
            images: [
              { url: 'https://res.cloudinary.com/test/primary.jpg' },
              { url: 'https://res.cloudinary.com/test/secondary.jpg' },
            ],
            availableBoxes: 18,
          },
        ]),
      });

      const result = await service.getTileStockReport({ size: '16x16' });

      expect(result.items[0].imageUrl).toBe('https://res.cloudinary.com/test/primary.jpg');
    });

    it('22. Correct piecesPerBox and sellingPricePerBox (converts Decimal128 properly)', async () => {
      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: mockId1,
            brand: 'Orient',
            productName: 'Grey Stone',
            category: 'Wall',
            size: '16x16',
            finish: 'Rustic',
            color: 'Grey',
            piecesPerBox: 12,
            sellingPrice: { toString: () => '750.50' }, // Decimal128 simulation
            images: [],
            availableBoxes: 25,
          },
        ]),
      });

      const result = await service.getTileStockReport({ size: '16x16' });

      expect(result.items[0].piecesPerBox).toBe(12);
      expect(result.items[0].sellingPricePerBox).toBe(750.5);
    });

    it('23. Summary counters accurately reflect returned items', async () => {
      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: mockId1,
            brand: 'Brand A',
            productName: 'Design 1',
            category: 'Floor',
            size: '16x16',
            finish: 'Matte',
            color: 'Black',
            piecesPerBox: 8,
            sellingPrice: 500,
            images: [],
            availableBoxes: 40,
          },
          {
            _id: mockId2,
            brand: 'Brand B',
            productName: 'Design 2',
            category: 'Wall',
            size: '16x16',
            finish: 'Glossy',
            color: 'White',
            piecesPerBox: 10,
            sellingPrice: 600,
            images: [],
            availableBoxes: 60,
          },
        ]),
      });

      const result = await service.getTileStockReport({ size: '16x16' });

      expect(result.summary.totalDesigns).toBe(2);
      expect(result.summary.totalAvailableBoxes).toBe(100);
      expect(result.items).toHaveLength(2);
    });

    it('24. Deterministic sorting: pipeline sorts by brand ASC, productName ASC, _id ASC', async () => {
      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      await service.getTileStockReport({ size: '16x16' });

      const pipeline = mockProductModel.aggregate.mock.calls[0][0];
      const sortStage = pipeline.find((stage: any) => stage.$sort);
      expect(sortStage).toBeDefined();
      expect(sortStage.$sort).toEqual({ brand: 1, productName: 1, _id: 1 });
    });

    it('25. Serial numbers are generated sequentially (1-indexed)', async () => {
      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: mockId1,
            brand: 'A',
            productName: 'Tile 1',
            category: 'Floor',
            size: '16x16',
            finish: 'M',
            color: 'C',
            piecesPerBox: 4,
            sellingPrice: 100,
            images: [],
            availableBoxes: 10,
          },
          {
            _id: mockId2,
            brand: 'B',
            productName: 'Tile 2',
            category: 'Floor',
            size: '16x16',
            finish: 'M',
            color: 'C',
            piecesPerBox: 4,
            sellingPrice: 100,
            images: [],
            availableBoxes: 15,
          },
          {
            _id: mockId3,
            brand: 'C',
            productName: 'Tile 3',
            category: 'Floor',
            size: '16x16',
            finish: 'M',
            color: 'C',
            piecesPerBox: 4,
            sellingPrice: 100,
            images: [],
            availableBoxes: 20,
          },
        ]),
      });

      const result = await service.getTileStockReport({ size: '16x16' });

      expect(result.items[0].serialNumber).toBe(1);
      expect(result.items[1].serialNumber).toBe(2);
      expect(result.items[2].serialNumber).toBe(3);
    });

    it('26. No Product.gallaId or Galla codes are exposed in report item response', async () => {
      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([
          {
            _id: mockId1,
            brand: 'Kajaria',
            productName: 'Royal Slate',
            category: 'Floor',
            size: '16x16',
            finish: 'Matte',
            color: 'Grey',
            piecesPerBox: 8,
            sellingPrice: 850,
            gallaId: new Types.ObjectId(),
            gallaNumber: 'GAL-01',
            images: [],
            availableBoxes: 25,
          },
        ]),
      });

      const result = await service.getTileStockReport({ size: '16x16' });
      const item = result.items[0] as any;

      expect(item.gallaId).toBeUndefined();
      expect(item.gallaNumber).toBeUndefined();
    });

    it('27. Empty result returns totalDesigns: 0, totalAvailableBoxes: 0 without error', async () => {
      mockProductModel.aggregate.mockReturnValue({
        exec: jest.fn().mockResolvedValue([]),
      });

      const result = await service.getTileStockReport({ size: '99x99' });

      expect(result.summary.totalDesigns).toBe(0);
      expect(result.summary.totalAvailableBoxes).toBe(0);
      expect(result.items).toEqual([]);
      expect(result.filterSize).toBe('99x99');
    });

    it('28. Service throws BadRequestException when size is empty in call', async () => {
      await expect(service.getTileStockReport({ size: '' } as any)).rejects.toThrow(
        BadRequestException,
      );
    });
  });
});

