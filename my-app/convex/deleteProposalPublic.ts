import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { listProfilesForClerk } from "./lib/userProfiles";

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

    const ownedProfiles = await listProfilesForClerk(ctx, identity.subject);
    const ownedProfileIds = new Set(ownedProfiles.map((profile) => String(profile._id)));

    // Verify the proposal belongs to the user
    const proposal = await ctx.db.get(args.id);
    if (!proposal) throw new Error("Proposal not found");
    if (!ownedProfileIds.has(String(proposal.userId))) {
      throw new Error("Not authorized to delete this proposal");
    }

    await ctx.db.delete(args.id);
    return { success: true };
  },
});
