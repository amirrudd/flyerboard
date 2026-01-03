---
trigger: always_on
---

# FlyerBoard Global Guidelines
> **Scope**: Rules that apply to **all platforms** (web app, Android, iOS)  
> **Project**: FlyerBoard - Classified marketplace application  
> **Terminology**: ads → flyers
## Project Context
FlyerBoard is a classified marketplace application where users can post, browse, and manage classified ads (called "flyers"). The application consists of:
- **Web Application**: React-based responsive web app
- **Native Mobile Apps**: Kotlin Multiplatform (KMP) apps for Android and iOS
## Backend & Data Layer
### Database (Convex)
- **Schema**: Defined in [convex/schema.ts](cci:7://file:///Users/amir.rudd/flyerBoard/FlyerBoard/convex/schema.ts:0:0-0:0)
- **Query Patterns**: Use Convex queries and mutations
- **Context Files**: See [.agent/gatheredContext/database.md](cci:7://file:///Users/amir.rudd/flyerBoard/FlyerBoard/.agent/gatheredContext/database.md:0:0-0:0)
### Authentication
- **Provider**: Descope
- **Pattern**: ALWAYS verify user authentication in mutations
- **Verification**: `await getDescopeUserId(ctx)` (or platform equivalent)
- **Ownership**: ALWAYS verify ownership before modifications
- **Security**: Never expose user data without auth checks
- **Context Files**: See [.agent/gatheredContext/authentication.md](cci:7://file:///Users/amir.rudd/flyerBoard/FlyerBoard/.agent/gatheredContext/authentication.md:0:0-0:0)
### Storage (R2)
- **Provider**: Cloudflare R2
- **Integration**: Presigned URLs for uploads
- **Context Files**: See [.agent/gatheredContext/storage.md](cci:7://file:///Users/amir.rudd/flyerBoard/FlyerBoard/.agent/gatheredContext/storage.md:0:0-0:0)
## Critical Patterns (Always Follow)
### Image Quality Standards
- Image quality is **ALWAYS 90% WebP**, regardless of uploader's connection speed
- Only `maxSizeMB` varies (0.8-1.5MB) based on network speed
- **Never compromise quality for upload speed**
### Image Upload in Edit Mode
- When editing, filter existing images to exclude deleted ones: `existingImages.filter(img => currentImages.includes(img))`
- Keep existing image storage keys separate from new upload keys
- Never pass data URLs or base64 to mutations - only storage keys
- Verify compressed files array contains only NEW files, not existing images
### Soft Deletes
- **ALWAYS filter deleted flyers/ads** when querying
- Never hard delete ads - use soft delete pattern
- Dashboard statistics must exclude deleted ads
- Example filter: `.filter(q => q.neq(q.field("isDeleted"), true))`
### R2 CORS Configuration
- **ALWAYS disable checksums** in presigned URLs: `ChecksumAlgorithm: undefined`
- **ALWAYS unhoist checksum headers**: `unhoistableHeaders: new Set(["x-amz-checksum-crc32"])`
- Failure to do this causes 403 CORS errors
### Database Migrations
- Any DB schema update requires careful migration consideration for existing users in production
- Plan for backward compatibility
- Test migration paths thoroughly
### Notifications
- **Email**: See [.agent/gatheredContext/email-notifications.md](cci:7://file:///Users/amir.rudd/flyerBoard/FlyerBoard/.agent/gatheredContext/email-notifications.md:0:0-0:0)
- **Push**: See [.agent/gatheredContext/push-notifications.md](cci:7://file:///Users/amir.rudd/flyerBoard/FlyerBoard/.agent/gatheredContext/push-notifications.md:0:0-0:0)
- Implement batching to prevent spam (10-minute time-based batching)
## Development Rules
For every task, the following rules must always be respected:
### Code Quality
- Follow the existing architecture, naming conventions, and module boundaries already established in the project
- Modify only the code directly required to complete the task
- No refactors, redesigns, or "improvements" unless explicitly requested
- Keep changes small, readable, and consistent with the current style
- Output only the new or changed code unless full context is absolutely necessary
### Testing & Quality Assurance
- **Always add tests** when fixing bugs or adding features
- Run tests after task completion to ensure no regressions
- Update tests when functionality changes
- Avoid regressions—do not break existing features, APIs, or UI flows
### Documentation
- After completing a task, update relevant documents in `.agent/gatheredContext/{relevant context document}` when needed
- Keep project context accurate for future tasks
### Decision Making
- Do not pause for confirmation unless the task is truly impossible or unreasonably ambiguous
- When clarification is needed, make a safe, minimal assumption and proceed
## Testing Data
- **Test Phone Number**: Use any Audtralian mobile number wiht "000000" as pin for testing
## Context & Knowledge Base
Before starting any task, check if relevant context exists in `.agent/gatheredContext/`:
- **Image uploads/compression**: `image-upload.md` - covers adaptive compression, quality settings, non-blocking UX
- **Storage/R2/CORS**: `storage.md` - covers R2 integration, presigned URLs, CORS configuration
- **Database/Convex queries**: `database.md` - covers schema, query patterns, soft deletes, authentication
- **Authentication**: `authentication.md` - covers Descope integration, user sync, token handling
- **Notifications**: `email-notifications.md` and `push-notifications.md` - covers notification systems
- **Admin features**: `admin.md` - covers admin dashboard, user/flyer management
If working on a feature that touches multiple areas, read all relevant context files before planning.