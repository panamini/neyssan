import { mutation, query } from './_generated/server';
import { v } from "convex/values";
import { internal } from './_generated/api';
import * as Monitoring from './monitoring';

export const trackError = mutation({
  args: {
    error: v.string()
  },
  handler: async (_ctx, args) => {
    return Monitoring.trackError(new Error(args.error));
  }
});

export const healthCheck = mutation({
  args: {},
  handler: async (ctx: any): Promise<{ status: string }> => {
    try {
      await ctx.runMutation(internal.metrics.recordMetric, {
        name: 'health_check',
        value: 1,
        metadata: {
          operation: 'health_check',
          status: 'success'
        },
        labels: {}
      });
      return { status: 'healthy' };
    } catch (error: any) {
      await ctx.runMutation(internal.metrics.recordMetric, {
        name: 'error',
        value: 1,
        metadata: {
          error: 'Health check failed: ' + error.message,
          type: 'health_check',
          status: 'error'
        },
        labels: {}
      });
      return { status: 'unhealthy' };
    }
  }
});

export { default as generateProposal } from "./generateProposalMutation";
export { default as createUserFromClient } from "./createUserFromClient";

export const ping = mutation({
  args: {
    service: v.optional(v.string())
  },
  handler: async (ctx: any, args): Promise<{ pong: boolean; service: string | undefined }> => {
    try {
      await ctx.runMutation(internal.metrics.recordMetric, {
        name: 'ping',
        value: 1,
        metadata: {
          operation: 'ping',
          status: 'success'
        },
        labels: {}
      });
      return { pong: true, service: args.service };
    } catch (error: any) {
      await ctx.runMutation(internal.metrics.recordMetric, {
        name: 'error',
        value: 1,
        metadata: {
          error: 'Ping failed: ' + error.message,
          type: 'ping',
          status: 'error'
        },
        labels: {}
      });
      return { pong: false, service: args.service };
    }
  }
});

export const getHealth = query({
  args: {},
  handler: async (ctx) => {
    try {
      const recentMetrics = await ctx.db
        .query('metrics')
        .withIndex('by_name_time', q => 
          q.eq('name', 'health_check')
           .gte('timestamp', Date.now() - 300000)
        )
        .collect();

      return {
        status: recentMetrics.length > 0 ? 'healthy' : 'unknown',
        lastCheck: recentMetrics[0]?.timestamp ?? null
      };
    } catch (error) {
      console.error('Health check query failed:', error);
      return { status: 'error', lastCheck: null };
    }
  }
});
