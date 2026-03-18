import { internalAction, internalMutation } from './_generated/server';
import { internal } from './_generated/api';

export const initializeMonitoring = internalAction({
  args: {},
  handler: async (ctx) => {
    await ctx.runMutation(internal.scheduler.scheduleMonitoring);
  }
});

export const scheduleMonitoring = internalMutation({
  args: {},
  handler: async (ctx) => {
    await ctx.scheduler.runAfter(0, internal.monitoring.checkAlerts);
    await ctx.scheduler.runAfter(300000, internal.scheduler.scheduleMonitoring);
  }
});

export const scheduleNextCheck = internalMutation({
  args: {},
  handler: async (ctx) => {
    // Schedule next check in 5 minutes (300000 milliseconds)
    await ctx.scheduler.runAfter(300000, internal.scheduler.scheduleMonitoring);
  }
});
