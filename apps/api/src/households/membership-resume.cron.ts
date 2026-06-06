import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MembershipResumeCron {
  private readonly logger = new Logger(MembershipResumeCron.name);

  constructor(private readonly prisma: PrismaService) {}

  // Runs daily at 00:05 server time. Defensive sweep — HouseholdScopeGuard
  // also resolves the status lazily on first read after the cutoff.
  @Cron('0 5 0 * * *')
  async run(): Promise<void> {
    await this.sweep(new Date());
  }

  async sweep(now: Date): Promise<{ resumed: number }> {
    const expired = await this.prisma.householdMember.findMany({
      where: {
        status: 'inactive',
        inactiveUntil: { lte: now },
      },
      select: {
        id: true,
        userId: true,
        inactiveFrom: true,
        inactiveUntil: true,
      },
    });

    if (expired.length === 0) {
      return { resumed: 0 };
    }

    await this.prisma.$transaction(async (tx) => {
      for (const m of expired) {
        await tx.householdMember.update({
          where: { id: m.id },
          data: {
            status: 'active',
            inactiveFrom: null,
            inactiveUntil: null,
            inactiveReason: null,
          },
        });
        await tx.membershipStatusLog.create({
          data: {
            membershipId: m.id,
            changedById: m.userId,
            fromStatus: 'inactive',
            toStatus: 'active',
            from: m.inactiveFrom,
            until: m.inactiveUntil,
            reason: 'cron-auto-resume',
          },
        });
      }
    });

    this.logger.log(`Auto-resumed ${expired.length} expired memberships`);
    return { resumed: expired.length };
  }
}
