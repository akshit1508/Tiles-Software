import React from 'react';
import { Card } from '@/components/ui';
import { DashboardSummary } from '@/lib/api/dashboard';
import { formatCurrencyINR } from '@/lib/api/products';
import {
  TrendingUp,
  CreditCard,
  AlertTriangle,
  ShoppingCart,
  Users,
  Package,
  ArrowUpRight,
} from 'lucide-react';
import Link from 'next/link';

interface DashboardKpiGridProps {
  summary: DashboardSummary;
}

export function DashboardKpiGrid({ summary }: DashboardKpiGridProps) {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
      {/* 1. Total Sales */}
      <Card className="p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Sales
          </span>
          <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
            <TrendingUp className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="font-mono text-xl font-bold text-slate-900 truncate">
            {formatCurrencyINR(summary.totalSales)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{summary.completedOrders} completed</span>
            {summary.cancelledOrders > 0 && (
              <span className="text-slate-400">({summary.cancelledOrders} cancelled)</span>
            )}
          </div>
        </div>
      </Card>

      {/* 2. Payments Collected */}
      <Card className="p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Collected
          </span>
          <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
            <CreditCard className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="font-mono text-xl font-bold text-emerald-700 truncate">
            {formatCurrencyINR(summary.totalCollected)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>Verified collections</span>
            <Link
              href="/payments"
              className="text-emerald-600 hover:text-emerald-800 font-medium inline-flex items-center"
            >
              Ledger <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </Card>

      {/* 3. Total Outstanding */}
      <Card
        className={`p-4 shadow-sm relative overflow-hidden ${
          summary.totalOutstanding > 0 ? 'border-amber-200 bg-amber-50/20' : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-800">
            Outstanding
          </span>
          <div className="rounded-lg bg-amber-100/70 p-2 text-amber-700">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div
            className={`font-mono text-xl font-bold truncate ${
              summary.totalOutstanding > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {formatCurrencyINR(summary.totalOutstanding)}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>Pending dues</span>
            <Link
              href="/outstanding"
              className="text-amber-700 hover:text-amber-900 font-medium inline-flex items-center"
            >
              View <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </Card>

      {/* 4. Total Orders */}
      <Card className="p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Orders
          </span>
          <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
            <ShoppingCart className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="font-mono text-xl font-bold text-slate-900">
            {summary.totalOrders}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>Shop transactions</span>
            <Link
              href="/orders"
              className="text-purple-600 hover:text-purple-800 font-medium inline-flex items-center"
            >
              Orders <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </Card>

      {/* 5. Total Customers */}
      <Card className="p-4 shadow-sm relative overflow-hidden">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Customers
          </span>
          <div className="rounded-lg bg-slate-100 p-2 text-slate-600">
            <Users className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="font-mono text-xl font-bold text-slate-900">
            {summary.totalCustomers}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{summary.activeCustomers} active</span>
            <Link
              href="/customers"
              className="text-blue-600 hover:text-blue-800 font-medium inline-flex items-center"
            >
              Directory <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </Card>

      {/* 6. Products & Low Stock Alert */}
      <Card
        className={`p-4 shadow-sm relative overflow-hidden ${
          summary.lowStock.totalLowStockProducts > 0
            ? 'border-rose-200 bg-rose-50/20'
            : ''
        }`}
      >
        <div className="flex items-center justify-between">
          <span
            className={`text-xs font-semibold uppercase tracking-wider ${
              summary.lowStock.totalLowStockProducts > 0
                ? 'text-rose-700'
                : 'text-slate-500'
            }`}
          >
            Products
          </span>
          <div
            className={`rounded-lg p-2 ${
              summary.lowStock.totalLowStockProducts > 0
                ? 'bg-rose-100 text-rose-600'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Package className="h-4 w-4" />
          </div>
        </div>
        <div className="mt-2">
          <div className="font-mono text-xl font-bold text-slate-900">
            {summary.totalProducts}
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            {summary.lowStock.totalLowStockProducts > 0 ? (
              <span className="text-rose-600 font-semibold">
                {summary.lowStock.totalLowStockProducts} low stock
              </span>
            ) : (
              <span className="text-emerald-600 font-medium">Stock healthy</span>
            )}
            <Link
              href="/inventory"
              className="text-slate-600 hover:text-slate-900 font-medium inline-flex items-center"
            >
              Stock <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      </Card>
    </div>
  );
}
