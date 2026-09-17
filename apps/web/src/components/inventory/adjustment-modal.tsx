import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import { Product } from '@/lib/api/products';
import { inventoryApi } from '@/lib/api/inventory';
import { ApiError } from '@/lib/api';
import { AlertCircle, Sliders, AlertTriangle } from 'lucide-react';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
  availableProducts?: Product[];
}

export function AdjustmentModal({
  isOpen,
  onClose,
  onSuccess,
  product,
  availableProducts = [],
}: AdjustmentModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [adjustmentType, setAdjustmentType] = useState<'SURPLUS' | 'SHRINKAGE'>('SURPLUS');
  const [pieces, setPieces] = useState<string>('');
  const [reason, setReason] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{
    productId?: string;
    pieces?: string;
    reason?: string;
  }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(product?._id || (availableProducts[0]?._id ?? ''));
      setAdjustmentType('SURPLUS');
      setPieces('');
      setReason('');
      setFieldErrors({});
      setServerError(null);
    }
  }, [isOpen, product, availableProducts]);

  const validate = (): boolean => {
    const errors: { productId?: string; pieces?: string; reason?: string } = {};

    if (!selectedProductId) {
      errors.productId = 'Please select a product';
    }

    const count = parseInt(pieces, 10);
    if (isNaN(count) || count <= 0) {
      errors.pieces = 'Adjustment pieces must be an integer greater than 0';
    }

    if (!reason.trim()) {
      errors.reason = 'Reason is mandatory for inventory adjustments';
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError(null);

    if (!validate()) return;

    const count = parseInt(pieces, 10);
    const signedPieces = adjustmentType === 'SHRINKAGE' ? -count : count;

    try {
      setIsSubmitting(true);
      await inventoryApi.adjustment({
        productId: selectedProductId,
        physicalPieces: signedPieces,
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
          setServerError(err.message || 'Failed to adjust inventory. Please try again.');
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
      title="Manual Stock Adjustment"
      description="Correct inventory counts due to physical audit count reconciliations."
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
                label: `${p.productName} (${p.gallaNumber})`,
                value: p._id,
              })),
            ]}
          />
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Adjustment Type *"
            value={adjustmentType}
            onChange={(e) => {
              setAdjustmentType(e.target.value as 'SURPLUS' | 'SHRINKAGE');
            }}
            disabled={isSubmitting}
            options={[
              { label: '📈 Found Stock / Surplus (+)', value: 'SURPLUS' },
              { label: '📉 Missing / Shrinkage (-)', value: 'SHRINKAGE' },
            ]}
          />

          <Input
            label="Physical Pieces *"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 5"
            value={pieces}
            onChange={(e) => {
              setPieces(e.target.value);
              setFieldErrors((prev) => ({ ...prev, pieces: undefined }));
            }}
            error={fieldErrors.pieces}
            helperText={
              adjustmentType === 'SURPLUS'
                ? 'Adds positive pieces to physical stock'
                : 'Deducts pieces from physical stock'
            }
            disabled={isSubmitting}
            required
          />
        </div>

        {adjustmentType === 'SHRINKAGE' && (
          <div className="rounded-lg border border-amber-200 bg-amber-50/80 p-3 text-xs text-amber-900 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-700 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Stock Underflow Protection:</span> The backend will strictly reject any adjustment if the pieces to deduct exceed currently recorded physical stock.
            </div>
          </div>
        )}

        <div>
          <label
            htmlFor="adjustment-reason"
            className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5"
          >
            Audit Justification / Reason *
          </label>
          <textarea
            id="adjustment-reason"
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500/20 disabled:bg-slate-50"
            placeholder="e.g. Annual stock audit physical recount found extra 4 loose pieces in warehouse rack B"
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
            variant="primary"
            disabled={isSubmitting || !selectedProductId}
          >
            {isSubmitting ? 'Adjusting Stock...' : 'Save Adjustment'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
