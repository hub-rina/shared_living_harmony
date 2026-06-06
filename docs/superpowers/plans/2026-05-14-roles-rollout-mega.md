# Roles Rollout — Single Mega PR

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. **Speed mode:** skip per-task spec/code reviews — run final whole-PR review only before push. Tests are the gate.

**Goal:** Land everything from spec PRs 2–5 plus legacy cleanup on a single branch (`feat/roles-backend`) and open one PR. The spec at `docs/superpowers/specs/2026-05-14-roles-tenancy-inactive-design.md` is the authoritative reference — read the matching section for any task before implementing.

**Tech Stack:** Prisma 6, Postgres 16, NestJS 11, Next.js 15 App Router, Tailwind 4, `@homebuddy/shared` policy module (already merged in PR 1).

**Scope:**
- Backend: schema + migration + seed + new guards + decorator + module rollouts (tasks, rituals, households w/ members CRUD, landlord) + /auth/me expansion + membership-status endpoints + auto-reassign + cron + lazy resume.
- Frontend: `/h/[householdId]/*` URL-scoped routing, household switcher, `useCan` hook, landlord experience at `/properties/[id]`, You-page inactive controls.
- Legacy cleanup: drop `User.role`, `Role` enum, `@Roles`, `RolesGuard`, role from JWT payload.

**Branch:** `feat/roles-backend` off `main`. Already created.

**Sequencing rule:** complete each task before starting the next. Each task ends with a passing local check and a commit. No `--no-verify`, no AI co-author, no body unless non-obvious.

---

## Phase 1 — Database

### Task 1: Additive Prisma schema

**Files:** `apps/api/prisma/schema.prisma`.

Spec §3.1. Add:
- `enum HouseholdRole { admin member }`, `enum SystemRole { user support }`, `enum MembershipStatus { active inactive }`.
- `User.systemRole SystemRole @default(user)` (do NOT remove `role`).
- On `HouseholdMember`: `role HouseholdRole @default(member)`, `status MembershipStatus @default(active)`, `inactiveFrom DateTime?`, `inactiveUntil DateTime?`, `inactiveReason String? @db.Text`, relation `statusLogs MembershipStatusLog[]`, `@@index([householdId, status])`.
- New `MembershipStatusLog` model per spec §3.1 (id, membershipId, changedById, fromStatus, toStatus, from, until, reason, createdAt, indexed `[membershipId, createdAt]`). Includes named relation `MembershipStatusChanger` on User side.
- Reverse relation on `User`: `membershipChanges MembershipStatusLog[] @relation("MembershipStatusChanger")`.

**Verify:** `pnpm --filter @homebuddy/api prisma format && pnpm --filter @homebuddy/api prisma validate` both succeed.

**Commit:** `feat(prisma): add per-household role, status, inactive window, status log`.

### Task 2: Migration + backfill

**Files:** new `apps/api/prisma/migrations/<timestamp>_roles_tenancy_inactive_additive/migration.sql`.

1. `pnpm db:up`
2. `pnpm --filter @homebuddy/api exec prisma migrate dev --name roles_tenancy_inactive_additive --create-only`
3. Append to the generated `migration.sql`:

```sql

UPDATE "HouseholdMember" hm
SET "role" = 'admin'
FROM "User" u
WHERE hm."userId" = u."id" AND u."role" = 'admin';

UPDATE "User" SET "systemRole" = 'support' WHERE email = 'admin@homebuddy.dev';
```

4. `pnpm --filter @homebuddy/api exec prisma migrate dev` — apply, regenerate client.
5. Inspect via psql: `\d "HouseholdMember"`, `\d "MembershipStatusLog"`, columns on `User`.

**Commit:** `feat(prisma): migration for roles, status, inactive window, status log`.

### Task 3: Seed update

**Files:** `apps/api/prisma/seed.ts`.

- Import `SystemRole, HouseholdRole` from `@prisma/client`.
- `DUMMY_USERS` entries gain `systemRole` (alice/bob/landlord = `user`, admin = `support`).
- User upsert `update` block adds `systemRole: u.systemRole`.
- Replace the member-creation loop with a tuple-array that sets `role` per member: alice=admin, bob=member, admin@=admin. Upsert `update: { role }` and `create: { userId, householdId, role }`.

**Verify:** `pnpm db:seed` succeeds. SQL check (from spec §8 PR 2 test plan) confirms expected rows.

**Commit:** `feat(seed): set per-household role and systemRole on demo users`.

---

## Phase 2 — Backend auth primitives

### Task 4: `HouseholdScope` + `@CurrentScope` decorator

**Files:**
- Create `apps/api/src/common/decorators/current-scope.decorator.ts` — reads `req.scope` and returns it. Same shape as `CurrentUser`.
- Re-export `HouseholdScope` and `HouseholdRole`/`MembershipStatus`/`SystemRole` from `@homebuddy/shared` so api modules import a single name.

```ts
// apps/api/src/common/decorators/current-scope.decorator.ts
import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { Request } from 'express';
import type { HouseholdScope } from '@homebuddy/shared';

export const CurrentScope = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): HouseholdScope => {
    const req = ctx.switchToHttp().getRequest<Request & { scope: HouseholdScope }>();
    return req.scope;
  },
);
```

**Commit:** `feat(api): add CurrentScope param decorator`.

### Task 5: `HouseholdScopeGuard`

**Files:** Create `apps/api/src/common/guards/household-scope.guard.ts`. Per spec §5.3.

- Extracts `householdId` from `req.params.householdId ?? req.body?.householdId`. 400 if missing.
- Queries `HouseholdMember` (by `(userId, householdId)`) and `LandlordProperty` (by `(landlordId, householdId)`) in parallel.
- Applies `lazyResume`: if membership.status === 'inactive' && inactiveUntil <= now, resolve as `'active'` for this request (and fire-and-forget UPDATE in DB).
- 404 if neither membership nor landlord and `systemRole !== 'support'`.
- Attaches `req.scope` per `HouseholdScope` shape.

Use `PrismaService` from `apps/api/src/prisma/prisma.service.ts`. Register in the modules that consume it.

**Commit:** `feat(api): add HouseholdScopeGuard with lazy resume`.

### Task 6: `RoleGuard` + `@RequireRole`

**Files:**
- Create `apps/api/src/common/decorators/require-role.decorator.ts` — `SetMetadata('roles', ...)`.
- Create `apps/api/src/common/guards/role.guard.ts` — reads metadata via `Reflector`, requires `req.scope.membership` to exist with `status === 'active'` and `role` in the required list.

Per spec §5.3.

**Commit:** `feat(api): add RoleGuard and RequireRole decorator`.

---

## Phase 3 — Backend module rollouts

For each module: route prefix changes to `/h/:householdId/...`, controllers take `@CurrentScope() scope`, services take `scope` as first arg, ownership rules call shared `policy.*` from `@homebuddy/shared`. Integration tests cover every matrix cell (admin/member/inactive/landlord/non-member, plus 401 unauthenticated).

### Task 7: Tasks module

**Files:**
- Modify: `apps/api/src/tasks/tasks.controller.ts`, `apps/api/src/tasks/tasks.service.ts`, `apps/api/src/tasks/tasks.module.ts`, `apps/api/src/tasks/tasks.service.spec.ts`.
- Create: `apps/api/test/tasks.e2e-spec.ts` (Supertest, real Prisma against the test DB).

Controller prefix → `@Controller('h/:householdId/tasks')`. Guards stack: `@UseGuards(JwtAuthGuard, HouseholdScopeGuard, RoleGuard)`.

Endpoints (preserve current behavior, change signatures):
- `GET /` list — `policy.task.canViewList(scope)`.
- `GET /mine` — keep flat under `/tasks/mine` or move under `/h/:id/tasks/mine`? Move under household.
- `POST /` create — `policy.task.canCreate(scope)`.
- `POST /flag-mess` — same as create.
- `POST /:id/complete` — fetch task, call `policy.task.canComplete(scope, task)`, 403 if not.
- `DELETE /:id` — fetch task, `policy.task.canDelete(scope, task)`, 403 if not.
- `PATCH /:id/assign` (new) — `@RequireRole('admin')`, allows admin reassignment.

Service: every method now takes `scope: HouseholdScope` first. Drop the old `assertMember(userId, householdId)` calls — guard already proved membership. Use `scope.householdId` and `scope.userId` instead of params.

**Integration tests:** for each endpoint, parametrized cases for admin / assignee-member / other-member / inactive-member / landlord / non-member / unauthenticated. Assert the documented status code (200 / 403 / 404 / 401).

**Commit:** `feat(tasks): refactor to /h/:householdId/tasks with new guards and tests`.

### Task 8: Rituals module

**Files:** `apps/api/src/rituals/rituals.controller.ts`, `rituals.service.ts`, `rituals.module.ts`, new `apps/api/test/rituals.e2e-spec.ts`.

Same shape as tasks. Routes under `/h/:householdId/rituals`. Endpoints: list, create, `:id/join`, `:id/complete`, `:id` (DELETE). Use `policy.ritual.*`. Integration tests cover proposer, admin override, inactive, etc.

**Commit:** `feat(rituals): refactor to /h/:householdId/rituals with new guards`.

### Task 9: Households module (members CRUD + settings + danger zone)

**Files:** `apps/api/src/households/households.controller.ts`, `households.service.ts`, `households.module.ts`, new `apps/api/test/households.e2e-spec.ts`.

Keep `GET /households` (list user's households — no scope guard, uses `@CurrentUser`) and `POST /households` (create new — caller becomes admin member). Add nested resources under `/h/:householdId/...`:

- `GET /h/:id` — household details + members list. View permission `policy.household.canView`.
- `PATCH /h/:id` — edit settings. `@RequireRole('admin')`. Uses `policy.household.canEditSettings`.
- `DELETE /h/:id` — admin only.
- `GET /h/:id/members` — list members + their status/role. View.
- `POST /h/:id/members/invite` — invite (admin only — simplified: pass an email or userId, creates membership row).
- `DELETE /h/:id/members/:memberId` — remove member. Service queries `activeAdminCount`, calls `policy.household.canRemoveMember(scope, target, count)`.
- `PATCH /h/:id/members/:memberId/role` — promote/demote. `policy.household.canPromote` or `canDemote`.
- `POST /h/:id/landlord` — link landlord (admin only, idempotent).
- `DELETE /h/:id/landlord/:landlordUserId` — unlink (admin only).

**Last-admin transaction:** the service that mutates role/status/membership MUST run inside a Prisma `$transaction` that re-counts active admins atomically. See spec §11 risks.

Integration tests cover the matrix and the last-admin invariant.

**Commit:** `feat(households): add members CRUD endpoints with last-admin guard and tests`.

### Task 10: Landlord module refactor

**Files:** `apps/api/src/landlord/landlord.controller.ts`, `landlord.service.ts`, new `apps/api/test/landlord.e2e-spec.ts`.

Replace `@Controller('landlord')` + `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles('landlord')` with:
- `GET /properties` — list properties for the authenticated user via `LandlordProperty` rows. No `HouseholdScopeGuard` needed (no `householdId`).
- `GET /properties/:propertyId` — load property by id, assert the requester is the landlord on it, return the summary shape (household name, members basic info, harmony score, latest activity). Per spec §6.4.
- `GET /properties/:propertyId/harmony` — read-only score.

Reject tenant routes for landlords by structure: the new `/h/:householdId/*` endpoints are 404 for landlords because `HouseholdScopeGuard` only attaches landlord scope inside the dedicated landlord endpoints; tenant routes fail membership check.

Integration tests cover: landlord sees their property summary; landlord 404s on tenant routes; non-landlord 404 on properties endpoints.

**Commit:** `feat(landlord): switch to /properties/:id with new guards`.

---

## Phase 4 — Auth response + JWT cleanup

### Task 11: `/auth/me` expansion + drop role from JWT

**Files:** `apps/api/src/auth/auth.controller.ts`, `auth.service.ts`, `auth.types.ts`, `strategies/jwt.strategy.ts`, `auth.service.spec.ts`.

- Update `JwtPayload` to drop `role`. Keep `sub`, `email`.
- `AuthUser` drops `role`. Add `systemRole: SystemRole`.
- `JwtStrategy.validate` re-fetches the user from DB on each request to get `systemRole` (cheap; cached by Postgres). Or include `systemRole` in JWT payload — pick the latter (faster, no DB hit per request).
- `auth.service.login` and `register` mint JWTs without `role`. Login response: `{ accessToken, refreshToken, user: { id, email, name, systemRole, createdAt } }`.
- `/auth/me` returns `{ id, email, name, systemRole, createdAt, memberships: Array<{ householdId, householdName, role, status }>, properties: Array<{ propertyId, householdId, householdName }> }`. Web uses this to populate the picker, switcher, and `useCan`.

**Migration concern:** existing tokens minted before this PR still carry `role`. To handle them: have JwtStrategy ignore the unknown field gracefully. New `AuthUser` shape drops `role` — old tokens just produce a `systemRole='user'` default if missing.

Update `auth.service.spec.ts` to assert the new payload shape.

**Commit:** `feat(auth): drop role from JWT, return memberships and properties from /auth/me`.

---

## Phase 5 — Inactive lifecycle backend

### Task 12: Membership-status endpoints + auto-reassignment

**Files:**
- Modify: `apps/api/src/households/households.controller.ts`, `households.service.ts`.
- New methods on `households.service.ts` for: `setSelfInactive(scope, input)`, `endOwnInactive(scope)`, `forceEndOther(scope, memberId)`.
- New endpoints under `/h/:id/membership/...`:
  - `POST /h/:id/membership/inactive` — body `{ from, until, reason? }`. Service calls `validateInactiveWindow` from shared, then `policy.membership.canSetSelfInactive(scope, activeAdminCount)`. In a `$transaction`: update HouseholdMember, write `MembershipStatusLog`, run reassignment routine.
  - `POST /h/:id/membership/active` — end own inactive period.
  - `POST /h/:id/members/:memberId/end-inactive` — admin force-end.
- New zod input schemas in `packages/shared/src/membership.ts` (e.g. `SetInactiveInputSchema`).

**Reassignment routine:**
```ts
async reassignTasksOnInactivation(tx, householdId, leavingUserId) {
  const tasks = await tx.task.findMany({
    where: { householdId, assigneeId: leavingUserId, status: 'pending' },
  });
  const leaving = await tx.user.findUniqueOrThrow({ where: { id: leavingUserId } });
  for (const t of tasks) {
    const next = await this.rotation.pickAssignee(householdId, t.title, t.weight, { excludeUserId: leavingUserId });
    await tx.task.update({
      where: { id: t.id },
      data: { assigneeId: next.userId, rotationReason: `Reassigned: ${leaving.name} away until ${...}` },
    });
  }
}
```

Extend `SmartRotationService.pickAssignee` to accept an optional `excludeUserId` AND to skip members where `status === 'inactive'`. Update the rotation spec tests.

Integration tests in `apps/api/test/inactive.e2e-spec.ts` per spec §9.5: valid window, missing until → 400, > 90 days → 400, sole admin self-inactive → 400, reassignment fires, force-end logs to MembershipStatusLog.

**Commit:** `feat(households): add membership-status endpoints with auto-reassignment`.

### Task 13: Auto-resume cron + harmony exclusion

**Files:**
- Create: `apps/api/src/households/membership-resume.cron.ts` — a `@Injectable()` with `@Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)` (use `@nestjs/schedule`, add to dependencies if missing).
- Modify: `apps/api/src/app.module.ts` to import `ScheduleModule.forRoot()` and register the cron.
- Modify: `apps/api/src/harmony/harmony.service.ts` — penalty calculation excludes tasks where the assignee was inactive during the missed window. Read the existing harmony logic and patch it minimally.

Cron implementation: `UPDATE "HouseholdMember" SET status='active', inactiveFrom=NULL, inactiveUntil=NULL, inactiveReason=NULL WHERE status='inactive' AND inactiveUntil <= NOW()` + write resume rows to `MembershipStatusLog` (use a system user id or `changedById=userId`).

Add a unit test that calls the cron method directly with a fake `Date.now()` to assert flips happen.

**Commit:** `feat(households): auto-resume cron and harmony exclusion for inactive members`.

---

## Phase 6 — Web refactor

### Task 14: `/h/[householdId]/*` route scaffold + HouseholdContext + useCan

**Files:**
- Create: `apps/web/src/lib/household-context.tsx` — provider, `useHousehold()` hook.
- Create: `apps/web/src/lib/use-can.ts` — exports `useCan` per spec §6.3 calling shared `policy.*`.
- Create: `apps/web/src/app/(app)/h/[householdId]/layout.tsx` — fetches `/h/:id/me` (returns scope info; if `404` redirect to `/pick`), provides context.
- Create: `apps/web/src/app/(app)/pick/page.tsx` — picker showing memberships + properties from `/auth/me`. Click → navigate.
- Create: `apps/web/src/app/(app)/new/page.tsx` — create a household (caller becomes admin).
- Modify: `apps/web/src/app/(app)/page.tsx` (root `/`) — redirects to last-visited household (localStorage) or `/pick`.

The `/h/:id/me` endpoint doesn't exist yet on api — add to `households.controller.ts` Task 9 OR add here as a separate small backend endpoint that returns `{ scope: HouseholdScope }`. Pick: add to households controller in Task 9 (already responsible for household reads).

**Commit:** `feat(web): add /h/[householdId] route scaffold and HouseholdContext`.

### Task 15: Migrate existing pages

**Files:**
- Move: every file under `apps/web/src/app/(app)/today/`, `apps/web/src/app/(app)/tasks/`, `apps/web/src/app/(app)/rituals/`, `apps/web/src/app/(app)/house/`, `apps/web/src/app/(app)/you/` → under `apps/web/src/app/(app)/h/[householdId]/...`.
- Update every API call in those pages to hit the new `/h/:householdId/*` endpoints. Use `useHousehold()` to get the active id.
- Replace any `user.role === 'landlord'` branch with `useCan().isLandlord`.
- Add a switcher component in `apps/web/src/components/household-switcher.tsx`; mount in the layout's top bar.
- Update `apps/web/src/lib/api.ts` client helpers to take `householdId` (or fold it into a route helper).

Touch every page that calls `/tasks`, `/rituals`, `/households/:id`. Search-and-replace cleanly. Verify each page renders with the demo user.

**Commit:** `feat(web): move app pages under /h/[householdId] and wire switcher`.

### Task 16: Landlord experience at `/properties/[id]`

**Files:**
- Move `apps/web/src/app/(landlord)/...` content. Routes become `/properties` (list) and `/properties/[propertyId]` (read-only summary).
- The summary page calls `/properties/:id` from Task 10 and renders household name, member names (with status badge), harmony score, last activity. No task/ritual details, no photos.
- Drop the `(landlord)/layout.tsx` redirect that checked `user.role === 'landlord'`. Replace with: if the auth user has at least one landlord property (from `/auth/me`), they can see `/properties`; otherwise 404.

**Commit:** `feat(web): landlord experience at /properties/[id]`.

### Task 17: Inactive UI on /you + member status badges

**Files:**
- Modify: `apps/web/src/app/(app)/h/[householdId]/you/page.tsx`.
- Create: `apps/web/src/components/inactive-modal.tsx` — date pickers, reason textarea, validation via shared `validateInactiveWindow`.
- Modify: `apps/web/src/app/(app)/h/[householdId]/house/members/page.tsx` to render status pill ("Away until …") and admin force-end button.
- Wire to the three Task 12 endpoints.

**Commit:** `feat(web): inactive controls on You page and member status badges`.

---

## Phase 7 — Legacy cleanup

### Task 18: Drop `User.role`, `Role` enum, `@Roles`, `RolesGuard`, role from JWT

**Files:**
- New Prisma migration `<timestamp>_drop_legacy_role` that does `ALTER TABLE "User" DROP COLUMN "role"; DROP TYPE "Role";`.
- Delete `apps/api/src/common/guards/roles.guard.ts`, `apps/api/src/common/decorators/roles.decorator.ts`.
- Remove `Role` from `apps/api/src/auth/auth.service.ts` (the `Role.member` default on register — replace with no explicit value, or set `systemRole: 'user'`).
- Delete `UserRole` schema from `packages/shared/src/user.ts` and any consumer reference. Update `PublicUserSchema` to drop `role` (it now reflects the new shape).
- Update `apps/web` — should already have no `user.role` reads after Task 16. Grep to confirm.
- Run `pnpm db:seed` against migrated DB to verify it still produces the expected demo state.

**Commit:** `chore(roles): drop legacy User.role and RolesGuard`.

---

## Phase 8 — Verification + PR

### Task 19: Final verification + push + open PR

- [ ] `pnpm typecheck` — all workspaces green.
- [ ] `pnpm lint` — all workspaces green.
- [ ] `pnpm --filter @homebuddy/shared test` — 106 tests from PR 1 still pass.
- [ ] `pnpm --filter @homebuddy/api test` — every new integration spec passes. Existing 19 tests still pass (or are updated where they asserted the old shape).
- [ ] `pnpm --filter @homebuddy/web test` — passes (or `--passWithNoTests` if web has no jest config yet).
- [ ] `pnpm build` — full monorepo builds.
- [ ] `pnpm db:reset` — migrations + seed run cleanly end-to-end.
- [ ] Smoke: api boots, login alice → /h/:id/tasks works; login landlord → /properties works; switching households works; setting self inactive works.
- [ ] Final whole-PR reviewer subagent — verifies spec coverage, last-admin invariant, no dead code, lockfile diff sane, no `--no-verify` commits.
- [ ] `git push -u origin feat/roles-backend`
- [ ] `gh pr create --base main --title "feat: roles, multi-tenancy, and member availability (PRs 2-5)" --body "<summary referencing spec sections covered, test plan checklist, list of breaking changes (URL shape, /auth/me shape, dropped User.role)>"`

**Done when:** PR opens, CI green.

---

## Notes for the implementer

- Read spec sections inline as you implement: §3.1 for schema, §5.3 for guards, §5.4 for policy usage, §6 for web, §7 for inactive lifecycle, §8 PR sequence (we're collapsing 4 PRs into 1).
- Don't extract the duplicated `isActiveMember`/`isActiveAdmin` helpers across policy files — intentional.
- Use the existing `PrismaService` from `apps/api/src/prisma/prisma.service.ts`.
- Tests live in `apps/api/test/*.e2e-spec.ts`. Use `Test.createTestingModule` + `Supertest`. Database setup: reuse the docker compose Postgres for now; the spec calls for isolated schemas per worker, but for speed mode one shared test DB is fine — wrap each spec in `prisma.$transaction` rollback OR `beforeEach`/`afterEach` truncates.
- Branch protection: do not push to `main`. Push only to `feat/roles-backend`. PR target = `main`.
- If you hit a "this is bigger than expected" moment (e.g., harmony exclusion is more involved than the spec assumed), report DONE_WITH_CONCERNS and the controller picks up.
