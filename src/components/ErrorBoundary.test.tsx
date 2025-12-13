import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ErrorBoundary } from './ErrorBoundary';

// Component that throws an error for testing
function ThrowError({ shouldThrow = false }: { shouldThrow?: boolean }) {
    if (shouldThrow) {
        throw new Error('Test error');
    }
    return <div>No error</div>;
}

describe('ErrorBoundary', () => {
    beforeEach(() => {
        // Suppress console.error for cleaner test output
        vi.spyOn(console, 'error').mockImplementation(() => { });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders children when no error occurs', () => {
        render(
            <BrowserRouter>
                <ErrorBoundary>
                    <div>Test content</div>
                </ErrorBoundary>
            </BrowserRouter>
        );
        expect(screen.getByText('Test content')).toBeInTheDocument();
    });

    it('catches errors and displays fallback UI', () => {
        render(
            <BrowserRouter>
                <ErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            </BrowserRouter>
        );
        expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('logs errors to console when caught', () => {
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        render(
            <BrowserRouter>
                <ErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            </BrowserRouter>
        );

        // React's error boundary logs errors automatically
        // We just verify that console.error was called
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    it('displays error message in fallback UI', () => {
        render(
            <BrowserRouter>
                <ErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            </BrowserRouter>
        );

        // Should show user-friendly message
        expect(screen.getByText(/something unexpected happened/i)).toBeInTheDocument();
    });

    it('provides Try Again button in fallback UI', () => {
        render(
            <BrowserRouter>
                <ErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            </BrowserRouter>
        );

        expect(screen.getByText('Try Again')).toBeInTheDocument();
    });

    it('provides Go Home button in fallback UI', () => {
        render(
            <BrowserRouter>
                <ErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            </BrowserRouter>
        );

        expect(screen.getByText('Go Home')).toBeInTheDocument();
    });

    it('resets error state when Try Again is clicked', () => {
        // Suppress console.error for this test since we're intentionally throwing
        const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => { });

        // Track whether error boundary has been reset
        let hasBeenReset = false;

        // Create a component that throws until reset
        function ConditionalThrow() {
            if (!hasBeenReset) {
                throw new Error('Test error before reset');
            }
            return <div>No error</div>;
        }

        render(
            <BrowserRouter>
                <ErrorBoundary>
                    <ConditionalThrow />
                </ErrorBoundary>
            </BrowserRouter>
        );

        // Error fallback should be displayed
        expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

        // Mark as reset and click Try Again
        hasBeenReset = true;
        const tryAgainButton = screen.getByText('Try Again');
        fireEvent.click(tryAgainButton);

        // After reset, component should render successfully
        expect(screen.getByText('No error')).toBeInTheDocument();

        // Restore console.error
        consoleErrorSpy.mockRestore();
    });

    it('uses custom fallback when provided', () => {
        const customFallback = <div>Custom error message</div>;

        render(
            <BrowserRouter>
                <ErrorBoundary fallback={customFallback}>
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            </BrowserRouter>
        );

        expect(screen.getByText('Custom error message')).toBeInTheDocument();
        expect(screen.queryByText('Oops! Something went wrong')).not.toBeInTheDocument();
    });

    it('handles different error types', () => {
        function ThrowStringError(): never {
            throw 'String error';
        }

        render(
            <BrowserRouter>
                <ErrorBoundary>
                    <ThrowStringError />
                </ErrorBoundary>
            </BrowserRouter>
        );

        // Should still catch and display fallback
        expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });

    it('maintains error state until reset', () => {
        const { rerender } = render(
            <BrowserRouter>
                <ErrorBoundary>
                    <ThrowError shouldThrow={true} />
                </ErrorBoundary>
            </BrowserRouter>
        );

        // Error fallback should be displayed
        expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();

        // Re-render with different children (but error state should persist)
        rerender(
            <BrowserRouter>
                <ErrorBoundary>
                    <div>Different content</div>
                </ErrorBoundary>
            </BrowserRouter>
        );

        // Should still show error fallback
        expect(screen.getByText('Oops! Something went wrong')).toBeInTheDocument();
    });
});
