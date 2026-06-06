# Roadmap — Road to the June 9 Defense

Living plan. Tracks what is done, what is next, and the open inputs still to analyze. Action IDs (A0, A1, …) reference `docs/AUDIT-RESPONSE.md`.

Defense date: **2026-06-09**.

## Done
- **P0 — Landlord portal anonymized** (A0). Insights/detail are aggregate-only; no tenant name can reach a landlord by construction. Privacy badge in the portal. Committed `feat(landlord): anonymize portal insights to aggregate-only`. See `docs/PRIVACY.md`.
- **Smart Rotation fairness fix** — score now counts in-flight (open) load, not just completed work, so tasks no longer pile on one person. 100% test coverage on the rotation service. Committed `fix(tasks): count in-flight load in smart rotation fairness score`.
- **Docs** — `AUDIT-RESPONSE.md` (master gap analysis), `design/behavioral-rationale.md` (theory→feature for the jury), `PRIVACY.md` (the Privacy Line).

## Analyzed inputs
- **Shared Living survey (38 responses)** — analyzed in `docs/research/survey-findings.md`. Headline: core persona is a Belgian student kot with a shared kitchen; the kitchen is the #1 friction; landlord acceptance is weak (only 32% unconditionally OK with an anonymous health score, 29% hands-off, 26% conditional on opt-out, 13% call it surveillance) and almost nobody contacts a landlord via a portal. Drove the **landlord model** below.

## Open inputs
- Any university interview notes (referenced in the audit, not yet provided).

## Landlord model — survey-driven
Replace the single landlord role with an **optional, tenant-consented relationship with a mode** (full table in `docs/research/survey-findings.md`):
- **None** (default) — no landlord linked; no portal. Most users.
- **Observer** — aggregate health + churn only (already anonymized); requires an explicit, revocable tenant toggle "Share house health with our landlord" (answers the 26% "only if I can turn it off").
- **Caretaker** — kotbaas/cleaner owns common-area zones (excluded from tenant Smart Rotation) and receives structural/maintenance requests (boiler, mold, mice, noise).

**Phase 1 — DONE.** `LandlordProperty.mode` + `consentGranted` (migration `20260529120000`). All landlord read endpoints gated on `consentGranted` (default off); admin sets mode + toggles consent via `PATCH /h/:id/landlord/:landlordUserId`; tenant consent toggle + mode picker on the House page; seed enables consent for the demo. Reframe applied. Did **not** expand the dashboard.

**Phase 2 — DONE (maintenance requests + zone-exclusion):**
- DONE: `MaintenanceRequest` model + tenant raise/list/status (boiler/mold/pests/noise) at `/h/:id/maintenance`; landlord sees them consent-gated and **without reporter identity** at `/properties/:id/maintenance`.
- DONE: Caretaker-owned common-area chores excluded from tenant Smart Rotation. `Task.caretakerOwned` flag (migration `20260529150000`); admin-only `POST /h/:id/tasks/caretaker` assigns the chore to the consented caretaker landlord; rotation fairness queries filter `caretakerOwned: false`; `taskPolicy` blocks complete/edit/reassign on these chores; tenants see them read-only ("looked after by your caretaker"). Requires a `caretaker`-mode landlord with consent (400 otherwise). Seeded in Sunset Kot. See `docs/ROLES.md` §3 footnotes 4–5.

## P1 (defense polish)
- **A1 — DONE.** Supportive micro-copy centralized in `apps/web/src/lib/copy.ts`: "Overdue" → "Needs a hand", "Done" → "Sorted", relational due line, and a chores-vs-rituals clarity line on the Chores page (survey users conflated the two).
- **A2 — DONE.** Card radii bumped to 24px (`rounded-3xl`).
- **A3 — DONE.** Spring easing token `--ease-spring` + button press scale.
- **A4 — DONE.** Completion → orb bloom link: a finished card emits its on-screen position (`lib/task-bloom.ts`), the Today page flies a `BloomSpark` of energy into the Energy Core, and the orb answers with a gentle `pulseCount` glow. Respects `prefers-reduced-motion` (instant pulse, no spark).
- **A6 — DONE** (skip-to-content link already in `app-shell.tsx`).
- **A7 — DONE.** "Bloom Stage" demo house (`…0004`, harmony 16 → Tense/red, a heavy overdue chore scarring the orb) with three chores assigned to alice and a ritual both members have already joined. On stage: complete the overdue chores to heal the orb (sparks fly in), then complete the ritual to trigger a full bloom.

## P2 — features (medium effort)
- **B1 — DONE.** One-tap supportive prompt chips on the flag-a-mess flow (`flagPrompts` in `lib/copy.ts`), framed as the space needing care rather than a person being at fault.
- **B2 — DONE.** Canvas doodle/sticker overlay on flag photos (`PhotoDoodleEditor`): freehand draw, three drawn stamps (heart/star/spark), four-colour palette, undo/clear. Opens after the photo is chosen; "Use this photo" exports the composited image as the flag's before photo. Tone-safe (drawn vector shapes, no emoji/mascots).
- **C1 — DONE.** Shared supplies tracker (`Supply` model, `/h/:id/supplies`). Marking a supply low opens a fairly-assigned "Buy …" task via Smart Rotation. Opt-in per household (empty until you add); House page UI + "add the basics" shortcut; demo seeded.
- **C2 — DONE (ambient).** "Evening Huddle" summary card on the Today page (`EveningHuddle`), computed on read from existing data: house mood, open/due-today chore counts, and whose turn it is. No `Notification` model, no push — deliberately ambient (survey shows weak appetite for nags).

## Cost sharing — DONE
Split what residents buy for the house. Spec: `docs/superpowers/specs/2026-06-06-cost-sharing-design.md`.
- **Receipt OCR, self-hosted.** Photo → Tesseract (`tesseract.js`, runs in the API, image never leaves our server) → heuristic parse into an **editable** draft. OCR is only ever a draft the resident corrects; failure degrades to manual entry. Free and open-source, strongest privacy story for the jury.
- **Whole-bill equal split.** The corrected total is split equally across the included sharers (the creator pays their own portion and owes nothing). Default included = **active** members; invited/away excluded by default, any member can be added by hand.
- **Two-sided settlement.** Per debtor share: the debtor marks "I paid" (optional proof photo), then the creator confirms "received". Both sides required — no one-click fakes. `ExpenseShareStatus`: open → paid → confirmed.
- **Per-person netting.** The Money page shows each person's net standing toward the viewer across all unsettled bills ("Bob owes you €12.25"). Single-payer bills make debts directional.
- **Money is its own zone.** No effect on the harmony score / Energy Core, and **never** crosses the Privacy Line into the landlord portal.
- **Image storage** behind an S3-compatible abstraction (`@aws-sdk/client-s3`): `local` disk driver for dev (served at `/api/uploads`), `s3` driver for prod (Cloudflare R2 or self-hosted MinIO). New env in `.env.example`; migration `20260606120000_add_expenses`. Seeded in Demo House (two bills mid-settlement; Charlie the invited member is excluded by the active-only default).

## P3 — Kickstarter-grade
- **D1 — DONE.** Churn-risk perk suggestion in the landlord portal (`RETENTION_PERK`).
- **D2 — DONE.** Landlord retention-ROI estimate (`estimateRetentionValue`, illustrative €/year protected).
- **D3 — DONE.** Service worker (`public/sw.js`) registered prod-only via `ServiceWorkerRegistrar`. Network-first for navigations (a fresh build's HTML always wins when online — no stale builds), cross-origin/API and non-GET never touched, cache-first only for content-hashed static, `/offline` fallback page, and a version kill-switch (bump `SW_VERSION` to wipe caches; `?nosw` unregisters everything). Prod-built and verified: `/sw.js`, `/offline`, manifest all serve 200.
- **D4 — DONE.** IndexedDB offline queue (`lib/offline-queue.ts`) for task completion + mess flags. `household-context` enqueues on offline or mid-flight network failure (optimistic local complete), replays oldest-first on the `online` event then refreshes. A `SyncIndicator` shows "Offline — N saved" / "Syncing…".
- **D5 — DONE.** Completion + bloom haptics (`lib/haptics.ts`).

## Remaining before the defense
- Nothing open from the audit backlog — A1/A4/A7, B1/B2, C1/C2, D1–D5, the landlord model (both phases), and caretaker zone-exclusion are all done.
- Pre-defense hygiene only: rehearse the Bloom Stage demo, smoke-test the live deploy after the next push, and re-read the thesis docs for the jury.
