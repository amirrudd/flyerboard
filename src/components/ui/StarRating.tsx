import React from 'react';
import { Star } from 'lucide-react';

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
                <Star
                    className={`${sizeClasses[size]} text-muted-foreground/30`}
                    fill="currentColor"
                    strokeWidth={0}
                />

                {/* Filled star (overlay) */}
                {fillPercentage > 0 && (
                    <div
                        className="absolute top-0 left-0 overflow-hidden"
                        style={{ width: `${fillPercentage * 100}%` }}
                    >
                        <Star
                            className={`${sizeClasses[size]} text-yellow-400`}
                            fill="currentColor"
                            strokeWidth={0}
                        />
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className={`flex items-center gap-1 ${className}`}>
            <div className="flex items-center gap-0.5">{stars}</div>
            {showCount && count > 0 && (
                <span className={`${textSizeClasses[size]} text-muted-foreground ml-1`}>
                    {rating.toFixed(1)} ({count})
                </span>
            )}
            {showCount && count === 0 && (
                <span className={`${textSizeClasses[size]} text-muted-foreground ml-1`}>
                    No ratings yet
                </span>
            )}
        </div>
    );
}
