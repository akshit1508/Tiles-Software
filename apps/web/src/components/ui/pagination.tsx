'use client';

import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from './button';

export interface PaginationProps {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  className?: string;
}

export function Pagination({
  page,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  className,
}: PaginationProps) {
  if (totalPages <= 1 && (!totalItems || totalItems === 0)) {
    return null;
  }

  const startItem = totalItems !== undefined && pageSize !== undefined
    ? Math.min((page - 1) * pageSize + 1, totalItems)
    : undefined;
  const endItem = totalItems !== undefined && pageSize !== undefined
    ? Math.min(page * pageSize, totalItems)
    : undefined;

  return (
    <div
      className={cn(
        'flex flex-col sm:flex-row items-center justify-between gap-4 py-3 px-2',
        className,
      )}
    >
      <div className="text-xs sm:text-sm text-slate-500">
        {startItem !== undefined && endItem !== undefined && totalItems !== undefined ? (
          <span>
            Showing <span className="font-medium text-slate-900">{startItem}</span> to{' '}
            <span className="font-medium text-slate-900">{endItem}</span> of{' '}
            <span className="font-medium text-slate-900">{totalItems}</span> results
          </span>
        ) : (
          <span>
            Page <span className="font-medium text-slate-900">{page}</span> of{' '}
            <span className="font-medium text-slate-900">{totalPages || 1}</span>
          </span>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(Math.max(1, page - 1))}
          aria-label="Previous Page"
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        <span className="text-xs font-medium text-slate-600 px-2 sm:hidden">
          {page} / {totalPages || 1}
        </span>

        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(Math.min(totalPages, page + 1))}
          aria-label="Next Page"
        >
          Next
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  );
}
