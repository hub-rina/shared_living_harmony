# HomeBuddy — Agent Instructions

You are working on HomeBuddy, a roommate/household task manager built as an API-first monorepo. This file is the contract for any AI agent (Claude, Copilot, Cursor, etc.) that writes code here.

**Read `CODING_GUIDELINES.md` before writing or modifying code.** It is authoritative on style, naming, testing, and architecture. This file covers project-specific context only.

**Read `docs/ROLES.md` before touching any guard, policy, controller, service, or web page that mentions `householdId`, membership, role, status, landlord, or inactive lifecycle.** It is the authoritative reference for the authorization model. The spec at `docs/superpowers/specs/2026-05-14-roles-tenancy-inactive-design.md` is the formal design; `docs/ROLES.md` is the day-to-day operational reference for AI agents.

---

## Project Context (READ THIS FIRST)

HomeBuddy is **Ecatarina's bachelor proef** at KDG (Karel de Grote Hogeschool, Antwerpen). She is a 3rd-year student from Moldova. Her informal name is **Catja**.

**Catja is the product owner. She is NOT a developer.** She does not know what pnpm, Docker, Prisma, JWT, or a monorepo is. She speaks in features and user experiences — never in code.

**Kai is the sole developer.** Kai (this agent, when invoked) writes all the code, runs all the commands, deploys everything, and keeps the app live. Catja describes what HomeBuddy should *do*; Kai builds it.

**Hard rules for any agent talking to Catja directly:**
- All communication with Catja is in **English**. No Dutch. No mixing.
- Never ask Catja a technical question. If a tech decision needs human input, escalate to **Mo** (`mohamed@hellozaia.com`), not to Catja.
- Explain progress in product/user terms ("you can now log in"), never in technical terms ("I added JWT auth").
- The app must stay deployed and accessible at the same URL — always live. No broken builds reach that URL.

This is being **graded as a bachelor thesis**. Code quality matters more than usual: clean architecture, no shortcuts, the kind of code a jury can defend.

---

## Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces + Turborepo |
| Backend | NestJS 11 (`apps/api`) |
| Frontend | Next.js 15 App Router + Tailwind 4 (`apps/web`) |
| Shared | `packages/shared` (zod schemas, DTOs, types) |
| Database | Postgres 16 + Prisma 6 |
| Auth | JWT access (15m) + refresh (30d) |
| Node | 22 LTS |
| Package manager | pnpm 10 |

Mobile (React Native) is deferred. Every API change must keep mobile reuse in mind: no session cookies, no web-only auth tricks.

---

## Repo Layout

```
HomeBuddy/
├── apps/
│   ├── api/                  NestJS — single source of truth for the domain
│   │   ├── prisma/           schema.prisma, seed.ts, migrations/
│   │   └── src/
│   │       ├── auth/         login, register, refresh, JWT strategies
│   │       ├── users/        user CRUD + dummy seed
│   │       ├── households/   household + membership
│   │       ├── expenses/     cost sharing (scan, split, settle)
│   │       ├── ocr/          self-hosted receipt OCR (tesseract.js)
│   │       ├── storage/      image storage (local disk / S3-compatible)
│   │       ├── prisma/       PrismaService (DI wrapper)
│   │       ├── common/       guards, decorators, filters
│   │       └── main.ts
│   └── web/                  Next.js App Router
│       └── src/
│           ├── app/
│           │   ├── (auth)/   login, register
│           │   └── (app)/    dashboard (auth required)
│           ├── lib/          api client, auth helpers
│           └── components/
├── packages/
│   ├── shared/               zod schemas + TS types reused by api and web
│   └── tsconfig/             base tsconfig presets
├── docker-compose.yml        Postgres for local dev
├── turbo.json
├── pnpm-workspace.yaml
└── .env.example
```

---

## Common Commands

```bash
# Install
pnpm install

# Start Postgres
pnpm db:up

# Run migrations + seed dummy users
pnpm db:migrate
pnpm db:seed

# Dev (api + web in parallel)
pnpm dev

# One-off
pnpm --filter @homebuddy/api dev
pnpm --filter @homebuddy/web dev

# Typecheck / lint / test
pnpm typecheck
pnpm lint
pnpm test
```

API runs on `http://localhost:4000`. Web on `http://localhost:3000`. Postgres runs on host port `5433` (the docker container exposes 5432 internally; we map 5433 to avoid clashing with any local Postgres install).

For Railway deployment, see `DEPLOY.md` at repo root.

---

## Dummy Users (seeded)

| Email | Password | Role |
|---|---|---|
| `alice@homebuddy.dev` | `password123` | household admin (Demo House + test houses) |
| `bob@homebuddy.dev` | `password123` | household member |
| `admin@homebuddy.dev` | `password123` | system support |
| `landlord@homebuddy.dev` | `password123` | landlord (manages the test properties) |
| `charlie@homebuddy.dev` | `password123` | invited to Demo House, not yet activated (drives the participation warning) |

Use these to log in during dev. Defined in `apps/api/prisma/seed.ts`.

The seed also creates three properties for the landlord so the landlord modes can be tested locally:

| Household | Landlord mode | Consent | Appears in landlord portal? |
|---|---|---|---|
| Demo House | observer | on | yes |
| Sunset Kot | caretaker | on | yes |
| Maple Flat | observer | off | no (consent gated) |
| Bloom Stage | none | — | no (no landlord linked) |

Log in as `landlord@homebuddy.dev` to see the portal (two consented houses); log in as `alice@homebuddy.dev` and open the House page of any to toggle consent / switch mode.

**Bloom Stage** is the on-stage demo house: it opens Tense (harmony 16, a heavy overdue chore scarring the Energy Core). Logged in as `alice@homebuddy.dev`, complete the overdue chores to heal the orb, then complete the pre-loaded "Sunday house dinner" ritual (both members already joined) to trigger a full bloom.

**Demo House** also stages three thesis features. Participation (§5.11): `charlie@homebuddy.dev` is an `invited` member who has not activated, so the Today zone shows a persistent participation warning until he enters the join code (entering it flips `invited` → `active`). Maintenance escalation (§5.8): two maintenance requests exist, but only "Damp patch in bathroom ceiling" is `escalated`, so the landlord portal shows that one and never the tenant-only "Boiler slow to heat". Residents toggle escalation per request on the House page. Cost sharing: the Money page has two demo bills mid-settlement — "Groceries — Colruyt" (Alice paid, Bob's €21.25 share already marked paid and waiting on Alice to confirm) and "Cleaning supplies" (Bob paid, Alice's €9.00 share still open). Charlie (invited) is excluded by the active-only split default. Add a bill via the camera to exercise the receipt OCR → editable draft flow.

**Sunset Kot** (caretaker mode) seeds a caretaker-owned common-area chore ("Mop the shared stairwell") assigned to the landlord and excluded from tenant rotation. As `alice@`, the Chores page shows it read-only with a Caretaker tag plus an admin-only form to add more.

---

## Auth Flow

1. **Register** → `POST /auth/register` → returns `{ accessToken, refreshToken, user }`.
2. **Login** → `POST /auth/login` → same shape.
3. **Refresh** → `POST /auth/refresh` with `{ refreshToken }` → new pair.
4. **Me** → `GET /auth/me` with `Authorization: Bearer <accessToken>`.
5. **Logout** → `POST /auth/logout` — invalidates stored refresh token hash.

Access tokens are stateless. Refresh tokens are hashed and stored on the `User` row so they can be revoked.

Web stores tokens in `localStorage` for now (bachelor-project scope). When mobile is added, both clients use the same flow.

---

## Adding a Feature — The Drill

1. **Add zod schema + types** in `packages/shared/src/`.
2. **API:** new NestJS module under `apps/api/src/<feature>/` (`*.module.ts`, `*.controller.ts`, `*.service.ts`, `dto/`).
3. **Prisma:** update `schema.prisma`, run `pnpm db:migrate`.
4. **Guard auth-required routes** with `@UseGuards(JwtAuthGuard)`.
5. **Web:** add route under `apps/web/src/app/`, call API via `apiClient` in `src/lib/api.ts`.
6. **Tests:** spec next to service for non-trivial logic.

---

## Mobile-Readiness Rules

- No HTTP-only cookies for auth. Tokens are returned in JSON body.
- No web-specific session middleware.
- All client state derived from API responses.
- Validation lives in `packages/shared` so React Native can import the same zod schemas.
- API never assumes browser (no `Set-Cookie`, no CSRF flow).

---

## Style Quick Reference

(full rules in `CODING_GUIDELINES.md`)

- TypeScript strict, no `any`, no `@ts-ignore`.
- Functions: short, single-purpose, early returns.
- No comments unless the why is non-obvious.
- No emojis anywhere — code, commits, PR titles, none.
- Tests for business logic, not framework code.
- DRY: search before writing a helper.

---

## Commit Rules (MANDATORY)

Every commit in this repo must follow these rules. No exceptions.

### Format

**Conventional Commits**, subject line only, no body unless the why is non-obvious.

```
type(scope): subject
```

- **Subject ≤ 72 characters**, imperative mood (`add login endpoint`, not `added` or `adds`).
- **Lowercase** subject (except proper nouns).
- **No trailing period.**
- **Body only when the why is non-obvious** — and even then, one short paragraph max.

### Types

`feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`, `build`, `ci`.

### Scope

Lowercase, single word. Common scopes for this repo: `api`, `web`, `shared`, `auth`, `households`, `prisma`, `infra`, `deps`, `tsconfig`. Omit when truly global.

### Examples

```
feat(auth): add jwt refresh rotation
fix(api): reject login with empty password
chore(deps): bump prisma to 6.2.1
docs(web): document auth flow in readme
refactor(households): extract member-check into guard
```

### Hard rules

- **One logical change per commit.** Mixed feature + refactor = split.
- **Never `--no-verify`** to skip hooks unless explicitly authorized by the human.
- **Never `--amend`** a pushed commit. Create a new commit.
- **Never `git push --force`** to `main` or any shared branch. Force-push only your own feature branch and only when needed.
- **Never push directly to `main`.** Always go through a PR.
- **Never commit secrets** (`.env`, keys, tokens). Use `.env.example` to document new vars.
- **Never commit generated files** (`node_modules`, `dist`, `.next`, `.turbo`, Prisma migration build output, lockfiles for libraries — but DO commit `pnpm-lock.yaml` at the repo root).
- **Never mention AI collaboration or co-authoring** in commits (no `Co-Authored-By: Claude`, no `🤖 Generated with...`, no "AI", no "Claude", no "Copilot" anywhere in subject, body, or trailers).
- **No emojis** in subject or body.
- **No `WIP`, `fixup`, `xxx`** committed to a shared branch. Squash before pushing.
- **`TODO` only with a ticket reference** (`TODO(HB-123): ...`).

### Branching

- Default working branch: `main` (this is a small project; PRs still required for shared work).
- Feature branches: `feat/<short-slug>`, `fix/<short-slug>`, `chore/<short-slug>`.
- Rebase onto `main` before merging. Merge via squash unless commits tell a story worth keeping.

### Pre-commit

If the repo has hooks (lint-staged, husky), let them run. If a hook fails, fix the root cause — do not bypass.

---

## What NOT to Do

- Don't introduce a second ORM, HTTP client, or validation lib.
- Don't add server-side session cookies. JWT only.
- Don't duplicate DTO types in `apps/web` — import from `@homebuddy/shared`.
- Don't add features beyond what the task asks for.
- Don't bypass Prisma with raw SQL unless there's a measured reason.
- Don't store passwords as anything other than bcrypt hashes.
- Don't commit `.env`. Use `.env.example` to document new vars.
