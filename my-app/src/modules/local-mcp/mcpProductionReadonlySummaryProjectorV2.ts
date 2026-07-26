import type {
  McpProductionReadonlySummaryExecutionResultV1,
  McpProductionReadonlySummaryToolNameV1,
} from "./mcpProductionReadonlySummaryExecutor";
import {
  buildMcpProductionReadonlySummaryStatusMcpResult,
  type McpProductionReadonlySummaryStatusFailureV1,
  type McpProductionReadonlySummaryStatusV1,
} from "./mcpProductionReadonlySummaryStatusNormalizer";

export const MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2 =
  "mcp_readonly_summary_result" as const;

const MAX_PUBLIC_COUNT = 100;

export type McpProductionReadonlySummaryFreshnessV2 =
  | "FRESH"
  | "STALE"
  | "UNKNOWN";

export type McpProductionReadonlySummaryActionCodeV2 =
  | "complete_twoweeks_onboarding"
  | "create_application_package"
  | "add_candidate_evidence"
  | "create_resume_variant_plan"
  | "add_application_context"
  | "refresh_stale_sources"
  | "refresh_inputs"
  | "retry_request"
  | "try_again_later"
  | "contact_support"
  | "review_blockers"
  | "review_application_package"
  | "complete_application_package"
  | "review_evidence_graph"
  | "review_missing_evidence"
  | "review_restricted_evidence"
  | "review_plan_items"
  | "review_missing_inputs"
  | "review_pending_items"
  | "approve_review_gate"
  | "ready_for_review";

type ApplicationPackageStatusV2 =
  | "draft"
  | "needs_review"
  | "blocked"
  | "ready_for_review"
  | "unknown";

type CoverageV2 = "complete" | "partial" | "missing" | "unknown";

type EvidenceQualityStatusV2 =
  | "ready_for_review"
  | "needs_review"
  | "blocked"
  | "unknown";

type EvidenceBlockerCategoryV2 =
  | "missing_evidence"
  | "restricted_evidence"
  | "stale_sources"
  | "unsupported"
  | "none"
  | "unknown";

type ResumePlanStatusV2 =
  | "draft"
  | "needs_review"
  | "blocked"
  | "ready_for_review"
  | "unknown";

type ResumeTargetDocumentKindV2 = "resume" | "cv" | "unknown";
type ResumeTailoringCompletenessV2 = CoverageV2;

type ResumeBlockerCategoryV2 =
  | "missing_evidence"
  | "private_fact"
  | "never_use_fact"
  | "generated_text_as_fact"
  | "unsupported"
  | "source_truth"
  | "other"
  | "none"
  | "unknown";

type ResumeMissingInputCategoryV2 =
  | "missing_evidence"
  | "missing_claims"
  | "missing_plan_items"
  | "no_plan"
  | "none"
  | "unknown";

type ReviewReadinessV2 =
  | "ready_for_review"
  | "needs_user_review"
  | "blocked"
  | "unknown";

type ReviewGateStatusV2 = "ready" | "needs_review" | "blocked" | "unknown";

type ReviewBlockerCategoryV2 =
  | "blocked_package"
  | "blocked_artifact"
  | "blocked_run"
  | "failed_run"
  | "none"
  | "unknown";

type ReviewMissingCategoryV2 =
  | "missing_review_context"
  | "missing_review_artifact"
  | "missing_application_package"
  | "pending_review_items"
  | "none"
  | "unknown";

export type McpApplicationPackageSummaryDataV2 = Readonly<{
  packageStatus: ApplicationPackageStatusV2;
  artifactCount: number;
  reviewItemCount: number;
  warningCount: number;
  blockerCount: number;
}>;

export type McpEvidenceGraphSummaryDataV2 = Readonly<{
  evidenceCoverage: CoverageV2;
  provenanceCoverage: CoverageV2;
  qualityStatus: EvidenceQualityStatusV2;
  blockerCategory: EvidenceBlockerCategoryV2;
  approvedFactCount: number;
  missingEvidenceCount: number;
  staleSourceCount: number;
  blockerCount: number;
}>;

export type McpResumeVariantPlanSummaryDataV2 = Readonly<{
  planStatus: ResumePlanStatusV2;
  targetDocumentKind: ResumeTargetDocumentKindV2;
  tailoringCompleteness: ResumeTailoringCompletenessV2;
  blockerCategory: ResumeBlockerCategoryV2;
  missingInputCategory: ResumeMissingInputCategoryV2;
  planItemCount: number;
  claimBackedItemCount: number;
  reviewNeededItemCount: number;
  blockerCount: number;
}>;

export type McpReviewCockpitSummaryDataV2 = Readonly<{
  reviewReadiness: ReviewReadinessV2;
  reviewGateStatus: ReviewGateStatusV2;
  blockerCategory: ReviewBlockerCategoryV2;
  missingReviewCategory: ReviewMissingCategoryV2;
  pendingReviewCount: number;
  approvedReviewCount: number;
  blockedReviewCount: number;
  missingReviewItemCount: number;
  approvalNeeded: boolean;
  staleData: boolean;
  overLimit: boolean;
}>;

type CommonResultV2<ToolName extends McpProductionReadonlySummaryToolNameV1> = Readonly<{
  kind: typeof MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2;
  toolName: ToolName;
  version: 2;
}>;

type ToolResultV2<
  ToolName extends McpProductionReadonlySummaryToolNameV1,
  Data,
  OkAction extends McpProductionReadonlySummaryActionCodeV2,
  NoDataAction extends McpProductionReadonlySummaryActionCodeV2,
  StaleAction extends McpProductionReadonlySummaryActionCodeV2,
> =
  | (CommonResultV2<ToolName> & Readonly<{
      status: "OK";
      freshness: "FRESH";
      data: Data;
      nextActionCode: OkAction;
    }>)
  | (CommonResultV2<ToolName> & Readonly<{
      status: "STALE";
      freshness: "STALE" | "UNKNOWN";
      data: Data;
      nextActionCode: StaleAction;
    }>)
  | (CommonResultV2<ToolName> & Readonly<{
      status: "NO_DATA";
      nextActionCode: NoDataAction;
    }>)
  | (CommonResultV2<ToolName> & Readonly<{
      status: "ONBOARDING_REQUIRED";
      nextActionCode: "complete_twoweeks_onboarding";
    }>)
  | (CommonResultV2<ToolName> & Readonly<{
      status: "TIMEOUT";
      nextActionCode: "retry_request";
      retryable: true;
    }>)
  | (CommonResultV2<ToolName> & Readonly<{
      status: "DEPENDENCY_MISSING";
      nextActionCode: "try_again_later";
      retryable: true;
    }>)
  | (CommonResultV2<ToolName> & Readonly<{
      status: "MALFORMED";
      nextActionCode: "contact_support";
      retryable: false;
    }>);

type ApplicationPackageOkActionV2 =
  | "review_blockers"
  | "review_application_package"
  | "complete_application_package"
  | "ready_for_review";

type EvidenceGraphOkActionV2 =
  | "add_candidate_evidence"
  | "review_missing_evidence"
  | "review_restricted_evidence"
  | "refresh_stale_sources"
  | "review_blockers"
  | "review_evidence_graph"
  | "ready_for_review";

type ResumeVariantPlanOkActionV2 =
  | "review_blockers"
  | "review_missing_inputs"
  | "review_plan_items"
  | "ready_for_review";

type ReviewCockpitOkActionV2 =
  | "review_blockers"
  | "review_pending_items"
  | "review_missing_inputs"
  | "refresh_inputs"
  | "approve_review_gate"
  | "add_application_context"
  | "ready_for_review";

export type McpProductionReadonlySummaryResultV2 =
  | ToolResultV2<
      "twoweeks.application_package.summarize",
      McpApplicationPackageSummaryDataV2,
      ApplicationPackageOkActionV2,
      "create_application_package",
      "refresh_inputs"
    >
  | ToolResultV2<
      "twoweeks.evidence_graph.summarize",
      McpEvidenceGraphSummaryDataV2,
      EvidenceGraphOkActionV2,
      "add_candidate_evidence",
      "refresh_stale_sources"
    >
  | ToolResultV2<
      "twoweeks.resume_variant_plan.summarize",
      McpResumeVariantPlanSummaryDataV2,
      ResumeVariantPlanOkActionV2,
      "create_resume_variant_plan",
      "refresh_inputs"
    >
  | ToolResultV2<
      "twoweeks.review_cockpit.summarize",
      McpReviewCockpitSummaryDataV2,
      ReviewCockpitOkActionV2,
      "add_application_context",
      "refresh_inputs"
    >;

export type McpProductionReadonlySummaryMcpResultV2 = Readonly<{
  content: readonly Readonly<{
    type: "text";
    text: string;
  }>[];
  structuredContent: McpProductionReadonlySummaryResultV2;
}>;

export type McpProductionReadonlySummaryJsonSchemaV2 = Readonly<{
  type?: "array" | "boolean" | "integer" | "number" | "object" | "string";
  const?: string | number | boolean;
  enum?: readonly string[];
  minimum?: number;
  maximum?: number;
  properties?: Readonly<Record<string, McpProductionReadonlySummaryJsonSchemaV2>>;
  required?: readonly string[];
  additionalProperties?: false;
  items?: McpProductionReadonlySummaryJsonSchemaV2;
  oneOf?: readonly McpProductionReadonlySummaryJsonSchemaV2[];
}>;

export type McpProductionReadonlySummaryOutputSchemaV2 = Readonly<{
  type: "object";
  oneOf: readonly McpProductionReadonlySummaryJsonSchemaV2[];
}>;

type PublicDataAndActionV2 = Readonly<{
  data:
    | McpApplicationPackageSummaryDataV2
    | McpEvidenceGraphSummaryDataV2
    | McpResumeVariantPlanSummaryDataV2
    | McpReviewCockpitSummaryDataV2;
  nextActionCode:
    | ApplicationPackageOkActionV2
    | EvidenceGraphOkActionV2
    | ResumeVariantPlanOkActionV2
    | ReviewCockpitOkActionV2;
}>;

type ToolSchemaContractV2 = Readonly<{
  dataSchema: McpProductionReadonlySummaryJsonSchemaV2;
  okActions: readonly McpProductionReadonlySummaryActionCodeV2[];
  noDataAction: McpProductionReadonlySummaryActionCodeV2;
  staleAction: McpProductionReadonlySummaryActionCodeV2;
}>;

const APPLICATION_PACKAGE_STATUS_VALUES = Object.freeze([
  "draft",
  "needs_review",
  "blocked",
  "ready_for_review",
  "unknown",
] as const);
const COVERAGE_VALUES = Object.freeze(["complete", "partial", "missing", "unknown"] as const);
const EVIDENCE_QUALITY_VALUES = Object.freeze([
  "ready_for_review",
  "needs_review",
  "blocked",
  "unknown",
] as const);
const EVIDENCE_BLOCKER_VALUES = Object.freeze([
  "missing_evidence",
  "restricted_evidence",
  "stale_sources",
  "unsupported",
  "none",
  "unknown",
] as const);
const EVIDENCE_REVIEW_HINT_VALUES = Object.freeze([
  "add_candidate_evidence",
  "review_missing_evidence",
  "review_restricted_evidence",
  "refresh_stale_sources",
  "ready_for_review",
] as const);
const RESUME_PLAN_STATUS_VALUES = Object.freeze([
  "draft",
  "needs_review",
  "blocked",
  "ready_for_review",
  "unknown",
] as const);
const RESUME_TARGET_KIND_VALUES = Object.freeze(["resume", "cv", "unknown"] as const);
const RESUME_BLOCKER_VALUES = Object.freeze([
  "missing_evidence",
  "private_fact",
  "never_use_fact",
  "generated_text_as_fact",
  "unsupported",
  "source_truth",
  "other",
  "none",
  "unknown",
] as const);
const RESUME_MISSING_INPUT_VALUES = Object.freeze([
  "missing_evidence",
  "missing_claims",
  "missing_plan_items",
  "no_plan",
  "none",
  "unknown",
] as const);
const RESUME_REVIEW_HINT_VALUES = Object.freeze([
  "review_blockers",
  "review_missing_inputs",
  "review_plan_items",
  "ready_for_review",
] as const);
const REVIEW_READINESS_VALUES = Object.freeze([
  "ready_for_review",
  "needs_user_review",
  "blocked",
  "unknown",
] as const);
const REVIEW_GATE_VALUES = Object.freeze(["ready", "needs_review", "blocked", "unknown"] as const);
const REVIEW_BLOCKER_VALUES = Object.freeze([
  "blocked_package",
  "blocked_artifact",
  "blocked_run",
  "failed_run",
  "none",
  "unknown",
] as const);
const REVIEW_MISSING_VALUES = Object.freeze([
  "missing_review_context",
  "missing_review_artifact",
  "missing_application_package",
  "pending_review_items",
  "none",
  "unknown",
] as const);
const REVIEW_HINT_VALUES = Object.freeze([
  "review_blockers",
  "review_pending_items",
  "review_missing_inputs",
  "refresh_stale_inputs",
  "ready_for_review",
  "add_application_context",
] as const);
const REVIEW_USER_ACTION_VALUES = Object.freeze([
  "review_blockers",
  "review_pending_items",
  "review_missing_inputs",
  "refresh_inputs",
  "approve_review_gate",
  "none",
] as const);

const INTERNAL_DATA_KEYS = Object.freeze({
  "twoweeks.application_package.summarize": Object.freeze({
    counts: Object.freeze([
      "packages",
      "artifacts",
      "provenanceLinks",
      "reviewItems",
      "warnings",
      "blockers",
      "version",
    ]),
    categories: Object.freeze([
      "packageStatus",
      "resumeVariantArtifactStatus",
      "coverLetterArtifactStatus",
      "version",
    ]),
    flags: undefined,
  }),
  "twoweeks.evidence_graph.summarize": Object.freeze({
    counts: Object.freeze([
      "sourceDocuments",
      "candidateFacts",
      "approvedFacts",
      "pendingFacts",
      "rejectedFacts",
      "restrictedEvidence",
      "archivedEvidence",
      "provenanceLinks",
      "evidenceMatches",
      "allowedClaims",
      "missingEvidence",
      "riskFlags",
      "staleSources",
      "warnings",
      "blockers",
      "version",
    ]),
    categories: Object.freeze([
      "evidenceCoverage",
      "provenanceCoverage",
      "qualityStatus",
      "blockerCategory",
      "nextReviewHint",
      "version",
    ]),
    flags: undefined,
  }),
  "twoweeks.resume_variant_plan.summarize": Object.freeze({
    counts: Object.freeze([
      "plans",
      "planItems",
      "claimBackedItems",
      "missingInputItems",
      "reviewNeededItems",
      "acceptedItems",
      "rejectedItems",
      "blockedItems",
      "warnings",
      "blockers",
      "restrictedFactBlockers",
      "excludedFactBlockers",
      "artifactTextBlockers",
      "allowedClaims",
      "sourceFacts",
      "evidenceMatches",
      "demands",
      "riskFlags",
      "version",
    ]),
    categories: Object.freeze([
      "planStatus",
      "targetDocumentKind",
      "tailoringCompleteness",
      "blockerCategory",
      "missingInputCategory",
      "reviewNeededCategory",
      "nextReviewHint",
      "version",
    ]),
    flags: undefined,
  }),
  "twoweeks.review_cockpit.summarize": Object.freeze({
    counts: Object.freeze([
      "reviewContexts",
      "reviewRuns",
      "reviewArtifacts",
      "applicationPackages",
      "pendingReviews",
      "approvedReviews",
      "blockedReviews",
      "failedRuns",
      "blockedRuns",
      "blockedArtifacts",
      "blockedPackages",
      "missingReviewItems",
      "approvalNeeded",
      "staleInputs",
      "overLimitCollections",
      "version",
    ]),
    categories: Object.freeze([
      "reviewReadiness",
      "reviewGateStatus",
      "blockerCategory",
      "missingReviewCategory",
      "nextReviewHint",
      "nextUserAction",
      "version",
    ]),
    flags: Object.freeze(["approvalNeeded", "staleData", "overLimit", "version"]),
  }),
} satisfies Record<
  McpProductionReadonlySummaryToolNameV1,
  Readonly<{
    counts: readonly string[];
    categories: readonly string[];
    flags: readonly string[] | undefined;
  }>
>);

const INTEGER_SCHEMA = Object.freeze({
  type: "integer" as const,
  minimum: 0,
  maximum: MAX_PUBLIC_COUNT,
});
const BOOLEAN_SCHEMA = Object.freeze({ type: "boolean" as const });

const TOOL_SCHEMA_CONTRACTS = Object.freeze({
  "twoweeks.application_package.summarize": Object.freeze({
    dataSchema: objectSchema({
      packageStatus: enumSchema(APPLICATION_PACKAGE_STATUS_VALUES),
      artifactCount: INTEGER_SCHEMA,
      reviewItemCount: INTEGER_SCHEMA,
      warningCount: INTEGER_SCHEMA,
      blockerCount: INTEGER_SCHEMA,
    }),
    okActions: Object.freeze([
      "review_blockers",
      "review_application_package",
      "complete_application_package",
      "ready_for_review",
    ] as const),
    noDataAction: "create_application_package",
    staleAction: "refresh_inputs",
  }),
  "twoweeks.evidence_graph.summarize": Object.freeze({
    dataSchema: objectSchema({
      evidenceCoverage: enumSchema(COVERAGE_VALUES),
      provenanceCoverage: enumSchema(COVERAGE_VALUES),
      qualityStatus: enumSchema(EVIDENCE_QUALITY_VALUES),
      blockerCategory: enumSchema(EVIDENCE_BLOCKER_VALUES),
      approvedFactCount: INTEGER_SCHEMA,
      missingEvidenceCount: INTEGER_SCHEMA,
      staleSourceCount: INTEGER_SCHEMA,
      blockerCount: INTEGER_SCHEMA,
    }),
    okActions: Object.freeze([
      "add_candidate_evidence",
      "review_missing_evidence",
      "review_restricted_evidence",
      "refresh_stale_sources",
      "review_blockers",
      "review_evidence_graph",
      "ready_for_review",
    ] as const),
    noDataAction: "add_candidate_evidence",
    staleAction: "refresh_stale_sources",
  }),
  "twoweeks.resume_variant_plan.summarize": Object.freeze({
    dataSchema: objectSchema({
      planStatus: enumSchema(RESUME_PLAN_STATUS_VALUES),
      targetDocumentKind: enumSchema(RESUME_TARGET_KIND_VALUES),
      tailoringCompleteness: enumSchema(COVERAGE_VALUES),
      blockerCategory: enumSchema(RESUME_BLOCKER_VALUES),
      missingInputCategory: enumSchema(RESUME_MISSING_INPUT_VALUES),
      planItemCount: INTEGER_SCHEMA,
      claimBackedItemCount: INTEGER_SCHEMA,
      reviewNeededItemCount: INTEGER_SCHEMA,
      blockerCount: INTEGER_SCHEMA,
    }),
    okActions: Object.freeze([
      "review_blockers",
      "review_missing_inputs",
      "review_plan_items",
      "ready_for_review",
    ] as const),
    noDataAction: "create_resume_variant_plan",
    staleAction: "refresh_inputs",
  }),
  "twoweeks.review_cockpit.summarize": Object.freeze({
    dataSchema: objectSchema({
      reviewReadiness: enumSchema(REVIEW_READINESS_VALUES),
      reviewGateStatus: enumSchema(REVIEW_GATE_VALUES),
      blockerCategory: enumSchema(REVIEW_BLOCKER_VALUES),
      missingReviewCategory: enumSchema(REVIEW_MISSING_VALUES),
      pendingReviewCount: INTEGER_SCHEMA,
      approvedReviewCount: INTEGER_SCHEMA,
      blockedReviewCount: INTEGER_SCHEMA,
      missingReviewItemCount: INTEGER_SCHEMA,
      approvalNeeded: BOOLEAN_SCHEMA,
      staleData: BOOLEAN_SCHEMA,
      overLimit: BOOLEAN_SCHEMA,
    }),
    okActions: Object.freeze([
      "review_blockers",
      "review_pending_items",
      "review_missing_inputs",
      "refresh_inputs",
      "approve_review_gate",
      "add_application_context",
      "ready_for_review",
    ] as const),
    noDataAction: "add_application_context",
    staleAction: "refresh_inputs",
  }),
} satisfies Record<McpProductionReadonlySummaryToolNameV1, ToolSchemaContractV2>);

export function buildMcpProductionReadonlySummaryMcpResultV2(input: Readonly<{
  toolName: McpProductionReadonlySummaryToolNameV1;
  executionResult?: McpProductionReadonlySummaryExecutionResultV1;
  failure?: McpProductionReadonlySummaryStatusFailureV1;
  nowEpochMs: number;
  forbiddenSubstrings?: readonly string[];
  version: 2;
}>): McpProductionReadonlySummaryMcpResultV2 {
  const status = buildMcpProductionReadonlySummaryStatusMcpResult({
    toolName: input.toolName,
    executionResult: input.executionResult,
    failure: input.failure,
    nowEpochMs: input.nowEpochMs,
    forbiddenSubstrings: input.forbiddenSubstrings,
    version: 1,
  }).structuredContent.status;

  let structuredContent: McpProductionReadonlySummaryResultV2;
  if (status === "OK" || status === "STALE") {
    const projected = projectAvailableData(input.toolName, input.executionResult);
    structuredContent = projected
      ? dataBearingResult(input, status, projected)
      : nonDataResult(input.toolName, "MALFORMED");
  } else {
    structuredContent = nonDataResult(input.toolName, status);
  }

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

export function buildMcpProductionReadonlySummaryOutputSchemaV2(
  toolName: McpProductionReadonlySummaryToolNameV1,
): McpProductionReadonlySummaryOutputSchemaV2 {
  const contract = TOOL_SCHEMA_CONTRACTS[toolName];
  return Object.freeze({
    type: "object" as const,
    oneOf: Object.freeze([
      resultBranchSchema(toolName, "OK", {
        freshness: constSchema("FRESH"),
        data: contract.dataSchema,
      }, contract.okActions),
      resultBranchSchema(toolName, "STALE", {
        freshness: enumSchema(["STALE", "UNKNOWN"]),
        data: contract.dataSchema,
      }, [contract.staleAction]),
      resultBranchSchema(toolName, "NO_DATA", {}, [contract.noDataAction]),
      resultBranchSchema(toolName, "ONBOARDING_REQUIRED", {}, ["complete_twoweeks_onboarding"]),
      resultBranchSchema(toolName, "TIMEOUT", { retryable: constSchema(true) }, ["retry_request"]),
      resultBranchSchema(
        toolName,
        "DEPENDENCY_MISSING",
        { retryable: constSchema(true) },
        ["try_again_later"],
      ),
      resultBranchSchema(toolName, "MALFORMED", { retryable: constSchema(false) }, ["contact_support"]),
    ]),
  });
}

function dataBearingResult(
  input: Readonly<{
    toolName: McpProductionReadonlySummaryToolNameV1;
    executionResult?: McpProductionReadonlySummaryExecutionResultV1;
  }>,
  status: "OK" | "STALE",
  projected: PublicDataAndActionV2,
): McpProductionReadonlySummaryResultV2 {
  const freshness = readFreshness(input.toolName, input.executionResult, status);
  const nextActionCode = status === "STALE"
    ? TOOL_SCHEMA_CONTRACTS[input.toolName].staleAction
    : projected.nextActionCode;
  return Object.freeze({
    kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
    status,
    toolName: input.toolName,
    freshness,
    data: projected.data,
    nextActionCode,
    version: 2 as const,
  }) as McpProductionReadonlySummaryResultV2;
}

function nonDataResult(
  toolName: McpProductionReadonlySummaryToolNameV1,
  status: Exclude<McpProductionReadonlySummaryStatusV1, "OK" | "STALE">,
): McpProductionReadonlySummaryResultV2 {
  const common = {
    kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
    status,
    toolName,
    version: 2 as const,
  };
  if (status === "NO_DATA") {
    return Object.freeze({
      ...common,
      nextActionCode: TOOL_SCHEMA_CONTRACTS[toolName].noDataAction,
    }) as McpProductionReadonlySummaryResultV2;
  }
  if (status === "ONBOARDING_REQUIRED") {
    return Object.freeze({ ...common, nextActionCode: "complete_twoweeks_onboarding" }) as McpProductionReadonlySummaryResultV2;
  }
  if (status === "TIMEOUT") {
    return Object.freeze({ ...common, nextActionCode: "retry_request", retryable: true }) as McpProductionReadonlySummaryResultV2;
  }
  if (status === "DEPENDENCY_MISSING") {
    return Object.freeze({ ...common, nextActionCode: "try_again_later", retryable: true }) as McpProductionReadonlySummaryResultV2;
  }
  return Object.freeze({ ...common, status: "MALFORMED", nextActionCode: "contact_support", retryable: false }) as McpProductionReadonlySummaryResultV2;
}

function projectAvailableData(
  toolName: McpProductionReadonlySummaryToolNameV1,
  executionResult: McpProductionReadonlySummaryExecutionResultV1 | undefined,
): PublicDataAndActionV2 | undefined {
  if (!executionResult?.ok) return undefined;
  const summary = executionResult.structuredContent;
  const counts = plainRecord(summary.safeCounts);
  const categories = plainRecord(summary.safeCategories);
  const flags = summary.safeFlags === undefined ? undefined : plainRecord(summary.safeFlags);
  const keys = INTERNAL_DATA_KEYS[toolName];
  if (
    !counts ||
    !categories ||
    !hasOnlyAllowedKeys(counts, keys.counts) ||
    !hasOnlyAllowedKeys(categories, keys.categories) ||
    counts.version !== 1 ||
    categories.version !== 1 ||
    (keys.flags
      ? !flags || !hasOnlyAllowedKeys(flags, keys.flags) || flags.version !== 1
      : summary.safeFlags !== undefined)
  ) {
    return undefined;
  }

  switch (toolName) {
    case "twoweeks.application_package.summarize":
      return projectApplicationPackage(counts, categories);
    case "twoweeks.evidence_graph.summarize":
      return projectEvidenceGraph(counts, categories);
    case "twoweeks.resume_variant_plan.summarize":
      return projectResumeVariantPlan(counts, categories);
    case "twoweeks.review_cockpit.summarize":
      return flags ? projectReviewCockpit(counts, categories, flags) : undefined;
  }
}

function projectApplicationPackage(
  counts: Readonly<Record<string, unknown>>,
  categories: Readonly<Record<string, unknown>>,
): PublicDataAndActionV2 | undefined {
  const packageStatus = enumOrUnknown(categories.packageStatus, APPLICATION_PACKAGE_STATUS_VALUES);
  const artifactCount = boundedInteger(counts.artifacts);
  const reviewItemCount = boundedInteger(counts.reviewItems);
  const warningCount = boundedInteger(counts.warnings);
  const blockerCount = boundedInteger(counts.blockers);
  if (
    packageStatus === undefined ||
    artifactCount === undefined ||
    reviewItemCount === undefined ||
    warningCount === undefined ||
    blockerCount === undefined
  ) {
    return undefined;
  }
  const data = Object.freeze({
    packageStatus,
    artifactCount,
    reviewItemCount,
    warningCount,
    blockerCount,
  });
  const nextActionCode: ApplicationPackageOkActionV2 =
    blockerCount > 0 || packageStatus === "blocked"
      ? "review_blockers"
      : reviewItemCount > 0 || warningCount > 0 || packageStatus === "needs_review"
        ? "review_application_package"
        : packageStatus === "draft"
          ? "complete_application_package"
          : packageStatus === "ready_for_review"
            ? "ready_for_review"
            : "review_application_package";
  return Object.freeze({ data, nextActionCode });
}

function projectEvidenceGraph(
  counts: Readonly<Record<string, unknown>>,
  categories: Readonly<Record<string, unknown>>,
): PublicDataAndActionV2 | undefined {
  const evidenceCoverage = enumOrUnknown(categories.evidenceCoverage, COVERAGE_VALUES);
  const provenanceCoverage = enumOrUnknown(categories.provenanceCoverage, COVERAGE_VALUES);
  const qualityStatus = enumOrUnknown(categories.qualityStatus, EVIDENCE_QUALITY_VALUES);
  const blockerCategory = enumOrUnknown(categories.blockerCategory, EVIDENCE_BLOCKER_VALUES);
  const nextReviewHint = optionalEnum(categories.nextReviewHint, EVIDENCE_REVIEW_HINT_VALUES);
  const approvedFactCount = boundedInteger(counts.approvedFacts);
  const missingEvidenceCount = boundedInteger(counts.missingEvidence);
  const staleSourceCount = boundedInteger(counts.staleSources);
  const blockerCount = boundedInteger(counts.blockers);
  if (
    evidenceCoverage === undefined ||
    provenanceCoverage === undefined ||
    qualityStatus === undefined ||
    blockerCategory === undefined ||
    nextReviewHint === null ||
    approvedFactCount === undefined ||
    missingEvidenceCount === undefined ||
    staleSourceCount === undefined ||
    blockerCount === undefined
  ) {
    return undefined;
  }
  const data = Object.freeze({
    evidenceCoverage,
    provenanceCoverage,
    qualityStatus,
    blockerCategory,
    approvedFactCount,
    missingEvidenceCount,
    staleSourceCount,
    blockerCount,
  });
  const nextActionCode: EvidenceGraphOkActionV2 = nextReviewHint ?? (
    blockerCount > 0
      ? "review_blockers"
      : missingEvidenceCount > 0
        ? "review_missing_evidence"
        : staleSourceCount > 0
          ? "refresh_stale_sources"
          : qualityStatus === "ready_for_review"
            ? "ready_for_review"
            : "review_evidence_graph"
  );
  return Object.freeze({ data, nextActionCode });
}

function projectResumeVariantPlan(
  counts: Readonly<Record<string, unknown>>,
  categories: Readonly<Record<string, unknown>>,
): PublicDataAndActionV2 | undefined {
  const planStatus = enumOrUnknown(categories.planStatus, RESUME_PLAN_STATUS_VALUES);
  const targetDocumentKind = enumOrUnknown(categories.targetDocumentKind, RESUME_TARGET_KIND_VALUES);
  const tailoringCompleteness = enumOrUnknown(categories.tailoringCompleteness, COVERAGE_VALUES);
  const blockerCategory = enumOrUnknown(categories.blockerCategory, RESUME_BLOCKER_VALUES);
  const missingInputCategory = enumOrUnknown(categories.missingInputCategory, RESUME_MISSING_INPUT_VALUES);
  const nextReviewHint = optionalEnum(categories.nextReviewHint, RESUME_REVIEW_HINT_VALUES);
  const planItemCount = boundedInteger(counts.planItems);
  const claimBackedItemCount = boundedInteger(counts.claimBackedItems);
  const reviewNeededItemCount = boundedInteger(counts.reviewNeededItems);
  const blockerCount = boundedInteger(counts.blockers);
  if (
    planStatus === undefined ||
    targetDocumentKind === undefined ||
    tailoringCompleteness === undefined ||
    blockerCategory === undefined ||
    missingInputCategory === undefined ||
    nextReviewHint === null ||
    planItemCount === undefined ||
    claimBackedItemCount === undefined ||
    reviewNeededItemCount === undefined ||
    blockerCount === undefined
  ) {
    return undefined;
  }
  const data = Object.freeze({
    planStatus,
    targetDocumentKind,
    tailoringCompleteness,
    blockerCategory,
    missingInputCategory,
    planItemCount,
    claimBackedItemCount,
    reviewNeededItemCount,
    blockerCount,
  });
  const nextActionCode: ResumeVariantPlanOkActionV2 = nextReviewHint ?? (
    blockerCount > 0 || planStatus === "blocked"
      ? "review_blockers"
      : !["none", "unknown"].includes(missingInputCategory)
        ? "review_missing_inputs"
        : reviewNeededItemCount > 0 || planStatus === "draft" || planStatus === "needs_review"
          ? "review_plan_items"
          : planStatus === "ready_for_review"
            ? "ready_for_review"
            : "review_plan_items"
  );
  return Object.freeze({ data, nextActionCode });
}

function projectReviewCockpit(
  counts: Readonly<Record<string, unknown>>,
  categories: Readonly<Record<string, unknown>>,
  flags: Readonly<Record<string, unknown>>,
): PublicDataAndActionV2 | undefined {
  const reviewReadiness = enumOrUnknown(categories.reviewReadiness, REVIEW_READINESS_VALUES);
  const reviewGateStatus = enumOrUnknown(categories.reviewGateStatus, REVIEW_GATE_VALUES);
  const blockerCategory = enumOrUnknown(categories.blockerCategory, REVIEW_BLOCKER_VALUES);
  const missingReviewCategory = enumOrUnknown(categories.missingReviewCategory, REVIEW_MISSING_VALUES);
  const nextReviewHint = optionalEnum(categories.nextReviewHint, REVIEW_HINT_VALUES);
  const nextUserAction = optionalEnum(categories.nextUserAction, REVIEW_USER_ACTION_VALUES);
  const pendingReviewCount = boundedInteger(counts.pendingReviews);
  const approvedReviewCount = boundedInteger(counts.approvedReviews);
  const blockedReviewCount = boundedInteger(counts.blockedReviews);
  const missingReviewItemCount = boundedInteger(counts.missingReviewItems);
  const approvalNeeded = booleanValue(flags.approvalNeeded);
  const staleData = booleanValue(flags.staleData);
  const overLimit = booleanValue(flags.overLimit);
  if (
    reviewReadiness === undefined ||
    reviewGateStatus === undefined ||
    blockerCategory === undefined ||
    missingReviewCategory === undefined ||
    nextReviewHint === null ||
    nextUserAction === null ||
    pendingReviewCount === undefined ||
    approvedReviewCount === undefined ||
    blockedReviewCount === undefined ||
    missingReviewItemCount === undefined ||
    approvalNeeded === undefined ||
    staleData === undefined ||
    overLimit === undefined
  ) {
    return undefined;
  }
  const data = Object.freeze({
    reviewReadiness,
    reviewGateStatus,
    blockerCategory,
    missingReviewCategory,
    pendingReviewCount,
    approvedReviewCount,
    blockedReviewCount,
    missingReviewItemCount,
    approvalNeeded,
    staleData,
    overLimit,
  });
  const userAction = nextUserAction && nextUserAction !== "none" ? nextUserAction : undefined;
  const reviewHint = nextReviewHint === "refresh_stale_inputs" ? "refresh_inputs" : nextReviewHint;
  const nextActionCode: ReviewCockpitOkActionV2 = userAction ?? reviewHint ?? (
    blockedReviewCount > 0 || reviewReadiness === "blocked" || reviewGateStatus === "blocked"
      ? "review_blockers"
      : missingReviewItemCount > 0 || !["none", "unknown"].includes(missingReviewCategory)
        ? "review_missing_inputs"
        : pendingReviewCount > 0 || reviewReadiness === "needs_user_review"
          ? "review_pending_items"
          : approvalNeeded
            ? "approve_review_gate"
            : reviewReadiness === "ready_for_review" && reviewGateStatus === "ready"
              ? "ready_for_review"
              : "review_pending_items"
  );
  return Object.freeze({ data, nextActionCode });
}

function readFreshness(
  toolName: McpProductionReadonlySummaryToolNameV1,
  executionResult: McpProductionReadonlySummaryExecutionResultV1 | undefined,
  status: "OK" | "STALE",
): McpProductionReadonlySummaryFreshnessV2 {
  if (status === "OK") return "FRESH";
  if (!executionResult?.ok) return "UNKNOWN";
  const summary = executionResult.structuredContent;
  const topLevelTimestamp = isoTimestamp(summary.updatedAt);
  if (topLevelTimestamp) return "STALE";
  const refKey = resultRefKey(toolName);
  const ref = plainRecord(summary[refKey]);
  return ref && isoTimestamp(ref.updatedAt) ? "STALE" : "UNKNOWN";
}

function resultRefKey(toolName: McpProductionReadonlySummaryToolNameV1): string {
  switch (toolName) {
    case "twoweeks.application_package.summarize": return "packageRef";
    case "twoweeks.evidence_graph.summarize": return "evidenceGraphRef";
    case "twoweeks.resume_variant_plan.summarize": return "resumeVariantPlanRef";
    case "twoweeks.review_cockpit.summarize": return "reviewCockpitRef";
  }
}

function resultBranchSchema(
  toolName: McpProductionReadonlySummaryToolNameV1,
  status: McpProductionReadonlySummaryStatusV1,
  extraProperties: Readonly<Record<string, McpProductionReadonlySummaryJsonSchemaV2>>,
  actions: readonly McpProductionReadonlySummaryActionCodeV2[],
): McpProductionReadonlySummaryJsonSchemaV2 {
  const properties = Object.freeze({
    kind: constSchema(MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2),
    status: constSchema(status),
    toolName: constSchema(toolName),
    nextActionCode: enumSchema(actions),
    version: constSchema(2),
    ...extraProperties,
  });
  return Object.freeze({
    type: "object" as const,
    additionalProperties: false as const,
    properties,
    required: Object.freeze(Object.keys(properties)),
  });
}

function objectSchema(
  properties: Readonly<Record<string, McpProductionReadonlySummaryJsonSchemaV2>>,
): McpProductionReadonlySummaryJsonSchemaV2 {
  return Object.freeze({
    type: "object" as const,
    additionalProperties: false as const,
    properties: Object.freeze({ ...properties }),
    required: Object.freeze(Object.keys(properties)),
  });
}

function enumSchema(values: readonly string[]): McpProductionReadonlySummaryJsonSchemaV2 {
  return Object.freeze({ type: "string" as const, enum: Object.freeze([...values]) });
}

function constSchema(value: string | number | boolean): McpProductionReadonlySummaryJsonSchemaV2 {
  const type = typeof value === "number"
    ? (Number.isInteger(value) ? "integer" : "number")
    : typeof value;
  return Object.freeze({
    type: type as "boolean" | "integer" | "number" | "string",
    const: value,
  });
}

function boundedInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= MAX_PUBLIC_COUNT
    ? value
    : undefined;
}

function booleanValue(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function enumOrUnknown<const Value extends string>(
  value: unknown,
  allowed: readonly Value[],
): Value | "unknown" | undefined {
  if (value === undefined) return "unknown";
  return typeof value === "string" && allowed.includes(value as Value)
    ? (value as Value)
    : undefined;
}

function optionalEnum<const Value extends string>(
  value: unknown,
  allowed: readonly Value[],
): Value | undefined | null {
  if (value === undefined) return undefined;
  return typeof value === "string" && allowed.includes(value as Value)
    ? (value as Value)
    : null;
}

function isoTimestamp(value: unknown): string | undefined {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  ) ? value : undefined;
}

function hasOnlyAllowedKeys(value: Readonly<Record<string, unknown>>, allowed: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}

function plainRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value))
    ? (value as Readonly<Record<string, unknown>>)
    : undefined;
}
