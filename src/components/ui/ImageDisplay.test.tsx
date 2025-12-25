import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ImageDisplay } from './ImageDisplay';
import { useQuery } from 'convex/react';
import React from 'react';

// Mock convex hooks
vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
}));

// Mock react-lazy-load-image-component
vi.mock('react-lazy-load-image-component', () => ({
    LazyLoadImage: ({ src, alt, className, effect, placeholder, onError }: any) => {
        // Render placeholder initially, then img on load
        const [loaded, setLoaded] = React.useState(false);

        if (!loaded) {
            return (
                <div data-testid="lazy-load-wrapper">
                    {placeholder}
                    <img
                        src={src}
                        alt={alt}
                        className={className}
                        data-effect={effect}
                        onLoad={() => setLoaded(true)}
                        onError={onError}
                        style={{ display: 'none' }}
                    />
                </div>
            );
        }

        return (
            <img
                src={src}
                alt={alt}
                className={className}
                data-effect={effect}
                onError={onError}
            />
        );
    },
}));

// Mock lucide-react
vi.mock('lucide-react', () => ({
    Image: ({ className }: any) => <div data-testid="image-placeholder-icon" className={className} />,
}));

describe('ImageDisplay', () => {
    beforeEach(() => {
        vi.resetAllMocks();
    });

    it('should render LazyLoadImage with direct URL and fade effect', () => {
        const src = 'https://example.com/image.jpg';
        render(<ImageDisplay src={src} alt="Test Image" className="test-class" />);

        const img = screen.getByRole('img', { hidden: true });
        expect(img).toHaveAttribute('src', src);
        expect(img).toHaveAttribute('alt', 'Test Image');
        expect(img).toHaveAttribute('data-effect', 'opacity');
        expect(img).toHaveClass('test-class');
    });

    it('should show skeleton while fetching storage URL', () => {
        const storageId = 'storage-id';

        // Mock useQuery to return undefined (still loading)
        vi.mocked(useQuery).mockReturnValue(undefined);

        render(<ImageDisplay src={storageId} alt="Storage Image" className="test-class" />);

        // Should show skeleton while fetching storage URL
        const skeleton = screen.getByLabelText('Loading image');
        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('shimmer', 'bg-gray-200', 'test-class');
    });

    it('should render LazyLoadImage after storage URL is fetched', () => {
        const storageId = 'storage-id';
        const storageUrl = 'https://example.com/storage-image.jpg';

        // Mock useQuery to return the storage URL
        vi.mocked(useQuery).mockReturnValue(storageUrl);

        render(<ImageDisplay src={storageId} alt="Storage Image" />);

        // Should show LazyLoadImage with storage URL
        const img = screen.getByRole('img', { hidden: true });
        expect(img).toHaveAttribute('src', storageUrl);
        expect(img).toHaveAttribute('alt', 'Storage Image');
        expect(img).toHaveAttribute('data-effect', 'opacity');
    });

    it('should show placeholder while image is loading', () => {
        const src = 'https://example.com/image.jpg';

        render(<ImageDisplay src={src} alt="Test Image" className="test-class" />);

        // Should show placeholder (skeleton) while image loads
        const wrapper = screen.getByTestId('lazy-load-wrapper');
        expect(wrapper).toBeInTheDocument();

        const skeleton = screen.getByLabelText('Loading image');
        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('shimmer', 'bg-gray-200', 'test-class');
    });

    it('should call onError callback when image fails to load', async () => {
        const src = 'https://example.com/broken.jpg';
        const mockOnError = vi.fn();

        render(<ImageDisplay src={src} alt="Broken Image" onError={mockOnError} />);

        const img = screen.getByRole('img', { hidden: true });

        // Simulate error
        fireEvent.error(img);

        // Should call onError callback
        await waitFor(() => {
            expect(mockOnError).toHaveBeenCalled();
        });
    });

    it('should work without onError callback', async () => {
        const src = 'https://example.com/broken.jpg';

        // Should not throw when onError is not provided
        render(<ImageDisplay src={src} alt="Broken Image" />);

        const img = screen.getByRole('img', { hidden: true });

        // Simulate error - should not throw
        expect(() => fireEvent.error(img)).not.toThrow();
    });

    it('should show skeleton only while URL is being fetched', () => {
        const storageId = 'storage-id';

        // Initially return undefined (loading)
        vi.mocked(useQuery).mockReturnValue(undefined);

        const { rerender } = render(<ImageDisplay src={storageId} alt="Test Image" />);

        // Should show skeleton while URL is undefined
        expect(screen.getByLabelText('Loading image')).toBeInTheDocument();

        // Now return the URL
        vi.mocked(useQuery).mockReturnValue('https://example.com/image.jpg');

        rerender(<ImageDisplay src={storageId} alt="Test Image" />);

        // Should show LazyLoadImage with placeholder
        expect(screen.getByTestId('lazy-load-wrapper')).toBeInTheDocument();
        expect(screen.getByRole('img', { hidden: true })).toBeInTheDocument();
    });

    it('should apply className to skeleton, placeholder, and image', () => {
        const src = 'https://example.com/image.jpg';
        const className = 'custom-class';

        render(<ImageDisplay src={src} alt="Test" className={className} />);

        // Placeholder skeleton should have className
        const skeleton = screen.getByLabelText('Loading image');
        expect(skeleton).toHaveClass(className);

        // Image should have className
        const img = screen.getByRole('img', { hidden: true });
        expect(img).toHaveClass(className);
    });

    it('should show skeleton for R2 references that haven\'t been converted yet', () => {
        const r2Reference = 'r2:flyers/test-id/image.jpg';

        // Mock useQuery to return undefined (still converting)
        vi.mocked(useQuery).mockReturnValue(undefined);

        render(<ImageDisplay src={r2Reference} alt="R2 Image" className="test-class" />);

        // Should show skeleton while R2 reference is being converted
        const skeleton = screen.getByLabelText('Loading image');
        expect(skeleton).toBeInTheDocument();
        expect(skeleton).toHaveClass('shimmer', 'bg-gray-200', 'test-class');
    });

    it('should show skeleton for R2 references even if imageUrl is still loading', () => {
        const r2Reference = 'r2:flyers/test-id/image.jpg';

        // Mock useQuery to return undefined
        vi.mocked(useQuery).mockReturnValue(undefined);

        render(<ImageDisplay imageRef={r2Reference} alt="R2 Image" />);

        // Should show skeleton, not attempt to load r2: URL
        const skeleton = screen.getByLabelText('Loading image');
        expect(skeleton).toBeInTheDocument();

        // Should NOT try to render an image with r2: URL
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should show error placeholder when image fails to load', async () => {
        const src = 'https://example.com/broken.jpg';

        render(<ImageDisplay src={src} alt="Broken Image" className="test-class" />);

        const img = screen.getByRole('img', { hidden: true });

        // Simulate error
        fireEvent.error(img);

        // Should show error placeholder with icon
        await waitFor(() => {
            const placeholder = screen.getByTestId('image-placeholder-icon');
            expect(placeholder).toBeInTheDocument();
            expect(placeholder).toHaveClass('w-1/3', 'h-1/3', 'text-gray-300');
        });

        // Should no longer show the image
        expect(screen.queryByRole('img')).not.toBeInTheDocument();
    });

    it('should call onError callback and show placeholder when image fails', async () => {
        const src = 'https://example.com/broken.jpg';
        const mockOnError = vi.fn();

        render(<ImageDisplay src={src} alt="Broken Image" onError={mockOnError} />);

        const img = screen.getByRole('img', { hidden: true });

        // Simulate error
        fireEvent.error(img);

        // Should call onError callback
        await waitFor(() => {
            expect(mockOnError).toHaveBeenCalled();
        });

        // Should show error placeholder
        await waitFor(() => {
            expect(screen.getByTestId('image-placeholder-icon')).toBeInTheDocument();
        });
    });
});
// Total tests: 13
