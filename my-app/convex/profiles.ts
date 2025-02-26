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