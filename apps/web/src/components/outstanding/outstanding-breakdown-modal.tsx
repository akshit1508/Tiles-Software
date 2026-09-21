import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
  LoadingState,
  ErrorState,
} from '@/components/ui';
import {
  CustomerOutstandingDetail,
  CustomerOutstandingListItem,
  outstandingApi,
} from '@/lib/api/outstanding';
import { formatCurrencyINR } from '@/lib/api/products';
import { ApiError } from '@/lib/api';
import { User, Phone, MapPin, CreditCard, ShoppingBag, Clock, CheckCircle2 } from 'lucide-react';

interface OutstandingBreakdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerItem: CustomerOutstandingListItem | null;
  onRecordPaymentForOrder: (orderId: string) => void;
  refreshTrigger?: number;
}

export function OutstandingBreakdownModal({
  isOpen,
  onClose,
  customerItem,
  onRecordPaymentForOrder,
  refreshTrigger,
}: OutstandingBreakdownModalProps) {
  const [detail, setDetail] = useState<CustomerOutstandingDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!customerItem?.customerId) return;

    try {
      setIsLoading(true);
      setError(null);
      const res = await outstandingApi.getCustomerDetail(customerItem.customerId);
      setDetail(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch customer outstanding breakdown');
      }
    } finally {
      setIsLoading(false);
    }
  }, [customerItem?.customerId]);

  useEffect(() => {
    if (isOpen && customerItem?.customerId) {
      fetchDetail();
    }
  }, [isOpen, customerItem?.customerId, refreshTrigger, fetchDetail]);

  const formatDateTime = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return isoDate;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={customerItem ? `Outstanding Breakdown: ${customerItem.customerName}` : 'Customer Breakdown'}
      description="Authoritative customer debtor aging and order-level payment status"
      size="xl"
    >
      <div className="space-y-5">
        {isLoading && !detail ? (
          <LoadingState message="Loading order breakdown..." />
        ) : error && !detail ? (
          <ErrorState message={error} onRetry={fetchDetail} />
        ) : detail ? (
          <div className="space-y-5">
            {/* Customer Profile & Financial Summary */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-slate-500" />
                    <span className="font-semibold text-slate-900 text-base">
                      {detail.customer.name}
                    </span>
                    {!detail.customer.isActive && (
                      <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                        Deactivated
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {detail.customer.phone}
                    </span>
                    {detail.customer.address && (
                      <span className="flex items-center gap-1 truncate max-w-[280px]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {detail.customer.address}
                      </span>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <div className={`text-[11px] font-semibold uppercase tracking-wider ${detail.outstanding > 0 ? 'text-amber-800' : 'text-emerald-800'}`}>
                    Total Outstanding
                  </div>
                  <div className={`font-mono text-xl font-bold ${detail.outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {formatCurrencyINR(detail.outstanding)}
                  </div>
                </div>
              </div>

              {/* Summary KPIs */}
              <div className="grid grid-cols-3 gap-3 pt-2 border-t border-slate-200 text-center">
                <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-medium">Completed Sales</div>
                  <div className="font-mono text-sm font-bold text-slate-900 mt-0.5">
                    {formatCurrencyINR(detail.totalCompletedSales)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-medium">Total Paid</div>
                  <div className="font-mono text-sm font-bold text-emerald-700 mt-0.5">
                    {formatCurrencyINR(detail.totalPaid)}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2.5 border border-slate-200">
                  <div className="text-[11px] text-slate-500 font-medium">Outstanding Balance</div>
                  <div className={`font-mono text-sm font-bold mt-0.5 ${detail.outstanding > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
                    {formatCurrencyINR(detail.outstanding)}
                  </div>
                </div>
              </div>

              {detail.outstanding === 0 && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-2.5 text-xs text-emerald-800 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="font-medium">All completed orders for this customer are now fully settled.</span>
                </div>
              )}
            </div>

            {/* Orders Breakdown Table */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2.5 flex items-center gap-1.5">
                <ShoppingBag className="h-3.5 w-3.5 text-slate-500" />
                Order Breakdown ({detail.orders.length})
              </h4>
              <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-slate-50/80">
                      <TableHead>Order #</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead className="text-right">Order Total</TableHead>
                      <TableHead className="text-right">Paid</TableHead>
                      <TableHead className="text-right">Outstanding</TableHead>
                      <TableHead className="text-center">Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.orders.map((ord) => (
                      <TableRow key={ord.orderId} className="hover:bg-slate-50/50">
                        <TableCell>
                          <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {ord.orderNumber}
                          </span>
                        </TableCell>

                        <TableCell className="text-xs text-slate-600">
                          {formatDateTime(ord.orderDate)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs text-slate-700">
                          {formatCurrencyINR(ord.totalAmount)}
                        </TableCell>

                        <TableCell className="text-right font-mono text-xs font-medium text-emerald-700">
                          {formatCurrencyINR(ord.paidAmount)}
                        </TableCell>

                        <TableCell className="text-right">
                          <span
                            className={`font-mono text-xs font-bold ${
                              ord.outstanding > 0 ? 'text-amber-700' : 'text-slate-400'
                            }`}
                          >
                            {formatCurrencyINR(ord.outstanding)}
                          </span>
                        </TableCell>

                        <TableCell className="text-center">
                          <Badge
                            variant={ord.status === 'COMPLETED' ? 'success' : 'danger'}
                            size="sm"
                          >
                            {ord.status}
                          </Badge>
                        </TableCell>

                        <TableCell className="text-right">
                          {ord.outstanding > 0 && ord.status === 'COMPLETED' ? (
                            <Button
                              size="sm"
                              variant="primary"
                              onClick={() => {
                                onRecordPaymentForOrder(ord.orderId);
                              }}
                              className="h-7 text-xs px-2.5"
                            >
                              <CreditCard className="h-3 w-3 mr-1" />
                              Pay
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-400">Settled</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end pt-3 border-t border-slate-100">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
