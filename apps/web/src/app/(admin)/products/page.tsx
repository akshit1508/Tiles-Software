'use client';

import React from 'react';
import { Package, Plus } from 'lucide-react';
import { Card, Button, EmptyState } from '@/components/ui';

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Products
          </h1>
          <p className="text-sm text-slate-500">
            Manage tile catalog, sizes, finishes, pricing, and galla locations.
          </p>
        </div>
        <Button variant="primary">
          <Plus className="h-4 w-4 mr-1.5" />
          Add Product
        </Button>
      </div>

      <Card>
        <EmptyState
          icon={<Package className="h-8 w-8 text-blue-600" />}
          title="Product Catalog Ready"
          description="Product management UI will display full tile catalog with search, filter, and pagination."
          actionLabel="Add Tile Product"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
