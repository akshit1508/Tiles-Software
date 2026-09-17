'use client';

import React from 'react';
import { Users, UserPlus } from 'lucide-react';
import { Card, Button, EmptyState } from '@/components/ui';

export default function CustomersPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Customers
          </h1>
          <p className="text-sm text-slate-500">
            Customer directory, contact details, purchase histories, and derived outstanding balances.
          </p>
        </div>
        <Button variant="primary">
          <UserPlus className="h-4 w-4 mr-1.5" />
          Add Customer
        </Button>
      </div>

      <Card>
        <EmptyState
          icon={<Users className="h-8 w-8 text-blue-600" />}
          title="Customer Directory Ready"
          description="Customer list will allow searching by phone/name, viewing order histories, and reviewing pending balances."
          actionLabel="Register Customer"
          onAction={() => {}}
        />
      </Card>
    </div>
  );
}
