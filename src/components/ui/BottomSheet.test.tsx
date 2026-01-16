import { render, screen, fireEvent } from '@testing-library/react';
import { BottomSheet } from './BottomSheet';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('BottomSheet', () => {
    const mockOnClose = vi.fn();
    const defaultProps = {
        isOpen: true,
        onClose: mockOnClose,
        title: 'Test Sheet',
        children: <div>Test Content</div>,
    };

    beforeEach(() => {
        mockOnClose.mockClear();
    });

    afterEach(() => {
        // Clean up body overflow style
        document.body.style.overflow = '';
    });

    it('should render when isOpen is true', () => {
        render(<BottomSheet {...defaultProps} />);

        expect(screen.getByText('Test Sheet')).toBeInTheDocument();
        expect(screen.getByText('Test Content')).toBeInTheDocument();
    });

    it('should not render when isOpen is false', () => {
        render(<BottomSheet {...defaultProps} isOpen={false} />);

        expect(screen.queryByText('Test Sheet')).not.toBeInTheDocument();
        expect(screen.queryByText('Test Content')).not.toBeInTheDocument();
    });

    it('should call onClose when backdrop is clicked', () => {
        render(<BottomSheet {...defaultProps} />);

        const backdrop = document.querySelector('.bg-black\\/50');
        expect(backdrop).toBeInTheDocument();

        fireEvent.click(backdrop!);
        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when close button is clicked', () => {
        render(<BottomSheet {...defaultProps} />);

        const closeButton = screen.getByRole('button', { name: '' });
        fireEvent.click(closeButton);

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when Escape key is pressed', () => {
        render(<BottomSheet {...defaultProps} />);

        fireEvent.keyDown(document, { key: 'Escape' });

        expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it('should not call onClose when other keys are pressed', () => {
        render(<BottomSheet {...defaultProps} />);

        fireEvent.keyDown(document, { key: 'Enter' });
        fireEvent.keyDown(document, { key: 'a' });

        expect(mockOnClose).not.toHaveBeenCalled();
    });

    it('should prevent body scroll when open', () => {
        const { rerender } = render(<BottomSheet {...defaultProps} />);

        expect(document.body.style.overflow).toBe('hidden');

        rerender(<BottomSheet {...defaultProps} isOpen={false} />);

        expect(document.body.style.overflow).toBe('');
    });

    it('should restore body scroll on unmount', () => {
        const { unmount } = render(<BottomSheet {...defaultProps} />);

        expect(document.body.style.overflow).toBe('hidden');

        unmount();

        expect(document.body.style.overflow).toBe('');
    });

    it('should render with handle bar', () => {
        render(<BottomSheet {...defaultProps} />);

        const handleBar = document.querySelector('.w-12.h-1\\.5.bg-muted.rounded-full');
        expect(handleBar).toBeInTheDocument();
    });

    it('should render title correctly', () => {
        render(<BottomSheet {...defaultProps} title="Custom Title" />);

        expect(screen.getByText('Custom Title')).toBeInTheDocument();
    });

    it('should render children correctly', () => {
        render(
            <BottomSheet {...defaultProps}>
                <div data-testid="custom-child">Custom Child Content</div>
            </BottomSheet>
        );

        expect(screen.getByTestId('custom-child')).toBeInTheDocument();
        expect(screen.getByText('Custom Child Content')).toBeInTheDocument();
    });

    it('should only be visible on mobile (lg:hidden)', () => {
        render(<BottomSheet {...defaultProps} />);

        const container = document.querySelector('.lg\\:hidden');
        expect(container).toBeInTheDocument();
    });

    it('should have high z-index for proper stacking', () => {
        render(<BottomSheet {...defaultProps} />);

        const container = document.querySelector('.z-\\[100\\]');
        expect(container).toBeInTheDocument();
    });
});
