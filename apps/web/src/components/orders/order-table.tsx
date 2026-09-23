import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
} from '@/components/ui';
import { Order, getOrderPaymentStatus } from '@/lib/api/orders';
import { formatCurrencyINR } from '@/lib/api/products';
import { OrderStatusBadge, OrderPaymentStatusBadge } from './order-status-badge';
import { Eye, XCircle, Phone } from 'lucide-react';

interface OrderTableProps {
  orders: Order[];
  onViewDetails: (order: Order) => void;
  onCancel: (order: Order) => void;
}

export function OrderTable({
  orders,
  onViewDetails,
  onCancel,
}: OrderTableProps) {
  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return isoString;
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Order Number</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Date / Time</TableHead>
            <TableHead className="text-right">Total Amount</TableHead>
            <TableHead className="text-right">Paid Amount</TableHead>
            <TableHead className="text-right">
              <div>Outstanding</div>
              <div className="text-[10px] font-normal lowercase text-slate-400">server-derived</div>
            </TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {orders.map((order) => {
            const hasOutstanding = order.outstandingAmount > 0 && order.status === 'COMPLETED';

            return (
              <TableRow
                key={order._id}
                className={
                  order.status === 'CANCELLED'
                    ? 'opacity-60 bg-slate-50/50'
                    : hasOutstanding
                      ? 'bg-amber-50/20 hover:bg-amber-50/35'
                      : undefined
                }
              >
                {/* Order Number */}
                <TableCell>
                  <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-1 rounded-md border border-blue-200">
                    {order.orderNumber}
                  </span>
                </TableCell>

                {/* Customer */}
                <TableCell>
                  <div className="font-semibold text-slate-900">
                    {order.customer?.name || 'Walk-in Customer'}
                  </div>
                  {order.customer?.phone && (
                    <div className="flex items-center gap-1 text-xs text-slate-500 font-mono">
                      <Phone className="h-3 w-3 text-slate-400" />
                      {order.customer.phone}
                    </div>
                  )}
                </TableCell>

                {/* Date */}
                <TableCell className="text-xs text-slate-600 whitespace-nowrap">
                  {formatDate(order.createdAt)}
                </TableCell>

                {/* Total Amount */}
                <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                  {formatCurrencyINR(order.totalAmount)}
                </TableCell>

                {/* Paid Amount */}
                <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700">
                  {formatCurrencyINR(order.paidAmount)}
                </TableCell>

                {/* Outstanding */}
                <TableCell className="text-right">
                  <span
                    className={`font-mono text-xs font-bold ${
                      order.status === 'CANCELLED'
                        ? 'text-slate-400 line-through'
                        : hasOutstanding
                          ? 'text-amber-800'
                          : 'text-slate-600'
                    }`}
                  >
                    {formatCurrencyINR(order.outstandingAmount)}
                  </span>
                  {hasOutstanding && (
                    <div className="text-[10px] font-medium text-amber-700">Pending</div>
                  )}
                </TableCell>

                {/* Status Badges */}
                <TableCell className="text-center">
                  <div className="flex flex-col items-center gap-1">
                    <OrderStatusBadge status={order.status} />
                    <OrderPaymentStatusBadge status={getOrderPaymentStatus(order)} />
                  </div>
                </TableCell>

                {/* Actions */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(order)}
                      className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                      title="View Order Details"
                      aria-label="View Order Details"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    {order.status === 'COMPLETED' && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onCancel(order)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Cancel Order & Restore Inventory"
                        aria-label="Cancel Order & Restore Inventory"
                      >
                        <XCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
