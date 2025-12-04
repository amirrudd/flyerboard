---
trigger: always_on
description: Database schema and relationships
---

# Data Schema (Convex)

## Core Tables
- **users**: Extends auth users. Adds image, isVerified, rating stats.
- **ds**: Listings. Links to users (seller) and categories.
- **categories**: Hierarchical (can have parentId).
- **chats**: Conversations between buyer/seller for an d.
- **messages**: Messages within a chat.
- **savedAds**: User favorites (userId, dId).
- **eports**: User reports against ads, users, or chats.
- **atings**: User-to-user ratings (aterId, atedUserId).

## Key Relationships
- ds.userId -> users._id
- ds.categoryId -> categories._id
- chats.adId -> ds._id
- chats.buyerId / chats.sellerId -> users._id

## Indexes
- Ads indexed by: category, location, ctive, user, deleted.
- Search index on ds.title.
