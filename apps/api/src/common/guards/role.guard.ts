import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { HouseholdRole, HouseholdScope } from '@homebuddy/shared';
import { REQUIRED_ROLES_KEY } from '../decorators/require-role.decorator';

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<HouseholdRole[] | undefined>(
      REQUIRED_ROLES_KEY,
      [ctx.getHandler(), ctx.getClass()],
    );
    if (!required || required.length === 0) return true;

    const req = ctx.switchToHttp().getRequest<Request & { scope?: HouseholdScope }>();
    const scope = req.scope;
    if (!scope?.membership || scope.membership.status !== 'active') {
      throw new ForbiddenException();
    }
    return required.includes(scope.membership.role);
  }
}
