export type McpRealApplicationPackageSummaryStatusV1 =
  | "available"
  | "no_data_available"
  | "onboarding_required";

export type McpRealApplicationPackageSummaryMissingDataReasonV1 =
  | "application_package_ref_missing"
  | "application_package_not_available"
  | "owner_onboarding_required"
  | "summary_unavailable";

export type McpRealApplicationPackageSummaryRefV1 = Readonly<{
  id: string;
  label: string;
  status: McpRealApplicationPackageSummaryStatusV1;
  category: "application_package";
  count: number;
  updatedAt?: string;
  version: 1;
}>;

export type McpRealApplicationPackageSummaryCountsV1 = Readonly<{
  packages: number;
  artifacts: number;
  provenanceLinks: number;
  reviewItems: number;
  warnings: number;
  blockers: number;
  version: 1;
}>;

export type McpRealApplicationPackageSummaryCategoriesV1 = Readonly<{
  packageStatus?: "draft" | "needs_review" | "blocked" | "ready_for_review";
  resumeVariantArtifactStatus?: string;
  coverLetterArtifactStatus?: string;
  version: 1;
}>;

export type McpRealApplicationPackageSummaryAvailabilityV1 = Readonly<{
  source: "pr59_read_only_adapter" | "convex_application_package_summary";
  ownerState: "resolved" | "onboarding_required";
  version: 1;
}>;

export type McpRealApplicationPackageSummaryCapabilitiesV1 = Readonly<{
  adapter: "blocked" | "pr59_read_only_adapter_verified";
  dataReads: "blocked" | "convex_application_package_summary";
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

export type McpRealApplicationPackageSummarySafeRefusalV1 = Readonly<{
  code: "real_application_package_summary_blocked";
  message: "Refused. Real application package summary boundary blocked.";
  safeForModel: true;
  rawDataExposed: false;
  credentialsExposed: false;
  ownerIdentityExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpRealApplicationPackageSummaryBlockedReasonV1 =
  | "invalid_input"
  | "adapter_required"
  | "summary_required"
  | "unsafe_summary_blocked";

export type McpRealApplicationPackageSummaryResultV1 = Readonly<
  | {
      kind: "mcp_real_application_package_summary_result";
      allowed: true;
      status: McpRealApplicationPackageSummaryStatusV1;
      packageRef: McpRealApplicationPackageSummaryRefV1;
      availability: McpRealApplicationPackageSummaryAvailabilityV1;
      safeCounts: McpRealApplicationPackageSummaryCountsV1;
      safeCategories: McpRealApplicationPackageSummaryCategoriesV1;
      updatedAt?: string;
      missingDataReason?: McpRealApplicationPackageSummaryMissingDataReasonV1;
      capabilities: McpRealApplicationPackageSummaryCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_real_application_package_summary_result";
      allowed: false;
      reason: McpRealApplicationPackageSummaryBlockedReasonV1;
      safeRefusal: McpRealApplicationPackageSummarySafeRefusalV1;
      capabilities: McpRealApplicationPackageSummaryCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
>;

type SummaryInput = Readonly<{
  adapterResult: unknown;
  applicationPackageSummary?: unknown;
}>;

type ParsedAdapterResult = Readonly<{
  applicationPackageRef?: McpRealApplicationPackageSummaryRefV1;
  availabilitySummary: Readonly<{
    onboarding: number;
    version: 1;
  }>;
}>;

type ParsedConvexSummary = Extract<McpRealApplicationPackageSummaryResultV1, { allowed: true }>;
type ParsedConvexSummaryRequiredFields = Pick<
  ParsedConvexSummary,
  "packageRef" | "availability" | "safeCounts" | "safeCategories"
>;
type ParsedConvexSummaryOptionalFields = Partial<
  Pick<ParsedConvexSummary, "updatedAt" | "missingDataReason">
>;

const INPUT_KEYS = ["kind", "adapterResult", "applicationPackageSummary", "version"] as const;
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
  "packageRef",
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
  "packageRef",
  "availability",
  "safeCounts",
  "safeCategories",
  "capabilities",
  "modelVisible",
  "version",
] as const;

const SUMMARY_AVAILABILITY_KEYS = ["source", "ownerState", "version"] as const;
const SUMMARY_COUNTS_KEYS = [
  "packages",
  "artifacts",
  "provenanceLinks",
  "reviewItems",
  "warnings",
  "blockers",
  "version",
] as const;
const SUMMARY_CATEGORIES_KEYS = [
  "packageStatus",
  "resumeVariantArtifactStatus",
  "coverLetterArtifactStatus",
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
  kind: "mcp_application_package_summary_result",
  allowed: true,
  modelVisible: true,
  version: 1,
} as const;

const CONVEX_SUMMARY_CAPABILITY_FIELDS = {
  dataReads: "convex_application_package_summary",
  dataWrites: "blocked",
  handlerExecution: "blocked",
  productionConnector: "blocked",
  networkAccess: "blocked",
  modelCalls: "blocked",
  writeActions: "blocked",
  rawDataProjection: "blocked",
  version: 1,
} as const;

export function projectMcpRealApplicationPackageSummary(
  input: unknown,
): McpRealApplicationPackageSummaryResultV1 {
  const parsedInput = parseSummaryInput(input);
  if (!parsedInput) return deny("invalid_input");

  const adapter = parseAllowedAdapterResult(parsedInput.adapterResult);
  if (!adapter) {
    return isBlockedAdapterResult(parsedInput.adapterResult) ? deny("adapter_required") : deny("invalid_input");
  }

  const adapterPackageRef = adapter.applicationPackageRef;
  if (!adapterPackageRef) {
    return allowUnavailable(
      "no_data_available",
      "application_package_ref_missing",
      "pr59_read_only_adapter",
    );
  }

  if (adapterPackageRef.status !== "available") {
    return allowUnavailable(
      adapterPackageRef.status,
      adapterPackageRef.status === "onboarding_required"
        ? "owner_onboarding_required"
        : "application_package_not_available",
      "pr59_read_only_adapter",
      adapterPackageRef,
    );
  }

  if (parsedInput.applicationPackageSummary === undefined) return deny("summary_required");
  if (containsUnsafeSummaryMaterial(parsedInput.applicationPackageSummary)) {
    return deny("unsafe_summary_blocked");
  }

  const summary = parseConvexSummary(parsedInput.applicationPackageSummary);
  if (!summary) return deny("summary_required");
  if (summary.packageRef.id !== adapterPackageRef.id) return deny("summary_required");
  if (summary.status !== "available") return deny("summary_required");
  if (summary.packageRef.status !== "available") return deny("summary_required");

  return {
    kind: "mcp_real_application_package_summary_result",
    allowed: true,
    status: "available",
    packageRef: summary.packageRef,
    availability: summary.availability,
    safeCounts: summary.safeCounts,
    safeCategories: summary.safeCategories,
    ...(summary.updatedAt !== undefined ? { updatedAt: summary.updatedAt } : {}),
    capabilities: buildCapabilities("pr59_read_only_adapter_verified", "convex_application_package_summary"),
    modelVisible: true,
    version: 1,
  };
}

export function buildMcpRealApplicationPackageSummarySafeRefusal(): McpRealApplicationPackageSummarySafeRefusalV1 {
  return {
    code: "real_application_package_summary_blocked",
    message: "Refused. Real application package summary boundary blocked.",
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
  if (record.kind !== "mcp_real_application_package_summary_input" || record.version !== 1) {
    return undefined;
  }
  return {
    adapterResult: record.adapterResult,
    ...(record.applicationPackageSummary !== undefined
      ? { applicationPackageSummary: record.applicationPackageSummary }
      : {}),
  };
}

function parseAllowedAdapterResult(value: unknown): ParsedAdapterResult | undefined {
  const record = readExactRecord(value, ADAPTER_RESULT_KEYS, ADAPTER_RESULT_KEYS);
  if (!record) return undefined;
  if (!recordMatchesExpected(record, ALLOWED_ADAPTER_RESULT_FIELDS)) return undefined;

  const refs = readPlainObjectRecord(record.refs);
  const availabilitySummary = parseAvailabilitySummary(record.availabilitySummary);
  if (!refs || !availabilitySummary) return undefined;

  const applicationPackageRef = parseAdapterApplicationPackageRef(refs);
  if (applicationPackageRef === false) return undefined;

  return {
    ...(applicationPackageRef ? { applicationPackageRef } : {}),
    availabilitySummary,
  };
}

function parseAdapterApplicationPackageRef(
  refs: Record<string, unknown>,
): McpRealApplicationPackageSummaryRefV1 | undefined | false {
  if (refs.applicationPackageRef === undefined) return undefined;
  return parseApplicationPackageRef(refs.applicationPackageRef) ?? false;
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

function parseApplicationPackageRef(
  value: unknown,
): McpRealApplicationPackageSummaryRefV1 | undefined {
  const record = readExactRecord(value, ADAPTER_REF_KEYS, ADAPTER_REF_REQUIRED_KEYS);
  if (!record) return undefined;
  const updatedAt = readOptionalIsoTimestamp(record.updatedAt);
  if (updatedAt === false) return undefined;
  if (!isApplicationPackageRefRecord(record)) return undefined;

  return {
    id: record.id,
    label: record.label,
    status: record.status,
    category: "application_package",
    count: record.count,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    version: 1,
  };
}

function isApplicationPackageRefRecord(
  record: Record<string, unknown>,
): record is Record<string, unknown> & {
  id: string;
  label: string;
  status: McpRealApplicationPackageSummaryStatusV1;
  category: "application_package";
  count: number;
  version: 1;
} {
  return everyBoolean([
    isSafePackageRefId(record.id),
    isSafeLabel(record.label),
    isSummaryStatus(record.status),
    record.category === "application_package",
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
    kind: "mcp_real_application_package_summary_result",
    allowed: true,
    status: record.status,
    ...requiredFields,
    ...optionalFields,
    capabilities: buildCapabilities("pr59_read_only_adapter_verified", "convex_application_package_summary"),
    modelVisible: true,
    version: 1,
  };
}

function parseConvexSummaryRequiredFields(
  record: Record<string, unknown>,
): ParsedConvexSummaryRequiredFields | undefined {
  const packageRef = parseApplicationPackageRef(record.packageRef);
  if (!packageRef) return undefined;

  const availability = parseSummaryAvailability(record.availability);
  if (!availability) return undefined;

  const safeCounts = parseSafeCounts(record.safeCounts);
  if (!safeCounts) return undefined;

  const safeCategories = parseSafeCategories(record.safeCategories);
  if (!safeCategories) return undefined;

  return { packageRef, availability, safeCounts, safeCategories };
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
): McpRealApplicationPackageSummaryAvailabilityV1 | undefined {
  const record = readExactRecord(value, SUMMARY_AVAILABILITY_KEYS, SUMMARY_AVAILABILITY_KEYS);
  if (!record) return undefined;
  if (record.source !== "convex_application_package_summary") return undefined;
  if (record.ownerState !== "resolved" && record.ownerState !== "onboarding_required") return undefined;
  if (record.version !== 1) return undefined;
  return {
    source: "convex_application_package_summary",
    ownerState: record.ownerState,
    version: 1,
  };
}

function parseSafeCounts(value: unknown): McpRealApplicationPackageSummaryCountsV1 | undefined {
  const record = readExactRecord(value, SUMMARY_COUNTS_KEYS, SUMMARY_COUNTS_KEYS);
  if (!record) return undefined;
  if (!SUMMARY_COUNTS_KEYS.every((key) => key === "version" || isSafeCount(record[key]))) {
    return undefined;
  }
  if (record.version !== 1) return undefined;
  return {
    packages: record.packages as number,
    artifacts: record.artifacts as number,
    provenanceLinks: record.provenanceLinks as number,
    reviewItems: record.reviewItems as number,
    warnings: record.warnings as number,
    blockers: record.blockers as number,
    version: 1,
  };
}

function parseSafeCategories(
  value: unknown,
): McpRealApplicationPackageSummaryCategoriesV1 | undefined {
  const record = readExactRecord(value, SUMMARY_CATEGORIES_KEYS, ["version"]);
  if (!record) return undefined;
  const packageStatus = readOptionalPackageStatus(record.packageStatus);
  const resumeVariantArtifactStatus = readOptionalSafeCategory(record.resumeVariantArtifactStatus);
  const coverLetterArtifactStatus = readOptionalSafeCategory(record.coverLetterArtifactStatus);
  if (
    packageStatus === false ||
    resumeVariantArtifactStatus === false ||
    coverLetterArtifactStatus === false ||
    record.version !== 1
  ) {
    return undefined;
  }
  return {
    ...(packageStatus !== undefined ? { packageStatus } : {}),
    ...(resumeVariantArtifactStatus !== undefined ? { resumeVariantArtifactStatus } : {}),
    ...(coverLetterArtifactStatus !== undefined ? { coverLetterArtifactStatus } : {}),
    version: 1,
  };
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
  status: McpRealApplicationPackageSummaryStatusV1,
  missingDataReason: McpRealApplicationPackageSummaryMissingDataReasonV1,
  source: McpRealApplicationPackageSummaryAvailabilityV1["source"],
  packageRef: McpRealApplicationPackageSummaryRefV1 = unavailablePackageRef(status),
): McpRealApplicationPackageSummaryResultV1 {
  const unavailableRef = { ...packageRef, count: 0 };
  return {
    kind: "mcp_real_application_package_summary_result",
    allowed: true,
    status,
    packageRef: unavailableRef,
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

function unavailablePackageRef(
  status: McpRealApplicationPackageSummaryStatusV1,
): McpRealApplicationPackageSummaryRefV1 {
  return {
    id: "mcp-safe-ref:application-package:latest",
    label: "Application package availability",
    status,
    category: "application_package",
    count: 0,
    version: 1,
  };
}

function zeroCounts(): McpRealApplicationPackageSummaryCountsV1 {
  return {
    packages: 0,
    artifacts: 0,
    provenanceLinks: 0,
    reviewItems: 0,
    warnings: 0,
    blockers: 0,
    version: 1,
  };
}

function deny(
  reason: McpRealApplicationPackageSummaryBlockedReasonV1,
): McpRealApplicationPackageSummaryResultV1 {
  return {
    kind: "mcp_real_application_package_summary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpRealApplicationPackageSummarySafeRefusal(),
    capabilities: buildCapabilities("blocked", "blocked"),
    modelVisible: true,
    version: 1,
  };
}

function buildCapabilities(
  adapter: McpRealApplicationPackageSummaryCapabilitiesV1["adapter"],
  dataReads: McpRealApplicationPackageSummaryCapabilitiesV1["dataReads"],
): McpRealApplicationPackageSummaryCapabilitiesV1 {
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
  if (normalizedKey === "rawdataprojection") return false;
  return /(?:raw|content|sourcetext|sourcequote|quote|private|never|debug|shadow|token|claims|email|clerk|userid|subject|documentid|convex|full|generated)/u.test(
    normalizedKey,
  );
}

function containsUnsafeText(value: string): boolean {
  return /(?:raw[_ -]?(?:cv|job|resume|proposal|text)|proposal content|generated artifact content|source[_ -]?(?:text|quote)|private[_ -]?fact|never[_ -]?use|structured[_ -]?shadow|documentid|bearer\s+\S+|accessToken|refreshToken|rawClaims|[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,})/iu.test(
    value,
  );
}

function isSummaryStatus(value: unknown): value is McpRealApplicationPackageSummaryStatusV1 {
  return (
    value === "available" ||
    value === "no_data_available" ||
    value === "onboarding_required"
  );
}

function isSafePackageRefId(value: unknown): value is string {
  return value === "mcp-safe-ref:application-package:latest";
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
): McpRealApplicationPackageSummaryMissingDataReasonV1 | undefined | false {
  if (value === undefined) return undefined;
  return isMissingDataReason(value) ? value : false;
}

function isMissingDataReason(value: unknown): value is McpRealApplicationPackageSummaryMissingDataReasonV1 {
  return (
    value === "application_package_ref_missing" ||
    value === "application_package_not_available" ||
    value === "owner_onboarding_required" ||
    value === "summary_unavailable"
  );
}

function readOptionalPackageStatus(
  value: unknown,
): McpRealApplicationPackageSummaryCategoriesV1["packageStatus"] | undefined | false {
  if (value === undefined) return undefined;
  return value === "draft" ||
    value === "needs_review" ||
    value === "blocked" ||
    value === "ready_for_review"
    ? value
    : false;
}

function readOptionalSafeCategory(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return typeof value === "string" && /^[a-z][a-z0-9_]{1,80}$/u.test(value) && !containsUnsafeText(value)
    ? value
    : false;
}
