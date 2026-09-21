import React, { useState, useEffect } from 'react';
import { Calendar, X, Filter } from 'lucide-react';
import { Button, Input } from '@/components/ui';

interface DashboardDateFilterProps {
  startDate?: string;
  endDate?: string;
  onFilterChange: (dates: { startDate?: string; endDate?: string }) => void;
  isLoading?: boolean;
}

/**
 * Formats a Date instance as YYYY-MM-DD using local calendar components.
 * Prevents UTC timezone shifts from .toISOString().
 */
export function formatCalendarDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Returns YYYY-MM-01 for the start of the month using local calendar components.
 */
export function formatMonthStartDate(d: Date = new Date()): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}-01`;
}

export function DashboardDateFilter({
  startDate,
  endDate,
  onFilterChange,
  isLoading = false,
}: DashboardDateFilterProps) {
  const [localStartDate, setLocalStartDate] = useState(startDate ? startDate.slice(0, 10) : '');
  const [localEndDate, setLocalEndDate] = useState(endDate ? endDate.slice(0, 10) : '');
  const [activePreset, setActivePreset] = useState<'all' | 'today' | 'month' | 'custom'>('all');

  useEffect(() => {
    setLocalStartDate(startDate ? startDate.slice(0, 10) : '');
  }, [startDate]);

  useEffect(() => {
    setLocalEndDate(endDate ? endDate.slice(0, 10) : '');
  }, [endDate]);

  const handleApplyCustom = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setActivePreset('custom');
    onFilterChange({
      startDate: localStartDate.trim() ? localStartDate.trim() : undefined,
      endDate: localEndDate.trim() ? localEndDate.trim() : undefined,
    });
  };

  const handlePreset = (preset: 'all' | 'today' | 'month') => {
    setActivePreset(preset);
    const now = new Date();

    if (preset === 'all') {
      setLocalStartDate('');
      setLocalEndDate('');
      onFilterChange({ startDate: undefined, endDate: undefined });
    } else if (preset === 'today') {
      const todayStr = formatCalendarDate(now);
      setLocalStartDate(todayStr);
      setLocalEndDate(todayStr);
      onFilterChange({
        startDate: todayStr,
        endDate: todayStr,
      });
    } else if (preset === 'month') {
      const monthStartStr = formatMonthStartDate(now);
      const todayStr = formatCalendarDate(now);
      setLocalStartDate(monthStartStr);
      setLocalEndDate(todayStr);
      onFilterChange({
        startDate: monthStartStr,
        endDate: todayStr,
      });
    }
  };

  const isFiltered = activePreset !== 'all' || localStartDate !== '' || localEndDate !== '';

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1 flex items-center gap-1">
            <Filter className="h-3.5 w-3.5 text-slate-400" />
            Period:
          </span>
          <Button
            type="button"
            size="sm"
            variant={activePreset === 'all' ? 'primary' : 'outline'}
            onClick={() => handlePreset('all')}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            All Time
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activePreset === 'today' ? 'primary' : 'outline'}
            onClick={() => handlePreset('today')}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            Today
          </Button>
          <Button
            type="button"
            size="sm"
            variant={activePreset === 'month' ? 'primary' : 'outline'}
            onClick={() => handlePreset('month')}
            disabled={isLoading}
            className="h-7 text-xs"
          >
            This Month
          </Button>
        </div>

        <form onSubmit={handleApplyCustom} className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <Input
              type="date"
              value={localStartDate}
              onChange={(e) => {
                setLocalStartDate(e.target.value);
                setActivePreset('custom');
              }}
              disabled={isLoading}
              className="h-8 text-xs py-1"
            />
            <span className="text-xs text-slate-400">to</span>
            <Input
              type="date"
              value={localEndDate}
              onChange={(e) => {
                setLocalEndDate(e.target.value);
                setActivePreset('custom');
              }}
              disabled={isLoading}
              className="h-8 text-xs py-1"
            />
          </div>
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={isLoading || (!localStartDate && !localEndDate)}
            className="h-8 text-xs"
          >
            <Calendar className="h-3 w-3 mr-1 text-slate-500" />
            Filter
          </Button>
          {isFiltered && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => handlePreset('all')}
              disabled={isLoading}
              className="h-8 text-xs text-slate-500 hover:text-slate-800"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </form>
      </div>

      {isFiltered && (
        <div className="text-[11px] text-slate-500 flex items-center justify-between border-t border-slate-100 pt-2">
          <span>
            Sales filtered by Order date; Collections filtered by Payment date.
          </span>
          <span className="font-medium text-blue-600">Active date filter applied</span>
        </div>
      )}
    </div>
  );
}
