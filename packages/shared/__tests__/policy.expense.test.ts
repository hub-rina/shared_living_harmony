import { expensePolicy, type PolicyExpense, type PolicyExpenseShare } from '../src/policy/expense';
import {
  adminScope,
  adminInactiveScope,
  memberAliceScope,
  memberBobScope,
  inactiveMemberScope,
  landlordScope,
  nonMemberScope,
} from '../src/test-fixtures/scopes';

const aliceExpense: PolicyExpense = { creatorId: 'u-alice' };
const bobShare: PolicyExpenseShare = { debtorId: 'u-bob' };
const aliceShare: PolicyExpenseShare = { debtorId: 'u-alice' };

describe('expensePolicy.canViewList', () => {
  test('any member can view, including inactive', () => {
    expect(expensePolicy.canViewList(memberAliceScope)).toBe(true);
    expect(expensePolicy.canViewList(inactiveMemberScope)).toBe(true);
    expect(expensePolicy.canViewList(adminScope)).toBe(true);
  });

  test('landlord and non-member cannot view', () => {
    expect(expensePolicy.canViewList(landlordScope)).toBe(false);
    expect(expensePolicy.canViewList(nonMemberScope)).toBe(false);
  });
});

describe('expensePolicy.canCreate', () => {
  test('active members create', () => {
    expect(expensePolicy.canCreate(memberAliceScope)).toBe(true);
    expect(expensePolicy.canCreate(adminScope)).toBe(true);
  });

  test('inactive member, landlord and non-member cannot create', () => {
    expect(expensePolicy.canCreate(inactiveMemberScope)).toBe(false);
    expect(expensePolicy.canCreate(landlordScope)).toBe(false);
    expect(expensePolicy.canCreate(nonMemberScope)).toBe(false);
  });
});

describe('expensePolicy.canEdit / canDelete', () => {
  test('creator can edit and delete their own bill', () => {
    expect(expensePolicy.canEdit(memberAliceScope, aliceExpense)).toBe(true);
    expect(expensePolicy.canDelete(memberAliceScope, aliceExpense)).toBe(true);
  });

  test('active admin can edit and delete any bill', () => {
    expect(expensePolicy.canEdit(adminScope, aliceExpense)).toBe(true);
    expect(expensePolicy.canDelete(adminScope, aliceExpense)).toBe(true);
  });

  test('a different member cannot edit or delete', () => {
    expect(expensePolicy.canEdit(memberBobScope, aliceExpense)).toBe(false);
    expect(expensePolicy.canDelete(memberBobScope, aliceExpense)).toBe(false);
  });

  test('inactive admin cannot edit or delete', () => {
    expect(expensePolicy.canEdit(adminInactiveScope, aliceExpense)).toBe(false);
    expect(expensePolicy.canDelete(adminInactiveScope, aliceExpense)).toBe(false);
  });

  test('landlord and non-member cannot edit or delete', () => {
    expect(expensePolicy.canEdit(landlordScope, aliceExpense)).toBe(false);
    expect(expensePolicy.canDelete(nonMemberScope, aliceExpense)).toBe(false);
  });
});

describe('expensePolicy.canMarkPaid', () => {
  test('only the debtor of the share can mark it paid', () => {
    expect(expensePolicy.canMarkPaid(memberBobScope, bobShare)).toBe(true);
    expect(expensePolicy.canMarkPaid(memberAliceScope, bobShare)).toBe(false);
  });

  test('inactive debtor cannot mark paid', () => {
    expect(expensePolicy.canMarkPaid(inactiveMemberScope, aliceShare)).toBe(false);
  });

  test('landlord and non-member cannot mark paid', () => {
    expect(expensePolicy.canMarkPaid(landlordScope, bobShare)).toBe(false);
    expect(expensePolicy.canMarkPaid(nonMemberScope, bobShare)).toBe(false);
  });
});

describe('expensePolicy.canConfirm', () => {
  test('only the creator confirms receipt', () => {
    expect(expensePolicy.canConfirm(memberAliceScope, aliceExpense)).toBe(true);
    expect(expensePolicy.canConfirm(memberBobScope, aliceExpense)).toBe(false);
  });

  test('inactive creator, landlord and non-member cannot confirm', () => {
    expect(expensePolicy.canConfirm(inactiveMemberScope, aliceExpense)).toBe(false);
    expect(expensePolicy.canConfirm(landlordScope, aliceExpense)).toBe(false);
    expect(expensePolicy.canConfirm(nonMemberScope, aliceExpense)).toBe(false);
  });
});
