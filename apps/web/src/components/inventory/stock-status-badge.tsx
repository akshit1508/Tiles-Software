import React from 'react';
import { Badge } from '@/components/ui';

interface StockStatusBadgeProps {
  isLowStock: boolean;
  totalPieces: number;
}

export function StockStatusBadge({ isLowStock, totalPieces }: StockStatusBadgeProps) {
  if (totalPieces === 0) {
    return (
      <Badge variant="danger" size="sm">
        Out of Stock
      </Badge>
    );
  }

  if (isLowStock) {
    return (
      <Badge variant="warning" size="sm">
        Low Stock
      </Badge>
    );
  }

  return (
    <Badge variant="success" size="sm">
      In Stock
    </Badge>
  );
}
