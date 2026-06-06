# Survey Findings — "Shared Living, 90-second survey"

Source: `Shared Living — 90-second survey.csv` (38 responses, 2026-05-20 → 05-22). Raw data is **not** committed (contains emails/Insta handles → PII). This document is the analysis of record.

Primary purpose of this pass: **decide how to position the landlord role.** General findings follow.

---

## Who answered (Q1)
- **Student kot (private room, shared kitchen): ~26 / 38 (≈68%)** — the dominant persona.
- Shared flat/house: ~5 · Studio/live alone: ~5 · Major residence (Upkot/Xior/Quares): ~3 · With family: ~2.

Implication: the core user is a **Belgian student in a kot with a shared kitchen**. The shared kitchen is the battleground (see Q4/free-text). Design for that case first.

---

## The landlord question (Q10 + Q11 + free text) — the headline

**Q10 — "Your landlord sees only a single harmony score (no names, no messages, no chores). Would you be OK with it?"** (n=38)

| Answer | Count | Share |
|---|---|---|
| Yes — proves we're good tenants | 12 | 32% |
| Only if I can turn it off | 10 | 26% |
| My landlord is hands-off / doesn't matter | 11 | 29% |
| No — that's surveillance | 5 | 13% |

**Q11 — how they actually contact the landlord:** WhatsApp ≈22, Email ≈7, **online portal ≈5**, never contact 3, in-person 1.

**Free-text on landlords:** two distinct realities —
- *Passive/absent:* "Landlord is passive, noise complaints"; repeated "hands-off".
- *Active/maintaining:* "I clean the whole kot every Friday — arrangement with my kotbaas" (landlord-delegated common-area cleaning). And the things tenants *want* a landlord for: **boiler, mold, mice, noise** — structural maintenance, not chore monitoring.

### What this means
1. **The landlord is optional.** For ~42% (hands-off 29% + surveillance 13%) a landlord presence is irrelevant or unwanted. Linking a landlord must never be required, and must default to off.
2. **Consent must be tenant-controlled.** 26% will accept it *only if they can turn it off*. A visible tenant toggle to start/stop sharing house health is non-negotiable.
3. **The portal is the wrong center of gravity.** Almost nobody contacts a landlord through a portal; they use WhatsApp/email. Do not invest more in a rich landlord dashboard for the thesis.
4. **The real landlord value is maintenance, not surveillance.** Tenants resent passive landlords who don't fix the boiler/mold/mice. The defensible landlord feature is **receiving structural/maintenance signals** and (where the kotbaas cleans) **owning common-area upkeep** — not watching tenants do dishes.

→ Full model in [Landlord positioning](#landlord-positioning-the-model).

---

## Chores & supplies (Q4–Q6)
- **Q4 tension from chores:** spread across "constant / multiple times / once-twice"; only a minority "never". Friction is real and recurring.
- **Kitchen is the #1 conflict.** Free-text "main issue" is dominated by: dirty kitchen, kitchen not cleaned after use, dishes, food in the sink, mold. This is the wedge.
- **Q5 supplies:** "We don't share supplies" is the **most common** answer (~14) — kot residents have private rooms and often don't pool toilet paper/soap. "Always the same person notices" ≈9 (the supply martyr). "Rotates fairly" ≈9. "Nobody notices until a crisis" ≈2.
  - → The **shared-supplies tracker (C1) is validated but conditional.** Build it as an opt-in per household; do not assume supplies are shared.
- **Q6 when a chore is forgotten:** "Nothing — silent tension" and "I just do it myself" recur heavily → this is exactly the passive-aggression HOOMA exists to defuse. Strong validation of the product thesis.

## Group chat & mood (Q7–Q8)
- **Q7 muted the group chat:** many "Never", but a real chunk "Yes, often / Sometimes" → validates the calm-tech, *not-another-chat* stance. HOOMA must not become a notification machine.

## Algorithm interest (Q9)
- Mostly mid-to-high interest (3–5 on the scale, several 5s). The fair-rotation premise resonates. Pair with the transparency we already ship (`rotationReason`).

## Website feedback (last column)
- Positive tone: "Looks nice", "I love it!", "cute, easy, clear", "Looks good".
- Two actionable notes:
  - **"I'm not really sure what the difference between tasks and rituals are."** → clarity gap; label/onboarding fix.
  - **"For bigger residences not ideal, good for small co-housing."** → position for small kots/co-housing, not 50-room residences.

---

## Landlord positioning — the model

Replace the single "landlord" with an **optional, tenant-consented relationship that has a mode.** Stored per household; default is no landlord at all.

| Mode | Who it's for (survey) | What the landlord sees / does | Tenant control |
|---|---|---|---|
| **None** (default) | Shared flats, studios, the 42% hands-off/surveillance camp | Nothing. No portal, no link. | n/a — must be the default |
| **Observer** | The 32% "yes" + 26% "only if I can turn it off" | Aggregate health score + churn risk only (already anonymized, `docs/PRIVACY.md`). **No maintenance duties.** | Tenants opt in; a visible toggle stops sharing at any time |
| **Caretaker** | Kots where the kotbaas cleans common areas; tenants wanting maintenance handled | Common-area zones/tasks marked landlord-owned are **excluded from tenant Smart Rotation**; landlord receives **structural/maintenance requests** (boiler, mold, mice, noise). Optionally marks their own tasks done. | Tenants see which zones the landlord owns; still control health-sharing separately |

Design rules:
- Linking a landlord is never required and defaults to **None**.
- **Consent is explicit and revocable** — a tenant-facing toggle "Share house health with our landlord", off until enabled. This directly answers the 26% "only if I can turn it off".
- **Caretaker zones are excluded from rotation** so the fairness algorithm never assigns a tenant a chore the landlord/cleaner handles. Reuse the existing `excludeUserId` / zone concept in Smart Rotation.
- **Flip the value proposition:** the landlord's reason to exist in HOOMA is *maintenance and upkeep*, not surveillance. Lead the landlord story with structural requests, not a who-slacks dashboard (which we already removed).

### Defense narrative
"Our survey showed landlords range from absent to actively cleaning, and most tenants are indifferent or wary of being watched. So we made the landlord **optional, consent-based, and reframed it from surveillance to maintenance** — a hands-off landlord simply isn't linked, while a caretaker kotbaas owns the common areas and receives repair signals. Privacy-by-design (no tenant name can reach a landlord) plus consent-by-default."

---

## How this re-ranks the backlog (see `docs/ROADMAP.md`)
- **NEW — Landlord modes + consent toggle** (None/Observer/Caretaker). Promote to a near-term item; it is the survey's clearest product signal and a strong defense story. Observer is mostly built; add consent toggle + mode field; Caretaker zones are the new work.
- **C1 supplies tracker** → keep, but make it **opt-in per household** (most kots don't share supplies).
- **Kitchen-first framing** → ensure the demo and copy center the shared kitchen (the #1 friction).
- **Tasks vs Rituals clarity** (A1-adjacent) → add a one-line explanation / onboarding; users conflate them.
- **Do NOT expand the landlord dashboard** (portal is a near-unused channel) beyond the modes above.
