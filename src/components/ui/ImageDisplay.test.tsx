import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ImageDisplay } from './ImageDisplay';
import { useQuery } from 'convex/react';

// Mock convex hooks
vi.mock('convex/react', () => ({
    useQuery: vi.fn(),
}));

describe('ImageDisplay', () => {
    it('should render image with direct URL', () => {
        const src = 'https://example.com/image.jpg';
        render(<ImageDisplay src={src} alt="Test Image" />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', src);
        expect(img).toHaveAttribute('alt', 'Test Image');
    });

    it('should render image with storage ID', () => {
        const storageId = 'storage-id';
        const storageUrl = 'https://example.com/storage-image.jpg';

        // Mock useQuery to return the storage URL
        vi.mocked(useQuery).mockReturnValue(storageUrl);

        render(<ImageDisplay src={storageId} alt="Storage Image" />);

        const img = screen.getByRole('img');
        expect(img).toHaveAttribute('src', storageUrl);
    });

    it('should use fallback on error', () => {
        const src = 'https://example.com/broken.jpg';
        render(<ImageDisplay src={src} alt="Broken Image" fallback="fallback.jpg" />);

        const img = screen.getByRole('img');
        fireEvent.error(img);

        expect(img).toHaveAttribute('src', 'fallback.jpg');
    });

    it('should use default fallback if none provided', () => {
        const src = 'https://example.com/broken.jpg';
        render(<ImageDisplay src={src} alt="Broken Image" />);

        const img = screen.getByRole('img');
        fireEvent.error(img);

        expect(img).toHaveAttribute('src', expect.stringContaining('unsplash'));
    });
});
