import React, { useState, useEffect } from 'react';
import {
  Modal,
  Button,
  Input,
  Select,
  SearchableSelect,
} from '@/components/ui';
import {
  Payment,
  PaymentMethod,
  paymentsApi,
  CreatePaymentInput,
} from '@/lib/api/payments';
import { Order, ordersApi } from '@/lib/api/orders';
import { formatCurrencyINR } from '@/lib/api/products';
import { ApiError } from '@/lib/api';
import { CreditCard, CheckCircle, AlertCircle, ShoppingBag, User, ArrowRight } from 'lucide-react';

interface PaymentFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (payment: Payment) => void;
  /** Optional preselected order (e.g. from Order details or Customer details modal) */
  initialOrder?: Order | null;
}

export function PaymentFormModal({
  isOpen,
  onClose,
  onSuccess,
  initialOrder,
}: PaymentFormModalProps) {
  // Orders selection state
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoadingOrders, setIsLoadingOrders] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [isLoadingOrderDetail, setIsLoadingOrderDetail] = useState(false);

  // Form inputs
  const [amount, setAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('CASH');
  const [paymentDate, setPaymentDate] = useState<string>(() => {
    return new Date().toISOString().slice(0, 10);
  });
  const [notes, setNotes] = useState<string>('');

  // UI status
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset or initialize on open
  useEffect(() => {
    if (isOpen) {
      setError(null);
      setPaymentDate(new Date().toISOString().slice(0, 10));
      setNotes('');

      if (initialOrder) {
        setSelectedOrderId(initialOrder._id);
        setSelectedOrder(initialOrder);
        setAmount(initialOrder.outstandingAmount > 0 ? String(initialOrder.outstandingAmount) : '');
      } else {
        setSelectedOrderId('');
        setSelectedOrder(null);
        setAmount('');
        loadOrders();
      }
    }
  }, [isOpen, initialOrder]);

  const loadOrders = async () => {
    try {
      setIsLoadingOrders(true);
      // Fetch completed orders to choose from
      const res = await ordersApi.list({ status: 'COMPLETED', limit: 100 });
      // Sort orders with outstanding balance first
      const sorted = [...res.data].sort((a, b) => {
        if (a.outstandingAmount > 0 && b.outstandingAmount <= 0) return -1;
        if (b.outstandingAmount > 0 && a.outstandingAmount <= 0) return 1;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setOrders(sorted);
    } catch {
      setError('Failed to fetch orders for payment association');
    } finally {
      setIsLoadingOrders(false);
    }
  };

  // When an order is chosen from dropdown, fetch its freshest authoritative details
  const handleOrderSelect = async (orderId: string) => {
    setSelectedOrderId(orderId);
    setError(null);

    if (!orderId) {
      setSelectedOrder(null);
      setAmount('');
      return;
    }

    try {
      setIsLoadingOrderDetail(true);
      const order = await ordersApi.getById(orderId);
      setSelectedOrder(order);
      if (order.outstandingAmount > 0) {
        setAmount(String(order.outstandingAmount));
      } else {
        setAmount('');
      }
    } catch {
      setError('Failed to load authoritative order details');
    } finally {
      setIsLoadingOrderDetail(false);
    }
  };

  const handlePayFullOutstanding = () => {
    if (selectedOrder && selectedOrder.outstandingAmount > 0) {
      setAmount(String(selectedOrder.outstandingAmount));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder) {
      setError('Please select an order to record payment against');
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Payment amount must be a positive number greater than 0');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const payload: CreatePaymentInput = {
        orderId: selectedOrder._id,
        amount: Math.round(parsedAmount * 100) / 100,
        paymentMethod,
        paymentDate: new Date(paymentDate).toISOString(),
        notes: notes.trim() || undefined,
        customerId: selectedOrder.customerId,
      };

      const created = await paymentsApi.create(payload);
      onSuccess(created);
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to record payment. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFullyPaid = Boolean(selectedOrder && selectedOrder.outstandingAmount <= 0);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Payment"
      description="Record an immutable payment against an existing completed order."
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="rounded-lg bg-rose-50 p-3.5 border border-rose-200 flex items-start gap-2 text-rose-800 text-sm">
            <AlertCircle className="h-4 w-4 text-rose-600 mt-0.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* 1. Order Association */}
        <div className="space-y-2">
          {initialOrder ? (
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
                Select Order <span className="text-rose-500">*</span>
              </label>
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-sm font-bold text-blue-700">
                    {initialOrder.orderNumber}
                  </span>
                  <span className="text-xs text-slate-500">
                    Linked Order
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <SearchableSelect
              label="Select Order *"
              value={selectedOrderId}
              onChange={handleOrderSelect}
              disabled={isLoadingOrders || isSubmitting}
              isLoading={isLoadingOrders}
              loadingText="Loading orders..."
              placeholder="Search by order number or customer name..."
              emptyText="No matching orders found"
              options={orders.map((o) => ({
                value: o._id,
                label: o.orderNumber,
                sublabel: `${o.customer?.name || 'Customer'}${o.customer?.phone ? ` (${o.customer.phone})` : ''}`,
                tag: o.outstandingAmount > 0 ? `Pending: ${formatCurrencyINR(o.outstandingAmount)}` : 'Fully Paid',
                searchTerms: [
                  o.orderNumber,
                  o.customer?.name || '',
                  o.customer?.phone || '',
                ],
              }))}
            />
          )}
        </div>

        {/* 2. Order Summary Card (Authoritative Backend Balances) */}
        {selectedOrder && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-slate-500" />
                <span className="font-mono text-xs font-bold text-slate-800">
                  {selectedOrder.orderNumber}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-600">
                <User className="h-3.5 w-3.5 text-slate-400" />
                <span className="font-medium text-slate-900">
                  {selectedOrder.customer?.name}
                </span>
                <span className="text-slate-400">({selectedOrder.customer?.phone})</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center pt-1">
              <div className="bg-white rounded-lg p-2 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Order Total</div>
                <div className="font-mono text-xs font-bold text-slate-900 mt-0.5">
                  {formatCurrencyINR(selectedOrder.totalAmount)}
                </div>
              </div>

              <div className="bg-white rounded-lg p-2 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Already Paid</div>
                <div className="font-mono text-xs font-bold text-emerald-700 mt-0.5">
                  {formatCurrencyINR(selectedOrder.paidAmount)}
                </div>
              </div>

              <div className="bg-white rounded-lg p-2 border border-slate-200">
                <div className="text-[11px] text-slate-500 font-medium">Outstanding</div>
                <div
                  className={`font-mono text-xs font-bold mt-0.5 ${
                    selectedOrder.outstandingAmount > 0
                      ? 'text-rose-700'
                      : 'text-emerald-700'
                  }`}
                >
                  {formatCurrencyINR(selectedOrder.outstandingAmount)}
                </div>
              </div>
            </div>

            {isFullyPaid && (
              <div className="rounded-lg bg-amber-50 p-2.5 border border-amber-200 flex items-center gap-2 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                <span>
                  This order is already fully paid. The backend will reject any additional payment.
                </span>
              </div>
            )}
          </div>
        )}

        {/* 3. Payment Amount & Payment Details */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Payment Amount */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-sm font-medium text-slate-900">
                Amount (₹) <span className="text-rose-500">*</span>
              </label>
              {selectedOrder && selectedOrder.outstandingAmount > 0 && (
                <button
                  type="button"
                  onClick={handlePayFullOutstanding}
                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                >
                  Pay Full ({formatCurrencyINR(selectedOrder.outstandingAmount)})
                </button>
              )}
            </div>
            <Input
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              disabled={isSubmitting || isFullyPaid}
              required
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Overpayment beyond remaining balance will be rejected by backend.
            </p>
          </div>

          {/* Payment Method */}
          <Select
            label="Payment Method"
            value={paymentMethod}
            onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
            disabled={isSubmitting || isFullyPaid}
            options={[
              { value: 'CASH', label: 'Cash' },
              { value: 'UPI', label: 'UPI' },
              { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
              { value: 'CHEQUE', label: 'Cheque' },
            ]}
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Payment Date */}
          <Input
            type="date"
            label="Payment Date"
            value={paymentDate}
            onChange={(e) => setPaymentDate(e.target.value)}
            disabled={isSubmitting || isFullyPaid}
            required
          />

          {/* Reference / Notes */}
          <Input
            label="Notes / Transaction Reference"
            placeholder="e.g. UPI ref, Cheque no., bank receipt"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={isSubmitting || isFullyPaid}
          />
        </div>

        {/* Modal Actions */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={isSubmitting || !selectedOrder || isFullyPaid}
            isLoading={isSubmitting}
          >
            <CreditCard className="h-4 w-4 mr-1.5" />
            Confirm Payment
          </Button>
        </div>
      </form>
    </Modal>
  );
}
