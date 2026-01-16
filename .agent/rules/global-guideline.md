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
- **Schema**: Defined in `convex/schema.ts`
- **Query Patterns**: Use Convex queries and mutations
- **Context Files**: See `.agent/gatheredContext/infrastructure/database.md`

### Authentication
- **Provider**: Descope
- **Pattern**: ALWAYS verify user authentication in mutations
- **Verification**: `await getDescopeUserId(ctx)` (or platform equivalent)
- **Ownership**: ALWAYS verify ownership before modifications
- **Security**: Never expose user data without auth checks
- **Context Files**: See `.agent/gatheredContext/features/authentication.md`

### Storage (R2)
- **Provider**: Cloudflare R2
- **Integration**: Presigned URLs for uploads
- **Context Files**: See `.agent/gatheredContext/infrastructure/storage.md`

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
- **Email & Push**: See `.agent/gatheredContext/features/notifications.md`
- Implement batching to prevent spam (10-minute time-based batching)

### Error Handling
- Use consistent, user-friendly error messages
- Never expose internal error details to users
- Log errors with context for debugging: `{ userId, resourceId, operation }`
- Use toast notifications for user-facing errors
- Throw specific error types: "Must be logged in", "Unauthorized", "Not found"

### Error Recovery & Tool Selection
- **When file edit tools fail repeatedly** (2+ consecutive failures):
  - If `replace_file_content` or `multi_replace_file_content` fail with "target content not found", switch to `write_to_file` with `Overwrite: true`
  - This is especially appropriate when making comprehensive changes across a file (e.g., multiple styling updates)
  - Don't persist with a failing approach—recognize the pattern and adapt quickly
- **General principle**: When a tool consistently fails, switch strategies rather than retry the same approach

## Development Rules

For every task, the following rules must always be respected:

### Code Quality
- Follow the existing architecture, naming conventions, and module boundaries
- Modify only the code directly required to complete the task
- No refactors, redesigns, or "improvements" unless explicitly requested
- Keep changes small, readable, and consistent with the current style
- Prefer clean, readable code over cleverness
- **DRY Principle**: Extract duplicated logic into reusable components, functions, or utilities
- No redundant comments or dead code unless marked with TODO

### Testing & Quality Assurance
- **Always add tests** when fixing bugs or adding features
- Run tests after task completion to ensure no regressions
- Update tests when functionality changes
- Avoid regressions—do not break existing features, APIs, or UI flows

### Documentation Updates

**When to update `.agent/gatheredContext/`** (AI context):
- New implementation patterns or code examples
- Technical details that help future AI tasks
- Bug fixes with non-obvious solutions

**When to update `docs/`** (Developer docs):
- Architecture changes or design decisions
- Setup or configuration changes
- Migration guides

### Decision Making
- When clarification is needed, make a safe, minimal assumption and proceed
- Exception: For brainstorming or planning tasks, ask instead of assuming

## Proactive Automation

As a startup-focused agent, you must always look for reusable patterns. During any task, you should:
- **Identify Reusable Logic**: If you find yourself writing a complex script or documented pattern for the second time, suggest capturing it as a **Skill** (`.agent/skills/`).
- **Identify Reusable Processes**: If you perform a series of manual terminal commands more than once (e.g., specific cleanup, complex builds), suggest capturing it as a **Workflow** (`.agent/workflows/`).
- **How to suggest**: Include a "💡 **Pattern Identified**" section in your task updates or final report.

## Common Pitfalls (Avoid These)

### ❌ Authentication Pitfalls
- Forgetting to call `getDescopeUserId(ctx)` in mutations
- Not verifying ownership before updates/deletes
- Using Convex queries for UI auth state (use `useSession()` instead)

### ❌ Image Upload Pitfalls
- Passing base64/data URLs to mutations instead of R2 keys
- Including existing images in the "new files" array during edit
- Forgetting to filter deleted images in edit mode
- Using quality < 90% for compression

### ❌ Database Pitfalls
- Forgetting `.filter(q => q.neq(q.field("isDeleted"), true))` in queries
- Hard deleting records instead of soft delete
- Not using indexes for filtered queries

### ❌ R2/Storage Pitfalls
- Not disabling checksums in presigned URLs (causes 403 CORS errors)
- Uploading without proper authentication check

### ❌ Testing Pitfalls
- Not mocking `useSession()` in auth-related tests
- Forgetting to update test counts in comments
- Not testing mobile viewports

## Task Completion Checklist

Before completing any task, verify:

- [ ] **Code**: Changes follow existing patterns and conventions
- [ ] **Auth**: All mutations verify authentication and ownership
- [ ] **Soft Delete**: Queries filter out deleted records
- [ ] **Tests**: New/updated tests pass (`npm test`)
- [ ] **Build**: No TypeScript errors (`npm run build`)
- [ ] **Context**: Updated relevant `.agent/gatheredContext/` files if needed
- [ ] **Docs**: Updated `docs/` if architecture/setup changed

### For UI Changes (AI Verification)
- [ ] Loading states implemented in code
- [ ] Error states handled in code
- [ ] Responsive logic verified in code (e.g., Tailwind classes, media queries)
- [ ] **Note**: Visual verification in browser is only performed if explicitly requested by the user.

### For Backend Changes
- [ ] Error messages are user-friendly
- [ ] Indexes used for filtered queries
- [ ] Backward compatible with existing data

## Testing Data

- **Test Phone Number**: Use any Australian mobile number with "000000" as PIN for testing

## Context & Knowledge Base

Before starting any task, check if relevant context exists in `.agent/gatheredContext/`:

**Quick Reference**: See `.agent/gatheredContext/INDEX.md` for comprehensive navigation guide.

**Key Context Files**:
- **Image uploads/compression**: `features/image-upload.md`
- **Storage/R2/CORS**: `infrastructure/storage.md`
- **Database/Convex queries**: `infrastructure/database.md`
- **Authentication**: `features/authentication.md`
- **Notifications**: `features/notifications.md`
- **Admin features**: `features/admin.md`
- **UI patterns**: `frontend/ui-patterns.md`
- **Responsive design**: `frontend/responsive-design-best-practices.md`

**Workflow Reference**: See `.agent/workflows/verify-changed-files.md` for verification steps.

If working on a feature that touches multiple areas, read all relevant context files before planning.