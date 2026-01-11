/**
 * View Tracker - Batches ad view tracking to reduce Convex mutations.
 * 
 * Features:
 * - Tracks unique views per session (no duplicates within same session)
 * - Flushes every 30 seconds while user is active
 * - Flushes on page visibility change to 'hidden'
 * - Single mutation for multiple views
 */

type ViewBatch = Set<string>; // Ad IDs viewed this session

// Session-unique identifier to deduplicate views
const SESSION_ID = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

// Track which ads have been viewed in this session
const viewedInSession: ViewBatch = new Set();

// Pending views to be flushed
let pendingViews: ViewBatch = new Set();
let flushTimeoutId: ReturnType<typeof setTimeout> | null = null;

// Callback to be set by React when component mounts
let flushCallback: ((adIds: string[]) => Promise<void>) | null = null;

/**
 * Set the flush callback that will be called to send batched views to the backend.
 * This should be called by a React component that has access to the Convex mutation.
 */
export function setFlushCallback(callback: (adIds: string[]) => Promise<void>) {
    flushCallback = callback;
}

/**
 * Track a view for an ad. 
 * - Deduplicates within current session
 * - Batches for efficient API calls
 */
export function trackView(adId: string) {
    // Deduplicate within session - same user viewing same ad multiple times doesn't count
    if (viewedInSession.has(adId)) {
        return;
    }

    viewedInSession.add(adId);
    pendingViews.add(adId);
    scheduleFlush();
}

/**
 * Schedule a flush after 30 seconds of inactivity.
 */
function scheduleFlush() {
    if (flushTimeoutId !== null) return;

    flushTimeoutId = setTimeout(async () => {
        await flush();
    }, 30000); // 30 seconds
}

/**
 * Immediately flush all pending views to the backend.
 */
async function flush() {
    if (pendingViews.size === 0) return;

    const viewsToFlush = Array.from(pendingViews);
    pendingViews = new Set();

    if (flushTimeoutId !== null) {
        clearTimeout(flushTimeoutId);
        flushTimeoutId = null;
    }

    if (flushCallback) {
        try {
            await flushCallback(viewsToFlush);
        } catch (error) {
            console.error('Failed to flush view batch:', error);
            // Re-add failed views for retry (but don't re-count in session)
            viewsToFlush.forEach(id => pendingViews.add(id));
            scheduleFlush();
        }
    }
}

/**
 * Force an immediate flush (e.g., before page unload).
 * Returns a promise that resolves when flush is complete.
 */
export async function forceFlush(): Promise<void> {
    await flush();
}

// Flush on visibility change to 'hidden' (user switches tabs or minimizes)
if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
            flush();
        }
    });
}

// Export session ID for debugging
export function getSessionId(): string {
    return SESSION_ID;
}

// Export pending count for debugging
export function getPendingCount(): number {
    return pendingViews.size;
}
