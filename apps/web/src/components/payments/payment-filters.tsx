import React, { useState, useEffect } from 'react';
import { Filter, X, Calendar } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { PaymentMethod } from '@/lib/api/payments';
import { customersApi, CustomerListItem } from '@/lib/api/customers';

interface PaymentFiltersProps {
  paymentMethod?: PaymentMethod;
  startDate?: string;
  endDate?: string;
  customerId?: string;
  onFilterChange: (filters: {
    paymentMethod?: PaymentMethod;
    startDate?: string;
    endDate?: string;
    customerId?: string;
  }) => void;
  isLoading?: boolean;
}

export function PaymentFilters({
  paymentMethod,
  startDate,
  endDate,
  customerId,
  onFilterChange,
  isLoading = false,
}: PaymentFiltersProps) {
  const [localMethod, setLocalMethod] = useState<string>(paymentMethod || 'all');
  const [localStartDate, setLocalStartDate] = useState(startDate || '');
  const [localEndDate, setLocalEndDate] = useState(endDate || '');
  const [localCustomerId, setLocalCustomerId] = useState<string>(customerId || 'all');
  const [customers, setCustomers] = useState<CustomerListItem[]>([]);

  useEffect(() => {
    setLocalMethod(paymentMethod || 'all');
  }, [paymentMethod]);

  useEffect(() => {
    setLocalStartDate(startDate || '');
  }, [startDate]);

  useEffect(() => {
    setLocalEndDate(endDate || '');
  }, [endDate]);

  useEffect(() => {
    setLocalCustomerId(customerId || 'all');
  }, [customerId]);

  // Load customer list for customer filter dropdown
  useEffect(() => {
    let isMounted = true;
    async function loadCustomers() {
      try {
        const res = await customersApi.list({ limit: 100 });
        if (isMounted) {
          setCustomers(res.data);
        }
      } catch {
        // Fallback silently if customer listing fails
      }
    }
    loadCustomers();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleMethodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalMethod(val);
    onFilterChange({
      paymentMethod: val === 'all' ? undefined : (val as PaymentMethod),
      startDate: localStartDate ? new Date(localStartDate).toISOString() : undefined,
      endDate: localEndDate ? new Date(localEndDate + 'T23:59:59.999Z').toISOString() : undefined,
      customerId: localCustomerId === 'all' ? undefined : localCustomerId,
    });
  };

  const handleCustomerChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalCustomerId(val);
    onFilterChange({
      paymentMethod: localMethod === 'all' ? undefined : (localMethod as PaymentMethod),
      startDate: localStartDate ? new Date(localStartDate).toISOString() : undefined,
      endDate: localEndDate ? new Date(localEndDate + 'T23:59:59.999Z').toISOString() : undefined,
      customerId: val === 'all' ? undefined : val,
    });
  };

  const handleDateApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onFilterChange({
      paymentMethod: localMethod === 'all' ? undefined : (localMethod as PaymentMethod),
      startDate: localStartDate ? new Date(localStartDate).toISOString() : undefined,
      endDate: localEndDate ? new Date(localEndDate + 'T23:59:59.999Z').toISOString() : undefined,
      customerId: localCustomerId === 'all' ? undefined : localCustomerId,
    });
  };

  const handleReset = () => {
    setLocalMethod('all');
    setLocalStartDate('');
    setLocalEndDate('');
    setLocalCustomerId('all');
    onFilterChange({
      paymentMethod: undefined,
      startDate: undefined,
      endDate: undefined,
      customerId: undefined,
    });
  };

  const isFiltered =
    localMethod !== 'all' ||
    localStartDate !== '' ||
    localEndDate !== '' ||
    localCustomerId !== 'all';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* Payment Method Filter */}
        <Select
          value={localMethod}
          onChange={handleMethodChange}
          disabled={isLoading}
          label="Payment Method"
          options={[
            { value: 'all', label: 'All Payment Methods' },
            { value: 'CASH', label: 'Cash' },
            { value: 'UPI', label: 'UPI' },
            { value: 'BANK_TRANSFER', label: 'Bank Transfer' },
            { value: 'CHEQUE', label: 'Cheque' },
          ]}
        />

        {/* Customer Filter */}
        <Select
          value={localCustomerId}
          onChange={handleCustomerChange}
          disabled={isLoading}
          label="Customer"
          options={[
            { value: 'all', label: 'All Customers' },
            ...customers.map((c) => ({
              value: c._id,
              label: `${c.name} (${c.phone})`,
            })),
          ]}
        />

        {/* Start Date */}
        <Input
          type="date"
          label="Payment Date (From)"
          value={localStartDate}
          onChange={(e) => setLocalStartDate(e.target.value)}
          disabled={isLoading}
        />

        {/* End Date */}
        <Input
          type="date"
          label="Payment Date (To)"
          value={localEndDate}
          onChange={(e) => setLocalEndDate(e.target.value)}
          disabled={isLoading}
        />
      </div>

      <div className="flex items-center justify-between pt-1 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleDateApply}
            disabled={isLoading}
          >
            <Calendar className="h-3.5 w-3.5 mr-1 text-slate-500" />
            Apply Dates
          </Button>

          {isFiltered && (
            <Button
              size="sm"
              variant="ghost"
              onClick={handleReset}
              disabled={isLoading}
              className="text-slate-500 hover:text-slate-800"
            >
              <X className="h-3.5 w-3.5 mr-1" />
              Reset Filters
            </Button>
          )}
        </div>

        {isFiltered && (
          <span className="text-xs text-slate-500 font-medium">
            Active filters applied
          </span>
        )}
      </div>
    </div>
  );
}
