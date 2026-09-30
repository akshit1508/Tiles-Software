import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Badge,
} from '@/components/ui';
import { TileStockReportItem } from '@/lib/api/reports';

interface TileStockTableProps {
  items: TileStockReportItem[];
}

function ProductThumbnail({ url, alt }: { url: string | null; alt: string }) {
  const [imageError, setImageError] = useState(false);

  if (!url || imageError) {
    return (
      <div
        className="flex h-12 w-12 flex-shrink-0 flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50 text-slate-400"
        title="No image available"
      >
        <ImageOff className="h-4 w-4" />
        <span className="text-[9px] font-medium tracking-tight mt-0.5">No Img</span>
      </div>
    );
  }

  return (
    <div className="relative h-12 w-12 flex-shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading="lazy"
        onError={() => setImageError(true)}
        className="h-full w-full object-cover transition-transform duration-200 hover:scale-105"
      />
    </div>
  );
}

export function TileStockTable({ items }: TileStockTableProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Tile Models Catalogue Preview
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Showing {items.length} customer-facing design variations
          </p>
        </div>
        <span className="text-xs font-medium text-slate-400">
          Stock in full boxes
        </span>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-14 text-center">#</TableHead>
            <TableHead className="w-16">Image</TableHead>
            <TableHead className="min-w-[180px]">Product / Design</TableHead>
            <TableHead className="w-28">Brand</TableHead>
            <TableHead className="w-24">Size</TableHead>
            <TableHead className="w-28 text-center">Surface Finish</TableHead>
            <TableHead className="w-32 text-right">Available Stock</TableHead>
            <TableHead className="w-28 text-center">Tiles / Box</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const specs = [item.category, item.color]
              .filter(Boolean)
              .join(' • ');

            return (
              <TableRow key={`${item.productId}-${item.serialNumber}`}>
                {/* Serial Number */}
                <TableCell className="text-center font-semibold text-slate-500 text-xs">
                  {item.serialNumber < 10 ? `0${item.serialNumber}` : item.serialNumber}
                </TableCell>

                {/* Thumbnail */}
                <TableCell>
                  <ProductThumbnail url={item.imageUrl} alt={item.productName} />
                </TableCell>

                {/* Product Name & Specifications */}
                <TableCell>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 text-sm truncate">
                      {item.productName}
                    </p>
                    {specs && (
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {specs}
                      </p>
                    )}
                  </div>
                </TableCell>

                {/* Brand */}
                <TableCell>
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                    {item.brand || 'Unbranded'}
                  </span>
                </TableCell>

                {/* Size */}
                <TableCell className="text-xs font-medium text-slate-600">
                  {item.size.replace(/[*xX]/g, ' × ')}
                </TableCell>

                {/* Surface Finish */}
                <TableCell className="text-center">
                  <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                    {item.finish || 'Standard'}
                  </span>
                </TableCell>

                {/* Available Stock in Boxes */}
                <TableCell className="text-right">
                  {item.availableBoxes > 0 ? (
                    <span className="inline-flex items-center font-bold text-emerald-700 text-sm">
                      {item.availableBoxes.toLocaleString('en-IN')}{' '}
                      <span className="text-xs font-normal text-slate-500 ml-1">Boxes</span>
                    </span>
                  ) : (
                    <Badge variant="danger" size="sm">
                      0 Boxes
                    </Badge>
                  )}
                </TableCell>

                {/* Tiles per Box */}
                <TableCell className="text-center text-xs font-medium text-slate-700">
                  {item.piecesPerBox} pcs
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
