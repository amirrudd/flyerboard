import { ImageDisplay } from './ImageDisplay';
import { StarRating } from './StarRating';
import { getDisplayName, getInitials } from '../../lib/displayName';

interface SellerProfileProps {
    seller: {
        name: string;
        image?: string;
        isVerified?: boolean;
        averageRating?: number;
        ratingCount?: number;
    } | null;
    avatarImageError: boolean;
    onAvatarError: () => void;
    onRatingClick?: () => void;
    size?: 'sm' | 'md' | 'lg';
    showRating?: boolean;
}

const sizeClasses = {
    sm: 'w-10 h-10 text-sm',
    md: 'w-12 h-12 text-lg',
    lg: 'w-16 h-16 text-xl',
};

export function SellerProfile({
    seller,
    avatarImageError,
    onAvatarError,
    onRatingClick,
    size = 'md',
    showRating = true,
}: SellerProfileProps) {
    const sizeClass = sizeClasses[size];

    return (
        <div className="flex items-center gap-3">
            {seller?.image && !avatarImageError ? (
                <ImageDisplay
                    src={seller.image}
                    alt={seller.name}
                    className={`${sizeClass} rounded-full object-cover`}
                    onError={onAvatarError}
                />
            ) : (
                <div className={`${sizeClass} bg-muted rounded-full flex items-center justify-center text-muted-foreground font-semibold`}>
                    {seller ? getInitials(seller) : 'U'}
                </div>
            )}
            <div className="flex-1">
                {seller ? (
                    <p className={`font-medium text-foreground flex items-center gap-1 ${size === 'lg' ? 'text-lg font-semibold' : ''}`}>
                        {getDisplayName(seller)}
                        {seller.isVerified && (
                            <img
                                src="/verified-badge.svg"
                                alt="Verified Seller"
                                className={`dark:brightness-125 dark:contrast-125 ${size === 'lg' ? 'w-6 h-6' : 'w-10 h-10'}`}
                            />
                        )}
                    </p>
                ) : (
                    <div className="h-4 w-32 bg-muted rounded animate-pulse mb-2" />
                )}
                {showRating && seller && (
                    <div
                        onClick={onRatingClick}
                        className={onRatingClick ? 'cursor-pointer hover:opacity-70 transition-opacity inline-block' : 'inline-block'}
                        title={onRatingClick ? 'View all reviews' : undefined}
                    >
                        <StarRating
                            rating={seller.averageRating || 0}
                            count={seller.ratingCount || 0}
                            size="sm"
                            showCount={true}
                        />
                    </div>
                )}
                {showRating && !seller && (
                    <div className="h-4 w-28 bg-muted rounded animate-pulse" />
                )}
            </div>
        </div>
    );
}
