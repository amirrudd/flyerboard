---
trigger: always_on
description: Feature modules and component map
---

# Features Map

## src/features/ads
- **AdsGrid**: Main grid display of ads with infinite scroll.
- **AdDetail**: Single ad view with images, map, seller info.
- **PostAd**: Form to create new listings with direct R2 image upload.
- **AdMessages**: Chat interface for an ad.

## src/features/dashboard
- **UserDashboard**: User's personal area. Tabs for:
  - My Listings (manage active/inactive ads)
  - Favorites (saved ads)
  - Profile (stats, verification, profile image upload)

## src/features/layout
- **Layout**: Main app shell.
- **Header**, **Sidebar**, **BottomNav**: Navigation components.

## src/features/reviews
- **SellerReviews**: List of reviews for a seller.
- **AddReviewForm**: Form to submit a review.

## src/features/auth
- Handles authentication flows (Login/Signup modals).

## src/features/notifications
- **EmailNotifications**: Sends personalized HTML emails via Resend when users receive messages
- **PushNotifications**: Browser push notifications for real-time alerts

## src/components/ui
- **ImageUpload**: Drag-and-drop image upload with compression and HEIC support.
- **ImageDisplay**: Lazy-loaded image component that resolves R2 references to URLs.

## src/lib
- **uploadToR2.ts**: Helper functions for direct R2 uploads with compression and progress tracking.
