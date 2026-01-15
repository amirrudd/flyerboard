# Responsive Design Best Practices

**Last Updated**: 2025-12-20

## Core Principles

### 1. Mobile-First Approach
Design and develop for mobile devices first, then progressively enhance for larger screens.

**Why:**
- Forces focus on essential features
- Easier to scale up than down
- Better performance on mobile devices
- Majority of users are on mobile

**Implementation:**
```css
/* Mobile styles (default) */
.container {
  padding: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
  }
}

/* Desktop and up */
@media (min-width: 1024px) {
  .container {
    padding: 3rem;
  }
}
```

### 2. Viewport Units - Use with Caution

**Problem with `100vh` on Mobile:**
- iOS Safari/Chrome have dynamic browser chrome (address bar, toolbar)
- `100vh` includes the browser UI, causing layout issues
- Viewport height changes as user scrolls

**Solutions:**

#### Option A: Use `dvh` (Dynamic Viewport Height) - Modern Browsers
```css
.full-height {
  height: 100dvh; /* Dynamic viewport height - adjusts with browser chrome */
}
```

#### Option B: Use `fixed inset-0` - Best Cross-Browser Support
```tsx
<div className="fixed inset-0 lg:relative lg:min-h-screen">
  {/* Content */}
</div>
```

**Why `fixed inset-0` works:**
- Creates a container that fills the actual viewport
- Adapts automatically when browser chrome shows/hides
- Works with `position: fixed` on body
- Excellent cross-browser support

#### Option C: CSS Custom Properties with JavaScript
```javascript
// Set actual viewport height
const setVH = () => {
  const vh = window.innerHeight * 0.01;
  document.documentElement.style.setProperty('--vh', `${vh}px`);
};

window.addEventListener('resize', setVH);
setVH();
```

```css
.full-height {
  height: calc(var(--vh, 1vh) * 100);
}
```

### 3. Breakpoint Strategy

**Standard Breakpoints:**
```css
/* Mobile: < 768px (default) */
/* Tablet: 768px - 1024px */
@media (min-width: 768px) { }

/* Desktop: > 1024px */
@media (min-width: 1024px) { }

/* Large Desktop: > 1440px */
@media (min-width: 1440px) { }
```

**Tailwind CSS Breakpoints:**
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

**Usage Pattern:**
```tsx
<div className="
  w-full           /* Mobile: full width */
  md:w-1/2         /* Tablet: half width */
  lg:w-1/3         /* Desktop: third width */
">
```

## Layout Patterns

### 1. Fixed Header with Scrollable Content

**Mobile Pattern:**
```tsx
<div className="fixed inset-0 flex flex-col">
  {/* Fixed header */}
  <header className="fixed top-0 left-0 right-0 z-50 h-16 bg-white">
    {/* Header content */}
  </header>
  
  {/* Scrollable content with top margin for header */}
  <main className="flex-1 overflow-y-auto mt-16 pb-bottom-nav">
    {/* Content */}
  </main>
  
  {/* Fixed bottom nav (mobile only) */}
  <nav className="fixed bottom-0 left-0 right-0 lg:hidden">
    {/* Bottom nav */}
  </nav>
</div>
```

**Desktop Pattern:**
```tsx
<div className="min-h-screen flex flex-col">
  {/* Sticky header */}
  <header className="sticky top-0 z-50 bg-white">
    {/* Header content */}
  </header>
  
  {/* Scrollable content */}
  <main className="flex-1">
    {/* Content */}
  </main>
</div>
```

**Combined (Responsive):**
```tsx
<div className="fixed inset-0 lg:relative lg:min-h-screen flex flex-col">
  <header className="fixed lg:sticky top-0 left-0 right-0 z-50 bg-white">
    {/* Header content */}
  </header>
  
  <main className="flex-1 overflow-y-auto mt-16 lg:mt-0 pb-bottom-nav lg:pb-8">
    {/* Content */}
  </main>
</div>
```

### 2. List-Detail Pattern (Master-Detail)

**Mobile:** Show one view at a time
**Desktop:** Show both views side-by-side

```tsx
function ListDetailView() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* List - Hidden on mobile when item selected */}
      <div className={`lg:col-span-1 ${selectedId ? 'hidden lg:block' : ''}`}>
        <div className="space-y-2">
          {items.map(item => (
            <button onClick={() => setSelectedId(item.id)}>
              {item.name}
            </button>
          ))}
        </div>
      </div>
      
      {/* Detail - Hidden on mobile when no item selected */}
      <div className={`lg:col-span-2 ${!selectedId ? 'hidden lg:block' : ''}`}>
        {selectedId ? (
          <>
            {/* Back button - Mobile only */}
            <button 
              onClick={() => setSelectedId(null)}
              className="lg:hidden mb-4"
            >
              ← Back to list
            </button>
            <DetailView id={selectedId} />
          </>
        ) : (
          <EmptyState />
        )}
      </div>
    </div>
  );
}
```

### 3. Nested Scroll Containers

**Problem:** Touch events get trapped in nested scrollable areas on mobile.

**Solution:** Add touch-action and overscroll-behavior:

```tsx
<div 
  className="max-h-96 overflow-y-auto"
  style={{ 
    touchAction: 'pan-y',           // Allow vertical scrolling
    overscrollBehavior: 'contain'   // Prevent scroll chaining
  }}
>
  {/* Scrollable content */}
</div>
```

**When to use:**
- Chat message containers
- Dropdown menus with scroll
- Modal content
- Any scrollable area inside a scrollable page

## Touch and Interaction

### 1. Touch Targets

**Minimum size:** 44x44px (Apple HIG) or 48x48px (Material Design)

```tsx
<button className="min-w-[44px] min-h-[44px] p-2">
  <Icon className="w-5 h-5" />
</button>
```

### 2. Touch Action

```css
/* Prevent double-tap zoom, allow scrolling */
.interactive-element {
  touch-action: manipulation;
}

/* Allow only vertical scrolling */
.vertical-scroll {
  touch-action: pan-y;
}

/* Allow only horizontal scrolling */
.horizontal-scroll {
  touch-action: pan-x;
}
```

### 3. Hover States

**Don't rely on hover for critical functionality:**

```tsx
// ❌ Bad: Delete button only visible on hover
<div className="group">
  <button className="opacity-0 group-hover:opacity-100">
    Delete
  </button>
</div>

// ✅ Good: Always visible on mobile, hover on desktop
<div className="group">
  <button className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100">
    Delete
  </button>
</div>
```

## Safe Areas (iOS Notch/Home Indicator)

### 1. CSS Variables

```css
:root {
  --safe-area-inset-top: env(safe-area-inset-top, 0px);
  --safe-area-inset-right: env(safe-area-inset-right, 0px);
  --safe-area-inset-bottom: env(safe-area-inset-bottom, 0px);
  --safe-area-inset-left: env(safe-area-inset-left, 0px);
}
```

### 2. Utility Classes

```css
.pb-safe {
  padding-bottom: max(1rem, var(--safe-area-inset-bottom));
}

.pt-safe {
  padding-top: max(1rem, var(--safe-area-inset-top));
}
```

### 3. Bottom Navigation

```css
.bottom-nav {
  /* Account for home indicator on iOS */
  padding-bottom: calc(1rem + var(--safe-area-inset-bottom));
}
```

## Performance Optimization

### 1. Content Visibility

```css
/* Improve rendering performance for long lists */
.list-item {
  content-visibility: auto;
  contain-intrinsic-size: 100px; /* Estimated height */
}
```

### 2. Hardware Acceleration

```css
/* Use transform instead of top/left for animations */
.animated {
  transform: translateZ(0);
  will-change: transform;
}
```

### 3. Scroll Performance

```css
.scroll-container {
  /* Enable momentum scrolling on iOS */
  -webkit-overflow-scrolling: touch;
  
  /* Optimize scroll performance */
  contain: layout style paint;
}
```

## Typography

### 1. Responsive Font Sizes

```css
/* Using clamp() for fluid typography */
.heading {
  font-size: clamp(1.5rem, 4vw, 3rem);
  /* Min: 1.5rem, Preferred: 4vw, Max: 3rem */
}
```

### 2. Line Length

```css
/* Optimal reading width: 45-75 characters */
.content {
  max-width: 65ch; /* Characters */
}
```

## Images and Media

### 1. Responsive Images

```tsx
<img
  src="image.jpg"
  srcSet="
    image-320w.jpg 320w,
    image-640w.jpg 640w,
    image-1280w.jpg 1280w
  "
  sizes="
    (max-width: 768px) 100vw,
    (max-width: 1024px) 50vw,
    33vw
  "
  alt="Description"
  loading="lazy"
/>
```

### 2. Aspect Ratio

```tsx
{/* Maintain aspect ratio while loading */}
<div className="aspect-video bg-gray-200">
  <img 
    src="image.jpg" 
    className="w-full h-full object-cover"
    alt="Description"
  />
</div>
```

## Testing Strategy

### 1. Device Testing

**Minimum test devices:**
- iPhone (Safari & Chrome)
- Android phone (Chrome)
- iPad (Safari)
- Desktop (Chrome, Firefox, Safari)

### 2. Browser DevTools

**Chrome DevTools:**
- Device toolbar (Cmd+Shift+M)
- Test different screen sizes
- Throttle network speed
- Emulate touch events

**Limitations:**
- Doesn't perfectly emulate real device behavior
- iOS viewport issues won't show
- Always test on real devices for final validation

### 3. Viewport Meta Tag

```html
<meta 
  name="viewport" 
  content="width=device-width, initial-scale=1.0, maximum-scale=5.0, user-scalable=yes"
/>
```

**Don't disable zoom:**
- Accessibility requirement
- Users need to zoom for readability
- `maximum-scale=5.0` allows zoom while preventing accidental zoom

## Common Pitfalls

### ❌ Don't

1. **Use `100vh` for full-height layouts on mobile**
   - Use `fixed inset-0` or `100dvh` instead

2. **Rely on hover states for mobile**
   - Provide alternative interactions

3. **Use fixed pixel widths**
   - Use relative units (%, rem, em)

4. **Disable user zoom**
   - Accessibility violation

5. **Ignore safe areas on iOS**
   - Content gets hidden by notch/home indicator

6. **Use `position: sticky` with `position: fixed` parent**
   - Sticky doesn't work, use fixed instead

7. **Forget touch-action on nested scroll containers**
   - Touch events get trapped

### ✅ Do

1. **Design mobile-first**
   - Start with mobile, enhance for desktop

2. **Test on real devices**
   - Emulators don't catch everything

3. **Use semantic HTML**
   - Better accessibility and SEO

4. **Provide adequate touch targets**
   - Minimum 44x44px

5. **Handle orientation changes**
   - Test both portrait and landscape

6. **Optimize images**
   - Use responsive images and lazy loading

7. **Consider network conditions**
   - Test on slow connections

## Architecture Recommendations

### 1. Component Structure

```
src/
├── components/
│   ├── ui/              # Reusable UI components
│   │   ├── Button.tsx
│   │   ├── Card.tsx
│   │   └── Modal.tsx
│   └── layout/          # Layout components
│       ├── Header.tsx
│       ├── Footer.tsx
│       └── BottomNav.tsx
├── features/            # Feature-specific components
│   ├── auth/
│   ├── dashboard/
│   └── messages/
└── styles/
    └── index.css        # Global styles and utilities
```

### 2. Responsive Utilities

Create reusable responsive patterns:

```tsx
// hooks/useMediaQuery.ts
export function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  
  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    
    const listener = (e: MediaQueryListEvent) => setMatches(e.matches);
    media.addEventListener('change', listener);
    
    return () => media.removeEventListener('change', listener);
  }, [query]);
  
  return matches;
}

// Usage
const isMobile = useMediaQuery('(max-width: 768px)');
```

### 3. Layout Wrapper

```tsx
// components/layout/ResponsiveLayout.tsx
export function ResponsiveLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 lg:relative lg:min-h-screen flex flex-col">
      {children}
    </div>
  );
}
```

## Resources

- [MDN: Responsive Design](https://developer.mozilla.org/en-US/docs/Learn/CSS/CSS_layout/Responsive_Design)
- [Web.dev: Responsive Web Design Basics](https://web.dev/responsive-web-design-basics/)
- [CSS-Tricks: A Complete Guide to Flexbox](https://css-tricks.com/snippets/css/a-guide-to-flexbox/)
- [CSS-Tricks: A Complete Guide to Grid](https://css-tricks.com/snippets/css/complete-guide-grid/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Material Design Guidelines](https://material.io/design)
