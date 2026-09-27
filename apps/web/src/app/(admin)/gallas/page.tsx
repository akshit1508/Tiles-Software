'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Warehouse,
  PlusCircle,
  Search,
  AlertCircle,
  CheckCircle2,
  Package,
  Boxes,
  Eye,
  Edit2,
  Power,
  X,
  Layers,
} from 'lucide-react';
import {
  Button,
  Input,
  Select,
  Badge,
  Modal,
  LoadingState,
  ErrorState,
  EmptyState,
  Pagination,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import {
  Galla,
  GallaInventoryResponse,
  gallasApi,
  CreateGallaInput,
  UpdateGallaInput,
} from '@/lib/api/gallas';
import { ApiError } from '@/lib/api';
import { formatCurrencyINR } from '@/lib/api/products';

export default function GallasPage() {
  const [gallas, setGallas] = useState<Galla[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');

  // UI state
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Add / Edit Modal state
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [editingGalla, setEditingGalla] = useState<Galla | null>(null);
  const [formGallaNumber, setFormGallaNumber] = useState('');
  const [formName, setFormName] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Detail View Drawer / Modal state
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedGallaInventory, setSelectedGallaInventory] = useState<GallaInventoryResponse | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  // Status toggle confirmation
  const [isDeactivating, setIsDeactivating] = useState(false);

  const fetchGallas = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);

      const isActiveParam =
        statusFilter === 'ACTIVE' ? true : statusFilter === 'INACTIVE' ? false : undefined;

      const res = await gallasApi.list({
        page,
        limit,
        search: search.trim() || undefined,
        isActive: isActiveParam,
      });

      setGallas(res.data);
      setTotal(res.total);
      setTotalPages(res.totalPages);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Unable to load Galla locations. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  }, [page, limit, search, statusFilter]);

  useEffect(() => {
    fetchGallas();
  }, [fetchGallas]);

  useEffect(() => {
    if (successMessage) {
      const timer = setTimeout(() => setSuccessMessage(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  const handleOpenCreate = () => {
    setEditingGalla(null);
    setFormGallaNumber('');
    setFormName('');
    setFormDescription('');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleOpenEdit = (galla: Galla) => {
    setEditingGalla(galla);
    setFormGallaNumber(galla.gallaNumber);
    setFormName(galla.name || '');
    setFormDescription(galla.description || '');
    setFormError(null);
    setIsFormModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formGallaNumber.trim()) {
      setFormError('Galla Number is required (e.g. GALLA 01, G-01)');
      return;
    }

    try {
      setIsSubmitting(true);
      if (editingGalla) {
        const updateData: UpdateGallaInput = {
          name: formName.trim() || undefined,
          description: formDescription.trim() || undefined,
        };
        await gallasApi.update(editingGalla._id, updateData);
        setSuccessMessage(`Location "${editingGalla.gallaNumber}" updated successfully.`);
      } else {
        const createData: CreateGallaInput = {
          gallaNumber: formGallaNumber.trim().toUpperCase(),
          name: formName.trim() || undefined,
          description: formDescription.trim() || undefined,
        };
        await gallasApi.create(createData);
        setSuccessMessage(`New location "${createData.gallaNumber}" created successfully.`);
      }
      setIsFormModalOpen(false);
      fetchGallas();
    } catch (err) {
      if (err instanceof ApiError) {
        setFormError(err.message);
      } else if (err instanceof Error) {
        setFormError(err.message);
      } else {
        setFormError('Failed to save Galla location.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (galla: Galla) => {
    const newStatus = !galla.isActive;
    const actionLabel = newStatus ? 'activate' : 'deactivate';

    if (!window.confirm(`Are you sure you want to ${actionLabel} ${galla.gallaNumber}?`)) {
      return;
    }

    try {
      setIsDeactivating(true);
      await gallasApi.update(galla._id, { isActive: newStatus });
      setSuccessMessage(
        `Location "${galla.gallaNumber}" ${newStatus ? 'activated' : 'deactivated'} successfully.`,
      );
      fetchGallas();
    } catch (err) {
      alert(err instanceof Error ? err.message : `Failed to ${actionLabel} Galla.`);
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleViewDetail = async (galla: Galla) => {
    try {
      setIsLoadingDetail(true);
      setIsDetailModalOpen(true);
      setSelectedGallaInventory(null);
      const data = await gallasApi.getInventory(galla._id);
      setSelectedGallaInventory(data);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to load Galla inventory breakdown.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // Aggregated summary stats
  const totalGallasCount = total;
  const activeGallasCount = gallas.filter((g) => g.isActive).length;
  const totalStockBoxes = gallas.reduce((acc, g) => acc + (g.totalBoxes || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2.5">
            <Warehouse className="h-6 w-6 text-blue-600" />
            Godown Storage Locations (Gallas)
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Manage warehouse bays, racks, and physical sections. Multiple products can be stored within each Galla.
          </p>
        </div>

        <Button type="button" variant="primary" onClick={handleOpenCreate}>
          <PlusCircle className="h-4 w-4 mr-1.5" />
          Add Galla Location
        </Button>
      </div>

      {/* Metrics Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Total Locations
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-slate-900">{totalGallasCount}</span>
            <span className="text-xs text-slate-500">physical godown sections</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active Locations
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-emerald-700">{activeGallasCount}</span>
            <span className="text-xs text-slate-500">accepting new incoming stock</span>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Current View Stock
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-2xl font-bold text-blue-700">{totalStockBoxes}</span>
            <span className="text-xs text-slate-500">boxes physically stored</span>
          </div>
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
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="flex flex-col md:flex-row gap-3 items-end">
          <div className="flex-1 w-full">
            <Input
              label="Search Gallas"
              placeholder="Search by Galla number, name, or description..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              disabled={isLoading}
            />
          </div>

          <div className="w-full md:w-56">
            <Select
              label="Status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE');
                setPage(1);
              }}
              disabled={isLoading}
              options={[
                { label: 'All Statuses', value: 'ALL' },
                { label: 'Active Only', value: 'ACTIVE' },
                { label: 'Inactive Only', value: 'INACTIVE' },
              ]}
            />
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={() => fetchGallas()}
            disabled={isLoading}
          >
            <Search className="h-4 w-4 mr-1.5 text-slate-500" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Table Content */}
      {isLoading && gallas.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 shadow-xs">
          <LoadingState message="Loading Galla locations..." />
        </div>
      ) : error && gallas.length === 0 ? (
        <ErrorState
          title="Failed to Load Gallas"
          message={error}
          onRetry={fetchGallas}
        />
      ) : gallas.length === 0 ? (
        <EmptyState
          title="No Galla Locations Found"
          description="Create your first warehouse Galla location to start categorizing physical stock."
          actionLabel="Add Galla Location"
          onAction={handleOpenCreate}
        />
      ) : (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Galla Number</TableHead>
                  <TableHead>Location Name / Description</TableHead>
                  <TableHead className="text-center">Stored Products</TableHead>
                  <TableHead className="text-center">Total Box Stock</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gallas.map((galla) => (
                  <TableRow key={galla._id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="inline-flex items-center rounded-md bg-blue-50 px-2.5 py-1 text-xs font-mono font-bold text-blue-800 border border-blue-200">
                          {galla.gallaNumber}
                        </span>
                      </div>
                    </TableCell>

                    <TableCell>
                      <div className="font-semibold text-slate-900">
                        {galla.name || <span className="text-slate-400 font-normal">No label set</span>}
                      </div>
                      {galla.description && (
                        <div className="text-xs text-slate-500 mt-0.5">{galla.description}</div>
                      )}
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-800">
                        <Package className="h-3 w-3 text-slate-500" />
                        {galla.productCount ?? 0} {((galla.productCount ?? 0) === 1 ? 'model' : 'models')}
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-800 border border-emerald-200">
                        <Boxes className="h-3.5 w-3.5 text-emerald-600" />
                        {galla.totalBoxes ?? 0} {((galla.totalBoxes ?? 0) === 1 ? 'box' : 'boxes')}
                      </span>
                    </TableCell>

                    <TableCell className="text-center">
                      <Badge variant={galla.isActive ? 'success' : 'neutral'} size="sm">
                        {galla.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleViewDetail(galla)}
                          className="h-8 px-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 text-xs"
                          title="View location inventory breakdown"
                        >
                          <Eye className="h-3.5 w-3.5 mr-1" />
                          View Stock
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEdit(galla)}
                          className="h-8 w-8 p-0 text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          title="Edit location details"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleToggleStatus(galla)}
                          disabled={isDeactivating}
                          className={`h-8 w-8 p-0 ${
                            galla.isActive
                              ? 'text-amber-600 hover:text-amber-800 hover:bg-amber-50'
                              : 'text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50'
                          }`}
                          title={galla.isActive ? 'Deactivate Galla' : 'Activate Galla'}
                        >
                          <Power className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {totalPages > 1 && (
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={(newPage) => setPage(newPage)}
            />
          )}
        </div>
      )}

      {/* Add / Edit Galla Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title={editingGalla ? `Edit Location: ${editingGalla.gallaNumber}` : 'Create New Godown Location'}
        description="A Galla represents a physical bay, rack, or section in your godown."
        size="md"
      >
        {formError && (
          <div
            className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800"
            role="alert"
          >
            <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600 mt-0.5" />
            <span className="font-medium">{formError}</span>
          </div>
        )}

        <form onSubmit={handleFormSubmit} className="space-y-4">
          <Input
            label="Galla Number / Code *"
            placeholder="e.g. GALLA 01, G-02, BAY-A"
            value={formGallaNumber}
            onChange={(e) => setFormGallaNumber(e.target.value)}
            disabled={!!editingGalla || isSubmitting}
            helperText={
              editingGalla
                ? 'Galla code cannot be changed once created.'
                : 'Must be unique in your shop. Stored in uppercase.'
            }
            required
          />

          <Input
            label="Location Name / Label (Optional)"
            placeholder="e.g. Main Godown North Section, Front Display Rack"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            disabled={isSubmitting}
            helperText="Descriptive label for shop workers and managers."
          />

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Notes / Description (Optional)
            </label>
            <textarea
              rows={3}
              placeholder="e.g. Floor tile heavy pallets, ground level section B..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              disabled={isSubmitting}
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsFormModalOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : editingGalla ? 'Save Changes' : 'Create Location'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Location Stock Breakdown Drawer / Modal */}
      <Modal
        isOpen={isDetailModalOpen}
        onClose={() => setIsDetailModalOpen(false)}
        title={
          selectedGallaInventory
            ? `Inventory in ${selectedGallaInventory.galla.gallaNumber}`
            : 'Loading Location Inventory...'
        }
        description="Detailed breakdown of all tile products physically stored in this godown section."
        size="lg"
      >
        {isLoadingDetail || !selectedGallaInventory ? (
          <div className="p-8">
            <LoadingState message="Fetching live location stock..." />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Location Banner */}
            <div className="rounded-xl border border-blue-200 bg-blue-50/50 p-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div>
                  <div className="text-base font-bold text-slate-900">
                    {selectedGallaInventory.galla.gallaNumber}
                    {selectedGallaInventory.galla.name && ` — ${selectedGallaInventory.galla.name}`}
                  </div>
                  {selectedGallaInventory.galla.description && (
                    <div className="text-xs text-slate-600 mt-0.5">
                      {selectedGallaInventory.galla.description}
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Total Models</span>
                    <span className="text-base font-bold text-slate-900">
                      {selectedGallaInventory.totalProducts}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 block">Total Boxes</span>
                    <span className="text-base font-bold font-mono text-emerald-800">
                      {selectedGallaInventory.totalBoxes}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Products List */}
            {selectedGallaInventory.items.length === 0 ? (
              <div className="py-8 text-center text-sm text-slate-500">
                No tile products currently have stock stored in this Galla.
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tile Product</TableHead>
                      <TableHead>Category / Size</TableHead>
                      <TableHead className="text-center">Boxes in Location</TableHead>
                      <TableHead className="text-center">Pieces in Location</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGallaInventory.items.map((item) => (
                      <TableRow key={item.product._id}>
                        <TableCell>
                          <div className="font-semibold text-slate-900">
                            {item.product.productName}
                          </div>
                          <div className="text-xs text-slate-500">{item.product.brand}</div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs text-slate-800">{item.product.category}</div>
                          <div className="text-[11px] text-slate-500">
                            {item.product.size} • {item.product.finish}
                          </div>
                        </TableCell>
                        <TableCell className="text-center font-mono font-bold text-slate-900">
                          {item.boxes} {item.boxes === 1 ? 'box' : 'boxes'}
                        </TableCell>
                        <TableCell className="text-center font-mono text-xs text-slate-600">
                          {item.totalPieces} pcs ({item.product.piecesPerBox} pcs/box)
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            <div className="flex justify-end pt-2">
              <Button type="button" variant="outline" onClick={() => setIsDetailModalOpen(false)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
