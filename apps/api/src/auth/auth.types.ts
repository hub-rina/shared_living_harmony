import type { SystemRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  email: string;
  systemRole: SystemRole;
}

export interface AuthUser {
  id: string;
  email: string;
  systemRole: SystemRole;
}
