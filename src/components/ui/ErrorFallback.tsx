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
        <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
            <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
                {/* Error Icon */}
                <div className="flex justify-center mb-6">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center">
                        <AlertTriangle className="w-8 h-8 text-orange-600" />
                    </div>
                </div>

                {/* Error Message */}
                <h1 className="text-2xl font-bold text-gray-900 mb-3">
                    {isAuthRelatedError ? 'Session Expired' : 'Oops! Something went wrong'}
                </h1>
                <p className="text-gray-600 mb-8">
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
                            onClick={handleSignOutAndRetry}
                            disabled={isLoggingOut}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            aria-label="Sign out and try again"
                        >
                            <LogOut className="w-5 h-5" />
                            {isLoggingOut ? 'Signing out...' : 'Sign Out & Try Again'}
                        </button>
                    ) : (
                        // For non-auth errors, show Try Again as primary
                        <button
                            onClick={handleTryAgain}
                            className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                            aria-label="Try again"
                        >
                            <RefreshCw className="w-5 h-5" />
                            Try Again
                        </button>
                    )}
                    <button
                        onClick={handleGoHome}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium"
                        aria-label="Go to home page"
                    >
                        <Home className="w-5 h-5" />
                        Go Home
                    </button>
                </div>

                {/* Development Mode: Show Error Details */}
                {isDevelopment && error && (
                    <details className="text-left mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                        <summary className="cursor-pointer font-medium text-gray-700 mb-2">
                            Error Details (Development Only)
                        </summary>
                        <div className="space-y-3">
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-1">Error Message:</p>
                                <p className="text-sm text-red-600 font-mono break-words">
                                    {error.message}
                                </p>
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-gray-700 mb-1">Auth Error Detected:</p>
                                <p className="text-sm text-gray-600 font-mono">
                                    {isAuthRelatedError ? 'Yes' : 'No'}
                                </p>
                            </div>
                            {error.stack && (
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 mb-1">Stack Trace:</p>
                                    <pre className="text-xs text-gray-600 font-mono overflow-x-auto whitespace-pre-wrap break-words bg-white p-2 rounded border border-gray-200">
                                        {error.stack}
                                    </pre>
                                </div>
                            )}
                            {errorInfo?.componentStack && (
                                <div>
                                    <p className="text-sm font-semibold text-gray-700 mb-1">Component Stack:</p>
                                    <pre className="text-xs text-gray-600 font-mono overflow-x-auto whitespace-pre-wrap break-words bg-white p-2 rounded border border-gray-200">
                                        {errorInfo.componentStack}
                                    </pre>
                                </div>
                            )}
                        </div>
                    </details>
                )}
            </div>
        </div>
    );
}

