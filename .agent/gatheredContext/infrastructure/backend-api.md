---
trigger: always_on
description: Backend API structure and functions
---

# Backend API

**Last Updated**: 2025-12-20

## Structure
- **convex/schema.ts**: Database schema definition.
- **convex/auth.config.ts**: OIDC configuration for Descope integration.
- **convex/http.ts**: HTTP endpoints (webhooks etc).
- **convex/r2.ts**: R2 storage integration and helpers.
- **convex/upload_urls.ts**: Presigned URL generation for direct R2 uploads.
- **convex/lib/auth.ts**: `getDescopeUserId()` helper for authentication.

## Key Modules
- **ads.ts** / **adDetail.ts**:
  - getAds: Paginated, filtered query.
  - createAd: Mutation with validation.
  - updateAd, deleteAd: Owner-only mutations.
- **users.ts**:
  - updateUser: Profile updates.
  - getUser: Public profile data.
- **chats.ts** / **messages.ts**:
  - createChat: Start conversation.
  - getChats: List user's conversations.
  - sendMessage: Send message in chat (triggers notifications).
- **upload_urls.ts**:
  - generateProfileUploadUrl: Creates presigned URL for profile image upload.
  - generateListingUploadUrl: Creates presigned URL for ad listing image upload.
- **notifications/**:
  - pushNotifications.ts: Web Push notification delivery.
  - emailNotifications.ts: Email notification via Resend.

## Image Upload Flow
1. **Client**: Compresses image to WebP (max 1MB) using `browser-image-compression`.
2. **Get URL**: Calls `generateProfileUploadUrl` or `generateListingUploadUrl` action.
3. **Upload**: Directly uploads to R2 using presigned URL (PUT request).
4. **Update**: Saves R2 reference (e.g., `r2:profiles/{userId}/{uuid}`) to database.

## R2 Storage
- **Folder Structure**:
  - Profile images: `profiles/{userId}/{uuid}`
  - Listing images: `flyers/{postId}/{uuid}`
- **Reference Format**: `r2:` prefix + folder path (e.g., `r2:profiles/abc123/xyz789`)
- **URL Resolution**: `api.posts.getImageUrl` converts R2 references to actual URLs.

## Security
- **Authentication**: `getDescopeUserId(ctx)` verifies user via Descope OIDC token.
- **Ownership Checks**: Verify `resource.userId === userId` before mutations.
- **Validation**: convex/values validators (v.string(), etc.) ensure data integrity.
- **Presigned URLs**: Expire in 1 hour for security.
