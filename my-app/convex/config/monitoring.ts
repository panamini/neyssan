export const MONITORING_CONFIG = {
  thresholds: {
    QUERY_LATENCY_MS: 200,     // P95 target for queries
    MUTATION_LATENCY_MS: 500,  // P95 target for mutations
    ERROR_RATE_THRESHOLD: 0.01, // 1% error rate threshold
    MEMORY_USAGE_THRESHOLD: 0.85 // 85% memory usage threshold
  },
  sampling: {
    TRACE_SAMPLE_RATE: 0.3,  // 30% trace sampling
    ERROR_SAMPLE_RATE: 1.0   // 100% error sampling
  },
  retention: {
    METRICS_RETENTION_MS: 7 * 24 * 60 * 60 * 1000,  // 7 days
    ALERTS_RETENTION_MS: 30 * 24 * 60 * 60 * 1000   // 30 days
  }
};
