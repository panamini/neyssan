import type { LocalMcpToolIdV1 } from "./schema";

export type LocalMcpRedactedAuditEventTypeV1 =
  | "consent_boundary_checked"
  | "auth_boundary_refused"
  | "tool_call_refused"
  | "write_action_refused"
  | "audit_entry_rejected";

export type LocalMcpRedactedAuditOutcomeV1 =
  | "boundary_only"
  | "refused"
  | "blocked"
  | "invalid";

export type LocalMcpRedactedAuditRedactionCategoryV1 =
  | "source_text"
  | "credential"
  | "session_marker"
  | "restricted_fact"
  | "artifact_text"
  | "identity"
  | "unknown_payload";

export type LocalMcpRedactedAuditRedactionV1 = Readonly<{
  category: LocalMcpRedactedAuditRedactionCategoryV1;
  occurrences: number;
  version: 1;
}>;

export type LocalMcpRedactedAuditCapabilitiesV1 = Readonly<{
  consent: "not_evaluated" | "boundary_only";
  authProtocol: "not_evaluated";
  handlerExecution: "blocked";
  dataAccess: "blocked";
  writeAction: "blocked";
  persistence: "none";
  productionConnector: "blocked";
  version: 1;
}>;

export type LocalMcpRedactedAuditEntryV1 = Readonly<{
  kind: "local_mcp_redacted_audit_entry";
  eventId: string;
  eventType: LocalMcpRedactedAuditEventTypeV1;
  occurredAt: string;
  outcome: LocalMcpRedactedAuditOutcomeV1;
  toolName?: string;
  localToolId?: LocalMcpToolIdV1;
  safeSummary: string;
  redactions: readonly LocalMcpRedactedAuditRedactionV1[];
  capabilities: LocalMcpRedactedAuditCapabilitiesV1;
  fixtureOnly: true;
  persisted: false;
  version: 1;
}>;

export type LocalMcpRedactedAuditBuildInputV1 = Readonly<{
  eventId?: string;
  eventType: LocalMcpRedactedAuditEventTypeV1;
  occurredAt: string;
  outcome: LocalMcpRedactedAuditOutcomeV1;
  toolName?: string;
  localToolId?: LocalMcpToolIdV1;
  safeSummary?: string;
  consentBoundarySatisfied?: boolean;
  rawPayload?: unknown;
}>;

export type LocalMcpRedactedAuditValidationErrorCodeV1 =
  | "malformed_audit_entry"
  | "unsafe_audit_entry";

export type LocalMcpRedactedAuditValidationResultV1 = Readonly<
  | {
      valid: true;
      entry: LocalMcpRedactedAuditEntryV1;
      version: 1;
    }
  | {
      valid: false;
      reason: LocalMcpRedactedAuditValidationErrorCodeV1;
      safeRefusal: LocalMcpRedactedAuditSafeRefusalV1;
      version: 1;
    }
>;

export type LocalMcpRedactedAuditSafeRefusalV1 = Readonly<{
  code: "redacted_audit_entry_rejected";
  message: "Refused. Redacted audit entry malformed.";
  safeForModel: true;
  fixtureOnly: true;
  version: 1;
}>;

const DEFAULT_EVENT_ID = "redacted-audit:fixture-boundary";
const DEFAULT_SAFE_SUMMARY = "Redacted audit boundary event recorded. No product action executed.";
const MAX_SAFE_SUMMARY_LENGTH = 220;
const MAX_REDACTION_DEPTH = 6;

const ENTRY_KEYS = [
  "kind",
  "eventId",
  "eventType",
  "occurredAt",
  "outcome",
  "toolName",
  "localToolId",
  "safeSummary",
  "redactions",
  "capabilities",
  "fixtureOnly",
  "persisted",
  "version",
] as const;

const CAPABILITY_KEYS = [
  "consent",
  "authProtocol",
  "handlerExecution",
  "dataAccess",
  "writeAction",
  "persistence",
  "productionConnector",
  "version",
] as const;

const REDACTION_KEYS = ["category", "occurrences", "version"] as const;

const SENSITIVE_VALUE_PATTERNS: readonly Readonly<{
  category: LocalMcpRedactedAuditRedactionCategoryV1;
  pattern: RegExp;
}>[] = [
  { category: "credential", pattern: /bearer\s+\S+|authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|secret[_-]?token|provider[_-]?credentials?|credential[_-]?(id|secret|token|key)|oauth/uim },
  { category: "session_marker", pattern: /cookie|session[_-]?(secret|token|id|cookie)|\bsid(?:[_-]|\b)/uim },
  { category: "source_text", pattern: /raw[_-]?(cv|resume|job)|cv\s+text|resume\s+text|job\s+(description|text)/uim },
  { category: "restricted_fact", pattern: /private[_-]?fact|never[_-]?use/uim },
  { category: "artifact_text", pattern: /generated[_-]?(full|artifact)|full\s+generated/uim },
  { category: "identity", pattern: /clerk[_-]?user|convex[_-]?user|user[_-]?real|\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/uim },
];

const SENSITIVE_KEY_PATTERNS: readonly Readonly<{
  category: LocalMcpRedactedAuditRedactionCategoryV1;
  pattern: RegExp;
}>[] = [
  { category: "credential", pattern: /token|secret|authorization|credential/uim },
  { category: "session_marker", pattern: /cookie|(?:^|[_-])session(?:[_-]?(secret|token|id|cookie))?(?:[_-]|$)|(?:^|[_-])sid(?:[_-]|$)/uim },
  { category: "source_text", pattern: /raw|cv|resume|job|source/uim },
  { category: "restricted_fact", pattern: /private|never[_-]?use|policy/uim },
  { category: "artifact_text", pattern: /generated|artifact|cover[_-]?letter/uim },
  { category: "identity", pattern: /user|email|clerk|convex|account/uim },
];

export function buildLocalMcpRedactedAuditEntry(
  input: LocalMcpRedactedAuditBuildInputV1,
): LocalMcpRedactedAuditEntryV1 {
  assertRedactedAuditBuildInput(input);
  const entry: LocalMcpRedactedAuditEntryV1 = {
    kind: "local_mcp_redacted_audit_entry",
    eventId: safeEventId(input.eventId),
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    outcome: input.outcome,
    ...(isSafeToolName(input.toolName) ? { toolName: input.toolName } : {}),
    ...(input.localToolId !== undefined ? { localToolId: input.localToolId } : {}),
    safeSummary: safeAuditSummary(input.safeSummary),
    redactions: collectLocalMcpRedactedAuditRedactions(input.rawPayload),
    capabilities: buildRedactedAuditCapabilities(input.consentBoundarySatisfied === true),
    fixtureOnly: true,
    persisted: false,
    version: 1,
  };

  const validation = validateLocalMcpRedactedAuditEntry(entry);
  if (!validation.valid) {
    throw new TypeError(validation.safeRefusal.message);
  }
  return entry;
}

export function collectLocalMcpRedactedAuditRedactions(
  value: unknown,
): readonly LocalMcpRedactedAuditRedactionV1[] {
  const counts = new Map<LocalMcpRedactedAuditRedactionCategoryV1, number>();
  visitAuditValue(value, 0, counts, new WeakSet<object>());
  if (value !== undefined && counts.size === 0) {
    counts.set("unknown_payload", 1);
  }
  return [...counts.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([category, occurrences]) => ({ category, occurrences, version: 1 as const }));
}

export function validateLocalMcpRedactedAuditEntry(
  value: unknown,
): LocalMcpRedactedAuditValidationResultV1 {
  if (isRecordLike(value) && containsForbiddenAuditText(value)) {
    return invalidAuditEntry("unsafe_audit_entry");
  }
  if (!isRedactedAuditEntryShape(value)) return invalidAuditEntry("malformed_audit_entry");
  return { valid: true, entry: value, version: 1 };
}

export function buildLocalMcpRedactedAuditSafeRefusal(): LocalMcpRedactedAuditSafeRefusalV1 {
  return {
    code: "redacted_audit_entry_rejected",
    message: "Refused. Redacted audit entry malformed.",
    safeForModel: true,
    fixtureOnly: true,
    version: 1,
  };
}

function buildRedactedAuditCapabilities(consentBoundarySatisfied: boolean): LocalMcpRedactedAuditCapabilitiesV1 {
  return {
    consent: consentBoundarySatisfied ? "boundary_only" : "not_evaluated",
    authProtocol: "not_evaluated",
    handlerExecution: "blocked",
    dataAccess: "blocked",
    writeAction: "blocked",
    persistence: "none",
    productionConnector: "blocked",
    version: 1,
  };
}

function visitAuditValue(
  value: unknown,
  depth: number,
  counts: Map<LocalMcpRedactedAuditRedactionCategoryV1, number>,
  seen: WeakSet<object>,
): void {
  if (depth > MAX_REDACTION_DEPTH) {
    addRedaction(counts, "unknown_payload");
    return;
  }
  if (typeof value === "string") {
    collectTextRedactions(value, counts);
    return;
  }
  if (!value || typeof value !== "object") return;
  if (seen.has(value)) {
    addRedaction(counts, "unknown_payload");
    return;
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item) => visitAuditValue(item, depth + 1, counts, seen));
  } else {
    Object.entries(value as Record<string, unknown>).forEach(([key, item]) => {
      collectKeyRedactions(key, counts);
      visitAuditValue(item, depth + 1, counts, seen);
    });
  }
  seen.delete(value);
}

function collectKeyRedactions(
  key: string,
  counts: Map<LocalMcpRedactedAuditRedactionCategoryV1, number>,
): void {
  SENSITIVE_KEY_PATTERNS.forEach(({ category, pattern }) => {
    if (pattern.test(key)) addRedaction(counts, category);
  });
}

function collectTextRedactions(
  text: string,
  counts: Map<LocalMcpRedactedAuditRedactionCategoryV1, number>,
): void {
  SENSITIVE_VALUE_PATTERNS.forEach(({ category, pattern }) => {
    if (pattern.test(text)) addRedaction(counts, category);
  });
}

function addRedaction(
  counts: Map<LocalMcpRedactedAuditRedactionCategoryV1, number>,
  category: LocalMcpRedactedAuditRedactionCategoryV1,
): void {
  counts.set(category, (counts.get(category) ?? 0) + 1);
}

function assertRedactedAuditBuildInput(input: LocalMcpRedactedAuditBuildInputV1): void {
  if (!isAuditEventType(input.eventType)) throw new TypeError("Redacted audit event type is invalid");
  if (!isStrictIsoUtcTimestamp(input.occurredAt)) throw new TypeError("Redacted audit timestamp is invalid");
  if (!isAuditOutcome(input.outcome)) throw new TypeError("Redacted audit outcome is invalid");
  if (input.eventId !== undefined && !isSafeEventId(input.eventId)) {
    throw new TypeError("Redacted audit event id is invalid");
  }
  if (input.toolName !== undefined && !isSafeToolName(input.toolName)) {
    throw new TypeError("Redacted audit tool name is invalid");
  }
}

function isRedactedAuditEntryShape(value: unknown): value is LocalMcpRedactedAuditEntryV1 {
  if (!isRecordLike(value) || !hasOnlyAllowedKeys(value, ENTRY_KEYS)) return false;
  const checks = [
    value.kind === "local_mcp_redacted_audit_entry",
    isSafeEventId(value.eventId),
    isAuditEventType(value.eventType),
    isStrictIsoUtcTimestamp(value.occurredAt),
    isAuditOutcome(value.outcome),
    optionalSafeToolName(value.toolName),
    optionalLocalToolId(value.localToolId),
    isSafeAuditSummary(value.safeSummary),
    Array.isArray(value.redactions),
    Array.isArray(value.redactions) && value.redactions.every(isAuditRedaction),
    isAuditCapabilities(value.capabilities),
    value.fixtureOnly === true,
    value.persisted === false,
    value.version === 1,
  ];
  return checks.every(Boolean);
}

function invalidAuditEntry(
  reason: LocalMcpRedactedAuditValidationErrorCodeV1,
): LocalMcpRedactedAuditValidationResultV1 {
  return { valid: false, reason, safeRefusal: buildLocalMcpRedactedAuditSafeRefusal(), version: 1 };
}

function containsForbiddenAuditText(entry: Record<string, unknown>): boolean {
  const serialized = JSON.stringify(entry);
  return SENSITIVE_VALUE_PATTERNS.some(({ pattern }) => pattern.test(serialized));
}

function safeEventId(value: string | undefined): string {
  return isSafeEventId(value) ? value : DEFAULT_EVENT_ID;
}

function safeAuditSummary(value: string | undefined): string {
  if (!isSafeAuditSummary(value)) return DEFAULT_SAFE_SUMMARY;
  return value;
}

function isSafeEventId(value: unknown): value is string {
  return typeof value === "string" && /^redacted-audit:[a-z0-9._:-]{1,96}$/u.test(value);
}

function isSafeAuditSummary(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /\S/u.test(value) &&
    value.length <= MAX_SAFE_SUMMARY_LENGTH &&
    !SENSITIVE_VALUE_PATTERNS.some(({ pattern }) => pattern.test(value))
  );
}

function isSafeToolName(value: unknown): value is string {
  return typeof value === "string" && /^twoweeks\.[a-z_]+\.summarize$/u.test(value);
}

function optionalSafeToolName(value: unknown): boolean {
  return value === undefined || isSafeToolName(value);
}

function optionalLocalToolId(value: unknown): value is LocalMcpToolIdV1 | undefined {
  return (
    value === undefined ||
    value === "local_mcp.application_package.summarize" ||
    value === "local_mcp.evidence_graph.summarize" ||
    value === "local_mcp.resume_variant_plan.summarize" ||
    value === "local_mcp.review_cockpit.summarize"
  );
}

function isAuditRedaction(value: unknown): value is LocalMcpRedactedAuditRedactionV1 {
  return (
    isRecordLike(value) &&
    hasOnlyAllowedKeys(value, REDACTION_KEYS) &&
    isRedactionCategory(value.category) &&
    Number.isInteger(value.occurrences) &&
    value.occurrences > 0 &&
    value.version === 1
  );
}

function isAuditCapabilities(value: unknown): value is LocalMcpRedactedAuditCapabilitiesV1 {
  if (!isRecordLike(value) || !hasOnlyAllowedKeys(value, CAPABILITY_KEYS)) return false;
  const checks = [
    value.consent === "not_evaluated" || value.consent === "boundary_only",
    value.authProtocol === "not_evaluated",
    value.handlerExecution === "blocked",
    value.dataAccess === "blocked",
    value.writeAction === "blocked",
    value.persistence === "none",
    value.productionConnector === "blocked",
    value.version === 1,
  ];
  return checks.every(Boolean);
}

function isAuditEventType(value: unknown): value is LocalMcpRedactedAuditEventTypeV1 {
  return (
    value === "consent_boundary_checked" ||
    value === "auth_boundary_refused" ||
    value === "tool_call_refused" ||
    value === "write_action_refused" ||
    value === "audit_entry_rejected"
  );
}

function isAuditOutcome(value: unknown): value is LocalMcpRedactedAuditOutcomeV1 {
  return value === "boundary_only" || value === "refused" || value === "blocked" || value === "invalid";
}

function isRedactionCategory(value: unknown): value is LocalMcpRedactedAuditRedactionCategoryV1 {
  return (
    value === "source_text" ||
    value === "credential" ||
    value === "session_marker" ||
    value === "restricted_fact" ||
    value === "artifact_text" ||
    value === "identity" ||
    value === "unknown_payload"
  );
}

function isStrictIsoUtcTimestamp(value: unknown): value is string {
  return (
    typeof value === "string" &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/u.test(value) &&
    Number.isFinite(Date.parse(value))
  );
}

function hasOnlyAllowedKeys(value: Record<string, unknown>, allowedKeys: readonly string[]): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
