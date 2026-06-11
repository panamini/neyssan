import { buildStableHash } from "../application-harness/fingerprints";
import type {
  LocalMcpCallEnvelopeV1,
  LocalMcpCallErrorCodeV1,
  LocalMcpCallValidationResultV1,
} from "./mcpCallEnvelope";
import type {
  LocalMcpApprovalV1,
  LocalMcpToolIdV1,
  LocalMcpToolRegistryV1,
} from "./schema";
import { buildLocalMcpToolRegistry } from "./toolRegistry";

export type LocalMcpApprovalDecisionStatusV1 = "approved" | "denied";

export type LocalMcpSafeArgumentSummaryV1 = Readonly<{
  kind: "local_mcp_safe_argument_summary";
  fields: readonly string[];
  refIds: readonly string[];
  omittedRawValueCount: number;
  version: 1;
}>;

export type LocalMcpApprovalRequestV1 = Readonly<{
  kind: "local_mcp_approval_request";
  requestId: string;
  toolName: string;
  localToolId: LocalMcpToolIdV1;
  userId: string;
  sessionId?: string;
  reason: string;
  requestedAt: string;
  riskLevel: "low" | "medium";
  argumentSummary: LocalMcpSafeArgumentSummaryV1;
  version: 1;
}>;

export type LocalMcpApprovalDecisionV1 = Readonly<{
  kind: "local_mcp_approval_decision";
  requestId: string;
  decision: LocalMcpApprovalDecisionStatusV1;
  decidedBy: string;
  decidedAt: string;
  reason?: string;
  version: 1;
}>;

export type LocalMcpAuditEventTypeV1 =
  | "approval_requested"
  | "approval_approved"
  | "approval_denied"
  | "call_validated"
  | "call_refused"
  | "call_error_result_built";

export type LocalMcpAuditOutcomeV1 =
  | "allowed"
  | "refused"
  | "approved"
  | "denied"
  | "error";

export type LocalMcpAuditEventV1 = Readonly<{
  kind: "local_mcp_audit_event";
  eventId: string;
  eventType: LocalMcpAuditEventTypeV1;
  requestId?: string;
  toolName?: string;
  localToolId?: LocalMcpToolIdV1;
  userId?: string;
  sessionId?: string;
  occurredAt: string;
  outcome: LocalMcpAuditOutcomeV1;
  reasonCode?: LocalMcpCallErrorCodeV1;
  safeSummary?: string;
  version: 1;
}>;

export type LocalMcpAuditEventBuildInputV1 = Readonly<{
  eventType: LocalMcpAuditEventTypeV1;
  requestId?: string;
  toolName?: string;
  localToolId?: LocalMcpToolIdV1;
  userId?: string;
  sessionId?: string;
  occurredAt: string;
  outcome: LocalMcpAuditOutcomeV1;
  reasonCode?: LocalMcpCallErrorCodeV1;
  safeSummary?: string;
}>;

const EXPECTED_REF_FIELDS = [
  "applicationPackageRef",
  "evidenceGraphRef",
  "resumeVariantPlanRef",
  "reviewCockpitRef",
] as const;

const SAFE_SUMMARY_FORBIDDEN_TERMS = [
  "cv text",
  "generated full",
  "job text",
  "never use",
  "never_use",
  "private facts",
  "privatefacts",
  "raw",
  "raw arguments",
  "source document",
  "stack",
  "stack trace",
] as const;

const AUDIT_EVENT_HASH_NAMESPACE = "local-mcp-approval-audit";

export function buildLocalMcpSafeArgumentSummary(
  args: Readonly<Record<string, unknown>>,
): LocalMcpSafeArgumentSummaryV1 {
  const fields = new Set<string>();
  const refIds = new Set<string>();
  let omittedRawValueCount = 0;

  for (const [field, value] of Object.entries(args)) {
    if (!isExpectedRefField(field)) {
      omittedRawValueCount += 1;
      continue;
    }

    fields.add(field);
    if (isPlainRecord(value) && isNonEmptyString(value.id)) {
      refIds.add(value.id);
    }
    if (!isExactRefObject(value)) {
      omittedRawValueCount += 1;
    }
  }

  return {
    kind: "local_mcp_safe_argument_summary",
    fields: [...fields].sort(compareStrings),
    refIds: [...refIds].sort(compareStrings),
    omittedRawValueCount,
    version: 1,
  };
}

export function buildLocalMcpApprovalRequest(
  envelope: LocalMcpCallEnvelopeV1,
  validation: LocalMcpCallValidationResultV1,
  options: Readonly<{ requestedAt?: string; registry?: LocalMcpToolRegistryV1 }> = {},
): LocalMcpApprovalRequestV1 {
  if (!validation.valid) {
    throw new TypeError("LocalMcpApprovalRequest requires validation with a valid localToolId");
  }
  if (!isNonEmptyString(envelope.requestId)) {
    throw new TypeError("LocalMcpApprovalRequest requires PR19 requestId");
  }
  if (!isNonEmptyString(options.requestedAt)) {
    throw new TypeError("LocalMcpApprovalRequest requires requestedAt");
  }
  if (!isNonEmptyString(envelope.user.userId)) {
    throw new TypeError("LocalMcpApprovalRequest requires userId");
  }

  const registry = options.registry ?? buildLocalMcpToolRegistry();
  const tool = registry.tools.find(
    (candidate) => candidate.id === validation.localToolId,
  );
  if (!tool || (tool.riskLevel !== "low" && tool.riskLevel !== "medium")) {
    throw new TypeError("LocalMcpApprovalRequest requires low or medium risk local tool");
  }

  const request: LocalMcpApprovalRequestV1 = {
    kind: "local_mcp_approval_request",
    requestId: envelope.requestId,
    toolName: envelope.toolName,
    localToolId: validation.localToolId,
    userId: envelope.user.userId,
    ...(envelope.user.sessionId !== undefined ? { sessionId: envelope.user.sessionId } : {}),
    reason: `Approval required for ${validation.localToolId}.`,
    requestedAt: options.requestedAt,
    riskLevel: tool.riskLevel,
    argumentSummary: buildLocalMcpSafeArgumentSummary(envelope.arguments),
    version: 1,
  };
  assertLocalMcpApprovalRequest(request);
  return request;
}

export function buildLocalMcpApprovalDecision(
  input: Readonly<{
    requestId: string;
    decision: LocalMcpApprovalDecisionStatusV1;
    decidedBy: string;
    decidedAt: string;
    reason?: string;
  }>,
): LocalMcpApprovalDecisionV1 {
  if (!isNonEmptyString(input.requestId)) {
    throw new TypeError("LocalMcpApprovalDecision requires requestId");
  }
  if (!isApprovalDecisionStatus(input.decision)) {
    throw new TypeError("LocalMcpApprovalDecision requires approved or denied decision");
  }
  if (!isNonEmptyString(input.decidedBy)) {
    throw new TypeError("LocalMcpApprovalDecision requires decidedBy");
  }
  if (!isNonEmptyString(input.decidedAt)) {
    throw new TypeError("LocalMcpApprovalDecision requires decidedAt");
  }
  if (input.reason !== undefined && !isNonEmptyString(input.reason)) {
    throw new TypeError("LocalMcpApprovalDecision reason must be non-empty when provided");
  }

  const decision: LocalMcpApprovalDecisionV1 = {
    kind: "local_mcp_approval_decision",
    requestId: input.requestId,
    decision: input.decision,
    decidedBy: input.decidedBy,
    decidedAt: input.decidedAt,
    ...(input.reason !== undefined ? { reason: input.reason } : {}),
    version: 1,
  };
  assertLocalMcpApprovalDecision(decision);
  return decision;
}

export function approvalDecisionToLocalMcpApproval(
  decision: LocalMcpApprovalDecisionV1,
): LocalMcpApprovalV1 {
  assertLocalMcpApprovalDecision(decision);
  // PR19 approval metadata has no deniedBy/deniedAt fields; when approved is false,
  // these compatibility fields identify who made the denial and when.
  return {
    approved: decision.decision === "approved",
    approvedBy: decision.decidedBy,
    approvedAt: decision.decidedAt,
    ...(decision.reason !== undefined ? { reason: decision.reason } : {}),
    version: 1,
  };
}

export async function buildLocalMcpAuditEvent(
  input: LocalMcpAuditEventBuildInputV1,
): Promise<LocalMcpAuditEventV1> {
  assertLocalMcpAuditEventBuildInput(input);
  const eventId = `local-mcp-audit-event:${await buildStableHash({
    namespace: AUDIT_EVENT_HASH_NAMESPACE,
    eventType: input.eventType,
    requestId: input.requestId,
    toolName: input.toolName,
    localToolId: input.localToolId,
    userId: input.userId,
    sessionId: input.sessionId,
    occurredAt: input.occurredAt,
    outcome: input.outcome,
    reasonCode: input.reasonCode,
    version: 1,
  })}`;
  const event: LocalMcpAuditEventV1 = {
    kind: "local_mcp_audit_event",
    eventId,
    eventType: input.eventType,
    ...(input.requestId !== undefined ? { requestId: input.requestId } : {}),
    ...(input.toolName !== undefined ? { toolName: input.toolName } : {}),
    ...(input.localToolId !== undefined ? { localToolId: input.localToolId } : {}),
    ...(input.userId !== undefined ? { userId: input.userId } : {}),
    ...(input.sessionId !== undefined ? { sessionId: input.sessionId } : {}),
    occurredAt: input.occurredAt,
    outcome: input.outcome,
    ...(input.reasonCode !== undefined ? { reasonCode: input.reasonCode } : {}),
    ...(isSafeSummary(input.safeSummary) ? { safeSummary: input.safeSummary } : {}),
    version: 1,
  };
  assertLocalMcpAuditEvent(event);
  return event;
}

export function assertLocalMcpApprovalRequest(value: LocalMcpApprovalRequestV1): void {
  const request = asPlainRecord(value, "LocalMcpApprovalRequest must be an object");
  if (request.kind !== "local_mcp_approval_request") {
    throw new TypeError("LocalMcpApprovalRequest requires kind");
  }
  assertNonEmptyRecordString(request, "requestId");
  assertNonEmptyRecordString(request, "toolName");
  assertLocalToolId(request.localToolId);
  assertNonEmptyRecordString(request, "userId");
  if (request.sessionId !== undefined && !isNonEmptyString(request.sessionId)) {
    throw new TypeError("LocalMcpApprovalRequest sessionId must be non-empty when provided");
  }
  assertNonEmptyRecordString(request, "reason");
  assertNonEmptyRecordString(request, "requestedAt");
  if (request.riskLevel !== "low" && request.riskLevel !== "medium") {
    throw new TypeError("LocalMcpApprovalRequest riskLevel must be low or medium");
  }
  assertLocalMcpSafeArgumentSummary(request.argumentSummary);
  if (request.version !== 1) throw new TypeError("LocalMcpApprovalRequest version must be 1");
}

export function assertLocalMcpApprovalDecision(value: LocalMcpApprovalDecisionV1): void {
  const decision = asPlainRecord(value, "LocalMcpApprovalDecision must be an object");
  if (decision.kind !== "local_mcp_approval_decision") {
    throw new TypeError("LocalMcpApprovalDecision requires kind");
  }
  assertNonEmptyRecordString(decision, "requestId");
  if (!isApprovalDecisionStatus(decision.decision)) {
    throw new TypeError("LocalMcpApprovalDecision requires approved or denied decision");
  }
  assertNonEmptyRecordString(decision, "decidedBy");
  assertNonEmptyRecordString(decision, "decidedAt");
  if (decision.reason !== undefined && !isNonEmptyString(decision.reason)) {
    throw new TypeError("LocalMcpApprovalDecision reason must be non-empty when provided");
  }
  if (decision.version !== 1) throw new TypeError("LocalMcpApprovalDecision version must be 1");
}

export function assertLocalMcpAuditEvent(value: LocalMcpAuditEventV1): void {
  const event = asPlainRecord(value, "LocalMcpAuditEvent must be an object");
  if (event.kind !== "local_mcp_audit_event") throw new TypeError("LocalMcpAuditEvent requires kind");
  if (!isNonEmptyString(event.eventId) || !/^local-mcp-audit-event:[a-f0-9]{64}$/u.test(event.eventId)) {
    throw new TypeError("LocalMcpAuditEvent requires deterministic eventId");
  }
  if (!isAuditEventType(event.eventType)) throw new TypeError("LocalMcpAuditEvent requires eventType");
  if (event.requestId !== undefined && !isNonEmptyString(event.requestId)) {
    throw new TypeError("LocalMcpAuditEvent requestId must be non-empty when provided");
  }
  if (event.toolName !== undefined && !isNonEmptyString(event.toolName)) {
    throw new TypeError("LocalMcpAuditEvent toolName must be non-empty when provided");
  }
  if (event.localToolId !== undefined) assertLocalToolId(event.localToolId);
  if (event.userId !== undefined && !isNonEmptyString(event.userId)) {
    throw new TypeError("LocalMcpAuditEvent userId must be non-empty when provided");
  }
  if (event.sessionId !== undefined && !isNonEmptyString(event.sessionId)) {
    throw new TypeError("LocalMcpAuditEvent sessionId must be non-empty when provided");
  }
  assertNonEmptyRecordString(event, "occurredAt");
  if (!isAuditOutcome(event.outcome)) throw new TypeError("LocalMcpAuditEvent requires outcome");
  if (event.reasonCode !== undefined && !isCallErrorCode(event.reasonCode)) {
    throw new TypeError("LocalMcpAuditEvent reasonCode is invalid");
  }
  if (event.safeSummary !== undefined && !isSafeSummary(event.safeSummary)) {
    throw new TypeError("LocalMcpAuditEvent safeSummary is unsafe");
  }
  if (event.version !== 1) throw new TypeError("LocalMcpAuditEvent version must be 1");
}

function assertLocalMcpSafeArgumentSummary(value: unknown): void {
  const summary = asPlainRecord(value, "LocalMcpSafeArgumentSummary must be an object");
  if (summary.kind !== "local_mcp_safe_argument_summary") {
    throw new TypeError("LocalMcpSafeArgumentSummary requires kind");
  }
  if (!Array.isArray(summary.fields) || !summary.fields.every(isExpectedRefField)) {
    throw new TypeError("LocalMcpSafeArgumentSummary requires expected fields");
  }
  if (!Array.isArray(summary.refIds) || !summary.refIds.every(isNonEmptyString)) {
    throw new TypeError("LocalMcpSafeArgumentSummary requires refIds");
  }
  if (!Number.isInteger(summary.omittedRawValueCount) || summary.omittedRawValueCount < 0) {
    throw new TypeError("LocalMcpSafeArgumentSummary requires omittedRawValueCount");
  }
  if (summary.version !== 1) throw new TypeError("LocalMcpSafeArgumentSummary version must be 1");
}

function assertLocalMcpAuditEventBuildInput(input: LocalMcpAuditEventBuildInputV1): void {
  if (!isPlainRecord(input)) throw new TypeError("LocalMcpAuditEvent input must be an object");
  if (!isAuditEventType(input.eventType)) throw new TypeError("LocalMcpAuditEvent input requires eventType");
  if (input.requestId !== undefined && !isNonEmptyString(input.requestId)) {
    throw new TypeError("LocalMcpAuditEvent input requestId must be non-empty when provided");
  }
  if (input.toolName !== undefined && !isNonEmptyString(input.toolName)) {
    throw new TypeError("LocalMcpAuditEvent input toolName must be non-empty when provided");
  }
  if (input.localToolId !== undefined) assertLocalToolId(input.localToolId);
  if (input.userId !== undefined && !isNonEmptyString(input.userId)) {
    throw new TypeError("LocalMcpAuditEvent input userId must be non-empty when provided");
  }
  if (input.sessionId !== undefined && !isNonEmptyString(input.sessionId)) {
    throw new TypeError("LocalMcpAuditEvent input sessionId must be non-empty when provided");
  }
  if (!isNonEmptyString(input.occurredAt)) {
    throw new TypeError("LocalMcpAuditEvent input requires occurredAt");
  }
  if (!isAuditOutcome(input.outcome)) throw new TypeError("LocalMcpAuditEvent input requires outcome");
  if (input.reasonCode !== undefined && !isCallErrorCode(input.reasonCode)) {
    throw new TypeError("LocalMcpAuditEvent input reasonCode is invalid");
  }
}

function assertLocalToolId(value: unknown): asserts value is LocalMcpToolIdV1 {
  if (!isLocalToolId(value)) throw new TypeError("Local MCP localToolId is invalid");
}

function assertNonEmptyRecordString(record: Record<string, unknown>, field: string): void {
  if (!isNonEmptyString(record[field])) throw new TypeError(`Local MCP ${field} must be non-empty`);
}

function isExactRefObject(value: unknown): boolean {
  return isPlainRecord(value) && Object.keys(value).length === 1 && isNonEmptyString(value.id);
}

function isExpectedRefField(value: unknown): value is (typeof EXPECTED_REF_FIELDS)[number] {
  return typeof value === "string" && (EXPECTED_REF_FIELDS as readonly string[]).includes(value);
}

function isApprovalDecisionStatus(value: unknown): value is LocalMcpApprovalDecisionStatusV1 {
  return value === "approved" || value === "denied";
}

function isAuditEventType(value: unknown): value is LocalMcpAuditEventTypeV1 {
  return (
    value === "approval_requested" ||
    value === "approval_approved" ||
    value === "approval_denied" ||
    value === "call_validated" ||
    value === "call_refused" ||
    value === "call_error_result_built"
  );
}

function isAuditOutcome(value: unknown): value is LocalMcpAuditOutcomeV1 {
  return (
    value === "allowed" ||
    value === "refused" ||
    value === "approved" ||
    value === "denied" ||
    value === "error"
  );
}

function isCallErrorCode(value: unknown): value is LocalMcpCallErrorCodeV1 {
  return (
    value === "invalid_request" ||
    value === "unknown_tool" ||
    value === "invalid_tool_name" ||
    value === "invalid_arguments" ||
    value === "missing_user" ||
    value === "approval_required" ||
    value === "tool_not_allowlisted" ||
    value === "output_too_large" ||
    value === "privacy_filter_required" ||
    value === "handler_unavailable" ||
    value === "timeout" ||
    value === "rate_limited" ||
    value === "internal_error"
  );
}

function isLocalToolId(value: unknown): value is LocalMcpToolIdV1 {
  return (
    value === "local_mcp.application_package.summarize" ||
    value === "local_mcp.evidence_graph.summarize" ||
    value === "local_mcp.resume_variant_plan.summarize" ||
    value === "local_mcp.review_cockpit.summarize"
  );
}

function isSafeSummary(value: unknown): value is string {
  if (!isNonEmptyString(value) || value.length > 240) return false;
  const normalized = value.normalize("NFKC").toLowerCase();
  return !SAFE_SUMMARY_FORBIDDEN_TERMS.some((term) => normalized.includes(term));
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  if (!isPlainRecord(value)) throw new TypeError(message);
  return value;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
