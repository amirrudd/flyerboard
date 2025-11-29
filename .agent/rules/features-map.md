---
trigger: always_on
description: Feature modules and component map
---

# Features Map

## src/features/ads
- **AdsGrid**: Main grid display of ads with infinite scroll.
- **AdDetail**: Single ad view with images, map, seller info.
- **PostAd**: Form to create new listings.
- **AdMessages**: Chat interface for an ad.

## src/features/dashboard
- **UserDashboard**: User's personal area. Tabs for:
  - My Listings (manage active/inactive ads)
  - Favorites (saved ads)
  - Profile (stats, verification)

## src/features/layout
- **Layout**: Main app shell.
- **Header**, **Sidebar**, **BottomNav**: Navigation components.

## src/features/reviews
- **SellerReviews**: List of reviews for a seller.
- **AddReviewForm**: Form to submit a review.

## src/features/auth
- Handles authentication flows (Login/Signup modals).
