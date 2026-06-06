import type { HouseholdScope } from '../scope';

export type PolicyRitual = {
  proposerId: string;
};

const isActiveMember = (scope: HouseholdScope): boolean =>
  !!scope.membership && scope.membership.status === 'active';

const isActiveAdmin = (scope: HouseholdScope): boolean =>
  isActiveMember(scope) && scope.membership!.role === 'admin';

export const ritualPolicy = {
  canViewList: (scope: HouseholdScope): boolean => !!scope.membership,

  canPropose: (scope: HouseholdScope): boolean => isActiveMember(scope),

  canJoin: (scope: HouseholdScope, _ritual: PolicyRitual): boolean => isActiveMember(scope),

  canComplete: (scope: HouseholdScope, ritual: PolicyRitual): boolean => {
    if (!isActiveMember(scope)) return false;
    if (isActiveAdmin(scope)) return true;
    return ritual.proposerId === scope.userId;
  },

  canDelete: (scope: HouseholdScope, ritual: PolicyRitual): boolean => {
    if (!isActiveMember(scope)) return false;
    if (isActiveAdmin(scope)) return true;
    return ritual.proposerId === scope.userId;
  },
};
