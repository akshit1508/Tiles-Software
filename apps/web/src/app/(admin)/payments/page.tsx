'use client';

import React from 'react';
import { CreditCard, Plus } from 'lucide-react';
import { Card, Button, EmptyState } from '@/components/ui';

export default function PaymentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Payments
          </h1>
          <p className="text-sm text-slate-500">
            Record payments against orders (Cash, UPI, Bank Transfer, Cheque) and review payment audit history.
          </p>
        </div>
        <Button variant="primary">
          <Plus className="h-4 w-4 mr-1.5" />
          Record Payment
        </Button>
      </div>

      <Card>
        <EmptyState
          icon={<CreditCard className="h-8 w-8 text-emerald-600" />}
          title="Payment Ledger Ready"
          description="Payments ledger will display all received collections with payment methods, references, and order links."
          actionLabel="Record New Payment"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
