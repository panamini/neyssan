import { mutation, query } from '../_generated/server';
import { v } from 'convex/values';
 

// Strict metadata type matching schema
const metricMetadataValidator = v.optional(
  v.object({
    operation: v.optional(v.string()),
    status: v.optional(v.string()),
    error: v.optional(v.string()),
    type: v.optional(v.string()),
    table: v.optional(v.string()),
    heapTotal: v.optional(v.number()),
    rss: v.optional(v.number()),
    functionType: v.optional(v.string()),
    labels: v.optional(v.any())
  })
);

export const recordMetric = mutation({
  args: {
    name: v.string(),
    value: v.number(),
    metadata: metricMetadataValidator,
    labels: v.optional(v.object({})),
    timestamp: v.optional(v.number())
  },
  handler: async (ctx, { name, value, metadata, labels, timestamp }) => {
    const doc = {
      name,
      value,
      timestamp: timestamp || Date.now(),
      labels: labels || {}, // Required empty object for backward compatibility
      metadata: metadata || {}
    };

    return await ctx.db.insert('metrics', doc);
  }
});

export const createAlert = mutation({
  args: {
    type: v.string(),
    severity: v.string(),
    message: v.string(),
    metadata: v.optional(v.object({}))
  },
  handler: async (ctx, { type, severity, message, metadata }) => {
    const doc = {
      type,
      severity,
      message,
      timestamp: Date.now(), // Add this line back
      acknowledged: false, // System-managed field
      resolved: false, // System-managed field
      metadata: metadata || {}
    };

    return await ctx.db.insert('alerts', doc);
  }
});

export const getActiveAlerts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('alerts')
      .withIndex('by_resolved')
      .filter(q => q.eq(q.field('resolved'), false))
      .collect();
  }
});
