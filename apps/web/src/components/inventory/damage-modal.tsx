import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import { Product } from '@/lib/api/products';
import { inventoryApi } from '@/lib/api/inventory';
import { ApiError } from '@/lib/api';
import { AlertCircle, AlertTriangle } from 'lucide-react';

interface DamageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
  availableProducts?: Product[];
}

export function DamageModal({
  isOpen,
  onClose,
  onSuccess,
  product,
  availableProducts = [],
}: DamageModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [unit, setUnit] = useState<'BOX' | 'PIECE'>('PIECE');
  const [reason, setReason] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{
    productId?: string;
    quantity?: string;
    unit?: string;
    reason?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(product?._id || (availableProducts[0]?._id ?? ''));
      setQuantity('');
      setUnit('PIECE');
      setReason('');
      setFieldErrors({});
      setServerError(null);
    }
  }, [isOpen, product, availableProducts]);

  const activeProduct =
    product || availableProducts.find((p) => p._id === selectedProductId);

  const validate = (): boolean => {
    const errors: {
      productId?: string;
      quantity?: string;
      unit?: string;
      reason?: string;
    } = {};

    if (!selectedProductId) {
      errors.productId = 'Please select a product';
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      errors.quantity = 'Quantity must be an integer of at least 1';
    }

    if (unit !== 'BOX' && unit !== 'PIECE') {
      errors.unit = 'Unit must be BOX or PIECE';
    }

    if (!reason.trim()) {
      errors.reason = 'Reason is mandatory when recording damaged stock';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    try {
      setIsSubmitting(true);
      await inventoryApi.damage({
        productId: selectedProductId,
        quantity: parseInt(quantity, 10),
        unit,
        reason: reason.trim(),
      });

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.validationErrors) {
          setServerError(
            Array.isArray(err.validationErrors)
              ? err.validationErrors.join(', ')
              : err.message,
          );
        } else {
          setServerError(err.message || 'Failed to record damage. Please try again.');
        }
      } else if (err instanceof Error) {
        setServerError(err.message);
      } else {
        setServerError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Record Damaged Stock"
      description="Deduct broken, chipped, or water-damaged tiles from inventory."
      size="md"
    >
      {serverError && (
        <div
          className="mb-4 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600 mt-0.5" />
          <span className="font-medium">{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {product ? (
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 space-y-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Selected Tile Product
            </span>
            <div className="font-semibold text-slate-900">{product.productName}</div>
            <div className="text-xs text-slate-600">
              Galla: <span className="font-mono font-medium">{product.gallaNumber}</span> • Brand: {product.brand} • Packaging: {product.piecesPerBox} pcs/box
            </div>
          </div>
        ) : (
          <Select
            label="Tile Product *"
            value={selectedProductId}
            onChange={(e) => {
              setSelectedProductId(e.target.value);
              setFieldErrors((prev) => ({ ...prev, productId: undefined }));
            }}
            error={fieldErrors.productId}
            disabled={isSubmitting}
            options={[
              { label: 'Select a tile product...', value: '' },
              ...availableProducts.map((p) => ({
                label: `${p.productName} (${p.gallaNumber}) — ${p.piecesPerBox} pcs/box`,
                value: p._id,
              })),
            ]}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Damaged Quantity *"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 3"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setFieldErrors((prev) => ({ ...prev, quantity: undefined }));
            }}
            error={fieldErrors.quantity}
            disabled={isSubmitting}
            required
          />

          <Select
            label="Measurement Unit *"
            value={unit}
            onChange={(e) => {
              setUnit(e.target.value as 'BOX' | 'PIECE');
              setFieldErrors((prev) => ({ ...prev, unit: undefined }));
            }}
            error={fieldErrors.unit}
            disabled={isSubmitting}
            options={[
              { label: 'PIECE (Individual Pieces)', value: 'PIECE' },
              { label: 'BOX (Full Boxes)', value: 'BOX' },
            ]}
          />
        </div>

        <div>
          <label
            htmlFor="damage-reason"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Damage Reason *
          </label>
          <textarea
            id="damage-reason"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50"
            placeholder="e.g. Cracked during transport, warehouse water leakage, handling chipping"
            value={reason}
            onChange={(e) => {
              setReason(e.target.value);
              setFieldErrors((prev) => ({ ...prev, reason: undefined }));
            }}
            disabled={isSubmitting}
            required
          />
          {fieldErrors.reason && (
            <p className="mt-1 text-xs text-red-600">{fieldErrors.reason}</p>
          )}
        </div>

        <div className="rounded-lg border border-amber-200 bg-amber-50/60 p-3 text-xs text-amber-900 flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold">Irreversible Inventory Audit Action:</span> Recording damage permanently reduces canonical physical stock and creates an immutable audit log entry.
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={isSubmitting || !selectedProductId}
          >
            {isSubmitting ? 'Recording Damage...' : 'Confirm Damage'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
