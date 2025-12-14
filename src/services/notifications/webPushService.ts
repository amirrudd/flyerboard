/**
 * Web Push Notification Service Implementation
 * Implements the NotificationService interface using the Web Push API
 */

import type { NotificationService, PushSubscriptionData } from './types';
import { api } from '../../../convex/_generated/api';
import type { FunctionReference } from 'convex/server';

export class WebPushService implements NotificationService {
    private savePushSubscription: FunctionReference<'mutation'> | null = null;
    private removePushSubscription: FunctionReference<'mutation'> | null = null;

    /**
     * Initialize the service with Convex mutations
     * This is called from the hook to inject dependencies
     */
    initialize(
        saveMutation: FunctionReference<'mutation'>,
        removeMutation: FunctionReference<'mutation'>
    ) {
        this.savePushSubscription = saveMutation;
        this.removePushSubscription = removeMutation;
    }

    isSupported(): boolean {
        return (
            'serviceWorker' in navigator &&
            'PushManager' in window &&
            'Notification' in window
        );
    }

    getPermissionStatus(): NotificationPermission {
        if (!('Notification' in window)) {
            return 'denied';
        }
        return Notification.permission;
    }

    async requestPermission(): Promise<boolean> {
        if (!this.isSupported()) {
            console.warn('Push notifications are not supported in this browser');
            return false;
        }

        try {
            const permission = await Notification.requestPermission();
            return permission === 'granted';
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return false;
        }
    }

    async subscribe(): Promise<boolean> {
        if (!this.isSupported()) {
            console.warn('Push notifications are not supported');
            return false;
        }

        if (Notification.permission !== 'granted') {
            console.warn('Notification permission not granted');
            return false;
        }

        if (!this.savePushSubscription) {
            console.error('Service not initialized with Convex mutations');
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.ready;

            // Get VAPID public key from environment
            const vapidPublicKey = import.meta.env.VITE_VAPID_PUBLIC_KEY;
            if (!vapidPublicKey) {
                console.error('VAPID public key not configured');
                return false;
            }

            // Subscribe to push notifications
            const subscription = await registration.pushManager.subscribe({
                userVisibleOnly: true,
                applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey) as any,
            });

            // Convert subscription to our format
            const subscriptionData: PushSubscriptionData = {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
                    auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
                },
            };

            // Save to database (this will be called from the hook with proper mutation)
            return true;
        } catch (error) {
            console.error('Failed to subscribe to push notifications:', error);
            return false;
        }
    }

    async unsubscribe(): Promise<boolean> {
        if (!this.isSupported()) {
            return false;
        }

        if (!this.removePushSubscription) {
            console.error('Service not initialized with Convex mutations');
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (subscription) {
                await subscription.unsubscribe();
                return true;
            }

            return false;
        } catch (error) {
            console.error('Failed to unsubscribe from push notifications:', error);
            return false;
        }
    }

    async isSubscribed(): Promise<boolean> {
        if (!this.isSupported()) {
            return false;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();
            return subscription !== null;
        } catch (error) {
            console.error('Error checking subscription status:', error);
            return false;
        }
    }

    async getSubscription(): Promise<PushSubscriptionData | null> {
        if (!this.isSupported()) {
            return null;
        }

        try {
            const registration = await navigator.serviceWorker.ready;
            const subscription = await registration.pushManager.getSubscription();

            if (!subscription) {
                return null;
            }

            return {
                endpoint: subscription.endpoint,
                keys: {
                    p256dh: this.arrayBufferToBase64(subscription.getKey('p256dh')!),
                    auth: this.arrayBufferToBase64(subscription.getKey('auth')!),
                },
            };
        } catch (error) {
            console.error('Error getting subscription:', error);
            return null;
        }
    }

    // Helper functions
    private urlBase64ToUint8Array(base64String: string): Uint8Array {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
            outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
    }

    private arrayBufferToBase64(buffer: ArrayBuffer): string {
        const bytes = new Uint8Array(buffer);
        let binary = '';
        for (let i = 0; i < bytes.byteLength; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        return window.btoa(binary);
    }
}

// Export singleton instance
export const webPushService = new WebPushService();
