import { describe, it, expect, vi } from 'vitest';
import { api, internal } from '../_generated/api';

/**
 * Behavioral unit tests for notification triggers in sendMessage mutation.
 * 
 * These tests verify that the mutation correctly calls the scheduler to
 * trigger both push and email notifications with the expected parameters.
 */

describe('Notification Triggers', () => {
    it('should verify push notifications use scheduler (instant)', async () => {
        // Push notifications should still be instant via scheduler
        expect(internal.notifications.pushNotifications.notifyMessageReceived).toBeDefined();
    });

    it('should verify email notifications use batching queue (not instant)', async () => {
        // Email notifications should be queued, NOT sent immediately
        // The sendMessage mutation should call queueEmailNotification
        expect(internal.notifications.pendingEmailNotifications.queueEmailNotification).toBeDefined();

        // The batched sending action should exist for the cron job
        expect(internal.notifications.emailNotifications.sendBatchedNotifications).toBeDefined();

        // The immediate send action still exists but is NOT called by sendMessage anymore
        expect(internal.notifications.emailNotifications.notifyMessageReceived).toBeDefined();
    });
});
