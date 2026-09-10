import { OrderStatus, SalesUnit } from '../../../common/enums';

export interface OrderItemResponse {
  productId: string;
  productNameSnapshot: string;
  brandSnapshot: string;
  salesQuantity: number;
  salesUnit: SalesUnit;
  physicalPieces: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderCustomerInfo {
  _id: string;
  name: string;
  phone: string;
  address?: string;
  isActive?: boolean;
}

export interface OrderDetailResponse {
  _id: string;
  orderNumber: string;
  customerId: string;
  customer?: OrderCustomerInfo;
  items: OrderItemResponse[];
  subtotal: number;
  totalAmount: number;
  status: OrderStatus;
  paidAmount: number;
  outstandingAmount: number;
  payments?: any[];
  createdBy: string | Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export interface PaginatedOrdersResponse {
  data: OrderDetailResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
