import React from 'react';
import { Search, Loader2 } from 'lucide-react';
import { Button, Select } from '@/components/ui';

interface TileStockFiltersProps {
  sizes: string[];
  isLoadingSizes: boolean;
  selectedSize: string;
  onSizeChange: (size: string) => void;
  availableOnly: boolean;
  onAvailableOnlyChange: (availableOnly: boolean) => void;
  onGenerate: () => void;
  isGenerating: boolean;
}

export function TileStockFilters({
  sizes,
  isLoadingSizes,
  selectedSize,
  onSizeChange,
  availableOnly,
  onAvailableOnlyChange,
  onGenerate,
  isGenerating,
}: TileStockFiltersProps) {
  const sizeOptions = [
    { label: isLoadingSizes ? 'Loading sizes...' : 'Select tile size...', value: '' },
    ...sizes.map((s) => ({
      label: s.replace(/[*xX]/g, ' × '),
      value: s,
    })),
  ];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        {/* Left Side: Size selector and toggle */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          {/* Tile Size Selector */}
          <div className="w-full sm:w-60">
            <Select
              id="tile-size-select"
              label="Tile Size"
              value={selectedSize}
              onChange={(e) => onSizeChange(e.target.value)}
              disabled={isLoadingSizes || isGenerating}
              options={sizeOptions}
              className="h-10 text-sm font-medium"
            />
          </div>

          {/* Stock Filter Checkbox / Toggle */}
          <div className="flex flex-col justify-end pb-1.5">
            <label className="flex items-center gap-2.5 cursor-pointer select-none">
              <input
                type="checkbox"
                id="available-only-toggle"
                checked={availableOnly}
                onChange={(e) => onAvailableOnlyChange(e.target.checked)}
                disabled={isGenerating}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
              />
              <span className="text-sm font-medium text-slate-700">
                Only show available stock
              </span>
            </label>
            <span className="text-xs text-slate-400 mt-0.5 ml-6.5">
              {availableOnly
                ? 'Excludes models with zero available boxes.'
                : 'Includes models with zero physical stock in warehouse.'}
            </span>
          </div>
        </div>

        {/* Right Side: Generate Report Action */}
        <div className="flex items-center">
          <Button
            type="button"
            variant="primary"
            size="md"
            onClick={onGenerate}
            disabled={!selectedSize || isGenerating || isLoadingSizes}
            className="w-full sm:w-auto h-10 px-5 shadow-sm font-medium"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Search className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
