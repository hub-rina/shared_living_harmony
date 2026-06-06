# HomeBuddy — Design Language

Extracted from current `globals.css` and dashboard usage. Conservative snapshot; the audit and follow-up commands evolve it.

## Color

Strategy: **Restrained, warm-neutral with a single sage accent.** Cream + ink for surfaces and text; sage carries the brand. Mood-tints (amber, red, orange) used only for Harmony state and chore weight — never decorative.

| Role | Light | Dark |
|---|---|---|
| Surface (page) | `--color-cream` `#fbf7f0` | `--color-cocoa` `#1a140f` |
| Surface (raised) | `--color-cream-shade` `#f4ecdc` | `--color-cocoa-shade` `#2a211b` |
| Surface (deep) | `--color-cream-deep` `#e8dcc2` | `--color-cocoa-deep` `#3b312a` |
| Text (primary) | `--color-ink` `#1f1a14` | `--color-cream-shade` |
| Text (muted) | `--color-ink-mute` `#635b53` | `cream-shade/65` |
| Text (soft) | `--color-ink-soft` `#8e867d` | `cream-shade/50` |
| Accent (primary) | `--color-sage-700` `#4d6e51` | `--color-sage-500` `#6f9072` |
| Accent (hover/wash) | `--color-sage-50/100/300` | `sage-900/40` |

**Mood tints (Harmony Score only):**

- Tense → red-500, Unstable → orange-500, Calm → amber-500, Stable → sage-500, Harmonized → sage-700.

**Rules:**
- Never `#000` or `#fff`. The ink/cream tokens already encode the warm tint.
- Sage is the only chromatic accent in product chrome. Amber/red/orange appear only as mood/weight indicators.
- Dark mode is `prefers-color-scheme` driven; no manual toggle yet.

## Typography

- **Family:** Nunito (Google Fonts, weights 400/500/600/700/800). Friendly sans-serif, slightly rounded — fits the warmth of the cream palette without being childish.
- **Scale (current usage):**
  - Display / H1: `text-2xl` semibold (dashboard greeting).
  - Section heading: `text-xs uppercase tracking-widest font-semibold` — small caps eyebrow style.
  - Big numeric (Harmony Score): `text-5xl font-bold tabular-nums`.
  - Body: default Tailwind base, weight 400–500.
  - Caption / meta: `text-xs`, muted token.
- **Line length:** not currently capped — fix in audit.

## Spacing & rhythm

- Tailwind 4 spacing scale, no custom tokens.
- Common: `gap-2` inside cards, `gap-3` between rows, `gap-8` between sections, `p-4 sm:p-5` for zone sections, `px-4 py-3` for task cards.
- Radii: `rounded-lg` (cards, buttons), `rounded-xl` (Harmony card), `rounded-2xl` (zone sections), `rounded-full` (pills, accent dots).

## Components (current, ad-hoc)

- **HarmonyCard** — large numeric + mood label + progress bar. Mood-tinted background. Single instance per household.
- **EnergyCore** — react-three-fiber 3D object. The brand centre. Currently inlined in the dashboard; should remain top-of-page on the daily view.
- **ZoneSection** — labelled grouping with a small accent dot. Two tints used today: amber ("Right now") and sage ("Build the house"). Good pattern, worth keeping.
- **TaskCard** — title + weight badge + status badge + assignee + due date + optional before/after photos + complete/remove actions. The work-horse component.
- **Badge** — full-rounded pill, small caps style by token (status, weight, reactive).
- **FlagMessForm / AddChoreForm / RitualsPanel** — inline forms inside zone sections.

## Motion

- Harmony bar width animates `transition-all duration-700`.
- EnergyCore has its own three.js animation loop (Bloom pulse, idle breathing, shudder for overdue heavy chores).
- No other motion currently. Audit will recommend specific places to add purposeful motion.

## Iconography

- **Library:** Phosphor Icons (`@phosphor-icons/react`, MIT). Warm rounded strokes match Nunito.
- **Weight rules:** `regular` for inactive nav, `duotone` for active nav and section accents, `bold` for inside buttons, `fill` for inline status pips.
- **Sizes:** 11–14 px inside tags / small chips, 16 px inside buttons, 22 px in nav, 28 px as section accents.
- **No icon-only buttons.** Every icon ships beside a label or has `aria-label` on its parent control.
- **No emoji.** Phosphor + currentColor only.

## Illustrations

- **Library:** unDraw (`undraw.co`), MIT-licensed, by Katerina Limpitsouni. Bundled SVGs live in `apps/web/public/illustrations/`.
- **Color:** unDraw's `#6c63ff` primary is replaced with sage `#4d6e51` (var equivalent `--color-sage-700`) at bundle time, so every scene reads on-brand on cream and on cocoa.
- **Component:** `<Undraw scene="..." />` in `components/illustration/illustration.tsx`. Renders a lazy-loaded `<img>` with sensible default alt text.
- **Named scenes** (semantic aliases over `Undraw`):
  - `PeepChilling` (`relaxing-at-home`) — Today empty, "You are clear".
  - `BroomAtRest` (`checklist`) — Tasks empty, open list cleared.
  - `PaperPlane` (`home-run`) — Tasks empty, "Done" filter with nothing finished yet.
  - `TableForTwo` (`eating-together`) — Rituals empty.
  - `LittleHouse` (`house-searching`) — no household / no home created.
  - `FlaggedDone` (`checklist`) — completion confirmations.
- **Where they appear:**
  - Inside every `<EmptyState art={...}/>` as a centered scene.
  - As **backdrops** inside Card via `<Card backdrop="..." backdropAnchor="right|right-bottom|top-right" backdropOpacity={0.18} />`. The illustration sits absolutely-positioned, decorative, `aria-hidden`, behind content. Use it on hero sections of pages (Flag mess, Add chore, Propose ritual, Current home, Add new home, Profile). Cards that are pure forms without a "topic" should not have a backdrop.
- **Anchors:** `right` (vertically centered, large), `right-bottom` (anchored to the corner), `top-right` (small, head-level). Use small + lower opacity (~0.14) when content is form-dense; larger + 0.18 when content is short.
- **License + attribution:** unDraw illustrations are free for personal and commercial use, no attribution required. We credit voluntarily here.

## Hard rules for this project

- No emojis or icons in UI unless explicitly added with reason.
- No glassmorphism, no gradient text, no side-stripe borders, no hero-metric template.
- The Harmony Score is the **only** big-number metric in the app.
- Dark mode must be visually equivalent in clarity, not just "the same screen but darker".
- Mobile-first. Touch targets ≥ 44px. Bottom-of-thumb actions on phones.
