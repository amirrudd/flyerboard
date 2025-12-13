import { AlertTriangle, Home, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface ErrorFallbackProps {
    error: Error | null;
    errorInfo: React.ErrorInfo | null;
    resetError: () => void;
}

/**
 * User-friendly error fallback UI component displayed when an error is caught by ErrorBoundary.
 * Provides options to retry or navigate home, with optional detailed error info in development.
 */
export function ErrorFallback({ error, errorInfo, resetError }: ErrorFallbackProps) {
    const navigate = useNavigate();
    const isDevelopment = import.meta.env.DEV;

    const handleGoHome = () => {
        resetError();
        navigate('/');
    };

    const handleTryAgain = () => {
        resetError();
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
                    Oops! Something went wrong
                </h1>
                <p className="text-gray-600 mb-8">
                    We're sorry, but something unexpected happened. Please try again or return to the home page.
                </p>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                    <button
                        onClick={handleTryAgain}
                        className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                        aria-label="Try again"
                    >
                        <RefreshCw className="w-5 h-5" />
                        Try Again
                    </button>
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
