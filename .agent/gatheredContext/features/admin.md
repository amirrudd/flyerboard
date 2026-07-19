# Admin Patterns & Dashboard

**Last Updated**: 2026-07-19

## Overview

The admin dashboard provides a centralized interface for managing users, flyers, reports, and monitoring chats. Access is restricted to users with the `isAdmin` flag set to `true`.

## Authentication & Authorization

### Admin Flag
Users with `isAdmin: true` in the database have full admin access.

### Setting Admin Users
Use the internal mutation via CLI:
```bash
npx convex run admin:setAdminUser --email "user@example.com"
```

See `.agent/workflows/set-admin-user.md` for detailed instructions.

### Admin Auth Helper
**File**: `convex/lib/adminAuth.ts`

```typescript
import { requireAdmin } from "./lib/adminAuth";

// In any admin query/mutation
export const adminOnlyQuery = query({
  handler: async (ctx) => {
    await requireAdmin(ctx); // Throws if not admin
    // ... admin logic
  }
});
```

**Pattern**: Always call `requireAdmin(ctx)` at the start of admin-only queries and mutations.

## Schema Changes

### Users Table
Added fields:
- `isAdmin: v.optional(v.boolean())` - Admin flag
- `isActive: v.optional(v.boolean())` - Account status (for deactivation)

**Indexes**:
- `by_admin` - Query admin users
- `by_active` - Filter by account status

## Admin Queries

**File**: `convex/admin.ts`

### getAllUsers
Get paginated list of users with search and filters.

**Args**:
- `searchTerm?: string` - Search by name/email
- `filterStatus?: "active" | "inactive" | "verified" | "all"`
- `paginationOpts: { numItems, cursor }`

**Returns**: Users with ad counts and stats

### getAllFlyers
Get all flyers including soft-deleted ones.

**Args**:
- `searchTerm?: string` - Search by title/description/location
- `filterStatus?: "active" | "inactive" | "deleted" | "all"`
- `categoryId?: Id<"categories">`
- `paginationOpts`

**Returns**: Flyers with user and category info

### getAllReports
Get user-submitted reports with filtering.

**Args**:
- `status?: "pending" | "reviewed" | "resolved"`

**Returns**: Reports with reporter and reported entity details

### getUserDetails
Get detailed user information including activity.

**Args**:
- `userId: Id<"users">`

**Returns**: User with stats, recent ads, chats, and reports

### getChatForModeration
View any chat conversation (admin override).

**Args**:
- `chatId: Id<"chats">`

**Returns**: Chat with buyer, seller, ad, and all messages

## Admin Mutations

### toggleUserStatus
Activate or deactivate user accounts.

**Behavior**:
- Toggles `isActive` field
- When deactivating, also deactivates all user's ads
- Cannot deactivate admin accounts

### deleteUserAccount
Delete user account (admin override).

**Behavior**:
- Soft-deletes all user's ads
- Hard-deletes the user record
- Cannot delete admin accounts

### deleteFlyerImage
Remove specific image from a flyer.

**Args**:
- `adId: Id<"ads">`
- `imageRef: string` - The image reference to remove

**Returns**: `{ success, remainingImages }`

### deleteFlyerAdmin
Soft-delete a flyer (admin override).

**Behavior**:
- Sets `isDeleted: true` and `isActive: false`
- Preserves data for potential restoration

### updateReportStatus
Update report status.

**Args**:
- `reportId: Id<"reports">`
- `status: "pending" | "reviewed" | "resolved"`

### toggleUserVerification
Toggle user verification status.

**Behavior**:
- Toggles `isVerified` field
- Adds/removes verification badge

## Frontend Components

### AdminDashboard
**File**: `src/features/admin/AdminDashboard.tsx`

Main admin interface with tab navigation.

**Features**:
- Admin access check (redirects non-admins)
- Tab-based navigation (Users, Flyers, Reports, Chats)
- Admin indicator in header

### UsersTab
**File**: `src/features/admin/UsersTab.tsx`

**Features**:
- Search users by name/email
- Filter by status (active/inactive/verified)
- User stats display
- Expandable user details
- Actions: activate/deactivate, verify/unverify, delete

### FlyersTab
**File**: `src/features/admin/FlyersTab.tsx`

**Features**:
- Search flyers by title/description/location
- Filter by status (active/inactive/deleted)
- Image management modal
- Delete specific images from flyers
- Soft-delete entire flyers

### ReportsTab
**File**: `src/features/admin/ReportsTab.tsx`

**Features**:
- Filter reports by status
- View reporter and reported entity details
- Update report status (pending/reviewed/resolved)
- Stats dashboard

### ChatsTab
**File**: `src/features/admin/ChatsTab.tsx`

**Features**:
- Load chat by ID
- View full conversation history
- Read-only access (admins cannot send messages)
- Display buyer/seller/ad information

### SettingsTab (numeric app config)
**File**: `src/features/admin/SettingsTab.tsx` (added Jul 2026, Boost feature)

The numeric sibling of `FeatureFlagsTab`: `featureFlags` stores booleans, `appSettings` stores numbers. As of Jul 2026 the tab renders **grouped sections** (Boost, Bundles, Moving Sales, Feed, Rate limits) — same per-field card design, lightweight `h3` group headers, count chip = total fields. Backend: `convex/appSettings.ts` (admin-gated `getAllSettings` + `updateSetting` with known-key upsert, public `getSetting`); bounds/defaults come from the setting registry in `convex/lib/appConfig.ts` via `getAppSettingSpec(key)` (boost bounds still originate in `convex/lib/boost.ts`; rate-limit data in `convex/lib/rateLimitConfig.ts`) and are **imported by the component** (never hardcode bounds — the client bound must track the server clamp).

**Sparse rate-limit fields**: one field per op in `OVERRIDABLE_RATE_LIMIT_OPS` (generated, not hand-listed). No row seeded — a missing row renders the static default, stays EDITABLE, shows "Using default N — saving creates an override", and Save upserts the `rateLimitMax_<op>` row. The "Not configured — run seedAppSettings" disabled state applies only to must-seed (non-sparse) fields.

Patterns worth reusing for future numeric settings:
- **Draft map, no useEffect sync**: `drafts: Record<key,string>` holds a value only while mid-edit; the displayed value is `drafts[key] ?? String(serverValue)`. After a successful save, `delete drafts[key]` so the input falls back to the (now reactive/updated) server value. Avoids stale-state useEffect syncing.
- **Dual validation**: client disables Save + shows `text-destructive` helper (`Enter {min}–{max} {unit}`) when out of range OR unchanged; server (`updateSetting`) *rejects* (throws) out-of-range via `isAppSettingInRange` (generic, registry-driven) rather than silently clamping — the admin gets loud feedback. Reads still clamp (`clampAppSetting`) as defense-in-depth.
- **Graceful un-seeded state**: if a must-seed key is absent from `getAllSettings`, render the field from its registry default with Save disabled + a "run `npx convex run migrations:seedAppSettings`" hint (mirrors FeatureFlagsTab's seed hint). Sparse (rate-limit) keys stay editable instead. Seed: `migrations:seedAppSettings` (idempotent, never overwrites a tuned value, skips `seed: false` entries).
- Icon: phosphor `Sliders` (repo convention — NOT lucide; enforced by `src/test/phosphor-migration.test.ts`).
- Tests: `src/features/admin/SettingsTab.test.tsx` mock `convex/react` (`useQuery`/`useMutation`) + `sonner` inline — the established pattern from `AdminDashboardPage.test.tsx` (no per-tab test existed before this).

**Wiring a new admin tab = 4 edits in `AdminDashboard.tsx`**: (1) icon import, (2) `activeTab` state union, (3) `tabs` array (append last), (4) render switch. Same shape as the Feature Flags tab.

## Routing

**Route**: `/admin`

**Protection**: Built-in access check in `AdminDashboard` component

**Lazy Loading**: Uses React.lazy for code splitting

## UI Patterns

### Admin Badge
Admin mode indicator in header:
```typescript
<div className="flex items-center gap-2">
  <Shield className="w-5 h-5 text-primary-600" />
  <h1>Admin Dashboard</h1>
</div>
```

### Confirmation Modals
All destructive actions (delete user, delete flyer) use confirmation modals:
```typescript
{showDeleteConfirm && (
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-lg p-6 max-w-md">
      <h3>Confirm Action</h3>
      <p>Warning message</p>
      <div className="flex gap-3">
        <button onClick={onCancel}>Cancel</button>
        <button onClick={onConfirm} className="bg-red-600">Delete</button>
      </div>
    </div>
  </div>
)}
```

### Stats Cards
Consistent stats display across tabs:
```typescript
<div className="grid grid-cols-2 md:grid-cols-4 gap-4">
  <div className="bg-blue-50 rounded-lg p-4">
    <div className="text-2xl font-bold text-blue-600">{count}</div>
    <div className="text-sm text-gray-600">Label</div>
  </div>
</div>
```

## Security Considerations

### Admin-Only Access
- All admin queries/mutations use `requireAdmin(ctx)`
- Frontend checks admin status before rendering
- Non-admins see "Access Denied" message

### Protected Operations
- Cannot deactivate/delete admin accounts
- Cannot delete own admin account
- All mutations verify admin status

### Audit Trail (IMPLEMENTED)
Every admin mutation calls `logAdminAction(label, {...})` from `convex/lib/logger.ts` — records the admin id, target id, and before/after values (e.g. `toggleUserStatus`, `deleteUserAccount`, `deleteFlyerAdmin`, `deleteFlyerImage`, `updateReportStatus`, `toggleUserVerification`, and `appSettings.updateSetting`). This is server-side logging, not a queryable audit table — an in-app audit-log *viewer* is still a future enhancement.

### ⚠️ Ungated destructive mutation — `categories.updateCategories`
**File**: `convex/categories.ts:264`. This is a **public `mutation` with NO `requireAdmin` gate** that **deletes ALL categories and reseeds a hardcoded 11-item list**. Any client (even unauthenticated) can call `api.categories.updateCategories` and wipe the category table. It is a leftover dev seeder — the only frontend reference is a dead, never-rendered `handleUpdateCategories` in `src/pages/HomePage.tsx:112`. **Fix: delete it, or convert to `internalMutation` + add `requireAdmin`.** (Same class of bug as the historical `reports.getAllReports` leak, which is now correctly gated in `convex/admin.ts:153`.)

## Common Patterns

### Pagination
```typescript
const result = await ctx.db
  .query("users")
  .order("desc")
  .paginate(args.paginationOpts);

return {
  items: result.page,
  continueCursor: result.continueCursor,
  isDone: result.isDone,
};
```

### Search Implementation
Client-side filtering for simplicity:
```typescript
let items = result.page;
if (searchTerm) {
  const searchLower = searchTerm.toLowerCase();
  items = items.filter(item =>
    item.name?.toLowerCase().includes(searchLower) ||
    item.email?.toLowerCase().includes(searchLower)
  );
}
```

### Soft Delete Pattern
```typescript
await ctx.db.patch(adId, {
  isDeleted: true,
  isActive: false,
});
```

## Testing

### Manual Testing Checklist
- [ ] Non-admin users cannot access `/admin`
- [ ] Admin users see full dashboard
- [ ] User search and filters work correctly
- [ ] User activation/deactivation works
- [ ] User deletion soft-deletes their ads
- [ ] Flyer search and filters work
- [ ] Image deletion removes specific images
- [ ] Flyer deletion soft-deletes correctly
- [ ] Report status updates work
- [ ] Chat viewing displays correctly

### Edge Cases
- Deleting user with active chats
- Deleting all images from a flyer
- Viewing deleted flyers
- Filtering with no results

## Category Management

### Schema
**File**: `convex/schema.ts`

Categories table includes:
- `name: v.string()` - Category display name
- `slug: v.string()` - URL-friendly identifier (unique)
- `icon: v.optional(v.string())` - Emoji or icon name
- `parentId: v.optional(v.id("categories"))` - For subcategories

**Indexes**:
- `by_slug` - Query by slug
- `by_parent` - Query subcategories

### Admin Mutations
**File**: `convex/categories.ts`

#### createCategory
Create new category or subcategory.

**Args**:
- `name: string` - Required, max 50 chars
- `slug: string` - Lowercase, alphanumeric + hyphens
- `icon?: string` - Optional emoji or icon name
- `parentId?: Id<"categories">` - Optional parent for subcategories

**Validation**:
- Slug must be unique
- Slug format: `/^[a-z0-9-]+$/`
- Max 1 level of nesting (no subcategories of subcategories)
- Parent must exist if provided

#### updateCategory
Update existing category.

**Args**:
- `categoryId: Id<"categories">`
- `name?: string`
- `slug?: string`
- `icon?: string`
- `parentId?: Id<"categories">`

**Validation**:
- Cannot be own parent
- Cannot make parent into subcategory if it has children
- Slug uniqueness (excluding current category)

#### deleteCategory
Delete category with safety checks.

**Args**:
- `categoryId: Id<"categories">`

**Protection**:
- Cannot delete if has subcategories
- Cannot delete if used by ads
- Must reassign or delete dependencies first

### Public Queries

#### getCategories
Get all categories (no auth required).

#### getCategoryBySlug
Get category by slug (no auth required).

#### getCategoryById
Get single category by ID.

#### getSubcategories
Get all children of a parent category.

**Args**:
- `parentId: Id<"categories">`

### Usage Examples

```bash
# Create top-level category
npx convex run categories:createCategory '{
  "name": "New Category",
  "slug": "new-category",
  "icon": "🎯"
}'

# Create subcategory
npx convex run categories:createCategory '{
  "name": "Subcategory",
  "slug": "subcategory",
  "parentId": "<PARENT_ID>"
}'

# Update category
npx convex run categories:updateCategory '{
  "categoryId": "<ID>",
  "name": "Updated Name",
  "icon": "🚀"
}'

# Delete category
npx convex run categories:deleteCategory '{
  "categoryId": "<ID>"
}'
```

## Future Enhancements


### Potential Features
- Bulk actions (delete multiple users/flyers)
- Advanced search with multiple filters
- Export data to CSV
- Analytics dashboard (user growth, flyer trends)
- Email notifications for admin actions
- Audit log viewer
- Scheduled tasks (auto-delete old soft-deleted items)
- IP ban management
- Content moderation AI integration

### Performance Optimizations
- Server-side search instead of client-side filtering
- Infinite scroll instead of pagination
- Caching for frequently accessed data
- Background jobs for bulk operations
