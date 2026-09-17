'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Package, CheckCircle2 } from 'lucide-react';
import { Button, LoadingState, ErrorState, EmptyState, Pagination } from '@/components/ui';
import { Product, productsApi } from '@/lib/api/products';
import { ApiError } from '@/lib/api';
import {
  ProductFilters,
  ProductTable,
  ProductFormModal,
  ProductDeactivateDialog,
} from '@/components/products';

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [brand, setBrand] = useState('');
  const [category, setCategory] = useState('');
  const [isActive, setIsActive] = useState(true);

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [selectedProductForEdit, setSelectedProductForEdit] = useState<Product | null>(null);
  const [selectedProductForStatus, setSelectedProductForStatus] = useState<Product | null>(null);

  const fetchProducts = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const response = await productsApi.list({
        page,
        limit,
        brand: brand || undefined,
        category: category || undefined,
        isActive,
      });

      setProducts(response.data);
      setTotal(response.total);
      setTotalPages(response.totalPages);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to fetch products from the server. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, brand, category, isActive]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Temporary success banner auto-dismiss
  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleFilterChange = (filters: {
    brand: string;
    category: string;
    isActive: boolean;
  }) => {
    setBrand(filters.brand);
    setCategory(filters.category);
    setIsActive(filters.isActive);
    setPage(1); // Reset to page 1 on filter change
  };

  const handleOpenCreate = () => {
    setSelectedProductForEdit(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setSelectedProductForEdit(product);
    setIsFormModalOpen(true);
  };

  const handleFormSuccess = () => {
    const isEdit = !!selectedProductForEdit;
    setSuccessMessage(
      isEdit ? 'Product updated successfully.' : 'New product created successfully.',
    );
    fetchProducts();
  };

  const handleStatusToggleSuccess = () => {
    const wasActive = selectedProductForStatus?.isActive;
    setSuccessMessage(
      wasActive
        ? 'Product deactivated successfully.'
        : 'Product reactivated successfully.',
    );
    fetchProducts();
  };

  const hasFiltersApplied = brand !== '' || category !== '' || !isActive;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Products
          </h1>
          <p className="text-sm text-slate-500">
            Manage tile catalog, sizes, finishes, pricing, and galla locations.
          </p>
        </div>

        <Button
          type="button"
          variant="primary"
          onClick={handleOpenCreate}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Add Product
        </Button>
      </div>

      {/* Success Banner */}
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
      <ProductFilters
        brand={brand}
        category={category}
        isActive={isActive}
        onFilterChange={handleFilterChange}
        isLoading={isLoading}
      />

      {/* Main Content Area */}
      {isLoading && products.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-xs">
          <LoadingState message="Loading tile products..." />
        </div>
      ) : error && products.length === 0 ? (
        <ErrorState
          title="Failed to Load Products"
          message={error}
          onRetry={fetchProducts}
        />
      ) : products.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
          {hasFiltersApplied ? (
            <EmptyState
              icon={<Package className="h-8 w-8 text-slate-400" />}
              title="No matching tile products found"
              description="No products match the selected filters. Try clearing or broadening your search criteria."
              actionLabel="Reset Filters"
              onAction={() => handleFilterChange({ brand: '', category: '', isActive: true })}
            />
          ) : (
            <EmptyState
              icon={<Package className="h-8 w-8 text-blue-600" />}
              title="Product Catalog is Empty"
              description="No tile products have been registered yet. Add your first product to start tracking inventory and creating orders."
              actionLabel="Add Tile Product"
              onAction={handleOpenCreate}
            />
          )}
        </div>
      ) : (
        <div className="space-y-4">
          <ProductTable
            products={products}
            onEdit={handleOpenEdit}
            onToggleStatus={(prod) => setSelectedProductForStatus(prod)}
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

      {/* Create / Edit Modal */}
      <ProductFormModal
        isOpen={isFormModalOpen}
        onClose={() => {
          setIsFormModalOpen(false);
          setSelectedProductForEdit(null);
        }}
        onSuccess={handleFormSuccess}
        product={selectedProductForEdit}
      />

      {/* Deactivate / Reactivate Confirmation Dialog */}
      <ProductDeactivateDialog
        isOpen={!!selectedProductForStatus}
        onClose={() => setSelectedProductForStatus(null)}
        onSuccess={handleStatusToggleSuccess}
        product={selectedProductForStatus}
      />
    </div>
  );
}
