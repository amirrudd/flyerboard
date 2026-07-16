# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Required session protocol

The `.agent/gatheredContext/` system is the project's accumulated technical memory. **Treat reading and updating it as part of every task — not optional.** Skipping the read step is the most likely cause of regressions; skipping the write step is what causes future sessions to repeat the same investigations.

### Before starting non-trivial work — refresh from `gatheredContext/`

1. Open `.agent/gatheredContext/INDEX.md` and identify which domain file(s) cover the topic you're touching (auth, image-upload, storage, database, notifications, admin, ui-patterns, responsive-design, etc.).
2. Read those files **before planning your change**. They encode prior decisions, trade-offs, gotchas, and "we tried that, it broke X" lessons that aren't in the code.
3. If your plan would contradict something in `gatheredContext/`, stop and either (a) follow the existing pattern, or (b) explicitly flag the contradiction to the user and confirm before diverging. Don't silently regress a documented decision.
4. Cross-reference `docs/architecture/` when you need the longer human-readable rationale.

### At the end of every session — write back what you learned

Before reporting a task complete, update `.agent/gatheredContext/` with anything from this session that a future agent would want to know. Specifically capture:

- **New patterns** introduced or established (with a short code example).
- **Trade-offs and decisions** — what you chose, what you rejected, and *why* (the "why" is the load-bearing part).
- **Non-obvious gotchas** — bugs that took more than one attempt to fix, framework quirks, race conditions, CORS/auth edge cases.
- **Corrections** — if you found that an existing note was stale (drifted from the code), fix it in place. Don't leave the stale note alongside the new one.
- **Bump `Last Updated`** at the top of the file.

If a discovery doesn't fit an existing domain file, route it per the table in "When you finish a task" below — but prefer extending an existing file over creating a new one. Architecture-level decisions also belong in `docs/architecture/design-decisions.md` (human-readable companion).

This isn't bookkeeping — it's how the project compounds knowledge across sessions.

## Project

FlyerBoard is a classified marketplace web app (ads = "flyers"). The repo also contains a Kotlin Multiplatform mobile app (`mobile/`) and `mobile-api/` — these are out of scope for the web guideline. The web app lives in `src/` and uses Convex for backend, Descope for auth, and Cloudflare R2 for image storage. Convex deployments: **prod** `resilient-pheasant-112` (what Vercel `main` builds deploy to; run prod migrations here), **dev** `doting-dogfish-130` (local `convex dev`). Don't run prod migrations against the dev deployment — the prod dashboard is https://dashboard.convex.dev/t/amir-rudd/flyerboard/resilient-pheasant-112.

## Commands

- `npm run dev` — Runs frontend (`vite --open`) and backend (`convex dev`) in parallel via `npm-run-all`. Always use this for development; `convex dev` regenerates `convex/_generated/`.
- `npm run build` — Vite production build only.
- `npm run lint` — Full validation: `eslint .` → `tsc -p convex` → `tsc -b` → `convex dev --once` (regenerates types) → `vite build`. Run this before claiming a task complete; it's the closest thing to CI. Note: `tsc -p .` is a no-op (root tsconfig is references-only); the frontend is type-checked via `tsc -b`.
- `npm test` — Vitest in watch mode. `npm run coverage` for one-shot with coverage. Run a single file: `npx vitest run path/to/file.test.ts`. A single test: `npx vitest run -t "test name"`.
- `npm run test:visual` — Playwright (E2E + visual snapshots). `test:visual:update` to regenerate snapshots. Auto-starts `dev:frontend` on port 5173.

Vitest uses `jsdom` and `src/test/setup.ts`; Playwright tests live in `e2e/` and are excluded from Vitest.

## Architecture

### Frontend (`src/`)
- **Routing**: React Router v7 in `App.tsx`. Only `HomePage` is eager; everything else is `lazy()` + `Suspense` with a `PageLoader` fallback. Each lazy route is wrapped in its own `ErrorBoundary`.
- **Providers** (outermost → innermost): `ErrorBoundary` → `UserSyncProvider` → `MarketplaceProvider` → `BrowserRouter`. `App` short-circuits to `PageLoader` while `useSession().isSessionLoading`.
- **Path alias**: `@/` → `src/` (configured in `vite.config.ts` and `vitest.config.ts`).
- **Layout**: `src/features/layout/Layout.tsx` is the shell rendered by `<Route element={<Layout />}>`.
- **Feature folders** (`src/features/`): `ads`, `auth`, `dashboard`, `admin`, `layout`. Page-level shells live in `src/pages/`. Shared hooks live in `src/hooks/` (e.g. `useMotionPrefs`, `useAdFilters`, `useMediaQuery`).
- **Tailwind v4** with PostCSS. Design tokens in `tailwind.config.js`.

### Backend (`convex/`)
- **Convex app components** (`convex.config.ts`): registers `@convex-dev/r2` and `@convex-dev/resend`.
- **Auth is Descope (OIDC), not Convex Auth.** `convex/auth.config.ts` configures the Descope OIDC provider; `convex/auth.ts` exists but its `getAuthUserId`/`Password`/`Anonymous` machinery is **not** the path used by Descope-authenticated users. For Descope-authed mutations/queries, use `getDescopeUserId(ctx)` from `convex/lib/auth.ts` — it reads `ctx.auth.getUserIdentity()` and looks up the user by `tokenIdentifier === identity.subject`.
- **Schema** (`convex/schema.ts`): key tables are `ads`, `categories`, `chats`, `messages`, `savedAds`, `reports`, plus `authTables` from `@convex-dev/auth`. `ads` has a `searchIndex` (`search_ads`) and an `isDeleted` soft-delete flag.
- **Generated types** (`convex/_generated/`): regenerated by `convex dev`. Don't edit; `npm run lint` regenerates them via `convex dev --once`.

### Storage (R2)
- Presigned uploads via `convex/upload_urls.ts` and `src/lib/uploadToR2.ts`. Folder layout: `profiles/{userId}/{uuid}` and `flyers/{postId}/{uuid}`. DB stores `r2:path/to/file` references.
- **Image reads are public + CDN-cached (since Jul 2026)**: `src/lib/imageUrl.ts` derives stable URLs on `https://img.flyerboard.com.au/<key>` (gated on `VITE_R2_PUBLIC_URL`); a Cloudflare zone Cache Rule provides Edge TTL 1 month / Browser TTL 1 year. `convex/posts.getImageUrl` (presigned) survives only as the fallback for legacy `_storage` IDs / when the env var is unset — don't remove it, and don't route new image reads through it. Setup/rationale: `docs/guides/r2-cdn-setup.md`, `gatheredContext/infrastructure/storage.md`.
- **Deleted-ad image cleanup**: daily cron `convex/imageCleanup.ts` purges images of ads soft-deleted > `IMAGE_CLEANUP_RETENTION_DAYS` (default 30) days ago; stamps `imagesPurgedAt`, never hard-deletes the ad row. Any new soft-delete site must stamp `deletedAt`; any future restore mutation must clear it.
- **R2 CORS gotcha** (load-bearing): presigned URLs MUST set `ChecksumAlgorithm: undefined` and `unhoistableHeaders: new Set(["x-amz-checksum-crc32"])`. Without this, browsers get 403 preflight errors.
- **Adaptive compression** (`src/lib/networkSpeed.ts`): quality varies 0.85–0.92 by connection speed; resolution is preserved up to 2048px on the longest side; `maxSizeMB: 10` is just a safety net. Note: `.agent/rules/global-guideline.md` still says "always 90%" — that's stale; the code and `gatheredContext/features/image-upload.md` (Dec 2025) are the source of truth.

## Project-specific patterns to preserve

- **Soft delete, always**: `ads` uses `isDeleted`. Every list/count/dashboard query must include `.filter(q => q.neq(q.field("isDeleted"), true))`. Never hard-delete ads. (Exception: a user's own dashboard can show their deleted ads for restoration.)
- **Auth on every mutation**: call `getDescopeUserId(ctx)` and verify ownership before update/delete. For admin-only paths use `requireAdmin(ctx)` from `convex/lib/adminAuth.ts`.
- **Wait for user-sync before authed queries**: a Descope-authenticated user may not yet exist in Convex's `users` table — `useDescopeUserSync` runs the sync mutation asynchronously. Gate queries with `isAuthenticated && !isSessionLoading && isUserSynced ? args : "skip"` (via `useUserSync()` from `src/context/UserSyncContext.tsx`). Skipping this causes "Not authenticated" race errors. See `src/features/ads/AdMessages.tsx` for the canonical example.
- **UI auth state**: use Descope's `useSession()`, not a Convex query — Convex queries cause flicker on first paint.
- **Image uploads in edit mode**: keep new files separate from existing R2 keys; filter deleted images out of `existingImages` before submit; only pass storage keys to mutations (never base64/data URLs).
- **Rate limits**: mutations apply per-user limits via `convex/lib/rateLimit.ts` (`checkRateLimit(ctx, userId, "createAd")` etc. — see that file for configured operations and windows).
- **Animations**: use `framer-motion` via `useMotionPrefs()` (`src/hooks/useMotionPrefs.ts`) — spread its `fadeUp` / `whileInView` / `staggerCard` helpers onto `motion.*` elements (e.g. `<motion.div {...whileInView(0.05)} />`). They bake in `prefers-reduced-motion`, so don't add manual reduced-motion checks or a second animation library. Canonical use: `src/features/ads/AdsGrid.tsx`.

## Common operational tasks

- **Grant admin**: `npx convex run admin:setAdminUser '{"email": "user@example.com"}'` (user must have logged in once first). Detailed steps: `.agent/workflows/set-admin-user.md`.
- **Run a Convex internal/migration mutation**: `npx convex run migrations:<name> --<arg> <value>`.
- **Port conflict / dev won't start**: `lsof -ti :5173 | xargs kill -9; lsof -ti :3210 | xargs kill -9`. Full procedure: `.agent/workflows/fix-port-conflicts.md`.
- **CI passes locally but fails on push**: `.agent/workflows/debug-ci-failures.md`.

## Two-track documentation

This project deliberately separates human docs from agent context. Don't conflate them.

- **`docs/`** — for human developers. Architecture decisions, setup guides, migration histories. Stable, narrative, audience = a person onboarding. Subfolders: `docs/architecture/` (e.g. `authentication-architecture.md`, `design-decisions.md`, `architecture-review.md`, dated audits), `docs/guides/` (`r2-cors-setup.md`, `r2-cdn-setup.md`, `push-notifications.md`, `blog-content-guideline.md`, `cloudflare-image-transformations-setup.md`), `docs/migrations/` (completed migrations: `storage-migration.md`, `descope-convex-integration.md`, `email-notifications-update.md`). Read these when you need the *why* behind a decision or a one-time setup procedure.
- **`.agent/gatheredContext/`** — agent-owned semantic memory. Written by agents, for agents. Captures implementation patterns, trade-offs, gotchas, and the "what's actually true in the code right now" snapshot of each domain. Audience = future Claude / AI sessions. **You both read and write this.** When you discover a non-obvious pattern, fix a subtle bug, or make a trade-off mid-task, update the relevant file here so the next session inherits it.

The split is codified in `docs/README.md` ("For AI Agents" vs "For Human Developers") and `.agent/gatheredContext/INDEX.md` (Update Guidelines).

### Read order before non-trivial work

Start at **`.agent/gatheredContext/INDEX.md`** — the canonical map by task type. Highest-value files:

- `infrastructure/database.md` — schema, query patterns, indexes, soft delete, rate-limit table, mutation patterns.
- `infrastructure/storage.md` — R2 reference format (`r2:path`), presigned URL CORS gotcha, folder layout, legacy fallback chain.
- `features/authentication.md` — Descope+Convex hybrid, frontend/backend env var split, user-sync race, auth error recovery hooks.
- `features/image-upload.md` — adaptive compression flow, `ImageState` shape, edit-mode pattern. Authoritative on quality (85–92%, 2048px) over the older "always 90%" line in `global-guideline.md`.
- `features/notifications.md`, `features/admin.md`, `features/pwa.md`.
- `frontend/ui-patterns.md`, `frontend/responsive-design-best-practices.md`, `frontend/state-management.md`, `frontend/routing-navigation.md`, `frontend/architecture.md`.
- `meta/features-map.md` (feature → component inventory), `meta/tech-stack.md`, `meta/data-schema.md`.

For human-facing architecture context (the *why*), cross-reference `docs/architecture/` — e.g., `authentication-architecture.md` is the longer narrative companion to `gatheredContext/features/authentication.md`.

### `.agent/rules/`
- `global-guideline.md` (always-on cross-platform), `web-app-guideline.md` (web only), `kmp-native-app-guideline.md` (mobile only). The image-quality rule in `global-guideline.md` is stale — see Storage section.

### `.agent/skills/` (9 skills with executable scripts)
- `convex-utility/` — mutation/query templates enforcing auth + soft-delete + ownership patterns.
- `r2-storage-manager/` — CORS-safe presigned URL patterns; `scripts/check-env.sh` to verify R2 env vars. (A `list-bucket.mjs` was once listed here but doesn't exist — to list the bucket, use the AWS SDK inline; see `.agent/workflows/debug-vercel-deployments.md`.)
- `responsive-ui-auditor/` — `scripts/audit-responsive.sh <file>` flags `100vh`, fixed widths, missing `md:` prefixes.
- `visual-consistency-auditor/` — `scripts/audit-design-system.sh <file>` flags hardcoded hex/pixel values. Design tokens: brand primary `#dc3626` (the `bg-primary` DEFAULT / `--primary`; `#ef4444` survives only as the lighter `primary-500` shade), neutrals `#242428` / `#71717a` / `#dbdbe4`, fonts `Plus Jakarta Sans` (body) + `Fraunces` (headings, via `font-display`), Phosphor icons at 16/20/24px (the app-wide icon library; lucide-react survives only for DB-slug category icons — see `src/lib/categoryIcons.tsx` and the admin picker). NOTE: the skill's own `SKILL.md` still lists `#ef4444` — treat this line as the source of truth.
- `test-stress-tester/` — `scripts/run-repeatedly.sh <test-file> <iterations>` for hunting flakes.
- `pwa-mobile-optimization-manager/`, `mobile-ux-optimizer/`, `kmp-ui-bridge/` (web↔Compose translation table).
- `blog-writer/` — house voice + plain-language (Grade 6–8) guardrails + SEO/GEO topic-selection for `src/content/blog/` posts. `scripts/audit-readability.mjs <post.md>` scores Flesch reading ease and flags long sentences, passive voice, and jargon. Contract lives in `docs/guides/blog-content-guideline.md` (that guideline wins on any conflict).

### `.agent/workflows/` (procedures)
- `verify-changed-files.md` — pre-completion checklist.
- `run-single-test.md`, `set-admin-user.md`, `debug-ci-failures.md`, `fix-port-conflicts.md`, `kill-hung-processes.md`, `git-quick-commands.md`.
- `debug-vercel-deployments.md` — stale/skipped Vercel builds, redeploy races, verifying CDN cache (GET not HEAD).

### When you finish a task, update the right place

| Discovery | Where to write |
|---|---|
| New implementation pattern, code example, or non-obvious bug fix | `.agent/gatheredContext/<domain>.md` (update existing file; create only if no domain fits) |
| Coding standard or rule that should always apply | `.agent/rules/` |
| Repeatable procedure (commands, recovery steps) | `.agent/workflows/` |
| Architecture decision or design rationale | `docs/architecture/design-decisions.md` |
| Setup/configuration procedure for humans | `docs/guides/` |
| Completed migration narrative | `docs/migrations/` |

Prefer updating an existing `gatheredContext/` file over creating a new one. If you contradict a previous note (e.g., a rule that's drifted from the code), correct it in place — don't leave the stale note alongside.

## Cursor rules

`.cursor/rules/convex_rules.mdc` enforces the modern Convex function syntax (object form with `args`, `returns`, `handler`) and validator usage. Apply these when writing new Convex functions.

## Deployment

- Convex env vars (Convex dashboard): `CONVEX_AUTH_ISSUER` (e.g. `https://api.descope.com/<DESCOPE_PROJECT_ID>`), `DESCOPE_PROJECT_ID`, R2 credentials, Resend keys, `IMAGE_CLEANUP_RETENTION_DAYS` (optional, default 30).
- Vercel env vars: `VITE_CONVEX_URL`, `VITE_DESCOPE_PROJECT_ID`, `VITE_R2_PUBLIC_URL` (public image CDN host; omit to fall back to presigned image reads).
- `vercel-build.sh` is the Vercel build entry point (production runs `npx convex deploy --cmd 'npm run build'` — a real build takes minutes; a Vercel deployment marked Ready in seconds means the build was skipped and old output reused: see `.agent/workflows/debug-vercel-deployments.md`).
- `npm run build` is `vite build && tsx scripts/generate-og-assets.ts` — the second step renders every blog post's Open Graph share card + the default brand card at build time. If it fails, the whole deploy fails; check this step specifically, not just the Vite build. Requires **Cloudflare Image Transformations enabled** on the `flyerboard.com.au` zone for share-card images to load (dashboard toggle, not code — see `docs/guides/cloudflare-image-transformations-setup.md`); if disabled, `/cdn-cgi/image/...` URLs 404 and share previews break even though the app itself works fine.
