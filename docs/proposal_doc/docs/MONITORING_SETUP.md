# Monitoring System Setup Guide

This guide explains how to set up and configure the monitoring system for the Convex application.

## Overview

The monitoring system consists of three main components:
1. Prometheus metrics collection
2. OpenTelemetry tracing
3. Sentry error tracking

## Prerequisites

- Node.js 16+
- Convex CLI
- A Sentry account
- A Prometheus server (optional)
- An OpenTelemetry collector (optional)

## Installation

1. Install required dependencies:
```bash
npm install @sentry/node @sentry/tracing @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions prom-client
```

2. Configure environment variables in your `.env` file:
```env
# Sentry
SENTRY_DSN=your_sentry_dsn_here
NODE_ENV=development

# OpenTelemetry
OTLP_ENDPOINT=http://localhost:4318/v1/traces
```

## Configuration

The monitoring system is configured through `convex/config/monitoring.ts`. Key configuration options include:

### Performance Thresholds
```typescript
thresholds: {
  QUERY_LATENCY_MS: 200,     // P95 target for queries
  MUTATION_LATENCY_MS: 500,  // P95 target for mutations
  ERROR_RATE_THRESHOLD: 0.01 // 1% error rate threshold
}
```

### Sampling Rates
```typescript
sampling: {
  TRACE_SAMPLE_RATE: 0.3,  // 30% trace sampling
  ERROR_SAMPLE_RATE: 1.0   // 100% error sampling
}
```

### Retention Periods
```typescript
retention: {
  METRICS_RETENTION_MS: 7 * 24 * 60 * 60 * 1000,  // 7 days
  ALERTS_RETENTION_MS: 30 * 24 * 60 * 60 * 1000   // 30 days
}
```

## Usage

### Recording Metrics

```typescript
import { recordMetric } from '../monitoring';

// Record a custom metric
await recordMetric(ctx, {
  name: 'custom_metric',
  value: 42,
  metadata: {
    operation: 'custom_operation',
    status: 'success'
  }
});
```

### Performance Tracking

```typescript
import { trackPerformance } from '../monitoring';

// Track function performance
const result = await trackPerformance(
  ctx,
  'myFunction',
  async () => {
    // Your function logic here
    return someResult;
  },
  'query' // or 'mutation'
);
```

### Error Tracking

```typescript
import { trackError } from '../monitoring';

try {
  // Your code here
} catch (error) {
  trackError(error, {
    context: 'additional context'
  });
}
```

## Prometheus Metrics

The following metrics are available:

### Function Duration
```
convex_function_duration_seconds
Labels: function_name, type, status
Type: Histogram
Buckets: [0.1, 0.3, 0.5, 0.7, 1, 2, 5]
```

### Database Operations
```
convex_db_operations_total
Labels: operation, table, status
Type: Counter
```

### Memory Usage
```
convex_memory_usage_bytes
Labels: type
Type: Gauge
```

### Error Rate
```
convex_errors_total
Labels: type, function
Type: Counter
```

## Alert Configuration

Alerts are generated based on configured thresholds:

- High Latency: When function duration exceeds thresholds
- High Error Rate: When error rate exceeds 1%
- Memory Warning: When memory usage exceeds 85%
- Rate Limit: When approaching rate limits

### Alert Severity Levels
- INFO: Normal operation
- WARNING: Approaching thresholds
- ERROR: Exceeding thresholds
- CRITICAL: Severe issues

## Dashboard Setup

1. Import the Grafana dashboard template from `monitoring/dashboards/convex-overview.json`
2. Configure Prometheus as a data source in Grafana
3. Customize panels as needed

## Maintenance

### Log Rotation
Metrics are automatically cleaned up based on retention periods:
- Metrics: 7 days
- Traces: 3 days
- Alerts: 30 days

### Alert Management
- Alerts can be acknowledged via the `acknowledgeAlert` mutation
- Auto-acknowledgment after 24 hours
- Clear old alerts using `clearOldAlerts` mutation

## Troubleshooting

### Common Issues

1. High Memory Usage
```typescript
// Check current memory metrics
const metrics = await getMetrics(ctx, {
  name: 'memory_usage',
  timeRange: 3600000 // Last hour
});
```

2. Performance Issues
```typescript
// Check function durations
const metrics = await getMetrics(ctx, {
  name: 'function_duration',
  timeRange: 3600000
});
```

3. Error Tracking
```typescript
// Get active alerts
const alerts = await checkAlerts(ctx, {});
```

## Best Practices

1. Use appropriate sampling rates for your traffic volume
2. Set meaningful alert thresholds based on your SLAs
3. Regularly review and update alert configurations
4. Use structured metadata for better debugging
5. Implement gradual alert thresholds to catch issues early

## Security Considerations

1. Protect sensitive data in metrics and traces
2. Use environment-specific DSNs for Sentry
3. Implement proper access controls for metrics endpoints
4. Regularly rotate access tokens
5. Monitor for unusual patterns in error rates

## Further Reading

- [Convex Documentation](https://docs.convex.dev)
- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Prometheus Best Practices](https://prometheus.io/docs/practices/naming/)
- [Sentry Documentation](https://docs.sentry.io/)

**PROMETHEUS**

