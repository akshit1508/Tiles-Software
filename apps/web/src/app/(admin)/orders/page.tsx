'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ShoppingBag, CheckCircle2 } from 'lucide-react';
import {
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from '@/components/ui';
import {
  Order,
  OrderStatus,
  ordersApi,
} from '@/lib/api/orders';
import { formatCurrencyINR } from '@/lib/api/products';
import { ApiError } from '@/lib/api';
import {
  OrderFilters,
  OrderTable,
  OrderCreateModal,
  OrderDetailsModal,
  OrderCancelDialog,
} from '@/components/orders';

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<OrderStatus | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedOrderForDetails, setSelectedOrderForDetails] = useState<Order | null>(null);
  const [selectedOrderForCancel, setSelectedOrderForCancel] = useState<Order | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await ordersApi.list({
        page,
        limit,
        search: search.trim() || undefined,
        status,
        startDate,
        endDate,
      });

      setOrders(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to load orders. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, status, startDate, endDate]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleFilterChange = (filters: {
    search: string;
    status?: OrderStatus;
    startDate?: string;
    endDate?: string;
  }) => {
    setSearch(filters.search);
    setStatus(filters.status);
    setStartDate(filters.startDate);
    setEndDate(filters.endDate);
    setPage(1);
  };

  const handleCreateSuccess = (createdOrder: Order) => {
    setSuccessMessage(
      `Sale ${createdOrder.orderNumber} created successfully.${
        createdOrder.paidAmount > 0
          ? ` Initial payment of ${formatCurrencyINR(createdOrder.paidAmount)} recorded.`
          : ''
      }`,
    );
    fetchOrders();
  };

  const handleCancelSuccess = () => {
    setSuccessMessage(
      'Order cancelled successfully. Physical inventory has been restored via SALE_REVERSAL.',
    );
    fetchOrders();
  };

  // Metrics summary
  const completedOrdersCount = orders.filter((o) => o.status === 'COMPLETED').length;
  const currentViewOutstandingTotal = orders
    .filter((o) => o.status === 'COMPLETED')
    .reduce((sum, o) => sum + (o.outstandingAmount || 0), 0);

  const hasFiltersApplied =
    search.trim() !== '' ||
    status !== undefined ||
    startDate !== undefined ||
    endDate !== undefined;

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Orders Management
          </h1>
          <p className="text-sm text-slate-500">
            Create tile sale orders, monitor line item snapshots, review payments, and manage cancellations.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={() => setIsCreateModalOpen(true)}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Create Order
        </Button>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Orders Logged
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{total}</span>
            <span className="text-xs text-slate-500">order records</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Completed Sales (Page View)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">
              {completedOrdersCount}
            </span>
            <span className="text-xs text-slate-500">active completed sales</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Outstanding Amount (Page View)
          </div>
          <div className="mt-1 flex items-baseline gap-2 font-mono">
            <span
              className={`text-2xl font-bold ${
                currentViewOutstandingTotal > 0 ? 'text-amber-800' : 'text-slate-900'
              }`}
            >
              {formatCurrencyINR(currentViewOutstandingTotal)}
            </span>
          </div>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div
          className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 transition-all"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Filter Bar */}
      <OrderFilters
        search={search}
        status={status}
        startDate={startDate}
        endDate={endDate}
        onFilterChange={handleFilterChange}
        isLoading={isLoading}
      />

      {/* Content State */}
      {isLoading && orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-xs">
          <LoadingState message="Loading orders..." />
        </div>
      ) : error && orders.length === 0 ? (
        <ErrorState
          title="Failed to Load Orders"
          message={error}
          onRetry={fetchOrders}
        />
      ) : orders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          {hasFiltersApplied ? (
            <EmptyState
              icon={<ShoppingBag className="h-8 w-8 text-slate-400" />}
              title="No matching orders found"
              description="No orders match your filter criteria. Try clearing search filters or adjusting the date range."
              actionLabel="Reset Filters"
              onAction={() =>
                handleFilterChange({
                  search: '',
                  status: undefined,
                  startDate: undefined,
                  endDate: undefined,
                })
              }
            />
          ) : (
            <EmptyState
              icon={<ShoppingBag className="h-8 w-8 text-blue-600" />}
              title="No orders created yet"
              description="Start recording customer sales. Orders will atomically deduct physical inventory and generate unique order numbers."
              actionLabel="Create First Order"
              onAction={() => setIsCreateModalOpen(true)}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <OrderTable
            orders={orders}
            onViewDetails={(order) => setSelectedOrderForDetails(order)}
            onCancel={(order) => setSelectedOrderForCancel(order)}
          />

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={limit}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}

      {/* Create Order Modal */}
      <OrderCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />

      {/* Order Details Modal */}
      <OrderDetailsModal
        isOpen={!!selectedOrderForDetails}
        onClose={() => setSelectedOrderForDetails(null)}
        order={selectedOrderForDetails}
        onCancelOrder={(order) => {
          setSelectedOrderForDetails(null);
          setSelectedOrderForCancel(order);
        }}
        onPaymentSuccess={() => {
          setSuccessMessage('Payment recorded successfully.');
          fetchOrders();
        }}
      />

      {/* Cancel Order Confirmation Dialog */}
      <OrderCancelDialog
        isOpen={!!selectedOrderForCancel}
        onClose={() => setSelectedOrderForCancel(null)}
        onSuccess={handleCancelSuccess}
        order={selectedOrderForCancel}
      />
    </div>
  );
}
