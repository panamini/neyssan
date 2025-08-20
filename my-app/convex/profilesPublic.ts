import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

/**
 * Public mutation that ingests a profile payload from an authenticated caller
 * (the extension) and patches the user's userProfiles document.
 *
 * This is intended to be called from the extension via ConvexHttpClient.mutation
 * (i.e., convex.mutation(api.profiles.ingestFromExtension, { profile }))
 */
export default mutation({
  args: {
    profile: v.object({
      name: v.optional(v.string()),
      summary: v.optional(v.string()),
      // preserve original pasted text (raw resume) if provided
      rawText: v.optional(v.string()),
      // preserve LinkedIn/original URL separately
      linkedIn: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      experience: v.optional(
        v.array(
          v.object({
            company: v.string(),
            title: v.string(),
            startDate: v.optional(v.number()),
            endDate: v.optional(v.number()),
            description: v.optional(v.string()),
          })
        )
      ),
      education: v.optional(
        v.array(
          v.object({
            school: v.string(),
            degree: v.optional(v.string()),
            fieldOfStudy: v.optional(v.string()),
            startDate: v.optional(v.number()),
            endDate: v.optional(v.number()),
          })
        )
      ),
      metadata: v.optional(
        v.object({
          source: v.optional(v.string()),
          importedAt: v.optional(v.number()),
        })
      ),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Ensure user profile exists
    await ctx.runMutation(internal.users.createOrUpdateUser, {
      clerkId: identity.subject,
      email: identity.email ?? "unknown@example.com",
      name: identity.name,
    });

    // Find existing profile
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!existing) {
      throw new Error("User profile not found after createOrUpdateUser");
    }
 
    const updates: any = {
      updatedAt: Date.now(),
      version: (existing.version || 1) + 1,
    };
 
    if (args.profile.name !== undefined) updates.name = args.profile.name;
    if (args.profile.summary !== undefined) updates.summary = args.profile.summary;
    if (args.profile.rawText !== undefined) updates.rawText = args.profile.rawText;
    if (args.profile.linkedIn !== undefined) updates.linkedIn = args.profile.linkedIn;
    if (args.profile.skills !== undefined) updates.skills = args.profile.skills;
    if (args.profile.experience !== undefined) updates.experience = args.profile.experience;
    if (args.profile.education !== undefined) updates.education = args.profile.education;
    if (args.profile.metadata !== undefined) updates.metadata = args.profile.metadata;
 
    return ctx.db.patch(existing._id, updates);
  },
});
