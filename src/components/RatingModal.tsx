import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { X, CircleNotch, Star } from '@phosphor-icons/react';

interface RatingModalProps {
    isOpen: boolean;
    onClose: () => void;
    userId: Id<"users">;
    userName: string;
    chatId?: Id<"chats">;
}

export function RatingModal({
    isOpen,
    onClose,
    userId,
    userName,
    chatId,
}: RatingModalProps) {
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const submitRating = useMutation(api.ratings.submitRating);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (rating === 0) {
            toast.error('Please select a rating');
            return;
        }

        setIsSubmitting(true);

        try {
            const result = await submitRating({
                ratedUserId: userId,
                rating,
                chatId,
                comment: comment.trim() || undefined,
            });

            toast.success(
                result.updated
                    ? 'Rating updated successfully!'
                    : 'Rating submitted successfully!'
            );

            // Reset form and close modal
            setRating(0);
            setComment('');
            onClose();
        } catch (error: any) {
            toast.error(error.message || 'Failed to submit rating');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    const displayRating = hoverRating || rating;

    return createPortal(
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-foreground/40 backdrop-blur-sm modal-scroll-lock"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rating-modal-title"
        >
            <section className="bg-card ring-1 ring-border/70 rounded-2xl shadow-card-hover max-w-md w-full p-6 sm:p-7 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <header className="flex items-start justify-between gap-4 mb-5">
                    <div>
                        <p className="kicker text-muted-foreground mb-1">Leave a review</p>
                        <h2
                            id="rating-modal-title"
                            className="font-display text-2xl font-semibold tracking-tight text-foreground"
                        >
                            Rate {userName}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close rating dialog"
                        className="text-muted-foreground hover:text-foreground rounded-full p-2 hover:bg-muted/60 transition-colors"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </header>

                {/* Star Rating */}
                <section className="mb-6">
                    <h3 className="kicker mb-3">How would you rate your experience?</h3>
                    <div className="flex gap-2 justify-center" role="radiogroup" aria-label="Star rating">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                aria-label={`Rate ${star} ${star === 1 ? 'star' : 'stars'}`}
                                aria-pressed={star <= rating}
                                className="transition-transform hover:scale-110 active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded-full"
                                disabled={isSubmitting}
                            >
                                <Star
                                    className={`w-10 h-10 transition-colors ${star <= displayRating
                                        ? 'text-yellow-400'
                                        : 'text-muted-foreground/40'
                                        }`}
                                    weight={star <= displayRating ? "fill" : "light"}
                                />
                            </button>
                        ))}
                    </div>
                    {rating > 0 && (
                        <p className="text-center text-sm font-medium text-foreground/80 mt-3 tabular">
                            {rating === 1 && "Poor"}
                            {rating === 2 && "Fair"}
                            {rating === 3 && "Good"}
                            {rating === 4 && "Very Good"}
                            {rating === 5 && "Excellent"}
                        </p>
                    )}
                </section>

                {/* Comment */}
                <section className="mb-6">
                    <label htmlFor="comment" className="kicker block mb-2">
                        Comment (optional)
                    </label>
                    <textarea
                        id="comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={4}
                        maxLength={500}
                        autoComplete="off"
                        placeholder="Share your experience..."
                        disabled={isSubmitting}
                        className="w-full px-4 py-3 rounded-2xl bg-muted/50 ring-1 ring-transparent focus:ring-ring focus:bg-card focus:outline-none transition-all resize-none disabled:opacity-50 text-foreground placeholder:text-muted-foreground/70 text-[15px] leading-relaxed"
                    />
                    <p className="text-xs text-muted-foreground mt-1 tabular">{comment.length}/500 characters</p>
                </section>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 h-11 px-4 bg-muted/40 text-foreground ring-1 ring-border hover:bg-muted/70 hover:ring-foreground/15 active:scale-[0.98] rounded-full font-medium transition-all disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={(e) => { void handleSubmit(e); }}
                        disabled={isSubmitting || rating === 0}
                        className="flex-1 h-11 px-4 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 active:scale-[0.98] transition-all font-semibold shadow-sm shadow-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <CircleNotch className="w-4 h-4 animate-spin" />
                                Submitting...
                            </span>
                        ) : (
                            "Submit Rating"
                        )}
                    </button>
                </div>
            </section>
        </div>,
        document.body
    );
}
