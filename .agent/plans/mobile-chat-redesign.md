# Mobile Chat Redesign — Phased Implementation Plan

**Created:** 2026-07-10 · **Status:** ready to execute (via `/claude-mem:do`, one phase per session)
**Decision (product owner ratified):** Replace the dashboard-embedded chat with a **dedicated responsive `/messages` route** — full-screen inbox and full-screen thread on mobile, two-pane master–detail on desktop — and retarget the existing BottomNav Messages item. The dashboard chats tab becomes a redirect.

**Why this option** (over "full-screen overlay inside dashboard" or "bottom-nav only"):
1. It is the universal marketplace IA (FB Marketplace, Gumtree, Depop, Vinted, Carousell, eBay): Messages is a destination, never a dashboard sub-tab.
2. The expensive parts already exist: BottomNav with `UnreadBadge` + `useTotalUnreadCount`, a complete shared chat library in `src/features/messages/`, and URL-encoded chat state. This plan is mostly **assembly + extraction**, not new UI.
3. The overlay option leaves the inbox squeezed under dashboard chrome (the founder's exact complaint) and deepens the 1,729-line `UserDashboard.tsx` god-component.
4. `/messages/:chatId` is a real URL — better for push/email deep links, browser back, and PWA cold starts than `?tab=chats&chat=` query state.

**Branching (mandatory):** every phase works on ONE feature branch cut from origin main:
```bash
git fetch origin
git checkout -b feature/mobile-chat-redesign origin/main   # Phase 1 creates it; later phases check it out
```
Never branch off the current worktree branch. Copy `.env.local` into the worktree if running `npm run dev` (worktree gotcha).

---

## Phase 0 — Consolidated Documentation Discovery (COMPLETE — read this before every phase)

Three discovery agents mapped the code, design system, and UX baseline. Findings below are verified against source with line refs (as of 2026-07-10, origin/main ≈ `835f4de`). Line numbers may drift — re-grep if an anchor misses.

### 0.1 Allowed APIs — frontend (extend these; do NOT invent parallel ones)

Shared chat library `src/features/messages/` (barrel: `index.ts`). **The ONE sanctioned chat implementation** — extend it, never hand-roll:

| Export | Signature / props (exact) |
|---|---|
| `useInbox` | `useInbox({ flyerId?, initialFilter? = 'all', enabled? = true }) → { conversations, filter, setFilter, isLoading }` (`useInbox.ts:72`) — merges seller+buyer+sale+bundle threads, role-tags, sorts by `lastMessageAt` desc |
| `useTotalUnreadCount` | `() → number` (`useTotalUnreadCount.ts:12`) — returns 0 while signed out/loading |
| `MessageBubble` | `{ content: string; timestamp: number; isOwn: boolean }` |
| `ConversationThread` | `{ messages: ThreadMessage[]; currentUserId: string; className? }` — owns the protected scroll pattern |
| `MessageComposer` | `{ onSend: (content) => Promise<void>; disabled?; disabledReason?; placeholder? }` — Enter sends / Shift+Enter newline; keeps draft + `toast.error` on failure |
| `ConversationHeader` | `{ image?; title; subtitle?; price?; onBack?; onViewItem?; viewItemLabel? = 'View flyer'; onReport? }` |
| `InboxRow` | `{ chat: InboxChat; role: InboxRole; onOpen(chatId); onArchive?(chatId); isActive?; index? }` |
| `RoleChip` | `{ role: 'selling'\|'buying'\|'sale'\|'bundle' }` |
| `UnreadBadge` | `{ count: number; className? }` — hidden at 0, caps "99+" |
| helpers | `isSaleThread(chat)`, `isBundleThread(chat)`, `getChipRole`, `getCounterpart`, `getCounterpartName` (→ "Deleted User"), `getItemTitle` |
| types | `InboxChat`, `ThreadMessage`, `InboxRole`, `InboxFilter` (`types.ts` — structural strings, not branded Convex Ids) |

Other primitives: `BottomSheet` (`src/components/ui/BottomSheet.tsx`), `ImageDisplay` (never raw `<img>`), `ChatItemSkeleton` (in `src/components/ui/DashboardSkeleton.tsx`), `PageLoader`, `useHeaderSlots()` (Layout owns the single `Header`).

Motion — ONLY via `useMotionPrefs()` (`src/hooks/useMotionPrefs.ts:44–92`, exports `:104`): `bubbleIn(delay?)`, `listStagger(index, cap=12)`, `scalePop()`, `fadeUp`, `staggerCard`, `whileInView`, plus `reduced`. New transitions = new helpers added **inside the hook**, not inline variants. `layoutId` pills must set `duration: 0` when `reduced` (see `UserDashboard.tsx:1241`).

CSS utilities (in `src/index.css`): `.h-dynamic-screen` (`:188` — the sanctioned 100dvh), `.pt-safe`/`.pb-safe` (`:173–214`), `.pb-bottom-nav`, `--bottom-nav-height` (`:57`), `.mobile-scroll-container` (`:414`), `.modal-scroll-lock`, `.scrollbar-hide`. Mobile body is scroll-locked ≤768px (`:438–448`) — pages scroll inside designated containers.

Design tokens: semantic classes only — `bg-primary`, `text-primary-foreground`, `bg-muted`, `ring-border`, `bg-card`, `bg-bundle` (teal). Brand red = `#dc3626` = `--primary: 5 71% 51%` (lives in tokens only). Fonts: body Plus Jakarta Sans (`font-sans`), headings Fraunces (`font-display`, automatic on h1–h6). Icons: **`@phosphor-icons/react`** (NOT lucide — the visual-consistency SKILL.md is stale on this).

### 0.2 Allowed APIs — backend (all exist today; **no new Convex functions are required for v1**)

All authed via `getDescopeUserId(ctx)` (`convex/lib/auth.ts`). Never `getAuthUserId`.

| Function | Args | Notes |
|---|---|---|
| `api.posts.getSellerChats` / `getBuyerChats` | `{}` | power `useInbox`; return `[]` unauthenticated; exclude archived |
| `api.messages.getChatMessages` | `{ chatId }` | participant-checked; throws for non-participants — catch → "Conversation not found" |
| `api.messages.sendMessage` | `{ chatId, content }` | rate-limited `sendMessage: 60/min` (`convex/lib/rateLimit.ts:33`); schedules push + 10-min-batched email |
| `api.messages.markChatAsRead` | `{ chatId }` | role-aware `lastReadBySeller/Buyer` timestamps |
| `api.messages.getTotalUnreadCount` | `{}` | never throws; 0 when signed out |
| `api.messages.getArchivedChats` / `archiveChat` / `unarchiveChat` | `{}` / `{chatId}` | buyer-archived list; per-role flags |
| `api.messages.deleteArchivedChats` | `{ chatIds }` | ⚠️ HARD-deletes chat + messages for BOTH sides — known product gap, do NOT change in this project |
| `api.messages.getAdChats` | `{ adId }` | seller per-ad inbox (AdMessages) |
| `api.saleChats.getSaleThread` / `sendSaleMessage`, `api.bundleChats.getBundleThread` / `sendBundleMessage` | — | sale/bundle threads share the `sendMessage` rate bucket |

Schema (`convex/schema.ts:52–82`): `chats` has exactly one of `adId`/`saleEventId`/`bundleId` (mutation-enforced), `buyerId`, `sellerId`, `lastMessageAt`, `lastReadBy*`, `archivedBy*`. `messages`: `chatId, senderId, content, timestamp`. Read state is per-role timestamps on the chat, not per-message. `getChatMessages` uses `.collect()` — no pagination (accepted for v1).

### 0.3 Canonical patterns to COPY (file:line)

| Pattern | Copy from |
|---|---|
| Auth+sync gate (`ready = isAuthenticated && !isSessionLoading && isUserSynced` → `useQuery(fn, ready ? {} : "skip")`) | `src/features/messages/useInbox.ts:76–88` |
| Lazy route + ErrorBoundary + Suspense | `src/App.tsx:16–30, 96–102` |
| Protected chat scroll (outer `flex-1 min-h-0 overflow-y-auto`, inner `min-h-full justify-end`) | `ConversationThread.tsx:47–64` — copy verbatim, never modify |
| Mobile full-screen chat via portal (escapes `<main>`'s `contain: paint`) | `src/features/ads/AdMessages.tsx:80, 109, 206–209` |
| URL-as-single-source-of-truth params writer | `UserDashboard.tsx:161–173, 597–598` |
| Mark-as-read effect keyed on chat param | `UserDashboard.tsx:368–374` |
| Thread meta (per-kind view label/route/composer-disabled reason for sale/bundle/flyer) | `UserDashboard.tsx:691–719` |
| Segmented All/Selling/Buying filter pill | `UserDashboard.tsx:1238–1263` |
| Master–detail grid + active-row highlight | `UserDashboard.tsx:1265–1345` |
| BottomSheet + thread nesting (avoid double scroll): wrap in `flex flex-col min-h-0 max-h-[50dvh]` | `AdDetail.tsx:941–947` |
| BottomNav hooks-above-early-return + `/blog` hiding | `BottomNav.tsx:20–25` |
| Page auth redirect | `src/pages/DashboardPage.tsx` |

### 0.4 Anti-pattern guards (grep-checkable; apply to EVERY phase)

- ❌ `getAuthUserId` — Descope only (`getDescopeUserId`).
- ❌ New chat primitives / second composer outside `src/features/messages/`.
- ❌ `100vh` in mobile chat surfaces — use `.h-dynamic-screen` / `100dvh` / `fixed inset-0`. (The old dashboard pane violates this at `lg:` — do not copy `UserDashboard.tsx:1312`'s `lg:h-[calc(100vh-320px)]` habit into new code.)
- ❌ `justify-end` on the thread's outer scroll container, or `flex-col-reverse`.
- ❌ Two writers for URL params / `setActiveTab`+`setSearchParams` ping-pong — caused an infinite-loop OOM once (`UserDashboard.tsx:400–442`). URL is the single writer, `replace: true` for shims.
- ❌ Querying chat data before user-sync (the `isUserSynced` race → "Not authenticated" errors).
- ❌ Hardcoded hex, px container widths, raw `<img>`, lucide-react imports, a second animation library, manual `prefers-reduced-motion` checks.
- ❌ `position: fixed` inside `<main>` (it has `contain: layout style paint` → becomes containing block). Use `createPortal(…, document.body)`.
- ❌ Inputs with font-size < 16px (iOS zoom); touch targets < 44×44px.
- ❌ Assuming `deleteArchivedChats` is one-sided — it is a two-sided hard delete; surface a scary confirm, don't change semantics.
- Doc-staleness traps: `routing-navigation.md` lists a `/messages` route that (pre-this-project) does NOT exist; `messaging.md:38` says deep links must use `?tab=chats` — this project deliberately inverts that rule and must update both docs (Phase 6). `visual-consistency-auditor/SKILL.md` cites lucide + `#ef4444` — both stale.

### 0.5 Current pain (what we're fixing — evidence)

1. BottomNav "Messages" → `/dashboard?tab=chats`: full dashboard shell (profile card, banners, tab chrome) renders above the inbox.
2. Thread pane height is `h-[calc(100dvh-300px)]` (`UserDashboard.tsx:1312`) — a hardcoded 300px guess nested in double scroll containers.
3. "Back" from a thread is a query-param class toggle, not navigation — OS back button diverges from visual back.
4. Composer competes with the fixed 72px BottomNav + iOS keyboard; AdMessages solved this with a body portal, the dashboard inbox never did.
5. Tests: messaging unit tests are solid (`src/features/messages/*.test.tsx`, `AdMessages.test.tsx`, `UserDashboard.test.tsx` with name-based Convex mocks + `window.innerWidth` mobile sim — NOT matchMedia); **zero e2e/visual coverage of chat** (only home/sidebar snapshots exist).

---

## Phase 1 — Branch, route scaffolding, redirects, chrome rules

**Goal:** `/messages` and `/messages/:chatId` exist behind auth; every legacy entry point lands on them; BottomNav/Header chrome behaves correctly. No inbox UI yet (placeholder body OK).

**Tasks**
1. Create branch `feature/mobile-chat-redesign` off `origin/main` (§Branching above).
2. `src/pages/MessagesPage.tsx` — lazy route registered in `src/App.tsx` copying the pattern at `App.tsx:16–30, 96–102` (ErrorBoundary + Suspense + PageLoader). Routes: `/messages` and `/messages/:chatId` (both render MessagesPage; it reads `useParams`). Preserve `?flyer=<adId>` query.
3. Auth gate: copy `DashboardPage.tsx`'s pattern — `useSession()`, `PageLoader` while `isSessionLoading`, redirect `/` when unauthenticated. Data queries additionally gate on `isUserSynced` (copy `useInbox.ts:76–88`; `useInbox` itself already does).
4. Redirect shims (must ship BEFORE any link changes): in `DashboardPage`/`UserDashboard` param handling, `?tab=chats` → `navigate('/messages', {replace:true})`; `?tab=chats&chat=X` → `/messages/X`; carry `flyer` through. **Single writer, `replace:true`** — re-read the ping-pong OOM guard (`UserDashboard.tsx:400–442`) first.
5. BottomNav: retarget Messages item `handleAuthGuard("/dashboard?tab=chats")` → `handleAuthGuard("/messages")` (`BottomNav.tsx:102–115`). Badge/`useTotalUnreadCount` unchanged. Add BottomNav hiding on `/messages/:chatId` only for `<md` (extend the `/blog` pathname check pattern, `BottomNav.tsx:23`; inbox `/messages` keeps the nav — it's a top-level destination).
6. Header chrome: on `/messages/:chatId` at `<md` the thread supplies its own header (Phase 3) — hide `PersistentHeader` via the `useHeaderSlots()` `hidden` slot. Note: `ui-patterns.md:240` reserves `hidden` for AdMessages/`!user`/admin — this project deliberately extends that reservation; record it in Phase 6 doc updates.

**Verification checklist**
- [ ] `git log --oneline -1 origin/main..HEAD` shows work only on the new branch; `git merge-base HEAD origin/main` == origin/main tip at branch time.
- [ ] Navigating to `/dashboard?tab=chats&chat=abc&flyer=x` lands on `/messages/abc?flyer=x` with no history spam (back button returns to pre-dashboard page, not a redirect loop).
- [ ] Signed-out `/messages` → auth flow; signed-in → placeholder page renders inside Layout.
- [ ] BottomNav badge still live; nav hidden only on thread route `<md`. `BottomNav.test.tsx` updated + green.
- [ ] New unit tests: redirect shim (both param shapes), auth gate. `npm run lint` green.

**Anti-pattern guards:** no second URL-param writer; hooks above early returns in BottomNav; don't touch notification link builders yet (Phase 4).

---## Phase 2 — Mobile-first inbox at `/messages`

**Goal:** full-screen inbox on `<md`, assembled entirely from the existing library.

**Tasks**
1. Page header: "Messages" in `font-display text-2xl`, overflow (`DotsThree`) menu → Archived. No search-header chrome.
2. Filter chips All/Selling/Buying under the header — port the segmented pill from `UserDashboard.tsx:1238–1263` (keep `layoutId` + `duration:0` when `reduced`), wired to `useInbox().filter/setFilter`.
3. Thread list: `InboxRow` per conversation (`onOpen={id => navigate('/messages/'+id)}`), rows ≥72px min-height, `divide-border/70`, `listStagger` on first render only. Scrolling happens in Layout's `<main>` (mobile body is scroll-locked — don't add a nested scroller).
4. Loading: `ChatItemSkeleton` ×6 while `useInbox().isLoading`. Empty states: (a) true-empty — ChatText icon, "No messages yet", subtext, CTA "Browse flyers" → `/`; (b) filtered-empty — "No selling/buying conversations yet."
5. `?flyer=<adId>` mode: dismissible chip "Showing chats about: {ad title} ✕" (title from the first matching conversation's `getItemTitle`).
6. Archived sub-view `/messages/archived`: port archive list + unarchive + bulk-delete from the dashboard chats tab (`getArchivedChats`, `unarchiveChat`, `deleteArchivedChats`). Bulk delete keeps a strong confirm dialog (two-sided hard delete!). Row-level Archive stays on `InboxRow.onArchive`.

**Verification checklist**
- [ ] 390px viewport: tap BottomNav Messages → full-screen inbox, zero dashboard chrome, one navigation.
- [ ] Filters, flyer-filter chip, archived round-trip (archive → appears in archived → unarchive) all work; unread rows bold + badge, un-bold live when read elsewhere (two-tab test).
- [ ] `./.agent/skills/responsive-ui-auditor/scripts/audit-responsive.sh` and `./.agent/skills/visual-consistency-auditor/scripts/audit-design-system.sh` clean on every new/changed file.
- [ ] Unit tests for MessagesPage inbox states (loading/empty/filtered/flyer chip) using the name-based Convex mock style from `UserDashboard.test.tsx`; jsdom `scrollIntoView` stubbed. `npm run lint` green.

**Anti-pattern guards:** no new inbox row/badge/chip components — extend `src/features/messages/` if a variant is genuinely needed; no `100vh`; no hardcoded colors.

---

## Phase 3 — Full-screen conversation at `/messages/:chatId`

**Goal:** the money screen. Mobile: portal full-screen `[header][thread][composer]`; correct keyboard, safe-area, back, and thread-kind behavior.

**Tasks**
1. Container (mobile `<md`): copy the AdMessages portal pattern (`AdMessages.tsx:80, 206–209`) — `createPortal` to `document.body`, `fixed inset-0 z-*` column (`bottom-0` is fine since BottomNav is hidden on this route), `pt-safe` on header, `pb-safe` on composer. Never `100vh`.
2. Compose from the library: `ConversationHeader` + `ConversationThread` + `MessageComposer`. Port `threadMeta` (`UserDashboard.tsx:691–719`) for per-kind context: flyer → title/price/"View flyer" → `/ad/:id`; sale → `House`/sale title/"View sale"; bundle → `Package`/bundle label; sold or `ad.isActive === false` → "No longer available" pill, strip not tappable, composer STAYS enabled (arranging pickup on a sold item is a real flow). Images via `ImageDisplay` (CDN helper; purged images fall back to placeholder).
3. Data: `getChatMessages` behind the auth+sync gate. Participant-check failure / malformed id → in-page "Conversation not found" + "Back to messages" (not the ErrorBoundary). Send via the right mutation for the thread kind (`sendMessage` / `sendSaleMessage` / `sendBundleMessage`), errors keep the draft (composer already does) + toast; rate-limit rejection toasts "You're sending messages too quickly…".
4. Mark-as-read: port the effect from `UserDashboard.tsx:368–374`, keyed on `:chatId`, gated on sync, swallowing foreign-id errors. This must fire for deep-link entries too.
5. Back semantics: header back = explicit `navigate('/messages')` (never `history.back()` — notification cold-starts have no stack).
6. Day separators ("Today"/"Yesterday"/en-AU date) — small addition inside `ConversationThread` or a wrapper in the library. Add `break-words`/`overflow-wrap:anywhere` to `MessageBubble` if missing (long URLs).
7. Keyboard: `interactive-widget=resizes-content` check on the viewport meta (`index.html:6`); re-scroll to bottom ~300ms after composer focus (iOS settle).
8. Desktop `≥md` placeholder: for this phase `/messages/:chatId` may render the mobile column centered or reuse the grid early — Phase 4 finalizes.

**Verification checklist**
- [ ] iOS Safari (or DevTools sim) + installed-PWA mode: keyboard never covers the composer; no horizontal scroll; safe-areas respected (notch + home indicator).
- [ ] Deep-link cold start `/messages/<id>` in a new tab: correct thread after auth, back → `/messages`, unread badge decrements.
- [ ] All three thread kinds render correct chips/context/links; sold-ad thread readable + sendable with "No longer available" pill; non-participant id → friendly not-found.
- [ ] Existing `ConversationThread/MessageBubble/MessageComposer` tests untouched and green; new tests: mark-as-read on mount, thread-kind meta, not-found state. Audit scripts clean. `npm run lint` green.

**Anti-pattern guards:** protected scroll pattern copied verbatim; portal (not fixed-inside-main); Enter/Shift+Enter rule untouched; no scroll/ordering re-implementation.

---

## Phase 4 — Desktop two-pane, dashboard extraction, notification links

**Goal:** desktop parity-or-better; `UserDashboard` sheds the chats tab; all new notifications link to `/messages/:chatId`.

**Tasks**
1. `≥md` on `/messages*`: two-pane — left list ~360–400px with its own scroll (inbox from Phase 2, `InboxRow.isActive` highlights the open thread), right pane thread (Phase 3 content, no portal on desktop) or centered "Select a conversation" empty state. Selecting a row = `navigate('/messages/:id')`; **no `?chat=` param anywhere in the new world**. Full height via `h-dynamic-screen`-derived flex, not `100vh` calc.
2. Remove the chats tab UI from `UserDashboard.tsx` (sections around `:1214–1347` + chat param plumbing + `threadMeta` once ported); keep the Phase 1 redirect shims. Leave a slim "Messages" pointer card/link → `/messages` so dashboard-habituated users aren't stranded. Target: **net-negative diff in UserDashboard.tsx**.
3. Retarget remaining entry points: desktop header messages icon/menu → `/messages`; dashboard sidebar unread badge → `/messages`; AdDetail post-send snackbar/link → `/messages/:chatId`; My Flyers per-ad "Messages" button (`UserDashboard.tsx:1167` → `?messages=<adId>`) → `/messages?flyer=<adId>` and retire the AdMessages full-screen portal surface if nothing else reaches it (keep `getAdChats` + files until Phase 6 confirms; delete only if zero consumers remain).
4. Notification deep links: update the link builder(s) — `convex/notifications/queries.ts` and the email/push payload builders that emit `/dashboard?tab=chats&chat=<id>` — to emit `/messages/<chatId>`. Redirect shims keep 10-min-batched in-flight emails and stale pushes working forever.
5. Update `UserDashboard.test.tsx` (remove chats-tab cases, keep redirect cases), `AdMessages.test.tsx` (retire or repoint), and notification link tests.

**Verification checklist**
- [ ] Desktop `/messages`: list+thread parity with old tab including archive + filters; refresh restores selection from URL.
- [ ] `grep -rn "tab=chats" src/ convex/` → only the redirect shim and tests of it remain.
- [ ] In-app + email notification for a new message links to `/messages/<id>` (inspect queued email payload); a legacy `?tab=chats&chat=` URL still resolves via shim.
- [ ] `UserDashboard.tsx` line count strictly decreased. Full `npm test` + `npm run lint` green.

**Anti-pattern guards:** don't delete `getAdChats`/AdMessages until consumer grep proves zero references; don't break the sidebar badge's sync gating; URL single-writer discipline in the two-pane selection.

---

## Phase 5 — Motion, a11y, resilience polish

**Goal:** the "elegant" layer — transitions, focus, live-region, send resilience — all through sanctioned channels.

**Tasks**
1. Transitions: add a `slideOver(direction)` helper INSIDE `useMotionPrefs` (x: 24→0, opacity 0→1, ~200ms `EASE`; exit reversed; collapses when `reduced`). Apply to inbox→thread on `<md`. Incoming bubbles already `bubbleIn`; badge already `scalePop`.
2. Scroll courtesy: if the user has scrolled up and a new message arrives, show a floating "↓ New message" pill (portal-free, inside the thread container) instead of auto-yanking; own-sends always scroll to bottom.
3. Optimistic send: local `pendingMessages` array keyed by client UUID merged into the `getChatMessages` result; pending = 60% opacity + clock; on reject mark "Not sent — tap to retry" (draft preserved). Keep the mutation promise independent of component lifetime (navigate-away must not lose a send — fire with toast-on-failure).
4. Offline: when Convex connection drops, banner "You're offline — messages will update when you reconnect" + composer disabled via `disabledReason`. (Queued offline send is explicitly v2 — honest disable for v1.)
5. A11y: focus to thread header on inbox→thread, restore focus to the originating `InboxRow` on back; `aria-live="polite"` region announcing new incoming messages; `UnreadBadge` gets `aria-label="N unread messages"` if missing; ad-context strip labelled "About: {title}, {price}, view listing"; keyboard-only walkthrough must pass (rows are `role="button"` with key handlers already).
6. Self-chat defense: dedupe merged inbox rows by `_id` (a self-chat would appear under both roles) — one-line guard in `mergeInboxChats` + test.

**Verification checklist**
- [ ] Reduced-motion OS setting: zero slide/stagger/pop animation, everything still usable.
- [ ] Keyboard-only: inbox → thread → send → back with visible focus at each step.
- [ ] Throttled network (DevTools Slow 3G): optimistic bubble <100ms perceived, retry works, rate-limit rejection never loses typed text.
- [ ] All motion goes through `useMotionPrefs` (grep new files for `variants={{`/`initial={{` inline usage → none outside the hook).

**Anti-pattern guards:** no manual reduced-motion checks; no second animation lib; pending-message merge must not fight the protected scroll pattern.

---

## Phase 6 — Verification sweep, e2e safety net, docs writeback

**Goal:** prove the whole thing, add the missing e2e coverage, and correct the documentation the code now contradicts.

**Tasks**
1. Full gates: `npm run lint` (eslint → tsc convex → tsc -b → convex codegen → vite build) and `npm test`. Run both audit scripts over every file changed on the branch (`git diff --name-only origin/main...HEAD -- 'src/**'`), plus `check-layout-parity.sh` on MessagesPage.
2. Grep guards (all must be clean in new/changed code): `100vh`, `getAuthUserId`, `lucide-react`, `tab=chats` (outside shims/tests), hex colors `#[0-9a-f]{6}` in src components, `history.back` in messages code.
3. New Playwright spec `e2e/messages.spec.ts`: mobile-viewport smoke — inbox renders, open thread, back returns, composer visible with keyboard-safe layout; add visual snapshots for `mobile-messages-inbox` and `mobile-messages-thread` (there is currently ZERO chat e2e coverage). `npm run test:visual`.
4. Manual checklist (390px + desktop, both themes): the 10 success criteria below.
5. Docs writeback (mandatory session protocol):
   - `.agent/gatheredContext/features/messaging.md` — new route model; INVERT the deep-link rule (now `/messages/:chatId`; `?tab=chats` is a legacy shim); AdMessages status; bump Last Updated.
   - `.agent/gatheredContext/frontend/routing-navigation.md` — `/messages` now genuinely exists (fixes the stale entry).
   - `.agent/gatheredContext/frontend/ui-patterns.md` — header `hidden`-slot reservation now includes the thread route; any new gotchas found.
   - `.agent/gatheredContext/meta/features-map.md` — MessagesPage inventory.
   - `docs/architecture/design-decisions.md` — decision record: why dedicated route over dashboard overlay (copy the "Why this option" block).
6. PR off the feature branch → `main` with before/after mobile screenshots.

**Success criteria (definition of done)**
1. 390px: Messages tap → full-screen inbox, zero dashboard chrome; thread ≤1 more tap; back preserves inbox scroll.
2. `/messages/:chatId` cold-start (new tab/notification) works post-auth; legacy `?tab=chats&chat=` redirects; zero broken notification links.
3. Composer never keyboard-obscured; no horizontal scroll; audit scripts clean.
4. Optimistic send <100ms perceived; rate-limit/failure never loses text.
5. Badge ↔ inbox ↔ mark-as-read consistent across two concurrent sessions.
6. Desktop two-pane ≥ old tab (archive, filters, sale/bundle chips).
7. All pre-existing messaging tests green; new route/redirect/thread tests + e2e snapshots added; `npm run lint` green.
8. Diff shape: extension of `src/features/messages/` + new page + chrome retargets; `UserDashboard.tsx` net-negative.
9. Sold/soft-deleted-ad thread readable + sendable with "No longer available" context.
10. Reduced-motion + keyboard-only walkthroughs pass.

---

## Out of scope (explicitly deferred)
- Blocked-user read-only threads (no block feature exists; `disabledReason` prop is the ready hook).
- Offline send-queueing (v1 = honest disable).
- `getChatMessages` pagination (`.collect()` accepted at current volumes).
- Changing `deleteArchivedChats` two-sided hard-delete semantics (flagged as a separate product task).
- Typing indicators / read receipts / message reactions (candidate v2 delighters).
