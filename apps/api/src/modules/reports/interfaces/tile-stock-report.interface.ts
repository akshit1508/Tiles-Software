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
