'use client';

import React from 'react';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Users,
  ShoppingCart,
  CreditCard,
  AlertCircle,
  TrendingUp,
} from 'lucide-react';
import { Card, Badge, Button } from '@/components/ui';

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Dashboard
          </h1>
          <p className="text-sm text-slate-500">
            Overview of store operations, sales, and outstanding balances.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="success" size="md">
            System Active
          </Badge>
        </div>
      </div>

      {/* Metric Cards Placeholders */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Sales
            </span>
            <div className="rounded-lg bg-blue-50 p-2 text-blue-600">
              <TrendingUp className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">₹0.00</div>
            <p className="mt-1 text-xs text-slate-500">From completed orders</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Payments Collected
            </span>
            <div className="rounded-lg bg-emerald-50 p-2 text-emerald-600">
              <CreditCard className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-emerald-600">₹0.00</div>
            <p className="mt-1 text-xs text-slate-500">Total verified collections</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Outstanding
            </span>
            <div className="rounded-lg bg-amber-50 p-2 text-amber-600">
              <AlertCircle className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-amber-600">₹0.00</div>
            <p className="mt-1 text-xs text-slate-500">Pending customer balance</p>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Active Orders
            </span>
            <div className="rounded-lg bg-purple-50 p-2 text-purple-600">
              <ShoppingCart className="h-5 w-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-2xl font-bold text-slate-900">0</div>
            <p className="mt-1 text-xs text-slate-500">Completed shop orders</p>
          </div>
        </Card>
      </div>

      {/* Quick Navigation / Overview section */}
      <Card
        title="Store Operations"
        subtitle="Tile Management System modules ready for administration"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2">
              <Package className="h-5 w-5 text-blue-600" />
              <h4 className="font-semibold text-sm text-slate-800">Products</h4>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Manage tile brands, sizes, finishes, prices, and catalog.
            </p>
            <a href="/products" className="text-xs font-medium text-blue-600 hover:text-blue-800">
              View Products &rarr;
            </a>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2">
              <Boxes className="h-5 w-5 text-emerald-600" />
              <h4 className="font-semibold text-sm text-slate-800">Inventory</h4>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Stock In, Stock Out, Damaged Stock, and partial box tracking.
            </p>
            <a href="/inventory" className="text-xs font-medium text-emerald-600 hover:text-emerald-800">
              View Inventory &rarr;
            </a>
          </div>

          <div className="p-4 rounded-lg border border-slate-200 bg-slate-50/50 flex flex-col justify-between">
            <div className="flex items-center gap-3 mb-2">
              <Users className="h-5 w-5 text-amber-600" />
              <h4 className="font-semibold text-sm text-slate-800">Customers</h4>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Customer profiles, order records, and balance accounts.
            </p>
            <a href="/customers" className="text-xs font-medium text-amber-600 hover:text-amber-800">
              View Customers &rarr;
            </a>
          </div>
        </div>
      </Card>
    </div>
  );
}
