'use client';

import React, { useState } from 'react';
import { ConfirmDialog } from '@/components/ui';
import { Product, productsApi } from '@/lib/api/products';
import { ApiError } from '@/lib/api';

interface ProductDeactivateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  product: Product | null;
}

export function ProductDeactivateDialog({
  isOpen,
  onClose,
  onSuccess,
  product,
}: ProductDeactivateDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!product) return null;

  const isDeactivating = product.isActive;

  const handleConfirm = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);

      if (isDeactivating) {
        await productsApi.deactivate(product._id);
      } else {
        await productsApi.activate(product._id);
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to update product status. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const title = isDeactivating
    ? 'Deactivate Tile Product'
    : 'Reactivate Tile Product';

  const message = isDeactivating
    ? `Are you sure you want to deactivate "${product.productName}" (${product.gallaNumber})? This is a soft deactivation: the product will be hidden from active sales, but all historical orders, invoices, and inventory records remain permanently intact.`
    : `Are you sure you want to reactivate "${product.productName}" (${product.gallaNumber})? The product will become available again for orders and stock entries.`;

  return (
    <>
      <ConfirmDialog
        isOpen={isOpen}
        onClose={onClose}
        onConfirm={handleConfirm}
        title={title}
        message={errorMessage ? `${errorMessage} — ${message}` : message}
        confirmText={isDeactivating ? 'Deactivate Product' : 'Reactivate Product'}
        cancelText="Cancel"
        variant={isDeactivating ? 'danger' : 'primary'}
        isLoading={isLoading}
      />
    </>
  );
}
