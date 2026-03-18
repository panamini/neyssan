import { v } from "convex/values";
import type { Infer } from "convex/values";

// Mutation argument validators
export const metricArgs = v.object({
  name: v.string(),
  value: v.number(),
  labels: v.optional(v.record(v.string(), v.string())),
});

export const alertArgs = v.object({
  name: v.string(),
  severity: v.union(v.literal("info"), v.literal("warning"), v.literal("error")),
  message: v.string(),
});

export const alertIdArgs = v.object({
  alertId: v.id("alerts"),
});

// Query argument validators
export const metricsQueryArgs = v.object({
  name: v.optional(v.string()),
  startTime: v.optional(v.number()),
  endTime: v.optional(v.number()),
});

// Types inferred from validators
export type MetricArgs = Infer<typeof metricArgs>;
export type AlertArgs = Infer<typeof alertArgs>;
export type AlertIdArgs = Infer<typeof alertIdArgs>;
export type MetricsQueryArgs = Infer<typeof metricsQueryArgs>;
