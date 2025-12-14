/**
 * Push Notifications Hook
 * Provides a simple interface for components to manage push notifications
 */

import { useEffect, useState, useCallback } from 'react';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { notificationService } from '../services/notifications';
import { webPushService } from '../services/notifications/webPushService';

export function usePushNotifications() {
    const [permission, setPermission] = useState<NotificationPermission>('default');
    const [isSubscribed, setIsSubscribed] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    const savePushSubscription = useMutation(api.notifications.pushSubscriptions.savePushSubscription);
    const removePushSubscription = useMutation(api.notifications.pushSubscriptions.removePushSubscription);

    // Initialize service with Convex mutations
    useEffect(() => {
        if (webPushService) {
            webPushService.initialize(
                savePushSubscription as any,
                removePushSubscription as any
            );
        }
    }, [savePushSubscription, removePushSubscription]);

    // Check initial permission and subscription status
    useEffect(() => {
        if (notificationService.isSupported()) {
            setPermission(notificationService.getPermissionStatus());

            notificationService.isSubscribed().then((subscribed) => {
                setIsSubscribed(subscribed);
            });
        }
    }, []);

    const requestPermission = useCallback(async () => {
        setIsLoading(true);
        try {
            const granted = await notificationService.requestPermission();
            setPermission(granted ? 'granted' : 'denied');
            return granted;
        } finally {
            setIsLoading(false);
        }
    }, []);

    const subscribe = useCallback(async () => {
        setIsLoading(true);
        try {
            // First ensure we have permission
            if (permission !== 'granted') {
                const granted = await requestPermission();
                if (!granted) {
                    return false;
                }
            }

            // Subscribe to push
            const success = await notificationService.subscribe();

            if (success) {
                // Get the subscription data
                const subscription = await webPushService.getSubscription();

                if (subscription) {
                    // Save to database
                    await savePushSubscription({
                        endpoint: subscription.endpoint,
                        keys: subscription.keys,
                        userAgent: navigator.userAgent,
                    });

                    setIsSubscribed(true);
                    return true;
                } else {
                    console.error('Failed to get subscription data');
                }
            }

            return false;
        } catch (error) {
            console.error('Failed to subscribe:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [permission, requestPermission, savePushSubscription]);

    const unsubscribe = useCallback(async () => {
        setIsLoading(true);
        try {
            const subscription = await webPushService.getSubscription();

            if (subscription) {
                // Remove from database first
                await removePushSubscription({ endpoint: subscription.endpoint });
            }

            // Then unsubscribe from push manager
            const success = await notificationService.unsubscribe();

            if (success) {
                setIsSubscribed(false);
            }

            return success;
        } catch (error) {
            console.error('Failed to unsubscribe:', error);
            return false;
        } finally {
            setIsLoading(false);
        }
    }, [removePushSubscription]);

    return {
        isSupported: notificationService.isSupported(),
        permission,
        isSubscribed,
        isLoading,
        requestPermission,
        subscribe,
        unsubscribe,
    };
}
