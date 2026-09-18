import React from 'react';
import { Badge } from '@/components/ui';
import { PaymentMethod } from '@/lib/api/payments';
import { Banknote, Smartphone, Building2, FileCheck } from 'lucide-react';

interface PaymentMethodBadgeProps {
  method: PaymentMethod | string;
  size?: 'sm' | 'md';
}

export function PaymentMethodBadge({ method, size = 'sm' }: PaymentMethodBadgeProps) {
  switch (method) {
    case 'CASH':
      return (
        <Badge variant="success" size={size} className="inline-flex items-center gap-1 font-medium">
          <Banknote className="h-3 w-3" />
          <span>Cash</span>
        </Badge>
      );
    case 'UPI':
      return (
        <Badge variant="info" size={size} className="inline-flex items-center gap-1 font-medium">
          <Smartphone className="h-3 w-3" />
          <span>UPI</span>
        </Badge>
      );
    case 'BANK_TRANSFER':
      return (
        <Badge variant="neutral" size={size} className="inline-flex items-center gap-1 font-medium bg-purple-50 text-purple-700 border-purple-200">
          <Building2 className="h-3 w-3 text-purple-600" />
          <span>Bank Transfer</span>
        </Badge>
      );
    case 'CHEQUE':
      return (
        <Badge variant="warning" size={size} className="inline-flex items-center gap-1 font-medium">
          <FileCheck className="h-3 w-3" />
          <span>Cheque</span>
        </Badge>
      );
    default:
      return (
        <Badge variant="neutral" size={size}>
          {method}
        </Badge>
      );
  }
}
