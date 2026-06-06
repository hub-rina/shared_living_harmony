# HomeBuddy — Role Management Reference

**Audience:** AI agents (Claude, Copilot, Cursor, etc.) working in this repo. Also useful for humans reading the codebase for the first time.

**Authoritative spec:** `docs/superpowers/specs/2026-05-14-roles-tenancy-inactive-design.md`. When this document and the spec disagree, the spec wins; update this doc.

**Why this exists:** The authorization model is the spine of the app. Every controller, every service, every UI button bends to it. If you misread the rules and ship code that contradicts them, you create privacy leaks, give roommates the power to nuke each other's data, or break the chore-rotation fairness model. Read this before touching any guard, policy, or controller that mentions `householdId`.

---

## 1. TL;DR

Four kinds of actors:

| Actor | Where it lives | What it means |
|---|---|---|
| **System support** | `User.systemRole = 'support'` | App-level admin (the developer, Mo, etc.). Bypasses household membership checks. Used for support tools, not user-facing routes. |
| **Household admin** | `HouseholdMember { role: 'admin', status: 'active' }` | Manages a specific household. Invites/removes members, changes settings, deletes the house, overrides task assignments. |
| **Household member** | `HouseholdMember { role: 'member', status: 'active' }` | Lives in the house. Does chores, joins rituals, can manage their own tasks and the rituals they proposed. |
| **Landlord** | `LandlordProperty { landlordId, householdId, mode, consentGranted }` | Owns the property. Optional and **tenant-consented**: sees an aggregate-only summary (health score, churn risk, counts) and **only while `consentGranted` is true**. Never sees individual tenants, names, tasks, rituals, photos, or per-person fault. `mode` is `observer` (watch only) or `caretaker` (maintains shared areas — Phase 2 behavior). Never appears in `HouseholdMember` for the same household. See `docs/PRIVACY.md`. |

Plus one **state modifier**:

| State | Where | Effect |
|---|---|---|
| **Inactive member** | `HouseholdMember.status = 'inactive'` with `inactiveUntil` | Member is on vacation/leave. Cannot perform any write action. Skipped by chore rotation. Excluded from harmony penalties. Auto-resumes when `inactiveUntil` passes. |

**One person can have multiple of these across different households.** Alice might be an admin in house A, a regular member in house B, and a landlord of property C — all at the same time. Roles are *per-household*, not global.

---

## 2. Why these specific roles

### Why per-household roles instead of a global role

Real life: a person can rent out one house while renting another. The same human is "landlord of A" and "tenant of B". A global `User.role` field cannot express that. The pre-rollout schema had `User.role` as `member | admin | landlord` — it was insufficient. We now carry the role on `HouseholdMember` (`admin | member`) and the landlord relationship in its own table (`LandlordProperty`).

The legacy `User.role` column and `Role` enum are gone — PR #2 dropped them.

### Why landlord is separate from membership

A landlord is **not a roommate**. They don't live in the house, don't do chores, shouldn't see the same data tenants see. Lumping them into `HouseholdMember` with `role: 'landlord'` would force every chore-rotation query and every ritual list to filter `WHERE role != 'landlord'` — bug-prone. Separate table = separate query path = harder to leak.

If you ever need a landlord-who-also-lives-there, that's a future feature: dual relationship. Not supported today.

### Why two tenant tiers (admin + member) and not more

Common SaaS pattern (Slack, Notion). Members do the day-to-day; admins handle invitations, settings, and destructive ops. Three tiers (owner + admin + member) was considered but the value of an immutable owner is low for a shared house — promotion/demotion among admins is enough.

### Why a "support" system role

The developer (Mo) needs to be able to read across households for debugging without being a member of every house. `systemRole = 'support'` lets `HouseholdScopeGuard` bypass the membership check. Used only by internal support tooling, never exposed in normal user-facing routes.

---

## 3. Full permission matrix

Legend: ✅ allowed · ❌ denied · 🟡 conditional (see footnote).

| Action | Admin | Member | Inactive member | Landlord | Non-member |
|---|---|---|---|---|---|
| **Household** | | | | | |
| View household + member list | ✅ | ✅ | ✅ | ✅ summary only | ❌ |
| Edit household name/settings | ✅ | ❌ | ❌ | ❌ | ❌ |
| Delete household | ✅ confirm | ❌ | ❌ | ❌ | ❌ |
| Invite new member | ✅ | ❌ | ❌ | ❌ | ❌ |
| Remove member | ✅ ¹ | ❌ | ❌ | ❌ | ❌ |
| Promote member → admin | ✅ | ❌ | ❌ | ❌ | ❌ |
| Demote admin → member | ✅ ¹ | ❌ | ❌ | ❌ | ❌ |
| Link/unlink landlord | ✅ | ❌ | ❌ | ❌ | ❌ |
| Set landlord mode + consent (share / stop sharing) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Regenerate the join code | ✅ | ❌ | ❌ | ❌ | ❌ |
| **Membership status (inactive)** | | | | | |
| Set self inactive (end date + reason required, ≤ 90 days) | ✅ ² | ✅ | n/a | ❌ | ❌ |
| End own inactive period early | ✅ | ✅ | ✅ | ❌ | ❌ |
| Force-end someone else's inactive | ✅ | ❌ | ❌ | ❌ | ❌ |
| View who is inactive | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Tasks** | | | | | |
| Create routine task | ✅ | ✅ | ❌ | ❌ | ❌ |
| Flag reactive task ("snap a mess") | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit task | ✅ | 🟡 own only | ❌ | ❌ | ❌ |
| Delete task | ✅ | 🟡 own only ³ | ❌ | ❌ | ❌ |
| Complete task | ✅ if assigned | 🟡 assignee only | ❌ | ❌ | ❌ |
| Override assignee (reassign) | ✅ ⁴ | ❌ | ❌ | ❌ | ❌ |
| Add a caretaker-owned common-area chore | ✅ ⁵ | ❌ | ❌ | ❌ | ❌ |
| View task list | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Rituals** | | | | | |
| Propose ritual | ✅ | ✅ | ❌ | ❌ | ❌ |
| Join ritual | ✅ | ✅ | ❌ | ❌ | ❌ |
| Mark ritual completed | 🟡 proposer or admin | 🟡 proposer only | ❌ | ❌ | ❌ |
| Delete ritual | ✅ | 🟡 proposer only | ❌ | ❌ | ❌ |
| View rituals | ✅ | ✅ | ✅ | ❌ | ❌ |
| **Cost sharing (money)** | | | | | |
| View bills + balances | ✅ | ✅ | ✅ | ❌ ⁶ | ❌ |
| Add a bill (scan/split) | ✅ | ✅ | ❌ | ❌ | ❌ |
| Edit / delete a bill | ✅ | 🟡 creator only | ❌ | ❌ | ❌ |
| Mark a share paid (+ proof) | 🟡 if the debtor | 🟡 if the debtor | ❌ | ❌ | ❌ |
| Confirm a share received | 🟡 if the bill creator | 🟡 if the bill creator | ❌ | ❌ | ❌ |
| **Photos / harmony** | | | | | |
| Upload before/proof photo | ✅ if assigned | 🟡 assignee only | ❌ | ❌ | ❌ |
| View household harmony score | ✅ | ✅ | ✅ | ✅ | ❌ |
| **Rotation + harmony math** | | | | | |
| Eligible for chore rotation | ✅ | ✅ | ❌ skipped | ❌ | ❌ |
| Their overdue tasks count toward harmony penalty | ✅ | ✅ | ❌ excluded | ❌ | ❌ |
| **System / cross-household** | | | | | |
| List own households | any authenticated user | any authenticated user | any authenticated user | own properties only | ❌ |
| Create new household (caller becomes admin) | any authenticated user | any authenticated user | any authenticated user | any authenticated user | ❌ |
| Join a house by code | any authenticated user | any authenticated user | any authenticated user | any authenticated user | any authenticated user |
| Cross-house read / impersonate | only `systemRole=support` | ❌ | ❌ | ❌ | ❌ |

**Footnotes:**

1. **Last-admin guard.** An admin cannot remove or demote another admin if doing so would leave the household with zero active admins. Enforced in service-layer Prisma `$transaction` that re-counts `WHERE role='admin' AND status='active'` atomically.
2. An admin cannot set themselves inactive if they are the only active admin in the household. They must promote another admin first.
3. "Own only" for task delete means the user is either the **assignee** (routine tasks — system picked them) or the **flagger** (reactive tasks — they snapped the mess). `Task` has no separate `createdBy` field; flagger and assignee together cover authorship.
4. Caretaker-owned chores never rotate — `taskPolicy.canReassign(scope, task)` returns false when `task.caretakerOwned`, and Smart Rotation's fairness queries filter `caretakerOwned: false` so they never inflate a tenant's load or contribution score.
5. **Caretaker-owned common-area chores.** When a household has a linked landlord in `caretaker` mode with `consentGranted: true`, an admin can add a chore that the caretaker owns (`POST /h/:id/tasks/caretaker`). The chore's `assigneeId` is the caretaker landlord's `User` (the caretaker "maintains shared areas" per §1), `caretakerOwned = true`, and it is fully excluded from tenant Smart Rotation, fairness load, and harmony penalties (the landlord has no active membership, so `applyOverduePenalty` already skips it). Tenants see it read-only ("looked after by your caretaker"); no member can complete, edit, or reassign it. Rejected with 400 if no consented caretaker landlord is linked. Tenant-side completion by the caretaker is future work.
6. **Money is tenant-only.** Shared bills, splits, balances, and receipt/proof images never cross the Privacy Line into the landlord portal, in any mode — there is no expense route under `/properties/:id`. The bill creator is the payer/creditor and is the only one who can confirm a share received; only the named debtor can mark their own share paid (two-sided settlement). `expensePolicy` enforces this; see `docs/superpowers/specs/2026-06-06-cost-sharing-design.md`.

**Join by code is self-service.** Any authenticated user who presents a valid join code becomes a `member` (active) via the unscoped `POST /households/join` — there is no admin gate on joining (a code is the capability). Regenerating the code is admin-only (`householdPolicy.canRegenerateJoinCode`, `POST /h/:id/join-code/regenerate`) and invalidates the old code immediately. The code lives on `Household.joinCode` (unique); the email-invite endpoint is retained separately for a future email integration.

**Information leak rule:** Non-members of a household receive **`404`**, not `403`, when they hit any household-scoped route. The existence of houses is not disclosed.

---

## 4. The inactive lifecycle in detail

This is the most-subtle subsystem. Read it twice.

### 4.1 What "inactive" means

A `HouseholdMember` row with `status = 'inactive'` plus an `inactiveFrom` and `inactiveUntil` window (and optionally a `reason`). The member is on vacation, sick, in exam mode — *temporarily* unavailable. They keep their membership, they keep their household role, but they are paused.

Operationally, while inactive:

- They **cannot** create routine tasks, flag reactive tasks, complete tasks, propose rituals, join rituals. `RoleGuard` rejects writes outright; service methods double-check via `taskPolicy` / `ritualPolicy`.
- They **can** still read everything they could before. The UI shows a banner: *"You're away until {date}. Actions are disabled."*
- The chore-rotation algorithm filters them out (`SmartRotationService.pickAssignee` queries `WHERE status = 'active'`).
- The reactive-flag auto-assignment skips them (same code path).
- Their assigned **overdue** tasks do not penalize harmony (`HarmonyService.applyOverduePenalty` filters by current assignee status).
- They appear in the member list with an "Away until {date}" badge.

### 4.2 Going inactive

1. Member opens `/h/:id/you`, clicks "Set as away".
2. Modal collects `from` (default today), `until` (required), `reason` (optional, public to the household).
3. Web validates locally with shared `validateInactiveWindow(...)`. Catches: missing until, from in the past, until ≤ from, span > `INACTIVE_MAX_DAYS` (90).
4. `POST /h/:id/membership/inactive` — service runs the same validation, applies `membershipPolicy.canSetSelfInactive(scope, activeAdminCount)`, then in one Prisma `$transaction`:
   - Updates the `HouseholdMember` row with status, dates, reason.
   - Writes a `MembershipStatusLog` row (who, when, from/until, reason).
   - **Auto-reassigns** every pending or overdue task currently assigned to the leaving member, calling `SmartRotationService.pickAssignee` with `excludeUserId` set. `rotationReason` records the absence in human-readable form.

If the member is the only active admin, the operation is rejected with a 403 and a clear message ("You're the only admin. Promote someone else first.").

### 4.3 Coming back

Three paths:

- **Auto-resume.** A daily cron at 00:05 server time (`MembershipResumeCron`) flips rows where `inactiveUntil <= now` back to `active`. Defensive sweep.
- **Lazy resume.** `HouseholdScopeGuard` checks on every authenticated read: if it sees an inactive row with `inactiveUntil <= now`, it resolves the scope's status as `'active'` immediately and fires-and-forgets a DB update. This means a user who logs in *before* the cron runs still sees themselves as active. The DB catches up shortly.
- **Early return by self.** `POST /h/:id/membership/active` flips status back. Logged.

And one admin override:

- **Force-end by admin.** `POST /h/:id/members/:memberId/end-inactive`. Logged with `changedBy = admin.id` and `reason = 'admin-end'`.

### 4.4 Why a 90-day cap

A self-serve "I'm away forever" defeats the chore-fairness goal. 90 days is long enough to cover summer break, surgery recovery, a sabbatical — anything shorter than a true move-out. Beyond 90 days, the member re-requests an extension explicitly (or the admin steps in). The cap is exported from `@homebuddy/shared` as `INACTIVE_MAX_DAYS` — change it in one place, propagates everywhere.

### 4.5 Why the audit log

`MembershipStatusLog` is append-only and logs every transition (self-inactive, self-end, cron auto-resume, admin force-end). Two reasons:

- **Trust.** Roommates can see who set whom inactive when. Discourages abuse without technical enforcement.
- **Debugging.** When a roommate complains "I never went inactive!" we can see exactly when, by whom, and the stated reason.

---

## 5. Last-admin invariant

The single most important invariant in the authorization model:

> Every household must always have at least one `HouseholdMember` with `role = 'admin'` and `status = 'active'`.

If this invariant breaks, the household becomes unmanageable — no one can invite, settle disputes, or delete the house. It is enforced **only** at the service layer (not at the DB layer; Prisma has no easy way to express it as a constraint) and **only** inside a Prisma `$transaction` that re-counts active admins atomically.

The operations that touch it:

- **Remove member.** Blocks if target is admin+active and the count is ≤ 1.
- **Demote admin → member.** Same guard.
- **Set self inactive.** Blocks if caller is the only active admin (per `membershipPolicy.canSetSelfInactive`).

The cron auto-resume can never violate the invariant — it only flips inactive → active, raising the count.

The deletion of the entire household is allowed (the cascade takes everyone with it, no orphan rows). The deletion of a single user account is not yet supported — when implemented, it must also respect this invariant.

**Inactive admins do not count toward the floor.** If the only admin is inactive, the household is effectively admin-less right now — but the data layer still has an admin row, so the invariant is technically satisfied. This is intentional: an admin away on vacation should not block their household from operating. When they return (auto-resume), they regain admin powers.

---

## 6. Where the rules live in code

### 6.1 The policy module — `@homebuddy/shared`

`packages/shared/src/policy/` holds **pure functions** for every authorization decision. They take a `HouseholdScope` plus the resource and return a boolean. No DB, no Nest, no framework. Same functions are imported by:

- `apps/api`'s controllers and services for server-side enforcement.
- `apps/web`'s `useCan()` hook for UI gating (hiding buttons the API would reject).

Files:

- `policy/task.ts` — `taskPolicy.{canViewList, canCreate, canDelete, canComplete, canEdit, canReassign}`
- `policy/ritual.ts` — `ritualPolicy.{canViewList, canPropose, canJoin, canComplete, canDelete}`
- `policy/household.ts` — `householdPolicy.{canView, canEditSettings, canDelete, canInvite, canRemoveMember, canPromote, canDemote, canManageLandlordLink}`
- `policy/membership.ts` — `membershipPolicy.{canSetSelfInactive, canEndOwnInactive, canForceEndOther}` + `validateInactiveWindow`

Tests: `packages/shared/__tests__/policy.*.test.ts`. Every cell of the matrix maps to a named test. Coverage gate: **100% on `src/policy/`**.

### 6.2 The guards — `apps/api`

Three guards stack on every household-scoped controller in this order:

1. **`JwtAuthGuard`** — authenticated user → `req.user`.
2. **`HouseholdScopeGuard`** — extracts `householdId` from `req.params.householdId ?? req.body.householdId`, queries `HouseholdMember` and `LandlordProperty` for `(userId, householdId)`, applies lazy resume, attaches `req.scope: HouseholdScope`. 404s non-members (no leak).
3. **`RoleGuard`** — reads `@RequireRole('admin')` metadata. Rejects if `req.scope.membership` is missing, inactive, or has the wrong role.

Files:

- `apps/api/src/common/guards/household-scope.guard.ts`
- `apps/api/src/common/guards/role.guard.ts`
- `apps/api/src/common/decorators/current-scope.decorator.ts` — `@CurrentScope() scope` param
- `apps/api/src/common/decorators/require-role.decorator.ts` — `@RequireRole(...)` route metadata

### 6.3 The service layer

Services receive `scope: HouseholdScope` as their first argument. They call `policy.*` for fine-grained, object-level decisions ("can this user delete *this* task?" — depends on assignee/flagger fields). They run mutations inside Prisma `$transaction` whenever a count-based invariant is at stake (e.g., last-admin).

Examples:

- `apps/api/src/tasks/tasks.service.ts` — `taskPolicy.canDelete`, `canComplete`, etc.
- `apps/api/src/households/households.service.ts` — last-admin guard, inactive lifecycle.
- `apps/api/src/landlord/landlord.service.ts` — pure landlord-by-id query (no scope guard needed).

### 6.4 The web — `apps/web`

- **`apps/web/src/lib/household-context.tsx`** — URL-driven provider. Reads `householdId` from the route, fetches `/h/:id/me` to populate `scope`, exposes `scope`, tasks, rituals, refresh helpers.
- **`apps/web/src/lib/use-can.ts`** — wraps the shared `policy.*` for UI gating. `isAdmin`, `canDeleteTask(task)`, etc.
- **`apps/web/src/components/household-switcher.tsx`** — top-bar `<select>` of memberships. Switching navigates to a new URL.
- **`apps/web/src/app/(app)/h/[householdId]/`** — every household-scoped page lives here.
- **`apps/web/src/app/(landlord)/properties/`** — landlord namespace, separate from the tenant routes.

---

## 7. Adding a new permission — the playbook

When you add a new action that needs authorization, follow this exact order:

1. **Update the spec.** Add the new row to the matrix in `docs/superpowers/specs/2026-05-14-roles-tenancy-inactive-design.md` §4, with a short rationale.
2. **Update this doc.** Mirror the matrix change in §3 above.
3. **Add a policy function.** Pure function in `packages/shared/src/policy/<resource>.ts`. Takes `scope` plus any object fields needed.
4. **Add unit tests for every matrix cell.** `packages/shared/__tests__/policy.<resource>.test.ts`. Coverage gate will refuse merge otherwise.
5. **Add the guard/decorator to the route.** Either `@RequireRole('admin')` (coarse) or call the policy from inside the service (object-level).
6. **Add a `useCan` helper if the web has a button for it.** Same shared policy function. UI gating prevents the user from seeing a button the server would reject.
7. **Add an integration test in the API spec file.** Cover admin, member, inactive, landlord, non-member, unauthenticated.

Never:

- Hard-code a role string in a controller or service (e.g., `if (user.role === 'admin')` without going through the policy module).
- Skip the policy unit test "because the integration test covers it" — the unit test is the matrix's single source of truth.
- Add a new role enum value without updating every existing policy function. Either the new role's permissions are covered by an existing policy decision, or every policy function needs an explicit branch.

---

## 8. Anti-patterns — what to NEVER do

- **Trust the JWT for roles.** JWT carries only `sub`, `email`, `systemRole`. Membership role is per-household and queried fresh by `HouseholdScopeGuard` on every request. Never put household role into a token.
- **Skip the scope guard "because the URL has no `:householdId`".** If your route touches household data, it needs the scope. Add `:householdId` to the URL.
- **Return 403 when a user is not a member.** Return **404**. Disclosing existence is a privacy leak.
- **Filter by `householdId` in the controller, not in the service.** The service is the authoritative chokepoint. Controllers pass `scope`; services build `where: { householdId: scope.householdId, ... }`. A bug in only the controller could leak cross-house data.
- **Allow landlord into `HouseholdMember`.** They never appear there. If you find code that expects them as a member, it's wrong.
- **Reuse the legacy `@Roles` / `RolesGuard` / `User.role`.** All gone as of PR #2. There is no global role.
- **Penalize harmony for an inactive member's missed tasks.** They get auto-reassigned at the moment of inactivation; whatever still slips past the rotation is excluded from the penalty math in `HarmonyService.applyOverduePenalty`.
- **Allow self-inactive when the caller is the only active admin.** This locks the house. The service checks; never bypass.
- **Set role at user creation.** New users get the Prisma default (`systemRole = 'user'`). They become a member of a household via `/households` (create) or invite. The legacy register-with-role flow is gone.

---

## 9. Common scenarios for the assistant

### "Alice the admin promotes Bob to admin, then demotes herself"

1. POST `/h/:id/members/<bob_member_id>/role` body `{ role: 'admin' }`. Service: `householdPolicy.canPromote(aliceScope, { role: 'member', status: 'active' })` → true. Bob's row updated.
2. POST `/h/:id/members/<alice_member_id>/role` body `{ role: 'member' }`. Service computes `activeAdminCount = 2` inside the transaction. `householdPolicy.canDemote(aliceScope, { role: 'admin', status: 'active' }, 2)` → true. Alice's row updated.

If step 1 was skipped, step 2's service would compute `activeAdminCount = 1` and return 403 with a "would leave the household admin-less" message.

### "Bob goes on vacation for two weeks"

1. POST `/h/:id/membership/inactive` body `{ from, until, reason }`. Validation in `validateInactiveWindow`.
2. Transaction: row updates to status='inactive', log row written, every Bob-assigned pending/overdue task in the household reassigns via `pickAssignee({ excludeUserId: 'bob' })`. `rotationReason` records "Reassigned: Bob is away until 2026-05-29".
3. Two weeks pass. Either the cron at 00:05 flips Bob back to active and writes a log row with `reason='cron-auto-resume'`, OR Bob logs in earlier and `HouseholdScopeGuard.lazyResume` resolves him as active for that request while the DB update fires asynchronously.

### "Landlord opens the web app and tries `/h/:id/tasks`"

`HouseholdScopeGuard` queries: is the landlord a `HouseholdMember` of `:id`? No. Is the landlord a `LandlordProperty` of `:id`? Yes. Scope attaches with `landlord: { propertyId }` and no `membership`. Tasks controller calls `taskPolicy.canViewList(scope)` → returns false (no membership). Controller throws 403. The web never even tries — the landlord layout redirects to `/properties` based on `/auth/me` shape.

### "A random user GETs `/h/<some-other-house-id>`"

`HouseholdScopeGuard` finds no membership, no landlord property. `systemRole !== 'support'`. Throws **`NotFoundException`** (404). The user cannot tell whether the house exists.

### "Mo logs in as `admin@homebuddy.dev` and wants to debug Alice's house"

`admin@homebuddy.dev` has `systemRole = 'support'`. `HouseholdScopeGuard` lets the request through with `membership: undefined, landlord: undefined`. Routes that gate on `RoleGuard('admin')` will still reject because `scope.membership` is missing. The "support" bypass only lets reads through if the route doesn't require a role. This is correct: support staff aren't admins of every house, they're observers with a special read pass. (Note: as of PR #2, none of the user-facing routes treat `support` specially beyond the 404 bypass. If you add a support console, gate it on `scope.systemRole === 'support'` explicitly.)

---

## 10. Reference — file paths cheat sheet

| Concern | Path |
|---|---|
| Spec | `docs/superpowers/specs/2026-05-14-roles-tenancy-inactive-design.md` |
| Mega-plan that built the system | `docs/superpowers/plans/2026-05-14-roles-rollout-mega.md` |
| Shared types | `packages/shared/src/membership.ts`, `packages/shared/src/scope.ts` |
| Shared policy | `packages/shared/src/policy/{task,ritual,household,membership}.ts` |
| Shared zod schemas | `packages/shared/src/{auth,user,household,task,ritual,membership}.ts` |
| API guards | `apps/api/src/common/guards/{household-scope,role}.guard.ts` |
| API decorators | `apps/api/src/common/decorators/{current-scope,require-role}.decorator.ts` |
| Tasks endpoints | `apps/api/src/tasks/*` |
| Rituals endpoints | `apps/api/src/rituals/*` |
| Supplies endpoints (member-gated; active member to mutate) | `apps/api/src/supplies/*` |
| Maintenance endpoints (member-gated; landlord read is consent-gated + reporter-anonymized) | `apps/api/src/maintenance/*` |
| Households endpoints (CRUD + members + inactive) | `apps/api/src/households/*` |
| Landlord endpoints | `apps/api/src/landlord/*` |
| Auto-resume cron | `apps/api/src/households/membership-resume.cron.ts` |
| Web URL-scoped routes | `apps/web/src/app/(app)/h/[householdId]/*` |
| Web landlord routes | `apps/web/src/app/(landlord)/properties/*` |
| Web auth + context | `apps/web/src/lib/{use-auth,household-context,use-can,api}.ts` |
| Prisma schema | `apps/api/prisma/schema.prisma` |
| Seed | `apps/api/prisma/seed.ts` |
