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
import { CustomerOutstandingListItem } from '@/lib/api/outstanding';
import { formatCurrencyINR } from '@/lib/api/products';
import { Eye, Phone, AlertCircle } from 'lucide-react';

interface OutstandingTableProps {
  customers: CustomerOutstandingListItem[];
  onViewBreakdown: (customer: CustomerOutstandingListItem) => void;
}

export function OutstandingTable({
  customers,
  onViewBreakdown,
}: OutstandingTableProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <Table>
        <TableHeader>
          <TableRow className="bg-slate-50/80">
            <TableHead>Customer</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead className="text-right">Total Sales</TableHead>
            <TableHead className="text-right">Total Paid</TableHead>
            <TableHead className="text-right">Outstanding Balance</TableHead>
            <TableHead className="text-right w-[120px]">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {customers.map((c) => (
            <TableRow
              key={c.customerId}
              className="hover:bg-slate-50/50 transition-colors"
            >
              <TableCell>
                <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                  <span>{c.customerName}</span>
                  {!c.isActive && (
                    <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-normal">
                      Deactivated
                    </span>
                  )}
                </div>
              </TableCell>

              <TableCell className="text-xs text-slate-600">
                <div className="flex items-center gap-1">
                  <Phone className="h-3 w-3 text-slate-400" />
                  <span>{c.customerPhone}</span>
                </div>
              </TableCell>

              <TableCell className="text-right font-mono text-xs text-slate-600">
                {formatCurrencyINR(c.totalSales)}
              </TableCell>

              <TableCell className="text-right font-mono text-xs font-medium text-emerald-700">
                {formatCurrencyINR(c.totalPaid)}
              </TableCell>

              <TableCell className="text-right">
                <span className="font-mono text-sm font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                  {formatCurrencyINR(c.outstanding)}
                </span>
              </TableCell>

              <TableCell className="text-right">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onViewBreakdown(c)}
                  className="h-8 text-xs text-blue-600 hover:text-blue-800"
                >
                  <Eye className="h-3.5 w-3.5 mr-1" />
                  Breakdown
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
