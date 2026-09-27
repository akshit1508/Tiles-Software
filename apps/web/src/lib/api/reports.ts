import { api, getApiBaseUrl } from './client';
import { ApiError } from './errors';

export interface TileStockReportItem {
  serialNumber: number;
  productId: string;
  brand: string;
  productName: string;
  category: string;
  size: string;
  finish: string;
  color: string;
  piecesPerBox: number;
  sellingPricePerBox: number;
  availableBoxes: number;
  imageUrl: string | null;
}

export interface TileStockReportSummary {
  totalDesigns: number;
  totalAvailableBoxes: number;
}

export interface TileStockReportResponse {
  reportTitle: string;
  filterSize: string;
  generatedAt: string;
  summary: TileStockReportSummary;
  items: TileStockReportItem[];
}

export interface DistinctSizesResponse {
  sizes: string[];
}

export interface TileStockReportQueryParams {
  size: string;
  availableOnly?: boolean;
}

export const reportsApi = {
  /**
   * Fetches distinct sizes of active products from the backend.
   */
  getDistinctSizes: (): Promise<DistinctSizesResponse> => {
    return api.get<DistinctSizesResponse>('/reports/tile-stock/sizes');
  },

  /**
   * Generates and returns the size-wise tile stock report data.
   */
  getTileStockReport: (
    params: TileStockReportQueryParams,
  ): Promise<TileStockReportResponse> => {
    return api.get<TileStockReportResponse>('/reports/tile-stock', {
      params: {
        size: params.size,
        availableOnly: params.availableOnly !== undefined ? params.availableOnly : true,
      },
    });
  },

  /**
   * Downloads the server-generated professional PDF catalogue for the specified size.
   * Performs an authenticated fetch and triggers browser file download.
   */
  downloadTileStockPdf: async (
    size: string,
    availableOnly = true,
  ): Promise<{ filename: string; sizeBytes: number }> => {
    const baseUrl = getApiBaseUrl();
    const searchParams = new URLSearchParams({
      size,
      availableOnly: String(availableOnly),
    });
    const url = `${baseUrl}/reports/tile-stock/pdf?${searchParams.toString()}`;

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
    });

    if (!response.ok) {
      let errorMessage = 'Failed to generate and download PDF report.';
      try {
        const errorJson = await response.json();
        errorMessage = errorJson.message || errorMessage;
      } catch {
        // Response is not JSON
      }
      throw new ApiError({
        statusCode: response.status,
        message: errorMessage,
        path: '/reports/tile-stock/pdf',
      });
    }

    // Extract filename from Content-Disposition header if provided by backend
    let filename = `Goverdhan_Stock_${size.replace(/[*×]/g, 'x')}.pdf`;
    const disposition = response.headers.get('content-disposition');
    if (disposition && disposition.includes('filename=')) {
      const match = disposition.match(/filename="?([^";]+)"?/);
      if (match && match[1]) {
        filename = match[1].trim();
      }
    }

    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(downloadUrl);

    return { filename, sizeBytes: blob.size };
  },
};
