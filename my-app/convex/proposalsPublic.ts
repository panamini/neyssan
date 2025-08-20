import { query } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public query to list the most recent proposals for the authenticated user.
 * Returns up to 10 most recent proposals.
 */
export default query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("proposals"),
      _creationTime: v.number(),
      userId: v.id("userProfiles"),
      title: v.string(),
      content: v.string(),
      status: v.string(),
      updatedAt: v.number(),
      createdAt: v.number(),
      sections: v.array(
        v.object({
          type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
          content: v.string(),
        })
      ),
      metadata: v.object({
        platform: v.optional(v.string()),
        jobId: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      }),
      // optional metrics included because stored proposals include metrics
      metrics: v.object({
        score: v.optional(v.number()),
        confidence: v.optional(v.number()),
      }),
      // optional version field present on stored proposals
      version: v.optional(v.number()),
    })
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    return await ctx.db
      .query("proposals")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(10);
  },
});
