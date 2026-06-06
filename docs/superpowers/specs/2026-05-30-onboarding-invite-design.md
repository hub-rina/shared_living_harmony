# Onboarding + Roommate Invite — Design

Date: 2026-05-30
Status: approved, pre-implementation
Author: Kai (agent), product owner Catja, escalation Mo

## Problem

A brand-new real user cannot today get their roommates into a house through the UI:

- Register collects name/email/password, then redirects to `/today` — a route that does not exist (the daily view lives at `/h/:householdId/today`). New users 404.
- Creating a household works (`POST /households`, creator becomes admin).
- The only invite path is `POST /h/:householdId/members/invite`, which is admin-only, **requires the invitee to already have a HOOMA account**, has **no web UI**, and no API-client method. There is no invite link or join code.

Goal: a new user can sign up, create their house, and get co-located roommates in with minimal friction.

## Decisions (from brainstorming)

1. **Invite primitive: a shareable join link + persistent house code.** Roommates live in the same building, so a code dropped in a group chat or read aloud beats email lookup. The roommate does not need a pre-existing account.
2. **Code lifecycle: one persistent code per house, admin-regenerable.** No expiry, no per-invite rows. Anyone with the code joins instantly as a member. Admin regenerates to kill a leaked code.
3. **Onboarding: a dedicated Create-or-Join fork screen** for any authed user with no household. Fixes the broken post-register redirect and the empty state.
4. **Email-invite endpoint is retained** (not removed). It is superseded as the primary path but kept for a planned Resend integration that will email the join link/code. No new UI for it this round.

## Domain vocabulary

- **Join code** — the household's standing, human-readable code (e.g. `SAGE-7K3`). Shareable, regenerable.
- **Join link** — a deep link embedding the code: `/join/{code}`.

## Data model

`Household` gains one column:

```prisma
model Household {
  // ...existing
  joinCode String @unique
}
```

- **Format:** `WORD-XXX` — a word from a small curated cozy wordlist (`sage`, `maple`, `hearth`, `willow`, `cedar`, `linen`, `ember`, `cocoa`, ...) + a separator + three characters from an unambiguous alphabet (`ABCDEFGHJKLMNPQRSTUVWXYZ23456789`, no `O/0/I/1`). Uppercased on display. Example: `SAGE-7K3`.
- **Generation:** on household create, generate and check the `@unique` constraint; retry on collision (bounded retries, then widen the suffix). Centralized in a `generateJoinCode()` helper so create and regenerate share it.
- **Migration:** add the column, backfill every existing (seeded) household with a generated unique code. Hand-written migration per the project's `prisma migrate diff` workflow (interactive `migrate dev` is unavailable here).
- No new table. The persistent-code decision means there are no invitation rows to track.

## API

All under the existing NestJS modules; shared zod schemas in `packages/shared`.

### New: `POST /households/join`
- **Auth:** JWT required. **Not** household-scoped — the caller is not yet a member, so the `HouseholdScopeGuard` does not apply. Lives on the top-level households controller alongside `POST /households`.
- **Body:** `{ code: string }` via `JoinHouseholdInputSchema`.
- **Behavior:** normalize the code (trim, uppercase, strip spaces; tolerate a missing/extra dash). Look up `Household` by `joinCode`.
  - Not found → `404` "That code didn't match a house. Check it and try again."
  - Found, caller already an active member → idempotent: return the household (no duplicate row).
  - Found, caller has an `inactive` membership → reactivate to `active` (same lifecycle as resume), return household.
  - Found, not a member → create `HouseholdMember { role: member, status: active }`, return household.
- **Returns:** the household summary (same shape as `GET /h/:id` minimal), so the web can route straight to `/h/:id/today`.

### New: `POST /h/:householdId/join-code/regenerate`
- **Auth:** JWT + `HouseholdScopeGuard` + `@RequireRole('admin')`.
- **Behavior:** generate a new unique `joinCode`, persist, return `{ joinCode }`. The old code stops resolving immediately.

### Changed: `POST /households` (create)
- Also generates and stores `joinCode` on create (via the shared helper). Response unchanged otherwise.

### Changed: `GET /h/:householdId`
- Household payload gains `joinCode`. Visible to any member (any housemate may share it); only an admin may regenerate. The shared `Household`/household-with-members schema adds `joinCode: string`.

### Retained: `POST /h/:householdId/members/invite`
- Unchanged. Kept for the planned Resend email integration (email the join link/code to an address). No UI this round.

### Policy
- Joining by code is **self-service**: no `householdPolicy` gate beyond authentication (any logged-in user with a valid code may join). Document this explicitly in `docs/ROLES.md` as a new row ("Join a house by code — any authenticated user").
- Regenerate the join code → admin only (new `householdPolicy.canRegenerateJoinCode` mirroring `canManageLandlordLink`, or reuse `canEditSettings`). Add a matrix row + unit tests per the ROLES playbook.

## Web flows

### `/welcome` (new, authed, no-household first run)
- Two clear choices, scaled for mobile/ESL/one-handed:
  - **Create a house** — name field → `POST /households` → land in `/h/:id/today`. Creator is admin.
  - **Join a house** — code field → `POST /households/join` → land in `/h/:id/today`.
- Warm, plain copy. No jargon. This is the empty-state home for a user with zero memberships.

### Redirect fixes
- Register success → `/welcome` (was the broken `/today`).
- Login with zero memberships and zero properties → `/welcome` (was `/pick`). `/pick` remains the switcher for users who already have houses.

### `/join/[code]` (new deep link)
- **Logged out:** route to register (default) / login, carrying the code (querystring `?join=CODE`, read after auth). On successful auth, auto-call `POST /households/join` with the carried code, then land in `/h/:id/today`.
- **Logged in:** show a small confirm — "Join {House name}?" — then `POST /households/join` → land in `/h/:id/today`. (House name is resolved by a lightweight lookup, or the confirm simply shows the code if name resolution requires membership; prefer showing the code to avoid leaking names pre-join.)
- **Already a member:** skip the join, go straight to `/h/:id/today`.

### House page (`/h/:householdId/house`)
- New **Invite roommates** block:
  - Shows the join code and a "Copy link" action (`/join/{code}`), plus a share affordance.
  - **Admin only:** "Regenerate code" with an inline confirm ("Old links stop working").
- Visible to all members; regenerate gated to admin.

### API client
- Add `households.join(code)` → `POST /households/join`.
- Add `households.regenerateCode(householdId)` → `POST /h/:id/join-code/regenerate`.

## Edge cases

- **Mistyped code:** normalized input; friendly 404 copy; no stack/jargon.
- **Already a member opening a link:** idempotent, route straight in.
- **Inactive member rejoining by code:** reactivates to `active`.
- **Regenerate while a link is in flight:** old code 404s; the joining roommate sees the friendly error and asks for the new one.
- **Code collision on generate:** `@unique` + bounded retry; widen suffix if exhausted.
- **Last-admin invariant:** unaffected — every code-joiner is a `member`, never an admin.
- **Carrying the code through auth:** querystring `?join=CODE`; cleared after a successful join.

## Tone / copy

Calm flatmate, plain, no exclamation marks. Examples:
- Welcome: "Start a house, or join one your roommates already made."
- Invite block: "Share this with your housemates."
- Join error: "That code didn't match a house. Check it and try again."
- Regenerate confirm: "Make a new code? The old link will stop working."

## Out of scope (this round)

- Real email sending (Resend) for the email-invite endpoint — planned next, credentials pending.
- Per-invite expiring tokens, join requests/approval queue, role selection at join time.
- Removing the email-invite endpoint.

## Testing

- **Shared:** `generateJoinCode` format + normalization helper; `JoinHouseholdInputSchema`; new `householdPolicy.canRegenerateJoinCode` matrix cells (admin/member/inactive/landlord/non-member).
- **API:** `households.service` join — valid code joins, invalid 404, already-member idempotent, inactive reactivates; regenerate is admin-only and invalidates the old code; create generates a unique code; collision retry.
- **Web:** typecheck; manual smoke of the four flows (create, join-by-code, join-link logged-in, join-link logged-out).
- Keep the existing `pnpm test` suites green; update the dev seed if any shape changes (every seeded household gets a deterministic-ish code).
