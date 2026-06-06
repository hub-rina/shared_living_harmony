import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

const DECAY_FLOOR = 50;
const DECAY_AMOUNT = 1;
const INACTIVITY_HOURS = 24;

@Injectable()
export class HarmonyDecayCron {
  private readonly logger = new Logger(HarmonyDecayCron.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron('0 15 1 * * *')
  async run(): Promise<void> {
    await this.sweep(new Date());
  }

  async sweep(now: Date): Promise<{ decayed: number }> {
    const cutoff = new Date(now.getTime() - INACTIVITY_HOURS * 60 * 60 * 1000);

    const candidates = await this.prisma.household.findMany({
      where: { harmonyScore: { gt: DECAY_FLOOR } },
      select: { id: true, harmonyScore: true },
    });

    if (candidates.length === 0) return { decayed: 0 };

    let decayed = 0;
    for (const h of candidates) {
      const recentTask = await this.prisma.task.findFirst({
        where: { householdId: h.id, completedAt: { gte: cutoff } },
        select: { id: true },
      });
      if (recentTask) continue;

      const recentRitual = await this.prisma.ritual.findFirst({
        where: { householdId: h.id, completedAt: { gte: cutoff } },
        select: { id: true },
      });
      if (recentRitual) continue;

      const next = Math.max(DECAY_FLOOR, h.harmonyScore - DECAY_AMOUNT);
      if (next === h.harmonyScore) continue;

      await this.prisma.household.update({
        where: { id: h.id },
        data: { harmonyScore: next },
      });
      decayed += 1;
    }

    if (decayed > 0) this.logger.log(`Decayed ${decayed} households`);
    return { decayed };
  }
}
