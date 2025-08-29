import { query } from "../_generated/server";
import { v } from "convex/values";

/**
 * getLatestCV
 *
 * Returns the most recently created userProfiles document for a given Clerk ID.
 * Args:
 *   - clerkId: string
 *
 * Returns:
 *   - The latest userProfiles row (any) or null if none found.
 *
 * Notes:
 *   - This query uses the schema index `by_clerk_id` defined in convex/schema.ts.
 *   - We return `v.any()` to remain flexible about the profile shape; callers should
 *     validate/shape the data on the client side.
 */
export const getLatestCV = query({
  args: {
    clerkId: v.string(),
  },
  returns: v.union(v.any(), v.null()),
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .order("desc") // order by _creationTime by default, but schema has createdAt field - ordering here uses default if createdAt not in index ordering
      .take(1);

    if (!rows || rows.length === 0) return null;
    return rows[0];
  },
});
