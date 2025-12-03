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

### Project Rules (`.agent/rules/`)
- `authentication.md` - Development rules for authentication
- `architecture.md` - Overall project architecture
- `tech-stack.md` - Technology stack details

### Source Code
- `src/lib/useDescopeAuth.ts` - Token bridge implementation
- `convex/auth.ts` - Backend auth configuration
- `convex/schema.ts` - Database schema with auth tables

## Contributing

When adding new documentation:
1. Create a new `.md` file in this directory
2. Update this README with a link and description
3. Follow the existing documentation style
4. Include code examples where relevant
5. Add troubleshooting sections for common issues

## Version

Last updated: 2025-12-03
