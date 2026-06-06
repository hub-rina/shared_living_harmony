# Recurring chores — design

Date: 2026-05-31
Status: approved-for-build (owner away; autonomous execution authorized)

## Problem

Routine chores are one-off: a chore has a single `dueAt` and, once completed, nothing
recurs. Real shared-home chores repeat ("clean the stairs every week", "deep-clean the
fridge every month"). Two needs:

1. A way to mark a chore as recurring (weekly / monthly) when adding it.
2. The repeat must respect fairness and timing. The owner's edge case: the stairs are
   weekly; Alice cleans on Sunday; the next week it should go to the *other* person, and
   nobody should be nudged to clean while it is still clean (e.g. completed early, or a
   different person glances on Monday).

## Non-goals

- Arbitrary RRULE / custom intervals / "every 2nd Tuesday". Weekly and monthly only.
- A look-ahead scheduler that pre-creates many future occurrences. One open occurrence at
  a time (mirrors the existing Ritual recurrence pattern).
- Changing the Smart Rotation scoring model. We reuse it.

## Model

Add `TaskCadence { once, weekly, monthly }` and `Task.cadence TaskCadence @default(once)`.
Default keeps every existing row valid (additive, prod-safe migration).

`once` = today's behaviour. `weekly` / `monthly` = recurring routine chore.

Reactive (flagged-mess) tasks are always `once` — they describe a specific mess, not a
schedule.

## Recurrence behaviour (the core)

A recurring occurrence is generated **only when the current one is completed** (same model
as Rituals). This guarantees exactly one open occurrence at any time, so a household never
sees two copies of the same recurring chore, and nobody is asked to clean something that is
still clean.

On completing a routine task whose `cadence != once`:

1. Compute the next due date **anchored to the schedule, not to the completion time**:
   `nextDueAt = advance(task.dueAt, cadence)` repeated until it is in the future.
   - weekly: + 7 days; monthly: + 1 calendar month.
   - Anchoring to `dueAt` (not `completedAt`) means completing early does **not** drag the
     rhythm earlier, and completing late does **not** immediately create an overdue next
     occurrence (we keep advancing until the next due is in the future).
2. Pick the next assignee with Smart Rotation, **excluding the person who just completed
   it**. This rotates the chore to someone else next time (the owner's "Alice did it
   Sunday, the other gets it next week"). It generalises the existing heavy-chore
   last-completer lock to light recurring chores too.
3. Create the next task: same `title`, `weight`, `kind`, `cadence`; `status = pending`;
   `dueAt = nextDueAt`; assignee + rotationReason from rotation.

Completion and next-occurrence creation run in one Prisma transaction.

### Why the edge case is solved

- "Cleaned early, looked at again Monday while clean": the next occurrence's `dueAt` sits
  on the weekly grid (next Sunday), so it is not due now; no nudge to re-clean.
- "Different person completes it": rotation excludes the actual completer, so the turn
  moves on regardless of who originally held it.
- "Completed very late": `advance` loops until the next due is in the future, so the next
  occurrence is never born overdue.
- No duplicate open occurrences: next is created only on completion of the current.

## Shared (`packages/shared/src/task.ts`)

- `TaskCadenceSchema = z.enum(['once','weekly','monthly'])`, `TaskCadence` type.
- `TASK_CADENCE_LABELS` for UI.
- `nextRecurrenceDueAt(dueAt: Date, cadence, now): Date` — pure, the anchored-advance helper.
- Add `cadence: TaskCadenceSchema` to `TaskSchema` and `cadence: TaskCadenceSchema.optional()`
  (default `once`) to `CreateTaskInputSchema`.

## API (`apps/api/src/tasks`)

- `create`: persist `cadence` (default `once`).
- `complete`: after the completion update, if `kind === routine && cadence !== once`,
  create the next occurrence as above, inside the transaction.
- `smart-rotation.pickAssignee`: extend `options` with `excludeReason` so the rotation
  explanation reads correctly ("they just completed this recurring chore") instead of the
  away-member copy.
- Serialise `cadence` in the task DTO.

## Web (`apps/web`)

- `AddChoreForm`: a cadence selector (One-off / Weekly / Monthly) beside the due date. The
  due date is the first occurrence.
- `TaskCard`: a small "Weekly"/"Monthly" tag so users see a chore recurs.

## Tests (TDD)

- shared: `nextRecurrenceDueAt` — weekly/monthly advance; early completion keeps the grid;
  late completion advances past `now`; monthly handles month-length differences.
- api rotation: next occurrence excludes the completer; reason copy is correct.
- api complete: completing a weekly task creates one pending next task with the anchored due
  date and a different assignee; completing a `once` task creates none; reactive never recurs.

## Rollout

Additive migration with a default; `prisma migrate deploy` applies it on the next API
deploy. No backfill needed.
