# Monitoring System Guide

## Overview

The monitoring system provides comprehensive tracking of application performance, memory usage, errors, and custom metrics using Convex as the data store and Sentry for error tracking.

## Features

- Performance tracking with automatic duration measurements
- Memory usage monitoring with automatic alerts
- Error tracking with Sentry integration
- Custom metric recording with metadata support
- Alert management system

## Database Schema

### Metrics Table

```typescript
metrics: defineTable({
  name: v.string(),
  value: v.number(),
  metadata: v.object({
    operation: v.optional(v.string()),
    status: v.optional(v.string()),
    error: v.optional(v.string()),
    type: v.optional(v.string()),
    table: v.optional(v.string()),
    heapTotal: v.optional(v.number()),
    rss: v.optional(v.number()),
    functionType: v.optional(v.string())
  }),
  timestamp: v.number()
}).index("by_name_time", ["name", "timestamp"])
```

### Alerts Table

```typescript
alerts: defineTable({
  type: v.string(),
  value: v.number(),
  threshold: v.number(),
  acknowledged: v.boolean(),
  timestamp: v.number()
}).index("by_status", ["acknowledged"])
```

## Usage Guide

### Performance Tracking

Track the duration of any async operation:

```typescript
import { trackPerformance } from "../model/monitoring";

// In your mutation:
const result = await trackPerformance(ctx, "database_query", async () => {
  // Your operation here
  const result = await performDatabaseOperation();
  return result;
});
```

The system will automatically:
- Measure the operation duration
- Record success/failure status
- Include error information if the operation fails

### Memory Monitoring

Monitor heap usage and automatically create alerts:

```typescript
import { recordMemoryUsage } from "../model/monitoring";

// In your scheduled task or health check:
await recordMemoryUsage(ctx);
```

This will:
- Record current memory usage metrics
- Create alerts if usage exceeds thresholds
- Track heap and RSS metrics

### Error Tracking

Track errors with optional context:

```typescript
import { trackError } from "../model/monitoring";

try {
  // Your code here
} catch (error) {
  await trackError({
    message: error.message,
    stack: error.stack,
    context: {
      userId: "123",
      operation: "user_update",
      additionalInfo: "Custom context"
    }
  });
}
```

### Custom Metrics

Record custom metrics with metadata:

```typescript
import { recordMetric } from "../model/monitoring";

await recordMetric(ctx, {
  name: "api_latency",
  value: responseTime,
  metadata: {
    operation: "user_lookup",
    status: "success",
    type: "api_call"
  }
});
```

### Alert Management

Query active alerts:

```typescript
import { getActiveAlerts } from "../model/monitoring";

const activeAlerts = await getActiveAlerts(ctx);
```

## Configuration

Alert thresholds and other settings can be configured in `config/monitoring.ts`:

```typescript
export const MONITORING_CONFIG = {
  thresholds: {
    QUERY_LATENCY_MS: 1000,    // Alert if query takes longer than 1 second
    MEMORY_USAGE_THRESHOLD: 0.8 // Alert if heap usage exceeds 80%
  }
};
```

## Testing

The monitoring system includes comprehensive tests covering:
- Metric recording
- Performance tracking
- Memory monitoring
- Alert management
- Error tracking

Run the tests:

```bash
npm test src/__tests__/convex/monitoring.test.ts
```

## Best Practices

1. **Performance Tracking**
   - Use `trackPerformance` for any long-running operations
   - Include meaningful operation names for better tracking

2. **Error Tracking**
   - Always include relevant context with errors
   - Use structured error messages for better searchability

3. **Custom Metrics**
   - Use consistent naming conventions for metrics
   - Include relevant metadata for better analysis
   - Consider adding indexes for frequently queried metadata fields

4. **Memory Monitoring**
   - Schedule regular memory usage checks
   - Adjust thresholds based on application needs
   - Monitor alert trends to identify memory leaks

## Type Safety

The monitoring system is fully typed with TypeScript:

```typescript
interface MetricData {
  name: string;
  value: number;
  metadata?: {
    operation?: string;
    status?: string;
    error?: string;
    type?: string;
    table?: string;
    heapTotal?: number;
    rss?: number;
    functionType?: string;
  };
}

interface AlertData {
  type: string;
  value: number;
  threshold: number;
  acknowledged?: boolean;
  timestamp: number;
}

interface ErrorData {
  message: string;
  stack?: string;
  context?: Record<string, any>;
}
```

## Integration with Other Systems

### Sentry Integration

Error tracking is integrated with Sentry for production monitoring:

```typescript
import * as Sentry from "@sentry/node";

// Automatically sends errors to Sentry with context
await trackError({
  message: error.message,
  stack: error.stack,
  context: errorContext
});
```

### Metrics Dashboard

Metrics can be queried and visualized using the Convex dashboard or external tools:

```typescript
// Example query for latency metrics
const latencyMetrics = await ctx.db
  .query("metrics")
  .withIndex("by_name_time", q => q.eq("name", "api_latency"))
  .collect();
```

## Maintenance

- Regularly review and adjust alert thresholds
- Monitor alert frequency and patterns
- Clean up old metrics data as needed
- Update Sentry configuration as needed
- Review error tracking patterns for systemic issues
