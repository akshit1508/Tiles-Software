import { ApiError, ApiErrorPayload } from './errors';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface RequestOptions extends Omit<RequestInit, 'method' | 'body'> {
  method?: HttpMethod;
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined | null>;
  timeout?: number;
}

/**
 * Returns the configured base API URL from process.env.
 * Defaults to http://localhost:3001 if not set.
 */
export function getApiBaseUrl(): string {
  const url = process.env.NEXT_PUBLIC_API_URL;
  if (!url) {
    // In development or when unset, fallback to default API port
    return 'http://localhost:3001';
  }
  // Trim any trailing slash for consistency
  return url.replace(/\/+$/, '');
}

/**
 * Generic API client for communicating with the NestJS backend.
 *
 * Rules:
 * - Always includes `credentials: 'include'` to exchange HttpOnly authentication cookies.
 * - Parses and raises strongly-typed `ApiError`.
 * - Formats query parameters cleanly.
 * - Handles JSON serialization and parsing.
 * - No business logic or token storage in client memory/localStorage.
 */
export async function apiClient<T>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Build query string if params provided
  let url = `${baseUrl}${normalizedEndpoint}`;
  if (options.params) {
    const searchParams = new URLSearchParams();
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.append(key, String(value));
      }
    }
    const queryString = searchParams.toString();
    if (queryString) {
      url += `?${queryString}`;
    }
  }

  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(options.headers as Record<string, string>),
  };

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (options.body instanceof FormData) {
      body = options.body;
    } else {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(options.body);
    }
  }

  const timeoutMs = options.timeout ?? 5000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      method: options.method || 'GET',
      headers,
      body,
      // IMPORTANT: credentials: 'include' ensures HttpOnly cookies are attached across origins
      credentials: 'include',
      signal: options.signal || controller.signal,
    });
    clearTimeout(timer);

    // Handle 204 No Content
    if (response.status === 204) {
      return {} as T;
    }

    const isJson = response.headers
      .get('content-type')
      ?.includes('application/json');
    const data = isJson ? await response.json() : await response.text();

    if (!response.ok) {
      const errorPayload: Partial<ApiErrorPayload> =
        typeof data === 'object' && data !== null ? data : { message: String(data) };

      throw new ApiError({
        statusCode: response.status,
        message: errorPayload.message || response.statusText,
        path: errorPayload.path || normalizedEndpoint,
        timestamp: errorPayload.timestamp,
        errors: errorPayload.errors,
      });
    }

    return data as T;
  } catch (error) {
    clearTimeout(timer);
    if (error instanceof ApiError) {
      throw error;
    }

    // Network error or unexpected exception (e.g., API unavailable)
    throw new ApiError({
      statusCode: 0,
      message:
        error instanceof Error
          ? error.name === 'AbortError'
            ? 'Request timed out. The server took too long to respond.'
            : error.message
          : 'Unable to connect to the server. Please check your internet connection or try again later.',
    });
  }
}

/** Convenience HTTP method helpers */
export const api = {
  get: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'GET' }),

  post: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'POST', body }),

  put: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'PUT', body }),

  patch: <T>(endpoint: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'PATCH', body }),

  delete: <T>(endpoint: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    apiClient<T>(endpoint, { ...options, method: 'DELETE' }),
};
