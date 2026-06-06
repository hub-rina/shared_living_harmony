'use client';

import { householdPolicy, ritualPolicy, taskPolicy } from '@homebuddy/shared';
import type { HouseholdScope, PolicyTask } from '@homebuddy/shared';
import { useHousehold } from './household-context';

export function useCan() {
  const { scope } = useHousehold();
  return {
    scope: scope as HouseholdScope,
    isMember: !!scope.membership,
    isActive: scope.membership?.status === 'active',
    isAdmin: scope.membership?.role === 'admin' && scope.membership.status === 'active',
    isLandlord: !!scope.landlord,
    canCreateTask: () => taskPolicy.canCreate(scope as HouseholdScope),
    canCompleteTask: (task: PolicyTask) =>
      taskPolicy.canComplete(scope as HouseholdScope, task),
    canDeleteTask: (task: PolicyTask) =>
      taskPolicy.canDelete(scope as HouseholdScope, task),
    canProposeRitual: () => ritualPolicy.canPropose(scope as HouseholdScope),
    canEditSettings: () => householdPolicy.canEditSettings(scope as HouseholdScope),
    canDeleteHousehold: () => householdPolicy.canDelete(scope as HouseholdScope),
  };
}
