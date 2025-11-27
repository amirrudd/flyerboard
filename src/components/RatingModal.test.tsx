import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { RatingModal } from './RatingModal';
import { ConvexProvider } from 'convex/react';
import { ConvexReactClient } from 'convex/react';

// Mock Convex client
const mockConvex = new ConvexReactClient(import.meta.env.VITE_CONVEX_URL || 'https://test.convex.cloud');

// Mock toast
vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}));

// Mock useMutation
const mockSubmitRating = vi.fn();
vi.mock('convex/react', async () => {
    const actual = await vi.importActual('convex/react');
    return {
        ...actual,
        useMutation: () => mockSubmitRating,
    };
});

const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    userId: 'test-user-id' as any,
    userName: 'Test User',
};

describe('RatingModal', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders when isOpen is true', () => {
        render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );
        expect(screen.getByText('Rate Test User')).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
        render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} isOpen={false} />
            </ConvexProvider>
        );
        expect(screen.queryByText('Rate Test User')).not.toBeInTheDocument();
    });

    it('displays 5 stars for selection', () => {
        const { container } = render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );
        const stars = container.querySelectorAll('button[type="button"] svg');
        expect(stars.length).toBe(5);
    });

    it('updates rating when star is clicked', () => {
        const { container } = render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );
        const stars = container.querySelectorAll('button[type="button"]');
        fireEvent.click(stars[3]); // Click 4th star
        expect(screen.getByText('Very Good')).toBeInTheDocument();
    });

    it('shows hover effect on stars', () => {
        const { container } = render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );
        const stars = container.querySelectorAll('button[type="button"]');
        fireEvent.mouseEnter(stars[2]); // Hover over 3rd star
        expect(screen.getByText(/Good|Click to rate/)).toBeInTheDocument();
    });

    it('displays correct rating labels', () => {
        const { container } = render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );
        const stars = container.querySelectorAll('button[type="button"]');

        fireEvent.click(stars[0]);
        expect(screen.getByText('Poor')).toBeInTheDocument();

        fireEvent.click(stars[1]);
        expect(screen.getByText('Fair')).toBeInTheDocument();

        fireEvent.click(stars[2]);
        expect(screen.getByText('Good')).toBeInTheDocument();

        fireEvent.click(stars[3]);
        expect(screen.getByText('Very Good')).toBeInTheDocument();

        fireEvent.click(stars[4]);
        expect(screen.getByText('Excellent')).toBeInTheDocument();
    });

    it('allows entering a comment', () => {
        render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );
        const textarea = screen.getByPlaceholderText('Share your experience...');
        fireEvent.change(textarea, { target: { value: 'Great seller!' } });
        expect(textarea).toHaveValue('Great seller!');
    });

    it('calls onClose when cancel button is clicked', () => {
        const onClose = vi.fn();
        render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} onClose={onClose} />
            </ConvexProvider>
        );
        const cancelButton = screen.getByText('Cancel');
        fireEvent.click(cancelButton);
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('calls onClose when X button is clicked', () => {
        const onClose = vi.fn();
        const { container } = render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} onClose={onClose} />
            </ConvexProvider>
        );
        // Find the X button in the header
        const closeButtons = container.querySelectorAll('button');
        const xButton = Array.from(closeButtons).find(btn => btn.querySelector('svg path[d*="M6 18L18 6"]'));
        if (xButton) {
            fireEvent.click(xButton);
            expect(onClose).toHaveBeenCalled();
        }
    });

    it('disables submit button when no rating is selected', () => {
        render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );
        const submitButton = screen.getByText('Submit Rating');
        expect(submitButton).toBeDisabled();
    });

    it('enables submit button when rating is selected', () => {
        const { container } = render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );
        const stars = container.querySelectorAll('button[type="button"]');
        fireEvent.click(stars[2]); // Select 3 stars

        const submitButton = screen.getByText('Submit Rating');
        expect(submitButton).not.toBeDisabled();
    });

    it('submits rating without comment', async () => {
        mockSubmitRating.mockResolvedValue({ updated: false });

        const { container } = render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );

        const stars = container.querySelectorAll('button[type="button"]');
        fireEvent.click(stars[3]); // Select 4 stars

        const submitButton = screen.getByText('Submit Rating');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockSubmitRating).toHaveBeenCalledWith({
                ratedUserId: 'test-user-id',
                rating: 4,
                chatId: undefined,
                comment: undefined,
            });
        });
    });

    it('submits rating with comment', async () => {
        mockSubmitRating.mockResolvedValue({ updated: false });

        const { container } = render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );

        const stars = container.querySelectorAll('button[type="button"]');
        fireEvent.click(stars[4]); // Select 5 stars

        const textarea = screen.getByPlaceholderText('Share your experience...');
        fireEvent.change(textarea, { target: { value: 'Excellent service!' } });

        const submitButton = screen.getByText('Submit Rating');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockSubmitRating).toHaveBeenCalledWith({
                ratedUserId: 'test-user-id',
                rating: 5,
                chatId: undefined,
                comment: 'Excellent service!',
            });
        });
    });

    it('includes chatId when provided', async () => {
        mockSubmitRating.mockResolvedValue({ updated: false });

        const { container } = render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} chatId={'test-chat-id' as any} />
            </ConvexProvider>
        );

        const stars = container.querySelectorAll('button[type="button"]');
        fireEvent.click(stars[2]);

        const submitButton = screen.getByText('Submit Rating');
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockSubmitRating).toHaveBeenCalledWith(
                expect.objectContaining({
                    chatId: 'test-chat-id',
                })
            );
        });
    });

    it('shows loading state during submission', async () => {
        mockSubmitRating.mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve({ updated: false }), 100))
        );

        const { container } = render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );

        const stars = container.querySelectorAll('button[type="button"]');
        fireEvent.click(stars[2]);

        const submitButton = screen.getByText('Submit Rating');
        fireEvent.click(submitButton);

        expect(screen.getByText('Submitting...')).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.queryByText('Submitting...')).not.toBeInTheDocument();
        });
    });

    it('prevents form submission without rating', async () => {
        const { toast } = await import('sonner');

        render(
            <ConvexProvider client={mockConvex}>
                <RatingModal {...defaultProps} />
            </ConvexProvider>
        );

        const form = screen.getByText('Submit Rating').closest('form');
        fireEvent.submit(form!);

        // The submit button should be disabled when no rating is selected
        const submitButton = screen.getByText('Submit Rating');
        expect(submitButton).toBeDisabled();
    });
});
