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
        bumpedAt: 99000,
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
        bumpedAt: 98000,
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
                bumpedAt: 97000,
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
                bumpedAt: 96000,
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
            bumpedAt: 95000,
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
            bumpedAt: 94000,
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
            bumpedAt: 93000,
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
            bumpedAt: 92000,
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

// ============================================================================
// MOVING SALE FEED (v3.1) — sale items look like normal listings; the whole-Sale
// card is the only feed differentiator.
// ============================================================================

describe('AdsGrid - moving sale feed (v3.1)', () => {
    const saleAd = {
        _id: 'adSale' as Id<'ads'>,
        title: 'Sale Sofa',
        description: 'An ad that belongs to a sale',
        listingType: 'sale' as const,
        price: 120,
        location: 'Bondi',
        categoryId: 'cat1' as Id<'categories'>,
        images: ['saleimg.jpg'],
        userId: 'user1' as Id<'users'>,
        isActive: true,
        views: 4,
        bumpedAt: 91000,
        saleEventId: 'sale1' as Id<'saleEvents'>,
    };

    const saleCard = {
        _id: 'sale1',
        slug: 'janes-sale',
        title: "Jane's Moving Sale",
        suburb: 'Carlton, VIC',
        createdAt: 1000,
        itemCount: 9,
        photoCount: 9,
        minPrice: 15,
        covers: ['c1.jpg', 'c2.jpg', 'c3.jpg'],
    };

    it('renders a sale item like a normal listing (no badge, no sale footer)', () => {
        render(
            <AdsGrid
                ads={[saleAd]}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
            />
        );
        // Normal view-count footer, no "In a moving sale" / "Moving Sale" badge.
        expect(screen.getByText(/4 views/i)).toBeInTheDocument();
        expect(screen.queryByText(/in a moving sale/i)).not.toBeInTheDocument();
        expect(screen.queryByText(/moving sale/i)).not.toBeInTheDocument();
    });

    it('renders a whole-Sale card from saleCards (badge, price, item count)', () => {
        render(
            <AdsGrid
                ads={[]}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
                saleCards={[saleCard]}
            />
        );
        expect(screen.getByText("Jane's Moving Sale")).toBeInTheDocument();
        expect(screen.getByText(/from \$15/i)).toBeInTheDocument();
        expect(screen.getByText(/9 items/i)).toBeInTheDocument();
    });

    it('clicking the Sale card calls onSaleClick with the slug', () => {
        const onSaleClick = vi.fn();
        render(
            <AdsGrid
                ads={[]}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
                onSaleClick={onSaleClick}
                saleCards={[saleCard]}
            />
        );
        fireEvent.click(screen.getByText("Jane's Moving Sale"));
        expect(onSaleClick).toHaveBeenCalledWith('janes-sale');
    });
});

// ============================================================================
// BUNDLE LISTING FEED — the whole-Bundle card is a feed differentiator,
// mirroring the whole-Sale card above.
// ============================================================================

describe('AdsGrid - bundle listing feed', () => {
    const bundleCard = {
        _id: 'bundle1',
        label: 'Kitchen Starter Bundle',
        createdAt: 2000,
        itemCount: 3,
        location: 'Fitzroy, VIC',
        bundlePrice: 80,
        separatelyTotal: 120,
        savings: 40,
        covers: ['b1.jpg', 'b2.jpg', 'b3.jpg'],
        adIds: ['adB1', 'adB2', 'adB3'],
    };

    it('renders a whole-Bundle card from bundleCards (badge, save pill, price, item count)', () => {
        render(
            <AdsGrid
                ads={[]}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
                bundleCards={[bundleCard]}
            />
        );
        expect(screen.getByText('Kitchen Starter Bundle')).toBeInTheDocument();
        expect(screen.getByText('Bundle')).toBeInTheDocument();
        expect(screen.getByText('Save $40')).toBeInTheDocument();
        expect(screen.getByText('$80')).toBeInTheDocument();
        expect(screen.getByText('$120')).toBeInTheDocument();
        expect(screen.getByText('3 items')).toBeInTheDocument();
    });

    it('clicking the Bundle card calls onBundleClick with the card', () => {
        const onBundleClick = vi.fn();
        render(
            <AdsGrid
                ads={[]}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
                onBundleClick={onBundleClick}
                bundleCards={[bundleCard]}
            />
        );
        fireEvent.click(screen.getByText('Kitchen Starter Bundle'));
        expect(onBundleClick).toHaveBeenCalledWith(bundleCard);
    });
});

// ============================================================================
// BOOST (Phase 2) — feed sorts on bumpedAt; boost arrivals get the pin-drop
// ring pulse and deliberately NO "New" badge.
// ============================================================================

describe('AdsGrid - boost (bumpedAt feed order + arrival treatment)', () => {
    const baseAd = {
        description: 'desc',
        listingType: 'sale' as const,
        location: 'Sydney',
        categoryId: 'cat1' as Id<'categories'>,
        images: ['img.jpg'],
        userId: 'user1' as Id<'users'>,
        isActive: true,
    };
    const oldButBoosted = {
        ...baseAd,
        _id: 'adBoosted' as Id<'ads'>,
        _creationTime: 1000, // ancient listing…
        bumpedAt: 90000,     // …boosted to the top
        title: 'Boosted Couch',
        price: 50,
        views: 300,
    };
    const newerUnboosted = {
        ...baseAd,
        _id: 'adNewer' as Id<'ads'>,
        _creationTime: 80000,
        bumpedAt: 80000,
        title: 'Newer Lamp',
        price: 20,
        views: 2,
    };

    it('sorts the feed by bumpedAt, not creation time (boosted ad leads)', () => {
        render(
            <AdsGrid
                ads={[newerUnboosted, oldButBoosted]}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
            />
        );
        const titles = screen
            .getAllByRole('heading', { level: 2 })
            .map((h) => h.textContent);
        expect(titles).toEqual(['Boosted Couch', 'Newer Lamp']);
    });

    it('renders the ring pulse for a boost arrival keyed `${_id}:${bumpedAt}`, with no "New" badge', () => {
        render(
            <AdsGrid
                ads={[oldButBoosted, newerUnboosted]}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
                boostedAdKeys={new Set(['adBoosted:90000'])}
            />
        );
        expect(screen.getByTestId('boost-ring-pulse')).toBeInTheDocument();
        // Boosted ads are NOT new — the badge would contradict the detail
        // page's honest "Posted X ago".
        expect(screen.queryByText('New')).not.toBeInTheDocument();
    });

    it('does not render the ring pulse for a stale key (older bumpedAt generation)', () => {
        render(
            <AdsGrid
                ads={[oldButBoosted]}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
                boostedAdKeys={new Set(['adBoosted:1000'])}
            />
        );
        expect(screen.queryByTestId('boost-ring-pulse')).not.toBeInTheDocument();
    });

    it('renders no ring pulse when there are no boost arrivals; brand-new ads keep the "New" badge', () => {
        render(
            <AdsGrid
                ads={[oldButBoosted, newerUnboosted]}
                categories={mockCategories}
                selectedCategory={null}
                sidebarCollapsed={false}
                onAdClick={vi.fn()}
                newAdIds={new Set(['adNewer'])}
            />
        );
        expect(screen.queryByTestId('boost-ring-pulse')).not.toBeInTheDocument();
        expect(screen.getByText('New')).toBeInTheDocument();
    });
});
