# Roles Foundation — Shared Package Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the shared types, `HouseholdScope`, and pure-function `policy` module to `packages/shared`, fully unit-tested (100% line coverage), so both `apps/api` and `apps/web` can import a single source of truth for authorization in later PRs.

**Architecture:** Pure TypeScript module. No framework deps. Two layers:
1. **Type/enum layer** (`membership.ts`, `scope.ts`) — defines the actors and their state.
2. **Policy layer** (`policy/*.ts`) — pure boolean functions, one per (resource, action). Every cell of the spec's permission matrix maps to a function call.

The old `UserRole` enum in `user.ts` stays untouched in this PR for backward compatibility — `apps/api` and `apps/web` continue to compile. It is removed in the next PR when the Prisma migration replaces the global role.

**Tech Stack:** TypeScript 5.6 (strict, `noUncheckedIndexedAccess`), Zod 3.23, Jest 29 + ts-jest (matches `apps/api`).

**Scope of this plan:** Phase 1 of 5 from `docs/superpowers/specs/2026-05-14-roles-tenancy-inactive-design.md` §8 ("PR 1 — shared types + policy module"). The Prisma migration, guards, and feature rollout live in separate plans.

**Branch:** `feat/roles-foundation-shared` off `main`. One PR at the end of this plan.

---

## File map

**Create:**
- `packages/shared/jest.config.js` — Jest config (mirrors `apps/api/jest.config.js`).
- `packages/shared/src/membership.ts` — `HouseholdRole`, `SystemRole`, `MembershipStatus` enums (zod + TS), `INACTIVE_MAX_DAYS` constant.
- `packages/shared/src/scope.ts` — `HouseholdScope` type.
- `packages/shared/src/policy/index.ts` — barrel re-export.
- `packages/shared/src/policy/task.ts` — task policy functions.
- `packages/shared/src/policy/ritual.ts` — ritual policy functions.
- `packages/shared/src/policy/household.ts` — household policy functions.
- `packages/shared/src/policy/membership.ts` — membership-status policy functions.
- `packages/shared/src/test-fixtures/scopes.ts` — reusable scope fixtures.
- `packages/shared/__tests__/policy.task.test.ts`
- `packages/shared/__tests__/policy.ritual.test.ts`
- `packages/shared/__tests__/policy.household.test.ts`
- `packages/shared/__tests__/policy.membership.test.ts`

**Modify:**
- `packages/shared/package.json` — add `jest`, `ts-jest`, `@types/jest` devDeps; add `test` script.
- `packages/shared/src/index.ts` — re-export new modules.
- `packages/shared/tsconfig.build.json` — exclude `__tests__` and `test-fixtures` from build output.

**Do not touch:**
- `packages/shared/src/user.ts` (keeps old `UserRole`; removed in next PR).
- `apps/api/**`, `apps/web/**` (no consumers yet).

---

## Task 1: Add Jest tooling to shared package

**Files:**
- Modify: `packages/shared/package.json`
- Create: `packages/shared/jest.config.js`

- [ ] **Step 1: Add Jest devDeps**

Run:
```bash
pnpm --filter @homebuddy/shared add -D jest@29.7.0 ts-jest@29.2.5 @types/jest@29.5.13
```

Expected: pnpm installs three packages, updates `packages/shared/package.json` and root `pnpm-lock.yaml`.

- [ ] **Step 2: Add `test` script**

Edit `packages/shared/package.json` — replace the `scripts` block with:

```json
"scripts": {
  "build": "tsc -p tsconfig.build.json",
  "dev": "tsc -p tsconfig.build.json --watch --preserveWatchOutput",
  "typecheck": "tsc --noEmit",
  "lint": "echo \"(no lint configured)\"",
  "test": "jest"
}
```

- [ ] **Step 3: Create Jest config**

Create `packages/shared/jest.config.js` with:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/src', '<rootDir>/__tests__'],
  testRegex: '.*\\.test\\.ts$',
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: [
    'src/policy/**/*.ts',
    'src/membership.ts',
    'src/scope.ts',
  ],
  coverageThreshold: {
    './src/policy/': { lines: 100, functions: 100, branches: 100, statements: 100 },
  },
  coverageDirectory: 'coverage',
};
```

- [ ] **Step 4: Exclude test files from build**

Edit `packages/shared/tsconfig.build.json` — replace the `exclude` array:

```json
"exclude": ["dist", "node_modules", "__tests__", "src/test-fixtures"]
```

- [ ] **Step 5: Smoke-run Jest**

Run:
```bash
pnpm --filter @homebuddy/shared test --passWithNoTests
```

Expected: `No tests found, exiting with code 0` (because `--passWithNoTests`). Jest is wired correctly.

- [ ] **Step 6: Commit**

```bash
git checkout -b feat/roles-foundation-shared
git add packages/shared/package.json packages/shared/jest.config.js packages/shared/tsconfig.build.json pnpm-lock.yaml
git commit -m "chore(shared): add jest for policy unit tests"
```

---

## Task 2: Define membership enums

**Files:**
- Create: `packages/shared/src/membership.ts`
- Modify: `packages/shared/src/index.ts`

Pure type definitions. No tests yet — types alone do not need runtime tests. They will be exercised by every policy test in later tasks.

- [ ] **Step 1: Create `membership.ts`**

Create `packages/shared/src/membership.ts` with:

```ts
import { z } from 'zod';

export const HouseholdRoleSchema = z.enum(['admin', 'member']);
export type HouseholdRole = z.infer<typeof HouseholdRoleSchema>;

export const SystemRoleSchema = z.enum(['user', 'support']);
export type SystemRole = z.infer<typeof SystemRoleSchema>;

export const MembershipStatusSchema = z.enum(['active', 'inactive']);
export type MembershipStatus = z.infer<typeof MembershipStatusSchema>;

export const INACTIVE_MAX_DAYS = 90;
```

- [ ] **Step 2: Re-export from index**

Edit `packages/shared/src/index.ts` — append a new export line so the file becomes:

```ts
export * from './auth';
export * from './user';
export * from './household';
export * from './landlord';
export * from './ritual';
export * from './task';
export * from './membership';
```

- [ ] **Step 3: Typecheck**

Run:
```bash
pnpm --filter @homebuddy/shared typecheck
```

Expected: exit code 0, no output.

- [ ] **Step 4: Build**

Run:
```bash
pnpm --filter @homebuddy/shared build
```

Expected: emits `packages/shared/dist/membership.js` and `.d.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/membership.ts packages/shared/src/index.ts
git commit -m "feat(shared): add HouseholdRole, SystemRole, MembershipStatus enums"
```

---

## Task 3: Define HouseholdScope type

**Files:**
- Create: `packages/shared/src/scope.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create `scope.ts`**

Create `packages/shared/src/scope.ts` with:

```ts
import type { HouseholdRole, MembershipStatus, SystemRole } from './membership';

export type HouseholdScope = {
  householdId: string;
  userId: string;
  systemRole: SystemRole;
  membership?: {
    id: string;
    role: HouseholdRole;
    status: MembershipStatus;
  };
  landlord?: {
    propertyId: string;
  };
};
```

- [ ] **Step 2: Re-export from index**

Edit `packages/shared/src/index.ts` — append:

```ts
export * from './scope';
```

The full file is now:

```ts
export * from './auth';
export * from './user';
export * from './household';
export * from './landlord';
export * from './ritual';
export * from './task';
export * from './membership';
export * from './scope';
```

- [ ] **Step 3: Typecheck + build**

Run:
```bash
pnpm --filter @homebuddy/shared typecheck && pnpm --filter @homebuddy/shared build
```

Expected: both succeed, no output.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/scope.ts packages/shared/src/index.ts
git commit -m "feat(shared): add HouseholdScope type"
```

---

## Task 4: Scope test fixtures

**Files:**
- Create: `packages/shared/src/test-fixtures/scopes.ts`

These fixtures are imported by every policy test in this PR and by `apps/api` integration tests in PR 3. They live in `src/test-fixtures/` so TS path resolution works from both `__tests__/` and (later) `apps/api/`. The `tsconfig.build.json` already excludes them from the published `dist/`.

- [ ] **Step 1: Create the fixtures file**

Create `packages/shared/src/test-fixtures/scopes.ts` with:

```ts
import type { HouseholdScope } from '../scope';

const HOUSE = 'house-1';

export const adminScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-admin',
  systemRole: 'user',
  membership: { id: 'm-admin', role: 'admin', status: 'active' },
};

export const adminInactiveScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-admin',
  systemRole: 'user',
  membership: { id: 'm-admin', role: 'admin', status: 'inactive' },
};

export const memberAliceScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'member', status: 'active' },
};

export const memberBobScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-bob',
  systemRole: 'user',
  membership: { id: 'm-bob', role: 'member', status: 'active' },
};

export const inactiveMemberScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-alice',
  systemRole: 'user',
  membership: { id: 'm-alice', role: 'member', status: 'inactive' },
};

export const landlordScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-landlord',
  systemRole: 'user',
  landlord: { propertyId: 'lp-1' },
};

export const nonMemberScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-stranger',
  systemRole: 'user',
};

export const supportScope: HouseholdScope = {
  householdId: HOUSE,
  userId: 'u-support',
  systemRole: 'support',
};

export const SCOPE_USER_IDS = {
  admin: 'u-admin',
  alice: 'u-alice',
  bob: 'u-bob',
  landlord: 'u-landlord',
  stranger: 'u-stranger',
  support: 'u-support',
};
```

- [ ] **Step 2: Typecheck**

Run:
```bash
pnpm --filter @homebuddy/shared typecheck
```

Expected: exit code 0.

- [ ] **Step 3: Commit**

```bash
git add packages/shared/src/test-fixtures/scopes.ts
git commit -m "test(shared): add reusable scope fixtures"
```

---

## Task 5: Task policy module (TDD)

**Files:**
- Create: `packages/shared/__tests__/policy.task.test.ts`
- Create: `packages/shared/src/policy/task.ts`

Test first. The matrix from spec §4 row "Tasks" maps to these tests.

### Test data shape

The policy module never imports Prisma types. It uses local minimal shapes so the same functions work against API DB rows and Web API responses.

- [ ] **Step 1: Write failing tests**

Create `packages/shared/__tests__/policy.task.test.ts` with:

```ts
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
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @homebuddy/shared test policy.task
```

Expected: All test files fail to compile — `Cannot find module '../src/policy/task'`. This is the red phase.

- [ ] **Step 3: Implement task policy**

Create `packages/shared/src/policy/task.ts` with:

```ts
import type { HouseholdScope } from '../scope';

export type PolicyTask = {
  assigneeId: string;
  flaggedById: string | null;
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
    isActiveMember(scope) && task.assigneeId === scope.userId,

  canEdit: (scope: HouseholdScope, task: PolicyTask): boolean => {
    if (!isActiveMember(scope)) return false;
    if (isActiveAdmin(scope)) return true;
    return task.assigneeId === scope.userId;
  },

  canReassign: (scope: HouseholdScope): boolean => isActiveAdmin(scope),
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @homebuddy/shared test policy.task
```

Expected: all 30 tests pass, exit code 0.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/__tests__/policy.task.test.ts packages/shared/src/policy/task.ts
git commit -m "feat(shared): add taskPolicy with full matrix coverage"
```

---

## Task 6: Ritual policy module (TDD)

**Files:**
- Create: `packages/shared/__tests__/policy.ritual.test.ts`
- Create: `packages/shared/src/policy/ritual.ts`

- [ ] **Step 1: Write failing tests**

Create `packages/shared/__tests__/policy.ritual.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @homebuddy/shared test policy.ritual
```

Expected: Cannot find module `../src/policy/ritual`. Red phase.

- [ ] **Step 3: Implement ritual policy**

Create `packages/shared/src/policy/ritual.ts` with:

```ts
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @homebuddy/shared test policy.ritual
```

Expected: all 19 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/__tests__/policy.ritual.test.ts packages/shared/src/policy/ritual.ts
git commit -m "feat(shared): add ritualPolicy with full matrix coverage"
```

---

## Task 7: Household policy module (TDD)

**Files:**
- Create: `packages/shared/__tests__/policy.household.test.ts`
- Create: `packages/shared/src/policy/household.ts`

The household policy is where the **last-admin invariant** lives. Each function that touches roles takes `activeAdminCount` as a parameter so the API service can compute it inside a Prisma transaction and the policy stays pure.

- [ ] **Step 1: Write failing tests**

Create `packages/shared/__tests__/policy.household.test.ts` with:

```ts
import { householdPolicy, type PolicyMemberTarget } from '../src/policy/household';
import {
  adminScope,
  adminInactiveScope,
  memberAliceScope,
  inactiveMemberScope,
  landlordScope,
  nonMemberScope,
} from '../src/test-fixtures/scopes';

const memberTarget: PolicyMemberTarget = { role: 'member', status: 'active' };
const adminTarget: PolicyMemberTarget = { role: 'admin', status: 'active' };
const inactiveAdminTarget: PolicyMemberTarget = { role: 'admin', status: 'inactive' };

describe('householdPolicy.canView', () => {
  test('any member can view', () => {
    expect(householdPolicy.canView(adminScope)).toBe(true);
    expect(householdPolicy.canView(memberAliceScope)).toBe(true);
    expect(householdPolicy.canView(inactiveMemberScope)).toBe(true);
  });
  test('landlord can view (summary)', () => {
    expect(householdPolicy.canView(landlordScope)).toBe(true);
  });
  test('non-member cannot view', () => {
    expect(householdPolicy.canView(nonMemberScope)).toBe(false);
  });
});

describe('householdPolicy.canEditSettings', () => {
  test('active admin can edit', () => {
    expect(householdPolicy.canEditSettings(adminScope)).toBe(true);
  });
  test('inactive admin cannot edit', () => {
    expect(householdPolicy.canEditSettings(adminInactiveScope)).toBe(false);
  });
  test('member cannot edit', () => {
    expect(householdPolicy.canEditSettings(memberAliceScope)).toBe(false);
  });
  test('landlord cannot edit', () => {
    expect(householdPolicy.canEditSettings(landlordScope)).toBe(false);
  });
});

describe('householdPolicy.canDelete', () => {
  test('active admin can delete', () => {
    expect(householdPolicy.canDelete(adminScope)).toBe(true);
  });
  test('member cannot delete', () => {
    expect(householdPolicy.canDelete(memberAliceScope)).toBe(false);
  });
  test('inactive admin cannot delete', () => {
    expect(householdPolicy.canDelete(adminInactiveScope)).toBe(false);
  });
});

describe('householdPolicy.canInvite', () => {
  test('active admin can invite', () => {
    expect(householdPolicy.canInvite(adminScope)).toBe(true);
  });
  test('member cannot invite', () => {
    expect(householdPolicy.canInvite(memberAliceScope)).toBe(false);
  });
});

describe('householdPolicy.canRemoveMember', () => {
  test('admin can remove regular member', () => {
    expect(householdPolicy.canRemoveMember(adminScope, memberTarget, 1)).toBe(true);
  });
  test('admin can remove another admin when 2+ active admins exist', () => {
    expect(householdPolicy.canRemoveMember(adminScope, adminTarget, 2)).toBe(true);
  });
  test('admin cannot remove the last active admin', () => {
    expect(householdPolicy.canRemoveMember(adminScope, adminTarget, 1)).toBe(false);
  });
  test('admin removing an inactive admin does not violate last-admin guard', () => {
    // inactive admins do not count toward the active-admin floor
    expect(householdPolicy.canRemoveMember(adminScope, inactiveAdminTarget, 1)).toBe(true);
  });
  test('inactive admin cannot remove anyone', () => {
    expect(householdPolicy.canRemoveMember(adminInactiveScope, memberTarget, 5)).toBe(false);
  });
  test('member cannot remove anyone', () => {
    expect(householdPolicy.canRemoveMember(memberAliceScope, memberTarget, 5)).toBe(false);
  });
});

describe('householdPolicy.canPromote', () => {
  test('active admin can promote a member to admin', () => {
    expect(householdPolicy.canPromote(adminScope, memberTarget)).toBe(true);
  });
  test('promoting an already-admin is a no-op disallowed', () => {
    expect(householdPolicy.canPromote(adminScope, adminTarget)).toBe(false);
  });
  test('inactive admin cannot promote', () => {
    expect(householdPolicy.canPromote(adminInactiveScope, memberTarget)).toBe(false);
  });
  test('member cannot promote', () => {
    expect(householdPolicy.canPromote(memberAliceScope, memberTarget)).toBe(false);
  });
});

describe('householdPolicy.canDemote', () => {
  test('admin can demote another admin when 2+ active admins exist', () => {
    expect(householdPolicy.canDemote(adminScope, adminTarget, 2)).toBe(true);
  });
  test('admin cannot demote the last active admin', () => {
    expect(householdPolicy.canDemote(adminScope, adminTarget, 1)).toBe(false);
  });
  test('demoting a regular member is not allowed (already lowest)', () => {
    expect(householdPolicy.canDemote(adminScope, memberTarget, 5)).toBe(false);
  });
  test('member cannot demote', () => {
    expect(householdPolicy.canDemote(memberAliceScope, adminTarget, 5)).toBe(false);
  });
});

describe('householdPolicy.canManageLandlordLink', () => {
  test('active admin can link/unlink', () => {
    expect(householdPolicy.canManageLandlordLink(adminScope)).toBe(true);
  });
  test('member cannot', () => {
    expect(householdPolicy.canManageLandlordLink(memberAliceScope)).toBe(false);
  });
  test('inactive admin cannot', () => {
    expect(householdPolicy.canManageLandlordLink(adminInactiveScope)).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @homebuddy/shared test policy.household
```

Expected: module not found. Red phase.

- [ ] **Step 3: Implement household policy**

Create `packages/shared/src/policy/household.ts` with:

```ts
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
  // Removing/demoting an inactive admin does not affect the active-admin floor.
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
};
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @homebuddy/shared test policy.household
```

Expected: all 30 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/__tests__/policy.household.test.ts packages/shared/src/policy/household.ts
git commit -m "feat(shared): add householdPolicy with last-admin guard"
```

---

## Task 8: Membership-status policy module (TDD)

**Files:**
- Create: `packages/shared/__tests__/policy.membership.test.ts`
- Create: `packages/shared/src/policy/membership.ts`

Covers: who can set themselves inactive, who can force-end someone else's inactive period, and a pure validator for the `from`/`until` window (used by both API service and the web modal). `INACTIVE_MAX_DAYS` from `membership.ts` is the single source of truth for the 90-day cap.

- [ ] **Step 1: Write failing tests**

Create `packages/shared/__tests__/policy.membership.test.ts` with:

```ts
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run:
```bash
pnpm --filter @homebuddy/shared test policy.membership
```

Expected: module not found. Red phase.

- [ ] **Step 3: Implement membership policy**

Create `packages/shared/src/policy/membership.ts` with:

```ts
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
  // Same-day "from" is allowed; reject only if strictly in the past calendar day.
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run:
```bash
pnpm --filter @homebuddy/shared test policy.membership
```

Expected: all 17 tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/__tests__/policy.membership.test.ts packages/shared/src/policy/membership.ts
git commit -m "feat(shared): add membershipPolicy and validateInactiveWindow"
```

---

## Task 9: Policy barrel + index re-export

**Files:**
- Create: `packages/shared/src/policy/index.ts`
- Modify: `packages/shared/src/index.ts`

- [ ] **Step 1: Create the barrel**

Create `packages/shared/src/policy/index.ts` with:

```ts
export * from './task';
export * from './ritual';
export * from './household';
export * from './membership';
```

- [ ] **Step 2: Re-export from package index**

Edit `packages/shared/src/index.ts` — append the new line so the file becomes:

```ts
export * from './auth';
export * from './user';
export * from './household';
export * from './landlord';
export * from './ritual';
export * from './task';
export * from './membership';
export * from './scope';
export * from './policy';
```

- [ ] **Step 3: Verify a consumer can import the policy module**

Create a temporary smoke file at `packages/shared/src/__smoke__.ts` (gitignored only because the next step deletes it):

```ts
import { taskPolicy, ritualPolicy, householdPolicy, membershipPolicy } from './index';
// touch each export so the compiler keeps it in the dist
void taskPolicy.canCreate;
void ritualPolicy.canPropose;
void householdPolicy.canDelete;
void membershipPolicy.canEndOwnInactive;
```

Run:
```bash
pnpm --filter @homebuddy/shared build
```

Expected: emits `packages/shared/dist/policy/{task,ritual,household,membership,index}.js` and corresponding `.d.ts` files.

- [ ] **Step 4: Delete the smoke file**

Run:
```bash
rm packages/shared/src/__smoke__.ts
pnpm --filter @homebuddy/shared build
```

Expected: re-emits dist without the smoke file. Build still succeeds.

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/policy/index.ts packages/shared/src/index.ts
git commit -m "feat(shared): export policy modules from package index"
```

---

## Task 10: Full-suite verification + coverage gate

**Files:** none modified.

- [ ] **Step 1: Run the full shared test suite with coverage**

Run:
```bash
pnpm --filter @homebuddy/shared test -- --coverage
```

Expected:
- All test files green (~96 tests across the four policy files).
- Coverage table shows `src/policy/` at **100% lines, 100% branches, 100% functions, 100% statements**.
- Jest exits 0. If coverage threshold from `jest.config.js` is not met, Jest exits non-zero — fix the gap before continuing.

- [ ] **Step 2: Run typecheck for the whole monorepo**

Run:
```bash
pnpm typecheck
```

Expected: turbo runs `typecheck` for every workspace. All green. `apps/api` and `apps/web` still compile (they haven't started consuming the new modules yet, but they must not regress).

- [ ] **Step 3: Run the existing `apps/api` test suite**

Run:
```bash
pnpm --filter @homebuddy/api test
```

Expected: pre-existing tests pass. This PR adds nothing to API but must not break it.

- [ ] **Step 4: Build the whole monorepo**

Run:
```bash
pnpm build
```

Expected: all workspaces build clean. `packages/shared/dist/` now contains policy + types.

- [ ] **Step 5: Push branch and open PR**

Run:
```bash
git push -u origin feat/roles-foundation-shared
gh pr create --base main --title "feat(shared): roles, scope, and policy foundation" --body "$(cat <<'EOF'
## Summary
- Adds HouseholdRole, SystemRole, MembershipStatus enums to @homebuddy/shared
- Adds HouseholdScope type
- Adds pure-function policy module (taskPolicy, ritualPolicy, householdPolicy, membershipPolicy) with 100% line/branch coverage
- Adds reusable scope test fixtures for later PRs
- Wires Jest + ts-jest into packages/shared

Phase 1 of 5 from docs/superpowers/specs/2026-05-14-roles-tenancy-inactive-design.md. Pure additive — no consumers yet, no behavior change to API or Web.

## Test plan
- [ ] CI passes (typecheck + lint + shared/test + api/test + web/test)
- [ ] Coverage shows packages/shared/src/policy at 100%
- [ ] apps/api and apps/web build unchanged
EOF
)"
```

Expected: PR opens against `main`. CI starts and goes green.

---

## Self-review checklist (run before pushing)

1. **Spec coverage** — every row of the §4 matrix that names a resource (task, ritual, household, membership) maps to a function in `packages/shared/src/policy/*.ts`, and every cell maps to a named test. Confirmed by counting tests vs. matrix cells. The Prisma migration, guards, web routing, and inactive lifecycle are out of scope for this plan and tracked as separate PRs.
2. **Placeholder scan** — no TODO/TBD/"fill in" in any task. Each step has either runnable code or an exact command.
3. **Type consistency** — every test imports `PolicyTask`, `PolicyRitual`, `PolicyMemberTarget`, `InactiveWindow` from the same modules they are defined in. `taskPolicy`/`ritualPolicy`/`householdPolicy`/`membershipPolicy` are the only exported names, used identically in tests and the policy index barrel.

## Definition of done

- All checkboxes ticked.
- PR opened, CI green, coverage gate met.
- `apps/api` and `apps/web` compile and pass their existing tests.
- No new dependencies leak out of `packages/shared` (no Prisma, no NestJS, no React, no Next).
- Next plan (`2026-05-14-roles-prisma-migration.md` for PR 2) can begin without further refactoring of this code.
