# Behavioral Design Rationale

Why HOOMA is built the way it is, mapped to the behavioral-design literature. This is the document to defend in front of the jury: it connects each visible feature to a named theory and to the code that implements it.

Frameworks: Emotional Design (Norman), Calm Technology (Weiser & Brown), Fogg Behavior Model (Fogg), Equity Theory (Adams), Interaction Ritual Chains (Collins).

---

## 1. Emotional Design — Norman's three levels

Norman splits emotional response into **visceral** (gut, pre-conscious), **behavioral** (use, function), and **reflective** (meaning, self-image).

| Level | HOOMA expression | Code |
|---|---|---|
| Visceral | The Energy Core: a living 3D object that breathes, pulses, and turns turbulent. Warm cream canvas relaxes the eye and signals *home*, not *workplace*. | `components/energy-core.tsx`, `globals.css` |
| Behavioral | Two-second daily answer: your chore, the house state, the most urgent thing — no drilling. | `today/page.tsx`, `PRODUCT.md` principle 2 |
| Reflective | "I live in a fair house." Smart Rotation transparency lets a user believe the system is even-handed, which is the feeling they take away. | `rotationReason`, `smart-rotation.service.ts` |

**Defense line:** we design for the reflective level deliberately — the product's job is not to track chores, it is to let roommates *feel* the home is fair and cared-for.

## 2. Calm Technology — Weiser & Brown

Calm tech lives in the **periphery** and moves to the center only when it must. It informs without demanding.

- **Ambient over alarm.** Household state is read from the orb's color, pulse, and turbulence — not from red-dot badges or alert dialogs. There are no unread-count badges in the app.
- **Legible, not just ambient.** Early feedback showed the orb alone was not self-explanatory — people saw a glowing shape without reading it as their house's state. A calm readout under the orb names it ("&lt;House&gt;'s mood") and turns its color into one plain, blame-free sentence tied to a cause ("2 chores need a hand. Sorting them brightens the orb."). This is comprehension, not alarm: no badge, no count, no red dot — it teaches the ambient signal so people can act on it. `components/feature/harmony-summary.tsx`, copy in `lib/copy.ts`.
- **Decay, not crash.** Harmony drifts toward a floor of 50 when the house goes quiet; it never plunges to zero or throws a shame banner. `harmony-decay.cron.ts` (`HARMONY_OVERDUE_PENALTY`, daily decay floor 50).
- **Calm landlord register.** The landlord view is the same data with the emotional register removed — no harmony scoring, no judgement (`PRODUCT.md` principle 7). The Privacy Line enforces this technically (`docs/PRIVACY.md`).

**Anti-pattern we avoid:** the "mute spiral" — co-living apps die when users mute nagging dish reminders. By pushing status to the periphery (orb) we remove the thing users mute.

## 3. Fogg Behavior Model — B = MAP (Motivation, Ability, Prompt)

Behavior happens when motivation, ability, and a prompt converge.

| FBM factor | HOOMA design | Code |
|---|---|---|
| Motivation | Collective dopamine: completing a chore visibly improves the shared orb; a Bloom is rare and earned. | bloom on completion, `ritual.ts computeRitualBonus` |
| Ability | Reactive flagging is one tap + one photo; heavy chores prompt the photo at the moment of completion, not as a separate task. | `flag-mess-form.tsx`, `tasks.service.ts requiresPhotoEvidence` |
| Prompt | The flag is a hot prompt thrown at the right person via Smart Rotation; the orb is an ambient prompt checked on launch. | `flagMess()`, `EnergyCore` on Today |

**Reactive flagging is a Fogg prompt, not a complaint.** The re-framing (see §Equity) keeps the prompt constructive so it triggers action instead of resentment.

## 4. Equity Theory — Adams

People compare their input/output ratio to others'. Perceived inequity breeds resentment; a *black-box* allocator is read as unfair even when it is fair.

- **Transparency is the mechanism.** Every assignment carries a plain-language reason ("lowest 30-day contribution score", "longest without completing", "skipped — completed this heavy chore most recently"). `smart-rotation.service.ts` (`selectAssignee` tie-break chain).
- **In-flight load counts.** The fairness score includes work already on your plate, not just completed work, so the system cannot dump ten tasks on the same person — which would itself read as inequity. `buildCandidates` (open + completed).
- **No public fault ranking.** Equity is restored *within* the household, never by exposing a "who slacks" leaderboard to the landlord (Privacy Line).

## 5. Interaction Ritual Chains — Collins

Collins: repeated shared rituals build "emotional energy" and group solidarity.

- **Rituals are first-class.** Meals, check-ins, challenges with a cadence (once/daily/weekly) and a participation-driven harmony bonus. `rituals.service.ts`, `RitualCadence` enum.
- **Solidarity threshold.** When ≥60% of the household joins a ritual, the house *Blooms* — a collective high, not an individual reward. `rituals.service.ts` completion flow, `lastBloomedAt`.
- **The orb is the shared symbol.** Collins' rituals need a common focus object; the Energy Core is that object — everyone looks at the same living thing.

---

## How the theories compose

```
Reactive mess (Fogg prompt)
   -> soft orb turbulence, no alarm        (Calm Tech)
   -> fair assignment + plain reason       (Equity Theory)
   -> completion blooms the shared orb      (Norman visceral + Collins solidarity)
   -> "the house breathes a sigh of relief" (Norman reflective)
```

The chain is the product. Each link is a deliberate theoretical choice, and each maps to a file in this repo.

## Open gaps against the theory (tracked in `docs/AUDIT-RESPONSE.md`)
- Calm-tech digest ("Evening Huddle") not built — currently ambient-only (C2).
- Energy bloom does not yet *visually* travel from the card to the orb (A4) — weakens the Norman/Collins payoff.
- Supportive micro-copy not applied everywhere (A1) — undercuts the Equity re-framing on routine tasks.
