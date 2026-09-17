'use client';

import React from 'react';
import { AlertCircle } from 'lucide-react';
import { Card, Button, EmptyState } from '@/components/ui';

export default function OutstandingPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Outstanding Balances
          </h1>
          <p className="text-sm text-slate-500">
            Real-time customer outstanding accounts derived from completed orders and received payments.
          </p>
        </div>
      </div>

      <Card>
        <EmptyState
          icon={<AlertCircle className="h-8 w-8 text-amber-600" />}
          title="Outstanding Balances Ready"
          description="Displays customers with pending balances, aging breakdowns, and direct payment recording shortcuts."
          actionLabel="View Dashboard"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
