'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react';
import { useRouter } from 'next/navigation';
import { api, ApiError } from '../api';
import { User, AuthResponse, AuthStatus, LogoutResponse } from './types';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------
interface AuthContextType {
  /** Current 4-state auth status. Use this for deterministic routing. */
  authStatus: AuthStatus;
  /** Current authenticated user — null when not authenticated or bootstrapping. */
  user: User | null;
  /**
   * Derived boolean: true ONLY while the one-time initial bootstrap is in
   * progress ('initializing'). Never becomes true again after bootstrap
   * completes. Retained for backward-compatibility with pages that read
   * `useAuth().isLoading`.
   */
  isLoading: boolean;
  /**
   * Derived boolean: true when authStatus === 'authenticated'.
   * Retained for backward-compatibility with pages that read
   * `useAuth().isAuthenticated`.
   */
  isAuthenticated: boolean;
  /** Re-run the /auth/me bootstrap without navigating. Use on error state. */
  retryAuth: () => void;
  /**
   * Login with email/password. Throws ApiError on failure.
   * Does NOT modify the global authStatus 'initializing' state — the caller's
   * local isSubmitting state handles UI feedback.
   */
  login: (email: string, password: string) => Promise<void>;
  /**
   * Log out the current user. Clears local state and navigates to /login.
   * Does NOT modify the global authStatus 'initializing' state.
   */
  logout: () => Promise<void>;
  /** Refresh the current user profile (e.g. after a profile update). */
  refreshUser: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Bootstrap timeout
// ---------------------------------------------------------------------------
/** Maximum ms to wait for the initial /auth/me response before treating the
 *  backend as unavailable. 8 seconds gives a generous window for cold-starts
 *  without leaving the user stuck forever. */
const BOOTSTRAP_TIMEOUT_MS = 8_000;

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthStatus>('initializing');
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  /**
   * Guard against React Strict Mode double-invocation.
   * The ref is created once per component lifetime. When the bootstrap effect
   * fires a second time (Strict Mode), `bootstrapped.current` is already true
   * so the second invocation is a no-op.
   */
  const bootstrapped = useRef(false);

  // -------------------------------------------------------------------------
  // Core: run the /auth/me bootstrap
  // -------------------------------------------------------------------------
  const runBootstrap = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BOOTSTRAP_TIMEOUT_MS);

    try {
      const data = await api.get<AuthResponse>('/auth/me', {
        signal: controller.signal,
      });
      clearTimeout(timer);
      setUser(data.user);
      setAuthStatus('authenticated');
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof ApiError && err.statusCode === 401) {
        // Valid unauthenticated state — no active session.
        setUser(null);
        setAuthStatus('unauthenticated');
      } else {
        // Network error, timeout (AbortError becomes ApiError statusCode 0),
        // or unexpected server error. Signal the 'error' state so the UI
        // can show a clear message + Retry button.
        setUser(null);
        setAuthStatus('error');
      }
    }
  }, []);

  // -------------------------------------------------------------------------
  // Mount: one-time bootstrap
  // -------------------------------------------------------------------------
  useEffect(() => {
    // Idempotency guard — only run bootstrap once, even in React Strict Mode.
    if (bootstrapped.current) return;
    bootstrapped.current = true;

    runBootstrap();
    // runBootstrap is a stable useCallback — no risk of stale closures.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------------------------------------------------------
  // retryAuth: re-run bootstrap from 'error' state
  // -------------------------------------------------------------------------
  const retryAuth = useCallback(() => {
    // Move back to 'initializing' so the UI shows the loading spinner during
    // the retry attempt (instead of remaining on the error screen).
    setAuthStatus('initializing');
    // Allow runBootstrap to be called again.
    bootstrapped.current = false;
    runBootstrap().finally(() => {
      // Re-arm the guard after the retry so future navigations don't
      // accidentally re-trigger it.
      bootstrapped.current = true;
    });
  }, [runBootstrap]);

  // -------------------------------------------------------------------------
  // refreshUser: update user object after profile changes (no status reset)
  // -------------------------------------------------------------------------
  const refreshUser = useCallback(async () => {
    try {
      const data = await api.get<AuthResponse>('/auth/me');
      setUser(data.user);
      setAuthStatus('authenticated');
    } catch {
      // If /auth/me fails here, the session has expired; treat as unauthenticated.
      setUser(null);
      setAuthStatus('unauthenticated');
    }
  }, []);

  // -------------------------------------------------------------------------
  // login: email/password authentication
  // -------------------------------------------------------------------------
  const login = async (email: string, password: string): Promise<void> => {
    // IMPORTANT: Do NOT set authStatus to 'initializing' here. The caller
    // manages its own local isSubmitting state for UI feedback. The global
    // authStatus only transitions when the result is known.
    try {
      const data = await api.post<AuthResponse>('/auth/login', {
        email,
        password,
      });
      setUser(data.user);
      setAuthStatus('authenticated');
      router.push('/dashboard');
    } catch (err) {
      // Keep current user null; do not change authStatus (leave as unauthenticated
      // or error — whatever it was). Let the caller handle the error.
      setUser(null);
      throw err;
    }
  };

  // -------------------------------------------------------------------------
  // logout: clear session
  // -------------------------------------------------------------------------
  const logout = async (): Promise<void> => {
    // IMPORTANT: Do NOT set authStatus to 'initializing' here. The caller
    // manages its own local isLoggingOut state for UI feedback.
    try {
      await api.post<LogoutResponse>('/auth/logout');
    } catch {
      // Network error during logout — still clear local state.
    } finally {
      setUser(null);
      setAuthStatus('unauthenticated');
      router.push('/login');
    }
  };

  // -------------------------------------------------------------------------
  // Derived values (backward-compatibility)
  // -------------------------------------------------------------------------
  const isLoading = authStatus === 'initializing';
  const isAuthenticated = authStatus === 'authenticated';

  return (
    <AuthContext.Provider
      value={{
        authStatus,
        user,
        isLoading,
        isAuthenticated,
        retryAuth,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
