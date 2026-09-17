import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';

interface CustomerFiltersProps {
  search: string;
  isActive: boolean | undefined;
  onFilterChange: (filters: { search: string; isActive: boolean | undefined }) => void;
  isLoading?: boolean;
}

export function CustomerFilters({
  search,
  isActive,
  onFilterChange,
  isLoading = false,
}: CustomerFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [localStatus, setLocalStatus] = useState<string>(
    isActive === undefined ? 'all' : isActive ? 'true' : 'false',
  );

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    setLocalStatus(isActive === undefined ? 'all' : isActive ? 'true' : 'false');
  }, [isActive]);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const activeVal =
      localStatus === 'all' ? undefined : localStatus === 'true';
    onFilterChange({
      search: localSearch.trim(),
      isActive: activeVal,
    });
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalStatus(val);
    const activeVal = val === 'all' ? undefined : val === 'true';
    onFilterChange({
      search: localSearch.trim(),
      isActive: activeVal,
    });
  };

  const handleReset = () => {
    setLocalSearch('');
    setLocalStatus('true');
    onFilterChange({
      search: '',
      isActive: true,
    });
  };

  const hasActiveFilters = search.trim() !== '' || localStatus !== 'true';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <form onSubmit={handleApply} className="flex flex-col md:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <Input
            label="Search Customers"
            placeholder="Search by customer name or phone number..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="w-full md:w-56">
          <Select
            label="Account Status"
            value={localStatus}
            onChange={handleStatusChange}
            disabled={isLoading}
            options={[
              { label: 'Active Customers', value: 'true' },
              { label: 'Deactivated Customers', value: 'false' },
              { label: 'All Customers', value: 'all' },
            ]}
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
            Search
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
      </form>
    </div>
  );
}
