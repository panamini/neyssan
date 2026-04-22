import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const HANDOFF_TTL_MS = 24 * 60 * 60 * 1000;

// Ephemeral bridge records for extension -> Proposal Forge handoff.
// These are not durable job/domain objects and may be cleaned up later.
export const create = mutation({
  args: {
    jobTitle: v.string(),
    jobDescription: v.string(),
    sourceUrl: v.optional(v.string()),
    platform: v.optional(v.string()),
  },
  returns: v.object({
    handoffId: v.string(),
    handoffToken: v.string(),
    createdAt: v.number(),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const handoffId = crypto.randomUUID();
    const handoffToken = crypto.randomUUID();
    const createdAt = Date.now();

    await ctx.db.insert("proposalHandoffs", {
      handoffId,
      handoffToken,
      clerkId: identity.subject,
      jobTitle: args.jobTitle,
      jobDescription: args.jobDescription,
      sourceUrl: args.sourceUrl,
      platform: args.platform,
      createdAt,
    });

    return { handoffId, handoffToken, createdAt };
  },
});

export const get = query({
  args: {
    handoffId: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const handoff = await ctx.db
      .query("proposalHandoffs")
      .withIndex("by_handoff_id", (q) => q.eq("handoffId", args.handoffId))
      .unique();

    if (!handoff) {
      return null;
    }

    if (handoff.clerkId !== identity.subject) {
      return null;
    }

    if (Date.now() - handoff.createdAt > HANDOFF_TTL_MS) {
      return null;
    }

    return {
      handoffId: handoff.handoffId,
      jobTitle: handoff.jobTitle,
      jobDescription: handoff.jobDescription,
      sourceUrl: handoff.sourceUrl,
      platform: handoff.platform,
      createdAt: handoff.createdAt,
    };
  },
});

export const getPublic = query({
  args: {
    handoffId: v.string(),
    handoffToken: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      handoffId: v.string(),
      jobTitle: v.string(),
      jobDescription: v.string(),
      sourceUrl: v.optional(v.string()),
      platform: v.optional(v.string()),
    }),
  ),
  handler: async (ctx, args) => {
    const handoff = await ctx.db
      .query("proposalHandoffs")
      .withIndex("by_handoff_id", (q) => q.eq("handoffId", args.handoffId))
      .unique();

    if (!handoff) {
      return null;
    }

    if (handoff.handoffToken !== args.handoffToken) {
      return null;
    }

    if (Date.now() - handoff.createdAt > HANDOFF_TTL_MS) {
      return null;
    }

    return {
      handoffId: handoff.handoffId,
      jobTitle: handoff.jobTitle,
      jobDescription: handoff.jobDescription,
      sourceUrl: handoff.sourceUrl,
      platform: handoff.platform,
    };
  },
});
