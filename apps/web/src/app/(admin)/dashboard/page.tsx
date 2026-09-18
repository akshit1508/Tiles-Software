'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, LayoutDashboard } from 'lucide-react';
import { Button, LoadingState, ErrorState, Badge } from '@/components/ui';
import {
  DashboardSummary,
  dashboardApi,
} from '@/lib/api/dashboard';
import { ApiError } from '@/lib/api';
import {
  DashboardKpiGrid,
  DashboardDateFilter,
  DashboardLowStockTable,
  DashboardQuickActions,
} from '@/components/dashboard';

export default function DashboardPage() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  const [endDate, setEndDate] = useState<string | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const res = await dashboardApi.getSummary({
        startDate,
        endDate,
      });
      setSummary(res);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to fetch dashboard metrics. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  const handleDateFilterChange = (dates: { startDate?: string; endDate?: string }) => {
    setStartDate(dates.startDate);
    setEndDate(dates.endDate);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
            <LayoutDashboard className="h-6 w-6 text-slate-700" />
            <span>Store Dashboard</span>
          </h1>
          <p className="text-sm text-slate-500">
            Real-time business performance, inventory health, and financial ledger summaries.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={fetchSummary}
            disabled={isLoading}
            className="h-9 shadow-2xs"
          >
            <RefreshCw className={`h-4 w-4 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh Data
          </Button>
        </div>
      </div>

      {/* Date Filter Bar */}
      <DashboardDateFilter
        startDate={startDate}
        endDate={endDate}
        onFilterChange={handleDateFilterChange}
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      {isLoading && !summary ? (
        <LoadingState message="Loading store analytics and KPI metrics..." fullPage />
      ) : error && !summary ? (
        <ErrorState
          title="Dashboard Unavailable"
          message={error}
          onRetry={fetchSummary}
        />
      ) : summary ? (
        <div className="space-y-6">
          {/* KPI Metrics Grid */}
          <DashboardKpiGrid summary={summary} />

          {/* Low Stock Alerts Section */}
          <DashboardLowStockTable
            items={summary.lowStock.items}
            totalLowStock={summary.lowStock.totalLowStockProducts}
          />

          {/* Operational Quick Actions */}
          <DashboardQuickActions />
        </div>
      ) : null}
    </div>
  );
}
