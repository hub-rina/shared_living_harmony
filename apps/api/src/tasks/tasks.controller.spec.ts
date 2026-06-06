import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import type { HouseholdScope } from '@homebuddy/shared';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { TasksController } from './tasks.controller';
import { TasksService } from './tasks.service';

const activeMemberScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'admin', status: 'active' },
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

const plainMemberScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-charlie',
  systemRole: 'user',
  membership: { id: 'm-charlie', role: 'member', status: 'active' },
};

describe('TasksController', () => {
  let controller: TasksController;
  const tasksService = {
    listForHousehold: jest.fn(),
    listAssignedToMe: jest.fn(),
    create: jest.fn(),
    flagMess: jest.fn(),
    complete: jest.fn(),
    remove: jest.fn(),
    reassign: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [TasksController],
      providers: [
        { provide: TasksService, useValue: tasksService },
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
    controller = moduleRef.get(TasksController);
  });

  describe('list', () => {
    it('delegates to tasks.listForHousehold when the caller has membership', async () => {
      tasksService.listForHousehold.mockResolvedValue([]);

      const result = await controller.list(activeMemberScope);

      expect(tasksService.listForHousehold).toHaveBeenCalledWith(activeMemberScope);
      expect(result).toEqual([]);
    });

    it('throws ForbiddenException when the caller has no membership', () => {
      expect(() => controller.list(noMembershipScope)).toThrow(ForbiddenException);
      expect(tasksService.listForHousehold).not.toHaveBeenCalled();
    });
  });

  describe('create', () => {
    const input = {
      title: 'Clean kitchen',
      weight: 'light' as const,
      dueAt: new Date(Date.now() + 86_400_000).toISOString(),
    };

    it('delegates to tasks.create when the caller is an active member', async () => {
      tasksService.create.mockResolvedValue({ id: 't1' });

      const result = await controller.create(activeMemberScope, input);

      expect(tasksService.create).toHaveBeenCalledWith(activeMemberScope, input);
      expect(result).toEqual({ id: 't1' });
    });

    it('throws ForbiddenException when the caller membership is inactive', () => {
      expect(() => controller.create(inactiveMemberScope, input)).toThrow(ForbiddenException);
      expect(tasksService.create).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('calls tasks.remove with scope when the caller is an admin', async () => {
      tasksService.remove.mockResolvedValue(undefined);

      await controller.remove(activeMemberScope, 't1');

      expect(tasksService.remove).toHaveBeenCalledWith(activeMemberScope, 't1');
    });

    it('delegates policy check to tasks.remove for plain members — service enforces the rule', async () => {
      const forbiddenError = new ForbiddenException();
      tasksService.remove.mockRejectedValue(forbiddenError);

      await expect(controller.remove(plainMemberScope, 't99')).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(tasksService.remove).toHaveBeenCalledWith(plainMemberScope, 't99');
    });
  });
});
