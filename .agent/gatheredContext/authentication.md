---
trigger: always_on
description: Rules and architecture for Authentication (Descope + Convex)
---

# Authentication Architecture & Rules

**Last Updated**: 2025-12-20

This project uses a **Hybrid Authentication** approach:
- **Identity Provider**: [Descope](https://descope.com) handles user identity, OTP verification, and session management.
- **Data Authorization**: [Convex](https://convex.dev) handles data access control using tokens issued by Descope.

## 1. Frontend Rules (React)

### ✅ DO: Use `useSession()` for UI State
Always use the Descope `useSession` hook to determine if a user is logged in for UI purposes (showing/hiding buttons, redirecting).
```tsx
import { useSession } from "@descope/react-sdk";

const { isAuthenticated, isSessionLoading } = useSession();
if (isAuthenticated) {
  // Show authenticated UI
}
```

### ❌ DON'T: Use `api.auth.loggedInUser` for UI State
Do not use Convex queries (like `api.auth.loggedInUser`) to determine *if* a user is logged in. Convex queries are async and depend on the token bridge, which can cause UI lag or "flicker" where a user appears logged out.

### ✅ DO: Use `useDescopeAuth` Bridge
Ensure `ConvexProviderWithAuth` is configured with the `useDescopeAuth` hook in `main.tsx`. This automatically passes the Descope session token to Convex.

### ✅ DO: Sync Users to Convex
The `useDescopeUserSync` hook automatically syncs Descope users to Convex on authentication. **Privacy-focused**: Phone numbers from OTP are NOT stored.

## 2. Backend Rules (Convex)

### ✅ DO: Verify Tokens via OIDC
Convex is configured to verify Descope JWTs via OIDC. Ensure `convex/auth.config.ts` points to the correct Descope issuer URL.

### ✅ DO: Use `getDescopeUserId`
In Convex mutations/queries, use `getDescopeUserId(ctx)` (from `convex/lib/auth.ts`) to retrieve the authenticated user's ID. This replaces the legacy `getAuthUserId` function.

### ✅ DO: Wait for User Sync Before Queries
**CRITICAL**: Always check that the user is synced to the database before making authenticated queries. Use the `UserSyncContext`:

```tsx
import { useSession } from "@descope/react-sdk";
import { useUserSync } from "../../context/UserSyncContext";

const { isAuthenticated, isSessionLoading } = useSession();
const { isUserSynced } = useUserSync();

// Only query when ALL conditions are met
const data = useQuery(
  api.someQuery,
  isAuthenticated && !isSessionLoading && isUserSynced ? { args } : "skip"
);
```

**Why This Matters:**
- Prevents "Not authenticated" errors from race conditions
- User may be authenticated with Descope but not yet synced to Convex database
- The `syncDescopeUser` mutation runs asynchronously on login
- Queries that run before sync completes will fail with "Not authenticated"

**See:** `/src/features/ads/AdMessages.tsx` for a complete example

### ✅ DO: Handle OTP-Only Users
Users can sign up via phone-only OTP. **New users** are prompted to provide their name after OTP verification (3-step flow: phone → OTP → name). **Existing users** proceed directly after OTP verification (2-step flow: phone → OTP). Phone numbers are NOT stored for privacy.

## 3. Environment Variables

### ⚠️ CRITICAL: Frontend vs Backend Variables

Environment variables are split between **frontend** (Vite/React) and **backend** (Convex):

#### Frontend Variables (VITE_* prefix)
These are embedded into the React app at build time and accessible via `import.meta.env`:
- `VITE_CONVEX_URL` - Convex deployment URL
- `VITE_DESCOPE_PROJECT_ID` - Descope project ID for AuthProvider
- `VITE_GOOGLE_MAPS_API_KEY` - Google Maps API key

**Where to set:**
- **Vercel Production**: Add to Vercel Dashboard → Settings → Environment Variables
- **Local Development**: Add to `.env.local` file

#### Backend Variables (NO VITE_ prefix)
These are only accessible in Convex functions via `process.env`:
- `CONVEX_AUTH_ISSUER` - OIDC issuer URL for JWT verification
- `DESCOPE_PROJECT_ID` - Descope project ID for auth.config.ts
- `DESCOPE_MANAGEMENT_KEY` - Descope management API key
- `R2_ACCESS_KEY_ID`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_SECRET_ACCESS_KEY` - Cloudflare R2 storage

**Where to set:**
- **Convex Production**: Add to Convex Dashboard → Settings → Environment Variables
- **Local Development**: Add to `.env.local` file

### ✅ DO: Check .env.example
See [`.env.example`](file:///Users/amir.rudd/flyerBoard/FlyerBoard/.env.example) for a complete list of required variables and detailed setup instructions for each deployment environment.

### ❌ DON'T: Mix Frontend and Backend Variables
- **Never** add backend variables (without VITE_ prefix) to Vercel
- **Never** add frontend variables (with VITE_ prefix) to Convex Dashboard
- Both types can coexist in **local** `.env.local` file

## 4. Session Management

### ✅ DO: Enable Persistence
The `AuthProvider` in `main.tsx` must have:
- `persistTokens={true}`
- `autoRefresh={true}`
- `sessionTokenViaCookie={false}` (unless specifically required otherwise)

## 5. Mobile & Responsive

### ✅ DO: Consistent Auth Checks
Mobile components (`MobileHeader`, `BottomNav`, `Sidebar`) must use the exact same `useSession()` hooks as desktop components. Do not create separate auth logic for mobile views.

## 6. Display Names

### ✅ DO: Use Display Name Utilities
Use `getDisplayName()` and `getInitials()` from `src/lib/displayName.ts` for consistent fallback behavior:
- Priority: `name` > `email prefix` > "User"
- **Privacy-focused**: Never uses phone numbers for display

## 7. Privacy & Security

### ✅ DO: Protect User Privacy
- Phone numbers used for OTP verification are **NOT stored** in the database
- Users can optionally add phone in dashboard for SMS notifications
- Phone numbers are never used for display names or avatars


