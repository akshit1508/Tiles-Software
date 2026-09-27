import { api } from './client';
import { Product } from './products';

export interface InventoryItem {
  _id: string;
  productId: Product | string;
  gallaId?: string;
  gallaNumber?: string;
  totalPieces: number;
  fullBoxes: number;
  loosePieces: number;
  totalSqFt: number;
  minimumStockBoxes: number;
  isLowStock: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type InventoryTransactionType =
  | 'STOCK_IN'
  | 'SALE'
  | 'DAMAGE'
  | 'ADJUSTMENT'
  | 'SALE_REVERSAL';

export interface InventoryTransaction {
  _id: string;
  productId: string;
  gallaId?: string;
  gallaNumber?: string;
  transactionType: InventoryTransactionType;
  physicalPieces: number;
  salesQuantity?: number | { $numberDecimal: string };
  salesUnit?: 'BOX' | 'PIECE' | 'SQ_FT';
  orderId?: string;
  reason?: string;
  createdBy: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ProductLocationStock {
  gallaId?: string;
  gallaNumber?: string;
  gallaName?: string;
  boxes: number;
  totalPieces: number;
  updatedAt?: string;
}

export interface ProductLocationsResponse {
  productId: string;
  totalBoxes: number;
  totalPieces: number;
  locations: ProductLocationStock[];
}

export interface ListInventoryQuery {
  page?: number;
  limit?: number;
  gallaId?: string;
  lowStockOnly?: boolean;
  search?: string;
}

export interface StockInInput {
  productId: string;
  gallaId?: string;
  gallaNumber?: string;
  quantity: number;
  unit: 'BOX';
}

export interface DamageStockInput {
  productId: string;
  gallaId?: string;
  quantity: number;
  unit: 'BOX' | 'PIECE';
  reason: string;
}

export interface AdjustmentInput {
  productId: string;
  gallaId?: string;
  physicalPieces: number;
  reason: string;
}

export interface ListHistoryQuery {
  page?: number;
  limit?: number;
  transactionType?: InventoryTransactionType;
}

export interface PaginatedInventory {
  data: InventoryItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedHistory {
  data: InventoryTransaction[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const inventoryApi = {
  /**
   * List inventory items with derived unit values and low-stock indicators.
   * Query parameters strictly follow backend ListInventoryDto.
   */
  list: (query: ListInventoryQuery = {}): Promise<PaginatedInventory> => {
    return api.get<PaginatedInventory>('/inventory', {
      params: {
        page: query.page,
        limit: query.limit,
        gallaId: query.gallaId || undefined,
        lowStockOnly: query.lowStockOnly !== undefined ? query.lowStockOnly : undefined,
        search: query.search?.trim() ? query.search.trim() : undefined,
      },
    });
  },

  /**
   * Get single product inventory details.
   */
  getByProductId: (productId: string): Promise<{ inventory: InventoryItem }> => {
    return api.get<{ inventory: InventoryItem }>(`/inventory/${productId}`);
  },

  /**
   * Get physical location stock breakdown for a product across all Gallas.
   */
  getProductLocations: (productId: string): Promise<ProductLocationsResponse> => {
    return api.get<ProductLocationsResponse>(`/inventory/product/${productId}/locations`);
  },

  /**
   * Get paginated audit transaction history for a product.
   */
  getHistory: (
    productId: string,
    query: ListHistoryQuery = {},
  ): Promise<PaginatedHistory> => {
    return api.get<PaginatedHistory>(`/inventory/${productId}/history`, {
      params: {
        page: query.page,
        limit: query.limit,
        transactionType: query.transactionType || undefined,
      },
    });
  },

  /**
   * Record stock-in in complete boxes.
   */
  stockIn: (data: StockInInput): Promise<{ inventory: InventoryItem }> => {
    return api.post<{ inventory: InventoryItem }>('/inventory/stock-in', data);
  },

  /**
   * Record damaged stock (BOX or PIECE) with mandatory reason.
   */
  damage: (data: DamageStockInput): Promise<{ inventory: InventoryItem }> => {
    return api.post<{ inventory: InventoryItem }>('/inventory/damage', data);
  },

  /**
   * Record manual physical inventory adjustment (+ or - signed pieces) with mandatory reason.
   */
  adjustment: (data: AdjustmentInput): Promise<{ inventory: InventoryItem }> => {
    return api.post<{ inventory: InventoryItem }>('/inventory/adjustment', data);
  },
};
