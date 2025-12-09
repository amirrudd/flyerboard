# Descope + Convex Integration Summary

## Problem
After migrating from Convex Auth to Descope, users were not being created in the Convex `users` table, causing authentication failures for R2 uploads and other operations.

## Solution

### 1. User Sync Mechanism
Created automatic user synchronization between Descope and Convex:

- **`convex/descopeAuth.ts`**: Mutations to sync Descope users to Convex
  - `syncDescopeUser`: Creates/updates user records (email and name only)
  - `getCurrentUser`: Gets current user by tokenIdentifier
  - `getCurrentUserId`: Gets current user ID

- **`src/lib/useDescopeUserSync.ts`**: React hook that automatically syncs users on login
  - **Privacy-focused**: Does NOT extract or store phone numbers from OTP signup
  - Only syncs email and name if provided
- **`src/App.tsx`**: Calls `useDescopeUserSync()` to enable automatic sync

### 2. Schema Update
Added `tokenIdentifier` and optional `phone` fields to users table:
```typescript
users: defineTable({
  ...authTables.users.validator.fields,
  tokenIdentifier: v.optional(v.string()), // Descope subject ID
  phone: v.optional(v.string()),           // Optional - user can add manually for SMS notifications
  // ... other fields
})
  .index("email", ["email"])
  .index("tokenIdentifier", ["tokenIdentifier"]),
```

**Note**: The `phone` field is NOT auto-populated from OTP signup. Users can optionally add it in their dashboard for SMS notifications.

### 3. Auth Helper Function
Created `convex/lib/auth.ts` with `getDescopeUserId()`:
- Replaces `getAuthUserId` from `@convex-dev/auth/server`
- Looks up users by `tokenIdentifier` (Descope subject)
- Returns `Id<"users">` for type safety

### 4. Display Name Utilities
Created `src/lib/displayName.ts` with privacy-focused fallback logic:
- `getDisplayName()`: Returns name > email prefix > "User"
- `getInitials()`: Returns first letter of name > email > "U"
- **Privacy-focused**: Does NOT use phone numbers for display

### 5. Updated All Backend Functions
Replaced `getAuthUserId` with `getDescopeUserId` in:
- `convex/users.ts`
- `convex/posts.ts`
- `convex/messages.ts`
- `convex/adDetail.ts`
- `convex/ratings.ts`
- `convex/reports.ts`

### 6. Fixed R2 Authentication
Updated `convex/r2.ts`:
- Uses `getDescopeUserId()` for authentication checks
- Works with OIDC provider (Descope)
- Added debug logging

## How It Works

1. **User signs up via OTP** → Descope issues JWT token (phone used only for verification, not stored)
2. **Frontend receives token** → `useDescopeAuth` passes it to Convex
3. **Convex verifies token** → Via OIDC (using `CONVEX_AUTH_ISSUER`)
4. **User sync runs** → `useDescopeUserSync` creates/updates user in Convex (without phone)
5. **Backend operations** → Use `getDescopeUserId()` to find user by `tokenIdentifier`
6. **Display names** → Use `getDisplayName()` for consistent, privacy-friendly fallbacks

## User Object Structure

**Descope Token Subject**: `"descope|user123"` or similar

**Convex User Record** (OTP signup):
```typescript
{
  _id: Id<"users">,
  tokenIdentifier: "descope|user123", // From Descope JWT subject
  email: undefined,                   // Not provided in OTP-only signup
  name: "User",                       // Generic fallback for privacy
  phone: undefined,                   // NOT stored from OTP for privacy
  image: "r2:profile/...",
  // ... other fields
}
```

**Convex User Record** (after user adds details):
```typescript
{
  _id: Id<"users">,
  tokenIdentifier: "descope|user123",
  email: "user@example.com",          // User added in dashboard
  name: "John Doe",                   // User added in dashboard
  phone: "+61412345678",              // User optionally added for SMS notifications
  image: "r2:profile/...",
  // ... other fields
}
```

## Environment Variables Required

### Vercel Production (Frontend Only)
Add these to **Vercel Dashboard → Settings → Environment Variables**:

```bash
# Frontend variables (VITE_* prefix - embedded at build time)
VITE_CONVEX_URL=https://resilient-pheasant-112.convex.cloud
VITE_DESCOPE_PROJECT_ID=P363bEaEDNeBq3fLWpNjbiUvuloU
VITE_GOOGLE_MAPS_API_KEY=AIzaSyC-GecPLxuF3-SJiYzyorDjNyDf5jh24gM
```

**❌ Do NOT add to Vercel:**
- Backend variables (CONVEX_AUTH_ISSUER, DESCOPE_PROJECT_ID without VITE_ prefix, R2_*, etc.)
- These belong in Convex Dashboard, not Vercel

### Convex Production (Backend Only)
Add these to **Convex Dashboard → Settings → Environment Variables**:

```bash
# OIDC Authentication
CONVEX_AUTH_ISSUER=https://api.descope.com/P363bEaEDNeBq3fLWpNjbiUvuloU
DESCOPE_PROJECT_ID=P363bEaEDNeBq3fLWpNjbiUvuloU

# Descope Management API
DESCOPE_MANAGEMENT_KEY=your_descope_management_key

# Cloudflare R2 Storage
R2_ACCESS_KEY_ID=your_r2_access_key_id
R2_BUCKET=flyer-board-images
R2_ENDPOINT=your_r2_endpoint_url
R2_SECRET_ACCESS_KEY=your_r2_secret_access_key
```

**❌ Do NOT add to Convex:**
- Frontend variables (VITE_CONVEX_URL, VITE_DESCOPE_PROJECT_ID, etc.)
- These are for Vite/React only

### Local Development (.env.local)
For local development, you need **both** frontend and backend variables in `.env.local`:

```bash
# See .env.example for complete setup instructions
```

Refer to [`.env.example`](file:///Users/amir.rudd/flyerBoard/FlyerBoard/.env.example) for detailed documentation.


## Testing

1. Sign up with phone-only OTP (no email)
2. Check browser console for "Syncing Descope user to Convex" logs
3. Check Convex logs for user creation
4. Upload a profile picture to verify R2 auth works
5. Verify user record created in Convex dashboard with:
   - `tokenIdentifier` field populated
   - `name` field has "User" (generic fallback)
   - `email` field is `undefined`
   - `phone` field is `undefined` (privacy protection)

## Display Name Behavior

| User Data | Display Name | Avatar Initials |
|-----------|--------------|-----------------|
| name: "John Doe" | "John Doe" | "J" |
| email: "user@example.com" | "user" | "U" |
| OTP-only (no data) | "User" | "U" |

**Privacy Note**: Phone numbers are never used for display names, even if the user manually adds them for SMS notifications.

## Privacy & Security

### Phone Number Handling
- ✅ Phone numbers used for OTP are **NOT stored** in the database
- ✅ Users can **optionally** add phone in dashboard for SMS notifications
- ✅ Phone numbers are **never** used for display names or avatars
- ✅ Protects user privacy by not storing authentication credentials

### Authentication Flow
```
┌─────────────┐
│   Descope   │ OTP Verification (phone not stored)
│   (Phone)   │ Issues JWT with subject: "descope|user123"
└──────┬──────┘
       │ sessionToken
       ▼
┌─────────────┐
│   Convex    │ 1. Verifies JWT via OIDC
│  (Backend)  │ 2. getUserIdentity() → subject
│             │ 3. getDescopeUserId() → user lookup
└──────┬──────┘
       │ userId
       ▼
┌─────────────┐
│ Cloudflare  │ checkUpload() requires authenticated userId
│     R2      │ Allows/denies file uploads
└─────────────┘
```

## Troubleshooting

- **"Must be logged in" error**: Check that `CONVEX_AUTH_ISSUER` is set correctly
- **User not found**: Ensure `useDescopeUserSync` is called in App component
- **Token not verified**: Verify `CONVEX_AUTH_ISSUER` matches your Descope project ID
- **Display shows "User"**: This is expected for OTP-only signups (privacy protection)


