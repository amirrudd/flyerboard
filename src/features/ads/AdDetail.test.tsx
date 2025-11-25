import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdDetail } from './AdDetail';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'sonner';
import { HelmetProvider } from 'react-helmet-async';

// Mock dependencies
vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
    useMutation: vi.fn(),
}));

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

vi.mock('../layout/Header', () => ({
    Header: ({ leftNode, centerNode, rightNode }: any) => (
        <div data-testid="header">
            <div data-testid="header-left">{leftNode}</div>
            <div data-testid="header-center">{centerNode}</div>
            <div data-testid="header-right">{rightNode}</div>
        </div>
    ),
}));

vi.mock('../layout/HeaderRightActions', () => ({
    HeaderRightActions: () => <div data-testid="header-right-actions">Actions</div>,
}));

vi.mock('../../components/ReportModal', () => ({
    ReportModal: () => <div data-testid="report-modal">Report Modal</div>,
}));

// Import useQuery and useMutation from the mocked module
import { useQuery, useMutation } from 'convex/react';

describe('AdDetail - Share Functionality', () => {
    const mockAdId = 'test-ad-id' as any;
    const mockAd = {
        _id: mockAdId,
        title: 'Test Ad Title',
        description: 'Test ad description',
        price: 100,
        images: ['https://example.com/image1.jpg'],
        location: 'Sydney, NSW',
        userId: 'seller-id',
        views: 10,
        _creationTime: Date.now(),
        seller: {
            name: 'Test Seller',
        },
    };

    const mockOnBack = vi.fn();
    const mockOnShowAuth = vi.fn();
    const mockIncrementViews = vi.fn();

    // Store original navigator methods
    let originalNavigator: any;
    let mockClipboard: any;
    let mockShare: any;

    beforeEach(() => {
        // Reset all mocks
        vi.clearAllMocks();

        // Store original navigator
        originalNavigator = global.navigator;

        // Mock clipboard API
        mockClipboard = {
            writeText: vi.fn().mockResolvedValue(undefined),
        };

        // Mock share API (default to not supported)
        mockShare = undefined;

        // Setup mock implementations with sequential returns
        // AdDetail makes these useQuery calls in order:
        // 1. getAdById, 2. isAdSaved, 3. getChatForAd, 4. getChatMessages (skip), 5. loggedInUser
        (useQuery as any)
            .mockReturnValueOnce(mockAd)        // getAdById
            .mockReturnValueOnce(false)         // isAdSaved
            .mockReturnValueOnce(null)          // getChatForAd
            .mockReturnValueOnce(undefined)     // getChatMessages (skip)
            .mockReturnValueOnce(null);         // loggedInUser

        // useMutation returns a function that returns a promise
        (useMutation as any).mockReturnValue(vi.fn().mockResolvedValue(undefined));
    });

    afterEach(() => {
        // Restore original navigator
        global.navigator = originalNavigator;
    });

    const renderAdDetail = () => {
        return render(
            <HelmetProvider>
                <BrowserRouter>
                    <AdDetail
                        adId={mockAdId}
                        onBack={mockOnBack}
                        onShowAuth={mockOnShowAuth}
                    />
                </BrowserRouter>
            </HelmetProvider>
        );
    };

    describe('Share URL Construction', () => {
        it('should construct URL without extra spaces', async () => {
            // Mock navigator without share API (fallback to clipboard)
            Object.defineProperty(global, 'navigator', {
                value: {
                    clipboard: mockClipboard,
                },
                writable: true,
                configurable: true,
            });

            renderAdDetail();

            // Wait for component to render
            await waitFor(() => {
                const titles = screen.getAllByText('Test Ad Title');
                expect(titles[0]).toBeInTheDocument();
            });

            // Find and click share button in the header
            const shareButtons = screen.getAllByTitle('Share ad');
            fireEvent.click(shareButtons[0]);

            // Verify clipboard was called with correctly formatted URL
            await waitFor(() => {
                expect(mockClipboard.writeText).toHaveBeenCalledWith(
                    'http://localhost:3000/' // JSDOM default URL
                );
            });

            // Verify the URL doesn't have extra spaces
            const calledUrl = mockClipboard.writeText.mock.calls[0][0];
            expect(calledUrl).not.toMatch(/\s/); // No whitespace in URL
        });
    });

    describe('Clipboard Fallback', () => {
        it('should copy to clipboard when navigator.share is not available', async () => {
            // Mock navigator without share API
            Object.defineProperty(global, 'navigator', {
                value: {
                    clipboard: mockClipboard,
                },
                writable: true,
                configurable: true,
            });

            renderAdDetail();

            await waitFor(() => {
                const titles = screen.getAllByText('Test Ad Title');
                expect(titles[0]).toBeInTheDocument();
            });

            // Click share button
            const shareButtons = screen.getAllByTitle('Share ad');
            fireEvent.click(shareButtons[0]);

            // Verify clipboard was called
            await waitFor(() => {
                expect(mockClipboard.writeText).toHaveBeenCalled();
            });

            // Verify toast message with branding
            expect(toast.success).toHaveBeenCalledWith('Link to this flyer copied to clipboard');
        });

        it('should show toast notification after copying to clipboard', async () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    clipboard: mockClipboard,
                },
                writable: true,
                configurable: true,
            });

            renderAdDetail();

            await waitFor(() => {
                const titles = screen.getAllByText('Test Ad Title');
                expect(titles[0]).toBeInTheDocument();
            });

            const shareButtons = screen.getAllByTitle('Share ad');
            fireEvent.click(shareButtons[0]);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('Link to this flyer copied to clipboard');
            });
        });
    });

    describe('Native Share API', () => {
        it('should use native share API when available', async () => {
            mockShare = vi.fn().mockResolvedValue(undefined);

            Object.defineProperty(global, 'navigator', {
                value: {
                    share: mockShare,
                    clipboard: mockClipboard,
                },
                writable: true,
                configurable: true,
            });

            renderAdDetail();

            await waitFor(() => {
                const titles = screen.getAllByText('Test Ad Title');
                expect(titles[0]).toBeInTheDocument();
            });

            const shareButtons = screen.getAllByTitle('Share ad');
            fireEvent.click(shareButtons[0]);

            await waitFor(() => {
                expect(mockShare).toHaveBeenCalledWith({
                    title: 'Test Ad Title',
                    url: 'http://localhost:3000/', // JSDOM default URL
                });
            });

            // Verify success toast is shown
            expect(toast.success).toHaveBeenCalledWith('Flyer shared successfully!');
        });

        it('should not show error when user cancels native share', async () => {
            const abortError = new Error('User cancelled');
            abortError.name = 'AbortError';
            mockShare = vi.fn().mockRejectedValue(abortError);

            Object.defineProperty(global, 'navigator', {
                value: {
                    share: mockShare,
                    clipboard: mockClipboard,
                },
                writable: true,
                configurable: true,
            });

            renderAdDetail();

            await waitFor(() => {
                const titles = screen.getAllByText('Test Ad Title');
                expect(titles[0]).toBeInTheDocument();
            });

            const shareButtons = screen.getAllByTitle('Share ad');
            fireEvent.click(shareButtons[0]);

            await waitFor(() => {
                expect(mockShare).toHaveBeenCalled();
            });

            // Verify no toast was shown (user cancelled)
            expect(toast.success).not.toHaveBeenCalled();
            expect(toast.error).not.toHaveBeenCalled();
        });

        it('should fallback to clipboard when native share fails', async () => {
            const shareError = new Error('Share failed');
            shareError.name = 'ShareError';
            mockShare = vi.fn().mockRejectedValue(shareError);

            Object.defineProperty(global, 'navigator', {
                value: {
                    share: mockShare,
                    clipboard: mockClipboard,
                },
                writable: true,
                configurable: true,
            });

            renderAdDetail();

            await waitFor(() => {
                const titles = screen.getAllByText('Test Ad Title');
                expect(titles[0]).toBeInTheDocument();
            });

            const shareButtons = screen.getAllByTitle('Share ad');
            fireEvent.click(shareButtons[0]);

            // Wait for share to fail and fallback to clipboard
            await waitFor(() => {
                expect(mockClipboard.writeText).toHaveBeenCalled();
            });

            // Verify clipboard fallback toast is shown
            expect(toast.success).toHaveBeenCalledWith('Link to this flyer copied to clipboard');
        });
    });

    describe('Share Button Accessibility', () => {
        it('should have share button in header', async () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    clipboard: mockClipboard,
                },
                writable: true,
                configurable: true,
            });

            renderAdDetail();

            await waitFor(() => {
                const titles = screen.getAllByText('Test Ad Title');
                expect(titles[0]).toBeInTheDocument();
            });

            // Check for share button in header
            const shareButtons = screen.getAllByTitle('Share ad');
            expect(shareButtons.length).toBeGreaterThan(0);
        });

        it('should have share button in Quick Actions sidebar', async () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    clipboard: mockClipboard,
                },
                writable: true,
                configurable: true,
            });

            renderAdDetail();

            await waitFor(() => {
                const titles = screen.getAllByText('Test Ad Title');
                expect(titles[0]).toBeInTheDocument();
            });

            // Check for "Share Ad" text in sidebar
            expect(screen.getByText('Share Ad')).toBeInTheDocument();
        });

        it('should work when clicking share button in sidebar', async () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    clipboard: mockClipboard,
                },
                writable: true,
                configurable: true,
            });

            renderAdDetail();

            await waitFor(() => {
                const titles = screen.getAllByText('Test Ad Title');
                expect(titles[0]).toBeInTheDocument();
            });

            // Click the sidebar share button
            const sidebarShareButton = screen.getByText('Share Ad');
            fireEvent.click(sidebarShareButton);

            await waitFor(() => {
                expect(mockClipboard.writeText).toHaveBeenCalled();
                expect(toast.success).toHaveBeenCalledWith('Link to this flyer copied to clipboard');
            });
        });
    });
});
