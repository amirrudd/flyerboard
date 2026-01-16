import { ReactNode } from 'react';

interface CircularProgressProps {
    progress: number; // 0-100
    size?: number; // diameter in pixels
    strokeWidth?: number;
    color?: string;
    backgroundColor?: string;
    children?: ReactNode; // Content to show in center (e.g., percentage)
    className?: string;
}

export function CircularProgress({
    progress,
    size = 120,
    strokeWidth = 8,
    color,
    backgroundColor,
    children,
    className = '',
}: CircularProgressProps) {
    // Compute colors from CSS variables if not provided
    const computedStyle = typeof window !== 'undefined' ? getComputedStyle(document.documentElement) : null;
    const primaryHsl = computedStyle?.getPropertyValue('--primary').trim();
    const mutedHsl = computedStyle?.getPropertyValue('--muted').trim();

    const progressColor = color || (primaryHsl ? `hsl(${primaryHsl})` : '#9e1b1e');
    const bgColor = backgroundColor || (mutedHsl ? `hsl(${mutedHsl})` : '#e5e7eb');
    const radius = (size - strokeWidth) / 2;
    const circumference = radius * 2 * Math.PI;
    const offset = circumference - (progress / 100) * circumference;

    return (
        <div className={`relative inline-flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
            <svg
                width={size}
                height={size}
                className="transform -rotate-90"
            >
                {/* Background circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={bgColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={progressColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeDasharray={circumference}
                    strokeDashoffset={offset}
                    strokeLinecap="round"
                    className="transition-all duration-300 ease-out"
                />
            </svg>
            {/* Center content */}
            {children && (
                <div className="absolute inset-0 flex items-center justify-center">
                    {children}
                </div>
            )}
        </div>
    );
}
