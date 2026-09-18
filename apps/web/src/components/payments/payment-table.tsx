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
import { Payment } from '@/lib/api/payments';
import { formatCurrencyINR } from '@/lib/api/products';
import { PaymentMethodBadge } from './payment-method-badge';
import { Eye, Clock } from 'lucide-react';

interface PaymentTableProps {
  payments: Payment[];
  onViewDetails: (payment: Payment) => void;
}

export function PaymentTable({ payments, onViewDetails }: PaymentTableProps) {
  const formatDateTime = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return isoDate;
    }
  };

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead className="w-[180px]">Date & Time</TableHead>
            <TableHead>Order #</TableHead>
            <TableHead>Customer</TableHead>
            <TableHead>Method</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Notes / Ref</TableHead>
            <TableHead className="text-right w-[100px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {payments.map((payment) => (
            <TableRow key={payment._id} className="hover:bg-slate-50/50 transition-colors">
              {/* Date & Time */}
              <TableCell className="text-xs text-slate-600 font-medium">
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                  <span>{formatDateTime(payment.paymentDate || payment.createdAt)}</span>
                </div>
              </TableCell>

              {/* Order Number */}
              <TableCell>
                {payment.order ? (
                  <div>
                    <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                      {payment.order.orderNumber}
                    </span>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      Total: {formatCurrencyINR(payment.order.totalAmount)}
                    </div>
                  </div>
                ) : (
                  <span className="font-mono text-xs text-slate-400">
                    {payment.orderId.slice(-8)}
                  </span>
                )}
              </TableCell>

              {/* Customer */}
              <TableCell>
                {payment.customer ? (
                  <div>
                    <div className="font-medium text-slate-900 text-sm">
                      {payment.customer.name}
                      {payment.customer.isActive === false && (
                        <span className="ml-1.5 text-[10px] text-amber-600 font-medium bg-amber-50 px-1 py-0.5 rounded border border-amber-200">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {payment.customer.phone}
                    </div>
                  </div>
                ) : (
                  <span className="text-xs text-slate-400">
                    ID: {payment.customerId.slice(-8)}
                  </span>
                )}
              </TableCell>

              {/* Payment Method */}
              <TableCell>
                <PaymentMethodBadge method={payment.paymentMethod} />
              </TableCell>

              {/* Amount */}
              <TableCell className="text-right">
                <span className="font-mono text-sm font-bold text-emerald-700">
                  {formatCurrencyINR(payment.amount)}
                </span>
              </TableCell>

              {/* Notes / Reference */}
              <TableCell className="text-xs text-slate-600 max-w-[200px] truncate">
                {payment.notes ? (
                  <span title={payment.notes}>{payment.notes}</span>
                ) : (
                  <span className="text-slate-300">—</span>
                )}
              </TableCell>

              {/* Actions (View Only — Payments are Immutable) */}
              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => onViewDetails(payment)}
                  className="h-8 px-2 text-slate-600 hover:text-blue-600"
                  title="View Payment Details"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Details
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
