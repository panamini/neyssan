import {
  assertLocalMcpApprovalDecision,
  assertLocalMcpApprovalRequest,
} from "./mcpApprovalAuditBoundary";
import type {
  LocalMcpApprovalDecisionV1,
  LocalMcpApprovalRequestV1,
} from "./mcpApprovalAuditBoundary";
import {
  projectedToolNameToLocalToolId,
} from "./mcpCallEnvelope";
import type {
  LocalMcpCallEnvelopeV1,
  LocalMcpCallValidationResultV1,
} from "./mcpCallEnvelope";
import type { LocalMcpToolIdV1 } from "./schema";

export const LOCAL_MCP_HANDLER_ALLOWED_EFFECTS_V1 = [
  "read_local_reference",
  "compute_deterministic_result",
  "apply_privacy_filter",
  "build_safe_response",
  "build_audit_event_shell",
] as const;

export const LOCAL_MCP_HANDLER_FORBIDDEN_EFFECTS_V1 = [
  "convex_write",
  "persistent_audit_log",
  "network_call",
  "transport_server",
  "remote_mcp",
  "chatgpt_app",
  "oauth_flow",
  "ui_approval",
  "browser_automation",
  "export_document",
  "send_message",
  "submit_application",
  "apply_to_job",
  "mutate_candidate_facts",
  "include_private_facts",
  "include_never_use_facts",
] as const;

export const LOCAL_MCP_HANDLER_REQUIRED_AUDIT_CHECKPOINTS_V1 = [
  "approval_requested",
  "approval_approved",
  "call_validated",
  "handler_started",
  "handler_succeeded_or_refused",
  "handler_failed_safely",
] as const;

export const LOCAL_MCP_HANDLER_REQUIRED_PUBLIC_EXCLUSIONS_V1 = [
  "private",
  "never_use",
  "raw_source_text",
  "generated_full_text",
  "stack_trace",
] as const;

export type LocalMcpAllowedHandlerEffectV1 =
  (typeof LOCAL_MCP_HANDLER_ALLOWED_EFFECTS_V1)[number];

export type LocalMcpForbiddenHandlerEffectV1 =
  (typeof LOCAL_MCP_HANDLER_FORBIDDEN_EFFECTS_V1)[number];

export type LocalMcpHandlerAuditCheckpointV1 =
  (typeof LOCAL_MCP_HANDLER_REQUIRED_AUDIT_CHECKPOINTS_V1)[number];

export type LocalMcpHandlerPublicOutputExclusionV1 =
  (typeof LOCAL_MCP_HANDLER_REQUIRED_PUBLIC_EXCLUSIONS_V1)[number];

export type LocalMcpValidCallValidationV1 = Extract<
  LocalMcpCallValidationResultV1,
  { valid: true }
>;

export type LocalMcpHandlerEffectPolicyV1 = Readonly<{
  kind: "local_mcp_handler_effect_policy";
  allowedEffects: readonly LocalMcpAllowedHandlerEffectV1[];
  forbiddenEffects: readonly LocalMcpForbiddenHandlerEffectV1[];
  version: 1;
}>;

export type LocalMcpHandlerApprovalGateV1 = Readonly<{
  required: true;
  approvedDecisionRequired: true;
  approvalRequest: LocalMcpApprovalRequestV1;
  approvalDecision: LocalMcpApprovalDecisionV1;
  version: 1;
}>;

export type LocalMcpHandlerAuditGateV1 = Readonly<{
  required: true;
  requiredCheckpoints: readonly LocalMcpHandlerAuditCheckpointV1[];
  persistence: "not_persisted_in_pr21";
  version: 1;
}>;

export type LocalMcpHandlerIdempotencyGateV1 = Readonly<{
  required: true;
  keySource: "request_id";
  replayPolicy: "return_same_result_without_repeating_effects";
  version: 1;
}>;

export type LocalMcpHandlerRollbackGateV1 = Readonly<{
  required: true;
  planRef: string;
  irreversibleEffectsForbidden: true;
  version: 1;
}>;

export type LocalMcpHandlerPrivacyGateV1 = Readonly<{
  required: true;
  publicOutputExcludes: readonly LocalMcpHandlerPublicOutputExclusionV1[];
  filterRequiredBeforePublicResult: true;
  version: 1;
}>;

export type LocalMcpHandlerGatesV1 = Readonly<{
  approval: LocalMcpHandlerApprovalGateV1;
  audit: LocalMcpHandlerAuditGateV1;
  idempotency: LocalMcpHandlerIdempotencyGateV1;
  rollback: LocalMcpHandlerRollbackGateV1;
  privacy: LocalMcpHandlerPrivacyGateV1;
  version: 1;
}>;

export type LocalMcpHandlerBoundaryV1 = Readonly<{
  kind: "local_mcp_handler_boundary";
  mode: "future_real_handler_design_only";
  envelope: LocalMcpCallEnvelopeV1;
  validation: LocalMcpValidCallValidationV1;
  gates: LocalMcpHandlerGatesV1;
  effectPolicy: LocalMcpHandlerEffectPolicyV1;
  version: 1;
}>;

export type LocalMcpFutureHandlerResultContractV1 = Readonly<{
  kind: "local_mcp_future_handler_result_contract";
  mustBePrivacyFiltered: true;
  mustHaveAuditEventBeforeReturn: true;
  mayPersistInPr21: false;
  version: 1;
}>;

export type LocalMcpFutureHandlerBoundaryV1 = Readonly<{
  kind: "local_mcp_future_handler_boundary";
  input: LocalMcpHandlerBoundaryV1;
  resultContract: LocalMcpFutureHandlerResultContractV1;
  version: 1;
}>;

export type BuildLocalMcpHandlerBoundaryInputV1 = Readonly<{
  envelope: LocalMcpCallEnvelopeV1;
  validation: LocalMcpValidCallValidationV1;
  approvalRequest: LocalMcpApprovalRequestV1;
  approvalDecision: LocalMcpApprovalDecisionV1;
  rollbackPlanRef: string;
}>;

export type LocalMcpHandlerBoundaryErrorCodeV1 =
  | "invalid_boundary"
  | "invalid_envelope"
  | "invalid_validation"
  | "invalid_mode"
  | "tool_mismatch"
  | "approval_gate_missing"
  | "approval_not_approved"
  | "audit_gate_missing"
  | "idempotency_gate_missing"
  | "rollback_gate_missing"
  | "privacy_gate_missing"
  | "effect_policy_invalid";

export type LocalMcpHandlerBoundaryErrorV1 = Readonly<{
  code: LocalMcpHandlerBoundaryErrorCodeV1;
  message: string;
  path: string;
  safeForModel: true;
  version: 1;
}>;

export type LocalMcpHandlerBoundaryValidationResultV1 = Readonly<
  | {
      valid: true;
      boundary: LocalMcpHandlerBoundaryV1;
      version: 1;
    }
  | {
      valid: false;
      errors: readonly LocalMcpHandlerBoundaryErrorV1[];
      version: 1;
    }
>;

const TOP_LEVEL_KEYS = [
  "kind",
  "mode",
  "envelope",
  "validation",
  "gates",
  "effectPolicy",
  "version",
] as const;

const ENVELOPE_KEYS = [
  "kind",
  "toolName",
  "arguments",
  "user",
  "approval",
  "requestId",
  "version",
] as const;

const GATE_KEYS = [
  "approval",
  "audit",
  "idempotency",
  "rollback",
  "privacy",
  "version",
] as const;

export function buildLocalMcpHandlerBoundary(
  input: BuildLocalMcpHandlerBoundaryInputV1,
): LocalMcpHandlerBoundaryV1 {
  const boundary: LocalMcpHandlerBoundaryV1 = {
    kind: "local_mcp_handler_boundary",
    mode: "future_real_handler_design_only",
    envelope: cloneCallEnvelope(input.envelope),
    validation: { ...input.validation },
    gates: {
      approval: {
        required: true,
        approvedDecisionRequired: true,
        approvalRequest: cloneApprovalRequest(input.approvalRequest),
        approvalDecision: { ...input.approvalDecision },
        version: 1,
      },
      audit: {
        required: true,
        requiredCheckpoints: [...LOCAL_MCP_HANDLER_REQUIRED_AUDIT_CHECKPOINTS_V1],
        persistence: "not_persisted_in_pr21",
        version: 1,
      },
      idempotency: {
        required: true,
        keySource: "request_id",
        replayPolicy: "return_same_result_without_repeating_effects",
        version: 1,
      },
      rollback: {
        required: true,
        planRef: input.rollbackPlanRef,
        irreversibleEffectsForbidden: true,
        version: 1,
      },
      privacy: {
        required: true,
        publicOutputExcludes: [...LOCAL_MCP_HANDLER_REQUIRED_PUBLIC_EXCLUSIONS_V1],
        filterRequiredBeforePublicResult: true,
        version: 1,
      },
      version: 1,
    },
    effectPolicy: {
      kind: "local_mcp_handler_effect_policy",
      allowedEffects: [...LOCAL_MCP_HANDLER_ALLOWED_EFFECTS_V1],
      forbiddenEffects: [...LOCAL_MCP_HANDLER_FORBIDDEN_EFFECTS_V1],
      version: 1,
    },
    version: 1,
  };

  assertLocalMcpHandlerBoundary(boundary);
  return boundary;
}

export function validateLocalMcpHandlerBoundary(
  value: unknown,
): LocalMcpHandlerBoundaryValidationResultV1 {
  const errors: LocalMcpHandlerBoundaryErrorV1[] = [];
  if (!isPlainRecord(value)) {
    return invalid([
      error("invalid_boundary", "$", "Local MCP handler boundary must be an object."),
    ]);
  }

  if (!hasOnlyKeys(value, TOP_LEVEL_KEYS)) {
    addError(errors, "invalid_boundary", "$", "Local MCP handler boundary has unsupported fields.");
  }
  if (value.kind !== "local_mcp_handler_boundary") {
    addError(errors, "invalid_boundary", "$.kind", "Local MCP handler boundary kind is invalid.");
  }
  if (value.mode !== "future_real_handler_design_only") {
    addError(errors, "invalid_mode", "$.mode", "Local MCP handler boundary mode is invalid.");
  }
  if (value.version !== 1) {
    addError(errors, "invalid_boundary", "$.version", "Local MCP handler boundary version is invalid.");
  }

  validateEnvelope(value.envelope, errors);
  validateValidation(value.validation, errors);
  validateEffectPolicy(value.effectPolicy, errors);
  validateGates(value.gates, errors);
  validateCrossReferences(value, errors);

  if (errors.length > 0) return invalid(errors);
  return {
    valid: true,
    boundary: cloneHandlerBoundary(value as LocalMcpHandlerBoundaryV1),
    version: 1,
  };
}

export function assertLocalMcpHandlerBoundary(value: unknown): asserts value is LocalMcpHandlerBoundaryV1 {
  const result = validateLocalMcpHandlerBoundary(value);
  if (!result.valid) {
    throw new TypeError(
      `LocalMcpHandlerBoundary is invalid: ${result.errors.map((item) => item.code).join(", ")}`,
    );
  }
}

function validateEnvelope(
  value: unknown,
  errors: LocalMcpHandlerBoundaryErrorV1[],
): void {
  if (!isPlainRecord(value)) {
    addError(errors, "invalid_envelope", "$.envelope", "Local MCP call envelope is required.");
    return;
  }
  if (!hasOnlyKeys(value, ENVELOPE_KEYS)) {
    addError(errors, "invalid_envelope", "$.envelope", "Local MCP call envelope has unsupported fields.");
  }
  if (value.kind !== "local_mcp_call_envelope") {
    addError(errors, "invalid_envelope", "$.envelope.kind", "Local MCP call envelope kind is invalid.");
  }
  if (!isNonEmptyString(value.toolName)) {
    addError(errors, "invalid_envelope", "$.envelope.toolName", "Local MCP call envelope toolName is required.");
  }
  if (!isPlainRecord(value.arguments)) {
    addError(errors, "invalid_envelope", "$.envelope.arguments", "Local MCP call envelope arguments are required.");
  }
  if (!isPlainRecord(value.user) || !isNonEmptyString(value.user.userId)) {
    addError(errors, "invalid_envelope", "$.envelope.user", "Local MCP call envelope user is required.");
  }
  if (!isNonEmptyString(value.requestId)) {
    addError(errors, "invalid_envelope", "$.envelope.requestId", "Local MCP call envelope requestId is required.");
  }
  if (value.version !== 1) {
    addError(errors, "invalid_envelope", "$.envelope.version", "Local MCP call envelope version is invalid.");
  }
}

function validateValidation(
  value: unknown,
  errors: LocalMcpHandlerBoundaryErrorV1[],
): void {
  if (!isPlainRecord(value) || value.valid !== true) {
    addError(errors, "invalid_validation", "$.validation", "Local MCP call validation must be valid.");
    return;
  }
  if (!isNonEmptyString(value.toolName) || !isLocalToolId(value.localToolId)) {
    addError(errors, "invalid_validation", "$.validation", "Local MCP call validation is incomplete.");
  }
  if (value.version !== 1) {
    addError(errors, "invalid_validation", "$.validation.version", "Local MCP call validation version is invalid.");
  }
}

function validateEffectPolicy(
  value: unknown,
  errors: LocalMcpHandlerBoundaryErrorV1[],
): void {
  if (!isPlainRecord(value)) {
    addError(errors, "effect_policy_invalid", "$.effectPolicy", "Local MCP effect policy is required.");
    return;
  }
  if (
    value.kind !== "local_mcp_handler_effect_policy" ||
    value.version !== 1 ||
    !Array.isArray(value.allowedEffects) ||
    !Array.isArray(value.forbiddenEffects) ||
    !sameStringSet(value.allowedEffects, LOCAL_MCP_HANDLER_ALLOWED_EFFECTS_V1) ||
    !sameStringSet(value.forbiddenEffects, LOCAL_MCP_HANDLER_FORBIDDEN_EFFECTS_V1) ||
    value.allowedEffects.some((item) => !isAllowedEffect(item)) ||
    value.forbiddenEffects.some((item) => !isForbiddenEffect(item)) ||
    value.allowedEffects.some((item) => value.forbiddenEffects.includes(item))
  ) {
    addError(errors, "effect_policy_invalid", "$.effectPolicy", "Local MCP effect policy is invalid.");
  }
}

function validateGates(
  value: unknown,
  errors: LocalMcpHandlerBoundaryErrorV1[],
): void {
  if (!isPlainRecord(value)) {
    addError(errors, "invalid_boundary", "$.gates", "Local MCP handler gates are required.");
    return;
  }
  if (!hasOnlyKeys(value, GATE_KEYS) || value.version !== 1) {
    addError(errors, "invalid_boundary", "$.gates", "Local MCP handler gates are invalid.");
  }
  validateApprovalGate(value.approval, errors);
  validateAuditGate(value.audit, errors);
  validateIdempotencyGate(value.idempotency, errors);
  validateRollbackGate(value.rollback, errors);
  validatePrivacyGate(value.privacy, errors);
}

function validateApprovalGate(
  value: unknown,
  errors: LocalMcpHandlerBoundaryErrorV1[],
): void {
  if (!isPlainRecord(value)) {
    addError(errors, "approval_gate_missing", "$.gates.approval", "Local MCP approval gate is required.");
    return;
  }
  if (
    value.required !== true ||
    value.approvedDecisionRequired !== true ||
    value.version !== 1 ||
    !isPlainRecord(value.approvalRequest) ||
    !isPlainRecord(value.approvalDecision)
  ) {
    addError(errors, "approval_gate_missing", "$.gates.approval", "Local MCP approval gate is incomplete.");
    return;
  }
  try {
    assertLocalMcpApprovalRequest(value.approvalRequest as LocalMcpApprovalRequestV1);
    assertLocalMcpApprovalDecision(value.approvalDecision as LocalMcpApprovalDecisionV1);
  } catch {
    addError(errors, "approval_gate_missing", "$.gates.approval", "Local MCP approval gate is malformed.");
    return;
  }
  if ((value.approvalDecision as LocalMcpApprovalDecisionV1).decision !== "approved") {
    addError(errors, "approval_not_approved", "$.gates.approval.approvalDecision", "Local MCP approval is not approved.");
  }
}

function validateAuditGate(
  value: unknown,
  errors: LocalMcpHandlerBoundaryErrorV1[],
): void {
  if (
    !isPlainRecord(value) ||
    value.required !== true ||
    value.persistence !== "not_persisted_in_pr21" ||
    value.version !== 1 ||
    !Array.isArray(value.requiredCheckpoints) ||
    !sameStringSet(value.requiredCheckpoints, LOCAL_MCP_HANDLER_REQUIRED_AUDIT_CHECKPOINTS_V1)
  ) {
    addError(errors, "audit_gate_missing", "$.gates.audit", "Local MCP audit gate is incomplete.");
  }
}

function validateIdempotencyGate(
  value: unknown,
  errors: LocalMcpHandlerBoundaryErrorV1[],
): void {
  if (
    !isPlainRecord(value) ||
    value.required !== true ||
    value.keySource !== "request_id" ||
    value.replayPolicy !== "return_same_result_without_repeating_effects" ||
    value.version !== 1
  ) {
    addError(errors, "idempotency_gate_missing", "$.gates.idempotency", "Local MCP idempotency gate is incomplete.");
  }
}

function validateRollbackGate(
  value: unknown,
  errors: LocalMcpHandlerBoundaryErrorV1[],
): void {
  if (
    !isPlainRecord(value) ||
    value.required !== true ||
    !isNonEmptyString(value.planRef) ||
    value.irreversibleEffectsForbidden !== true ||
    value.version !== 1
  ) {
    addError(errors, "rollback_gate_missing", "$.gates.rollback", "Local MCP rollback gate is incomplete.");
  }
}

function validatePrivacyGate(
  value: unknown,
  errors: LocalMcpHandlerBoundaryErrorV1[],
): void {
  if (
    !isPlainRecord(value) ||
    value.required !== true ||
    value.filterRequiredBeforePublicResult !== true ||
    value.version !== 1 ||
    !Array.isArray(value.publicOutputExcludes) ||
    !sameStringSet(value.publicOutputExcludes, LOCAL_MCP_HANDLER_REQUIRED_PUBLIC_EXCLUSIONS_V1)
  ) {
    addError(errors, "privacy_gate_missing", "$.gates.privacy", "Local MCP privacy gate is incomplete.");
  }
}

function validateCrossReferences(
  value: Record<string, unknown>,
  errors: LocalMcpHandlerBoundaryErrorV1[],
): void {
  if (!isPlainRecord(value.envelope) || !isPlainRecord(value.validation) || !isPlainRecord(value.gates)) {
    return;
  }
  const envelope = value.envelope;
  const validation = value.validation;
  const approvalGate = value.gates.approval;
  const projectedLocalToolId =
    typeof envelope.toolName === "string" ? projectedToolNameToLocalToolId(envelope.toolName) : undefined;

  if (
    validation.valid !== true ||
    validation.toolName !== envelope.toolName ||
    validation.localToolId !== projectedLocalToolId
  ) {
    addError(errors, "tool_mismatch", "$.validation", "Local MCP validation does not match the envelope.");
  }
  if (!isPlainRecord(approvalGate)) return;
  const approvalRequest = approvalGate.approvalRequest;
  const approvalDecision = approvalGate.approvalDecision;
  if (!isPlainRecord(approvalRequest) || !isPlainRecord(approvalDecision)) return;
  if (
    approvalRequest.requestId !== envelope.requestId ||
    approvalRequest.toolName !== envelope.toolName ||
    approvalRequest.localToolId !== validation.localToolId ||
    approvalDecision.requestId !== envelope.requestId
  ) {
    addError(errors, "tool_mismatch", "$.gates.approval", "Local MCP approval gate does not match the envelope.");
  }
}

function cloneHandlerBoundary(boundary: LocalMcpHandlerBoundaryV1): LocalMcpHandlerBoundaryV1 {
  return {
    kind: "local_mcp_handler_boundary",
    mode: "future_real_handler_design_only",
    envelope: cloneCallEnvelope(boundary.envelope),
    validation: { ...boundary.validation },
    gates: {
      approval: {
        ...boundary.gates.approval,
        approvalRequest: cloneApprovalRequest(boundary.gates.approval.approvalRequest),
        approvalDecision: { ...boundary.gates.approval.approvalDecision },
      },
      audit: {
        ...boundary.gates.audit,
        requiredCheckpoints: [...boundary.gates.audit.requiredCheckpoints],
      },
      idempotency: { ...boundary.gates.idempotency },
      rollback: { ...boundary.gates.rollback },
      privacy: {
        ...boundary.gates.privacy,
        publicOutputExcludes: [...boundary.gates.privacy.publicOutputExcludes],
      },
      version: 1,
    },
    effectPolicy: {
      ...boundary.effectPolicy,
      allowedEffects: [...boundary.effectPolicy.allowedEffects],
      forbiddenEffects: [...boundary.effectPolicy.forbiddenEffects],
    },
    version: 1,
  };
}

function cloneCallEnvelope(envelope: LocalMcpCallEnvelopeV1): LocalMcpCallEnvelopeV1 {
  return {
    kind: "local_mcp_call_envelope",
    toolName: envelope.toolName,
    arguments: clonePlainRecord(envelope.arguments),
    user: {
      userId: envelope.user.userId,
      ...(envelope.user.sessionId !== undefined ? { sessionId: envelope.user.sessionId } : {}),
    },
    ...(envelope.approval !== undefined ? { approval: { ...envelope.approval } } : {}),
    ...(envelope.requestId !== undefined ? { requestId: envelope.requestId } : {}),
    version: 1,
  };
}

function cloneApprovalRequest(request: LocalMcpApprovalRequestV1): LocalMcpApprovalRequestV1 {
  return {
    ...request,
    argumentSummary: {
      ...request.argumentSummary,
      fields: [...request.argumentSummary.fields],
      refIds: [...request.argumentSummary.refIds],
    },
  };
}

function clonePlainRecord(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, cloneLocalValue(item)]),
  );
}

function cloneLocalValue(value: unknown): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(cloneLocalValue);
  if (isPlainRecord(value)) return clonePlainRecord(value);
  return null;
}

function invalid(
  errors: readonly LocalMcpHandlerBoundaryErrorV1[],
): LocalMcpHandlerBoundaryValidationResultV1 {
  return {
    valid: false,
    errors,
    version: 1,
  };
}

function addError(
  errors: LocalMcpHandlerBoundaryErrorV1[],
  code: LocalMcpHandlerBoundaryErrorCodeV1,
  path: string,
  message: string,
): void {
  errors.push(error(code, path, message));
}

function error(
  code: LocalMcpHandlerBoundaryErrorCodeV1,
  path: string,
  message: string,
): LocalMcpHandlerBoundaryErrorV1 {
  return {
    code,
    message,
    path,
    safeForModel: true,
    version: 1,
  };
}

function hasOnlyKeys(
  value: Record<string, unknown>,
  allowedKeys: readonly string[],
): boolean {
  return Object.keys(value).every((key) => allowedKeys.includes(key));
}

function sameStringSet(
  actual: readonly unknown[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    actual.every((item) => typeof item === "string") &&
    expected.every((item) => actual.includes(item))
  );
}

function isAllowedEffect(value: unknown): value is LocalMcpAllowedHandlerEffectV1 {
  return (
    typeof value === "string" &&
    (LOCAL_MCP_HANDLER_ALLOWED_EFFECTS_V1 as readonly string[]).includes(value)
  );
}

function isForbiddenEffect(value: unknown): value is LocalMcpForbiddenHandlerEffectV1 {
  return (
    typeof value === "string" &&
    (LOCAL_MCP_HANDLER_FORBIDDEN_EFFECTS_V1 as readonly string[]).includes(value)
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

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
