# Cost Sharing — Design Spec

Date: 2026-06-06
Status: approved (owner delegated full build)
Feature owner: Catja · Developer: Kai

## Goal

Let housemates share the cost of things they buy for the house. A resident
photographs a receipt; HomeBuddy reads it (self-hosted OCR), shows an
**editable** draft, the resident corrects anything wrong, then splits the
corrected total among the housemates. Settlement is a two-sided handshake.
Money is its own zone — it never touches the harmony/Energy Core and is never
visible to the landlord.

## Decisions (locked)

1. **Receipt input** — photo → self-hosted Tesseract OCR (`tesseract.js`,
   Apache-2.0, free, runs inside the API, image never leaves our server) →
   heuristic parse into a draft (line items + total). OCR never auto-commits;
   the resident reviews and **corrects** every draft before saving. If OCR
   fails or returns nothing, the form falls back to manual entry.
2. **Split model** — whole-bill. One bill = one corrected total, split
   **equally** among the included people. Editing the split = toggling people
   off (they pay nothing). Line items exist only as a review/correction aid;
   the split maths is always on the corrected total. No per-item assignment.
3. **Default included** — **active** members only. Invited and inactive
   members are excluded by default; the creator can manually add anyone who is
   a member of the household.
4. **Settlement** — two-sided handshake per debtor share:
   - the **debtor** marks "I paid" (optionally attaching a proof photo),
   - the **bill creator** then confirms "received", which settles the share.
   Either side acting alone does not settle; both are required.
5. **Overview** — per-person netting across all bills. Because every bill has a
   single payer (the creator), debts are directional (creditor ← debtor). The
   money page shows each person's net position toward the viewer
   ("Bob owes you 23.00", "You owe Alice 8.00").
6. **Harmony** — bills do **not** affect the harmony score or Energy Core.
7. **Image storage** — S3-compatible abstraction via `@aws-sdk/client-s3`
   (open-source client). Two drivers chosen by `STORAGE_DRIVER`:
   - `local` (default, dev/offline): writes under `apps/api/uploads/`, served
     read-only at `/api/uploads/*`. Zero config.
   - `s3` (prod): env-configured endpoint/bucket/keys → free Cloudflare R2 or
     self-hosted MinIO. Same code path.
8. **Currency** — EUR only. Amounts stored as integer **cents** to avoid float
   error. No multi-currency.
9. **Privacy** — money is tenant-only. No expense data crosses the Privacy Line
   into the landlord portal, ever.

## Authorization (`expensePolicy`)

| Action | Who |
|---|---|
| View bills + balances | any member (incl. inactive/invited — read only) |
| Create a bill | any **active** member |
| Edit / delete a bill | the **creator** or an active **admin** |
| Mark a share paid (+ proof) | the **debtor** of that share only |
| Confirm a share received | the **creator** of the bill only |

Pure functions in `packages/shared/src/policy/expense.ts`, mirroring
`taskPolicy` (take `HouseholdScope` + resource, return boolean, no framework
deps). Service layer enforces; controller guards with
`JwtAuthGuard, HouseholdScopeGuard, RoleGuard` like every scoped module.

## Data model (Prisma)

```
enum ExpenseShareStatus { open paid confirmed }

model Expense {
  id           String         @id @default(uuid())
  household    Household      @relation(...)   onDelete: Cascade
  householdId  String
  creator      User           @relation("ExpenseCreator", ...)
  creatorId    String
  title        String
  note         String?        @db.Text
  totalCents   Int                              // corrected total, EUR cents
  receiptUrl   String?        @db.Text          // stored receipt image (optional)
  items        ExpenseItem[]                     // corrected line items (review aid)
  shares       ExpenseShare[]
  createdAt    DateTime       @default(now())
  updatedAt    DateTime       @updatedAt
  @@index([householdId, createdAt])
}

model ExpenseItem {
  id          String  @id @default(uuid())
  expense     Expense @relation(...)            onDelete: Cascade
  expenseId   String
  label       String
  amountCents Int
  position    Int                                // preserve receipt order
  @@index([expenseId])
}

model ExpenseShare {
  id          String             @id @default(uuid())
  expense     Expense            @relation(...) onDelete: Cascade
  expenseId   String
  debtor      User               @relation("ExpenseDebtor", ...)
  debtorId    String
  amountCents Int                                 // this person's split of the total
  status      ExpenseShareStatus @default(open)
  proofUrl    String?            @db.Text         // optional proof-of-payment image
  paidAt      DateTime?
  confirmedAt DateTime?
  @@unique([expenseId, debtorId])
  @@index([expenseId])
}
```

The creator is the payer/creditor; they are not given a share row (you do not
owe yourself). `amountCents` per share is computed at creation by splitting
`totalCents` equally across included people, distributing the remainder cent by
cent to the first shares so the shares always sum exactly to the total.

## Split & netting (pure, tested)

`packages/shared/src/expense.ts`:

- `splitEqually(totalCents, debtorIds): Array<{debtorId, amountCents}>` —
  floor split + remainder spread; sum === total; stable order.
- `netBalances(expenses, viewerId): Array<{userId, netCents}>` — for each other
  person, sum what they owe the viewer minus what the viewer owes them across
  unsettled (non-`confirmed`) shares; positive = they owe the viewer.
- `parseReceiptText(rawOcrText): {items, totalCents}` — heuristic: extract
  `label … price` lines, detect a `TOTAL` line (else fall back to the largest
  price / sum of items). Always returns an editable draft; never throws.

## API (`apps/api/src/expenses/`)

Routes under `h/:householdId/expenses`:

- `POST .../scan` — body `{ imageDataUrl }`; runs OCR + parse; returns a draft
  `{ items, totalCents, receiptUrl }`. Does **not** persist an Expense.
  Stores the receipt image and returns its URL so the eventual create can keep
  it. Active members only.
- `GET .../` — list bills for the household with shares (+ a computed
  `balances` block for the viewer). Any member.
- `POST .../` — create a bill: `{ title, note?, totalCents, items[],
  includedDebtorIds[], receiptUrl? }`. Server recomputes shares via
  `splitEqually` (never trusts client share amounts). Active members.
- `PATCH .../:id` — edit title/note/total/items/included people (creator or
  admin); shares recomputed. Settled shares block destructive edits.
- `DELETE .../:id` — creator or admin.
- `POST .../:id/shares/:shareId/paid` — `{ proofImageDataUrl? }`; debtor marks
  paid, stores optional proof, sets `paid`.
- `POST .../:id/shares/:shareId/confirm` — creator confirms → `confirmed`.

Supporting modules:

- `StorageModule` / `StorageService` — `put(buffer, contentType): url`, driver
  by `STORAGE_DRIVER`. Decodes base64 data URLs.
- `OcrModule` / `OcrService` — `read(buffer): string` via `tesseract.js`,
  graceful empty string on failure.

## Web (`apps/web`)

- New nav entry **Money** (segment `money`, Receipt icon).
- `/h/[id]/money` — list of bills + per-person netting summary at top
  ("Bob owes you 23.00"). Each bill expandable to its shares with status and
  the two-sided actions (debtor: "I paid" + optional photo; creator: "Confirm
  received").
- New-bill flow on the same page (BottomSheet/inline): pick photo → calls
  `scan` → shows editable draft (line items + total, all correctable) → member
  checklist (active pre-checked) → save.
- `apiClient.expenses.*` namespace; types from `@homebuddy/shared`. Money data
  is fetched on the money page itself (not in the global HouseholdProvider) to
  keep other pages light.

## Seed (Demo House)

Add two demo bills so the feature demos without setup:
- "Groceries — Colruyt" 42.50, creator Alice, split Alice+Bob; Bob's share
  `paid` (awaiting Alice's confirm) — demonstrates the handshake mid-flight.
- "Cleaning supplies" 18.00, creator Bob, split Alice+Bob; Alice's share `open`.
Charlie (invited) is excluded by default, demonstrating the active-only rule.

## Out of scope (YAGNI)

Per-item assignment, unequal/weighted shares, multi-currency, in-app payment
rails (Stripe/bank), recurring bills, debt reminders/notifications, exporting.

## Testing

- shared (Jest): `splitEqually` (even, remainder, single, exact-sum),
  `netBalances` (directional, multi-bill, excludes confirmed),
  `parseReceiptText` (total line, no total, junk), `expensePolicy` (each row of
  the matrix).
- api (Jest): `ExpenseService` — create recomputes shares server-side, paid
  requires debtor, confirm requires creator, cross-household NotFound, edit
  blocked on settled shares.

## Risks

- **OCR reliability in prod** — `tesseract.js` fetches its wasm core + `eng`
  traineddata at first run. Mitigated by graceful fallback to manual entry and
  a configurable cache path; OCR is only ever a draft the resident corrects.
- **Local storage on ephemeral hosts** — `local` driver loses images on
  redeploy. Acceptable for dev; prod sets `STORAGE_DRIVER=s3` (R2/MinIO).
