import { mutation, query } from './_generated/server';
import { v } from 'convex/values';


export const createAlert = mutation({
  args: {
    type: v.string(),
    severity: v.union(v.string(), v.literal('low'), v.literal('medium'), v.literal('high'), v.literal('critical')),
    message: v.string(),
    metadata: v.optional(v.record(v.string(), v.any()))
  },
  handler: async (ctx, args) => {
    const doc = {
      type: args.type,
      severity: args.severity,
      message: args.message,
      timestamp: Date.now(),
      acknowledged: false,
      resolved: false,
      metadata: args.metadata ?? {}
    };
    return await ctx.db.insert('alerts', doc);
  }
});

export const resolveAlert = mutation({
  args: {
    id: v.id('alerts')
  },
  handler: async (ctx, { id }) => {
    const alert = await ctx.db.get(id);
    if (!alert) {
      throw new Error('Alert not found');
    }
    const now = Date.now();
    return await ctx.db.patch(id, {
      resolved: true,
      resolvedAt: now
    });
  }
});

export const getActiveAlerts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('alerts')
      .withIndex('by_resolved')
      .filter(q => q.eq(q.field('resolved'), false))
      .order('desc')
      .collect();
  }
});
