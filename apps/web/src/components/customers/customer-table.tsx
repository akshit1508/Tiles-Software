import React from 'react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
} from '@/components/ui';
import { CustomerListItem } from '@/lib/api/customers';
import { formatCurrencyINR } from '@/lib/api/products';
import { CustomerStatusBadge } from './customer-status-badge';
import { Edit2, Ban, CheckCircle, Eye, Phone, MapPin } from 'lucide-react';

interface CustomerTableProps {
  customers: CustomerListItem[];
  onViewDetails: (customer: CustomerListItem) => void;
  onEdit: (customer: CustomerListItem) => void;
  onToggleStatus: (customer: CustomerListItem) => void;
}

export function CustomerTable({
  customers,
  onViewDetails,
  onEdit,
  onToggleStatus,
}: CustomerTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer Name</TableHead>
            <TableHead>Phone Number</TableHead>
            <TableHead>Address</TableHead>
            <TableHead className="text-center">Total Orders</TableHead>
            <TableHead className="text-right">
              <div>Outstanding Balance</div>
              <div className="text-[10px] font-normal lowercase text-slate-400">server-derived</div>
            </TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((customer) => {
            const hasOutstanding = customer.outstandingBalance > 0;

            return (
              <TableRow
                key={customer._id}
                className={hasOutstanding ? 'bg-amber-50/20 hover:bg-amber-50/35' : undefined}
              >
                {/* Name */}
                <TableCell>
                  <div className="font-semibold text-slate-900">{customer.name}</div>
                </TableCell>

                {/* Phone */}
                <TableCell>
                  <div className="flex items-center gap-1.5 text-xs font-mono font-medium text-slate-700">
                    <Phone className="h-3 w-3 text-slate-400 flex-shrink-0" />
                    {customer.phone}
                  </div>
                </TableCell>

                {/* Address */}
                <TableCell>
                  {customer.address ? (
                    <div className="flex items-center gap-1.5 text-xs text-slate-600 max-w-xs truncate" title={customer.address}>
                      <MapPin className="h-3 w-3 text-slate-400 flex-shrink-0" />
                      <span className="truncate">{customer.address}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic">No address specified</span>
                  )}
                </TableCell>

                {/* Total Orders */}
                <TableCell className="text-center font-mono text-xs font-medium text-slate-700">
                  {customer.totalOrders} {customer.totalOrders === 1 ? 'order' : 'orders'}
                </TableCell>

                {/* Outstanding Balance */}
                <TableCell className="text-right">
                  <span
                    className={`font-mono text-sm font-semibold ${
                      hasOutstanding ? 'text-amber-800' : 'text-slate-700'
                    }`}
                  >
                    {formatCurrencyINR(customer.outstandingBalance)}
                  </span>
                  {hasOutstanding && (
                    <div className="text-[10px] font-medium text-amber-700">Payment Pending</div>
                  )}
                </TableCell>

                {/* Status Badge */}
                <TableCell className="text-center">
                  <CustomerStatusBadge isActive={customer.isActive} />
                </TableCell>

                {/* Action Buttons */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewDetails(customer)}
                      className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                      title="View Customer Profile & History"
                      aria-label="View Customer Profile & History"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(customer)}
                      className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                      title="Edit Customer"
                      aria-label="Edit Customer"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>

                    {customer.isActive ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleStatus(customer)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Deactivate Customer"
                        aria-label="Deactivate Customer"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleStatus(customer)}
                        className="h-8 w-8 p-0 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
                        title="Reactivate Customer"
                        aria-label="Reactivate Customer"
                      >
                        <CheckCircle className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
