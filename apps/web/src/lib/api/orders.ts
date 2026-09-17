import { api } from './client';

export type OrderStatus = 'COMPLETED' | 'CANCELLED';
export type SalesUnit = 'BOX' | 'PIECE' | 'SQ_FT';

export interface OrderItem {
  productId: string;
  productNameSnapshot: string;
  brandSnapshot: string;
  salesQuantity: number;
  salesUnit: SalesUnit;
  physicalPieces: number;
  unitPrice: number;
  lineTotal: number;
}

export interface OrderCustomer {
  _id: string;
  name: string;
  phone: string;
  address?: string;
  isActive?: boolean;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customerId: string;
  customer?: OrderCustomer;
  items: OrderItem[];
  subtotal: number;
  totalAmount: number;
  status: OrderStatus;
  paidAmount: number;
  outstandingAmount: number;
  payments?: any[];
  createdBy: string | Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderItemInput {
  productId: string;
  salesQuantity: number;
  salesUnit: SalesUnit;
  unitPrice?: number;
}

export interface CreateOrderInput {
  customerId: string;
  items: CreateOrderItemInput[];
}

export interface ListOrdersQuery {
  page?: number;
  limit?: number;
  status?: OrderStatus;
  customerId?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
}

export interface PaginatedOrders {
  data: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const ordersApi = {
  /**
   * List orders with payment summaries and filters.
   */
  list: (query: ListOrdersQuery = {}): Promise<PaginatedOrders> => {
    return api.get<PaginatedOrders>('/orders', {
      params: {
        page: query.page,
        limit: query.limit,
        status: query.status || undefined,
        customerId: query.customerId || undefined,
        startDate: query.startDate || undefined,
        endDate: query.endDate || undefined,
        search: query.search?.trim() ? query.search.trim() : undefined,
      },
    });
  },

  /**
   * Get single order details with item snapshots and payment ledger.
   */
  getById: (id: string): Promise<Order> => {
    return api.get<Order>(`/orders/${id}`);
  },

  /**
   * Atomically creates an order in COMPLETED status, validating and deducting physical inventory.
   */
  create: (data: CreateOrderInput): Promise<Order> => {
    return api.post<Order>('/orders', data);
  },

  /**
   * Atomically cancels a completed order and restores physical inventory via SALE_REVERSAL.
   */
  cancel: (id: string): Promise<Order> => {
    return api.post<Order>(`/orders/${id}/cancel`);
  },
};
