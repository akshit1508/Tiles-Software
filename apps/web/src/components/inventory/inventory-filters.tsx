import React, { useState, useEffect } from 'react';
import { Search, X, Filter } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';
import { Galla } from '@/lib/api/gallas';

interface InventoryFiltersProps {
  search: string;
  lowStockOnly: boolean;
  gallaId?: string;
  availableGallas?: Galla[];
  onFilterChange: (filters: { search: string; lowStockOnly: boolean; gallaId?: string }) => void;
  isLoading?: boolean;
}

export function InventoryFilters({
  search,
  lowStockOnly,
  gallaId = '',
  availableGallas = [],
  onFilterChange,
  isLoading = false,
}: InventoryFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);
  const [localLowStock, setLocalLowStock] = useState<string>(
    lowStockOnly ? 'true' : 'false',
  );
  const [localGallaId, setLocalGallaId] = useState<string>(gallaId);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  useEffect(() => {
    setLocalLowStock(lowStockOnly ? 'true' : 'false');
  }, [lowStockOnly]);

  useEffect(() => {
    setLocalGallaId(gallaId);
  }, [gallaId]);

  const handleApply = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    onFilterChange({
      search: localSearch.trim(),
      lowStockOnly: localLowStock === 'true',
      gallaId: localGallaId || undefined,
    });
  };

  const handleLowStockChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalLowStock(val);
    onFilterChange({
      search: localSearch.trim(),
      lowStockOnly: val === 'true',
      gallaId: localGallaId || undefined,
    });
  };

  const handleGallaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setLocalGallaId(val);
    onFilterChange({
      search: localSearch.trim(),
      lowStockOnly: localLowStock === 'true',
      gallaId: val || undefined,
    });
  };

  const handleReset = () => {
    setLocalSearch('');
    setLocalLowStock('false');
    setLocalGallaId('');
    onFilterChange({
      search: '',
      lowStockOnly: false,
      gallaId: undefined,
    });
  };

  const hasActiveFilters = search.trim() !== '' || lowStockOnly || localGallaId !== '';

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

        {availableGallas.length > 0 && (
          <div className="w-full md:w-56">
            <Select
              label="Galla Location"
              value={localGallaId}
              onChange={handleGallaChange}
              disabled={isLoading}
              options={[
                { label: 'All Gallas', value: '' },
                ...availableGallas.map((g) => ({
                  label: `${g.gallaNumber}${g.name ? ` — ${g.name}` : ''}`,
                  value: g._id,
                })),
              ]}
            />
          </div>
        )}

        <div className="w-full md:w-52">
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
