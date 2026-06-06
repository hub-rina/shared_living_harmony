import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type HouseholdRole } from '@prisma/client';
import {
  generateJoinCode,
  householdPolicy,
  membershipPolicy,
  normalizeJoinCode,
  validateInactiveWindow,
  type CreateHouseholdInput,
  type HouseholdScope,
  type JoinHouseholdInput,
  type SetInactiveInput,
  type UpdateLandlordLinkInput,
} from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SmartRotationService } from '../tasks/smart-rotation.service';

const memberInclude = {
  user: { select: { id: true, name: true, email: true } },
} as const;

@Injectable()
export class HouseholdsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly rotation: SmartRotationService,
  ) {}

  listForUser(userId: string) {
    return this.prisma.household.findMany({
      where: { members: { some: { userId } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(userId: string, input: CreateHouseholdInput) {
    return this.prisma.household.create({
      data: {
        name: input.name,
        joinCode: await this.uniqueJoinCode(),
        members: { create: { userId, role: 'admin' } },
      },
    });
  }

  private async uniqueJoinCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateJoinCode();
      const clash = await this.prisma.household.findUnique({
        where: { joinCode: code },
        select: { id: true },
      });
      if (!clash) return code;
    }
    throw new InternalServerErrorException('Could not generate a unique join code');
  }

  async joinByCode(userId: string, input: JoinHouseholdInput) {
    const code = normalizeJoinCode(input.code);
    const household = await this.prisma.household.findUnique({ where: { joinCode: code } });
    if (!household) {
      throw new NotFoundException("That code didn't match a house. Check it and try again.");
    }

    const existing = await this.prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId: household.id } },
      select: { id: true, status: true },
    });

    if (existing?.status === 'active') return household;

    if (existing) {
      await this.prisma.householdMember.update({
        where: { id: existing.id },
        data: { status: 'active', inactiveFrom: null, inactiveUntil: null, inactiveReason: null },
      });
      return household;
    }

    await this.prisma.householdMember.create({
      data: { userId, householdId: household.id, role: 'member', status: 'active' },
    });
    return household;
  }

  async regenerateJoinCode(scope: HouseholdScope) {
    if (!householdPolicy.canRegenerateJoinCode(scope)) throw new ForbiddenException();
    const joinCode = await this.uniqueJoinCode();
    return this.prisma.household.update({
      where: { id: scope.householdId },
      data: { joinCode },
      select: { joinCode: true },
    });
  }

  async getForScope(scope: HouseholdScope) {
    return this.prisma.household.findUniqueOrThrow({
      where: { id: scope.householdId },
      include: {
        members: {
          include: memberInclude,
          orderBy: { joinedAt: 'asc' },
        },
        landlords: {
          include: { landlord: { select: { id: true, name: true, email: true } } },
        },
      },
    });
  }

  getScopeView(scope: HouseholdScope) {
    return { scope };
  }

  async updateSettings(scope: HouseholdScope, input: { name?: string }) {
    if (!householdPolicy.canEditSettings(scope)) throw new ForbiddenException();
    return this.prisma.household.update({
      where: { id: scope.householdId },
      data: { ...(input.name ? { name: input.name } : {}) },
    });
  }

  async remove(scope: HouseholdScope) {
    if (!householdPolicy.canDelete(scope)) throw new ForbiddenException();
    await this.prisma.household.delete({ where: { id: scope.householdId } });
  }

  async invite(scope: HouseholdScope, input: { email: string }) {
    if (!householdPolicy.canInvite(scope)) throw new ForbiddenException();

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true, name: true, email: true },
    });
    if (!user) throw new NotFoundException('No user with that email');

    const existing = await this.prisma.householdMember.findUnique({
      where: { userId_householdId: { userId: user.id, householdId: scope.householdId } },
      select: { id: true },
    });
    if (existing) throw new ConflictException('Already a member');

    const isLandlord = await this.prisma.landlordProperty.findUnique({
      where: { landlordId_householdId: { landlordId: user.id, householdId: scope.householdId } },
      select: { id: true },
    });
    if (isLandlord) throw new ConflictException('This user is already the landlord of this house');

    // Invited, not active: they count toward the household roster (so the
    // participation warning can flag them) but are excluded from rotation,
    // harmony, and admin counts until they activate by entering the join code.
    return this.prisma.householdMember.create({
      data: { userId: user.id, householdId: scope.householdId, role: 'member', status: 'invited' },
      include: memberInclude,
    });
  }

  async removeMember(scope: HouseholdScope, memberId: string) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.householdMember.findFirst({
        where: { id: memberId, householdId: scope.householdId },
        select: { id: true, role: true, status: true },
      });
      if (!target) throw new NotFoundException();

      const activeAdminCount = await tx.householdMember.count({
        where: { householdId: scope.householdId, role: 'admin', status: 'active' },
      });
      if (!householdPolicy.canRemoveMember(scope, target, activeAdminCount)) {
        throw new ForbiddenException();
      }

      await tx.householdMember.delete({ where: { id: memberId } });
    });
  }

  async changeMemberRole(scope: HouseholdScope, memberId: string, newRole: HouseholdRole) {
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.householdMember.findFirst({
        where: { id: memberId, householdId: scope.householdId },
        select: { id: true, role: true, status: true },
      });
      if (!target) throw new NotFoundException();

      if (target.role === newRole) {
        throw new BadRequestException('Member already has that role');
      }

      const activeAdminCount = await tx.householdMember.count({
        where: { householdId: scope.householdId, role: 'admin', status: 'active' },
      });

      const allowed =
        newRole === 'admin'
          ? householdPolicy.canPromote(scope, target)
          : householdPolicy.canDemote(scope, target, activeAdminCount);
      if (!allowed) throw new ForbiddenException();

      return tx.householdMember.update({
        where: { id: memberId },
        data: { role: newRole },
      });
    });
  }

  async linkLandlord(scope: HouseholdScope, input: { email: string }) {
    if (!householdPolicy.canManageLandlordLink(scope)) throw new ForbiddenException();

    const user = await this.prisma.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('No user with that email');

    const isMember = await this.prisma.householdMember.findUnique({
      where: { userId_householdId: { userId: user.id, householdId: scope.householdId } },
      select: { id: true },
    });
    if (isMember) throw new ConflictException('Cannot link a member as a landlord');

    return this.prisma.landlordProperty.upsert({
      where: { landlordId_householdId: { landlordId: user.id, householdId: scope.householdId } },
      update: {},
      create: { landlordId: user.id, householdId: scope.householdId },
    });
  }

  async updateLandlordLink(
    scope: HouseholdScope,
    landlordUserId: string,
    input: UpdateLandlordLinkInput,
  ) {
    if (!householdPolicy.canManageLandlordLink(scope)) throw new ForbiddenException();

    return this.prisma.landlordProperty
      .update({
        where: {
          landlordId_householdId: { landlordId: landlordUserId, householdId: scope.householdId },
        },
        data: {
          ...(input.mode !== undefined ? { mode: input.mode } : {}),
          ...(input.consentGranted !== undefined ? { consentGranted: input.consentGranted } : {}),
        },
      })
      .catch((e: { code?: string }) => {
        if (e?.code === 'P2025') throw new NotFoundException();
        throw e;
      });
  }

  async unlinkLandlord(scope: HouseholdScope, landlordUserId: string) {
    if (!householdPolicy.canManageLandlordLink(scope)) throw new ForbiddenException();

    await this.prisma.landlordProperty
      .delete({
        where: { landlordId_householdId: { landlordId: landlordUserId, householdId: scope.householdId } },
      })
      .catch((e: { code?: string }) => {
        if (e?.code === 'P2025') throw new NotFoundException();
        throw e;
      });
  }

  async setSelfInactive(scope: HouseholdScope, input: SetInactiveInput) {
    const from = new Date(input.from);
    const until = new Date(input.until);

    const validation = validateInactiveWindow({ from, until }, new Date());
    if (!validation.ok) {
      throw new BadRequestException(`Invalid inactive window: ${validation.code}`);
    }
    if (!scope.membership) throw new ForbiddenException();

    return this.prisma.$transaction(async (tx) => {
      const activeAdminCount = await tx.householdMember.count({
        where: { householdId: scope.householdId, role: 'admin', status: 'active' },
      });
      if (!membershipPolicy.canSetSelfInactive(scope, activeAdminCount)) {
        throw new ForbiddenException();
      }

      const updated = await tx.householdMember.update({
        where: { id: scope.membership!.id },
        data: {
          status: 'inactive',
          inactiveFrom: from,
          inactiveUntil: until,
          inactiveReason: input.reason ?? null,
        },
      });

      await tx.membershipStatusLog.create({
        data: {
          membershipId: scope.membership!.id,
          changedById: scope.userId,
          fromStatus: 'active',
          toStatus: 'inactive',
          from,
          until,
          reason: input.reason ?? null,
        },
      });

      await this.reassignTasksOnInactivation(
        tx,
        scope.householdId,
        scope.userId,
        input.reason ?? null,
        until,
      );

      return updated;
    });
  }

  async endOwnInactive(scope: HouseholdScope) {
    if (!membershipPolicy.canEndOwnInactive(scope)) throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.householdMember.findUniqueOrThrow({
        where: { id: scope.membership!.id },
      });
      const updated = await tx.householdMember.update({
        where: { id: scope.membership!.id },
        data: {
          status: 'active',
          inactiveFrom: null,
          inactiveUntil: null,
          inactiveReason: null,
        },
      });
      await tx.membershipStatusLog.create({
        data: {
          membershipId: scope.membership!.id,
          changedById: scope.userId,
          fromStatus: 'inactive',
          toStatus: 'active',
          from: current.inactiveFrom,
          until: current.inactiveUntil,
          reason: 'self-end',
        },
      });
      return updated;
    });
  }

  async forceEndOther(scope: HouseholdScope, memberId: string) {
    if (!membershipPolicy.canForceEndOther(scope)) throw new ForbiddenException();
    return this.prisma.$transaction(async (tx) => {
      const target = await tx.householdMember.findFirst({
        where: { id: memberId, householdId: scope.householdId },
      });
      if (!target) throw new NotFoundException();
      if (target.status !== 'inactive') {
        throw new BadRequestException('Member is not inactive');
      }
      const updated = await tx.householdMember.update({
        where: { id: target.id },
        data: {
          status: 'active',
          inactiveFrom: null,
          inactiveUntil: null,
          inactiveReason: null,
        },
      });
      await tx.membershipStatusLog.create({
        data: {
          membershipId: target.id,
          changedById: scope.userId,
          fromStatus: 'inactive',
          toStatus: 'active',
          from: target.inactiveFrom,
          until: target.inactiveUntil,
          reason: 'admin-end',
        },
      });
      return updated;
    });
  }

  private async reassignTasksOnInactivation(
    tx: Prisma.TransactionClient,
    householdId: string,
    leavingUserId: string,
    reason: string | null,
    until: Date,
  ) {
    const tasks = await tx.task.findMany({
      where: { householdId, assigneeId: leavingUserId, status: { in: ['pending', 'overdue'] } },
    });
    if (tasks.length === 0) return;

    const leaving = await tx.user.findUniqueOrThrow({
      where: { id: leavingUserId },
      select: { name: true },
    });
    const untilLabel = until.toISOString().slice(0, 10);

    for (const t of tasks) {
      const decision = await this.rotation.pickAssignee(
        householdId,
        t.title,
        t.weight,
        { excludeUserId: leavingUserId },
      );
      await tx.task.update({
        where: { id: t.id },
        data: {
          assigneeId: decision.userId,
          rotationReason: `Reassigned: ${leaving.name} is away until ${untilLabel}${reason ? ` (${reason})` : ''}`,
        },
      });
    }
  }
}
