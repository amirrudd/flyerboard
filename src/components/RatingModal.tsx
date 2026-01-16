import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { toast } from 'sonner';
import { X, Loader2, Star } from 'lucide-react';

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

    const handleStarClick = (value: number) => {
        // Allow half-star ratings by clicking on left/right half of star
        setRating(value);
    };

    const handleStarHover = (value: number) => {
        setHoverRating(value);
    };

    const handleMouseLeave = () => {
        setHoverRating(0);
    };

    if (!isOpen) return null;

    const displayRating = hoverRating || rating;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm modal-scroll-lock">
            <div className="bg-card border border-border rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Rate {userName}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-accent transition-colors"
                    >
                        <X className="w-5 h-5 text-muted-foreground" />
                    </button>
                </div>

                {/* Star Rating */}
                <div className="mb-6">
                    <p className="text-sm text-muted-foreground mb-3">How would you rate your experience?</p>
                    <div className="flex gap-2 justify-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                            <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                onMouseEnter={() => setHoverRating(star)}
                                onMouseLeave={() => setHoverRating(0)}
                                className="transition-transform hover:scale-110 focus:outline-none"
                                disabled={isSubmitting}
                            >
                                <Star
                                    className={`w-10 h-10 transition-colors ${star <= displayRating
                                        ? 'text-yellow-400'
                                        : 'text-muted'
                                        }`}
                                    fill={star <= displayRating ? "currentColor" : "none"}
                                    strokeWidth={1.5}
                                />
                            </button>
                        ))}
                    </div>
                    {rating > 0 && (
                        <p className="text-center text-sm text-muted-foreground mt-2">
                            {rating === 1 && "Poor"}
                            {rating === 2 && "Fair"}
                            {rating === 3 && "Good"}
                            {rating === 4 && "Very Good"}
                            {rating === 5 && "Excellent"}
                        </p>
                    )}
                </div>

                {/* Comment */}
                <div className="mb-6">
                    <label htmlFor="comment" className="block text-sm font-medium text-muted-foreground mb-2">
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
                        className="w-full px-3 py-2 border border-input rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none disabled:opacity-50 bg-background text-foreground placeholder:text-muted-foreground"
                    />
                    <p className="text-xs text-muted-foreground mt-1">{comment.length}/500 characters</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 border border-input text-foreground rounded-lg hover:bg-accent transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || rating === 0}
                        className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:opacity-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Submitting...
                            </span>
                        ) : (
                            "Submit Rating"
                        )}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
}
