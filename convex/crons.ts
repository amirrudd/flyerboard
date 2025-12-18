import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Process batched email notifications every 5 minutes
crons.interval(
    "send-batched-emails",
    { minutes: 5 },
    internal.notifications.emailNotifications.sendBatchedNotifications
);

export default crons;
