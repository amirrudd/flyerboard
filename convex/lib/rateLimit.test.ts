import { describe, it, expect } from 'vitest';
import { internal } from '../_generated/api';
import { RATE_LIMITS } from './rateLimit';

/**
 * Behavioral guard: actions that can't access MutationCtx directly must call
 * `enforceRateLimit` via ctx.runMutation. If this internalMutation export is
 * removed or renamed, `upload_urls.ts` (and any other action-side rate-limit
 * call site) will silently lose enforcement — these tests fail loudly first.
 */

describe('rateLimit — generateUploadUrl enforcement', () => {
    it('exposes enforceRateLimit as an internal mutation', () => {
        expect(internal.lib.rateLimit.enforceRateLimit).toBeDefined();
    });

    it('configures a rate limit for generateUploadUrl', () => {
        const limit = RATE_LIMITS.generateUploadUrl;
        expect(limit).toBeDefined();
        expect(limit.maxRequests).toBeGreaterThan(0);
        expect(limit.windowMs).toBeGreaterThan(0);
    });
});
