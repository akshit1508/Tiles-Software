import React from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface LoadingStateProps {
  message?: string;
  className?: string;
  fullPage?: boolean;
}

export function LoadingState({
  message = 'Loading...',
  className,
  fullPage = false,
}: LoadingStateProps) {
  const content = (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center',
        fullPage ? 'min-h-[60vh]' : 'py-12',
        className,
      )}
    >
      <Loader2 className="h-8 w-8 animate-spin text-blue-600 mb-3" />
      {message && <p className="text-sm font-medium text-slate-600">{message}</p>}
    </div>
  );

  return content;
}
