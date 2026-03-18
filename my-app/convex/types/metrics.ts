import { z } from 'zod';
import type { Doc } from "../_generated/dataModel";

// Environment configuration schema
export const MetricsEnvSchema = z.object({
  RATE_LIMIT_WINDOW_MS: z.number().default(60000), // 1 minute default
  RATE_LIMIT_MAX_REQUESTS: z.number().default(100),
  METRICS_RETENTION_DAYS: z.number().default(30),
});

// Rate limit specific schemas
export const RateLimitOperationSchema = z.enum(['check', 'consume']);
export const RateLimitStatusSchema = z.enum(['allowed', 'denied']);

// Metric label validation schema
export const MetricLabelsSchema = z.record(z.string(), z.string());

// Metadata validation schema
export const MetricMetadataSchema = z.record(
  z.string(),
  z.union([z.string(), z.number()])
);

// Base metric schema matching our database structure
export const BaseMetricSchema = z.object({
  name: z.string(),
  value: z.number(),
  timestamp: z.number(),
  labels: MetricLabelsSchema,
  metadata: MetricMetadataSchema,
});

// HTTP Query parameters schema
export const MetricsQuerySchema = z.object({
  startTime: z.number(),
  endTime: z.number(),
  filter: z.object({
    name: z.string().optional(),
    labels: MetricLabelsSchema.optional(),
  }).optional(),
});

// Response schema with pagination support
export const MetricsResponseSchema = z.object({
  metrics: z.array(BaseMetricSchema),
  meta: z.object({
    count: z.number(),
    startTime: z.number(),
    endTime: z.number(),
    hasMore: z.boolean().optional(),
    cursor: z.string().optional(),
  }),
});

// Rate limit response schema
export const RateLimitResponseSchema = z.object({
  ok: z.boolean(),
  remaining: z.number(),
  reset: z.number().optional(),
  retryAfter: z.number().optional(),
});

// Error response schema with detailed error codes
// User roles for metrics access
export const UserRoleSchema = z.enum(['admin', 'readonly', 'user']);
export type UserRole = z.infer<typeof UserRoleSchema>;

// Allowed roles configuration
export const METRICS_ALLOWED_ROLES: UserRole[] = ['admin', 'readonly'];

export const ErrorResponseSchema = z.object({
  error: z.string(),
  code: z.enum([
    'UNAUTHORIZED',
    'FORBIDDEN',
    'RATE_LIMITED',
    'INVALID_REQUEST',
    'INTERNAL_ERROR',
    'NOT_FOUND'
  ]),
  details: z.record(z.string(), z.any()).optional(),
});

// Types
export type MetricsEnv = z.infer<typeof MetricsEnvSchema>;
export type MetricLabels = z.infer<typeof MetricLabelsSchema>;
export type MetricMetadata = z.infer<typeof MetricMetadataSchema>;
export type BaseMetric = z.infer<typeof BaseMetricSchema>;
export type MetricsQuery = z.infer<typeof MetricsQuerySchema>;
export type MetricsResponse = z.infer<typeof MetricsResponseSchema>;
export type RateLimitResponse = z.infer<typeof RateLimitResponseSchema>;
export type RateLimitOperation = z.infer<typeof RateLimitOperationSchema>;
export type RateLimitStatus = z.infer<typeof RateLimitStatusSchema>;
export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// Database document types
export interface MetricDoc extends Doc<"metrics"> {
  name: string;
  value: number;
  timestamp: number;
  labels: Record<string, string>;
  metadata: Record<string, string | number>;
}
