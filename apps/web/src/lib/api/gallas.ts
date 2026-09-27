import { api } from './client';

export interface Galla {
  _id: string;
  gallaNumber: string;
  name?: string;
  description?: string;
  isActive: boolean;
  productCount?: number;
  totalBoxes?: number;
  createdAt: string;
  updatedAt: string;
}

export interface GallaInventoryItem {
  product: {
    _id: string;
    brand: string;
    productName: string;
    category: string;
    size: string;
    finish: string;
    color: string;
    piecesPerBox: number;
    sellingPrice: number;
    isActive: boolean;
  };
  boxes: number;
  totalPieces: number;
  updatedAt: string;
}

export interface GallaInventoryResponse {
  galla: Galla;
  items: GallaInventoryItem[];
  totalProducts: number;
  totalBoxes: number;
}

export interface CreateGallaInput {
  gallaNumber: string;
  name?: string;
  description?: string;
}

export interface UpdateGallaInput {
  name?: string;
  description?: string;
  isActive?: boolean;
}

export interface ListGallasQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface PaginatedGallas {
  data: Galla[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const gallasApi = {
  /**
   * List all Galla locations with product count and total box stock aggregations.
   */
  list: (query: ListGallasQuery = {}): Promise<PaginatedGallas> => {
    return api.get<PaginatedGallas>('/gallas', {
      params: {
        page: query.page,
        limit: query.limit,
        search: query.search?.trim() ? query.search.trim() : undefined,
        isActive: query.isActive !== undefined ? query.isActive : undefined,
      },
    });
  },

  /**
   * Get single Galla location details.
   */
  getById: (id: string): Promise<Galla> => {
    return api.get<Galla>(`/gallas/${id}`);
  },

  /**
   * Get complete stock breakdown inside a specific Galla.
   */
  getInventory: (id: string): Promise<GallaInventoryResponse> => {
    return api.get<GallaInventoryResponse>(`/gallas/${id}/inventory`);
  },

  /**
   * Create a new Galla location.
   */
  create: (data: CreateGallaInput): Promise<Galla> => {
    return api.post<Galla>('/gallas', data);
  },

  /**
   * Update Galla details or soft-deactivate/activate.
   */
  update: (id: string, data: UpdateGallaInput): Promise<Galla> => {
    return api.patch<Galla>(`/gallas/${id}`, data);
  },
};
