# Ads Feature - User Journeys

This document captures all user journeys and flows for the Ads feature package.

Scope note: journeys **9–18** below are about POSTING/creating flyers (`PostAd.tsx`) — a
separate concern from browsing/consuming. They are retained here for history but belong to
the posting journey set. Browsing/detail journeys are 1–8, 19, 31–44.

## 1. Browse Flyers (Unified Feed)
**Given** the user is on the home page  
**When** they view the flyers grid  
**Then** they see the server-interleaved unified feed (`feed.getFeed`, sorted `bumpedAt` desc):
active single flyers plus standalone Bundle cards and Moving Sale cards, each with image,
title, price, and location. Order is never re-sorted client-side (newest/boosted first).

## 2. View Flyer Details
**Given** the user is browsing flyers  
**When** they click on a flyer card  
**Then** they see the full flyer details including all images, description, location map, and seller information

## 3. Share Flyer
**Given** the user is viewing a flyer detail page  
**When** they click the share button (in header or sidebar)  
**Then** the flyer URL (`/ad/:id`) is copied to clipboard and a success toast is shown; a
background `fetch('/api/og/ad/:id')` (body cancelled) warms the Open Graph share-card cache
so a pasted link previews instantly. No native Web Share sheet — clipboard only.

## 4. Filter Flyers by Category
**Given** the user is on the home page  
**When** they select a category from the sidebar  
**Then** only flyers in that category are displayed with the category name shown

## 5. Search Flyers
**Given** the user is on the home page  
**When** they type a search query in the header search bar  
**Then** flyers matching the search term are displayed

## 6. View Loading State
**Given** flyers are being fetched from the server  
**When** the data is loading  
**Then** skeleton loading cards are displayed

## 7. View Empty State
**Given** no flyers match the current filters  
**When** the flyers grid is rendered  
**Then** "No Flyers Found" message is displayed

## 8. View Free Items
**Given** a flyer has price set to 0  
**When** the flyer is displayed in the grid  
**Then** "Free" is shown instead of "$0"

## 9. Post New Flyer (Authenticated)
**Given** the user is authenticated  
**When** they navigate to the post flyer page and fill in all required fields (title, category, price, location, description, images)  
**Then** the flyer is created and they are navigated to the appropriate page (dashboard if from dashboard, home otherwise)

## 10. Validate Post Form
**Given** the user is on the post flyer page  
**When** they attempt to submit without filling required fields  
**Then** the submit button remains disabled and form validation prevents submission

## 11. Upload Images (POSTING — belongs to posting journeys)
**Given** the user is posting a flyer  
**When** they add images via the image upload component  
**Then** images are adaptively compressed (quality 0.85–0.92 by connection speed, resolution
preserved up to 2048px on the longest side) and uploaded to R2 storage. *(The old "always
90% WebP" line was stale — see `gatheredContext/features/image-upload.md`.)*

## 12. Edit Existing Flyer
**Given** the user owns a flyer  
**When** they navigate to edit mode with the flyer data  
**Then** the form is pre-filled with existing flyer data and shows "Update Flyer" button

## 13. Delete Images While Editing
**Given** the user is editing a flyer with existing images  
**When** they remove some images from the image upload component  
**Then** only the remaining images are sent to the update mutation (deleted images are filtered out)

## 14. Delete Flyer
**Given** the user is editing their flyer  
**When** they click the delete button and confirm the deletion  
**Then** the flyer is soft-deleted (isDeleted: true) and they are navigated back

## 15. Validate Price Input
**Given** the user is entering a price  
**When** they type in the price field  
**Then** only whole numbers are accepted (no decimals, no leading zeros, no non-numeric characters, max 999999999)

## 16. Character Limits
**Given** the user is filling the post form  
**When** they type in text fields  
**Then** character limits are enforced (title: 100, description: 500, extended description: 2000, location: 100)

## 17. Character Counters
**Given** the user is typing in description fields  
**When** they enter text  
**Then** character counters update in real-time showing "X / MAX characters"

## 18. Location Search
**Given** the user is entering a location  
**When** they type in the location field  
**Then** location suggestions appear and they can select from the dropdown

## 19. Message Seller (Authenticated)
**Given** the user is viewing a flyer they don't own and is authenticated  
**When** they open the chat (auto-opens on mount for logged-in non-owners; the button calls
`handleStartChat`) and send their first message  
**Then** `adDetail.sendFirstMessage` creates the chat (or reuses the existing one) and inserts
the message atomically, then a contextual notification modal is shown. Follow-ups route to
`adDetail.sendMessage`. If not authenticated, clicking Message Seller opens the auth modal
(`onShowAuth`). Self-chat is blocked server-side ("Cannot chat with yourself").

## 20. View Flyer Messages (Seller)
**Given** the user owns a flyer with messages  
**When** they navigate to the messages view for that flyer  
**Then** they see all chat conversations with buyers

## 21. Authentication Required for Messaging
**Given** the user is not authenticated  
**When** they view flyer messages  
**Then** they see a loading state until authentication is confirmed

## 22. User Sync Required for Messaging
**Given** the user is authenticated but not yet synced to database  
**When** the messages component loads  
**Then** chat queries are skipped until user sync is complete

## 23. Message Ordering
**Given** the user is viewing a chat conversation  
**When** messages are displayed  
**Then** they are ordered chronologically (oldest to newest)

## 24. Message Alignment
**Given** the user is viewing messages  
**When** messages are rendered  
**Then** seller messages are right-aligned with primary background, buyer messages are left-aligned with white background

## 25. Bottom Alignment with Scroll
**Given** the user is viewing a chat  
**When** there are few messages  
**Then** messages align to the bottom of the container

**Given** the user is viewing a chat  
**When** there are many messages  
**Then** the container is scrollable and allows viewing message history

## 26. Auto-scroll to Latest Message
**Given** a new message is sent or received  
**When** the messages list updates  
**Then** the view automatically scrolls to the latest message

## 27. Mobile Touch Scrolling
**Given** the user is on a mobile device  
**When** they scroll through messages  
**Then** touch scrolling works smoothly with pan-y and overscroll-behavior

## 28. Empty Chat State
**Given** a flyer has no messages yet  
**When** the seller views the messages page  
**Then** "No messages yet" empty state is displayed

## 29. Select Conversation
**Given** the seller has multiple chat conversations  
**When** they haven't selected a chat yet  
**Then** "Select a conversation" prompt is displayed

## 30. Send Message
**Given** the user is in an active chat  
**When** they type a message and click send  
**Then** the message is sent and appears in the conversation

## 31. Increment Flyer Views
**Given** a user views a flyer detail page  
**When** the page loads  
**Then** the view is registered via `trackView(adId)` (client-side dedup) and flushed in a
batch through `adDetail.batchIncrementViews`, which silently skips deleted/missing ads. No
auth required; not rate-limited (view counting only).

## 32. Save/Unsave Flyer (Authenticated)
**Given** the user is viewing a flyer  
**When** they click the save/heart button  
**Then** if not signed in they get a toast "Please sign in to save ads"; if signed in the
heart optimistically toggles, `adDetail.saveAd` inserts/deletes the `savedAds` row (idempotent
toggle), a success toast + heart-pulse animation play, and on first save a contextual "like"
modal appears. On error the optimistic state reverts and "Failed to save ad" toasts.

## 33. Report Flyer (Authenticated)
**Given** the user is authenticated and viewing a flyer  
**When** they click the report button and submit a report  
**Then** a report is created for admin review

## 34. View Seller Profile from Flyer
**Given** the user is viewing a flyer detail page  
**When** they see the seller information section  
**Then** they can view the seller's name, rating, and verification status

## 35. View Location Map
**Given** a flyer has location data  
**When** the flyer detail page loads  
**Then** a map showing the approximate location is displayed

## 36. Image Lightbox
**Given** the user is viewing flyer images  
**When** they click on an image  
**Then** a full-screen lightbox opens with navigation between images

## 37. Navigate Between Images
**Given** the user has opened the image lightbox  
**When** they use arrow keys or click navigation buttons  
**Then** they can view all flyer images in sequence

## 38. Close Lightbox
**Given** the image lightbox is open  
**When** they press Escape or click the close button  
**Then** the lightbox closes and returns to the flyer detail view

## 39. Price History Display
**Given** a flyer's price has been reduced  
**When** the flyer is displayed  
**Then** the previous price is shown with a strikethrough next to the current price

## 40. Infinite Scroll
**Given** the user is browsing the flyers grid  
**When** they scroll to the bottom of the page  
**Then** an `IntersectionObserver` sentinel (500px rootMargin) calls `loadMore(30)` while
status is `CanLoadMore`; skeleton cards + a "Loading more" spinner show during fetch, and when
`status === "Exhausted"` an "End of the Board" divider is shown.

## 41. Filter Flyers by Price Range
**Given** the user is on the home page  
**When** they enter a Min $ and/or Max $ in the `AdsFilterBar`  
**Then** the feed page is filtered in-memory to ad entries whose `price` falls in range (ads
without a price are excluded when a bound is set); composite Bundle/Sale cards are never
price-filtered. A "Clear" button appears while any filter is active. Order is never changed —
there is deliberately no sort control (price-sort would undercut the "pin to top" model).

## 42. Open a Moving Sale card from the feed
**Given** a Moving Sale is active and its flag is enabled  
**When** the user clicks (or keyboard-activates) the "Moving Sale" card in the feed  
**Then** they navigate to `/sale/:slug`. Individual sale items also appear as ordinary
listings in the feed; how many members of one sale show is capped (default 3, admin-tunable
via `feedSaleMemberCap`; -1 = unlimited, 0 = composite card only).

## 43. Open a Bundle card from the feed
**Given** a standalone Bundle is active with ≥2 live members and its flag is enabled  
**When** the user clicks (or keyboard-activates) the "Bundle" card  
**Then** they navigate to the bundle's Deal Ticket page `/bundle/:id`. The card shows the
bundle price, struck-through separate total, and a "Save $X" chip when savings > 0. A bundle
whose live members drop below 2 is hydrated out of the feed. Member listings are capped
(default 2, `feedBundleMemberCap`).

## 44. Sale / Bundle context banner on the ad detail page
**Given** an ad belongs to an active Moving Sale (`saleEventId`) or standalone Bundle  
**When** the ad detail page renders  
**Then** a Sale banner (`saleEvents.getSaleBannerForAd`) and/or an "Available as a bundle"
banner (`bundles.getBundleBannerForAd`, gated on the `bundleListing` flag) is shown — the ad
detail page is the primary discovery surface for the sale/bundle an item belongs to (feed
items themselves are no longer visually differentiated).

## 45. Trade / Exchange listing display
**Given** an ad has `listingType` of `exchange` or `both`  
**When** it renders in the feed grid  
**Then** an `exchange` ad shows a "Trade" badge and "Open to Trade" instead of a price; a
`both` ad shows its price plus a "• Trade" tag; a plain `sale` ad shows just the price.

## 46. New / Boosted arrival highlight
**Given** a flyer was just posted (in `newAdIds`) or just boosted to the top (in `boostedAdKeys`)  
**When** it appears in the feed  
**Then** a new ad shows a "New" badge with a primary ring; a boosted arrival plays a one-shot
pin-drop entrance + ring-pulse (keyed on `${_id}:${bumpedAt}`, desktop-only layout slide,
skipped under reduced-motion). Both highlight sets auto-clear after ~5s.

## 47. Ad Not Found / Deleted
**Given** the user opens `/ad/:id` for an ad that is deleted or does not exist  
**When** `adDetail.getAdWithContext` resolves to `null`  
**Then** an "Ad Not Found — This ad may have been deleted or removed" state with a "Return to
Flyers" button is shown (while loading, a skeleton matching the loaded layout is shown to
avoid CLS). Sold/deleted/inactive ads are already excluded from feed, search, and category
queries via `isActive && !isDeleted && !isSold`.

## 48. Report Seller Profile (Authenticated)
**Given** the user is viewing a flyer's seller section and is authenticated  
**When** they click "Report Seller" and submit  
**Then** `reports.submitReport` (type `profile`) records the report for admin review; reporting
one's own profile is blocked, and reports are rate-limited to 5/hour (`createReport`).

## 49. Back navigation from a deep link
**Given** the user landed on an ad detail page via a shared URL / new tab (history idx 0)  
**When** they click "Back to flyers"  
**Then** `navigate(-1)` is used only when there is real in-app history; otherwise they are sent
to `/` so Back never leaves the site or no-ops.

## 50. Scroll position preserved across the feed
**Given** the user scrolled down the feed, opened an ad, then returned  
**When** the home feed remounts  
**Then** the saved scroll offset (sessionStorage) is re-applied across frames as images load;
a floating Scroll-to-top button appears past 600px and can also be triggered from the bottom nav.
