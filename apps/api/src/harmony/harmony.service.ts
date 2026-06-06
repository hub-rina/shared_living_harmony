import { Injectable } from '@nestjs/common';
import { computeRitualBonus, shouldBloom } from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';

const HARMONY_MIN = 0;
const HARMONY_MAX = 100;
const HARMONY_ON_TIME_BONUS = 5;
const HARMONY_OVERDUE_PENALTY = 10;

@Injectable()
export class HarmonyService {
  constructor(private readonly prisma: PrismaService) {}

  async applyOnTimeCompletion(householdId: string): Promise<void> {
    await this.shift(householdId, HARMONY_ON_TIME_BONUS);
  }

  async applyOverduePenalty(householdId: string, taskIds: string[]): Promise<void> {
    if (taskIds.length === 0) return;
    const penalizable = await this.prisma.task.count({
      where: {
        id: { in: taskIds },
        assignee: {
          memberships: {
            some: { householdId, status: 'active' },
          },
        },
      },
    });
    if (penalizable === 0) return;
    await this.shift(householdId, -(HARMONY_OVERDUE_PENALTY * penalizable));
  }

  async applyRitualCompletion(
    householdId: string,
    participantCount: number,
    memberCount: number,
  ): Promise<number> {
    const bonus = computeRitualBonus(participantCount, memberCount);
    if (bonus > 0) await this.shift(householdId, bonus);
    if (shouldBloom(participantCount, memberCount)) {
      await this.prisma.household.update({
        where: { id: householdId },
        data: { lastBloomedAt: new Date() },
      });
    }
    return bonus;
  }

  private async shift(householdId: string, delta: number): Promise<void> {
    const { harmonyScore } = await this.prisma.household.findUniqueOrThrow({
      where: { id: householdId },
      select: { harmonyScore: true },
    });
    const next = Math.min(HARMONY_MAX, Math.max(HARMONY_MIN, harmonyScore + delta));
    await this.prisma.household.update({
      where: { id: householdId },
      data: { harmonyScore: next },
    });
  }
}
