import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BundleBanner } from './BundleBanner';

// Mock convex's useQuery (ImageDisplay depends on it) and ImageDisplay itself
// so we don't need a real Convex client in this presentational-component test.
vi.mock('convex/react', () => ({
  useQuery: vi.fn(() => undefined),
}));

vi.mock('../../components/ui/ImageDisplay', () => ({
  ImageDisplay: ({ alt }: { alt: string }) => <img alt={alt} src="mock-image.jpg" />,
}));

describe('BundleBanner', () => {
  const currentItem = {
    adId: 'ad-current',
    title: 'Sofa',
    image: 'r2:flyers/ad-current/sofa.jpg',
    price: 350,
    isCurrent: true,
  };
  const otherItem = {
    adId: 'ad-other',
    title: 'Dining Table',
    image: 'r2:flyers/ad-other/table.jpg',
    price: 280,
    isCurrent: false,
  };

  const baseProps = {
    bundleId: 'bundle-1',
    label: 'Living room set',
    bundlePrice: 530,
    separatelyTotal: 630,
    savings: 100,
    savingsPct: 16,
    itemCount: 2,
    items: [currentItem, otherItem],
    onItemClick: vi.fn(),
  };

  it('renders the heading', () => {
    render(<BundleBanner {...baseProps} />);
    expect(screen.getByText('Available as a bundle')).toBeInTheDocument();
  });

  it('renders both item titles/thumbnails', () => {
    render(<BundleBanner {...baseProps} />);
    // The other item's title appears in the subline and as thumbnail alt/title text.
    expect(screen.getAllByText(/Dining Table/).length).toBeGreaterThan(0);
    expect(screen.getByAltText('Dining Table')).toBeInTheDocument();
    // The current item's thumbnail is rendered too (alt is empty, so query by title attr container).
    expect(screen.getByLabelText(/Sofa \(you're viewing this item\)/)).toBeInTheDocument();
  });

  it('renders bundle price and separately total', () => {
    render(<BundleBanner {...baseProps} />);
    expect(screen.getByText('$530', { exact: false })).toBeInTheDocument();
    expect(screen.getByText(/vs \$630 separately/)).toBeInTheDocument();
  });

  it('renders the savings percentage chip', () => {
    render(<BundleBanner {...baseProps} />);
    expect(screen.getByText('Save 16%')).toBeInTheDocument();
  });

  it('calls onItemClick with the adId when the non-current thumbnail is clicked', () => {
    const onItemClick = vi.fn();
    render(<BundleBanner {...baseProps} onItemClick={onItemClick} />);

    const otherThumbButton = screen.getByRole('button', { name: 'Dining Table' });
    fireEvent.click(otherThumbButton);

    expect(onItemClick).toHaveBeenCalledWith('ad-other');
    expect(onItemClick).toHaveBeenCalledTimes(1);
  });

  it('does not render the current item thumbnail as a clickable button', () => {
    render(<BundleBanner {...baseProps} />);
    const buttons = screen.getAllByRole('button');
    // Only the "other" item should be a button; the current item is a plain div.
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute('title', 'Dining Table');
  });
});
