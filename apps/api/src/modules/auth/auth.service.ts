import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { Response } from 'express';
import { User, UserDocument } from '../users/schemas/user.schema';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser, JwtPayload } from './interfaces/auth.interface';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Validates user credentials.
   * - Normalizes email
   * - Queries user with passwordHash explicitly selected (since select:false by default)
   * - Verifies password hash using bcrypt
   * - Rejects invalid credentials with a generic message
   * - Rejects inactive users
   * - Returns safe AuthenticatedUser (no passwordHash) and generated JWT token
   */
  async login(loginDto: LoginDto, res: Response): Promise<{ user: AuthenticatedUser }> {
    const normalizedEmail = loginDto.email.trim().toLowerCase();

    // Explicitly select passwordHash because the schema defaults to select: false
    const user = await this.userModel
      .findOne({ email: normalizedEmail })
      .select('+passwordHash')
      .exec();

    // Constant-time generic rejection: Do NOT reveal whether email exists or password is wrong
    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const isPasswordValid = await bcrypt.compare(loginDto.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid email or password');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is inactive. Please contact administrator.');
    }

    const payload: JwtPayload = {
      sub: user._id.toString(),
      email: user.email,
      role: user.role,
    };

    const token = this.jwtService.sign(payload);

    // Set secure HttpOnly cookie
    this.setAuthCookie(res, token);

    return {
      user: {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        createdAt: (user as unknown as { createdAt?: Date }).createdAt,
        updatedAt: (user as unknown as { updatedAt?: Date }).updatedAt,
      },
    };
  }

  /**
   * Logs out the user by clearing the HttpOnly cookie.
   */
  logout(res: Response): { message: string } {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';

    res.clearCookie('token', {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      path: '/',
    });

    return { message: 'Logged out successfully' };
  }

  /**
   * Helper to set the HttpOnly cookie with production-safe attributes
   */
  private setAuthCookie(res: Response, token: string): void {
    const isProduction = this.configService.get<string>('NODE_ENV') === 'production';
    const expiresInDays = 7; // Matches JWT_EXPIRES_IN=7d default
    const maxAgeMs = expiresInDays * 24 * 60 * 60 * 1000;

    res.cookie('token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'strict' : 'lax',
      maxAge: maxAgeMs,
      path: '/',
    });
  }
}
