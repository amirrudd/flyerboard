import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process batched email notifications every 5 minutes
crons.interval(
    "send-batched-emails",
    { minutes: 5 },
    internal.notifications.emailNotifications.sendBatchedNotifications
);

// Auto-end active moving sales past their expiresAt (pickup end + buffer,
// default 2 days — so the up-to-24h daily-cron lag is well inside the buffer).
// 09:15 UTC, sharing the image purge's quiet-hour slot (registered below).
crons.cron(
    "expire-sale-events",
    "15 9 * * *",
    internal.saleEvents.expireSaleEvents,
    {}
);

// Purge R2 images for soft-deleted ads past their retention window.
// Runs daily at 09:00 UTC (quiet hour — off-peak for AU/US traffic).
crons.cron(
    "purge-deleted-ad-images",
    "0 9 * * *",
    internal.imageCleanup.purgeDeletedAdImages,
    {}
);

export default crons;
