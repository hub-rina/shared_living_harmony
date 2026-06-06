import { SetMetadata } from '@nestjs/common';
import type { HouseholdRole } from '@homebuddy/shared';

export const REQUIRED_ROLES_KEY = 'requiredRoles';

export const RequireRole = (...roles: HouseholdRole[]) =>
  SetMetadata(REQUIRED_ROLES_KEY, roles);
