# FlyerBoard AI Context Index

**Last Updated**: 2026-01-15

This index helps AI agents quickly locate relevant implementation context for any task.

---

## Quick Navigation

### By Task Type

| Task | Primary Context | Related Context |
|------|----------------|-----------------|
| **Authentication/Login** | `features/authentication.md` | `infrastructure/database.md` |
| **Image Upload** | `features/image-upload.md` | `infrastructure/storage.md` |
| **Notifications** | `features/notifications.md` | `infrastructure/database.md` |
| **Admin Features** | `features/admin.md` | `infrastructure/database.md` |
| **PWA/Offline** | `features/pwa.md` | `frontend/ui-patterns.md` |
| **Database Queries** | `infrastructure/database.md` | `features/authentication.md` |
| **Storage/R2** | `infrastructure/storage.md` | `features/image-upload.md` |
| **UI Components** | `frontend/ui-patterns.md` | `frontend/responsive-design-best-practices.md` |
| **Routing** | `frontend/routing-navigation.md` | `frontend/architecture.md` |
| **State Management** | `frontend/state-management.md` | `frontend/architecture.md` |
| **Mobile/Native** | `platform/native/` | `../../rules/kmp-native-app-guideline.md` |

---

## Directory Structure

```
.agent/gatheredContext/
├── features/                    # Feature implementations
│   ├── admin.md                 # Admin dashboard, user/flyer management
│   ├── authentication.md        # Descope integration, auth patterns
│   ├── image-upload.md          # Adaptive compression, upload UX
│   ├── notifications.md         # Email (Resend) + Push (Web Push)
│   └── pwa.md                   # Progressive Web App features
│
├── infrastructure/              # Backend & services
│   ├── backend-api.md           # Convex API patterns
│   ├── cost-optimization.md     # Cost management strategies
│   ├── database.md              # Schema, queries, soft deletes
│   └── storage.md               # R2 integration, presigned URLs
│
├── frontend/                    # UI patterns & architecture
│   ├── architecture.md          # Frontend architecture overview
│   ├── responsive-design-best-practices.md  # Mobile-first patterns
│   ├── routing-navigation.md    # React Router patterns
│   ├── state-management.md      # Context API, Convex queries
│   └── ui-patterns.md           # Component patterns, design system
│
├── platform/                    # Platform-specific
│   └── native/                  # KMP mobile implementation
│       └── kmp-implementation.md
│
└── meta/                        # Cross-cutting concerns
    ├── data-schema.md           # Database schema overview
    ├── features-map.md          # Feature inventory
    └── tech-stack.md            # Technology choices
```

---

## By Topic

### Authentication
- **Implementation**: `features/authentication.md`
- **Database**: `infrastructure/database.md` (users table)
- **Rules**: `../rules/global-guideline.md#authentication`
- **Human Docs**: `../../docs/architecture/authentication-architecture.md`

### Image Upload & Storage
- **Upload Logic**: `features/image-upload.md`
- **Storage Backend**: `infrastructure/storage.md`
- **Rules**: `../rules/global-guideline.md#image-quality-standards`
- **Migration Guide**: `../../docs/migrations/storage-migration.md`

### Notifications
- **Implementation**: `features/notifications.md` (email + push)
- **Database**: `infrastructure/database.md` (pushSubscriptions, emailNotificationsEnabled)
- **Rules**: `../rules/global-guideline.md#notifications`
- **Human Docs**: `../../docs/guides/push-notifications.md`

### Admin Features
- **Implementation**: `features/admin.md`
- **Database**: `infrastructure/database.md` (isAdmin, isActive)
- **Workflow**: `../workflows/set-admin-user.md`

### Database
- **Patterns**: `infrastructure/database.md`
- **Schema**: `meta/data-schema.md`
- **Rules**: `../rules/global-guideline.md#soft-deletes`

### Frontend Architecture
- **Overview**: `frontend/architecture.md`
- **UI Patterns**: `frontend/ui-patterns.md`
- **Responsive Design**: `frontend/responsive-design-best-practices.md`
- **State**: `frontend/state-management.md`
- **Routing**: `frontend/routing-navigation.md`
- **Rules**: `../rules/web-app-guideline.md`

### Mobile/Native
- **Implementation**: `platform/native/kmp-implementation.md`
- **Rules**: `../rules/kmp-native-app-guideline.md`

### Cost & Performance
- **Optimization**: `infrastructure/cost-optimization.md`
- **Image Upload**: `features/image-upload.md#adaptive-compression`
- **Caching**: `frontend/state-management.md`

---

## File Descriptions

### Features

#### `features/admin.md`
Admin dashboard implementation including:
- User management (activate/deactivate, verify, delete)
- Flyer management (view, delete, image management)
- Reports management (view, update status)
- Chat moderation (view conversations)
- Category management (CRUD operations)

#### `features/authentication.md`
Descope + Convex authentication integration:
- Token flow and verification
- Authorization patterns (`getDescopeUserId`)
- Row-level security (RLS)
- Auth guards and error handling
- Session management

#### `features/image-upload.md`
Image upload and compression:
- Adaptive compression based on network speed
- Non-blocking UX with Web Workers
- Quality standards (always 90% WebP)
- Edit mode patterns (existing vs new images)
- R2 integration

#### `features/notifications.md`
Email and push notifications:
- Email via Resend (templates, spam prevention, batching)
- Push via Web Push API (VAPID, service worker)
- User preferences and opt-in
- Platform support (iOS, Android, Desktop)
- Troubleshooting guides

#### `features/pwa.md`
Progressive Web App features:
- Service worker configuration
- Installability
- Offline support
- Push notification integration

### Infrastructure

#### `infrastructure/backend-api.md`
Convex API patterns and conventions.

#### `infrastructure/cost-optimization.md`
Strategies for managing costs across services (Convex, R2, Resend).

#### `infrastructure/database.md`
**Most important for backend work:**
- Complete schema reference
- Query patterns and indexes
- Soft delete implementation
- Authentication in mutations
- Pagination patterns

#### `infrastructure/storage.md`
Cloudflare R2 integration:
- Presigned URL generation
- CORS configuration (critical!)
- Upload/download patterns
- Security considerations

### Frontend

#### `frontend/architecture.md`
High-level frontend architecture:
- Feature-based structure
- Code splitting and lazy loading
- Component organization

#### `frontend/responsive-design-best-practices.md`
Mobile-first design patterns:
- Breakpoints and viewport handling
- Touch optimization
- Bottom navigation vs sidebar
- Dynamic viewport height (dvh)

#### `frontend/routing-navigation.md`
React Router patterns and navigation.

#### `frontend/state-management.md`
State management approach:
- Context API for global state
- Convex queries for server state
- Local state patterns
- Caching strategies

#### `frontend/ui-patterns.md`
Component patterns and design system:
- Common components
- Styling conventions
- Accessibility patterns
- Modal/dialog patterns

### Platform

#### `platform/native/kmp-implementation.md`
Kotlin Multiplatform mobile app implementation.

### Meta

#### `meta/data-schema.md`
Database schema overview.

#### `meta/features-map.md`
Inventory of all features in the application.

#### `meta/tech-stack.md`
Technology choices and rationale.

---

## Common Patterns Reference

### Authentication Check
```typescript
const userId = await getDescopeUserId(ctx);
if (!userId) throw new Error("Must be logged in");
```
**Context**: `features/authentication.md`, `infrastructure/database.md`

### Ownership Verification
```typescript
const resource = await ctx.db.get(args.resourceId);
if (resource.userId !== userId) throw new Error("Unauthorized");
```
**Context**: `features/authentication.md`, `infrastructure/database.md`

### Soft Delete
```typescript
await ctx.db.patch(adId, { isDeleted: true, isActive: false });
```
**Context**: `infrastructure/database.md`

### Query with Soft Delete Filter
```typescript
.filter(q => q.neq(q.field("isDeleted"), true))
```
**Context**: `infrastructure/database.md`

### Image Upload (Edit Mode)
```typescript
const existingImages = currentImages.filter(img => img.startsWith('r2:'));
const newImages = await uploadNewImages(newFiles);
const allImages = [...existingImages, ...newImages];
```
**Context**: `features/image-upload.md`

### R2 Presigned URL (CORS-safe)
```typescript
{
  ChecksumAlgorithm: undefined,
  unhoistableHeaders: new Set(["x-amz-checksum-crc32"])
}
```
**Context**: `infrastructure/storage.md`

---

## Update Guidelines

When completing a task, update the relevant context files:

1. **Code changes** → Update `.agent/gatheredContext/` with implementation details
2. **Architecture decisions** → Update `../../docs/architecture/design-decisions.md`
3. **New patterns/standards** → Update `.agent/rules/`
4. **Repeatable procedures** → Create/update `.agent/workflows/`

---

## Related Documentation

### For Developers (Human-Readable)
- `../../docs/README.md` - Project overview
- `../../docs/architecture/` - Architecture decisions
- `../../docs/guides/` - Setup and usage guides
- `../../docs/migrations/` - Migration guides

### For AI Agents (Implementation Details)
- `.agent/gatheredContext/` - This directory
- `.agent/rules/` - Coding standards
- `.agent/workflows/` - Task procedures
- `.agent/skills/` - Specialized capabilities
