import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { HouseholdScope } from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MaintenanceService } from './maintenance.service';

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

const row = {
  id: 'r1',
  title: 'Boiler not heating',
  category: 'Heating / boiler',
  status: 'open',
  escalated: false,
  createdAt: new Date('2026-05-20T10:00:00Z'),
  updatedAt: new Date('2026-05-20T10:00:00Z'),
};

describe('MaintenanceService', () => {
  let service: MaintenanceService;

  const prisma = {
    maintenanceRequest: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [MaintenanceService, { provide: PrismaService, useValue: prisma }],
    }).compile();
    service = moduleRef.get(MaintenanceService);
  });

  it('creates a request from the reporting tenant and serialises dates', async () => {
    prisma.maintenanceRequest.create.mockResolvedValue(row);

    const result = await service.create(activeScope, { title: 'Boiler not heating' });

    expect(prisma.maintenanceRequest.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          householdId: 'h1',
          reporterId: 'u-alice',
          title: 'Boiler not heating',
        }),
      }),
    );
    expect(result.createdAt).toBe('2026-05-20T10:00:00.000Z');
    expect(result).not.toHaveProperty('reporterId');
  });

  it('forbids inactive members from raising a request', async () => {
    await expect(service.create(inactiveScope, { title: 'x' })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('updates status only for a request in the household', async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue(row);
    prisma.maintenanceRequest.update.mockResolvedValue({ ...row, status: 'resolved' });

    const result = await service.updateStatus(activeScope, 'r1', 'resolved' as never);

    expect(result.status).toBe('resolved');
  });

  it('throws NotFound when the request is in another household', async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue(null);
    await expect(service.updateStatus(activeScope, 'ghost', 'resolved' as never)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('escalates a request so the landlord can see it, and exposes the flag', async () => {
    prisma.maintenanceRequest.findFirst.mockResolvedValue(row);
    prisma.maintenanceRequest.update.mockResolvedValue({ ...row, escalated: true });

    const result = await service.setEscalation(activeScope, 'r1', true);

    expect(prisma.maintenanceRequest.update).toHaveBeenCalledWith({
      where: { id: 'r1' },
      data: { escalated: true },
    });
    expect(result.escalated).toBe(true);
  });

  it('forbids inactive members from changing escalation', async () => {
    await expect(service.setEscalation(inactiveScope, 'r1', true)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
