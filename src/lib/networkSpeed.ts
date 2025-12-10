/**
 * Detect network speed and return appropriate compression settings
 * Uses Network Information API when available, with fallback to conservative defaults
 */

export interface CompressionSettings {
    quality: number;
    maxSizeMB: number;
    label: string;
}

/**
 * Estimate network speed using Network Information API
 * Returns speed in Mbps
 */
export async function estimateNetworkSpeed(): Promise<number | null> {
    // Check if Network Information API is available
    if ('connection' in navigator) {
        const connection = (navigator as any).connection;

        // effectiveType: 'slow-2g', '2g', '3g', '4g'
        if (connection.effectiveType) {
            const typeToSpeed: Record<string, number> = {
                'slow-2g': 0.05,  // ~50 Kbps
                '2g': 0.25,       // ~250 Kbps
                '3g': 1.5,        // ~1.5 Mbps
                '4g': 10,         // ~10 Mbps
            };

            const speed = typeToSpeed[connection.effectiveType];
            if (speed) return speed;
        }

        // downlink: estimated bandwidth in Mbps
        if (connection.downlink) {
            return connection.downlink;
        }
    }

    // Fallback: measure actual download speed with a small test
    try {
        const startTime = performance.now();
        // Download a small image (1KB) from a fast CDN
        await fetch('https://via.placeholder.com/1', { cache: 'no-store' });
        const endTime = performance.now();
        const duration = (endTime - startTime) / 1000; // seconds

        // Rough estimate: if 1KB takes X seconds, speed is ~1KB/X Kbps
        // This is very rough, but gives us a baseline
        const speedKbps = (1 / duration);
        return speedKbps / 1000; // Convert to Mbps
    } catch {
        return null; // Can't determine speed
    }
}

/**
 * Get optimal compression settings based on network speed
 * 
 * IMPORTANT: Quality is kept consistent (90%) for all users to ensure
 * ads look good regardless of uploader's connection speed.
 * Only maxSizeMB is adjusted to optimize upload time.
 */
export async function getOptimalCompressionSettings(): Promise<CompressionSettings> {
    const speed = await estimateNetworkSpeed();

    // Consistent quality for all users - ads should look good for everyone
    const QUALITY = 0.9; // 90% quality for all connections

    // If we can't determine speed, use balanced settings
    if (speed === null) {
        return {
            quality: QUALITY,
            maxSizeMB: 1,
            label: 'Balanced (unknown connection)',
        };
    }

    // Fast connection (>5 Mbps): Allow larger files
    // Less aggressive compression = faster processing
    if (speed > 5) {
        return {
            quality: QUALITY,
            maxSizeMB: 1.5,
            label: 'Fast connection - larger files OK',
        };
    }

    // Medium connection (1-5 Mbps): Standard compression
    if (speed >= 1) {
        return {
            quality: QUALITY,
            maxSizeMB: 1,
            label: 'Medium connection - standard compression',
        };
    }

    // Slow connection (<1 Mbps): More aggressive size reduction
    // Same quality, but compress harder to reduce file size
    return {
        quality: QUALITY,
        maxSizeMB: 0.8,
        label: 'Slow connection - aggressive compression',
    };
}

/**
 * Calculate estimated total time (compression + upload)
 * This helps verify our optimization is working
 */
export function estimateTotalTime(
    fileSizeKB: number,
    compressionRatio: number,
    compressionTimeMs: number,
    uploadSpeedMbps: number
): number {
    const compressedSizeKB = fileSizeKB * compressionRatio;
    const uploadTimeMs = (compressedSizeKB * 8) / (uploadSpeedMbps * 1000) * 1000;
    return compressionTimeMs + uploadTimeMs;
}
