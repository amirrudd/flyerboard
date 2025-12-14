# AdMessages Component - Critical Chat Behavior

This document describes the critical chat behavior in the `AdMessages` component that is protected by automated tests.

## 🔒 Protected Behaviors

### 1. Authentication & User Sync Requirements

**Critical Rule:** Queries must ONLY run when ALL conditions are met:
- ✅ User is authenticated (`isAuthenticated === true`)
- ✅ Session is not loading (`isSessionLoading === false`)
- ✅ User is synced to database (`isUserSynced === true`)

**Why This Matters:**
- Prevents "Not authenticated" errors from race conditions
- Ensures user record exists in database before querying
- Avoids querying before authentication is complete

**Test Coverage:**
- `should not query chats when user is not authenticated`
- `should not query chats when session is loading`
- `should not query chats when user is not synced to database`
- `should query chats only when authenticated AND user is synced`

### 2. Message Ordering

**Critical Rule:** Messages MUST be rendered in chronological order (oldest to newest)

**Why This Matters:**
- Standard chat UX pattern
- Allows users to read conversation history naturally
- Works with auto-scroll to bottom

**Test Coverage:**
- `should render messages in correct order (oldest to newest)`

### 3. Bottom Alignment with Free Scroll

**Critical Rule:** Messages must align to the bottom while allowing free scrolling

**Implementation:**
```tsx
{/* Outer container: scrollable */}
<div className="flex-1 min-h-0 overflow-y-auto p-4">
  {/* Inner wrapper: bottom alignment */}
  <div className="flex flex-col space-y-4 min-h-full justify-end">
    {messages.map(...)}
    <div ref={messagesEndRef} />
  </div>
</div>
```

**Why This Matters:**
- When few messages: aligns to bottom (like chat apps)
- When many messages: allows scrolling through history
- Auto-scrolls to bottom on new messages

**Test Coverage:**
- `should have correct CSS classes for bottom alignment with scroll`
- `should have scrollIntoView ref at the end of messages`

### 4. Mobile Scroll Support

**Critical Rule:** Must support touch scrolling on mobile devices

**Implementation:**
```tsx
style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
```

**Why This Matters:**
- Prevents scroll blocking on mobile
- Avoids iOS scroll issues
- Ensures smooth touch interactions

**Test Coverage:**
- `should maintain touch-action and overscroll-behavior for mobile scroll`

### 5. Message Alignment

**Critical Rule:** 
- Seller messages → right-aligned with primary background
- Buyer messages → left-aligned with white background

**Why This Matters:**
- Standard chat UX pattern
- Clear visual distinction between participants
- Improves readability

**Test Coverage:**
- `should align seller messages to the right`
- `should apply correct background colors to messages`

## 🚫 Common Mistakes to Avoid

### ❌ DON'T: Use `justify-end` on the scroll container
```tsx
{/* WRONG - breaks scroll */}
<div className="flex-1 overflow-y-auto flex flex-col justify-end">
```

### ✅ DO: Use `justify-end` on inner wrapper
```tsx
{/* CORRECT - maintains scroll */}
<div className="flex-1 overflow-y-auto">
  <div className="flex flex-col min-h-full justify-end">
```

### ❌ DON'T: Query before user sync completes
```tsx
{/* WRONG - causes "Not authenticated" error */}
const chats = useQuery(api.messages.getAdChats, { adId });
```

### ✅ DO: Wait for authentication AND sync
```tsx
{/* CORRECT - prevents race condition */}
const chats = useQuery(
  api.messages.getAdChats,
  isAuthenticated && !isSessionLoading && isUserSynced ? { adId } : "skip"
);
```

### ❌ DON'T: Use `flex-col-reverse` for message ordering
```tsx
{/* WRONG - breaks auto-scroll behavior */}
<div className="flex flex-col-reverse">
```

### ✅ DO: Render in normal order with ref at end
```tsx
{/* CORRECT - works with scrollIntoView */}
<div className="flex flex-col">
  {messages.map(...)}
  <div ref={messagesEndRef} />
</div>
```

## 🧪 Running Tests

```bash
# Run AdMessages tests
npm test src/features/ads/AdMessages.test.tsx

# Run in watch mode
npm test src/features/ads/AdMessages.test.tsx -- --watch
```

## 📝 When to Update Tests

Update tests when:
- ✅ Changing authentication logic
- ✅ Modifying scroll behavior
- ✅ Updating message layout/styling
- ✅ Adding new features to chat

## 🔍 Test Failures

If tests fail, check:
1. **Authentication tests failing?** → Check auth/sync conditions in queries
2. **Scroll tests failing?** → Check CSS classes on scroll containers
3. **Ordering tests failing?** → Check message rendering order
4. **Alignment tests failing?** → Check justify-end placement

## 📚 Related Files

- `/src/features/ads/AdMessages.tsx` - Component implementation
- `/src/features/ads/AdMessages.test.tsx` - Test suite
- `/src/context/UserSyncContext.tsx` - User sync tracking
- `/src/lib/useDescopeUserSync.ts` - User sync hook
- `/convex/messages.ts` - Backend queries/mutations
