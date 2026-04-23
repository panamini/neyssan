export type JobsTelemetryEvent =
  | "job_opened"
  | "job_decision_made"
  | "match_read_computed"
  | "field_corrected"
  | "first_run_path"
  | "import_accepted"
  | "import_rejected";

type JobsTelemetryMetricArgs = {
  event: JobsTelemetryEvent;
  jobId?: string | null;
  path?: "import" | "sample" | "bounce";
  outcome?: "cover_letter" | "resume" | "bounce";
  timeToDecisionMs?: number | null;
  fieldKey?: string | null;
  beforeConfidence?: number | null;
  hasMatchRead?: boolean | null;
  reviewState?: string | null;
  tier?: string | null;
  confidence?: string | null;
  method?: string | null;
  fallback?: string | null;
  provider?: string | null;
  model?: string | null;
  promptTokens?: number | null;
  completionTokens?: number | null;
  estimatedCostUsd?: number | null;
};

function setString(
  target: Record<string, string>,
  key: string,
  value: string | number | boolean | null | undefined,
) {
  if (value === null || value === undefined) {
    return;
  }

  target[key] = String(value);
}

export function buildJobsMetricArgs(args: JobsTelemetryMetricArgs) {
  const metadata: Record<string, string> = {
    namespace: "jobs-v2",
    event: args.event,
  };
  const labels: Record<string, string> = {
    namespace: "jobs-v2",
    event: args.event,
  };

  setString(metadata, "jobId", args.jobId);
  setString(metadata, "path", args.path);
  setString(metadata, "outcome", args.outcome);
  setString(metadata, "timeToDecisionMs", args.timeToDecisionMs);
  setString(metadata, "fieldKey", args.fieldKey);
  setString(metadata, "beforeConfidence", args.beforeConfidence);
  setString(metadata, "hasMatchRead", args.hasMatchRead);
  setString(metadata, "reviewState", args.reviewState);
  setString(metadata, "tier", args.tier);
  setString(metadata, "confidence", args.confidence);
  setString(metadata, "method", args.method);
  setString(metadata, "fallback", args.fallback);
  setString(metadata, "provider", args.provider);
  setString(metadata, "model", args.model);
  setString(metadata, "promptTokens", args.promptTokens);
  setString(metadata, "completionTokens", args.completionTokens);
  setString(metadata, "estimatedCostUsd", args.estimatedCostUsd);

  setString(labels, "path", args.path);
  setString(labels, "outcome", args.outcome);
  setString(labels, "fieldKey", args.fieldKey);
  setString(labels, "reviewState", args.reviewState);
  setString(labels, "tier", args.tier);
  setString(labels, "confidence", args.confidence);
  setString(labels, "method", args.method);
  setString(labels, "fallback", args.fallback);
  setString(labels, "provider", args.provider);
  setString(labels, "model", args.model);

  return {
    name: `jobs-v2:${args.event}`,
    value: 1,
    metadata,
    labels,
  };
}
