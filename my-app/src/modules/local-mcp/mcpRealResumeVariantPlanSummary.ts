export type McpRealResumeVariantPlanSummaryStatusV1 =
  | "available"
  | "no_data_available"
  | "onboarding_required";

export type McpRealResumeVariantPlanSummaryMissingDataReasonV1 =
  | "resume_variant_plan_ref_missing"
  | "resume_variant_plan_not_available"
  | "owner_onboarding_required"
  | "summary_unavailable";

export type McpRealResumeVariantPlanSummaryRefV1 = Readonly<{
  id: string;
  label: string;
  status: McpRealResumeVariantPlanSummaryStatusV1;
  category: "resume_variant_plan";
  count: number;
  updatedAt?: string;
  version: 1;
}>;

export type McpRealResumeVariantPlanSummaryCountsV1 = Readonly<{
  plans: number;
  planItems: number;
  claimBackedItems: number;
  missingInputItems: number;
  reviewNeededItems: number;
  acceptedItems: number;
  rejectedItems: number;
  blockedItems: number;
  warnings: number;
  blockers: number;
  restrictedFactBlockers: number;
  excludedFactBlockers: number;
  artifactTextBlockers: number;
  allowedClaims: number;
  sourceFacts: number;
  evidenceMatches: number;
  demands: number;
  riskFlags: number;
  version: 1;
}>;

export type McpRealResumeVariantPlanSummaryCategoriesV1 = Readonly<{
  planStatus?:
    | "draft"
    | "needs_review"
    | "blocked"
    | "ready_for_review"
    | "unknown";
  targetDocumentKind?: "resume" | "cv";
  tailoringCompleteness?: "complete" | "partial" | "missing" | "unknown";
  blockerCategory?:
    | "missing_evidence"
    | "private_fact"
    | "never_use_fact"
    | "generated_text_as_fact"
    | "unsupported"
    | "source_truth"
    | "other"
    | "none";
  missingInputCategory?:
    | "missing_evidence"
    | "missing_claims"
    | "missing_plan_items"
    | "no_plan"
    | "none";
  reviewNeededCategory?:
    | "review_warnings"
    | "review_items"
    | "ready_for_review"
    | "blocked";
  nextReviewHint?:
    | "review_blockers"
    | "review_missing_inputs"
    | "review_plan_items"
    | "ready_for_review";
  version: 1;
}>;

export type McpRealResumeVariantPlanSummaryAvailabilityV1 = Readonly<{
  source: "pr59_read_only_adapter" | "convex_resume_variant_plan_summary";
  ownerState: "resolved" | "onboarding_required";
  version: 1;
}>;

export type McpRealResumeVariantPlanSummaryCapabilitiesV1 = Readonly<{
  adapter: "blocked" | "pr59_read_only_adapter_verified";
  dataReads: "blocked" | "convex_resume_variant_plan_summary";
  dataWrites: "blocked";
  handlerExecution: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  writeActions: "blocked";
  exportActions: "blocked";
  rawDataProjection: "blocked";
  credentialStorage: "none";
  tokenStorage: "none";
  version: 1;
}>;

export type McpRealResumeVariantPlanSummarySafeRefusalV1 = Readonly<{
  code: "real_resume_variant_plan_summary_blocked";
  message: "Refused. Real resume variant plan summary boundary blocked.";
  safeForModel: true;
  rawDataExposed: false;
  credentialsExposed: false;
  ownerIdentityExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpRealResumeVariantPlanSummaryBlockedReasonV1 =
  | "invalid_input"
  | "adapter_required"
  | "summary_required"
  | "unsafe_summary_blocked";

export type McpRealResumeVariantPlanSummaryResultV1 = Readonly<
  | {
      kind: "mcp_real_resume_variant_plan_summary_result";
      allowed: true;
      status: McpRealResumeVariantPlanSummaryStatusV1;
      resumeVariantPlanRef: McpRealResumeVariantPlanSummaryRefV1;
      availability: McpRealResumeVariantPlanSummaryAvailabilityV1;
      safeCounts: McpRealResumeVariantPlanSummaryCountsV1;
      safeCategories: McpRealResumeVariantPlanSummaryCategoriesV1;
      updatedAt?: string;
      missingDataReason?: McpRealResumeVariantPlanSummaryMissingDataReasonV1;
      capabilities: McpRealResumeVariantPlanSummaryCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_real_resume_variant_plan_summary_result";
      allowed: false;
      reason: McpRealResumeVariantPlanSummaryBlockedReasonV1;
      safeRefusal: McpRealResumeVariantPlanSummarySafeRefusalV1;
      capabilities: McpRealResumeVariantPlanSummaryCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
>;

type SummaryInput = Readonly<{
  adapterResult: unknown;
  resumeVariantPlanSummary?: unknown;
}>;

type ParsedAdapterResult = Readonly<{
  resumeVariantPlanRef?: McpRealResumeVariantPlanSummaryRefV1;
  availabilitySummary: Readonly<{
    onboarding: number;
    version: 1;
  }>;
}>;

type ParsedConvexSummary = Extract<
  McpRealResumeVariantPlanSummaryResultV1,
  { allowed: true }
>;
type ParsedConvexSummaryRequiredFields = Pick<
  ParsedConvexSummary,
  "resumeVariantPlanRef" | "availability" | "safeCounts" | "safeCategories"
>;
type ParsedConvexSummaryOptionalFields = Partial<
  Pick<ParsedConvexSummary, "updatedAt" | "missingDataReason">
>;

const INPUT_KEYS = [
  "kind",
  "adapterResult",
  "resumeVariantPlanSummary",
  "version",
] as const;
const INPUT_REQUIRED_KEYS = ["kind", "adapterResult", "version"] as const;

const ADAPTER_RESULT_KEYS = [
  "kind",
  "allowed",
  "reason",
  "refs",
  "blockedRefClasses",
  "availabilitySummary",
  "audit",
  "capabilities",
  "modelVisible",
  "version",
] as const;

const ADAPTER_BLOCKED_RESULT_KEYS = [
  "kind",
  "allowed",
  "reason",
  "safeRefusal",
  "capabilities",
  "modelVisible",
  "version",
] as const;

const ADAPTER_REF_KEYS = [
  "id",
  "label",
  "status",
  "category",
  "count",
  "updatedAt",
  "version",
] as const;
const ADAPTER_REF_REQUIRED_KEYS = [
  "id",
  "label",
  "status",
  "category",
  "count",
  "version",
] as const;

const AVAILABILITY_SUMMARY_KEYS = [
  "available",
  "noData",
  "onboarding",
  "blocked",
  "version",
] as const;

const SUMMARY_RESULT_KEYS = [
  "kind",
  "allowed",
  "status",
  "resumeVariantPlanRef",
  "availability",
  "safeCounts",
  "safeCategories",
  "updatedAt",
  "missingDataReason",
  "capabilities",
  "modelVisible",
  "version",
] as const;
const SUMMARY_RESULT_REQUIRED_KEYS = [
  "kind",
  "allowed",
  "status",
  "resumeVariantPlanRef",
  "availability",
  "safeCounts",
  "safeCategories",
  "capabilities",
  "modelVisible",
  "version",
] as const;

const SUMMARY_AVAILABILITY_KEYS = ["source", "ownerState", "version"] as const;
const SUMMARY_COUNTS_KEYS = [
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
] as const;
const SUMMARY_CATEGORIES_KEYS = [
  "planStatus",
  "targetDocumentKind",
  "tailoringCompleteness",
  "blockerCategory",
  "missingInputCategory",
  "reviewNeededCategory",
  "nextReviewHint",
  "version",
] as const;
const SUMMARY_CAPABILITIES_KEYS = [
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
] as const;

const MAX_SAFE_COUNT = 100;

const ALLOWED_ADAPTER_RESULT_FIELDS = {
  kind: "mcp_read_only_twoweeks_data_adapter_result",
  allowed: true,
  modelVisible: true,
  version: 1,
} as const;

const ALLOWED_CONVEX_SUMMARY_FIELDS = {
  kind: "mcp_resume_variant_plan_summary_result",
  allowed: true,
  modelVisible: true,
  version: 1,
} as const;

const CONVEX_SUMMARY_CAPABILITY_FIELDS = {
  dataReads: "convex_resume_variant_plan_summary",
  dataWrites: "blocked",
  handlerExecution: "blocked",
  productionConnector: "blocked",
  networkAccess: "blocked",
  modelCalls: "blocked",
  writeActions: "blocked",
  rawDataProjection: "blocked",
  version: 1,
} as const;

const SAFE_CATEGORY_VALUES = new Set([
  "private_fact",
  "never_use_fact",
  "generated_text_as_fact",
]);

export function projectMcpRealResumeVariantPlanSummary(
  input: unknown,
): McpRealResumeVariantPlanSummaryResultV1 {
  const parsedInput = parseSummaryInput(input);
  if (!parsedInput) return deny("invalid_input");

  const adapter = parseAllowedAdapterResult(parsedInput.adapterResult);
  if (!adapter) {
    return isBlockedAdapterResult(parsedInput.adapterResult)
      ? deny("adapter_required")
      : deny("invalid_input");
  }

  const adapterResumeVariantPlanRef = adapter.resumeVariantPlanRef;
  if (!adapterResumeVariantPlanRef) {
    return allowUnavailable(
      "no_data_available",
      "resume_variant_plan_ref_missing",
      "pr59_read_only_adapter",
    );
  }

  if (adapterResumeVariantPlanRef.status !== "available") {
    return allowUnavailable(
      adapterResumeVariantPlanRef.status,
      adapterResumeVariantPlanRef.status === "onboarding_required"
        ? "owner_onboarding_required"
        : "resume_variant_plan_not_available",
      "pr59_read_only_adapter",
      adapterResumeVariantPlanRef,
    );
  }

  if (parsedInput.resumeVariantPlanSummary === undefined)
    return deny("summary_required");
  if (containsUnsafeSummaryMaterial(parsedInput.resumeVariantPlanSummary)) {
    return deny("unsafe_summary_blocked");
  }

  const summary = parseConvexSummary(parsedInput.resumeVariantPlanSummary);
  if (!summary) return deny("summary_required");
  if (summary.resumeVariantPlanRef.id !== adapterResumeVariantPlanRef.id)
    return deny("summary_required");
  if (summary.status !== summary.resumeVariantPlanRef.status)
    return deny("summary_required");
  if (
    summary.status !== "available" &&
    summary.missingDataReason === undefined
  ) {
    return deny("summary_required");
  }

  return {
    ...summary,
    capabilities: buildCapabilities(
      "pr59_read_only_adapter_verified",
      "convex_resume_variant_plan_summary",
    ),
  };
}

export function buildMcpRealResumeVariantPlanSummarySafeRefusal(): McpRealResumeVariantPlanSummarySafeRefusalV1 {
  return {
    code: "real_resume_variant_plan_summary_blocked",
    message: "Refused. Real resume variant plan summary boundary blocked.",
    safeForModel: true,
    rawDataExposed: false,
    credentialsExposed: false,
    ownerIdentityExposed: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseSummaryInput(value: unknown): SummaryInput | undefined {
  const record = readExactRecord(value, INPUT_KEYS, INPUT_REQUIRED_KEYS);
  if (!record) return undefined;
  if (
    record.kind !== "mcp_real_resume_variant_plan_summary_input" ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    adapterResult: record.adapterResult,
    ...(record.resumeVariantPlanSummary !== undefined
      ? { resumeVariantPlanSummary: record.resumeVariantPlanSummary }
      : {}),
  };
}

function parseAllowedAdapterResult(
  value: unknown,
): ParsedAdapterResult | undefined {
  const record = readExactRecord(
    value,
    ADAPTER_RESULT_KEYS,
    ADAPTER_RESULT_KEYS,
  );
  if (!record) return undefined;
  if (!recordMatchesExpected(record, ALLOWED_ADAPTER_RESULT_FIELDS))
    return undefined;

  const refs = readPlainObjectRecord(record.refs);
  const availabilitySummary = parseAvailabilitySummary(
    record.availabilitySummary,
  );
  if (!refs || !availabilitySummary) return undefined;

  const resumeVariantPlanRef = parseAdapterResumeVariantPlanRef(refs);
  if (resumeVariantPlanRef === false) return undefined;

  return {
    ...(resumeVariantPlanRef ? { resumeVariantPlanRef } : {}),
    availabilitySummary,
  };
}

function parseAdapterResumeVariantPlanRef(
  refs: Record<string, unknown>,
): McpRealResumeVariantPlanSummaryRefV1 | undefined | false {
  if (refs.resumeVariantPlanRef === undefined) return undefined;
  return parseResumeVariantPlanRef(refs.resumeVariantPlanRef) ?? false;
}

function isBlockedAdapterResult(value: unknown): boolean {
  const record = readExactRecord(
    value,
    ADAPTER_BLOCKED_RESULT_KEYS,
    ADAPTER_BLOCKED_RESULT_KEYS,
  );
  return Boolean(
    record &&
      record.kind === "mcp_read_only_twoweeks_data_adapter_result" &&
      record.allowed === false &&
      record.modelVisible === true &&
      record.version === 1,
  );
}

function parseResumeVariantPlanRef(
  value: unknown,
): McpRealResumeVariantPlanSummaryRefV1 | undefined {
  const record = readExactRecord(
    value,
    ADAPTER_REF_KEYS,
    ADAPTER_REF_REQUIRED_KEYS,
  );
  if (!record) return undefined;
  const updatedAt = readOptionalIsoTimestamp(record.updatedAt);
  if (updatedAt === false) return undefined;
  if (!isResumeVariantPlanRefRecord(record)) return undefined;

  return {
    id: record.id,
    label: "Resume variant plan availability",
    status: record.status,
    category: "resume_variant_plan",
    count: record.count,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    version: 1,
  };
}

function isResumeVariantPlanRefRecord(
  record: Record<string, unknown>,
): record is Record<string, unknown> & {
  id: string;
  label: string;
  status: McpRealResumeVariantPlanSummaryStatusV1;
  category: "resume_variant_plan";
  count: number;
  version: 1;
} {
  return everyBoolean([
    isSafeResumeVariantPlanRefId(record.id),
    isSafeLabel(record.label),
    isSummaryStatus(record.status),
    record.category === "resume_variant_plan",
    isSafeCount(record.count),
    record.version === 1,
  ]);
}

function parseAvailabilitySummary(
  value: unknown,
): ParsedAdapterResult["availabilitySummary"] | undefined {
  const record = readExactRecord(
    value,
    AVAILABILITY_SUMMARY_KEYS,
    AVAILABILITY_SUMMARY_KEYS,
  );
  if (!record) return undefined;
  if (!isSafeCount(record.onboarding) || record.version !== 1) return undefined;
  return { onboarding: record.onboarding, version: 1 };
}

function parseConvexSummary(value: unknown): ParsedConvexSummary | undefined {
  const record = readExactRecord(
    value,
    SUMMARY_RESULT_KEYS,
    SUMMARY_RESULT_REQUIRED_KEYS,
  );
  if (!record) return undefined;
  if (!recordMatchesExpected(record, ALLOWED_CONVEX_SUMMARY_FIELDS))
    return undefined;
  if (!isSummaryStatus(record.status)) return undefined;

  const requiredFields = parseConvexSummaryRequiredFields(record);
  const optionalFields = parseConvexSummaryOptionalFields(record);
  if (!requiredFields || !optionalFields) return undefined;
  if (!isConvexSummaryCapabilities(record.capabilities)) return undefined;

  return {
    kind: "mcp_real_resume_variant_plan_summary_result",
    allowed: true,
    status: record.status,
    ...requiredFields,
    ...optionalFields,
    capabilities: buildCapabilities(
      "pr59_read_only_adapter_verified",
      "convex_resume_variant_plan_summary",
    ),
    modelVisible: true,
    version: 1,
  };
}

function parseConvexSummaryRequiredFields(
  record: Record<string, unknown>,
): ParsedConvexSummaryRequiredFields | undefined {
  const resumeVariantPlanRef = parseResumeVariantPlanRef(
    record.resumeVariantPlanRef,
  );
  if (!resumeVariantPlanRef) return undefined;

  const availability = parseSummaryAvailability(record.availability);
  if (!availability) return undefined;

  const safeCounts = parseSafeCounts(record.safeCounts);
  if (!safeCounts) return undefined;

  const safeCategories = parseSafeCategories(record.safeCategories);
  if (!safeCategories) return undefined;

  return { resumeVariantPlanRef, availability, safeCounts, safeCategories };
}

function parseConvexSummaryOptionalFields(
  record: Record<string, unknown>,
): ParsedConvexSummaryOptionalFields | undefined {
  const updatedAt = readOptionalIsoTimestamp(record.updatedAt);
  if (updatedAt === false) return undefined;

  const missingDataReason = readOptionalMissingDataReason(
    record.missingDataReason,
  );
  if (missingDataReason === false) return undefined;

  return {
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(missingDataReason !== undefined ? { missingDataReason } : {}),
  };
}

function parseSummaryAvailability(
  value: unknown,
): McpRealResumeVariantPlanSummaryAvailabilityV1 | undefined {
  const record = readExactRecord(
    value,
    SUMMARY_AVAILABILITY_KEYS,
    SUMMARY_AVAILABILITY_KEYS,
  );
  if (!record) return undefined;
  if (record.source !== "convex_resume_variant_plan_summary") return undefined;
  if (
    record.ownerState !== "resolved" &&
    record.ownerState !== "onboarding_required"
  )
    return undefined;
  if (record.version !== 1) return undefined;
  return {
    source: "convex_resume_variant_plan_summary",
    ownerState: record.ownerState,
    version: 1,
  };
}

function parseSafeCounts(
  value: unknown,
): McpRealResumeVariantPlanSummaryCountsV1 | undefined {
  const record = readExactRecord(
    value,
    SUMMARY_COUNTS_KEYS,
    SUMMARY_COUNTS_KEYS,
  );
  if (!record) return undefined;
  if (
    !SUMMARY_COUNTS_KEYS.every(
      (key) => key === "version" || isSafeCount(record[key]),
    )
  ) {
    return undefined;
  }
  if (record.version !== 1) return undefined;
  return {
    plans: record.plans as number,
    planItems: record.planItems as number,
    claimBackedItems: record.claimBackedItems as number,
    missingInputItems: record.missingInputItems as number,
    reviewNeededItems: record.reviewNeededItems as number,
    acceptedItems: record.acceptedItems as number,
    rejectedItems: record.rejectedItems as number,
    blockedItems: record.blockedItems as number,
    warnings: record.warnings as number,
    blockers: record.blockers as number,
    restrictedFactBlockers: record.restrictedFactBlockers as number,
    excludedFactBlockers: record.excludedFactBlockers as number,
    artifactTextBlockers: record.artifactTextBlockers as number,
    allowedClaims: record.allowedClaims as number,
    sourceFacts: record.sourceFacts as number,
    evidenceMatches: record.evidenceMatches as number,
    demands: record.demands as number,
    riskFlags: record.riskFlags as number,
    version: 1,
  };
}

function parseSafeCategories(
  value: unknown,
): McpRealResumeVariantPlanSummaryCategoriesV1 | undefined {
  const record = readExactRecord(value, SUMMARY_CATEGORIES_KEYS, ["version"]);
  if (!record) return undefined;
  if (record.version !== 1) return undefined;
  return buildParsedSafeCategories({
    planStatus: readOptionalPlanStatus(record.planStatus),
    targetDocumentKind: readOptionalTargetDocumentKind(
      record.targetDocumentKind,
    ),
    tailoringCompleteness: readOptionalCompleteness(
      record.tailoringCompleteness,
    ),
    blockerCategory: readOptionalBlockerCategory(record.blockerCategory),
    missingInputCategory: readOptionalMissingInputCategory(
      record.missingInputCategory,
    ),
    reviewNeededCategory: readOptionalReviewNeededCategory(
      record.reviewNeededCategory,
    ),
    nextReviewHint: readOptionalNextReviewHint(record.nextReviewHint),
  });
}

function buildParsedSafeCategories(
  fields: Readonly<
    Record<
      Exclude<keyof McpRealResumeVariantPlanSummaryCategoriesV1, "version">,
      string | undefined | false
    >
  >,
): McpRealResumeVariantPlanSummaryCategoriesV1 | undefined {
  if (Object.values(fields).some((field) => field === false)) return undefined;
  const categories: Record<string, unknown> = { version: 1 };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) categories[key] = value;
  }
  return categories as McpRealResumeVariantPlanSummaryCategoriesV1;
}

function isConvexSummaryCapabilities(value: unknown): boolean {
  const record = readExactRecord(
    value,
    SUMMARY_CAPABILITIES_KEYS,
    SUMMARY_CAPABILITIES_KEYS,
  );
  return Boolean(
    record &&
      isConvexSummaryOwnerResolution(record.ownerResolution) &&
      recordMatchesExpected(record, CONVEX_SUMMARY_CAPABILITY_FIELDS),
  );
}

function isConvexSummaryOwnerResolution(value: unknown): boolean {
  return value === "server_only" || value === "blocked";
}

function allowUnavailable(
  status: McpRealResumeVariantPlanSummaryStatusV1,
  missingDataReason: McpRealResumeVariantPlanSummaryMissingDataReasonV1,
  source: McpRealResumeVariantPlanSummaryAvailabilityV1["source"],
  resumeVariantPlanRef: McpRealResumeVariantPlanSummaryRefV1 = unavailableResumeVariantPlanRef(
    status,
  ),
): McpRealResumeVariantPlanSummaryResultV1 {
  const unavailableRef = { ...resumeVariantPlanRef, count: 0 };
  return {
    kind: "mcp_real_resume_variant_plan_summary_result",
    allowed: true,
    status,
    resumeVariantPlanRef: unavailableRef,
    availability: {
      source,
      ownerState:
        status === "onboarding_required" ? "onboarding_required" : "resolved",
      version: 1,
    },
    safeCounts: zeroCounts(),
    safeCategories: { version: 1 },
    missingDataReason,
    capabilities: buildCapabilities(
      "pr59_read_only_adapter_verified",
      "blocked",
    ),
    modelVisible: true,
    version: 1,
  };
}

function unavailableResumeVariantPlanRef(
  status: McpRealResumeVariantPlanSummaryStatusV1,
): McpRealResumeVariantPlanSummaryRefV1 {
  return {
    id: "mcp-safe-ref:resume-variant-plan:latest",
    label: "Resume variant plan availability",
    status,
    category: "resume_variant_plan",
    count: 0,
    version: 1,
  };
}

function zeroCounts(): McpRealResumeVariantPlanSummaryCountsV1 {
  return {
    plans: 0,
    planItems: 0,
    claimBackedItems: 0,
    missingInputItems: 0,
    reviewNeededItems: 0,
    acceptedItems: 0,
    rejectedItems: 0,
    blockedItems: 0,
    warnings: 0,
    blockers: 0,
    restrictedFactBlockers: 0,
    excludedFactBlockers: 0,
    artifactTextBlockers: 0,
    allowedClaims: 0,
    sourceFacts: 0,
    evidenceMatches: 0,
    demands: 0,
    riskFlags: 0,
    version: 1,
  };
}

function deny(
  reason: McpRealResumeVariantPlanSummaryBlockedReasonV1,
): McpRealResumeVariantPlanSummaryResultV1 {
  return {
    kind: "mcp_real_resume_variant_plan_summary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpRealResumeVariantPlanSummarySafeRefusal(),
    capabilities: buildCapabilities("blocked", "blocked"),
    modelVisible: true,
    version: 1,
  };
}

function buildCapabilities(
  adapter: McpRealResumeVariantPlanSummaryCapabilitiesV1["adapter"],
  dataReads: McpRealResumeVariantPlanSummaryCapabilitiesV1["dataReads"],
): McpRealResumeVariantPlanSummaryCapabilitiesV1 {
  return {
    adapter,
    dataReads,
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    exportActions: "blocked",
    rawDataProjection: "blocked",
    credentialStorage: "none",
    tokenStorage: "none",
    version: 1,
  };
}

function readExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | undefined {
  const record = readPlainObjectRecord(value);
  if (!record) return undefined;
  const keys = Object.keys(record);
  if (!keys.every((key) => allowedKeys.includes(key))) return undefined;
  if (
    !requiredKeys.every((key) =>
      Object.prototype.hasOwnProperty.call(record, key),
    )
  ) {
    return undefined;
  }
  return record;
}

function recordMatchesExpected(
  record: Record<string, unknown>,
  expected: Readonly<Record<string, unknown>>,
): boolean {
  return Object.entries(expected).every(
    ([key, expectedValue]) => record[key] === expectedValue,
  );
}

function everyBoolean(values: readonly boolean[]): boolean {
  return values.every((value) => value);
}

function readPlainObjectRecord(
  value: unknown,
): Record<string, unknown> | undefined {
  const descriptors = readPlainObjectDescriptors(value);
  return descriptors ? readDescriptorRecord(descriptors) : undefined;
}

function readPlainObjectDescriptors(
  value: unknown,
): Record<PropertyKey, PropertyDescriptor | undefined> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value))
    return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    return Object.getOwnPropertyDescriptors(value);
  } catch {
    return undefined;
  }
}

function readDescriptorRecord(
  descriptors: Record<PropertyKey, PropertyDescriptor | undefined>,
): Record<string, unknown> | undefined {
  const record: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    const entry = readDescriptorEntry(key, descriptors[key]);
    if (!entry) return undefined;
    record[entry.key] = entry.value;
  }
  return record;
}

function readDescriptorEntry(
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): { key: string; value: unknown } | undefined {
  if (typeof key !== "string") return undefined;
  if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor))
    return undefined;
  return { key, value: descriptor.value };
}

function containsUnsafeSummaryMaterial(value: unknown): boolean {
  return visitUnsafeSummaryMaterial(value, new WeakSet<object>(), 0);
}

function visitUnsafeSummaryMaterial(
  value: unknown,
  seen: WeakSet<object>,
  depth: number,
): boolean {
  if (depth > 5) return true;
  if (typeof value === "string") return containsUnsafeText(value);
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  const record = readPlainObjectRecord(value);
  if (!record) return true;
  seen.add(value);
  const unsafe = Object.entries(record).some(
    ([key, item]) =>
      containsUnsafeKey(key) ||
      visitUnsafeSummaryMaterial(item, seen, depth + 1),
  );
  seen.delete(value);
  return unsafe;
}

function containsUnsafeKey(key: string): boolean {
  const normalizedKey = key.replace(/[\s_-]/gu, "").toLowerCase();
  if (normalizedKey === "source") return false;
  if (normalizedKey === "sourcefacts") return false;
  if (normalizedKey === "allowedclaims") return false;
  if (normalizedKey === "rawdataprojection") return false;
  return /(?:raw|content|coverletter|cvtext|resumetext|jobdescription|proposaltext|sourcetext|sourcequote|quote|debug|shadow|token|claims|email|clerk|userid|sessionid|subject|documentid|convex|full)/u.test(
    normalizedKey,
  );
}

function containsUnsafeText(value: string): boolean {
  if (SAFE_CATEGORY_VALUES.has(value)) return false;
  return /(?:raw[_ -]?(?:cv|job|resume|proposal|text)|proposal content|coverLetter|generated resume variant content|generated artifact content|source[_ -]?(?:text|quote)|private fact detail|never_use fact detail|structured[_ -]?shadow|documentid|bearer\s+\S+|accessToken|refreshToken|rawClaims|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/iu.test(
    value,
  );
}

function isSummaryStatus(
  value: unknown,
): value is McpRealResumeVariantPlanSummaryStatusV1 {
  return (
    value === "available" ||
    value === "no_data_available" ||
    value === "onboarding_required"
  );
}

function isSafeResumeVariantPlanRefId(value: unknown): value is string {
  return value === "mcp-safe-ref:resume-variant-plan:latest";
}

function isSafeLabel(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /\S/u.test(value) &&
    value.length <= 80 &&
    !containsUnsafeText(value)
  );
}

function isSafeCount(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 0 &&
    value <= MAX_SAFE_COUNT
  );
}

function readOptionalIsoTimestamp(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return isOptionalIsoTimestamp(value) ? value : false;
}

function isOptionalIsoTimestamp(value: unknown): value is string | undefined {
  return (
    value === undefined ||
    (typeof value === "string" &&
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(value) &&
      Number.isFinite(Date.parse(value)))
  );
}

function readOptionalMissingDataReason(
  value: unknown,
): McpRealResumeVariantPlanSummaryMissingDataReasonV1 | undefined | false {
  if (value === undefined) return undefined;
  return isMissingDataReason(value) ? value : false;
}

function isMissingDataReason(
  value: unknown,
): value is McpRealResumeVariantPlanSummaryMissingDataReasonV1 {
  return (
    value === "resume_variant_plan_ref_missing" ||
    value === "resume_variant_plan_not_available" ||
    value === "owner_onboarding_required" ||
    value === "summary_unavailable"
  );
}

function readOptionalPlanStatus(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "draft" ||
    value === "needs_review" ||
    value === "blocked" ||
    value === "ready_for_review" ||
    value === "unknown"
    ? value
    : false;
}

function readOptionalTargetDocumentKind(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "resume" || value === "cv" ? value : false;
}

function readOptionalCompleteness(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "complete" ||
    value === "partial" ||
    value === "missing" ||
    value === "unknown"
    ? value
    : false;
}

function readOptionalBlockerCategory(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return isAllowedBlockerCategory(value) ? value : false;
}

function isAllowedBlockerCategory(value: unknown): value is string {
  return (
    value === "missing_evidence" ||
    value === "private_fact" ||
    value === "never_use_fact" ||
    value === "generated_text_as_fact" ||
    value === "unsupported" ||
    value === "source_truth" ||
    value === "other" ||
    value === "none"
  );
}

function readOptionalMissingInputCategory(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "missing_evidence" ||
    value === "missing_claims" ||
    value === "missing_plan_items" ||
    value === "no_plan" ||
    value === "none"
    ? value
    : false;
}

function readOptionalReviewNeededCategory(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "review_warnings" ||
    value === "review_items" ||
    value === "ready_for_review" ||
    value === "blocked"
    ? value
    : false;
}

function readOptionalNextReviewHint(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "review_blockers" ||
    value === "review_missing_inputs" ||
    value === "review_plan_items" ||
    value === "ready_for_review"
    ? value
    : false;
}
