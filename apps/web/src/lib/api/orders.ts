import { api } from './client';
import { PaymentMethod } from './payments';

export type OrderStatus = 'COMPLETED' | 'CANCELLED';
export type SalesUnit = 'BOX' | 'PIECE' | 'SQ_FT';
export type OrderPaymentStatus = 'PAID' | 'PARTIALLY PAID' | 'UNPAID' | 'CANCELLED';

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
  paymentStatus?: OrderPaymentStatus;
  payments?: any[];
  createdBy: string | Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderItemInput {
  productId: string;
  /** Box quantity for the BOX-only sales workflow */
  quantityBoxes?: number;
  /** Sold quantity (backward compatible) */
  salesQuantity?: number;
  salesUnit?: SalesUnit;
  unitPrice?: number;
}

export interface InitialPaymentInput {
  amount: number;
  paymentMethod?: PaymentMethod;
  notes?: string;
  paymentDate?: string;
}

export interface CreateOrderInput {
  customerId: string;
  items: CreateOrderItemInput[];
  initialPayment?: InitialPaymentInput;
  paidNow?: number;
  paymentMethod?: PaymentMethod;
  paymentNotes?: string;
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

/**
 * Derives the payment status display for an order if not provided directly.
 */
export function getOrderPaymentStatus(order: {
  status: OrderStatus;
  paidAmount?: number;
  totalAmount: number;
  paymentStatus?: OrderPaymentStatus;
}): OrderPaymentStatus {
  if (order.paymentStatus) return order.paymentStatus;
  if (order.status === 'CANCELLED') return 'CANCELLED';
  const paid = order.paidAmount || 0;
  if (paid >= order.totalAmount && order.totalAmount > 0) return 'PAID';
  if (paid > 0) return 'PARTIALLY PAID';
  return 'UNPAID';
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
   * Atomically creates an order in COMPLETED status, validating and deducting physical inventory,
   * with optional initial payment.
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
