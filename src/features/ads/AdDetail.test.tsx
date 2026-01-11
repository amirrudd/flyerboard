import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdDetail } from './AdDetail';
import { BrowserRouter } from 'react-router-dom';
import { toast } from 'sonner';

// Mock Descope SDK
const mockUseSession = vi.fn();
vi.mock('@descope/react-sdk', () => ({
    useSession: () => mockUseSession(),
}));

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

vi.mock('../../components/ui/ImageDisplay', () => ({
    ImageDisplay: ({ alt }: { alt: string }) => <img alt={alt} src="mock-image.jpg" />,
}));

vi.mock('../../components/ui/LocationMap', () => ({
    LocationMap: () => <div data-testid="location-map">Map</div>,
}));

vi.mock('../../components/ui/ImageLightbox', () => ({
    ImageLightbox: () => <div data-testid="image-lightbox">Lightbox</div>,
}));

vi.mock('../../lib/viewTracker', () => ({
    trackView: vi.fn(),
    setFlushCallback: vi.fn(),
}));

// Import useQuery and useMutation from the mocked module
import { useQuery, useMutation } from 'convex/react';

describe('AdDetail - Share Functionality', () => {
    const mockAdId = 'test-ad-id' as any;
    const mockAd = {
        _id: mockAdId,
        title: 'Test Flyer Title',
        description: 'Test flyer description',
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

        // Default to authenticated
        mockUseSession.mockReturnValue({ isAuthenticated: true });

        // Store original navigator
        originalNavigator = global.navigator;

        // Mock clipboard API
        mockClipboard = {
            writeText: vi.fn().mockResolvedValue(undefined),
        };

        // Mock share API (default to not supported)
        mockShare = undefined;

        // Setup mock implementations based on query function called
        const adContext = {
            ad: mockAd,
            isSaved: false,
            existingChat: null
        };
        const mockUser = { _id: 'user-1', name: 'Test User' };

        // Use mockImplementation to return the right value based on the query
        (useQuery as any).mockImplementation((queryFn: any, args: any) => {
            // Check the query function/args to determine return value
            // Since we can't easily inspect the function, return adContext as default
            if (args === "skip") {
                return undefined;
            }
            // For getAdWithContext, return the context
            // For getCurrentUser, return user
            // Since we can't distinguish, just return the adContext for ad queries
            return adContext;
        });

        // useMutation returns a function that returns a promise
        (useMutation as any).mockReturnValue(vi.fn().mockResolvedValue(undefined));
    });

    afterEach(() => {
        // Restore original navigator
        global.navigator = originalNavigator;
    });

    const renderAdDetail = () => {
        return render(
            <BrowserRouter>
                <AdDetail
                    adId={mockAdId}
                    onBack={mockOnBack}
                    onShowAuth={mockOnShowAuth}
                />
            </BrowserRouter>
        );
    };

    describe('Share Functionality', () => {
        it('should copy URL to clipboard when share button is clicked', async () => {
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
                const titles = screen.getAllByText('Test Flyer Title');
                expect(titles[0]).toBeInTheDocument();
            });

            // Find and click share button in the header
            const shareButtons = screen.getAllByTitle('Share flyer');
            fireEvent.click(shareButtons[0]);

            // Verify clipboard was called with correctly formatted URL
            await waitFor(() => {
                expect(mockClipboard.writeText).toHaveBeenCalledWith(
                    expect.stringMatching(/^http:\/\/localhost:\d+\/ad\/test-ad-id$/)
                );
            });

            // Verify the URL doesn't have extra spaces
            const calledUrl = mockClipboard.writeText.mock.calls[0][0];
            expect(calledUrl).not.toMatch(/\s/); // No whitespace in URL
        });

        it('should show success toast with correct message', async () => {
            Object.defineProperty(global, 'navigator', {
                value: {
                    clipboard: mockClipboard,
                },
                writable: true,
                configurable: true,
            });

            renderAdDetail();

            await waitFor(() => {
                const titles = screen.getAllByText('Test Flyer Title');
                expect(titles[0]).toBeInTheDocument();
            });

            const shareButtons = screen.getAllByTitle('Share flyer');
            fireEvent.click(shareButtons[0]);

            await waitFor(() => {
                expect(toast.success).toHaveBeenCalledWith('Link to flyer copied to clipboard');
            });
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
                const titles = screen.getAllByText('Test Flyer Title');
                expect(titles[0]).toBeInTheDocument();
            });

            // Check for share button in header
            const shareButtons = screen.getAllByTitle('Share flyer');
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
                const titles = screen.getAllByText('Test Flyer Title');
                expect(titles[0]).toBeInTheDocument();
            });

            // Check for "Share Flyer" text in sidebar
            expect(screen.getByText('Share Flyer')).toBeInTheDocument();
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
                const titles = screen.getAllByText('Test Flyer Title');
                expect(titles[0]).toBeInTheDocument();
            });

            // Click the sidebar share button
            const sidebarShareButton = screen.getByText('Share Flyer');
            fireEvent.click(sidebarShareButton);

            await waitFor(() => {
                expect(mockClipboard.writeText).toHaveBeenCalled();
                expect(toast.success).toHaveBeenCalledWith('Link to flyer copied to clipboard');
            });
        });
    });

    describe('Layout Consistency', () => {
        // Tests to ensure skeleton and loaded states have consistent layout
        // to prevent "compressed layout" bug caused by missing w-full class

        it('should have w-full class on content container in loaded state', async () => {
            Object.defineProperty(global, 'navigator', {
                value: { clipboard: mockClipboard },
                writable: true,
                configurable: true,
            });

            const { container } = renderAdDetail();

            await waitFor(() => {
                expect(screen.getAllByText('Test Flyer Title')[0]).toBeInTheDocument();
            });

            // Find the content container (flex-1 with content-max-width)
            const contentContainer = container.querySelector('.content-max-width.mx-auto');
            expect(contentContainer).toBeInTheDocument();
            expect(contentContainer).toHaveClass('w-full');
        });

        it('should have w-full class on content container in skeleton state', () => {
            // Return undefined to trigger skeleton state
            (useQuery as any).mockReset();
            (useQuery as any).mockReturnValue(undefined);

            const { container } = render(
                <BrowserRouter>
                    <AdDetail
                        adId={'loading-id' as any}
                        onBack={mockOnBack}
                        onShowAuth={mockOnShowAuth}
                    />
                </BrowserRouter>
            );

            // Should show loading state
            expect(screen.getByText('Loading...')).toBeInTheDocument();

            // Find the content container in skeleton state (the one with flex-1, not the header)
            const contentContainer = container.querySelector('.flex-1.content-max-width.mx-auto');
            expect(contentContainer).toBeInTheDocument();
            expect(contentContainer).toHaveClass('w-full');
        });
    });
});

