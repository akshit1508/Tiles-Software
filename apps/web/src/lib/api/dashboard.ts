import { api } from './client';

export interface LowStockProductInfo {
  productId: string;
  productName: string;
  brand: string;
  currentPieces: number;
  minimumStockPieces: number;
}

export interface LowStockSummary {
  totalLowStockProducts: number;
  items: LowStockProductInfo[];
}

export interface DashboardSummary {
  totalProducts: number;
  activeProducts: number;
  totalCustomers: number;
  activeCustomers: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalSales: number;
  totalCollected: number;
  totalOutstanding: number;
  lowStock: LowStockSummary;
  dateFilter?: {
    startDate?: string;
    endDate?: string;
    salesFilteredBy: 'order.createdAt';
    collectedFilteredBy: 'payment.paymentDate';
  };
}

export interface DashboardSummaryQuery {
  startDate?: string;
  endDate?: string;
}

export const dashboardApi = {
  /**
   * Returns real-time aggregate statistics for the business owner.
   * Query supports ISO8601 startDate and endDate.
   */
  getSummary: (query: DashboardSummaryQuery = {}): Promise<DashboardSummary> => {
    return api.get<DashboardSummary>('/dashboard/summary', {
      params: {
        startDate: query.startDate || undefined,
        endDate: query.endDate || undefined,
      },
    });
  },
};
