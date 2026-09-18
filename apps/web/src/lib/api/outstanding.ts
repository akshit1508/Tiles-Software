import { api } from './client';

export interface CustomerOutstandingListItem {
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalSales: number;
  totalPaid: number;
  outstanding: number;
  isActive: boolean;
}

export interface PaginatedOutstandingCustomers {
  data: CustomerOutstandingListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ListOutstandingCustomersQuery {
  page?: number;
  limit?: number;
  search?: string;
}

export interface OrderOutstandingBreakdown {
  orderId: string;
  orderNumber: string;
  orderDate: string;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  status: string;
}

export interface CustomerOutstandingDetail {
  customer: {
    _id: string;
    name: string;
    phone: string;
    address?: string;
    isActive: boolean;
  };
  totalCompletedSales: number;
  totalPaid: number;
  outstanding: number;
  orders: OrderOutstandingBreakdown[];
}

export const outstandingApi = {
  /**
   * Returns paginated list of customers having derived outstanding balance > 0.
   */
  getCustomers: (
    query: ListOutstandingCustomersQuery = {},
  ): Promise<PaginatedOutstandingCustomers> => {
    return api.get<PaginatedOutstandingCustomers>('/outstanding/customers', {
      params: {
        page: query.page,
        limit: query.limit,
        search: query.search?.trim() ? query.search.trim() : undefined,
      },
    });
  },

  /**
   * Returns customer details and order-level breakdown for a customer.
   */
  getCustomerDetail: (customerId: string): Promise<CustomerOutstandingDetail> => {
    return api.get<CustomerOutstandingDetail>(
      `/outstanding/customers/${customerId}`,
    );
  },
};
