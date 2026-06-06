import type { HouseholdScope } from '../scope';

export type PolicyTask = {
  assigneeId: string;
  flaggedById: string | null;
  caretakerOwned?: boolean;
};

const isActiveMember = (scope: HouseholdScope): boolean =>
  !!scope.membership && scope.membership.status === 'active';

const isActiveAdmin = (scope: HouseholdScope): boolean =>
  isActiveMember(scope) && scope.membership!.role === 'admin';

export const taskPolicy = {
  canViewList: (scope: HouseholdScope): boolean => !!scope.membership,

  canCreate: (scope: HouseholdScope): boolean => isActiveMember(scope),

  canDelete: (scope: HouseholdScope, task: PolicyTask): boolean => {
    if (!isActiveMember(scope)) return false;
    if (isActiveAdmin(scope)) return true;
    return task.assigneeId === scope.userId || task.flaggedById === scope.userId;
  },

  canComplete: (scope: HouseholdScope, task: PolicyTask): boolean =>
    !task.caretakerOwned && isActiveMember(scope) && task.assigneeId === scope.userId,

  canEdit: (scope: HouseholdScope, task: PolicyTask): boolean => {
    if (task.caretakerOwned) return false;
    if (!isActiveMember(scope)) return false;
    if (isActiveAdmin(scope)) return true;
    return task.assigneeId === scope.userId;
  },

  canReassign: (scope: HouseholdScope, task?: PolicyTask): boolean =>
    isActiveAdmin(scope) && !task?.caretakerOwned,
};
