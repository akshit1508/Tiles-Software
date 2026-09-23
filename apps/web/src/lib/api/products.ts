import { api } from './client';

export interface ImageReference {
  url: string;
  publicId?: string;
  alt?: string;
}

export interface Product {
  _id: string;
  brand: string;
  productName: string;
  gallaNumber: string;
  category: string;
  size: string;
  finish: string;
  color: string;
  piecesPerBox: number;
  areaPerBox: number | string | { $numberDecimal: string };
  purchasePrice: number | string | { $numberDecimal: string };
  sellingPrice: number | string | { $numberDecimal: string };
  minimumStockBoxes: number;
  minimumStockPieces?: number;
  initialStockBoxes?: number;
  incomingBoxes?: number;
  images: ImageReference[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedProducts {
  data: Product[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListProductsQuery {
  page?: number;
  limit?: number;
  brand?: string;
  category?: string;
  isActive?: boolean;
}

export interface CreateProductInput {
  brand: string;
  productName: string;
  gallaNumber: string;
  category: string;
  size: string;
  finish: string;
  color: string;
  piecesPerBox: number;
  areaPerBox: number;
  purchasePrice: number;
  sellingPrice: number;
  minimumStockBoxes?: number;
  minimumStockPieces?: number;
  initialStockBoxes?: number;
  incomingBoxes?: number;
  images?: ImageReference[];
}

export interface UpdateProductInput {
  brand?: string;
  productName?: string;
  gallaNumber?: string;
  category?: string;
  size?: string;
  finish?: string;
  color?: string;
  piecesPerBox?: number;
  areaPerBox?: number;
  purchasePrice?: number;
  sellingPrice?: number;
  minimumStockBoxes?: number;
  minimumStockPieces?: number;
  images?: ImageReference[];
}

/** Helper to parse Decimal128 / number values consistently */
export function parseDecimalValue(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') return parseFloat(val) || 0;
  if (val && typeof val === 'object' && '$numberDecimal' in val) {
    return parseFloat(String((val as { $numberDecimal: string }).$numberDecimal)) || 0;
  }
  return 0;
}

/** Formats a numeric price to Indian Rupee representation */
export function formatCurrencyINR(val: unknown): string {
  const num = parseDecimalValue(val);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

export const productsApi = {
  list: (query: ListProductsQuery = {}): Promise<PaginatedProducts> => {
    return api.get<PaginatedProducts>('/products', {
      params: {
        page: query.page,
        limit: query.limit,
        brand: query.brand || undefined,
        category: query.category || undefined,
        isActive: query.isActive !== undefined ? query.isActive : undefined,
      },
    });
  },

  getById: (id: string): Promise<{ product: Product }> => {
    return api.get<{ product: Product }>(`/products/${id}`);
  },

  create: (data: CreateProductInput): Promise<{ product: Product }> => {
    return api.post<{ product: Product }>('/products', data);
  },

  update: (id: string, data: UpdateProductInput): Promise<{ product: Product }> => {
    return api.patch<{ product: Product }>(`/products/${id}`, data);
  },

  deactivate: (id: string): Promise<{ product: Product }> => {
    return api.patch<{ product: Product }>(`/products/${id}/deactivate`);
  },

  activate: (id: string): Promise<{ product: Product }> => {
    return api.patch<{ product: Product }>(`/products/${id}/activate`);
  },

  uploadImages: (files: File[]): Promise<ImageReference[]> => {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('images', file);
    });
    return api.post<ImageReference[]>('/products/upload-images', formData);
  },
};
