import { NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { TaskStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { LandlordService } from './landlord.service';

const LANDLORD_ID = 'u-landlord';
const PROPERTY_ID = 'prop-1';
const HOUSEHOLD_ID = 'h-1';
const LINKED_AT = new Date('2024-01-01T00:00:00.000Z');

const buildLink = (overrides: Record<string, unknown> = {}) => ({
  id: PROPERTY_ID,
  landlordId: LANDLORD_ID,
  mode: 'observer',
  linkedAt: LINKED_AT,
  household: {
    id: HOUSEHOLD_ID,
    name: 'Flat 3B',
    harmonyScore: 80,
    _count: { tasks: 0 },
    members: [
      { status: 'active' },
      { status: 'inactive' },
    ],
  },
  ...overrides,
});

describe('LandlordService', () => {
  let service: LandlordService;

  const prisma = {
    landlordProperty: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    task: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    householdMember: {
      findMany: jest.fn(),
    },
    messFlag: {
      count: jest.fn(),
    },
    maintenanceRequest: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const moduleRef = await Test.createTestingModule({
      providers: [LandlordService, { provide: PrismaService, useValue: prisma }],
    }).compile();

    service = moduleRef.get(LandlordService);
  });

  describe('listProperties', () => {
    it('returns mapped PropertyMetrics for each consented household', async () => {
      prisma.landlordProperty.findMany.mockResolvedValue([
        {
          id: PROPERTY_ID,
          landlordId: LANDLORD_ID,
          mode: 'observer',
          linkedAt: LINKED_AT,
          household: {
            id: HOUSEHOLD_ID,
            name: 'Flat 3B',
            harmonyScore: 80,
            _count: { members: 3, tasks: 1 },
          },
        },
      ]);

      const result = await service.listProperties(LANDLORD_ID);

      expect(result).toEqual([
        {
          householdId: HOUSEHOLD_ID,
          name: 'Flat 3B',
          healthScore: 80,
          churnRisk: 'low',
          overdueCount: 1,
          memberCount: 3,
          mode: 'observer',
          linkedAt: LINKED_AT.toISOString(),
        },
      ]);

      expect(prisma.landlordProperty.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { landlordId: LANDLORD_ID, consentGranted: true } }),
      );
    });
  });

  describe('getPropertyDetail', () => {
    it('returns aggregate member counts, never individual names', async () => {
      prisma.landlordProperty.findFirst.mockResolvedValue(buildLink());

      const result = await service.getPropertyDetail(LANDLORD_ID, PROPERTY_ID);

      expect(result).toEqual({
        propertyId: PROPERTY_ID,
        householdId: HOUSEHOLD_ID,
        name: 'Flat 3B',
        healthScore: 80,
        churnRisk: 'low',
        overdueCount: 0,
        memberCount: 2,
        activeCount: 1,
        inactiveCount: 1,
        mode: 'observer',
        linkedAt: LINKED_AT.toISOString(),
      });
      expect(JSON.stringify(result)).not.toMatch(/Alice|Bob/);

      expect(prisma.landlordProperty.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROPERTY_ID, landlordId: LANDLORD_ID, consentGranted: true },
        }),
      );
    });

    it('throws NotFoundException when the property is not consented or not found', async () => {
      prisma.landlordProperty.findFirst.mockResolvedValue(null);

      await expect(service.getPropertyDetail(LANDLORD_ID, 'unknown-prop')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('getPropertyInsights', () => {
    it('returns aggregate insights without any tenant names', async () => {
      prisma.landlordProperty.findFirst.mockResolvedValue({
        id: PROPERTY_ID,
        household: { id: HOUSEHOLD_ID, harmonyScore: 35 },
      });
      const dueAt = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      prisma.task.findMany
        .mockResolvedValueOnce([{ id: 't1', title: 'Vacuum', dueAt }])
        .mockResolvedValueOnce([
          { completedById: 'u-alice', completedAt: new Date('2026-05-10T00:00:00Z') },
          { completedById: 'u-alice', completedAt: new Date('2026-05-12T00:00:00Z') },
        ]);
      prisma.householdMember.findMany.mockResolvedValue([
        { user: { id: 'u-alice' } },
        { user: { id: 'u-bob' } },
      ]);
      prisma.messFlag.count.mockResolvedValue(4);
      prisma.task.count.mockResolvedValue(6);

      const result = await service.getPropertyInsights(LANDLORD_ID, PROPERTY_ID);

      expect(result.churnRisk).toBe('high');
      expect(result.churnRiskFactors.length).toBeGreaterThan(0);
      expect(result.overdueTasks).toEqual([
        { id: 't1', title: 'Vacuum', dueAt: dueAt.toISOString(), daysOverdue: 3 },
      ]);
      // Only Alice contributed; Bob did nothing -> uneven, 1 of 2 active.
      expect(result.contributionBalance).toEqual({
        spread: 'uneven',
        activeContributors: 1,
        totalMembers: 2,
      });
      expect(result.recentMessFlagCount).toBe(4);
      expect(JSON.stringify(result)).not.toMatch(/Alice|Bob/);
      expect(prisma.landlordProperty.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PROPERTY_ID, landlordId: LANDLORD_ID, consentGranted: true },
        }),
      );
    });

    it('reports an even spread when every member has contributed', async () => {
      prisma.landlordProperty.findFirst.mockResolvedValue({
        id: PROPERTY_ID,
        household: { id: HOUSEHOLD_ID, harmonyScore: 90 },
      });
      prisma.task.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { completedById: 'u-alice', completedAt: new Date('2026-05-10T00:00:00Z') },
          { completedById: 'u-bob', completedAt: new Date('2026-05-11T00:00:00Z') },
        ]);
      prisma.householdMember.findMany.mockResolvedValue([
        { user: { id: 'u-alice' } },
        { user: { id: 'u-bob' } },
      ]);
      prisma.messFlag.count.mockResolvedValue(0);
      prisma.task.count.mockResolvedValue(0);

      const result = await service.getPropertyInsights(LANDLORD_ID, PROPERTY_ID);

      expect(result.contributionBalance).toEqual({
        spread: 'even',
        activeContributors: 2,
        totalMembers: 2,
      });
    });

    it('throws NotFoundException when property does not belong to landlord', async () => {
      prisma.landlordProperty.findFirst.mockResolvedValue(null);
      await expect(
        service.getPropertyInsights(LANDLORD_ID, 'unknown-prop'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('getPropertyMaintenance', () => {
    it('returns only resident-escalated requests, never the full log (Privacy Line)', async () => {
      prisma.landlordProperty.findFirst.mockResolvedValue({
        household: { id: HOUSEHOLD_ID },
      });
      prisma.maintenanceRequest.findMany.mockResolvedValue([
        {
          id: 'm1',
          title: 'Mold in bathroom',
          category: 'Mold / damp',
          status: 'open',
          escalated: true,
          createdAt: LINKED_AT,
          updatedAt: LINKED_AT,
        },
      ]);

      const result = await service.getPropertyMaintenance(LANDLORD_ID, PROPERTY_ID);

      expect(prisma.maintenanceRequest.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { householdId: HOUSEHOLD_ID, escalated: true },
        }),
      );
      expect(result).toHaveLength(1);
      expect(result[0]).not.toHaveProperty('reporterId');
    });

    it('throws NotFoundException when the property is not consented', async () => {
      prisma.landlordProperty.findFirst.mockResolvedValue(null);
      await expect(
        service.getPropertyMaintenance(LANDLORD_ID, 'unknown-prop'),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
