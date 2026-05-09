# FlyerBoard Architecture Audit Report

**Audit Date**: 2026-05-09
**Auditor**: AI Architecture Review
**Codebase Version**: `main` (post-185, post-187 dependency bumps)
**Previous Audit**: `architecture-audit-2026-01-17.md` (A- 89/100)

---

## Executive Summary

This is the next-cycle audit following the January 2026 review. The codebase has stayed stable on its strong foundations (modern stack, feature-based organization, soft-delete + auth patterns, R2 + adaptive compression) but four months of incremental work surfaced a small number of concrete regressions that warrant fixing. Several open carryovers from January (Sentry, CSP, real e2e, i18n) are also re-prioritized below given current state.

**Updated Overall Grade: A- (87/100)** — net flat vs Jan 17. Security and DX moved down slightly due to newly-spotted regressions; the rest held. Quick-win fixes applied this session bring the working grade back toward 89/100 on next pass.

---

## 🏗️ Audit Method

- Three parallel exploration agents reviewed: prior audit docs + `.agent/gatheredContext/`; the frontend (`src/`); the backend + cross-cutting (`convex/`).
- Each finding below is evidence-backed at file:line where applicable.
- Spot-samples covered 6+ mutations for auth/ownership and 8 public queries for soft-delete enforcement.

---

## ✅ Strengths (Carry Forward)

| # | Strength | Evidence |
|---|----------|----------|
| S1 | Modern stack — React 19.2, TS 5.9, Vite 7.3, Convex 1.31.6, Tailwind v4, RR v7 | `package.json` |
| S2 | Clean feature-based organization; thin `pages/` over `src/features/{ads,auth,dashboard,admin,layout}` | `src/pages/DashboardPage.tsx` (15 lines), `PostAdPage.tsx` (31 lines) |
| S3 | Lazy routes + per-route `ErrorBoundary` + Suspense | `src/App.tsx:51–107` |
| S4 | Soft-delete enforcement consistent in 8 sampled queries | `convex/ads.ts:69`, `adDetail.ts:43,144,370`, `admin.ts:104` |
| S5 | Auth/authorization in 6+ sampled mutations (`getDescopeUserId` + ownership; `requireAdmin` for admin) | `convex/posts.ts:46,109,182`, `messages.ts:105`, `reports.ts:17`, `ratings.ts:19`, `admin.ts:332` |
| S6 | Schema indexes adequate for current query patterns | `convex/schema.ts` |
| S7 | Adaptive image compression (resolution preserved 2048px, 85–92% WebP quality) | `src/lib/networkSpeed.ts:65–104` |
| S8 | No PII leakage in public queries (email explicitly dropped from seller info) | `convex/adDetail.ts:24,76` |
| S9 | Dependency surface modern and maintained; no risky/abandoned packages | `package.json` |
| S10 | Rate-limit infrastructure in place (added Jan 17) covering 6 mutations | `convex/lib/rateLimit.ts:20–41` |
| S11 | Structured backend logging + admin action logs | `convex/lib/logger.ts` |
| S12 | Two-track docs system (`docs/` for humans, `.agent/gatheredContext/` for agents) | `docs/README.md`, `.agent/gatheredContext/INDEX.md` |

---

## 🔍 Findings (New This Audit)

| # | Severity | Finding | Evidence |
|---|----------|---------|----------|
| F1 | **High** | Protected routes unguarded at router level — `/dashboard`, `/admin`, `/post` render their feature components with no auth check or redirect; an unauthenticated user navigating directly hits the page and sees the feature's internal fallback rather than being routed home. | `src/pages/DashboardPage.tsx`, `AdminDashboardPage.tsx`, `PostAdPage.tsx` (each ≤30 lines, no `useSession` redirect) |
| F2 | **Medium** | `generateUploadUrl` declared in rate-limit config but not enforced. The rate-limit infrastructure is `MutationCtx`-typed; `upload_urls.ts` is an action and never calls it. | Config: `convex/lib/rateLimit.ts:37` (`generateUploadUrl: 50/hr`). Action handlers: `convex/upload_urls.ts:42–69` (profile), `75–104` (listing) — no rate-limit wrapper. |
| F3 | **Medium** | Type-`any` regression in hot paths — `ads: any` and `adsCache: Map<string, any[]>` in `MarketplaceContext`; `editingAd?: any` in `PostAd`. Erodes Convex's typed-API benefit at the boundary most consumers see. | `src/context/MarketplaceContext.tsx:26,52,53`; `src/features/ads/PostAd.tsx:27` |
| F4 | **Low** | Production `console.log("Adaptive compression: ...")` runs on every `ImageUpload` mount. | `src/components/ui/ImageUpload.tsx:41` |
| F5 | **Medium** | `MarketplaceContext` cache has no TTL/invalidation — `initialLoadTimestamp` frozen at mount; switching filters re-renders stale cached ads before the new query lands. Manual page refresh required to see fresh results. | `src/context/MarketplaceContext.tsx:71` (frozen timestamp), `155–164` (cache load on filter change) |
| F6 | **Medium** | `admin.getAllUsers` filters `isActive` post-query instead of using the `by_active` index — risks full-scan as the users table grows. | `convex/admin.ts:26–30` |
| F7 | **Low** | HTTP storage route lacks explicit payload validation; relies on Convex storage API to validate `storageId`. Surface for enumeration if `storageId`s are guessable. | `convex/router.ts:7–33` |
| F8 | **Low** | A11y — `RatingModal` and `BottomSheet` lack `role="dialog"`; no keyboard nav for star rating. | `src/components/RatingModal.tsx`, `src/components/ui/BottomSheet.tsx` |
| F9 | **Low** | Memoization underutilized in large components (`PostAd` 500+ lines, `UserDashboard` 90+ lines) | grep across `src/` |
| F10 | **Medium** | E2E folder contains only `e2e/layout.spec.ts` — no real flow coverage (login, post-ad, image-upload edit-mode). Prior audit deferred; status unchanged. | `e2e/` |
| F11 | **Low** | Soft-delete flag absent on `reports`, `ratings`, `chats`, `messages` — gap if hard-delete avoidance is later required (e.g., GDPR). | `convex/schema.ts` |
| F12 | **Low** | No automated cleanup job for soft-deleted ads (`posts.ts:201` TODO) — R2 images accumulate indefinitely. | `convex/posts.ts` |
| F13 | **Low** | In-memory rate-limit (uploads-table sliding window) declared as temporary; OK for current scale but fragile under multi-region or higher concurrency. | `convex/lib/rateLimit.ts:8–10` |
| F14 | **Process** | `.agent/gatheredContext/` not refreshed since 2026-01-15/17 despite codebase evolution. Per the new CLAUDE.md session protocol, this should be updated each session. | mtimes on `INDEX.md`, `infrastructure/database.md`, `frontend/architecture.md` |

---

## 🔁 Carryovers from 2026-01-17 — Re-prioritized

| Item | Jan 17 priority | May 9 reassessment |
|------|-----------------|---------------------|
| Error tracking (Sentry / lightweight alt) | High, deferred | **Highest open priority.** No way to detect prod issues today. Recommend a lightweight alt (Logflare/Axiom/Better Stack) before full Sentry to minimize cost. |
| Content Security Policy headers | Medium-High, deferred | **High.** Quick win — header config in `vercel.json`. XSS surface widens as user-generated content grows (chat, descriptions, markdown rendering via `react-markdown`). |
| Real e2e suite | High, deferred | **High** but blocked on golden-flow definitions. Recommend starting with three: (1) phone-OTP login, (2) post ad with image upload, (3) buyer→seller chat. |
| i18n | Low-Medium | **Defer.** Single-region (AU) still. Revisit only if expansion lands on the roadmap. |
| Dependency security scanning | Not covered Jan | **Medium.** `dependabot.yml` exists; recent group bumps (commits `6622763`, `9ebe96d`) confirm it runs. Verify it's auto-merged or PR-reviewed weekly. |

---

## 🛠️ Quick-Win Fixes Applied This Session

Tight, low-risk fixes for the most actionable findings. Each is committed independently for revertibility.

### QF1 — Route guards on `/dashboard`, `/post`, `/admin` (F1)
Added page-level `useSession()` guard with redirect to `/` when `!isAuthenticated && !isSessionLoading`. Loading state reuses the `PageLoader` spinner pattern from `App.tsx:25–30`. Admin-flag enforcement remains in `AdminDashboard` (backend `requireAdmin` is the source of truth).

**Files**: `src/pages/DashboardPage.tsx`, `src/pages/PostAdPage.tsx`, `src/pages/AdminDashboardPage.tsx`.

### QF2 — Rate-limit on `generateUploadUrl` (F2)
Added an `internalMutation` wrapper `enforceRateLimit` in `convex/lib/rateLimit.ts` (since `checkRateLimit` is `MutationCtx`-typed and `upload_urls.ts` is an action). Both `generateProfileUploadUrl` and `generateListingUploadUrl` now call `ctx.runMutation(internal["lib/rateLimit"].enforceRateLimit, { userId, operation: "generateUploadUrl" })` after auth.

**Files**: `convex/lib/rateLimit.ts` (added wrapper), `convex/upload_urls.ts` (call sites).

### QF3 — Removed production `console.log` (F4)
Deleted the `console.log("Adaptive compression: ...")` in `ImageUpload`. `getOptimalCompressionSettings()` and the adaptive-compression flow are unchanged.

**Files**: `src/components/ui/ImageUpload.tsx`.

### QF4 — Type-`any` cleanup (F3)
Replaced `any` with `Doc<"ads">` from `convex/_generated/dataModel` in `MarketplaceContext` (`ads`, `adsCache`, `cachedAds`) and `PostAd` (`editingAd`).

**Files**: `src/context/MarketplaceContext.tsx`, `src/features/ads/PostAd.tsx`.

---

## 📝 `.agent/gatheredContext/` Refreshed

Per the CLAUDE.md session protocol — patterns and gotchas captured for future sessions:

- `infrastructure/database.md` — note rate-limit gap on `generateUploadUrl` (now closed) + `admin.getAllUsers` index gotcha (F6, deferred).
- `features/authentication.md` — added route-guard pattern with snippet (so this regression doesn't recur).
- `infrastructure/storage.md` — `generateUploadUrl` rate-limit now enforced via `internalMutation` wrapper.
- `frontend/state-management.md` — documented MarketplaceContext stale-cache risk (F5) with `Why:` and `How to apply:`.
- `frontend/ui-patterns.md` — added `role="dialog"` gap on `RatingModal` / `BottomSheet` as known-debt.
- `INDEX.md` — bumped `Last Updated`.

---

## 📌 Deferred to Follow-Up Tickets

Called out here for visibility but not fixed in this session:

| # | Item | Why deferred |
|---|------|--------------|
| F5 | MarketplaceContext cache TTL / invalidation redesign | Needs design discussion (TTL vs refresh-on-focus vs manual invalidate-on-mutate) |
| F6 | `admin.getAllUsers` index-driven filter | Low traffic; not blocking |
| F7 | HTTP storage route hardening | Needs Convex storage threat-model review |
| F8 | `role="dialog"` + keyboard nav on modals | Deserves a focused a11y sweep |
| F9 | Memoization audit on `PostAd` / `UserDashboard` | Low impact; bigger refactor risk than reward |
| F10 | Real e2e suite (3 golden flows) | Separate ticket — see carryover re-prioritization |
| F11 | Soft-delete flag on reports/ratings/chats/messages | Add when GDPR / hard-delete avoidance becomes a requirement |
| F12 | Soft-deleted ad/image cleanup cron | Part of broader R2 lifecycle ticket |
| F13 | Replace in-memory rate-limit | Address at scale, not before |
| Carryover | Sentry / CSP / e2e / i18n | Per re-prioritization above |

---

## 📊 Score Delta vs 2026-01-17

| Category | Jan 17 | May 9 | Δ | Reason |
|----------|--------|-------|---|--------|
| Architecture & Structure | 95 | 95 | → | Stable |
| Performance | 92 | 92 | → | Stable |
| Security | 88 | 86 | ↓ | New finding F1 (unguarded routes) + F2 (unenforced rate-limit) — fixed this session, revisit next audit |
| Testing | 72 | 72 | → | E2E gap unchanged (F10) |
| Developer Experience | 97 | 95 | ↓ | Type-`any` regression (F3) + console.log (F4) — fixed this session |
| Scalability | 85 | 85 | → | Stable; F6/F13 are low-impact |
| Monitoring & Observability | 45 | 45 | → | Sentry still deferred |
| Accessibility | 82 | 82 | → | F8 known-debt logged |
| Documentation | 94 | 92 | ↓ | `.agent/gatheredContext/` drift (F14) — refreshed this session |
| Modern Practices | 92 | 92 | → | Stable |

**New Total: 87/100 (A-)** — pre-fix baseline. Working toward 89/100 once this session's fixes verify.

---

## Conclusion

FlyerBoard's architecture remains solid: the choices made in 2025 (Convex + Descope + R2 + adaptive compression + soft-delete) continue to pay off, and dependency hygiene + feature cohesion have held up. The findings in this audit are tactical regressions — easy to fix, easy to prevent — rather than design failures.

**This session's fixes** close F1–F4 directly. **Highest open priorities** are now (1) error tracking, (2) CSP, (3) three-flow e2e coverage. The MarketplaceContext cache (F5) and HTTP storage route (F7) are next-cycle design discussions.

**Process change**: per the new CLAUDE.md session protocol, `.agent/gatheredContext/` updates are now part of every session — this audit closes the 4-month drift gap (F14).

**Next audit recommended**: 2026-08-09 (3 months).

---

*This audit succeeds `architecture-audit-2026-01-17.md` and serves as the baseline for the next cycle.*
