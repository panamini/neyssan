import { RateLimiter, MINUTE } from "@convex-dev/rate-limiter";
import { internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { components } from "./_generated/api";
import { internal } from "./_generated/api";

const rateLimiter = new RateLimiter(components.rateLimiter, {
  authRequests: { kind: "token bucket", rate: 100, period: MINUTE },
});

export const checkRateLimit = internalAction({
  args: { 
    key: v.string(),
    endpoint: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const result = await rateLimiter.check(ctx, "authRequests", { key: args.key });
    
    
    // Record the check in metrics if endpoint is provided
    if (args.endpoint) {
      await ctx.runMutation(internal.metrics.recordMetric, {
        name: 'rate_limit',
        value: 1,
        metadata: {
          operation: 'check',
          status: result.ok ? 'allowed' : 'denied'
        },
        labels: {
          endpoint: args.endpoint,
          status: result.ok ? 'allowed' : 'denied'
        }
      });
    }
    
    return result;
  },
});

export const consumeRateLimit = internalMutation({
  args: { 
    key: v.string(),
    endpoint: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const result = await rateLimiter.limit(ctx, "authRequests", { key: args.key, throws: true });

    
    // Record the consumption in metrics if endpoint is provided
    if (args.endpoint) {
      await ctx.runMutation(internal.metrics.recordMetric, {
        name: 'rate_limit',
        value: 1,
        metadata: {
          operation: 'consume',
          status: result.ok ? 'allowed' : 'denied'
        },
        labels: {
          endpoint: args.endpoint,
          status: result.ok ? 'allowed' : 'denied'
        }
      });
    }
    
    return result;
  },
});
