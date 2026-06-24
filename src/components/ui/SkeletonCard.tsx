import React from 'react';

export const SkeletonCard = () => {
    return (
        <div className="bg-card rounded-xl shadow-card ring-1 ring-border/70 h-full overflow-hidden">
            {/* Image Placeholder */}
            <div className="aspect-[4/3] w-full shimmer" />

            {/* Content Placeholder */}
            <div className="px-3.5 pt-3 pb-3.5 space-y-3">
                {/* Title */}
                <div className="h-4 w-3/4 rounded shimmer" />

                {/* Location and Price */}
                <div className="flex justify-between items-center pt-1">
                    <div className="h-3 w-1/3 rounded shimmer" />
                    <div className="h-4 w-1/4 rounded shimmer" />
                </div>

                {/* Views row with hairline */}
                <div className="pt-2 border-t border-border/60">
                    <div className="h-3 w-1/5 rounded shimmer" />
                </div>
            </div>
        </div>
    );
};
