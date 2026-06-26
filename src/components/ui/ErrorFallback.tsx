import { useState } from 'react';
import { AlertTriangle, Home, RefreshCw, LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { isAuthError } from '../../lib/useAuthRecovery';
import { useDescope } from '@descope/react-sdk';

interface ErrorFallbackProps {
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    resetError: () => void;
}

/**
 * User-friendly error fallback UI component displayed when an error is caught by ErrorBoundary.
 * Provides options to retry or navigate home, with optional detailed error info in development.
 * 
 * For authentication errors, provides a "Sign Out & Try Again" option to help users
 * recover from stuck auth states (expired tokens, sync failures, etc).
 */
export function ErrorFallback({ error, errorInfo, resetError }: ErrorFallbackProps) {
    const navigate = useNavigate();
    const sdk = useDescope();
    const isDevelopment = import.meta.env.DEV;
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    // Check if this is an authentication-related error
    const isAuthRelatedError = isAuthError(error);

    const handleGoHome = () => {
        resetError();
        navigate('/');
    };

    const handleTryAgain = () => {
        resetError();
    };

    /**
     * Handle sign out for auth errors.
     * Logs out the user and navigates to home to allow fresh login.
     */
    const handleSignOutAndRetry = async () => {
        setIsLoggingOut(true);
        try {
            await sdk.logout();
        } catch (e) {
            // Even if logout fails, continue to reset and navigate
            console.error('Logout failed during error recovery:', e);
        }
        resetError();
        navigate('/');
    };

    return (
        <main className="min-h-screen flex items-center justify-center bg-background px-4">
            <section className="max-w-md w-full bg-card rounded-lg shadow-lg ring-1 ring-border/70 p-8 text-center">
                {/* Error Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-destructive" aria-hidden="true" />
                    </div>
                </div>

                {/* Error Message */}
                <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-[-0.02em] leading-[1.1] text-foreground mb-3">
                    {isAuthRelatedError ? 'Session Expired' : 'Oops! Something went wrong'}
                </h1>
                <p className="text-[15px] leading-relaxed text-foreground/80 mb-8 max-w-prose mx-auto">
                    {isAuthRelatedError
                        ? 'Your session has expired or is invalid. Please sign out and log in again to continue.'
                        : "We're sorry, but something unexpected happened. Please try again or return to the home page."
                    }
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    {isAuthRelatedError ? (
                        // For auth errors, show Sign Out button as primary action
                        <button
                            type="button"
                            onClick={handleSignOutAndRetry}
                            disabled={isLoggingOut}
                            className="flex-1 flex items-center justify-center gap-2 h-11 px-5 py-3 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-destructive/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
                            aria-label="Sign out and try again"
                        >
                            <LogOut className="w-5 h-5" aria-hidden="true" />
                            {isLoggingOut ? 'Signing out...' : 'Sign Out & Try Again'}
                        </button>
                    ) : (
                        // For non-auth errors, show Try Again as primary
                        <button
                            type="button"
                            onClick={handleTryAgain}
                            className="flex-1 flex items-center justify-center gap-2 h-11 px-5 py-3 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                            aria-label="Try again"
                        >
                            <RefreshCw className="w-5 h-5" aria-hidden="true" />
                            Try Again
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handleGoHome}
                        className="flex-1 flex items-center justify-center gap-2 h-11 px-5 py-3 bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] rounded-full font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                        aria-label="Go to home page"
                    >
                        <Home className="w-5 h-5" aria-hidden="true" />
                        Go Home
                    </button>
                </div>

                {/* Development Mode: Show Error Details */}
                {isDevelopment && error && (
                    <details className="text-left mt-6 p-4 bg-muted/50 rounded-2xl ring-1 ring-border/70">
                        <summary className="cursor-pointer font-medium text-foreground mb-2">
                            Error Details (Development Only)
                        </summary>
                        <div className="space-y-3">
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-1">Error Message</p>
                                <p className="text-sm text-destructive font-mono break-words">
                                    {error.message}
                                </p>
                            </div>
                            <div>
                                <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-1">Auth Error Detected</p>
                                <p className="text-sm text-muted-foreground font-mono">
                                    {isAuthRelatedError ? 'Yes' : 'No'}
                                </p>
                            </div>
                            {error.stack && (
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-1">Stack Trace</p>
                                    <pre className="text-xs text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap break-words bg-card p-2 rounded-lg ring-1 ring-border/70">
                                        {error.stack}
                                    </pre>
                                </div>
                            )}
                            {errorInfo?.componentStack && (
                                <div>
                                    <p className="text-[11px] uppercase tracking-[0.14em] font-semibold text-muted-foreground mb-1">Component Stack</p>
                                    <pre className="text-xs text-muted-foreground font-mono overflow-x-auto whitespace-pre-wrap break-words bg-card p-2 rounded-lg ring-1 ring-border/70">
                                        {errorInfo.componentStack}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </details>
                )}
            </section>
        </main>
    );
}

