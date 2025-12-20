# Admin Patterns & Dashboard

**Last Updated**: 2025-12-20

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

### Audit Trail
**Future Enhancement**: Consider adding audit logging for admin actions:
- Who performed the action
- What action was performed
- When it was performed
- Target user/flyer/report

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
