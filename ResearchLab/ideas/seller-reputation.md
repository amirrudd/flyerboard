# Seller reputation (transaction-verified ratings)

- **Status:** Shipped
- **Created:** 2026-07-15
- **Last touched:** 2026-07-15
- **Owner:** Amir

## Problem
Ratings existed (`convex/ratings.ts`) but were worthless as a trust signal: any logged-in user could rate any other user, with no transaction or conversation required, and the mutation was symmetric (a seller could rate a buyer back). That's the exact opposite of what the reputation-economics literature says works, and it's gameable — retaliatory ratings and friend-boosting drive-by 5-stars.

## Hypothesis
If seller ratings are **transaction-verified** and **one-sided** (buyers rate sellers), the average rating becomes a signal a stranger can trust — which is the mechanism that lets in-group trust from the Persian-community launch extend to strangers as FlyerBoard grows outward (PNAS Airbnb finding). See [../market-readiness-2026-07.md](../market-readiness-2026-07.md).

## What shipped
- **Backend guard** (`convex/ratings.ts` → `submitRating`): the rater must have a chat thread where they are the `buyerId` and the rated user is the `sellerId`. A chat row only exists after a first message is sent (`adDetail.sendFirstMessage`), so this is a genuine transaction proxy. It also *structurally* enforces one-sidedness — a seller can never be the buyer on their own listing's thread, so seller→buyer retaliation ratings are impossible. Root-cause fix: lives in the one shared mutation, so every caller (desktop button, mobile sheet, direct API) is covered.
- **UI** (`src/features/ads/AdDetail.tsx`): both "Rate Seller" buttons are now gated on `chatId` (an existing thread for this ad), so a buyer who hasn't messaged doesn't see the button and hit a confusing error.
- **Test** (`convex/ratings.test.ts`): rejects rating an un-messaged seller; allows it once a thread exists; blocks the seller from rating the buyer back.

## Design decisions (from the literature)
- **One-sided, buyers rate sellers** — eBay removed seller-rates-buyer in 2008 because negatives were primarily retaliatory.
- **Transaction-verified** — un-gated ratings inflate until uninformative (eBay median seller score: 100%). A sent message is the closest proxy we have (no on-platform payments).
- Kept the existing "one rating per rater→seller, updatable" behaviour and the 10/hour rate limit.

## Deliberately NOT done (YAGNI)
- No display of raw percent-positive (literature says it's uninformative) — we show average + count.
- No requirement of *N* messages or a "deal done" flag — a first message is a good-enough proxy for v1; revisit if boosting appears.
- `chatId` on the rating stays optional context; enforcement is the buyer→seller relationship scan, not the passed id.

## Related
- [../market-readiness-2026-07.md](../market-readiness-2026-07.md) — why reputation was the pick.
- `convex/ratings.ts`, `src/features/ads/AdDetail.tsx`, `convex/ratings.test.ts`.

## Log
- 2026-07-15 — designed from market-readiness research and shipped (backend guard + UI gate + test).
