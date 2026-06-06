import { INACTIVE_MAX_DAYS } from '../membership';
import type { HouseholdScope } from '../scope';

const isActiveMember = (scope: HouseholdScope): boolean =>
  !!scope.membership && scope.membership.status === 'active';

const isActiveAdmin = (scope: HouseholdScope): boolean =>
  isActiveMember(scope) && scope.membership!.role === 'admin';

export const membershipPolicy = {
  canSetSelfInactive: (scope: HouseholdScope, activeAdminCount: number): boolean => {
    if (!isActiveMember(scope)) return false;
    if (scope.membership!.role === 'admin' && activeAdminCount <= 1) return false;
    return true;
  },

  canEndOwnInactive: (scope: HouseholdScope): boolean =>
    !!scope.membership && scope.membership.status === 'inactive',

  canForceEndOther: (scope: HouseholdScope): boolean => isActiveAdmin(scope),
};

export type InactiveWindow = {
  from: Date;
  until: Date | null;
};

export type InactiveValidation =
  | { ok: true }
  | {
      ok: false;
      code: 'until_required' | 'from_in_past' | 'until_before_from' | 'window_too_long';
    };

const MS_PER_DAY = 86_400_000;

export function validateInactiveWindow(
  window: InactiveWindow,
  now: Date,
): InactiveValidation {
  if (window.until === null) return { ok: false, code: 'until_required' };
  const fromStartOfDayMs = startOfUtcDay(window.from).getTime();
  const nowStartOfDayMs = startOfUtcDay(now).getTime();
  if (fromStartOfDayMs < nowStartOfDayMs) return { ok: false, code: 'from_in_past' };
  if (window.until.getTime() <= window.from.getTime()) {
    return { ok: false, code: 'until_before_from' };
  }
  const spanDays = (window.until.getTime() - window.from.getTime()) / MS_PER_DAY;
  if (spanDays > INACTIVE_MAX_DAYS) return { ok: false, code: 'window_too_long' };
  return { ok: true };
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}
