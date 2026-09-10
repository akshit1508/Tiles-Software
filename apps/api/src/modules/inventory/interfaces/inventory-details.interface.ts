import { ProductDocument } from '../../products/schemas/product.schema';
import { InventoryDocument } from '../schemas/inventory.schema';
import { InventoryTransactionDocument } from '../schemas/inventory-transaction.schema';

export interface InventoryDerivedValues {
  fullBoxes: number;
  loosePieces: number;
  totalSqFt: number;
  isLowStock: boolean;
}

export interface InventoryItemResponse {
  _id: string;
  productId: string | ProductDocument;
  totalPieces: number;
  fullBoxes: number;
  loosePieces: number;
  totalSqFt: number;
  isLowStock: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface PaginatedInventoryResponse {
  data: InventoryItemResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface PaginatedHistoryResponse {
  data: InventoryTransactionDocument[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
