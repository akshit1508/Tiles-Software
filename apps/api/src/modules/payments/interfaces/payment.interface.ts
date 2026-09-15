import { PaymentMethod } from '../../../common/enums';

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

export interface PaymentResponse {
  _id: string;
  orderId: string;
  order?: PaymentOrderInfo;
  customerId: string;
  customer?: PaymentCustomerInfo;
  amount: number;
  paymentMethod: PaymentMethod;
  paymentDate: Date;
  notes?: string;
  remainingOutstanding?: number;
  createdBy: string;
  createdAt: Date;
}

export interface PaginatedPaymentsResponse {
  data: PaymentResponse[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
