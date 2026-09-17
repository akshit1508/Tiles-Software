'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Boxes,
  PlusCircle,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import {
  Button,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
} from '@/components/ui';
import {
  InventoryItem,
  inventoryApi,
} from '@/lib/api/inventory';
import { Product, productsApi } from '@/lib/api/products';
import { ApiError } from '@/lib/api';
import {
  InventoryFilters,
  InventoryTable,
  StockInModal,
  DamageModal,
  AdjustmentModal,
  InventoryHistoryModal,
} from '@/components/inventory';

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active products list for top-level modal dropdowns
  const [availableProducts, setAvailableProducts] = useState<Product[]>([]);

  // Modals state
  const [isStockInModalOpen, setIsStockInModalOpen] = useState(false);
  const [isDamageModalOpen, setIsDamageModalOpen] = useState(false);
  const [isAdjustmentModalOpen, setIsAdjustmentModalOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const fetchInventory = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await inventoryApi.list({
        page,
        limit,
        lowStockOnly: lowStockOnly ? true : undefined,
        search: search.trim() || undefined,
      });

      setItems(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to load inventory data from the server. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, lowStockOnly, search]);

  useEffect(() => {
    fetchInventory();
  }, [fetchInventory]);

  // Load available active products for top-level action modals
  const fetchAvailableProducts = useCallback(async () => {
    try {
      const res = await productsApi.list({ limit: 100, isActive: true });
      setAvailableProducts(res.data);
    } catch {
      // Non-blocking: table actions will still work with row product
    }
  }, []);

  useEffect(() => {
    fetchAvailableProducts();
  }, [fetchAvailableProducts]);

  // Auto-dismiss success notification
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleFilterChange = (filters: { search: string; lowStockOnly: boolean }) => {
    setSearch(filters.search);
    setLowStockOnly(filters.lowStockOnly);
    setPage(1);
  };

  // Row-level action handlers
  const handleOpenStockIn = (item?: InventoryItem, product?: Product) => {
    setSelectedProduct(product || null);
    setIsStockInModalOpen(true);
  };

  const handleOpenDamage = (item?: InventoryItem, product?: Product) => {
    setSelectedProduct(product || null);
    setIsDamageModalOpen(true);
  };

  const handleOpenAdjustment = (item?: InventoryItem, product?: Product) => {
    setSelectedProduct(product || null);
    setIsAdjustmentModalOpen(true);
  };

  const handleOpenHistory = (item: InventoryItem, product: Product) => {
    setSelectedProduct(product);
    setIsHistoryModalOpen(true);
  };

  // Mutation success handlers
  const handleMutationSuccess = (actionName: string) => {
    setSuccessMessage(`${actionName} recorded successfully. Canonical stock updated.`);
    fetchInventory();
  };

  // Metrics summary
  const lowStockCount = items.filter((i) => i.isLowStock).length;
  const hasFiltersApplied = search.trim() !== '' || lowStockOnly;

  return (
    <div className="space-y-6">
      {/* Header & Main Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inventory Management
          </h1>
          <p className="text-sm text-slate-500">
            Monitor physical stock in canonical pieces, full boxes, and coverage. Record stock-ins, damages, and audit adjustments.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            type="button"
            variant="primary"
            onClick={() => handleOpenStockIn()}
          >
            <PlusCircle className="h-4 w-4 mr-1.5" />
            Stock In
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenDamage()}
            className="text-rose-700 border-rose-200 hover:bg-rose-50"
          >
            <AlertTriangle className="h-4 w-4 mr-1.5 text-rose-600" />
            Record Damage
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={() => handleOpenAdjustment()}
            className="text-amber-800 border-amber-200 hover:bg-amber-50"
          >
            <Sliders className="h-4 w-4 mr-1.5 text-amber-600" />
            Adjust Stock
          </Button>
        </div>
      </div>

      {/* Summary Metrics Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Catalog Products Stocked
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{total}</span>
            <span className="text-xs text-slate-500">active SKU lines</span>
          </div>
        </div>

        <div
          className={`rounded-xl border p-4 shadow-xs transition-colors ${
            lowStockCount > 0
              ? 'border-amber-300 bg-amber-50/50'
              : 'border-slate-200 bg-white'
          }`}
        >
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Low Stock Alerts (Current View)
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={`text-2xl font-bold ${
                lowStockCount > 0 ? 'text-amber-800' : 'text-slate-900'
              }`}
            >
              {lowStockCount}
            </span>
            <span className="text-xs text-slate-500">
              {lowStockCount > 0 ? 'items at or below minimum threshold' : 'all items adequately stocked'}
            </span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs sm:col-span-2 lg:col-span-1">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Canonical Accounting Rule
          </div>
          <p className="mt-1 text-xs text-slate-600">
            Stock is authoritatively held in <span className="font-semibold text-slate-900">physical pieces</span>. Boxes and coverage are server-derived.
          </p>
        </div>
      </div>

      {/* Success Notification Banner */}
      {successMessage && (
        <div
          className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 transition-all"
          role="status"
        >
          <CheckCircle2 className="h-4 w-4 flex-shrink-0 text-emerald-600" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Filter Bar */}
      <InventoryFilters
        search={search}
        lowStockOnly={lowStockOnly}
        onFilterChange={handleFilterChange}
        isLoading={isLoading}
      />

      {/* Content State */}
      {isLoading && items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-xs">
          <LoadingState message="Loading inventory balances..." />
        </div>
      ) : error && items.length === 0 ? (
        <ErrorState
          title="Failed to Load Inventory"
          message={error}
          onRetry={fetchInventory}
        />
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          {hasFiltersApplied ? (
            <EmptyState
              icon={<Boxes className="h-8 w-8 text-slate-400" />}
              title="No matching inventory found"
              description="No stock records matched your search or low-stock filter. Try clearing or broadening your criteria."
              actionLabel="Reset Filters"
              onAction={() => handleFilterChange({ search: '', lowStockOnly: false })}
            />
          ) : (
            <EmptyState
              icon={<Boxes className="h-8 w-8 text-emerald-600" />}
              title="Inventory Ledger is Empty"
              description="No inventory records found. Add tile products to the store catalog or receive initial stock."
              actionLabel="Receive Stock"
              onAction={() => handleOpenStockIn()}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <InventoryTable
            items={items}
            onStockIn={handleOpenStockIn}
            onDamage={handleOpenDamage}
            onAdjustment={handleOpenAdjustment}
            onViewHistory={handleOpenHistory}
          />

          <Pagination
            page={page}
            totalPages={totalPages}
            totalItems={total}
            pageSize={limit}
            onPageChange={(newPage) => setPage(newPage)}
          />
        </div>
      )}

      {/* Stock-In Modal */}
      <StockInModal
        isOpen={isStockInModalOpen}
        onClose={() => {
          setIsStockInModalOpen(false);
          setSelectedProduct(null);
        }}
        onSuccess={() => handleMutationSuccess('Stock-In')}
        product={selectedProduct}
        availableProducts={availableProducts}
      />

      {/* Damage Modal */}
      <DamageModal
        isOpen={isDamageModalOpen}
        onClose={() => {
          setIsDamageModalOpen(false);
          setSelectedProduct(null);
        }}
        onSuccess={() => handleMutationSuccess('Damaged stock')}
        product={selectedProduct}
        availableProducts={availableProducts}
      />

      {/* Adjustment Modal */}
      <AdjustmentModal
        isOpen={isAdjustmentModalOpen}
        onClose={() => {
          setIsAdjustmentModalOpen(false);
          setSelectedProduct(null);
        }}
        onSuccess={() => handleMutationSuccess('Stock adjustment')}
        product={selectedProduct}
        availableProducts={availableProducts}
      />

      {/* History Audit Modal */}
      <InventoryHistoryModal
        isOpen={isHistoryModalOpen}
        onClose={() => {
          setIsHistoryModalOpen(false);
          setSelectedProduct(null);
        }}
        product={selectedProduct}
      />
    </div>
  );
}
