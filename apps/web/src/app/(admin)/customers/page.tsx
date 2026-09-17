'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { UserPlus, Users, CheckCircle2, AlertCircle } from 'lucide-react';
import {
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from '@/components/ui';
import {
  CustomerListItem,
  customersApi,
} from '@/lib/api/customers';
import { formatCurrencyINR } from '@/lib/api/products';
import { ApiError } from '@/lib/api';
import {
  CustomerFilters,
  CustomerTable,
  CustomerFormModal,
  CustomerDeactivateDialog,
  CustomerDetailsModal,
} from '@/components/customers';

export default function CustomersPage() {
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [isActive, setIsActive] = useState<boolean | undefined>(true);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedCustomerForEdit, setSelectedCustomerForEdit] = useState<CustomerListItem | null>(null);
  const [selectedCustomerForStatus, setSelectedCustomerForStatus] = useState<CustomerListItem | null>(null);
  const [selectedCustomerForDetails, setSelectedCustomerForDetails] = useState<CustomerListItem | null>(null);

  const fetchCustomers = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await customersApi.list({
        page,
        limit,
        search: search.trim() || undefined,
        isActive,
      });

      setCustomers(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to load customer directory. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, isActive]);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleFilterChange = (filters: {
    search: string;
    isActive: boolean | undefined;
  }) => {
    setSearch(filters.search);
    setIsActive(filters.isActive);
    setPage(1);
  };

  const handleOpenCreate = () => {
    setSelectedCustomerForEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (customer: CustomerListItem) => {
    setSelectedCustomerForEdit(customer);
    setIsFormModalOpen(true);
  };

  const handleFormSuccess = () => {
    const isEdit = !!selectedCustomerForEdit;
    setSuccessMessage(
      isEdit
        ? 'Customer profile updated successfully.'
        : 'Customer registered successfully.',
    );
    fetchCustomers();
  };

  const handleStatusToggleSuccess = () => {
    const wasActive = selectedCustomerForStatus?.isActive;
    setSuccessMessage(
      wasActive
        ? 'Customer deactivated successfully.'
        : 'Customer reactivated successfully.',
    );
    fetchCustomers();
  };

  // Derived page-level summary stats
  const customersWithOutstanding = customers.filter(
    (c) => c.outstandingBalance > 0,
  ).length;

  const currentViewOutstandingTotal = customers.reduce(
    (sum, c) => sum + (c.outstandingBalance || 0),
    0,
  );

  const hasFiltersApplied = search.trim() !== '' || isActive !== true;

  return (
    <div className="space-y-6">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Customer Directory
          </h1>
          <p className="text-sm text-slate-500">
            Manage customer accounts, track purchase histories, and review server-derived outstanding balances.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={handleOpenCreate}
        >
          <UserPlus className="h-4 w-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Customers
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{total}</span>
            <span className="text-xs text-slate-500">master records</span>
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 shadow-xs transition-colors ${
            customersWithOutstanding > 0
              ? 'border-amber-300 bg-amber-50/50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Accounts with Outstanding (Page View)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                customersWithOutstanding > 0 ? 'text-amber-800' : 'text-slate-900'
              }`}
            >
              {customersWithOutstanding}
            </span>
            <span className="text-xs text-slate-500">
              {customersWithOutstanding === 1 ? 'customer has pending balance' : 'customers have pending balance'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Outstanding Amount (Page View)
          </div>
          <div className="mt-1 flex items-baseline gap-2 font-mono">
            <span className="text-2xl font-bold text-slate-900">
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
      <CustomerFilters
        search={search}
        isActive={isActive}
        onFilterChange={handleFilterChange}
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      {isLoading && customers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-xs">
          <LoadingState message="Loading customers..." />
        </div>
      ) : error && customers.length === 0 ? (
        <ErrorState
          title="Failed to Load Customers"
          message={error}
          onRetry={fetchCustomers}
        />
      ) : customers.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          {hasFiltersApplied ? (
            <EmptyState
              icon={<Users className="h-8 w-8 text-slate-400" />}
              title="No matching customers found"
              description="No customers match your search query or status filter. Try clearing or broadening your search criteria."
              actionLabel="Reset Filters"
              onAction={() => handleFilterChange({ search: '', isActive: true })}
            />
          ) : (
            <EmptyState
              icon={<Users className="h-8 w-8 text-blue-600" />}
              title="Customer Directory is Empty"
              description="No customers have been registered yet. Add your first customer to start recording orders and payments."
              actionLabel="Register Customer"
              onAction={handleOpenCreate}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <CustomerTable
            customers={customers}
            onViewDetails={(cust) => setSelectedCustomerForDetails(cust)}
            onEdit={handleOpenEdit}
            onToggleStatus={(cust) => setSelectedCustomerForStatus(cust)}
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

      {/* Create / Edit Modal */}
      <CustomerFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedCustomerForEdit(null);
        }}
        onSuccess={handleFormSuccess}
        customer={selectedCustomerForEdit}
      />

      {/* Deactivate / Reactivate Confirmation Dialog */}
      <CustomerDeactivateDialog
        isOpen={!!selectedCustomerForStatus}
        onClose={() => setSelectedCustomerForStatus(null)}
        onSuccess={handleStatusToggleSuccess}
        customer={selectedCustomerForStatus}
      />

      {/* Customer Profile & Ledger Details Modal */}
      <CustomerDetailsModal
        isOpen={!!selectedCustomerForDetails}
        onClose={() => setSelectedCustomerForDetails(null)}
        customer={selectedCustomerForDetails}
      />
    </div>
  );
}
