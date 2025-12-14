/**
 * Notification Permission Prompt Component
 * Displays a banner prompting users to enable push notifications
 */

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { useSession } from '@descope/react-sdk';

export function NotificationPrompt() {
    const [isDismissed, setIsDismissed] = useState(false);
    const [showPrompt, setShowPrompt] = useState(false);
    const { isSupported, permission, isSubscribed, subscribe, isLoading } = usePushNotifications();
    const { isAuthenticated } = useSession();

    useEffect(() => {
        // Check if user has dismissed the prompt before
        const dismissed = localStorage.getItem('notification-prompt-dismissed');
        if (dismissed) {
            setIsDismissed(true);
            return;
        }

        // Show prompt if:
        // 1. User is authenticated (required to save subscription)
        // 2. Notifications are supported
        // 3. Permission is default (not granted or denied)
        // 4. User is not already subscribed
        if (isAuthenticated && isSupported && permission === 'default' && !isSubscribed) {
            // Delay showing the prompt to avoid overwhelming the user
            const timer = setTimeout(() => {
                setShowPrompt(true);
            }, 3000);

            return () => clearTimeout(timer);
        }
    }, [isAuthenticated, isSupported, permission, isSubscribed]);

    const handleEnable = async () => {
        const success = await subscribe();
        if (success) {
            setShowPrompt(false);
        }
    };

    const handleDismiss = () => {
        setShowPrompt(false);
        setIsDismissed(true);
        localStorage.setItem('notification-prompt-dismissed', 'true');
    };

    if (!showPrompt || isDismissed) {
        return null;
    }

    return (
        <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center">
                            <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
                            Enable Notifications
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            Get notified when you receive new messages from buyers and sellers
                        </p>

                        <div className="flex gap-2">
                            <button
                                onClick={handleEnable}
                                disabled={isLoading}
                                className="px-4 py-2 bg-orange-600 text-white text-sm font-medium rounded-lg hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                {isLoading ? 'Enabling...' : 'Enable'}
                            </button>
                            <button
                                onClick={handleDismiss}
                                className="px-4 py-2 text-gray-700 dark:text-gray-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                            >
                                Not now
                            </button>
                        </div>
                    </div>

                    <button
                        onClick={handleDismiss}
                        className="flex-shrink-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
}
