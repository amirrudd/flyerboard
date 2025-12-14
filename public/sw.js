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
