---
trigger: always_on
description: Backend API structure and functions
---

# Backend API

## Structure
- **convex/schema.ts**: Database schema definition.
- **convex/auth.ts**: Authentication configuration.
- **convex/http.ts**: HTTP endpoints (webhooks etc).

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

## Security
- **RLS (Row Level Security)**: Implemented in functions.
- **Checks**: ctx.auth.getUserIdentity() used to verify ownership before mutations.
- **Validation**: convex/values validators (.string(), etc.) ensure data integrity.
