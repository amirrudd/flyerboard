# Seller reputation (transaction-verified ratings)

- **Status:** Shipped
- **Created:** 2026-07-15
- **Last touched:** 2026-07-15
- **Owner:** Amir

## What & why
Ratings existed but were un-gated (any user could rate any user, no transaction, symmetric) — worthless as a trust signal. Made them **one-sided (buyers rate sellers)** and **transaction-verified**, the two properties the reputation-economics literature says make a rating trustworthy. This is the mechanism that carries the Persian-community's in-group trust to strangers as FlyerBoard expands (PNAS Airbnb finding). See [../market-readiness-2026-07.md](../market-readiness-2026-07.md).

## Shipped (PR #315)
- **Guard** — `convex/ratings.ts` `submitRating`: rater must be the `buyerId` on a `chats` row whose `sellerId` is the rated user. A chat only exists after a first message, so it's a real transaction proxy; and a seller is never the buyer on their own listing's thread, so seller→buyer retaliation is structurally impossible.
- **UI** — `AdDetail` "Rate Seller" buttons gated on `chatId`.
- **Test** — `convex/ratings.test.ts` (3 cases).

Design notes: one-sided (eBay dropped seller-rates-buyer in 2008, retaliation); transaction-verified (un-gated ratings inflate to meaningless). Kept the one-per-rater/updatable behaviour + 10/hr rate limit.

## Display — already present
Rating shows on the **ad detail page** (`SellerProfile`: stars + count, → `ReviewListModal`, with a "No ratings yet" empty state), the user dashboard, admin, and chat context.

## Deferred
Per-card ratings in the browse feed (`AdsGrid`). Not worth it until sellers have ratings — at launch every card would show an empty state (noise), and the feed query would need an N+1 seller fetch on the hottest path. Build when rating data exists; gate on `count > 0` and dedupe seller lookups.

## Log
- 2026-07-15 — designed from market-readiness research, shipped (guard + UI gate + test) in PR #315. Confirmed display already exists on the detail page; feed-card display deferred.
