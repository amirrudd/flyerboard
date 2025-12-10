import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { requireAdmin } from "./lib/adminAuth";
import { Id } from "./_generated/dataModel";

// ============================================================================
// ADMIN QUERIES
// ============================================================================

/**
 * Get all users with pagination and optional search/filter
 */
export const getAllUsers = query({
    args: {
        searchTerm: v.optional(v.string()),
        filterStatus: v.optional(v.string()), // "active", "inactive", "verified", "all"
        paginationOpts: v.object({
            numItems: v.number(),
            cursor: v.union(v.string(), v.null()),
        }),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        let usersQuery = ctx.db.query("users");

        // Apply filters
        if (args.filterStatus === "active") {
            usersQuery = usersQuery.filter((q) => q.eq(q.field("isActive"), true));
        } else if (args.filterStatus === "inactive") {
            usersQuery = usersQuery.filter((q) => q.eq(q.field("isActive"), false));
        } else if (args.filterStatus === "verified") {
            usersQuery = usersQuery.filter((q) => q.eq(q.field("isVerified"), true));
        }

        const result = await usersQuery.order("desc").paginate(args.paginationOpts);

        // Filter by search term if provided (client-side for simplicity)
        let users = result.page;
        if (args.searchTerm) {
            const searchLower = args.searchTerm.toLowerCase();
            users = users.filter(
                (user) =>
                    user.name?.toLowerCase().includes(searchLower) ||
                    user.email?.toLowerCase().includes(searchLower)
            );
        }

        // Get ad counts for each user
        const usersWithStats = await Promise.all(
            users.map(async (user) => {
                const ads = await ctx.db
                    .query("ads")
                    .withIndex("by_user", (q) => q.eq("userId", user._id))
                    .filter((q) => q.neq(q.field("isDeleted"), true))
                    .collect();

                return {
                    ...user,
                    totalAds: ads.length,
                    activeAds: ads.filter((ad) => ad.isActive).length,
                };
            })
        );

        return {
            users: usersWithStats,
            continueCursor: result.continueCursor,
            isDone: result.isDone,
        };
    },
});

/**
 * Get all flyers with pagination and filters (including soft-deleted)
 */
export const getAllFlyers = query({
    args: {
        searchTerm: v.optional(v.string()),
        filterStatus: v.optional(v.string()), // "active", "inactive", "deleted", "all"
        categoryId: v.optional(v.id("categories")),
        paginationOpts: v.object({
            numItems: v.number(),
            cursor: v.union(v.string(), v.null()),
        }),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        // Apply category filter first (must be done before other operations)
        let flyersQuery;
        if (args.categoryId) {
            flyersQuery = ctx.db
                .query("ads")
                .withIndex("by_category", (q) => q.eq("categoryId", args.categoryId!));
        } else {
            flyersQuery = ctx.db.query("ads");
        }

        // Apply status filters
        if (args.filterStatus === "active") {
            flyersQuery = flyersQuery.filter((q) =>
                q.and(q.eq(q.field("isActive"), true), q.neq(q.field("isDeleted"), true))
            );
        } else if (args.filterStatus === "inactive") {
            flyersQuery = flyersQuery.filter((q) =>
                q.and(q.eq(q.field("isActive"), false), q.neq(q.field("isDeleted"), true))
            );
        } else if (args.filterStatus === "deleted") {
            flyersQuery = flyersQuery.filter((q) => q.eq(q.field("isDeleted"), true));
        }
        // "all" shows everything including deleted

        const result = await flyersQuery.order("desc").paginate(args.paginationOpts);

        // Get user info for each flyer
        const flyersWithUser = await Promise.all(
            result.page.map(async (flyer) => {
                const user = await ctx.db.get(flyer.userId);
                const category = await ctx.db.get(flyer.categoryId);
                return {
                    ...flyer,
                    user,
                    category,
                };
            })
        );

        // Filter by search term if provided
        let flyers = flyersWithUser;
        if (args.searchTerm) {
            const searchLower = args.searchTerm.toLowerCase();
            flyers = flyers.filter(
                (flyer) =>
                    flyer.title.toLowerCase().includes(searchLower) ||
                    flyer.description.toLowerCase().includes(searchLower) ||
                    flyer.location.toLowerCase().includes(searchLower)
            );
        }

        return {
            flyers,
            continueCursor: result.continueCursor,
            isDone: result.isDone,
        };
    },
});

/**
 * Get all reports with optional status filtering
 */
export const getAllReports = query({
    args: {
        status: v.optional(v.string()), // "pending", "reviewed", "resolved"
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        // Apply status filter (must be done at query initialization if using index)
        let reportsQuery;
        if (args.status) {
            reportsQuery = ctx.db
                .query("reports")
                .withIndex("by_status", (q) => q.eq("status", args.status!));
        } else {
            reportsQuery = ctx.db.query("reports");
        }

        const reports = await reportsQuery.order("desc").collect();

        // Enrich with reporter and reported entity info
        const reportsWithDetails = await Promise.all(
            reports.map(async (report) => {
                const reporter = await ctx.db.get(report.reporterId);

                let reportedEntity = null;
                if (report.reportType === "ad") {
                    reportedEntity = await ctx.db.get(report.reportedEntityId as Id<"ads">);
                } else if (report.reportType === "profile") {
                    reportedEntity = await ctx.db.get(report.reportedEntityId as Id<"users">);
                } else if (report.reportType === "chat") {
                    reportedEntity = await ctx.db.get(report.reportedEntityId as Id<"chats">);
                }

                return {
                    ...report,
                    reporter,
                    reportedEntity,
                };
            })
        );

        return reportsWithDetails;
    },
});

/**
 * Get detailed user information including their flyers and activity
 */
export const getUserDetails = query({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        // Get user's ads
        const ads = await ctx.db
            .query("ads")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        // Get user's chats as buyer
        const buyerChats = await ctx.db
            .query("chats")
            .withIndex("by_buyer", (q) => q.eq("buyerId", args.userId))
            .collect();

        // Get user's chats as seller
        const sellerChats = await ctx.db
            .query("chats")
            .withIndex("by_seller", (q) => q.eq("sellerId", args.userId))
            .collect();

        // Get reports submitted by user
        const reportsSubmitted = await ctx.db
            .query("reports")
            .withIndex("by_reporter", (q) => q.eq("reporterId", args.userId))
            .collect();

        // Get reports against user
        const reportsAgainst = await ctx.db
            .query("reports")
            .withIndex("by_entity", (q) => q.eq("reportedEntityId", args.userId))
            .collect();

        return {
            user,
            stats: {
                totalAds: ads.length,
                activeAds: ads.filter((ad) => ad.isActive && !ad.isDeleted).length,
                deletedAds: ads.filter((ad) => ad.isDeleted).length,
                totalViews: ads.reduce((sum, ad) => sum + ad.views, 0),
                buyerChats: buyerChats.length,
                sellerChats: sellerChats.length,
                reportsSubmitted: reportsSubmitted.length,
                reportsAgainst: reportsAgainst.length,
            },
            recentAds: ads.slice(0, 5),
        };
    },
});

/**
 * Get chat messages for moderation (admin can view any chat)
 */
export const getChatForModeration = query({
    args: {
        chatId: v.id("chats"),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const chat = await ctx.db.get(args.chatId);
        if (!chat) {
            throw new Error("Chat not found");
        }

        const [buyer, seller, ad, messages] = await Promise.all([
            ctx.db.get(chat.buyerId),
            ctx.db.get(chat.sellerId),
            ctx.db.get(chat.adId),
            ctx.db
                .query("messages")
                .withIndex("by_chat", (q) => q.eq("chatId", args.chatId))
                .order("asc")
                .collect(),
        ]);

        const messagesWithSender = await Promise.all(
            messages.map(async (message) => {
                const sender = await ctx.db.get(message.senderId);
                return {
                    ...message,
                    sender,
                };
            })
        );

        return {
            chat,
            buyer,
            seller,
            ad,
            messages: messagesWithSender,
        };
    },
});

/**
 * Check if current user is admin
 */
export const isCurrentUserAdmin = query({
    handler: async (ctx) => {
        try {
            await requireAdmin(ctx);
            return true;
        } catch {
            return false;
        }
    },
});

// ============================================================================
// ADMIN MUTATIONS
// ============================================================================

/**
 * Toggle user account status (activate/deactivate)
 */
export const toggleUserStatus = mutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        // Don't allow deactivating admin accounts
        if (user.isAdmin) {
            throw new Error("Cannot deactivate admin accounts");
        }

        const newStatus = !user.isActive;
        await ctx.db.patch(args.userId, {
            isActive: newStatus,
        });

        // If deactivating, also deactivate all their ads
        if (!newStatus) {
            const userAds = await ctx.db
                .query("ads")
                .withIndex("by_user", (q) => q.eq("userId", args.userId))
                .collect();

            for (const ad of userAds) {
                await ctx.db.patch(ad._id, { isActive: false });
            }
        }

        return { isActive: newStatus };
    },
});

/**
 * Delete user account (admin override)
 */
export const deleteUserAccount = mutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        // Don't allow deleting admin accounts
        if (user.isAdmin) {
            throw new Error("Cannot delete admin accounts");
        }

        // Soft delete all user's ads
        const userAds = await ctx.db
            .query("ads")
            .withIndex("by_user", (q) => q.eq("userId", args.userId))
            .collect();

        for (const ad of userAds) {
            await ctx.db.patch(ad._id, {
                isDeleted: true,
                isActive: false,
            });
        }

        // Delete the user
        await ctx.db.delete(args.userId);

        return { success: true };
    },
});

/**
 * Delete specific image from a flyer
 */
export const deleteFlyerImage = mutation({
    args: {
        adId: v.id("ads"),
        imageRef: v.string(),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const ad = await ctx.db.get(args.adId);
        if (!ad) {
            throw new Error("Flyer not found");
        }

        // Remove the image from the array
        const updatedImages = ad.images.filter((img) => img !== args.imageRef);

        if (updatedImages.length === ad.images.length) {
            throw new Error("Image not found in flyer");
        }

        await ctx.db.patch(args.adId, {
            images: updatedImages,
        });

        return { success: true, remainingImages: updatedImages.length };
    },
});

/**
 * Soft-delete flyer (admin override)
 */
export const deleteFlyerAdmin = mutation({
    args: {
        adId: v.id("ads"),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const ad = await ctx.db.get(args.adId);
        if (!ad) {
            throw new Error("Flyer not found");
        }

        await ctx.db.patch(args.adId, {
            isDeleted: true,
            isActive: false,
        });

        return { success: true };
    },
});

/**
 * Update report status
 */
export const updateReportStatus = mutation({
    args: {
        reportId: v.id("reports"),
        status: v.string(), // "pending", "reviewed", "resolved"
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const report = await ctx.db.get(args.reportId);
        if (!report) {
            throw new Error("Report not found");
        }

        await ctx.db.patch(args.reportId, {
            status: args.status,
        });

        return { success: true };
    },
});

/**
 * Toggle user verification status
 */
export const toggleUserVerification = mutation({
    args: {
        userId: v.id("users"),
    },
    handler: async (ctx, args) => {
        await requireAdmin(ctx);

        const user = await ctx.db.get(args.userId);
        if (!user) {
            throw new Error("User not found");
        }

        const newVerificationStatus = !user.isVerified;
        await ctx.db.patch(args.userId, {
            isVerified: newVerificationStatus,
        });

        return { isVerified: newVerificationStatus };
    },
});

/**
 * Set a user as admin (internal mutation - run via CLI)
 */
export const setAdminUser = internalMutation({
    args: {
        email: v.string(),
    },
    handler: async (ctx, args) => {
        const user = await ctx.db
            .query("users")
            .withIndex("email", (q) => q.eq("email", args.email))
            .first();

        if (!user) {
            throw new Error(`User with email ${args.email} not found`);
        }

        await ctx.db.patch(user._id, {
            isAdmin: true,
            isActive: true, // Ensure admin is active
        });

        return { success: true, userId: user._id };
    },
});
