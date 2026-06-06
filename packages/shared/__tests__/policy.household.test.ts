import { householdPolicy, type PolicyMemberTarget } from '../src/policy/household';
import {
  adminScope,
  adminInactiveScope,
  memberAliceScope,
  inactiveMemberScope,
  landlordScope,
  nonMemberScope,
} from '../src/test-fixtures/scopes';

const memberTarget: PolicyMemberTarget = { role: 'member', status: 'active' };
const adminTarget: PolicyMemberTarget = { role: 'admin', status: 'active' };
const inactiveAdminTarget: PolicyMemberTarget = { role: 'admin', status: 'inactive' };

describe('householdPolicy.canView', () => {
  test('any member can view', () => {
    expect(householdPolicy.canView(adminScope)).toBe(true);
    expect(householdPolicy.canView(memberAliceScope)).toBe(true);
    expect(householdPolicy.canView(inactiveMemberScope)).toBe(true);
  });
  test('landlord can view (summary)', () => {
    expect(householdPolicy.canView(landlordScope)).toBe(true);
  });
  test('non-member cannot view', () => {
    expect(householdPolicy.canView(nonMemberScope)).toBe(false);
  });
});

describe('householdPolicy.canEditSettings', () => {
  test('active admin can edit', () => {
    expect(householdPolicy.canEditSettings(adminScope)).toBe(true);
  });
  test('inactive admin cannot edit', () => {
    expect(householdPolicy.canEditSettings(adminInactiveScope)).toBe(false);
  });
  test('member cannot edit', () => {
    expect(householdPolicy.canEditSettings(memberAliceScope)).toBe(false);
  });
  test('landlord cannot edit', () => {
    expect(householdPolicy.canEditSettings(landlordScope)).toBe(false);
  });
});

describe('householdPolicy.canDelete', () => {
  test('active admin can delete', () => {
    expect(householdPolicy.canDelete(adminScope)).toBe(true);
  });
  test('member cannot delete', () => {
    expect(householdPolicy.canDelete(memberAliceScope)).toBe(false);
  });
  test('inactive admin cannot delete', () => {
    expect(householdPolicy.canDelete(adminInactiveScope)).toBe(false);
  });
});

describe('householdPolicy.canInvite', () => {
  test('active admin can invite', () => {
    expect(householdPolicy.canInvite(adminScope)).toBe(true);
  });
  test('member cannot invite', () => {
    expect(householdPolicy.canInvite(memberAliceScope)).toBe(false);
  });
});

describe('householdPolicy.canRemoveMember', () => {
  test('admin can remove regular member', () => {
    expect(householdPolicy.canRemoveMember(adminScope, memberTarget, 1)).toBe(true);
  });
  test('admin can remove another admin when 2+ active admins exist', () => {
    expect(householdPolicy.canRemoveMember(adminScope, adminTarget, 2)).toBe(true);
  });
  test('admin cannot remove the last active admin', () => {
    expect(householdPolicy.canRemoveMember(adminScope, adminTarget, 1)).toBe(false);
  });
  test('admin removing an inactive admin does not violate last-admin guard', () => {
    expect(householdPolicy.canRemoveMember(adminScope, inactiveAdminTarget, 1)).toBe(true);
  });
  test('inactive admin cannot remove anyone', () => {
    expect(householdPolicy.canRemoveMember(adminInactiveScope, memberTarget, 5)).toBe(false);
  });
  test('member cannot remove anyone', () => {
    expect(householdPolicy.canRemoveMember(memberAliceScope, memberTarget, 5)).toBe(false);
  });
});

describe('householdPolicy.canPromote', () => {
  test('active admin can promote a member to admin', () => {
    expect(householdPolicy.canPromote(adminScope, memberTarget)).toBe(true);
  });
  test('promoting an already-admin is a no-op disallowed', () => {
    expect(householdPolicy.canPromote(adminScope, adminTarget)).toBe(false);
  });
  test('inactive admin cannot promote', () => {
    expect(householdPolicy.canPromote(adminInactiveScope, memberTarget)).toBe(false);
  });
  test('member cannot promote', () => {
    expect(householdPolicy.canPromote(memberAliceScope, memberTarget)).toBe(false);
  });
});

describe('householdPolicy.canDemote', () => {
  test('admin can demote another admin when 2+ active admins exist', () => {
    expect(householdPolicy.canDemote(adminScope, adminTarget, 2)).toBe(true);
  });
  test('admin cannot demote the last active admin', () => {
    expect(householdPolicy.canDemote(adminScope, adminTarget, 1)).toBe(false);
  });
  test('demoting a regular member is not allowed (already lowest)', () => {
    expect(householdPolicy.canDemote(adminScope, memberTarget, 5)).toBe(false);
  });
  test('member cannot demote', () => {
    expect(householdPolicy.canDemote(memberAliceScope, adminTarget, 5)).toBe(false);
  });
});

describe('householdPolicy.canManageLandlordLink', () => {
  test('active admin can link/unlink', () => {
    expect(householdPolicy.canManageLandlordLink(adminScope)).toBe(true);
  });
  test('member cannot', () => {
    expect(householdPolicy.canManageLandlordLink(memberAliceScope)).toBe(false);
  });
  test('inactive admin cannot', () => {
    expect(householdPolicy.canManageLandlordLink(adminInactiveScope)).toBe(false);
  });
});

describe('householdPolicy.canRegenerateJoinCode', () => {
  test('active admin can regenerate', () => {
    expect(householdPolicy.canRegenerateJoinCode(adminScope)).toBe(true);
  });
  test('member cannot', () => {
    expect(householdPolicy.canRegenerateJoinCode(memberAliceScope)).toBe(false);
  });
  test('inactive member cannot', () => {
    expect(householdPolicy.canRegenerateJoinCode(inactiveMemberScope)).toBe(false);
  });
  test('inactive admin cannot', () => {
    expect(householdPolicy.canRegenerateJoinCode(adminInactiveScope)).toBe(false);
  });
  test('landlord cannot', () => {
    expect(householdPolicy.canRegenerateJoinCode(landlordScope)).toBe(false);
  });
  test('non-member cannot', () => {
    expect(householdPolicy.canRegenerateJoinCode(nonMemberScope)).toBe(false);
  });
});
