# Coding Guidelines

Pragmatic rules for writing code that ships fast and stays maintainable. Not a religion. Use judgment.

Applies to: TypeScript (NestJS, React, Next.js, React Native).

> **For AI agents (Claude, Copilot, Cursor, etc.):** Read this file before writing or modifying code in this repo. Reference it from your `CLAUDE.md` / `AGENTS.md`. Treat these as defaults — follow existing patterns in the file you are editing if they conflict.

---

## 1. The Three Pillars

Every change should pass these three checks. If it fails one, rewrite.

1. **Consistency** — does it look like the rest of the codebase? Same naming, same structure, same patterns.
2. **DRY** — is this logic already written somewhere? Reuse before re-implementing.
3. **Readable** — would a new dev understand it in 30 seconds without asking?

Everything below serves these three.

---

## 2. Consistency

The single most important rule. **Match the surrounding code.**

- Open the file you are editing. Look at how things are named, structured, and ordered. Do the same.
- If the project uses `camelCase` for functions, do not introduce `snake_case`.
- If services live in `*.service.ts` next to controllers, do not invent a `services/` folder.
- If errors are thrown via a custom `AppError`, do not `throw new Error(...)`.
- New patterns are fine — but only when the existing one is genuinely unfit. Discuss in PR.

> Personal preference loses to project convention. Every time.

---

## 3. DRY — Use Helpers and Utils

Duplication is the silent killer of maintainability. But premature abstraction is worse.

### Rule of three

- **First time** writing a piece of logic: inline it.
- **Second time**: take note, maybe leave a comment.
- **Third time**: extract into a helper / util / shared module.

### Where things live in HomeBuddy

| Type | Location |
|---|---|
| Types / DTOs / zod schemas shared by api + web | `packages/shared/src/` |
| Pure utility (date format, currency, slug) | `packages/shared/src/utils/` or feature-local `helpers/` |
| Feature-specific helper used in 2+ files of that feature | `apps/<app>/src/<feature>/helpers/` |
| Shared business logic | a domain service / NestJS module |
| Shared React logic | custom hook in `apps/web/src/hooks/` |
| Magic numbers / strings used more than once | named `const` in `constants.ts` |

### Before writing a helper

1. **Search first.** `grep` the repo for the function name, the regex, the calculation. It probably exists.
2. If it exists but is in the wrong place, move it. Do not duplicate.
3. If it exists but is slightly different, ask: can I generalize the existing one? Usually yes.

---

## 4. Naming

- **Intent over mechanics.** `getActiveHouseholdMembers` beats `filterMembers`.
- **No `data`, `info`, `temp`, `obj`, `x`, `arr`, `result`** as variable names.
- **Booleans start with `is`, `has`, `can`, `should`.**
- **Functions are verbs.** Components / classes are nouns.
- **Avoid abbreviations** unless universally known (`id`, `url`, `db`, `api`).
- **Match existing vocabulary.** HomeBuddy uses `Household`, `Chore`, `Expense`, `ShoppingItem`. Stick to those.

---

## 5. Types — No `any`

`any` defeats the entire reason TypeScript exists. Treat it as a code smell.

- **Never `any` in new code.** Use `unknown` and narrow it.
- **Never `as` casting** to silence the compiler unless you can justify it in a comment.
- **Avoid `@ts-ignore` / `@ts-expect-error`.**
- **Type external boundaries explicitly** — API responses, env vars, third-party callbacks.
- **Validate input at boundaries with zod.** API DTOs and web forms both use schemas from `packages/shared`.
- **Use `satisfies`** to validate object shapes without widening types.

---

## 6. Functions

- **One thing, one function.** If the name needs `and`, split it.
- **Short.** If a function does not fit on a screen, it is doing too much.
- **Few parameters.** More than 3? Pass an object.
- **Pure when possible.** Side effects in one place, logic in another.
- **Early returns.** Flatten nesting. No `else` after `return`.

---

## 7. Files & Modules

- **One responsibility per file.** When a file grows past ~300 lines, ask if it should split.
- **Group by feature, not by type.** `auth/` containing `auth.controller.ts`, `auth.service.ts`, `auth.module.ts`.
- **Imports order:** stdlib → third-party → internal absolute → internal relative.

---

## 8. Comments

Default: **do not write them.** Code should explain what; commit messages explain why.

Write a comment only when:

- The **why** is non-obvious (workaround for a known bug, performance trick).
- A subtle invariant a future reader could break.
- A `TODO` with a ticket reference.

Never write:

- Comments restating the code.
- Multi-paragraph docstrings on obvious functions.
- Banner comments / ASCII art separators.
- Stale comments after refactors.

---

## 9. Error Handling

- **Handle at the right layer.** Domain throws, controllers translate (NestJS exception filters), infra logs.
- **Never swallow errors silently.** No empty `catch {}`.
- **Useful messages.** `"Household ${id} not found for user ${userId}"` beats `"Not found"`.
- **Validate at the boundary** (HTTP input via zod, env vars). Trust internal calls.
- **Do not over-validate.** Internal calls trust their callers.

---

## 10. Testing

Pragmatic, not religious.

### Always test

- **Pure business logic.** Auth token expiry, permission checks, formatters.
- **Critical paths.** Login, register, refresh.
- **Bugs you fix.** Reproduce with a test before fixing.

### Skip

- Trivial getters / pass-through wrappers.
- Framework code (NestJS routing, Next.js rendering).
- Mocks of mocks.

### How

- **Behavior, not implementation.**
- **Descriptive names.** `it('returns 401 when refresh token expired')`.
- **Mock at the edge.** Mock Prisma / HTTP — not your own services.
- **Tests live next to code.** `*.spec.ts` sibling.

---

## 11. Architecture

- **Separate business logic from infrastructure.** Services contain logic. Controllers handle HTTP. Prisma is infra.
- **Module boundaries are real.** Do not reach across them. Use public exports.
- **Composition over inheritance.**
- **No premature abstraction.** Three similar lines beat one wrong abstraction.
- **No speculative flexibility.** No config knobs or feature flags for hypothetical needs.

### HomeBuddy-specific architecture

- **API-first.** Every feature is a NestJS controller + service + DTO. Web consumes the API. Mobile will too.
- **Shared types.** API responses and web forms share zod schemas in `packages/shared`. The web's typed `apiClient` infers types from those schemas. Never redefine a DTO type in `apps/web`.
- **Auth is JWT-only.** Access token (short-lived) in `Authorization: Bearer`, refresh token (long-lived) sent on `/auth/refresh`. No session cookies, so the same flow works for mobile.

---

## 12. Git

- **Conventional commits:** `type(scope): subject`. Types: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`, `perf`, `style`.
- **Subject ≤ 72 chars, imperative mood.** `add login endpoint` not `added login endpoint`.
- **Subject line only.** No body unless the why is non-obvious.
- **Never mention AI collaboration or co-authoring** in commits.
- **Small, focused commits.** A commit = one logical change.
- **Never commit:** secrets, generated files, `node_modules`, `.env`, build artifacts.
- **Never `--no-verify`** to skip hooks unless explicitly justified.
- **Never push directly to `main`.** PR.

---

## 13. Code Review Checklist

- [ ] Matches surrounding code style and naming?
- [ ] No duplicated logic? (grep first)
- [ ] No `any`, `as`, `@ts-ignore`?
- [ ] Functions short, named for intent?
- [ ] Tests for the critical bits?
- [ ] Comments only where the why is non-obvious?
- [ ] No features / refactors beyond the task?
- [ ] Commit message says why, not what?

---

## 14. Anti-Patterns

- Big bang refactors mixed with feature work.
- God files / god classes.
- Silent fallbacks (`?? {}`, empty catch).
- Boolean parameters. Use options objects.
- Deep nesting (> 3 levels).
- Magic numbers / strings.
- Premature abstraction.
- `TODO` without a ticket reference.
- **Emojis in code, commits, or PR titles.**

---

## 15. When in Doubt

1. Look at how the codebase already does it. Match.
2. Choose the option a junior dev would understand fastest.
3. Optimize for the next reader (probably you, in 6 months).
4. Ask in the PR.
