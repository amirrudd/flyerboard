# Email Notifications

**Last Updated**: 2025-12-20

## Overview

Email notifications are sent to users when they receive new chat messages about their flyers. The system uses Resend for reliable email delivery with built-in queueing, batching, and idempotency.

## Architecture

### Components

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
   - Runs alongside push notifications

4. **UI Components** (`src/features/dashboard/UserDashboard.tsx`)
   - Email collection banner (when no email provided)
   - Notification toggle in profile settings

## Email Template

### Subject Line
```
💬 {SenderName} sent you a message about "{FlyerTitle}"
```

### HTML Email
- Professional white card design
- FlyerBoard branded header
- Personalized greeting
- Message preview in highlighted blockquote
- Clear CTA button: "View Conversation"
- Footer with settings link and branding

### Plain Text Email
Full content in plain text format for accessibility and email clients that don't support HTML.

## User Flow

### First-Time User
1. User lands in dashboard without email
2. Blue banner prompts: "📧 Get notified when buyers message you!"
3. Click "Add email address" → redirects to profile settings
4. Enter email → notifications auto-enabled

### Existing User
1. Navigate to Profile Settings → Notifications section
2. Toggle "Email notifications for new messages"
3. Immediately saved with toast confirmation

### Receiving Notifications
1. Someone sends message about user's flyer
2. Email sent if:
   - User has email address
   - `emailNotificationsEnabled: true`
   - Ad exists and is valid
3. Email contains message preview and link to chat

## Configuration

### Environment Variables

```bash
# Required
RESEND_API_KEY=re_xxxxxxxxxxxxx
ENABLE_EMAIL_NOTIFICATIONS=true

# Optional
EMAIL_FROM=FlyerBoard <noreply@yourdomain.com>
VITE_APP_URL=https://flyerboard.com
EMAIL_BATCH_WINDOW_MINUTES=10  # Time window for batching emails (default: 10)
```

### Domain Verification (Production)

To send emails from your own domain:

1. Create Resend account at [resend.com](https://resend.com)
2. Add domain in Resend dashboard
3. Add DNS records:
   - SPF: `v=spf1 include:_spf.resend.com ~all`
   - DKIM: (2-3 TXT records provided by Resend)
   - DMARC: `v=DMARC1; p=none; rua=mailto:dmarc@yourdomain.com`
4. Wait for verification (~5-10 minutes)

Without domain verification, emails only work with `*@resend.dev` addresses.

## Spam Prevention

### Gmail 2024 Compliance

✅ **SPF/DKIM** - Handled by Resend automatically  
✅ **DMARC** - Set up via DNS (start with `p=none`)  
✅ **List-Unsubscribe header** - Included in every email  
✅ **Personalization** - Real names, flyer context  
✅ **Clear sender** - `FlyerBoard <noreply@flyerboard.com>`  
✅ **Opt-in model** - Users must enable notifications  
✅ **Plain text version** - Included with all emails  

### Content Best Practices

- ✅ Honest subject lines (no clickbait)
- ✅ Relevant content (actual message preview)
- ✅ Balanced text-to-image ratio
- ✅ Professional formatting
- ✅ Unsubscribe link visible in footer

### Frequency Management

**Implemented:** 10-minute time-based batching
- Messages are queued and sent in batches every 10 minutes
- Single message: Detailed email with full content
- Multiple messages: Summary email with count
- Cron job processes queue every 5 minutes
- Configurable via `EMAIL_BATCH_WINDOW_MINUTES` environment variable

**Benefits:**
- Prevents email spam
- Respects Resend free tier limits (100 emails/day)
- Better user experience with consolidated notifications

## Database Schema

### Users Table Addition

```typescript
users: defineTable({
  // ... existing fields
  emailNotificationsEnabled: v.optional(v.boolean()),
})
```

**Default behavior**: 
- `undefined` = notifications disabled (opt-in)
- User must explicitly enable after adding email

## API Reference

### Mutations

#### `updateEmailNotificationPreference`
```typescript
api.users.updateEmailNotificationPreference({ enabled: boolean })
```

Toggles email notifications for authenticated user.

**Returns**: `{ success: true }`

**Errors**:
- "Must be logged in" - User not authenticated

### Internal Actions

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

**Returns**:
```typescript
{
  success: boolean,
  reason?: "no_email" | "notifications_disabled" | "ad_not_found" | "send_failed"
}
```

**Called by**: `sendMessage` mutation via `ctx.scheduler.runAfter`

## Free Tier Limits

### Resend
- **3,000 emails/month**
- **100 emails/day**
- 1 custom domain
- 1-day data retention

### Strategies When Hitting Limits

1. **Batch notifications** (recommended)
   - Combine multiple messages: "You have 3 new messages"
   - Send digest emails instead of instant

2. **Priority-based sending**
   - First message instant
   - Subsequent messages batched

3. **Upgrade to paid tier**
   - $20/month for 50,000 emails

4. **Switch to Brevo**
   - 300/day free forever
   - Requires custom action (no component)

## Testing

### Local Development

1. Set `RESEND_API_KEY` in `.env.local`
2. Use test email addresses from Resend:
   - `delivered@resend.dev` - Successful delivery
   - `bounced@resend.dev` - Bounce simulation
   - `complained@resend.dev` - Spam complaint simulation

3. Test without domain verification using labels:
   - `delivered+test@resend.dev`
   - `delivered+user-123@resend.dev`

### Test Checklist

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

### Automated Testing

Integrated automated tests verify the trigger logic:
- `convex/notifications/notifications.test.ts`: Backend unit tests for scheduler triggers in `sendMessage`.
- `src/features/dashboard/UserDashboard.emailNotifications.test.tsx`: Component-level integration coverage.

## Monitoring

Track the following metrics:

- **Delivery rate** - % of emails successfully delivered
- **Bounce rate** - % of emails bounced (should be <5%)
- **Spam rate** - % marked as spam (should be <0.3%)
- **Open rate** - % of emails opened
- **Click-through rate** - % clicking "View Conversation"

Use Resend dashboard for analytics and DMARC reports for authentication status.

## Troubleshooting

### Emails Not Sending

1. **Check environment variable**: `RESEND_API_KEY` set?
2. **Verify user has email**: Check `user.email` in database
3. **Check notifications enabled**: `user.emailNotificationsEnabled === true`
4. **Review logs**: Look for error messages in Convex dashboard

### Emails in Spam

1. **Verify domain authentication**: Check SPF/DKIM/DMARC records
2. **Review content**: Avoid spam trigger words
3. **Check sender reputation**: New domain may take time
4. **Monitor complaints**: Keep spam rate <0.3%

### Domain Verification Issues

1. **DNS propagation**: Wait 24-48 hours for DNS changes
2. **Correct records**: Double-check DNS entries match Resend
3. **DMARC policy**: Start with `p=none`, upgrade gradually

## Future Enhancements

- [ ] **React Email templates** - Component-based email design
- [ ] **Email preferences page** - Granular control (instant/digest/weekly)
- [ ] **A/B testing** - Test different subject lines/content
- [ ] **Email analytics** - Track engagement in database
- [ ] **Webhook handling** - Process bounces/complaints automatically
- [ ] **Multi-language** - Translated emails based on user locale
- [ ] **Rich notifications** - Include flyer images in email

## Related Documentation

- [Push Notifications](push-notifications.md)
- [Database Patterns](database.md)
- [User Authentication](authentication.md)
