'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth';
import { LoadingState } from '@/components/ui/loading-state';

/**
 * Root route `/`.
 *
 * Acts as a deterministic routing gateway based on the 4-state authStatus:
 *
 *   initializing   → show spinner (one-time bootstrap in progress)
 *   authenticated  → redirect to /dashboard
 *   unauthenticated → redirect to /login
 *   error          → show backend-unavailable message + Retry button
 *
 * There is NO fallback timer. All state transitions are driven by the auth
 * context, which has its own bounded timeout (BOOTSTRAP_TIMEOUT_MS = 8s).
 * This eliminates the race condition where a timer could override a correct
 * redirect.
 */
export default function HomePage() {
  const { authStatus, retryAuth } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (authStatus === 'authenticated') {
      router.replace('/dashboard');
    } else if (authStatus === 'unauthenticated') {
      router.replace('/login');
    }
    // 'initializing' → stay on this page (show spinner)
    // 'error'        → stay on this page (show error UI, handled by JSX below)
  }, [authStatus, router]);

  // ── Error state ────────────────────────────────────────────────────────────
  if (authStatus === 'error') {
    return (
      <main className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
        <div className="flex flex-col items-center gap-4 text-center max-w-sm">
          {/* Red warning icon */}
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-100">
            <svg
              className="h-7 w-7 text-rose-600"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>

          <div>
            <h1 className="text-lg font-semibold text-slate-900">
              Cannot Reach Server
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              The Goverdhan Traders backend is unavailable or took too long to
              respond. Please check that the API server is running on port 3001.
            </p>
          </div>

          <button
            type="button"
            onClick={retryAuth}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 active:bg-blue-800 transition-colors"
          >
            {/* Retry icon */}
            <svg
              className="h-4 w-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"
              />
            </svg>
            Retry Connection
          </button>

          <p className="text-xs text-slate-400">
            Start the API server with{' '}
            <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-slate-700">
              npm run dev:api
            </code>
          </p>
        </div>
      </main>
    );
  }

  // ── Initializing state (spinner) ──────────────────────────────────────────
  // Also shown briefly during 'authenticated'/'unauthenticated' while the
  // router.replace() navigation is in flight.
  return (
    <main className="flex min-h-screen items-center justify-center p-6 bg-slate-50">
      <LoadingState message="Connecting to Goverdhan Traders..." />
    </main>
  );
}
