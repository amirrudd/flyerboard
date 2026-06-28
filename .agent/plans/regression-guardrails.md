# Plan: Harden FlyerBoard against agent regressions

**Goal:** Convert skippable guidelines into non-skippable gates across three layers — local
(Stop hook), pre-merge (CI), and invariant-specific (Convex audit + smoke tests).

Each phase is self-contained and can run in a fresh chat context. Paths are verified against the
repo as of 2026-06-27.

## Ground truth (Phase 0 — read before implementing)

| Area | Truth | Source |
|---|---|---|
| Scripts | `lint` = `tsc -p convex -noEmit --pretty false && tsc -p . -noEmit --pretty false && convex dev --once && vite build` | `package.json:11` |
| ESLint configured but **never invoked** by any script | flat config exists | `eslint.config.js:1-77` |
| TS configs | `tsconfig.json` (root refs), `tsconfig.app.json` (src/), `convex/tsconfig.json` (backend) | repo root |
| CI today | `build.yml`: `npm ci` → `tsc -p convex` → `tsc -p .` → `npm run test -- --run`. `visual-tests.yml`: Playwright. `lighthouse.yml`: daily. | `.github/workflows/` |
| Tests | 37 files: 30 frontend (vitest+RTL+jsdom), 3 Convex (`convex/**/*.test.ts`), 1 E2E (`e2e/layout.spec.ts`) | repo |
| Auth invariant | `getDescopeUserId(ctx)` | `convex/lib/auth.ts:11-27` |
| Admin invariant | `requireAdmin(ctx)` / `isAdmin()` | `convex/lib/adminAuth.ts:9-21` |
| Soft-delete invariant | `.filter((q) => q.neq(q.field("isDeleted"), true))` | `convex/admin.ts:56`, `convex/ads.ts:69`, `convex/schema.ts:27` |
| Audit-script pattern to COPY | bash, `grep -E`, `ISSUES` counter, `exit $ISSUES` | `.agent/skills/responsive-ui-auditor/scripts/audit-responsive.sh` |
| Hooks | none configured; only `.claude/settings.local.json` (permissions) | `.claude/settings.local.json` |

### Stop-hook contract (verified vs code.claude.com/docs/en/hooks.md, 2026-06-27)
- Event `Stop`. Block via exit code 2 + message on **stderr** (fed back to the model), OR top-level
  `{"decision":"block","reason":"..."}`. Do NOT use `hookSpecificOutput` (that's PreToolUse).
- **Mandatory** infinite-loop guard: read `stop_hook_active` from stdin; if `true`, `exit 0`.
- Stdin JSON includes `cwd`, `stop_hook_active`, `transcript_path`. `${CLAUDE_PROJECT_DIR}` = project root.
- Precedence: `~/.claude` < `.claude/settings.json` < `.claude/settings.local.json`.

## Phase 1 — Local "claiming-done" gate (Stop hook)  ✅ DONE (2026-06-28)
- `.claude/hooks/verify-before-stop.sh`: guard on `stop_hook_active`, `cd` to `cwd`, runs
  `tsc -p convex -noEmit` + `tsc -b` (NOT `tsc -p .`); exit 2 + stderr on failure.
- `.claude/settings.json` registers the `Stop` hook (committed, not `.local.json`).
- Verified: clean→0, frontend type error→2+msg, `stop_hook_active:true`→0, 31 affected tests pass.

### 🔴 LOAD-BEARING DISCOVERY (carry into Phase 3)
`tsc -p .` checks **nothing in src/** — root `tsconfig.json` is references-only (`"files": []`).
The correct frontend type-check is **`tsc -b`** (build mode). This means the project's
`npm run lint` script AND CI `build.yml` have NOT been type-checking the frontend.
**Phase 3 MUST replace `tsc -p .` with `tsc -b` in both `package.json` `lint` and `build.yml`,
not just add ESLint.** This was masking 40 real errors (now fixed — see below).

### Baseline fixed (the 40 masked errors, 3 root causes)
- `src/components/MarkdownContent.tsx`: typed `Tag` as a heading-only literal union
  (`"h1"|…|"h6"`) instead of `keyof JSX.IntrinsicElements` (the full union breaks `children`,
  and React 19's global `JSX` was polluted by `@descope/react-sdk`'s widget augmentation).
- `src/components/ui/LocationMap.tsx`: added `@types/google.maps` dev dep +
  `/// <reference types="google.maps" />` in `src/vite-env.d.ts`.
- `src/features/ads/PostAd.test.tsx`: added a typed `makeAd()` factory returning full `Doc<"ads">`;
  `src/components/ui/LocationMap.test.tsx`: cast `global.google` mock as `any` (matches file style).

## Phase 2 — Convex invariant auditor (advisory tripwire, not a gate)
- COPY `.agent/skills/responsive-ui-auditor/scripts/audit-responsive.sh` → `.agent/skills/convex-utility/scripts/audit-convex-invariants.sh`.
- Greps: `ads` query without `isDeleted` filter; `mutation(`/`internalMutation(` handler without
  `getDescopeUserId`/`requireAdmin`. Print file:line, never auto-edit.
- Optional PostToolUse hook (match `Edit|Write`, only `convex/.*\.ts`), advisory only (always exit 0).

## Phase 3 — Close CI / lint gaps
- Add `"lint:eslint": "eslint ."`; prepend `eslint .` to the `lint` script.
- Harden `build.yml`: add `npx eslint .` and `npm run build`. Keep `convex dev --once` OUT of CI
  unless `CONVEX_DEPLOY_KEY` secret exists.
- Make `build.yml` required to merge (branch protection on `main`) — only after it's green.

## Phase 4 — Critical-path smoke tests (auth, navigation, DB)
- Navigation smoke (Playwright, COPY `e2e/layout.spec.ts`): visit each top-level route in
  `src/App.tsx`, assert no ErrorBoundary fallback renders.
- Soft-delete test (Convex, COPY `convex/lib/rateLimit.test.ts`): create→list→soft-delete→list.
- Auth-gate test (vitest, COPY `src/features/ads/*.test.tsx` mocks): authed query passes `"skip"`
  until `isAuthenticated && !isSessionLoading && isUserSynced`.

## Phase 5 — Verification + write-back
- Full local gate green: `npm run lint` (now w/ ESLint) + `npx vitest run` + `npm run test:visual`.
- One real PR exercising each gate (type error, lint error, broken route) fails the right check.
- Write back to `.agent/gatheredContext/meta/` and `docs/architecture/design-decisions.md`.

### Sequencing: Phase 1 → 3 → 4 → 2. Land as separate PRs.
