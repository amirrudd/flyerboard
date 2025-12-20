# Push Notifications Context

**Last Updated**: 2025-12-20

## Overview
FlyerBoard implements Web Push notifications using a modular, provider-based architecture that allows PWA users to receive notifications when they get new messages. For privacy, notifications show the ad title instead of message content.

## Architecture

### Modular Design
```
UI Components → usePushNotifications Hook → NotificationService Interface → WebPushService
```

**Key principle**: All notification logic goes through the `NotificationService` interface, making it easy to swap implementations (e.g., replace with FCM).

### Provider Pattern
- **Current**: Web Push API implementation
- **Future**: Can swap to FCM by changing one line in `src/services/notifications/index.ts`

### Feature Flag
Controlled by `ENABLE_PUSH_NOTIFICATIONS` environment variable. Can enable/disable without code changes.

## Implementation

### Backend (Convex)

**Database**: `pushSubscriptions` table in `convex/schema.ts`
- Stores user subscriptions with endpoint and encryption keys
- Indexed by user and endpoint

**Modules**:
- `convex/notifications/pushSubscriptions.ts` - Subscription CRUD operations
- `convex/notifications/pushNotifications.ts` - Push sending with web-push library
- `convex/messages.ts` - Triggers notifications in `sendMessage` mutation

**Critical Pattern**: Push notifications are scheduled asynchronously:
```typescript
await ctx.scheduler.runAfter(0, internal.notifications.pushNotifications.notifyMessageReceived, {...});
```

### Frontend

**Service Worker**: `public/sw.js`
- Handles `push` events - displays notifications
- Handles `notificationclick` events - opens app to chat

**Service Layer**: `src/services/notifications/`
- `types.ts` - Interface definitions
- `webPushService.ts` - Web Push implementation
- `index.ts` - Service factory (swap point)

**Hook**: `src/hooks/usePushNotifications.ts`
- Provides: `subscribe()`, `unsubscribe()`, `isSubscribed`, `permission`
- Integrates with Convex mutations

**UI**: `src/components/notifications/ContextualNotificationModal.tsx`
- Shows contextual permission requests at key moments:
  - After posting a new flyer
  - When sending first message to seller
  - When saving/liking a flyer
- Independent dismissal tracking per context
- Privacy-focused: Notifications show ad title, not message content

## Setup

### 1. Generate VAPID Keys
```bash
node scripts/generate-vapid-keys.js
```

### 2. Environment Variables
```bash
ENABLE_PUSH_NOTIFICATIONS=true
VITE_VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>
VAPID_SUBJECT=mailto:email@flyerboard.com
```

### 3. Add to Vercel
Add same variables to Vercel environment variables.

## Usage

### In Components
```typescript
import { usePushNotifications } from '../hooks/usePushNotifications';

const { subscribe, unsubscribe, isSubscribed } = usePushNotifications();
```

### Show Prompt
```typescript
import { NotificationPrompt } from './components/notifications/NotificationPrompt';

// Add to app layout
<NotificationPrompt />
```

## Platform Support

| Platform | Browser | PWA Installed | Support |
|----------|---------|---------------|---------|
| iOS 16.4+ | ❌ No | ✅ Yes | Only when installed |
| Android | ✅ Yes | ✅ Yes | Full support |
| Desktop | ✅ Yes | ✅ Yes | Full support |

**iOS Critical**: Must install PWA to home screen AND open from home screen icon.

## Removal

To remove Web Push notifications:

1. Delete directories:
   - `convex/notifications/`
   - `src/services/notifications/`
   - `src/components/notifications/`

2. Remove from `convex/messages.ts`:
   - Import of `internal`
   - Push notification scheduling code

3. Remove from `convex/schema.ts`:
   - `pushSubscriptions` table

4. Remove from `public/sw.js`:
   - Push event handlers

5. Delete files:
   - `src/hooks/usePushNotifications.ts`
   - `scripts/generate-vapid-keys.js`

All code is isolated - no scattered dependencies.

## Migration to FCM

To switch to Firebase Cloud Messaging:

1. Create `src/services/notifications/fcmService.ts`
2. Implement `NotificationService` interface
3. Update `src/services/notifications/index.ts`:
   ```typescript
   import { fcmService } from './fcmService';
   export const notificationService = fcmService;
   ```
4. Update backend to use FCM Admin SDK
5. UI components remain unchanged ✅

## Troubleshooting

### iOS notifications not working
- Ensure iOS 16.4+
- PWA must be installed to home screen
- Must open from home screen icon (not Safari)

### VAPID errors
- Regenerate keys: `node scripts/generate-vapid-keys.js`
- Verify keys in environment variables
- Restart dev server

### Subscription fails
- Check browser console
- Verify service worker registered
- Check VAPID public key accessible

## Documentation
See `docs/push-notifications.md` for complete setup and usage guide.
