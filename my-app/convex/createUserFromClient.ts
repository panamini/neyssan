import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";

export default mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx): Promise<null> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    const clerkId = identity.subject;
    const email = identity.email ?? "unknown@example.com";
    const name = identity.name;
    await ctx.runMutation(internal.users.createOrUpdateUser, {
      clerkId,
      email,
      ...(name ? { name } : {}),
    });
    return null;
  },
});
