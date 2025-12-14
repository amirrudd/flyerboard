/**
 * Notification Service Types
 * Defines the interface for notification providers
 */

export interface NotificationService {
    /**
     * Request notification permission from the user
     * @returns Promise<boolean> - true if permission granted
     */
    requestPermission(): Promise<boolean>;

    /**
     * Subscribe to push notifications
     * @returns Promise<boolean> - true if subscription successful
     */
    subscribe(): Promise<boolean>;

    /**
     * Unsubscribe from push notifications
     * @returns Promise<boolean> - true if unsubscription successful
     */
    unsubscribe(): Promise<boolean>;

    /**
     * Check if push notifications are supported
     * @returns boolean
     */
    isSupported(): boolean;

    /**
     * Get current notification permission status
     * @returns NotificationPermission
     */
    getPermissionStatus(): NotificationPermission;

    /**
     * Check if user is currently subscribed
     * @returns Promise<boolean>
     */
    isSubscribed(): Promise<boolean>;
}

export interface PushSubscriptionData {
    endpoint: string;
    keys: {
        p256dh: string;
        auth: string;
    };
}
