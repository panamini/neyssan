import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const get = query({
  args: { clerkId: v.string() }, // Add clerkId arg
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    return profile;
  },
});

export const upsert = mutation({
  args: {
    clerkId: v.string(), // Add clerkId arg
    email: v.string(),   // Add email arg
    name: v.optional(v.string()), // Add name arg
    preferences: v.object({
      writingStyle: v.string(),
      tonePreference: v.string(),
      autoSend: v.boolean(),
      rateLimits: v.optional(v.object({})),
    }),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("clerkId"), args.clerkId))
      .first();

    if (existing) {
      return ctx.db.patch(existing._id, {
        preferences: args.preferences,
        version: existing.version + 1,
        updatedAt: Date.now(),
      });
    } else {
      return ctx.db.insert("userProfiles", {
        clerkId: args.clerkId,
        email: args.email,
        name: args.name,
        preferences: args.preferences,
        version: 1,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  },
});

// Keep updatePreferences, listAll, getStats unchanged for now (not called in current flow)
export const updatePreferences = mutation({
  args: {
    writingStyle: v.optional(v.string()),
    tonePreference: v.optional(v.string()),
    autoSend: v.optional(v.boolean()),
    rateLimits: v.optional(v.object({})),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profile = await ctx.db
      .query("userProfiles")
      .filter((q) => q.eq(q.field("clerkId"), identity.subject))
      .first();

    if (!profile) {
      throw new Error("Profile not found");
    }

    const updatedPreferences = { ...profile.preferences };
    
    if (args.writingStyle !== undefined) {
      updatedPreferences.writingStyle = args.writingStyle;
    }
    if (args.tonePreference !== undefined) {
      updatedPreferences.tonePreference = args.tonePreference;
    }
    if (args.autoSend !== undefined) {
      updatedPreferences.autoSend = args.autoSend;
    }
    if (args.rateLimits !== undefined) {
      updatedPreferences.rateLimits = args.rateLimits;
    }

    return ctx.db.patch(profile._id, {
      preferences: updatedPreferences,
      updatedAt: Date.now(),
      version: profile.version + 1,
    });
  },
});

export const listAll = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authorized");
    }
    const isAdmin = false;
    if (!isAdmin) {
      throw new Error("Not authorized");
    }
    return ctx.db.query("userProfiles").collect();
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authorized");
    }
    const isAdmin = false;
    if (!isAdmin) {
      throw new Error("Not authorized");
    }

    const profiles = await ctx.db.query("userProfiles").collect();
    const stats = {
      total: profiles.length,
      autoSendEnabled: profiles.filter((p) => p.preferences.autoSend).length,
      byWritingStyle: {} as Record<string, number>,
      byTonePreference: {} as Record<string, number>,
    };

    profiles.forEach((profile) => {
      const { writingStyle, tonePreference } = profile.preferences;
      stats.byWritingStyle[writingStyle] = (stats.byWritingStyle[writingStyle] || 0) + 1;
      stats.byTonePreference[tonePreference] = (stats.byTonePreference[tonePreference] || 0) + 1;
    });

    return stats;
  },
});