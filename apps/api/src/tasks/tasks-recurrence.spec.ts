import { Test } from '@nestjs/testing';
import { TaskCadence, TaskKind, TaskStatus, TaskWeight } from '@prisma/client';
import type { HouseholdScope } from '@homebuddy/shared';
import { HarmonyService } from '../harmony/harmony.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmartRotationService } from './smart-rotation.service';
import { TasksService } from './tasks.service';

const aliceScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'admin', status: 'active' },
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function makeStoredTask(over: Partial<Record<string, unknown>> = {}) {
  return {
    id: 't1',
    title: 'Clean the stairs',
    assigneeId: 'u-alice',
    flaggedById: null,
    householdId: 'h1',
    status: TaskStatus.pending,
    dueAt: new Date(Date.now() - WEEK_MS), // a week ago, so the next occurrence advances past now
    weight: TaskWeight.light,
    kind: TaskKind.routine,
    cadence: TaskCadence.weekly,
    snoozeUsed: false,
    caretakerOwned: false,
    ...over,
  };
}

describe('TasksService.complete recurrence', () => {
  let service: TasksService;
  const prisma = {
    task: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  };
  const rotation = { pickAssignee: jest.fn() };
  const harmony = { applyOnTimeCompletion: jest.fn(), applyOverduePenalty: jest.fn() };
  const notifications = { send: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.task.update.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 't1', ...data, assignee: { id: 'u-alice', name: 'Alice' } }),
    );
    prisma.task.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({ id: 't2', ...data, assignee: { id: 'u-bob', name: 'Bob' } }),
    );
    rotation.pickAssignee.mockResolvedValue({
      userId: 'u-bob',
      tieBreak: 'lowest_score',
      reason: 'Bob is next.',
    });
    const moduleRef = await Test.createTestingModule({
      providers: [
        TasksService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmartRotationService, useValue: rotation },
        { provide: HarmonyService, useValue: harmony },
        { provide: NotificationsService, useValue: notifications },
      ],
    }).compile();
    service = moduleRef.get(TasksService);
  });

  it('spawns the next weekly occurrence, excluding the person who just completed it', async () => {
    const stored = makeStoredTask();
    prisma.task.findFirst.mockResolvedValue(stored);

    await service.complete(aliceScope, 't1');

    expect(rotation.pickAssignee).toHaveBeenCalledTimes(1);
    const [, , , options] = rotation.pickAssignee.mock.calls[0];
    expect(options).toMatchObject({ excludeUserId: 'u-alice' });

    expect(prisma.task.create).toHaveBeenCalledTimes(1);
    const created = prisma.task.create.mock.calls[0][0].data;
    expect(created).toMatchObject({
      householdId: 'h1',
      title: 'Clean the stairs',
      weight: TaskWeight.light,
      kind: TaskKind.routine,
      cadence: TaskCadence.weekly,
      assigneeId: 'u-bob',
    });
    const nextDue = (created.dueAt as Date).getTime();
    expect(nextDue).toBeGreaterThan(Date.now());
    expect((nextDue - stored.dueAt.getTime()) % WEEK_MS).toBe(0);
  });

  it('does not spawn a next occurrence for a one-off chore', async () => {
    prisma.task.findFirst.mockResolvedValue(makeStoredTask({ cadence: TaskCadence.once }));

    await service.complete(aliceScope, 't1');

    expect(prisma.task.create).not.toHaveBeenCalled();
  });

  it('does not spawn a next occurrence for a reactive task', async () => {
    prisma.task.findFirst.mockResolvedValue(
      makeStoredTask({ kind: TaskKind.reactive, cadence: TaskCadence.weekly }),
    );

    await service.complete(aliceScope, 't1');

    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});
