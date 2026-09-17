import { api } from './client';

export interface Customer {
  _id: string;
  name: string;
  phone: string;
  address?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerListItem {
  _id: string;
  name: string;
  phone: string;
  address?: string;
  isActive: boolean;
  totalOrders: number;
  outstandingBalance: number;
  createdAt: string;
  updatedAt: string;
}

export interface CustomerOrderDetail {
  _id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  createdAt: string;
}

export interface CustomerPaymentDetail {
  _id: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: string;
  notes?: string;
  createdAt: string;
}

export interface CustomerDetail {
  customer: Customer;
  totalOrders: number;
  outstandingBalance: number;
  orders: CustomerOrderDetail[];
  payments: CustomerPaymentDetail[];
}

export interface CreateCustomerInput {
  name: string;
  phone: string;
  address?: string;
}

export interface UpdateCustomerInput {
  name?: string;
  phone?: string;
  address?: string;
  isActive?: boolean;
}

export interface ListCustomersQuery {
  page?: number;
  limit?: number;
  search?: string;
  isActive?: boolean;
}

export interface PaginatedCustomers {
  data: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const customersApi = {
  /**
   * List customers with authoritative derived totalOrders and outstandingBalance.
   */
  list: (query: ListCustomersQuery = {}): Promise<PaginatedCustomers> => {
    return api.get<PaginatedCustomers>('/customers', {
      params: {
        page: query.page,
        limit: query.limit,
        search: query.search?.trim() ? query.search.trim() : undefined,
        isActive: query.isActive !== undefined ? query.isActive : undefined,
      },
    });
  },

  /**
   * Get single customer profile with full order history and payment ledger.
   */
  getById: (id: string): Promise<CustomerDetail> => {
    return api.get<CustomerDetail>(`/customers/${id}`);
  },

  /**
   * Create a new customer master record.
   */
  create: (data: CreateCustomerInput): Promise<{ customer: Customer }> => {
    return api.post<{ customer: Customer }>('/customers', data);
  },

  /**
   * Update mutable customer fields.
   */
  update: (id: string, data: UpdateCustomerInput): Promise<{ customer: Customer }> => {
    return api.patch<{ customer: Customer }>(`/customers/${id}`, data);
  },

  /**
   * Reactivate a soft-deactivated customer.
   */
  activate: (id: string): Promise<{ customer: Customer }> => {
    return api.patch<{ customer: Customer }>(`/customers/${id}/activate`);
  },

  /**
   * Soft-deactivate customer (isActive = false). Never hard-deletes.
   */
  deactivate: (id: string): Promise<{ customer: Customer }> => {
    return api.patch<{ customer: Customer }>(`/customers/${id}/deactivate`);
  },
};
