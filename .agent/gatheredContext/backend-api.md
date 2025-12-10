---
trigger: always_on
description: Backend API structure and functions
---

# Backend API

## Structure
- **convex/schema.ts**: Database schema definition.
- **convex/auth.ts**: Authentication configuration.
- **convex/http.ts**: HTTP endpoints (webhooks etc).
- **convex/r2.ts**: R2 storage integration and helpers.
- **convex/upload_urls.ts**: Presigned URL generation for direct R2 uploads.
- **convex/image_actions.ts**: Legacy image upload actions (being phased out).

## Key Modules
- **ds.ts**:
  - getAds: Paginated, filtered query.
  - createAd: Mutation with validation.
  - updateAd, deleteAd: Owner-only mutations.
- **users.ts**:
  - updateUser: Profile updates.
  - getUser: Public profile data.
- **chats.ts**:
  - createChat: Start conversation.
  - getChats: List user's conversations.
  - sendMessage: Send message in chat.
- **upload_urls.ts**:
  - generateProfileUploadUrl: Creates presigned URL for profile image upload.
  - generateListingUploadUrl: Creates presigned URL for ad listing image upload.

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
- **RLS (Row Level Security)**: Implemented in functions.
- **Checks**: ctx.auth.getUserIdentity() used to verify ownership before mutations.
- **Validation**: convex/values validators (.string(), etc.) ensure data integrity.
- **Presigned URLs**: Expire in 1 hour for security.
