import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AdsGrid } from './AdsGrid';
import { Id } from '../../../convex/_generated/dataModel';

// Mock ImageDisplay component
vi.mock('../../components/ui/ImageDisplay', () => ({
    ImageDisplay: ({ src, alt }: { src: string; alt: string }) => (
        <img src={src} alt={alt} data-testid="ad-image" />
    ),
}));

const mockCategories = [
    { _id: 'cat1' as Id<'categories'>, name: 'Electronics', slug: 'electronics' },
    { _id: 'cat2' as Id<'categories'>, name: 'Vehicles', slug: 'vehicles' },
];

const mockAds = [
    {
        _id: 'ad1' as Id<'ads'>,
        title: 'iPhone 13',
        description: 'Good condition',
        price: 500,
        location: 'Sydney',
        categoryId: 'cat1' as Id<'categories'>,
        images: ['img1.jpg'],
        userId: 'user1' as Id<'users'>,
        isActive: true,
        views: 10,
    },
    {
        _id: 'ad2' as Id<'ads'>,
        title: 'Toyota Camry',
        description: 'Low mileage',
        price: 15000,
        location: 'Melbourne',
        categoryId: 'cat2' as Id<'categories'>,
        images: ['img2.jpg'],
        userId: 'user2' as Id<'users'>,
        isActive: true,
        views: 50,
    },
];

describe('AdsGrid', () => {
    it('should render loading skeleton when isLoading is true', () => {
        render(
            <AdsGrid
                ads={undefined}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
                isLoading={true}
            />
        );
        // Check for the skeleton loader (animate-pulse)
        const skeletons = document.getElementsByClassName('animate-pulse');
        expect(skeletons.length).toBeGreaterThan(0);
    });

    it('should render ads when data is provided', () => {
        render(
            <AdsGrid
                ads={mockAds}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
            />
        );

        expect(screen.getByText('iPhone 13')).toBeInTheDocument();
        expect(screen.getByText('Toyota Camry')).toBeInTheDocument();
        expect(screen.getByText('2 flyers')).toBeInTheDocument();
    });

    it('should render category name when selected', () => {
        render(
            <AdsGrid
                ads={mockAds}
                categories={mockCategories}
                selectedCategory={'cat1' as Id<'categories'>}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
            />
        );

        expect(screen.getByText('Electronics Flyers')).toBeInTheDocument();
    });

    it('should call onAdClick when an ad is clicked', () => {
        const handleAdClick = vi.fn();
        render(
            <AdsGrid
                ads={mockAds}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={handleAdClick}
            />
        );

        fireEvent.click(screen.getByText('iPhone 13'));
        expect(handleAdClick).toHaveBeenCalledWith(mockAds[0]);
    });

    it('should render empty state when no ads found', () => {
        render(
            <AdsGrid
                ads={[]}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
            />
        );

        expect(screen.getByText('No Flyers Found')).toBeInTheDocument();
    });
});
