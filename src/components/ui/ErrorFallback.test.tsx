import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
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

// Mock Descope SDK
const mockLogout = vi.fn().mockResolvedValue(undefined);
vi.mock('@descope/react-sdk', () => ({
    useDescope: () => ({
        logout: mockLogout,
    }),
}));

const defaultProps = {
    error: new Error('Test error message'),
    errorInfo: {
        componentStack: '\n    at TestComponent\n    at ErrorBoundary',
    } as React.ErrorInfo,
    resetError: vi.fn(),
};

const authErrorProps = {
    error: new Error('Not authenticated'),
    errorInfo: {
        componentStack: '\n    at TestComponent\n    at ErrorBoundary',
    } as React.ErrorInfo,
    resetError: vi.fn(),
};

describe('ErrorFallback', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('General error handling', () => {
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

        it('renders Try Again button for non-auth errors', () => {
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
    });

    describe('Authentication error handling', () => {
        it('shows Session Expired title for auth errors', () => {
            render(
                <BrowserRouter>
                    <ErrorFallback {...authErrorProps} />
                </BrowserRouter>
            );
            expect(screen.getByText('Session Expired')).toBeInTheDocument();
        });

        it('shows auth-specific message for auth errors', () => {
            render(
                <BrowserRouter>
                    <ErrorFallback {...authErrorProps} />
                </BrowserRouter>
            );
            expect(screen.getByText(/session has expired or is invalid/i)).toBeInTheDocument();
        });

        it('shows Sign Out button for auth errors instead of Try Again', () => {
            render(
                <BrowserRouter>
                    <ErrorFallback {...authErrorProps} />
                </BrowserRouter>
            );
            expect(screen.getByText('Sign Out & Try Again')).toBeInTheDocument();
            expect(screen.queryByText('Try Again')).not.toBeInTheDocument();
        });

        it('calls logout and navigates when Sign Out is clicked', async () => {
            const resetError = vi.fn();
            render(
                <BrowserRouter>
                    <ErrorFallback {...authErrorProps} resetError={resetError} />
                </BrowserRouter>
            );

            const signOutButton = screen.getByText('Sign Out & Try Again');
            fireEvent.click(signOutButton);

            await waitFor(() => {
                expect(mockLogout).toHaveBeenCalled();
                expect(resetError).toHaveBeenCalled();
                expect(mockNavigate).toHaveBeenCalledWith('/');
            });
        });

        it('shows loading state while signing out', async () => {
            // Make logout take some time
            mockLogout.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

            render(
                <BrowserRouter>
                    <ErrorFallback {...authErrorProps} />
                </BrowserRouter>
            );

            const signOutButton = screen.getByText('Sign Out & Try Again');
            fireEvent.click(signOutButton);

            expect(screen.getByText('Signing out...')).toBeInTheDocument();
        });

        it('detects various auth error messages', () => {
            const authErrors = [
                'Not authenticated',
                'Unauthorized',
                'Token expired',
                'Invalid token',
                '401 error',
            ];

            authErrors.forEach(message => {
                const { unmount } = render(
                    <BrowserRouter>
                        <ErrorFallback
                            error={new Error(message)}
                            errorInfo={null}
                            resetError={vi.fn()}
                        />
                    </BrowserRouter>
                );
                expect(screen.getByText('Session Expired')).toBeInTheDocument();
                unmount();
            });
        });
    });

    describe('Error display', () => {
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

        it('has accessible sign out button label for auth errors', () => {
            render(
                <BrowserRouter>
                    <ErrorFallback {...authErrorProps} />
                </BrowserRouter>
            );

            expect(screen.getByLabelText('Sign out and try again')).toBeInTheDocument();
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
    });

    describe('Edge cases', () => {
        it('handles null error gracefully', () => {
            render(
                <BrowserRouter>
                    <ErrorFallback {...defaultProps} error={null} />
                </BrowserRouter>
            );

            // Should still render the fallback UI (non-auth path)
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

        it('handles logout failure gracefully', async () => {
            mockLogout.mockRejectedValueOnce(new Error('Logout failed'));
            const resetError = vi.fn();

            render(
                <BrowserRouter>
                    <ErrorFallback {...authErrorProps} resetError={resetError} />
                </BrowserRouter>
            );

            const signOutButton = screen.getByText('Sign Out & Try Again');
            fireEvent.click(signOutButton);

            // Should still reset and navigate even if logout fails
            await waitFor(() => {
                expect(resetError).toHaveBeenCalled();
                expect(mockNavigate).toHaveBeenCalledWith('/');
            });
        });
    });

    describe('Styling', () => {
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
            const card = container.querySelector('.bg-card.rounded-lg.shadow-lg');
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
});

