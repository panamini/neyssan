export interface RateLimitMetric {
  platform: string;
  total: number;
  allowed: number;
  blocked: number;
  timestamp: number;
}

export interface RateLimitAlert {
  platform: string;
  type: 'NEAR_LIMIT' | 'LIMIT_EXCEEDED';
  value: number;
  threshold: number;
  timestamp: number;
}

export interface RateLimit {
  platform: string;
  limit: number;
  window: number;
  isActive: boolean;
  updatedAt: number;
}

export interface MonitoringConfig {
  nearLimitThreshold: number;
  checkInterval: number;
}
