# Audit Response — UI/UX, Behavioral & PropTech

Source: external "Plumbing vs. Soul" audit (2026-05, Kickstarter Test framing).
Purpose: map every audit point to the current implementation, mark covered / partial / gap, and turn gaps into a prioritized action list for the June 9 defense.

Status legend: **DONE** (shipped, defensible) · **PARTIAL** (exists, needs work) · **GAP** (not built) · **DEVIATION** (we intentionally differ from the audit, with rationale).

Brand note: the product ships as **HOOMA**; this repo is still named HomeBuddy. Treat the names as the same product.

---

## 1. Visual consistency & branding

| Audit point | Status | Where / why |
|---|---|---|
| Warm cream canvas, not sterile white | **DONE** | `--color-cream #fbf7f0`, `apps/web/src/app/globals.css`. Documented in `DESIGN.md`. |
| Amber = action, sage = completion | **DEVIATION** | We restrict amber/red/orange to Harmony **mood** and chore **weight** only; sage is the sole chrome accent (`DESIGN.md` §Color). Defensible: a single accent reads calmer than amber-everywhere. Document this as a deliberate calm-tech choice, do not "fix" it. |
| Generous radii 16–24px | **PARTIAL** | Cards mix `rounded-lg` (8px), `rounded-xl` (12px), `rounded-2xl` (16px). Bump cards/containers to a consistent 16–24px. → A2 |
| Elastic / bouncy easing `cubic-bezier(0.34,1.56,0.64,1)` | **GAP** | Only `ease-out` width transitions today; no spring, no framer-motion (`DESIGN.md` §Motion). → A3 |
| Orb is the center of gravity on the Today view | **DONE** | `EnergyCore` renders top of `apps/web/src/app/(app)/h/[householdId]/today/page.tsx`. Matches `PRODUCT.md` principle 1. |
| Orb externalizes "vibe" via color/pulse/turbulence, not guilt text | **DONE** | `components/energy-core.tsx`: shader noise/turbulence, bloom on completion, shock on heavy-overdue. |

## 2. Behavioral UX (Fogg, Equity Theory, Calm Tech)

| Audit point | Status | Where / why |
|---|---|---|
| No nagging red-dot badges; lean on ambient orb state | **DONE** | No unread-count badges in UI. Overdue is a soft tag (red wash + icon + label), not an alarm. Harmony decays toward 50, never crashes (`harmony-decay.cron.ts`). |
| Overdue = orb turbulence, not "turn red" | **DONE** | Continuous `harmonyScore` 0–100 on `Household`; heavy-overdue triggers orb shock/turbulence, not a discrete red state. |
| Daily digest ("Evening Huddle") instead of high-frequency alerts | **GAP** | `notifications.service.ts` is a logger stub, per-event, no `Notification` model, no digest. Note: calm-tech argues *against* push, so this is low priority and partly satisfied by the ambient orb. → C2 |
| Smart Rotation fully transparent (Equity Theory) | **DONE** | `rotationReason` stored per task and returned to client; human-readable ("Bob has the lowest 30-day contribution score…"). See `docs/SMART-ROTATION.md` once written. Score now also counts in-flight load (anti pile-up). |
| Photo as constructive "contextual bookmark", supportive pre-written micro-copy | **PARTIAL** | Flagger note exists (`MessFlag.title`), camera capture exists; **no** pre-written supportive prompts, **no** sticker/doodle overlay. → B1, B2 |
| Energy Bloom radiates from the task card into the orb | **PARTIAL** | Orb blooms on completion; the *visual link* from the completed card to the orb is not drawn. Bloom banner copy is warm. → A4 |
| Relational completion copy ("the house breathes…") not "Task Completed!" | **PARTIAL** | Bloom banner is relational; routine completion still says "Done". Tone rules already in `PRODUCT.md` — apply them everywhere. → A1 |

## 3. Landlord portal (B2B2C)

| Audit point | Status | Where / why |
|---|---|---|
| **Privacy Line: landlord must not see individual fault metrics** | **GAP — CRITICAL** | `landlord.service.ts getPropertyInsights` returns `overdueTasks[].assigneeName`, `lowContributors[].name`, `recentMessFlags[].flaggerName`; `getPropertyDetail` returns member names tied to status. This exposes who-slacks to the landlord — violates the audit Privacy Line **and our own `PRODUCT.md` principle 7**. → **P0 / A0** |
| "Privacy Protected / Anonymized" badge in the portal UI | **GAP** | Not present. Add once the API is anonymized. → A5 |
| Churn-risk indicator | **DONE** | `computeChurnRisk` + `explainChurnRisk` (level + factors), returned on all three landlord endpoints. |
| Churn risk tied to an actionable lever (perk offer) | **GAP** | No intervention action. Kickstarter upgrade, optional. → D1 |
| ROI / cost-saving dashboard | **GAP** | Absent. Kickstarter upgrade, optional. → D2 |

## 4. Technical, accessibility & performance

| Audit point | Status | Where / why |
|---|---|---|
| WCAG AA body-text contrast on cream | **DONE** | Ink `#1f1a14` on cream `#fbf7f0` ≈ 15:1. Mood tints used only for state, always paired with icon + text. |
| State never conveyed by color alone | **DONE** | Overdue/Done/weight all use color **+** Phosphor icon **+** text label (`DESIGN.md` §Iconography, `task-card.tsx`). |
| Skip-to-content link, heading hierarchy | **PARTIAL** | No skip link; heading order uneven on some pages. → A6 (minor) |
| PWA: manifest + service worker + aggressive caching of WebGL assets | **GAP** | No `manifest.json`, no service worker. → D3 |
| Offline photo + completion queue via IndexedDB, sync on reconnect | **GAP** | Not built. Highest-effort item; scope carefully before the defense. → D4 |

## 5. Strategic — jury traps & upgrades

**Jury traps**
1. "Ghost Town" Orb (orb feels cosmetic) — **MITIGATED**: orb reacts to completion/overdue. Action: rehearse a demo seed that produces a dramatic, immediate transition on stage. → A7
2. "Nagger" Simulator (kanban + red alarms) — **MITIGATED**: no kanban, soft atmospheric states, harmony decays not crashes.
3. Landlord Overreach — **ACTIVE TRAP**: see P0 above. This is the one that can actually sink the grade.

**Kickstarter upgrades (all optional, post-P0):** haptic resonance (GAP, D5), micro-copy tone toggle / empathetic phrasing engine (GAP, A1 covers the static version), ROI dashboard (GAP, D2).

**Extra features named in the brief**
- Shared supplies "Holy Trinity" tracker (toilet paper / soap / trash bags) with low-stock → auto-assign purchase to lowest contributor — **GAP**, new feature, backend + frontend. → C1

---

## Prioritized action list

IDs are referenced from the tables above. P0 first — it is correctness/ethics and currently live.

### P0 — fix before anything else (ethics + GDPR, low risk)
- **A0** Anonymize the landlord portal. Remove tenant names from `getPropertyInsights` (overdue assignee, low-contributor ranking, mess-flag flagger) and reduce `getPropertyDetail` to aggregate counts (e.g. "members: 4", active/inactive counts) — no per-person fault linkage. Update `PropertyInsights` / `PropertyDetail` shared types and tests. See `docs/PRIVACY.md`.

### P1 — high audit value, low/medium risk (defense polish)
- **A1** Supportive micro-copy pass: replace bare "Overdue"/"Failed"/"Done" with relational copy per `PRODUCT.md` tone. Centralize strings.
- **A2** Normalize card radii to 16–24px.
- **A3** Add a spring easing token `cubic-bezier(0.34,1.56,0.64,1)` and apply to hover/focus/state transitions.
- **A4** Draw the completion → orb link (energy bloom radiates from the completed card toward the orb).
- **A5** "Privacy Protected · Anonymized" badge in the landlord portal (after A0).
- **A6** Skip-to-content link + heading-order audit.
- **A7** Demo seed that yields a dramatic on-stage orb transition.

### P2 — features (medium effort)
- **B1** Pre-written supportive micro-copy prompts on the flag-mess flow.
- **B2** Sticker / doodle overlay on flag photos.
- **C1** Shared supplies tracker ("Holy Trinity") with low-stock → auto-assign via Smart Rotation.
- **C2** Daily digest ("Evening Huddle") — only if a `Notification` model is introduced; otherwise stays ambient.

### P3 — Kickstarter-grade (high effort, optional for the thesis)
- **D1** Churn-risk actionable lever (landlord perk offer).
- **D2** Landlord ROI / cost-saving dashboard.
- **D3** PWA shell: manifest + service worker + cache WebGL assets.
- **D4** Offline queue (IndexedDB) for photo + completion, sync on reconnect.
- **D5** Haptic resonance on ritual/shared completion (mobile PWA).

---

## Cross-references
- `docs/PRIVACY.md` — the Privacy Line and landlord data boundary (new).
- `docs/design/behavioral-rationale.md` — theory → feature mapping for the defense (new).
- `docs/SMART-ROTATION.md` — product-facing rotation explanation (to write).
- `DESIGN.md`, `PRODUCT.md` — existing design language and product vision.
