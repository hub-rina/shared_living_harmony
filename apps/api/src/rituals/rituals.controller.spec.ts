import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { HouseholdScope } from '@homebuddy/shared';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { RitualsController } from './rituals.controller';
import { RitualsService } from './rituals.service';

const activeMemberScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'member', status: 'active' },
};

const noMembershipScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-stranger',
  systemRole: 'user',
};

const inactiveMemberScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-bob',
  systemRole: 'user',
  membership: { id: 'm-bob', role: 'member', status: 'inactive' },
};

describe('RitualsController', () => {
  let controller: RitualsController;

  const ritualsService = {
    listForHousehold: jest.fn(),
    create: jest.fn(),
    join: jest.fn(),
    complete: jest.fn(),
    remove: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [RitualsController],
      providers: [
        { provide: RitualsService, useValue: ritualsService },
        { provide: HouseholdScopeGuard, useValue: { canActivate: () => true } },
        { provide: RoleGuard, useValue: { canActivate: () => true } },
        Reflector,
      ],
    })
      .overrideGuard(HouseholdScopeGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(RitualsController);
  });

  describe('list', () => {
    it('delegates to rituals.listForHousehold when the caller has membership', async () => {
      ritualsService.listForHousehold.mockResolvedValue([]);

      const result = await controller.list(activeMemberScope);

      expect(ritualsService.listForHousehold).toHaveBeenCalledWith(activeMemberScope);
      expect(result).toEqual([]);
    });

    it('throws ForbiddenException when the caller has no membership', () => {
      expect(() => controller.list(noMembershipScope)).toThrow(ForbiddenException);
      expect(ritualsService.listForHousehold).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const input = {
      type: 'meal' as const,
      title: 'Sunday brunch',
      proposedAt: new Date(Date.now() + 86_400_000).toISOString(),
    };

    it('delegates to rituals.create when the caller is an active member', async () => {
      ritualsService.create.mockResolvedValue({ id: 'r1' });

      const result = await controller.create(activeMemberScope, input);

      expect(ritualsService.create).toHaveBeenCalledWith(activeMemberScope, input);
      expect(result).toEqual({ id: 'r1' });
    });

    it('throws ForbiddenException when the caller membership is inactive', () => {
      expect(() => controller.create(inactiveMemberScope, input)).toThrow(ForbiddenException);
      expect(ritualsService.create).not.toHaveBeenCalled();
    });
  });
});
