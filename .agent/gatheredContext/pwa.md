# Progressive Web App (PWA)

## Overview
FlyerBoard implements PWA capabilities to enable home screen installation and app-like experience on mobile devices.

## Implementation Status
✅ **Phase 1 Complete**: Basic PWA setup (installable app)  
⏳ **Phase 2 Pending**: Static asset caching (optional)  
⏳ **Phase 3 Pending**: Push notifications (future)

---

## Files

### Manifest
**File**: `public/manifest.json`

Defines app metadata for browsers:
```json
{
  "name": "FlyerBoard",
  "short_name": "FlyerBoard",
  "display": "standalone",
  "theme_color": "#ea580c",
  "background_color": "#fafaf9"
}
```

### Service Worker
**File**: `public/sw.js`

Minimal service worker for installability (no offline caching):
```javascript
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));
```

**No fetch handler** - all requests go to network to maintain real-time data.

### Icons
**Directory**: `public/icons/`

- `icon-192.png` - Standard icon (192x192)
- `icon-512.png` - Large icon (512x512)
- `icon-maskable-512.png` - Android adaptive icon
- `apple-touch-icon.png` - iOS home screen icon

### HTML Meta Tags
**File**: `index.html`

```html
<meta name="theme-color" content="#ea580c" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<link rel="manifest" href="/manifest.json" />
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
```

### Service Worker Registration
**File**: `src/main.tsx`

```typescript
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(console.error);
  });
}
```

---

## User Experience

### Installation
- **Android**: "Add to Home Screen" prompt or menu option
- **iOS**: Share → "Add to Home Screen"
- **Desktop**: Install icon in address bar

### Standalone Mode
When launched from home screen:
- No browser UI (address bar, tabs)
- Fullscreen app experience
- Orange status bar (theme color)
- Splash screen on iOS

---

## Design Decisions

### No Offline Mode
FlyerBoard is a real-time marketplace. Offline functionality would:
- Show stale listings (misleading to users)
- Break messaging (requires connectivity)
- Add unnecessary complexity

**Decision**: Prioritize real-time accuracy over offline capability.

### Minimal Service Worker
Only implements install/activate handlers for PWA installability. No fetch handler means:
- All requests go to network
- No cache management complexity
- Real-time data guaranteed
- Future-ready for push notifications

---

## Browser Support

| Feature | Android | iOS | Desktop |
|---------|---------|-----|---------|
| Installation | ✅ Chrome 40+ | ✅ Safari 16.4+ | ✅ Chrome/Edge |
| Standalone Mode | ✅ | ✅ | ✅ |
| Theme Color | ✅ | ✅ | ✅ |
| Push Notifications | ✅ | ✅ (16.4+) | ✅ |

---

## Testing

### Manual Testing
1. Open FlyerBoard on mobile device
2. Install to home screen
3. Launch from home screen
4. Verify standalone mode (no browser UI)

### Lighthouse Audit
```bash
# Run in Chrome DevTools
Lighthouse → Progressive Web App → Generate Report
```

Expected: ✅ Installable, ✅ PWA optimized

---

## Future Enhancements

### Phase 2: Static Asset Caching
- Cache JS/CSS/fonts for faster repeat visits
- Stale-while-revalidate for images
- Reduces data usage

### Phase 3: Push Notifications
- Notify users of new messages
- Alert on flyer status changes
- Re-engagement campaigns

---

## Related Documentation
- [Architecture Review](file:///Users/amir.rudd/flyerBoard/FlyerBoard/.agent/gatheredContext/architecture-review.md) - PWA section
- [UI Patterns](file:///Users/amir.rudd/flyerBoard/FlyerBoard/.agent/gatheredContext/ui-patterns.md) - Mobile-first design
