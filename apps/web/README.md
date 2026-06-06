# @homebuddy/web

Next.js App Router web client. Talks to `@homebuddy/api` over HTTP and shares zod schemas via `@homebuddy/shared`.

## Run

```bash
# From repo root
pnpm --filter @homebuddy/web dev
```

Web on `http://localhost:3000`. API expected on `http://localhost:4000` (override via `NEXT_PUBLIC_API_URL`).

## Routes

| Path | Auth | Purpose |
|---|---|---|
| `/` | — | Landing |
| `/login` | — | Log in (prefilled with seeded `alice@homebuddy.dev`) |
| `/register` | — | Create account |
| `/dashboard` | required | List + create households |

## Structure

```
src/
├── app/
│   ├── (auth)/   login, register
│   ├── (app)/    dashboard (auth-required layout)
│   └── layout.tsx
├── lib/
│   ├── api.ts          typed fetch wrapper
│   ├── auth-store.ts   localStorage tokens
│   └── use-auth.tsx    AuthProvider + useAuth hook
└── components/
```

## Auth

JWT access + refresh stored in `localStorage`. The `<AuthProvider>` hydrates from storage and calls `/auth/me` on mount. The `(app)` layout redirects to `/login` when there's no user.

> Tokens-in-localStorage is fine for this bachelor-project scope. If exposed to XSS risk in future, move access tokens to in-memory + refresh in httpOnly cookie. JWT-only design keeps mobile-reuse intact.

## Style

- Tailwind 4 (PostCSS plugin). One global stylesheet imports `tailwindcss`.
- No icon libs yet.
- Mobile-first: every page reads well on narrow viewports.

See `CODING_GUIDELINES.md` at the repo root.
