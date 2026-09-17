import React from 'react';
import { Badge } from '@/components/ui';

interface CustomerStatusBadgeProps {
  isActive: boolean;
}

export function CustomerStatusBadge({ isActive }: CustomerStatusBadgeProps) {
  if (!isActive) {
    return (
      <Badge variant="neutral" size="sm">
        Deactivated
      </Badge>
    );
  }

  return (
    <Badge variant="success" size="sm">
      Active
    </Badge>
  );
}
