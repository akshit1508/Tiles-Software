import React from 'react';
import {
  Card,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from '@/components/ui';
import { LowStockProductInfo } from '@/lib/api/dashboard';
import { AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface DashboardLowStockTableProps {
  items: LowStockProductInfo[];
  totalLowStock: number;
}

export function DashboardLowStockTable({
  items,
  totalLowStock,
}: DashboardLowStockTableProps) {
  if (totalLowStock === 0) {
    return (
      <Card className="p-6 border-emerald-200 bg-emerald-50/30">
        <div className="flex items-center gap-3">
          <div className="rounded-full bg-emerald-100 p-2 text-emerald-600">
            <CheckCircle2 className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-emerald-950">
              Inventory Levels Healthy
            </h4>
            <p className="text-xs text-emerald-700 mt-0.5">
              All catalog products currently meet or exceed their configured minimum stock thresholds.
            </p>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      title={`Low Stock Alerts (${totalLowStock})`}
      subtitle="Products currently at or below their configured minimum stock threshold"
      action={
        <Link
          href="/inventory"
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 inline-flex items-center gap-1"
        >
          View Full Inventory <ArrowRight className="h-3 w-3" />
        </Link>
      }
    >
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead>Product</TableHead>
              <TableHead>Brand</TableHead>
              <TableHead className="text-right">Current Stock</TableHead>
              <TableHead className="text-right">Min Threshold</TableHead>
              <TableHead className="text-right">Deficit</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.map((item) => {
              const ppb = item.piecesPerBox || 1;
              const rawMinPieces = item.minimumStockPieces ?? 0;
              const minBoxes =
                item.minimumStockBoxes ?? (item.piecesPerBox ? Math.ceil(rawMinPieces / item.piecesPerBox) : 0);
              const minPieces =
                item.piecesPerBox && item.minimumStockBoxes !== undefined
                  ? item.minimumStockBoxes * item.piecesPerBox
                  : rawMinPieces;
              const fullBoxes = item.fullBoxes ?? Math.floor(item.currentPieces / ppb);
              const loosePieces = item.loosePieces ?? (item.currentPieces % ppb);
              const deficitPieces = Math.max(0, minPieces - item.currentPieces);
              const deficitBoxes = item.piecesPerBox ? Math.ceil(deficitPieces / item.piecesPerBox) : 0;

              return (
                <TableRow key={item.productId} className="hover:bg-slate-50/50">
                  <TableCell>
                    <div className="font-semibold text-slate-900 text-sm">
                      {item.productName}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-slate-600">
                    {item.brand}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono text-xs font-bold text-rose-600">
                      {fullBoxes} {fullBoxes === 1 ? 'box' : 'boxes'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-normal">
                      +{loosePieces} loose ({item.currentPieces} pcs)
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="font-mono text-xs font-semibold text-slate-700">
                      {minBoxes} {minBoxes === 1 ? 'box' : 'boxes'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-normal">
                      ({minPieces} pcs)
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="danger" size="sm">
                      -{deficitBoxes} {deficitBoxes === 1 ? 'box' : 'boxes'}
                    </Badge>
                    <div className="text-[10px] text-slate-400 mt-0.5">
                      -{deficitPieces} pcs
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Link
                      href="/inventory"
                      className="text-xs font-medium text-blue-600 hover:text-blue-800"
                    >
                      Stock In &rarr;
                    </Link>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
