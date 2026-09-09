import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Request } from 'express';
import { User, UserDocument } from '../../users/schemas/user.schema';
import { JwtPayload, AuthenticatedUser } from '../interfaces/auth.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {
    const authSecret = configService.get<string>('AUTH_SECRET');
    if (!authSecret) {
      throw new Error('AUTH_SECRET must be defined in environment configuration');
    }

    super({
      jwtFromRequest: ExtractJwt.fromExtractors([
        // 1. Extract from HttpOnly cookie 'token'
        (req: Request) => {
          if (req && req.cookies) {
            return req.cookies['token'] || null;
          }
          return null;
        },
        // 2. Fallback to standard Bearer Authorization header
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: authSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<AuthenticatedUser> {
    const user = await this.userModel.findById(payload.sub).exec();

    if (!user) {
      throw new UnauthorizedException('User account no longer exists');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is deactivated');
    }

    return {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      createdAt: (user as unknown as { createdAt?: Date }).createdAt,
      updatedAt: (user as unknown as { updatedAt?: Date }).updatedAt,
    };
  }
}
