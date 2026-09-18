import React, { useState, useEffect, useCallback } from 'react';
import {
  Modal,
  Button,
  LoadingState,
  ErrorState,
} from '@/components/ui';
import { Payment, paymentsApi } from '@/lib/api/payments';
import { formatCurrencyINR } from '@/lib/api/products';
import { PaymentMethodBadge } from './payment-method-badge';
import { ApiError } from '@/lib/api';
import { ShoppingBag, User, Phone, MapPin, Clock, FileText, CheckCircle2 } from 'lucide-react';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: Payment | null;
}

export function PaymentDetailsModal({
  isOpen,
  onClose,
  payment,
}: PaymentDetailsModalProps) {
  const [detail, setDetail] = useState<Payment | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDetail = useCallback(async () => {
    if (!payment?._id) return;

    try {
      setIsLoading(true);
      setError(null);
      const res = await paymentsApi.getById(payment._id);
      setDetail(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch payment details');
      }
    } finally {
      setIsLoading(false);
    }
  }, [payment?._id]);

  useEffect(() => {
    if (isOpen && payment?._id) {
      fetchDetail();
    }
  }, [isOpen, payment?._id, fetchDetail]);

  const activePayment = detail || payment;

  const formatDateTime = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }).format(d);
    } catch {
      return isoDate;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Payment Transaction Details"
      description="Immutable financial receipt and order audit trail"
      size="lg"
    >
      <div className="space-y-5">
        {isLoading && !activePayment ? (
          <LoadingState message="Loading payment receipt details..." />
        ) : error && !activePayment ? (
          <ErrorState message={error} onRetry={fetchDetail} />
        ) : activePayment ? (
          <div className="space-y-4">
            {/* Amount & Status Card */}
            <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <div className="text-xs text-emerald-800 font-semibold uppercase tracking-wider">
                    Amount Received
                  </div>
                  <div className="font-mono text-2xl font-bold text-emerald-700 mt-0.5">
                    {formatCurrencyINR(activePayment.amount)}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <PaymentMethodBadge method={activePayment.paymentMethod} size="md" />
                </div>
              </div>

              {activePayment.remainingOutstanding !== undefined && (
                <div className="pt-2 border-t border-emerald-200/60 flex items-center justify-between text-xs text-emerald-900">
                  <span>Remaining Order Outstanding:</span>
                  <span className="font-mono font-bold">
                    {formatCurrencyINR(activePayment.remainingOutstanding)}
                  </span>
                </div>
              )}
            </div>

            {/* Order & Customer Details Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Linked Order */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <ShoppingBag className="h-4 w-4 text-slate-400" />
                  <span>Linked Order</span>
                </div>

                {activePayment.order ? (
                  <div className="space-y-1 pt-1">
                    <div className="font-mono text-sm font-bold text-blue-700">
                      {activePayment.order.orderNumber}
                    </div>
                    <div className="text-xs text-slate-600 flex justify-between">
                      <span>Order Total:</span>
                      <span className="font-mono font-semibold">
                        {formatCurrencyINR(activePayment.order.totalAmount)}
                      </span>
                    </div>
                    <div className="text-xs text-slate-600 flex justify-between">
                      <span>Order Status:</span>
                      <span className="font-medium text-slate-800">
                        {activePayment.order.status}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs font-mono text-slate-500 pt-1">
                    Order ID: {activePayment.orderId}
                  </div>
                )}
              </div>

              {/* Customer Info */}
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <User className="h-4 w-4 text-slate-400" />
                  <span>Customer</span>
                </div>

                {activePayment.customer ? (
                  <div className="space-y-1 pt-1">
                    <div className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                      {activePayment.customer.name}
                      {activePayment.customer.isActive === false && (
                        <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1 py-0.2 rounded font-normal">
                          Deactivated
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-600 flex items-center gap-1.5">
                      <Phone className="h-3 w-3 text-slate-400" />
                      <span>{activePayment.customer.phone}</span>
                    </div>
                    {activePayment.customer.address && (
                      <div className="text-xs text-slate-500 flex items-start gap-1.5">
                        <MapPin className="h-3 w-3 text-slate-400 shrink-0 mt-0.5" />
                        <span className="truncate">{activePayment.customer.address}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs font-mono text-slate-500 pt-1">
                    Customer ID: {activePayment.customerId}
                  </div>
                )}
              </div>
            </div>

            {/* Audit & Reference Meta */}
            <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5">
              <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <FileText className="h-4 w-4 text-slate-400" />
                <span>Reference & Audit</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-slate-500">Payment Date:</span>
                  <div className="font-medium text-slate-800 mt-0.5 flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {formatDateTime(activePayment.paymentDate)}
                  </div>
                </div>

                <div>
                  <span className="text-slate-500">Recorded At:</span>
                  <div className="font-medium text-slate-800 mt-0.5">
                    {formatDateTime(activePayment.createdAt)}
                  </div>
                </div>
              </div>

              {activePayment.notes && (
                <div className="pt-2 border-t border-slate-200 text-xs">
                  <span className="text-slate-500 block mb-0.5">Reference / Notes:</span>
                  <p className="font-medium text-slate-900 bg-white p-2 rounded border border-slate-200 whitespace-pre-wrap">
                    {activePayment.notes}
                  </p>
                </div>
              )}

              <div className="pt-1 text-[11px] text-slate-400 font-mono">
                Payment ID: {activePayment._id}
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
