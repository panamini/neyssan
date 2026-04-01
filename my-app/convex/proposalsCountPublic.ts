import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public query returning the total number of saved proposals
 * for the authenticated user.
 */
export default query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_user_and_status", (q) =>
        q.eq("userId", user._id).eq("status", "saved"),
      )
      .collect();

    return proposals.filter((proposal) => proposal.status === "saved").length;
  },
});
