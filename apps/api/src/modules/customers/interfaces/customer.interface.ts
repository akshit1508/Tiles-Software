import { CustomerDocument } from '../schemas/customer.schema';

/**
 * Customer item representation in paginated customer lists.
 * Includes dynamically derived business values.
 */
export interface CustomerListItem {
  _id: string;
  name: string;
  phone: string;
  address?: string;
  isActive: boolean;
  totalOrders: number;
  outstandingBalance: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Standard paginated response envelope.
 */
export interface PaginatedCustomers {
  data: CustomerListItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * Derived order summary for customer detail view.
 */
export interface CustomerOrderDetail {
  _id: string;
  orderNumber: string;
  status: string;
  totalAmount: number;
  paidAmount: number;
  outstandingAmount: number;
  createdAt: Date;
}

/**
 * Payment ledger entry for customer detail view.
 */
export interface CustomerPaymentDetail {
  _id: string;
  orderId: string;
  amount: number;
  paymentMethod: string;
  paymentDate: Date;
  notes?: string;
  createdAt: Date;
}

/**
 * Detailed customer profile with full order history and payment ledger.
 */
export interface CustomerDetailResponse {
  customer: CustomerDocument;
  totalOrders: number;
  outstandingBalance: number;
  orders: CustomerOrderDetail[];
  payments: CustomerPaymentDetail[];
}
