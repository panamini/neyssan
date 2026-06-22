export type McpRealReviewCockpitSummaryStatusV1 =
  | "available"
  | "no_data_available"
  | "onboarding_required";

export type McpRealReviewCockpitSummaryMissingDataReasonV1 =
  | "review_cockpit_ref_missing"
  | "review_cockpit_not_available"
  | "owner_onboarding_required"
  | "summary_unavailable";

export type McpRealReviewCockpitSummaryRefV1 = Readonly<{
  id: string;
  label: string;
  status: McpRealReviewCockpitSummaryStatusV1;
  category: "review_cockpit";
  count: number;
  updatedAt?: string;
  version: 1;
}>;

export type McpRealReviewCockpitSummaryCountsV1 = Readonly<{
  reviewContexts: number;
  reviewRuns: number;
  reviewArtifacts: number;
  applicationPackages: number;
  pendingReviews: number;
  approvedReviews: number;
  blockedReviews: number;
  failedRuns: number;
  blockedRuns: number;
  blockedArtifacts: number;
  blockedPackages: number;
  missingReviewItems: number;
  approvalNeeded: number;
  staleInputs: number;
  overLimitCollections: number;
  version: 1;
}>;

export type McpRealReviewCockpitSummaryCategoriesV1 = Readonly<{
  reviewReadiness?:
    | "ready_for_review"
    | "needs_user_review"
    | "blocked"
    | "unknown";
  reviewGateStatus?: "ready" | "needs_review" | "blocked" | "unknown";
  blockerCategory?:
    | "blocked_package"
    | "blocked_artifact"
    | "blocked_run"
    | "failed_run"
    | "none";
  missingReviewCategory?:
    | "missing_review_context"
    | "missing_review_artifact"
    | "missing_application_package"
    | "pending_review_items"
    | "none";
  nextReviewHint?:
    | "review_blockers"
    | "review_pending_items"
    | "review_missing_inputs"
    | "refresh_stale_inputs"
    | "ready_for_review"
    | "add_application_context";
  nextUserAction?:
    | "review_blockers"
    | "review_pending_items"
    | "review_missing_inputs"
    | "refresh_inputs"
    | "approve_review_gate"
    | "none";
  version: 1;
}>;

export type McpRealReviewCockpitSummaryFlagsV1 = Readonly<{
  approvalNeeded: boolean;
  staleData: boolean;
  overLimit: boolean;
  version: 1;
}>;

export type McpRealReviewCockpitSummaryAvailabilityV1 = Readonly<{
  source: "pr59_read_only_adapter" | "convex_review_cockpit_summary";
  ownerState: "resolved" | "onboarding_required";
  version: 1;
}>;

export type McpRealReviewCockpitSummaryCapabilitiesV1 = Readonly<{
  adapter: "blocked" | "pr59_read_only_adapter_verified";
  dataReads: "blocked" | "convex_review_cockpit_summary";
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

export type McpRealReviewCockpitSummarySafeRefusalV1 = Readonly<{
  code: "real_review_cockpit_summary_blocked";
  msg: "Refused. Real review cockpit summary boundary blocked.";
  safeForModel: true;
  rawDataExposed: false;
  credentialsExposed: false;
  ownerIdentityExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpRealReviewCockpitSummaryBlockedReasonV1 =
  | "invalid_input"
  | "adapter_required"
  | "summary_required"
  | "unsafe_summary_blocked";

export type McpRealReviewCockpitSummaryResultV1 = Readonly<
  | {
      kind: "mcp_real_review_cockpit_summary_result";
      allowed: true;
      status: McpRealReviewCockpitSummaryStatusV1;
      reviewCockpitRef: McpRealReviewCockpitSummaryRefV1;
      availability: McpRealReviewCockpitSummaryAvailabilityV1;
      safeCounts: McpRealReviewCockpitSummaryCountsV1;
      safeCategories: McpRealReviewCockpitSummaryCategoriesV1;
      safeFlags: McpRealReviewCockpitSummaryFlagsV1;
      updatedAt?: string;
      missingDataReason?: McpRealReviewCockpitSummaryMissingDataReasonV1;
      capabilities: McpRealReviewCockpitSummaryCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_real_review_cockpit_summary_result";
      allowed: false;
      reason: McpRealReviewCockpitSummaryBlockedReasonV1;
      safeRefusal: McpRealReviewCockpitSummarySafeRefusalV1;
      capabilities: McpRealReviewCockpitSummaryCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
>;

type SummaryInput = Readonly<{
  adapterResult: unknown;
  reviewCockpitSummary?: unknown;
}>;

type ParsedAdapterResult = Readonly<{
  reviewCockpitRef?: McpRealReviewCockpitSummaryRefV1;
  availabilitySummary: Readonly<{
    onboarding: number;
    version: 1;
  }>;
}>;

type ParsedConvexSummary = Extract<
  McpRealReviewCockpitSummaryResultV1,
  { allowed: true }
>;
type ParsedConvexSummaryRequiredFields = Pick<
  ParsedConvexSummary,
  | "reviewCockpitRef"
  | "availability"
  | "safeCounts"
  | "safeCategories"
  | "safeFlags"
>;
type ParsedConvexSummaryOptionalFields = Partial<
  Pick<ParsedConvexSummary, "updatedAt" | "missingDataReason">
>;

const INPUT_KEYS = [
  "kind",
  "adapterResult",
  "reviewCockpitSummary",
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
] as const;
const SUMMARY_RESULT_REQUIRED_KEYS = [
  "kind",
  "allowed",
  "status",
  "reviewCockpitRef",
  "availability",
  "safeCounts",
  "safeCategories",
  "safeFlags",
  "capabilities",
  "modelVisible",
  "version",
] as const;
const SUMMARY_AVAILABILITY_KEYS = ["source", "ownerState", "version"] as const;
const SUMMARY_COUNTS_KEYS = [
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
] as const;
const SUMMARY_CATEGORIES_KEYS = [
  "reviewReadiness",
  "reviewGateStatus",
  "blockerCategory",
  "missingReviewCategory",
  "nextReviewHint",
  "nextUserAction",
  "version",
] as const;
const SUMMARY_FLAGS_KEYS = [
  "approvalNeeded",
  "staleData",
  "overLimit",
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
  kind: "mcp_review_cockpit_summary_result",
  allowed: true,
  modelVisible: true,
  version: 1,
} as const;
const CONVEX_SUMMARY_CAPABILITY_FIELDS = {
  dataReads: "convex_review_cockpit_summary",
  dataWrites: "blocked",
  handlerExecution: "blocked",
  productionConnector: "blocked",
  networkAccess: "blocked",
  modelCalls: "blocked",
  writeActions: "blocked",
  rawDataProjection: "blocked",
  version: 1,
} as const;

export function projectMcpRealReviewCockpitSummary(
  input: unknown,
): McpRealReviewCockpitSummaryResultV1 {
  const parsedInput = parseSummaryInput(input);
  if (!parsedInput) return deny("invalid_input");

  const adapter = parseAllowedAdapterResult(parsedInput.adapterResult);
  if (!adapter) {
    return isBlockedAdapterResult(parsedInput.adapterResult)
      ? deny("adapter_required")
      : deny("invalid_input");
  }

  const adapterReviewCockpitRef = adapter.reviewCockpitRef;
  if (!adapterReviewCockpitRef) {
    return allowUnavailable(
      "no_data_available",
      "review_cockpit_ref_missing",
      "pr59_read_only_adapter",
    );
  }

  if (adapterReviewCockpitRef.status !== "available") {
    return allowUnavailable(
      adapterReviewCockpitRef.status,
      adapterReviewCockpitRef.status === "onboarding_required"
        ? "owner_onboarding_required"
        : "review_cockpit_not_available",
      "pr59_read_only_adapter",
      adapterReviewCockpitRef,
    );
  }

  if (parsedInput.reviewCockpitSummary === undefined)
    return deny("summary_required");
  if (containsUnsafeSummaryMaterial(parsedInput.reviewCockpitSummary)) {
    return deny("unsafe_summary_blocked");
  }

  const summary = parseConvexSummary(parsedInput.reviewCockpitSummary);
  if (!summary) return deny("summary_required");
  if (summary.reviewCockpitRef.id !== adapterReviewCockpitRef.id)
    return deny("summary_required");
  if (summary.status !== summary.reviewCockpitRef.status)
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
      "convex_review_cockpit_summary",
    ),
  };
}

export function buildMcpRealReviewCockpitSummarySafeRefusal(): McpRealReviewCockpitSummarySafeRefusalV1 {
  return {
    code: "real_review_cockpit_summary_blocked",
    msg: "Refused. Real review cockpit summary boundary blocked.",
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
    record.kind !== "mcp_real_review_cockpit_summary_input" ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    adapterResult: record.adapterResult,
    ...(record.reviewCockpitSummary !== undefined
      ? { reviewCockpitSummary: record.reviewCockpitSummary }
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
  const reviewCockpitRef = parseAdapterReviewCockpitRef(refs);
  if (reviewCockpitRef === false) return undefined;
  return {
    ...(reviewCockpitRef ? { reviewCockpitRef } : {}),
    availabilitySummary,
  };
}

function parseAdapterReviewCockpitRef(
  refs: Record<string, unknown>,
): McpRealReviewCockpitSummaryRefV1 | undefined | false {
  const refKeys = Object.keys(refs);
  if (refKeys.length === 0) return undefined;
  if (refKeys.length !== 1 || refs.reviewCockpitRef === undefined) return false;
  return parseReviewCockpitRef(refs.reviewCockpitRef) ?? false;
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

function parseReviewCockpitRef(
  value: unknown,
): McpRealReviewCockpitSummaryRefV1 | undefined {
  const record = readExactRecord(
    value,
    ADAPTER_REF_KEYS,
    ADAPTER_REF_REQUIRED_KEYS,
  );
  if (!record) return undefined;
  const updatedAt = readOptionalIsoTimestamp(record.updatedAt);
  if (updatedAt === false) return undefined;
  if (!isReviewCockpitRefRecord(record)) return undefined;
  return {
    id: record.id,
    label: "Review cockpit availability",
    status: record.status,
    category: "review_cockpit",
    count: record.count,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    version: 1,
  };
}

function isReviewCockpitRefRecord(
  record: Record<string, unknown>,
): record is Record<string, unknown> & {
  id: string;
  label: string;
  status: McpRealReviewCockpitSummaryStatusV1;
  category: "review_cockpit";
  count: number;
  version: 1;
} {
  return everyBoolean([
    isSafeReviewCockpitRefId(record.id),
    isSafeLabel(record.label),
    isSummaryStatus(record.status),
    record.category === "review_cockpit",
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
    kind: "mcp_real_review_cockpit_summary_result",
    allowed: true,
    status: record.status,
    ...requiredFields,
    ...optionalFields,
    capabilities: buildCapabilities(
      "pr59_read_only_adapter_verified",
      "convex_review_cockpit_summary",
    ),
    modelVisible: true,
    version: 1,
  };
}

function parseConvexSummaryRequiredFields(
  record: Record<string, unknown>,
): ParsedConvexSummaryRequiredFields | undefined {
  const reviewCockpitRef = parseReviewCockpitRef(record.reviewCockpitRef);
  if (!reviewCockpitRef) return undefined;
  const availability = parseSummaryAvailability(record.availability);
  if (!availability) return undefined;
  const safeCounts = parseSafeCounts(record.safeCounts);
  if (!safeCounts) return undefined;
  const safeCategories = parseSafeCategories(record.safeCategories);
  if (!safeCategories) return undefined;
  const safeFlags = parseSafeFlags(record.safeFlags);
  if (!safeFlags) return undefined;
  return {
    reviewCockpitRef,
    availability,
    safeCounts,
    safeCategories,
    safeFlags,
  };
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
): McpRealReviewCockpitSummaryAvailabilityV1 | undefined {
  const record = readExactRecord(
    value,
    SUMMARY_AVAILABILITY_KEYS,
    SUMMARY_AVAILABILITY_KEYS,
  );
  if (!record) return undefined;
  if (record.source !== "convex_review_cockpit_summary") return undefined;
  if (
    record.ownerState !== "resolved" &&
    record.ownerState !== "onboarding_required"
  ) {
    return undefined;
  }
  if (record.version !== 1) return undefined;
  return {
    source: "convex_review_cockpit_summary",
    ownerState: record.ownerState,
    version: 1,
  };
}

function parseSafeCounts(
  value: unknown,
): McpRealReviewCockpitSummaryCountsV1 | undefined {
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
    reviewContexts: record.reviewContexts as number,
    reviewRuns: record.reviewRuns as number,
    reviewArtifacts: record.reviewArtifacts as number,
    applicationPackages: record.applicationPackages as number,
    pendingReviews: record.pendingReviews as number,
    approvedReviews: record.approvedReviews as number,
    blockedReviews: record.blockedReviews as number,
    failedRuns: record.failedRuns as number,
    blockedRuns: record.blockedRuns as number,
    blockedArtifacts: record.blockedArtifacts as number,
    blockedPackages: record.blockedPackages as number,
    missingReviewItems: record.missingReviewItems as number,
    approvalNeeded: record.approvalNeeded as number,
    staleInputs: record.staleInputs as number,
    overLimitCollections: record.overLimitCollections as number,
    version: 1,
  };
}

function parseSafeCategories(
  value: unknown,
): McpRealReviewCockpitSummaryCategoriesV1 | undefined {
  const record = readExactRecord(value, SUMMARY_CATEGORIES_KEYS, ["version"]);
  if (!record) return undefined;
  if (record.version !== 1) return undefined;
  return buildParsedSafeCategories({
    reviewReadiness: readOptionalReviewReadiness(record.reviewReadiness),
    reviewGateStatus: readOptionalReviewGateStatus(record.reviewGateStatus),
    blockerCategory: readOptionalBlockerCategory(record.blockerCategory),
    missingReviewCategory: readOptionalMissingReviewCategory(
      record.missingReviewCategory,
    ),
    nextReviewHint: readOptionalNextReviewHint(record.nextReviewHint),
    nextUserAction: readOptionalNextUserAction(record.nextUserAction),
  });
}

function buildParsedSafeCategories(
  fields: Readonly<
    Record<
      Exclude<keyof McpRealReviewCockpitSummaryCategoriesV1, "version">,
      string | undefined | false
    >
  >,
): McpRealReviewCockpitSummaryCategoriesV1 | undefined {
  if (Object.values(fields).some((field) => field === false)) return undefined;
  const categories: Record<string, unknown> = { version: 1 };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) categories[key] = value;
  }
  return categories as McpRealReviewCockpitSummaryCategoriesV1;
}

function parseSafeFlags(
  value: unknown,
): McpRealReviewCockpitSummaryFlagsV1 | undefined {
  const record = readExactRecord(value, SUMMARY_FLAGS_KEYS, SUMMARY_FLAGS_KEYS);
  if (!record) return undefined;
  if (
    typeof record.approvalNeeded !== "boolean" ||
    typeof record.staleData !== "boolean" ||
    typeof record.overLimit !== "boolean" ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    approvalNeeded: record.approvalNeeded,
    staleData: record.staleData,
    overLimit: record.overLimit,
    version: 1,
  };
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
  status: McpRealReviewCockpitSummaryStatusV1,
  missingDataReason: McpRealReviewCockpitSummaryMissingDataReasonV1,
  source: McpRealReviewCockpitSummaryAvailabilityV1["source"],
  reviewCockpitRef: McpRealReviewCockpitSummaryRefV1 = unavailableReviewCockpitRef(
    status,
  ),
): McpRealReviewCockpitSummaryResultV1 {
  const unavailableRef = { ...reviewCockpitRef, count: 0 };
  return {
    kind: "mcp_real_review_cockpit_summary_result",
    allowed: true,
    status,
    reviewCockpitRef: unavailableRef,
    availability: {
      source,
      ownerState:
        status === "onboarding_required" ? "onboarding_required" : "resolved",
      version: 1,
    },
    safeCounts: zeroCounts(),
    safeCategories: { version: 1 },
    safeFlags: {
      approvalNeeded: false,
      staleData: false,
      overLimit: false,
      version: 1,
    },
    missingDataReason,
    capabilities: buildCapabilities(
      "pr59_read_only_adapter_verified",
      "blocked",
    ),
    modelVisible: true,
    version: 1,
  };
}

function unavailableReviewCockpitRef(
  status: McpRealReviewCockpitSummaryStatusV1,
): McpRealReviewCockpitSummaryRefV1 {
  return {
    id: "mcp-safe-ref:review-cockpit:latest",
    label: "Review cockpit availability",
    status,
    category: "review_cockpit",
    count: 0,
    version: 1,
  };
}

function zeroCounts(): McpRealReviewCockpitSummaryCountsV1 {
  return {
    reviewContexts: 0,
    reviewRuns: 0,
    reviewArtifacts: 0,
    applicationPackages: 0,
    pendingReviews: 0,
    approvedReviews: 0,
    blockedReviews: 0,
    failedRuns: 0,
    blockedRuns: 0,
    blockedArtifacts: 0,
    blockedPackages: 0,
    missingReviewItems: 0,
    approvalNeeded: 0,
    staleInputs: 0,
    overLimitCollections: 0,
    version: 1,
  };
}

function deny(
  reason: McpRealReviewCockpitSummaryBlockedReasonV1,
): McpRealReviewCockpitSummaryResultV1 {
  return {
    kind: "mcp_real_review_cockpit_summary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpRealReviewCockpitSummarySafeRefusal(),
    capabilities: buildCapabilities("blocked", "blocked"),
    modelVisible: true,
    version: 1,
  };
}

function buildCapabilities(
  adapter: McpRealReviewCockpitSummaryCapabilitiesV1["adapter"],
  dataReads: McpRealReviewCockpitSummaryCapabilitiesV1["dataReads"],
): McpRealReviewCockpitSummaryCapabilitiesV1 {
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
  if (normalizedKey === "rawdataprojection") return false;
  return /(?:raw|content|coverletter|cvtext|resumetext|jobdescription|proposaltext|sourcetext|sourcequote|quote|private|never|debug|shadow|token|claims|email|clerk|userid|sessionid|subject|documentid|convex|full|generated|note)/u.test(
    normalizedKey,
  );
}

function containsUnsafeText(value: string): boolean {
  return /(?:raw[_ -]?(?:cv|job|resume|proposal|text)|proposal content|coverLetter|generated resume variant content|generated artifact content|src[_ -]?(?:text|quote)|source quote|private fact detail|never_use fact detail|structured[_ -]?shadow|documentid|bearer\s+\S+|accessToken|refreshToken|rawClaims|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/iu.test(
    value,
  );
}

function isSummaryStatus(
  value: unknown,
): value is McpRealReviewCockpitSummaryStatusV1 {
  return (
    value === "available" ||
    value === "no_data_available" ||
    value === "onboarding_required"
  );
}

function isSafeReviewCockpitRefId(value: unknown): value is string {
  return value === "mcp-safe-ref:review-cockpit:latest";
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
): McpRealReviewCockpitSummaryMissingDataReasonV1 | undefined | false {
  if (value === undefined) return undefined;
  return isMissingDataReason(value) ? value : false;
}

function isMissingDataReason(
  value: unknown,
): value is McpRealReviewCockpitSummaryMissingDataReasonV1 {
  return (
    value === "review_cockpit_ref_missing" ||
    value === "review_cockpit_not_available" ||
    value === "owner_onboarding_required" ||
    value === "summary_unavailable"
  );
}

function readOptionalReviewReadiness(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "ready_for_review" ||
    value === "needs_user_review" ||
    value === "blocked" ||
    value === "unknown"
    ? value
    : false;
}

function readOptionalReviewGateStatus(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "ready" ||
    value === "needs_review" ||
    value === "blocked" ||
    value === "unknown"
    ? value
    : false;
}

function readOptionalBlockerCategory(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "blocked_package" ||
    value === "blocked_artifact" ||
    value === "blocked_run" ||
    value === "failed_run" ||
    value === "none"
    ? value
    : false;
}

function readOptionalMissingReviewCategory(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "missing_review_context" ||
    value === "missing_review_artifact" ||
    value === "missing_application_package" ||
    value === "pending_review_items" ||
    value === "none"
    ? value
    : false;
}

function readOptionalNextReviewHint(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "review_blockers" ||
    value === "review_pending_items" ||
    value === "review_missing_inputs" ||
    value === "refresh_stale_inputs" ||
    value === "ready_for_review" ||
    value === "add_application_context"
    ? value
    : false;
}

function readOptionalNextUserAction(
  value: unknown,
): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "review_blockers" ||
    value === "review_pending_items" ||
    value === "review_missing_inputs" ||
    value === "refresh_inputs" ||
    value === "approve_review_gate" ||
    value === "none"
    ? value
    : false;
}
