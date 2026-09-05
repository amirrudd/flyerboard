# Convex Exit De-Risking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove FlyerBoard's production data can be extracted and restored, and remove the one piece of Convex type-coupling that is also live duplication — without starting a migration.

**Architecture:** Two independent tasks. Task 1 adds a documented, once-executed backup/restore procedure (no application code changes). Task 2 collapses three duplicated `Category` interfaces into one exported type on the provider that already owns categories. Neither task changes runtime behaviour.

**Tech Stack:** Convex CLI 1.45, TypeScript 6.0, React 19, Vite 8, Vitest 4.

**Allowed APIs:**
- `npx convex export --path <dir|zip> [--include-file-storage] [--prod|--deployment <name>]` — verified by running `npx convex export --help` on this repo's installed CLI (2026-09-05).
- `npx convex import [--replace|--replace-all] [--prod] [-y] <path>` — path is a POSITIONAL argument, **not** `--path`. Verified by running `npx convex import --help` on this repo's installed CLI (2026-09-05). `--table` is for csv/json only and is not supported for zip snapshots.
- `npx convex run <module>:<fn>` — already used across `.agent/workflows/set-admin-user.md`.
- `interface Category { _id: Id<"categories">; name: string; slug: string; icon?: string; parentId?: Id<"categories">; }` — the union of the three existing declarations at `src/context/MarketplaceContext.tsx:19-24`, `src/features/ads/AdsGrid.tsx:33-38`, `src/features/layout/Sidebar/SidebarContent.tsx:7-13`.
- `import type { X } from "..."` — TypeScript type-only import; erased at compile time, so it cannot create a runtime import cycle.
- `npx tsc -b --pretty false` — the repo's frontend type-check (root `tsc -p .` is a no-op; see CLAUDE.md).

**Spec:** No separate spec doc exists. The "Findings" section below IS the spec — it records what was measured in the codebase on 2026-09-05 and why two of the three originally-proposed items were cut. Context: `docs/architecture/design-decisions.md` § "Vite SPA over Next.js (Sep 2026)".

## Global Constraints

- Soft delete always: any query touching `ads` includes `.filter(q => q.neq(q.field("isDeleted"), true))`. Neither task adds a query, so this is inherited, not exercised.
- Prod Convex deployment is `resilient-pheasant-112`; dev is `doting-dogfish-130`. **Never run a mutation or import against prod in this plan.** Task 1 is read-only against prod and write-only against dev.
- Run `npm run lint` before claiming any task complete — it is the closest thing to CI.
- This worktree needs `npm install` and a copy of `.env.local` before anything builds.
- Do not paraphrase `.agent/PRODUCT-RULES.md` into any file this plan creates. Link to it.
- Exported snapshots contain real user data (emails, phone numbers, chat messages). They must never be committed. Task 1 Step 1 adds the `.gitignore` entry before the first export runs.

---

## Findings (the spec)

Measured on 2026-09-05 against this worktree. Three de-risking items were proposed in conversation; measurement kept one, replaced one, and cut two.

**KEPT — no backup or restore procedure exists.**
`grep -rli 'convex export|convex import|backup' docs .agent` returns nothing. There is no evidence a production snapshot has ever been taken. This is not only a portability gap; it is a live data-loss risk with 18 tables of real data behind it.

**KEPT (narrowed) — `Category` is declared three times.**
Identical-in-substance `interface Category` blocks at `src/context/MarketplaceContext.tsx:19`, `src/features/ads/AdsGrid.tsx:33`, and `src/features/layout/Sidebar/SidebarContent.tsx:7`. The Sidebar copy additionally has `icon?: string`. This is real duplication today and happens to be the highest-traffic `Id<"categories">` boundary.

**CUT — blanket `Id<"...">` → `string` sweep.**
113 occurrences across 38 files (verified 2026-09-05). Replacing them wholesale trades a compile-time guarantee (you cannot pass an ad id where a chat id is expected) for a migration that is not scheduled and may never happen. That is a bad trade. Task 2 takes only the subset that is *also* duplication, where the change pays for itself immediately.

**CUT — "keep business logic out of handlers".**
Already done. `convex/lib/` holds 15 non-test modules, of which six contain **zero** `ctx` references and are already portable as-is: `appConfig.ts`, `boost.ts`, `emailUtils.ts`, `feedSections.ts`, `logger.ts`, `rateLimitConfig.ts`. The rest take `ctx` because they load documents (`derive.ts`, `cards.ts`, `nearby.ts`, `unread.ts`) or are auth/rate-limit middleware — that is data access, not portable logic, and splitting it would be a speculative abstraction.

**CUT — "keep `_creationTime` out of business logic".**
The only two non-display uses are `convex/bundles.ts:457` (`getMyBundles`) and `convex/bundles.ts:532` (`getEligibleAdsForBundle`), both sorting an **owner's own management list** newest-first. `.agent/PRODUCT-RULES.md` governs the public feed, not these screens — no rule applies, and stable creation order is the right behaviour for a list you are managing rather than browsing. The public feed already sorts on `bumpedAt` (`convex/feed.ts:38`), and `convex/lib/cards.ts:41` already exposes `createdAt` and `bumpedAt` as separate fields. Nothing to fix.

---

## Task 1: Backup and restore runbook, executed once

**Files:**
- Create: `.agent/workflows/backup-and-restore-convex.md`
- Modify: `.gitignore` (append snapshot ignore rule)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: nothing other tasks depend on. Task 1 and Task 2 are independent and may run in either order.

- [ ] **Step 1: Ignore snapshots before creating any**

Append to `.gitignore`:

```gitignore

# Convex data snapshots — contain real user PII, never commit
convex-snapshots/
*.convex-snapshot.zip
```

- [ ] **Step 2: Verify the ignore rule works**

Run:

```bash
mkdir -p convex-snapshots && touch convex-snapshots/probe.zip && git status --porcelain convex-snapshots
```

Expected: **no output** (the directory is ignored). If a line appears, the rule is wrong — fix it before continuing.

Then clean up: `rm -rf convex-snapshots/probe.zip`

- [ ] **Step 3: Take a real production snapshot**

This is a **read-only** operation against prod. It does not deploy, migrate, or mutate anything.

```bash
npx convex export --prod --include-file-storage --path convex-snapshots/prod-$(date +%Y-%m-%d).zip
```

Expected: the command prints progress and exits 0, leaving a `.zip` file. If it prompts to select a deployment, stop — `--prod` should not prompt. Do not substitute `--deployment` with a guessed name.

- [ ] **Step 4: Verify the snapshot actually contains the data**

```bash
unzip -l convex-snapshots/prod-$(date +%Y-%m-%d).zip | head -40
```

Expected: one entry per table — `ads/documents.jsonl`, `users/documents.jsonl`, `chats/`, `messages/`, `saleBundles/`, `saleEvents/`, plus a `_storage/` folder. Record the **actual observed table count and total zip size** — Step 6 writes them into the runbook.

Sanity-check one table is non-empty:

```bash
unzip -p convex-snapshots/prod-$(date +%Y-%m-%d).zip ads/documents.jsonl | wc -l
```

Expected: a non-zero line count matching roughly the number of ads in prod.

- [ ] **Step 5: Prove restore works — into the DEV deployment only**

This is the step that turns a backup into a *verified* backup. It writes to dev (`doting-dogfish-130`), never prod.

```bash
npx convex import --replace-all convex-snapshots/prod-$(date +%Y-%m-%d).zip
```

Note the path is **positional** — there is no `--path` flag on `import` (there is on `export`; they differ). `--replace-all` is required because the dev deployment already has tables; without it the import refuses rather than merging into existing data.

Expected: the CLI warns it will replace dev data and asks for confirmation. Confirm. On success, open the dev dashboard (`doting-dogfish-130`) and confirm the `ads` table row count matches Step 4's line count.

**If this step fails, that failure is the single most valuable output of this whole plan.** Record the exact error in the runbook under "Known restore gotchas" rather than working around it silently.

- [ ] **Step 6: Write the runbook**

Create `.agent/workflows/backup-and-restore-convex.md`. Replace every `<...>` with the real value observed in Steps 4–5 — a runbook with placeholders in it has not been run.

```markdown
# Backup and restore the Convex database

**Last executed**: <YYYY-MM-DD> (by <who>) — snapshot <N> tables, <SIZE>, restore into dev verified.

Deployments: prod `resilient-pheasant-112`, dev `doting-dogfish-130`.

## Take a snapshot (read-only, safe against prod)

    npx convex export --prod --include-file-storage --path convex-snapshots/prod-$(date +%Y-%m-%d).zip

`--include-file-storage` pulls legacy `_storage` files. It does **not** pull R2
images — those live in Cloudflare R2 and are backed up separately (see
`docs/guides/r2-cdn-setup.md`). A snapshot restores the database, not the photos.

Snapshots contain real emails, phone numbers, and chat messages. `.gitignore`
excludes `convex-snapshots/`. Do not move one outside that directory.

## Verify a snapshot

    unzip -l convex-snapshots/<file>.zip          # expect <N> table folders
    unzip -p convex-snapshots/<file>.zip ads/documents.jsonl | wc -l

## Restore

    npx convex import --replace-all convex-snapshots/<file>.zip           # -> dev
    npx convex import --prod --replace-all convex-snapshots/<file>.zip    # -> PROD, destructive

The path is positional. `export` uses `--path`, `import` does not — they differ,
and getting it wrong is the most common failure here. `--replace-all` is needed
whenever the target deployment already has tables.

**The prod form replaces production data.** Only run it during a real recovery,
and take a fresh snapshot of the current prod state first.

## Known restore gotchas

<Record what actually went wrong in Step 5, or "none observed on <date>".>

## Cadence

No automation. Run the snapshot command before any prod migration
(`npx convex run migrations:<name>`) and before any schema change that drops or
renames a field.
```

- [ ] **Step 7: Confirm nothing leaked into git**

```bash
git status --porcelain
```

Expected: exactly two entries — `M .gitignore` and `?? .agent/workflows/backup-and-restore-convex.md`. **No `.zip` file may appear.** If one does, stop and fix `.gitignore` before committing.

- [ ] **Step 8: Commit**

```bash
git add .gitignore .agent/workflows/backup-and-restore-convex.md
git commit -m "docs: add verified Convex backup and restore runbook

Snapshot taken from prod and restored into dev to prove the procedure
works, rather than documenting an untested one.

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: One `Category` type instead of three

**Files:**
- Modify: `src/context/MarketplaceContext.tsx:19-24` (export the interface, add `icon?`)
- Modify: `src/features/ads/AdsGrid.tsx:33-38` (delete local copy, import)
- Modify: `src/features/layout/Sidebar/SidebarContent.tsx:7-13` (delete local copy, import)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces: `export interface Category` from `src/context/MarketplaceContext.tsx`, with fields `_id: Id<"categories">`, `name: string`, `slug: string`, `icon?: string`, `parentId?: Id<"categories">`.

**Why this file owns it:** `MarketplaceProvider` is what fetches and supplies categories. The consumers already depend on it conceptually. Adding a new shared types file would be a third place for the same information to live. `import type` is erased at compile time, so no runtime import cycle is possible even though `SidebarContent` is rendered beneath the provider.

- [ ] **Step 1: Export the canonical type**

In `src/context/MarketplaceContext.tsx`, replace lines 19-24:

```typescript
interface Category {
    _id: Id<"categories">;
    name: string;
    slug: string;
    parentId?: Id<"categories">;
}
```

with:

```typescript
/**
 * The category shape every consumer uses. Declared here because this provider
 * is what loads categories. `icon` is optional — only the sidebar renders it
 * (via `getCategoryIcon`); the feed and grid ignore it.
 */
export interface Category {
    _id: Id<"categories">;
    name: string;
    slug: string;
    icon?: string;
    parentId?: Id<"categories">;
}
```

- [ ] **Step 2: Verify the type-check still passes before touching consumers**

Run: `npx tsc -b --pretty false`

Expected: PASS. Adding an optional field and an `export` keyword is backward-compatible. If this fails, something else is broken — stop and diagnose before continuing.

- [ ] **Step 3: Point AdsGrid at the shared type**

In `src/features/ads/AdsGrid.tsx`, delete lines 33-38:

```typescript
interface Category {
  _id: Id<"categories">;
  name: string;
  slug: string;
  parentId?: Id<"categories">;
}
```

Then **modify the existing import on line 13** — this file already imports from that module, so do not add a second import line:

```typescript
import type { Category, FeedEntry } from "../../context/MarketplaceContext";
```

(Line 13 currently reads `import type { FeedEntry } from "../../context/MarketplaceContext";`. That pre-existing import is also empirical proof this direction creates no cycle.)

Leave the `Id` import on line 1 alone — `Id<"categories">` is still used at line 53.

- [ ] **Step 4: Point SidebarContent at the shared type**

In `src/features/layout/Sidebar/SidebarContent.tsx`, delete lines 7-13:

```typescript
interface Category {
    _id: Id<"categories">;
    name: string;
    slug: string;
    icon?: string;
    parentId?: Id<"categories">;
}
```

and add to the import block at the top of the file:

```typescript
import type { Category } from "../../../context/MarketplaceContext";
```

Note the path depth: `SidebarContent.tsx` sits at `src/features/layout/Sidebar/`, so `src/context/` is **three** levels up. (Its `dataModel` import on line 2 is four levels up because that one resolves to the repo root, not `src/`. Do not copy that depth.)

Unlike AdsGrid, this file has no existing import from `MarketplaceContext`, so a new import line is correct here. Leave the `Id` import on line 2 alone — `Id<"categories">` is still used at lines 17, 18, and 40.

- [ ] **Step 5: Type-check — this is the real test**

Run: `npx tsc -b --pretty false`

Expected: PASS with no output.

This step *is* the test for this task. If the three declarations were not actually compatible, the compiler fails here — that is exactly the assertion a hand-written unit test would make, and TypeScript makes it across all call sites rather than one. Do not add a Vitest file asserting the shape of a type alias.

If it FAILS, do not widen the shared type to make the error disappear. Read the error: a genuine mismatch means the three components were relying on different shapes, and that is a finding worth reporting rather than papering over.

- [ ] **Step 6: Confirm no `Id` import went unused**

Run:

```bash
npx eslint src/features/ads/AdsGrid.tsx src/features/layout/Sidebar/SidebarContent.tsx src/context/MarketplaceContext.tsx
```

Expected: no new errors.

Verified 2026-09-05: `Id` stays used in both consumers after the interface is deleted (`AdsGrid.tsx:53`; `SidebarContent.tsx:17,18,40`), so **neither `Id` import should be removed**. If eslint reports `Id` as unused, the deletion in Step 3 or 4 removed more than the interface block — re-check the diff rather than deleting the import.

- [ ] **Step 7: Run the affected tests**

Run:

```bash
npx vitest run src/context/MarketplaceContext.radius.test.tsx src/features/ads
```

Expected: PASS. These are type-level changes with no runtime effect, so any failure indicates something unrelated was disturbed.

- [ ] **Step 8: Full validation gate**

Run: `npm run lint`

Expected: exits 0. This runs eslint, both type-checks, `convex dev --once`, the Vite build, and the OG asset generation. Note: it fails if a local Convex backend is already running on port 3210 — stop `npm run dev` first.

- [ ] **Step 9: Commit**

```bash
git add src/context/MarketplaceContext.tsx src/features/ads/AdsGrid.tsx src/features/layout/Sidebar/SidebarContent.tsx
git commit -m "refactor: single Category type instead of three copies

MarketplaceContext owns categories, so it owns the type. Removes two
duplicate interface declarations that had already drifted (only the
sidebar copy carried the optional icon field).

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: Record what was cut and why

**Files:**
- Modify: `docs/architecture/design-decisions.md` (append)

**Interfaces:**
- Consumes: the Findings section of this plan.
- Produces: nothing. Run this task last.

**Why:** the "Vite SPA over Next.js" decision already in that file invites the follow-up question "what about Convex lock-in?". Without a recorded answer, the next person re-derives it — or worse, does the 113-site `Id<>` sweep this plan deliberately rejected.

- [ ] **Step 1: Append the decision**

Append to `docs/architecture/design-decisions.md`:

```markdown

## Convex lock-in — verified exit, not a portability layer (Sep 2026)

**Decision**: We accept Convex coupling as a deliberate trade. We keep a
**tested** data escape hatch and we do **not** build abstraction layers to make
a hypothetical migration cheaper.

**Why**: The exit cost is dominated by reactivity, not by types. 157 `useQuery`
call sites assume results update themselves; nothing else on the market
reproduces that, so the work of leaving is rewriting those expectations, not
renaming identifiers. Portability shims would add complexity now against a
migration that may never happen, and would not touch the part that is actually
expensive.

**What we did instead**:
- `.agent/workflows/backup-and-restore-convex.md` — a snapshot/restore procedure
  that has been **run end to end** (prod export, restore into dev). An untested
  backup is not a backup.
- Collapsed the triplicated `Category` interface into one exported type. Taken
  because it removed live duplication, not for portability.

**Explicitly rejected**:
- A blanket `Id<"table">` → `string` sweep (113 sites across 38 files). Trades a real
  compile-time guarantee for an unscheduled migration. Keep the branded ids.
- Extracting more "pure logic" out of Convex handlers. Already done — six of
  `convex/lib/`'s 15 modules (`appConfig`, `boost`, `emailUtils`,
  `feedSections`, `logger`, `rateLimitConfig`) hold zero `ctx` references.
  The rest take `ctx` because they load documents; that is data access, not
  logic.
- Removing `_creationTime` from queries. Its only non-display uses
  (`convex/bundles.ts:457,532`) sort an owner's own **management** list
  newest-first. `.agent/PRODUCT-RULES.md` governs the public feed, not these
  screens; stable creation order is right for a list you manage rather than
  browse. The public feed already sorts on `bumpedAt` (`convex/feed.ts:38`).

**Revisit trigger**: Convex cost becomes material at real traffic, or a product
need appears that the document model genuinely fights (reporting joins,
ad-hoc analytics). Migration options and effort: this plan's companion analysis.
```

- [ ] **Step 2: Verify the markdown renders and links resolve**

```bash
tail -35 docs/architecture/design-decisions.md
test -f .agent/workflows/backup-and-restore-convex.md && echo "runbook link OK"
```

Expected: the section appears intact and `runbook link OK` prints. If the runbook is missing, Task 1 was not completed — do that first rather than committing a dangling reference.

- [ ] **Step 3: Commit**

```bash
git add docs/architecture/design-decisions.md
git commit -m "docs: record Convex lock-in decision and rejected de-risking work

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Session close-out

Per CLAUDE.md, update agent memory before reporting complete:

- [ ] Add to `.agent/gatheredContext/infrastructure/database.md`: a pointer to
  `.agent/workflows/backup-and-restore-convex.md`, plus any restore gotcha found
  in Task 1 Step 5. Bump `Last Updated`.
- [ ] Add to `.agent/gatheredContext/frontend/state-management.md`: `Category` is
  exported from `MarketplaceContext`; do not redeclare it locally. Bump
  `Last Updated`.
