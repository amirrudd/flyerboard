# UI Patterns & Components

**Last Updated**: 2026-07-16

## Icon library policy (2026-07-16)
Phosphor (`@phosphor-icons/react`) is the app-wide icon library — 16/20/24px. lucide-react survives in exactly one place: category icons, because the DB stores category `icon` as a Lucide PascalCase slug (e.g. `"Car"`). Two files:
- `src/lib/categoryIcons.tsx` — public, imported eagerly (homepage Sidebar). Ships a **curated** ~21-icon subset that's a superset of every slug prod categories actually use. Exports `getCategoryIcon` (LayoutGrid fallback), `hasIcon`, `getIconCdnUrl`, `pascalToKebab`.
- `src/lib/adminIconMap.ts` — admin-only, the full ~180-icon mega-map (spreads the curated map + the rest). Only `src/features/admin/CategoriesTab.tsx` imports it, and it's only reachable through the lazy `/admin` route. **Never import `adminIconMap` from a public/eager surface** — importing the full mega-map eagerly was costing ~56KB in the entry chunk before this 2026-07-16 split.
- Ceiling: an admin-picked icon outside the curated map renders as `LayoutGrid` on public surfaces (Sidebar, PostAd category picker) until it's added to the curated list. `CategoriesTab`'s own preview still works for any icon via the lucide-static CDN fallback (`getIconCdnUrl`), independent of the curated map.
- `src/components/ui/LucideIconPicker.tsx` does NOT import either module — it fetches `tags.json` from the lucide-static CDN and renders `<img>` tags, so it carries zero lucide-react JS cost.

## LazyMotion / `m.*` (2026-07-16)
The app loads framer-motion's full feature set (`domMax`, needed for `layout`/`layoutId`/`drag` used across ~14 sites) asynchronously via `<LazyMotion features={...} strict>` wrapped around the router in `src/App.tsx`, loading `src/lib/motionFeatures.ts` (`export { domMax as default } from "framer-motion"`) as a dynamic import.
- **Use `m.*`, not `motion.*`.** Every file that renders an animated element imports `{ m }` from `"framer-motion"` and writes `<m.div>` etc. `strict` mode on `LazyMotion` throws in dev if a stray `motion.*` import sneaks back in — that's the regression guard, don't remove `strict` to silence it, fix the import instead.
- Non-JSX framer-motion APIs (`useAnimation`, `useAnimationControls`, `useMotionValue`, `useTransform`, `animate`, `useReducedMotion`, `AnimatePresence`) are unaffected by this — they don't go through the `m` namespace and don't need renaming.
- `useMotionPrefs.ts` remains the sanctioned place for variant objects (`fadeUp`, `whileInView`, `staggerCard`, etc.) — spread its helpers onto `<m.*>` elements, same as before.

## Shared messaging component library (2026-07-05)
`src/features/messages/` is the ONE chat/inbox implementation — `ConversationThread` (protected scroll pattern: outer `flex-1 min-h-0 overflow-y-auto` + inner `min-h-full justify-end`, auto-scroll, touch props), `MessageBubble`, `MessageComposer` (Enter sends / Shift+Enter newline — the app-wide rule now), `ConversationHeader`, `InboxRow`, `RoleChip`, `UnreadBadge`, `useInbox(options: {flyerId?, initialFilter?, enabled?})`. Consumers: UserDashboard chats tab (unified inbox), AdMessages (per-ad seller view), AdDetail (buyer panel + mobile sheet), BottomNav (UnreadBadge). Do NOT hand-roll new chat UI or a second composer — extend this library. Its tests own the protected chat behaviors formerly documented only in `ADMESSAGES_BEHAVIOR.md`.
- **Convex mock gotcha for tests**: `api.module.fn` is an `anyApi` Proxy — property access mints a fresh object each time, so identity comparison in `useQuery` mocks fails across renders. Key mocks on `(fn as any)[Symbol.for("functionName")]` (e.g. `"adDetail:getAdById"`), never on object identity or call order.
- **jsdom**: `ConversationThread` calls `scrollIntoView` — consumer tests must stub `Element.prototype.scrollIntoView`.
- **BottomSheet nesting**: BottomSheet's content div already scrolls (`flex-1 overflow-y-auto overscroll-contain`); nesting ConversationThread directly double-scrolls. Wrap it in `flex flex-col min-h-0 max-h-[50dvh]` with the composer as a sibling.

## Floating pill inside a scroller: `sticky` + `h-0` (2026-07-11, PR #289)
To float an overlay (e.g. ConversationThread's "New message" pill) above the bottom edge of a scroll container without a portal or absolute-positioning against the page: render, as the LAST child inside the scrollport, `<div className="sticky bottom-16 h-0 flex justify-center pointer-events-none">` and put the pill (with `pointer-events-auto`) inside. `h-0` means it occupies no layout space (no content shift, no scroll-height change); `sticky bottom-*` pins it to the scrollport's visible bottom edge regardless of scroll position. Canonical: `src/features/messages/ConversationThread.tsx:~173`.

## Offline signal: `useConvexConnectionState` (2026-07-11, PR #289)
The sanctioned way to detect offline is `useConvexConnectionState()` from `convex/react` — NOT `navigator.onLine` (lies on captive portals / doesn't know about the Convex WebSocket). Treat as offline only when `hasEverConnected && !isWebSocketConnected`, and debounce ~2s before showing UI (reconnect blips must not flicker banners). Strict-lint note: don't `setState` synchronously in the effect body — set it inside the debounce `setTimeout` (0ms on recovery). Canonical: MessagesPage's `useOfflineStatus` (`src/pages/MessagesPage.tsx:~743`).

## ImageDisplay backdrop mode needs `isolate` (2026-07-06)
`ImageDisplay`'s backdrop mode gives the LazyLoadImage wrapper `z-[1]` to sit above the blurred fill. Its container div is positioned with `z-auto`, which is NOT a stacking context — so that `z-[1]` escaped into the card's stacking context and painted the photo OVER sibling overlays (grid "New"/"Trade" badges were visibly clipped by tall, letterboxed images in prod). Fixed by adding `isolate` to the backdrop container so the inner z-index stays scoped. Rule of thumb: any component that uses z-index internally and renders under sibling overlays must isolate its own stacking context (`isolate` / `relative z-0`) — don't fix it by z-index-escalating every badge.

## `overflow-y-auto` clips outset rings/shadows (2026-07-16)
Setting `overflow-y-auto` on a scroll container silently computes `overflow-x` from `visible` to `auto` (CSS spec: the two axes can't disagree when one is non-visible) — making it a **clip boundary on both axes**. Children flush against it lose the left/right edge of anything painted OUTSIDE their border box. Tailwind's `ring-*` is exactly that: a non-inset box-shadow drawn 1px outside. Symptom: the leftmost/rightmost cards in the homepage feed had their 1px ring shaved off — visible in light mode (warm `ring-border/70` hairline), near-invisible in dark mode, which is why it went unnoticed for so long.
Fix at the **container** (`src/pages/HomePage.tsx`, the `adsFeedRef` div): `md:px-2 md:-mx-2` — the padding buys room inside the clip boundary, the negative margin cancels the position shift so the grid stays pixel-identical. Scope the pair to the same breakpoint as the `overflow-y-auto` that causes it.
Don't "fix" it by making the card's ring inset (`ring-inset`): `.listing-card:hover` also carries an outset `0 16px 32px -12px` shadow and `.spotlight-card::before` a glow — inset-ring fixes the 1px and leaves the 20px shadow still clipped. Diagnose by measuring: `cardRect.left - scrollContainerRect.left` should be > 0; if it's exactly `0`, the ring is being trimmed.
Only HomePage needs this today — every other `overflow-y-auto` scroller either carries its own `p-4`/`px-*` gutter (`ConversationThread`, `SidebarContent`, modals) or rings the scroller itself. Extract a utility only when a second flush-child scroller appears.

## Motion helpers in useMotionPrefs (2026-07-05)
`src/hooks/useMotionPrefs.ts` gained `bubbleIn(delay?)` (chat bubble enter: fade + 8px rise, 180ms ease-out, 120ms ease-in exit), `listStagger(index, cap=12, step=0.04)` (list entrances, 40ms/item stagger capped at 12), and `scalePop()` (badge pop 0.8→1; re-key the element to replay on value change). All collapse under `prefers-reduced-motion`, animate transform/opacity only, exits shorter than enters. This hook remains the ONLY sanctioned framer-motion entry point — extend it rather than writing raw variants; `layoutId` pill animations (inbox filter) must set `duration: 0` when `reduced`.

## `position: fixed` inside `<main>` needs a portal (2026-07-01)
`Layout.tsx`'s `<main>` (`mobile-scroll-container` class, `index.css`) sets `contain: layout style paint` for scroll performance. Per spec, `contain: layout`/`paint` makes an element a **containing block for `position: fixed` descendants** — any plain `fixed` div nested inside `<main>` (which every routed page renders into) pins to `<main>`'s full scrollable content height, not the viewport. Symptom: a "sticky" bottom bar drifts into the middle of the page as the user scrolls, instead of staying pinned to the screen edge.
- **Fix**: `createPortal(<div className="fixed ...">, document.body)`. `AdDetail.tsx`'s mobile FABs already do this (comment: "Using Portal to ensure fixed positioning works") — that's the precedent to copy for any new fixed-position UI, not just this one component.
- **Gotcha found while fixing**: once a fixed element correctly portals to `document.body`, remember it now competes with the persistent mobile `BottomNav` (`fixed bottom-0`, `z-50`, `md:hidden`) for the same screen real estate. Offset with `bottom-[var(--bottom-nav-height)] md:bottom-0` (same CSS var `AdDetail`'s FABs use) rather than a plain `bottom-0`, or the new element renders invisibly behind the nav bar.
- Fixed in `PublicSaleView.tsx`'s sale-message sticky footer (2026-07-01) — it had shipped without the portal.

## Thumbnail fill: blurred backdrop (2026-06-28)
The shared `ImageDisplay` (`src/components/ui/ImageDisplay.tsx`) has an opt-in `backdrop` prop. When true it renders the image `object-contain` (never cropped) on top of a blurred, `scale-110 blur-2xl opacity-80 object-cover` copy of itself inside an `absolute inset-0` container. This fills any aspect-ratio box with no empty letterbox bars and no cropping — used by the browse grid (`AdsGrid.tsx`, the `aspect-[4/3]` box).
- **Why over plain `object-cover`**: marketplace photos vary wildly in ratio; cover-crop would chop tall flyers / wide panoramas in the thumbnail.
- **Why over plain `object-contain` (previous default)**: contain left grey `bg-muted/60` bars that made the grid look uneven.
- **Scope**: opt-in only — detail page and dashboard keep plain `object-contain` (full fidelity). Do not enable globally.
- **Parent must be positioned** (`relative`): the backdrop renders an `absolute inset-0` layer. `AdsGrid`'s `aspect-[4/3] relative` box satisfies this; any new caller must too.
- The blurred layer reuses the already-resolved `displaySrc` (same URL, browser-cached, ~free). Loading/error states unchanged.

## Known a11y debt (2026-05-09 audit, F8 — deferred)
- `RatingModal` (`src/components/RatingModal.tsx`) and `BottomSheet` (`src/components/ui/BottomSheet.tsx`) are portal-rendered overlays without `role="dialog"`. Add `role="dialog"`, `aria-modal="true"`, and `aria-labelledby`/`aria-describedby` references when next touching them.
- `StarRating` has no keyboard navigation (arrow keys to change rating, Space/Enter to commit).
- Reusable loader: `src/components/PageLoader.tsx` (extracted from `App.tsx` 2026-05-09). Use this for route-guard loading states; don't recreate the spinner.

## Design Philosophy

### Mobile-First
- Design for mobile, enhance for desktop
- Touch-friendly targets (min 44x44px)
- Responsive layouts with breakpoints
- Bottom navigation on mobile, sidebar on desktop

### Smooth Interactions
- Transitions for state changes (200-300ms)
- Loading states for async operations
- Optimistic updates where possible
- Clear feedback for user actions

### Minimal & Clean
- No unnecessary visual clutter
- Compression status badges removed (runs silently)
- Focus on content, not chrome
- Consistent spacing and alignment

### Dark Mode & Semantic Theming
- **Semantic Tokens**: Use functional names (e.g., `bg-background`, `text-foreground`) instead of hardcoded colors.
- **HSL Variables**: Defined in `index.css` for both `:root` and `.dark` scopes.
- **System Sync**: Automatic detection of `prefers-color-scheme`.
- **FOUC Prevention**: Early theme application via inline script to prevent "Flash of Unstyled Content".
- **Brand Consistency**: Maintain primary brand colors (e.g., red) with adjusted foregrounds for accessibility.

## Key Components

### CircularProgress
**File**: `src/components/ui/CircularProgress.tsx`

**Purpose**: Beautiful loading indicator for operations.

**Usage**:
```typescript
<CircularProgress progress={75} size={140} strokeWidth={10}>
  <div className="text-center">
    <div className="text-3xl font-bold text-primary-600">75%</div>
    <div className="text-xs text-gray-500 mt-1">Uploading</div>
  </div>
</CircularProgress>
```

**Features**:
- SVG-based (smooth scaling)
- Customizable size, color, stroke width
- Center content slot for percentage/status
- Smooth animation via CSS transitions

**When to use**:
- ✅ Long operations (compression, upload)
- ✅ Determinate progress (known percentage)
- ❌ Indeterminate loading (use spinner instead)

### ImageUpload
**File**: `src/components/ui/ImageUpload.tsx`

**Purpose**: Non-blocking image selection and compression.

**Key features**:
- Drag & drop support
- Immediate preview display
- Background compression
- Grid layout for previews
- Remove button on hover

**Props**:
```typescript
interface ImageUploadProps {
  images: string[];                    // Preview URLs
  onImagesChange: (images: string[]) => void;
  onCompressionStateChange?: (states: Map<string, ImageState>) => void;
  maxImages?: number;                  // Default: 10
}
```

**Pattern**: Controlled component - parent manages state.

### ImageDisplay
**File**: `src/components/ui/ImageDisplay.tsx`

**Purpose**: Display images from various sources (R2, external, base64).

**Features**:
- Lazy loading with fade-in
- Skeleton placeholder
- Error fallback
- Handles all image reference types
- Priority loading for above-the-fold images

**Props**:
```typescript
interface ImageDisplayProps {
  imageRef?: string | null | undefined;  // Preferred: R2 storage reference
  src?: string;                          // Backward compatibility: direct URL
  alt: string;                           // Required alt text
  className?: string;                    // CSS classes
  onError?: () => void;                  // Error callback
  priority?: boolean;                    // Skip lazy loading for above-the-fold images
}
```

**Usage**:
```typescript
// Standard usage with lazy loading
<ImageDisplay
  imageRef="r2:flyers/123/abc.webp"
  alt="Product image"
  className="w-full h-full object-cover"
/>

// Priority loading for first visible images (e.g., first 6 in grid)
<ImageDisplay
  imageRef={ad.images[0]}
  alt={ad.title}
  className="w-full h-full object-contain"
  priority={index < 6}  // First 6 images load immediately
/>
```

**Performance tip**: Set `priority={true}` for the first 6 images in grids to improve perceived load time.

### ImageLightbox
**File**: `src/components/ui/ImageLightbox.tsx`

**Purpose**: Full-screen image viewer with navigation and keyboard controls.

**Features**:
- Full-screen overlay with dark backdrop (`bg-black/95 backdrop-blur-sm`)
- Keyboard navigation (Arrow keys, Escape)
- Thumbnail strip for quick navigation
- Image counter display
- Touch-friendly navigation buttons with premium styling:
  - Semi-transparent black background (`bg-black/50`)
  - Backdrop blur effect
  - White border (`border-white/20`)
  - Shadow and hover effects
- Prevents body scroll when open
- Responsive padding for UI elements (top counter, bottom thumbnails)

**Props**:
```typescript
interface ImageLightboxProps {
  images: string[];           // Array of image references
  currentIndex: number;       // Currently displayed image index
  isOpen: boolean;           // Lightbox visibility state
  onClose: () => void;       // Close callback
  onNavigate: (index: number) => void;  // Navigation callback
  altPrefix?: string;        // Alt text prefix (default: "Image")
}
```

**Usage**:
```typescript
const [showLightbox, setShowLightbox] = useState(false);
const [currentIndex, setCurrentIndex] = useState(0);

<ImageLightbox
  images={imageRefs}
  currentIndex={currentIndex}
  isOpen={showLightbox}
  onClose={() => setShowLightbox(false)}
  onNavigate={setCurrentIndex}
  altPrefix="Product"
/>
```

**Integration pattern**:
```typescript
// Make image clickable to open lightbox
<div onClick={() => setShowLightbox(true)} className="cursor-pointer">
  <ImageDisplay imageRef={images[currentIndex]} alt="..." />
</div>
```

**Styling details**:
- Close/navigation buttons: `bg-black/50 hover:bg-black/70 border border-white/20 backdrop-blur-sm shadow-lg`
- Main container: `px-4 sm:px-8 pt-16 pb-28 sm:pb-32` (space for counter and thumbnails)
- Image display: `w-full h-full object-contain` (maintains aspect ratio)

### Header — persistent app shell (2026-07-02)
**Files**: `src/features/layout/Header.tsx` (visuals — unchanged), `src/features/layout/HeaderSlots.tsx` (slot registration), `src/features/layout/Layout.tsx` (the ONE instance)

**Purpose**: ONE `<Header>` instance rendered by `Layout`, persisting across all routes under it. Pages must NOT render `<Header>` themselves anymore — doing so would double the header. They customise via slot registration:

```typescript
import { useHeaderSlots } from "@/features/layout/HeaderSlots";

// inside the page component, top-level, BEFORE any early return:
useHeaderSlots({
  leftNode: <BackButton />,
  centerNode: <Title />,
  rightNode: <Actions />,   // or `hidden: true` for full-screen sub-views
});
```

Pages that register nothing (HomePage) get the default header — search / location / sidebar state wired from `MarketplaceContext` by Layout's `PersistentHeader`, auth via Descope `useSession()`.

**Why / how (load-bearing details)**:
- **Stale closures are impossible by design**: `useHeaderSlots` re-pushes the freshly built config on EVERY render (no-dep `useLayoutEffect`). Do NOT memoize the config. Slot JSX may close over live state (e.g. AdDetail's `displaySaved`).
- **No render loop**: registrations live in an external `HeaderSlotsStore`; only Layout's `PersistentHeader` subscribes (`useSyncExternalStore`), so pushing a config re-renders the header, never the registering page.
- **Nesting = mount-order stack, last mounted wins**: dashboard registers its header; the inline `<AdDetail>` it opens registers on top; on close the dashboard header is restored automatically. Caveat: don't mount two registrants in the same commit (child layout-effects run before the parent's, inverting the stack) — sub-screens must mount on a later interaction, which they all do today.
- **Conditional pages**: hooks rules mean the hook call must be unconditional — build the config conditionally instead (see `AdDetail.tsx`: not-found / loading-skeleton / loaded each produce a different `HeaderSlotsConfig`, one `useHeaderSlots(headerSlots)` call before the early returns).
- **`hidden: true`**: reserved for sub-views that supply their own full-screen chrome (dashboard's AdMessages screen, dashboard `!user`, admin loading/access-denied, and — since the mobile chat redesign, PR #289, 2026-07-11 — `/messages/:chatId` at `<md`, where the thread's `ConversationHeader` is the header and BottomNav is hidden too; the desktop two-pane keeps the shell header). Don't use it on normal pages.
- **Header stays INSIDE `<main>`** (before the `<Outlet/>`), not above it: `<main>` is the mobile scroll container and the header is `sticky top-0`; pages compute sticky offsets (`sticky top-21` sidebars in AdDetail/UserDashboard) against the 57px header living in the same scroller. Moving it outside `<main>` shifts every `top-21` by 57px. Related: HomePage's root is `md:h-[calc(100%-57px)]` so header + page = exactly 100% of `<main>` on desktop (keeps `<main>` non-scrollable there; the feed div remains the desktop scroller — see routing-navigation.md scroll preservation).
- **Suspense**: lazy-route fallbacks only replace the Outlet area; the header no longer unmounts/remounts on navigation or chunk load.
- **Auth modal**: Layout owns the single OTP modal; pages reach it via `useOutletContext<{ setShowAuthModal }>()` (AdDetailPage's local duplicate was removed 2026-07-02).
- **Unit tests**: components that register slots render inside `HeaderSlotsHarness` from `src/test/headerSlotsTestUtils.tsx` (renders the current slots into `header-left/center/right` testids). Outside a provider the hook is a no-op.

**Responsive** (unchanged, in Header.tsx):
- Mobile: Compact, icon-only buttons
- Desktop: Full text labels

## Loading States

### Skeleton Loaders
**When**: Initial data load (unknown duration)

**Pattern**:
```typescript
{data === undefined ? (
  <SkeletonLoader />
) : data.length === 0 ? (
  <EmptyState />
) : (
  <DataDisplay data={data} />
)}
```

**Files**: `src/components/ui/DashboardSkeleton.tsx`

### Circular Progress
**When**: Known operation with progress (upload, compression)

**Pattern**: Modal overlay with progress indicator
```typescript
{isUploading && createPortal(
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm">
    <CircularProgress progress={uploadPercent}>
      {/* Status */}
    </CircularProgress>
  </div>,
  document.body
)}
```

### Spinner
**When**: Short operation, indeterminate

**Pattern**: Inline or button spinner
```typescript
<button disabled={isLoading}>
  {isLoading ? (
    <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
  ) : (
    'Submit'
  )}
</button>
```

## Modal Patterns

### Using createPortal
**Why**: Render outside parent DOM hierarchy (avoid z-index issues)

**Pattern**:
```typescript
{showModal && createPortal(
  <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
    <div className="bg-white rounded-2xl p-8 max-w-md">
      {/* Modal content */}
    </div>
  </div>,
  document.body
)}
```

**Styling**:
- Backdrop: `bg-black/50 backdrop-blur-sm`
- Modal: `rounded-2xl shadow-2xl`
- Animations: Fade in/out with transitions

### Confirmation Dialogs
**Pattern**: Two-button layout with clear actions
```typescript
<div className="flex gap-3">
  <button onClick={onCancel} className="flex-1 border">
    Cancel
  </button>
  <button onClick={onConfirm} className="flex-1 bg-red-600">
    Delete
  </button>
</div>
```

## Form Patterns

### Controlled Inputs
**Pattern**: State in parent, onChange updates
```typescript
const [formData, setFormData] = useState({ title: '', price: '' });

<input
  name="title"
  value={formData.title}
  onChange={(e) => setFormData(prev => ({
    ...prev,
    [e.target.name]: e.target.value
  }))}
/>
```

### Validation
**Client-side**: Before submit
```typescript
if (!formData.title || !formData.price) {
  toast.error("Please fill in all required fields");
  return;
}
```

**Server-side**: In Convex mutations
```typescript
if (!args.title || args.title.length < 3) {
  throw new Error("Title must be at least 3 characters");
}
```

### Submit States
**Pattern**: Disable during submission
```typescript
<button
  type="submit"
  disabled={isSubmitting || !isValid}
  className="disabled:opacity-50 disabled:cursor-not-allowed"
>
  {isSubmitting ? 'Saving...' : 'Save'}
</button>
```

## Responsive Design

### Breakpoints
- Mobile: < 768px
- Tablet: 768px - 1024px
- Desktop: > 1024px

### Mobile Scroll Container
**Pattern**: Fixed header/footer, scrollable content
```typescript
<div className="flex-1 overflow-y-auto mobile-scroll-container lg:overflow-visible">
  {/* Content */}
</div>
```

**CSS**:
```css
.mobile-scroll-container {
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  touch-action: manipulation; /* Prevents scroll freeze when tapping interactive elements */
}
```

**Important**: The `touch-action: manipulation` property prevents double-tap zoom and ensures scrolling works even after tapping on interactive elements like cards or buttons.

### Nested Scroll Containers
**Problem**: When you have nested scrollable containers (e.g., a messages list inside a scrollable page), touch events can get trapped in the nested container, preventing the main page from scrolling.

**Solution**: Add `touch-action: pan-y` and `overscroll-behavior: contain` to nested scroll containers:

```typescript
{/* Nested scrollable container (e.g., chat messages, conversation list) */}
<div 
  className="max-h-96 overflow-y-auto p-4 space-y-3" 
  style={{ touchAction: 'pan-y', overscrollBehavior: 'contain' }}
>
  {/* Scrollable content */}
</div>
```

**When to use**:
- ✅ Chat message containers
- ✅ Conversation lists
- ✅ Dropdown menus with scroll
- ✅ Any scrollable area inside a scrollable page

**Why it works**:
- `touch-action: pan-y` - Allows vertical panning (scrolling) and prevents touch event trapping
- `overscrollBehavior: contain` - Prevents scroll chaining (when you reach the end of nested scroll, it doesn't continue to parent scroll)

**Example locations**:
- `AdMessages.tsx` - Chat list and messages containers
- `UserDashboard.tsx` - Expanded chat messages
- `AdDetail.tsx` - Chat messages sidebar
- `ChatsTab.tsx` - Admin chat monitoring

### Mobile List-Detail Pattern
**Problem**: On mobile, showing both a list and detail view side-by-side (as on desktop) doesn't work well due to limited screen space.

**Solution**: Conditionally show only one view at a time on mobile, with navigation between them:

```typescript
{/* List - Hidden on mobile when item is selected */}
<div className={`lg:col-span-1 ${selectedId ? 'hidden lg:block' : ''}`}>
  {/* List content */}
</div>

{/* Detail - Hidden on mobile when no item is selected */}
<div className={`lg:col-span-2 ${!selectedId ? 'hidden lg:block' : ''}`}>
  {/* Detail content with back button */}
  <button onClick={() => setSelectedId(null)} className="lg:hidden">
    <ChevronLeft /> Back
  </button>
  {/* Detail content */}
</div>
```

**Key points**:
- Use `hidden lg:block` to hide on mobile but show on desktop
- Add a back button in the detail view that's only visible on mobile (`lg:hidden`)
- On desktop (lg breakpoint), both views remain visible
- Ensure root container uses `h-screen` not `min-h-screen` for proper flex layout

**Example**: `AdMessages.tsx` - Shows conversation list on mobile, then switches to messages view when a conversation is selected

### Bottom Navigation
**Mobile only**: Fixed bottom nav with safe area padding
```typescript
<div className="pb-bottom-nav md:pb-8">
  {/* Content with bottom padding for nav */}
</div>
```

**CSS**:
```css
.pb-bottom-nav {
  padding-bottom: calc(env(safe-area-inset-bottom) + 4rem);
}
```

## Toast Notifications

### Using Sonner
**File**: `src/main.tsx` - `<Toaster />` provider

**Patterns**:
```typescript
// Success
toast.success("Flyer posted successfully!");

// Error
toast.error(error.message || "Failed to save");

// Info
toast.info("Processing images...");

// With duration
toast.success("Saved!", { duration: 2000 });
```

**When to use**:
- ✅ Operation feedback (success/error)
- ✅ Non-critical information
- ❌ Critical errors (use modal instead)
- ❌ Long messages (use modal instead)

## Animation Patterns

### Transitions
**Standard duration**: 200-300ms
```css
transition: all 0.2s ease-out;
```

**Hover effects**:
```css
.button {
  transition: background-color 0.2s;
}
.button:hover {
  background-color: #ea580c;
}
```

### Loading Spinners
```css
.animate-spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
```

### Fade In
```css
.fade-in {
  animation: fadeIn 0.3s ease-out;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}
```

## Color Palette

### Brand Colors (Primary - Red)
- `primary`: `hsl(359 71% 36%)` - Main brand color (#9e1b1e)
- `primary-foreground`: Light text on primary backgrounds
- `primary-bright`: High-contrast variant for better text readability

### Semantic Tokens (Use These)
| Token | Light Mode | Dark Mode | Usage |
|-------|------------|-----------|-------|
| `bg-background` | White | Dark navy | Page backgrounds |
| `text-foreground` | Dark navy | Light gray | Primary text |
| `bg-card` | White | Dark navy | Card backgrounds |
| `text-muted-foreground` | Gray | Light gray | Secondary text |
| `bg-muted` | Light gray | Dark navy | Muted backgrounds |
| `bg-destructive` | Red | Dark red | Error states |
| `border-border` | Light gray | Dark gray | Borders |

### Status Colors (Semantic)
- **Success**: Use `text-green-600 dark:text-green-400` for success states
- **Error/Destructive**: Use `bg-destructive text-destructive-foreground`
- **Warning**: Use `text-amber-600 dark:text-amber-400`
- **Info**: Use `text-blue-600 dark:text-blue-400`

> **Note**: Prefer semantic tokens (`bg-background`, `text-foreground`, etc.) over hardcoded colors (`gray-500`, `neutral-100`) to ensure dark mode compatibility.

## Accessibility

### Focus States
**Always visible**: Outline on keyboard focus
```css
.button:focus-visible {
  outline: 2px solid #ea580c;
  outline-offset: 2px;
}
```

### ARIA Labels
```typescript
<button aria-label="Remove image" title="Remove image">
  <Trash2 className="w-4 h-4" />
</button>
```

### Keyboard Navigation
- Tab order follows visual order
- Enter/Space activates buttons
- Escape closes modals

## Testing Patterns

### Component Tests
```typescript
it('shows loading state', () => {
  render(<Component isLoading={true} />);
  expect(screen.getByRole('status')).toBeInTheDocument();
});
```

### User Interactions
```typescript
it('handles click', async () => {
  const onClick = vi.fn();
  render(<Button onClick={onClick} />);
  await userEvent.click(screen.getByRole('button'));
  expect(onClick).toHaveBeenCalled();
});
```

## Flex Layout Width Patterns

### Content Container in flex-col Parent

**Problem**: When using `flex flex-col` as a parent layout, child containers with `max-width` and `mx-auto` (for centering) but **no explicit width** can collapse during rendering, especially when their children use percentage-based widths.

**Root Cause**: 
- `max-width` only constrains upper bound, it doesn't set actual width
- In `flex-col`, children don't auto-stretch horizontally by default
- Percentage-based children (`lg:w-[70%]`, `lg:w-[30%]`) create circular dependency: parent width depends on children, children are % of parent
- CSS resolves this by shrinking to fit content → "compressed layout" bug

**Fix Pattern**: Always add `w-full` to content containers inside `flex-col` parents:

```tsx
{/* ❌ BAD - Missing width, can cause compressed layout */}
<div className="flex flex-col min-h-screen">
  <header>...</header>
  <div className="flex-1 content-max-width mx-auto container-padding">
    <div className="flex lg:flex-row gap-8">
      <div className="lg:w-[70%]">...</div>  {/* 70% of WHAT? */}
      <div className="lg:w-[30%]">...</div>
    </div>
  </div>
</div>

{/* ✅ GOOD - w-full ensures container takes 100% width */}
<div className="flex flex-col min-h-screen">
  <header>...</header>
  <div className="w-full flex-1 content-max-width mx-auto container-padding">
    <div className="flex lg:flex-row gap-8">
      <div className="lg:w-[70%]">...</div>  {/* 70% of parent's 100% width */}
      <div className="lg:w-[30%]">...</div>
    </div>
  </div>
</div>
```

**Symptom**: Page appears "compressed" or narrow during initial load or hard refresh, then expands once content loads.

**Where this applies**:
- Page layouts with `flex-col` outer wrapper
- Content containers using `content-max-width` or custom max-width
- Two-column layouts with percentage widths
- Skeleton vs loaded state transitions

### Skeleton and Loaded State Consistency

**Rule**: Skeleton layouts must have **identical container structure and dimensions** as loaded layouts to prevent layout shift.

**Checklist**:
- ✅ Same container classes (including `w-full`)
- ✅ Same flex/grid structure
- ✅ Same height for image placeholders (use `aspect-video`, `aspect-square`, etc.)
- ✅ Same sidebar/main column widths

## Common Mistakes to Avoid

❌ **Don't**: Block UI during async operations
✅ **Do**: Show loading state, keep UI responsive

❌ **Don't**: Use inline styles for complex styling
✅ **Do**: Use CSS classes for reusability

❌ **Don't**: Forget mobile responsiveness
✅ **Do**: Test on mobile devices/simulators

❌ **Don't**: Ignore loading/error states
✅ **Do**: Handle all states (loading, error, empty, success)

❌ **Don't**: Use generic error messages
✅ **Do**: Provide specific, actionable feedback

❌ **Don't**: Use `max-width` + `mx-auto` without `w-full` in `flex-col` layouts
✅ **Do**: Always add `w-full` to ensure proper width reference for percentage children

❌ **Don't**: Have skeleton layouts with different structure than loaded layouts
✅ **Do**: Match container structure exactly (same classes, same flex/grid hierarchy)

