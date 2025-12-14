# Web Push Notification Implementation - Documentation

## Overview
This document provides instructions for setting up and using the Web Push notification system in FlyerBoard.

## Setup Instructions

### 1. Generate VAPID Keys

Run the following command to generate VAPID keys:

```bash
node scripts/generate-vapid-keys.js
```

This will output three environment variables that you need to add to your `.env.local` file.

### 2. Configure Environment Variables

Add the following to your `.env.local` file:

```bash
# Enable push notifications
ENABLE_PUSH_NOTIFICATIONS=true

# VAPID keys (from step 1)
VITE_VAPID_PUBLIC_KEY=your-public-key-here
VAPID_PRIVATE_KEY=your-private-key-here
VAPID_SUBJECT=mailto:your-email@flyerboard.com
```

### 3. Deploy to Vercel

Add the same environment variables to your Vercel project:

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all four variables from above
3. Redeploy your application

## Usage

### For Users

1. **Install the PWA**: Add FlyerBoard to your home screen
   - iOS: Safari → Share → Add to Home Screen
   - Android: Chrome → Menu → Add to Home Screen

2. **Enable Notifications**: When prompted at key moments (posting a flyer, messaging, or saving), tap "Enable" to receive push notifications

3. **Receive Notifications**: You'll get notified when someone sends you a message. For privacy, notifications show the ad title, not the message content.
   - Example: "Message from John" - "New message about 'iPhone 13 Pro Max 256GB'"

### For Developers

#### Using the Hook

```typescript
import { usePushNotifications } from '../hooks/usePushNotifications';

function MyComponent() {
  const { 
    isSupported, 
    permission, 
    isSubscribed, 
    subscribe, 
    unsubscribe 
  } = usePushNotifications();

  // Check if supported
  if (!isSupported) {
    return <div>Notifications not supported</div>;
  }

  // Subscribe to notifications
  const handleEnable = async () => {
    const success = await subscribe();
    if (success) {
      console.log('Subscribed!');
    }
  };

  return (
    <button onClick={handleEnable}>
      Enable Notifications
    </button>
  );
}
```

#### Showing the Prompt

Add the `ContextualNotificationModal` component where appropriate:

```typescript
import { ContextualNotificationModal } from './components/notifications/ContextualNotificationModal';

function MyComponent() {
  const [showModal, setShowModal] = useState(false);

  return (
    <>
      <YourComponent />
      <ContextualNotificationModal
        context="post-flyer" // or "send-message" or "like-flyer"
        isOpen={showModal}
        onClose={() => setShowModal(false)}
      />
    </>
  );
}
```

#### Notification Privacy

Notifications are designed with privacy in mind:
- **Message content is never shown** in notifications
- Only the ad title and sender name are displayed
- Users must open the app to read actual messages

## Architecture

### Modular Design

The implementation uses a provider pattern for easy replacement:

```
src/services/notifications/
├── types.ts              # Interface definitions
├── webPushService.ts     # Web Push implementation
├── fcmService.ts         # Future: FCM implementation
└── index.ts              # Service factory (swap here)
```

### To Replace with FCM

1. Create `src/services/notifications/fcmService.ts`
2. Implement the `NotificationService` interface
3. Update `src/services/notifications/index.ts`:
   ```typescript
   import { fcmService } from './fcmService';
   export const notificationService = fcmService;
   ```

## Testing

### iOS (16.4+)
1. Install PWA to home screen
2. Open from home screen
3. Grant notification permission
4. Send a test message from another account
5. Verify notification appears

### Android
1. Works in browser AND installed PWA
2. Grant notification permission
3. Send test message
4. Verify notification appears

### Desktop
1. Works in Chrome, Firefox, Edge
2. Grant notification permission
3. Send test message
4. Verify notification appears

## Troubleshooting

### Notifications not working on iOS
- Ensure iOS 16.4 or later
- PWA must be installed to home screen
- Must open from home screen icon (not Safari)

### VAPID key errors
- Regenerate keys using the script
- Ensure keys are properly set in environment variables
- Restart dev server after adding keys

### Subscription fails
- Check browser console for errors
- Verify service worker is registered
- Check VAPID public key is accessible in frontend

## Removal Instructions

To remove Web Push notifications:

1. Delete these directories:
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

5. Remove environment variables

6. Delete:
   - `src/hooks/usePushNotifications.ts`
   - `scripts/generate-vapid-keys.js`
   - `.env.example.notifications`
