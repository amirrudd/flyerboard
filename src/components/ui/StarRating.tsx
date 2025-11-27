import React from 'react';

interface StarRatingProps {
    rating: number; // 0-5, supports 0.5 increments
    count?: number; // Number of ratings
    size?: 'sm' | 'md' | 'lg';
    showCount?: boolean;
    className?: string;
}

export function StarRating({
    rating,
    count = 0,
    size = 'md',
    showCount = true,
    className = '',
}: StarRatingProps) {
    // Clamp rating between 0 and 5
    const clampedRating = Math.max(0, Math.min(5, rating));

    // Size classes
    const sizeClasses = {
        sm: 'w-3 h-3',
        md: 'w-4 h-4',
        lg: 'w-5 h-5',
    };

    const textSizeClasses = {
        sm: 'text-xs',
        md: 'text-sm',
        lg: 'text-base',
    };

    // Generate star elements
    const stars = [];
    for (let i = 1; i <= 5; i++) {
        const fillPercentage = Math.max(0, Math.min(1, clampedRating - (i - 1)));

        stars.push(
            <div key={i} className="relative inline-block">
                {/* Empty star (background) */}
                <svg
                    className={`${sizeClasses[size]} text-gray-300`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    xmlns="http://www.w3.org/2000/svg"
                >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>

                {/* Filled star (overlay) */}
                {fillPercentage > 0 && (
                    <div
                        className="absolute top-0 left-0 overflow-hidden"
                        style={{ width: `${fillPercentage * 100}%` }}
                    >
                        <svg
                            className={`${sizeClasses[size]} text-yellow-400`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                            xmlns="http://www.w3.org/2000/svg"
                        >
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <div className="flex items-center gap-0.5">{stars}</div>
            {showCount && count > 0 && (
                <span className={`${textSizeClasses[size]} text-gray-600 ml-1`}>
                    {rating.toFixed(1)} ({count})
                </span>
            )}
            {showCount && count === 0 && (
                <span className={`${textSizeClasses[size]} text-gray-500 ml-1`}>
                    No ratings yet
                </span>
            )}
        </div>
    );
}
