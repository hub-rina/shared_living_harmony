# Onboarding + Roommate Invite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a brand-new user sign up, create or join a house, and pull co-located roommates in via a shareable join code/link, with no pre-existing-account requirement.

**Architecture:** A persistent, admin-regenerable `joinCode` on `Household` (stored alphanumeric, displayed with a dash). A self-service `POST /households/join` (auth-only, not household-scoped) creates the membership. A first-run `/welcome` fork (Create / Join) fixes the broken post-register redirect, and a public `/join/[code]` deep link carries the code through signup. The existing email-invite endpoint is left untouched for a later Resend integration.

**Tech Stack:** pnpm monorepo — `packages/shared` (zod + pure policy, Jest), `apps/api` (NestJS 11 + Prisma 6, Jest), `apps/web` (Next.js 15 App Router). Migrations are hand-written (`prisma migrate diff` → `prisma migrate deploy`), not interactive.

**Spec:** `docs/superpowers/specs/2026-05-30-onboarding-invite-design.md`

**Conventions:**
- Run shared tests: `pnpm --filter @homebuddy/shared test`
- Rebuild shared after editing it (api/web consume the build): `pnpm --filter @homebuddy/shared build`
- API tests: `pnpm --filter @homebuddy/api test`
- Web typecheck: `pnpm --filter @homebuddy/web exec tsc --noEmit`
- DB URL: `postgresql://homebuddy:homebuddy@localhost:5433/homebuddy?schema=public`
- After any schema change, restart the dev api (regenerated Prisma client).
- Commit per task. Conventional commits, subject ≤72, no AI mentions.

---

## File structure

**Create:**
- `packages/shared/src/join-code.ts` — `generateJoinCode`, `normalizeJoinCode`, `formatJoinCode`, `JOIN_CODE_WORDS`.
- `packages/shared/__tests__/join-code.test.ts`
- `apps/api/prisma/migrations/20260530120000_add_household_join_code/migration.sql`
- `apps/web/src/app/(app)/welcome/page.tsx` — first-run Create/Join fork.
- `apps/web/src/app/join/[code]/page.tsx` — public deep link (outside the `(app)` shell so it works logged-out).
- `apps/web/src/components/feature/invite-roommates.tsx` — house-page invite block.

**Modify:**
- `packages/shared/src/household.ts` — add `joinCode` to `HouseholdSchema`; add `JoinHouseholdInputSchema`.
- `packages/shared/src/policy/household.ts` — add `canRegenerateJoinCode`.
- `packages/shared/src/index.ts` — export the new module (verify export style first).
- `packages/shared/__tests__/policy.household.test.ts` — add regenerate cells (verify filename first).
- `apps/api/prisma/schema.prisma` — `Household.joinCode String @unique`.
- `apps/api/prisma/seed.ts` — give every seeded household an explicit `joinCode`.
- `apps/api/src/households/households.service.ts` — generate code on create; add `joinByCode`, `regenerateJoinCode`.
- `apps/api/src/households/households.controller.ts` — `POST /households/join`; `POST /h/:id/join-code/regenerate`.
- `apps/api/src/households/households.service.spec.ts` — new tests (verify file exists first; create if absent).
- `apps/web/src/lib/api.ts` — `households.join`, `households.regenerateCode`; `joinCode` in the get type.
- `apps/web/src/app/(auth)/register/page.tsx` — redirect to `/welcome`, carry `?join`.
- `apps/web/src/app/(auth)/login/page.tsx` — no-membership → `/welcome`; carry `?join`.
- `apps/web/src/app/(app)/h/[householdId]/house/page.tsx` — render `<InviteRoommates>`.
- `docs/ROLES.md` — matrix rows for join + regenerate.

---

## Task 1: Shared join-code helpers

**Files:**
- Create: `packages/shared/src/join-code.ts`
- Test: `packages/shared/__tests__/join-code.test.ts`

- [ ] **Step 1: Write the failing test**

Create `packages/shared/__tests__/join-code.test.ts`:

```ts
import { generateJoinCode, normalizeJoinCode, formatJoinCode } from '../src/join-code';

describe('normalizeJoinCode', () => {
  test('uppercases and strips spaces, dashes, punctuation', () => {
    expect(normalizeJoinCode(' sage-7k3 ')).toBe('SAGE7K3');
    expect(normalizeJoinCode('sage 7k3')).toBe('SAGE7K3');
    expect(normalizeJoinCode('SAGE7K3')).toBe('SAGE7K3');
  });

  test('drops everything that is not a letter or digit', () => {
    expect(normalizeJoinCode('s@ge_7k3!')).toBe('SGE7K3');
  });
});

describe('formatJoinCode', () => {
  test('inserts a dash before the last three characters for display', () => {
    expect(formatJoinCode('SAGE7K3')).toBe('SAGE-7K3');
  });

  test('returns short codes unchanged', () => {
    expect(formatJoinCode('AB')).toBe('AB');
  });
});

describe('generateJoinCode', () => {
  test('produces an alphanumeric code with no ambiguous characters', () => {
    for (let i = 0; i < 50; i++) {
      const code = generateJoinCode();
      expect(code).toMatch(/^[A-Z0-9]+$/);
      expect(code).not.toMatch(/[O0I1]/);
      expect(code.length).toBeGreaterThanOrEqual(6);
    }
  });

  test('normalizing a generated code is a no-op (already canonical)', () => {
    const code = generateJoinCode();
    expect(normalizeJoinCode(code)).toBe(code);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @homebuddy/shared test join-code`
Expected: FAIL — `Cannot find module '../src/join-code'`.

- [ ] **Step 3: Write the implementation**

Create `packages/shared/src/join-code.ts`:

```ts
// Human-readable household join codes. Stored canonical (alphanumeric,
// uppercase, e.g. "SAGE7K3"); displayed with a dash ("SAGE-7K3"); matched by
// normalizing user input back to canonical. The alphabet drops O/0/I/1 so a
// code read aloud or typed on a phone is unambiguous.

export const JOIN_CODE_WORDS = [
  'SAGE', 'MAPLE', 'HEARTH', 'WILLOW', 'CEDAR', 'LINEN',
  'EMBER', 'COCOA', 'CLOVER', 'HAVEN', 'NEST', 'BLOOM',
] as const;

const SUFFIX_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const SUFFIX_LENGTH = 3;

export function normalizeJoinCode(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

export function formatJoinCode(code: string): string {
  if (code.length <= SUFFIX_LENGTH) return code;
  const head = code.slice(0, code.length - SUFFIX_LENGTH);
  const tail = code.slice(code.length - SUFFIX_LENGTH);
  return `${head}-${tail}`;
}

export function generateJoinCode(): string {
  const word = JOIN_CODE_WORDS[Math.floor(Math.random() * JOIN_CODE_WORDS.length)];
  let suffix = '';
  for (let i = 0; i < SUFFIX_LENGTH; i++) {
    suffix += SUFFIX_ALPHABET[Math.floor(Math.random() * SUFFIX_ALPHABET.length)];
  }
  return `${word}${suffix}`;
}
```

- [ ] **Step 4: Export the module**

Read `packages/shared/src/index.ts` first to match its export style, then add (alphabetically near the others):

```ts
export * from './join-code';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `pnpm --filter @homebuddy/shared test join-code`
Expected: PASS (3 describes).

- [ ] **Step 6: Build shared + commit**

```bash
pnpm --filter @homebuddy/shared build
git add packages/shared/src/join-code.ts packages/shared/src/index.ts packages/shared/__tests__/join-code.test.ts
git commit -m "feat(shared): add household join-code helpers"
```

---

## Task 2: Shared schema + policy

**Files:**
- Modify: `packages/shared/src/household.ts`
- Modify: `packages/shared/src/policy/household.ts`
- Test: `packages/shared/__tests__/policy.household.test.ts`

- [ ] **Step 1: Add `joinCode` to the Household schema and a join input schema**

In `packages/shared/src/household.ts`, change `HouseholdSchema` to include `joinCode` and add the join input after `CreateHouseholdInputSchema`:

```ts
export const HouseholdSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(80),
  harmonyScore: z.number().int().min(0).max(100),
  lastBloomedAt: z.string().datetime().nullable(),
  joinCode: z.string(),
  createdAt: z.string().datetime(),
});
export type Household = z.infer<typeof HouseholdSchema>;
```

```ts
export const JoinHouseholdInputSchema = z.object({
  code: z.string().min(1).max(40),
});
export type JoinHouseholdInput = z.infer<typeof JoinHouseholdInputSchema>;
```

- [ ] **Step 2: Write the failing policy test**

In `packages/shared/__tests__/policy.household.test.ts` (open it first; reuse its existing scope fixtures/imports), append:

```ts
describe('householdPolicy.canRegenerateJoinCode', () => {
  test('active admin can regenerate', () => {
    expect(householdPolicy.canRegenerateJoinCode(adminScope)).toBe(true);
  });
  test('member cannot', () => {
    expect(householdPolicy.canRegenerateJoinCode(memberAliceScope)).toBe(false);
  });
  test('inactive admin cannot', () => {
    expect(householdPolicy.canRegenerateJoinCode(adminInactiveScope)).toBe(false);
  });
  test('landlord cannot', () => {
    expect(householdPolicy.canRegenerateJoinCode(landlordScope)).toBe(false);
  });
  test('non-member cannot', () => {
    expect(householdPolicy.canRegenerateJoinCode(nonMemberScope)).toBe(false);
  });
});
```

If any of those scope fixtures are not already imported at the top of the file, add the missing names to the existing import from the scopes fixture (mirror `policy.task.test.ts`, which imports `adminScope, adminInactiveScope, memberAliceScope, landlordScope, nonMemberScope`).

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @homebuddy/shared test policy.household`
Expected: FAIL — `canRegenerateJoinCode is not a function`.

- [ ] **Step 4: Implement the policy**

In `packages/shared/src/policy/household.ts`, add inside the `householdPolicy` object (after `canManageLandlordLink`):

```ts
  canRegenerateJoinCode: (scope: HouseholdScope): boolean => isActiveAdmin(scope),
```

- [ ] **Step 5: Run shared tests**

Run: `pnpm --filter @homebuddy/shared test`
Expected: PASS (all suites, including the new policy cells).

- [ ] **Step 6: Build shared + commit**

```bash
pnpm --filter @homebuddy/shared build
git add packages/shared/src/household.ts packages/shared/src/policy/household.ts packages/shared/__tests__/policy.household.test.ts
git commit -m "feat(shared): add join input schema and regenerate-code policy"
```

---

## Task 3: Prisma column, migration, seed

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20260530120000_add_household_join_code/migration.sql`
- Modify: `apps/api/prisma/seed.ts`

- [ ] **Step 1: Add the column to the schema**

In `apps/api/prisma/schema.prisma`, inside `model Household`, add after `lastBloomedAt`:

```prisma
  joinCode      String             @unique
```

- [ ] **Step 2: Write the migration SQL**

Create `apps/api/prisma/migrations/20260530120000_add_household_join_code/migration.sql`:

```sql
-- Add the join code. Existing rows get a backfilled value before the NOT NULL
-- + unique index. Backfill uses md5(random()) so every row is distinct; new
-- codes created by the app use the friendly wordlist generator.
ALTER TABLE "Household" ADD COLUMN "joinCode" TEXT;

UPDATE "Household"
SET "joinCode" = upper(substr(md5(random()::text || id::text), 1, 7))
WHERE "joinCode" IS NULL;

ALTER TABLE "Household" ALTER COLUMN "joinCode" SET NOT NULL;

CREATE UNIQUE INDEX "Household_joinCode_key" ON "Household"("joinCode");
```

- [ ] **Step 3: Apply the migration and regenerate the client**

```bash
cd apps/api
export DATABASE_URL="postgresql://homebuddy:homebuddy@localhost:5433/homebuddy?schema=public"
pnpm exec prisma migrate deploy
pnpm exec prisma generate
cd ../..
```

Expected: "All migrations have been successfully applied." and client regenerated.

- [ ] **Step 4: Give seeded households explicit codes**

In `apps/api/prisma/seed.ts`, add `joinCode` to the `create` of each `household.upsert`. The `update` branches do not need it (the migration already backfilled existing rows). Use stable demo codes:

- Demo House (`...0001`): `joinCode: 'DEMOHB2'`
- Sunset Kot (`...0002`): `joinCode: 'SUNSET3'`
- Maple Flat (`...0003`): `joinCode: 'MAPLE44'`
- Bloom Stage (`...0004`): `joinCode: 'BLOOM55'`

Example for Demo House:

```ts
  const household = await prisma.household.upsert({
    where: { id: '00000000-0000-0000-0000-000000000001' },
    update: {},
    create: { id: '00000000-0000-0000-0000-000000000001', name: 'Demo House', joinCode: 'DEMOHB2' },
  });
```

Apply the same pattern (add `joinCode` to the `create`) to Sunset Kot, Maple Flat, and Bloom Stage.

- [ ] **Step 5: Run the seed**

```bash
pnpm db:seed
```

Expected: completes without a unique-constraint error; the demo logins still print.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/20260530120000_add_household_join_code apps/api/prisma/seed.ts
git commit -m "feat(prisma): add household join code with backfill migration"
```

---

## Task 4: API — generate on create, join, regenerate (service)

**Files:**
- Modify: `apps/api/src/households/households.service.ts`
- Test: `apps/api/src/households/households.service.spec.ts` (check if it exists; if not, create it with the structure below)

- [ ] **Step 1: Write failing service tests**

Open `apps/api/src/households/households.service.spec.ts`. If it does not exist, create it modeled on `apps/api/src/tasks/tasks.service.spec.ts` (a `Test.createTestingModule` providing `HouseholdsService`, a mocked `PrismaService`, and a mocked `SmartRotationService`). Add this describe block (extend the prisma mock with the methods it uses):

```ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type { HouseholdScope } from '@homebuddy/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SmartRotationService } from '../tasks/smart-rotation.service';
import { HouseholdsService } from './households.service';

describe('HouseholdsService join code', () => {
  let service: HouseholdsService;
  const prisma = {
    household: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    householdMember: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  };
  const rotation = { pickAssignee: jest.fn() };
  const aliceNoHouse = { householdId: '', userId: 'u-alice', systemRole: 'user' } as unknown as HouseholdScope;
  const adminScope: HouseholdScope = {
    householdId: 'h1', userId: 'u-alice', systemRole: 'user',
    membership: { id: 'm1', role: 'admin', status: 'active' },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        HouseholdsService,
        { provide: PrismaService, useValue: prisma },
        { provide: SmartRotationService, useValue: rotation },
      ],
    }).compile();
    service = moduleRef.get(HouseholdsService);
  });

  it('create assigns a join code', async () => {
    prisma.household.create.mockImplementation(({ data }) => Promise.resolve({ id: 'h9', ...data }));
    const house = await service.create('u-alice', { name: 'Kot 12' });
    expect(house.joinCode).toMatch(/^[A-Z0-9]+$/);
    expect(prisma.household.create.mock.calls[0][0].data.members.create).toEqual({ userId: 'u-alice', role: 'admin' });
  });

  it('joinByCode joins a non-member as an active member', async () => {
    prisma.household.findUnique.mockResolvedValue({ id: 'h1', name: 'Demo', joinCode: 'SAGE7K3' });
    prisma.householdMember.findUnique.mockResolvedValue(null);
    prisma.householdMember.create.mockResolvedValue({ id: 'm-new' });
    const house = await service.joinByCode('u-bob', { code: 'sage-7k3' });
    expect(prisma.household.findUnique).toHaveBeenCalledWith({ where: { joinCode: 'SAGE7K3' } });
    expect(prisma.householdMember.create).toHaveBeenCalledWith({
      data: { userId: 'u-bob', householdId: 'h1', role: 'member', status: 'active' },
    });
    expect(house.id).toBe('h1');
  });

  it('joinByCode rejects an unknown code', async () => {
    prisma.household.findUnique.mockResolvedValue(null);
    await expect(service.joinByCode('u-bob', { code: 'NOPE000' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('joinByCode is idempotent for an existing active member', async () => {
    prisma.household.findUnique.mockResolvedValue({ id: 'h1', name: 'Demo', joinCode: 'SAGE7K3' });
    prisma.householdMember.findUnique.mockResolvedValue({ id: 'm1', status: 'active' });
    const house = await service.joinByCode('u-bob', { code: 'SAGE7K3' });
    expect(prisma.householdMember.create).not.toHaveBeenCalled();
    expect(house.id).toBe('h1');
  });

  it('joinByCode reactivates an inactive member', async () => {
    prisma.household.findUnique.mockResolvedValue({ id: 'h1', name: 'Demo', joinCode: 'SAGE7K3' });
    prisma.householdMember.findUnique.mockResolvedValue({ id: 'm1', status: 'inactive' });
    prisma.householdMember.update.mockResolvedValue({ id: 'm1', status: 'active' });
    await service.joinByCode('u-bob', { code: 'SAGE7K3' });
    expect(prisma.householdMember.update).toHaveBeenCalledWith({
      where: { id: 'm1' },
      data: { status: 'active', inactiveFrom: null, inactiveUntil: null, inactiveReason: null },
    });
  });

  it('regenerateJoinCode rejects a non-admin', async () => {
    await expect(service.regenerateJoinCode(aliceNoHouse)).rejects.toBeTruthy();
  });

  it('regenerateJoinCode sets a new code for an admin', async () => {
    prisma.household.update.mockImplementation(({ data }) => Promise.resolve({ id: 'h1', joinCode: data.joinCode }));
    const result = await service.regenerateJoinCode(adminScope);
    expect(result.joinCode).toMatch(/^[A-Z0-9]+$/);
    expect(prisma.household.update.mock.calls[0][0].where).toEqual({ id: 'h1' });
  });
});
```

Note: the `regenerateJoinCode rejects a non-admin` test passes `aliceNoHouse` (no membership). Adjust the call to match the final signature from Step 3 (`regenerateJoinCode(scope)`).

- [ ] **Step 2: Run to verify failure**

Run: `pnpm --filter @homebuddy/api test households.service`
Expected: FAIL — `joinByCode`/`regenerateJoinCode` not a function; `create` has no `joinCode`.

- [ ] **Step 3: Implement in the service**

In `apps/api/src/households/households.service.ts`:

Add to the imports from `@homebuddy/shared`:

```ts
  generateJoinCode,
  normalizeJoinCode,
  type JoinHouseholdInput,
```

Replace the existing `create` method with:

```ts
  async create(userId: string, input: CreateHouseholdInput) {
    return this.prisma.household.create({
      data: {
        name: input.name,
        joinCode: await this.uniqueJoinCode(),
        members: { create: { userId, role: 'admin' } },
      },
    });
  }
```

Add these methods (place after `create`):

```ts
  private async uniqueJoinCode(): Promise<string> {
    for (let attempt = 0; attempt < 8; attempt++) {
      const code = generateJoinCode();
      const clash = await this.prisma.household.findUnique({
        where: { joinCode: code },
        select: { id: true },
      });
      if (!clash) return code;
    }
    throw new Error('Could not generate a unique join code');
  }

  async joinByCode(userId: string, input: JoinHouseholdInput) {
    const code = normalizeJoinCode(input.code);
    const household = await this.prisma.household.findUnique({ where: { joinCode: code } });
    if (!household) {
      throw new NotFoundException("That code didn't match a house. Check it and try again.");
    }

    const existing = await this.prisma.householdMember.findUnique({
      where: { userId_householdId: { userId, householdId: household.id } },
      select: { id: true, status: true },
    });

    if (existing?.status === 'active') return household;

    if (existing) {
      await this.prisma.householdMember.update({
        where: { id: existing.id },
        data: { status: 'active', inactiveFrom: null, inactiveUntil: null, inactiveReason: null },
      });
      return household;
    }

    await this.prisma.householdMember.create({
      data: { userId, householdId: household.id, role: 'member', status: 'active' },
    });
    return household;
  }

  async regenerateJoinCode(scope: HouseholdScope) {
    if (!householdPolicy.canRegenerateJoinCode(scope)) throw new ForbiddenException();
    const joinCode = await this.uniqueJoinCode();
    return this.prisma.household.update({
      where: { id: scope.householdId },
      data: { joinCode },
      select: { joinCode: true },
    });
  }
```

- [ ] **Step 4: Run to verify pass**

Run: `pnpm --filter @homebuddy/api test households.service`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/households/households.service.ts apps/api/src/households/households.service.spec.ts
git commit -m "feat(api): join household by code and regenerate the code"
```

---

## Task 5: API — controller routes

**Files:**
- Modify: `apps/api/src/households/households.controller.ts`

- [ ] **Step 1: Add the join route to the top-level controller**

In `apps/api/src/households/households.controller.ts`, update the shared import to add the schema/type:

```ts
  JoinHouseholdInputSchema,
  type JoinHouseholdInput,
```

Then add inside `HouseholdsController` (after `create`):

```ts
  @Post('join')
  join(
    @CurrentUser() user: AuthUser,
    @Body(new ZodValidationPipe(JoinHouseholdInputSchema)) input: JoinHouseholdInput,
  ) {
    return this.households.joinByCode(user.id, input);
  }
```

(`CurrentUser` and `AuthUser` are already imported in this file.)

- [ ] **Step 2: Add the regenerate route to the scoped controller**

Inside `HouseholdScopedController`, add (after the `update` method):

```ts
  @Post('join-code/regenerate')
  @RequireRole('admin')
  regenerateJoinCode(@CurrentScope() scope: HouseholdScope) {
    return this.households.regenerateJoinCode(scope);
  }
```

- [ ] **Step 3: Typecheck the api**

Run: `pnpm --filter @homebuddy/api exec tsc --noEmit -p tsconfig.json`
Expected: no output (clean).

- [ ] **Step 4: Restart dev api and smoke test**

Restart the dev server (regenerated client + new routes). Then:

```bash
TOKEN=$(curl -s -X POST http://localhost:4000/api/auth/login -H 'Content-Type: application/json' -d '{"email":"bob@homebuddy.dev","password":"password123"}' | python3 -c 'import sys,json;print(json.load(sys.stdin)["accessToken"])')
# Bob is not in Maple Flat; join it by its seeded code:
curl -s -X POST http://localhost:4000/api/households/join -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' -d '{"code":"maple-44"}' | python3 -c 'import sys,json;d=json.load(sys.stdin);print("joined", d.get("name"), d.get("joinCode"))'
```

Expected: `joined Maple Flat MAPLE44`. A bogus code returns 404 with the friendly message.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/households/households.controller.ts
git commit -m "feat(api): expose join and regenerate-code endpoints"
```

---

## Task 6: Web API client

**Files:**
- Modify: `apps/web/src/lib/api.ts`

- [ ] **Step 1: Add the types import**

In `apps/web/src/lib/api.ts`, add to the `@homebuddy/shared` type import block:

```ts
  JoinHouseholdInput,
```

- [ ] **Step 2: Add the client methods**

In the `households` object, after `create`, add:

```ts
    join: (input: JoinHouseholdInput) =>
      request<Household>('/households/join', { method: 'POST', body: input, auth: true }),
    regenerateCode: (id: string) =>
      request<{ joinCode: string }>(`/h/${id}/join-code/regenerate`, { method: 'POST', auth: true }),
```

- [ ] **Step 3: Typecheck the web**

Run: `pnpm --filter @homebuddy/web exec tsc --noEmit`
Expected: clean (the `Household` type now carries `joinCode` from the shared build done in Task 2).

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/api.ts
git commit -m "feat(web): add join and regenerate-code api client methods"
```

---

## Task 7: Web — `/welcome` first-run fork

**Files:**
- Create: `apps/web/src/app/(app)/welcome/page.tsx`

- [ ] **Step 1: Create the page**

Create `apps/web/src/app/(app)/welcome/page.tsx`:

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, TextInput } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/use-auth';

export default function WelcomePage() {
  const router = useRouter();
  const { refresh } = useAuth();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function createHouse(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setBusy('create');
    setError(null);
    try {
      const house = await apiClient.households.create({ name: name.trim() });
      await refresh();
      router.push(`/h/${house.id}/today`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create the house.');
    } finally {
      setBusy(null);
    }
  }

  async function joinHouse(e: React.FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setBusy('join');
    setError(null);
    try {
      const house = await apiClient.households.join({ code: code.trim() });
      await refresh();
      router.push(`/h/${house.id}/today`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not join that house.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--text-soft)]">Welcome</p>
        <h1 className="text-3xl font-bold tracking-tight">Let’s set up your home.</h1>
        <p className="text-sm text-[var(--text-mute)]">Start a house, or join one your roommates already made.</p>
      </header>

      {error && (
        <p className="text-sm text-[color:var(--color-state-danger)]" role="alert">{error}</p>
      )}

      <div className="grid gap-6 sm:grid-cols-2">
        <Card>
          <form onSubmit={createHouse} className="flex flex-col gap-4" aria-label="Create a house">
            <h2 className="text-lg font-semibold tracking-tight">Create a house</h2>
            <Field label="House name" required>
              {(id) => (
                <TextInput id={id} value={name} onChange={(e) => setName(e.target.value)} placeholder="Kot 12" required />
              )}
            </Field>
            <Button type="submit" disabled={busy !== null || !name.trim()}>
              {busy === 'create' ? 'Creating…' : 'Create house'}
            </Button>
            <p className="text-xs text-[var(--text-soft)]">You become the admin and get a code to share.</p>
          </form>
        </Card>

        <Card surface="wash">
          <form onSubmit={joinHouse} className="flex flex-col gap-4" aria-label="Join a house">
            <h2 className="text-lg font-semibold tracking-tight">Join a house</h2>
            <Field label="Join code" hint="Your housemate can share it." required>
              {(id) => (
                <TextInput id={id} value={code} onChange={(e) => setCode(e.target.value)} placeholder="SAGE-7K3" autoCapitalize="characters" required />
              )}
            </Field>
            <Button type="submit" variant="secondary" disabled={busy !== null || !code.trim()}>
              {busy === 'join' ? 'Joining…' : 'Join house'}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
```

If `Card` does not accept a `surface="wash"` prop, drop that prop (verify against `apps/web/src/components/ui/card.tsx`).

- [ ] **Step 2: Typecheck the web**

Run: `pnpm --filter @homebuddy/web exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/(app)/welcome/page.tsx"
git commit -m "feat(web): add welcome create-or-join onboarding screen"
```

---

## Task 8: Web — fix redirects, carry the join code through auth

**Files:**
- Modify: `apps/web/src/app/(auth)/register/page.tsx`
- Modify: `apps/web/src/app/(auth)/login/page.tsx`

- [ ] **Step 1: Register — redirect to `/welcome`, honor a pending join code**

In `apps/web/src/app/(auth)/register/page.tsx`:

Add to imports:

```ts
import { useRouter, useSearchParams } from 'next/navigation';
```

Inside the component, read the param:

```ts
  const search = useSearchParams();
  const joinCode = search.get('join');
```

Replace `router.push('/today');` in `onSubmit` with:

```ts
      if (joinCode) {
        try {
          const house = await apiClient.households.join({ code: joinCode });
          router.push(`/h/${house.id}/today`);
          return;
        } catch {
          // Fall through to the welcome screen; they can re-enter the code.
        }
      }
      router.push('/welcome');
```

Also make the "Sign in" link preserve the code:

```tsx
        <Link href={joinCode ? `/login?join=${joinCode}` : '/login'} className="font-semibold text-[var(--accent)] hover:underline">
          Sign in
        </Link>
```

- [ ] **Step 2: Login — no-membership goes to `/welcome`, honor pending code**

In `apps/web/src/app/(auth)/login/page.tsx`:

Add `useSearchParams`:

```ts
import { useRouter, useSearchParams } from 'next/navigation';
```

```ts
  const search = useSearchParams();
  const joinCode = search.get('join');
```

Replace the redirect block in `onSubmit` (the `firstProperty`/`firstMembership`/`else` chain) with:

```ts
      if (joinCode) {
        try {
          const house = await apiClient.households.join({ code: joinCode });
          router.push(`/h/${house.id}/today`);
          return;
        } catch {
          // ignore; fall through to normal routing
        }
      }
      const me = await apiClient.me();
      const firstProperty = me.properties[0];
      const firstMembership = me.memberships[0];
      if (firstProperty && me.memberships.length === 0) {
        router.push(`/properties/${firstProperty.propertyId}`);
      } else if (firstMembership) {
        router.push(`/h/${firstMembership.householdId}`);
      } else {
        router.push('/welcome');
      }
```

And the "Create one" link:

```tsx
        <Link href={joinCode ? `/register?join=${joinCode}` : '/register'} className="font-semibold text-[var(--accent)] hover:underline">
          Create one
        </Link>
```

- [ ] **Step 3: Typecheck the web**

Run: `pnpm --filter @homebuddy/web exec tsc --noEmit`
Expected: clean. (`useSearchParams` requires the component to be inside a Suspense boundary in some setups; both pages are `'use client'` leaf pages and already render under the app — if the build warns, wrap the page body in `<Suspense>`. Verify with the build in Task 11.)

- [ ] **Step 4: Commit**

```bash
git add "apps/web/src/app/(auth)/register/page.tsx" "apps/web/src/app/(auth)/login/page.tsx"
git commit -m "fix(web): route new users to welcome and carry join code"
```

---

## Task 9: Web — `/join/[code]` deep link

**Files:**
- Create: `apps/web/src/app/join/[code]/page.tsx`

- [ ] **Step 1: Create the public deep-link page**

This route lives OUTSIDE the `(app)` group so it renders for logged-out users (the `(app)` shell redirects them to `/login`). It reads the auth token directly.

Create `apps/web/src/app/join/[code]/page.tsx`:

```tsx
'use client';

import { use, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { authStore } from '@/lib/auth-store';

export default function JoinByLinkPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  const router = useRouter();
  const [status, setStatus] = useState<'working' | 'error'>('working');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    const token = authStore.getAccessToken();
    if (!token) {
      router.replace(`/register?join=${encodeURIComponent(code)}`);
      return;
    }
    apiClient.households
      .join({ code })
      .then((house) => router.replace(`/h/${house.id}/today`))
      .catch(() => setStatus('error'));
  }, [code, router]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center">
      {status === 'working' ? (
        <p className="text-sm text-[var(--text-mute)]">Joining the house…</p>
      ) : (
        <>
          <h1 className="text-xl font-bold tracking-tight">That code didn’t match a house</h1>
          <p className="max-w-prose text-sm text-[var(--text-mute)]">
            Ask your housemate for the current code, then try again from the welcome screen.
          </p>
          <button
            type="button"
            onClick={() => router.replace('/welcome')}
            className="mt-2 rounded-full bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-cream"
          >
            Go to welcome
          </button>
        </>
      )}
    </main>
  );
}
```

Verify `authStore.getAccessToken` exists in `apps/web/src/lib/auth-store.ts` (it is used by `use-auth.tsx`). Verify the cream text token class `text-cream` is used elsewhere (it appears in `app-shell.tsx` skip link); if not, use `text-[var(--color-cream)]`.

- [ ] **Step 2: Typecheck the web**

Run: `pnpm --filter @homebuddy/web exec tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/src/app/join/[code]/page.tsx"
git commit -m "feat(web): add join-by-link deep link route"
```

---

## Task 10: Web — Invite roommates block on the house page

**Files:**
- Create: `apps/web/src/components/feature/invite-roommates.tsx`
- Modify: `apps/web/src/app/(app)/h/[householdId]/house/page.tsx`

- [ ] **Step 1: Create the invite component**

Create `apps/web/src/components/feature/invite-roommates.tsx`:

```tsx
'use client';

import { Copy, ArrowsClockwise } from '@phosphor-icons/react';
import { useState } from 'react';
import { formatJoinCode } from '@homebuddy/shared';
import { Button, InlineConfirm } from '@/components/ui';
import { apiClient, ApiError } from '@/lib/api';

interface InviteRoommatesProps {
  householdId: string;
  joinCode: string;
  isAdmin: boolean;
  onRegenerated: (code: string) => void;
}

export function InviteRoommates({ householdId, joinCode, isAdmin, onRegenerated }: InviteRoommatesProps) {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const link = typeof window !== 'undefined' ? `${window.location.origin}/join/${joinCode}` : `/join/${joinCode}`;

  async function copyLink() {
    setError(null);
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Long-press the code to copy it.');
    }
  }

  async function regenerate() {
    setError(null);
    try {
      const res = await apiClient.households.regenerateCode(householdId);
      onRegenerated(res.joinCode);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not make a new code.');
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-[var(--text-mute)]">Share this with your housemates.</p>
      <div className="flex flex-wrap items-center gap-3">
        <span className="rounded-2xl border border-[var(--border)] bg-[var(--surface-raised)] px-4 py-2 text-lg font-bold tracking-[0.12em]">
          {formatJoinCode(joinCode)}
        </span>
        <Button type="button" size="sm" variant="secondary" onClick={copyLink}>
          <Copy size={14} weight="bold" aria-hidden />
          {copied ? 'Copied' : 'Copy link'}
        </Button>
        {isAdmin && (
          <InlineConfirm
            label="New code"
            confirmLabel="Make a new code"
            question="Make a new code? The old link will stop working."
            onConfirm={regenerate}
          />
        )}
      </div>
      {error && <p className="text-xs text-[color:var(--color-state-danger)]" role="alert">{error}</p>}
    </div>
  );
}
```

Verify `Button` accepts `size="sm"` and `InlineConfirm` has the props `label/confirmLabel/question/onConfirm` (it is used this way in `task-card.tsx`). If `ArrowsClockwise` is unused, remove it from the import.

- [ ] **Step 2: Render it on the house page**

Open `apps/web/src/app/(app)/h/[householdId]/house/page.tsx`. It already fetches the household-with-members (which now includes `joinCode`) and knows the current user's role. Add an "Invite roommates" section near the members list. Concretely:

- Import the component and the can-hook:

```tsx
import { InviteRoommates } from '@/components/feature/invite-roommates';
import { useCan } from '@/lib/use-can';
```

- Where the household data is available (the same object used to render members; call it `house` here), render inside a `Card` with a `SectionHeader`:

```tsx
{house?.joinCode && (
  <Card>
    <SectionHeader eyebrow="Invite" title="Invite roommates" />
    <InviteRoommates
      householdId={householdId}
      joinCode={house.joinCode}
      isAdmin={can.isAdmin}
      onRegenerated={() => { void refresh(); }}
    />
  </Card>
)}
```

Match the existing variable names in the file: use the same household variable the members list iterates, the same `Card`/`SectionHeader` imports already present, the page's `householdId`, the `useCan()` instance (add `const can = useCan();` if not present), and the page's existing `refresh`/refetch function (if the page uses a local fetch rather than context, call that refetch in `onRegenerated`). Read the file fully before editing so the wiring matches.

- [ ] **Step 3: Typecheck the web**

Run: `pnpm --filter @homebuddy/web exec tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/feature/invite-roommates.tsx "apps/web/src/app/(app)/h/[householdId]/house/page.tsx"
git commit -m "feat(web): invite roommates block with join code and regenerate"
```

---

## Task 11: Docs + full verification

**Files:**
- Modify: `docs/ROLES.md`

- [ ] **Step 1: Add ROLES matrix rows**

In `docs/ROLES.md`, in the System / cross-household section of the permission matrix, add a row for self-service join, and in the Household section add a row for regenerate. Example lines (match the table's column count):

```markdown
| Join a house by code | any authenticated user | any authenticated user | any authenticated user | n/a | any authenticated user |
```

```markdown
| Regenerate the join code | ✅ | ❌ | ❌ | ❌ | ❌ |
```

Add a short note under the matrix: "Joining by code is self-service (any authenticated user with a valid code becomes a `member`). Regenerating the code is admin-only and invalidates the old code immediately. Backed by `householdPolicy.canRegenerateJoinCode` and the unscoped `POST /households/join`."

- [ ] **Step 2: Run the full test suite**

Run: `pnpm test`
Expected: shared + api suites green (shared gains the join-code + policy tests; api gains the join-code service tests).

- [ ] **Step 3: Production build of the web (catches Suspense/useSearchParams issues)**

Run: `pnpm --filter @homebuddy/web build`
Expected: build succeeds, routes `/welcome` and `/join/[code]` listed. If the build fails on `useSearchParams` needing Suspense, wrap the affected page's body in `<Suspense fallback={null}>` and rebuild.

- [ ] **Step 4: Manual smoke (dev server running)**

1. Register a brand-new email → lands on `/welcome`.
2. Create a house → lands in `/h/:id/today`; open House page → an "Invite roommates" block shows a code.
3. Copy the `/join/CODE` link. In a private window (logged out), open it → routed to register with `?join=CODE`; after signup, auto-joined into that house.
4. As an admin, regenerate the code → old `/join/CODE` now shows the friendly error.

- [ ] **Step 5: Commit + push**

```bash
git add docs/ROLES.md
git commit -m "docs: record join-by-code and regenerate permissions"
git push origin main
```

---

## Self-review notes (resolved)

- **Spec coverage:** join code model (Task 3), generate-on-create + join + regenerate (Tasks 4–5), client (Task 6), `/welcome` (Task 7), redirect fixes + carry-code (Task 8), `/join/[code]` (Task 9), house-page invite block (Task 10), ROLES rows + verification (Task 11). Email-invite endpoint intentionally untouched (spec: retained for Resend).
- **Naming consistency:** service methods `joinByCode` / `regenerateJoinCode`; client `households.join` / `households.regenerateCode`; shared `generateJoinCode` / `normalizeJoinCode` / `formatJoinCode`; policy `canRegenerateJoinCode` — used identically across tasks.
- **Stored vs displayed code:** canonical alphanumeric stored + matched via `normalizeJoinCode`; `formatJoinCode` only for display. Join links and lookups use the canonical form.
- **Verify-before-edit flags:** index export style (Task 1), policy test fixtures (Task 2), `households.service.spec` existence (Task 4), `Card surface` prop (Task 7), `authStore.getAccessToken` + `text-cream` (Task 9), house-page variable names + `Button size`/`InlineConfirm` props (Task 10) — each step says to read the file first where the shape is uncertain.
