# Deploying HomeBuddy to Railway

HomeBuddy ships as **three Railway services** in one project, all from this repo:

1. **`db`** — Railway-managed Postgres plugin
2. **`api`** — NestJS backend (`apps/api`)
3. **`web`** — Next.js frontend (`apps/web`)

This file is the end-to-end playbook. Follow it top to bottom for a fresh deploy.

---

## Prereqs

- A Railway account (https://railway.com).
- This repo pushed to GitHub (already done: `Hub-Mo/HomeBuddy`).
- Railway CLI is optional. The web UI is enough.

---

## 1. Create the Railway project

1. Railway dashboard → **New Project** → **Deploy from GitHub repo** → pick `Hub-Mo/HomeBuddy`.
2. Railway will scan the repo. Cancel any auto-detected service for now — we will add three deliberately.

---

## 2. Add Postgres

1. Inside the project → **+ New** → **Database** → **Add PostgreSQL**.
2. Railway provisions it and exposes `DATABASE_URL` as a service variable on the Postgres service.
3. Note the **service reference**: in the API service you will reference it as `${{Postgres.DATABASE_URL}}`.

---

## 3. Deploy the API service

1. Project → **+ New** → **GitHub repo** → `Hub-Mo/HomeBuddy`.
2. Open the new service → **Settings**:
   - **Service name:** `api`
   - **Root Directory:** leave blank (we use the repo root because the Dockerfile copies workspace files).
   - **Config-as-code → Path:** `apps/api/railway.json`  
     (This points Railway at the Dockerfile, healthcheck, and start command.)
   - **Networking → Generate Domain** (so you get `<something>.up.railway.app`).
3. **Variables** tab — set these:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `JWT_ACCESS_SECRET` | generate a strong 64-char random string |
   | `JWT_REFRESH_SECRET` | generate a different strong 64-char random string |
   | `JWT_ACCESS_TTL` | `15m` |
   | `JWT_REFRESH_TTL` | `30d` |
   | `ALLOWED_ORIGINS` | (fill in after the web service has a domain) |
   | `NODE_ENV` | `production` |

   Generate secrets with: `openssl rand -hex 48`.

4. **Deploy.** First build pulls the Dockerfile, installs deps, runs `prisma generate`, and compiles. On start it runs `prisma migrate deploy` then `node dist/main.js`.

5. After deploy, check the API URL: `https://<api-domain>/api/health` → `{ "status": "ok" }`.

6. **Seed dummy users (one-time).** Railway → API service → **…** → **Shell** (or `railway run` from CLI), then:

   ```sh
   npx prisma db seed --schema=apps/api/prisma/schema.prisma
   ```

   You should see the three seeded users printed. They live on the deployed DB.

---

## 4. Deploy the Web service

1. Project → **+ New** → **GitHub repo** → `Hub-Mo/HomeBuddy` (same repo again).
2. Open the new service → **Settings**:
   - **Service name:** `web`
   - **Root Directory:** blank.
   - **Config-as-code → Path:** `apps/web/railway.json`.
   - **Networking → Generate Domain.**
3. **Variables** tab:

   | Variable | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<api-domain>` (no trailing slash) |
   | `NODE_ENV` | `production` |

   > `NEXT_PUBLIC_API_URL` is baked at build time. Set it before the first deploy, or trigger a rebuild after changing it. The Dockerfile passes it through as a build arg.

4. **Build arg.** In **Settings → Build → Build Args** add:

   | Name | Value |
   |---|---|
   | `NEXT_PUBLIC_API_URL` | `https://<api-domain>` |

   This is what makes the value available inside `next build`.

5. **Deploy.** Visit the web domain. You should see the landing page → log in with one of the seeded users:
   - `alice@homebuddy.dev` / `password123`
   - `bob@homebuddy.dev` / `password123`
   - `admin@homebuddy.dev` / `password123`

---

## 5. Tighten CORS

1. Go back to the **api** service → **Variables**.
2. Set `ALLOWED_ORIGINS` to the web domain, e.g. `https://homebuddy-web.up.railway.app`.
3. Multiple origins: comma-separated. Use `*` to allow anything (not recommended for prod).
4. Redeploy the API service.

---

## 6. Share the link

Send the student the **web** service URL (e.g. `https://homebuddy-web.up.railway.app`) plus the dummy credentials from step 3.

---

## 7. Keep services warm (kill the slow first login)

Railway puts idle containers to sleep. The first request after a quiet spell waits 10-30s for the API to wake — felt as a slow first login. A scheduled GitHub Action (`.github/workflows/keep-warm.yml`) pings the services every 10 minutes so they stay awake.

Enable it by adding two **repository variables** (GitHub → repo **Settings → Secrets and variables → Actions → Variables** tab, not Secrets):

| Variable | Required | Value |
|---|---|---|
| `API_HEALTH_URL` | yes | `https://<api-domain>/api/health` |
| `WEB_URL` | optional | the web service URL, e.g. `https://web-production-96525.up.railway.app` |

Without `API_HEALTH_URL` the workflow runs but does nothing (no-op). Trigger a manual run from the **Actions** tab → **keep-warm** → **Run workflow** to test.

Notes:
- GitHub disables scheduled workflows after 60 days of repo inactivity — push anything to re-enable.
- Cron runs can be delayed a few minutes under load; that is fine for keep-warm.
- This does not stop Railway from sleeping on its own settings; it only keeps traffic flowing. For a hard guarantee, set the API service to always-on / min 1 instance in Railway (paid).

---

## What gets deployed (file map)

| File | Purpose |
|---|---|
| `apps/api/Dockerfile` | Multi-stage build for NestJS. Installs deps, builds `@homebuddy/shared`, runs `prisma generate`, compiles to `dist/`. Runtime stage runs `prisma migrate deploy` + `node dist/main.js`. |
| `apps/api/railway.json` | Tells Railway which Dockerfile, what to start, and where the healthcheck lives (`/api/health`). |
| `apps/web/Dockerfile` | Multi-stage Next.js build using `output: 'standalone'`. Tiny runtime image. |
| `apps/web/railway.json` | Same idea for the web service. |
| `.dockerignore` | Keeps node_modules, build output, `.env`, and `.git` out of the build context. |

---

## Updating

Pushing to `main` automatically redeploys both services. Each service builds independently from the same commit.

To run new Prisma migrations, just commit the new files under `apps/api/prisma/migrations/` — `prisma migrate deploy` runs on every API start.

---

## Common gotchas

- **`prisma migrate deploy` errors with "no migrations found"** — run `pnpm --filter @homebuddy/api prisma migrate dev --name init` locally first, commit the generated migration, push. The `migrate dev` step creates the SQL files; `migrate deploy` is read-only and just applies them.
- **Web shows "Failed to fetch"** — `NEXT_PUBLIC_API_URL` build arg was missing or wrong. Update under Settings → Build Args and redeploy.
- **CORS errors in browser** — `ALLOWED_ORIGINS` on the API doesn't include the web domain. Add it and redeploy the API.
- **JWT secrets shorter than 32 chars** — the strategy will boot but tokens are weak. Use `openssl rand -hex 48`.
- **Healthcheck failing** — Railway hits `/api/health` on the API service. The default port inside the container is `8080`; Railway maps it. Don't hardcode `4000` in production.

---

## Local parity check

Before pushing a change you want to deploy, sanity-check locally:

```sh
pnpm install
pnpm --filter @homebuddy/shared build
pnpm --filter @homebuddy/api build
pnpm --filter @homebuddy/web build
```

If those three succeed, Railway will too (modulo env vars).
