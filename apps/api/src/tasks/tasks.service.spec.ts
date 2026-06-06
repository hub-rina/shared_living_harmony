import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TaskKind, TaskWeight } from '@prisma/client';
import { REACTIVE_DEFAULT_DUE_HOURS, REACTIVE_DEFAULT_TITLE } from '@homebuddy/shared';
import type { HouseholdScope } from '@homebuddy/shared';
import { HarmonyService } from '../harmony/harmony.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { SmartRotationService } from './smart-rotation.service';
import { TasksService } from './tasks.service';

const SAMPLE_PHOTO =
  'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/' +
  '2wBDAAEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEB/9k=';

const aliceScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'admin', status: 'active' },
};

describe('TasksService.flagMess', () => {
  let service: TasksService;
  const prisma = {
    task: { create: jest.fn() },
    messFlag: { create: jest.fn() },
    user: { findUnique: jest.fn().mockResolvedValue({ name: 'Alice' }) },
  };
  const rotation = { pickAssignee: jest.fn() };
  const harmony = { applyOnTimeCompletion: jest.fn(), applyOverduePenalty: jest.fn() };
  const notifications = { send: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.user.findUnique.mockResolvedValue({ name: 'Alice' });
    notifications.send.mockResolvedValue(undefined);
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

  it('creates a reactive heavy chore with the before-photo, rotates the assignee, and persists the rotation reasoning', async () => {
    rotation.pickAssignee.mockResolvedValue({
      userId: 'assignee-1',
      tieBreak: 'lowest_score',
      reason: 'Bob has the lowest 30-day contribution score (1 pt) vs Alice 6 pt.',
    });
    prisma.task.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 't1', ...data, assignee: { id: 'assignee-1', name: 'Bob' } }),
    );

    const before = Date.now();
    const result = await service.flagMess(aliceScope, {
      photoDataUrl: SAMPLE_PHOTO,
      title: 'kitchen explosion',
    });
    const after = Date.now();

    expect(rotation.pickAssignee).toHaveBeenCalledWith('h1', 'kitchen explosion', TaskWeight.heavy);
    expect(prisma.task.create).toHaveBeenCalledTimes(1);
    const createArgs = prisma.task.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      householdId: 'h1',
      title: 'kitchen explosion',
      weight: TaskWeight.heavy,
      kind: TaskKind.reactive,
      assigneeId: 'assignee-1',
      flaggedById: 'u-alice',
      beforePhotoUrl: SAMPLE_PHOTO,
      rotationReason: 'Bob has the lowest 30-day contribution score (1 pt) vs Alice 6 pt.',
    });
    const dueAtMs = (createArgs.data.dueAt as Date).getTime();
    const expectedMs = REACTIVE_DEFAULT_DUE_HOURS * 60 * 60 * 1000;
    expect(dueAtMs).toBeGreaterThanOrEqual(before + expectedMs);
    expect(dueAtMs).toBeLessThanOrEqual(after + expectedMs);
    expect(result.id).toBe('t1');
  });

  it('falls back to the default title when none is provided', async () => {
    rotation.pickAssignee.mockResolvedValue({
      userId: 'assignee-1',
      tieBreak: 'lowest_score',
      reason: 'rotation reason',
    });
    prisma.task.create.mockResolvedValue({ id: 't2' });

    await service.flagMess(aliceScope, {
      photoDataUrl: SAMPLE_PHOTO,
    });

    expect(rotation.pickAssignee).toHaveBeenCalledWith('h1', REACTIVE_DEFAULT_TITLE, TaskWeight.heavy);
    expect(prisma.task.create.mock.calls[0][0].data.title).toBe(REACTIVE_DEFAULT_TITLE);
  });

  it('trims whitespace and ignores empty titles', async () => {
    rotation.pickAssignee.mockResolvedValue({
      userId: 'assignee-1',
      tieBreak: 'lowest_score',
      reason: 'rotation reason',
    });
    prisma.task.create.mockResolvedValue({ id: 't3' });

    await service.flagMess(aliceScope, {
      photoDataUrl: SAMPLE_PHOTO,
      title: '   ',
    });

    expect(prisma.task.create.mock.calls[0][0].data.title).toBe(REACTIVE_DEFAULT_TITLE);
  });

  it('truncates very long titles to 120 chars', async () => {
    rotation.pickAssignee.mockResolvedValue({
      userId: 'assignee-1',
      tieBreak: 'lowest_score',
      reason: 'rotation reason',
    });
    prisma.task.create.mockResolvedValue({ id: 't4' });

    const longTitle = 'mess '.repeat(50);
    await service.flagMess(aliceScope, {
      photoDataUrl: SAMPLE_PHOTO,
      title: longTitle,
    });

    expect(prisma.task.create.mock.calls[0][0].data.title.length).toBeLessThanOrEqual(120);
  });

  it('still surfaces a BadRequestException from rotation when the household has no members', async () => {
    rotation.pickAssignee.mockRejectedValue(new BadRequestException('Household has no members'));

    await expect(
      service.flagMess(aliceScope, {
        photoDataUrl: SAMPLE_PHOTO,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('writes a MessFlag audit row and fires a notification on flag', async () => {
    rotation.pickAssignee.mockResolvedValue({
      userId: 'assignee-1',
      tieBreak: 'lowest_score',
      reason: 'rotation reason',
    });
    prisma.task.create.mockResolvedValue({ id: 't-flag' });
    prisma.messFlag.create.mockResolvedValue({ id: 'mf-1' });

    await service.flagMess(aliceScope, {
      photoDataUrl: SAMPLE_PHOTO,
      title: 'kitchen explosion',
    });

    expect(prisma.messFlag.create).toHaveBeenCalledWith({
      data: {
        householdId: 'h1',
        flaggerId: 'u-alice',
        taskId: 't-flag',
        title: 'kitchen explosion',
        photoUrl: SAMPLE_PHOTO,
      },
    });
    expect(notifications.send).toHaveBeenCalledWith({
      kind: 'mess-flag',
      householdId: 'h1',
      assigneeId: 'assignee-1',
      flaggerName: 'Alice',
      taskTitle: 'kitchen explosion',
    });
  });
});

describe('TasksService.update', () => {
  let service: TasksService;
  const prisma = {
    task: { findFirst: jest.fn(), update: jest.fn() },
    householdMember: { findFirst: jest.fn() },
  };
  const rotation = { pickAssignee: jest.fn() };
  const harmony = { applyOnTimeCompletion: jest.fn(), applyOverduePenalty: jest.fn() };
  const notifications = { send: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
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

  it('updates only provided fields', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 't1',
      assigneeId: 'u-alice',
      flaggedById: null,
      householdId: 'h1',
      status: 'pending',
      dueAt: new Date('2026-05-20T12:00:00Z'),
      weight: TaskWeight.light,
      title: 'old',
    });
    prisma.task.update.mockResolvedValue({ id: 't1' });

    await service.update(aliceScope, 't1', {
      title: 'new title',
      weight: 'heavy',
    });

    const data = prisma.task.update.mock.calls[0][0].data;
    expect(data.title).toBe('new title');
    expect(data.weight).toBe('heavy');
    expect(data.dueAt).toBeUndefined();
    expect(data.assigneeId).toBeUndefined();
  });

  it('rejects edit on completed task', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 't1',
      assigneeId: 'u-alice',
      flaggedById: null,
      householdId: 'h1',
      status: 'completed',
      dueAt: new Date(),
      weight: TaskWeight.light,
    });
    await expect(
      service.update(aliceScope, 't1', { title: 'x' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects edit when policy denies (non-admin, non-assignee)', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 't1',
      assigneeId: 'someone-else',
      flaggedById: null,
      householdId: 'h1',
      status: 'pending',
      dueAt: new Date(),
      weight: TaskWeight.light,
    });
    const memberScope: HouseholdScope = {
      ...aliceScope,
      membership: { id: 'm-bob', role: 'member', status: 'active' },
      userId: 'u-bob',
    };
    await expect(
      service.update(memberScope, 't1', { title: 'x' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('validates new assignee is an active member', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 't1',
      assigneeId: 'u-alice',
      flaggedById: null,
      householdId: 'h1',
      status: 'pending',
      dueAt: new Date(),
      weight: TaskWeight.light,
    });
    prisma.householdMember.findFirst.mockResolvedValue(null);
    await expect(
      service.update(aliceScope, 't1', { assigneeId: 'u-stranger' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts new assignee when active member exists', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 't1',
      assigneeId: 'u-alice',
      flaggedById: null,
      householdId: 'h1',
      status: 'pending',
      dueAt: new Date(),
      weight: TaskWeight.light,
    });
    prisma.householdMember.findFirst.mockResolvedValue({ id: 'm-bob' });
    prisma.task.update.mockResolvedValue({ id: 't1' });
    await service.update(aliceScope, 't1', { assigneeId: 'u-bob' });
    expect(prisma.task.update.mock.calls[0][0].data.assigneeId).toBe('u-bob');
  });
});

describe('TasksService.snooze', () => {
  let service: TasksService;
  const prisma = {
    task: { findFirst: jest.fn(), update: jest.fn() },
  };
  const rotation = { pickAssignee: jest.fn() };
  const harmony = { applyOnTimeCompletion: jest.fn(), applyOverduePenalty: jest.fn() };
  const notifications = { send: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
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

  it('pushes dueAt forward 24h, marks snoozeUsed, restores pending', async () => {
    const originalDue = new Date('2026-05-20T12:00:00Z');
    prisma.task.findFirst.mockResolvedValue({
      id: 't1',
      assigneeId: 'u-alice',
      flaggedById: null,
      householdId: 'h1',
      status: 'overdue',
      dueAt: originalDue,
      weight: TaskWeight.light,
      snoozeUsed: false,
    });
    prisma.task.update.mockResolvedValue({ id: 't1' });

    await service.snooze(aliceScope, 't1');

    const data = prisma.task.update.mock.calls[0][0].data;
    expect((data.dueAt as Date).getTime()).toBe(originalDue.getTime() + 24 * 60 * 60 * 1000);
    expect(data.snoozeUsed).toBe(true);
    expect(data.status).toBe('pending');
  });

  it('rejects second snooze on same task', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 't1',
      assigneeId: 'u-alice',
      flaggedById: null,
      householdId: 'h1',
      status: 'pending',
      dueAt: new Date(),
      weight: TaskWeight.light,
      snoozeUsed: true,
    });
    await expect(service.snooze(aliceScope, 't1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects snooze on completed task', async () => {
    prisma.task.findFirst.mockResolvedValue({
      id: 't1',
      assigneeId: 'u-alice',
      flaggedById: null,
      householdId: 'h1',
      status: 'completed',
      dueAt: new Date(),
      weight: TaskWeight.light,
      snoozeUsed: false,
    });
    await expect(service.snooze(aliceScope, 't1')).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('TasksService.sweepOverdue (grace window)', () => {
  let service: TasksService;
  const prisma = {
    task: {
      updateMany: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  };
  const rotation = { pickAssignee: jest.fn() };
  const harmony = { applyOnTimeCompletion: jest.fn(), applyOverduePenalty: jest.fn() };
  const notifications = { send: jest.fn().mockResolvedValue(undefined) };

  beforeEach(async () => {
    jest.clearAllMocks();
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

  it('flips pending past dueAt to overdue but does not penalize within 6h grace', async () => {
    prisma.task.updateMany.mockResolvedValue({ count: 1 });
    prisma.task.findMany.mockResolvedValue([]);

    await service.listForHousehold(aliceScope);

    expect(prisma.task.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'pending' }),
        data: { status: 'overdue' },
      }),
    );
    expect(harmony.applyOverduePenalty).not.toHaveBeenCalled();
  });

  it('penalizes past-grace overdue not yet penalized', async () => {
    prisma.task.updateMany.mockResolvedValue({ count: 0 });
    prisma.task.findMany
      .mockResolvedValueOnce([{ id: 't1' }, { id: 't2' }])
      .mockResolvedValueOnce([]);

    await service.listForHousehold(aliceScope);

    expect(prisma.task.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['t1', 't2'] } },
      data: { penaltyApplied: true },
    });
    expect(harmony.applyOverduePenalty).toHaveBeenCalledWith('h1', ['t1', 't2']);
  });
});

describe('TasksService.createCaretakerChore', () => {
  let service: TasksService;
  const prisma = {
    task: { create: jest.fn() },
    landlordProperty: { findFirst: jest.fn() },
  };
  const rotation = { pickAssignee: jest.fn() };
  const harmony = { applyOnTimeCompletion: jest.fn(), applyOverduePenalty: jest.fn() };
  const notifications = { send: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
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

  it('assigns a caretaker-owned chore to the consented caretaker landlord without rotating', async () => {
    prisma.landlordProperty.findFirst.mockResolvedValue({ landlordId: 'u-landlord' });
    prisma.task.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'c1', ...data, assignee: { id: 'u-landlord', name: 'Property Manager' } }),
    );

    await service.createCaretakerChore(aliceScope, {
      title: 'Mop the shared hallway',
      weight: TaskWeight.heavy,
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    });

    expect(rotation.pickAssignee).not.toHaveBeenCalled();
    const createArgs = prisma.task.create.mock.calls[0][0];
    expect(createArgs.data).toMatchObject({
      assigneeId: 'u-landlord',
      caretakerOwned: true,
    });
  });

  it('rejects when no consented caretaker landlord is linked', async () => {
    prisma.landlordProperty.findFirst.mockResolvedValue(null);

    await expect(
      service.createCaretakerChore(aliceScope, {
        title: 'Mop the shared hallway',
        weight: TaskWeight.heavy,
        dueAt: new Date(Date.now() + 86_400_000).toISOString(),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.task.create).not.toHaveBeenCalled();
  });
});
