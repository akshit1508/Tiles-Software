import React, { useState } from 'react';
import { ConfirmDialog } from '@/components/ui';
import { CustomerListItem, customersApi } from '@/lib/api/customers';
import { ApiError } from '@/lib/api';

interface CustomerDeactivateDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  customer: CustomerListItem | null;
}

export function CustomerDeactivateDialog({
  isOpen,
  onClose,
  onSuccess,
  customer,
}: CustomerDeactivateDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!customer) return null;

  const isDeactivating = customer.isActive;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      if (isDeactivating) {
        await customersApi.deactivate(customer._id);
      } else {
        await customersApi.activate(customer._id);
      }

      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to update customer status. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = isDeactivating
    ? `Deactivate Customer: ${customer.name}`
    : `Reactivate Customer: ${customer.name}`;

  const message = isDeactivating
    ? `Are you sure you want to deactivate "${customer.name}"? This is a soft deactivation: the customer cannot be selected for new sales orders, but existing balances can still receive payments and all historical order and payment records remain permanently intact.`
    : `Are you sure you want to reactivate "${customer.name}"? The customer will become available again for new sales orders.`;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={() => {
        setErrorMessage(null);
        onClose();
      }}
      onConfirm={handleConfirm}
      title={title}
      message={errorMessage ? `${errorMessage} — ${message}` : message}
      confirmText={isDeactivating ? 'Deactivate Customer' : 'Reactivate Customer'}
      cancelText="Cancel"
      variant={isDeactivating ? 'danger' : 'primary'}
      isLoading={isSubmitting}
    />
  );
}
