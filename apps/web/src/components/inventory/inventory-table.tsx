/* eslint-disable @next/next/no-img-element */
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
import { InventoryItem } from '@/lib/api/inventory';
import { Product } from '@/lib/api/products';
import { StockStatusBadge } from './stock-status-badge';
import { ProductStatusBadge } from '@/components/products';
import { PlusCircle, AlertTriangle, Sliders, History, Image as ImageIcon } from 'lucide-react';

interface InventoryTableProps {
  items: InventoryItem[];
  onStockIn: (item: InventoryItem, product: Product) => void;
  onDamage: (item: InventoryItem, product: Product) => void;
  onAdjustment: (item: InventoryItem, product: Product) => void;
  onViewHistory: (item: InventoryItem, product: Product) => void;
}

export function InventoryTable({
  items,
  onStockIn,
  onDamage,
  onAdjustment,
  onViewHistory,
}: InventoryTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product / Brand</TableHead>
            <TableHead>Galla No.</TableHead>
            <TableHead>Size / Finish</TableHead>
            <TableHead className="text-right">
              <div>Current Stock</div>
              <div className="text-[10px] font-normal lowercase text-slate-400">boxes & loose pcs</div>
            </TableHead>
            <TableHead className="text-right">
              <div>Total Physical Stock</div>
              <div className="text-[10px] font-normal lowercase text-slate-400">canonical pieces</div>
            </TableHead>
            <TableHead className="text-right">
              <div>Area Coverage</div>
              <div className="text-[10px] font-normal lowercase text-slate-400">sq.ft</div>
            </TableHead>
            <TableHead className="text-center">Stock Status</TableHead>
            <TableHead className="text-center">Catalog Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const product =
              typeof item.productId === 'object' && item.productId !== null
                ? (item.productId as Product)
                : null;

            if (!product) return null;

            return (
              <TableRow
                key={item._id}
                className={item.isLowStock ? 'bg-amber-50/25 hover:bg-amber-50/40' : undefined}
              >
                {/* Product & Brand */}
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100 flex items-center justify-center">
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0].url}
                          alt={product.images[0].alt || product.productName}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <ImageIcon className="h-4 w-4 text-slate-400" />
                      )}
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">{product.productName}</div>
                      <div className="text-xs text-slate-500">
                        {product.brand} • <span className="font-medium">{product.category}</span>
                      </div>
                    </div>
                  </div>
                </TableCell>

                {/* Galla Number */}
                <TableCell>
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-800">
                    {product.gallaNumber}
                  </span>
                </TableCell>

                {/* Size & Finish */}
                <TableCell>
                  <div className="text-xs font-medium text-slate-800">{product.size}</div>
                  <div className="text-[11px] text-slate-500">
                    {product.finish} • {product.color}
                  </div>
                </TableCell>

                {/* Primary: Boxes + Loose Pieces */}
                <TableCell className="text-right">
                  <div className="font-mono text-sm font-bold text-slate-900">
                    {item.fullBoxes} {item.fullBoxes === 1 ? 'box' : 'boxes'}
                  </div>
                  <div className="text-[11px] font-medium text-slate-500">
                    {item.loosePieces > 0 ? `+${item.loosePieces} loose pcs` : '0 loose pcs'}
                  </div>
                </TableCell>

                {/* Canonical Total Pieces */}
                <TableCell className="text-right font-mono text-xs font-semibold text-slate-700">
                  <div>
                    {item.totalPieces.toLocaleString('en-IN')}{' '}
                    <span className="text-[11px] font-normal text-slate-500 font-sans">pcs total</span>
                  </div>
                  <div className="text-[10px] font-normal text-slate-400 font-sans">
                    {product.piecesPerBox} pcs/box
                  </div>
                </TableCell>

                {/* Derived Sq.Ft */}
                <TableCell className="text-right">
                  <div className="text-xs font-medium text-slate-800">
                    {Number(item.totalSqFt || 0).toLocaleString('en-IN', {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{' '}
                    <span className="text-[10px] text-slate-400">sq.ft</span>
                  </div>
                </TableCell>

                {/* Stock Health */}
                <TableCell className="text-center">
                  <div className="inline-flex flex-col items-center gap-0.5">
                    <StockStatusBadge
                      isLowStock={item.isLowStock}
                      totalPieces={item.totalPieces}
                    />
                    <span className="text-[10px] font-medium text-slate-500">
                      min: {item.minimumStockBoxes ?? product.minimumStockBoxes ?? 0}{' '}
                      {(item.minimumStockBoxes ?? product.minimumStockBoxes ?? 0) === 1 ? 'box' : 'boxes'}
                    </span>
                  </div>
                </TableCell>

                {/* Product Catalog Status */}
                <TableCell className="text-center">
                  <ProductStatusBadge isActive={product.isActive} />
                </TableCell>

                {/* Action Buttons */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onStockIn(item, product)}
                      className="h-8 px-2 text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 text-xs font-medium"
                      title="Receive incoming stock (Boxes)"
                    >
                      <PlusCircle className="h-3.5 w-3.5 mr-1" />
                      Stock In
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onDamage(item, product)}
                      className="h-8 px-2 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-medium"
                      title="Record damaged tiles"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                      Damage
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onAdjustment(item, product)}
                      className="h-8 px-2 text-amber-700 hover:text-amber-800 hover:bg-amber-50 text-xs font-medium"
                      title="Manual inventory adjustment"
                    >
                      <Sliders className="h-3.5 w-3.5 mr-1" />
                      Adjust
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onViewHistory(item, product)}
                      className="h-8 w-8 p-0 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                      title="View transaction audit log"
                      aria-label="View transaction audit log"
                    >
                      <History className="h-4 w-4" />
                    </Button>
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
