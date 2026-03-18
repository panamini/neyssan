import type { ProposalResult, ProposalMetrics } from '../types';

export interface PerformanceMetrics {
  averageDuration: number;
  successRate: number;
  totalCalls: number;
  cacheHitRate: number;
}

class MetricsTracker {
  private metrics: {
    durations: number[];
    successes: number;
    failures: number;
    cacheHits: number;
    totalCalls: number;
  };

  constructor() {
    this.metrics = {
      durations: [],
      successes: 0,
      failures: 0,
      cacheHits: 0,
      totalCalls: 0,
    };
  }

  trackProposal(result: ProposalResult): void {
    this.metrics.totalCalls++;
    
    if (result.metrics.success) {
      this.metrics.successes++;
    } else {
      this.metrics.failures++;
    }

    this.metrics.durations.push(result.metrics.duration);

    if (result.metadata.fromCache) {
      this.metrics.cacheHits++;
    }
  }

  getMetrics(): PerformanceMetrics {
    const totalDuration = this.metrics.durations.reduce((a, b) => a + b, 0);
    const averageDuration = this.metrics.durations.length > 0
      ? totalDuration / this.metrics.durations.length
      : 0;

    return {
      averageDuration,
      successRate: this.metrics.totalCalls > 0
        ? this.metrics.successes / this.metrics.totalCalls
        : 0,
      totalCalls: this.metrics.totalCalls,
      cacheHitRate: this.metrics.totalCalls > 0
        ? this.metrics.cacheHits / this.metrics.totalCalls
        : 0,
    };
  }

  reset(): void {
    this.metrics = {
      durations: [],
      successes: 0,
      failures: 0,
      cacheHits: 0,
      totalCalls: 0,
    };
  }
}

const globalMetricsTracker = new MetricsTracker();

export function trackPerformance(result: ProposalResult): void {
  globalMetricsTracker.trackProposal(result);
}

export function getPerformanceMetrics(): PerformanceMetrics {
  return globalMetricsTracker.getMetrics();
}

export function resetMetrics(): void {
  globalMetricsTracker.reset();
}

export function createProposalMetrics(
  duration: number = 0,
  success: boolean = true
): ProposalMetrics {
  return {
    duration,
    success,
  };
}
