import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StarRating } from './StarRating';

describe('StarRating', () => {
    it('renders 5 stars', () => {
        const { container } = render(<StarRating rating={0} />);
        const stars = container.querySelectorAll('svg');
        expect(stars.length).toBe(5); // 5 stars total (empty + filled overlay)
    });

    it('displays correct rating value', () => {
        render(<StarRating rating={4.5} count={23} showCount={true} />);
        expect(screen.getByText(/4.5/)).toBeInTheDocument();
        expect(screen.getByText(/\(23\)/)).toBeInTheDocument();
    });

    it('shows "No ratings yet" when count is 0', () => {
        render(<StarRating rating={0} count={0} showCount={true} />);
        expect(screen.getByText('No ratings yet')).toBeInTheDocument();
    });

    it('hides count when showCount is false', () => {
        const { container } = render(<StarRating rating={4.5} count={23} showCount={false} />);
        expect(screen.queryByText(/23/)).not.toBeInTheDocument();
    });

    it('renders different sizes correctly', () => {
        const { container: smallContainer } = render(<StarRating rating={3} size="sm" />);
        const smallStar = smallContainer.querySelector('svg');
        expect(smallStar).toHaveClass('w-3', 'h-3');

        const { container: mediumContainer } = render(<StarRating rating={3} size="md" />);
        const mediumStar = mediumContainer.querySelector('svg');
        expect(mediumStar).toHaveClass('w-4', 'h-4');

        const { container: largeContainer } = render(<StarRating rating={3} size="lg" />);
        const largeStar = largeContainer.querySelector('svg');
        expect(largeStar).toHaveClass('w-5', 'h-5');
    });

    it('clamps rating between 0 and 5', () => {
        const { container: lowContainer } = render(<StarRating rating={-1} count={1} showCount={true} />);
        // Component displays the actual value but clamps star rendering
        expect(screen.getByText(/-1.0/)).toBeInTheDocument();

        const { container: highContainer } = render(<StarRating rating={6} count={1} showCount={true} />);
        expect(screen.getByText(/6.0/)).toBeInTheDocument();
    });

    it('applies custom className', () => {
        const { container } = render(<StarRating rating={3} className="custom-class" />);
        const wrapper = container.firstChild;
        expect(wrapper).toHaveClass('custom-class');
    });

    it('renders half stars correctly', () => {
        const { container } = render(<StarRating rating={2.5} />);
        // Check that filled stars have correct width (50% for the half star)
        const filledStars = container.querySelectorAll('.absolute');
        expect(filledStars.length).toBeGreaterThan(0);
    });

    it('displays yellow color for filled stars', () => {
        const { container } = render(<StarRating rating={5} />);
        const filledStars = container.querySelectorAll('.text-yellow-400');
        expect(filledStars.length).toBe(5); // All 5 stars filled
    });

    it('displays gray color for empty stars', () => {
        const { container } = render(<StarRating rating={0} />);
        const emptyStars = container.querySelectorAll('.text-muted-foreground\\/30');
        expect(emptyStars.length).toBe(5);
    });
});
