import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { HouseholdScope, MembershipStatus } from '@homebuddy/shared';
import { PrismaService } from '../../prisma/prisma.service';
import type { AuthUser } from '../../auth/auth.types';

type MembershipRow = {
  id: string;
  role: 'admin' | 'member';
  status: MembershipStatus;
  inactiveUntil: Date | null;
};

@Injectable()
export class HouseholdScopeGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request & { user: AuthUser; scope?: HouseholdScope }>();
    const householdId = this.extractHouseholdId(req);
    if (!householdId) throw new BadRequestException('missing householdId');

    const userId = req.user.id;
    const [membershipRaw, landlordRaw, userRow] = await Promise.all([
      this.prisma.householdMember.findUnique({
        where: { userId_householdId: { userId, householdId } },
        select: { id: true, role: true, status: true, inactiveUntil: true },
      }),
      this.prisma.landlordProperty.findUnique({
        where: { landlordId_householdId: { landlordId: userId, householdId } },
        select: { id: true },
      }),
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { systemRole: true },
      }),
    ]);

    const membership = membershipRaw
      ? this.applyLazyResume(membershipRaw, householdId)
      : undefined;
    const landlord = landlordRaw ? { propertyId: landlordRaw.id } : undefined;

    if (!membership && !landlord && userRow.systemRole !== 'support') {
      throw new NotFoundException();
    }

    req.scope = {
      householdId,
      userId,
      systemRole: userRow.systemRole,
      membership: membership
        ? { id: membership.id, role: membership.role, status: membership.status }
        : undefined,
      landlord,
    };
    return true;
  }

  private extractHouseholdId(req: Request): string | undefined {
    const fromParams = (req.params as Record<string, string | undefined>).householdId;
    if (fromParams) return fromParams;
    const body = req.body as { householdId?: string } | undefined;
    return body?.householdId;
  }

  private applyLazyResume(
    row: MembershipRow,
    householdId: string,
  ): MembershipRow {
    if (row.status !== 'inactive') return row;
    if (!row.inactiveUntil || row.inactiveUntil > new Date()) return row;
    void this.prisma.householdMember
      .update({
        where: { id: row.id },
        data: {
          status: 'active',
          inactiveFrom: null,
          inactiveUntil: null,
          inactiveReason: null,
        },
      })
      .catch(() => undefined);
    return { ...row, status: 'active' };
  }
}
