import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TaskWeight } from '@prisma/client';
import type { HouseholdScope } from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SmartRotationService } from '../tasks/smart-rotation.service';
import { SuppliesService } from './supplies.service';

const activeScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'member', status: 'active' },
};

const inactiveScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-bob',
  systemRole: 'user',
  membership: { id: 'm-bob', role: 'member', status: 'inactive' },
};

describe('SuppliesService', () => {
  let service: SuppliesService;

  const prisma = {
    supply: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      createMany: jest.fn(),
      delete: jest.fn(),
    },
    task: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  const rotation = { pickAssignee: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));

    const moduleRef = await Test.createTestingModule({
      providers: [
        SuppliesService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmartRotationService, useValue: rotation },
      ],
    }).compile();

    service = moduleRef.get(SuppliesService);
  });

  describe('markLow', () => {
    it('flips the supply to low and opens a fairly-assigned purchase task', async () => {
      prisma.supply.findFirst.mockResolvedValue({ id: 's1', name: 'Toilet paper', isLow: false });
      rotation.pickAssignee.mockResolvedValue({ userId: 'u-bob', reason: 'Bob has the lowest score.' });
      prisma.supply.update.mockResolvedValue({ id: 's1', name: 'Toilet paper', isLow: true });
      prisma.task.create.mockResolvedValue({ id: 't1', title: 'Buy toilet paper' });

      const result = await service.markLow(activeScope, 's1');

      expect(rotation.pickAssignee).toHaveBeenCalledWith('h1', 'Buy toilet paper', TaskWeight.light);
      expect(prisma.supply.update).toHaveBeenCalledWith({
        where: { id: 's1' },
        data: { isLow: true },
      });
      expect(prisma.task.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            householdId: 'h1',
            title: 'Buy toilet paper',
            assigneeId: 'u-bob',
            rotationReason: 'Bob has the lowest score.',
          }),
        }),
      );
      expect(result.supply.isLow).toBe(true);
      expect(result.task.id).toBe('t1');
    });

    it('throws NotFound when the supply is not in this household', async () => {
      prisma.supply.findFirst.mockResolvedValue(null);
      await expect(service.markLow(activeScope, 'ghost')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('forbids inactive members from changing supplies', async () => {
      await expect(service.markLow(inactiveScope, 's1')).rejects.toBeInstanceOf(ForbiddenException);
      expect(rotation.pickAssignee).not.toHaveBeenCalled();
    });
  });

  describe('addDefaults', () => {
    it('adds the default supplies without duplicating existing ones', async () => {
      prisma.supply.createMany.mockResolvedValue({ count: 3 });
      prisma.supply.findMany.mockResolvedValue([]);

      await service.addDefaults(activeScope);

      expect(prisma.supply.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true }),
      );
    });
  });
});
