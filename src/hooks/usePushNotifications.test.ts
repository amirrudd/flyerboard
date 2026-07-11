import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePushNotifications } from './usePushNotifications';
import { notificationService } from '../services/notifications';

vi.mock('convex/react', () => ({
    useMutation: vi.fn(() => vi.fn()),
}));

vi.mock('../services/notifications', () => ({
    notificationService: {
        isSupported: vi.fn(() => true),
        getPermissionStatus: vi.fn(() => 'default'),
        requestPermission: vi.fn(),
        isSubscribed: vi.fn(async () => false),
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
    },
}));

vi.mock('../services/notifications/webPushService', () => ({
    webPushService: {
        initialize: vi.fn(),
        getSubscription: vi.fn(async () => null),
    },
}));

// The module above is fully mocked, so every member is a vi.fn — retype it
// once to avoid unbound-method lint noise on each vi.mocked(obj.method) call.
const svc = notificationService as unknown as Record<
    keyof typeof notificationService,
    ReturnType<typeof vi.fn>
>;

describe('usePushNotifications.requestPermission', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        svc.isSupported.mockReturnValue(true);
        svc.isSubscribed.mockResolvedValue(false);
    });

    it('keeps permission at "default" when the prompt is dismissed (not denied)', async () => {
        // A dismissed prompt resolves ungranted, but the browser permission
        // stays 'default'. Coercing to 'denied' hid enable UIs until reload.
        svc.requestPermission.mockResolvedValue(false);
        svc.getPermissionStatus.mockReturnValue('default');

        const { result } = renderHook(() => usePushNotifications());
        await act(async () => {
            expect(await result.current.requestPermission()).toBe(false);
        });

        expect(result.current.permission).toBe('default');
    });

    it('reports "denied" when the browser permission is actually denied', async () => {
        svc.requestPermission.mockResolvedValue(false);
        svc.getPermissionStatus.mockReturnValue('denied');

        const { result } = renderHook(() => usePushNotifications());
        await act(async () => {
            await result.current.requestPermission();
        });

        expect(result.current.permission).toBe('denied');
    });

    it('reports "granted" after the user allows', async () => {
        svc.requestPermission.mockResolvedValue(true);
        svc.getPermissionStatus.mockReturnValue('granted');

        const { result } = renderHook(() => usePushNotifications());
        await act(async () => {
            expect(await result.current.requestPermission()).toBe(true);
        });

        expect(result.current.permission).toBe('granted');
    });
});
