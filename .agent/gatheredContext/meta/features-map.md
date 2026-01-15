---
trigger: always_on
description: Feature modules and component map
---

# Features Map

**Last Updated**: 2025-12-20

## src/features/ads
- **AdsGrid**: Main grid display of flyers with infinite scroll.
- **AdDetail**: Single flyer view with images, map, seller info.
- **PostAd**: Form to create new listings with direct R2 image upload.
- **AdMessages**: Chat interface for a flyer.

## src/features/dashboard
- **UserDashboard**: User's personal area. Tabs for:
  - My Listings (manage active/inactive flyers)
  - Favorites (saved flyers)
  - Profile (stats, verification, profile image upload)
  - Settings (notification preferences)

## src/features/layout
- **Layout**: Main app shell.
- **Header**, **Sidebar**, **BottomNav**: Navigation components.

## src/features/reviews
- **SellerReviews**: List of reviews for a seller.
- **AddReviewForm**: Form to submit a review.

## src/features/auth
- Handles authentication flows (Login/Signup modals via Descope).

## src/features/admin
- **AdminDashboard**: Admin-only management interface. Tabs for:
  - Users (search, filter, activate/deactivate, verify)
  - Flyers (search, filter, delete images, soft-delete)
  - Reports (view/resolve user reports)
  - Chats (view any chat for moderation)

## src/features/notifications
- **ContextualNotificationModal**: Prompts for push notification permissions at key moments.

## src/components/ui
- **ImageUpload**: Drag-and-drop image upload with compression and HEIC support.
- **ImageDisplay**: Lazy-loaded image component that resolves R2 references to URLs.
- **ImageLightbox**: Full-screen image viewer with navigation.
- **CircularProgress**: Progress indicator for uploads/compression.

## src/lib
- **uploadToR2.ts**: Helper functions for direct R2 uploads with compression and progress tracking.
- **networkSpeed.ts**: Adaptive compression based on network speed.
- **displayName.ts**: Privacy-focused display name utilities.

## src/services/notifications
- **webPushService.ts**: Web Push API integration.
- **types.ts**: Notification service interface.

## Feature Flags

Features that are not yet live are controlled by feature flags:

| Flag | Location | Status | Description |
|------|----------|--------|-------------|
| `FEATURE_IDENTITY_VERIFICATION` | `src/features/dashboard/UserDashboard.tsx` | `false` | Identity verification for users (verify button in Profile tab) |

### Enabling Identity Verification for Production

When ready to launch identity verification:

1. Open `src/features/dashboard/UserDashboard.tsx`
2. Find `const FEATURE_IDENTITY_VERIFICATION = false;` (near top of file, after imports)
3. Change to `const FEATURE_IDENTITY_VERIFICATION = true;`
4. Test the feature in staging environment
5. Deploy to production
