# Notifications (Email & Push)

**Last Updated**: 2026-01-15

> **For architecture overview**: See `docs/architecture/notifications-architecture.md` (if exists)

## Overview

FlyerBoard implements two notification channels for new chat messages:
1. **Email Notifications** - via Resend
2. **Push Notifications** - via Web Push API

Both systems use time-based batching (10 minutes) to prevent spam and respect rate limits.

---

## Email Notifications

### Architecture

**Components:**
1. **Email Action** (`convex/notifications/emailNotifications.ts`)
   - Validates recipient has email and notifications enabled
   - Fetches sender and ad information
   - Builds personalized HTML and plain text emails
   - Sends via Resend component

2. **Preference Management** (`convex/users.ts`)
   - `updateEmailNotificationPreference` mutation
   - Toggle email notifications on/off per user

3. **Message Trigger** (`convex/messages.ts`)
   - `sendMessage` mutation triggers email via scheduler
   - Controlled by `ENABLE_EMAIL_NOTIFICATIONS` feature flag

4. **UI Components** (`src/features/dashboard/UserDashboard.tsx`)
   - Email collection banner (when no email provided)
   - Notification toggle in profile settings

### Email Template

**Subject Line:**
```
💬 {SenderName} sent you a message about "{FlyerTitle}"
```

**HTML Email:**
- Professional white card design
- FlyerBoard branded header
- Personalized greeting
- Message preview in highlighted blockquote
- Clear CTA button: "View Conversation"
- Footer with settings link and branding

**Plain Text Email:**
Full content in plain text format for accessibility.

### User Flow

**First-Time User:**
1. User lands in dashboard without email
2. Blue banner prompts: "📧 Get notified when buyers message you!"
3. Click "Add email address" → redirects to profile settings
4. Enter email → notifications auto-enabled

**Existing User:**
1. Navigate to Profile Settings → Notifications section
2. Toggle "Email notifications for new messages"
3. Immediately saved with toast confirmation

**Receiving Notifications:**
1. Someone sends message about user's flyer
2. Email sent if:
   - User has email address
   - `emailNotificationsEnabled: true`
   - Ad exists and is valid
3. Email contains message preview and link to chat

### Configuration

**Environment Variables:**
```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxx
ENABLE_EMAIL_NOTIFICATIONS=true

# Optional
EMAIL_FROM=FlyerBoard <noreply@yourdomain.com>
VITE_APP_URL=https://flyerboard.com
EMAIL_BATCH_WINDOW_MINUTES=10  # Time window for batching emails (default: 10)
```

**Domain Verification (Production):**
1. Create Resend account at [resend.com](https://resend.com)
2. Add domain in Resend dashboard
3. Add DNS records:
   - SPF: `v=spf1 include:_spf.resend.com ~all`
   - DKIM: (2-3 TXT records provided by Resend)
   - DMARC: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`
4. Wait for verification (~5-10 minutes)

Without domain verification, emails only work with `*@resend.dev` addresses.

### Spam Prevention

**Gmail 2024 Compliance:**
- ✅ SPF/DKIM - Handled by Resend automatically
- ✅ DMARC - Set up via DNS (start with `p=none`)
- ✅ List-Unsubscribe header - Included in every email
- ✅ Personalization - Real names, flyer context
- ✅ Clear sender - `FlyerBoard <noreply@flyerboard.com>`
- ✅ Opt-in model - Users must enable notifications
- ✅ Plain text version - Included with all emails

**Frequency Management:**
- **Implemented:** 10-minute time-based batching
- Messages are queued and sent in batches every 10 minutes
- Single message: Detailed email with full content
- Multiple messages: Summary email with count
- Cron job processes queue every 5 minutes
- Configurable via `EMAIL_BATCH_WINDOW_MINUTES` environment variable

**Benefits:**
- Prevents email spam
- Respects Resend free tier limits (100 emails/day)
- Better user experience with consolidated notifications

### Database Schema

```typescript
users: defineTable({
  // ... existing fields
  emailNotificationsEnabled: v.optional(v.boolean()),
})
```

**Default behavior:**
- `undefined` = notifications disabled (opt-in)
- User must explicitly enable after adding email

### API Reference

**Mutations:**

#### `updateEmailNotificationPreference`
```typescript
api.users.updateEmailNotificationPreference({ enabled: boolean })
```
Toggles email notifications for authenticated user.

**Returns:** `{ success: true }`

**Errors:**
- "Must be logged in" - User not authenticated

**Internal Actions:**

#### `notifyMessageReceived`
```typescript
internal.notifications.emailNotifications.notifyMessageReceived({
  recipientId: Id<"users">,
  senderId: Id<"users">,
  chatId: Id<"chats">,
  adId: Id<"ads">,
  messageContent: string
})
```

Sends email notification for new message.

**Returns:**
```typescript
{
  success: boolean,
  reason?: "no_email" | "notifications_disabled" | "ad_not_found" | "send_failed"
}
```

**Called by:** `sendMessage` mutation via `ctx.scheduler.runAfter`

### Free Tier Limits

**Resend:**
- **3,000 emails/month**
- **100 emails/day**
- 1 custom domain
- 1-day data retention

**Strategies When Hitting Limits:**
1. **Batch notifications** (recommended) - Already implemented
2. **Priority-based sending** - First message instant, subsequent batched
3. **Upgrade to paid tier** - $20/month for 50,000 emails
4. **Switch to Brevo** - 300/day free forever

### Testing

**Local Development:**
1. Set `RESEND_API_KEY` in `.env.local`
2. Use test email addresses from Resend:
   - `delivered@resend.dev` - Successful delivery
   - `bounced@resend.dev` - Bounce simulation
   - `complained@resend.dev` - Spam complaint simulation

3. Test without domain verification using labels:
   - `delivered+test@resend.dev`
   - `delivered+user-123@resend.dev`

**Test Checklist:**
- [x] Enable notifications in dashboard
- [x] Send test message to yourself
- [x] Verify email received
- [x] Check HTML rendering in Gmail/Outlook
- [x] Click "View Conversation" link
- [x] Test unsubscribe link
- [x] Disable notifications → no email sent
- [x] Test with no email address → banner shows
- [x] Test email length validation (max 50 chars)
- [x] Test local part validation (min 2 chars)

**Automated Testing:**
- `convex/notifications/notifications.test.ts`: Backend unit tests for scheduler triggers
- `src/features/dashboard/UserDashboard.emailNotifications.test.tsx`: Component-level integration

### Monitoring

Track the following metrics:
- **Delivery rate** - % of emails successfully delivered
- **Bounce rate** - % of emails bounced (should be <5%)
- **Spam rate** - % marked as spam (should be <0.3%)
- **Open rate** - % of emails opened
- **Click-through rate** - % clicking "View Conversation"

Use Resend dashboard for analytics and DMARC reports for authentication status.

### Troubleshooting

**Emails Not Sending:**
1. Check environment variable: `RESEND_API_KEY` set?
2. Verify user has email: Check `user.email` in database
3. Check notifications enabled: `user.emailNotificationsEnabled === true`
4. Review logs: Look for error messages in Convex dashboard

**Emails in Spam:**
1. Verify domain authentication: Check SPF/DKIM/DMARC records
2. Review content: Avoid spam trigger words
3. Check sender reputation: New domain may take time
4. Monitor complaints: Keep spam rate <0.3%

**Domain Verification Issues:**
1. DNS propagation: Wait 24-48 hours for DNS changes
2. Correct records: Double-check DNS entries match Resend
3. DMARC policy: Start with `p=none`, upgrade gradually

---

## Push Notifications

### Architecture

**Modular Design:**
```
UI Components → usePushNotifications Hook → NotificationService Interface → WebPushService
```

**Key principle:** All notification logic goes through the `NotificationService` interface, making it easy to swap implementations (e.g., replace with FCM).

**Provider Pattern:**
- **Current:** Web Push API implementation
- **Future:** Can swap to FCM by changing one line in `src/services/notifications/index.ts`

**Feature Flag:**
Controlled by `ENABLE_PUSH_NOTIFICATIONS` environment variable.

### Implementation

**Backend (Convex):**

**Database:** `pushSubscriptions` table in `convex/schema.ts`
- Stores user subscriptions with endpoint and encryption keys
- Indexed by user and endpoint

**Modules:**
- `convex/notifications/pushSubscriptions.ts` - Subscription CRUD operations
- `convex/notifications/pushNotifications.ts` - Push sending with web-push library
- `convex/messages.ts` - Triggers notifications in `sendMessage` mutation

**Critical Pattern:** Push notifications are scheduled asynchronously:
```typescript
await ctx.scheduler.runAfter(0, internal.notifications.pushNotifications.notifyMessageReceived, {...});
```

**Frontend:**

**Service Worker:** `public/sw.js`
- Handles `push` events - displays notifications
- Handles `notificationclick` events - opens app to chat

**Service Layer:** `src/services/notifications/`
- `types.ts` - Interface definitions
- `webPushService.ts` - Web Push implementation
- `index.ts` - Service factory (swap point)

**Hook:** `src/hooks/usePushNotifications.ts`
- Provides: `subscribe()`, `unsubscribe()`, `isSubscribed`, `permission`
- Integrates with Convex mutations

**UI:** `src/components/notifications/ContextualNotificationModal.tsx`
- Shows contextual permission requests at key moments:
  - After posting a new flyer
  - When sending first message to seller
  - When saving/liking a flyer
- Independent dismissal tracking per context
- Privacy-focused: Notifications show ad title, not message content

### Setup

**1. Generate VAPID Keys:**
```bash
node scripts/generate-vapid-keys.js
```

**2. Environment Variables:**
```bash
ENABLE_PUSH_NOTIFICATIONS=true
VITE_VAPID_PUBLIC_KEY=<generated>
VAPID_PRIVATE_KEY=<generated>
VAPID_SUBJECT=mailto:email@flyerboard.com
```

**3. Add to Vercel:**
Add same variables to Vercel environment variables.

### Usage

**In Components:**
```typescript
import { usePushNotifications } from '../hooks/usePushNotifications';

const { subscribe, unsubscribe, isSubscribed } = usePushNotifications();
```

**Show Prompt:**
```typescript
import { NotificationPrompt } from './components/notifications/NotificationPrompt';

// Add to app layout
<NotificationPrompt />
```

### Platform Support

| Platform | Browser | PWA Installed | Support |
|----------|---------|---------------|---------|
| iOS 16.4+ | ❌ No | ✅ Yes | Only when installed |
| Android | ✅ Yes | ✅ Yes | Full support |
| Desktop | ✅ Yes | ✅ Yes | Full support |

**iOS Critical:** Must install PWA to home screen AND open from home screen icon.

### Migration to FCM

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

### Troubleshooting

**iOS notifications not working:**
- Ensure iOS 16.4+
- PWA must be installed to home screen
- Must open from home screen icon (not Safari)

**VAPID errors:**
- Regenerate keys: `node scripts/generate-vapid-keys.js`
- Verify keys in environment variables
- Restart dev server

**Subscription fails:**
- Check browser console
- Verify service worker registered
- Check VAPID public key accessible

---

## Future Enhancements

### Email
- [ ] **React Email templates** - Component-based email design
- [ ] **Email preferences page** - Granular control (instant/digest/weekly)
- [ ] **A/B testing** - Test different subject lines/content
- [ ] **Email analytics** - Track engagement in database
- [ ] **Webhook handling** - Process bounces/complaints automatically
- [ ] **Multi-language** - Translated emails based on user locale
- [ ] **Rich notifications** - Include flyer images in email

### Push
- [ ] **FCM integration** - Better mobile support
- [ ] **Rich push notifications** - Include images
- [ ] **Action buttons** - Reply directly from notification
- [ ] **Notification grouping** - Stack multiple messages

---

## Related Files

### Email
- `convex/notifications/emailNotifications.ts`
- `convex/users.ts` - Preference management
- `src/features/dashboard/UserDashboard.tsx` - UI components

### Push
- `convex/notifications/pushSubscriptions.ts`
- `convex/notifications/pushNotifications.ts`
- `src/services/notifications/` - Service layer
- `src/hooks/usePushNotifications.ts`
- `public/sw.js` - Service worker

### Shared
- `convex/messages.ts` - Trigger point for both systems
