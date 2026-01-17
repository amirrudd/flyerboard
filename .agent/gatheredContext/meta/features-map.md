---
trigger: always_on
description: Feature modules and component map
---

# Features Map

**Last Updated**: 2026-01-17

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
- **StarRating**: Reusable star rating display component.

## src/components (Ratings & Reviews)
- **RatingModal**: Form to submit/update a rating for another user (1-5 stars + comment).
- **ReviewListModal**: Displays list of all reviews received by a user.

## src/lib
- **uploadToR2.ts**: Helper functions for direct R2 uploads with compression and progress tracking.
- **networkSpeed.ts**: Adaptive compression based on network speed.
- **displayName.ts**: Privacy-focused display name utilities.

## src/services/notifications
- **webPushService.ts**: Web Push API integration.
- **types.ts**: Notification service interface.

## Feature Flags

Feature flags are managed via the database (`featureFlags` table) and controlled from the Admin Dashboard.

| Flag Key | Description | Toggle Location |
|----------|-------------|----------------|
| `identityVerification` | User identity self-verification feature | Admin Dashboard > Feature Flags |

### Managing Feature Flags

1. **Via Admin Dashboard**: Navigate to Admin > Feature Flags tab to toggle features on/off
2. **Via Database**: Use Convex dashboard to directly modify `featureFlags` table
3. **In Code**: Use `useQuery(api.featureFlags.getFlag, { key: "flagName" })` to check flag status
