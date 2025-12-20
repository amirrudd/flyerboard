# FlyerBoard Documentation

This directory contains architectural and technical documentation for the FlyerBoard project.

## Documents

### [Authentication Architecture](./authentication-architecture.md)
Comprehensive guide to the hybrid Descope + Convex authentication system, including:
- Token flow and architecture diagrams
- Frontend and backend implementation patterns
- Security features and best practices
- Troubleshooting guide
- Row-level security (RLS) implementation

### [Descope Convex Integration](./descope-convex-integration.md)
Details on how Descope users are synced to Convex, including:
- User sync mechanism
- Privacy-focused phone handling
- Environment variable setup

### [Push Notifications](./push-notifications.md)
Web Push notification setup and usage:
- VAPID key generation
- Service worker configuration
- Mobile platform support

### [Email Notifications Update](./email-notifications-update.md)
Email notification implementation changelog:
- Resend integration
- Batching system
- User preferences

### [R2 CORS Setup](./r2-cors-setup.md)
Cloudflare R2 CORS configuration for image uploads.

### [Storage Migration](./storage-migration.md)
Guide for migrating from Convex storage to R2.

## Quick Links

### For Developers
- **New to the project?** Start with [Authentication Architecture](./authentication-architecture.md) to understand how auth works
- **Adding new features?** Review the authorization patterns in the auth docs
- **Debugging auth issues?** Check the troubleshooting section

### Key Concepts
- **Hybrid Auth**: Descope handles identity, Convex handles data authorization
- **Token Bridge**: `useDescopeAuth` passes JWT from Descope to Convex
- **Row-Level Security**: All mutations verify ownership before allowing access
- **UI State**: Always use `useSession()`, never Convex queries

## Related Files

### Project Context (`.agent/gatheredContext/`)
- `authentication.md` - Development rules for authentication
- `architecture.md` - Overall project architecture
- `tech-stack.md` - Technology stack details
- `database.md` - Database patterns and queries

### Source Code
- `src/lib/useDescopeAuth.ts` - Token bridge implementation
- `convex/auth.config.ts` - Backend auth configuration
- `convex/lib/auth.ts` - `getDescopeUserId()` helper
- `convex/schema.ts` - Database schema with auth tables

## Contributing

When adding new documentation:
1. Create a new `.md` file in this directory
2. Update this README with a link and description
3. Follow the existing documentation style
4. Include code examples where relevant
5. Add troubleshooting sections for common issues

## Version

Last updated: 2025-12-20
