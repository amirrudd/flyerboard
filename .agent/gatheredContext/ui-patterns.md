# UI Patterns & Components

**Last Updated**: 2025-12-25

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

### Header
**File**: `src/features/layout/Header.tsx`

**Purpose**: Consistent header across all pages.

**Pattern**: Slot-based layout
```typescript
<Header
  leftNode={<BackButton />}
  centerNode={<Title />}
  rightNode={<Actions />}
/>
```

**Responsive**:
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

### Primary (Orange)
- `primary-50`: `#fff7ed` - Backgrounds
- `primary-600`: `#ea580c` - Main brand color
- `primary-700`: `#c2410c` - Hover states

### Neutrals
- `gray-100`: `#f3f4f6` - Backgrounds
- `gray-500`: `#6b7280` - Secondary text
- `gray-900`: `#111827` - Primary text

### Semantic
- Success: `green-600` (#16a34a)
- Error: `red-600` (#dc2626)
- Warning: `amber-600` (#d97706)

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
