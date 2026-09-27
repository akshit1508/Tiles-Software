import React from 'react';
import { Layers, Boxes, Calendar, Grid } from 'lucide-react';
import { TileStockReportSummary } from '@/lib/api/reports';

interface TileStockSummaryProps {
  filterSize: string;
  generatedAt: string;
  summary: TileStockReportSummary;
}

export function TileStockSummary({
  filterSize,
  generatedAt,
  summary,
}: TileStockSummaryProps) {
  const formattedDate = (() => {
    try {
      return new Date(generatedAt).toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return generatedAt;
    }
  })();

  const metrics = [
    {
      label: 'Catalogue Size',
      value: filterSize.replace(/[*xX]/g, ' × '),
      subtext: 'Selected Dimension',
      icon: Grid,
      textColor: 'text-slate-900',
    },
    {
      label: 'Total Designs',
      value: `${summary.totalDesigns} Models`,
      subtext: 'Active Catalogue Variants',
      icon: Layers,
      textColor: 'text-blue-700',
    },
    {
      label: 'Available Stock',
      value: `${summary.totalAvailableBoxes.toLocaleString('en-IN')} Boxes`,
      subtext: 'Physical Warehouse Stock',
      icon: Boxes,
      textColor: 'text-emerald-700',
    },
    {
      label: 'Report Generated',
      value: formattedDate,
      subtext: 'Live Snapshot Timestamp',
      icon: Calendar,
      textColor: 'text-slate-700',
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
      {metrics.map((m) => {
        const Icon = m.icon;
        return (
          <div
            key={m.label}
            className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
          >
            <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600 border border-slate-100">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {m.label}
              </p>
              <p className={`text-base font-bold truncate mt-0.5 ${m.textColor}`}>
                {m.value}
              </p>
              <p className="text-[11px] text-slate-400 truncate mt-0.5">
                {m.subtext}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
