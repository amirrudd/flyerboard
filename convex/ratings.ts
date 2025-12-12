import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { getDescopeUserId } from "./lib/auth";

/**
 * Submit or update a rating for another user
 * Users can rate each other once, but can update their rating at any time
 */
export const submitRating = mutation({
    args: {
        ratedUserId: v.id("users"),
        rating: v.number(),
        chatId: v.optional(v.id("chats")),
        comment: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getDescopeUserId(ctx);
        if (!userId) {
            throw new Error("Must be logged in to submit ratings");
        }

        // Prevent self-rating
        if (userId === args.ratedUserId) {
            throw new Error("Cannot rate yourself");
        }

        // Validate rating value (0-5, supports 0.5 increments)
        if (args.rating < 0 || args.rating > 5 || (args.rating * 2) % 1 !== 0) {
            throw new Error("Rating must be between 0 and 5 in 0.5 increments");
        }

        // Check if user has already rated this person
        const existingRating = await ctx.db
            .query("ratings")
            .withIndex("by_rater_and_rated", (q) =>
                q.eq("raterId", userId).eq("ratedUserId", args.ratedUserId)
            )
            .unique();

        const ratedUser = await ctx.db.get(args.ratedUserId);
        if (!ratedUser) {
            throw new Error("User not found");
        }

        if (existingRating) {
            // Update existing rating
            const oldRating = existingRating.rating;
            const ratingDiff = args.rating - oldRating;

            await ctx.db.patch(existingRating._id, {
                rating: args.rating,
                comment: args.comment,
                chatId: args.chatId,
                createdAt: Date.now(), // Update timestamp
            });

            // Update user's rating stats
            const newTotalRating = (ratedUser.totalRating || 0) + ratingDiff;
            const newAverageRating = newTotalRating / (ratedUser.ratingCount || 1);

            await ctx.db.patch(args.ratedUserId, {
                totalRating: newTotalRating,
                averageRating: newAverageRating,
            });

            return { success: true, updated: true };
        } else {
            // Create new rating
            await ctx.db.insert("ratings", {
                raterId: userId,
                ratedUserId: args.ratedUserId,
                rating: args.rating,
                chatId: args.chatId,
                comment: args.comment,
                createdAt: Date.now(),
            });

            // Update user's rating stats
            const newTotalRating = (ratedUser.totalRating || 0) + args.rating;
            const newRatingCount = (ratedUser.ratingCount || 0) + 1;
            const newAverageRating = newTotalRating / newRatingCount;

            await ctx.db.patch(args.ratedUserId, {
                totalRating: newTotalRating,
                ratingCount: newRatingCount,
                averageRating: newAverageRating,
            });

            return { success: true, updated: false };
        }
    },
});

/**
 * Get a user's average rating and count
 */
export const getUserRating = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const user = await ctx.db.get(args.userId);
        if (!user) {
            return null;
        }

        return {
            averageRating: user.averageRating || 0,
            ratingCount: user.ratingCount || 0,
        };
    },
});

/**
 * Check if the current user has rated a specific user
 */
export const getMyRatingFor = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const currentUserId = await getDescopeUserId(ctx);
        if (!currentUserId) {
            return null;
        }

        const rating = await ctx.db
            .query("ratings")
            .withIndex("by_rater_and_rated", (q) =>
                q.eq("raterId", currentUserId).eq("ratedUserId", args.userId)
            )
            .unique();

        if (!rating) {
            return null;
        }

        return {
            rating: rating.rating,
            comment: rating.comment,
            createdAt: rating.createdAt,
        };
    },
});

/**
 * Get all ratings received by a user (for potential future use)
 */
export const getUserRatings = query({
    args: { userId: v.id("users") },
    handler: async (ctx, args) => {
        const ratings = await ctx.db
            .query("ratings")
            .withIndex("by_rated_user", (q) => q.eq("ratedUserId", args.userId))
            .order("desc")
            .collect();

        // Get rater information for each rating
        const ratingsWithRaters = await Promise.all(
            ratings.map(async (rating) => {
                const rater = await ctx.db.get(rating.raterId);
                return {
                    ...rating,
                    raterName: rater?.name || "Unknown",
                    raterImage: rater?.image,
                };
            })
        );

        return ratingsWithRaters;
    },
});
