---
trigger: always_on
description: Database schema and relationships
---

# Data Schema (Convex)

**Last Updated**: 2025-12-20

## Core Tables
- **users**: Extends auth users. Adds image, isVerified, rating stats, tokenIdentifier for Descope.
- **ads**: Listings (user-facing: "flyers"). Links to users (seller) and categories.
- **categories**: Hierarchical (can have parentId).
- **chats**: Conversations between buyer/seller for an ad.
- **messages**: Messages within a chat.
- **savedAds**: User favorites (userId, adId).
- **reports**: User reports against ads, users, or chats.
- **ratings**: User-to-user ratings (raterId, ratedUserId).
- **pushSubscriptions**: Web Push notification subscriptions.

## Key Relationships
- ads.userId -> users._id
- ads.categoryId -> categories._id
- chats.adId -> ads._id
- chats.buyerId / chats.sellerId -> users._id

## Indexes
- Ads indexed by: category, location, isActive, user, deleted.
- Search index on ads.title.

## Schema Reference
See `convex/schema.ts` for complete schema definition.
