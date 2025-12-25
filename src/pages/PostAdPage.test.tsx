import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PostAdPage } from './PostAdPage';
import { MemoryRouter } from 'react-router-dom';

// Mock the PostAd component
vi.mock('../features/ads/PostAd', () => ({
    PostAd: ({ onBack, editingAd, origin }: any) => (
        <div data-testid="post-ad-component">
            <button onClick={onBack} data-testid="back-button">Back</button>
            <div data-testid="editing-ad">{editingAd ? 'Editing' : 'Creating'}</div>
            <div data-testid="origin">{origin}</div>
        </div>
    ),
}));

const mockNavigate = vi.fn();
const mockUseLocation = vi.fn();

vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
        useLocation: () => mockUseLocation(),
    };
});

describe('PostAdPage - Navigation Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('should render PostAd component', () => {
        mockUseLocation.mockReturnValue({ state: {} });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('post-ad-component')).toBeInTheDocument();
    });

    it('should navigate to home when onBack is called from home', () => {
        mockUseLocation.mockReturnValue({
            state: { from: '/' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        const backButton = screen.getByTestId('back-button');
        backButton.click();

        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should navigate to dashboard when onBack is called from dashboard', () => {
        mockUseLocation.mockReturnValue({
            state: { from: '/dashboard' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        const backButton = screen.getByTestId('back-button');
        backButton.click();

        expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });

    it('should navigate to home when onBack is called from ad detail page', () => {
        mockUseLocation.mockReturnValue({
            state: { from: '/ad/123' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        const backButton = screen.getByTestId('back-button');
        backButton.click();

        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should navigate to home when no from state is provided', () => {
        mockUseLocation.mockReturnValue({
            state: {},
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        const backButton = screen.getByTestId('back-button');
        backButton.click();

        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('should pass editingAd to PostAd component when provided', () => {
        const mockEditingAd = {
            _id: 'ad1',
            title: 'Test Ad',
            description: 'Test description',
            price: 100,
            location: 'Sydney',
            categoryId: 'cat1',
            images: ['image1.jpg'],
        };

        mockUseLocation.mockReturnValue({
            state: { editingAd: mockEditingAd, from: '/dashboard' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('editing-ad')).toHaveTextContent('Editing');
    });

    it('should pass origin to PostAd component', () => {
        mockUseLocation.mockReturnValue({
            state: { from: '/dashboard' },
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('origin')).toHaveTextContent('/dashboard');
    });

    it('should default origin to / when not provided', () => {
        mockUseLocation.mockReturnValue({
            state: {},
        });

        render(
            <MemoryRouter>
                <PostAdPage />
            </MemoryRouter>
        );

        expect(screen.getByTestId('origin')).toHaveTextContent('/');
    });
});

