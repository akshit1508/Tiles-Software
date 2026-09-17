'use client';

import React from 'react';
import { ShoppingCart, Plus } from 'lucide-react';
import { Card, Button, EmptyState } from '@/components/ui';

export default function OrdersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Orders
          </h1>
          <p className="text-sm text-slate-500">
            Create tile sale orders, manage billing, track payments, and review order documents.
          </p>
        </div>
        <Button variant="primary">
          <Plus className="h-4 w-4 mr-1.5" />
          Create Order
        </Button>
      </div>

      <Card>
        <EmptyState
          icon={<ShoppingCart className="h-8 w-8 text-purple-600" />}
          title="Orders System Ready"
          description="Order management UI will handle atomic order generation (GT-YYYYMMDD-XXXX), multi-item lines, and payment statuses."
          actionLabel="New Order"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
