import { Test } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import type { HouseholdScope } from '@homebuddy/shared';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { HouseholdScopeGuard } from '../common/guards/household-scope.guard';
import { RoleGuard } from '../common/guards/role.guard';
import { HouseholdScopedController, HouseholdsController } from './households.controller';
import { HouseholdsService } from './households.service';

const authUser = { id: 'u-alice', email: 'alice@example.com', systemRole: 'user' as const };

const adminScope: HouseholdScope = {
  householdId: 'h1',
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'admin', status: 'active' },
};

describe('HouseholdsController (no householdId)', () => {
  let controller: HouseholdsController;
  const householdsService = {
    listForUser: jest.fn(),
    create: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [HouseholdsController],
      providers: [
        { provide: HouseholdsService, useValue: householdsService },
        { provide: JwtAuthGuard, useValue: { canActivate: () => true } },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(HouseholdsController);
  });

  describe('list', () => {
    it('delegates to householdsService.listForUser with the caller id', async () => {
      householdsService.listForUser.mockResolvedValue([{ id: 'h1' }]);

      const result = await controller.list(authUser);

      expect(householdsService.listForUser).toHaveBeenCalledWith('u-alice');
      expect(result).toEqual([{ id: 'h1' }]);
    });
  });

  describe('create', () => {
    it('delegates to householdsService.create with caller id and input', async () => {
      const input = { name: 'Flat 3B' };
      householdsService.create.mockResolvedValue({ id: 'h1', name: 'Flat 3B' });

      const result = await controller.create(authUser, input);

      expect(householdsService.create).toHaveBeenCalledWith('u-alice', input);
      expect(result).toMatchObject({ name: 'Flat 3B' });
    });
  });
});

describe('HouseholdScopedController', () => {
  let controller: HouseholdScopedController;
  const householdsService = {
    getForScope: jest.fn(),
    getScopeView: jest.fn(),
    updateSettings: jest.fn(),
    remove: jest.fn(),
    invite: jest.fn(),
    removeMember: jest.fn(),
    changeMemberRole: jest.fn(),
    linkLandlord: jest.fn(),
    unlinkLandlord: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      controllers: [HouseholdScopedController],
      providers: [
        { provide: HouseholdsService, useValue: householdsService },
        { provide: HouseholdScopeGuard, useValue: { canActivate: () => true } },
        { provide: RoleGuard, useValue: { canActivate: () => true } },
        Reflector,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(HouseholdScopeGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RoleGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = moduleRef.get(HouseholdScopedController);
  });

  describe('get', () => {
    it('delegates to getForScope with the scope', async () => {
      const household = { id: 'h1', name: 'Flat 3B', members: [] };
      householdsService.getForScope.mockResolvedValue(household);

      const result = await controller.get(adminScope);

      expect(householdsService.getForScope).toHaveBeenCalledWith(adminScope);
      expect(result).toEqual(household);
    });
  });

  describe('me', () => {
    it('returns the scope view from getScopeView', () => {
      householdsService.getScopeView.mockReturnValue({ scope: adminScope });

      const result = controller.me(adminScope);

      expect(householdsService.getScopeView).toHaveBeenCalledWith(adminScope);
      expect(result).toEqual({ scope: adminScope });
    });
  });

  describe('update', () => {
    it('delegates to updateSettings with scope and input', async () => {
      householdsService.updateSettings.mockResolvedValue({ id: 'h1', name: 'New Name' });

      const result = await controller.update(adminScope, { name: 'New Name' });

      expect(householdsService.updateSettings).toHaveBeenCalledWith(adminScope, { name: 'New Name' });
      expect(result).toMatchObject({ name: 'New Name' });
    });
  });

  describe('remove', () => {
    it('delegates to remove with the scope', async () => {
      householdsService.remove.mockResolvedValue(undefined);

      await controller.remove(adminScope);

      expect(householdsService.remove).toHaveBeenCalledWith(adminScope);
    });
  });

  describe('invite', () => {
    it('delegates to invite with scope and input', async () => {
      const member = { id: 'm-charlie', userId: 'u-charlie' };
      householdsService.invite.mockResolvedValue(member);

      const result = await controller.invite(adminScope, { email: 'charlie@example.com' });

      expect(householdsService.invite).toHaveBeenCalledWith(adminScope, { email: 'charlie@example.com' });
      expect(result).toEqual(member);
    });
  });

  describe('removeMember', () => {
    it('delegates to removeMember with scope and memberId', async () => {
      householdsService.removeMember.mockResolvedValue(undefined);

      await controller.removeMember(adminScope, 'm-bob');

      expect(householdsService.removeMember).toHaveBeenCalledWith(adminScope, 'm-bob');
    });
  });

  describe('changeRole', () => {
    it('delegates to changeMemberRole with scope, memberId and new role', async () => {
      householdsService.changeMemberRole.mockResolvedValue({ id: 'm-bob', role: 'admin' });

      const result = await controller.changeRole(adminScope, 'm-bob', { role: 'admin' });

      expect(householdsService.changeMemberRole).toHaveBeenCalledWith(adminScope, 'm-bob', 'admin');
      expect(result).toMatchObject({ role: 'admin' });
    });
  });

  describe('linkLandlord', () => {
    it('delegates to linkLandlord with scope and input', async () => {
      const link = { id: 'lp1', landlordId: 'u-ll', householdId: 'h1' };
      householdsService.linkLandlord.mockResolvedValue(link);

      const result = await controller.linkLandlord(adminScope, { email: 'll@example.com' });

      expect(householdsService.linkLandlord).toHaveBeenCalledWith(adminScope, { email: 'll@example.com' });
      expect(result).toEqual(link);
    });
  });

  describe('unlinkLandlord', () => {
    it('delegates to unlinkLandlord with scope and landlordUserId', async () => {
      householdsService.unlinkLandlord.mockResolvedValue(undefined);

      await controller.unlinkLandlord(adminScope, 'u-ll');

      expect(householdsService.unlinkLandlord).toHaveBeenCalledWith(adminScope, 'u-ll');
    });
  });
});
