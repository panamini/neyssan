import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';

export const storeProposal = internalMutation({
  args: {
    userId: v.id("userProfiles"),
    title: v.string(),
    content: v.string(),
    status: v.string(),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    sections: v.array(v.object({
      type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
      content: v.string()
    })),
    metrics: v.object({
      score: v.optional(v.number()),
      confidence: v.optional(v.number())
    }),
    metadata: v.object({
      platform: v.optional(v.string()),
      jobId: v.optional(v.string()),
      tags: v.optional(v.array(v.string()))
    })
  },
  handler: async (ctx, args) => {
    return ctx.db.insert('proposals', args);
  }
});

export const getProposal = internalQuery({
  args: {
    id: v.id('proposals')
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  }
});

export const listUserProposals = internalQuery({
  args: {
    userId: v.id("userProfiles")
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query('proposals')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .collect();
  }
});

export const updateProposal = internalMutation({
  args: {
    id: v.id('proposals'),
    sections: v.array(v.object({
      type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
      content: v.string()
    })),
    metrics: v.object({
      score: v.optional(v.number()),
      confidence: v.optional(v.number())
    }),
    metadata: v.object({
      platform: v.optional(v.string()),
      jobId: v.optional(v.string()),
      tags: v.optional(v.array(v.string()))
    }),
    status: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now()
    });
  }
});

export const deleteProposal = internalMutation({
  args: {
    id: v.id('proposals')
  },
  handler: async (ctx, args) => {
    return ctx.db.delete(args.id);
  }
});
