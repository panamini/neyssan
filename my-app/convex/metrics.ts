/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { httpAction, internalMutation } from "./_generated/server";
import type { ActionCtx, MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { FunctionReference } from "convex/server";
import { v } from 'convex/values';
import {
  MetricsQuerySchema,
  MetricsResponseSchema,
  BaseMetricSchema,
  type ErrorResponse,
  type BaseMetric,
  type UserRole,
  METRICS_ALLOWED_ROLES,
  UserRoleSchema
} from './types/metrics';

// Environment configuration
const METRICS_RETENTION_DAYS = process.env['METRICS_RETENTION_DAYS'] ? parseInt(process.env['METRICS_RETENTION_DAYS']) : 30;

function hasRequiredRole(role: UserRole, requiredRoles: UserRole[]): boolean {
  return requiredRoles.includes(role);
}

function createErrorResponse(
  code: ErrorResponse['code'],
  message: string,
  status: number,
  details?: Record<string, any>
): Response {
  const errorResponse: ErrorResponse = { error: message, code, ...(details && { details }) };
  return new Response(JSON.stringify(errorResponse), {
    status,
    headers: { "Content-Type": "application/json" }
  });
}

async function checkAndConsumeRateLimit(
  ctx: ActionCtx,
  clientIp: string,
  endpoint: string
): Promise<void> {
  const checkRateLimit: any = internal.checkratelimit.checkRateLimit;
  const consumeRateLimit: any = internal.checkratelimit.consumeRateLimit;

  if (!checkRateLimit || !consumeRateLimit) {
    throw new Error("Rate limiter functions not found");
  }

  const rateLimit = await ctx.runAction(checkRateLimit, { key: `${endpoint}_${clientIp}`, endpoint });

  if (!rateLimit.ok) {
    throw new Error("RATE_LIMITED");
  }

  await ctx.runMutation(consumeRateLimit, { key: `${endpoint}_${clientIp}`, endpoint });
}
function validateMetric(metric: Partial<BaseMetric>): BaseMetric {
  const metricCopy = { ...metric };

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

  return BaseMetricSchema.parse(metricCopy);
}

export const getMetrics = httpAction(async (ctx: ActionCtx, request: Request): Promise<Response> => {
  try {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return createErrorResponse("UNAUTHORIZED", "Authentication required", 401);
    }

    // Parse and validate role
    const role = UserRoleSchema.parse(identity['role']);
    if (!hasRequiredRole(role, METRICS_ALLOWED_ROLES)) {
      return createErrorResponse("FORBIDDEN", "Insufficient permissions", 403);
    }

    // Parse and validate query parameters
    const url = new URL(request.url);
    const queryParams = {
      startTime: Number(url.searchParams.get("startTime")),
      endTime: Number(url.searchParams.get("endTime")),
      filter: url.searchParams.get("filter") ? JSON.parse(url.searchParams.get("filter") ?? "null") : undefined
    };
    const validatedArgs = MetricsQuerySchema.parse(queryParams);

    const clientIp = request.headers.get("X-Forwarded-For") || "unknown";
    await checkAndConsumeRateLimit(ctx, clientIp, "getMetrics");

    const minTimestamp = Date.now() - (METRICS_RETENTION_DAYS * 24 * 60 * 60 * 1000);
    if (validatedArgs.startTime < minTimestamp) {
      validatedArgs.startTime = minTimestamp;
    }

    const getMetricsInRange = internal['model']?.['metrics']?.['getMetricsInRange'] as FunctionReference<"query", "internal">;
    if (!getMetricsInRange) {
      throw new Error("getMetricsInRange function not found");
    }
    // Fetch and validate metrics
    const metrics = await ctx.runQuery(getMetricsInRange, validatedArgs);
    const validatedMetrics = (metrics as any[]).map(metric => validateMetric(metric));

    // Create type-safe response
    const response = {
      metrics: validatedMetrics,
      meta: {
        count: validatedMetrics.length,
        startTime: validatedArgs.startTime,
        endTime: validatedArgs.endTime
      }
    };

    // Validate response and return
    const validatedResponse = MetricsResponseSchema.parse(response);
    return new Response(JSON.stringify(validatedResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (error: unknown) {
    if (error instanceof Error) {
      if (error.name === "ZodError" && 'errors' in error) {
        return createErrorResponse("INVALID_REQUEST", "Invalid request parameters", 400, { details: error.errors });
      }
      if (error.message === "RATE_LIMITED") {
        return createErrorResponse("RATE_LIMITED", "Too many requests. Please try again later.", 429);
      }
    }
    console.error("Metrics endpoint error:", error);
    return createErrorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
});

export const recordMetric = internalMutation({
  args: {
    name: v.string(),
    value: v.number(),
    metadata: v.optional(v.object({})),
    labels: v.optional(v.object({}))
  },
  handler: async (ctx: MutationCtx, args) => {
    try {
      const metric = validateMetric({
        name: args.name,
        value: args.value,
        metadata: args.metadata || {},
        labels: args.labels || {},
        timestamp: Date.now()
      });
      await ctx.db.insert('metrics', metric);
    } catch (error) {
      console.error("Error recording metric:", error);
      throw error;
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
      throw error;
    }
  }
});

export const recordFunctionExecution = internalMutation({
  args: {
    functionName: v.string(),
    type: v.string(),
    durationMs: v.number(),
    status: v.string()
  },
  handler: async (ctx: MutationCtx, args) => {
    try {
      const recordMetricRef = internal['metrics']?.['recordMetric'] as FunctionReference<"mutation", "internal">;
      if (!recordMetricRef) {
        throw new Error("recordMetric function not found");
      }

      await ctx.runMutation(recordMetricRef, {
        name: 'function_duration',
        value: args.durationMs,
        metadata: {
          operation: args.functionName,
          type: args.type,
          status: args.status
        },
        labels: {
          function_name: args.functionName,
          type: args.type,
          status: args.status
        }
      });
    } catch (error) {
      console.error("Error recording function execution metric:", error);
      throw error;
    }
  }
});

export const updateActiveSessions = internalMutation({
  args: {
    count: v.number(),
    type: v.string()
  },
  handler: async (ctx: MutationCtx, args) => {
    try {
      const recordMetricRef = internal['metrics']?.['recordMetric'] as FunctionReference<"mutation", "internal">;
      if (!recordMetricRef) {
        throw new Error("recordMetric function not found");
      }

      await ctx.runMutation(recordMetricRef, {
        name: 'active_sessions',
        value: args.count,
        metadata: {
          type: args.type,
          status: 'info'
        },
        labels: {
          type: args.type
        }
      });
    } catch (error) {
      console.error("Error updating active sessions metric:", error);
      throw error;
    }
  }
});

export const recordMemoryMetrics = internalMutation({
  args: {
    heapUsed: v.optional(v.number()),
    heapTotal: v.optional(v.number()),
    rss: v.optional(v.number())
  },
  handler: async (ctx: MutationCtx, args) => {
    try {
      const recordMetricRef = internal['metrics']?.['recordMetric'] as FunctionReference<"mutation", "internal">;
      if (!recordMetricRef) {
        throw new Error("recordMetric function not found");
      }

      if (args.heapUsed !== undefined && args.heapTotal !== undefined) {
        await ctx.runMutation(recordMetricRef, {
          name: 'memory_usage',
          value: args.heapUsed / args.heapTotal,
          metadata: {
            operation: 'system',
            status: 'info',
            heapTotal: args.heapTotal,
            rss: args.rss || 0
          },
          labels: {
            type: 'heap_usage',
            status: 'info'
          }
        });
      }

      if (args.heapTotal !== undefined) {
        await ctx.runMutation(recordMetricRef, {
          name: 'memory_heap_total',
          value: args.heapTotal,
          metadata: {
            operation: 'system',
            status: 'info'
          },
          labels: {
            type: 'heap_total',
            status: 'info'
          }
        });
      }

      if (args.rss !== undefined) {
        await ctx.runMutation(recordMetricRef, {
          name: 'memory_rss',
          value: args.rss,
          metadata: {
            operation: 'system',
            status: 'info'
          },
          labels: {
            type: 'rss',
            status: 'info'
          }
        });
      }
    } catch (error) {
      console.error("Error recording memory metrics:", error);
      throw error;
    }
  }
});

export const recordError = internalMutation({
  args: {
    type: v.string(),
    functionName: v.string(),
    error: v.string()
  },
  handler: async (ctx: MutationCtx, args) => {
    try {
      const recordMetricRef = internal['metrics']?.['recordMetric'] as FunctionReference<"mutation", "internal">;
      if (!recordMetricRef) {
        throw new Error("recordMetric function not found");
      }

      await ctx.runMutation(recordMetricRef, {
        name: 'error',
        value: 1,
        metadata: {
          type: args.type,
          operation: args.functionName,
          error: args.error,
          status: 'error'
        },
        labels: {
          type: args.type,
          function: args.functionName,
          error: args.error
        }
      });
    } catch (error) {
      console.error("Error recording error metric:", error);
      throw error;
    }
  }
});
