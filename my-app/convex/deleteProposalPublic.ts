import { mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Public mutation to delete a proposal owned by the authenticated user.
 * Args:
 *  - id: Id<"proposals">
 */
export default mutation({
  args: {
    id: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Find the userProfile for the current Clerk user
    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    // Verify the proposal belongs to the user
    const proposal = await ctx.db.get(args.id);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.userId !== user._id) throw new Error("Not authorized to delete this proposal");

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
