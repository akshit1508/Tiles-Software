'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, RefreshCw, CheckCircle2, IndianRupee, Users } from 'lucide-react';
import {
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from '@/components/ui';
import {
  CustomerOutstandingListItem,
  outstandingApi,
} from '@/lib/api/outstanding';
import { Order, ordersApi } from '@/lib/api/orders';
import { Payment } from '@/lib/api/payments';
import { formatCurrencyINR } from '@/lib/api/products';
import { ApiError } from '@/lib/api';
import {
  OutstandingFilters,
  OutstandingTable,
  OutstandingBreakdownModal,
} from '@/components/outstanding';
import { PaymentFormModal } from '@/components/payments';

export default function OutstandingPage() {
  const [customers, setCustomers] = useState<CustomerOutstandingListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);
  const [search, setSearch] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [selectedCustomerForBreakdown, setSelectedCustomerForBreakdown] =
    useState<CustomerOutstandingListItem | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentTargetOrder, setPaymentTargetOrder] = useState<Order | null>(null);
  const [isLoadingOrderForPayment, setIsLoadingOrderForPayment] = useState(false);

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await outstandingApi.getCustomers({
        page,
        limit,
        search: search.trim() || undefined,
      });

      setCustomers(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch outstanding balances. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleSearchChange = (newSearch: string) => {
    setSearch(newSearch);
    setPage(1);
  };

  const handleRecordPaymentForOrder = async (orderId: string) => {
    try {
      setIsLoadingOrderForPayment(true);
      const order = await ordersApi.getById(orderId);
      setPaymentTargetOrder(order);
      setIsPaymentModalOpen(true);
    } catch {
      setError('Failed to retrieve order details for payment');
    } finally {
      setIsLoadingOrderForPayment(false);
    }
  };

  const handlePaymentSuccess = (payment: Payment) => {
    setSuccessMessage(
      `Payment of ${formatCurrencyINR(payment.amount)} recorded successfully.`
    );
    setIsPaymentModalOpen(false);
    setPaymentTargetOrder(null);
    // Refresh the debtor list
    fetchCustomers();
    // Refresh the open customer breakdown modal if one is active
    if (selectedCustomerForBreakdown) {
      setSelectedCustomerForBreakdown({ ...selectedCustomerForBreakdown });
    }
  };

  const currentViewOutstandingTotal = customers.reduce(
    (sum, c) => sum + (c.outstanding || 0),
    0,
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
            <span>Outstanding Balances</span>
          </h1>
          <p className="text-sm text-slate-500">
            Debtor accounts derived strictly from completed orders and verified payment collections.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchCustomers}
            disabled={isLoading}
            className="h-9 shadow-2xs"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
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
              Customers With Balance
            </span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600 border border-amber-100">
              <Users className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {total}
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Active accounts with outstanding &gt; ₹0
          </p>
        </div>

        <div className="rounded-xl border border-amber-200 bg-amber-50/40 p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
              Outstanding (Current Page)
            </span>
            <div className="rounded-lg bg-amber-100 p-2 text-amber-700">
              <IndianRupee className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-800 font-mono">
            {formatCurrencyINR(currentViewOutstandingTotal)}
          </div>
          <p className="text-xs text-amber-700/80 mt-1">
            Across {customers.length} debtor accounts in view
          </p>
        </div>
      </div>

      {/* Search Filter */}
      <OutstandingFilters
        search={search}
        onSearchChange={handleSearchChange}
        isLoading={isLoading}
      />

      {/* Content State */}
      {isLoading ? (
        <LoadingState message="Loading outstanding accounts..." />
      ) : error ? (
        <ErrorState
          title="Failed to Load Outstanding Balances"
          message={error}
          onRetry={fetchCustomers}
        />
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm p-6">
          <EmptyState
            icon={<CheckCircle2 className="h-10 w-10 text-emerald-500" />}
            title={search ? 'No debtor accounts found' : 'All Accounts Settled'}
            description={
              search
                ? 'No customers with pending balances match your search query.'
                : 'There are currently zero customers with pending outstanding balances.'
            }
          />
        </div>
      ) : (
        <div className="space-y-4">
          <OutstandingTable
            customers={customers}
            onViewBreakdown={(c) => setSelectedCustomerForBreakdown(c)}
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

      {/* Customer Outstanding Breakdown Modal */}
      <OutstandingBreakdownModal
        isOpen={!!selectedCustomerForBreakdown}
        onClose={() => setSelectedCustomerForBreakdown(null)}
        customerItem={selectedCustomerForBreakdown}
        onRecordPaymentForOrder={handleRecordPaymentForOrder}
      />

      {/* Reused Payment Form Modal */}
      <PaymentFormModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setPaymentTargetOrder(null);
        }}
        onSuccess={handlePaymentSuccess}
        initialOrder={paymentTargetOrder}
      />
    </div>
  );
}
