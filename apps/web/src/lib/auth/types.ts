export interface User {
  id: string;
  name: string;
  email: string;
  role: 'OWNER';
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface AuthResponse {
  user: User;
}

export interface LogoutResponse {
  message: string;
}

/**
 * 4-state authentication status machine.
 *
 * - initializing   : First-load bootstrap is in progress (GET /auth/me pending).
 *                    This state is entered ONCE on app mount and never re-entered.
 * - authenticated  : /auth/me returned a valid user. HttpOnly cookie is present.
 * - unauthenticated: /auth/me returned 401, or user has explicitly logged out.
 * - error          : Backend is unreachable, timed out, or returned an unexpected
 *                    non-401 error. The user may retry the bootstrap.
 */
export type AuthStatus =
  | 'initializing'
  | 'authenticated'
  | 'unauthenticated'
  | 'error';
