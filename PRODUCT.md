# HomeBuddy

## Product Purpose

HomeBuddy is a roommate / household coordination app. It replaces the unspoken score-keeping that lives inside a shared apartment (who cleaned last, who's slacking, who's the only person buying toilet paper) with a calm, visible system. Tasks rotate fairly, chores can be flagged with photo evidence, and the household has a single emotional readout — a Harmony Score from 0 to 100 — that tells you whether the home is healthy without having to read every notification.

A 3D Energy Core sits at the centre of the experience: a living object that breathes when the home is harmonised and shudders when chores rot. The Core is the product, not chrome around it.

## Register

product

The app surfaces (dashboard, tasks, rituals, household, landlord portal) are tools the user lives inside daily. Design serves clarity and flow. The landing / login pages are the only brand surfaces — short, warm, on-tone, but still product-led.

## Users

**Primary — Catja, roommate (20–28).** Sharing a flat in a European university town. Doesn't want roommate drama. Wants the app to mediate so she doesn't have to. Mobile-first usage, often one-handed, often distracted. Will not read a tooltip. Speaks English as a second language — copy must be plain.

**Secondary — the housemate.** Same person, different role of the week. Sometimes the one flagging a mess, sometimes the one being nudged.

**Tertiary — landlord.** Sees a calm operator view of the properties they manage. Read-mostly, no notifications, no judgement of individual roommates.

## Tone

- Warm, plain, never childish.
- Speaks like a calm flatmate, not a productivity coach.
- Encourages without nagging. The app's job is to lower friction in a shared home, not to gamify cleaning.
- No exclamation marks unless something genuinely good happened (a Bloom).
- No "Awesome!" / "Great job!" — say what happened instead ("Kitchen logged. Harmony +3").

## Anti-references

- **Notion / Linear** — too cold, too dense, too "operator". This is not a productivity tool for power users.
- **Habitica / Duolingo** — gamification with cartoon mascots, streaks, XP, badges. HomeBuddy uses one signal (Harmony) intentionally.
- **Trello / Asana** — kanban boards for tasks. Wrong mental model: a home is not a sprint.
- **Apple Reminders / iOS default lists** — flat checklist with no sense of household or shared accountability.
- **SaaS dashboards** — KPI tiles, sparklines, hero metrics with up-arrow gradients. The Harmony Score is the only number worth showing big.

## Strategic principles

1. **The Energy Core is the homepage.** Whatever else is on screen, the Core's state is the first thing the user understands. Everything else is in service of it.
2. **One screen tells you what to do next.** A roommate opening the app should see, in 2 seconds: their own assigned chore, the household's state, and the most urgent thing happening. No drilling required for the daily case.
3. **Multi-page for breadth, single-glance for daily use.** Splitting features into pages (Today, Tasks, Rituals, House, You) reduces noise on the home screen, but the home screen still answers "what should I do?" without navigation.
4. **Photo evidence is a feature, not a chore.** Flagging a mess and proving completion are first-class actions, not buried in a menu.
5. **Harmony decays, doesn't crash.** The system never punishes (no red banners, no shame). It dims, it shudders, it asks softly.
6. **Mobile-first, but the desktop view is not a stretched phone.** On wide screens, the Core gets room to breathe and ambient context (household feed, harmony trend) shows alongside it.
7. **The landlord view is a different product.** Same data, different emotional register: calm, factual, no harmony scoring.

## Domain vocabulary

- **Household** — the shared flat. Has members, tasks, rituals, a Harmony Score.
- **Chore / Task** — a unit of work. Weight is `light` or `heavy`. Kind is `routine` (recurring) or `reactive` (flagged from a mess).
- **Flag a mess** — anyone can mark something dirty in shared space; this becomes a reactive task and someone gets assigned it.
- **Ritual** — slower household work: a shared meal, a check-in, a challenge. Builds harmony over time.
- **Bloom** — moment when the Energy Core blooms because Harmony hit a new high. Rare, deserved.
- **Smart Rotation** — the assignment engine. Picks who does what so the load stays fair.

## Scope this round

A bachelor thesis project at KDG, Antwerpen. Graded on craft, defended in front of a jury. UI quality matters more than usual. No throwaway code, no SaaS template aesthetic.
