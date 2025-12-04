---
trigger: always_on
description: Rules and architecture for Authentication (Descope + Convex)
---

# Authentication Architecture & Rules

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

### ✅ DO: Handle OTP-Only Users
Users can sign up via phone-only OTP without providing email or name. For privacy, phone numbers are NOT stored. OTP-only users display as "User" until they add profile details.

## 3. Session Management

### ✅ DO: Enable Persistence
The `AuthProvider` in `main.tsx` must have:
- `persistTokens={true}`
- `autoRefresh={true}`
- `sessionTokenViaCookie={false}` (unless specifically required otherwise)

## 4. Mobile & Responsive

### ✅ DO: Consistent Auth Checks
Mobile components (`MobileHeader`, `BottomNav`, `Sidebar`) must use the exact same `useSession()` hooks as desktop components. Do not create separate auth logic for mobile views.

## 5. Display Names

### ✅ DO: Use Display Name Utilities
Use `getDisplayName()` and `getInitials()` from `src/lib/displayName.ts` for consistent fallback behavior:
- Priority: `name` > `email prefix` > "User"
- **Privacy-focused**: Never uses phone numbers for display

## 6. Privacy & Security

### ✅ DO: Protect User Privacy
- Phone numbers used for OTP verification are **NOT stored** in the database
- Users can optionally add phone in dashboard for SMS notifications
- Phone numbers are never used for display names or avatars


