import { taskPolicy, type PolicyTask } from '../src/policy/task';
import {
  adminScope,
  adminInactiveScope,
  memberAliceScope,
  memberBobScope,
  inactiveMemberScope,
  landlordScope,
  nonMemberScope,
} from '../src/test-fixtures/scopes';

const aliceAssignedTask: PolicyTask = {
  assigneeId: 'u-alice',
  flaggedById: null,
};

const aliceFlaggedReactiveTask: PolicyTask = {
  assigneeId: 'u-bob',
  flaggedById: 'u-alice',
};

const bobAssignedTask: PolicyTask = {
  assigneeId: 'u-bob',
  flaggedById: null,
};

const caretakerOwnedTask: PolicyTask = {
  assigneeId: 'u-landlord',
  flaggedById: null,
  caretakerOwned: true,
};

describe('taskPolicy.canDelete', () => {
  test('admin can delete any task', () => {
    expect(taskPolicy.canDelete(adminScope, bobAssignedTask)).toBe(true);
  });

  test('inactive admin cannot delete', () => {
    expect(taskPolicy.canDelete(adminInactiveScope, bobAssignedTask)).toBe(false);
  });

  test('member can delete a task assigned to them', () => {
    expect(taskPolicy.canDelete(memberAliceScope, aliceAssignedTask)).toBe(true);
  });

  test('member can delete a reactive task they flagged', () => {
    expect(taskPolicy.canDelete(memberAliceScope, aliceFlaggedReactiveTask)).toBe(true);
  });

  test('member cannot delete another member\'s task', () => {
    expect(taskPolicy.canDelete(memberBobScope, aliceAssignedTask)).toBe(false);
  });

  test('inactive member cannot delete even their own task', () => {
    expect(taskPolicy.canDelete(inactiveMemberScope, aliceAssignedTask)).toBe(false);
  });

  test('landlord cannot delete', () => {
    expect(taskPolicy.canDelete(landlordScope, aliceAssignedTask)).toBe(false);
  });

  test('non-member cannot delete', () => {
    expect(taskPolicy.canDelete(nonMemberScope, aliceAssignedTask)).toBe(false);
  });
});

describe('taskPolicy.canComplete', () => {
  test('assignee can complete their own task', () => {
    expect(taskPolicy.canComplete(memberAliceScope, aliceAssignedTask)).toBe(true);
  });

  test('admin who is not the assignee cannot complete', () => {
    expect(taskPolicy.canComplete(adminScope, bobAssignedTask)).toBe(false);
  });

  test('admin who is the assignee can complete', () => {
    const adminAsAssignee: PolicyTask = { assigneeId: 'u-admin', flaggedById: null };
    expect(taskPolicy.canComplete(adminScope, adminAsAssignee)).toBe(true);
  });

  test('inactive member cannot complete', () => {
    expect(taskPolicy.canComplete(inactiveMemberScope, aliceAssignedTask)).toBe(false);
  });

  test('other member cannot complete', () => {
    expect(taskPolicy.canComplete(memberBobScope, aliceAssignedTask)).toBe(false);
  });

  test('landlord cannot complete', () => {
    expect(taskPolicy.canComplete(landlordScope, aliceAssignedTask)).toBe(false);
  });

  test('non-member cannot complete', () => {
    expect(taskPolicy.canComplete(nonMemberScope, aliceAssignedTask)).toBe(false);
  });
});

describe('taskPolicy.canEdit', () => {
  test('admin can edit any task', () => {
    expect(taskPolicy.canEdit(adminScope, bobAssignedTask)).toBe(true);
  });

  test('inactive admin cannot edit', () => {
    expect(taskPolicy.canEdit(adminInactiveScope, bobAssignedTask)).toBe(false);
  });

  test('member can edit their own task', () => {
    expect(taskPolicy.canEdit(memberAliceScope, aliceAssignedTask)).toBe(true);
  });

  test('member cannot edit another member\'s task', () => {
    expect(taskPolicy.canEdit(memberBobScope, aliceAssignedTask)).toBe(false);
  });

  test('inactive member cannot edit', () => {
    expect(taskPolicy.canEdit(inactiveMemberScope, aliceAssignedTask)).toBe(false);
  });

  test('landlord cannot edit', () => {
    expect(taskPolicy.canEdit(landlordScope, aliceAssignedTask)).toBe(false);
  });

  test('non-member cannot edit', () => {
    expect(taskPolicy.canEdit(nonMemberScope, aliceAssignedTask)).toBe(false);
  });
});

describe('taskPolicy.canCreate', () => {
  test('active admin can create', () => {
    expect(taskPolicy.canCreate(adminScope)).toBe(true);
  });

  test('active member can create', () => {
    expect(taskPolicy.canCreate(memberAliceScope)).toBe(true);
  });

  test('inactive member cannot create', () => {
    expect(taskPolicy.canCreate(inactiveMemberScope)).toBe(false);
  });

  test('landlord cannot create', () => {
    expect(taskPolicy.canCreate(landlordScope)).toBe(false);
  });

  test('non-member cannot create', () => {
    expect(taskPolicy.canCreate(nonMemberScope)).toBe(false);
  });
});

describe('taskPolicy.canViewList', () => {
  test('any member can view (active or inactive)', () => {
    expect(taskPolicy.canViewList(memberAliceScope)).toBe(true);
    expect(taskPolicy.canViewList(inactiveMemberScope)).toBe(true);
    expect(taskPolicy.canViewList(adminScope)).toBe(true);
  });

  test('landlord cannot view task list', () => {
    expect(taskPolicy.canViewList(landlordScope)).toBe(false);
  });

  test('non-member cannot view task list', () => {
    expect(taskPolicy.canViewList(nonMemberScope)).toBe(false);
  });
});

describe('taskPolicy.canReassign', () => {
  test('active admin can reassign', () => {
    expect(taskPolicy.canReassign(adminScope)).toBe(true);
  });

  test('inactive admin cannot reassign', () => {
    expect(taskPolicy.canReassign(adminInactiveScope)).toBe(false);
  });

  test('member cannot reassign', () => {
    expect(taskPolicy.canReassign(memberAliceScope)).toBe(false);
  });

  test('landlord cannot reassign', () => {
    expect(taskPolicy.canReassign(landlordScope)).toBe(false);
  });

  test('caretaker-owned chores never rotate, even for an admin', () => {
    expect(taskPolicy.canReassign(adminScope, caretakerOwnedTask)).toBe(false);
  });
});

describe('taskPolicy caretaker-owned chores', () => {
  test('no member can complete a caretaker-owned chore', () => {
    expect(taskPolicy.canComplete(adminScope, caretakerOwnedTask)).toBe(false);
    expect(taskPolicy.canComplete(memberAliceScope, caretakerOwnedTask)).toBe(false);
  });

  test('caretaker-owned chores are not editable', () => {
    expect(taskPolicy.canEdit(adminScope, caretakerOwnedTask)).toBe(false);
  });
});
