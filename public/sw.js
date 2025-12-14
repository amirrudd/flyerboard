// Minimal service worker for PWA installability
// No caching or offline functionality - just enables "Add to Home Screen"

self.addEventListener('install', (event) => {
    // Skip waiting to activate immediately
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    // Claim all clients immediately
    event.waitUntil(clients.claim());
});

// No fetch handler - all requests go to network

// ============================================================================
// Push Notification Handlers
// ============================================================================

/**
 * Handle incoming push notifications
 * Displays a notification to the user
 */
self.addEventListener('push', (event) => {
    console.log('Push notification received:', event);

    // Parse notification data
    const data = event.data?.json() ?? {};
    const title = data.title || 'FlyerBoard';
    const options = {
        body: data.body || 'You have a new notification',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: {
            url: data.url || '/',
            chatId: data.chatId,
            timestamp: data.timestamp,
        },
        tag: data.chatId || 'notification',
        requireInteraction: false,
        vibrate: [200, 100, 200], // Vibration pattern for mobile
    };

    event.waitUntil(
        self.registration.showNotification(title, options)
    );
});

/**
 * Handle notification clicks
 * Opens the app to the relevant page
 */
self.addEventListener('notificationclick', (event) => {
    console.log('Notification clicked:', event.notification);

    event.notification.close();

    const urlToOpen = event.notification.data?.url || '/';
    const fullUrl = new URL(urlToOpen, self.location.origin).href;

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true })
            .then((clientList) => {
                // Check if there's already a window open with this URL
                for (const client of clientList) {
                    if (client.url === fullUrl && 'focus' in client) {
                        return client.focus();
                    }
                }
                // Check if there's any window open
                if (clientList.length > 0) {
                    const client = clientList[0];
                    client.focus();
                    client.postMessage({
                        type: 'NAVIGATE',
                        url: urlToOpen,
                    });
                    return client;
                }
                // Open new window if none exists
                if (clients.openWindow) {
                    return clients.openWindow(fullUrl);
                }
            })
    );
});
