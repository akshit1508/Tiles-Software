'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/ui/loading-state';

export default function HomePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      if (isAuthenticated) {
        router.replace('/dashboard');
      } else {
        router.replace('/login');
      }
    }
  }, [isAuthenticated, isLoading, router]);

  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
      <LoadingState message="Connecting to Goverdhan Traders..." />
    </main>
  );
}
