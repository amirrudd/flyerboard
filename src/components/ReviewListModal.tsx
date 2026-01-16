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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-scroll-lock animate-fade-in" onClick={onClose}>
            <div
                className="bg-card border border-border rounded-xl shadow-xl max-w-lg w-full max-h-[85vh] flex flex-col overflow-hidden"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-4 border-b border-border flex items-center justify-between bg-card sticky top-0 z-10">
                    <div>
                        <h2 className="text-xl font-bold text-foreground">Reviews for {userName}</h2>
                        {ratings && (
                            <p className="text-sm text-muted-foreground mt-0.5">
                                {ratings.length} {ratings.length === 1 ? 'review' : 'reviews'}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-full hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="overflow-y-auto p-4 flex-1 overscroll-contain">
                    {ratings === undefined ? (
                        // Loading state
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                            <Loader2 className="w-8 h-8 animate-spin mb-3 text-primary" />
                            <p>Loading reviews...</p>
                        </div>
                    ) : ratings.length === 0 ? (
                        // Empty state
                        <div className="flex flex-col items-center justify-center py-12 text-center">
                            <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mb-4">
                                <MessageSquare className="w-8 h-8 text-muted-foreground/30" />
                            </div>
                            <h3 className="text-lg font-semibold text-foreground mb-1">No reviews yet</h3>
                            <p className="text-muted-foreground max-w-xs mx-auto">
                                This user hasn't received any reviews from other members yet.
                            </p>
                        </div>
                    ) : (
                        // Reviews list
                        <div className="space-y-4">
                            {ratings.map((review) => (
                                <div key={review._id} className="bg-muted/50 rounded-lg p-4 transition-all hover:bg-accent border border-border">
                                    <div className="flex items-start gap-3 mb-3">
                                        {/* Avatar */}
                                        <div className="flex-shrink-0">
                                            {review.raterImage ? (
                                                <ImageDisplay
                                                    imageRef={review.raterImage}
                                                    alt={review.raterName}
                                                    className="w-10 h-10 rounded-full object-cover border border-border shadow-sm"
                                                />
                                            ) : (
                                                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm border border-border shadow-sm">
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
                                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                                    {formatDistanceToNow(new Date(review.createdAt), { addSuffix: true })}
                                                </span>
                                            </div>
                                            <div className="flex items-center gap-2 mt-0.5">
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
                                            <p className="text-foreground/80 text-sm leading-relaxed whitespace-pre-wrap italic">
                                                "{review.comment}"
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>,
        document.body
    );
}
