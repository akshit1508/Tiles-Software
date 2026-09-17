'use client';

import React, { useState, useEffect } from 'react';
import { Search, RotateCcw, Filter } from 'lucide-react';
import { Button, Input, Select } from '@/components/ui';

interface ProductFiltersProps {
  brand: string;
  category: string;
  isActive: boolean;
  onFilterChange: (filters: { brand: string; category: string; isActive: boolean }) => void;
  isLoading?: boolean;
}

export function ProductFilters({
  brand,
  category,
  isActive,
  onFilterChange,
  isLoading = false,
}: ProductFiltersProps) {
  const [localBrand, setLocalBrand] = useState(brand);
  const [localCategory, setLocalCategory] = useState(category);
  const [localIsActive, setLocalIsActive] = useState<boolean>(isActive);

  useEffect(() => {
    setLocalBrand(brand);
  }, [brand]);

  useEffect(() => {
    setLocalCategory(category);
  }, [category]);

  useEffect(() => {
    setLocalIsActive(isActive);
  }, [isActive]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onFilterChange({
      brand: localBrand.trim(),
      category: localCategory.trim(),
      isActive: localIsActive,
    });
  };

  const handleReset = () => {
    setLocalBrand('');
    setLocalCategory('');
    setLocalIsActive(true);
    onFilterChange({
      brand: '',
      category: '',
      isActive: true,
    });
  };

  const hasActiveFilters = localBrand !== '' || localCategory !== '' || !localIsActive;

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3"
    >
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
        <Filter className="h-3.5 w-3.5" />
        Filter Catalog
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div>
          <Input
            placeholder="Filter by brand..."
            value={localBrand}
            onChange={(e) => setLocalBrand(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div>
          <Input
            placeholder="Filter by category (Floor, Wall...)"
            value={localCategory}
            onChange={(e) => setLocalCategory(e.target.value)}
            disabled={isLoading}
          />
        </div>

        <div>
          <Select
            options={[
              { label: 'Active Products', value: 'true' },
              { label: 'Deactivated Products', value: 'false' },
            ]}
            value={localIsActive ? 'true' : 'false'}
            onChange={(e) => setLocalIsActive(e.target.value === 'true')}
            disabled={isLoading}
          />
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="submit"
            variant="primary"
            size="md"
            className="flex-1"
            disabled={isLoading}
          >
            <Search className="h-4 w-4 mr-1.5" />
            Filter
          </Button>

          {hasActiveFilters && (
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={handleReset}
              disabled={isLoading}
              title="Reset Filters"
            >
              <RotateCcw className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
