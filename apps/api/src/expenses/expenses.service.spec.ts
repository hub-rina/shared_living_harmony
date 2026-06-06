import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { HouseholdScope } from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { OcrService } from '../ocr/ocr.service';
import { StorageService } from '../storage/storage.service';
import { ExpensesService } from './expenses.service';

const aliceScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'member', status: 'active' },
};

const bobScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-bob',
  systemRole: 'user',
  membership: { id: 'm-bob', role: 'member', status: 'active' },
};

const inactiveScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'member', status: 'inactive' },
};

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'e1',
    creatorId: 'u-alice',
    creator: { id: 'u-alice', name: 'Alice' },
    title: 'Groceries',
    note: null,
    totalCents: 4250,
    receiptUrl: null,
    items: [],
    shares: [
      {
        id: 's-bob',
        debtorId: 'u-bob',
        debtor: { id: 'u-bob', name: 'Bob' },
        amountCents: 2125,
        status: 'open',
        proofUrl: null,
        paidAt: null,
        confirmedAt: null,
      },
    ],
    createdAt: new Date('2026-06-06T10:00:00Z'),
    ...overrides,
  };
}

describe('ExpensesService', () => {
  let service: ExpensesService;

  const prisma = {
    expense: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    expenseShare: { findFirst: jest.fn(), update: jest.fn(), deleteMany: jest.fn(), createMany: jest.fn() },
    expenseItem: { deleteMany: jest.fn(), createMany: jest.fn() },
    householdMember: { findMany: jest.fn() },
    $transaction: jest.fn(),
  };
  const storage = { decodeDataUrl: jest.fn(), store: jest.fn() };
  const ocr = { read: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ExpensesService,
        { provide: PrismaService, useValue: prisma },
        { provide: StorageService, useValue: storage },
        { provide: OcrService, useValue: ocr },
      ],
    }).compile();
    service = moduleRef.get(ExpensesService);
  });

  describe('create', () => {
    it('splits across all sharers and drops the creator portion', async () => {
      prisma.householdMember.findMany.mockResolvedValue([{ userId: 'u-alice' }, { userId: 'u-bob' }]);
      prisma.expense.create.mockResolvedValue(buildRow());

      const result = await service.create(aliceScope, {
        title: 'Groceries',
        totalCents: 4250,
        includedMemberIds: ['u-alice', 'u-bob'],
      });

      const createArg = prisma.expense.create.mock.calls[0][0];
      expect(createArg.data.shares.create).toEqual([{ debtorId: 'u-bob', amountCents: 2125 }]);
      expect(result.creatorName).toBe('Alice');
      expect(result.shares[0].debtorName).toBe('Bob');
      expect(result).not.toHaveProperty('householdId');
    });

    it('forbids an inactive member from creating a bill', async () => {
      await expect(
        service.create(inactiveScope, {
          title: 'x',
          totalCents: 100,
          includedMemberIds: ['u-bob'],
        }),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects a debtor who is not a member of the house', async () => {
      prisma.householdMember.findMany.mockResolvedValue([]);
      await expect(
        service.create(aliceScope, {
          title: 'x',
          totalCents: 100,
          includedMemberIds: ['u-ghost'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a split with no one but the creator', async () => {
      await expect(
        service.create(aliceScope, {
          title: 'x',
          totalCents: 100,
          includedMemberIds: ['u-alice'],
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('markPaid', () => {
    it('lets only the debtor mark their share paid', async () => {
      prisma.expense.findFirst.mockResolvedValue(buildRow());
      prisma.expenseShare.findFirst.mockResolvedValue({ id: 's-bob', debtorId: 'u-bob', status: 'open' });
      prisma.expenseShare.update.mockResolvedValue({});

      await service.markPaid(bobScope, 'e1', 's-bob');

      expect(prisma.expenseShare.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 's-bob' }, data: expect.objectContaining({ status: 'paid' }) }),
      );
    });

    it('forbids a non-debtor from marking the share paid', async () => {
      prisma.expense.findFirst.mockResolvedValue(buildRow());
      prisma.expenseShare.findFirst.mockResolvedValue({ id: 's-bob', debtorId: 'u-bob', status: 'open' });

      await expect(service.markPaid(aliceScope, 'e1', 's-bob')).rejects.toBeInstanceOf(ForbiddenException);
    });
  });

  describe('confirm', () => {
    it('lets only the creator confirm a paid share', async () => {
      prisma.expense.findFirst.mockResolvedValue(buildRow());
      prisma.expenseShare.findFirst.mockResolvedValue({ id: 's-bob', debtorId: 'u-bob', status: 'paid' });
      prisma.expenseShare.update.mockResolvedValue({});

      await service.confirm(aliceScope, 'e1', 's-bob');

      expect(prisma.expenseShare.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'confirmed' }) }),
      );
    });

    it('forbids a non-creator from confirming', async () => {
      prisma.expense.findFirst.mockResolvedValue(buildRow());
      await expect(service.confirm(bobScope, 'e1', 's-bob')).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('rejects confirming a share that has not been paid', async () => {
      prisma.expense.findFirst.mockResolvedValue(buildRow());
      prisma.expenseShare.findFirst.mockResolvedValue({ id: 's-bob', debtorId: 'u-bob', status: 'open' });
      await expect(service.confirm(aliceScope, 'e1', 's-bob')).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('update', () => {
    it('blocks changing the total once a share has been paid', async () => {
      prisma.expense.findFirst.mockResolvedValue(
        buildRow({ shares: [{ id: 's-bob', debtorId: 'u-bob', debtor: { id: 'u-bob', name: 'Bob' }, amountCents: 2125, status: 'paid', proofUrl: null, paidAt: new Date(), confirmedAt: null }] }),
      );
      await expect(
        service.update(aliceScope, 'e1', { totalCents: 9999 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('list', () => {
    it('returns a NotFound when an expense is in another household', async () => {
      prisma.expense.findFirst.mockResolvedValue(null);
      await expect(service.remove(aliceScope, 'ghost')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
