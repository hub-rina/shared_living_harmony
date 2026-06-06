import type { HouseholdScope } from '../scope';

export type PolicyExpense = {
  creatorId: string;
};

export type PolicyExpenseShare = {
  debtorId: string;
};

const isActiveMember = (scope: HouseholdScope): boolean =>
  !!scope.membership && scope.membership.status === 'active';

const isActiveAdmin = (scope: HouseholdScope): boolean =>
  isActiveMember(scope) && scope.membership!.role === 'admin';

export const expensePolicy = {
  // Reading bills and balances is open to any member, including inactive and
  // invited ones — they can see what they owe even while paused.
  canViewList: (scope: HouseholdScope): boolean => !!scope.membership,

  canCreate: (scope: HouseholdScope): boolean => isActiveMember(scope),

  canEdit: (scope: HouseholdScope, expense: PolicyExpense): boolean => {
    if (!isActiveMember(scope)) return false;
    return isActiveAdmin(scope) || expense.creatorId === scope.userId;
  },

  canDelete: (scope: HouseholdScope, expense: PolicyExpense): boolean => {
    if (!isActiveMember(scope)) return false;
    return isActiveAdmin(scope) || expense.creatorId === scope.userId;
  },

  // Only the person who owes a share can mark it paid.
  canMarkPaid: (scope: HouseholdScope, share: PolicyExpenseShare): boolean =>
    isActiveMember(scope) && share.debtorId === scope.userId,

  // Only the bill's creator (the one who fronted the money) can confirm receipt.
  canConfirm: (scope: HouseholdScope, expense: PolicyExpense): boolean =>
    isActiveMember(scope) && expense.creatorId === scope.userId,
};
