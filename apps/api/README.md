# @homebuddy/api

NestJS backend. Single source of truth for the HomeBuddy domain.

## Run

```bash
# From repo root
pnpm db:up
pnpm db:migrate
pnpm db:seed
pnpm --filter @homebuddy/api dev
```

API serves on `http://localhost:4000/api`.

## Routes

| Method | Path | Auth | Body |
|---|---|---|---|
| GET | `/api/health` | — | — |
| POST | `/api/auth/register` | — | `{ email, password, name }` |
| POST | `/api/auth/login` | — | `{ email, password }` |
| POST | `/api/auth/refresh` | — | `{ refreshToken }` |
| POST | `/api/auth/logout` | Bearer | — |
| GET | `/api/auth/me` | Bearer | — |
| GET | `/api/households` | Bearer | — |
| POST | `/api/households` | Bearer | `{ name }` |
| GET | `/api/households/:id` | Bearer | — |

## Structure

```
src/
├── auth/          register/login/refresh/me + JWT strategy
├── users/         user lookups
├── households/    household CRUD
├── prisma/        PrismaService (DI wrapper)
├── common/        decorators, pipes
├── main.ts
└── app.module.ts
```

## Adding a module

1. Add Prisma model + migrate.
2. Create `src/<feature>/` with `*.module.ts`, `*.controller.ts`, `*.service.ts`.
3. Define DTOs/zod in `packages/shared` and import them.
4. Guard routes with `@UseGuards(JwtAuthGuard)` when auth is required.
5. Register the module in `app.module.ts`.

See `CODING_GUIDELINES.md` at the repo root.
