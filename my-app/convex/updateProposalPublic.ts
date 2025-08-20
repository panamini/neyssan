import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public mutation to update a proposal owned by the authenticated user.
 * Args:
 *  - id: Id<"proposals">
 *  - content: string
 *  - sections: array of { type, content }
 */
export default mutation({
  args: {
    id: v.id("proposals"),
    content: v.string(),
    sections: v.array(
      v.object({
        type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
        content: v.string(),
      })
    ),
    status: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        platform: v.optional(v.string()),
        jobId: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const proposal = await ctx.db.get(args.id);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.userId !== user._id) throw new Error("Not authorized to update this proposal");

    await ctx.db.patch(args.id, {
      content: args.content,
      sections: args.sections,
      status: args.status ?? proposal.status,
      metadata: args.metadata ?? proposal.metadata,
      updatedAt: Date.now(),
      version: (proposal.version ?? 1) + 1,
    });

    return { success: true };
  },
});
