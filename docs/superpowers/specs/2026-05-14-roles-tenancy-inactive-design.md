# Roles, Multi-Tenancy, and Member Availability — Design

**Status:** Draft for review
**Date:** 2026-05-14
**Owner:** Kai (developer) / Catja (product)
**Scope:** Authorization model, multi-household tenancy, member active/inactive lifecycle, and the enforcement architecture that makes them safe to ship.

---

## 1. Problem

HomeBuddy treats every authenticated user as roughly equal inside a household. The current schema carries a global `Role` enum (`member | admin | landlord`) on `User`, but:

- The same person may be a landlord at one property and a tenant at another — a single global role cannot express that.
- `HouseholdMember` has no role of its own, so an admin in House A is also "admin" in House B by accident.
- Destructive actions (delete a task, delete a household, kick a member) are not gated. Any member can wipe the board.
- Landlords have access to the same data tenants do, leaking privacy.
- Real life — vacations, exams, illness — has no representation. A member cannot opt out of chore rotation without leaving the house entirely. This causes either unfair penalties or self-removal.

The goal is one coherent model that handles all four problems without invented complexity.

---

## 2. Decisions

| # | Decision |
|---|----------|
| D1 | Role lives **per household membership**, not globally on the user. |
| D2 | Landlord stays a **separate link** (`LandlordProperty`), not a member with a role. |
| D3 | Tenant role set inside a household is **`admin` + `member`** (two-tier). |
| D4 | Landlord access is **read-only summary** — name, member list, harmony score. No tasks, no rituals, no photos. |
| D5 | Task delete is permitted for **admins, the flagger (reactive tasks), or the assignee** — others get 403. (The `Task` model has no separate `createdBy`; flagger and assignee together cover authorship.) |
| D6 | Task complete is **assignee-only**. |
| D7 | Household-level destructive actions (delete, remove member, change role) are **admin-only**, with a **last-admin safeguard**. |
| D8 | Multiple households are surfaced via **URL-scoped routing** (`/h/[householdId]/...`). A switcher in the layout navigates between them. |
| D9 | Enforcement uses **two guards + a pure-function policy module** shared by api and web (Approach A). |
| D10 | A member can be marked **inactive** (e.g., vacation) by themselves; an end date and reason are required, max 90 days per request. Admin can revoke. |
| D11 | When a member becomes inactive, their **assigned tasks auto-reassign** to the next active member in rotation, with a logged reason. |

---

## 3. Data model

### 3.1 Prisma schema changes

```prisma
enum HouseholdRole {
  admin
  member
}

enum SystemRole {
  user
  support
}

enum MembershipStatus {
  active
  inactive
}

model User {
  id               String              @id @default(uuid())
  email            String              @unique
  name             String
  passwordHash     String
  systemRole       SystemRole          @default(user)   // replaces old global Role
  refreshTokenHash String?
  memberships      HouseholdMember[]
  managedProperties LandlordProperty[]
  // ...other relations unchanged
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
}

model HouseholdMember {
  id              String            @id @default(uuid())
  user            User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  userId          String
  household       Household         @relation(fields: [householdId], references: [id], onDelete: Cascade)
  householdId     String
  role            HouseholdRole     @default(member)
  status          MembershipStatus  @default(active)
  inactiveFrom    DateTime?
  inactiveUntil   DateTime?
  inactiveReason  String?           @db.Text
  joinedAt        DateTime          @default(now())
  statusLogs      MembershipStatusLog[]

  @@unique([userId, householdId])
  @@index([householdId])
  @@index([householdId, status])
}

model MembershipStatusLog {
  id           String             @id @default(uuid())
  membership   HouseholdMember    @relation(fields: [membershipId], references: [id], onDelete: Cascade)
  membershipId String
  changedBy    User               @relation(fields: [changedById], references: [id])
  changedById  String
  fromStatus   MembershipStatus
  toStatus     MembershipStatus
  from         DateTime?
  until        DateTime?
  reason       String?            @db.Text
  createdAt    DateTime           @default(now())

  @@index([membershipId, createdAt])
}

// Unchanged: Household, LandlordProperty, Task, Ritual, RitualParticipant.
```

### 3.2 Invariants

- **I1 — Last-admin protection:** Every `Household` must always have at least one `HouseholdMember` with `role = admin` and `status = active`. Any operation that would violate this is rejected with a clear error.
- **I2 — Membership uniqueness:** A `(userId, householdId)` pair is unique. A user is either a member or not — no duplicate rows.
- **I3 — Landlord exclusivity:** A user linked to a household via `LandlordProperty` for that household is never simultaneously a `HouseholdMember` of it (enforced at service layer; not a DB constraint). Service rejects: linking a landlord who is already a member, and inviting a member who is already the household's landlord. Covered by an integration test in PR 4.
- **I4 — Inactive window bounds:** When `status = inactive`, `inactiveFrom <= now` and `inactiveUntil` is set and is no more than 90 days after `inactiveFrom`.
- **I5 — Auto-resume:** When the current time passes `inactiveUntil`, the row reverts to `status = active` and the date fields clear. Implemented by both a cron job (defensive) and a lazy check on read (authoritative).

---

## 4. Permission matrix

Legend: ✅ allowed · ❌ denied · 🟡 conditional (rule in column footnote)

| Action | Admin | Member | Inactive member | Landlord | Non-member |
|---|---|---|---|---|---|
| **Household** | | | | | |
| View household + member list | ✅ | ✅ | ✅ | ✅ summary only | ❌ |
| Edit household name/settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete household | ✅ (confirmation step) | ❌ | ❌ | ❌ | ❌ |
| Invite new member | ✅ | ❌ | ❌ | ❌ | ❌ |
| Remove member | ✅ (not last admin) | ❌ | ❌ | ❌ | ❌ |
| Promote member → admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Demote admin → member | ✅ (not last admin) | ❌ | ❌ | ❌ | ❌ |
| Link/unlink landlord | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Membership status** | | | | | |
| Set self inactive (≤ 90 days, end date + reason required) | ✅ (unless last admin) | ✅ | n/a | ❌ | ❌ |
| End own inactive period early | ✅ | ✅ | ✅ | ❌ | ❌ |
| Force-end someone else's inactive | ✅ | ❌ | ❌ | ❌ | ❌ |
| View who is inactive | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Tasks** | | | | | |
| Create routine task | ✅ | ✅ | ❌ | ❌ | ❌ |
| Flag reactive task (snap a mess) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit task | ✅ | 🟡 own only | ❌ | ❌ | ❌ |
| Delete task | ✅ | 🟡 assignee or flagger (no separate `createdBy` field; reactive tasks track `flaggedBy`, routine tasks credit the assignee) | ❌ | ❌ | ❌ |
| Complete task | ✅ if assigned | 🟡 assignee only | ❌ | ❌ | ❌ |
| Override assignee | ✅ | ❌ | ❌ | ❌ | ❌ |
| View tasks | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Rituals** | | | | | |
| Propose ritual | ✅ | ✅ | ❌ | ❌ | ❌ |
| Join ritual | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mark ritual completed | 🟡 proposer or admin | 🟡 proposer only | ❌ | ❌ | ❌ |
| Delete ritual | ✅ | 🟡 proposer only | ❌ | ❌ | ❌ |
| View rituals | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Photos / harmony** | | | | | |
| Upload before/proof photo | ✅ if assigned | 🟡 assignee only | ❌ | ❌ | ❌ |
| View household harmony score | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Rotation logic** | | | | | |
| Eligible for chore rotation | ✅ | ✅ | ❌ (skipped) | ❌ | ❌ |
| Counts toward harmony penalty | ✅ | ✅ | ❌ (excluded) | ❌ | ❌ |
| **System (cross-household)** | | | | | |
| List own households | any authed user | any authed user | any authed user | own properties only | ❌ |
| Create new household (you become admin) | any authed user | any authed user | any authed user | any authed user | ❌ |
| Cross-house read / impersonate | only `systemRole = support` | ❌ | ❌ | ❌ | ❌ |

**Information leak rule:** Non-members of a household receive `404`, not `403`, when hitting any household-scoped route. The existence of houses is not disclosed.

---

## 5. Enforcement architecture

### 5.1 Layered design

```
Request
  ↓
JwtAuthGuard            req.user = User
  ↓
HouseholdScopeGuard     req.scope = { householdId, userId, systemRole, membership?, landlord? }
  ↓
@RequireRole('admin')   coarse, route-level
  ↓
Controller → Service → policy.canX(scope, resource)   fine-grained, object-level
```

Each layer has one responsibility. The combination provides defense in depth without redundant DB calls.

### 5.2 The `HouseholdScope` shape

```ts
// apps/api/src/common/scope.ts
export type HouseholdScope = {
  householdId: string;
  userId: string;
  systemRole: SystemRole;
  membership?: {
    id: string;
    role: HouseholdRole;        // admin | member
    status: MembershipStatus;   // active | inactive
  };
  landlord?: { propertyId: string };
};
```

Exactly one of `membership` or `landlord` is set, unless `systemRole = 'support'` (which may bypass for cross-house reads — used only by admin tools, never by user-facing UI).

### 5.3 Guards

```ts
// apps/api/src/common/guards/household-scope.guard.ts
@Injectable()
export class HouseholdScopeGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const householdId = req.params.householdId ?? req.body?.householdId;
    if (!householdId) throw new BadRequestException('missing householdId');

    const [membership, landlord] = await Promise.all([
      this.prisma.householdMember.findUnique({
        where: { userId_householdId: { userId: req.user.id, householdId } },
        select: { id: true, role: true, status: true, inactiveUntil: true },
      }),
      this.prisma.landlordProperty.findUnique({
        where: { landlordId_householdId: { landlordId: req.user.id, householdId } },
        select: { id: true },
      }),
    ]);

    const resolved = membership
      ? { ...membership, status: this.lazyResume(membership) }
      : undefined;

    if (!resolved && !landlord && req.user.systemRole !== 'support') {
      throw new NotFoundException();
    }

    req.scope = {
      householdId,
      userId: req.user.id,
      systemRole: req.user.systemRole,
      membership: resolved
        ? { id: resolved.id, role: resolved.role, status: resolved.status }
        : undefined,
      landlord: landlord ? { propertyId: landlord.id } : undefined,
    };
    return true;
  }

  private lazyResume(m: { status: MembershipStatus; inactiveUntil: Date | null }): MembershipStatus {
    if (m.status === 'inactive' && m.inactiveUntil && m.inactiveUntil <= new Date()) {
      // Fire-and-forget DB update; return the resolved value immediately.
      return 'active';
    }
    return m.status;
  }
}
```

```ts
// apps/api/src/common/guards/role.guard.ts
export const RequireRole = (...roles: HouseholdRole[]) => SetMetadata('roles', roles);

@Injectable()
export class RoleGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.get<HouseholdRole[]>('roles', ctx.getHandler());
    if (!required?.length) return true;
    const { scope } = ctx.switchToHttp().getRequest();
    if (!scope?.membership) throw new ForbiddenException();
    if (scope.membership.status !== 'active') throw new ForbiddenException();
    return required.includes(scope.membership.role);
  }
}
```

### 5.4 Policy module (pure, shared)

Lives in **`packages/shared/src/policy.ts`** so both `apps/api` and `apps/web` import the same functions. No framework dependencies. No DB. Pure boolean returns.

```ts
// packages/shared/src/policy.ts
export const policy = {
  task: {
    canDelete: (scope, task) => {
      if (!scope.membership || scope.membership.status !== 'active') return false;
      if (scope.membership.role === 'admin') return true;
      return task.assigneeId === scope.userId || task.flaggedById === scope.userId;
    },
    canComplete: (scope, task) =>
      !!scope.membership &&
      scope.membership.status === 'active' &&
      task.assigneeId === scope.userId,
    canEdit: (scope, task) =>
      (scope.membership?.role === 'admin' && scope.membership.status === 'active') ||
      (scope.membership?.status === 'active' && task.assigneeId === scope.userId),
  },
  ritual: {
    canComplete: (scope, ritual) =>
      (scope.membership?.role === 'admin' && scope.membership.status === 'active') ||
      (scope.membership?.status === 'active' && ritual.proposerId === scope.userId),
    canDelete: (scope, ritual) =>
      (scope.membership?.role === 'admin' && scope.membership.status === 'active') ||
      (scope.membership?.status === 'active' && ritual.proposerId === scope.userId),
  },
  household: {
    canRemoveMember: (scope, target, activeAdminCount) => {
      if (scope.membership?.role !== 'admin' || scope.membership.status !== 'active') return false;
      if (target.role === 'admin' && activeAdminCount <= 1) return false;
      return true;
    },
    canDemoteAdmin: (scope, target, activeAdminCount) =>
      scope.membership?.role === 'admin' &&
      scope.membership.status === 'active' &&
      activeAdminCount > 1,
    canDeleteHousehold: (scope) =>
      scope.membership?.role === 'admin' && scope.membership.status === 'active',
  },
  membership: {
    canSetSelfInactive: (scope, activeAdminCount) => {
      if (!scope.membership || scope.membership.status !== 'active') return false;
      if (scope.membership.role === 'admin' && activeAdminCount <= 1) return false;
      return true;
    },
    canForceEndInactive: (scope) =>
      scope.membership?.role === 'admin' && scope.membership.status === 'active',
  },
} as const;
```

### 5.5 Controller + service usage

```ts
@Controller('h/:householdId/tasks')
@UseGuards(JwtAuthGuard, HouseholdScopeGuard, RoleGuard)
export class TasksController {
  @Post()
  create(@Req() req, @Body() dto: CreateTaskDto) {
    return this.tasks.create(req.scope, dto);
  }

  @Delete(':id')
  delete(@Req() req, @Param('id') id: string) {
    return this.tasks.delete(req.scope, id);   // service applies policy
  }

  @Patch(':id/assign')
  @RequireRole('admin')
  reassign(@Req() req, @Param('id') id: string, @Body() dto: AssignDto) {
    return this.tasks.reassign(req.scope, id, dto);
  }
}
```

```ts
// service
async delete(scope: HouseholdScope, taskId: string) {
  const task = await this.prisma.task.findFirst({
    where: { id: taskId, householdId: scope.householdId },
  });
  if (!task) throw new NotFoundException();
  if (!policy.task.canDelete(scope, task)) throw new ForbiddenException();
  await this.prisma.task.delete({ where: { id: taskId } });
}
```

---

## 6. Multi-tenant web routing

### 6.1 Route map

```
apps/web/src/app/
├── (auth)/login, register
├── (app)/
│   ├── page.tsx                       redirects to last-used or /pick
│   ├── pick/page.tsx                  household picker (cards)
│   ├── new/page.tsx                   create household (caller becomes admin)
│   └── h/[householdId]/
│       ├── layout.tsx                 fetches /h/:id/me, provides HouseholdContext
│       ├── page.tsx                   dashboard
│       ├── tasks/page.tsx
│       ├── rituals/page.tsx
│       ├── house/
│       │   ├── members/page.tsx
│       │   ├── invite/page.tsx        admin-only
│       │   └── settings/page.tsx      admin-only
│       └── you/page.tsx               profile + inactive controls
└── (landlord)/
    └── properties/
        ├── page.tsx                   landlord's property list
        └── [propertyId]/page.tsx      read-only summary
```

### 6.2 Switcher

A top-bar component inside `(app)/h/[householdId]/layout.tsx` lists the user's other houses. Selecting one navigates to `/h/<otherId>/<same-tail>` where possible. The URL is canonical; local storage only stores "last visited" to redirect `/` on next login.

### 6.3 UI gating via shared policy

```ts
// apps/web/src/lib/use-can.ts
export function useCan() {
  const ctx = useHousehold();
  return {
    isAdmin: ctx.membership?.role === 'admin' && ctx.membership.status === 'active',
    isActive: ctx.membership?.status === 'active',
    isLandlord: !!ctx.landlord,
    canDeleteTask:   (t) => policy.task.canDelete(ctx, t),
    canCompleteTask: (t) => policy.task.canComplete(ctx, t),
    canEditTask:     (t) => policy.task.canEdit(ctx, t),
  };
}
```

UI gating hides buttons the user cannot use. The server still enforces. **Hidden ≠ blocked.**

### 6.4 Landlord experience

Landlords never reach `/h/[householdId]/...` — the api guard 404s them, and the web links from `/properties/[propertyId]` only point inside the landlord namespace. The landlord summary page is read-only and shows: household name, member names + status, harmony score, last-bloomed timestamp.

---

## 7. Member availability — going inactive

### 7.1 Lifecycle

```
active ──(self-set inactive, end date ≤ 90d)──► inactive ──(time passes inactiveUntil OR admin/self ends early)──► active
```

Every transition writes a `MembershipStatusLog` row recording who, when, from/until, and the reason. The log is append-only.

### 7.2 What "inactive" means operationally

While `status = inactive`:

- The member cannot create routine tasks, flag reactive tasks, complete tasks, propose rituals, or join rituals (RoleGuard rejects writes).
- They remain able to read everything they could read before. UI shows a banner: *"You're away until {date}. Actions are disabled."*
- Chore rotation skips them. The rotation algorithm filters `where: { status: 'active' }` before picking the next assignee.
- Reactive auto-assignment skips them.
- Harmony score excludes their assigned tasks from the penalty side (no penalty for tasks during their stated absence).
- They remain visible in the member list with an "Away until {date}" badge.

### 7.3 Going inactive — the flow

1. Member opens `/h/[id]/you`, clicks **Set as away**.
2. Modal collects `from` (default today), `until` (required, ≤ 90 days from start), `reason` (optional, public).
3. `POST /h/:id/membership/inactive` is called. Service:
   - Validates dates.
   - Checks `policy.membership.canSetSelfInactive` — blocks if this would leave the household with no active admin.
   - Writes the new status + dates + reason.
   - Calls the **reassignment routine** below.
   - Writes a `MembershipStatusLog` row.
4. UI updates instantly via the response.

### 7.4 Task reassignment on inactivation

When a member transitions `active → inactive`:

```
for each task T where assigneeId = userId AND status = pending:
   pick next active member via the existing rotation algorithm
   set T.assigneeId = next.id
   set T.rotationReason = "Reassigned: {name} away until {until}"
```

This is the **same** rotation function that picks assignees for new routine tasks. No new logic to maintain.

### 7.5 Coming back

- **Auto-resume:** when `now > inactiveUntil`, the row flips back to `active`. Implemented two ways:
  - A daily cron at 00:05 server time iterates over `inactiveUntil < now AND status = inactive` and flips them. Defensive sweep.
  - On every authenticated read, `HouseholdScopeGuard` evaluates `lazyResume()` to return the correct status even before the cron runs.
- **Early return by self:** `POST /h/:id/membership/active` flips status back immediately. Logged.
- **Force-end by admin:** same endpoint, admin acts on someone else's membership. Logged with `changedBy = admin.id`.

### 7.6 Constraints and edge cases

- A user who is the only active admin cannot set themselves inactive. They must promote a second admin first. Frontend explains this with the exact text *"You're the only admin in this house. Promote someone else first."*
- An admin can extend a member's inactive window by ending it and asking the member to set a new one — there is no separate "extend" endpoint in this iteration (YAGNI).
- The schema permits 90 days; a future product call may raise or lower it. The 90 is a constant in shared, not duplicated.
- Reactivation does not auto-redistribute future tasks back to the returning member; rotation will pick them up naturally on the next cycle.

---

## 8. Migration plan

Five PRs, each independently green, each deployable. App stays live across the whole sequence.

### PR 1 — shared types + policy module
- Add enums, `HouseholdScope` type, `policy.ts`, scope fixtures.
- 100% unit test coverage on policy before merge.

### PR 2 — Prisma migration + seed rewrite
- Single migration adds new columns, backfills `HouseholdMember.role` from old `User.role`, drops the old column.
- `apps/api/prisma/seed.ts` rewritten:
  - `alice@homebuddy.dev` → admin of demo household
  - `bob@homebuddy.dev` → member of demo household
  - `landlord@homebuddy.dev` → user linked via `LandlordProperty` to demo household
  - `admin@homebuddy.dev` → `systemRole = support` (Mo/Kai/Catja dev account)
- `pnpm db:migrate && pnpm db:seed` succeeds locally and on Railway.

### PR 3 — guards + first module rollout (tasks)
- New `HouseholdScopeGuard`, `RoleGuard`, `@RequireRole`, `@CurrentScope` decorator.
- Refactor `tasks` module: routes move under `/h/:householdId/tasks`. All existing endpoints keep their behavior plus the new authorization checks. Integration tests cover every cell of the matrix that applies to tasks.
- Old flat `/tasks` routes redirect with a deprecation log entry for one release, then are removed in PR 4.

### PR 4 — remaining modules + web route refactor
- Apply the same pattern to `rituals`, `households`, `harmony`, `landlord`.
- Web routes move to `/h/[householdId]/...` alongside `/properties/[propertyId]`. Switcher component lands. UI gating with `useCan` rolls out everywhere a write action exists.

### PR 5 — inactive feature
- `MembershipStatusLog` table, `inactive*` columns activated in service.
- You-page UI for going away + admin force-end UI.
- Cron job for auto-resume. Lazy-check fallback in the guard.
- Reassignment routine wired into the inactivation service.
- Harmony exclusion logic updated.
- e2e Playwright path: "Alice goes away for the weekend" lands.

---

## 9. Testing strategy

Coverage is non-negotiable. Every PR adds tests for the slice it ships. CI gates merges to `main`.

### 9.1 Test pyramid

```
                e2e (Playwright)            ~10 tests, golden paths only
        integration (Nest + Supertest)      ~40 tests, one per guarded route + failure modes
   unit (Vitest)                            policy matrix (every cell), service rules
```

### 9.2 Unit — `packages/shared/__tests__/policy.*.test.ts`

- One file per resource (`policy.task.test.ts`, `policy.ritual.test.ts`, `policy.household.test.ts`, `policy.membership.test.ts`).
- Every cell of §4's matrix maps to a named test.
- Scope fixtures (`adminScope`, `memberScope`, `inactiveScope`, `landlordScope`, `nonMemberScope`) live in `packages/shared/test-fixtures/scopes.ts` and are reused by api + web tests.
- Coverage target: **100% on `policy.*`**.

### 9.3 Integration — `apps/api/test/*.e2e-spec.ts`

- Real Nest app + isolated test Postgres (one schema per Jest worker, set up via `apps/api/test/setup.ts`).
- One spec per controller. Each guarded route gets:
  - happy path (admin)
  - happy path (assignee/proposer)
  - 403 (other member)
  - 403 (inactive member)
  - 404 (landlord, when applicable)
  - 404 (non-member)
  - 401 (unauthenticated)
- Shared factory `apps/api/test/factories.ts` exports `seedScenario()` returning `{ house, admin, alice, bob, inactiveMember, landlord, task, ritual, tokens }`.
- Coverage target on services + guards: **≥ 90%**.

### 9.4 Last-admin invariant — `apps/api/test/last-admin.e2e-spec.ts`

A dedicated file. The invariant is high-risk and must be brutally covered.

- Cannot demote the only admin.
- Cannot remove the only admin.
- Cannot set the only admin inactive.
- Cannot delete the user account of the only admin without a transfer step (deferred; today the row deletion cascade is blocked at the service layer).
- Two admins: each can demote the other, but not when they would become the last.
- Promote → demote → promote sequence stays consistent.

### 9.5 Inactive lifecycle — `apps/api/test/inactive.e2e-spec.ts`

- Self-set with valid window → 200, status flips, log row written.
- Self-set without end date → 400.
- Self-set with `inactiveUntil - inactiveFrom > 90 days` → 400.
- Self-set when sole active admin → 400 with the exact user-facing message.
- Inactivation reassigns owned pending tasks → assert new assignee + `rotationReason`.
- Inactive member excluded from rotation selection → property-style test with 20 trials.
- Inactive member receives 403 on every write route (parametrised).
- Lazy resume on read when `inactiveUntil` is in the past → status returns `'active'`.
- Cron job flips DB rows when `inactiveUntil` passes (test calls the job directly).
- Admin force-end → log row, status flips, called user can act again.

### 9.6 e2e — `apps/web/e2e/*.spec.ts`

Playwright, ~10 paths, run against a real api + DB in CI.

1. Register → become admin of a new house → invite Bob → Bob accepts → Bob appears as member.
2. Alice flags a reactive task → it auto-assigns to Bob → Bob completes with photo → harmony bumps.
3. Alice sets herself away for the weekend → next routine task is auto-routed to Bob → past `inactiveUntil`, Alice's status flips back.
4. Landlord views their property page → sees members + harmony, no task list, no photos.
5. Admin demotes themselves while two admins exist → ok; tries when alone → blocked with the exact UI message.
6. Multi-house user switches via the top-bar → URL changes → data refreshes.
7. Non-member opens `/h/<other-house-id>/tasks` directly → 404 page.
8. Deleting a task you do not own as a regular member → button absent; direct API call returns 403.
9. Login as `systemRole = support` → can read across houses (used by Mo for support).
10. Last-admin tries to delete the house → confirmation modal lets them, but only after transferring or demoting is not required (admin role is enough); deleting cascades cleanly.

### 9.7 CI gates

`.github/workflows/ci.yml` runs on every push:

```yaml
jobs:
  test:
    steps:
      - pnpm install --frozen-lockfile
      - pnpm typecheck
      - pnpm lint
      - pnpm --filter @homebuddy/shared test
      - pnpm --filter @homebuddy/api test
      - pnpm --filter @homebuddy/web test
      - pnpm --filter @homebuddy/web e2e
```

Branch protection on `main` requires the `test` job to pass.

### 9.8 Manual QA checklist

`docs/qa/roles-smoke.md` — 15 checkboxes for the demo. Run before every Railway deploy. Lives alongside this spec.

---

## 10. Non-goals (this iteration)

- No per-permission overrides ("Alice can delete tasks but not invite"). Two roles cover it.
- No CASL/Casbin or external authz library.
- No multi-property bulk views for landlords beyond a list.
- No nested groups (sub-households, sub-rooms). Households are flat.
- No "extend my away period" endpoint — re-create instead.
- No notification system for status changes (toast in UI only). Email/push deferred.
- No transfer-of-ownership workflow when the sole admin deletes their account — for now, the account simply cannot be deleted until a second admin exists.

---

## 11. Risks

| Risk | Mitigation |
|---|---|
| Migration runs in production and drops `User.role` while other code still reads it. | Migration is atomic; the same PR ships the code that no longer reads `User.role`. Pre-deploy smoke test on a Railway preview env. |
| Policy module drifts between api and web. | Shared package import. Same fixtures used in both test suites. Type-only build of policy guarantees one definition. |
| Last-admin guard has a race condition (two admins demoting simultaneously). | Wrap the demote operation in a Prisma transaction with an explicit count query on active admins inside the same tx. |
| Lazy-resume and the cron disagree on edge times. | Cron is the source of writes; the guard's `lazyResume` only changes the value returned to the request, not the DB. DB is eventually consistent within minutes; tests cover both paths. |
| Inactive flag used as a permanent dodge by repeatedly extending. | 90-day cap per request, full audit log, visible to all housemates. Social signal, not technical. Acceptable for bachelor scope. |
| URL refactor breaks deep links from the existing app. | PR 4 ships redirects from old paths to canonical `/h/[id]/*` paths for one release. |

---

## 12. Open questions

None blocking. Possible follow-ups for after this iteration:

- Should `systemRole = support` also have a write path (e.g., create an admin-only support console)? Right now read-only is enough.
- Should households allow custom roles? Not for v1.
- Should the household have a name policy (uniqueness per user)? Currently no constraint.

---

## 13. Acceptance criteria

- All 11 decisions in §2 are implemented and visible in the running app.
- Permission matrix in §4 holds: each cell has a passing integration test.
- A member can go inactive with an end date, gets auto-resumed, can come back early, and an admin can force-end them — all covered by tests.
- A landlord lands on a read-only summary and cannot reach any tenant route.
- Two admins can demote each other; the last admin cannot demote themselves.
- The web app's "switch house" UX lands users on the correct URL with the correct data.
- CI runs all four test suites and gates merges to `main`.
- The demo Railway deploy stays live across every PR in the migration sequence.

---

## Addendum 2026-05-29 — Caretaker-owned common-area chores (Phase 2)

Caretaker mode (§ landlord model) gains a concrete behaviour: an admin can mark a chore as **caretaker-owned**. Such a chore is assigned to the consented caretaker landlord's `User`, carries `Task.caretakerOwned = true`, and is excluded from tenant Smart Rotation (fairness queries filter `caretakerOwned: false`), from fairness load, and from harmony penalties (the landlord is not an active member). New permission rows and rationale live in `docs/ROLES.md` §3 (footnotes 4–5). Endpoint: admin-only `POST /h/:id/tasks/caretaker`, 400 when no consented caretaker landlord is linked. Tenant-side completion by the caretaker is deferred.
