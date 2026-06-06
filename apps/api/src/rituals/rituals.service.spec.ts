import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { RitualStatus } from '@prisma/client';
import type { HouseholdScope } from '@homebuddy/shared';
import { HarmonyService } from '../harmony/harmony.service';
import { PrismaService } from '../prisma/prisma.service';
import { RitualsService } from './rituals.service';

const adminScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-admin',
  systemRole: 'user',
  membership: { id: 'm-admin', role: 'admin', status: 'active' },
};

const proposerScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-proposer',
  systemRole: 'user',
  membership: { id: 'm-proposer', role: 'member', status: 'active' },
};

const otherMemberScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-other',
  systemRole: 'user',
  membership: { id: 'm-other', role: 'member', status: 'active' },
};

const inactiveMemberScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-inactive',
  systemRole: 'user',
  membership: { id: 'm-inactive', role: 'member', status: 'inactive' },
};

const baseRitual = {
  id: 'r1',
  householdId: 'h1',
  type: 'meal',
  title: 'Sunday brunch',
  proposedAt: new Date('2026-05-14T10:00:00.000Z'),
  status: RitualStatus.proposed,
  cadence: 'once' as const,
  proposerId: 'u-proposer',
  completedAt: null,
  createdAt: new Date('2026-05-14T09:00:00.000Z'),
  participants: [{ user: { id: 'u-proposer', name: 'Proposer' } }],
};

describe('RitualsService', () => {
  let service: RitualsService;

  const prisma = {
    ritual: {
      create: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    ritualParticipant: {
      findUnique: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    },
    householdMember: {
      count: jest.fn(),
    },
  };

  const harmony = {
    applyRitualCompletion: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        RitualsService,
        { provide: PrismaService, useValue: prisma },
        { provide: HarmonyService, useValue: harmony },
      ],
    }).compile();
    service = moduleRef.get(RitualsService);
  });

  describe('create', () => {
    it('creates a ritual scoped to the household and sets proposerId from scope.userId', async () => {
      const created = { ...baseRitual };
      prisma.ritual.create.mockResolvedValue(created);

      const input = {
        type: 'meal' as const,
        title: 'Sunday brunch',
        proposedAt: '2026-05-14T10:00:00.000Z',
      };

      const result = await service.create(proposerScope, input);

      expect(prisma.ritual.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            householdId: 'h1',
            proposerId: 'u-proposer',
          }),
        }),
      );
      expect(result.proposerId).toBe('u-proposer');
    });
  });

  describe('complete', () => {
    it('allows the proposer to complete their own ritual', async () => {
      prisma.ritual.findFirst.mockResolvedValue(baseRitual);
      prisma.householdMember.count.mockResolvedValue(3);
      harmony.applyRitualCompletion.mockResolvedValue(10);
      const completed = { ...baseRitual, status: RitualStatus.completed, completedAt: new Date() };
      prisma.ritual.update.mockResolvedValue(completed);

      const result = await service.complete(proposerScope, 'r1');

      expect(prisma.ritual.update).toHaveBeenCalled();
      expect(result.harmonyBonus).toBe(10);
    });

    it('rejects an active non-proposer member from completing another member ritual', async () => {
      prisma.ritual.findFirst.mockResolvedValue(baseRitual);

      await expect(service.complete(otherMemberScope, 'r1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.ritual.update).not.toHaveBeenCalled();
    });

    it('rejects an inactive member from completing a ritual', async () => {
      prisma.ritual.findFirst.mockResolvedValue(baseRitual);

      await expect(service.complete(inactiveMemberScope, 'r1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.ritual.update).not.toHaveBeenCalled();
    });

    it('throws BadRequestException when the ritual is already completed', async () => {
      prisma.ritual.findFirst.mockResolvedValue({
        ...baseRitual,
        status: RitualStatus.completed,
      });

      await expect(service.complete(proposerScope, 'r1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws NotFoundException for a ritual that does not belong to the household', async () => {
      prisma.ritual.findFirst.mockResolvedValue(null);

      await expect(service.complete(proposerScope, 'r-cross')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('does not clone a one-off ritual', async () => {
      prisma.ritual.findFirst.mockResolvedValue(baseRitual);
      prisma.householdMember.count.mockResolvedValue(3);
      harmony.applyRitualCompletion.mockResolvedValue(10);
      prisma.ritual.update.mockResolvedValue({ ...baseRitual, status: RitualStatus.completed });

      await service.complete(proposerScope, 'r1');

      expect(prisma.ritual.create).not.toHaveBeenCalled();
    });

    it('clones a weekly ritual 7 days forward on completion', async () => {
      const weekly = { ...baseRitual, cadence: 'weekly' as const };
      prisma.ritual.findFirst.mockResolvedValue(weekly);
      prisma.householdMember.count.mockResolvedValue(3);
      harmony.applyRitualCompletion.mockResolvedValue(10);
      prisma.ritual.update.mockResolvedValue({ ...weekly, status: RitualStatus.completed });
      prisma.ritual.create.mockResolvedValue({});

      await service.complete(proposerScope, 'r1');

      expect(prisma.ritual.create).toHaveBeenCalledTimes(1);
      const nextData = prisma.ritual.create.mock.calls[0][0].data;
      expect(nextData.cadence).toBe('weekly');
      expect(nextData.title).toBe('Sunday brunch');
      const nextDue = (nextData.proposedAt as Date).getTime();
      const expected = baseRitual.proposedAt.getTime() + 7 * 24 * 60 * 60 * 1000;
      expect(nextDue).toBe(expected);
    });

    it('clones a daily ritual 24h forward on completion', async () => {
      const daily = { ...baseRitual, cadence: 'daily' as const };
      prisma.ritual.findFirst.mockResolvedValue(daily);
      prisma.householdMember.count.mockResolvedValue(3);
      harmony.applyRitualCompletion.mockResolvedValue(10);
      prisma.ritual.update.mockResolvedValue({ ...daily, status: RitualStatus.completed });
      prisma.ritual.create.mockResolvedValue({});

      await service.complete(proposerScope, 'r1');

      const nextData = prisma.ritual.create.mock.calls[0][0].data;
      const nextDue = (nextData.proposedAt as Date).getTime();
      expect(nextDue - baseRitual.proposedAt.getTime()).toBe(24 * 60 * 60 * 1000);
    });
  });

  describe('remove', () => {
    it('allows an admin to delete any ritual', async () => {
      prisma.ritual.findFirst.mockResolvedValue({
        id: 'r1',
        proposerId: 'u-proposer',
        status: RitualStatus.proposed,
        householdId: 'h1',
      });
      prisma.ritual.delete.mockResolvedValue({});

      await service.remove(adminScope, 'r1');

      expect(prisma.ritual.delete).toHaveBeenCalledWith({ where: { id: 'r1' } });
    });

    it('rejects a plain member from deleting another member ritual', async () => {
      prisma.ritual.findFirst.mockResolvedValue({
        id: 'r1',
        proposerId: 'u-proposer',
        status: RitualStatus.proposed,
        householdId: 'h1',
      });

      await expect(service.remove(otherMemberScope, 'r1')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.ritual.delete).not.toHaveBeenCalled();
    });
  });

  describe('join', () => {
    it('adds the user as a participant when not yet joined', async () => {
      prisma.ritual.findFirst.mockResolvedValue(baseRitual);
      prisma.ritualParticipant.findUnique.mockResolvedValue(null);
      prisma.ritualParticipant.create.mockResolvedValue({});
      const updatedRitual = { ...baseRitual, participants: [{ user: { id: 'u-other', name: 'Other' } }] };
      prisma.ritual.findUniqueOrThrow.mockResolvedValue(updatedRitual);

      await service.join(otherMemberScope, 'r1');

      expect(prisma.ritualParticipant.create).toHaveBeenCalledWith({
        data: { ritualId: 'r1', userId: 'u-other' },
      });
      expect(prisma.ritualParticipant.delete).not.toHaveBeenCalled();
    });

    it('removes the user as a participant when already joined (toggle)', async () => {
      prisma.ritual.findFirst.mockResolvedValue(baseRitual);
      prisma.ritualParticipant.findUnique.mockResolvedValue({ ritualId: 'r1', userId: 'u-other' });
      prisma.ritualParticipant.delete.mockResolvedValue({});
      prisma.ritual.findUniqueOrThrow.mockResolvedValue(baseRitual);

      await service.join(otherMemberScope, 'r1');

      expect(prisma.ritualParticipant.delete).toHaveBeenCalled();
      expect(prisma.ritualParticipant.create).not.toHaveBeenCalled();
    });
  });
});
