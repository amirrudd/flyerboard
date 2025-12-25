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
 * IMPORTANT: Resolution is preserved (max 2048px on longest side) to ensure
 * ads look sharp and clear. Quality is adjusted based on network speed
 * to optimize upload time while maintaining visual quality.
 */
export async function getOptimalCompressionSettings(): Promise<CompressionSettings> {
    const speed = await estimateNetworkSpeed();

    // If we can't determine speed, use balanced settings
    if (speed === null) {
        return {
            quality: 0.88,
            maxSizeMB: 10, // Safety net, won't constrain normal images
            label: 'Balanced (unknown connection)',
        };
    }

    // Fast connection (>5 Mbps): Higher quality, preserve resolution
    // Result: ~2-4MB for high-res photos, sharp and clear
    if (speed > 5) {
        return {
            quality: 0.92,
            maxSizeMB: 10, // Safety net, won't constrain normal images
            label: 'Fast connection - high quality',
        };
    }

    // Medium connection (1-5 Mbps): Balanced quality
    // Result: ~1.5-3MB for high-res photos, still sharp
    if (speed >= 1) {
        return {
            quality: 0.88,
            maxSizeMB: 10, // Safety net, won't constrain normal images
            label: 'Medium connection - balanced quality',
        };
    }

    // Slow connection (<1 Mbps): Lower quality but still preserve resolution
    // Result: ~1-2MB for high-res photos, acceptable quality
    return {
        quality: 0.85,
        maxSizeMB: 10, // Safety net, won't constrain normal images
        label: 'Slow connection - optimized quality',
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
