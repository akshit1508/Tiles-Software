import { SetMetadata, CustomDecorator } from '@nestjs/common';
import { UserRole } from '../../../common/enums';

export const ROLES_KEY = 'roles';

/**
 * Roles decorator to specify which roles are allowed to access a route.
 * Example: @Roles(UserRole.OWNER)
 */
export const Roles = (...roles: UserRole[]): CustomDecorator<string> =>
  SetMetadata(ROLES_KEY, roles);
