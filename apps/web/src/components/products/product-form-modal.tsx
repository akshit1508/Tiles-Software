'use client';

import React, { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Modal, Button, Input } from '@/components/ui';
import {
  Product,
  CreateProductInput,
  UpdateProductInput,
  productsApi,
  parseDecimalValue,
} from '@/lib/api/products';
import { ApiError } from '@/lib/api';

interface ProductFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product?: Product | null; // If provided, edit mode; otherwise create mode
}

interface FormState {
  brand: string;
  productName: string;
  gallaNumber: string;
  category: string;
  size: string;
  finish: string;
  color: string;
  piecesPerBox: string;
  areaPerBox: string;
  purchasePrice: string;
  sellingPrice: string;
  minimumStockPieces: string;
}

const initialFormState: FormState = {
  brand: '',
  productName: '',
  gallaNumber: '',
  category: '',
  size: '',
  finish: '',
  color: '',
  piecesPerBox: '4',
  areaPerBox: '14.4',
  purchasePrice: '0',
  sellingPrice: '0',
  minimumStockPieces: '0',
};

export function ProductFormModal({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductFormModalProps) {
  const isEdit = !!product;

  const [form, setForm] = useState<FormState>(initialFormState);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (product) {
      setForm({
        brand: product.brand,
        productName: product.productName,
        gallaNumber: product.gallaNumber,
        category: product.category,
        size: product.size,
        finish: product.finish,
        color: product.color,
        piecesPerBox: String(product.piecesPerBox),
        areaPerBox: String(parseDecimalValue(product.areaPerBox)),
        purchasePrice: String(parseDecimalValue(product.purchasePrice)),
        sellingPrice: String(parseDecimalValue(product.sellingPrice)),
        minimumStockPieces: String(product.minimumStockPieces ?? 0),
      });
    } else {
      setForm(initialFormState);
    }
    setFieldErrors({});
    setServerError(null);
  }, [product, isOpen]);

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const validate = (): boolean => {
    const errors: Partial<Record<keyof FormState, string>> = {};

    if (!form.brand.trim()) errors.brand = 'Brand is required';
    if (!form.productName.trim()) errors.productName = 'Product name is required';
    if (!form.gallaNumber.trim()) errors.gallaNumber = 'Galla number is required';
    if (!form.category.trim()) errors.category = 'Category is required';
    if (!form.size.trim()) errors.size = 'Size is required';
    if (!form.finish.trim()) errors.finish = 'Finish is required';
    if (!form.color.trim()) errors.color = 'Color is required';

    const pieces = parseInt(form.piecesPerBox, 10);
    if (isNaN(pieces) || pieces < 1) {
      errors.piecesPerBox = 'Pieces per box must be an integer >= 1';
    }

    const area = parseFloat(form.areaPerBox);
    if (isNaN(area) || area <= 0) {
      errors.areaPerBox = 'Area per box must be greater than 0';
    }

    const purchase = parseFloat(form.purchasePrice);
    if (isNaN(purchase) || purchase < 0) {
      errors.purchasePrice = 'Purchase price must be >= 0';
    }

    const selling = parseFloat(form.sellingPrice);
    if (isNaN(selling) || selling < 0) {
      errors.sellingPrice = 'Selling price must be >= 0';
    }

    const minStock = parseInt(form.minimumStockPieces, 10);
    if (isNaN(minStock) || minStock < 0) {
      errors.minimumStockPieces = 'Minimum stock must be >= 0';
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

      const payload: CreateProductInput = {
        brand: form.brand.trim(),
        productName: form.productName.trim(),
        gallaNumber: form.gallaNumber.trim().toUpperCase(),
        category: form.category.trim(),
        size: form.size.trim(),
        finish: form.finish.trim(),
        color: form.color.trim(),
        piecesPerBox: parseInt(form.piecesPerBox, 10),
        areaPerBox: parseFloat(form.areaPerBox),
        purchasePrice: parseFloat(form.purchasePrice),
        sellingPrice: parseFloat(form.sellingPrice),
        minimumStockPieces: parseInt(form.minimumStockPieces, 10) || 0,
      };

      if (isEdit && product) {
        const updatePayload: UpdateProductInput = { ...payload };
        await productsApi.update(product._id, updatePayload);
      } else {
        await productsApi.create(payload);
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.statusCode === 409) {
          setServerError(`A product with Galla Number "${form.gallaNumber.trim().toUpperCase()}" already exists. Each model must have a unique Galla Number.`);
        } else if (err.validationErrors) {
          setServerError(
            Array.isArray(err.validationErrors)
              ? err.validationErrors.join(', ')
              : err.message,
          );
        } else {
          setServerError(err.message || 'Failed to save product. Please try again.');
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
      title={isEdit ? 'Edit Tile Product' : 'Add New Tile Product'}
      description={
        isEdit
          ? `Update specifications and pricing for ${product?.productName}`
          : 'Define a new tile product master record in the store catalog'
      }
      size="lg"
    >
      {serverError && (
        <div
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800"
          role="alert"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0 text-rose-600 mt-0.5" />
          <span className="font-medium">{serverError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Product Name *"
            placeholder="e.g. Statuario Classic Glazed"
            value={form.productName}
            onChange={(e) => handleChange('productName', e.target.value)}
            error={fieldErrors.productName}
            disabled={isSubmitting}
            required
          />

          <Input
            label="Brand *"
            placeholder="e.g. Kajaria, Somany, Johnson"
            value={form.brand}
            onChange={(e) => handleChange('brand', e.target.value)}
            error={fieldErrors.brand}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Galla Number (SKU) *"
            placeholder="e.g. GT-A101"
            value={form.gallaNumber}
            onChange={(e) => handleChange('gallaNumber', e.target.value)}
            error={fieldErrors.gallaNumber}
            helperText="Unique shop reference identifier. Will be converted to uppercase."
            disabled={isSubmitting}
            required
          />

          <Input
            label="Category *"
            placeholder="e.g. Floor, Wall, Bathroom, Elevation"
            value={form.category}
            onChange={(e) => handleChange('category', e.target.value)}
            error={fieldErrors.category}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Tile Size *"
            placeholder="e.g. 600x600 mm, 2x2 ft"
            value={form.size}
            onChange={(e) => handleChange('size', e.target.value)}
            error={fieldErrors.size}
            disabled={isSubmitting}
            required
          />

          <Input
            label="Surface Finish *"
            placeholder="e.g. Glossy, Matte, Rustic"
            value={form.finish}
            onChange={(e) => handleChange('finish', e.target.value)}
            error={fieldErrors.finish}
            disabled={isSubmitting}
            required
          />

          <Input
            label="Color *"
            placeholder="e.g. White, Grey, Beige"
            value={form.color}
            onChange={(e) => handleChange('color', e.target.value)}
            error={fieldErrors.color}
            disabled={isSubmitting}
            required
          />
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/50 p-3.5 space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-700">
            Packaging & Pricing Specifications
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input
              label="Pieces Per Box *"
              type="number"
              min="1"
              step="1"
              placeholder="4"
              value={form.piecesPerBox}
              onChange={(e) => handleChange('piecesPerBox', e.target.value)}
              error={fieldErrors.piecesPerBox}
              helperText="Number of full tile pieces in one complete box"
              disabled={isSubmitting}
              required
            />

            <Input
              label="Area Per Box (sq.ft) *"
              type="number"
              min="0.001"
              step="0.01"
              placeholder="14.4"
              value={form.areaPerBox}
              onChange={(e) => handleChange('areaPerBox', e.target.value)}
              error={fieldErrors.areaPerBox}
              helperText="Coverage area in square feet per complete box"
              disabled={isSubmitting}
              required
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input
              label="Selling Price (₹ / Box) *"
              type="number"
              min="0"
              step="0.01"
              placeholder="650"
              value={form.sellingPrice}
              onChange={(e) => handleChange('sellingPrice', e.target.value)}
              error={fieldErrors.sellingPrice}
              helperText="Catalog reference selling price per box (default for orders)"
              disabled={isSubmitting}
              required
            />

            <Input
              label="Purchase Price (₹ / Box) *"
              type="number"
              min="0"
              step="0.01"
              placeholder="480"
              value={form.purchasePrice}
              onChange={(e) => handleChange('purchasePrice', e.target.value)}
              error={fieldErrors.purchasePrice}
              helperText="Catalog reference purchase price per box"
              disabled={isSubmitting}
              required
            />

            <Input
              label="Minimum Stock (Pieces)"
              type="number"
              min="0"
              step="1"
              placeholder="0"
              value={form.minimumStockPieces}
              onChange={(e) => handleChange('minimumStockPieces', e.target.value)}
              error={fieldErrors.minimumStockPieces}
              helperText="Low stock alert threshold"
              disabled={isSubmitting}
            />
          </div>
        </div>

        <div className="mt-6 flex justify-end space-x-3 pt-2">
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
            isLoading={isSubmitting}
          >
            {isEdit ? 'Save Changes' : 'Create Product'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
