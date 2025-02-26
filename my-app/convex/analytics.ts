import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
// import { createTimestamps } from "./types";
// import { Id } from "./_generated/dataModel";



/**
 * Record a new metric
 */
export const recordMetric = internalMutation({
  args: {
    metric: v.string(),
    value: v.number(),
    tags: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    // const timestamps = createTimestamps();

    return ctx.db.insert("analytics", {
      metric: args.metric,
      value: args.value,
      tags: args.tags,
      timestamp: now,
    });
  },
});

/**
 * Get metrics for a specific time range
 */
export const getMetrics = internalQuery({
  args: {
    metric: v.string(),
    startTime: v.number(),
    endTime: v.number(),
    tags: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    // First get metrics by time range
    const metrics = await ctx.db
      .query("analytics")
      .filter((q) => q.eq(q.field("metric"), args.metric))
      .filter((q) =>
        q.and(
          q.gte(q.field("timestamp"), args.startTime),
          q.lt(q.field("timestamp"), args.endTime)
        )
      )
      .collect();

    // Then filter by tags in memory since Convex doesn't support array containment queries
    if (args.tags && args.tags.length > 0) {
      return metrics.filter((metric) =>
        args.tags!.every((tag) => metric.tags.includes(tag))
      );
    }

    return metrics;
  },
});

/**
 * Get metric statistics
 */
export const getMetricStats = query({
  args: {
    metric: v.string(),
    timeRange: v.number(), // Time range in milliseconds
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // TODO: Implement proper admin check
    const isAdmin = false;
    if (!isAdmin) {
      throw new Error("Not authorized");
    }

    const now = Date.now();
    const startTime = now - args.timeRange;

    const metrics = await ctx.db
      .query("analytics")
      .filter((q) => q.eq(q.field("metric"), args.metric))
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .collect();

    if (metrics.length === 0) {
      return {
        count: 0,
        sum: 0,
        avg: 0,
        min: 0,
        max: 0,
        tags: {},
      };
    }

    const stats = metrics.reduce(
      (acc, metric) => {
        // Update basic stats
        acc.count++;
        acc.sum += metric.value;
        acc.min = Math.min(acc.min, metric.value);
        acc.max = Math.max(acc.max, metric.value);

        // Count occurrences by tag
        metric.tags.forEach((tag) => {
          acc.tags[tag] = (acc.tags[tag] || 0) + 1;
        });

        return acc;
      },
      {
        count: 0,
        sum: 0,
        min: Infinity,
        max: -Infinity,
        tags: {} as Record<string, number>,
      }
    );

    return {
      ...stats,
      avg: stats.count > 0 ? stats.sum / stats.count : 0,
    };
  },
});

/**
 * Clean up old metrics
 */
export const cleanupMetrics = internalMutation({
  args: {
    beforeTimestamp: v.number(),
  },
  handler: async (ctx, args) => {
    const oldMetrics = await ctx.db
      .query("analytics")
      .filter((q) => q.lt(q.field("timestamp"), args.beforeTimestamp))
      .collect();

    await Promise.all(
      oldMetrics.map((metric) => ctx.db.delete(metric._id))
    );

    return oldMetrics.length;
  },
});
