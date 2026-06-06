import { Injectable, BadRequestException } from '@nestjs/common';
import { TaskStatus, TaskWeight } from '@prisma/client';
import { TASK_WEIGHT_POINTS, normalizeChoreTitle } from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';

const CONTRIBUTION_WINDOW_DAYS = 30;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface RotationCandidate {
  userId: string;
  name: string;
  contributionScore: number;
  lastCompletedAt: Date | null;
}

export interface MemberRef {
  userId: string;
  name: string;
}

export interface CompletedTaskPoints {
  completedById: string;
  weight: TaskWeight;
  completedAt: Date | null;
}

export interface OpenTaskPoints {
  assigneeId: string;
  weight: TaskWeight;
}

export function buildCandidates(
  members: MemberRef[],
  completed: CompletedTaskPoints[],
  open: OpenTaskPoints[],
): RotationCandidate[] {
  const scoreByUser = new Map<string, number>();
  const lastByUser = new Map<string, Date>();

  for (const task of completed) {
    const uid = task.completedById;
    scoreByUser.set(uid, (scoreByUser.get(uid) ?? 0) + TASK_WEIGHT_POINTS[task.weight]);
    const prev = lastByUser.get(uid);
    if (task.completedAt && (!prev || task.completedAt > prev)) {
      lastByUser.set(uid, task.completedAt);
    }
  }

  for (const task of open) {
    const uid = task.assigneeId;
    scoreByUser.set(uid, (scoreByUser.get(uid) ?? 0) + TASK_WEIGHT_POINTS[task.weight]);
  }

  return members.map((m) => ({
    userId: m.userId,
    name: m.name,
    contributionScore: scoreByUser.get(m.userId) ?? 0,
    lastCompletedAt: lastByUser.get(m.userId) ?? null,
  }));
}

export interface SelectAssigneeInput {
  candidates: RotationCandidate[];
  excludeUserId: string | null;
  excludeReason?: string | null;
  randomSeed?: () => number;
}

export type RotationTieBreak =
  | 'lowest_score'
  | 'never_completed'
  | 'oldest_completion'
  | 'random_tiebreak';

export interface RotationDecision {
  userId: string;
  tieBreak: RotationTieBreak;
  reason: string;
}

function nameFor(candidates: RotationCandidate[], userId: string): string {
  return candidates.find((c) => c.userId === userId)?.name ?? 'this housemate';
}

function buildExclusionPrefix(
  candidates: RotationCandidate[],
  excludeUserId: string | null,
  excludeReason: string | null | undefined,
  applied: boolean,
): string {
  if (!applied || !excludeUserId) return '';
  const name = nameFor(candidates, excludeUserId);
  const because = excludeReason ?? 'they completed this same chore most recently';
  return `Skipped ${name} (${because}). `;
}

export function selectAssignee(input: SelectAssigneeInput): RotationDecision {
  const { candidates, excludeUserId, excludeReason, randomSeed = Math.random } = input;
  if (candidates.length === 0) {
    throw new Error('Cannot rotate: household has no members');
  }

  const exclusionApplied = Boolean(excludeUserId) && candidates.length > 1;
  const eligible = exclusionApplied
    ? candidates.filter((c) => c.userId !== excludeUserId)
    : candidates;

  const exclusionPrefix = buildExclusionPrefix(
    candidates,
    excludeUserId ?? null,
    excludeReason,
    exclusionApplied,
  );

  const lowestScore = Math.min(...eligible.map((c) => c.contributionScore));
  const lowest = eligible.filter((c) => c.contributionScore === lowestScore);

  if (lowest.length === 1) {
    const winner = lowest[0];
    const others = eligible
      .filter((c) => c.userId !== winner.userId)
      .map((c) => `${c.name} ${c.contributionScore} pt`);
    const reason = others.length
      ? `${exclusionPrefix}${winner.name} has the lowest 30-day contribution score (${winner.contributionScore} pt) vs ${others.join(', ')}.`
      : `${exclusionPrefix}${winner.name} is the only eligible housemate, so Smart Rotation assigned them.`;
    return { userId: winner.userId, tieBreak: 'lowest_score', reason };
  }

  const neverCompleted = lowest.filter((c) => c.lastCompletedAt === null);
  if (neverCompleted.length > 0) {
    const winner =
      neverCompleted.length === 1
        ? neverCompleted[0]
        : neverCompleted[Math.floor(randomSeed() * neverCompleted.length)];
    const tied = lowest.map((c) => c.name).join(', ');
    return {
      userId: winner.userId,
      tieBreak: 'never_completed',
      reason: `${exclusionPrefix}${tied} are tied on contribution score (${lowestScore} pt). ${winner.name} has never completed a chore in this house, so they get the first turn.`,
    };
  }

  const oldestLast = Math.min(
    ...lowest.map((c) => (c.lastCompletedAt as Date).getTime()),
  );
  const oldest = lowest.filter(
    (c) => (c.lastCompletedAt as Date).getTime() === oldestLast,
  );

  if (oldest.length === 1) {
    const winner = oldest[0];
    return {
      userId: winner.userId,
      tieBreak: 'oldest_completion',
      reason: `${exclusionPrefix}${lowest.map((c) => c.name).join(', ')} are tied at ${lowestScore} pt over 30 days. ${winner.name} has gone the longest without completing anything, so it's their turn.`,
    };
  }

  const winner = oldest[Math.floor(randomSeed() * oldest.length)];
  return {
    userId: winner.userId,
    tieBreak: 'random_tiebreak',
    reason: `${exclusionPrefix}${oldest.map((c) => c.name).join(', ')} are fully tied (same contribution score and same last-completion timestamp). Smart Rotation picked ${winner.name} at random — every other housemate gets the next one.`,
  };
}

@Injectable()
export class SmartRotationService {
  constructor(private readonly prisma: PrismaService) {}

  async pickAssignee(
    householdId: string,
    title: string,
    weight: TaskWeight,
    options?: { excludeUserId?: string; excludeReason?: string },
  ): Promise<RotationDecision> {
    const members = await this.prisma.householdMember.findMany({
      where: { householdId, status: 'active' },
      select: { user: { select: { id: true, name: true } } },
    });
    if (members.length === 0) {
      throw new BadRequestException('Household has no active members');
    }

    const since = new Date(Date.now() - CONTRIBUTION_WINDOW_DAYS * MS_PER_DAY);
    const completedRecently = await this.prisma.task.findMany({
      where: {
        householdId,
        status: TaskStatus.completed,
        completedAt: { gte: since },
        completedById: { not: null },
        caretakerOwned: false,
      },
      select: { completedById: true, weight: true, completedAt: true },
    });

    const openAssigned = await this.prisma.task.findMany({
      where: {
        householdId,
        status: { in: [TaskStatus.pending, TaskStatus.overdue] },
        caretakerOwned: false,
      },
      select: { assigneeId: true, weight: true },
    });

    const candidates = buildCandidates(
      members.map((m) => ({ userId: m.user.id, name: m.user.name })),
      completedRecently.map((t) => ({
        completedById: t.completedById as string,
        weight: t.weight,
        completedAt: t.completedAt,
      })),
      openAssigned.map((t) => ({
        assigneeId: t.assigneeId,
        weight: t.weight,
      })),
    );

    let excludeUserId: string | null = options?.excludeUserId ?? null;
    let excludeReason: string | null = excludeUserId
      ? options?.excludeReason ?? 'they are currently away'
      : null;

    if (!excludeUserId && weight === TaskWeight.heavy) {
      const slug = normalizeChoreTitle(title);
      const lastSameTitle = slug
        ? await this.prisma.task.findFirst({
            where: {
              householdId,
              titleSlug: slug,
              status: TaskStatus.completed,
              completedById: { not: null },
            },
            orderBy: { completedAt: 'desc' },
            select: { completedById: true },
          })
        : null;
      excludeUserId = lastSameTitle?.completedById ?? null;
      if (excludeUserId) {
        excludeReason = `they completed "${title}" most recently and this is a heavy chore`;
      }
    }

    return selectAssignee({ candidates, excludeUserId, excludeReason });
  }
}
