/**
 * Standard API error response format returned by the NestJS HttpExceptionFilter.
 */
export interface ApiErrorPayload {
  statusCode: number;
  timestamp: string;
  path: string;
  message: string | string[];
  errors?: Record<string, string[]> | string[];
}

/**
 * Custom Error class representing a backend API error.
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly timestamp?: string;
  public readonly path?: string;
  public readonly validationErrors?: Record<string, string[]> | string[];

  constructor(payload: {
    statusCode: number;
    message?: string | string[];
    timestamp?: string;
    path?: string;
    errors?: Record<string, string[]> | string[];
  }) {
    const formattedMessage = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || 'An unexpected error occurred';

    super(formattedMessage);
    this.name = 'ApiError';
    this.statusCode = payload.statusCode;
    this.timestamp = payload.timestamp;
    this.path = payload.path;
    this.validationErrors = payload.errors;

    // Restore prototype chain
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  /**
   * Helper to determine if the error is an unauthenticated 401.
   */
  get isUnauthorized(): boolean {
    return this.statusCode === 401;
  }

  /**
   * Helper to determine if the error is a forbidden 403.
   */
  get isForbidden(): boolean {
    return this.statusCode === 403;
  }

  /**
   * Helper to determine if the error is a not found 404.
   */
  get isNotFound(): boolean {
    return this.statusCode === 404;
  }

  /**
   * Helper to determine if the error is a validation error 400.
   */
  get isValidationError(): boolean {
    return this.statusCode === 400;
  }
}
