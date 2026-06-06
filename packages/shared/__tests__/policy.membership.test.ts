import {
  membershipPolicy,
  validateInactiveWindow,
  type InactiveWindow,
} from '../src/policy/membership';
import {
  adminScope,
  adminInactiveScope,
  memberAliceScope,
  inactiveMemberScope,
  landlordScope,
  nonMemberScope,
} from '../src/test-fixtures/scopes';
import { INACTIVE_MAX_DAYS } from '../src/membership';

const now = new Date('2026-05-14T12:00:00.000Z');
const validWindow: InactiveWindow = {
  from: new Date('2026-05-14T12:00:00.000Z'),
  until: new Date('2026-05-21T12:00:00.000Z'),
};

describe('membershipPolicy.canSetSelfInactive', () => {
  test('active member can set self inactive when not last admin', () => {
    expect(membershipPolicy.canSetSelfInactive(memberAliceScope, 2)).toBe(true);
  });
  test('active admin can set self inactive when another active admin exists', () => {
    expect(membershipPolicy.canSetSelfInactive(adminScope, 2)).toBe(true);
  });
  test('sole active admin cannot set self inactive', () => {
    expect(membershipPolicy.canSetSelfInactive(adminScope, 1)).toBe(false);
  });
  test('already inactive member cannot re-set inactive', () => {
    expect(membershipPolicy.canSetSelfInactive(inactiveMemberScope, 5)).toBe(false);
  });
  test('landlord cannot set self inactive', () => {
    expect(membershipPolicy.canSetSelfInactive(landlordScope, 5)).toBe(false);
  });
  test('non-member cannot', () => {
    expect(membershipPolicy.canSetSelfInactive(nonMemberScope, 5)).toBe(false);
  });
});

describe('membershipPolicy.canEndOwnInactive', () => {
  test('inactive member can end their own period', () => {
    expect(membershipPolicy.canEndOwnInactive(inactiveMemberScope)).toBe(true);
  });
  test('active member has nothing to end', () => {
    expect(membershipPolicy.canEndOwnInactive(memberAliceScope)).toBe(false);
  });
  test('landlord cannot', () => {
    expect(membershipPolicy.canEndOwnInactive(landlordScope)).toBe(false);
  });
  test('non-member cannot', () => {
    expect(membershipPolicy.canEndOwnInactive(nonMemberScope)).toBe(false);
  });
});

describe('membershipPolicy.canForceEndOther', () => {
  test('active admin can force-end', () => {
    expect(membershipPolicy.canForceEndOther(adminScope)).toBe(true);
  });
  test('inactive admin cannot force-end', () => {
    expect(membershipPolicy.canForceEndOther(adminInactiveScope)).toBe(false);
  });
  test('member cannot force-end', () => {
    expect(membershipPolicy.canForceEndOther(memberAliceScope)).toBe(false);
  });
  test('landlord cannot', () => {
    expect(membershipPolicy.canForceEndOther(landlordScope)).toBe(false);
  });
});

describe('validateInactiveWindow', () => {
  test('valid window returns ok', () => {
    expect(validateInactiveWindow(validWindow, now)).toEqual({ ok: true });
  });
  test('rejects missing until', () => {
    const result = validateInactiveWindow({ from: now, until: null }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('until_required');
  });
  test('rejects from in the past', () => {
    const past = new Date('2026-05-13T00:00:00.000Z');
    const result = validateInactiveWindow({ from: past, until: validWindow.until }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('from_in_past');
  });
  test('rejects until before from', () => {
    const result = validateInactiveWindow({ from: now, until: new Date(now.getTime() - 1000) }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('until_before_from');
  });
  test(`rejects window longer than ${INACTIVE_MAX_DAYS} days`, () => {
    const tooLongUntil = new Date(now.getTime() + (INACTIVE_MAX_DAYS + 1) * 86_400_000);
    const result = validateInactiveWindow({ from: now, until: tooLongUntil }, now);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('window_too_long');
  });
  test(`accepts exactly ${INACTIVE_MAX_DAYS} days`, () => {
    const maxUntil = new Date(now.getTime() + INACTIVE_MAX_DAYS * 86_400_000);
    const result = validateInactiveWindow({ from: now, until: maxUntil }, now);
    expect(result.ok).toBe(true);
  });
});
