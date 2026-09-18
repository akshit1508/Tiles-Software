import { api } from './client';

export type PaymentMethod = 'CASH' | 'UPI' | 'BANK_TRANSFER' | 'CHEQUE';

export interface PaymentCustomerInfo {
  _id: string;
  name: string;
  phone: string;
  address?: string;
  isActive?: boolean;
}

export interface PaymentOrderInfo {
  _id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
}

export interface Payment {
  _id: string;
  orderId: string;
  order?: PaymentOrderInfo;
  customerId: string;
  customer?: PaymentCustomerInfo;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes?: string;
  remainingOutstanding?: number;
  createdBy: string;
  createdAt: string;
}

export interface CreatePaymentInput {
  orderId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: string;
  notes?: string;
  customerId?: string;
}

export interface ListPaymentsQuery {
  page?: number;
  limit?: number;
  orderId?: string;
  customerId?: string;
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
}

export interface PaginatedPayments {
  data: Payment[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const paymentsApi = {
  /**
   * List payments with optional filters (orderId, customerId, paymentMethod, date range)
   * Note: Non-whitelisted query params are rejected by backend validation pipe.
   */
  list: (query: ListPaymentsQuery = {}): Promise<PaginatedPayments> => {
    return api.get<PaginatedPayments>('/payments', {
      params: {
        page: query.page,
        limit: query.limit,
        orderId: query.orderId || undefined,
        customerId: query.customerId || undefined,
        paymentMethod: query.paymentMethod || undefined,
        startDate: query.startDate || undefined,
        endDate: query.endDate || undefined,
      },
    });
  },

  /**
   * Get single payment details with populated order, customer, and remaining order outstanding.
   */
  getById: (id: string): Promise<Payment> => {
    return api.get<Payment>(`/payments/${id}`);
  },

  /**
   * Records an immutable payment against an order.
   * Transaction-safe, serializes per order using __v, validates positive amount and no overpayment.
   */
  create: (data: CreatePaymentInput): Promise<Payment> => {
    return api.post<Payment>('/payments', data);
  },
};
