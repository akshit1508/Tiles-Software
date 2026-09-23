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
import { Order, ordersApi, getOrderPaymentStatus } from '@/lib/api/orders';
import { formatCurrencyINR } from '@/lib/api/products';
import { OrderStatusBadge, OrderPaymentStatusBadge } from './order-status-badge';
import { PaymentFormModal } from '@/components/payments';
import { ApiError } from '@/lib/api';
import { XCircle, CreditCard, ShoppingCart, Plus } from 'lucide-react';

interface OrderDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: Order | null;
  onCancelOrder: (order: Order) => void;
  onPaymentSuccess?: () => void;
}

export function OrderDetailsModal({
  isOpen,
  onClose,
  order,
  onCancelOrder,
  onPaymentSuccess,
}: OrderDetailsModalProps) {
  const [detail, setDetail] = useState<Order | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  const fetchDetail = useCallback(async () => {
    if (!order?._id) return;

    try {
      setIsLoading(true);
      setError(null);
      const res = await ordersApi.getById(order._id);
      setDetail(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch order details');
      }
    } finally {
      setIsLoading(false);
    }
  }, [order?._id]);

  useEffect(() => {
    if (isOpen && order?._id) {
      fetchDetail();
    }
  }, [isOpen, order?._id, fetchDetail]);

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

  const activeOrder = detail || order;
  const paymentStatus = activeOrder
    ? getOrderPaymentStatus(activeOrder)
    : 'UNPAID';

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={activeOrder ? `Order: ${activeOrder.orderNumber}` : 'Order Details'}
        description="Authoritative order transaction details, line item snapshots, and payment ledger"
        size="xl"
      >
        <div className="space-y-5">
          {/* Header Summary Tile */}
          {activeOrder && (
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-mono text-sm font-bold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
                      {activeOrder.orderNumber}
                    </span>
                    <OrderStatusBadge status={activeOrder.status} />
                    <OrderPaymentStatusBadge status={paymentStatus} />
                  </div>
                  <div className="mt-1.5 text-xs text-slate-500">
                    Ordered on: {formatDate(activeOrder.createdAt)}
                  </div>
                </div>

                <div className="flex items-center gap-2 self-start sm:self-auto flex-wrap">
                  {/* Receive Payment Action for subsequent payments */}
                  {activeOrder.status === 'COMPLETED' && activeOrder.outstandingAmount > 0 && (
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => setIsPaymentModalOpen(true)}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Receive Payment
                    </Button>
                  )}

                  {/* Cancel Order Action */}
                  {activeOrder.status === 'COMPLETED' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => onCancelOrder(activeOrder)}
                      className="text-rose-700 border-rose-200 hover:bg-rose-50"
                    >
                      <XCircle className="h-4 w-4 mr-1 text-rose-600" />
                      Cancel Order
                    </Button>
                  )}
                </div>
              </div>

              {/* Customer Details */}
              {activeOrder.customer && (
                <div className="pt-2 border-t border-slate-200/80 text-xs text-slate-700">
                  <span className="font-semibold text-slate-900">Customer: </span>
                  {activeOrder.customer.name}{' '}
                  <span className="font-mono text-slate-500">({activeOrder.customer.phone})</span>
                  {activeOrder.customer.address && (
                    <span className="text-slate-500"> • {activeOrder.customer.address}</span>
                  )}
                </div>
              )}

              {/* Financial Summary KPIs */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-200/80">
                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Total Order Amount
                  </div>
                  <div className="mt-0.5 text-lg font-bold font-mono text-slate-900">
                    {formatCurrencyINR(activeOrder.totalAmount)}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Paid Amount
                  </div>
                  <div className="mt-0.5 text-lg font-bold font-mono text-emerald-700">
                    {formatCurrencyINR(activeOrder.paidAmount)}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Outstanding Balance
                  </div>
                  <div
                    className={`mt-0.5 text-lg font-bold font-mono ${
                      activeOrder.outstandingAmount > 0 ? 'text-amber-800' : 'text-slate-700'
                    }`}
                  >
                    {formatCurrencyINR(activeOrder.outstandingAmount)}
                  </div>
                </div>

                <div className="rounded-lg border border-slate-200 bg-white p-3">
                  <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Payment Status
                  </div>
                  <div className="mt-1">
                    <OrderPaymentStatusBadge status={paymentStatus} />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Content Body */}
          {isLoading && !detail ? (
            <div className="p-8">
              <LoadingState message="Loading order line items..." />
            </div>
          ) : error && !detail ? (
            <ErrorState
              title="Failed to Load Order"
              message={error}
              onRetry={fetchDetail}
            />
          ) : (
            <div className="space-y-4">
              {/* Line Items Table */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <ShoppingCart className="h-3.5 w-3.5 text-slate-500" />
                  Line Item Snapshots ({activeOrder?.items?.length || 0})
                </h4>
                <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Product / Brand Snapshot</TableHead>
                        <TableHead className="text-right">Sold Quantity</TableHead>
                        <TableHead className="text-right">Physical Deducted</TableHead>
                        <TableHead className="text-right">Unit Price</TableHead>
                        <TableHead className="text-right">Line Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeOrder?.items?.map((item, idx) => (
                        <TableRow key={idx}>
                          <TableCell>
                            <div className="font-semibold text-slate-900">
                              {item.productNameSnapshot}
                            </div>
                            <div className="text-xs text-slate-500">
                              {item.brandSnapshot}
                            </div>
                          </TableCell>

                          <TableCell className="text-right font-mono text-xs font-medium">
                            {item.salesQuantity} {item.salesUnit.toLowerCase()}
                          </TableCell>

                          <TableCell className="text-right font-mono text-xs text-slate-600">
                            {item.physicalPieces} pcs
                          </TableCell>

                          <TableCell className="text-right font-mono text-xs text-slate-700">
                            {formatCurrencyINR(item.unitPrice)}
                          </TableCell>

                          <TableCell className="text-right font-mono text-xs font-bold text-slate-900">
                            {formatCurrencyINR(item.lineTotal)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {/* Recorded Payments */}
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                  <CreditCard className="h-3.5 w-3.5 text-slate-500" />
                  Payment History ({activeOrder?.payments?.length || 0})
                </h4>
                {activeOrder?.payments && activeOrder.payments.length > 0 ? (
                  <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Payment Date</TableHead>
                          <TableHead>Method</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Notes</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeOrder.payments.map((p, idx) => (
                          <TableRow key={idx}>
                            <TableCell className="text-xs text-slate-600">
                              {formatDate(p.paymentDate || p.createdAt)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="neutral" size="sm">
                                {p.paymentMethod}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs font-semibold text-emerald-700">
                              {formatCurrencyINR(p.amount)}
                            </TableCell>
                            <TableCell className="text-xs text-slate-600">
                              {p.notes || '—'}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center text-xs text-slate-500">
                    No payments recorded yet for this order.
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </Modal>

      {/* Subsequent Payment Modal */}
      {activeOrder && (
        <PaymentFormModal
          isOpen={isPaymentModalOpen}
          onClose={() => setIsPaymentModalOpen(false)}
          initialOrder={activeOrder}
          onSuccess={() => {
            setIsPaymentModalOpen(false);
            fetchDetail();
            onPaymentSuccess?.();
          }}
        />
      )}
    </>
  );
}
