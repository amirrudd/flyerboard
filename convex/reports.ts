import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getAuthUserId } from "@convex-dev/auth/server";

/**
 * Submit a report for an ad, profile, or chat
 */
export const submitReport = mutation({
    args: {
        reportType: v.string(), // "ad", "profile", or "chat"
        reportedEntityId: v.string(), // ID of the reported item
        reason: v.string(), // Report reason category
        description: v.optional(v.string()), // Optional detailed description
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            throw new Error("Must be logged in to submit a report");
        }

        // Validate report type
        const validTypes = ["ad", "profile", "chat"];
        if (!validTypes.includes(args.reportType)) {
            throw new Error("Invalid report type");
        }

        // Validate that user is not reporting their own content
        if (args.reportType === "ad") {
            try {
                const ad = await ctx.db.get(args.reportedEntityId as any);
                if (ad && 'userId' in ad && ad.userId === userId) {
                    throw new Error("You cannot report your own listing");
                }
            } catch (error) {
                // If the ad doesn't exist or there's an error, we'll still allow the report
                // The admin can determine if it's valid
            }
        } else if (args.reportType === "profile") {
            if (args.reportedEntityId === userId) {
                throw new Error("You cannot report your own profile");
            }
        }

        // Create the report
        const reportId = await ctx.db.insert("reports", {
            reporterId: userId,
            reportType: args.reportType,
            reportedEntityId: args.reportedEntityId,
            reason: args.reason,
            description: args.description,
            status: "pending",
            createdAt: Date.now(),
        });

        return reportId;
    },
});

/**
 * Get all reports submitted by the current user
 */
export const getUserReports = query({
    args: {},
    handler: async (ctx) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return [];
        }

        const reports = await ctx.db
            .query("reports")
            .withIndex("by_reporter", (q) => q.eq("reporterId", userId))
            .collect();

        return reports;
    },
});

/**
 * Get all reports (admin only - for future use)
 */
export const getAllReports = query({
    args: {
        status: v.optional(v.string()),
    },
    handler: async (ctx, args) => {
        const userId = await getAuthUserId(ctx);
        if (!userId) {
            return [];
        }

        // TODO: Add admin check when admin system is implemented
        // For now, this query is available but would need authorization

        let reports;

        if (args.status) {
            reports = await ctx.db
                .query("reports")
                .withIndex("by_status", (q) => q.eq("status", args.status!))
                .collect();
        } else {
            reports = await ctx.db.query("reports").collect();
        }

        return reports;
    },
});
