/**
 * Contextual Notification Permission Modal
 * Shows permission request at specific user action moments with contextual messaging
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from '@phosphor-icons/react';
import { usePushNotifications } from '../../hooks/usePushNotifications';

export type NotificationContext = 'post-flyer' | 'send-message' | 'like-flyer';

interface ContextualNotificationModalProps {
    context: NotificationContext;
    isOpen: boolean;
    onClose: () => void;
}

const CONTEXT_CONFIG = {
    'post-flyer': {
        title: 'Stay Updated on Your Flyer',
        message: 'Get notified when someone makes an enquiry about your flyer',
        icon: '📬',
    },
    'send-message': {
        title: 'Never Miss a Reply',
        message: 'Get notified when the seller replies to your message',
        icon: '💬',
    },
    'like-flyer': {
        title: 'Track Your Saved Flyers',
        message: 'Get notified about price drops and status updates for saved flyers',
        icon: '❤️',
    },
};

export function ContextualNotificationModal({
    context,
    isOpen,
    onClose
}: ContextualNotificationModalProps) {
    const { isSupported, permission, subscribe, isLoading } = usePushNotifications();
    const [shouldShow, setShouldShow] = useState(false);

    const config = CONTEXT_CONFIG[context];
    const dismissalKey = `notification-prompt-dismissed-${context}`;

    useEffect(() => {
        if (!isOpen) {
            setShouldShow(false);
            return;
        }

        // Check if we should show the modal
        // Only show if permission is 'default' (not yet asked)
        // Don't show if 'granted' (already enabled) or 'denied' (user rejected)
        const isDismissed = localStorage.getItem(dismissalKey);
        const shouldShowModal =
            isSupported &&
            permission === 'default' &&
            !isDismissed;

        setShouldShow(shouldShowModal);

        // If we shouldn't show, call onClose immediately to allow navigation
        if (!shouldShowModal) {
            onClose();
        }
    }, [isOpen, isSupported, permission, dismissalKey, onClose]);

    const handleEnable = async () => {
        const success = await subscribe();
        if (success) {
            onClose();
        }
    };

    const handleDismiss = () => {
        localStorage.setItem(dismissalKey, 'true');
        onClose();
    };

    if (!shouldShow) {
        return null;
    }

    const modal = (
        <div
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            role="dialog"
            aria-modal="true"
            aria-labelledby={`notification-modal-title-${context}`}
            aria-describedby={`notification-modal-desc-${context}`}
        >
            <section className="bg-card rounded-xl shadow-2xl ring-1 ring-border/70 p-6 sm:p-7 max-w-md w-full animate-scale-in">
                <div className="flex items-start gap-4">
                    <div className="flex-shrink-0">
                        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center text-2xl ring-1 ring-primary/15" aria-hidden="true">
                            {config.icon}
                        </div>
                    </div>

                    <div className="flex-1 min-w-0">
                        <p className="kicker text-muted-foreground mb-1">Stay in the loop</p>
                        <h3
                            id={`notification-modal-title-${context}`}
                            className="font-display text-xl sm:text-2xl font-semibold tracking-tight text-foreground mb-2"
                        >
                            {config.title}
                        </h3>
                        <p
                            id={`notification-modal-desc-${context}`}
                            className="text-[15px] leading-relaxed text-foreground/80 mb-5 max-w-prose"
                        >
                            {config.message}
                        </p>

                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleEnable}
                                disabled={isLoading}
                                className="flex-1 h-11 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all shadow-sm shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                                aria-label="Enable push notifications"
                            >
                                {isLoading ? 'Enabling...' : 'Enable Notifications'}
                            </button>
                            <button
                                type="button"
                                onClick={handleDismiss}
                                className="h-11 px-4 bg-muted/40 text-foreground ring-1 ring-border text-sm font-medium rounded-full hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] transition-all"
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
                        aria-label="Close notification prompt"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>
            </section>
        </div>
    );

    return createPortal(modal, document.body);
}
