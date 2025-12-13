import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ErrorFallback } from './ErrorFallback';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
    const actual = await vi.importActual('react-router-dom');
    return {
        ...actual,
        useNavigate: () => mockNavigate,
    };
});

const defaultProps = {
    error: new Error('Test error message'),
    errorInfo: {
        componentStack: '\n    at TestComponent\n    at ErrorBoundary',
    } as React.ErrorInfo,
    resetError: vi.fn(),
};

describe('ErrorFallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('renders error fallback UI', () => {
        render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} />
            </BrowserRouter>
        );
        expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('displays user-friendly error message', () => {
        render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} />
            </BrowserRouter>
        );
        expect(screen.getByText(/something unexpected happened/i)).toBeInTheDocument();
    });

    it('renders Try Again button', () => {
        render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} />
            </BrowserRouter>
        );
        expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('renders Go Home button', () => {
        render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} />
            </BrowserRouter>
        );
        expect(screen.getByText('Go Home')).toBeInTheDocument();
    });

    it('calls resetError when Try Again is clicked', () => {
        const resetError = vi.fn();
        render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} resetError={resetError} />
            </BrowserRouter>
        );

        const tryAgainButton = screen.getByText('Try Again');
        fireEvent.click(tryAgainButton);

        expect(resetError).toHaveBeenCalledTimes(1);
    });

    it('calls resetError and navigates to home when Go Home is clicked', () => {
        const resetError = vi.fn();
        render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} resetError={resetError} />
            </BrowserRouter>
        );

        const goHomeButton = screen.getByText('Go Home');
        fireEvent.click(goHomeButton);

        expect(resetError).toHaveBeenCalledTimes(1);
        expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    it('displays error icon', () => {
        const { container } = render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} />
            </BrowserRouter>
        );

        // Check for AlertTriangle icon
        const icon = container.querySelector('svg');
        expect(icon).toBeInTheDocument();
    });

    it('has accessible button labels', () => {
        render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} />
            </BrowserRouter>
        );

        expect(screen.getByLabelText('Try again')).toBeInTheDocument();
        expect(screen.getByLabelText('Go to home page')).toBeInTheDocument();
    });

    it('shows error details in development mode', () => {
        // Mock development environment
        const originalEnv = import.meta.env.DEV;
        import.meta.env.DEV = true;

        render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} />
            </BrowserRouter>
        );

        // Error details should be in a details element
        const detailsElement = screen.getByText(/Error Details/i);
        expect(detailsElement).toBeInTheDocument();

        // Restore environment
        import.meta.env.DEV = originalEnv;
    });

    it('handles null error gracefully', () => {
        render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} error={null} />
            </BrowserRouter>
        );

        // Should still render the fallback UI
        expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('handles null errorInfo gracefully', () => {
        render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} errorInfo={null} />
            </BrowserRouter>
        );

        // Should still render the fallback UI
        expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('applies correct styling classes', () => {
        const { container } = render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} />
            </BrowserRouter>
        );

        // Check for responsive container
        const mainContainer = container.querySelector('.min-h-screen');
        expect(mainContainer).toBeInTheDocument();

        // Check for card styling
        const card = container.querySelector('.bg-white.rounded-lg.shadow-lg');
        expect(card).toBeInTheDocument();
    });

    it('buttons have correct styling for touch targets', () => {
        const { container } = render(
            <BrowserRouter>
                <ErrorFallback {...defaultProps} />
            </BrowserRouter>
        );

        const buttons = container.querySelectorAll('button');
        buttons.forEach(button => {
            // Check for padding that creates touch-friendly targets
            expect(button.className).toMatch(/p[xy]-/);
        });
    });
});
