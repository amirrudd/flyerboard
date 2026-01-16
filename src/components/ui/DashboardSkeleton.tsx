import React from 'react';

/**
 * Skeleton loader for user profile section in dashboard sidebar
 * Matches exact dimensions of loaded content to prevent layout shifts
 */
export const UserProfileSkeleton = () => {
    return (
        <div className="bg-card rounded-lg p-4 shadow-sm mb-6 border border-border">
            <div className="flex items-center gap-3 mb-4">
                {/* Avatar skeleton - matches w-12 h-12 */}
                <div className="w-12 h-12 bg-muted rounded-full shimmer" />

                <div className="flex-1">
                    {/* Name skeleton - matches font-semibold text-gray-800 */}
                    <div className="h-5 w-32 rounded shimmer mb-2" />
                    {/* Email skeleton - matches text-sm text-gray-500 */}
                    <div className="h-4 w-40 rounded shimmer" />
                </div>
            </div>

            {/* Stats skeleton */}
            <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center">
                    {/* Total Ads number - matches text-2xl font-bold */}
                    <div className="h-8 w-12 rounded shimmer mx-auto mb-1" />
                    {/* Label - matches text-xs */}
                    <div className="h-3 w-16 rounded shimmer mx-auto" />
                </div>
                <div className="text-center">
                    {/* Total Views number - matches text-2xl font-bold */}
                    <div className="h-8 w-12 rounded shimmer mx-auto mb-1" />
                    {/* Label - matches text-xs */}
                    <div className="h-3 w-20 rounded shimmer mx-auto" />
                </div>
            </div>

            {/* Rating skeleton */}
            <div className="pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                    {/* Star rating - matches StarRating component height */}
                    <div className="h-4 w-20 rounded shimmer" />
                    {/* Rating count */}
                    <div className="h-3 w-12 rounded shimmer" />
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton loader for individual ad listing card
 * Matches the layout of ad cards in "My Listings" section
 */
export const AdListingSkeleton = () => {
    return (
        <div className="border border-border bg-card rounded-lg p-4">
            <div className="flex items-start gap-4">
                {/* Image skeleton - matches w-20 h-20 */}
                <div className="w-20 h-20 rounded-lg shimmer" />

                <div className="flex-1">
                    {/* Title skeleton - matches font-semibold text-gray-800 mb-1 */}
                    <div className="h-5 w-3/4 rounded shimmer mb-1" />

                    {/* Price skeleton - matches text-lg font-bold mb-2 */}
                    <div className="h-6 w-24 rounded shimmer mb-2" />

                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            {/* Views skeleton */}
                            <div className="h-4 w-16 rounded shimmer" />
                            {/* Status badge skeleton */}
                            <div className="h-6 w-16 rounded-full shimmer" />
                        </div>

                        {/* Action buttons skeleton - hidden on mobile */}
                        <div className="hidden md:flex items-center gap-2">
                            <div className="h-8 w-20 rounded-lg shimmer" />
                            <div className="h-8 w-20 rounded-lg shimmer" />
                            <div className="h-8 w-16 rounded-lg shimmer" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton loader for saved ad card
 * Matches the layout of saved ads section
 */
export const SavedAdSkeleton = () => {
    return (
        <div className="border border-border bg-card rounded-lg p-4">
            <div className="flex items-start gap-4">
                {/* Image skeleton */}
                <div className="w-20 h-20 rounded-lg shimmer" />

                <div className="flex-1">
                    {/* Title skeleton */}
                    <div className="h-5 w-3/4 rounded shimmer mb-1" />

                    {/* Price skeleton */}
                    <div className="h-6 w-24 rounded shimmer mb-2" />

                    {/* Description skeleton - 2 lines */}
                    <div className="h-4 w-full rounded shimmer mb-1" />
                    <div className="h-4 w-2/3 rounded shimmer mb-2" />

                    {/* Location and views */}
                    <div className="flex items-center justify-between">
                        <div className="h-3 w-24 rounded shimmer" />
                        <div className="h-3 w-16 rounded shimmer" />
                    </div>
                </div>
            </div>
        </div>
    );
};

/**
 * Skeleton loader for chat item
 * Matches the layout of chat messages
 */
export const ChatItemSkeleton = () => {
    return (
        <div className="border border-border bg-card rounded-lg p-4">
            <div className="flex items-start gap-4">
                {/* Image skeleton */}
                <div className="w-16 h-16 rounded-lg shimmer" />

                <div className="flex-1">
                    <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                            {/* Title skeleton */}
                            <div className="h-5 w-2/3 rounded shimmer mb-2" />

                            {/* Seller name skeleton */}
                            <div className="h-4 w-32 rounded shimmer mb-1" />

                            {/* Rating skeleton */}
                            <div className="h-4 w-20 rounded shimmer" />
                        </div>

                        {/* Button skeleton */}
                        <div className="h-8 w-24 rounded-lg shimmer" />
                    </div>

                    {/* Message preview skeleton */}
                    <div className="h-4 w-full rounded shimmer mb-2" />

                    {/* Time and price */}
                    <div className="flex items-center justify-between">
                        <div className="h-3 w-20 rounded shimmer" />
                        <div className="h-5 w-24 rounded shimmer" />
                    </div>
                </div>
            </div>
        </div>
    );
};
