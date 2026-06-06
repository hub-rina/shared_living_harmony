import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { HouseholdScope } from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SmartRotationService } from '../tasks/smart-rotation.service';
import { HouseholdsService } from './households.service';

const adminScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'admin', status: 'active' },
};

const memberScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-bob',
  systemRole: 'user',
  membership: { id: 'm-bob', role: 'member', status: 'active' },
};

const inactiveMemberScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-bob',
  systemRole: 'user',
  membership: { id: 'm-bob', role: 'member', status: 'inactive' },
};

const noMembershipScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-stranger',
  systemRole: 'user',
};

describe('HouseholdsService', () => {
  let service: HouseholdsService;

  const prisma = {
    household: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    householdMember: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    landlordProperty: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
    membershipStatusLog: {
      create: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const rotation = {
    pickAssignee: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (cb: (tx: typeof prisma) => unknown) => cb(prisma));

    const moduleRef = await Test.createTestingModule({
      providers: [
        HouseholdsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmartRotationService, useValue: rotation },
      ],
    }).compile();

    service = moduleRef.get(HouseholdsService);
  });

  describe('create', () => {
    it('creates a household with the caller as admin member and a join code', async () => {
      prisma.household.findUnique.mockResolvedValue(null);
      prisma.household.create.mockImplementation(({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({ id: 'h1', ...data }),
      );

      const result = await service.create('u-alice', { name: 'Flat 3B' });

      const createArgs = prisma.household.create.mock.calls[0][0];
      expect(createArgs.data.name).toBe('Flat 3B');
      expect(createArgs.data.members.create).toEqual({ userId: 'u-alice', role: 'admin' });
      expect(createArgs.data.joinCode).toMatch(/^[A-Z0-9]+$/);
      expect(result).toMatchObject({ id: 'h1', name: 'Flat 3B' });
    });
  });

  describe('invite', () => {
    it('creates a member when the user exists and is not already a member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-charlie', name: 'Charlie', email: 'charlie@example.com' });
      prisma.householdMember.findUnique.mockResolvedValueOnce(null);
      prisma.landlordProperty.findUnique.mockResolvedValue(null);
      prisma.householdMember.create.mockResolvedValue({
        id: 'm-charlie',
        userId: 'u-charlie',
        householdId: 'h1',
        role: 'member',
        user: { id: 'u-charlie', name: 'Charlie', email: 'charlie@example.com' },
      });

      const result = await service.invite(adminScope, { email: 'charlie@example.com' });

      expect(prisma.householdMember.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { userId: 'u-charlie', householdId: 'h1', role: 'member', status: 'invited' },
        }),
      );
      expect(result).toMatchObject({ userId: 'u-charlie' });
    });

    it('throws 404 when no user has that email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.invite(adminScope, { email: 'nobody@example.com' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prisma.householdMember.create).not.toHaveBeenCalled();
    });

    it('throws 409 when the user is already a member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-bob', name: 'Bob', email: 'bob@example.com' });
      prisma.householdMember.findUnique.mockResolvedValueOnce({ id: 'm-bob' });

      await expect(service.invite(adminScope, { email: 'bob@example.com' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws 409 when the user is already the landlord', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-ll', name: 'Landlord', email: 'll@example.com' });
      prisma.householdMember.findUnique.mockResolvedValueOnce(null);
      prisma.landlordProperty.findUnique.mockResolvedValue({ id: 'lp1' });

      await expect(service.invite(adminScope, { email: 'll@example.com' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws 403 when caller is not an admin', async () => {
      await expect(service.invite(memberScope, { email: 'x@example.com' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('removeMember', () => {
    it('removes a plain member successfully', async () => {
      prisma.householdMember.findFirst.mockResolvedValue({ id: 'm-bob', role: 'member', status: 'active' });
      prisma.householdMember.count.mockResolvedValue(1);
      prisma.householdMember.delete.mockResolvedValue(undefined);

      await service.removeMember(adminScope, 'm-bob');

      expect(prisma.householdMember.delete).toHaveBeenCalledWith({ where: { id: 'm-bob' } });
    });

    it('throws 403 when trying to remove the last active admin', async () => {
      prisma.householdMember.findFirst.mockResolvedValue({ id: 'm-alice', role: 'admin', status: 'active' });
      prisma.householdMember.count.mockResolvedValue(1);

      await expect(service.removeMember(adminScope, 'm-alice')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.householdMember.delete).not.toHaveBeenCalled();
    });

    it('removes an admin when there are two active admins', async () => {
      prisma.householdMember.findFirst.mockResolvedValue({ id: 'm-other-admin', role: 'admin', status: 'active' });
      prisma.householdMember.count.mockResolvedValue(2);
      prisma.householdMember.delete.mockResolvedValue(undefined);

      await service.removeMember(adminScope, 'm-other-admin');

      expect(prisma.householdMember.delete).toHaveBeenCalledWith({ where: { id: 'm-other-admin' } });
    });

    it('throws 404 when the member does not exist in the household', async () => {
      prisma.householdMember.findFirst.mockResolvedValue(null);

      await expect(service.removeMember(adminScope, 'm-ghost')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('changeMemberRole', () => {
    it('promotes a member to admin', async () => {
      prisma.householdMember.findFirst.mockResolvedValue({ id: 'm-bob', role: 'member', status: 'active' });
      prisma.householdMember.count.mockResolvedValue(1);
      prisma.householdMember.update.mockResolvedValue({ id: 'm-bob', role: 'admin' });

      const result = await service.changeMemberRole(adminScope, 'm-bob', 'admin');

      expect(prisma.householdMember.update).toHaveBeenCalledWith({
        where: { id: 'm-bob' },
        data: { role: 'admin' },
      });
      expect(result).toMatchObject({ role: 'admin' });
    });

    it('throws 403 when demoting the last active admin', async () => {
      prisma.householdMember.findFirst.mockResolvedValue({ id: 'm-alice', role: 'admin', status: 'active' });
      prisma.householdMember.count.mockResolvedValue(1);

      await expect(service.changeMemberRole(adminScope, 'm-alice', 'member')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prisma.householdMember.update).not.toHaveBeenCalled();
    });

    it('demotes an admin to member when there are two active admins', async () => {
      prisma.householdMember.findFirst.mockResolvedValue({ id: 'm-other-admin', role: 'admin', status: 'active' });
      prisma.householdMember.count.mockResolvedValue(2);
      prisma.householdMember.update.mockResolvedValue({ id: 'm-other-admin', role: 'member' });

      await service.changeMemberRole(adminScope, 'm-other-admin', 'member');

      expect(prisma.householdMember.update).toHaveBeenCalledWith({
        where: { id: 'm-other-admin' },
        data: { role: 'member' },
      });
    });

    it('throws 400 when the member already has that role', async () => {
      prisma.householdMember.findFirst.mockResolvedValue({ id: 'm-bob', role: 'member', status: 'active' });

      await expect(service.changeMemberRole(adminScope, 'm-bob', 'member')).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('throws 404 when the member does not exist', async () => {
      prisma.householdMember.findFirst.mockResolvedValue(null);

      await expect(service.changeMemberRole(adminScope, 'm-ghost', 'admin')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('linkLandlord', () => {
    it('links a user as landlord when they exist and are not a member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-ll' });
      prisma.householdMember.findUnique.mockResolvedValue(null);
      prisma.landlordProperty.upsert.mockResolvedValue({ id: 'lp1', landlordId: 'u-ll', householdId: 'h1' });

      const result = await service.linkLandlord(adminScope, { email: 'll@example.com' });

      expect(prisma.landlordProperty.upsert).toHaveBeenCalled();
      expect(result).toMatchObject({ landlordId: 'u-ll' });
    });

    it('throws 409 when the email belongs to an existing member', async () => {
      prisma.user.findUnique.mockResolvedValue({ id: 'u-bob' });
      prisma.householdMember.findUnique.mockResolvedValue({ id: 'm-bob' });

      await expect(service.linkLandlord(adminScope, { email: 'bob@example.com' })).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('throws 404 when no user has that email', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.linkLandlord(adminScope, { email: 'nobody@example.com' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('throws 403 when caller is not an admin', async () => {
      await expect(service.linkLandlord(memberScope, { email: 'll@example.com' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    });
  });

  describe('updateLandlordLink', () => {
    it('updates mode and consent on the link', async () => {
      prisma.landlordProperty.update.mockResolvedValue({ id: 'lp1' });

      await service.updateLandlordLink(adminScope, 'u-ll', {
        mode: 'caretaker',
        consentGranted: true,
      });

      expect(prisma.landlordProperty.update).toHaveBeenCalledWith({
        where: { landlordId_householdId: { landlordId: 'u-ll', householdId: 'h1' } },
        data: { mode: 'caretaker', consentGranted: true },
      });
    });

    it('only writes the fields provided', async () => {
      prisma.landlordProperty.update.mockResolvedValue({ id: 'lp1' });

      await service.updateLandlordLink(adminScope, 'u-ll', { consentGranted: false });

      expect(prisma.landlordProperty.update).toHaveBeenCalledWith({
        where: { landlordId_householdId: { landlordId: 'u-ll', householdId: 'h1' } },
        data: { consentGranted: false },
      });
    });

    it('throws 404 when no link exists', async () => {
      prisma.landlordProperty.update.mockRejectedValue({ code: 'P2025' });

      await expect(
        service.updateLandlordLink(adminScope, 'u-ghost', { consentGranted: true }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when caller is not an admin', async () => {
      await expect(
        service.updateLandlordLink(noMembershipScope, 'u-ll', { consentGranted: true }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('unlinkLandlord', () => {
    it('deletes the landlord link', async () => {
      prisma.landlordProperty.delete.mockResolvedValue({ id: 'lp1' });

      await service.unlinkLandlord(adminScope, 'u-ll');

      expect(prisma.landlordProperty.delete).toHaveBeenCalledWith({
        where: { landlordId_householdId: { landlordId: 'u-ll', householdId: 'h1' } },
      });
    });

    it('throws 404 when no link exists', async () => {
      prisma.landlordProperty.delete.mockRejectedValue({ code: 'P2025' });

      await expect(service.unlinkLandlord(adminScope, 'u-ghost')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('throws 403 when caller is not an admin', async () => {
      await expect(service.unlinkLandlord(noMembershipScope, 'u-ll')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('setSelfInactive', () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    const nextMonth = new Date(tomorrow);
    nextMonth.setUTCDate(nextMonth.getUTCDate() + 30);

    const validInput = {
      from: tomorrow.toISOString(),
      until: nextMonth.toISOString(),
      reason: 'vacation',
    };

    it('writes member row, log, and reassigns pending tasks', async () => {
      prisma.householdMember.count.mockResolvedValue(2);
      prisma.householdMember.update.mockResolvedValue({ id: 'm-bob', status: 'inactive' });
      prisma.membershipStatusLog.create.mockResolvedValue({});
      prisma.task.findMany.mockResolvedValue([
        { id: 't1', title: 'Dishes', weight: 'light', status: 'pending' },
      ]);
      prisma.user.findUniqueOrThrow.mockResolvedValue({ name: 'Bob' });
      rotation.pickAssignee.mockResolvedValue({ userId: 'u-alice', tieBreak: 'lowest_score', reason: '' });
      prisma.task.update.mockResolvedValue({});

      await service.setSelfInactive(memberScope, validInput);

      expect(prisma.householdMember.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'inactive' }) }),
      );
      expect(prisma.membershipStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: 'active', toStatus: 'inactive' }),
        }),
      );
      expect(rotation.pickAssignee).toHaveBeenCalledWith('h1', 'Dishes', 'light', { excludeUserId: 'u-bob' });
      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ assigneeId: 'u-alice' }) }),
      );
    });

    it('throws 400 when inactive window is invalid', async () => {
      const badInput = { from: nextMonth.toISOString(), until: tomorrow.toISOString() };

      await expect(service.setSelfInactive(memberScope, badInput)).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.householdMember.update).not.toHaveBeenCalled();
    });

    it('throws 403 when caller is the sole active admin', async () => {
      prisma.householdMember.count.mockResolvedValue(1);

      await expect(service.setSelfInactive(adminScope, validInput)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.householdMember.update).not.toHaveBeenCalled();
    });
  });

  describe('endOwnInactive', () => {
    it('flips status to active and writes log', async () => {
      const memberRow = {
        id: 'm-bob',
        status: 'inactive',
        inactiveFrom: new Date('2026-06-01'),
        inactiveUntil: new Date('2026-06-30'),
      };
      prisma.householdMember.findUniqueOrThrow.mockResolvedValue(memberRow);
      prisma.householdMember.update.mockResolvedValue({ id: 'm-bob', status: 'active' });
      prisma.membershipStatusLog.create.mockResolvedValue({});

      const result = await service.endOwnInactive(inactiveMemberScope);

      expect(prisma.householdMember.update).toHaveBeenCalledWith({
        where: { id: 'm-bob' },
        data: { status: 'active', inactiveFrom: null, inactiveUntil: null, inactiveReason: null },
      });
      expect(prisma.membershipStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: 'inactive', toStatus: 'active', reason: 'self-end' }),
        }),
      );
      expect(result).toMatchObject({ status: 'active' });
    });

    it('throws 403 when caller is not inactive', async () => {
      await expect(service.endOwnInactive(memberScope)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.householdMember.update).not.toHaveBeenCalled();
    });
  });

  describe('forceEndOther', () => {
    it('throws 403 when caller is not an admin', async () => {
      await expect(service.forceEndOther(memberScope, 'm-bob')).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.householdMember.update).not.toHaveBeenCalled();
    });

    it('throws 404 when memberId not in household', async () => {
      prisma.householdMember.findFirst.mockResolvedValue(null);

      await expect(service.forceEndOther(adminScope, 'm-ghost')).rejects.toBeInstanceOf(NotFoundException);
      expect(prisma.householdMember.update).not.toHaveBeenCalled();
    });

    it('throws 400 when target member is not inactive', async () => {
      prisma.householdMember.findFirst.mockResolvedValue({ id: 'm-bob', status: 'active' });

      await expect(service.forceEndOther(adminScope, 'm-bob')).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.householdMember.update).not.toHaveBeenCalled();
    });

    it('reactivates an inactive member and writes log', async () => {
      const targetRow = {
        id: 'm-bob',
        status: 'inactive',
        inactiveFrom: new Date('2026-06-01'),
        inactiveUntil: new Date('2026-06-30'),
      };
      prisma.householdMember.findFirst.mockResolvedValue(targetRow);
      prisma.householdMember.update.mockResolvedValue({ id: 'm-bob', status: 'active' });
      prisma.membershipStatusLog.create.mockResolvedValue({});

      const result = await service.forceEndOther(adminScope, 'm-bob');

      expect(prisma.householdMember.update).toHaveBeenCalledWith({
        where: { id: 'm-bob' },
        data: { status: 'active', inactiveFrom: null, inactiveUntil: null, inactiveReason: null },
      });
      expect(prisma.membershipStatusLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ fromStatus: 'inactive', toStatus: 'active', reason: 'admin-end' }),
        }),
      );
      expect(result).toMatchObject({ status: 'active' });
    });
  });
});

describe('HouseholdsService join code', () => {
  let service: HouseholdsService;
  const prisma = {
    household: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    householdMember: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const rotation = { pickAssignee: jest.fn() };
  const aliceNoHouse = { householdId: '', userId: 'u-alice', systemRole: 'user' } as unknown as HouseholdScope;
  const adminScope: HouseholdScope = {
    householdId: 'h1', userId: 'u-alice', systemRole: 'user',
    membership: { id: 'm1', role: 'admin', status: 'active' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        HouseholdsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmartRotationService, useValue: rotation },
      ],
    }).compile();
    service = moduleRef.get(HouseholdsService);
  });

  it('create assigns a join code', async () => {
    prisma.household.findUnique.mockResolvedValue(null);
    prisma.household.create.mockImplementation(({ data }) => Promise.resolve({ id: 'h9', ...data }));
    const house = await service.create('u-alice', { name: 'Kot 12' });
    expect(house.joinCode).toMatch(/^[A-Z0-9]+$/);
    expect(prisma.household.create.mock.calls[0][0].data.members.create).toEqual({ userId: 'u-alice', role: 'admin' });
  });

  it('joinByCode joins a non-member as an active member', async () => {
    prisma.household.findUnique.mockResolvedValue({ id: 'h1', name: 'Demo', joinCode: 'SAGE7K3' });
    prisma.householdMember.findUnique.mockResolvedValue(null);
    prisma.householdMember.create.mockResolvedValue({ id: 'm-new' });
    const house = await service.joinByCode('u-bob', { code: 'sage-7k3' });
    expect(prisma.household.findUnique).toHaveBeenCalledWith({ where: { joinCode: 'SAGE7K3' } });
    expect(prisma.householdMember.create).toHaveBeenCalledWith({
      data: { userId: 'u-bob', householdId: 'h1', role: 'member', status: 'active' },
    });
    expect(house.id).toBe('h1');
  });

  it('joinByCode rejects an unknown code', async () => {
    prisma.household.findUnique.mockResolvedValue(null);
    await expect(service.joinByCode('u-bob', { code: 'NOPE000' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('joinByCode is idempotent for an existing active member', async () => {
    prisma.household.findUnique.mockResolvedValue({ id: 'h1', name: 'Demo', joinCode: 'SAGE7K3' });
    prisma.householdMember.findUnique.mockResolvedValue({ id: 'm1', status: 'active' });
    const house = await service.joinByCode('u-bob', { code: 'SAGE7K3' });
    expect(prisma.householdMember.create).not.toHaveBeenCalled();
    expect(house.id).toBe('h1');
  });

  it('joinByCode reactivates an inactive member', async () => {
    prisma.household.findUnique.mockResolvedValue({ id: 'h1', name: 'Demo', joinCode: 'SAGE7K3' });
    prisma.householdMember.findUnique.mockResolvedValue({ id: 'm1', status: 'inactive' });
    prisma.householdMember.update.mockResolvedValue({ id: 'm1', status: 'active' });
    await service.joinByCode('u-bob', { code: 'SAGE7K3' });
    expect(prisma.householdMember.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { status: 'active', inactiveFrom: null, inactiveUntil: null, inactiveReason: null },
    });
  });

  it('regenerateJoinCode rejects a non-admin', async () => {
    await expect(service.regenerateJoinCode(aliceNoHouse)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('regenerateJoinCode sets a new code for an admin', async () => {
    prisma.household.findUnique.mockResolvedValue(null);
    prisma.household.update.mockImplementation(({ data }) => Promise.resolve({ id: 'h1', joinCode: data.joinCode }));
    const result = await service.regenerateJoinCode(adminScope);
    expect(result.joinCode).toMatch(/^[A-Z0-9]+$/);
    expect(prisma.household.update.mock.calls[0][0].where).toEqual({ id: 'h1' });
  });
});
