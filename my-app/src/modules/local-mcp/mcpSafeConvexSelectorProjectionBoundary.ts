export type LocalMcpSafeConvexSelectorProjectionRefClassV1 =
  | "applicationPackageRef"
  | "evidenceGraphRef"
  | "resumeVariantPlanRef"
  | "reviewCockpitRef";

export type LocalMcpSafeConvexSelectorProjectionStatusV1 =
  | "available"
  | "no_data_available"
  | "onboarding_required"
  | "blocked";

export type LocalMcpSafeConvexSelectorProjectionCandidateV1 = Readonly<{
  kind: "local_mcp_safe_convex_selector_projection_candidate";
  refClass: LocalMcpSafeConvexSelectorProjectionRefClassV1;
  refId: string;
  label: string;
  status: LocalMcpSafeConvexSelectorProjectionStatusV1;
  updatedAt?: string;
  version: 1;
}>;

export type LocalMcpSafeConvexSelectorProjectionRefV1 = Readonly<{
  id: string;
  label: string;
  status: LocalMcpSafeConvexSelectorProjectionStatusV1;
  updatedAt?: string;
  version: 1;
}>;

export type LocalMcpSafeConvexSelectorProjectionCapabilitiesV1 = Readonly<{
  selectorProjection: "blocked" | "fixture_only";
  dataReads: "blocked" | "fixture_projection_only";
  dataWrites: "blocked";
  handlerExecution: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  writeActions: "blocked";
  convexAccess: "blocked";
  credentialStorage: "none";
  version: 1;
}>;

export type LocalMcpSafeConvexSelectorProjectionBlockedReasonV1 =
  | "invalid_input"
  | "unsafe_selector_payload"
  | "malformed_ref_candidate";

export type LocalMcpSafeConvexSelectorProjectionSafeRefusalV1 = Readonly<{
  code: "safe_convex_selector_projection_blocked";
  message: "Refused. Safe selector projection boundary blocked.";
  safeForModel: true;
  fixtureOnly: true;
  version: 1;
}>;

export type LocalMcpSafeConvexSelectorProjectionResultV1 = Readonly<
  | {
      kind: "local_mcp_safe_convex_selector_projection_result";
      allowed: true;
      projection: Readonly<
        Partial<
          Record<LocalMcpSafeConvexSelectorProjectionRefClassV1, LocalMcpSafeConvexSelectorProjectionRefV1>
        >
      >;
      capabilities: LocalMcpSafeConvexSelectorProjectionCapabilitiesV1;
      modelVisible: true;
      fixtureOnly: true;
      version: 1;
    }
  | {
      kind: "local_mcp_safe_convex_selector_projection_result";
      allowed: false;
      reason: LocalMcpSafeConvexSelectorProjectionBlockedReasonV1;
      safeRefusal: LocalMcpSafeConvexSelectorProjectionSafeRefusalV1;
      capabilities: LocalMcpSafeConvexSelectorProjectionCapabilitiesV1;
      modelVisible: false;
      fixtureOnly: true;
      version: 1;
    }
>;

const CANDIDATE_KEYS = ["kind", "refClass", "refId", "label", "status", "updatedAt", "version"] as const;
const CANDIDATE_REQUIRED_KEYS = ["kind", "refClass", "refId", "label", "status", "version"] as const;

const REF_PREFIX_BY_CLASS = {
  applicationPackageRef: "mcp-safe-ref:application-package:",
  evidenceGraphRef: "mcp-safe-ref:evidence-graph:",
  resumeVariantPlanRef: "mcp-safe-ref:resume-variant-plan:",
  reviewCockpitRef: "mcp-safe-ref:review-cockpit:",
} as const satisfies Record<LocalMcpSafeConvexSelectorProjectionRefClassV1, string>;

const FORBIDDEN_KEY_TOKENS = new Set([
  "_id",
  "accountid",
  "authorization",
  "bearer",
  "clerkid",
  "content",
  "coverletter",
  "cvdocument",
  "cvtext",
  "debug",
  "debugpayload",
  "convexdocumentid",
  "documentid",
  "email",
  "extractionspans",
  "fullgeneratedartifact",
  "fullproposalcontent",
  "generatedartifact",
  "generatedartifacts",
  "metadata",
  "neveruse",
  "neverusefacts",
  "privatefact",
  "privatefacts",
  "proposalcontent",
  "proposaldocument",
  "providersubject",
  "raw",
  "rawclaims",
  "rawcvtext",
  "rawdescription",
  "rawjobtext",
  "rawpayload",
  "rawresume",
  "rawresumetext",
  "rawselector",
  "rawselectorresult",
  "rawtext",
  "refresh",
  "refreshtoken",
  "resumecontent",
  "resumetext",
  "sectioncontent",
  "sections",
  "sessionid",
  "sourcecvid",
  "sourcejobdescription",
  "sourcequote",
  "sourcequotes",
  "sourcespan",
  "sourcetext",
  "structuredshadow",
  "stytchsubject",
  "sub",
  "subject",
  "token",
  "userid",
]);

const FORBIDDEN_TEXT_PATTERNS: readonly RegExp[] = [
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/iu,
  /\bbearer\s+[A-Za-z0-9._-]+/iu,
  /\b(?:access|refresh)[_-]?token\b/iu,
  /\b(?:clerk|session|stytch|user|account)[_-][a-z0-9._:-]+/iu,
  /\braw[_ -]?(?:cv|resume|job|proposal|text)\b/iu,
  /\bsource[_ -]?(?:text|quote|quotes)\b/iu,
  /\bstructured[_ -]?shadow\b/iu,
  /\braw[_ -]?selector\b/iu,
  /\bprivate[_ -]?fact\b/iu,
  /\bnever[_ -]?use\b/iu,
  /\bfull[_ -]?(?:generated|proposal|artifact)\b/iu,
  /\bcover[_ -]?letter\b/iu,
];

const FORBIDDEN_REF_ID_TOKENS = ["convexdocumentid", "documentid"] as const;

export function projectLocalMcpSafeConvexSelectorRef(
  candidate: unknown,
): LocalMcpSafeConvexSelectorProjectionResultV1 {
  const record = readPlainObjectRecord(candidate);
  if (!record) return deny("invalid_input");
  if (containsUnsafeSelectorPayload(record)) return deny("unsafe_selector_payload");

  const parsedCandidate = parseProjectionCandidate(record);
  if (!parsedCandidate) return deny("malformed_ref_candidate");

  const ref: LocalMcpSafeConvexSelectorProjectionRefV1 = {
    id: parsedCandidate.refId,
    label: parsedCandidate.label.trim(),
    status: parsedCandidate.status,
    ...(parsedCandidate.updatedAt !== undefined ? { updatedAt: parsedCandidate.updatedAt } : {}),
    version: 1,
  };

  return {
    kind: "local_mcp_safe_convex_selector_projection_result",
    allowed: true,
    projection: { [parsedCandidate.refClass]: ref },
    capabilities: buildCapabilities("fixture_only"),
    modelVisible: true,
    fixtureOnly: true,
    version: 1,
  };
}

export function buildLocalMcpSafeConvexSelectorProjectionSafeRefusal(): LocalMcpSafeConvexSelectorProjectionSafeRefusalV1 {
  return {
    code: "safe_convex_selector_projection_blocked",
    message: "Refused. Safe selector projection boundary blocked.",
    safeForModel: true,
    fixtureOnly: true,
    version: 1,
  };
}

function parseProjectionCandidate(
  record: Record<string, unknown>,
): LocalMcpSafeConvexSelectorProjectionCandidateV1 | undefined {
  if (!hasProjectionCandidateEnvelope(record)) return undefined;

  const refClass = readRefClass(record.refClass);
  const refId = readSafeOpaqueRefId(refClass, record.refId);
  const label = readSafeLabel(record.label);
  const status = readProjectionStatus(record.status);
  const updatedAt = readOptionalStrictIsoUtcTimestamp(record.updatedAt);

  if (!refClass || !refId || !label || !status || updatedAt === false) return undefined;

  return {
    kind: "local_mcp_safe_convex_selector_projection_candidate",
    refClass,
    refId,
    label,
    status,
    ...(updatedAt !== undefined ? { updatedAt } : {}),
    version: 1,
  };
}

function deny(
  reason: LocalMcpSafeConvexSelectorProjectionBlockedReasonV1,
): LocalMcpSafeConvexSelectorProjectionResultV1 {
  return {
    kind: "local_mcp_safe_convex_selector_projection_result",
    allowed: false,
    reason,
    safeRefusal: buildLocalMcpSafeConvexSelectorProjectionSafeRefusal(),
    capabilities: buildCapabilities("blocked"),
    modelVisible: false,
    fixtureOnly: true,
    version: 1,
  };
}

function buildCapabilities(
  selectorProjection: LocalMcpSafeConvexSelectorProjectionCapabilitiesV1["selectorProjection"],
): LocalMcpSafeConvexSelectorProjectionCapabilitiesV1 {
  return {
    selectorProjection,
    dataReads: selectorProjection === "fixture_only" ? "fixture_projection_only" : "blocked",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    convexAccess: "blocked",
    credentialStorage: "none",
    version: 1,
  };
}

function containsUnsafeSelectorPayload(value: unknown): boolean {
  return visitForUnsafeSelectorPayload(value, new WeakSet<object>());
}

function visitForUnsafeSelectorPayload(value: unknown, seen: WeakSet<object>): boolean {
  if (typeof value === "string") return containsForbiddenText(value);
  if (!isObjectPayload(value)) return false;
  return visitObjectForUnsafeSelectorPayload(value, seen);
}

function visitObjectForUnsafeSelectorPayload(value: object, seen: WeakSet<object>): boolean {
  if (seen.has(value)) return true;
  if (Array.isArray(value)) return true;
  const record = readPlainObjectRecord(value);
  if (!record) return true;

  seen.add(value);
  const unsafe = Object.entries(record).some(
    ([key, item]) => isForbiddenPayloadKey(key) || visitForUnsafeSelectorPayload(item, seen),
  );
  seen.delete(value);
  return unsafe;
}

function isForbiddenPayloadKey(key: string): boolean {
  return FORBIDDEN_KEY_TOKENS.has(normalizeKeyToken(key));
}

function containsForbiddenText(value: string): boolean {
  const normalized = value.normalize("NFKC");
  return FORBIDDEN_TEXT_PATTERNS.some((pattern) => pattern.test(normalized));
}

function isSafeLabel(value: unknown): value is string {
  return typeof value === "string" && /\S/u.test(value) && value.length <= 80 && !containsForbiddenText(value);
}

function readSafeLabel(value: unknown): string | undefined {
  return isSafeLabel(value) ? value : undefined;
}

function isSafeOpaqueRefId(
  refClass: LocalMcpSafeConvexSelectorProjectionRefClassV1,
  value: unknown,
): value is string {
  if (typeof value !== "string") return false;
  const prefix = REF_PREFIX_BY_CLASS[refClass];
  if (!value.startsWith(prefix)) return false;
  const suffix = value.slice(prefix.length);
  return (
    /^[a-z0-9][a-z0-9._:-]{0,64}$/u.test(suffix) &&
    !containsForbiddenRefIdMaterial(suffix) &&
    !containsForbiddenText(value)
  );
}

function readSafeOpaqueRefId(
  refClass: LocalMcpSafeConvexSelectorProjectionRefClassV1 | undefined,
  value: unknown,
): string | undefined {
  return refClass && isSafeOpaqueRefId(refClass, value) ? value : undefined;
}

function isRefClass(value: unknown): value is LocalMcpSafeConvexSelectorProjectionRefClassV1 {
  return (
    value === "applicationPackageRef" ||
    value === "evidenceGraphRef" ||
    value === "resumeVariantPlanRef" ||
    value === "reviewCockpitRef"
  );
}

function readRefClass(value: unknown): LocalMcpSafeConvexSelectorProjectionRefClassV1 | undefined {
  return isRefClass(value) ? value : undefined;
}

function isProjectionStatus(value: unknown): value is LocalMcpSafeConvexSelectorProjectionStatusV1 {
  return (
    value === "available" ||
    value === "no_data_available" ||
    value === "onboarding_required" ||
    value === "blocked"
  );
}

function readProjectionStatus(value: unknown): LocalMcpSafeConvexSelectorProjectionStatusV1 | undefined {
  return isProjectionStatus(value) ? value : undefined;
}

function isStrictIsoUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function readOptionalStrictIsoUtcTimestamp(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return isStrictIsoUtcTimestamp(value) ? value : false;
}

function hasProjectionCandidateEnvelope(record: Record<string, unknown>): boolean {
  return (
    hasOnlyAllowedKeys(record, CANDIDATE_KEYS) &&
    hasOwnRequiredKeys(record, CANDIDATE_REQUIRED_KEYS) &&
    record.kind === "local_mcp_safe_convex_selector_projection_candidate" &&
    record.version === 1
  );
}

function hasOnlyAllowedKeys(record: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(record).every((key) => allowedKeys.includes(key));
}

function hasOwnRequiredKeys(record: Record<string, unknown>, requiredKeys: readonly string[]): boolean {
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function readPlainObjectRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = readObjectPrototype(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  return readEnumerableDataRecord(value);
}

function isObjectPayload(value: unknown): value is object {
  return value !== null && value !== undefined && typeof value === "object";
}

function readObjectPrototype(value: object): object | null | undefined {
  try {
    return Object.getPrototypeOf(value) as object | null;
  } catch {
    return undefined;
  }
}

function readEnumerableDataRecord(value: object): Record<string, unknown> | undefined {
  try {
    const descriptors = Object.getOwnPropertyDescriptors(value) as Record<PropertyKey, PropertyDescriptor>;
    const record: Record<string, unknown> = Object.create(null);

    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string") return undefined;
      const descriptor = descriptors[key];
      if (!isEnumerableDataDescriptor(descriptor)) return undefined;
      record[key] = descriptor.value;
    }

    return record;
  } catch {
    return undefined;
  }
}

function isEnumerableDataDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & { value: unknown } {
  return descriptor !== undefined && descriptor.enumerable === true && "value" in descriptor;
}

function containsForbiddenRefIdMaterial(value: string): boolean {
  const normalized = normalizeKeyToken(value);
  return FORBIDDEN_REF_ID_TOKENS.some((token) => normalized.includes(token));
}

function normalizeKeyToken(key: string): string {
  return key.normalize("NFKC").replace(/[\s_-]/gu, "").toLowerCase();
}
