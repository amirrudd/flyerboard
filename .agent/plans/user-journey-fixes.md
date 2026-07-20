# Fix Plan: User Journey Audit Findings (2026-07-19)

Source: 9 parallel domain audits mapped all user journeys (see [`docs/USER_JOURNEYS.md`](../../docs/USER_JOURNEYS.md)), then 4 independent adversarial verification passes re-confirmed every flagged finding against live code with file:line citations. **All 11 findings below are CONFIRMED (one PARTIALLY, noted).** Nothing here is speculative — every task cites the exact line to change and the exact existing pattern to copy.

Ordered by severity. Each phase is independently shippable — do not batch phases into one PR; each is its own review unit.

---

## Phase 0: Documentation Discovery (already complete)

Findings were extracted from live code, not invented. "Allowed APIs" for these fixes are patterns **already used elsewhere in this codebase** — copy them, don't invent new ones:

- Admin gating pattern: `requireAdmin(ctx)` — see `convex/categories.ts:72,134,224` (the 3 correctly-gated sibling mutations in the same file as the bug).
- Notification scheduling pattern: `convex/messages.ts:90-166` (`sendMessage`) — the reference implementation with both push (`ctx.scheduler.runAfter(0, internal.notifications.pushNotifications.notifyMessageReceived, ...)`) and email (`ctx.runMutation(internal.notifications.pendingEmailNotifications.queueEmailNotification, ...)`), each gated on its feature flag.
- Rate-limit pattern: `checkRateLimit(ctx, userId, "sendMessage")` — see `convex/messages.ts:102`; configs already exist in `convex/lib/rateLimitConfig.ts:36-37` (`sendMessage` 60/60s, `createChat` 20/hr) — **do not add new config entries, they're already there, just call the guard.**
- Soft-delete guard pattern on chat/ad resolution: `convex/adDetail.ts:264-269` (`if (!ad || ad.isDeleted) throw ...`) — already correct in this file; `messages.ts` and `posts.ts` need the same shape.

Anti-pattern guard: do not invent a new rate-limit config, a new notification-queue mechanism, or a new admin-check helper. Every fix below is "call the thing that already exists, in the place that's currently missing it."

---

## Phase 1 — CRITICAL: Gate or remove the ungated categories mutation

**File:** `convex/categories.ts:264` (`updateCategories`)

**What:** This is a public `mutation` (not `internalMutation`) with no `requireAdmin` call. It deletes every row in `categories` and reseeds a hardcoded 11-item list. Its 3 sibling CRUD mutations in the same file (`:72`, `:134`, `:224`) are correctly gated — copy that pattern, or remove the mutation entirely (preferred, since it's marked `@deprecated` and the admin Categories tab already provides equivalent CRUD).

**Do:**
1. Delete `updateCategories` from `convex/categories.ts` (lines ~258-290, the whole `// LEGACY MUTATION` block).
2. Delete the dead caller `handleUpdateCategories` in `src/pages/HomePage.tsx:112` (confirmed unreferenced/never rendered — verify with `grep -rn handleUpdateCategories src/` before deleting, should be 1 definition + 0 real call sites).
3. If Convex codegen complains about a removed public API being referenced elsewhere, `grep -rn "api.categories.updateCategories" src/` first — if any live caller exists, stop and re-scope (should be none per audit).

**Verification:**
- `grep -n "requireAdmin" convex/categories.ts` — every remaining mutation should have it.
- `npm run lint` passes (regenerates Convex types, will fail loudly if a frontend caller still references the deleted export).

**Anti-pattern guard:** do not convert to `internalMutation` if deleting is viable — an unused deprecated public mutation is a bigger footgun than no mutation at all.

---

## Phase 2 — HIGH: Buyer messages from ad-detail never notify the seller

**Files:** `convex/adDetail.ts` (`sendFirstMessage` ~189-244, `sendMessage` ~249-286) vs. reference `convex/messages.ts` (`sendMessage` 90-166)

**What:** Confirmed by grep — zero `runAfter`/`scheduler`/notification calls in `adDetail.ts`. `AdDetail.tsx:88-89,192,199` is the actual frontend caller for the ad-detail message flow, so this is not a dead code path — it's the primary "message seller from an ad" entry point, silently un-notifying.

**Do (in `convex/adDetail.ts`):**
1. After the message insert in both `sendFirstMessage` and `sendMessage`, add the same two scheduler calls `messages.ts:136-144` (push) and `:155-164` (email) make — same args shape, same feature-flag gating (`ENABLE_PUSH_NOTIFICATIONS` / `ENABLE_EMAIL_NOTIFICATIONS`).
2. Same functions currently call no `checkRateLimit` (see Phase 2b below) — bundle that fix into this same PR since it's the same two functions, same root cause (adDetail.ts drifted from messages.ts).
3. Also fix `messages.ts:132,151` — both currently gate notification-scheduling on `(chat.adId || chat.saleEventId)`, omitting `chat.bundleId` (confirmed to exist per schema, `chat.bundleId` unset only for non-bundle chats). Change both conditions to `(chat.adId || chat.saleEventId || chat.bundleId)`.

**Do (2b — rate limiting, same files):**
4. Add `await checkRateLimit(ctx, userId, "createChat")` before the chat-insert in `sendFirstMessage`, and `await checkRateLimit(ctx, userId, "sendMessage")` before the message-insert in `sendMessage` — configs already exist, just call them (copy `messages.ts:102`).

**Verification:**
- Manually test: sign in as buyer A, open an ad owned by seller B (dev/test seller with push+email test config), send first message + follow-up → confirm seller B receives both push (if flag on) and queued email.
- Manually test: open a bundle thread as buyer, seller replies from `/messages` → confirm buyer gets notified (bundle path was previously silent).
- `npm run lint` passes.

**Anti-pattern guard:** don't refactor `adDetail.ts`/`messages.ts` into one shared implementation as part of this fix — that's a bigger, separate refactor (flag it as a follow-up, don't scope-creep this PR). Just bring `adDetail.ts` up to parity.

---

## Phase 3 — HIGH: Dashboard delete-flyer is dead UI

**File:** `src/features/dashboard/UserDashboard.tsx`

**What:** Confirmed — `setShowDeleteConfirm` (declared line 426) is only ever called with `null` (lines 715, 1469, 1485). No call site opens it with an ad id. `MyAdCard` (props at 206-216) exposes `onEdit`, `onOpenMessages`, `onToggleStatus`, `onManageBundle`, `onAddToBundle` — no `onDelete`. The modal (1466-1500) and `handleDeleteAd` (711, calling `api.posts.deleteAd` correctly) are fully wired but unreachable.

**Decision needed before implementing — this is a product call, not a code call:** should dashboard delete be re-enabled, or was it deliberately removed (e.g. in favor of the `/post` edit-form delete path)? **Ask the user before writing code for this phase.** If "yes, re-enable":

**Do:**
1. Add an `onDelete?: () => void` prop to `MyAdCardProps` (~line 216) and a delete action (icon button, e.g. alongside the existing Toggle/Edit actions) in the `MyAdCard` render.
2. Wire it in the parent: `onDelete={() => setShowDeleteConfirm(ad._id)}`.
3. No other changes needed — the modal and `handleDeleteAd` are already correct.

**If "no, remove it":** delete the modal JSX (1466-1500), `showDeleteConfirm` state (426), and `handleDeleteAd` (711-720) — dead code cleanup, ~40 lines removed.

**Separately note (no action needed unless asked):** no `restoreAd` mutation exists anywhere in `convex/` — soft-deleted ads are not recoverable by the user today. If dashboard delete is re-enabled, consider whether restore should ship alongside it (ask the user; out of scope for this phase unless they want it bundled).

**Verification:**
- Manual: dashboard → delete a test flyer → confirm it disappears from "My Flyers" and from the home feed, `isDeleted`/`deletedAt` stamped in Convex dashboard.
- `npm run lint` passes.

---

## Phase 4 — HIGH: Moving Sale — no "mark item sold" UI

**Files:** `convex/saleEvents.ts:364` (`setItemSold`, exists, unused) + wherever the sale item list renders (public sale page seller view / `PublicSaleView.tsx`, dashboard sale management)

**What:** Confirmed — `grep -rn "setItemSold" src/` returns zero real callers. The mutation is correct and ready; there's no button.

**Do:**
1. Identify the seller-facing item list on the public sale page (`PublicSaleView.tsx`, per the "Sold badge/grayscale" reference at lines ~276,285,289 from the original audit) or wherever the seller manages their own live sale's items.
2. Add a "Mark sold" action per item, visible only to the sale owner, calling `useMutation(api.saleEvents.setItemSold)`.
3. Follow the existing pattern for owner-only actions on this page (there should be an `isOwner`/`isMine` check already gating other seller-only UI — reuse it, don't invent a new ownership check).

**Verification:**
- Manual: as the sale owner, mark an item sold → confirm the sold badge/grayscale (already implemented in `PublicSaleView.tsx`) renders for buyers viewing the public page.
- `npm run lint` passes.

**Anti-pattern guard:** this phase only wires the UI to the existing mutation — do not touch `setItemSold`'s backend logic, it's already correct (per audit, "Not broken" section).

---

## Phase 5 — HIGH: Moving Sale — no edit/delete/end for a live sale

**Files:** `src/features/movingSale/MovingSaleFlow.tsx:68-76` (resume routing), `convex/saleEvents.ts` (no `deleteSaleEvent`/`endSaleEvent`), `src/features/movingSale/steps/ReviewStep.tsx` (draft-only edit)

**What:** Confirmed — resuming an `active` sale always routes to `"share"`, never `"review"`; no delete/end mutation exists; the "Ended" status badge in `MovingSalesTab.tsx` is dead (nothing ever sets `status: "ended"`).

**This is the largest phase — scope it as its own mini-plan before coding, and confirm with the user which of these three sub-problems they want fixed now vs. deferred:**

1. **Edit a live sale's items** — would need `ReviewStep` (or a new lightweight editor) reachable from an active sale, plus deciding whether edits to a *live* sale need different guardrails than draft edits (e.g., don't let editing reset `status` back to draft).
2. **End/delete a live sale** — needs a new `endSaleEvent` (or `deleteSaleEvent`) mutation. Follow the soft-delete convention used elsewhere (`ads.isDeleted`/`deletedAt`) rather than hard-deleting sale rows — check `convex/schema.ts` for the `saleEvents` status enum first; likely just needs a `status: "ended"` transition + timestamp field, not a new soft-delete flag.
3. **Wire the dashboard "Ended" badge** — once `status: "ended"` is a reachable state, the badge in `MovingSalesTab.tsx:13` will just work (it's already reading `status`).

**Do NOT start coding this phase without user confirmation on scope** — unlike Phases 1-4 and 6-11 (clear bug fixes with one obvious correct behavior), this phase is closer to a small feature addition (new mutation, new state transition, new UI surface) and deserves a scope check.

**Verification (once scoped):**
- Manual: publish a test sale, edit an item, confirm the change reflects on the public page without corrupting `status`.
- Manual: end a sale, confirm it stops accepting messages/appearing as "active" in the feed, and the dashboard badge updates.
- `npm run lint` passes.

---

## Phase 6 — MEDIUM: Soft-deleted flyers still messageable via `messages.sendMessage`

**File:** `convex/messages.ts` `sendMessage` (90-168)

**What:** Confirmed (partially — nuance: `adDetail.sendMessage` already has this guard at lines 264-269; `messages.sendMessage` does not). Whichever UI path is live for the unified inbox reply flow uses `messages.sendMessage`, so this is real exposure there.

**Do:**
1. Copy the guard from `convex/adDetail.ts:264-269` into `convex/messages.ts` `sendMessage`, right after `chat.adId` is resolved: `if (chat.adId) { const ad = await ctx.db.get(chat.adId); if (!ad || ad.isDeleted) throw new Error(...); }`.
2. Also fix `posts.getSellerChats` (`convex/posts.ts:400`) and `getBuyerChats` (`convex/posts.ts:456`) — both resolve the ad with no `isDeleted` check, so the thread's "View flyer" affordance and composer-enabled state are wrong for deleted ads. Add the same soft-delete check when building the thread-meta response (mirror however `src/features/messages/helpers.ts` `getThreadMeta` already treats a missing ad — a deleted ad should be treated the same as "ad not found", not "ad available").

**Verification:**
- Manual: delete a flyer that has an active chat thread → confirm the thread shows "No longer available" and the composer disables/blocks send.
- `npm run lint` passes.

---

## Phase 7 — MEDIUM: Partial-create orphan flyer on upload failure

**File:** `src/features/ads/PostAd.tsx` (`performUpload`, ~318-387)

**What:** Confirmed — `createAd` (line 318, `images: []`, `isActive: true`) runs before the upload loop; the `catch` (385-387) only toasts, never rolls back the created ad.

**Do:**
1. In the `catch` block, if `createAd` already succeeded (i.e., we have an `adId` and we're in the create — not edit — path) and the subsequent upload/`updateAd` step failed, call `posts.deleteAd` (soft-delete, existing mutation, already ownership-checked) on that `adId` before showing the error toast, so the orphan doesn't persist as a live imageless listing.
2. Do not hard-delete — use the existing soft-delete mutation, consistent with the project-wide soft-delete rule.

**Verification:**
- Manual: throttle/kill network mid-upload during ad creation → confirm the partially-created ad does not appear in the feed or dashboard afterward (check it's soft-deleted in the Convex dashboard, not still `isActive`).
- `npm run lint` passes.

**Anti-pattern guard:** don't switch `createAd` to run *after* uploads (bigger reorder, changes the R2 folder-keying-by-postId pattern documented in `gatheredContext/infrastructure/storage.md` — out of scope).

---

## Phase 8 — MEDIUM: Support form is a stub

**File:** `src/pages/SupportPage.tsx:22-26`

**What:** Confirmed — `handleSubmit` only calls `logDebug(...)` then shows a success toast. No request is ever sent.

**Do — needs a product decision on the backend target, ask the user:**
- Option A: wire it to Resend (already integrated per `@convex-dev/resend` component, used elsewhere for notifications) — add a `convex/support.ts` mutation that queues an email to a support inbox address.
- Option B: if there's no real support inbox yet, remove the misleading success state and show a "coming soon" / mailto: fallback instead, so users aren't told something happened when it didn't.

**Do not silently pick one** — this is a user-trust issue (false confirmation), not a pure code bug; confirm the desired backend before implementing.

**Verification:** once scoped — manual submit → confirm email/ticket actually arrives, or confirm the honest fallback UI renders instead.

---

## Phase 9 — MEDIUM: Bundle CTA offers ineligible exchange-type ads

**Files:** `src/features/dashboard/UserDashboard.tsx:298` vs. `convex/bundles.ts:210-216` (`createBundle`), `:527` (`getEligibleAdsForBundle`)

**What:** Confirmed — dashboard eligibility check omits `listingType !== "exchange"`; bundle-side logic already rejects/flags it.

**Do:**
1. In `UserDashboard.tsx:298`, add `&& ad.listingType !== "exchange"` to the `eligible` check, matching the two backend checks exactly (same field name, same value).

**Verification:**
- Manual: an exchange-listing ad no longer shows "Add to a bundle" on the dashboard card.
- `npm run lint` passes.

**Anti-pattern guard:** one-line fix — don't touch `BundleFlow.tsx`'s ineligible-tile-can't-be-deselected behavior as part of this (that's now unreachable once the CTA itself excludes exchange ads, so no further change needed there).

---

## Final Phase — Verification

1. Run `npm run lint` after every phase (not just at the end) — it's the closest thing to CI (eslint → tsc convex → tsc build → convex regen → vite build).
2. For each phase touching a Convex mutation, re-run `grep -n "requireAdmin\|getDescopeUserId\|checkRateLimit"` on the touched file to confirm no auth/rate-limit regression was introduced elsewhere in the same file.
3. Update the relevant `USER_JOURNEYS.md` doc for each fixed flow — flip it from "broken" back to a normal Given/When/Then entry (all 9 docs already exist per the July 2026 audit, see `docs/USER_JOURNEYS.md`).
4. Update `docs/USER_JOURNEYS.md`'s "Consolidated broken / half-wired flows" section — remove each item as its phase ships.
5. Bump `Last Updated` / correct any stale note in the relevant `.agent/gatheredContext/features/*.md` file touched by the fix (e.g., `messaging.md` once notification gaps are closed).

## Anti-Patterns to Prevent (global, all phases)

- Do not add new abstractions (no new "notification service," no new "rate limit wrapper") — every fix here is calling an existing helper from a new call site.
- Do not hard-delete anything — soft-delete (`isDeleted`/`deletedAt`) is the project-wide rule, no exceptions.
- Do not batch Phases 5 and 8 into code without asking the user first — both require a product scope decision, not just a bug fix.
- Do not skip `npm run lint` between phases — Convex codegen regenerates on that command and will catch a broken frontend/backend contract immediately.
