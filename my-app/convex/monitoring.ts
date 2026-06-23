/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { internalMutation, internalQuery } from './_generated/server';
import { v } from 'convex/values';
import { internal } from "./_generated/api";

export const trackError = (error: Error) => {
  console.error("Error tracked:", error);
  // TODO: Implement proper error tracking logic here
};

const metadataValidator = v.object({
  operation: v.optional(v.string()),
  status: v.optional(v.string()),
  error: v.optional(v.string()),
  type: v.optional(v.string()),
  table: v.optional(v.string()),
  heapTotal: v.optional(v.number()),
  rss: v.optional(v.number()),
  functionType: v.optional(v.string())
});

export const getMetrics = internalQuery({
  args: {
    startTime: v.number(),
    endTime: v.number()
  },
  handler: async (ctx, { startTime, endTime }) => {
    const metrics = await ctx.db
      .query('metrics')
      .withIndex('by_name_time')
      .filter(q => q.gte(q.field('timestamp'), startTime))
      .filter(q => q.lte(q.field('timestamp'), endTime))
      .collect();

    return metrics.map(metric => ({
      ...metric,
      name: metric.name,
      value: metric.value,
      timestamp: metric.timestamp,
      metadata: metric.metadata,
      labels: metric.labels || {},
      _id: metric._id,
      _creationTime: metric._creationTime
    }));
  }
});

export const recordMetric = internalMutation({
  args: {
    name: v.string(),
    value: v.number(),
    metadata: v.optional(metadataValidator)
  },
  handler: async (ctx, args) => {
    // Directly insert the metric into the database
    return await ctx.db.insert("metrics", {
      name: args.name,
      value: args.value,
      timestamp: Date.now(),
      labels: { ...(args.metadata as any) },
      metadata: args.metadata || {}
    });
  }
});

export const createAlert = internalMutation({
  args: {
    type: v.string(),
    severity: v.string(),
    message: v.string(),
    metadata: v.optional(v.object({}))
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("alerts", {
      type: args.type,
      severity: args.severity,
      message: args.message,
      metadata: args.metadata ?? {},
      resolved: false,
      acknowledged: false,
      timestamp: Date.now()
    });
  }
});

export const resolveAlert = internalMutation({
  args: {
    id: v.id('alerts')
  },
  handler: async (ctx, { id }) => {
    const now = Date.now();
    return await ctx.db.patch(id, {
      resolved: true,
      resolvedAt: now
    });
  }
});

export const getActiveAlerts = internalQuery({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query('alerts')
      .withIndex('by_resolved')
      .filter(q => q.eq(q.field('resolved'), false))
      .collect();
  }
});

export const checkAlerts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const activeAlerts = await ctx.runQuery(internal.monitoring.getActiveAlerts, {});

    console.log("Checking active alerts:", activeAlerts);

    const endTime = Date.now();
    const startTime = endTime - 5 * 60 * 1000; // Last 5 minutes
    const recentMetrics = await ctx.runQuery(internal.monitoring.getMetrics, { startTime, endTime });

    const thresholds: Record<string, number> = {
      cpu_usage: 80,
      memory_usage: 90,
      // Add more metrics and their thresholds as needed
    };

    for (const metric of recentMetrics) {
      const threshold = thresholds[metric.name] || 100;

      const existingAlert = activeAlerts.find(
        (alert: { type: string; _id: string }) => alert.type === `${metric.name}_threshold_exceeded`
      );

      if (metric.value > threshold) {
        if (!existingAlert) {
          await ctx.runMutation(internal.monitoring.createAlert, {
            type: `${metric.name}_threshold_exceeded`,
            severity: "warning",
            message: `${metric.name} exceeded threshold: ${metric.value} > ${threshold}`,
            metadata: {
              metricName: metric.name,
              currentValue: metric.value,
              threshold
            }
          });
        }
      } else {
        if (existingAlert) {
          await ctx.runMutation(internal.monitoring.resolveAlert, {
            id: existingAlert._id
          });
        }
      }
    }

    await ctx.runMutation(internal.monitoring.recordMetric, {
      name: "alert_check_run",
      value: 1,
      metadata: {
        operation: "checkAlerts",
        status: "completed"
      }
    });
  },
});
