import { Controller, Post, Get, Body, Res, Req, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { Response, Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './interfaces/auth.interface';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly loginThrottlerGuard: LoginThrottlerGuard,
  ) {}

  /**
   * POST /auth/login
   * Authenticates owner credentials, sets HttpOnly cookie, and returns safe user profile.
   * Rate-limited to prevent brute-force attacks via LoginThrottlerGuard.
   */
  @Post('login')
  @UseGuards(LoginThrottlerGuard)
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: LoginDto,
    @Res({ passthrough: true }) res: Response,
    @Req() req: Request,
  ): Promise<{ user: AuthenticatedUser }> {
    const clientIp = this.loginThrottlerGuard.getClientIp(req);
    try {
      const result = await this.authService.login(loginDto, res);
      // Reset rate limit attempts on successful login
      this.loginThrottlerGuard.resetAttempts(clientIp);
      return result;
    } catch (err) {
      // Record failed attempt for rate limiting
      this.loginThrottlerGuard.recordFailedAttempt(clientIp);
      throw err;
    }
  }

  /**
   * POST /auth/logout
   * Clears the authentication HttpOnly cookie.
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response): { message: string } {
    return this.authService.logout(res);
  }

  /**
   * GET /auth/me
   * Returns current authenticated user profile. Protected by JwtAuthGuard.
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser): { user: AuthenticatedUser } {
    return { user };
  }
}
