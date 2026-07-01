import type { McpProductionToolsCallBoundaryValidationV1 } from "./mcpProductionToolsCallBoundary";

export const MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE =
  "Read-only summary unavailable." as const;

export type McpProductionReadonlySummaryToolNameV1 =
  | "twoweeks.application_package.summarize"
  | "twoweeks.evidence_graph.summarize"
  | "twoweeks.resume_variant_plan.summarize"
  | "twoweeks.review_cockpit.summarize";

export type McpProductionReadonlySummaryQueryKeyV1 =
  | "applicationPackageSummary"
  | "evidenceGraphSummary"
  | "resumeVariantPlanSummary"
  | "reviewCockpitSummary";

export type McpProductionReadonlySummaryQueryPortInputV1 = Readonly<{
  query: McpProductionReadonlySummaryQueryKeyV1;
  args: Readonly<Record<string, unknown>>;
  version: 1;
}>;

export type McpProductionReadonlySummaryQueryPortV1 = (
  input: McpProductionReadonlySummaryQueryPortInputV1,
) => Promise<unknown>;

export type McpProductionReadonlySummaryExecutionInputV1 = Readonly<{
  toolName: McpProductionReadonlySummaryToolNameV1;
  twoweeksClerkId: string;
  ref: Readonly<{
    id: string;
  }>;
  version: 1;
}>;

export type McpProductionReadonlySummaryExecutionFailureCodeV1 =
  | "unsupported_tool"
  | "invalid_server_owner"
  | "invalid_validated_ref"
  | "query_failed"
  | "malformed_result";

export type McpProductionReadonlySummaryExecutionResultV1 = Readonly<
  | {
      ok: true;
      content: readonly Readonly<{
        type: "text";
        text: string;
      }>[];
      structuredContent: Readonly<Record<string, unknown>>;
      modelVisible: true;
      version: 1;
    }
  | {
      ok: false;
      failure: Readonly<{
        code: McpProductionReadonlySummaryExecutionFailureCodeV1;
        message: typeof MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE;
        safeForModel: true;
        rawArgumentsEchoed: false;
        ownerIdentityEchoed: false;
        tokenMaterialEchoed: false;
        internalQueryRefEchoed: false;
        providerMetadataEchoed: false;
        stackTraceEchoed: false;
        version: 1;
      }>;
      modelVisible: true;
      version: 1;
    }
>;

export type McpProductionReadonlySummaryExecutorV1 = (
  input: McpProductionReadonlySummaryExecutionInputV1,
) => Promise<McpProductionReadonlySummaryExecutionResultV1>;

type SummaryStatusV1 = "available" | "no_data_available" | "onboarding_required";
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
type SummaryArgumentKeyV1 =
  | "applicationPackageRef"
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
  query: McpProductionReadonlySummaryQueryKeyV1;
  argumentKey: SummaryArgumentKeyV1;
  resultRefKey: SummaryResultRefKeyV1;
  expectedKind: SummaryExpectedKindV1;
  category: SummaryCategoryV1;
  label: string;
  safeRefId: string;
  dataReads: SummaryDataReadV1;
  missingDataReasons: readonly string[];
}>;

const SUMMARY_STATUSES = new Set<SummaryStatusV1>([
  "available",
  "no_data_available",
  "onboarding_required",
]);

const TOOL_MAPPINGS = Object.freeze({
  "twoweeks.application_package.summarize": Object.freeze({
    toolName: "twoweeks.application_package.summarize",
    query: "applicationPackageSummary",
    argumentKey: "applicationPackageRef",
    resultRefKey: "packageRef",
    expectedKind: "mcp_application_package_summary_result",
    category: "application_package",
    label: "Application package availability",
    safeRefId: "mcp-safe-ref:application-package:latest",
    dataReads: "convex_application_package_summary",
    missingDataReasons: ["application_package_not_available", "owner_onboarding_required"],
  }),
  "twoweeks.evidence_graph.summarize": Object.freeze({
    toolName: "twoweeks.evidence_graph.summarize",
    query: "evidenceGraphSummary",
    argumentKey: "evidenceGraphRef",
    resultRefKey: "evidenceGraphRef",
    expectedKind: "mcp_evidence_graph_summary_result",
    category: "evidence_graph",
    label: "Candidate evidence availability",
    safeRefId: "mcp-safe-ref:evidence-graph:profile",
    dataReads: "convex_evidence_graph_summary",
    missingDataReasons: ["evidence_graph_not_available", "owner_onboarding_required"],
  }),
  "twoweeks.resume_variant_plan.summarize": Object.freeze({
    toolName: "twoweeks.resume_variant_plan.summarize",
    query: "resumeVariantPlanSummary",
    argumentKey: "resumeVariantPlanRef",
    resultRefKey: "resumeVariantPlanRef",
    expectedKind: "mcp_resume_variant_plan_summary_result",
    category: "resume_variant_plan",
    label: "Resume variant plan availability",
    safeRefId: "mcp-safe-ref:resume-variant-plan:latest",
    dataReads: "convex_resume_variant_plan_summary",
    missingDataReasons: ["resume_variant_plan_not_available", "owner_onboarding_required"],
  }),
  "twoweeks.review_cockpit.summarize": Object.freeze({
    toolName: "twoweeks.review_cockpit.summarize",
    query: "reviewCockpitSummary",
    argumentKey: "reviewCockpitRef",
    resultRefKey: "reviewCockpitRef",
    expectedKind: "mcp_review_cockpit_summary_result",
    category: "review_cockpit",
    label: "Review cockpit availability",
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

export function buildMcpProductionReadonlySummaryExecutionInput(input: Readonly<{
  validation: Extract<McpProductionToolsCallBoundaryValidationV1, { valid: true }>;
  twoweeksClerkId: string;
  version: 1;
}>): McpProductionReadonlySummaryExecutionInputV1 | undefined {
  const mapping = toolMapping(input.validation.tool.name);
  if (!mapping) return undefined;
  const ref = readValidatedRef(input.validation.params.arguments[mapping.argumentKey], mapping);
  if (!ref) return undefined;
  return Object.freeze({
    toolName: mapping.toolName,
    twoweeksClerkId: input.twoweeksClerkId,
    ref,
    version: 1,
  });
}

export function buildMcpProductionReadonlySummaryExecutor(
  runQuery: McpProductionReadonlySummaryQueryPortV1,
): McpProductionReadonlySummaryExecutorV1 {
  return async (input) => {
    const mapping = toolMapping(input.toolName);
    if (!mapping) return failure("unsupported_tool");
    if (!isServerOnlyOwnerIdentity(input.twoweeksClerkId)) return failure("invalid_server_owner");
    if (!isValidatedRef(input.ref, mapping)) return failure("invalid_validated_ref");

    let queryResult: unknown;
    try {
      queryResult = await runQuery(Object.freeze({
        query: mapping.query,
        args: buildConvexSummaryArgs(mapping, input),
        version: 1,
      }));
    } catch {
      return failure("query_failed");
    }

    if (!isSafeReadonlySummaryResult(queryResult, mapping, input)) {
      return failure("malformed_result");
    }

    return Object.freeze({
      ok: true as const,
      content: Object.freeze([
        Object.freeze({
          type: "text" as const,
          text: "Read-only summary returned.",
        }),
      ]),
      structuredContent: cloneAndFreezeRecord(queryResult),
      modelVisible: true as const,
      version: 1 as const,
    });
  };
}

function buildConvexSummaryArgs(
  mapping: SummaryToolMappingV1,
  input: McpProductionReadonlySummaryExecutionInputV1,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    twoweeksClerkId: input.twoweeksClerkId,
    [mapping.argumentKey]: Object.freeze({
      id: input.ref.id,
      label: mapping.label,
      status: "available" as const,
      category: mapping.category,
      count: 1,
      version: 1 as const,
    }),
  });
}

function isSafeReadonlySummaryResult(
  value: unknown,
  mapping: SummaryToolMappingV1,
  input: McpProductionReadonlySummaryExecutionInputV1,
): value is Readonly<Record<string, unknown>> {
  if (!isPlainRecord(value)) return false;
  if (!hasOnlyAllowedKeys(value, RESULT_TOP_LEVEL_KEYS)) return false;
  if (value.kind !== mapping.expectedKind) return false;
  if (value.allowed !== true || value.modelVisible !== true || value.version !== 1) return false;
  if (!SUMMARY_STATUSES.has(value.status as SummaryStatusV1)) return false;
  if (value.missingDataReason !== undefined && !mapping.missingDataReasons.includes(String(value.missingDataReason))) {
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
  return !containsForbiddenEcho(value, mapping, input);
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
  if (!SUMMARY_STATUSES.has(value.status as SummaryStatusV1)) return false;
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

function containsForbiddenEcho(
  value: Readonly<Record<string, unknown>>,
  mapping: SummaryToolMappingV1,
  input: McpProductionReadonlySummaryExecutionInputV1,
): boolean {
  const serialized = JSON.stringify(value);
  if (!serialized) return true;
  if (serialized.includes(input.twoweeksClerkId)) return true;
  if (input.ref.id === mapping.safeRefId) return false;
  return input.ref.id.length >= 8 && serialized.includes(input.ref.id);
}

function readValidatedRef(
  value: unknown,
  mapping: SummaryToolMappingV1,
): Readonly<{ id: string }> | undefined {
  if (!isPlainRecord(value)) return undefined;
  if (!hasOnlyAllowedKeys(value, ["id"])) return undefined;
  return isExpectedSafeRefId(value.id, mapping) ? Object.freeze({ id: value.id }) : undefined;
}

function isValidatedRef(
  value: unknown,
  mapping: SummaryToolMappingV1,
): value is Readonly<{ id: string }> {
  return isPlainRecord(value) && hasOnlyAllowedKeys(value, ["id"]) && isExpectedSafeRefId(value.id, mapping);
}

function isExpectedSafeRefId(value: unknown, mapping: SummaryToolMappingV1): value is string {
  return value === mapping.safeRefId;
}

function isServerOnlyOwnerIdentity(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u.test(value);
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

function toolMapping(name: string): SummaryToolMappingV1 | undefined {
  return TOOL_MAPPINGS[name as McpProductionReadonlySummaryToolNameV1];
}

function failure(
  code: McpProductionReadonlySummaryExecutionFailureCodeV1,
): McpProductionReadonlySummaryExecutionResultV1 {
  return Object.freeze({
    ok: false as const,
    failure: Object.freeze({
      code,
      message: MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE,
      safeForModel: true as const,
      rawArgumentsEchoed: false as const,
      ownerIdentityEchoed: false as const,
      tokenMaterialEchoed: false as const,
      internalQueryRefEchoed: false as const,
      providerMetadataEchoed: false as const,
      stackTraceEchoed: false as const,
      version: 1 as const,
    }),
    modelVisible: true as const,
    version: 1 as const,
  });
}

function cloneAndFreezeRecord(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return cloneAndFreezeJsonValue(value) as Readonly<Record<string, unknown>>;
}

function cloneAndFreezeJsonValue(value: unknown): unknown {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (Array.isArray(value)) return Object.freeze(value.map(cloneAndFreezeJsonValue));
  if (isPlainRecord(value)) {
    return Object.freeze(
      Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, cloneAndFreezeJsonValue(nested)])),
    );
  }
  throw new TypeError("Read-only summary result must be JSON-serializable.");
}

function hasOnlyAllowedKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
