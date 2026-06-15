export type McpRealEvidenceGraphSummaryStatusV1 =
  | "available"
  | "no_data_available"
  | "onboarding_required";

export type McpRealEvidenceGraphSummaryMissingDataReasonV1 =
  | "evidence_graph_ref_missing"
  | "evidence_graph_not_available"
  | "owner_onboarding_required"
  | "summary_unavailable";

export type McpRealEvidenceGraphSummaryRefV1 = Readonly<{
  id: string;
  label: string;
  status: McpRealEvidenceGraphSummaryStatusV1;
  category: "evidence_graph";
  count: number;
  updatedAt?: string;
  version: 1;
}>;

export type McpRealEvidenceGraphSummaryCountsV1 = Readonly<{
  sourceDocuments: number;
  candidateFacts: number;
  approvedFacts: number;
  pendingFacts: number;
  rejectedFacts: number;
  restrictedEvidence: number;
  archivedEvidence: number;
  provenanceLinks: number;
  evidenceMatches: number;
  allowedClaims: number;
  missingEvidence: number;
  riskFlags: number;
  staleSources: number;
  warnings: number;
  blockers: number;
  version: 1;
}>;

export type McpRealEvidenceGraphSummaryCategoriesV1 = Readonly<{
  evidenceCoverage?: "complete" | "partial" | "missing" | "unknown";
  provenanceCoverage?: "complete" | "partial" | "missing" | "unknown";
  qualityStatus?: "ready_for_review" | "needs_review" | "blocked" | "unknown";
  blockerCategory?:
    | "missing_evidence"
    | "restricted_evidence"
    | "stale_sources"
    | "unsupported"
    | "none";
  nextReviewHint?:
    | "add_candidate_evidence"
    | "review_missing_evidence"
    | "review_restricted_evidence"
    | "refresh_stale_sources"
    | "ready_for_review";
  version: 1;
}>;

export type McpRealEvidenceGraphSummaryAvailabilityV1 = Readonly<{
  source: "pr59_read_only_adapter" | "convex_evidence_graph_summary";
  ownerState: "resolved" | "onboarding_required";
  version: 1;
}>;

export type McpRealEvidenceGraphSummaryCapabilitiesV1 = Readonly<{
  adapter: "blocked" | "pr59_read_only_adapter_verified";
  dataReads: "blocked" | "convex_evidence_graph_summary";
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

export type McpRealEvidenceGraphSummarySafeRefusalV1 = Readonly<{
  code: "real_evidence_graph_summary_blocked";
  message: "Refused. Real evidence graph summary boundary blocked.";
  safeForModel: true;
  rawDataExposed: false;
  credentialsExposed: false;
  ownerIdentityExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpRealEvidenceGraphSummaryBlockedReasonV1 =
  | "invalid_input"
  | "adapter_required"
  | "summary_required"
  | "unsafe_summary_blocked";

export type McpRealEvidenceGraphSummaryResultV1 = Readonly<
  | {
      kind: "mcp_real_evidence_graph_summary_result";
      allowed: true;
      status: McpRealEvidenceGraphSummaryStatusV1;
      evidenceGraphRef: McpRealEvidenceGraphSummaryRefV1;
      availability: McpRealEvidenceGraphSummaryAvailabilityV1;
      safeCounts: McpRealEvidenceGraphSummaryCountsV1;
      safeCategories: McpRealEvidenceGraphSummaryCategoriesV1;
      updatedAt?: string;
      missingDataReason?: McpRealEvidenceGraphSummaryMissingDataReasonV1;
      capabilities: McpRealEvidenceGraphSummaryCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_real_evidence_graph_summary_result";
      allowed: false;
      reason: McpRealEvidenceGraphSummaryBlockedReasonV1;
      safeRefusal: McpRealEvidenceGraphSummarySafeRefusalV1;
      capabilities: McpRealEvidenceGraphSummaryCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
>;

type SummaryInput = Readonly<{
  adapterResult: unknown;
  evidenceGraphSummary?: unknown;
}>;

type ParsedAdapterResult = Readonly<{
  evidenceGraphRef?: McpRealEvidenceGraphSummaryRefV1;
  availabilitySummary: Readonly<{
    onboarding: number;
    version: 1;
  }>;
}>;

type ParsedConvexSummary = Extract<McpRealEvidenceGraphSummaryResultV1, { allowed: true }>;
type ParsedConvexSummaryRequiredFields = Pick<
  ParsedConvexSummary,
  "evidenceGraphRef" | "availability" | "safeCounts" | "safeCategories"
>;
type ParsedConvexSummaryOptionalFields = Partial<
  Pick<ParsedConvexSummary, "updatedAt" | "missingDataReason">
>;

const INPUT_KEYS = ["kind", "adapterResult", "evidenceGraphSummary", "version"] as const;
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
const ADAPTER_REF_REQUIRED_KEYS = ["id", "label", "status", "category", "count", "version"] as const;

const AVAILABILITY_SUMMARY_KEYS = ["available", "noData", "onboarding", "blocked", "version"] as const;

const SUMMARY_RESULT_KEYS = [
  "kind",
  "allowed",
  "status",
  "evidenceGraphRef",
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
  "evidenceGraphRef",
  "availability",
  "safeCounts",
  "safeCategories",
  "capabilities",
  "modelVisible",
  "version",
] as const;

const SUMMARY_AVAILABILITY_KEYS = ["source", "ownerState", "version"] as const;
const SUMMARY_COUNTS_KEYS = [
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
] as const;
const SUMMARY_CATEGORIES_KEYS = [
  "evidenceCoverage",
  "provenanceCoverage",
  "qualityStatus",
  "blockerCategory",
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
  kind: "mcp_evidence_graph_summary_result",
  allowed: true,
  modelVisible: true,
  version: 1,
} as const;

const CONVEX_SUMMARY_CAPABILITY_FIELDS = {
  dataReads: "convex_evidence_graph_summary",
  dataWrites: "blocked",
  handlerExecution: "blocked",
  productionConnector: "blocked",
  networkAccess: "blocked",
  modelCalls: "blocked",
  writeActions: "blocked",
  rawDataProjection: "blocked",
  version: 1,
} as const;

export function projectMcpRealEvidenceGraphSummary(
  input: unknown,
): McpRealEvidenceGraphSummaryResultV1 {
  const parsedInput = parseSummaryInput(input);
  if (!parsedInput) return deny("invalid_input");

  const adapter = parseAllowedAdapterResult(parsedInput.adapterResult);
  if (!adapter) {
    return isBlockedAdapterResult(parsedInput.adapterResult) ? deny("adapter_required") : deny("invalid_input");
  }

  const adapterEvidenceGraphRef = adapter.evidenceGraphRef;
  if (!adapterEvidenceGraphRef) {
    return allowUnavailable(
      "no_data_available",
      "evidence_graph_ref_missing",
      "pr59_read_only_adapter",
    );
  }

  if (adapterEvidenceGraphRef.status !== "available") {
    return allowUnavailable(
      adapterEvidenceGraphRef.status,
      adapterEvidenceGraphRef.status === "onboarding_required"
        ? "owner_onboarding_required"
        : "evidence_graph_not_available",
      "pr59_read_only_adapter",
      adapterEvidenceGraphRef,
    );
  }

  if (parsedInput.evidenceGraphSummary === undefined) return deny("summary_required");
  if (containsUnsafeSummaryMaterial(parsedInput.evidenceGraphSummary)) {
    return deny("unsafe_summary_blocked");
  }

  const summary = parseConvexSummary(parsedInput.evidenceGraphSummary);
  if (!summary) return deny("summary_required");
  if (summary.evidenceGraphRef.id !== adapterEvidenceGraphRef.id) return deny("summary_required");
  if (summary.status !== summary.evidenceGraphRef.status) return deny("summary_required");
  if (summary.status !== "available" && summary.missingDataReason === undefined) {
    return deny("summary_required");
  }

  return {
    ...summary,
    capabilities: buildCapabilities("pr59_read_only_adapter_verified", "convex_evidence_graph_summary"),
  };
}

export function buildMcpRealEvidenceGraphSummarySafeRefusal(): McpRealEvidenceGraphSummarySafeRefusalV1 {
  return {
    code: "real_evidence_graph_summary_blocked",
    message: "Refused. Real evidence graph summary boundary blocked.",
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
  if (record.kind !== "mcp_real_evidence_graph_summary_input" || record.version !== 1) {
    return undefined;
  }
  return {
    adapterResult: record.adapterResult,
    ...(record.evidenceGraphSummary !== undefined ? { evidenceGraphSummary: record.evidenceGraphSummary } : {}),
  };
}

function parseAllowedAdapterResult(value: unknown): ParsedAdapterResult | undefined {
  const record = readExactRecord(value, ADAPTER_RESULT_KEYS, ADAPTER_RESULT_KEYS);
  if (!record) return undefined;
  if (!recordMatchesExpected(record, ALLOWED_ADAPTER_RESULT_FIELDS)) return undefined;

  const refs = readPlainObjectRecord(record.refs);
  const availabilitySummary = parseAvailabilitySummary(record.availabilitySummary);
  if (!refs || !availabilitySummary) return undefined;

  const evidenceGraphRef = parseAdapterEvidenceGraphRef(refs);
  if (evidenceGraphRef === false) return undefined;

  return {
    ...(evidenceGraphRef ? { evidenceGraphRef } : {}),
    availabilitySummary,
  };
}

function parseAdapterEvidenceGraphRef(
  refs: Record<string, unknown>,
): McpRealEvidenceGraphSummaryRefV1 | undefined | false {
  if (refs.evidenceGraphRef === undefined) return undefined;
  return parseEvidenceGraphRef(refs.evidenceGraphRef) ?? false;
}

function isBlockedAdapterResult(value: unknown): boolean {
  const record = readExactRecord(value, ADAPTER_BLOCKED_RESULT_KEYS, ADAPTER_BLOCKED_RESULT_KEYS);
  return Boolean(
    record &&
      record.kind === "mcp_read_only_twoweeks_data_adapter_result" &&
      record.allowed === false &&
      record.modelVisible === true &&
      record.version === 1,
  );
}

function parseEvidenceGraphRef(value: unknown): McpRealEvidenceGraphSummaryRefV1 | undefined {
  const record = readExactRecord(value, ADAPTER_REF_KEYS, ADAPTER_REF_REQUIRED_KEYS);
  if (!record) return undefined;
  const updatedAt = readOptionalIsoTimestamp(record.updatedAt);
  if (updatedAt === false) return undefined;
  if (!isEvidenceGraphRefRecord(record)) return undefined;

  return {
    id: record.id,
    label: "Candidate evidence availability",
    status: record.status,
    category: "evidence_graph",
    count: record.count,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    version: 1,
  };
}

function isEvidenceGraphRefRecord(
  record: Record<string, unknown>,
): record is Record<string, unknown> & {
  id: string;
  label: string;
  status: McpRealEvidenceGraphSummaryStatusV1;
  category: "evidence_graph";
  count: number;
  version: 1;
} {
  return everyBoolean([
    isSafeEvidenceGraphRefId(record.id),
    isSafeLabel(record.label),
    isSummaryStatus(record.status),
    record.category === "evidence_graph",
    isSafeCount(record.count),
    record.version === 1,
  ]);
}

function parseAvailabilitySummary(
  value: unknown,
): ParsedAdapterResult["availabilitySummary"] | undefined {
  const record = readExactRecord(value, AVAILABILITY_SUMMARY_KEYS, AVAILABILITY_SUMMARY_KEYS);
  if (!record) return undefined;
  if (!isSafeCount(record.onboarding) || record.version !== 1) return undefined;
  return { onboarding: record.onboarding, version: 1 };
}

function parseConvexSummary(value: unknown): ParsedConvexSummary | undefined {
  const record = readExactRecord(value, SUMMARY_RESULT_KEYS, SUMMARY_RESULT_REQUIRED_KEYS);
  if (!record) return undefined;
  if (!recordMatchesExpected(record, ALLOWED_CONVEX_SUMMARY_FIELDS)) return undefined;
  if (!isSummaryStatus(record.status)) return undefined;

  const requiredFields = parseConvexSummaryRequiredFields(record);
  const optionalFields = parseConvexSummaryOptionalFields(record);
  if (!requiredFields || !optionalFields) return undefined;
  if (!isConvexSummaryCapabilities(record.capabilities)) return undefined;

  return {
    kind: "mcp_real_evidence_graph_summary_result",
    allowed: true,
    status: record.status,
    ...requiredFields,
    ...optionalFields,
    capabilities: buildCapabilities("pr59_read_only_adapter_verified", "convex_evidence_graph_summary"),
    modelVisible: true,
    version: 1,
  };
}

function parseConvexSummaryRequiredFields(
  record: Record<string, unknown>,
): ParsedConvexSummaryRequiredFields | undefined {
  const evidenceGraphRef = parseEvidenceGraphRef(record.evidenceGraphRef);
  if (!evidenceGraphRef) return undefined;

  const availability = parseSummaryAvailability(record.availability);
  if (!availability) return undefined;

  const safeCounts = parseSafeCounts(record.safeCounts);
  if (!safeCounts) return undefined;

  const safeCategories = parseSafeCategories(record.safeCategories);
  if (!safeCategories) return undefined;

  return { evidenceGraphRef, availability, safeCounts, safeCategories };
}

function parseConvexSummaryOptionalFields(
  record: Record<string, unknown>,
): ParsedConvexSummaryOptionalFields | undefined {
  const updatedAt = readOptionalIsoTimestamp(record.updatedAt);
  if (updatedAt === false) return undefined;

  const missingDataReason = readOptionalMissingDataReason(record.missingDataReason);
  if (missingDataReason === false) return undefined;

  return {
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    ...(missingDataReason !== undefined ? { missingDataReason } : {}),
  };
}

function parseSummaryAvailability(
  value: unknown,
): McpRealEvidenceGraphSummaryAvailabilityV1 | undefined {
  const record = readExactRecord(value, SUMMARY_AVAILABILITY_KEYS, SUMMARY_AVAILABILITY_KEYS);
  if (!record) return undefined;
  if (record.source !== "convex_evidence_graph_summary") return undefined;
  if (record.ownerState !== "resolved" && record.ownerState !== "onboarding_required") return undefined;
  if (record.version !== 1) return undefined;
  return {
    source: "convex_evidence_graph_summary",
    ownerState: record.ownerState,
    version: 1,
  };
}

function parseSafeCounts(value: unknown): McpRealEvidenceGraphSummaryCountsV1 | undefined {
  const record = readExactRecord(value, SUMMARY_COUNTS_KEYS, SUMMARY_COUNTS_KEYS);
  if (!record) return undefined;
  if (!SUMMARY_COUNTS_KEYS.every((key) => key === "version" || isSafeCount(record[key]))) {
    return undefined;
  }
  if (record.version !== 1) return undefined;
  return {
    sourceDocuments: record.sourceDocuments as number,
    candidateFacts: record.candidateFacts as number,
    approvedFacts: record.approvedFacts as number,
    pendingFacts: record.pendingFacts as number,
    rejectedFacts: record.rejectedFacts as number,
    restrictedEvidence: record.restrictedEvidence as number,
    archivedEvidence: record.archivedEvidence as number,
    provenanceLinks: record.provenanceLinks as number,
    evidenceMatches: record.evidenceMatches as number,
    allowedClaims: record.allowedClaims as number,
    missingEvidence: record.missingEvidence as number,
    riskFlags: record.riskFlags as number,
    staleSources: record.staleSources as number,
    warnings: record.warnings as number,
    blockers: record.blockers as number,
    version: 1,
  };
}

function parseSafeCategories(value: unknown): McpRealEvidenceGraphSummaryCategoriesV1 | undefined {
  const record = readExactRecord(value, SUMMARY_CATEGORIES_KEYS, ["version"]);
  if (!record) return undefined;
  if (record.version !== 1) return undefined;
  return buildParsedSafeCategories({
    evidenceCoverage: readOptionalEvidenceCoverage(record.evidenceCoverage),
    provenanceCoverage: readOptionalProvenanceCoverage(record.provenanceCoverage),
    qualityStatus: readOptionalQualityStatus(record.qualityStatus),
    blockerCategory: readOptionalBlockerCategory(record.blockerCategory),
    nextReviewHint: readOptionalNextReviewHint(record.nextReviewHint),
  });
}

function buildParsedSafeCategories(
  fields: Readonly<
    Record<Exclude<keyof McpRealEvidenceGraphSummaryCategoriesV1, "version">, string | undefined | false>
  >,
): McpRealEvidenceGraphSummaryCategoriesV1 | undefined {
  if (Object.values(fields).some((field) => field === false)) return undefined;
  const categories: Record<string, unknown> = { version: 1 };
  for (const [key, value] of Object.entries(fields)) {
    if (value !== undefined) categories[key] = value;
  }
  return categories as McpRealEvidenceGraphSummaryCategoriesV1;
}

function isConvexSummaryCapabilities(value: unknown): boolean {
  const record = readExactRecord(value, SUMMARY_CAPABILITIES_KEYS, SUMMARY_CAPABILITIES_KEYS);
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
  status: McpRealEvidenceGraphSummaryStatusV1,
  missingDataReason: McpRealEvidenceGraphSummaryMissingDataReasonV1,
  source: McpRealEvidenceGraphSummaryAvailabilityV1["source"],
  evidenceGraphRef: McpRealEvidenceGraphSummaryRefV1 = unavailableEvidenceGraphRef(status),
): McpRealEvidenceGraphSummaryResultV1 {
  const unavailableRef = { ...evidenceGraphRef, count: 0 };
  return {
    kind: "mcp_real_evidence_graph_summary_result",
    allowed: true,
    status,
    evidenceGraphRef: unavailableRef,
    availability: {
      source,
      ownerState: status === "onboarding_required" ? "onboarding_required" : "resolved",
      version: 1,
    },
    safeCounts: zeroCounts(),
    safeCategories: { version: 1 },
    missingDataReason,
    capabilities: buildCapabilities("pr59_read_only_adapter_verified", "blocked"),
    modelVisible: true,
    version: 1,
  };
}

function unavailableEvidenceGraphRef(
  status: McpRealEvidenceGraphSummaryStatusV1,
): McpRealEvidenceGraphSummaryRefV1 {
  return {
    id: "mcp-safe-ref:evidence-graph:profile",
    label: "Candidate evidence availability",
    status,
    category: "evidence_graph",
    count: 0,
    version: 1,
  };
}

function zeroCounts(): McpRealEvidenceGraphSummaryCountsV1 {
  return {
    sourceDocuments: 0,
    candidateFacts: 0,
    approvedFacts: 0,
    pendingFacts: 0,
    rejectedFacts: 0,
    restrictedEvidence: 0,
    archivedEvidence: 0,
    provenanceLinks: 0,
    evidenceMatches: 0,
    allowedClaims: 0,
    missingEvidence: 0,
    riskFlags: 0,
    staleSources: 0,
    warnings: 0,
    blockers: 0,
    version: 1,
  };
}

function deny(reason: McpRealEvidenceGraphSummaryBlockedReasonV1): McpRealEvidenceGraphSummaryResultV1 {
  return {
    kind: "mcp_real_evidence_graph_summary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpRealEvidenceGraphSummarySafeRefusal(),
    capabilities: buildCapabilities("blocked", "blocked"),
    modelVisible: true,
    version: 1,
  };
}

function buildCapabilities(
  adapter: McpRealEvidenceGraphSummaryCapabilitiesV1["adapter"],
  dataReads: McpRealEvidenceGraphSummaryCapabilitiesV1["dataReads"],
): McpRealEvidenceGraphSummaryCapabilitiesV1 {
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
  if (!requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))) {
    return undefined;
  }
  return record;
}

function recordMatchesExpected(
  record: Record<string, unknown>,
  expected: Readonly<Record<string, unknown>>,
): boolean {
  return Object.entries(expected).every(([key, expectedValue]) => record[key] === expectedValue);
}

function everyBoolean(values: readonly boolean[]): boolean {
  return values.every((value) => value);
}

function readPlainObjectRecord(value: unknown): Record<string, unknown> | undefined {
  const descriptors = readPlainObjectDescriptors(value);
  return descriptors ? readDescriptorRecord(descriptors) : undefined;
}

function readPlainObjectDescriptors(
  value: unknown,
): Record<PropertyKey, PropertyDescriptor | undefined> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
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
  if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) return undefined;
  return { key, value: descriptor.value };
}

function containsUnsafeSummaryMaterial(value: unknown): boolean {
  return visitUnsafeSummaryMaterial(value, new WeakSet<object>(), 0);
}

function visitUnsafeSummaryMaterial(value: unknown, seen: WeakSet<object>, depth: number): boolean {
  if (depth > 5) return true;
  if (typeof value === "string") return containsUnsafeText(value);
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  const record = readPlainObjectRecord(value);
  if (!record) return true;
  seen.add(value);
  const unsafe = Object.entries(record).some(
    ([key, item]) => containsUnsafeKey(key) || visitUnsafeSummaryMaterial(item, seen, depth + 1),
  );
  seen.delete(value);
  return unsafe;
}

function containsUnsafeKey(key: string): boolean {
  const normalizedKey = key.replace(/[\s_-]/gu, "").toLowerCase();
  if (normalizedKey === "source") return false;
  if (normalizedKey === "sourcedocuments") return false;
  if (normalizedKey === "stalesources") return false;
  if (normalizedKey === "allowedclaims") return false;
  if (normalizedKey === "rawdataprojection") return false;
  return /(?:raw|content|coverletter|sourcetext|sourcequote|quote|private|never|debug|shadow|token|claims|email|clerk|userid|subject|documentid|convex|full|generated)/u.test(
    normalizedKey,
  );
}

function containsUnsafeText(value: string): boolean {
  return /(?:raw[_ -]?(?:cv|job|resume|proposal|text)|proposal content|coverLetter|generated artifact content|source[_ -]?(?:text|quote)|private[_ -]?fact|never[_ -]?use|structured[_ -]?shadow|documentid|bearer\s+\S+|accessToken|refreshToken|rawClaims|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/iu.test(
    value,
  );
}

function isSummaryStatus(value: unknown): value is McpRealEvidenceGraphSummaryStatusV1 {
  return (
    value === "available" ||
    value === "no_data_available" ||
    value === "onboarding_required"
  );
}

function isSafeEvidenceGraphRefId(value: unknown): value is string {
  return value === "mcp-safe-ref:evidence-graph:profile";
}

function isSafeLabel(value: unknown): value is string {
  return typeof value === "string" && /\S/u.test(value) && value.length <= 80 && !containsUnsafeText(value);
}

function isSafeCount(value: unknown): value is number {
  return Number.isInteger(value) && value >= 0 && value <= MAX_SAFE_COUNT;
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
): McpRealEvidenceGraphSummaryMissingDataReasonV1 | undefined | false {
  if (value === undefined) return undefined;
  return isMissingDataReason(value) ? value : false;
}

function isMissingDataReason(value: unknown): value is McpRealEvidenceGraphSummaryMissingDataReasonV1 {
  return (
    value === "evidence_graph_ref_missing" ||
    value === "evidence_graph_not_available" ||
    value === "owner_onboarding_required" ||
    value === "summary_unavailable"
  );
}

function readOptionalEvidenceCoverage(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "complete" || value === "partial" || value === "missing" || value === "unknown"
    ? value
    : false;
}

function readOptionalProvenanceCoverage(value: unknown): string | undefined | false {
  return readOptionalEvidenceCoverage(value);
}

function readOptionalQualityStatus(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "ready_for_review" ||
    value === "needs_review" ||
    value === "blocked" ||
    value === "unknown"
    ? value
    : false;
}

function readOptionalBlockerCategory(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "missing_evidence" ||
    value === "restricted_evidence" ||
    value === "stale_sources" ||
    value === "unsupported" ||
    value === "none"
    ? value
    : false;
}

function readOptionalNextReviewHint(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return value === "add_candidate_evidence" ||
    value === "review_missing_evidence" ||
    value === "review_restricted_evidence" ||
    value === "refresh_stale_sources" ||
    value === "ready_for_review"
    ? value
    : false;
}
