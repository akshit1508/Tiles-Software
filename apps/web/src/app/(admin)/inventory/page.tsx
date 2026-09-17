'use client';

import React from 'react';
import { Boxes, Plus } from 'lucide-react';
import { Card, Button, EmptyState } from '@/components/ui';

export default function InventoryPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Inventory
          </h1>
          <p className="text-sm text-slate-500">
            Monitor stock levels in boxes, pieces, and sqft. Record stock in, stock out, and damaged adjustments.
          </p>
        </div>
        <Button variant="primary">
          <Plus className="h-4 w-4 mr-1.5" />
          Stock Adjustment
        </Button>
      </div>

      <Card>
        <EmptyState
          icon={<Boxes className="h-8 w-8 text-emerald-600" />}
          title="Inventory Ledger Ready"
          description="Inventory management UI will display real-time stock balances and movement audit history."
          actionLabel="Record Stock"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
