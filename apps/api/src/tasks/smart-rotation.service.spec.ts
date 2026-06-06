import { Test } from '@nestjs/testing';
import { TaskStatus, TaskWeight } from '@prisma/client';
import { normalizeChoreTitle } from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';
import {
  SmartRotationService,
  buildCandidates,
  selectAssignee,
  type RotationCandidate,
} from './smart-rotation.service';

function candidate(
  userId: string,
  contributionScore: number,
  lastCompletedAt: Date | null = null,
  name?: string,
): RotationCandidate {
  return { userId, name: name ?? userId, contributionScore, lastCompletedAt };
}

describe('selectAssignee', () => {
  it('picks the member with the lowest 30-day contribution score', () => {
    const result = selectAssignee({
      candidates: [
        candidate('alice', 8),
        candidate('bob', 3),
        candidate('carol', 5),
      ],
      excludeUserId: null,
    });
    expect(result.userId).toBe('bob');
    expect(result.tieBreak).toBe('lowest_score');
    expect(result.reason).toMatch(/lowest 30-day contribution score/);
    expect(result.reason).toMatch(/3 pt/);
  });

  it('excludes the last completer of a heavy task and reasons about it', () => {
    const result = selectAssignee({
      candidates: [
        candidate('alice', 0),
        candidate('bob', 6),
      ],
      excludeUserId: 'alice',
      excludeReason: 'they completed "Clean the kitchen" most recently and this is a heavy chore',
    });
    expect(result.userId).toBe('bob');
    expect(result.reason).toMatch(/Skipped alice/);
    expect(result.reason).toMatch(/heavy chore/);
  });

  it('does not exclude the only remaining candidate', () => {
    const result = selectAssignee({
      candidates: [candidate('alice', 0)],
      excludeUserId: 'alice',
    });
    expect(result.userId).toBe('alice');
    expect(result.reason).toMatch(/only eligible housemate/);
  });

  it('prefers a member who has never completed a task on a tie', () => {
    const lastWeek = new Date('2026-05-05T12:00:00Z');
    const result = selectAssignee({
      candidates: [
        candidate('alice', 0, lastWeek),
        candidate('bob', 0, null),
      ],
      excludeUserId: null,
    });
    expect(result.userId).toBe('bob');
    expect(result.tieBreak).toBe('never_completed');
    expect(result.reason).toMatch(/never completed a chore/);
  });

  it('on a tie with prior history, picks the one whose last completion is oldest', () => {
    const older = new Date('2026-04-01T10:00:00Z');
    const newer = new Date('2026-05-10T10:00:00Z');
    const result = selectAssignee({
      candidates: [
        candidate('alice', 2, newer),
        candidate('bob', 2, older),
      ],
      excludeUserId: null,
    });
    expect(result.userId).toBe('bob');
    expect(result.tieBreak).toBe('oldest_completion');
    expect(result.reason).toMatch(/longest without completing/);
  });

  it('falls back to random when scores and last-completion times tie', () => {
    const sameTime = new Date('2026-05-01T10:00:00Z');
    const result = selectAssignee({
      candidates: [
        candidate('alice', 2, sameTime),
        candidate('bob', 2, sameTime),
      ],
      excludeUserId: null,
      randomSeed: () => 0,
    });
    expect(result.userId).toBe('alice');
    expect(result.tieBreak).toBe('random_tiebreak');

    const result2 = selectAssignee({
      candidates: [
        candidate('alice', 2, sameTime),
        candidate('bob', 2, sameTime),
      ],
      excludeUserId: null,
      randomSeed: () => 0.99,
    });
    expect(result2.userId).toBe('bob');
  });

  it('throws when the household has no members', () => {
    expect(() =>
      selectAssignee({ candidates: [], excludeUserId: null }),
    ).toThrow('Cannot rotate: household has no members');
  });

  it('falls back to a generic name when the excluded user is not a candidate', () => {
    const result = selectAssignee({
      candidates: [candidate('alice', 5), candidate('bob', 1)],
      excludeUserId: 'ghost',
      excludeReason: 'they left the household',
    });
    expect(result.userId).toBe('bob');
    expect(result.reason).toMatch(/Skipped this housemate/);
  });

  it('uses a default exclusion reason when none is given', () => {
    const result = selectAssignee({
      candidates: [candidate('alice', 5), candidate('bob', 1)],
      excludeUserId: 'alice',
    });
    expect(result.userId).toBe('bob');
    expect(result.reason).toMatch(/completed this same chore most recently/);
  });
});

describe('buildCandidates', () => {
  const members = [
    { userId: 'alice', name: 'Alice' },
    { userId: 'bob', name: 'Bob' },
  ];

  it('sums completed task points and tracks the latest completion', () => {
    const older = new Date('2026-04-01T10:00:00Z');
    const newer = new Date('2026-05-10T10:00:00Z');
    const candidates = buildCandidates(
      members,
      [
        { completedById: 'alice', weight: TaskWeight.light, completedAt: older },
        { completedById: 'alice', weight: TaskWeight.heavy, completedAt: newer },
      ],
      [],
    );
    const alice = candidates.find((c) => c.userId === 'alice')!;
    expect(alice.contributionScore).toBe(4);
    expect(alice.lastCompletedAt).toEqual(newer);
  });

  it('counts open assigned tasks toward the score without setting a completion time', () => {
    const candidates = buildCandidates(members, [], [
      { assigneeId: 'alice', weight: TaskWeight.heavy },
    ]);
    const alice = candidates.find((c) => c.userId === 'alice')!;
    expect(alice.contributionScore).toBe(3);
    expect(alice.lastCompletedAt).toBeNull();
  });

  it('prevents pile-up: an already-assigned member is no longer the lowest', () => {
    const candidates = buildCandidates(members, [], [
      { assigneeId: 'alice', weight: TaskWeight.heavy },
    ]);
    const decision = selectAssignee({ candidates, excludeUserId: null });
    expect(decision.userId).toBe('bob');
  });

  it('gives zero score and no completion to members with no activity', () => {
    const candidates = buildCandidates(members, [], []);
    expect(candidates).toHaveLength(2);
    for (const candidate of candidates) {
      expect(candidate.contributionScore).toBe(0);
      expect(candidate.lastCompletedAt).toBeNull();
    }
  });
});

describe('SmartRotationService.pickAssignee', () => {
  const prisma = {
    householdMember: { findMany: jest.fn() },
    task: { findMany: jest.fn(), findFirst: jest.fn() },
  };
  let service: SmartRotationService;

  const alice = { userId: 'alice', name: 'Alice' };
  const bob = { userId: 'bob', name: 'Bob' };

  function setup({
    members,
    completed = [],
    open = [],
    lastSameTitle = null,
  }: {
    members: { userId: string; name: string }[];
    completed?: { completedById: string; weight: TaskWeight; completedAt: Date }[];
    open?: { assigneeId: string; weight: TaskWeight }[];
    lastSameTitle?: { completedById: string } | null;
  }) {
    prisma.householdMember.findMany.mockResolvedValue(
      members.map((m) => ({ user: { id: m.userId, name: m.name } })),
    );
    prisma.task.findMany.mockImplementation((args: { where: { status: unknown } }) =>
      args.where.status === TaskStatus.completed
        ? Promise.resolve(completed)
        : Promise.resolve(open),
    );
    prisma.task.findFirst.mockResolvedValue(lastSameTitle);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        SmartRotationService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();
    service = moduleRef.get(SmartRotationService);
  });

  it('throws when the household has no active members', async () => {
    setup({ members: [] });
    await expect(
      service.pickAssignee('h1', 'Dishes', TaskWeight.light),
    ).rejects.toThrow('Household has no active members');
  });

  it('assigns to the lowest scorer from completed history', async () => {
    setup({
      members: [alice, bob],
      completed: [
        { completedById: 'alice', weight: TaskWeight.heavy, completedAt: new Date('2026-05-20T10:00:00Z') },
      ],
    });
    const decision = await service.pickAssignee('h1', 'Dishes', TaskWeight.light);
    expect(decision.userId).toBe('bob');
  });

  it('folds open assigned tasks into the score so they shift the pick', async () => {
    setup({
      members: [alice, bob],
      open: [{ assigneeId: 'alice', weight: TaskWeight.heavy }],
    });
    const decision = await service.pickAssignee('h1', 'Dishes', TaskWeight.light);
    expect(decision.userId).toBe('bob');
    expect(prisma.task.findMany).toHaveBeenCalledTimes(2);
  });

  it('excludes caretaker-owned chores from the fairness queries', async () => {
    setup({ members: [alice, bob] });
    await service.pickAssignee('h1', 'Dishes', TaskWeight.light);
    for (const call of prisma.task.findMany.mock.calls) {
      expect(call[0].where.caretakerOwned).toBe(false);
    }
  });

  it('excludes the last completer of the same heavy chore', async () => {
    setup({ members: [alice, bob], lastSameTitle: { completedById: 'alice' } });
    const decision = await service.pickAssignee('h1', 'Clean the kitchen', TaskWeight.heavy);
    expect(decision.userId).toBe('bob');
    expect(decision.reason).toMatch(/Skipped Alice/);
    expect(decision.reason).toMatch(/heavy chore/);
    expect(prisma.task.findFirst).toHaveBeenCalled();
  });

  it('does not exclude anyone when no one completed the heavy chore before', async () => {
    setup({ members: [alice, bob], lastSameTitle: null });
    const decision = await service.pickAssignee('h1', 'Clean the kitchen', TaskWeight.heavy);
    expect(decision.reason).not.toMatch(/Skipped/);
  });

  it('skips the same-title lookup when the title has no meaningful slug', async () => {
    setup({ members: [alice, bob] });
    await service.pickAssignee('h1', 'the the the', TaskWeight.heavy);
    expect(prisma.task.findFirst).not.toHaveBeenCalled();
  });

  it('honors an explicit excludeUserId and skips the heavy-chore lookup', async () => {
    setup({ members: [alice, bob] });
    const decision = await service.pickAssignee('h1', 'Dishes', TaskWeight.heavy, {
      excludeUserId: 'alice',
    });
    expect(decision.userId).toBe('bob');
    expect(decision.reason).toMatch(/away/);
    expect(prisma.task.findFirst).not.toHaveBeenCalled();
  });
});

describe('normalizeChoreTitle', () => {
  it('maps trivial variants to the same slug', () => {
    const a = normalizeChoreTitle('dishes');
    const b = normalizeChoreTitle('Do the dishes');
    const c = normalizeChoreTitle('do dishes please');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });

  it('is order-invariant', () => {
    expect(normalizeChoreTitle('wash dishes')).toBe(normalizeChoreTitle('dishes wash'));
  });

  it('strips punctuation', () => {
    expect(normalizeChoreTitle('Take out, the trash!')).toBe(normalizeChoreTitle('trash take'));
  });

  it('returns empty string for stopword-only titles', () => {
    expect(normalizeChoreTitle('the the the')).toBe('');
  });

  it('preserves distinct chore types', () => {
    expect(normalizeChoreTitle('dishes')).not.toBe(normalizeChoreTitle('laundry'));
  });
});
