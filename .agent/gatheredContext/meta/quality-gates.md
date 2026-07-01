# Quality Gates (type-check, lint, CI, Stop hook)

Last Updated: 2026-06-30

How regressions are caught in FlyerBoard. Three layers: local Stop hook (per turn),
the `lint` script (pre-commit, manual), and CI `build.yml` (required to merge).

## 🔴 Load-bearing gotcha: `tsc -p .` is a NO-OP

Root `tsconfig.json` is references-only (`"files": []`, references `tsconfig.app.json` +
`tsconfig.node.json`). Running `tsc -p . -noEmit` **type-checks nothing in `src/`** — it
compiles an empty file list and exits 0. To actually type-check the frontend you MUST use
**`tsc -b`** (build mode, follows project references).

This was silently true for a long time: `npm run lint` and CI `build.yml` both used `tsc -p .`,
so frontend type errors never failed either. `vite build` doesn't help — esbuild does no type
checking. Fixing it (2026-06-28) surfaced 40 masked errors. **Always use `tsc -b` for the
frontend; `tsc -p convex -noEmit` for the backend (convex tsconfig is normal, not references).**

## The three gates

1. **Stop hook** — `.claude/hooks/verify-before-stop.sh` (registered in `.claude/settings.json`).
   Runs `tsc -p convex -noEmit` + `tsc -b` before the agent can end a turn; exit 2 + stderr feeds
   the error back to the model. Honors `stop_hook_active` (mandatory loop guard). Fast gate —
   intentionally does NOT run eslint/vite/convex (too slow per-turn); those run in CI.
2. **`npm run lint`** — `eslint . && tsc -p convex -noEmit && tsc -b && convex dev --once && vite build`.
   The full local check. `convex dev --once` regenerates types + validates schema (needs convex auth).
3. **CI `build.yml`** (required to merge via branch protection on `main`) — `npm ci` → `eslint .` →
   `tsc -p convex` → `tsc -b` → tests → `npm run build`. `convex dev --once` is OMITTED (needs
   `CONVEX_DEPLOY_KEY`). Branch protection requires the `build` check; blocks force-push/deletions.

## ESLint config (`eslint.config.js`)

- Uses `parserOptions.projectService: true` (typescript-eslint 8.x) — auto-resolves the nearest
  tsconfig per file, including config/test files. Do NOT go back to a static `project: [...]` array
  (it caused "file not found in project" parse errors on vitest/playwright configs).
- Ignores: `dist`, `coverage`, config files (`vite/vitest/playwright.config`), `e2e/**`,
  `.agent/**`, `.claude/**`, `convex/_generated`.
- `no-unused-vars` and `react-hooks/exhaustive-deps` are **warn**, not error (by design). CI blocks
  on errors only; ~73 warnings remain as tracked debt.

## Fix patterns (when ESLint errors reappear)

- **no-floating-promises**: fire-and-forget → prefix `void fn()`; if result matters in an async
  fn → `await`. Never delete the call.
- **no-misused-promises** (async handler in JSX): wrap to return void —
  `onClick={() => { void handleAsync(); }}`, `onSubmit={(e) => { void handleSubmit(e); }}`,
  `useEffect(() => { void asyncFn(); }, deps)`.
- **no-unnecessary-type-assertion**: drop redundant `as T` / non-null `!`. EXCEPTION — testing-library
  element casts: `screen.getByX('...') as HTMLInputElement` → rewrite as the generic
  `screen.getByX<HTMLInputElement>('...')`. Deleting the cast breaks `.value`/`.maxLength` (those
  props don't exist on `HTMLElement`). ESLint flags it "unnecessary" but `tsc -b` needs the type.
- Intentional effect-sync cases (`react-hooks/set-state-in-effect`, `purity`) use scoped
  `// eslint-disable-next-line` with a rationale — matching existing repo convention — rather than
  risky refactors.

## React 19 note

React 19 removed the global `JSX` namespace (it's `React.JSX` now). `@descope/react-sdk` augments
the *global* `JSX.IntrinsicElements` with its widgets, so `keyof JSX.IntrinsicElements` resolves to
ONLY descope widgets. Don't rely on the global `JSX` namespace; use narrow literal unions or import
`JSX` from `react`. (See `src/components/MarkdownContent.tsx`.)

## Don't blind-`eslint --fix`

`eslint . --fix` here stripped *necessary* type assertions (broke tests) and rewrote generated
`coverage/*.js`. Fix by rule with verification (`tsc -b` + `vitest run`), not blanket autofix.

## Convex backend tests with `convex-test` (added 2026-06-30)

Backend functions are tested in-memory with `convex-test` (devDeps: `convex-test`,
`@edge-runtime/vm`). Pattern — see `convex/saleEvents.test.ts` / `convex/saleChats.test.ts`:

- Each file MUST start with `// @vitest-environment edge-runtime` (convex-test needs it).
- `convexTest(schema, modules)` spins a fresh backend against the real schema + functions.
- 🔴 **Glob gotcha**: the canonical `import.meta.glob("./**/!(*.*.*)*.*s")` from the
  convex-test docs returns **`[]`** under this repo's vite/vitest (the extglob `!(...)`
  brace pattern isn't expanded), so convex-test fails with *"Could not find the
  _generated directory"*. Fix used: glob `./**/*.ts` + `./**/*.js` and filter out
  `.d.ts` and `*.test/*.spec` files in JS. Keep this filter or you'll re-import the
  test file itself.
- **Auth simulation (Descope, not Convex Auth)**: insert a `users` row with
  `tokenIdentifier: "u1"`, then `t.withIdentity({ subject: "u1" })`. `getDescopeUserId`
  matches `tokenIdentifier === identity.subject`. Plain `t` (no identity) = unauthenticated
  → mutations throw "Must be logged in…". An identity whose subject matches no user row
  also reads as unauthenticated.
- `addSaleItems` needs ≥1 `categories` row seeded (calls `getDefaultCategoryId`).
- `t.run(async (ctx) => …)` callbacks that `await` MUST be declared `async` — SWC errors
  loudly ("await isn't allowed in non-async function") otherwise.
- Run just these: `npx vitest run convex/saleEvents.test.ts convex/saleChats.test.ts`.

See also: [[regression-guardrails plan]] at `.agent/plans/regression-guardrails.md`.
