import { internalMutation } from "./_generated/server";

/**
 * Update Rent & Hire icon from CalendarClock to Handshake
 * Run once to update the existing category
 */
export const updateRentHireIcon = internalMutation({
    args: {},
    handler: async (ctx) => {
        const category = await ctx.db
            .query("categories")
            .withIndex("by_slug", (q) => q.eq("slug", "rent-hire"))
            .first();

        if (category) {
            await ctx.db.patch(category._id, { icon: "Handshake" });
            return {
                success: true,
                message: "Updated Rent & Hire icon to Handshake",
                categoryId: category._id,
            };
        }

        return {
            success: false,
            message: "Rent & Hire category not found",
        };
    },
});
