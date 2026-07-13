import type {
  McpProductionReadonlySummaryExecutionResultV1,
  McpProductionReadonlySummaryToolNameV1,
} from "./mcpProductionReadonlySummaryExecutor";

export const MCP_PRODUCTION_READONLY_SUMMARY_STATUS_RESULT_KIND =
  "mcp_readonly_summary_status_result" as const;

const MCP_PRODUCTION_READONLY_SUMMARY_FRESHNESS_THRESHOLD_DAYS = 14 as const;

export type McpProductionReadonlySummaryStatusV1 =
  | "OK"
  | "STALE"
  | "NO_DATA"
  | "ONBOARDING_REQUIRED"
  | "MALFORMED"
  | "TIMEOUT"
  | "DEPENDENCY_MISSING";

export type McpProductionReadonlySummaryStatusFailureV1 =
  | "dependency_missing"
  | "timeout"
  | "malformed";

export type McpProductionReadonlySummaryStatusResultV1 = Readonly<{
  kind: typeof MCP_PRODUCTION_READONLY_SUMMARY_STATUS_RESULT_KIND;
  status: McpProductionReadonlySummaryStatusV1;
  toolName: McpProductionReadonlySummaryToolNameV1;
  version: 1;
}>;

export type McpProductionReadonlySummaryStatusMcpResultV1 = Readonly<{
  content: readonly Readonly<{
    type: "text";
    text: string;
  }>[];
  structuredContent: McpProductionReadonlySummaryStatusResultV1;
}>;

type Pr106SummaryStatusV1 = "available" | "no_data_available" | "onboarding_required";
type SummaryCategoryV1 =
  | "application_package"
  | "evidence_graph"
  | "resume_variant_plan"
  | "review_cockpit";
type SummaryResultRefKeyV1 =
  | "packageRef"
  | "evidenceGraphRef"
  | "resumeVariantPlanRef"
  | "reviewCockpitRef";
type SummaryExpectedKindV1 =
  | "mcp_application_package_summary_result"
  | "mcp_evidence_graph_summary_result"
  | "mcp_resume_variant_plan_summary_result"
  | "mcp_review_cockpit_summary_result";
type SummaryDataReadV1 =
  | "convex_application_package_summary"
  | "convex_evidence_graph_summary"
  | "convex_resume_variant_plan_summary"
  | "convex_review_cockpit_summary";

type SummaryToolMappingV1 = Readonly<{
  toolName: McpProductionReadonlySummaryToolNameV1;
  resultRefKey: SummaryResultRefKeyV1;
  expectedKind: SummaryExpectedKindV1;
  category: SummaryCategoryV1;
  safeRefId: string;
  dataReads: SummaryDataReadV1;
  missingDataReasons: readonly string[];
}>;

const STRICT_STATUSES: readonly McpProductionReadonlySummaryStatusV1[] = Object.freeze([
  "OK",
  "STALE",
  "NO_DATA",
  "ONBOARDING_REQUIRED",
  "MALFORMED",
  "TIMEOUT",
  "DEPENDENCY_MISSING",
]);

const PR106_SUMMARY_STATUSES = new Set<Pr106SummaryStatusV1>([
  "available",
  "no_data_available",
  "onboarding_required",
]);

const TOOL_MAPPINGS = Object.freeze({
  "twoweeks.application_package.summarize": Object.freeze({
    toolName: "twoweeks.application_package.summarize",
    resultRefKey: "packageRef",
    expectedKind: "mcp_application_package_summary_result",
    category: "application_package",
    safeRefId: "mcp-safe-ref:application-package:latest",
    dataReads: "convex_application_package_summary",
    missingDataReasons: ["application_package_not_available", "owner_onboarding_required"],
  }),
  "twoweeks.evidence_graph.summarize": Object.freeze({
    toolName: "twoweeks.evidence_graph.summarize",
    resultRefKey: "evidenceGraphRef",
    expectedKind: "mcp_evidence_graph_summary_result",
    category: "evidence_graph",
    safeRefId: "mcp-safe-ref:evidence-graph:profile",
    dataReads: "convex_evidence_graph_summary",
    missingDataReasons: ["evidence_graph_not_available", "owner_onboarding_required"],
  }),
  "twoweeks.resume_variant_plan.summarize": Object.freeze({
    toolName: "twoweeks.resume_variant_plan.summarize",
    resultRefKey: "resumeVariantPlanRef",
    expectedKind: "mcp_resume_variant_plan_summary_result",
    category: "resume_variant_plan",
    safeRefId: "mcp-safe-ref:resume-variant-plan:latest",
    dataReads: "convex_resume_variant_plan_summary",
    missingDataReasons: ["resume_variant_plan_not_available", "owner_onboarding_required"],
  }),
  "twoweeks.review_cockpit.summarize": Object.freeze({
    toolName: "twoweeks.review_cockpit.summarize",
    resultRefKey: "reviewCockpitRef",
    expectedKind: "mcp_review_cockpit_summary_result",
    category: "review_cockpit",
    safeRefId: "mcp-safe-ref:review-cockpit:latest",
    dataReads: "convex_review_cockpit_summary",
    missingDataReasons: ["review_cockpit_not_available", "owner_onboarding_required"],
  }),
} satisfies Record<McpProductionReadonlySummaryToolNameV1, SummaryToolMappingV1>);

const RESULT_TOP_LEVEL_KEYS = Object.freeze([
  "kind",
  "allowed",
  "status",
  "packageRef",
  "evidenceGraphRef",
  "resumeVariantPlanRef",
  "reviewCockpitRef",
  "availability",
  "safeCounts",
  "safeCategories",
  "safeFlags",
  "updatedAt",
  "missingDataReason",
  "capabilities",
  "modelVisible",
  "version",
] as const);

const CAPABILITY_KEYS = Object.freeze([
  "ownerResolution",
  "dataReads",
  "dataWrites",
  "handlerExecution",
  "productionConnector",
  "networkAccess",
  "modelCalls",
  "writeActions",
  "rawDataProjection",
  "version",
] as const);

const FORBIDDEN_SUMMARY_PATTERNS = Object.freeze([
  /access_token|refresh_token|client_secret|authorizationCodeDigest|tokenDigest/u,
  /mcpOAuthAccessTokens|mcpOAuthAuthorizationCodes|mcpOAuthAuthorizationIntents|mcpOAuthPreAuthIntents/u,
  /providerMetadata|modelPrompt|stackTrace|storageId|prompt/u,
  /https?:\/\//u,
] as const);

export function readMcpProductionReadonlySummaryToolName(
  value: string,
): McpProductionReadonlySummaryToolNameV1 | undefined {
  return Object.prototype.hasOwnProperty.call(TOOL_MAPPINGS, value)
    ? (value as McpProductionReadonlySummaryToolNameV1)
    : undefined;
}

export function buildMcpProductionReadonlySummaryStatusMcpResult(input: Readonly<{
  toolName: McpProductionReadonlySummaryToolNameV1;
  executionResult?: McpProductionReadonlySummaryExecutionResultV1;
  failure?: McpProductionReadonlySummaryStatusFailureV1;
  nowEpochMs: number;
  forbiddenSubstrings?: readonly string[];
  version: 1;
}>): McpProductionReadonlySummaryStatusMcpResultV1 {
  const structuredContent = normalizeStatusResult(input);
  return Object.freeze({
    content: Object.freeze([
      Object.freeze({
        type: "text" as const,
        text: `Read-only summary status: ${structuredContent.status}.`,
      }),
    ]),
    structuredContent,
  });
}

function normalizeStatusResult(input: Readonly<{
  toolName: McpProductionReadonlySummaryToolNameV1;
  executionResult?: McpProductionReadonlySummaryExecutionResultV1;
  failure?: McpProductionReadonlySummaryStatusFailureV1;
  nowEpochMs: number;
  forbiddenSubstrings?: readonly string[];
  version: 1;
}>): McpProductionReadonlySummaryStatusResultV1 {
  if (input.failure === "dependency_missing") return statusEnvelope(input.toolName, "DEPENDENCY_MISSING");
  if (input.failure === "timeout") return statusEnvelope(input.toolName, "TIMEOUT");
  if (input.failure === "malformed" || !input.executionResult) return statusEnvelope(input.toolName, "MALFORMED");
  if (!input.executionResult.ok) return statusEnvelope(input.toolName, "MALFORMED");

  const mapping = TOOL_MAPPINGS[input.toolName];
  const summary = input.executionResult.structuredContent;
  if (!isSafeReadonlySummary(summary, mapping, input.forbiddenSubstrings ?? [])) {
    return statusEnvelope(input.toolName, "MALFORMED");
  }

  const pr106Status = summary.status as Pr106SummaryStatusV1;
  if (pr106Status === "no_data_available") {
    return statusEnvelope(input.toolName, "NO_DATA");
  }
  if (pr106Status === "onboarding_required") {
    return statusEnvelope(input.toolName, "ONBOARDING_REQUIRED");
  }

  const timestamp = readFreshnessTimestamp(summary, mapping.resultRefKey);
  if (!timestamp) return statusEnvelope(input.toolName, "STALE");
  const ageMs = input.nowEpochMs - Date.parse(timestamp);
  const freshnessThresholdMs = MCP_PRODUCTION_READONLY_SUMMARY_FRESHNESS_THRESHOLD_DAYS * 24 * 60 * 60 * 1_000;
  return statusEnvelope(
    input.toolName,
    ageMs <= freshnessThresholdMs ? "OK" : "STALE",
  );
}

function statusEnvelope(
  toolName: McpProductionReadonlySummaryToolNameV1,
  status: McpProductionReadonlySummaryStatusV1,
): McpProductionReadonlySummaryStatusResultV1 {
  if (!STRICT_STATUSES.includes(status)) return statusEnvelope(toolName, "MALFORMED");
  return Object.freeze({
    kind: MCP_PRODUCTION_READONLY_SUMMARY_STATUS_RESULT_KIND,
    status,
    toolName,
    version: 1 as const,
  });
}

function isSafeReadonlySummary(
  value: unknown,
  mapping: SummaryToolMappingV1,
  forbiddenSubstrings: readonly string[],
): value is Readonly<Record<string, unknown>> {
  if (!isPlainRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, RESULT_TOP_LEVEL_KEYS)) return false;
  if (value.kind !== mapping.expectedKind) return false;
  if (value.allowed !== true || value.modelVisible !== true || value.version !== 1) return false;
  if (!PR106_SUMMARY_STATUSES.has(value.status as Pr106SummaryStatusV1)) return false;
  if (
    value.missingDataReason !== undefined &&
    (typeof value.missingDataReason !== "string" || !mapping.missingDataReasons.includes(value.missingDataReason))
  ) {
    return false;
  }
  if (value.updatedAt !== undefined && !isIsoTimestamp(value.updatedAt)) return false;
  if (!hasOnlyExpectedResultRefKey(value, mapping.resultRefKey)) return false;
  if (!isSafeResultRef(value[mapping.resultRefKey], mapping)) return false;
  if (!isSafeAvailability(value.availability, mapping.dataReads)) return false;
  if (!isSafeCapabilities(value.capabilities, mapping.dataReads)) return false;
  if (!isSafeJsonRecord(value.safeCounts, 2)) return false;
  if (!isSafeJsonRecord(value.safeCategories, 2)) return false;
  if (value.safeFlags !== undefined && !isSafeJsonRecord(value.safeFlags, 2)) return false;
  return !containsForbiddenSummaryContent(value, forbiddenSubstrings);
}

function hasOnlyExpectedResultRefKey(
  value: Readonly<Record<string, unknown>>,
  resultRefKey: SummaryResultRefKeyV1,
): boolean {
  const resultRefKeys: readonly SummaryResultRefKeyV1[] = [
    "packageRef",
    "evidenceGraphRef",
    "resumeVariantPlanRef",
    "reviewCockpitRef",
  ];
  return resultRefKeys.every((key) => key === resultRefKey || value[key] === undefined);
}

function isSafeResultRef(value: unknown, mapping: SummaryToolMappingV1): boolean {
  if (!isPlainRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, ["id", "label", "status", "category", "count", "updatedAt", "version"])) {
    return false;
  }
  if (value.id !== mapping.safeRefId) return false;
  if (typeof value.label !== "string" || value.label.length === 0 || value.label.length > 120) return false;
  if (!PR106_SUMMARY_STATUSES.has(value.status as Pr106SummaryStatusV1)) return false;
  if (value.category !== mapping.category) return false;
  if (!isSafeCount(value.count)) return false;
  if (value.updatedAt !== undefined && !isIsoTimestamp(value.updatedAt)) return false;
  return value.version === 1;
}

function isSafeAvailability(value: unknown, dataReads: SummaryDataReadV1): boolean {
  if (!isPlainRecord(value)) return false;
  return hasOnlyAllowedKeys(value, ["source", "ownerState", "version"]) &&
    value.source === dataReads &&
    (value.ownerState === "resolved" || value.ownerState === "onboarding_required") &&
    value.version === 1;
}

function isSafeCapabilities(value: unknown, dataReads: SummaryDataReadV1): boolean {
  if (!isPlainRecord(value)) return false;
  return hasOnlyAllowedKeys(value, CAPABILITY_KEYS) &&
    (value.ownerResolution === "blocked" || value.ownerResolution === "server_only") &&
    value.dataReads === dataReads &&
    value.dataWrites === "blocked" &&
    value.handlerExecution === "blocked" &&
    value.productionConnector === "blocked" &&
    value.networkAccess === "blocked" &&
    value.modelCalls === "blocked" &&
    value.writeActions === "blocked" &&
    value.rawDataProjection === "blocked" &&
    value.version === 1;
}

function readFreshnessTimestamp(
  summary: Readonly<Record<string, unknown>>,
  resultRefKey: SummaryResultRefKeyV1,
): string | undefined {
  if (isIsoTimestamp(summary.updatedAt)) return summary.updatedAt;
  const ref = summary[resultRefKey];
  return isPlainRecord(ref) && isIsoTimestamp(ref.updatedAt) ? ref.updatedAt : undefined;
}

function containsForbiddenSummaryContent(value: Readonly<Record<string, unknown>>, forbiddenSubstrings: readonly string[]): boolean {
  const serialized = JSON.stringify(value);
  if (!serialized) return true;
  if (forbiddenSubstrings.some((forbidden) => forbidden.length >= 8 && serialized.includes(forbidden))) return true;
  return FORBIDDEN_SUMMARY_PATTERNS.some((pattern) => pattern.test(serialized));
}

function isSafeJsonRecord(value: unknown, depth: number): boolean {
  return isPlainRecord(value) && isSafeJsonValue(value, depth);
}

function isSafeJsonValue(value: unknown, depth: number): boolean {
  if (depth < 0) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 && value <= 10_000;
  if (typeof value === "string") return /^[A-Za-z0-9 _./:_-]{0,160}$/u.test(value);
  if (Array.isArray(value)) return value.length <= 20 && value.every((item) => isSafeJsonValue(item, depth - 1));
  if (!isPlainRecord(value)) return false;
  return Object.keys(value).length <= 40 && Object.entries(value).every(([key, nested]) =>
    /^[A-Za-z][A-Za-z0-9_]{0,80}$/u.test(key) && isSafeJsonValue(nested, depth - 1)
  );
}

function isSafeCount(value: unknown): boolean {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
}

function isIsoTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
