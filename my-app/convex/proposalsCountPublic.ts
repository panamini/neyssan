import { query } from "./_generated/server";
import { v } from "convex/values";
import { listProfilesForClerk } from "./lib/userProfiles";

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

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    if (profiles.length === 0) {
      return 0;
    }

    const proposalGroups = await Promise.all(
      profiles.map((profile) =>
        ctx.db
          .query("proposals")
          .withIndex("by_user_and_status", (q) =>
            q.eq("userId", profile._id).eq("status", "saved"),
          )
          .collect(),
      ),
    );

    return proposalGroups.flat().filter((proposal) => proposal.status === "saved").length;
  },
});
