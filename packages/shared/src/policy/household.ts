import type { HouseholdRole, MembershipStatus } from '../membership';
import type { HouseholdScope } from '../scope';

export type PolicyMemberTarget = {
  role: HouseholdRole;
  status: MembershipStatus;
};

const isActiveMember = (scope: HouseholdScope): boolean =>
  !!scope.membership && scope.membership.status === 'active';

const isActiveAdmin = (scope: HouseholdScope): boolean =>
  isActiveMember(scope) && scope.membership!.role === 'admin';

const lastAdminGuard = (target: PolicyMemberTarget, activeAdminCount: number): boolean => {
  if (target.role === 'admin' && target.status === 'active' && activeAdminCount <= 1) {
    return false;
  }
  return true;
};

export const householdPolicy = {
  canView: (scope: HouseholdScope): boolean =>
    !!scope.membership || !!scope.landlord,

  canEditSettings: (scope: HouseholdScope): boolean => isActiveAdmin(scope),

  canDelete: (scope: HouseholdScope): boolean => isActiveAdmin(scope),

  canInvite: (scope: HouseholdScope): boolean => isActiveAdmin(scope),

  canRemoveMember: (
    scope: HouseholdScope,
    target: PolicyMemberTarget,
    activeAdminCount: number,
  ): boolean => isActiveAdmin(scope) && lastAdminGuard(target, activeAdminCount),

  canPromote: (scope: HouseholdScope, target: PolicyMemberTarget): boolean =>
    isActiveAdmin(scope) && target.role === 'member',

  canDemote: (
    scope: HouseholdScope,
    target: PolicyMemberTarget,
    activeAdminCount: number,
  ): boolean =>
    isActiveAdmin(scope) &&
    target.role === 'admin' &&
    lastAdminGuard(target, activeAdminCount),

  canManageLandlordLink: (scope: HouseholdScope): boolean => isActiveAdmin(scope),

  canRegenerateJoinCode: (scope: HouseholdScope): boolean => isActiveAdmin(scope),
};
