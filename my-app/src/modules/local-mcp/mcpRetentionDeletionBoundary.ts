type LocalMcpRetentionDeletionRecordTypeV1 =
  | "fixture_summary"
  | "future_audit"
  | "future_component_state"
  | "future_generated_artifact";

type LocalMcpRetentionDeletionPolicyStateV1 =
  | "fixture_ephemeral"
  | "retain_until"
  | "stale"
  | "expired"
  | "deletion_requested"
  | "deletion_completed";

type LocalMcpRetentionDeletionRecordV1 = Readonly<{
  kind: "local_mcp_retention_deletion_record";
  recordRef: string;
  recordType: LocalMcpRetentionDeletionRecordTypeV1;
  policyState: LocalMcpRetentionDeletionPolicyStateV1;
  createdAt: string;
  retainUntil: string;
  deletionRequestedAt?: string;
  deletionCompletedAt?: string;
  version: 1;
}>;

export type LocalMcpRetentionDeletionInputV1 = Readonly<{
  kind: "local_mcp_retention_deletion_input";
  record: unknown;
  version: 1;
}>;

export type LocalMcpRetentionDeletionBlockedReasonV1 =
  | "record_malformed"
  | "record_stale"
  | "retention_expired"
  | "deletion_requested"
  | "deletion_completed";

export type LocalMcpRetentionDeletionAllowedReasonV1 =
  | "fixture_ephemeral"
  | "within_retention_window";

export type LocalMcpRetentionDeletionCapabilitiesV1 = Readonly<{
  persistenceDeletion: "blocked";
  convexWrites: "blocked";
  authProtocol: "not_evaluated";
  consent: "not_evaluated";
  handlerExecution: "blocked";
  dataAccess: "blocked";
  writeAction: "blocked";
  realUserData: "blocked";
  version: 1;
}>;

export type LocalMcpRetentionDeletionResultV1 = Readonly<
  | {
      kind: "local_mcp_retention_deletion_result";
      allowed: true;
      reason: LocalMcpRetentionDeletionAllowedReasonV1;
      safeSummary: string;
      capabilities: LocalMcpRetentionDeletionCapabilitiesV1;
      fixtureOnly: true;
      version: 1;
    }
  | {
      kind: "local_mcp_retention_deletion_result";
      allowed: false;
      reason: LocalMcpRetentionDeletionBlockedReasonV1;
      safeRefusal: LocalMcpRetentionDeletionSafeRefusalV1;
      capabilities: LocalMcpRetentionDeletionCapabilitiesV1;
      fixtureOnly: true;
      version: 1;
    }
>;

export type LocalMcpRetentionDeletionSafeRefusalV1 = Readonly<{
  code: "retention_deletion_boundary_blocked";
  message: "Refused. Retention/deletion boundary blocked.";
  safeForModel: true;
  fixtureOnly: true;
  version: 1;
}>;

const RECORD_KEYS = [
  "kind",
  "recordRef",
  "recordType",
  "policyState",
  "createdAt",
  "retainUntil",
  "deletionRequestedAt",
  "deletionCompletedAt",
  "version",
] as const;

const SAFE_SUMMARY = "Retention boundary satisfied for fixture-only data. No deletion or persistence action executed.";

export function validateLocalMcpRetentionDeletionBoundary(
  input: LocalMcpRetentionDeletionInputV1,
  now: Date = new Date(),
): LocalMcpRetentionDeletionResultV1 {
  const record = parseLocalMcpRetentionDeletionRecord(input.record);
  if (!record) return blocked("record_malformed");

  if (record.policyState === "stale") return blocked("record_stale");
  if (record.policyState === "expired") return blocked("retention_expired");
  if (record.policyState === "deletion_requested") return blocked("deletion_requested");
  if (record.policyState === "deletion_completed") return blocked("deletion_completed");
  if (Date.parse(record.retainUntil) <= now.getTime()) return blocked("retention_expired");

  return {
    kind: "local_mcp_retention_deletion_result",
    allowed: true,
    reason: record.policyState === "fixture_ephemeral" ? "fixture_ephemeral" : "within_retention_window",
    safeSummary: SAFE_SUMMARY,
    capabilities: buildLocalMcpRetentionDeletionCapabilities(),
    fixtureOnly: true,
    version: 1,
  };
}

function parseLocalMcpRetentionDeletionRecord(
  value: unknown,
): LocalMcpRetentionDeletionRecordV1 | undefined {
  if (!isPlainRecord(value) || !hasOnlyAllowedKeys(value, RECORD_KEYS)) return undefined;
  const validShape = [
    value.kind === "local_mcp_retention_deletion_record",
    isSafeRecordRef(value.recordRef),
    isRecordType(value.recordType),
    isPolicyState(value.policyState),
    isStrictIsoUtcTimestamp(value.createdAt),
    isStrictIsoUtcTimestamp(value.retainUntil),
    isOptionalStrictIsoUtcTimestamp(value.deletionRequestedAt),
    isOptionalStrictIsoUtcTimestamp(value.deletionCompletedAt),
    value.version === 1,
  ].every(Boolean);
  if (!validShape) return undefined;

  return {
    kind: "local_mcp_retention_deletion_record",
    recordRef: value.recordRef,
    recordType: value.recordType as LocalMcpRetentionDeletionRecordTypeV1,
    policyState: value.policyState as LocalMcpRetentionDeletionPolicyStateV1,
    createdAt: value.createdAt,
    retainUntil: value.retainUntil,
    ...(value.deletionRequestedAt !== undefined ? { deletionRequestedAt: value.deletionRequestedAt } : {}),
    ...(value.deletionCompletedAt !== undefined ? { deletionCompletedAt: value.deletionCompletedAt } : {}),
    version: 1,
  };
}

export function buildLocalMcpRetentionDeletionSafeRefusal(): LocalMcpRetentionDeletionSafeRefusalV1 {
  return {
    code: "retention_deletion_boundary_blocked",
    message: "Refused. Retention/deletion boundary blocked.",
    safeForModel: true,
    fixtureOnly: true,
    version: 1,
  };
}

function blocked(reason: LocalMcpRetentionDeletionBlockedReasonV1): LocalMcpRetentionDeletionResultV1 {
  return {
    kind: "local_mcp_retention_deletion_result",
    allowed: false,
    reason,
    safeRefusal: buildLocalMcpRetentionDeletionSafeRefusal(),
    capabilities: buildLocalMcpRetentionDeletionCapabilities(),
    fixtureOnly: true,
    version: 1,
  };
}

function buildLocalMcpRetentionDeletionCapabilities(): LocalMcpRetentionDeletionCapabilitiesV1 {
  return {
    persistenceDeletion: "blocked",
    convexWrites: "blocked",
    authProtocol: "not_evaluated",
    consent: "not_evaluated",
    handlerExecution: "blocked",
    dataAccess: "blocked",
    writeAction: "blocked",
    realUserData: "blocked",
    version: 1,
  };
}

function isRecordType(value: unknown): value is LocalMcpRetentionDeletionRecordTypeV1 {
  return (
    value === "fixture_summary" ||
    value === "future_audit" ||
    value === "future_component_state" ||
    value === "future_generated_artifact"
  );
}

function isPolicyState(value: unknown): value is LocalMcpRetentionDeletionPolicyStateV1 {
  return (
    value === "fixture_ephemeral" ||
    value === "retain_until" ||
    value === "stale" ||
    value === "expired" ||
    value === "deletion_requested" ||
    value === "deletion_completed"
  );
}

function isSafeRecordRef(value: unknown): value is string {
  return typeof value === "string" && /^fixture-retention:[a-z0-9._:-]{1,96}$/u.test(value);
}

function isStrictIsoUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function isOptionalStrictIsoUtcTimestamp(value: unknown): value is string | undefined {
  return value === undefined || isStrictIsoUtcTimestamp(value);
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value))
  );
}
