import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../../../common/enums';
import { ROLES_KEY } from '../decorators/roles.decorator';

/**
 * RolesGuard — enforces role-based access control based on @Roles() decorator.
 *
 * If no roles are required on the route handler or class, access is granted.
 * If roles are specified, the authenticated user must possess one of the required roles.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // If no specific roles required on handler or class, permit access
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user || !user.role) {
      throw new ForbiddenException('Forbidden resource: User has no assigned role');
    }

    const hasRole = requiredRoles.includes(user.role);
    if (!hasRole) {
      throw new ForbiddenException('Forbidden resource: Insufficient permissions');
    }

    return true;
  }
}
