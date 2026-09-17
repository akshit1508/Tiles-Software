import React, { useState } from 'react';
import { ConfirmDialog } from '@/components/ui';
import { Order, ordersApi } from '@/lib/api/orders';
import { ApiError } from '@/lib/api';

interface OrderCancelDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  order: Order | null;
}

export function OrderCancelDialog({
  isOpen,
  onClose,
  onSuccess,
  order,
}: OrderCancelDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!order) return null;

  const handleConfirm = async () => {
    try {
      setIsSubmitting(true);
      setErrorMessage(null);

      await ordersApi.cancel(order._id);
      onSuccess();
      onClose();
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else if (err instanceof Error) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Failed to cancel order. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const title = `Cancel Order ${order.orderNumber}`;
  const baseMessage = `Are you sure you want to cancel order ${order.orderNumber}? Cancellation is permanent: the backend will automatically restore the physical inventory consumed by this order via SALE_REVERSAL and set the order status to CANCELLED.`;

  return (
    <ConfirmDialog
      isOpen={isOpen}
      onClose={() => {
        setErrorMessage(null);
        onClose();
      }}
      onConfirm={handleConfirm}
      title={title}
      message={errorMessage ? `${errorMessage} — ${baseMessage}` : baseMessage}
      confirmText="Cancel Order & Restore Stock"
      cancelText="Keep Order Active"
      variant="danger"
      isLoading={isSubmitting}
    />
  );
}
