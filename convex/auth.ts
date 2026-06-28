import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { Password } from "@convex-dev/auth/providers/Password";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { query } from "./_generated/server";

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Password, Anonymous],
  callbacks: {
    async createOrUpdateUser(ctx, args) {
      if (args.existingUserId) {
        return args.existingUserId;
      }
      const email = args.profile.email;
      if (email) {
        const existingUser = await ctx.db
          .query("users")
          // @ts-expect-error -- "email" index is defined in the auth tables but not surfaced in the generated types here
          .withIndex("email", (q) => q.eq("email", email))
          .first();
        if (existingUser) {
          throw new Error("A user with this email already exists.");
        }
      }
      return ctx.db.insert("users", args.profile);
    },
  },
});

export const loggedInUser = query({
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const user = await ctx.db.get(userId);
    if (!user) {
      return null;
    }
    return user;
  },
});
