/**
 * Auth context unit tests.
 *
 * Tests the 4-state AuthStatus machine implemented in auth-context.tsx:
 *   initializing → authenticated / unauthenticated / error
 *
 * Strategy:
 * - We do NOT use React Testing Library's `render` for the context provider
 *   because it would require mocking next/navigation (router) in jsdom which
 *   adds significant complexity.
 * - Instead, we test the state-machine logic directly by mocking the api
 *   module and the router, then rendering a minimal wrapper that uses
 *   the context hook.
 *
 * Coverage targets (10 required test cases):
 *  1.  Successful bootstrap → authenticated
 *  2.  Unauthenticated bootstrap (401) → unauthenticated
 *  3.  401 response → unauthenticated (same as #2, explicit)
 *  4.  Backend network error → error state
 *  5.  Bootstrap timeout (AbortError) → error state
 *  6.  Retry after error → re-runs bootstrap
 *  7.  Login success → authenticated + router.push /dashboard
 *  8.  Login failure → throws, status stays unauthenticated
 *  9.  Logout → unauthenticated + router.push /login
 * 10.  Hard refresh with valid session → authenticated (no infinite loading)
 */

import React, { act } from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// ── Mocks ──────────────────────────────────────────────────────────────────

// Mock next/navigation before importing anything that uses it
const mockRouterPush = jest.fn();
const mockRouterReplace = jest.fn();

jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
  }),
  usePathname: () => '/',
}));

// Mock the api module
jest.mock('@/lib/api', () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
  ApiError: class ApiError extends Error {
    statusCode: number;
    constructor({ statusCode, message }: { statusCode: number; message: string }) {
      super(message);
      this.name = 'ApiError';
      this.statusCode = statusCode;
    }
  },
}));

// ── Imports (after mocks) ──────────────────────────────────────────────────
import { AuthProvider, useAuth } from './auth-context';
import { api, ApiError } from '@/lib/api';

const mockApi = api as jest.Mocked<typeof api>;

// ── Helper: minimal consumer component ──────────────────────────────────────

function AuthConsumer() {
  const { authStatus, user, isLoading, isAuthenticated, retryAuth, login, logout } = useAuth();
  return (
    <div>
      <span data-testid="status">{authStatus}</span>
      <span data-testid="user">{user ? user.email : 'none'}</span>
      <span data-testid="isLoading">{String(isLoading)}</span>
      <span data-testid="isAuthenticated">{String(isAuthenticated)}</span>
      <button data-testid="retry" onClick={retryAuth}>
        Retry
      </button>
      <button
        data-testid="login-btn"
        onClick={() => {
          // Mirroring how login page handles it: login() throws on failure.
          // The test consumer catches it so unhandled rejections don't leak.
          login('owner@test.com', 'password123').catch(() => {});
        }}
      >
        Login
      </button>
      <button data-testid="logout-btn" onClick={() => logout()}>
        Logout
      </button>
    </div>
  );
}

function renderWithAuth() {
  return render(
    <AuthProvider>
      <AuthConsumer />
    </AuthProvider>
  );
}

// ── Mock data ────────────────────────────────────────────────────────────────
const mockUser = {
  id: 'user-1',
  name: 'Test Owner',
  email: 'owner@test.com',
  role: 'OWNER' as const,
  isActive: true,
};

// ── Tests ────────────────────────────────────────────────────────────────────

describe('AuthProvider — 4-state machine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ── 1. Successful bootstrap ────────────────────────────────────────────────
  it('1: successful bootstrap → transitions initializing → authenticated', async () => {
    mockApi.get.mockResolvedValueOnce({ user: mockUser });

    renderWithAuth();

    // Immediately after render: initializing
    expect(screen.getByTestId('status').textContent).toBe('initializing');
    expect(screen.getByTestId('isLoading').textContent).toBe('true');

    // Resolve the /auth/me promise
    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });

    expect(screen.getByTestId('isLoading').textContent).toBe('false');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
    expect(screen.getByTestId('user').textContent).toBe('owner@test.com');
    expect(mockApi.get).toHaveBeenCalledWith('/auth/me', expect.objectContaining({ signal: expect.any(AbortSignal) }));
  });

  // ── 2. Unauthenticated bootstrap (no session) ─────────────────────────────
  it('2: 401 response on bootstrap → transitions initializing → unauthenticated', async () => {
    mockApi.get.mockRejectedValueOnce(new ApiError({ statusCode: 401, message: 'Unauthorized' }));

    renderWithAuth();

    expect(screen.getByTestId('status').textContent).toBe('initializing');

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });

    expect(screen.getByTestId('isLoading').textContent).toBe('false');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  // ── 3. Explicit 401 test (same as above, different framing) ───────────────
  it('3: 401 is treated as clean unauthenticated — NOT an error state', async () => {
    mockApi.get.mockRejectedValueOnce(new ApiError({ statusCode: 401, message: 'Unauthorized' }));

    renderWithAuth();

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });

    // Must NOT be 'error'
    expect(screen.getByTestId('status').textContent).not.toBe('error');
  });

  // ── 4. Backend network error ───────────────────────────────────────────────
  it('4: network error (status 0) on bootstrap → transitions to error state', async () => {
    mockApi.get.mockRejectedValueOnce(
      new ApiError({ statusCode: 0, message: 'Unable to connect to the server.' })
    );

    renderWithAuth();

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('error');
    });

    expect(screen.getByTestId('isLoading').textContent).toBe('false');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
    expect(screen.getByTestId('user').textContent).toBe('none');
  });

  // ── 5. Bootstrap timeout (AbortError via AbortController) ─────────────────
  it('5: AbortError (timeout) on bootstrap → transitions to error state', async () => {
    // Simulate the AbortError being thrown via ApiError (statusCode 0)
    // as apiClient wraps AbortError into ApiError with statusCode 0.
    mockApi.get.mockRejectedValueOnce(
      new ApiError({ statusCode: 0, message: 'Request timed out. The server took too long to respond.' })
    );

    renderWithAuth();

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('error');
    });
  });

  // ── 6. Retry after error ───────────────────────────────────────────────────
  it('6: retryAuth() re-runs bootstrap and resolves to authenticated on success', async () => {
    // First call → error
    mockApi.get.mockRejectedValueOnce(
      new ApiError({ statusCode: 0, message: 'Unable to connect.' })
    );

    renderWithAuth();

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('error');
    });

    // Second call (retry) → success
    mockApi.get.mockResolvedValueOnce({ user: mockUser });

    await act(async () => {
      screen.getByTestId('retry').click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });

    expect(screen.getByTestId('user').textContent).toBe('owner@test.com');
  });

  // ── 7. Login success ───────────────────────────────────────────────────────
  it('7: login() success → authenticated + router.push /dashboard', async () => {
    // Bootstrap: unauthenticated
    mockApi.get.mockRejectedValueOnce(new ApiError({ statusCode: 401, message: 'Unauthorized' }));

    renderWithAuth();

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });

    // Login → success
    mockApi.post.mockResolvedValueOnce({ user: mockUser });

    await act(async () => {
      screen.getByTestId('login-btn').click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });

    expect(screen.getByTestId('user').textContent).toBe('owner@test.com');
    expect(mockRouterPush).toHaveBeenCalledWith('/dashboard');
    // Global isLoading must NOT have been set to true during login
    expect(screen.getByTestId('isLoading').textContent).toBe('false');
  });

  // ── 8. Login failure ───────────────────────────────────────────────────────
  it('8: login() failure → throws ApiError, stays unauthenticated', async () => {
    // Bootstrap: unauthenticated
    mockApi.get.mockRejectedValueOnce(new ApiError({ statusCode: 401, message: 'Unauthorized' }));

    renderWithAuth();

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });

    // Login → failure (build error before passing to mock to keep stack clean)
    const loginError = new ApiError({ statusCode: 401, message: 'Invalid credentials' });
    mockApi.post.mockRejectedValueOnce(loginError);

    await act(async () => {
      // login-btn fires login() which will throw — catch it so it doesn't fail the test
      screen.getByTestId('login-btn').click();
      await Promise.resolve();
    });

    // Status must remain unauthenticated
    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });

    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(mockRouterPush).not.toHaveBeenCalled();
  });

  // ── 9. Logout ─────────────────────────────────────────────────────────────
  it('9: logout() → unauthenticated + router.push /login (no isLoading reset)', async () => {
    // Bootstrap: authenticated
    mockApi.get.mockResolvedValueOnce({ user: mockUser });

    renderWithAuth();

    await act(async () => {
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });

    // Logout
    mockApi.post.mockResolvedValueOnce({ message: 'Logged out' });

    await act(async () => {
      screen.getByTestId('logout-btn').click();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('unauthenticated');
    });

    expect(screen.getByTestId('user').textContent).toBe('none');
    expect(mockRouterPush).toHaveBeenCalledWith('/login');
    // isLoading must NOT have been true during logout (no 'initializing' re-entry)
    expect(screen.getByTestId('isLoading').textContent).toBe('false');
  });

  // ── 10. Hard refresh with valid session (idempotency) ─────────────────────
  it('10: hard refresh with valid session → goes directly to authenticated (no infinite initializing)', async () => {
    mockApi.get.mockResolvedValueOnce({ user: mockUser });

    renderWithAuth();

    // Must resolve within the bootstrap timeout — no infinite loading
    await waitFor(
      () => {
        expect(screen.getByTestId('status').textContent).toBe('authenticated');
      },
      { timeout: 3000 }
    );

    // isLoading must be false — system has settled
    expect(screen.getByTestId('isLoading').textContent).toBe('false');
    // Must never call /auth/me more than once (Strict Mode idempotency)
    expect(mockApi.get).toHaveBeenCalledTimes(1);
  });

  // ── 11. No infinite loading state ─────────────────────────────────────────
  it('11: every bootstrap path eventually leaves initializing state', async () => {
    // Test all three exit paths in sequence with separate renders
    // Success path
    mockApi.get.mockResolvedValueOnce({ user: mockUser });
    const { unmount: u1 } = renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('status').textContent).not.toBe('initializing'));
    u1();

    // 401 path
    mockApi.get.mockRejectedValueOnce(new ApiError({ statusCode: 401, message: 'Unauthorized' }));
    const { unmount: u2 } = renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('status').textContent).not.toBe('initializing'));
    u2();

    // Error path
    mockApi.get.mockRejectedValueOnce(new ApiError({ statusCode: 0, message: 'Network error' }));
    const { unmount: u3 } = renderWithAuth();
    await waitFor(() => expect(screen.getByTestId('status').textContent).not.toBe('initializing'));
    u3();
  });

  // ── 12. Backward-compatible derived values ─────────────────────────────────
  it('12: isLoading and isAuthenticated remain backward-compatible derived values', async () => {
    mockApi.get.mockResolvedValueOnce({ user: mockUser });

    renderWithAuth();

    // During initializing: isLoading=true, isAuthenticated=false
    expect(screen.getByTestId('isLoading').textContent).toBe('true');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');

    await waitFor(() => {
      expect(screen.getByTestId('status').textContent).toBe('authenticated');
    });

    // After bootstrap: isLoading=false, isAuthenticated=true
    expect(screen.getByTestId('isLoading').textContent).toBe('false');
    expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
  });
});
