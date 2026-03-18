import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * getProfileCount
 *
 * Returns the number of userProfiles documents for a given Clerk ID.
 * Args:
 *   - clerkId: string
 *
 * Returns:
 *   - number (0 if none)
 */
export const getProfileCount = query({
  args: {
    clerkId: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .collect(); // collect all matching rows; small expected cardinality

    return rows.length;
  },
});
