import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { Id } from '../../convex/_generated/dataModel';
import { toast } from 'sonner';

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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-50 modal-scroll-lock">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-gray-900">Rate {userName}</h2>
                    <button
                        onClick={onClose}
                        className="p-1 rounded-full hover:bg-gray-100 transition-colors"
                    >
                        <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Star Rating */}
                <div className="mb-6">
                    <p className="text-sm text-gray-600 mb-3">How would you rate your experience?</p>
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
                                <svg
                                    className={`w - 10 h - 10 ${star <= displayRating
                                        ? 'text-yellow-400 fill-current'
                                        : 'text-gray-300'
                                        } transition - colors`}
                                    fill={star <= displayRating ? "currentColor" : "none"}
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={1.5}
                                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                                    />
                                </svg>
                            </button>
                        ))}
                    </div>
                    {rating > 0 && (
                        <p className="text-center text-sm text-gray-600 mt-2">
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
                    <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-2">
                        Comment (optional)
                    </label>
                    <textarea
                        id="comment"
                        value={comment}
                        onChange={(e) => setComment(e.target.value)}
                        rows={4}
                        maxLength={500}
                        placeholder="Share your experience..."
                        disabled={isSubmitting}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none resize-none disabled:opacity-50"
                    />
                    <p className="text-xs text-gray-500 mt-1">{comment.length}/500 characters</p>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isSubmitting}
                        className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleSubmit}
                        disabled={isSubmitting || rating === 0}
                        className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center justify-center gap-2">
                                <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                </svg>
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
