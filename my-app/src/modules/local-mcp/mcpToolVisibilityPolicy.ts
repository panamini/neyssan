import type {
  LocalMcpApprovalDecisionV1,
  LocalMcpAuditEventV1,
} from "./mcpApprovalAuditBoundary";
import type {
  LocalMcpCallEnvelopeV1,
  LocalMcpCallValidationResultV1,
} from "./mcpCallEnvelope";
import type { LocalMcpHandlerBoundaryV1 } from "./mcpHandlerBoundary";
import {
  assertLocalMcpProjectedToolDescriptor,
  projectLocalMcpRegistryToMcpToolsList,
} from "./mcpSchemaProjection";
import type { LocalMcpProjectedToolDescriptorV1 } from "./mcpSchemaProjection";
import {
  buildDisabledLocalMcpRemoteTransportConfig,
} from "./mcpRemoteTransportSpike";
import type {
  LocalMcpRemoteTransportConfigV1,
  LocalMcpRemoteTransportPreflightResultV1,
} from "./mcpRemoteTransportSpike";
import {
  assertLocalMcpPrivacySafeOutput,
} from "./privacyRedactionFixtures";
import type {
  LocalMcpPrivacyRedactionCheckResultV1,
} from "./privacyRedactionFixtures";
import type {
  LocalMcpToolIdV1,
  LocalMcpToolRegistryV1,
} from "./schema";
import { buildLocalMcpToolRegistry } from "./toolRegistry";

export type LocalMcpToolVisibilityStateV1 =
  | "hidden"
  | "listed_disabled"
  | "listed_dry_run"
  | "listed_requires_approval"
  | "listed_ready_for_review"
  | "blocked_by_privacy"
  | "disabled_by_admin";

export type LocalMcpToolVisibilityReasonV1 =
  | "default_hidden"
  | "admin_disabled"
  | "tool_not_in_registry"
  | "descriptor_missing"
  | "descriptor_invalid"
  | "call_envelope_missing"
  | "call_validation_missing"
  | "call_validation_failed"
  | "approval_required"
  | "approval_missing"
  | "approval_denied"
  | "audit_missing"
  | "handler_boundary_missing"
  | "handler_boundary_blocked"
  | "handler_unavailable"
  | "transport_disabled"
  | "transport_blocked"
  | "remote_transport_not_allowed"
  | "privacy_review_missing"
  | "privacy_check_failed"
  | "privacy_fixture_failed"
  | "dry_run_only"
  | "safe_for_internal_review"
  | "safe_summary_only";

export type LocalMcpToolVisibilityPolicyContextV1 = Readonly<{
  kind: "local_mcp_tool_visibility_policy_context";
  registry: LocalMcpToolRegistryV1;
  descriptors: readonly LocalMcpProjectedToolDescriptorV1[];
  callEnvelope?: LocalMcpCallEnvelopeV1;
  callValidation?: LocalMcpCallValidationResultV1;
  approvalDecision?: LocalMcpApprovalDecisionV1;
  auditEvents?: readonly LocalMcpAuditEventV1[];
  handlerBoundary?: LocalMcpHandlerBoundaryV1;
  remoteTransportConfig: LocalMcpRemoteTransportConfigV1;
  remoteTransportPreflight?: LocalMcpRemoteTransportPreflightResultV1;
  privacyCheck?: LocalMcpPrivacyRedactionCheckResultV1;
  adminDisabledToolIds: readonly LocalMcpToolIdV1[];
  allowDryRunListing: boolean;
  allowDisabledListing: boolean;
  allowRemoteListing: boolean;
  privacyReviewComplete: boolean;
  version: 1;
}>;

export type LocalMcpToolVisibilityPolicyInputV1 = Readonly<{
  kind: "local_mcp_tool_visibility_policy_input";
  localToolId: LocalMcpToolIdV1;
  context: LocalMcpToolVisibilityPolicyContextV1;
  version: 1;
}>;

export type LocalMcpToolVisibilityDecisionV1 = Readonly<{
  kind: "local_mcp_tool_visibility_decision";
  localToolId: LocalMcpToolIdV1;
  projectedToolName?: string;
  state: LocalMcpToolVisibilityStateV1;
  reasons: readonly LocalMcpToolVisibilityReasonV1[];
  safeSummary: string;
  version: 1;
}>;

export type LocalMcpToolVisibilityListV1 = Readonly<{
  kind: "local_mcp_tool_visibility_list";
  decisions: readonly LocalMcpToolVisibilityDecisionV1[];
  version: 1;
}>;

const VISIBILITY_STATE_ORDER: readonly LocalMcpToolVisibilityStateV1[] = [
  "hidden",
  "listed_disabled",
  "listed_dry_run",
  "listed_requires_approval",
  "listed_ready_for_review",
  "blocked_by_privacy",
  "disabled_by_admin",
] as const;

const REASON_ORDER: readonly LocalMcpToolVisibilityReasonV1[] = [
  "admin_disabled",
  "tool_not_in_registry",
  "descriptor_missing",
  "descriptor_invalid",
  "call_envelope_missing",
  "call_validation_missing",
  "call_validation_failed",
  "approval_required",
  "approval_missing",
  "approval_denied",
  "audit_missing",
  "handler_boundary_missing",
  "handler_boundary_blocked",
  "handler_unavailable",
  "transport_disabled",
  "transport_blocked",
  "remote_transport_not_allowed",
  "privacy_review_missing",
  "privacy_check_failed",
  "privacy_fixture_failed",
  "dry_run_only",
  "safe_for_internal_review",
  "safe_summary_only",
  "default_hidden",
] as const;

const SAFE_SUMMARIES: Readonly<Record<LocalMcpToolVisibilityStateV1, string>> = {
  hidden: "Hidden by default.",
  listed_disabled: "Tool disabled.",
  listed_dry_run: "Dry run only.",
  listed_requires_approval: "Approval required.",
  listed_ready_for_review: "Ready for review. No handler executed.",
  blocked_by_privacy: "Blocked. Review privacy.",
  disabled_by_admin: "Tool disabled.",
} as const;

const UNSAFE_SUMMARY_TERMS = [
  "arguments",
  "never_use",
  "origin",
  "private facts",
  "raw",
  "secret",
  "session",
  "sourcequote",
  "stack trace",
  "token",
  "user id",
] as const;

type LocalMcpVisibilityStateInput = Readonly<{
  localToolId: LocalMcpToolIdV1;
  toolRequiresApproval: boolean;
  toolFound: boolean;
  descriptorValid: boolean;
  privacySafe: boolean;
  approvalReady: boolean;
  auditReady: boolean;
  handlerReady: boolean;
  remoteReady: boolean;
  context: LocalMcpToolVisibilityPolicyContextV1;
  reasons: Set<LocalMcpToolVisibilityReasonV1>;
}>;

type LocalMcpVisibilityStateRule = Readonly<{
  matches: (input: LocalMcpVisibilityStateInput) => boolean;
  state: (input: LocalMcpVisibilityStateInput) => LocalMcpToolVisibilityStateV1;
}>;

const VISIBILITY_STATE_RULES: readonly LocalMcpVisibilityStateRule[] = [
  {
    matches: isAdminDisabledInput,
    state: (input) => {
      input.reasons.add("admin_disabled");
      return "disabled_by_admin";
    },
  },
  {
    matches: (input) => !input.toolFound,
    state: (input) => {
      input.reasons.add("tool_not_in_registry");
      return "hidden";
    },
  },
  {
    matches: isPrivacyBlockedInput,
    state: (input) => {
      addPrivacyBlockedReasons(input.context, input.reasons);
      return "blocked_by_privacy";
    },
  },
  {
    matches: (input) => input.context.approvalDecision?.decision === "denied",
    state: () => "listed_disabled",
  },
  {
    matches: (input) => input.context.allowRemoteListing && !input.remoteReady,
    state: (input) => (input.context.allowDisabledListing ? "listed_disabled" : "hidden"),
  },
  {
    matches: isReadyForReview,
    state: (input) => {
      input.reasons.add("safe_for_internal_review");
      input.reasons.add("safe_summary_only");
      return "listed_ready_for_review";
    },
  },
  {
    matches: isApprovalListingReady,
    state: () => "listed_requires_approval",
  },
  {
    matches: isDryRunListingReady,
    state: (input) => {
      input.reasons.add("dry_run_only");
      input.reasons.add("safe_summary_only");
      return "listed_dry_run";
    },
  },
] as const;

export function evaluateLocalMcpToolVisibility(
  input: LocalMcpToolVisibilityPolicyInputV1,
): LocalMcpToolVisibilityDecisionV1 {
  assertPolicyInput(input);

  const context = buildDefaultLocalMcpToolVisibilityPolicyContext(input.context);
  const reasons = new Set<LocalMcpToolVisibilityReasonV1>(["default_hidden"]);
  const tool = context.registry.tools.find((candidate) => candidate.id === input.localToolId);
  const descriptor = context.descriptors.find((candidate) => candidate.localToolId === input.localToolId);
  const descriptorValid = isValidDescriptor(descriptor, reasons);
  const privacySafe = collectPrivacyReasons(context, reasons);
  collectCallReasons(context, reasons);
  const approvalReady = collectApprovalReasons(tool?.requiresApproval === true, context, reasons);
  const auditReady = collectAuditReasons(context, reasons);
  const handlerReady = collectHandlerReasons(context, reasons);
  const remoteReady = collectRemoteReasons(context, reasons);
  const state = determineLocalMcpVisibilityState({
    localToolId: input.localToolId,
    toolRequiresApproval: tool?.requiresApproval === true,
    toolFound: tool !== undefined,
    descriptorValid,
    privacySafe,
    approvalReady,
    auditReady,
    handlerReady,
    remoteReady,
    context,
    reasons,
  });

  return buildDecision(input.localToolId, descriptor, state, reasons);
}

export function listLocalMcpToolVisibilityDecisions(
  context?: Partial<LocalMcpToolVisibilityPolicyContextV1>,
): LocalMcpToolVisibilityListV1 {
  const completeContext = buildDefaultLocalMcpToolVisibilityPolicyContext(context);
  const decisions = completeContext.registry.toolIds.map((localToolId) =>
    evaluateLocalMcpToolVisibility({
      kind: "local_mcp_tool_visibility_policy_input",
      localToolId,
      context: completeContext,
      version: 1,
    }),
  );

  return {
    kind: "local_mcp_tool_visibility_list",
    decisions,
    version: 1,
  };
}

export function assertLocalMcpToolVisibilityDecision(
  decision: LocalMcpToolVisibilityDecisionV1,
): void {
  const record = asPlainRecord(decision, "Local MCP visibility decision must be an object");
  if (record.kind !== "local_mcp_tool_visibility_decision") {
    throw new TypeError("Local MCP visibility decision kind is invalid");
  }
  if (!isLocalMcpVisibilityState(record.state)) {
    throw new TypeError("Local MCP visibility decision state is invalid");
  }
  if (!isKnownLocalToolId(record.localToolId)) {
    throw new TypeError("Local MCP visibility decision localToolId is invalid");
  }
  if (record.projectedToolName !== undefined && !isNonEmptyString(record.projectedToolName)) {
    throw new TypeError("Local MCP visibility decision projectedToolName is invalid");
  }
  if (!Array.isArray(record.reasons) || !record.reasons.every(isLocalMcpVisibilityReason)) {
    throw new TypeError("Local MCP visibility decision reasons are invalid");
  }
  if (!areReasonsSorted(record.reasons)) {
    throw new TypeError("Local MCP visibility decision reasons must be sorted");
  }
  if (!isSafeSummary(record.safeSummary)) {
    throw new TypeError("Local MCP visibility decision safeSummary is unsafe");
  }
  if (record.version !== 1) {
    throw new TypeError("Local MCP visibility decision version must be 1");
  }
  assertLocalMcpPrivacySafeOutput(decision);
}

export function isLocalMcpToolVisibleToExternalSurface(
  decision: LocalMcpToolVisibilityDecisionV1,
): boolean {
  assertLocalMcpToolVisibilityDecision(decision);
  return (
    decision.state === "listed_disabled" ||
    decision.state === "listed_dry_run" ||
    decision.state === "listed_requires_approval" ||
    decision.state === "listed_ready_for_review"
  );
}

export function buildDefaultLocalMcpToolVisibilityPolicyContext(
  overrides: Partial<LocalMcpToolVisibilityPolicyContextV1> = {},
): LocalMcpToolVisibilityPolicyContextV1 {
  const registry = overrides.registry ?? buildLocalMcpToolRegistry();
  const projected = projectLocalMcpRegistryToMcpToolsList(registry);
  const context: LocalMcpToolVisibilityPolicyContextV1 = {
    kind: "local_mcp_tool_visibility_policy_context",
    registry,
    descriptors: overrides.descriptors ?? projected.tools,
    ...(overrides.callEnvelope !== undefined ? { callEnvelope: overrides.callEnvelope } : {}),
    ...(overrides.callValidation !== undefined ? { callValidation: overrides.callValidation } : {}),
    ...(overrides.approvalDecision !== undefined ? { approvalDecision: overrides.approvalDecision } : {}),
    ...(overrides.auditEvents !== undefined ? { auditEvents: [...overrides.auditEvents] } : {}),
    ...(overrides.handlerBoundary !== undefined ? { handlerBoundary: overrides.handlerBoundary } : {}),
    remoteTransportConfig:
      overrides.remoteTransportConfig ?? buildDisabledLocalMcpRemoteTransportConfig(),
    ...(overrides.remoteTransportPreflight !== undefined
      ? { remoteTransportPreflight: overrides.remoteTransportPreflight }
      : {}),
    ...(overrides.privacyCheck !== undefined ? { privacyCheck: overrides.privacyCheck } : {}),
    adminDisabledToolIds: [...(overrides.adminDisabledToolIds ?? [])].sort(compareStrings),
    allowDryRunListing: overrides.allowDryRunListing ?? false,
    allowDisabledListing: overrides.allowDisabledListing ?? false,
    allowRemoteListing: overrides.allowRemoteListing ?? false,
    privacyReviewComplete: overrides.privacyReviewComplete ?? false,
    version: 1,
  };

  return context;
}

export function sortLocalMcpToolVisibilityReasons(
  reasons: readonly LocalMcpToolVisibilityReasonV1[],
): readonly LocalMcpToolVisibilityReasonV1[] {
  return [...new Set(reasons)].sort(
    (a, b) => REASON_ORDER.indexOf(a) - REASON_ORDER.indexOf(b),
  );
}

function collectPrivacyReasons(
  context: LocalMcpToolVisibilityPolicyContextV1,
  reasons: Set<LocalMcpToolVisibilityReasonV1>,
): boolean {
  if (!context.privacyReviewComplete) {
    reasons.add("privacy_review_missing");
  }
  if (context.privacyCheck === undefined) {
    reasons.add("privacy_review_missing");
  }
  if (context.privacyCheck?.safe === false) {
    reasons.add("privacy_check_failed");
    reasons.add("privacy_fixture_failed");
  }
  return context.privacyReviewComplete && context.privacyCheck?.safe === true;
}

function collectCallReasons(
  context: LocalMcpToolVisibilityPolicyContextV1,
  reasons: Set<LocalMcpToolVisibilityReasonV1>,
): void {
  if (!context.callEnvelope) reasons.add("call_envelope_missing");
  if (!context.callValidation) {
    reasons.add("call_validation_missing");
    return;
  }
  if (!context.callValidation.valid) reasons.add("call_validation_failed");
}

function collectApprovalReasons(
  requiresApproval: boolean,
  context: LocalMcpToolVisibilityPolicyContextV1,
  reasons: Set<LocalMcpToolVisibilityReasonV1>,
): boolean {
  if (!requiresApproval) return true;
  reasons.add("approval_required");
  if (!context.approvalDecision) {
    reasons.add("approval_missing");
    return false;
  }
  if (context.approvalDecision.decision === "denied") {
    reasons.add("approval_denied");
    return false;
  }
  return context.approvalDecision.decision === "approved";
}

function collectAuditReasons(
  context: LocalMcpToolVisibilityPolicyContextV1,
  reasons: Set<LocalMcpToolVisibilityReasonV1>,
): boolean {
  if (!context.auditEvents || context.auditEvents.length === 0) {
    reasons.add("audit_missing");
    return false;
  }
  return true;
}

function collectHandlerReasons(
  context: LocalMcpToolVisibilityPolicyContextV1,
  reasons: Set<LocalMcpToolVisibilityReasonV1>,
): boolean {
  if (!context.handlerBoundary) {
    reasons.add("handler_boundary_missing");
    reasons.add("handler_unavailable");
    return false;
  }
  if (
    context.handlerBoundary.kind !== "local_mcp_handler_boundary" ||
    context.handlerBoundary.mode !== "future_real_handler_design_only"
  ) {
    reasons.add("handler_boundary_blocked");
    return false;
  }
  return true;
}

function collectRemoteReasons(
  context: LocalMcpToolVisibilityPolicyContextV1,
  reasons: Set<LocalMcpToolVisibilityReasonV1>,
): boolean {
  if (!context.allowRemoteListing) {
    reasons.add("remote_transport_not_allowed");
    if (context.remoteTransportConfig.mode === "disabled") reasons.add("transport_disabled");
    return true;
  }
  if (!context.remoteTransportPreflight) {
    reasons.add("transport_blocked");
    if (context.remoteTransportConfig.mode === "disabled") reasons.add("transport_disabled");
    return false;
  }
  if (context.remoteTransportPreflight.status === "blocked") {
    reasons.add("transport_blocked");
    if (context.remoteTransportPreflight.blockedReasons.includes("transport_disabled")) {
      reasons.add("transport_disabled");
    }
    return false;
  }
  return context.remoteTransportPreflight.status === "allowed_for_non_production_spike";
}

function determineLocalMcpVisibilityState(
  input: LocalMcpVisibilityStateInput,
): LocalMcpToolVisibilityStateV1 {
  const rule = VISIBILITY_STATE_RULES.find((candidate) => candidate.matches(input));
  return rule ? rule.state(input) : "hidden";
}

function isAdminDisabledInput(input: LocalMcpVisibilityStateInput): boolean {
  return input.context.adminDisabledToolIds.includes(input.localToolId);
}

function isPrivacyBlockedInput(input: LocalMcpVisibilityStateInput): boolean {
  if (input.context.privacyCheck?.safe === false) return true;
  return isListingRequested(input.context) && !input.privacySafe;
}

function addPrivacyBlockedReasons(
  context: LocalMcpToolVisibilityPolicyContextV1,
  reasons: Set<LocalMcpToolVisibilityReasonV1>,
): void {
  if (!context.privacyReviewComplete || context.privacyCheck === undefined) {
    reasons.add("privacy_review_missing");
  }
  if (context.privacyCheck?.safe === false) {
    reasons.add("privacy_check_failed");
    reasons.add("privacy_fixture_failed");
  }
}

function isListingRequested(context: LocalMcpToolVisibilityPolicyContextV1): boolean {
  return context.allowDryRunListing || context.allowDisabledListing || context.allowRemoteListing;
}

function isReadyForReview(input: LocalMcpVisibilityStateInput): boolean {
  return (
    input.descriptorValid &&
    input.privacySafe &&
    input.approvalReady &&
    input.auditReady &&
    input.handlerReady &&
    input.remoteReady &&
    input.context.privacyReviewComplete &&
    input.context.callEnvelope !== undefined &&
    isValidCallValidationForTool(input.context.callValidation, input.localToolId)
  );
}

function isApprovalListingReady(input: LocalMcpVisibilityStateInput): boolean {
  return (
    input.toolRequiresApproval &&
    isValidCallValidationForTool(input.context.callValidation, input.localToolId) &&
    input.context.approvalDecision === undefined &&
    input.auditReady &&
    input.handlerReady &&
    !input.context.allowRemoteListing
  );
}

function isDryRunListingReady(input: LocalMcpVisibilityStateInput): boolean {
  return (
    input.context.allowDryRunListing &&
    input.descriptorValid &&
    input.privacySafe &&
    input.context.privacyReviewComplete &&
    !input.context.allowRemoteListing
  );
}

function isValidDescriptor(
  descriptor: LocalMcpProjectedToolDescriptorV1 | undefined,
  reasons: Set<LocalMcpToolVisibilityReasonV1>,
): boolean {
  if (!descriptor) {
    reasons.add("descriptor_missing");
    return false;
  }
  try {
    assertLocalMcpProjectedToolDescriptor(descriptor);
    return true;
  } catch {
    reasons.add("descriptor_invalid");
    return false;
  }
}

function isValidCallValidationForTool(
  validation: LocalMcpCallValidationResultV1 | undefined,
  localToolId: LocalMcpToolIdV1,
): boolean {
  return validation?.valid === true && validation.localToolId === localToolId;
}

function buildDecision(
  localToolId: LocalMcpToolIdV1,
  descriptor: LocalMcpProjectedToolDescriptorV1 | undefined,
  state: LocalMcpToolVisibilityStateV1,
  reasons: Iterable<LocalMcpToolVisibilityReasonV1>,
): LocalMcpToolVisibilityDecisionV1 {
  const decision: LocalMcpToolVisibilityDecisionV1 = {
    kind: "local_mcp_tool_visibility_decision",
    localToolId,
    ...(descriptor ? { projectedToolName: descriptor.name } : {}),
    state,
    reasons: sortLocalMcpToolVisibilityReasons([...reasons]),
    safeSummary: SAFE_SUMMARIES[state],
    version: 1,
  };
  assertLocalMcpToolVisibilityDecision(decision);
  return decision;
}

function assertPolicyInput(input: LocalMcpToolVisibilityPolicyInputV1): void {
  const record = asPlainRecord(input, "Local MCP visibility policy input must be an object");
  if (record.kind !== "local_mcp_tool_visibility_policy_input") {
    throw new TypeError("Local MCP visibility policy input kind is invalid");
  }
  if (!isKnownLocalToolId(record.localToolId)) {
    throw new TypeError("Local MCP visibility policy input localToolId is invalid");
  }
  if (record.version !== 1) {
    throw new TypeError("Local MCP visibility policy input version must be 1");
  }
  asPlainRecord(record.context, "Local MCP visibility policy context must be an object");
}

function isLocalMcpVisibilityState(value: unknown): value is LocalMcpToolVisibilityStateV1 {
  return typeof value === "string" && VISIBILITY_STATE_ORDER.includes(value as LocalMcpToolVisibilityStateV1);
}

function isLocalMcpVisibilityReason(value: unknown): value is LocalMcpToolVisibilityReasonV1 {
  return typeof value === "string" && REASON_ORDER.includes(value as LocalMcpToolVisibilityReasonV1);
}

function areReasonsSorted(reasons: readonly LocalMcpToolVisibilityReasonV1[]): boolean {
  return reasons.every(
    (reason, index) => index === 0 || REASON_ORDER.indexOf(reasons[index - 1]) < REASON_ORDER.indexOf(reason),
  );
}

function isSafeSummary(value: unknown): value is string {
  if (!isNonEmptyString(value)) return false;
  const normalized = value.normalize("NFKC").toLowerCase();
  return !UNSAFE_SUMMARY_TERMS.some((term) => normalized.includes(term));
}

function isKnownLocalToolId(value: unknown): value is LocalMcpToolIdV1 {
  return (
    value === "local_mcp.application_package.summarize" ||
    value === "local_mcp.evidence_graph.summarize" ||
    value === "local_mcp.resume_variant_plan.summarize" ||
    value === "local_mcp.review_cockpit.summarize"
  );
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new TypeError(message);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) throw new TypeError(message);
  return value as Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function compareStrings(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
