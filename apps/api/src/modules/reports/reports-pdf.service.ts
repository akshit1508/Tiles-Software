import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import PDFDocument from 'pdfkit';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import * as fs from 'fs';
import * as path from 'path';
import {
  TileStockReportResponse,
  TileStockReportItem,
} from './interfaces/tile-stock-report.interface';

export interface DocumentFonts {
  regular: string;
  bold: string;
  medium: string;
}

@Injectable()
export class ReportsPdfService {
  private readonly logger = new Logger(ReportsPdfService.name);

  // Maximum allowed products per generated PDF document for server stability
  public static readonly MAX_PRODUCTS_PER_REPORT = 150;

  // Maximum milliseconds to wait for a single image download
  private static readonly IMAGE_DOWNLOAD_TIMEOUT_MS = 3500;

  /**
   * Resolves the filesystem path for a packaged font asset.
   * Checks multiple common locations for development (src), production (dist),
   * and monorepo execution contexts.
   */
  public resolveFontPath(fontFilename: string): string | null {
    const candidatePaths = [
      path.resolve(__dirname, '../../assets/fonts', fontFilename),
      path.resolve(__dirname, '../assets/fonts', fontFilename),
      path.resolve(__dirname, '../../../src/assets/fonts', fontFilename),
      path.resolve(process.cwd(), 'apps/api/src/assets/fonts', fontFilename),
      path.resolve(process.cwd(), 'apps/api/dist/assets/fonts', fontFilename),
      path.resolve(process.cwd(), 'src/assets/fonts', fontFilename),
      path.resolve(process.cwd(), 'dist/assets/fonts', fontFilename),
    ];

    for (const candidate of candidatePaths) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
    return null;
  }

  /**
   * Registers Unicode fonts (Roboto) with the PDF document.
   * Falls back gracefully to standard Helvetica if font files cannot be located.
   */
  public registerDocumentFonts(doc: PDFKit.PDFDocument): DocumentFonts {
    const regularPath = this.resolveFontPath('Roboto-Regular.ttf');
    const boldPath = this.resolveFontPath('Roboto-Bold.ttf');
    const mediumPath = this.resolveFontPath('Roboto-Medium.ttf');

    let regular = 'Helvetica';
    let bold = 'Helvetica-Bold';
    let medium = 'Helvetica';

    if (regularPath && fs.existsSync(regularPath)) {
      doc.registerFont('Roboto-Regular', regularPath);
      regular = 'Roboto-Regular';
    }
    if (boldPath && fs.existsSync(boldPath)) {
      doc.registerFont('Roboto-Bold', boldPath);
      bold = 'Roboto-Bold';
    }
    if (mediumPath && fs.existsSync(mediumPath)) {
      doc.registerFont('Roboto-Medium', mediumPath);
      medium = 'Roboto-Medium';
    }

    return { regular, bold, medium };
  }

  /**
   * Sanitizes a tile size string to create a safe, filesystem-friendly PDF filename.
   * e.g. "16x16" -> "16x16", "2*2" -> "2x2", "600*600 mm" -> "600x600_mm"
   */
  public buildPdfFilename(size: string, generatedAtIso: string): string {
    const dateStr = generatedAtIso
      ? new Date(generatedAtIso).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0];

    // Normalize multiplication signs and strip any unsafe filesystem characters
    const cleanSize = (size || 'All')
      .trim()
      .replace(/[*×]/g, 'x')
      .replace(/[^a-zA-Z0-9_\-]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_+|_+$/g, '');

    return `Goverdhan_Stock_${cleanSize || 'Report'}_${dateStr}.pdf`;
  }

  /**
   * Validates whether an image URL is safe to fetch (anti-SSRF guard).
   * Strictly permits only HTTPS requests to Cloudinary domains.
   */
  public isAllowedImageUrl(urlString: string): boolean {
    try {
      const parsed = new URL(urlString);
      if (parsed.protocol !== 'https:') {
        return false;
      }

      const hostname = parsed.hostname.toLowerCase();
      // Allow official Cloudinary delivery domains
      if (
        hostname === 'res.cloudinary.com' ||
        hostname.endsWith('.cloudinary.com')
      ) {
        return true;
      }

      return false;
    } catch {
      return false;
    }
  }

  /**
   * Optimizes a Cloudinary URL for fast PDF thumbnail embedding (240x240 JPG).
   */
  public optimizeCloudinaryUrl(originalUrl: string): string {
    if (!originalUrl || !originalUrl.includes('/upload/')) {
      return originalUrl;
    }
    // If not already transformed, inject thumbnail dimensions and format
    if (!originalUrl.includes('/upload/c_') && !originalUrl.includes('/upload/w_')) {
      return originalUrl.replace(
        '/upload/',
        '/upload/c_fill,w_240,h_240,q_auto,f_jpg/',
      );
    }
    return originalUrl;
  }

  /**
   * Downloads an image buffer safely with strict timeouts, SSRF guard, and size limit.
   */
  public async fetchImageBuffer(url: string): Promise<Buffer | null> {
    if (!this.isAllowedImageUrl(url)) {
      this.logger.warn(`Rejected untrusted image URL for PDF rendering: ${url}`);
      return null;
    }

    const optimizedUrl = this.optimizeCloudinaryUrl(url);

    return new Promise((resolve) => {
      let resolved = false;

      const finish = (result: Buffer | null) => {
        if (!resolved) {
          resolved = true;
          resolve(result);
        }
      };

      try {
        const parsed = new URL(optimizedUrl);
        const req = https.get(
          parsed,
          { timeout: ReportsPdfService.IMAGE_DOWNLOAD_TIMEOUT_MS },
          (res) => {
            if (res.statusCode !== 200) {
              res.resume();
              return finish(null);
            }

            const chunks: Buffer[] = [];
            let totalBytes = 0;
            // Cap downloaded image buffer at 3MB to prevent memory exhaustion
            const MAX_BYTES = 3 * 1024 * 1024;

            res.on('data', (chunk: Buffer) => {
              totalBytes += chunk.length;
              if (totalBytes > MAX_BYTES) {
                req.destroy();
                finish(null);
              } else {
                chunks.push(chunk);
              }
            });

            res.on('end', () => {
              try {
                const buffer = Buffer.concat(chunks);
                finish(buffer);
              } catch {
                finish(null);
              }
            });

            res.on('error', () => finish(null));
          },
        );

        req.on('timeout', () => {
          req.destroy();
          finish(null);
        });

        req.on('error', () => finish(null));
      } catch {
        finish(null);
      }
    });
  }

  /**
   * Pre-fetches all product thumbnails in parallel using Promise.allSettled().
   * A broken or slow image will never crash the PDF generation process.
   */
  public async fetchProductImages(
    items: TileStockReportItem[],
  ): Promise<Map<string, Buffer | null>> {
    const imageMap = new Map<string, Buffer | null>();
    const uniqueUrls = Array.from(
      new Set(items.map((i) => i.imageUrl).filter((u): u is string => Boolean(u))),
    );

    const downloadPromises = uniqueUrls.map(async (url) => {
      const buf = await this.fetchImageBuffer(url);
      return { url, buf };
    });

    const results = await Promise.allSettled(downloadPromises);
    for (const res of results) {
      if (res.status === 'fulfilled' && res.value) {
        imageMap.set(res.value.url, res.value.buf);
      }
    }

    return imageMap;
  }

  /**
   * Formats a numeric price into standard Indian Rupee format (e.g. ₹850 or ₹1,250).
   */
  public formatIndianPrice(amount: number): string {
    if (amount == null || isNaN(amount)) return '₹0.00';
    return `₹${amount.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  /**
   * Formats date string into human-readable customer format (e.g. 27 Sep 2026, 06:15 PM).
   */
  public formatReportDate(isoString: string): string {
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return isoString;
    }
  }

  /**
   * Generates a complete, multi-page vector PDF buffer for the Tile Stock Report.
   */
  public async generateTileStockPdf(
    reportData: TileStockReportResponse,
  ): Promise<Buffer> {
    if (!reportData || !reportData.items || reportData.items.length === 0) {
      throw new NotFoundException(
        `No matching tile designs found for size "${reportData?.filterSize || ''}"`,
      );
    }

    if (reportData.items.length > ReportsPdfService.MAX_PRODUCTS_PER_REPORT) {
      throw new BadRequestException(
        `Report contains too many designs (${reportData.items.length} designs). Maximum allowed is ${ReportsPdfService.MAX_PRODUCTS_PER_REPORT}. Please narrow your filter criteria.`,
      );
    }

    // Pre-fetch thumbnails with resilient error handling
    const imageMap = await this.fetchProductImages(reportData.items);

    return new Promise<Buffer>((resolve, reject) => {
      try {
        // A4 page setup: 595.28 x 841.89 points
        const doc = new PDFDocument({
          size: 'A4',
          margin: 36, // 0.5 inch margins
          bufferPages: true,
          info: {
            Title: `Goverdhan Traders - Tile Stock Report (${reportData.filterSize})`,
            Author: 'Goverdhan Traders',
            Subject: 'Tile Sample & Live Physical Stock Catalogue',
          },
        });

        const fonts = this.registerDocumentFonts(doc);

        const chunks: Buffer[] = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', (err) => reject(err));

        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const margin = 36;
        const printableWidth = pageWidth - margin * 2; // 523.28 pt
        const bottomThreshold = pageHeight - 48; // Space reserved for footer

        // ─────────────────────────────────────────────────────────────────────
        // 1. Draw Page 1 Header
        // ─────────────────────────────────────────────────────────────────────
        let currentY = margin;

        // Company Logo Mark / Badge
        doc
          .roundedRect(margin, currentY, 32, 32, 6)
          .fillAndStroke('#2563EB', '#1D4ED8');
        doc
          .font(fonts.bold)
          .fontSize(16)
          .fillColor('#FFFFFF')
          .text('GT', margin, currentY + 7, { width: 32, align: 'center' });

        // Company Brand Text
        doc
          .font(fonts.bold)
          .fontSize(18)
          .fillColor('#0F172A')
          .text('GOVERDHAN TRADERS', margin + 40, currentY + 1);

        doc
          .font(fonts.regular)
          .fontSize(8.5)
          .fillColor('#64748B')
          .text('Premium Vitrified, Ceramic & Wall Tile Management', margin + 40, currentY + 20);

        // Document Title Banner on Right
        doc
          .font(fonts.bold)
          .fontSize(12)
          .fillColor('#1E3A8A')
          .text('Tile Sample & Stock Report', margin, currentY + 4, {
            width: printableWidth,
            align: 'right',
          });

        doc
          .font(fonts.regular)
          .fontSize(8.5)
          .fillColor('#64748B')
          .text(`Generated: ${this.formatReportDate(reportData.generatedAt)}`, margin, currentY + 19, {
            width: printableWidth,
            align: 'right',
          });

        currentY += 42;

        // Divider
        doc
          .strokeColor('#E2E8F0')
          .lineWidth(1)
          .moveTo(margin, currentY)
          .lineTo(margin + printableWidth, currentY)
          .stroke();

        currentY += 8;

        // Summary KPI Bar
        const kpiHeight = 38;
        doc
          .roundedRect(margin, currentY, printableWidth, kpiHeight, 6)
          .fillAndStroke('#F8FAFC', '#E2E8F0');

        const colW = printableWidth / 4;

        // KPI 1: Selected Size
        doc
          .font(fonts.regular)
          .fontSize(7)
          .fillColor('#64748B')
          .text('CATALOGUE SIZE', margin + 12, currentY + 7);
        doc
          .font(fonts.bold)
          .fontSize(11)
          .fillColor('#0F172A')
          .text(reportData.filterSize.replace(/[*xX]/g, ' × '), margin + 12, currentY + 18);

        // KPI 2: Total Designs
        doc
          .font(fonts.regular)
          .fontSize(7)
          .fillColor('#64748B')
          .text('TOTAL DESIGNS', margin + colW, currentY + 7);
        doc
          .font(fonts.bold)
          .fontSize(11)
          .fillColor('#0F172A')
          .text(`${reportData.summary.totalDesigns} Models`, margin + colW, currentY + 18);

        // KPI 3: Live Stock
        doc
          .font(fonts.regular)
          .fontSize(7)
          .fillColor('#64748B')
          .text('AVAILABLE STOCK', margin + colW * 2, currentY + 7);
        doc
          .font(fonts.bold)
          .fontSize(12)
          .fillColor('#047857')
          .text(
            `${reportData.summary.totalAvailableBoxes.toLocaleString('en-IN')} Boxes`,
            margin + colW * 2,
            currentY + 18,
          );

        // KPI 4: Stock Status
        doc
          .font(fonts.regular)
          .fontSize(7)
          .fillColor('#64748B')
          .text('INVENTORY STATUS', margin + colW * 3, currentY + 7);
        doc
          .font(fonts.bold)
          .fontSize(10)
          .fillColor('#2563EB')
          .text('Live Warehouse Stock', margin + colW * 3, currentY + 19);

        currentY += kpiHeight + 12;

        // ─────────────────────────────────────────────────────────────────────
        // 2. Render Product Rows / Cards
        // ─────────────────────────────────────────────────────────────────────
        const cardHeight = 72;
        const cardGap = 7;

        reportData.items.forEach((item, index) => {
          // Check if space remains on page, else break to new page
          if (currentY + cardHeight > bottomThreshold) {
            doc.addPage();
            currentY = margin;

            // Compact running header for subsequent pages
            doc
              .font(fonts.bold)
              .fontSize(9)
              .fillColor('#0F172A')
              .text('GOVERDHAN TRADERS', margin, currentY);

            doc
              .font(fonts.regular)
              .fontSize(8)
              .fillColor('#64748B')
              .text(
                `Tile Sample & Live Stock Report • Size: ${reportData.filterSize.replace(/[*xX]/g, ' × ')}`,
                margin + 125,
                currentY,
              );

            doc
              .font(fonts.regular)
              .fontSize(8)
              .fillColor('#94A3B8')
              .text(this.formatReportDate(reportData.generatedAt), margin, currentY, {
                width: printableWidth,
                align: 'right',
              });

            currentY += 14;
            doc
              .strokeColor('#E2E8F0')
              .lineWidth(0.75)
              .moveTo(margin, currentY)
              .lineTo(margin + printableWidth, currentY)
              .stroke();

            currentY += 10;
          }

          // Card Background & Outline
          doc
            .roundedRect(margin, currentY, printableWidth, cardHeight, 5)
            .fillAndStroke('#FFFFFF', '#E2E8F0');

          // Left Accent Strip
          doc
            .roundedRect(margin, currentY, 3.5, cardHeight, 1)
            .fill('#3B82F6');

          // ── Column A: S.No (width ~ 32 pt) ──
          const sNoX = margin + 8;
          doc
            .roundedRect(sNoX, currentY + 23, 24, 24, 12)
            .fillAndStroke('#F1F5F9', '#CBD5E1');
          doc
            .font(fonts.bold)
            .fontSize(9)
            .fillColor('#475569')
            .text(
              item.serialNumber < 10 ? `0${item.serialNumber}` : `${item.serialNumber}`,
              sNoX,
              currentY + 30,
              { width: 24, align: 'center', lineBreak: false },
            );

          // ── Column B: Image Thumbnail (60 x 60 pt) ──
          const imgX = sNoX + 30;
          const imgY = currentY + 6;
          const imgBoxSize = 60;

          const imgBuffer = item.imageUrl ? imageMap.get(item.imageUrl) : null;

          if (imgBuffer) {
            try {
              doc
                .roundedRect(imgX, imgY, imgBoxSize, imgBoxSize, 4)
                .fillAndStroke('#FFFFFF', '#CBD5E1');
              doc.image(imgBuffer, imgX + 1, imgY + 1, {
                fit: [imgBoxSize - 2, imgBoxSize - 2],
                align: 'center',
                valign: 'center',
              });
            } catch {
              this.drawNoImagePlaceholder(doc, imgX, imgY, imgBoxSize, fonts);
            }
          } else {
            this.drawNoImagePlaceholder(doc, imgX, imgY, imgBoxSize, fonts);
          }

          // ── Column C: Design & Specifications (width ~ 150 pt) ──
          const descX = imgX + imgBoxSize + 12;
          const descW = 150;

          // Brand Label
          doc
            .font(fonts.bold)
            .fontSize(7.5)
            .fillColor('#64748B')
            .text((item.brand || 'PREMIUM BRAND').toUpperCase(), descX, currentY + 9, {
              width: descW,
              ellipsis: true,
              lineBreak: false,
            });

          // Product / Design Name
          doc.font(fonts.bold).fontSize(10.5);
          const rawNameHeight = doc.heightOfString(item.productName, { width: descW });
          const nameHeight = Math.min(24, Math.max(12, rawNameHeight));

          doc
            .fillColor('#0F172A')
            .text(item.productName, descX, currentY + 19, {
              width: descW,
              height: 24,
              ellipsis: true,
            });

          // Category & Color Tags (Surface Finish has its own dedicated column)
          const specsText = [item.category, item.color]
            .filter(Boolean)
            .join(' • ');

          const specsY = currentY + 19 + nameHeight + 2;
          if (specsText) {
            doc
              .font(fonts.regular)
              .fontSize(7.5)
              .fillColor('#475569')
              .text(specsText, descX, specsY, {
                width: descW,
                ellipsis: true,
                lineBreak: false,
              });
          }

          // Tile Dimensions spec
          doc
            .font(fonts.regular)
            .fontSize(7)
            .fillColor('#64748B')
            .text(`Tile Size: ${item.size}`, descX, specsY + (specsText ? 10 : 2), { lineBreak: false });

          // ── Column D: Surface Finish (width ~ 72 pt) ──
          const finishX = descX + descW + 8;
          const finishW = 72;

          doc
            .font(fonts.regular)
            .fontSize(6.5)
            .fillColor('#64748B')
            .text('SURFACE FINISH', finishX, currentY + 16, { width: finishW, align: 'center', lineBreak: false });

          const finishStr = item.finish ? item.finish.trim() : 'Standard';
          doc
            .font(fonts.bold)
            .fontSize(10.5)
            .fillColor('#0F172A')
            .text(finishStr, finishX, currentY + 27, { width: finishW, align: 'center', lineBreak: false });

          doc
            .font(fonts.regular)
            .fontSize(6.5)
            .fillColor('#94A3B8')
            .text('texture', finishX, currentY + 43, { width: finishW, align: 'center', lineBreak: false });

          // ── Column E: Live Available Stock (width ~ 74 pt) ──
          const stockX = finishX + finishW + 8;
          const stockW = 74;

          doc
            .font(fonts.regular)
            .fontSize(6.5)
            .fillColor('#64748B')
            .text('AVAILABLE STOCK', stockX, currentY + 16, { width: stockW, align: 'center', lineBreak: false });

          const stockColor = item.availableBoxes > 0 ? '#047857' : '#DC2626';
          const stockLabel =
            item.availableBoxes === 1
              ? '1 Box'
              : `${item.availableBoxes.toLocaleString('en-IN')} Boxes`;

          doc
            .font(fonts.bold)
            .fontSize(10.5)
            .fillColor(stockColor)
            .text(stockLabel, stockX, currentY + 27, { width: stockW, align: 'center', lineBreak: false });

          doc
            .font(fonts.regular)
            .fontSize(6.5)
            .fillColor('#64748B')
            .text('in warehouse', stockX, currentY + 43, { width: stockW, align: 'center', lineBreak: false });

          // ── Column F: Packaging Details (width ~ 85 pt) ──
          const packX = stockX + stockW + 8;
          const packW = printableWidth - (packX - margin) - 8;

          doc
            .font(fonts.regular)
            .fontSize(6.5)
            .fillColor('#64748B')
            .text('TILES / BOX', packX, currentY + 16, { width: packW, align: 'center', lineBreak: false });

          doc
            .font(fonts.bold)
            .fontSize(10)
            .fillColor('#334155')
            .text(`${item.piecesPerBox} pcs`, packX, currentY + 29, { width: packW, align: 'center', lineBreak: false });

          doc
            .font(fonts.regular)
            .fontSize(6.5)
            .fillColor('#94A3B8')
            .text('standard pack', packX, currentY + 43, { width: packW, align: 'center', lineBreak: false });

          currentY += cardHeight + cardGap;
        });

        // ─────────────────────────────────────────────────────────────────────
        // 3. Add Page Footers (Page X of Y)
        // ─────────────────────────────────────────────────────────────────────
        const range = doc.bufferedPageRange();
        for (let i = 0; i < range.count; i++) {
          doc.switchToPage(i);
          // Set bottom margin to 0 during footer rendering to prevent auto page-breaks
          doc.page.margins.bottom = 0;

          const footerY = pageHeight - 30;

          // Subtle footer separator
          doc
            .strokeColor('#E2E8F0')
            .lineWidth(0.5)
            .moveTo(margin, footerY - 5)
            .lineTo(margin + printableWidth, footerY - 5)
            .stroke();

          // Left disclaimer
          doc
            .font(fonts.regular)
            .fontSize(7.5)
            .fillColor('#94A3B8')
            .text(
              'Goverdhan Traders Tile Management System • Stock subject to physical warehouse confirmation.',
              margin,
              footerY,
              { width: printableWidth - 90, lineBreak: false },
            );

          // Right page count
          doc
            .font(fonts.bold)
            .fontSize(8)
            .fillColor('#64748B')
            .text(`Page ${i + 1} of ${range.count}`, margin, footerY, {
              width: printableWidth,
              align: 'right',
              lineBreak: false,
            });
        }

        // Finalize document
        doc.end();
      } catch (err) {
        this.logger.error('Failed to generate PDF document:', err);
        reject(err);
      }
    });
  }

  /**
   * Draws a clean, professional vector placeholder when an image is missing or unreachable.
   */
  private drawNoImagePlaceholder(
    doc: PDFKit.PDFDocument,
    x: number,
    y: number,
    size: number,
    fonts?: DocumentFonts,
  ) {
    // Outer framed box
    doc
      .roundedRect(x, y, size, size, 4)
      .fillAndStroke('#F8FAFC', '#CBD5E1');

    // Mini vector tile icon (4 small squares)
    const iconX = x + size / 2 - 8;
    const iconY = y + 13;
    doc.rect(iconX, iconY, 6, 6).fill('#CBD5E1');
    doc.rect(iconX + 8, iconY, 6, 6).fill('#CBD5E1');
    doc.rect(iconX, iconY + 8, 6, 6).fill('#CBD5E1');
    doc.rect(iconX + 8, iconY + 8, 6, 6).fill('#CBD5E1');

    // Placeholder text
    doc
      .font(fonts?.bold || 'Helvetica-Bold')
      .fontSize(6)
      .fillColor('#94A3B8')
      .text('TILE IMAGE', x, y + 33, { width: size, align: 'center' });

    doc
      .font(fonts?.regular || 'Helvetica')
      .fontSize(5.5)
      .fillColor('#94A3B8')
      .text('NOT AVAILABLE', x, y + 42, { width: size, align: 'center' });
  }
}
