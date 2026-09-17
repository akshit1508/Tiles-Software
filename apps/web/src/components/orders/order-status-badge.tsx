import React from 'react';
import { Badge } from '@/components/ui';
import { OrderStatus } from '@/lib/api/orders';

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
