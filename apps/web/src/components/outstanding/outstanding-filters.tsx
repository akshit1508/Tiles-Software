import React, { useState, useEffect } from 'react';
import { Search, X } from 'lucide-react';
import { Input, Button } from '@/components/ui';

interface OutstandingFiltersProps {
  search: string;
  onSearchChange: (search: string) => void;
  isLoading?: boolean;
}

export function OutstandingFilters({
  search,
  onSearchChange,
  isLoading = false,
}: OutstandingFiltersProps) {
  const [localSearch, setLocalSearch] = useState(search);

  useEffect(() => {
    setLocalSearch(search);
  }, [search]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearchChange(localSearch.trim());
  };

  const handleClear = () => {
    setLocalSearch('');
    onSearchChange('');
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by customer name or phone number..."
            value={localSearch}
            onChange={(e) => setLocalSearch(e.target.value)}
            disabled={isLoading}
            className="pl-9"
          />
        </div>
        <Button
          type="submit"
          variant="primary"
          disabled={isLoading || localSearch === search}
        >
          Search
        </Button>
        {search && (
          <Button
            type="button"
            variant="ghost"
            onClick={handleClear}
            disabled={isLoading}
            className="text-slate-500 hover:text-slate-800"
          >
            <X className="h-4 w-4 mr-1" />
            Clear
          </Button>
        )}
      </div>
    </form>
  );
}
