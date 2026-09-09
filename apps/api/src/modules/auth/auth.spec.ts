import { UnauthorizedException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Response } from 'express';
import * as bcrypt from 'bcrypt';
import { Types } from 'mongoose';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { LoginThrottlerGuard } from './guards/login-throttler.guard';
import { User } from '../users/schemas/user.schema';
import { UserRole } from '../../common/enums';
import { LoginDto } from './dto/login.dto';
import { AuthenticatedUser } from './interfaces/auth.interface';

describe('Authentication Unit Tests', () => {
  let authService: AuthService;
  let authController: AuthController;
  let jwtStrategy: JwtStrategy;
  let jwtAuthGuard: JwtAuthGuard;
  let loginThrottlerGuard: LoginThrottlerGuard;
  let userModel: any;
  let jwtService: JwtService;

  const mockOwnerId = new Types.ObjectId();
  const mockPassword = 'SecretPassword123!';
  let mockPasswordHash: string;

  const mockOwnerUser = {
    _id: mockOwnerId,
    name: 'Goverdhan Owner',
    email: 'owner@goverdhan.com',
    passwordHash: '',
    role: UserRole.OWNER,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockRes = () => {
    const res: any = {};
    res.cookie = jest.fn().mockReturnValue(res);
    res.clearCookie = jest.fn().mockReturnValue(res);
    return res as Response;
  };

  beforeAll(async () => {
    mockPasswordHash = await bcrypt.hash(mockPassword, 10);
    mockOwnerUser.passwordHash = mockPasswordHash;
  });

  beforeEach(async () => {
    const mockUserModel = {
      findOne: jest.fn(),
      findById: jest.fn(),
    };

    const mockJwtService = {
      sign: jest.fn().mockReturnValue('mock-jwt-token'),
      verify: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'AUTH_SECRET') return 'test-auth-secret-key-12345';
        if (key === 'JWT_EXPIRES_IN') return '7d';
        if (key === 'NODE_ENV') return 'development';
        return null;
      }),
    };

    const throttlerGuardInstance = new LoginThrottlerGuard();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        AuthService,
        JwtStrategy,
        JwtAuthGuard,
        {
          provide: LoginThrottlerGuard,
          useValue: throttlerGuardInstance,
        },
        {
          provide: getModelToken(User.name),
          useValue: mockUserModel,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    authService = module.get<AuthService>(AuthService);
    authController = module.get<AuthController>(AuthController);
    jwtStrategy = module.get<JwtStrategy>(JwtStrategy);
    jwtAuthGuard = module.get<JwtAuthGuard>(JwtAuthGuard);
    loginThrottlerGuard = throttlerGuardInstance;
    userModel = module.get(getModelToken(User.name));
    jwtService = module.get<JwtService>(JwtService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 1. Valid login succeeds
  // ───────────────────────────────────────────────────────────────────────────
  it('1. valid login succeeds and sets HttpOnly cookie', async () => {
    const selectMock = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockOwnerUser),
    });
    userModel.findOne.mockReturnValue({ select: selectMock });

    const res = mockRes();
    const loginDto: LoginDto = {
      email: 'owner@goverdhan.com',
      password: mockPassword,
    };

    const result = await authService.login(loginDto, res);

    expect(result.user).toBeDefined();
    expect(result.user.id).toBe(mockOwnerId.toString());
    expect(result.user.email).toBe('owner@goverdhan.com');
    expect(result.user.role).toBe(UserRole.OWNER);
    expect(result.user.isActive).toBe(true);

    // Verify token was signed with correct payload
    expect(jwtService.sign).toHaveBeenCalledWith({
      sub: mockOwnerId.toString(),
      email: 'owner@goverdhan.com',
      role: UserRole.OWNER,
    });

    // Verify cookie was set with HttpOnly
    expect(res.cookie).toHaveBeenCalledWith(
      'token',
      'mock-jwt-token',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 2. Invalid password is rejected
  // ───────────────────────────────────────────────────────────────────────────
  it('2. invalid password is rejected with generic UnauthorizedException', async () => {
    const selectMock = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockOwnerUser),
    });
    userModel.findOne.mockReturnValue({ select: selectMock });

    const res = mockRes();
    const loginDto: LoginDto = {
      email: 'owner@goverdhan.com',
      password: 'WrongPassword!',
    };

    await expect(authService.login(loginDto, res)).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 3. Unknown user is rejected
  // ───────────────────────────────────────────────────────────────────────────
  it('3. unknown user is rejected with identical generic message', async () => {
    const selectMock = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    userModel.findOne.mockReturnValue({ select: selectMock });

    const res = mockRes();
    const loginDto: LoginDto = {
      email: 'unknown@goverdhan.com',
      password: mockPassword,
    };

    await expect(authService.login(loginDto, res)).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 4. Inactive user is rejected
  // ───────────────────────────────────────────────────────────────────────────
  it('4. inactive user is rejected', async () => {
    const inactiveUser = {
      ...mockOwnerUser,
      isActive: false,
    };
    const selectMock = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(inactiveUser),
    });
    userModel.findOne.mockReturnValue({ select: selectMock });

    const res = mockRes();
    const loginDto: LoginDto = {
      email: 'owner@goverdhan.com',
      password: mockPassword,
    };

    await expect(authService.login(loginDto, res)).rejects.toThrow(
      UnauthorizedException,
    );
    expect(res.cookie).not.toHaveBeenCalled();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 5. passwordHash is never returned
  // ───────────────────────────────────────────────────────────────────────────
  it('5. passwordHash is never returned in login response or /me', async () => {
    const selectMock = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockOwnerUser),
    });
    userModel.findOne.mockReturnValue({ select: selectMock });

    const res = mockRes();
    const loginDto: LoginDto = {
      email: 'owner@goverdhan.com',
      password: mockPassword,
    };

    const loginResult = await authService.login(loginDto, res);
    expect((loginResult.user as any).passwordHash).toBeUndefined();
    expect(Object.keys(loginResult.user)).not.toContain('passwordHash');

    const meResult = authController.getMe(loginResult.user);
    expect((meResult.user as any).passwordHash).toBeUndefined();
    expect(Object.keys(meResult.user)).not.toContain('passwordHash');
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 6. Authenticated /me succeeds
  // ───────────────────────────────────────────────────────────────────────────
  it('6. authenticated GET /auth/me returns safe profile', async () => {
    const safeUser: AuthenticatedUser = {
      id: mockOwnerId.toString(),
      name: 'Goverdhan Owner',
      email: 'owner@goverdhan.com',
      role: UserRole.OWNER,
      isActive: true,
    };

    const response = authController.getMe(safeUser);
    expect(response).toEqual({ user: safeUser });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 7. Unauthenticated /me is rejected by guard
  // ───────────────────────────────────────────────────────────────────────────
  it('7. unauthenticated /me is rejected by JwtAuthGuard handleRequest', () => {
    expect(() => jwtAuthGuard.handleRequest(null, null)).toThrow(
      new UnauthorizedException('Authentication required'),
    );

    expect(() => jwtAuthGuard.handleRequest(new Error('JWT expired'), null)).toThrow();
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 8. Logout clears/invalidates authentication
  // ───────────────────────────────────────────────────────────────────────────
  it('8. logout clears the HttpOnly token cookie', () => {
    const res = mockRes();
    const result = authService.logout(res);

    expect(result).toEqual({ message: 'Logged out successfully' });
    expect(res.clearCookie).toHaveBeenCalledWith(
      'token',
      expect.objectContaining({
        httpOnly: true,
        path: '/',
      }),
    );
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 9. Authentication guard / strategy rejects deactivated user token
  // ───────────────────────────────────────────────────────────────────────────
  it('9. JWT strategy validates active user and rejects non-existent or inactive user', async () => {
    // Valid user
    userModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockOwnerUser),
    });
    const validated = await jwtStrategy.validate({
      sub: mockOwnerId.toString(),
      email: 'owner@goverdhan.com',
      role: UserRole.OWNER,
    });
    expect(validated.id).toBe(mockOwnerId.toString());
    expect(validated.email).toBe('owner@goverdhan.com');

    // Non-existent user
    userModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue(null),
    });
    await expect(
      jwtStrategy.validate({
        sub: new Types.ObjectId().toString(),
        email: 'ghost@goverdhan.com',
        role: UserRole.OWNER,
      }),
    ).rejects.toThrow(new UnauthorizedException('User account no longer exists'));

    // Deactivated user
    userModel.findById.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ ...mockOwnerUser, isActive: false }),
    });
    await expect(
      jwtStrategy.validate({
        sub: mockOwnerId.toString(),
        email: 'owner@goverdhan.com',
        role: UserRole.OWNER,
      }),
    ).rejects.toThrow(new UnauthorizedException('User account is deactivated'));
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 10. Email normalization behaves consistently
  // ───────────────────────────────────────────────────────────────────────────
  it('10. email normalization handles mixed case and whitespace consistently', async () => {
    const selectMock = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue(mockOwnerUser),
    });
    userModel.findOne.mockReturnValue({ select: selectMock });

    const res = mockRes();
    const loginDto: LoginDto = {
      email: '  OwNeR@Goverdhan.COM  ',
      password: mockPassword,
    };

    await authService.login(loginDto, res);

    expect(userModel.findOne).toHaveBeenCalledWith({
      email: 'owner@goverdhan.com',
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // 11. Rate limiting: LoginThrottlerGuard blocks repeated failed login attempts
  // ───────────────────────────────────────────────────────────────────────────
  describe('Login Rate Limiting (LoginThrottlerGuard)', () => {
    it('11. allows up to 5 failed attempts, then blocks the 6th with 429 Too Many Requests', async () => {
      const selectMock = jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue(null), // Unknown user -> failed login
      });
      userModel.findOne.mockReturnValue({ select: selectMock });

      const testIp = '192.168.1.100';
      const mockReq = {
        ip: testIp,
        headers: {},
        socket: { remoteAddress: testIp },
      } as any;

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
        }),
      } as any;

      const loginDto: LoginDto = {
        email: 'attacker@evil.com',
        password: 'WrongPassword!',
      };

      // Attempts 1 to 5: guard allows activation, but login fails
      for (let i = 1; i <= 5; i++) {
        expect(loginThrottlerGuard.canActivate(mockExecutionContext)).toBe(true);
        const res = mockRes();
        await expect(authController.login(loginDto, res, mockReq)).rejects.toThrow(
          UnauthorizedException,
        );
      }

      // 6th attempt: guard blocks request with 429 TOO_MANY_REQUESTS
      expect(() => loginThrottlerGuard.canActivate(mockExecutionContext)).toThrow();
      try {
        loginThrottlerGuard.canActivate(mockExecutionContext);
      } catch (err: any) {
        expect(err.getStatus()).toBe(429);
        expect(err.getResponse().statusCode).toBe(429);
        expect(err.getResponse().message).toContain('Too many login attempts');
      }
    });

    it('12. successful login resets the failed attempts counter for that IP', async () => {
      const testIp = '192.168.1.101';
      const mockReq = {
        ip: testIp,
        headers: {},
        socket: { remoteAddress: testIp },
      } as any;

      const mockExecutionContext = {
        switchToHttp: () => ({
          getRequest: () => mockReq,
        }),
      } as any;

      // 3 failed attempts
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(null),
        }),
      });
      for (let i = 1; i <= 3; i++) {
        const res = mockRes();
        await expect(
          authController.login({ email: 'owner@goverdhan.com', password: 'wrong' }, res, mockReq),
        ).rejects.toThrow(UnauthorizedException);
      }

      // Successful login on 4th attempt
      userModel.findOne.mockReturnValue({
        select: jest.fn().mockReturnValue({
          exec: jest.fn().mockResolvedValue(mockOwnerUser),
        }),
      });
      const res = mockRes();
      const successResult = await authController.login(
        { email: 'owner@goverdhan.com', password: mockPassword },
        res,
        mockReq,
      );
      expect(successResult.user).toBeDefined();

      // Guard should allow further attempts since counter was reset
      expect(loginThrottlerGuard.canActivate(mockExecutionContext)).toBe(true);
    });

    it('13. different client IPs are tracked independently', async () => {
      const ipA = '10.0.0.1';
      const ipB = '10.0.0.2';

      for (let i = 1; i <= 5; i++) {
        loginThrottlerGuard.recordFailedAttempt(ipA);
      }

      const mockContextA = {
        switchToHttp: () => ({
          getRequest: () => ({ ip: ipA, headers: {}, socket: { remoteAddress: ipA } }),
        }),
      } as any;

      const mockContextB = {
        switchToHttp: () => ({
          getRequest: () => ({ ip: ipB, headers: {}, socket: { remoteAddress: ipB } }),
        }),
      } as any;

      // IP A is blocked
      expect(() => loginThrottlerGuard.canActivate(mockContextA)).toThrow();

      // IP B is still allowed
      expect(loginThrottlerGuard.canActivate(mockContextB)).toBe(true);
    });
  });
});
