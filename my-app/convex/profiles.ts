import { internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const get = internalQuery({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("clerkId"), identity.subject))
      .first();
  },
});

export const upsert = internalMutation({
  args: {
    preferences: v.object({
      writingStyle: v.string(),
      tonePreference: v.string(),
      autoSend: v.boolean(),
      rateLimits: v.optional(v.object({})),
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("clerkId"), identity.subject))
      .first();

    if (existing) {
      return ctx.db.patch(existing._id, {
        preferences: args.preferences,
        version: existing.version + 1,
        updatedAt: Date.now(),
      });
    } else {
      return ctx.db.insert("userProfiles", {
        clerkId: identity.subject,
        email: identity.email ?? "unknown@example.com",
        name: identity.name,
        preferences: args.preferences,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

export const patchProfile = internalMutation({
  args: {
    profile: v.object({
      summary: v.optional(v.string()),
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
    }),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!existing) {
      throw new Error("User profile not found");
    }

    const updates: any = {
      updatedAt: Date.now(),
      version: (existing.version || 1) + 1,
    };

    if (args.profile.summary !== undefined) updates.summary = args.profile.summary;
    if (args.profile.skills !== undefined) updates.skills = args.profile.skills;
    if (args.profile.experience !== undefined) updates.experience = args.profile.experience;
    if (args.profile.education !== undefined) updates.education = args.profile.education;

    return ctx.db.patch(existing._id, updates);
  },
});
