import React, { useState, useEffect } from 'react';
import { Search, X, Calendar } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { OrderStatus } from '@/lib/api/orders';

interface OrderFiltersProps {
  search: string;
  status?: OrderStatus;
  startDate?: string;
  endDate?: string;
  onFilterChange: (filters: {
    search: string;
    status?: OrderStatus;
    startDate?: string;
    endDate?: string;
  }) => void;
  isLoading?: boolean;
}

export function OrderFilters({
  search,
  status,
  startDate,
  endDate,
  onFilterChange,
  isLoading = false,
}: OrderFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [localStatus, setLocalStatus] = useState<string>(status || 'all');
  const [localStartDate, setLocalStartDate] = useState(startDate || '');
  const [localEndDate, setLocalEndDate] = useState(endDate || '');

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    setLocalStatus(status || 'all');
  }, [status]);

  useEffect(() => {
    setLocalStartDate(startDate || '');
  }, [startDate]);

  useEffect(() => {
    setLocalEndDate(endDate || '');
  }, [endDate]);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onFilterChange({
      search: localSearch.trim(),
      status: localStatus === 'all' ? undefined : (localStatus as OrderStatus),
      startDate: localStartDate ? new Date(localStartDate).toISOString() : undefined,
      endDate: localEndDate ? new Date(localEndDate + 'T23:59:59.999Z').toISOString() : undefined,
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalStatus(val);
    onFilterChange({
      search: localSearch.trim(),
      status: val === 'all' ? undefined : (val as OrderStatus),
      startDate: localStartDate ? new Date(localStartDate).toISOString() : undefined,
      endDate: localEndDate ? new Date(localEndDate + 'T23:59:59.999Z').toISOString() : undefined,
    });
  };

  const handleReset = () => {
    setLocalSearch('');
    setLocalStatus('all');
    setLocalStartDate('');
    setLocalEndDate('');
    onFilterChange({
      search: '',
      status: undefined,
      startDate: undefined,
      endDate: undefined,
    });
  };

  const hasActiveFilters =
    search.trim() !== '' ||
    localStatus !== 'all' ||
    localStartDate !== '' ||
    localEndDate !== '';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <form onSubmit={handleApply} className="space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <Input
              label="Search Orders"
              placeholder="Search by Order No. (e.g. GT-2026...), customer name, or phone..."
              value={localSearch}
              onChange={(e) => setLocalSearch(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="w-full md:w-48">
            <Select
              label="Order Status"
              value={localStatus}
              onChange={handleStatusChange}
              disabled={isLoading}
              options={[
                { label: 'All Orders', value: 'all' },
                { label: 'Completed Only', value: 'COMPLETED' },
                { label: 'Cancelled Only', value: 'CANCELLED' },
              ]}
            />
          </div>

          <div className="w-full md:w-40">
            <Input
              label="From Date"
              type="date"
              value={localStartDate}
              onChange={(e) => setLocalStartDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="w-full md:w-40">
            <Input
              label="To Date"
              type="date"
              value={localEndDate}
              onChange={(e) => setLocalEndDate(e.target.value)}
              disabled={isLoading}
            />
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <Button
              type="submit"
              variant="secondary"
              disabled={isLoading}
              className="w-full md:w-auto"
            >
              <Search className="h-4 w-4 mr-1.5 text-slate-500" />
              Filter
            </Button>

            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                onClick={handleReset}
                disabled={isLoading}
                className="text-slate-500 hover:text-slate-800"
              >
                <X className="h-4 w-4 mr-1" />
                Reset
              </Button>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
