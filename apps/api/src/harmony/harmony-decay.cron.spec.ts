import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { HarmonyDecayCron } from './harmony-decay.cron';

describe('HarmonyDecayCron.sweep', () => {
  const prisma = {
    household: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    task: { findFirst: jest.fn() },
    ritual: { findFirst: jest.fn() },
  };
  let cron: HarmonyDecayCron;

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [HarmonyDecayCron, { provide: PrismaService, useValue: prisma }],
    }).compile();
    cron = moduleRef.get(HarmonyDecayCron);
  });

  it('no households above floor → decayed: 0', async () => {
    prisma.household.findMany.mockResolvedValue([]);
    const result = await cron.sweep(new Date('2026-05-15T01:00:00Z'));
    expect(result).toEqual({ decayed: 0 });
    expect(prisma.household.update).not.toHaveBeenCalled();
  });

  it('skips households with recent task completion', async () => {
    prisma.household.findMany.mockResolvedValue([{ id: 'h1', harmonyScore: 80 }]);
    prisma.task.findFirst.mockResolvedValue({ id: 't1' });
    const result = await cron.sweep(new Date('2026-05-15T01:00:00Z'));
    expect(result).toEqual({ decayed: 0 });
    expect(prisma.household.update).not.toHaveBeenCalled();
  });

  it('skips households with recent ritual completion', async () => {
    prisma.household.findMany.mockResolvedValue([{ id: 'h1', harmonyScore: 80 }]);
    prisma.task.findFirst.mockResolvedValue(null);
    prisma.ritual.findFirst.mockResolvedValue({ id: 'r1' });
    const result = await cron.sweep(new Date('2026-05-15T01:00:00Z'));
    expect(result).toEqual({ decayed: 0 });
    expect(prisma.household.update).not.toHaveBeenCalled();
  });

  it('decrements inactive households by 1', async () => {
    prisma.household.findMany.mockResolvedValue([
      { id: 'h1', harmonyScore: 80 },
      { id: 'h2', harmonyScore: 60 },
    ]);
    prisma.task.findFirst.mockResolvedValue(null);
    prisma.ritual.findFirst.mockResolvedValue(null);
    prisma.household.update.mockResolvedValue({});

    const result = await cron.sweep(new Date('2026-05-15T01:00:00Z'));

    expect(result).toEqual({ decayed: 2 });
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { harmonyScore: 79 },
    });
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: 'h2' },
      data: { harmonyScore: 59 },
    });
  });

  it('floors at 50', async () => {
    prisma.household.findMany.mockResolvedValue([{ id: 'h1', harmonyScore: 51 }]);
    prisma.task.findFirst.mockResolvedValue(null);
    prisma.ritual.findFirst.mockResolvedValue(null);
    prisma.household.update.mockResolvedValue({});

    const result = await cron.sweep(new Date('2026-05-15T01:00:00Z'));

    expect(result).toEqual({ decayed: 1 });
    expect(prisma.household.update).toHaveBeenCalledWith({
      where: { id: 'h1' },
      data: { harmonyScore: 50 },
    });
  });

  it('queries activity inside 24h window', async () => {
    prisma.household.findMany.mockResolvedValue([{ id: 'h1', harmonyScore: 80 }]);
    prisma.task.findFirst.mockResolvedValue(null);
    prisma.ritual.findFirst.mockResolvedValue(null);
    prisma.household.update.mockResolvedValue({});

    const now = new Date('2026-05-15T01:00:00Z');
    await cron.sweep(now);

    const expectedCutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    expect(prisma.task.findFirst).toHaveBeenCalledWith({
      where: { householdId: 'h1', completedAt: { gte: expectedCutoff } },
      select: { id: true },
    });
  });
});
