import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { RitualCadence, RitualStatus } from '@prisma/client';
import {
  ritualCadenceOffsetMs,
  ritualPolicy,
  shouldBloom,
  type CreateRitualInput,
  type HouseholdScope,
} from '@homebuddy/shared';
import { HarmonyService } from '../harmony/harmony.service';
import { PrismaService } from '../prisma/prisma.service';

const ritualInclude = {
  participants: { select: { user: { select: { id: true, name: true } } } },
} as const;

function formatRitual(raw: {
  id: string;
  householdId: string;
  type: string;
  title: string;
  proposedAt: Date;
  status: string;
  cadence: string;
  proposerId: string;
  completedAt: Date | null;
  createdAt: Date;
  participants: { user: { id: string; name: string } }[];
}) {
  return {
    ...raw,
    proposedAt: raw.proposedAt.toISOString(),
    completedAt: raw.completedAt?.toISOString() ?? null,
    createdAt: raw.createdAt.toISOString(),
    participants: raw.participants.map((p) => p.user),
  };
}

@Injectable()
export class RitualsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly harmony: HarmonyService,
  ) {}

  async create(scope: HouseholdScope, input: CreateRitualInput) {
    const ritual = await this.prisma.ritual.create({
      data: {
        householdId: scope.householdId,
        type: input.type,
        title: input.title,
        proposedAt: new Date(input.proposedAt),
        cadence: (input.cadence ?? 'once') as RitualCadence,
        proposerId: scope.userId,
        participants: { create: { userId: scope.userId } },
      },
      include: ritualInclude,
    });

    return formatRitual(ritual);
  }

  async listForHousehold(scope: HouseholdScope) {
    const rituals = await this.prisma.ritual.findMany({
      where: { householdId: scope.householdId },
      orderBy: [{ status: 'asc' }, { proposedAt: 'asc' }],
      include: ritualInclude,
    });
    return rituals.map(formatRitual);
  }

  async join(scope: HouseholdScope, ritualId: string) {
    const ritual = await this.findActiveInHousehold(ritualId, scope.householdId);
    if (!ritualPolicy.canJoin(scope, { proposerId: ritual.proposerId })) {
      throw new ForbiddenException();
    }

    const alreadyJoined = await this.prisma.ritualParticipant.findUnique({
      where: { ritualId_userId: { ritualId, userId: scope.userId } },
    });

    if (alreadyJoined) {
      await this.prisma.ritualParticipant.delete({
        where: { ritualId_userId: { ritualId, userId: scope.userId } },
      });
    } else {
      await this.prisma.ritualParticipant.create({
        data: { ritualId, userId: scope.userId },
      });
    }

    const updated = await this.prisma.ritual.findUniqueOrThrow({
      where: { id: ritualId },
      include: ritualInclude,
    });

    return formatRitual(updated);
  }

  async complete(scope: HouseholdScope, ritualId: string) {
    const ritual = await this.findActiveInHousehold(ritualId, scope.householdId);
    if (!ritualPolicy.canComplete(scope, { proposerId: ritual.proposerId })) {
      throw new ForbiddenException();
    }

    const memberCount = await this.prisma.householdMember.count({
      where: { householdId: ritual.householdId, status: 'active' },
    });
    const participantCount = ritual.participants.length;
    const bloom = shouldBloom(participantCount, memberCount);

    const harmonyBonus = await this.harmony.applyRitualCompletion(
      ritual.householdId,
      participantCount,
      memberCount,
    );

    const updated = await this.prisma.ritual.update({
      where: { id: ritualId },
      data: { status: RitualStatus.completed, completedAt: new Date() },
      include: ritualInclude,
    });

    if (ritual.cadence !== RitualCadence.once) {
      const offset = ritualCadenceOffsetMs(ritual.cadence as 'daily' | 'weekly');
      await this.prisma.ritual.create({
        data: {
          householdId: ritual.householdId,
          type: ritual.type,
          title: ritual.title,
          proposedAt: new Date(ritual.proposedAt.getTime() + offset),
          cadence: ritual.cadence,
          proposerId: ritual.proposerId,
          participants: { create: { userId: ritual.proposerId } },
        },
      });
    }

    return { ritual: formatRitual(updated), bloomTriggered: bloom, harmonyBonus };
  }

  async remove(scope: HouseholdScope, ritualId: string) {
    const ritual = await this.findInHousehold(ritualId, scope.householdId);
    if (!ritualPolicy.canDelete(scope, { proposerId: ritual.proposerId })) {
      throw new ForbiddenException();
    }
    await this.prisma.ritual.delete({ where: { id: ritualId } });
  }

  private async findInHousehold(ritualId: string, householdId: string) {
    const ritual = await this.prisma.ritual.findFirst({
      where: { id: ritualId, householdId },
      select: { id: true, proposerId: true, status: true, householdId: true },
    });
    if (!ritual) throw new NotFoundException();
    return ritual;
  }

  private async findActiveInHousehold(ritualId: string, householdId: string) {
    const ritual = await this.prisma.ritual.findFirst({
      where: { id: ritualId, householdId },
      include: ritualInclude,
    });
    if (!ritual) throw new NotFoundException();
    if (ritual.status === RitualStatus.completed) {
      throw new BadRequestException('Ritual already completed');
    }
    return ritual;
  }
}
