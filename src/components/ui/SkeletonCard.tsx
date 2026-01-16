import React from 'react';

export const SkeletonCard = () => {
    return (
        <div className="bg-card border border-border rounded-xl shadow-sm h-full overflow-hidden">
            {/* Image Placeholder */}
            <div className="aspect-[4/3] w-full shimmer" />

            {/* Content Placeholder */}
            <div className="p-3 space-y-3">
                {/* Title */}
                <div className="h-4 w-3/4 rounded shimmer" />

                {/* Location and Price */}
                <div className="flex justify-between items-center pt-1">
                    <div className="h-3 w-1/3 rounded shimmer" />
                    <div className="h-4 w-1/4 rounded shimmer" />
                </div>

                {/* Views */}
                <div className="h-3 w-1/5 rounded shimmer mt-2" />
            </div>
        </div>
    );
};
