/**
 * Notification Service Factory
 * Single point to swap notification implementations
 */

import { webPushService } from './webPushService';
// Future: import { fcmService } from './fcmService';

// Export the active notification service
// To switch to FCM: change this to fcmService
export const notificationService = webPushService;

// Re-export types
export type { NotificationService, PushSubscriptionData } from './types';
