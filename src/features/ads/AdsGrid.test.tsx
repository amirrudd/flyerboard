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
        // Check for the skeleton loader (shimmer)
        const skeletons = document.getElementsByClassName('shimmer');
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

    it('should display "Free" for ads with price 0 and formatted prices for others', () => {
        const adsWithFree = [
            {
                _id: 'ad1' as Id<'ads'>,
                title: 'Free Item',
                description: 'Take it away',
                price: 0,
                location: 'Sydney',
                categoryId: 'cat1' as Id<'categories'>,
                images: ['img1.jpg'],
                userId: 'user1' as Id<'users'>,
                isActive: true,
                views: 5,
            },
            {
                _id: 'ad2' as Id<'ads'>,
                title: 'Paid Item',
                description: 'For sale',
                price: 1500,
                location: 'Melbourne',
                categoryId: 'cat2' as Id<'categories'>,
                images: ['img2.jpg'],
                userId: 'user2' as Id<'users'>,
                isActive: true,
                views: 10,
            },
        ];

        render(
            <AdsGrid
                ads={adsWithFree}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
            />
        );

        expect(screen.getByText('Free')).toBeInTheDocument();
        expect(screen.getByText('$1,500')).toBeInTheDocument();
    });

    // ============================================================================
    // LISTING TYPE DISPLAY TESTS (Exchange Feature)
    // ============================================================================

    it('should display "Open to Trade" for exchange-only listings', () => {
        const exchangeAds = [{
            _id: 'ad1' as Id<'ads'>,
            title: 'Trading Cards',
            description: 'Looking to trade',
            listingType: 'exchange' as const,
            location: 'Sydney',
            categoryId: 'cat1' as Id<'categories'>,
            images: ['img1.jpg'],
            userId: 'user1' as Id<'users'>,
            isActive: true,
            views: 20,
        }];

        render(
            <AdsGrid
                ads={exchangeAds}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
            />
        );

        expect(screen.getByText('Open to Trade')).toBeInTheDocument();
        // Should NOT show a price
        expect(screen.queryByText(/\$/)).not.toBeInTheDocument();
    });

    it('should display price with "Trade" badge for "both" listing type', () => {
        const bothAds = [{
            _id: 'ad1' as Id<'ads'>,
            title: 'Sell or Trade Item',
            description: 'Accept cash or trades',
            listingType: 'both' as const,
            price: 250,
            location: 'Melbourne',
            categoryId: 'cat1' as Id<'categories'>,
            images: ['img1.jpg'],
            userId: 'user1' as Id<'users'>,
            isActive: true,
            views: 30,
        }];

        render(
            <AdsGrid
                ads={bothAds}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
            />
        );

        expect(screen.getByText('$250')).toBeInTheDocument();
        expect(screen.getByText('• Trade')).toBeInTheDocument();
    });

    it('should display regular price for sale-only listings', () => {
        const saleAds = [{
            _id: 'ad1' as Id<'ads'>,
            title: 'For Sale Item',
            description: 'Cash only',
            listingType: 'sale' as const,
            price: 100,
            location: 'Brisbane',
            categoryId: 'cat1' as Id<'categories'>,
            images: ['img1.jpg'],
            userId: 'user1' as Id<'users'>,
            isActive: true,
            views: 15,
        }];

        render(
            <AdsGrid
                ads={saleAds}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
            />
        );

        expect(screen.getByText('$100')).toBeInTheDocument();
        // Should NOT show trade badge
        expect(screen.queryByText('• Trade')).not.toBeInTheDocument();
        expect(screen.queryByText('Open to Trade')).not.toBeInTheDocument();
    });

    it('should handle legacy ads without listingType as sale', () => {
        // Legacy ads without listingType should display as regular sale
        const legacyAds = [{
            _id: 'ad1' as Id<'ads'>,
            title: 'Legacy Ad',
            description: 'Old format',
            price: 75,
            location: 'Perth',
            categoryId: 'cat1' as Id<'categories'>,
            images: ['img1.jpg'],
            userId: 'user1' as Id<'users'>,
            isActive: true,
            views: 8,
            // No listingType field
        }];

        render(
            <AdsGrid
                ads={legacyAds}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
            />
        );

        expect(screen.getByText('$75')).toBeInTheDocument();
        expect(screen.queryByText('• Trade')).not.toBeInTheDocument();
    });
});
