import { createPortal } from "react-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { X, MessageSquare, Loader2 } from "lucide-react";
import { StarRating } from "./ui/StarRating";
import { ImageDisplay } from "./ui/ImageDisplay";
import { formatDistanceToNow } from "date-fns";
import { getInitials } from "../lib/displayName";

interface ReviewListModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: Id<"users">;
    userName: string;
}

export function ReviewListModal({
    isOpen,
    onClose,
    userId,
    userName,
}: ReviewListModalProps) {
    const ratings = useQuery(api.ratings.getUserRatings, { userId });

    if (!isOpen) return null;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm modal-scroll-lock animate-fade-in"
            onClick={onClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="review-list-modal-title"
        >
            <section
                className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <header className="px-5 sm:px-6 py-4 hairline border-b border-border/70 flex items-center justify-between bg-card sticky top-0 z-10">
                    <div>
                        <p className="kicker text-muted-foreground mb-1">Reviews</p>
                        <h2
                            id="review-list-modal-title"
                            className="font-display text-2xl font-semibold tracking-tight text-foreground"
                        >
                            Reviews for {userName}
                        </h2>
                        {ratings && (
                            <p className="text-sm text-muted-foreground mt-1 tabular">
                                {ratings.length} {ratings.length === 1 ? 'review' : 'reviews'}
                            </p>
                        )}
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close reviews dialog"
                        className="text-muted-foreground hover:text-foreground rounded-full p-2 hover:bg-muted/60 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                {/* Content */}
                <div className="overflow-y-auto px-5 sm:px-6 py-4 flex-1 overscroll-contain">
                    {ratings === undefined ? (
                        // Loading state
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
                            <p>Loading reviews...</p>
                        </div>
                    ) : ratings.length === 0 ? (
                        // Empty state
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 bg-muted/60 ring-1 ring-border/70 rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="w-8 h-8 text-muted-foreground/40" />
                            </div>
                            <h3 className="font-display text-xl font-semibold tracking-tight text-foreground mb-1">No reviews yet</h3>
                            <p className="text-[15px] leading-relaxed text-foreground/80 max-w-xs mx-auto">
                                This user hasn't received any reviews from other members yet.
                            </p>
                        </div>
                    ) : (
                        // Reviews list — hairline dividers, not cards
                        <ul className="divide-y divide-border/60">
                            {ratings.map((review) => (
                                <li key={review._id} className="py-5 first:pt-1 last:pb-1">
                                    <article>
                                        <div className="flex items-start gap-3 mb-2">
                                            {/* Avatar */}
                                            <div className="flex-shrink-0">
                                                {review.raterImage ? (
                                                    <ImageDisplay
                                                        imageRef={review.raterImage}
                                                        alt={review.raterName}
                                                        className="w-10 h-10 rounded-full object-cover ring-1 ring-border/70"
                                                    />
                                                ) : (
                                                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm ring-1 ring-border/70">
                                                        {getInitials({ name: review.raterName })}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Header info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between gap-2 flex-wrap">
                                                    <h4 className="font-semibold text-foreground truncate">
                                                        {review.raterName}
                                                    </h4>
                                                    <span className="text-xs text-muted-foreground whitespace-nowrap tabular">
                                                        {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <StarRating
                                                        rating={review.rating}
                                                        size="sm"
                                                        showCount={false}
                                                        className="pointer-events-none" // Read-only view
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Comment */}
                                        {review.comment && (
                                            <div className="pl-[52px]">
                                                <p className="text-foreground/80 text-[15px] leading-relaxed whitespace-pre-wrap italic">
                                                    "{review.comment}"
                                                </p>
                                            </div>
                                        )}
                                    </article>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </section>
        </div>,
        document.body
    );
}
