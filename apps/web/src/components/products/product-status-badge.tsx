import React from 'react';
import { Badge } from '@/components/ui';

interface ProductStatusBadgeProps {
  isActive: boolean;
  className?: string;
}

export function ProductStatusBadge({ isActive, className }: ProductStatusBadgeProps) {
  if (isActive) {
    return (
      <Badge variant="success" size="sm" className={className}>
        <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Active
      </Badge>
    );
  }

  return (
    <Badge variant="neutral" size="sm" className={className}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-slate-400" />
      Deactivated
    </Badge>
  );
}
