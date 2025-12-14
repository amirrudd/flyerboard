import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ContextualNotificationModal } from './ContextualNotificationModal';
import { usePushNotifications } from '../../hooks/usePushNotifications';

// Mock the usePushNotifications hook
vi.mock('../../hooks/usePushNotifications', () => ({
    usePushNotifications: vi.fn(),
}));

// Mock createPortal to render directly in the DOM for testing
vi.mock('react-dom', async () => {
    const actual = await vi.importActual('react-dom');
    return {
        ...actual,
        createPortal: (node: React.ReactNode) => node,
    };
});

describe('ContextualNotificationModal', () => {
    const mockSubscribe = vi.fn();
    const mockOnClose = vi.fn();

    beforeEach(() => {
        // Clear localStorage before each test
        localStorage.clear();
        vi.resetAllMocks();

        // Default mock implementation
        vi.mocked(usePushNotifications).mockReturnValue({
            isSupported: true,
            permission: 'default',
            isSubscribed: false,
            isLoading: false,
            requestPermission: vi.fn(),
            subscribe: mockSubscribe,
            unsubscribe: vi.fn(),
        });
    });

    afterEach(() => {
        localStorage.clear();
    });

    describe('Context-specific messaging', () => {
        it('should display post-flyer context messaging', () => {
            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('Stay Updated on Your Flyer')).toBeInTheDocument();
            expect(screen.getByText('Get notified when someone makes an enquiry about your flyer')).toBeInTheDocument();
            expect(screen.getByText('📬')).toBeInTheDocument();
        });

        it('should display send-message context messaging', () => {
            render(
                <ContextualNotificationModal
                    context="send-message"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('Never Miss a Reply')).toBeInTheDocument();
            expect(screen.getByText('Get notified when the seller replies to your message')).toBeInTheDocument();
            expect(screen.getByText('💬')).toBeInTheDocument();
        });

        it('should display like-flyer context messaging', () => {
            render(
                <ContextualNotificationModal
                    context="like-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('Track Your Saved Flyers')).toBeInTheDocument();
            expect(screen.getByText('Get notified about price drops and status updates for saved flyers')).toBeInTheDocument();
            expect(screen.getByText('❤️')).toBeInTheDocument();
        });
    });

    describe('Visibility conditions', () => {
        it('should not render when isOpen is false', () => {
            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={false}
                    onClose={mockOnClose}
                />
            );

            expect(screen.queryByText('Stay Updated on Your Flyer')).not.toBeInTheDocument();
        });

        it('should not render when notifications are not supported', () => {
            vi.mocked(usePushNotifications).mockReturnValue({
                isSupported: false,
                permission: 'default',
                isSubscribed: false,
                isLoading: false,
                requestPermission: vi.fn(),
                subscribe: mockSubscribe,
                unsubscribe: vi.fn(),
            });

            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.queryByText('Stay Updated on Your Flyer')).not.toBeInTheDocument();
        });

        it('should not render when permission is already granted', () => {
            vi.mocked(usePushNotifications).mockReturnValue({
                isSupported: true,
                permission: 'granted',
                isSubscribed: true,
                isLoading: false,
                requestPermission: vi.fn(),
                subscribe: mockSubscribe,
                unsubscribe: vi.fn(),
            });

            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.queryByText('Stay Updated on Your Flyer')).not.toBeInTheDocument();
        });

        it('should not render when context has been dismissed', () => {
            localStorage.setItem('notification-prompt-dismissed-post-flyer', 'true');

            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.queryByText('Stay Updated on Your Flyer')).not.toBeInTheDocument();
        });

        it('should render when all conditions are met', () => {
            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('Stay Updated on Your Flyer')).toBeInTheDocument();
        });
    });

    describe('Context-specific dismissal tracking', () => {
        it('should use separate localStorage keys for different contexts', () => {
            const { rerender } = render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            // Dismiss post-flyer context
            const notNowButton = screen.getByText('Not now');
            fireEvent.click(notNowButton);

            expect(localStorage.getItem('notification-prompt-dismissed-post-flyer')).toBe('true');
            expect(localStorage.getItem('notification-prompt-dismissed-send-message')).toBeNull();
            expect(localStorage.getItem('notification-prompt-dismissed-like-flyer')).toBeNull();

            // Verify send-message context still shows
            rerender(
                <ContextualNotificationModal
                    context="send-message"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('Never Miss a Reply')).toBeInTheDocument();
        });

        it('should not show modal again after dismissal for same context', () => {
            localStorage.setItem('notification-prompt-dismissed-post-flyer', 'true');

            const { rerender } = render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.queryByText('Stay Updated on Your Flyer')).not.toBeInTheDocument();

            // Reopen should still not show
            rerender(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={false}
                    onClose={mockOnClose}
                />
            );

            rerender(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.queryByText('Stay Updated on Your Flyer')).not.toBeInTheDocument();
        });
    });

    describe('User interactions', () => {
        it('should call subscribe and onClose when Enable Notifications is clicked', async () => {
            mockSubscribe.mockResolvedValue(true);

            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            const enableButton = screen.getByText('Enable Notifications');
            fireEvent.click(enableButton);

            await waitFor(() => {
                expect(mockSubscribe).toHaveBeenCalled();
                expect(mockOnClose).toHaveBeenCalled();
            });
        });

        it('should not call onClose if subscribe fails', async () => {
            mockSubscribe.mockResolvedValue(false);

            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            const enableButton = screen.getByText('Enable Notifications');
            fireEvent.click(enableButton);

            await waitFor(() => {
                expect(mockSubscribe).toHaveBeenCalled();
            });

            expect(mockOnClose).not.toHaveBeenCalled();
        });

        it('should save dismissal to localStorage and call onClose when Not now is clicked', () => {
            render(
                <ContextualNotificationModal
                    context="send-message"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            const notNowButton = screen.getByText('Not now');
            fireEvent.click(notNowButton);

            expect(localStorage.getItem('notification-prompt-dismissed-send-message')).toBe('true');
            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should save dismissal and call onClose when X button is clicked', () => {
            render(
                <ContextualNotificationModal
                    context="like-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            const closeButton = screen.getByLabelText('Close notification prompt');
            fireEvent.click(closeButton);

            expect(localStorage.getItem('notification-prompt-dismissed-like-flyer')).toBe('true');
            expect(mockOnClose).toHaveBeenCalled();
        });

        it('should show loading state while subscribing', async () => {
            vi.mocked(usePushNotifications).mockReturnValue({
                isSupported: true,
                permission: 'default',
                isSubscribed: false,
                isLoading: true,
                requestPermission: vi.fn(),
                subscribe: mockSubscribe,
                unsubscribe: vi.fn(),
            });

            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            const enableButton = screen.getByText('Enabling...');
            expect(enableButton).toBeDisabled();
        });
    });

    describe('Modal rendering', () => {
        it('should render with proper styling classes', () => {
            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            // Check for backdrop
            const backdrop = screen.getByText('Stay Updated on Your Flyer').closest('.fixed');
            expect(backdrop).toHaveClass('bg-black/50', 'backdrop-blur-sm', 'z-[100]');

            // Check for modal content
            const modal = screen.getByText('Stay Updated on Your Flyer').closest('.bg-white');
            expect(modal).toHaveClass('rounded-xl', 'shadow-2xl', 'animate-scale-in');
        });

        it('should have accessible button labels', () => {
            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('Enable Notifications')).toBeInTheDocument();
            expect(screen.getByText('Not now')).toBeInTheDocument();
            expect(screen.getByLabelText('Close notification prompt')).toBeInTheDocument();
        });
    });

    describe('Edge cases', () => {
        it('should handle rapid open/close cycles', () => {
            const { rerender } = render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('Stay Updated on Your Flyer')).toBeInTheDocument();

            rerender(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={false}
                    onClose={mockOnClose}
                />
            );

            expect(screen.queryByText('Stay Updated on Your Flyer')).not.toBeInTheDocument();

            rerender(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            expect(screen.getByText('Stay Updated on Your Flyer')).toBeInTheDocument();
        });

        it('should handle permission denied state', () => {
            vi.mocked(usePushNotifications).mockReturnValue({
                isSupported: true,
                permission: 'denied',
                isSubscribed: false,
                isLoading: false,
                requestPermission: vi.fn(),
                subscribe: mockSubscribe,
                unsubscribe: vi.fn(),
            });

            render(
                <ContextualNotificationModal
                    context="post-flyer"
                    isOpen={true}
                    onClose={mockOnClose}
                />
            );

            // Should not show modal when permission is denied
            expect(screen.queryByText('Stay Updated on Your Flyer')).not.toBeInTheDocument();
        });
    });
});
