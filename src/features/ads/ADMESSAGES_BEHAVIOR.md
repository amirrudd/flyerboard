# AdMessages Component - Critical Chat Behavior

This document describes the critical chat behavior in the `AdMessages` component (the seller's per-ad message view). As of the unified-messaging migration, `AdMessages` is a thin container that wires the shared `src/features/messages/` component library together — most of the previously-hand-rolled behavior below now lives in and is tested by that shared library. This file tracks what's still protected in `AdMessages` itself vs. where coverage moved.

## Where things live now

`AdMessages.tsx` renders:
- `InboxRow` (role="selling") for each conversation in the list.
- `ConversationHeader` for the selected thread (buyer name as title, wired to the report button).
- `ConversationThread` for the message list.
- `MessageComposer` for the input.

It still owns: the auth/sync query gating, the fixed mobile portal layout, the "Conversations (n)" list header, empty states, and `markChatAsRead`.

## 🔒 Protected Behaviors

### 1. Authentication & User Sync Requirements (still enforced here)

**Critical Rule:** Queries must ONLY run when ALL conditions are met:
- ✅ User is authenticated (`isAuthenticated === true`)
- ✅ Session is not loading (`isSessionLoading === false`)
- ✅ User is synced to database (`isUserSynced === true`)

**Why This Matters:**
- Prevents "Not authenticated" errors from race conditions
- Ensures user record exists in database before querying
- Avoids querying before authentication is complete

**Test Coverage (in `AdMessages.test.tsx`, unchanged by the migration):**
- `should not query chats when user is not authenticated`
- `should not query chats when session is loading`
- `should not query chats when user is not synced to database`
- `should query chats only when authenticated AND user is synced`

### 2. Message ordering, scroll pattern, mobile touch scroll, bubble alignment — MOVED

These are now implemented **inside** `ConversationThread` (`src/features/messages/ConversationThread.tsx`) and `MessageBubble`, and are covered by `src/features/messages/ConversationThread.test.tsx`:
- chronological ordering (oldest → newest), even from unsorted input
- the protected scroll pattern (outer `flex-1 min-h-0 overflow-y-auto`, inner `flex flex-col min-h-full justify-end`, never `justify-end` on the outer, never `flex-col-reverse`)
- `touchAction: pan-y` / `overscrollBehavior: contain` for mobile
- `messagesEndRef` + `scrollIntoView` auto-scroll on open/new message
- own vs. other message alignment (right/primary vs. left/muted)

`AdMessages.test.tsx` no longer asserts these directly — do not re-add per-component scroll/ordering/alignment assertions there. If you change scroll/ordering/alignment behavior, update `ConversationThread.tsx` + its test, not `AdMessages.tsx`.

`AdMessages.test.tsx` instead has integration coverage confirming the container wires the shared components correctly:
- `renders the conversation list via InboxRow with buyer name, snippet, and unread count`
- `opens a thread with ConversationHeader + ConversationThread + MessageComposer when a row is selected`
- `sends a message via the composer using messages.sendMessage`
- `opens the report modal from the conversation header report button (previously unreachable)`

### 3. Enter-to-send (behavior change — intentional unification)

**Old behavior:** the hand-rolled textarea only submitted on `Cmd/Ctrl+Enter` (desktop) or a raw `Enter` handler duplicated per-surface with inconsistent rules across `AdMessages`, `AdDetail`, and the dashboard.

**New behavior (via `MessageComposer`):** **Enter sends, Shift+Enter inserts a newline** — one consistent rule everywhere a conversation is rendered. This is intentional: it's the single unified send rule for the whole messaging surface, not a regression. See `src/features/messages/MessageComposer.tsx` / `MessageComposer.test.tsx` for the behavior and its coverage (trims content, clears on success, keeps the draft + toasts on error, disables while empty/sending).

### 4. Report button wiring (previously unreachable — now fixed)

**Before:** `AdMessages` had `showReportModal`/`setShowReportModal` state and a fully-built `ReportModal` render, but nothing in the UI ever called `setShowReportModal(true)` — it was dead code.

**Now:** `ConversationHeader`'s `onReport` prop is wired to `setShowReportModal(true)`, rendered as a "Report conversation" icon button in the thread header. Covered by the `opens the report modal from the conversation header report button (previously unreachable)` test in `AdMessages.test.tsx`.

## 🚫 Common Mistakes to Avoid

### ❌ DON'T: Query before user sync completes
```tsx
{/* WRONG - causes "Not authenticated" error */}
const chats = useQuery(api.messages.getAdChats, { adId });
```

### ✅ DO: Wait for authentication AND sync
```tsx
{/* CORRECT - prevents race condition */}
const chats = useQuery(
  api.messages.getAdChats,
  isAuthenticated && !isSessionLoading && isUserSynced ? { adId } : "skip"
);
```

### ❌ DON'T: Re-implement scroll/ordering/alignment logic in AdMessages
Those behaviors live in `ConversationThread` now. Duplicating them here would drift the two chat surfaces (`AdMessages` and `AdDetail`) apart again — the whole point of the shared library is one implementation both consume.

## 🧪 Running Tests

```bash
# Run AdMessages tests
npx vitest run src/features/ads/AdMessages.test.tsx

# Run the shared conversation-thread/composer tests (scroll, ordering, alignment, Enter-to-send)
npx vitest run src/features/messages/
```

## 📝 When to Update Tests

Update `AdMessages.test.tsx` when:
- ✅ Changing authentication/sync gating logic
- ✅ Changing how `AdMessages` maps `getAdChats`/`getChatMessages` shapes onto `InboxChat`/`ThreadMessage`
- ✅ Changing which shared components are wired in, or their props

Update `src/features/messages/ConversationThread.test.tsx` / `MessageComposer.test.tsx` when:
- ✅ Changing scroll behavior, message ordering, or bubble alignment
- ✅ Changing the send/composer rules (Enter/Shift+Enter, disabled states, error toasting)

## 🔍 Test Failures

If tests fail, check:
1. **Authentication tests failing?** → Check auth/sync conditions in queries in `AdMessages.tsx`
2. **Scroll/ordering/alignment tests failing?** → These live in `src/features/messages/ConversationThread.test.tsx` now, not here
3. **Composer/Enter-to-send tests failing?** → `src/features/messages/MessageComposer.test.tsx`
4. **Report button not opening?** → Check `onReport` wiring on `ConversationHeader` in `AdMessages.tsx`

## 📚 Related Files

- `/src/features/ads/AdMessages.tsx` - Container: auth gating, mobile portal layout, wiring
- `/src/features/ads/AdMessages.test.tsx` - Container test suite (auth gating + integration)
- `/src/features/messages/ConversationThread.tsx` + `.test.tsx` - Scroll/ordering/alignment (shared, protected)
- `/src/features/messages/MessageComposer.tsx` + `.test.tsx` - Send rules (shared, protected)
- `/src/features/messages/ConversationHeader.tsx` - Thread header + report button
- `/src/features/messages/InboxRow.tsx` - Conversation list row
- `/src/context/UserSyncContext.tsx` - User sync tracking
- `/src/lib/useDescopeUserSync.ts` - User sync hook
- `/convex/messages.ts` - Backend queries/mutations used by `AdMessages`
