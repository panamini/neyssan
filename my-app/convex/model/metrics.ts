import { internalMutation, internalQuery } from "../_generated/server";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { v } from "convex/values";
import { BaseMetricSchema } from "../types/metrics";
import type { BaseMetric } from "../types/metrics";
import { internal } from "../_generated/api";
import type { FunctionReference } from "convex/server";

export interface TimeRange {
  startTime: number;
  endTime: number;
}


export interface RateLimitMetricArgs {
  operation: 'check' | 'consume';
  status: 'allowed' | 'denied';
  endpoint?: string;
}

function validateMetric(metricData: Partial<BaseMetric>): BaseMetric {
  const metricCopy = { ...metricData };

  // Handle legacy format where labels might be in metadata
  if (metricCopy.metadata?.['labels'] && !metricCopy.labels) {
    const labels = metricCopy.metadata['labels'];
    if (typeof labels === 'object' && labels !== null) {
      metricCopy.labels = Object.entries(labels).reduce((acc, [key, val]) => ({
        ...acc,
        [key]: String(val)
      }), {} as Record<string, string>);
      delete metricCopy.metadata['labels'];
    }
  }

  // Ensure labels exist
  metricCopy.labels = metricCopy.labels ?? {};

  // Preserve all metadata fields as labels for backward compatibility
  if (metricCopy.metadata) {
    Object.entries(metricCopy.metadata).forEach(([key, value]) => {
      if (typeof value === 'string' && !metricCopy.labels![key]) {
        metricCopy.labels![key] = value;
      }
    });
  }

  // Filter out undefined values from metadata
  metricCopy.metadata = Object.fromEntries(
    Object.entries(metricCopy.metadata || {}).filter(([_, v]) => v !== undefined)
  ) as Record<string, string | number>;

  return BaseMetricSchema.parse(metricCopy);
}

/**
 * Helper function to record rate limit metrics
 */
export const recordRateLimitMetric = internalMutation({
  args: {
    operation: v.union(v.literal('check'), v.literal('consume')),
    status: v.union(v.literal('allowed'), v.literal('denied')),
    endpoint: v.optional(v.string())
  },
  handler: async (ctx: MutationCtx, args) => {
    try {
      const metric = validateMetric({
        name: 'rate_limit',
        value: 1,
        metadata: {
          operation: args.operation,
          status: args.status,
          schema_version: '2.0'
        },
        labels: {
          endpoint: args.endpoint ?? 'unknown',
          status: args.status,
          operation: args.operation,
          metric_type: 'rate_limit'
        },
        timestamp: Date.now()
      });
      await ctx.db.insert('metrics', metric);
    } catch (error) {
      console.error("Error recording rate limit metric:", error);
      throw new Error("Failed to record rate limit metric");
    }
  }
});

/**
 * Query rate limit metrics within a time range
 */
export const getRateLimitMetrics = internalQuery({
  args: {
    startTime: v.number(),
    endTime: v.number(),
    endpoint: v.optional(v.string())
  },
  handler: async (ctx: QueryCtx, { startTime, endTime, endpoint }) => {
    let query = ctx.db
      .query("metrics")
      .withIndex("by_name_time")
      .filter(q => q.eq(q.field("name"), "rate_limit"))
      .filter(q => q.gte(q.field("timestamp"), startTime))
      .filter(q => q.lte(q.field("timestamp"), endTime));
    
    if (endpoint) {
      const labelFilter = { endpoint };
      query = query.filter(q => q.eq(q.field("labels"), labelFilter));
    }
    
    return await query.collect();
  }
});

/**
 * Generic function to get metrics within a time range
 */
export const getMetricsInRange = internalQuery({
  args: {
    startTime: v.number(),
    endTime: v.number(),
    filter: v.optional(v.object({
      name: v.optional(v.string()),
      labels: v.optional(v.record(v.string(), v.string()))
    }))
  },
  handler: async (ctx: QueryCtx, { startTime, endTime, filter }) => {
    let query = ctx.db
      .query("metrics")
      .withIndex("by_name_time")
      .filter(q => q.gte(q.field("timestamp"), startTime))
      .filter(q => q.lte(q.field("timestamp"), endTime));

    if (filter?.name) {
      query = query.filter(q => q.eq(q.field("name"), filter.name));
    }

    if (filter?.labels) {
      query = query.filter(q => q.eq(q.field("labels"), filter.labels));
    }

    const metrics = await query.collect();
    return metrics.map(metricData => validateMetric({
      ...metricData,
      metadata: Object.fromEntries(
        Object.entries(metricData.metadata || {}).filter(([_, v]) => v !== undefined)
      ) as Record<string, string | number>
    }));
  }
});

/**
 * Record a metric with validation and backward compatibility
 */
export const recordMetric = internalMutation({
  args: {
    name: v.string(),
    value: v.number(),
    metadata: v.optional(v.record(v.string(), v.union(v.string(), v.number()))),
    labels: v.optional(v.object({}))
  },
  handler: async (ctx: MutationCtx, args) => {
    try {
      const metric = validateMetric({
        name: args.name,
        value: args.value,
        metadata: {
          ...(args.metadata || {}),
          schema_version: '2.0'
        },
        labels: args.labels || {},
        timestamp: Date.now()
      });
      return await ctx.db.insert('metrics', metric);
    } catch (error) {
      console.error("Error recording metric:", error);
      throw new Error("Failed to record metric");
    }
  }
});

/**
 * @deprecated Use recordMetric instead with appropriate labels
 */
export const recordDBOperation = internalMutation({
  args: {
    operation: v.string(),
    table: v.string(),
    status: v.string()
  },
  handler: async (ctx: MutationCtx, args) => {
    try {
      const recordMetricRef = internal['metrics']?.['recordMetric'] as FunctionReference<"mutation", "internal">;
      if (!recordMetricRef) {
        throw new Error("recordMetric function not found");
      }

      await ctx.runMutation(recordMetricRef, {
        name: 'database_operation',
        value: 1,
        metadata: {
          operation: args.operation,
          table: args.table,
          status: args.status,
          schema_version: '2.0'
        },
        labels: {
          operation: args.operation,
          table: args.table,
          status: args.status,
          metric_type: 'database_operation'
        }
      });
    } catch (error) {
      console.error("Error recording DB operation metric:", error);
      throw new Error("Failed to record DB operation metric");
    }
  }
});
