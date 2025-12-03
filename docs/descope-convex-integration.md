# Descope + Convex Integration Summary

## Problem
After migrating from Convex Auth to Descope, users were not being created in the Convex `users` table, causing authentication failures for R2 uploads and other operations.

## Solution

### 1. User Sync Mechanism
Created automatic user synchronization between Descope and Convex:

- **`convex/descopeAuth.ts`**: Mutations to sync Descope users to Convex
  - `syncDescopeUser`: Creates/updates user records
  - `getCurrentUser`: Gets current user by tokenIdentifier
  - `getCurrentUserId`: Gets current user ID

- **`src/lib/useDescopeUserSync.ts`**: React hook that automatically syncs users on login
- **`src/App.tsx`**: Calls `useDescopeUserSync()` to enable automatic sync

### 2. Schema Update
Added `tokenIdentifier` field to users table:
```typescript
users: defineTable({
  ...authTables.users.validator.fields,
  tokenIdentifier: v.optional(v.string()), // Descope subject ID
  // ... other fields
})
  .index("email", ["email"])
  .index("tokenIdentifier", ["tokenIdentifier"]),
```

### 3. Auth Helper Function
Created `convex/lib/auth.ts` with `getDescopeUserId()`:
- Replaces `getAuthUserId` from `@convex-dev/auth/server`
- Looks up users by `tokenIdentifier` (Descope subject)
- Returns `Id<"users">` for type safety

### 4. Updated All Backend Functions
Replaced `getAuthUserId` with `getDescopeUserId` in:
- `convex/users.ts`
- `convex/posts.ts`
- `convex/messages.ts`
- `convex/adDetail.ts`
- `convex/ratings.ts`
- `convex/reports.ts`

### 5. Fixed R2 Authentication
Updated `convex/r2.ts`:
- Changed from `getAuthUserId(ctx)` to `ctx.auth.getUserIdentity()`
- Works with any OIDC provider (including Descope)
- Added debug logging

## How It Works

1. **User logs in via Descope** → Descope issues JWT token
2. **Frontend receives token** → `useDescopeAuth` passes it to Convex
3. **Convex verifies token** → Via OIDC (using `CONVEX_AUTH_ISSUER`)
4. **User sync runs** → `useDescopeUserSync` creates/updates user in Convex
5. **Backend operations** → Use `getDescopeUserId()` to find user by `tokenIdentifier`

## User Object Structure

**Descope Token Subject**: `"descope|user123"` or similar

**Convex User Record**:
```typescript
{
  _id: Id<"users">,
  tokenIdentifier: "descope|user123", // From Descope JWT subject
  email: "user@example.com",
  name: "User Name",
  image: "r2:profile/...",
  // ... other fields
}
```

## Environment Variables Required

```bash
# Descope
VITE_DESCOPE_PROJECT_ID=P363bEaEDNeBq3fLWpNjbiUvuloU

# Convex OIDC
CONVEX_AUTH_ISSUER=https://api.descope.com/P363bEaEDNeBq3fLWpNjbiUvuloU

# R2 Storage
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_ENDPOINT=...
R2_BUCKET=...
```

## Testing

1. Sign in with Descope
2. Check browser console for "Descope Auth State" logs
3. Check Convex logs for "R2 Upload: Checking authentication..."
4. Upload a profile picture
5. Verify user record created in Convex dashboard

## Troubleshooting

- **"Must be logged in" error**: Check that `CONVEX_AUTH_ISSUER` is set correctly
- **User not found**: Ensure `useDescopeUserSync` is called in App component
- **Token not verified**: Verify `CONVEX_AUTH_ISSUER` matches your Descope project ID
