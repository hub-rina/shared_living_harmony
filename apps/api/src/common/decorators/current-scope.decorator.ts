import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { HouseholdScope } from '@homebuddy/shared';

export const CurrentScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): HouseholdScope => {
    const req = ctx.switchToHttp().getRequest<Request & { scope: HouseholdScope }>();
    return req.scope;
  },
);
