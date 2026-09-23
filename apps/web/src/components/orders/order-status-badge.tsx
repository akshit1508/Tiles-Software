import React from 'react';
import { Badge } from '@/components/ui';
import { OrderStatus, OrderPaymentStatus } from '@/lib/api/orders';

interface OrderStatusBadgeProps {
  status: OrderStatus;
}

export function OrderStatusBadge({ status }: OrderStatusBadgeProps) {
  if (status === 'COMPLETED') {
    return (
      <Badge variant="success" size="sm">
        Completed
      </Badge>
    );
  }

  if (status === 'CANCELLED') {
    return (
      <Badge variant="danger" size="sm">
        Cancelled
      </Badge>
    );
  }

  return (
    <Badge variant="default" size="sm">
      {status}
    </Badge>
  );
}

interface OrderPaymentStatusBadgeProps {
  status: OrderPaymentStatus;
}

export function OrderPaymentStatusBadge({ status }: OrderPaymentStatusBadgeProps) {
  switch (status) {
    case 'PAID':
      return (
        <Badge variant="success" size="sm">
          Paid
        </Badge>
      );
    case 'PARTIALLY PAID':
      return (
        <Badge variant="warning" size="sm">
          Partially Paid
        </Badge>
      );
    case 'UNPAID':
      return (
        <Badge variant="neutral" size="sm">
          Unpaid
        </Badge>
      );
    case 'CANCELLED':
      return (
        <Badge variant="danger" size="sm">
          Cancelled
        </Badge>
      );
    default:
      return (
        <Badge variant="default" size="sm">
          {status}
        </Badge>
      );
  }
}
