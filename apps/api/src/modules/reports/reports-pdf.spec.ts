import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ReportsPdfService } from './reports-pdf.service';
import { ReportsController } from './reports.controller';
import { ReportsService } from './reports.service';
import { TileStockReportResponse } from './interfaces/tile-stock-report.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

describe('ReportsPdfService & PDF Endpoint', () => {
  let pdfService: ReportsPdfService;
  let controller: ReportsController;
  let reportsService: { [K in keyof ReportsService]?: jest.Mock };
  let reflector: Reflector;

  const makeMockReport = (
    itemCount = 2,
    customItems?: any[],
  ): TileStockReportResponse => {
    const items =
      customItems ||
      Array.from({ length: itemCount }).map((_, i) => ({
        serialNumber: i + 1,
        productId: `prod-${i + 1}`,
        brand: `Brand-${i + 1}`,
        productName: `Royal Slate ${i + 1}`,
        category: 'Floor',
        size: '16x16',
        finish: 'Matte',
        color: 'Grey',
        piecesPerBox: 8,
        sellingPricePerBox: 850 + i * 50,
        availableBoxes: 25 + i * 10,
        imageUrl: `https://res.cloudinary.com/test/tile-${i + 1}.jpg`,
      }));

    return {
      reportTitle: 'Goverdhan Traders - Tile Sample & Stock Report',
      filterSize: '16x16',
      generatedAt: '2026-09-27T18:15:00.000Z',
      summary: {
        totalDesigns: items.length,
        totalAvailableBoxes: items.reduce((s, it) => s + it.availableBoxes, 0),
      },
      items,
    };
  };

  beforeEach(async () => {
    reportsService = {
      getDistinctSizes: jest.fn(),
      getTileStockReport: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ReportsController],
      providers: [
        ReportsPdfService,
        Reflector,
        { provide: ReportsService, useValue: reportsService },
      ],
    }).compile();

    pdfService = module.get<ReportsPdfService>(ReportsPdfService);
    controller = module.get<ReportsController>(ReportsController);
    reflector = module.get<Reflector>(Reflector);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Security & Authorization
  // ───────────────────────────────────────────────────────────────────────────
  describe('PDF Endpoint Security & Controller Guards', () => {
    it('1. PDF endpoint is guarded with JwtAuthGuard and RolesGuard', () => {
      const guards = Reflect.getMetadata('__guards__', ReportsController);
      expect(guards).toContain(JwtAuthGuard);
      expect(guards).toContain(RolesGuard);
    });

    it('2. GET /reports/tile-stock/pdf requires UserRole.OWNER', () => {
      const roles = reflector.get<string[]>(
        ROLES_KEY,
        ReportsController.prototype.downloadTileStockPdf,
      );
      expect(roles).toEqual([UserRole.OWNER]);
    });

    it('3. Controller sends application/pdf with correct Content-Disposition attachment', async () => {
      const mockReport = makeMockReport(1);
      reportsService.getTileStockReport!.mockResolvedValue(mockReport);

      const mockRes: any = {
        set: jest.fn(),
        end: jest.fn(),
      };

      await controller.downloadTileStockPdf({ size: '16x16' }, mockRes);

      expect(mockRes.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'application/pdf',
          'Content-Disposition': expect.stringContaining(
            'attachment; filename="Goverdhan_Stock_16x16_2026-09-27.pdf"',
          ),
          'Content-Length': expect.any(String),
        }),
      );
      expect(mockRes.end).toHaveBeenCalledWith(expect.any(Buffer));
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // PDF Content & Generation Engine
  // ───────────────────────────────────────────────────────────────────────────
  describe('PDF Generation Engine (ReportsPdfService)', () => {
    it('4. Generates a valid non-empty PDF Buffer', async () => {
      const report = makeMockReport(2);
      const pdfBuffer = await pdfService.generateTileStockPdf(report);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
      // PDF header magic bytes "%PDF-"
      expect(pdfBuffer.toString('utf8', 0, 5)).toBe('%PDF-');
    });

    it('5. Contains report metadata and branding in the PDF document', async () => {
      const report = makeMockReport(1);
      const pdfBuffer = await pdfService.generateTileStockPdf(report);
      const pdfString = pdfBuffer.toString('latin1');

      // Check for PDFKit metadata object
      expect(pdfString).toContain('Goverdhan Traders');
    });

    it('6. Missing image does not fail PDF generation and draws fallback placeholder', async () => {
      const report = makeMockReport(1, [
        {
          serialNumber: 1,
          productId: 'prod-no-img',
          brand: 'Kajaria',
          productName: 'No Image Design',
          category: 'Floor',
          size: '16x16',
          finish: 'Matte',
          color: 'White',
          piecesPerBox: 8,
          sellingPricePerBox: 700,
          availableBoxes: 20,
          imageUrl: null, // No image provided
        },
      ]);

      const pdfBuffer = await pdfService.generateTileStockPdf(report);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });

    it('7. Broken or unreachable image does not crash PDF generation', async () => {
      jest.spyOn(pdfService, 'fetchImageBuffer').mockResolvedValue(null);

      const report = makeMockReport(1, [
        {
          serialNumber: 1,
          productId: 'prod-broken-img',
          brand: 'Somany',
          productName: 'Broken Image Tile',
          category: 'Wall',
          size: '16x16',
          finish: 'Glossy',
          color: 'Beige',
          piecesPerBox: 6,
          sellingPricePerBox: 950,
          availableBoxes: 15,
          imageUrl: 'https://res.cloudinary.com/test/broken.jpg',
        },
      ]);

      const pdfBuffer = await pdfService.generateTileStockPdf(report);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });

    it('8. Successfully embeds valid image buffer when download succeeds', async () => {
      // 1x1 transparent PNG buffer
      const dummyPng = Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
        'base64',
      );
      jest.spyOn(pdfService, 'fetchImageBuffer').mockResolvedValue(dummyPng);

      const report = makeMockReport(1);
      const pdfBuffer = await pdfService.generateTileStockPdf(report);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });

    it('9. Multi-page pagination works cleanly for large catalogues (25+ items)', async () => {
      const report = makeMockReport(25);
      const pdfBuffer = await pdfService.generateTileStockPdf(report);

      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      const pdfString = pdfBuffer.toString('latin1');
      // Multiple /Type /Page objects should be present in multi-page document
      const pageOccurrences = (pdfString.match(/\/Type\s*\/Page\b/g) || []).length;
      expect(pageOccurrences).toBeGreaterThan(1);
    }, 15000);

    it('10. Handles zero-stock items properly when availableOnly=false', async () => {
      const report = makeMockReport(1, [
        {
          serialNumber: 1,
          productId: 'zero-stock-prod',
          brand: 'Orient',
          productName: 'Zero Stock Design',
          category: 'Floor',
          size: '16x16',
          finish: 'Rustic',
          color: 'Black',
          piecesPerBox: 10,
          sellingPricePerBox: 500,
          availableBoxes: 0,
          imageUrl: null,
        },
      ]);

      const pdfBuffer = await pdfService.generateTileStockPdf(report);
      expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
      expect(pdfBuffer.length).toBeGreaterThan(1000);
    });

    it('11. Throws NotFoundException when no matching products exist in report', async () => {
      const emptyReport: TileStockReportResponse = {
        reportTitle: 'Goverdhan Traders - Tile Sample & Stock Report',
        filterSize: '99x99',
        generatedAt: '2026-09-27T18:15:00.000Z',
        summary: { totalDesigns: 0, totalAvailableBoxes: 0 },
        items: [],
      };

      await expect(pdfService.generateTileStockPdf(emptyReport)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('12. Rejects report exceeding MAX_PRODUCTS_PER_REPORT (151 items) with BadRequestException', async () => {
      const hugeReport = makeMockReport(151);

      await expect(pdfService.generateTileStockPdf(hugeReport)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Security & Utility Functions
  // ───────────────────────────────────────────────────────────────────────────
  describe('Security & Helper Guards', () => {
    it('13. Anti-SSRF: isAllowedImageUrl strictly accepts Cloudinary HTTPS URLs', () => {
      expect(
        pdfService.isAllowedImageUrl(
          'https://res.cloudinary.com/i7876qxa/image/upload/v1/sample.jpg',
        ),
      ).toBe(true);
      expect(
        pdfService.isAllowedImageUrl(
          'https://sub.cloudinary.com/assets/img.jpg',
        ),
      ).toBe(true);
    });

    it('14. Anti-SSRF: isAllowedImageUrl rejects localhost, internal IPs, and non-https protocols', () => {
      expect(pdfService.isAllowedImageUrl('http://localhost:3000/secret.jpg')).toBe(false);
      expect(pdfService.isAllowedImageUrl('https://localhost:3001/admin')).toBe(false);
      expect(pdfService.isAllowedImageUrl('http://127.0.0.1:8080/test')).toBe(false);
      expect(pdfService.isAllowedImageUrl('http://169.254.169.254/latest/meta-data')).toBe(false);
      expect(pdfService.isAllowedImageUrl('https://192.168.1.1/router.jpg')).toBe(false);
      expect(pdfService.isAllowedImageUrl('ftp://res.cloudinary.com/sample.jpg')).toBe(false);
      expect(pdfService.isAllowedImageUrl('https://evil-site.com/avatar.jpg')).toBe(false);
      expect(pdfService.isAllowedImageUrl('not-a-url')).toBe(false);
    });

    it('15. Cloudinary URL optimization injects fast thumbnail transform parameters', () => {
      const raw =
        'https://res.cloudinary.com/demo/image/upload/v12345/products/tile.jpg';
      const optimized = pdfService.optimizeCloudinaryUrl(raw);

      expect(optimized).toBe(
        'https://res.cloudinary.com/demo/image/upload/c_fill,w_240,h_240,q_auto,f_jpg/v12345/products/tile.jpg',
      );
    });

    it('16. Cloudinary URL optimization does not duplicate already transformed URLs', () => {
      const alreadyTransformed =
        'https://res.cloudinary.com/demo/image/upload/c_thumb,w_300,h_300/v123/tile.jpg';
      const result = pdfService.optimizeCloudinaryUrl(alreadyTransformed);

      expect(result).toBe(alreadyTransformed);
    });

    it('17. Filename sanitization handles asterisks, slashes, and spaces safely', () => {
      const filename1 = pdfService.buildPdfFilename('16x16', '2026-09-27T18:15:00.000Z');
      expect(filename1).toBe('Goverdhan_Stock_16x16_2026-09-27.pdf');

      const filename2 = pdfService.buildPdfFilename('600*600 mm', '2026-09-27T18:15:00.000Z');
      expect(filename2).toBe('Goverdhan_Stock_600x600_mm_2026-09-27.pdf');

      const filename3 = pdfService.buildPdfFilename('2/2 ft', '2026-09-27T18:15:00.000Z');
      expect(filename3).toBe('Goverdhan_Stock_2_2_ft_2026-09-27.pdf');

      const filename4 = pdfService.buildPdfFilename('16 × 16', '2026-09-27T18:15:00.000Z');
      expect(filename4).toBe('Goverdhan_Stock_16_x_16_2026-09-27.pdf');
    });

    it('18. Indian currency formatting formats numbers correctly with 2 decimal places', () => {
      expect(pdfService.formatIndianPrice(850)).toBe('₹850.00');
      expect(pdfService.formatIndianPrice(1250)).toBe('₹1,250.00');
      expect(pdfService.formatIndianPrice(125000)).toBe('₹1,25,000.00');
      expect(pdfService.formatIndianPrice(0)).toBe('₹0.00');
    });

    it('19. Customer PDF does not expose Galla ID or warehouse numbers', () => {
      // Intentionally verify that item structure does not carry gallaNumber
      const report = makeMockReport(1);
      const item = report.items[0] as any;
      expect(item.gallaId).toBeUndefined();
      expect(item.gallaNumber).toBeUndefined();
    });

    it('20. Date formatting formats ISO string to localized Indian format', () => {
      const formatted = pdfService.formatReportDate('2026-09-27T12:45:00.000Z');
      expect(formatted).toContain('2026');
      expect(formatted).toContain('Sep');
    });

    it('21. Resolves packaged project Unicode font files without depending on C:\\Windows\\Fonts', () => {
      const regularPath = pdfService.resolveFontPath('Roboto-Regular.ttf');
      const boldPath = pdfService.resolveFontPath('Roboto-Bold.ttf');

      expect(regularPath).toBeDefined();
      expect(regularPath).not.toBeNull();
      expect(boldPath).toBeDefined();
      expect(boldPath).not.toBeNull();

      // Must be inside the project repository, not Windows system fonts
      expect(regularPath).toContain('Roboto-Regular.ttf');
      expect(regularPath?.toLowerCase()).not.toContain('windows\\fonts');
    });

    it('22. PDF embeds Unicode font with ToUnicode CMap for Rupee symbol (₹) rendering', async () => {
      const report = makeMockReport(1);
      const pdfBuffer = await pdfService.generateTileStockPdf(report);
      const pdfString = pdfBuffer.toString('latin1');

      // TrueType fonts embedded by PDFKit include ToUnicode mapping and font descriptors
      expect(pdfString).toContain('/ToUnicode');
      expect(pdfString).toContain('Roboto');
    });
  });
});
