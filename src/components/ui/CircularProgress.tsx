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
    color = '#ea580c', // primary-600
    backgroundColor = '#f3f4f6', // gray-100
    children,
    className = '',
}: CircularProgressProps) {
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
                    stroke={backgroundColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress circle */}
                <circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={color}
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
