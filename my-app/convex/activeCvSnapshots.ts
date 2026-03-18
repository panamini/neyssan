import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const personalizationContextValidator = v.union(
  v.null(),
  v.object({
    name: v.optional(v.string()),
    summary: v.optional(v.string()),
    desiredPosition: v.optional(v.string()),
    topSkills: v.optional(v.array(v.string())),
    recentExperience: v.optional(
      v.array(
        v.object({
          company: v.optional(v.string()),
          position: v.optional(v.string()),
          highlights: v.optional(v.array(v.string())),
        })
      )
    ),
    standoutAchievements: v.optional(v.array(v.string())),
  })
);

const activeCvSnapshotValidator = v.object({
  title: v.string(),
  personalizationContext: personalizationContextValidator,
  updatedAt: v.optional(v.string()),
});

export const getCurrent = query({
  args: {},
  returns: v.union(v.null(), activeCvSnapshotValidator),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const snapshot = await ctx.db
      .query("activeCvSnapshots")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!snapshot) {
      return null;
    }

    return {
      title: snapshot.title,
      personalizationContext: snapshot.personalizationContext,
      ...(snapshot.updatedAt ? { updatedAt: snapshot.updatedAt } : {}),
    };
  },
});

export const setCurrent = mutation({
  args: {
    snapshot: v.union(v.null(), activeCvSnapshotValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("activeCvSnapshots")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (args.snapshot === null) {
      if (existing) {
        await ctx.db.delete(existing._id);
      }
      return null;
    }

    const nextDoc = {
      clerkId: identity.subject,
      title: args.snapshot.title,
      personalizationContext: args.snapshot.personalizationContext,
      ...(args.snapshot.updatedAt ? { updatedAt: args.snapshot.updatedAt } : {}),
      syncedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch(existing._id, nextDoc);
      return null;
    }

    await ctx.db.insert("activeCvSnapshots", nextDoc);
    return null;
  },
});
