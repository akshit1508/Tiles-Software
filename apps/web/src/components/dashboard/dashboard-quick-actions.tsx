import React from 'react';
import { Card } from '@/components/ui';
import {
  Package,
  Boxes,
  Users,
  ShoppingCart,
  CreditCard,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import Link from 'next/link';

export function DashboardQuickActions() {
  const actions = [
    {
      title: 'New Order',
      description: 'Create multi-item orders with box/sq.ft conversions',
      icon: <ShoppingCart className="h-5 w-5 text-purple-600" />,
      href: '/orders',
      cta: 'Go to Orders',
      color: 'hover:border-purple-200',
    },
    {
      title: 'Record Payment',
      description: 'Post Cash, UPI, Bank Transfer or Cheque payments',
      icon: <CreditCard className="h-5 w-5 text-emerald-600" />,
      href: '/payments',
      cta: 'Go to Payments',
      color: 'hover:border-emerald-200',
    },
    {
      title: 'Stock Management',
      description: 'Receive boxes, record damage, and log stock adjustments',
      icon: <Boxes className="h-5 w-5 text-blue-600" />,
      href: '/inventory',
      cta: 'View Inventory',
      color: 'hover:border-blue-200',
    },
    {
      title: 'Outstanding Dues',
      description: 'Review debtor aging and order-level payment breakdowns',
      icon: <AlertTriangle className="h-5 w-5 text-amber-600" />,
      href: '/outstanding',
      cta: 'View Outstanding',
      color: 'hover:border-amber-200',
    },
    {
      title: 'Product Catalog',
      description: 'Configure tile brands, packaging specs, and reference prices',
      icon: <Package className="h-5 w-5 text-indigo-600" />,
      href: '/products',
      cta: 'Manage Products',
      color: 'hover:border-indigo-200',
    },
    {
      title: 'Customer Directory',
      description: 'Manage customer accounts, contacts, and transaction ledgers',
      icon: <Users className="h-5 w-5 text-rose-600" />,
      href: '/customers',
      cta: 'Manage Customers',
      color: 'hover:border-rose-200',
    },
  ];

  return (
    <Card
      title="Store Operations & Quick Actions"
      subtitle="Direct navigation to store management modules"
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((act) => (
          <Link
            key={act.title}
            href={act.href}
            className={`p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white transition-all shadow-sm flex flex-col justify-between group ${act.color}`}
          >
            <div>
              <div className="flex items-center gap-2.5 mb-2">
                <div className="p-2 bg-white rounded-lg border border-slate-200 shadow-2xs group-hover:scale-105 transition-transform">
                  {act.icon}
                </div>
                <h4 className="font-semibold text-sm text-slate-900">
                  {act.title}
                </h4>
              </div>
              <p className="text-xs text-slate-500 mb-3">
                {act.description}
              </p>
            </div>
            <div className="text-xs font-semibold text-blue-600 group-hover:text-blue-800 flex items-center gap-1 pt-2 border-t border-slate-100">
              <span>{act.cta}</span>
              <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        ))}
      </div>
    </Card>
  );
}
