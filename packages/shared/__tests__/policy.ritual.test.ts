import { ritualPolicy, type PolicyRitual } from '../src/policy/ritual';
import {
  adminScope,
  adminInactiveScope,
  memberAliceScope,
  memberBobScope,
  inactiveMemberScope,
  landlordScope,
  nonMemberScope,
} from '../src/test-fixtures/scopes';

const aliceProposed: PolicyRitual = { proposerId: 'u-alice' };
const bobProposed: PolicyRitual = { proposerId: 'u-bob' };

describe('ritualPolicy.canPropose', () => {
  test('active member can propose', () => {
    expect(ritualPolicy.canPropose(memberAliceScope)).toBe(true);
  });
  test('active admin can propose', () => {
    expect(ritualPolicy.canPropose(adminScope)).toBe(true);
  });
  test('inactive member cannot propose', () => {
    expect(ritualPolicy.canPropose(inactiveMemberScope)).toBe(false);
  });
  test('landlord cannot propose', () => {
    expect(ritualPolicy.canPropose(landlordScope)).toBe(false);
  });
  test('non-member cannot propose', () => {
    expect(ritualPolicy.canPropose(nonMemberScope)).toBe(false);
  });
});

describe('ritualPolicy.canJoin', () => {
  test('active member can join', () => {
    expect(ritualPolicy.canJoin(memberBobScope, aliceProposed)).toBe(true);
  });
  test('inactive member cannot join', () => {
    expect(ritualPolicy.canJoin(inactiveMemberScope, aliceProposed)).toBe(false);
  });
  test('landlord cannot join', () => {
    expect(ritualPolicy.canJoin(landlordScope, aliceProposed)).toBe(false);
  });
});

describe('ritualPolicy.canComplete', () => {
  test('proposer can mark complete', () => {
    expect(ritualPolicy.canComplete(memberAliceScope, aliceProposed)).toBe(true);
  });
  test('admin can mark anyone\'s ritual complete', () => {
    expect(ritualPolicy.canComplete(adminScope, bobProposed)).toBe(true);
  });
  test('inactive admin cannot complete', () => {
    expect(ritualPolicy.canComplete(adminInactiveScope, bobProposed)).toBe(false);
  });
  test('other member cannot complete', () => {
    expect(ritualPolicy.canComplete(memberBobScope, aliceProposed)).toBe(false);
  });
  test('inactive proposer cannot complete their own', () => {
    expect(ritualPolicy.canComplete(inactiveMemberScope, aliceProposed)).toBe(false);
  });
  test('landlord cannot complete', () => {
    expect(ritualPolicy.canComplete(landlordScope, aliceProposed)).toBe(false);
  });
});

describe('ritualPolicy.canDelete', () => {
  test('proposer can delete', () => {
    expect(ritualPolicy.canDelete(memberAliceScope, aliceProposed)).toBe(true);
  });
  test('admin can delete any', () => {
    expect(ritualPolicy.canDelete(adminScope, bobProposed)).toBe(true);
  });
  test('other member cannot delete', () => {
    expect(ritualPolicy.canDelete(memberBobScope, aliceProposed)).toBe(false);
  });
  test('inactive member cannot delete', () => {
    expect(ritualPolicy.canDelete(inactiveMemberScope, aliceProposed)).toBe(false);
  });
  test('landlord cannot delete', () => {
    expect(ritualPolicy.canDelete(landlordScope, aliceProposed)).toBe(false);
  });
});

describe('ritualPolicy.canViewList', () => {
  test('any member (active or inactive) can view', () => {
    expect(ritualPolicy.canViewList(memberAliceScope)).toBe(true);
    expect(ritualPolicy.canViewList(inactiveMemberScope)).toBe(true);
    expect(ritualPolicy.canViewList(adminScope)).toBe(true);
  });
  test('landlord cannot view rituals', () => {
    expect(ritualPolicy.canViewList(landlordScope)).toBe(false);
  });
  test('non-member cannot view rituals', () => {
    expect(ritualPolicy.canViewList(nonMemberScope)).toBe(false);
  });
});
