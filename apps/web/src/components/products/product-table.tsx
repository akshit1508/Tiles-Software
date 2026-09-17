'use client';

import React from 'react';
import { Edit2, Ban, CheckCircle2 } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
} from '@/components/ui';
import { Product, formatCurrencyINR, parseDecimalValue } from '@/lib/api/products';
import { ProductStatusBadge } from './product-status-badge';

interface ProductTableProps {
  products: Product[];
  onEdit: (product: Product) => void;
  onToggleStatus: (product: Product) => void;
}

export function ProductTable({
  products,
  onEdit,
  onToggleStatus,
}: ProductTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Product / Brand</TableHead>
            <TableHead>Galla No.</TableHead>
            <TableHead>Category</TableHead>
            <TableHead>Size / Finish</TableHead>
            <TableHead>Color</TableHead>
            <TableHead>Packaging</TableHead>
            <TableHead className="text-right">
              <div>Ref. Selling Price</div>
              <div className="text-[10px] font-normal lowercase text-slate-400">per box</div>
            </TableHead>
            <TableHead className="text-right">
              <div>Ref. Purchase Price</div>
              <div className="text-[10px] font-normal lowercase text-slate-400">per box</div>
            </TableHead>
            <TableHead className="text-center">Min Stock</TableHead>
            <TableHead className="text-center">Status</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {products.map((product) => {
            const area = parseDecimalValue(product.areaPerBox);

            return (
              <TableRow key={product._id}>
                <TableCell>
                  <div className="font-semibold text-slate-900">
                    {product.productName}
                  </div>
                  <div className="text-xs text-slate-500">{product.brand}</div>
                </TableCell>

                <TableCell>
                  <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-xs font-mono font-bold text-slate-800 border border-slate-200">
                    {product.gallaNumber}
                  </span>
                </TableCell>

                <TableCell>
                  <span className="text-sm text-slate-700">{product.category}</span>
                </TableCell>

                <TableCell>
                  <div className="text-sm text-slate-800">{product.size}</div>
                  <div className="text-xs text-slate-500 capitalize">{product.finish}</div>
                </TableCell>

                <TableCell>
                  <span className="text-sm text-slate-700">{product.color}</span>
                </TableCell>

                <TableCell>
                  <div className="text-xs text-slate-700 font-medium">
                    {product.piecesPerBox} pcs/box
                  </div>
                  <div className="text-xs text-slate-500">
                    {area} sq.ft/box
                  </div>
                </TableCell>

                <TableCell className="text-right font-semibold text-slate-900">
                  {formatCurrencyINR(product.sellingPrice)}
                  <div className="text-[10px] font-normal text-slate-400">ref / box</div>
                </TableCell>

                <TableCell className="text-right text-slate-600">
                  {formatCurrencyINR(product.purchasePrice)}
                  <div className="text-[10px] font-normal text-slate-400">ref / box</div>
                </TableCell>

                <TableCell className="text-center">
                  <span className="text-xs font-medium text-slate-600">
                    {product.minimumStockPieces} pcs
                  </span>
                </TableCell>

                <TableCell className="text-center">
                  <ProductStatusBadge isActive={product.isActive} />
                </TableCell>

                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onEdit(product)}
                      className="h-8 w-8 p-0 text-slate-600 hover:text-blue-600 hover:bg-blue-50"
                      title="Edit Product"
                      aria-label="Edit Product"
                    >
                      <Edit2 className="h-4 w-4" />
                    </Button>

                    {product.isActive ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleStatus(product)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                        title="Deactivate Product"
                        aria-label="Deactivate Product"
                      >
                        <Ban className="h-4 w-4" />
                      </Button>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => onToggleStatus(product)}
                        className="h-8 w-8 p-0 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50"
                        title="Reactivate Product"
                        aria-label="Reactivate Product"
                      >
                        <CheckCircle2 className="h-4 w-4" />
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
