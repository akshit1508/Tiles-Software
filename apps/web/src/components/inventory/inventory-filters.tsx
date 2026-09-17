import React, { useState, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';

interface InventoryFiltersProps {
  search: string;
  lowStockOnly: boolean;
  onFilterChange: (filters: { search: string; lowStockOnly: boolean }) => void;
  isLoading?: boolean;
}

export function InventoryFilters({
  search,
  lowStockOnly,
  onFilterChange,
  isLoading = false,
}: InventoryFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [localLowStock, setLocalLowStock] = useState<string>(
    lowStockOnly ? 'true' : 'false',
  );

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    setLocalLowStock(lowStockOnly ? 'true' : 'false');
  }, [lowStockOnly]);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onFilterChange({
      search: localSearch.trim(),
      lowStockOnly: localLowStock === 'true',
    });
  };

  const handleLowStockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalLowStock(val);
    onFilterChange({
      search: localSearch.trim(),
      lowStockOnly: val === 'true',
    });
  };

  const handleReset = () => {
    setLocalSearch('');
    setLocalLowStock('false');
    onFilterChange({
      search: '',
      lowStockOnly: false,
    });
  };

  const hasActiveFilters = search.trim() !== '' || lowStockOnly;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <form onSubmit={handleApply} className="flex flex-col md:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <Input
            label="Search Inventory"
            placeholder="Search by product name, brand, or Galla number..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div className="w-full md:w-56">
          <Select
            label="Stock Level"
            value={localLowStock}
            onChange={handleLowStockChange}
            disabled={isLoading}
            options={[
              { label: 'All Stock Levels', value: 'false' },
              { label: '⚠️ Low Stock Only', value: 'true' },
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
