import type {
  LocalMcpApprovalDecisionV1,
  LocalMcpAuditEventV1,
} from "./mcpApprovalAuditBoundary";
import {
  validateLocalMcpHandlerBoundary,
} from "./mcpHandlerBoundary";
import type { LocalMcpHandlerBoundaryV1 } from "./mcpHandlerBoundary";
import type { LocalMcpRemoteTransportPreflightResultV1 } from "./mcpRemoteTransportSpike";
import {
  assertLocalMcpApprovalUxCopyEntry,
  getLocalMcpApprovalUxCopy,
} from "./mcpApprovalUxCopyFixtures";
import type {
  LocalMcpApprovalUxCopyEntryV1,
  LocalMcpApprovalUxCopyKeyV1,
} from "./mcpApprovalUxCopyFixtures";
import {
  assertLocalMcpPrivacySafeOutput,
} from "./privacyRedactionFixtures";
import type { LocalMcpPrivacyRedactionCheckResultV1 } from "./privacyRedactionFixtures";
import {
  assertLocalMcpToolVisibilityDecision,
} from "./mcpToolVisibilityPolicy";
import type { LocalMcpToolVisibilityDecisionV1 } from "./mcpToolVisibilityPolicy";
import type { LocalMcpToolIdV1 } from "./schema";

export type LocalMcpPrivacyReviewGateStatusV1 =
  | "blocked"
  | "review_required"
  | "ready_for_internal_review";

export type LocalMcpPrivacyReviewGateReasonV1 =
  | "default_blocked"
  | "tool_not_visible"
  | "tool_visibility_blocked"
  | "privacy_review_missing"
  | "privacy_check_missing"
  | "privacy_check_failed"
  | "approval_missing"
  | "approval_denied"
  | "audit_missing"
  | "handler_boundary_missing"
  | "handler_boundary_not_ready"
  | "handler_unavailable"
  | "transport_missing"
  | "transport_disabled"
  | "transport_blocked"
  | "remote_not_allowed"
  | "copy_missing"
  | "copy_invalid"
  | "safe_summary_only"
  | "manual_review_required"
  | "all_design_gates_present";

export type LocalMcpApprovalUxCopyCatalogV1 =
  readonly LocalMcpApprovalUxCopyEntryV1[];

export type LocalMcpPrivacyReviewGateInputV1 = Readonly<{
  kind: "local_mcp_privacy_review_gate_input";
  localToolId: LocalMcpToolIdV1;
  visibilityDecision?: LocalMcpToolVisibilityDecisionV1;
  privacyReviewComplete?: boolean;
  privacyCheck?: LocalMcpPrivacyRedactionCheckResultV1;
  approvalDecision?: LocalMcpApprovalDecisionV1;
  auditEvents?: readonly LocalMcpAuditEventV1[];
  handlerBoundary?: LocalMcpHandlerBoundaryV1;
  remoteTransportPreflight?: LocalMcpRemoteTransportPreflightResultV1;
  copyCatalog?: LocalMcpApprovalUxCopyCatalogV1;
  requireRemoteReady?: boolean;
  requireApprovedApproval?: boolean;
  requireAudit?: boolean;
  requireHandlerBoundary?: boolean;
  requireTransportPreflight?: boolean;
  requireCopyValidation?: boolean;
  version: 1;
}>;

export type LocalMcpPrivacyReviewGateResultV1 = Readonly<{
  kind: "local_mcp_privacy_review_gate_result";
  localToolId: LocalMcpToolIdV1;
  status: LocalMcpPrivacyReviewGateStatusV1;
  reasons: readonly LocalMcpPrivacyReviewGateReasonV1[];
  copyKey: LocalMcpApprovalUxCopyKeyV1;
  userFacingCopy: string;
  safeSummary: string;
  version: 1;
}>;

export type LocalMcpPrivacyReviewGateListV1 = Readonly<{
  kind: "local_mcp_privacy_review_gate_list";
  results: readonly LocalMcpPrivacyReviewGateResultV1[];
  version: 1;
}>;

const REASON_ORDER: readonly LocalMcpPrivacyReviewGateReasonV1[] = [
  "default_blocked",
  "tool_not_visible",
  "tool_visibility_blocked",
  "privacy_review_missing",
  "privacy_check_missing",
  "privacy_check_failed",
  "approval_missing",
  "approval_denied",
  "audit_missing",
  "handler_boundary_missing",
  "handler_boundary_not_ready",
  "handler_unavailable",
  "transport_missing",
  "transport_disabled",
  "transport_blocked",
  "remote_not_allowed",
  "copy_missing",
  "copy_invalid",
  "safe_summary_only",
  "manual_review_required",
  "all_design_gates_present",
] as const;

const HARD_BLOCK_REASONS: readonly LocalMcpPrivacyReviewGateReasonV1[] = [
  "default_blocked",
  "tool_not_visible",
  "tool_visibility_blocked",
  "privacy_review_missing",
  "privacy_check_missing",
  "privacy_check_failed",
  "approval_denied",
  "audit_missing",
  "handler_boundary_missing",
  "handler_boundary_not_ready",
  "handler_unavailable",
  "transport_missing",
  "transport_disabled",
  "transport_blocked",
  "remote_not_allowed",
  "copy_invalid",
] as const;

const REVIEW_REQUIRED_REASONS: readonly LocalMcpPrivacyReviewGateReasonV1[] = [
  "approval_missing",
  "copy_missing",
  "manual_review_required",
] as const;

const REQUIRED_COPY_KEYS: readonly LocalMcpApprovalUxCopyKeyV1[] = [
  "approval_required",
  "denied",
  "review_first",
  "tool_disabled",
  "blocked_privacy",
  "handler_unavailable",
  "transport_disabled",
  "remote_blocked",
  "audit_boundary_required",
  "safe_summary_only",
] as const;

const ALLOWED_SAFE_SUMMARIES = [
  "Blocked. Review privacy.",
  "Approval required.",
  "Denied. Nothing ran.",
  "Audit unavailable. Tool blocked.",
  "No handler yet.",
  "Remote tools disabled.",
  "Ready for internal review. No handler executed.",
] as const;

const KNOWN_LOCAL_TOOL_IDS: readonly LocalMcpToolIdV1[] = [
  "local_mcp.application_package.summarize",
  "local_mcp.evidence_graph.summarize",
  "local_mcp.resume_variant_plan.summarize",
  "local_mcp.review_cockpit.summarize",
] as const;

const FORBIDDEN_RESULT_TEXT = [
  "ready_for_production",
  "ready_to_execute",
  "ready_for_chatgpt",
  "approved_for_remote",
  "safe_to_run",
  "raw arguments",
  "raw source",
  "sourcequote",
  "private facts",
  "never_use",
  "stack trace",
  "session id",
  "secret",
  "token",
] as const;

const VISIBILITY_STATE_REASONS: Readonly<
  Partial<
    Record<
      LocalMcpToolVisibilityDecisionV1["state"],
      readonly LocalMcpPrivacyReviewGateReasonV1[]
    >
  >
> = {
  hidden: ["tool_not_visible"],
  listed_disabled: ["tool_visibility_blocked"],
  blocked_by_privacy: ["tool_visibility_blocked"],
  disabled_by_admin: ["tool_visibility_blocked"],
  listed_dry_run: ["safe_summary_only"],
} as const;

const COPY_KEY_RULES: readonly Readonly<{
  reasons: readonly LocalMcpPrivacyReviewGateReasonV1[];
  copyKey: LocalMcpApprovalUxCopyKeyV1;
}>[] = [
  {
    reasons: [
      "privacy_check_failed",
      "privacy_check_missing",
      "privacy_review_missing",
      "default_blocked",
    ],
    copyKey: "blocked_privacy",
  },
  { reasons: ["approval_denied"], copyKey: "denied" },
  { reasons: ["approval_missing"], copyKey: "approval_required" },
  { reasons: ["audit_missing"], copyKey: "audit_boundary_required" },
  {
    reasons: [
      "handler_boundary_missing",
      "handler_boundary_not_ready",
      "handler_unavailable",
    ],
    copyKey: "handler_unavailable",
  },
  { reasons: ["transport_disabled"], copyKey: "transport_disabled" },
  {
    reasons: ["transport_missing", "transport_blocked", "remote_not_allowed"],
    copyKey: "remote_blocked",
  },
  { reasons: ["copy_missing", "copy_invalid"], copyKey: "stopped_safely" },
  { reasons: ["tool_not_visible", "tool_visibility_blocked"], copyKey: "tool_disabled" },
] as const;

const SAFE_SUMMARY_RULES: readonly Readonly<{
  reasons: readonly LocalMcpPrivacyReviewGateReasonV1[];
  summary: (typeof ALLOWED_SAFE_SUMMARIES)[number];
}>[] = [
  {
    reasons: [
      "privacy_check_failed",
      "privacy_check_missing",
      "privacy_review_missing",
      "default_blocked",
    ],
    summary: "Blocked. Review privacy.",
  },
  { reasons: ["approval_denied"], summary: "Denied. Nothing ran." },
  { reasons: ["approval_missing"], summary: "Approval required." },
  { reasons: ["audit_missing"], summary: "Audit unavailable. Tool blocked." },
  {
    reasons: [
      "handler_boundary_missing",
      "handler_boundary_not_ready",
      "handler_unavailable",
    ],
    summary: "No handler yet.",
  },
  {
    reasons: ["transport_missing", "transport_disabled", "transport_blocked", "remote_not_allowed"],
    summary: "Remote tools disabled.",
  },
] as const;

export function buildDefaultLocalMcpPrivacyReviewGateInput(
  localToolId: LocalMcpToolIdV1,
  overrides: Partial<LocalMcpPrivacyReviewGateInputV1> = {},
): LocalMcpPrivacyReviewGateInputV1 {
  const {
    kind: _kind,
    localToolId: _localToolId,
    version: _version,
    ...safeOverrides
  } = cloneInputOverrides(overrides);

  return {
    kind: "local_mcp_privacy_review_gate_input",
    localToolId,
    privacyReviewComplete: false,
    requireRemoteReady: false,
    requireApprovedApproval: true,
    requireAudit: true,
    requireHandlerBoundary: true,
    requireTransportPreflight: false,
    requireCopyValidation: true,
    ...safeOverrides,
    version: 1,
  };
}

export function evaluateLocalMcpPrivacyReviewGate(
  input: LocalMcpPrivacyReviewGateInputV1,
): LocalMcpPrivacyReviewGateResultV1 {
  assertGateInput(input);
  const normalized = buildDefaultLocalMcpPrivacyReviewGateInput(input.localToolId, input);
  const reasons = new Set<LocalMcpPrivacyReviewGateReasonV1>();

  if (isDefaultBlockedInput(normalized)) reasons.add("default_blocked");

  collectVisibilityReasons(normalized, reasons);
  collectPrivacyReasons(normalized, reasons);
  collectApprovalReasons(normalized, reasons);
  collectAuditReasons(normalized, reasons);
  collectHandlerReasons(normalized, reasons);
  collectTransportReasons(normalized, reasons);
  collectCopyReasons(normalized, reasons);
  collectReadyReasons(normalized, reasons);

  const sortedReasons = sortLocalMcpPrivacyReviewGateReasons([...reasons]);
  const status = determineGateStatus(sortedReasons);
  const copyKey = determineCopyKey(status, sortedReasons);
  const result: LocalMcpPrivacyReviewGateResultV1 = {
    kind: "local_mcp_privacy_review_gate_result",
    localToolId: normalized.localToolId,
    status,
    reasons: sortedReasons,
    copyKey,
    userFacingCopy: resolveGateCopyText(copyKey),
    safeSummary: buildSafeSummary(status, sortedReasons),
    version: 1,
  };

  assertLocalMcpPrivacyReviewGateResult(result);
  return cloneGateResult(result);
}

function resolveGateCopyText(copyKey: LocalMcpApprovalUxCopyKeyV1): string {
  // copyCatalog is an input contract check only; returned copy stays pinned to PR26 fixtures.
  return getLocalMcpApprovalUxCopy(copyKey).text;
}

export function listLocalMcpPrivacyReviewGateResults(
  inputs: readonly LocalMcpPrivacyReviewGateInputV1[],
): LocalMcpPrivacyReviewGateListV1 {
  const list: LocalMcpPrivacyReviewGateListV1 = {
    kind: "local_mcp_privacy_review_gate_list",
    results: inputs.map(evaluateLocalMcpPrivacyReviewGate),
    version: 1,
  };
  assertLocalMcpPrivacySafeOutput(list);
  return {
    kind: list.kind,
    results: list.results.map(cloneGateResult),
    version: 1,
  };
}

export function isLocalMcpPrivacyReviewGatePassedForInternalReview(
  result: LocalMcpPrivacyReviewGateResultV1,
): boolean {
  assertLocalMcpPrivacyReviewGateResult(result);
  return result.status === "ready_for_internal_review";
}

export function assertLocalMcpPrivacyReviewGateResult(
  result: LocalMcpPrivacyReviewGateResultV1,
): void {
  const record = asPlainRecord(result, "Local MCP privacy review gate result must be an object");
  if (record.kind !== "local_mcp_privacy_review_gate_result") {
    throw new TypeError("Local MCP privacy review gate result kind is invalid");
  }
  if (!isKnownLocalToolId(record.localToolId)) {
    throw new TypeError("Local MCP privacy review gate result localToolId is invalid");
  }
  if (!isGateStatus(record.status)) {
    throw new TypeError("Local MCP privacy review gate result status is invalid");
  }
  if (!Array.isArray(record.reasons) || !record.reasons.every(isGateReason)) {
    throw new TypeError("Local MCP privacy review gate result reasons are invalid");
  }
  if (!areReasonsSorted(record.reasons)) {
    throw new TypeError("Local MCP privacy review gate result reasons must be sorted");
  }
  if (!isApprovalUxCopyKey(record.copyKey)) {
    throw new TypeError("Local MCP privacy review gate result copyKey is invalid");
  }
  const copy = getLocalMcpApprovalUxCopy(record.copyKey);
  if (record.userFacingCopy !== copy.text) {
    throw new TypeError("Local MCP privacy review gate result copy text does not match PR26");
  }
  if (!isAllowedSafeSummary(record.safeSummary)) {
    throw new TypeError("Local MCP privacy review gate result safeSummary is invalid");
  }
  if (record.version !== 1) {
    throw new TypeError("Local MCP privacy review gate result version must be 1");
  }
  assertNoForbiddenResultText(result);
  assertLocalMcpPrivacySafeOutput(result);
}

export function sortLocalMcpPrivacyReviewGateReasons(
  reasons: readonly LocalMcpPrivacyReviewGateReasonV1[],
): readonly LocalMcpPrivacyReviewGateReasonV1[] {
  return [...new Set(reasons)].sort(
    (a, b) => REASON_ORDER.indexOf(a) - REASON_ORDER.indexOf(b),
  );
}

function collectVisibilityReasons(
  input: LocalMcpPrivacyReviewGateInputV1,
  reasons: Set<LocalMcpPrivacyReviewGateReasonV1>,
): void {
  if (!input.visibilityDecision) {
    reasons.add("tool_not_visible");
    return;
  }

  try {
    assertLocalMcpToolVisibilityDecision(input.visibilityDecision);
  } catch {
    reasons.add("tool_visibility_blocked");
    return;
  }

  if (input.visibilityDecision.localToolId !== input.localToolId) {
    reasons.add("tool_visibility_blocked");
    return;
  }

  addReasons(reasons, VISIBILITY_STATE_REASONS[input.visibilityDecision.state] ?? []);
}

function collectPrivacyReasons(
  input: LocalMcpPrivacyReviewGateInputV1,
  reasons: Set<LocalMcpPrivacyReviewGateReasonV1>,
): void {
  if (input.privacyReviewComplete !== true) reasons.add("privacy_review_missing");
  if (!input.privacyCheck) {
    reasons.add("privacy_check_missing");
    return;
  }
  if (input.privacyCheck.safe !== true) reasons.add("privacy_check_failed");
}

function collectApprovalReasons(
  input: LocalMcpPrivacyReviewGateInputV1,
  reasons: Set<LocalMcpPrivacyReviewGateReasonV1>,
): void {
  if (input.approvalDecision?.decision === "denied") {
    reasons.add("approval_denied");
    return;
  }

  if (input.requireApprovedApproval !== false && !input.approvalDecision) {
    reasons.add("approval_missing");
  }
}

function collectAuditReasons(
  input: LocalMcpPrivacyReviewGateInputV1,
  reasons: Set<LocalMcpPrivacyReviewGateReasonV1>,
): void {
  if (input.requireAudit === false) return;
  if (!input.auditEvents || input.auditEvents.length === 0) reasons.add("audit_missing");
}

function collectHandlerReasons(
  input: LocalMcpPrivacyReviewGateInputV1,
  reasons: Set<LocalMcpPrivacyReviewGateReasonV1>,
): void {
  if (input.requireHandlerBoundary === false) return;
  if (!input.handlerBoundary) {
    reasons.add("handler_boundary_missing");
    reasons.add("handler_unavailable");
    return;
  }

  const validation = validateLocalMcpHandlerBoundary(input.handlerBoundary);
  if (!validation.valid) reasons.add("handler_boundary_not_ready");
}

function collectTransportReasons(
  input: LocalMcpPrivacyReviewGateInputV1,
  reasons: Set<LocalMcpPrivacyReviewGateReasonV1>,
): void {
  const transportRequired =
    input.requireRemoteReady === true || input.requireTransportPreflight === true;
  if (!transportRequired) return;

  if (!input.remoteTransportPreflight) {
    reasons.add("transport_missing");
    return;
  }

  if (input.remoteTransportPreflight.status === "allowed_for_non_production_spike") {
    reasons.add("safe_summary_only");
    return;
  }

  if (input.remoteTransportPreflight.blockedReasons.includes("transport_disabled")) {
    reasons.add("transport_disabled");
    return;
  }

  reasons.add("transport_blocked");
}

function collectCopyReasons(
  input: LocalMcpPrivacyReviewGateInputV1,
  reasons: Set<LocalMcpPrivacyReviewGateReasonV1>,
): void {
  if (input.requireCopyValidation === false) return;
  if (!input.copyCatalog || input.copyCatalog.length === 0) {
    reasons.add("copy_missing");
    return;
  }

  try {
    const entriesByKey = new Map<LocalMcpApprovalUxCopyKeyV1, LocalMcpApprovalUxCopyEntryV1>();
    for (const entry of input.copyCatalog) {
      assertLocalMcpApprovalUxCopyEntry(entry);
      entriesByKey.set(entry.key, entry);
    }
    if (!REQUIRED_COPY_KEYS.every((key) => entriesByKey.has(key))) {
      reasons.add("copy_missing");
    }
  } catch {
    reasons.add("copy_invalid");
  }
}

function collectReadyReasons(
  input: LocalMcpPrivacyReviewGateInputV1,
  reasons: Set<LocalMcpPrivacyReviewGateReasonV1>,
): void {
  const sorted = sortLocalMcpPrivacyReviewGateReasons([...reasons]);
  if (hasAnyReason(sorted, HARD_BLOCK_REASONS) || hasAnyReason(sorted, REVIEW_REQUIRED_REASONS)) {
    return;
  }
  if (input.privacyCheck?.safe !== true) return;
  reasons.add("safe_summary_only");
  reasons.add("all_design_gates_present");
}

function determineGateStatus(
  reasons: readonly LocalMcpPrivacyReviewGateReasonV1[],
): LocalMcpPrivacyReviewGateStatusV1 {
  if (hasAnyReason(reasons, HARD_BLOCK_REASONS)) return "blocked";
  if (hasAnyReason(reasons, REVIEW_REQUIRED_REASONS)) return "review_required";
  if (reasons.includes("all_design_gates_present")) return "ready_for_internal_review";
  return "blocked";
}

function determineCopyKey(
  status: LocalMcpPrivacyReviewGateStatusV1,
  reasons: readonly LocalMcpPrivacyReviewGateReasonV1[],
): LocalMcpApprovalUxCopyKeyV1 {
  if (status === "ready_for_internal_review") return "review_first";
  const rule = COPY_KEY_RULES.find((candidate) => hasAnyReason(reasons, candidate.reasons));
  if (rule) return rule.copyKey;
  return "review_first";
}

function buildSafeSummary(
  status: LocalMcpPrivacyReviewGateStatusV1,
  reasons: readonly LocalMcpPrivacyReviewGateReasonV1[],
): string {
  if (status === "ready_for_internal_review") {
    return "Ready for internal review. No handler executed.";
  }
  const rule = SAFE_SUMMARY_RULES.find((candidate) => hasAnyReason(reasons, candidate.reasons));
  if (rule) return rule.summary;
  return "Blocked. Review privacy.";
}

function cloneGateResult(
  result: LocalMcpPrivacyReviewGateResultV1,
): LocalMcpPrivacyReviewGateResultV1 {
  return {
    ...result,
    reasons: [...result.reasons],
  };
}

function cloneInputOverrides(
  overrides: Partial<LocalMcpPrivacyReviewGateInputV1>,
): Partial<LocalMcpPrivacyReviewGateInputV1> {
  return {
    ...overrides,
    ...(overrides.auditEvents !== undefined ? { auditEvents: [...overrides.auditEvents] } : {}),
    ...(overrides.copyCatalog !== undefined ? { copyCatalog: [...overrides.copyCatalog] } : {}),
  };
}

function isDefaultBlockedInput(input: LocalMcpPrivacyReviewGateInputV1): boolean {
  return (
    input.visibilityDecision === undefined &&
    input.privacyReviewComplete !== true &&
    input.privacyCheck === undefined &&
    input.approvalDecision === undefined &&
    (!input.auditEvents || input.auditEvents.length === 0) &&
    input.handlerBoundary === undefined &&
    input.remoteTransportPreflight === undefined &&
    input.copyCatalog === undefined
  );
}

function assertGateInput(input: LocalMcpPrivacyReviewGateInputV1): void {
  const record = asPlainRecord(input, "Local MCP privacy review gate input must be an object");
  if (record.kind !== "local_mcp_privacy_review_gate_input") {
    throw new TypeError("Local MCP privacy review gate input kind is invalid");
  }
  if (!isKnownLocalToolId(record.localToolId)) {
    throw new TypeError("Local MCP privacy review gate input localToolId is invalid");
  }
  if (record.version !== 1) {
    throw new TypeError("Local MCP privacy review gate input version must be 1");
  }
}

function hasAnyReason(
  reasons: readonly LocalMcpPrivacyReviewGateReasonV1[],
  candidates: readonly LocalMcpPrivacyReviewGateReasonV1[],
): boolean {
  return candidates.some((reason) => reasons.includes(reason));
}

function addReasons(
  reasons: Set<LocalMcpPrivacyReviewGateReasonV1>,
  additions: readonly LocalMcpPrivacyReviewGateReasonV1[],
): void {
  additions.forEach((reason) => reasons.add(reason));
}

function isGateStatus(value: unknown): value is LocalMcpPrivacyReviewGateStatusV1 {
  return (
    value === "blocked" ||
    value === "review_required" ||
    value === "ready_for_internal_review"
  );
}

function isGateReason(value: unknown): value is LocalMcpPrivacyReviewGateReasonV1 {
  return typeof value === "string" && REASON_ORDER.includes(value as LocalMcpPrivacyReviewGateReasonV1);
}

function areReasonsSorted(reasons: readonly LocalMcpPrivacyReviewGateReasonV1[]): boolean {
  return reasons.every(
    (reason, index) =>
      index === 0 || REASON_ORDER.indexOf(reasons[index - 1]) < REASON_ORDER.indexOf(reason),
  );
}

function isApprovalUxCopyKey(value: unknown): value is LocalMcpApprovalUxCopyKeyV1 {
  if (typeof value !== "string") return false;
  try {
    getLocalMcpApprovalUxCopy(value as LocalMcpApprovalUxCopyKeyV1);
    return true;
  } catch {
    return false;
  }
}

function isAllowedSafeSummary(value: unknown): value is string {
  return (
    typeof value === "string" &&
    ALLOWED_SAFE_SUMMARIES.includes(value as (typeof ALLOWED_SAFE_SUMMARIES)[number])
  );
}

function assertNoForbiddenResultText(result: LocalMcpPrivacyReviewGateResultV1): void {
  const normalized = JSON.stringify(result).normalize("NFKC").toLowerCase();
  for (const term of FORBIDDEN_RESULT_TEXT) {
    if (normalized.includes(term)) {
      throw new TypeError("Local MCP privacy review gate result contains forbidden language");
    }
  }
}

function isKnownLocalToolId(value: unknown): value is LocalMcpToolIdV1 {
  return typeof value === "string" && KNOWN_LOCAL_TOOL_IDS.includes(value as LocalMcpToolIdV1);
}

function asPlainRecord(value: unknown, message: string): Record<string, unknown> {
  const candidate = value as Record<string, unknown> | null;
  const isObjectRecord =
    candidate !== null && typeof candidate === "object" && !Array.isArray(candidate);
  const prototype = isObjectRecord ? Object.getPrototypeOf(candidate) : undefined;
  if (!isObjectRecord || (prototype !== Object.prototype && prototype !== null)) {
    throw new TypeError(message);
  }
  return value as Record<string, unknown>;
}
