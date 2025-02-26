# Monitoring Implementation Plan

## Overview
This document outlines the step-by-step implementation plan for integrating monitoring across our application using Prometheus, OpenTelemetry, and Sentry.

## Prerequisites Checklist
- [ ] Install dependencies:
  ```bash
  npm install @sentry/node @sentry/tracing @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http @opentelemetry/resources @opentelemetry/semantic-conventions prom-client
  ```
- [ ] Configure environment variables in `.env`:
  ```env
  SENTRY_DSN=your_sentry_dsn_here
  NODE_ENV=development
  OTLP_ENDPOINT=http://localhost:4318/v1/traces
  ```
- [ ] Import Grafana dashboard from `monitoring/dashboards/convex-overview.json`

## Phase 1: Core Infrastructure Setup (Day 1)

### 1. Database Schema Updates
- [x] Add metrics table schema
- [x] Add alerts table schema
- [x] Configure indexes for efficient querying

### 2. Monitoring Configuration
- [x] Set up monitoring thresholds
- [x] Configure sampling rates
- [x] Define retention periods

## Phase 2: Service Instrumentation (Days 2-3)

### 1. Proposal Handler Service
```typescript
// src/services/proposal-handler.ts
import { trackPerformance, recordMetric } from '../monitoring';

// Track proposal generation performance
await trackPerformance(ctx, 'generateProposal', async () => {
  // Existing logic
}, 'mutation');

// Monitor API success rates
recordMetric(ctx, {
  name: 'api_success_rate',
  value: successCount / totalCount,
  metadata: {
    operation: 'proposal_generation',
    status: 'success'
  }
});
```

### 2. Scraping Service
```typescript
// src/services/scraping-service.ts
import { trackPerformance, recordError } from '../monitoring';

// Track scraping job execution
await trackPerformance(ctx, 'scrapingJob', async () => {
  try {
    // Existing logic
  } catch (error) {
    recordError(error, {
      context: 'scraping',
      url: targetUrl
    });
    throw error;
  }
}, 'background');
```

### 3. Rate Limiting Service
```typescript
// convex/rateLimits.ts
import { recordMetric } from './monitoring';

// Monitor rate limit utilization
recordMetric(ctx, {
  name: 'rate_limit_utilization',
  value: currentUsage / limit,
  metadata: {
    operation: 'rate_limiting',
    endpoint: endpoint
  }
});
```

## Phase 3: Critical Function Monitoring (Day 4)

### 1. Database Operations
```typescript
// Track database operations
await trackPerformance(ctx, 'dbOperation', async () => {
  const result = await ctx.db.query(table).collect();
  recordMetric(ctx, {
    name: 'db_operation_size',
    value: result.length,
    metadata: {
      operation: 'query',
      table: table
    }
  });
  return result;
}, 'query');
```

### 2. External API Calls
```typescript
// Monitor external API calls
await trackPerformance(ctx, 'externalApi', async () => {
  const startTime = Date.now();
  try {
    const response = await fetch(url);
    recordMetric(ctx, {
      name: 'api_latency',
      value: Date.now() - startTime,
      metadata: {
        endpoint: url,
        status: response.status
      }
    });
    return response;
  } catch (error) {
    recordError(error, {
      context: 'external_api',
      endpoint: url
    });
    throw error;
  }
}, 'external');
```

## Phase 4: Alert Configuration (Day 5)

### 1. Performance Alerts
```typescript
// High latency alerts
if (duration > MONITORING_CONFIG.thresholds.FUNCTION_LATENCY_MS) {
  await createAlert(ctx, {
    type: 'HIGH_LATENCY',
    value: duration,
    threshold: MONITORING_CONFIG.thresholds.FUNCTION_LATENCY_MS
  });
}
```

### 2. Error Rate Alerts
```typescript
// Error rate monitoring
if (errorRate > MONITORING_CONFIG.thresholds.ERROR_RATE_THRESHOLD) {
  await createAlert(ctx, {
    type: 'HIGH_ERROR_RATE',
    value: errorRate,
    threshold: MONITORING_CONFIG.thresholds.ERROR_RATE_THRESHOLD
  });
}
```

### 3. Resource Utilization Alerts
```typescript
// Memory usage alerts
if (memoryUsage > MONITORING_CONFIG.thresholds.MEMORY_USAGE_THRESHOLD) {
  await createAlert(ctx, {
    type: 'MEMORY_WARNING',
    value: memoryUsage,
    threshold: MONITORING_CONFIG.thresholds.MEMORY_USAGE_THRESHOLD
  });
}
```

## Phase 5: Testing & Verification (Day 6)

### 1. Unit Tests
```typescript
// Test monitoring functionality
describe('Monitoring System', () => {
  it('should track performance correctly', async () => {
    const result = await trackPerformance(ctx, 'test', async () => {
      await delay(100);
      return 'success';
    });
    expect(result).toBe('success');
  });
});
```

### 2. Integration Tests
```typescript
// Test alert generation
describe('Alert System', () => {
  it('should create alerts when thresholds exceeded', async () => {
    await recordMetric(ctx, {
      name: 'test_metric',
      value: MONITORING_CONFIG.thresholds.ERROR_RATE_THRESHOLD * 2
    });
    const alerts = await checkAlerts(ctx);
    expect(alerts.length).toBeGreaterThan(0);
  });
});
```

## Phase 6: Dashboard & Visualization (Day 7)

### 1. Grafana Dashboard Setup
- Import dashboard template
- Configure data sources
- Set up alert notifications

### 2. Custom Panels
- Function duration histograms
- Error rate trends
- Resource utilization gauges
- Alert status overview

## Implementation Schedule

1. Day 1: Infrastructure Setup
   - Install dependencies
   - Configure environment
   - Set up schemas

2. Days 2-3: Service Instrumentation
   - Proposal handler monitoring
   - Scraping service tracking
   - Rate limiting metrics

3. Day 4: Critical Function Monitoring
   - Database operations
   - External API calls
   - Background jobs

4. Day 5: Alert Configuration
   - Performance thresholds
   - Error rate monitoring
   - Resource utilization

5. Day 6: Testing
   - Unit tests
   - Integration tests
   - Load testing

6. Day 7: Dashboard & Documentation
   - Grafana setup
   - Alert routing
   - Documentation updates

## Success Criteria

1. Performance Metrics
   - Function duration P95 < 200ms
   - API latency P95 < 500ms
   - Error rate < 1%

2. Monitoring Coverage
   - All critical functions instrumented
   - All external calls tracked
   - Resource utilization monitored

3. Alert Effectiveness
   - No false positives
   - Critical issues detected
   - Proper escalation

4. Dashboard Usability
   - Real-time updates
   - Clear visualizations
   - Actionable insights

## Rollback Plan

1. Code Rollback
   - Git revert monitoring changes
   - Restore previous configurations
   - Clean up database tables

2. Data Cleanup
   - Archive metrics
   - Clear alerts
   - Remove dashboard

3. Service Recovery
   - Restart services
   - Verify functionality
   - Update documentation

## Next Steps

After completing this implementation:

1. Monitor system for 2 weeks
2. Gather feedback from team
3. Adjust thresholds based on data
4. Optimize alert rules
5. Enhance dashboards
6. Document lessons learned

## Maintenance Plan

1. Weekly Tasks
   - Review alert patterns
   - Check metric growth
   - Update thresholds

2. Monthly Tasks
   - Clean old metrics
   - Update dashboards
   - Review performance

3. Quarterly Tasks
   - Audit monitoring coverage
   - Update documentation
   - Plan improvements
