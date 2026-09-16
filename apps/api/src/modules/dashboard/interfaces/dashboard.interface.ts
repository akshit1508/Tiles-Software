export interface CustomerOutstandingListItem {
  customerId: string;
  customerName: string;
  customerPhone: string;
  totalSales: number;
  totalPaid: number;
  outstanding: number;
  isActive: boolean;
}

export interface PaginatedOutstandingCustomersResponse {
  data: CustomerOutstandingListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderOutstandingBreakdown {
  orderId: string;
  orderNumber: string;
  orderDate: Date;
  totalAmount: number;
  paidAmount: number;
  outstanding: number;
  status: string;
}

export interface CustomerOutstandingDetailResponse {
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

export interface DashboardSummaryResponse {
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
