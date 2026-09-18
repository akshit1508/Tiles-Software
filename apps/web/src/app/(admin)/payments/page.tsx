'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, CreditCard, CheckCircle2, IndianRupee, ArrowDownRight } from 'lucide-react';
import {
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from '@/components/ui';
import {
  Payment,
  PaymentMethod,
  paymentsApi,
} from '@/lib/api/payments';
import { formatCurrencyINR } from '@/lib/api/products';
import { ApiError } from '@/lib/api';
import {
  PaymentFilters,
  PaymentTable,
  PaymentFormModal,
  PaymentDetailsModal,
} from '@/components/payments';

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // Filters (strictly whitelisted backend parameters)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [customerId, setCustomerId] = useState<string | undefined>(undefined);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [isRecordModalOpen, setIsRecordModalOpen] = useState(false);
  const [selectedPaymentForDetails, setSelectedPaymentForDetails] = useState<Payment | null>(null);

  const fetchPayments = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await paymentsApi.list({
        page,
        limit,
        paymentMethod,
        startDate,
        endDate,
        customerId,
      });

      setPayments(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to load payments ledger. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, paymentMethod, startDate, endDate, customerId]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleFilterChange = (filters: {
    paymentMethod?: PaymentMethod;
    startDate?: string;
    endDate?: string;
    customerId?: string;
  }) => {
    setPaymentMethod(filters.paymentMethod);
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
    setCustomerId(filters.customerId);
    setPage(1); // Reset to page 1 on filter change
  };

  const handlePaymentCreated = (payment: Payment) => {
    setSuccessMessage(
      `Payment of ${formatCurrencyINR(payment.amount)} recorded successfully.`
    );
    fetchPayments();
  };

  const currentViewCollectedTotal = payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const isFiltered =
    paymentMethod !== undefined ||
    startDate !== undefined ||
    endDate !== undefined ||
    customerId !== undefined;

  return (
    <div className="space-y-6">
      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Payments Ledger
          </h1>
          <p className="text-sm text-slate-500">
            Record payments against orders (Cash, UPI, Bank Transfer, Cheque) and review immutable financial transaction logs.
          </p>
        </div>

        <Button
          variant="primary"
          onClick={() => setIsRecordModalOpen(true)}
          className="shadow-sm"
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Record Payment
        </Button>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 flex items-center justify-between text-emerald-800 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span className="text-sm font-medium">{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-xs font-semibold text-emerald-700 hover:text-emerald-900 ml-4"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Metric Cards (Real backend data only) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Recorded Payments
            </span>
            <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
              <CreditCard className="h-4 w-4 text-slate-600" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {total}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Immutable transaction records
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-800">
              Collected (Current Page)
            </span>
            <div className="rounded-lg bg-emerald-100/70 p-2">
              <ArrowDownRight className="h-4 w-4 text-emerald-700" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-800 font-mono">
            {formatCurrencyINR(currentViewCollectedTotal)}
          </div>
          <p className="text-xs text-emerald-700/80 mt-1">
            Across {payments.length} transactions in view
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm hidden lg:block">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Accepted Methods
            </span>
            <div className="rounded-lg bg-slate-50 p-2 border border-slate-100">
              <IndianRupee className="h-4 w-4 text-slate-600" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <span className="text-[11px] font-medium bg-slate-100 text-slate-700 px-2 py-0.5 rounded">
              Cash
            </span>
            <span className="text-[11px] font-medium bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
              UPI
            </span>
            <span className="text-[11px] font-medium bg-purple-50 text-purple-700 px-2 py-0.5 rounded">
              Bank Transfer
            </span>
            <span className="text-[11px] font-medium bg-amber-50 text-amber-700 px-2 py-0.5 rounded">
              Cheque
            </span>
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <PaymentFilters
        paymentMethod={paymentMethod}
        startDate={startDate}
        endDate={endDate}
        customerId={customerId}
        onFilterChange={handleFilterChange}
        isLoading={isLoading}
      />

      {/* Content State: Loading / Error / Empty / Table */}
      {isLoading ? (
        <LoadingState message="Loading payment records..." />
      ) : error ? (
        <ErrorState
          title="Failed to Load Payments"
          message={error}
          onRetry={fetchPayments}
        />
      ) : payments.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <EmptyState
            icon={<CreditCard className="h-10 w-10 text-slate-400" />}
            title={isFiltered ? 'No matching payments found' : 'No payments recorded yet'}
            description={
              isFiltered
                ? 'Try adjusting your payment method, date range, or customer filters.'
                : 'Payments recorded against orders will appear here in chronological order.'
            }
            actionLabel={isFiltered ? undefined : 'Record New Payment'}
            onAction={isFiltered ? undefined : () => setIsRecordModalOpen(true)}
          />
        </div>
      ) : (
        <div className="space-y-4">
          <PaymentTable
            payments={payments}
            onViewDetails={(payment) => setSelectedPaymentForDetails(payment)}
          />

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pt-2">
              <Pagination
                page={page}
                totalPages={totalPages}
                totalItems={total}
                pageSize={limit}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </div>
          )}
        </div>
      )}

      {/* Record Payment Modal */}
      <PaymentFormModal
        isOpen={isRecordModalOpen}
        onClose={() => setIsRecordModalOpen(false)}
        onSuccess={handlePaymentCreated}
      />

      {/* Payment Details Modal */}
      <PaymentDetailsModal
        isOpen={!!selectedPaymentForDetails}
        onClose={() => setSelectedPaymentForDetails(null)}
        payment={selectedPaymentForDetails}
      />
    </div>
  );
}
