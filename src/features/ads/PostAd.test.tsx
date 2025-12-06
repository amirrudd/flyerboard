import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PostAd } from './PostAd';
import { useMutation, useQuery } from 'convex/react';
import { searchLocations } from '../../lib/locationService';

// Mock convex hooks
vi.mock('convex/react', () => ({
    useMutation: vi.fn(),
    useQuery: vi.fn(),
    useAction: vi.fn(),
}));

// Mock sonner
vi.mock('sonner', () => ({
    toast: {
        error: vi.fn(),
        success: vi.fn(),
    },
}));

// Mock ImageUpload component
vi.mock('../../components/ui/ImageUpload', () => ({
    ImageUpload: ({ onImagesChange }: any) => (
        <button type="button" onClick={() => onImagesChange(['image1.jpg'])}>Add Image</button>
    ),
}));

// Mock Header
vi.mock('../layout/Header', () => ({
    Header: () => <div data-testid="header">Header</div>,
}));

// Mock category icons
vi.mock('../../lib/categoryIcons', () => ({
    getCategoryIcon: () => 'div',
}));

// Mock location service
vi.mock('../../lib/locationService', () => ({
    searchLocations: vi.fn(),
    formatLocation: vi.fn((loc) => loc.locality),
}));

describe('PostAd', () => {
    const mockOnBack = vi.fn();
    const mockCreateAd = vi.fn();

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(useMutation).mockImplementation((apiFunc: any) => {
            return mockCreateAd as any;
        });
        vi.mocked(useQuery).mockReturnValue([
            { _id: 'cat1', name: 'Electronics', slug: 'electronics' },
        ]);
        vi.mocked(searchLocations).mockResolvedValue([]);
    });

    it('should render form fields', () => {
        render(<PostAd onBack={mockOnBack} />);

        expect(screen.getByText('Title *')).toBeInTheDocument();
        expect(screen.getByText('Category *')).toBeInTheDocument();
        expect(screen.getByText('Price (AUD) *')).toBeInTheDocument();
        expect(screen.getByText('Location *')).toBeInTheDocument();
        expect(screen.getByText('Description *')).toBeInTheDocument();
    });

    it('should validate required fields on submit', async () => {
        render(<PostAd onBack={mockOnBack} />);

        const submitButton = screen.getByText('Post Listing');
        fireEvent.click(submitButton);

        expect(mockCreateAd).not.toHaveBeenCalled();
    });

    it('should submit form with valid data', async () => {
        // Mock searchLocations to return results
        const mockLocation = { id: 1, locality: 'Sydney', state: 'NSW', postcode: '2000', lat: 0, long: 0 };
        vi.mocked(searchLocations).mockResolvedValue([mockLocation]);

        render(<PostAd onBack={mockOnBack} />);

        // Fill form
        fireEvent.change(screen.getByPlaceholderText('Enter a descriptive title'), { target: { value: 'Test Ad' } });
        fireEvent.change(screen.getByPlaceholderText('0.00'), { target: { value: '100' } });

        // Handle Location Selection
        const locationInput = screen.getByPlaceholderText('Enter suburb or postcode');
        fireEvent.change(locationInput, { target: { value: 'Syd' } });
        fireEvent.focus(locationInput);

        await waitFor(() => {
            expect(screen.getByText('Sydney')).toBeInTheDocument();
        });
        fireEvent.click(screen.getByText('Sydney'));

        fireEvent.change(screen.getByPlaceholderText('Describe your item...'), { target: { value: 'Test Description' } });

        // Select category
        fireEvent.click(screen.getByText('Select a category'));
        fireEvent.click(screen.getByText('Electronics'));

        // Add image
        fireEvent.click(screen.getByText('Add Image'));

        const submitButton = screen.getByText('Post Listing');
        expect(submitButton).not.toBeDisabled();
        fireEvent.click(submitButton);

        await waitFor(() => {
            expect(mockCreateAd).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Test Ad',
                price: 100,
                location: 'Sydney',
                description: 'Test Description',
                images: [],
            }));
        });
    });

    it('should pre-fill form when editing', () => {
        const editingAd = {
            _id: 'ad1',
            title: 'Existing Ad',
            description: 'Desc',
            price: 50,
            location: 'Melbourne',
            categoryId: 'cat1',
            images: ['old.jpg'],
        };

        render(<PostAd onBack={mockOnBack} editingAd={editingAd} />);

        expect(screen.getByDisplayValue('Existing Ad')).toBeInTheDocument();
        expect(screen.getByText('Update Listing')).toBeInTheDocument();
    });
});
