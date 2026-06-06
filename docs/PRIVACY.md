# The Privacy Line

The boundary between what tenants see and what a landlord sees. This is both a product principle (`PRODUCT.md` principle 7: "the landlord view is a different product… no judgement of individual roommates") and a legal posture (GDPR data minimization, EU housing-privacy norms). It is also a jury trap: a tech-savvy panel will attack any landlord view that exposes individual tenant fault.

## The rule

A landlord manages **property health**, not **people**. The portal may show aggregated, operational telemetry about a household. It must never let a landlord infer *which named tenant* did or didn't do something.

```
┌───────────────────────────┬────────────────────────────┐
│  TENANT DASHBOARD          │  LANDLORD PORTAL           │
│  • Named chores & flags    │  • Property health score   │
│  • Who completed what      │  • Churn risk + factors    │
│  • Personal rituals        │  • Aggregate overdue count │
│  • Pulse Orb diagnostics   │  • Member count (number)   │
│                            │  • Structural maintenance  │
│  ───────────────────────── │  ───────────────────────── │
│  Sees individuals          │  Sees the household only   │
└───────────────────────────┴────────────────────────────┘
```

## What a landlord MAY see
- Household name and property link date.
- Harmony / health score (the aggregate 0–100 number).
- Churn-risk level (low/medium/high) and its **non-personal** factors ("harmony below 65", "5+ overdue tasks").
- Counts: total members, active vs inactive members, overdue task count.
- Structural / maintenance requests the household chooses to raise to the landlord.

## What a landlord MUST NOT see
- Tenant names tied to any metric.
- Who is assigned a chore; who completed or missed one.
- A "low contributor" ranking of named people.
- Who flagged a mess (flagger identity) or mess-flag titles.
- Photos, chat, ritual participation, or any per-person history.
- **Shared money** — bills, splits, who owes whom, balances, receipt or proof-of-payment images. Cost sharing is entirely tenant-only; there is no expense route under `/properties/:id`, in any landlord mode.

## Current state — COMPLIANT (implemented)

`apps/api/src/landlord/landlord.service.ts` is aggregate-only:
- `getPropertyInsights`: no names. `overdueTasks` carry title + age only; `contributionBalance` is a nameless `{ spread: even|uneven, activeContributors, totalMembers }`; mess flags collapse to `recentMessFlagCount`.
- `getPropertyDetail`: `memberCount` / `activeCount` / `inactiveCount`, no member names.
- Shared types `PropertyInsights` / `PropertyDetail` enforce the shape; service tests assert `JSON.stringify(result)` contains no tenant name.

## Consent gating (implemented)

Sharing is **off by default and tenant-revocable**, answering the survey's "only if I can turn it off" segment.
- `LandlordProperty.consentGranted` (default `false`) gates **all** landlord read endpoints — no consent → the property is invisible (not listed; 404 on detail/insights).
- A household admin sets consent + `mode` via `PATCH /h/:id/landlord/:landlordUserId`; tenants control it from the House page.
- `mode` (`observer` | `caretaker`) describes involvement; Caretaker's common-area / maintenance behavior is Phase 2 (`docs/ROADMAP.md`).

## Maintenance requests (landlord-visible, still anonymized)

Maintenance requests (boiler, mold, pests, noise) are the one thing tenants *want* the landlord to see — they are about the property, not about people. They cross to the landlord **consent-gated** and **without reporter identity**: the landlord endpoint returns title, category, status, and dates only — never who raised it (`getPropertyMaintenance`). This stays inside the Privacy Line: the landlord learns the building has a damp problem, not which tenant reported it.

## UI signal
The landlord portal shows a **"Privacy protected"** badge (property detail page); the House page shows the live sharing state and toggle to tenants.

## Why this matters for the defense
Fixing this turns a liability into a selling point: "our landlord product is privacy-by-design — the schema cannot leak a tenant's name to a landlord, by construction." That is a stronger story than any feature.
