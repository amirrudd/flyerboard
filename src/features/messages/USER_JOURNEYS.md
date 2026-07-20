# Messaging Feature - User Journeys

This document captures all user journeys and flows for the Messaging / Chat
feature. One `chats` table backs four thread kinds — a single-listing flyer
chat (`adId` set), a Moving Sale thread (`saleEventId` set), a Bundle thread
(`bundleId` set), and nothing else — with the unified inbox at
`/messages/:chatId?`. Traced from real code; no invented flows.

Key files: `src/pages/MessagesPage.tsx`, `src/features/messages/*`,
`src/features/ads/AdMessages.tsx` + `AdDetail.tsx`,
`src/features/movingSale/SaleMessageModal.tsx`,
`src/features/bundles/BundleMessageModal.tsx`, `convex/messages.ts`,
`convex/adDetail.ts`, `convex/saleChats.ts`, `convex/bundleChats.ts`,
`convex/posts.ts` (getSellerChats/getBuyerChats), `convex/lib/unread.ts`.

## Starting conversations

### 1. Start a chat from a flyer (first message)
**Given** an authenticated buyer viewing a flyer they don't own
**When** they open the in-page chat and send their first message
**Then** `adDetail.sendFirstMessage` creates a `chats` row keyed on
`(adId, buyerId)` (or reuses the existing one) and inserts the message, and a
"turn on notifications" modal is shown

### 2. Continue a chat from the flyer page
**Given** a buyer with an existing chat open on a flyer detail page
**When** they send a further message
**Then** `adDetail.sendMessage` inserts it after re-checking the ad still
exists and is not soft-deleted (throws "Cannot send message - flyer no longer
available" if it was deleted)

### 3. Start a chat from a Moving Sale
**Given** an authenticated buyer viewing a Moving Sale they don't own
**When** they open the Sale message modal and send (optionally tagging item
chips)
**Then** `saleChats.sendSaleMessage` creates one thread per buyer per sale
keyed on `(saleEventId, buyerId)`, keeping only chips whose ad belongs to that
sale, and notifies the seller

### 4. Start a chat from a Bundle
**Given** an authenticated buyer viewing a live standalone Bundle they don't own
**When** they open the Bundle message modal and send
**Then** `bundleChats.sendBundleMessage` creates one thread per buyer per
bundle keyed on `(bundleId, buyerId)` and notifies the seller (rejected if the
bundle is deleted, cancelled, or sale-scoped)

### 5. Cannot message your own listing
**Given** a signed-in seller viewing their own flyer / sale / bundle
**When** the send mutation runs
**Then** it throws ("Cannot chat with yourself" / "You can't message your own
sale" / "...own bundle") — no self-chat is created

### 6. Unauthenticated user tries to start a chat
**Given** a signed-out visitor on a flyer detail page
**When** they tap the message / start-chat control
**Then** the auth modal is shown (`onShowAuth`) instead of opening the composer

## The unified inbox (`/messages`)

### 7. Open the inbox
**Given** an authenticated user
**When** they navigate to `/messages`
**Then** `useInbox` merges `posts.getSellerChats` + `posts.getBuyerChats`,
tags each row selling/buying, and lists them newest-first by `lastMessageAt`

### 8. Inbox auth gate
**Given** a signed-out user (or a route-guard redirect in flight)
**When** they hit `/messages`
**Then** `PageLoader` shows while the session resolves, then they are
redirected home (`navigate('/', { replace: true })`); no chat query fires

### 9. User-sync race guard
**Given** an authenticated user whose Convex user row hasn't synced yet
**When** the inbox mounts
**Then** both chat queries stay `"skip"` until
`isAuthenticated && !isSessionLoading && isUserSynced`, and `useInbox` reports
`isLoading` (never a false "empty inbox") during the gap

### 10. Filter by role
**Given** the inbox is open
**When** the user selects the all / selling / buying filter
**Then** `filterInboxConversations` shows only matching rows; an empty result
shows "No {selling|buying} conversations yet."

### 11. Filter to one flyer (deep link)
**Given** a `/messages?flyer=<adId>` deep link
**When** the inbox renders
**Then** only conversations about that ad show, with a removable chip titled
from the flyer; dismissing it clears `flyer` with `replace:true`

### 12. Empty inbox
**Given** a user with no conversations
**When** the "all" inbox renders
**Then** the "No messages yet" empty state with a Browse CTA is shown

### 13. Desktop two-pane vs mobile full-screen
**Given** the viewport width
**When** the page renders
**Then** ≥md shows a master-detail two-pane (inbox list + thread, URL
`:chatId` is the single selection source); <md swaps the whole inbox for a
full-screen thread (its own header, persistent shell header hidden)

## Reading a conversation

### 14. Open a thread
**Given** a conversation in the inbox
**When** the user taps it (or deep-links `/messages/:chatId`)
**Then** `ThreadView` resolves metadata from the merged inbox, subscribes to
`messages.getChatMessages`, and renders bubbles aligned by the row's role tag
(no extra current-user query)

### 15. Open an archived conversation by link
**Given** a `/messages/:chatId` link to an archived chat (excluded from
seller/buyer lists)
**When** the thread resolves and the inbox has no match
**Then** it falls back to `messages.getArchivedChats` (buyer-archived, no
badge) rather than dead-ending on "not found"

### 16. Conversation not found
**Given** a foreign, malformed, or fully-deleted `:chatId`
**When** it resolves to no conversation
**Then** an in-page "Conversation not found" state (with a Back to messages
button) is shown — never the route ErrorBoundary

### 17. Mark as read on entry
**Given** a thread with unread counterpart messages
**When** it opens (or a new counterpart message arrives while open)
**Then** `markChatAsRead` patches the role-specific `lastReadBySeller` /
`lastReadByBuyer`; the effect is keyed on the newest counterpart timestamp so
own-sends never trigger a redundant round-trip

## Sending

### 18. Send from the unified thread (optimistic)
**Given** an open thread
**When** the user sends a message
**Then** the composer clears immediately, an optimistic bubble renders, and
`messages.sendMessage` (60/min rate limit) persists it; on resolve the live
subscription replaces the bubble

### 19. Retry a failed send
**Given** an optimistic send that rejected (marked failed)
**When** the user taps the failed bubble
**Then** the same content is re-dispatched (guarded against double-fire); the
typed content is never lost

### 20. Offline banner
**Given** the Convex socket has connected once then dropped for ~2s
**When** the thread is open
**Then** a debounced "offline" status strip appears under the messages and
clears immediately on reconnect

### 21. Send on a sold / inactive flyer
**Given** a flyer thread whose ad is sold or inactive (but not deleted)
**When** the thread renders
**Then** the composer stays ENABLED (arranging pickup is a real flow) with a
"No longer available" pill; the item context strip is non-tappable

### 22. Send on an unavailable sale / bundle
**Given** a sale or bundle thread whose sale/bundle no longer resolves
**When** the thread renders
**Then** the composer is DISABLED with "This {sale|bundle} is no longer
available"

## Seller-side per-ad view

### 23. Seller reviews conversations for one flyer
**Given** a seller in their dashboard opening `AdMessages` for an owned ad
**When** the view loads
**Then** `messages.getAdChats` (ownership-checked) lists every buyer thread on
that ad with unread counts; selecting one shows the thread and marks it read

## Unread indicators & notifications

### 24. Nav unread badge
**Given** an authenticated user anywhere in the app
**When** the bottom nav / dashboard renders
**Then** `useTotalUnreadCount` (`messages.getTotalUnreadCount`, gated on
sync, returns 0 while signed out) drives an `UnreadBadge`; the count excludes
archived and deleted-for-me chats

### 25. Per-flyer unread badges in dashboard
**Given** a seller on the "My Flyers" dashboard tab
**When** the tab renders
**Then** `messages.getUnreadCounts` returns a per-ad unread map for each owned
ad (badge per flyer card)

### 26. Recipient notification on new message
**Given** push/email notifications are enabled for the recipient
**When** a message is sent through `messages.sendMessage`,
`saleChats.sendSaleMessage`, or `bundleChats.sendBundleMessage`
**Then** a push is scheduled and an email is queued for batching to the other
participant (see BROKEN-FLOWS for the paths that skip this)

## Archiving & deleting

### 27. Archive a conversation
**Given** a conversation in the inbox
**When** the user archives it
**Then** `archiveChat` sets `archivedBySeller`/`archivedByBuyer` for that side
only; it drops out of the active inbox and unread total

### 28. View / unarchive archived chats
**Given** `/messages/archived`
**When** it renders
**Then** `getArchivedChats` lists buyer-archived chats; the user can unarchive
(restores to inbox) or multi-select and delete

### 29. Delete archived conversations (two-sided)
**Given** archived chats selected for deletion
**When** `deleteArchivedChats` runs
**Then** it sets `deletedBy{Buyer|Seller}`; once BOTH sides have deleted, the
chat and its messages are hard-deleted inline — a one-sided delete just hides
it from that user

## Display edge cases

### 30. Deleted counterpart / deleted item
**Given** the other participant's user row or the linked flyer is gone
**When** the row/thread renders
**Then** `getCounterpartName` falls back to "Deleted User" and `getItemTitle`
falls back to "Deleted Flyer" / "Moving Sale" / "Bundle"

### 31. Self-chat de-dupe
**Given** a (defensive) chat where `buyerId === sellerId`
**When** the inbox merges seller + buyer lists
**Then** only one row per `_id` is kept (the selling copy)
