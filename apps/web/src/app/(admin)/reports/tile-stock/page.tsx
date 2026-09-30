'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Download, FileText, Loader2, CheckCircle2, AlertCircle, Share2 } from 'lucide-react';
import {
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
} from '@/components/ui';
import {
  reportsApi,
  TileStockReportResponse,
} from '@/lib/api/reports';
import { ApiError } from '@/lib/api';
import { generateTileStockWhatsAppMessage } from '@/lib/whatsapp';
import {
  TileStockFilters,
  TileStockSummary,
  TileStockTable,
} from '@/components/reports';

export default function TileStockReportPage() {
  // Available sizes state
  const [sizes, setSizes] = useState<string[]>([]);
  const [isLoadingSizes, setIsLoadingSizes] = useState(true);
  const [sizesError, setSizesError] = useState<string | null>(null);

  // Filter selections
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [availableOnly, setAvailableOnly] = useState<boolean>(true);

  // Report generation state
  const [reportData, setReportData] = useState<TileStockReportResponse | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  // PDF download state
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  // WhatsApp share state
  const [isSharingWhatsApp, setIsSharingWhatsApp] = useState(false);
  const [whatsappSuccess, setWhatsappSuccess] = useState<string | null>(null);
  const [whatsappError, setWhatsappError] = useState<string | null>(null);

  // Load distinct sizes on mount
  const fetchSizes = useCallback(async () => {
    try {
      setIsLoadingSizes(true);
      setSizesError(null);
      const res = await reportsApi.getDistinctSizes();
      setSizes(res.sizes || []);
    } catch (err) {
      if (err instanceof ApiError) {
        setSizesError(err.message);
      } else if (err instanceof Error) {
        setSizesError(err.message);
      } else {
        setSizesError('Unable to load available tile sizes from the server.');
      }
    } finally {
      setIsLoadingSizes(false);
    }
  }, []);

  useEffect(() => {
    fetchSizes();
  }, [fetchSizes]);

  // Generate Report action
  const handleGenerateReport = async () => {
    if (!selectedSize || isGenerating) return;

    try {
      setIsGenerating(true);
      setReportError(null);
      setDownloadSuccess(null);
      setDownloadError(null);
      setWhatsappSuccess(null);
      setWhatsappError(null);

      const response = await reportsApi.getTileStockReport({
        size: selectedSize,
        availableOnly,
      });

      setReportData(response);
    } catch (err) {
      setReportData(null);
      if (err instanceof ApiError) {
        if (err.statusCode === 404) {
          setReportError(`No matching tile designs found for size "${selectedSize}".`);
        } else if (err.statusCode === 403) {
          setReportError('You do not have permission to view this report (Owner access required).');
        } else {
          setReportError(err.message || 'Unable to generate the report. Please try again.');
        }
      } else if (err instanceof Error) {
        setReportError(err.message);
      } else {
        setReportError('Unable to generate the report. Please try again.');
      }
    } finally {
      setIsGenerating(false);
    }
  };

  // Download PDF action
  const handleDownloadPdf = async () => {
    if (!selectedSize || isDownloadingPdf) return;

    try {
      setIsDownloadingPdf(true);
      setDownloadError(null);
      setDownloadSuccess(null);

      const { filename } = await reportsApi.downloadTileStockPdf(
        selectedSize,
        availableOnly,
      );

      setDownloadSuccess(`Downloaded ${filename}`);
      setTimeout(() => setDownloadSuccess(null), 5000);
    } catch (err) {
      if (err instanceof ApiError) {
        setDownloadError(err.message);
      } else if (err instanceof Error) {
        setDownloadError(err.message);
      } else {
        setDownloadError('Failed to download PDF report. Please try again.');
      }
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  /**
   * Share on WhatsApp:
   * 1. Generate professional message
   * 2. Fetch PDF blob from backend
   * 3a. Mobile: Web Share API → native share sheet with PDF + message → user picks WhatsApp & contact → sends
   * 3b. Desktop fallback: PDF downloads + wa.me?text= opens WhatsApp with message pre-filled
   */
  const handleShareOnWhatsApp = async () => {
    if (!selectedSize || isSharingWhatsApp || !reportData) return;

    try {
      setIsSharingWhatsApp(true);
      setWhatsappError(null);
      setWhatsappSuccess(null);

      // Generate the professional catalogue message
      const message = generateTileStockWhatsAppMessage({
        customerName: 'Customer',
        size: reportData.filterSize,
        totalDesigns: reportData.summary.totalDesigns,
        totalBoxes: reportData.summary.totalAvailableBoxes,
      });

      // Fetch PDF as blob
      const { blob, filename } = await reportsApi.fetchTileStockPdfBlob(
        selectedSize,
        availableOnly,
      );

      const pdfFile = new File([blob], filename, { type: 'application/pdf' });

      // Try Web Share API with file + message (works on Android/mobile Chrome & Safari)
      if (
        typeof navigator.share === 'function' &&
        typeof navigator.canShare === 'function' &&
        navigator.canShare({ files: [pdfFile] })
      ) {
        await navigator.share({
          files: [pdfFile],
          title: `Goverdhan Traders – Tile Stock ${reportData.filterSize}`,
          text: message,
        });
        setWhatsappSuccess('PDF and message shared successfully via WhatsApp.');
        setTimeout(() => setWhatsappSuccess(null), 5000);
        return;
      }

      // Desktop fallback: download PDF + open WhatsApp with pre-filled message
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(blobUrl);

      // Open WhatsApp with pre-filled message (no phone — user picks contact in WhatsApp)
      await new Promise((r) => setTimeout(r, 400));
      const encodedMessage = encodeURIComponent(message);
      window.open(`https://wa.me/?text=${encodedMessage}`, '_blank', 'noopener,noreferrer');

      setWhatsappSuccess(
        `PDF "${filename}" saved. WhatsApp opened with message — select contact and attach PDF.`,
      );
      setTimeout(() => setWhatsappSuccess(null), 8000);
    } catch (err) {
      // User cancelled the share sheet — not an error
      if (err instanceof Error && err.name === 'AbortError') {
        return;
      }
      if (err instanceof ApiError) {
        setWhatsappError(err.message);
      } else if (err instanceof Error) {
        setWhatsappError(err.message);
      } else {
        setWhatsappError('Failed to prepare PDF for sharing. Please try again.');
      }
    } finally {
      setIsSharingWhatsApp(false);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Page Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600 border border-blue-100">
              <FileText className="h-5 w-5" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              Tile Stock Report
            </h1>
          </div>
          <p className="mt-1.5 text-sm text-slate-500">
            Generate a size-wise live stock catalogue for customers.
          </p>
        </div>

        {/* Header Actions: Download PDF and Share on WhatsApp */}
        {reportData && reportData.items.length > 0 && (
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleDownloadPdf}
              disabled={isDownloadingPdf || isSharingWhatsApp}
              className="h-10 px-4 font-medium border-slate-300 shadow-xs hover:bg-slate-50 text-slate-800"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin text-blue-600" />
                  Preparing PDF...
                </>
              ) : (
                <>
                  <Download className="h-4 w-4 mr-2 text-slate-600" />
                  Download PDF
                </>
              )}
            </Button>

            <Button
              type="button"
              size="md"
              onClick={handleShareOnWhatsApp}
              disabled={isSharingWhatsApp || isDownloadingPdf}
              className="h-10 px-4 font-medium bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
            >
              {isSharingWhatsApp ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Preparing...
                </>
              ) : (
                <>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share on WhatsApp
                </>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Notifications / Feedback Banners */}
      {whatsappSuccess && (
        <div className="flex items-center justify-between rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
            <span>{whatsappSuccess}</span>
          </div>
          <button
            type="button"
            onClick={() => setWhatsappSuccess(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 ml-4 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {whatsappError && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{whatsappError}</span>
        </div>
      )}

      {downloadSuccess && (
        <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 flex-shrink-0" />
          <span>{downloadSuccess}</span>
        </div>
      )}

      {downloadError && (
        <div className="flex items-center gap-2.5 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          <AlertCircle className="h-4 w-4 text-rose-600 flex-shrink-0" />
          <span>{downloadError}</span>
        </div>
      )}

      {/* Filter and Selection Card */}
      <TileStockFilters
        sizes={sizes}
        isLoadingSizes={isLoadingSizes}
        selectedSize={selectedSize}
        onSizeChange={(size) => {
          setSelectedSize(size);
          setReportError(null);
          setDownloadSuccess(null);
          setDownloadError(null);
          setWhatsappSuccess(null);
          setWhatsappError(null);
        }}
        availableOnly={availableOnly}
        onAvailableOnlyChange={(val) => {
          setAvailableOnly(val);
        }}
        onGenerate={handleGenerateReport}
        isGenerating={isGenerating}
      />

      {/* Error loading sizes */}
      {sizesError && (
        <ErrorState
          title="Failed to Load Tile Sizes"
          message={sizesError}
          onRetry={fetchSizes}
        />
      )}

      {/* Loading state during report generation */}
      {isGenerating && (
        <div className="py-12">
          <LoadingState message="Aggregating live warehouse inventory..." />
        </div>
      )}

      {/* Error state during report generation */}
      {!isGenerating && reportError && (
        <ErrorState
          title="Could Not Generate Report"
          message={reportError}
          onRetry={handleGenerateReport}
        />
      )}

      {/* Report Data Preview */}
      {!isGenerating && !reportError && reportData && (
        <div className="space-y-6">
          {reportData.items.length === 0 ? (
            <EmptyState
              title="No tiles found"
              description={`No products are currently available for size "${reportData.filterSize}"${
                availableOnly ? ' with positive stock.' : '.'
              }`}
            />
          ) : (
            <>
              {/* Summary Metric Cards */}
              <TileStockSummary
                filterSize={reportData.filterSize}
                generatedAt={reportData.generatedAt}
                summary={reportData.summary}
              />

              {/* Data Preview Table */}
              <TileStockTable items={reportData.items} />
            </>
          )}
        </div>
      )}

      {/* Initial state before first generation */}
      {!isGenerating && !reportError && !reportData && !sizesError && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50/50 p-12 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blue-50 text-blue-600 mb-3 border border-blue-100">
            <FileText className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            Select a Size to Preview Catalogue
          </h3>
          <p className="mt-1.5 max-w-md mx-auto text-sm text-slate-500">
            Choose an available tile size above and click <strong>Generate Report</strong> to inspect live physical inventory, packaging, and commercial rates.
          </p>
        </div>
      )}
    </div>
  );
}
