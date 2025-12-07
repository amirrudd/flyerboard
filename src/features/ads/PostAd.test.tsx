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
    Header: ({ leftNode, centerNode, rightNode }: any) => (
        <div data-testid="header">
            {leftNode}
            {centerNode}
            {rightNode}
        </div>
    ),
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
        const mockDeleteAd = vi.fn();
        vi.mocked(useMutation).mockImplementation(() => {
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

    it('should show delete button when editing', () => {
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

        // Delete button should be visible (either with text or just icon on mobile)
        const deleteButton = screen.getByRole('button', { name: /delete/i });
        expect(deleteButton).toBeInTheDocument();
    });

    it('should show confirmation dialog when delete is clicked', async () => {
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

        const deleteButton = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(deleteButton);

        await waitFor(() => {
            expect(screen.getByText('Delete Listing')).toBeInTheDocument();
            expect(screen.getByText(/are you sure you want to delete this listing/i)).toBeInTheDocument();
        });
    });

    it('should show and hide delete confirmation dialog', async () => {
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

        // Click delete button in the header
        const deleteButton = screen.getByRole('button', { name: /delete/i });
        fireEvent.click(deleteButton);

        // Confirmation dialog should appear
        await waitFor(() => {
            expect(screen.getByText('Delete Listing')).toBeInTheDocument();
            expect(screen.getByText(/are you sure you want to delete this listing/i)).toBeInTheDocument();
        });

        // Get all buttons and find the Cancel button in the dialog (not the form)
        // The dialog has two buttons: Cancel and Delete, both are after the dialog appears
        const allButtons = screen.getAllByRole('button');
        // Filter for buttons that have 'Cancel' text and are within the dialog context
        // The dialog cancel button should be one of the last buttons rendered
        const dialogCancelButton = allButtons.filter(btn => btn.textContent === 'Cancel').pop();

        expect(dialogCancelButton).toBeDefined();
        fireEvent.click(dialogCancelButton!);

        // Dialog should close
        await waitFor(() => {
            expect(screen.queryByText('Delete Listing')).not.toBeInTheDocument();
        });
    });

    it('should not show delete button when creating new ad', () => {
        render(<PostAd onBack={mockOnBack} />);

        // Delete button should not be present
        const deleteButton = screen.queryByRole('button', { name: /delete/i });
        expect(deleteButton).not.toBeInTheDocument();
    });

    it('should enforce character limits on form fields', () => {
        render(<PostAd onBack={mockOnBack} />);

        const titleInput = screen.getByPlaceholderText('Enter a descriptive title') as HTMLInputElement;
        const descriptionTextarea = screen.getByPlaceholderText('Describe your item...') as HTMLTextAreaElement;
        const extendedDescriptionTextarea = screen.getByPlaceholderText('Additional details (optional)...') as HTMLTextAreaElement;
        const locationInput = screen.getByPlaceholderText('Enter suburb or postcode') as HTMLInputElement;

        // Check maxLength attributes
        expect(titleInput.maxLength).toBe(100);
        expect(descriptionTextarea.maxLength).toBe(500);
        expect(extendedDescriptionTextarea.maxLength).toBe(2000);
        expect(locationInput.maxLength).toBe(100);
    });

    it('should display character counters for textareas', () => {
        render(<PostAd onBack={mockOnBack} />);

        // Check for character counters
        expect(screen.getByText('0 / 500 characters')).toBeInTheDocument();
        expect(screen.getByText('0 / 2000 characters')).toBeInTheDocument();
    });

    it('should update character counter when typing', () => {
        render(<PostAd onBack={mockOnBack} />);

        const descriptionTextarea = screen.getByPlaceholderText('Describe your item...');

        fireEvent.change(descriptionTextarea, { target: { value: 'Test description' } });

        expect(screen.getByText('16 / 500 characters')).toBeInTheDocument();
    });
});
