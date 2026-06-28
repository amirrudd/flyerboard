/**
 * Notification Permission Prompt Component
 * Displays a banner prompting users to enable push notifications
 */

import { useState, useEffect } from 'react';
import { Bell, X } from '@phosphor-icons/react';
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
            // eslint-disable-next-line react-hooks/set-state-in-effect
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
        <aside
            className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-96 z-50 animate-slide-up"
            role="region"
            aria-label="Notification permission prompt"
        >
            <section className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover p-5">
                <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                        <div className="w-10 h-10 bg-primary/10 ring-1 ring-primary/15 rounded-full flex items-center justify-center">
                            <Bell className="w-5 h-5 text-primary" aria-hidden="true" />
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="kicker text-muted-foreground mb-1">Stay in the loop</p>
                        <h3 className="font-display text-lg font-semibold tracking-tight text-foreground mb-1">
                            Enable Notifications
                        </h3>
                        <p className="text-sm text-foreground/80 mb-4 leading-relaxed">
                            Get notified when you receive new messages from buyers and sellers
                        </p>

                        <div className="flex gap-2">
                            <button
                                type="button"
                                onClick={() => { void handleEnable(); }}
                                disabled={isLoading}
                                className="h-10 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                aria-label="Enable push notifications"
                            >
                                {isLoading ? 'Enabling...' : 'Enable'}
                            </button>
                            <button
                                type="button"
                                onClick={handleDismiss}
                                className="h-10 px-4 bg-muted/40 text-foreground ring-1 ring-border text-sm font-medium rounded-full hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
                                aria-label="Dismiss notification prompt"
                            >
                                Not now
                            </button>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleDismiss}
                        className="flex-shrink-0 text-muted-foreground hover:text-foreground rounded-full p-2 hover:bg-muted/60 transition-colors"
                        aria-label="Close"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </section>
        </aside>
    );
}
