# HomeBuddy

Roommate / household task manager. API-first monorepo: NestJS backend, Next.js web frontend, shared zod schemas, JWT auth ready for a future React Native client.

Built as a bachelor project; designed to be extended by AI agents (see `CLAUDE.md`).

**Live:** https://web-production-96525.up.railway.app (Railway)

## Quick Start

Requirements: Node 22, pnpm 10, Docker (for Postgres).

```bash
# 1. Install
pnpm install

# 2. Copy env
cp .env.example .env

# 3. Start Postgres
pnpm db:up

# 4. Migrate + seed dummy users
pnpm db:migrate
pnpm db:seed

# 5. Run everything
pnpm dev
```

Web → http://localhost:3000  
API → http://localhost:4000

Log in with one of the seeded users (see `CLAUDE.md` → "Dummy Users").

## Layout

```
apps/api      NestJS API (single source of truth)
apps/web      Next.js App Router (web client)
packages/shared   zod schemas + types reused by api and web
packages/tsconfig base tsconfig presets
```

## Scripts

| Command | Purpose |
|---|---|
| `pnpm dev` | Run api + web in parallel |
| `pnpm build` | Build all apps |
| `pnpm typecheck` | TS check across the monorepo |
| `pnpm lint` | Lint all packages |
| `pnpm test` | Run tests |
| `pnpm db:up` / `pnpm db:down` | Start / stop Postgres |
| `pnpm db:migrate` / `pnpm db:seed` / `pnpm db:reset` | Prisma helpers |

## Deploy

See `DEPLOY.md` for the Railway playbook (Postgres + API + Web as three services from this repo).

## Docs

- `CLAUDE.md` — project context for AI agents
- `CODING_GUIDELINES.md` — style + architecture rules
- `DEPLOY.md` — Railway deployment playbook
- `apps/api/README.md` — API specifics
- `apps/web/README.md` — web specifics
