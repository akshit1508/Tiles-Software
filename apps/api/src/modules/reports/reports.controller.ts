import {
  Controller,
  Get,
  Query,
  Res,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { ReportsService } from './reports.service';
import { ReportsPdfService } from './reports-pdf.service';
import { TileStockReportQueryDto } from './dto';
import {
  TileStockReportResponse,
  DistinctSizesResponse,
} from './interfaces/tile-stock-report.interface';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../../common/enums';

@Controller('reports')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportsController {
  constructor(
    private readonly reportsService: ReportsService,
    private readonly reportsPdfService: ReportsPdfService,
  ) {}

  /**
   * GET /reports/tile-stock/sizes
   *
   * Returns a deterministically sorted list of all distinct tile sizes
   * present on active products.
   * Access: OWNER only.
   */
  @Get('tile-stock/sizes')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  getDistinctSizes(): Promise<DistinctSizesResponse> {
    return this.reportsService.getDistinctSizes();
  }

  /**
   * GET /reports/tile-stock
   *
   * Returns matching tile designs for a given size with live box stock
   * aggregated across all Gallas, pricing, image, and packaging info.
   * Access: OWNER only.
   */
  @Get('tile-stock')
  @Roles(UserRole.OWNER)
  @HttpCode(HttpStatus.OK)
  getTileStockReport(
    @Query() query: TileStockReportQueryDto,
  ): Promise<TileStockReportResponse> {
    return this.reportsService.getTileStockReport(query);
  }

  /**
   * GET /reports/tile-stock/pdf
   *
   * Generates and downloads a multi-page, professional customer-facing
   * PDF catalogue with live physical warehouse stock.
   * Access: OWNER only.
   */
  @Get('tile-stock/pdf')
  @Roles(UserRole.OWNER)
  async downloadTileStockPdf(
    @Query() query: TileStockReportQueryDto,
    @Res() res: Response,
  ): Promise<void> {
    const reportData = await this.reportsService.getTileStockReport(query);
    const filename = this.reportsPdfService.buildPdfFilename(
      reportData.filterSize,
      reportData.generatedAt,
    );
    const pdfBuffer = await this.reportsPdfService.generateTileStockPdf(reportData);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': pdfBuffer.length.toString(),
    });

    res.end(pdfBuffer);
  }
}
