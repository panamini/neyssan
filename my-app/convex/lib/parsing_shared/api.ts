export interface ParseOptions {
  rawText: string;
  timeoutMs?: number;
  providerConfig?: {
    forceGpt?: boolean;
    allowFallback?: boolean;
  };
  telemetryContext?: {
    jobId?: string;
    source?: 'refine' | 'worker' | 'test';
  };
}

export interface Section {
  title: string;
  content: string;
  fieldKey: string;
  confidence: number;
}

export interface ParseResult {
  sections: Section[];
  metadata: Record<string, any>;
  method: 'llm' | 'heuristic';
  warnings: string[];
  telemetry?: {
    providerUsed?: string | null;
    attempts?: number;
    fallbackUsed?: boolean;
    totalDurationMs?: number;
  };
}