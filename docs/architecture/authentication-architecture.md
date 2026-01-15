# Authentication Architecture

**Last Updated**: 2025-12-20  
**Status**: Production-Ready ✅

## Overview

FlyerBoard uses a **hybrid authentication architecture** that separates identity management from data authorization:

- **Identity Provider**: [Descope](https://descope.com) handles user identity, OTP verification, and session management
- **Data Authorization**: [Convex](https://convex.dev) handles data access control using tokens issued by Descope

This separation provides security, scalability, and a better developer experience.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌──────────────┐         ┌─────────────────┐              │
│  │   Descope    │────────▶│  useSession()   │              │
│  │ (Identity)   │         │  (UI State)     │              │
│  └──────────────┘         └─────────────────┘              │
│         │                                                    │
│         │ JWT Token                                         │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │     useDescopeAuth (Token Bridge)    │                  │
│  └──────────────────────────────────────┘                  │
└─────────────────────│────────────────────────────────────────┘
                      │ JWT Token
                      ▼
┌─────────────────────────────────────────────────────────────┐
│                    Convex Backend                            │
│  ┌──────────────────────────────────────┐                  │
│  │  OIDC Verification (auth.config.ts)  │                  │
│  └──────────────────────────────────────┘                  │
│         │                                                    │
│         │ Verified User ID                                  │
│         ▼                                                    │
│  ┌──────────────────────────────────────┐                  │
│  │   getAuthUserId() in mutations       │                  │
│  │   (Data Authorization)               │                  │
│  └──────────────────────────────────────┘                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Token Flow

### 1. User Authentication (Descope)
- User authenticates via Descope (email/OTP)
- Descope issues a JWT session token
- Token is stored in browser localStorage (`persistTokens={true}`)

### 2. Token Bridge (Frontend)
The `useDescopeAuth` hook bridges Descope and Convex:

```typescript
// src/lib/useDescopeAuth.ts
const fetchAccessToken = useCallback(async () => {
  if (!isAuthenticated || !sessionToken) {
    return null;  // Not authenticated
  }
  return sessionToken;  // Pass Descope JWT to Convex
}, [isAuthenticated, sessionToken]);
```

### 3. Convex Integration
The `ConvexProviderWithAuth` uses the custom auth hook:

```typescript
// src/main.tsx
<ConvexProviderWithAuth client={convex} useAuth={useDescopeAuth}>
  <App />
</ConvexProviderWithAuth>
```

### 4. Backend Verification
Convex verifies the JWT via OIDC:

```typescript
// convex/auth.config.ts
{
  domain: process.env.CONVEX_AUTH_ISSUER,  // Descope OIDC endpoint
  applicationID: "convex",
}
```

---

## Frontend Implementation

### UI State Management

**Rule**: Always use `useSession()` for UI state, never Convex queries.

```typescript
import { useSession } from "@descope/react-sdk";

const { isAuthenticated, isSessionLoading } = useSession();

if (isAuthenticated) {
  // Show authenticated UI
}
```

**Why?** Convex queries are async and depend on the token bridge, which can cause UI lag or "flicker" where a user appears logged out.

### Auth Guards

Components use auth guards to prompt login instead of failing silently:

```typescript
const handleAuthGuard = (path: string) => {
  if (user) {
    navigate(path);
  } else {
    setShowAuthModal(true);  // Prompt login
  }
};
```

### Session Configuration

```typescript
<AuthProvider
  projectId={import.meta.env.VITE_DESCOPE_PROJECT_ID}
  persistTokens={true}           // Persist across sessions
  autoRefresh={true}             // Auto-refresh tokens
  sessionTokenViaCookie={false}  // Use localStorage
>
```

---

## Backend Implementation

### Authorization Pattern

**Standard pattern** used across all protected mutations:

```typescript
import { getDescopeUserId } from "./lib/auth";

export const myMutation = mutation({
  handler: async (ctx, args) => {
    // 1. Get authenticated user ID (via Descope OIDC)
    const userId = await getDescopeUserId(ctx);
    if (!userId) {
      throw new Error("Must be logged in to perform this action");
    }

    // 2. Verify resource ownership (if applicable)
    const resource = await ctx.db.get(args.resourceId);
    if (resource.userId !== userId) {
      throw new Error("You can only modify your own resources");
    }

    // 3. Perform action
    await ctx.db.patch(args.resourceId, { ... });
  },
});
```

### Row-Level Security (RLS)

All mutations implement row-level security:

| File | Protected Operations | Security Pattern |
|------|---------------------|------------------|
| `posts.ts` | createAd, updateAd, deleteAd | Ownership verification |
| `users.ts` | updateProfile, deleteAccount | Self-only operations |
| `messages.ts` | sendMessage, markAsRead | Participant verification |
| `ratings.ts` | submitRating | Prevents self-rating |
| `reports.ts` | submitReport | Prevents self-reporting |

### Schema Integration

The schema extends Convex Auth tables:

```typescript
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,  // Include auth tables
  users: defineTable({
    ...authTables.users.validator.fields,  // Extend user fields
    image: v.optional(v.string()),
    averageRating: v.optional(v.number()),
    isVerified: v.optional(v.boolean()),
  }).index("email", ["email"]),
});
```

---

## Security Features

### 1. Token Security
- ✅ Tokens not exposed in production logs
- ✅ Automatic token refresh prevents expiration
- ✅ JWT verification via OIDC

### 2. Data Access Control
- ✅ All mutations verify authentication
- ✅ Ownership checks prevent unauthorized access
- ✅ Consistent error messages

### 3. Duplicate Prevention
- ✅ Email uniqueness enforced at database level
- ✅ Indexed queries for efficient lookups

### 4. Self-Action Prevention
- ✅ Users cannot rate themselves
- ✅ Users cannot report their own content

### 5. Soft Deletes
- ✅ Ads use logical deletion (preserves data integrity)
- ✅ Deleted content excluded from queries

---

## Error Handling

### Authentication Errors
```typescript
throw new Error("Must be logged in to [action]");
```
Used when user is not authenticated.

### Authorization Errors
```typescript
throw new Error("You can only [action] your own [resource]");
```
Used when user lacks permission for the resource.

### Not Found Errors
```typescript
throw new Error("[Resource] not found");
```
Used when requested resource doesn't exist.

---

## Mobile & Responsive

**Rule**: Mobile and desktop components use identical auth patterns.

All components (`Header`, `MobileHeader`, `BottomNav`, `Sidebar`) use the same `useSession()` hook. No separate auth logic for mobile views.

---

## Session Management

### Login Flow
1. User clicks "Sign In"
2. Descope modal appears
3. User enters email/OTP
4. Descope issues JWT
5. Token stored in localStorage
6. `useSession()` updates to `isAuthenticated: true`
7. UI updates to show authenticated state

### Logout Flow
1. User clicks "Sign Out"
2. `sdk.logout()` called
3. Descope clears session
4. Token removed from localStorage
5. `useSession()` updates to `isAuthenticated: false`
6. User redirected to home page

### Token Refresh
- Automatic via `autoRefresh={true}`
- Happens transparently in background
- No user action required

---

## Environment Variables

### Frontend (.env.local)
```bash
VITE_DESCOPE_PROJECT_ID=your_descope_project_id
VITE_CONVEX_URL=your_convex_url
```

### Backend (Convex Dashboard)
```bash
CONVEX_AUTH_ISSUER=https://api.descope.com/[PROJECT_ID]
```

---

## Testing Considerations

### Unit Tests
- Mock `useSession()` hook in tests
- Test auth guards with authenticated/unauthenticated states
- Verify error handling for unauthorized access

### Integration Tests
- Test full login/logout flow
- Verify token persistence across page refreshes
- Test token expiration and refresh

---

## Best Practices

### ✅ DO
- Use `useSession()` for UI state
- Use `getDescopeUserId()` in backend mutations
- Implement ownership checks for user resources
- Provide clear error messages
- Use auth guards to prompt login

### ❌ DON'T
- Use Convex queries for UI auth state
- Expose tokens in production logs
- Skip ownership verification
- Allow users to modify others' resources
- Fail silently on auth errors

---

## Troubleshooting

### User appears logged out after page refresh
**Cause**: `persistTokens` not enabled  
**Fix**: Ensure `persistTokens={true}` in `AuthProvider`

### "Unauthenticated" errors in Convex
**Cause**: Token not being passed to Convex  
**Fix**: Verify `useDescopeAuth` is configured in `ConvexProviderWithAuth`

### OIDC verification fails
**Cause**: Incorrect issuer URL  
**Fix**: Verify `CONVEX_AUTH_ISSUER` matches your Descope project

### UI flicker on auth state
**Cause**: Using Convex queries for UI state  
**Fix**: Use `useSession()` instead of `api.auth.loggedInUser`

---

## Related Files

### Frontend
- `src/main.tsx` - Auth provider configuration
- `src/lib/useDescopeAuth.ts` - Token bridge
- `src/features/auth/SignOutButton.tsx` - Logout implementation

### Backend
- `convex/auth.ts` - Auth configuration
- `convex/auth.config.ts` - OIDC configuration
- `convex/schema.ts` - Auth tables integration
- `convex/http.ts` - HTTP routes for auth

### Documentation
- `.agent/rules/authentication.md` - Development rules
- `docs/authentication-architecture.md` - This document

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2025-12-03 | Initial documentation |

---

## References

- [Descope Documentation](https://docs.descope.com/)
- [Convex Auth Documentation](https://docs.convex.dev/auth)
- [OIDC Specification](https://openid.net/connect/)
