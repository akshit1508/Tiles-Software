import React, { useState, useEffect } from 'react';
import { Modal, Button, Input, Select } from '@/components/ui';
import { Product } from '@/lib/api/products';
import { inventoryApi } from '@/lib/api/inventory';
import { ApiError } from '@/lib/api';
import { AlertCircle, ArrowDownToLine } from 'lucide-react';

interface StockInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null;
  availableProducts?: Product[];
}

export function StockInModal({
  isOpen,
  onClose,
  onSuccess,
  product,
  availableProducts = [],
}: StockInModalProps) {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [quantity, setQuantity] = useState<string>('');
  const [fieldErrors, setFieldErrors] = useState<{ productId?: string; quantity?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedProductId(product?._id || (availableProducts[0]?._id ?? ''));
      setQuantity('');
      setFieldErrors({});
      setServerError(null);
    }
  }, [isOpen, product, availableProducts]);

  const activeProduct =
    product || availableProducts.find((p) => p._id === selectedProductId);

  const parsedQuantity = parseInt(quantity, 10);
  const estimatedPieces =
    !isNaN(parsedQuantity) && parsedQuantity > 0 && activeProduct
      ? parsedQuantity * activeProduct.piecesPerBox
      : 0;

  const validate = (): boolean => {
    const errors: { productId?: string; quantity?: string } = {};

    if (!selectedProductId) {
      errors.productId = 'Please select a product';
    }

    const qty = parseInt(quantity, 10);
    if (isNaN(qty) || qty < 1) {
      errors.quantity = 'Quantity must be at least 1 box';
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
      await inventoryApi.stockIn({
        productId: selectedProductId,
        quantity: parseInt(quantity, 10),
        unit: 'BOX',
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
          setServerError(err.message || 'Failed to record stock-in. Please try again.');
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
      title="Record Stock-In"
      description="Add incoming supplier stock in complete boxes."
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

        <div>
          <Input
            label="Quantity (Boxes) *"
            type="number"
            min="1"
            step="1"
            placeholder="e.g. 25"
            value={quantity}
            onChange={(e) => {
              setQuantity(e.target.value);
              setFieldErrors((prev) => ({ ...prev, quantity: undefined }));
            }}
            error={fieldErrors.quantity}
            helperText="Stock arrives exclusively in complete boxes. Minimum 1 box."
            disabled={isSubmitting}
            required
          />
        </div>

        {estimatedPieces > 0 && activeProduct && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-xs text-emerald-900">
            <div className="font-semibold text-emerald-950 flex items-center gap-1.5">
              <ArrowDownToLine className="h-3.5 w-3.5 text-emerald-700" />
              Incoming Physical Stock Conversion
            </div>
            <p className="mt-1 text-emerald-800">
              {parsedQuantity} {parsedQuantity === 1 ? 'box' : 'boxes'} × {activeProduct.piecesPerBox} pcs/box ={' '}
              <span className="font-bold font-mono text-emerald-950">+{estimatedPieces} physical pieces</span> will be added to canonical inventory.
            </p>
          </div>
        )}

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
            {isSubmitting ? 'Recording Stock...' : 'Confirm Stock-In'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
