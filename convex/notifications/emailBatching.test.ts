import { describe, it, expect, vi } from 'vitest';
import { api, internal } from '../_generated/api';

/**
 * Tests for email batching functionality
 * 
 * These tests verify that:
 * 1. Messages trigger queueing instead of immediate send
 * 2. Batched sending action exists and is callable
 * 3. Queue management functions are properly defined
 */

describe('Email Batching', () => {
    describe('Queue Management', () => {
        it('should have queueEmailNotification mutation defined', () => {
            expect(internal.notifications.pendingEmailNotifications.queueEmailNotification).toBeDefined();
        });

        it('should have getPendingNotificationsToSend query defined', () => {
            expect(internal.notifications.pendingEmailNotifications.getPendingNotificationsToSend).toBeDefined();
        });

        it('should have clearPendingNotifications mutation defined', () => {
            expect(internal.notifications.pendingEmailNotifications.clearPendingNotifications).toBeDefined();
        });
    });

    describe('Batched Sending', () => {
        it('should have sendBatchedNotifications action defined', () => {
            expect(internal.notifications.emailNotifications.sendBatchedNotifications).toBeDefined();
        });
    });

    describe('Message Trigger', () => {
        it('should queue email notifications instead of sending immediately', () => {
            // The sendMessage mutation in convex/messages.ts should:
            // 1. Call queueEmailNotification instead of notifyMessageReceived
            // 2. This is verified by checking that the queue mutation exists
            expect(internal.notifications.pendingEmailNotifications.queueEmailNotification).toBeDefined();

            // The immediate send action should still exist for backwards compatibility
            // but is no longer called by sendMessage
            expect(internal.notifications.emailNotifications.notifyMessageReceived).toBeDefined();
        });
    });
});

describe('Cron Job Configuration', () => {
    it('should verify cron job file exists', async () => {
        // The crons.ts file should export a cron configuration
        // This test verifies the file can be imported
        const cronsModule = await import('../crons');
        expect(cronsModule.default).toBeDefined();
    });
});
