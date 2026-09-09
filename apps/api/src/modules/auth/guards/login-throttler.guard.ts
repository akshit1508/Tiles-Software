import { Injectable, CanActivate, ExecutionContext, HttpException, HttpStatus } from '@nestjs/common';
import { Request } from 'express';

interface AttemptRecord {
  count: number;
  firstAttemptTime: number;
  blockedUntil?: number;
}

@Injectable()
export class LoginThrottlerGuard implements CanActivate {
  // Store attempts per IP in-memory
  // Window: 15 minutes (900,000 ms), Max attempts: 5, Block duration: 15 minutes
  private readonly attempts = new Map<string, AttemptRecord>();
  private readonly windowMs = 15 * 60 * 1000;
  private readonly maxAttempts = 5;
  private readonly blockDurationMs = 15 * 60 * 1000;

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const clientIp = this.getClientIp(request);
    const now = Date.now();

    const record = this.attempts.get(clientIp);

    if (record) {
      // Check if existing tracking window has expired; reset if so
      if (now - record.firstAttemptTime > this.windowMs) {
        this.attempts.delete(clientIp);
        return true;
      }

      // Check if client is currently in a blocked window or reached max attempts
      if ((record.blockedUntil && now < record.blockedUntil) || record.count >= this.maxAttempts) {
        if (!record.blockedUntil || now >= record.blockedUntil) {
          record.blockedUntil = now + this.blockDurationMs;
        }
        const retryAfterSeconds = Math.ceil((record.blockedUntil - now) / 1000);
        throw new HttpException(
          {
            statusCode: HttpStatus.TOO_MANY_REQUESTS,
            message: `Too many login attempts. Please try again in ${retryAfterSeconds} seconds.`,
            retryAfter: retryAfterSeconds,
          },
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    }

    return true;
  }

  /**
   * Called on unsuccessful login attempt to increment failure count.
   */
  recordFailedAttempt(clientIp: string): void {
    const now = Date.now();
    const record = this.attempts.get(clientIp);

    if (!record || now - record.firstAttemptTime > this.windowMs) {
      this.attempts.set(clientIp, {
        count: 1,
        firstAttemptTime: now,
      });
    } else {
      record.count += 1;
      if (record.count >= this.maxAttempts) {
        record.blockedUntil = now + this.blockDurationMs;
      }
    }
  }

  /**
   * Called on successful login to clear failed attempt count.
   */
  resetAttempts(clientIp: string): void {
    this.attempts.delete(clientIp);
  }

  /**
   * Helper to extract client IP safely.
   */
  getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (typeof forwarded === 'string') {
      return forwarded.split(',')[0].trim();
    }
    if (Array.isArray(forwarded) && forwarded.length > 0) {
      return forwarded[0].trim();
    }
    return request.ip || request.socket?.remoteAddress || 'unknown-ip';
  }
}
