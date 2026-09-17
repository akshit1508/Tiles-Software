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
  EmptyState,
} from '@/components/ui';
import {
  CustomerListItem,
  CustomerDetail,
  customersApi,
} from '@/lib/api/customers';
import { formatCurrencyINR } from '@/lib/api/products';
import { CustomerStatusBadge } from './customer-status-badge';
import { ApiError } from '@/lib/api';
import { Phone, MapPin, ShoppingBag, CreditCard, Clock } from 'lucide-react';

interface CustomerDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  customer: CustomerListItem | null;
}

export function CustomerDetailsModal({
  isOpen,
  onClose,
  customer,
}: CustomerDetailsModalProps) {
  const [detail, setDetail] = useState<CustomerDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'payments'>('orders');

  const fetchDetail = useCallback(async () => {
    if (!customer?._id) return;

    try {
      setIsLoading(true);
      setError(null);
      const res = await customersApi.getById(customer._id);
      setDetail(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch customer profile and ledger');
      }
    } finally {
      setIsLoading(false);
    }
  }, [customer?._id]);

  useEffect(() => {
    if (isOpen && customer?._id) {
      fetchDetail();
      setActiveTab('orders');
    }
  }, [isOpen, customer?._id, fetchDetail]);

  const formatDate = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return new Intl.DateTimeFormat('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }).format(d);
    } catch {
      return isoString;
    }
  };

  const renderOrderStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success" size="sm">Completed</Badge>;
      case 'CANCELLED':
        return <Badge variant="danger" size="sm">Cancelled</Badge>;
      default:
        return <Badge variant="default" size="sm">{status}</Badge>;
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Customer Profile & Ledger"
      description={
        customer
          ? `Authoritative order records and payment ledger for ${customer.name}`
          : 'Customer Profile'
      }
      size="xl"
    >
      <div className="space-y-5">
        {/* Customer Header & KPI Cards */}
        {customer && (
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-bold text-slate-900">{customer.name}</h3>
                  <CustomerStatusBadge isActive={customer.isActive} />
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-4 text-xs text-slate-600">
                  <span className="flex items-center gap-1 font-mono">
                    <Phone className="h-3 w-3 text-slate-400" />
                    {customer.phone}
                  </span>
                  {customer.address && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" />
                      {customer.address}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-slate-200/80">
              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Total Customer Orders
                </div>
                <div className="mt-0.5 text-xl font-bold text-slate-900 font-mono">
                  {detail ? detail.totalOrders : customer.totalOrders}
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  Current Outstanding Balance
                </div>
                <div
                  className={`mt-0.5 text-xl font-bold font-mono ${
                    (detail ? detail.outstandingBalance : customer.outstandingBalance) > 0
                      ? 'text-amber-800'
                      : 'text-emerald-700'
                  }`}
                >
                  {formatCurrencyINR(
                    detail ? detail.outstandingBalance : customer.outstandingBalance,
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveTab('orders')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'orders'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <ShoppingBag className="h-4 w-4" />
            Orders History ({detail?.orders?.length ?? 0})
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('payments')}
            className={`flex items-center gap-1.5 pb-2.5 px-3 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === 'payments'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-600 hover:text-slate-900'
            }`}
          >
            <CreditCard className="h-4 w-4" />
            Payment Ledger ({detail?.payments?.length ?? 0})
          </button>
        </div>

        {/* Tab Content */}
        {isLoading ? (
          <div className="p-8">
            <LoadingState message="Loading customer history and ledger..." />
          </div>
        ) : error ? (
          <ErrorState
            title="Failed to Load Customer Details"
            message={error}
            onRetry={fetchDetail}
          />
        ) : activeTab === 'orders' ? (
          detail?.orders && detail.orders.length > 0 ? (
            <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[340px] overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order No.</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-right">Total Amount</TableHead>
                    <TableHead className="text-right">Paid</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.orders.map((order) => (
                    <TableRow key={order._id}>
                      <TableCell className="font-mono text-xs font-semibold text-slate-900">
                        {order.orderNumber}
                      </TableCell>
                      <TableCell className="text-xs text-slate-600">
                        {formatDate(order.createdAt)}
                      </TableCell>
                      <TableCell className="text-center">
                        {renderOrderStatusBadge(order.status)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium text-slate-900">
                        {formatCurrencyINR(order.totalAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs text-emerald-700">
                        {formatCurrencyINR(order.paidAmount)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs font-semibold">
                        <span
                          className={
                            order.outstandingAmount > 0
                              ? 'text-amber-800'
                              : 'text-slate-500'
                          }
                        >
                          {formatCurrencyINR(order.outstandingAmount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <EmptyState
              icon={<ShoppingBag className="h-8 w-8 text-slate-400" />}
              title="No orders found"
              description="This customer does not have any orders recorded yet."
            />
          )
        ) : detail?.payments && detail.payments.length > 0 ? (
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden max-h-[340px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Payment Date</TableHead>
                  <TableHead>Method</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Order Ref</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {detail.payments.map((p) => (
                  <TableRow key={p._id}>
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
                    <TableCell className="font-mono text-xs text-slate-600">
                      {p.orderId}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {p.notes || <span className="text-slate-400">—</span>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <EmptyState
            icon={<CreditCard className="h-8 w-8 text-slate-400" />}
            title="No payments recorded"
            description="No payment ledger entries found for this customer."
          />
        )}

        <div className="mt-4 flex justify-end border-t border-slate-100 pt-3">
          <Button type="button" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
