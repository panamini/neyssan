import type { LocalMcpCallErrorCodeV1 } from "./mcpCallEnvelope";
import type { LocalMcpRemoteTransportBlockReasonV1 } from "./mcpRemoteTransportSpike";
import type { LocalMcpToolVisibilityStateV1 } from "./mcpToolVisibilityPolicy";
import { assertLocalMcpPrivacySafeOutput } from "./privacyRedactionFixtures";
import type { LocalMcpPrivacyFixtureSetV1 } from "./privacyRedactionFixtures";

export type LocalMcpApprovalUxCopyToneV1 = "status" | "body" | "button" | "action";

export type LocalMcpApprovalUxCopyKeyV1 =
  | "invalid_request"
  | "tool_unavailable"
  | "check_inputs"
  | "sign_in_required"
  | "approval_required"
  | "review_first"
  | "approve_tool"
  | "deny"
  | "denied"
  | "approval_expired"
  | "tool_disabled"
  | "too_large_input"
  | "too_large_output"
  | "privacy_review_required"
  | "handler_unavailable"
  | "timed_out"
  | "rate_limited"
  | "stopped_safely"
  | "hidden"
  | "dry_run_only"
  | "blocked_privacy"
  | "transport_disabled"
  | "remote_blocked"
  | "origin_blocked"
  | "host_blocked"
  | "auth_required"
  | "session_expired"
  | "invalid_limit"
  | "handler_boundary_required"
  | "approval_boundary_required"
  | "audit_boundary_required"
  | "safe_summary_only";

export type LocalMcpApprovalUxCopyEntryV1 = Readonly<{
  key: LocalMcpApprovalUxCopyKeyV1;
  text: string;
  tone: LocalMcpApprovalUxCopyToneV1;
  maxWords: number;
  version: 1;
}>;

export type LocalMcpApprovalUxCopyFixtureOutputV1 = Readonly<{
  kind: "local_mcp_approval_ux_copy_fixture_output";
  key: LocalMcpApprovalUxCopyKeyV1;
  text: string;
  tone: LocalMcpApprovalUxCopyToneV1;
  version: 1;
}>;

export const LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1: readonly LocalMcpApprovalUxCopyKeyV1[] = [
  "invalid_request",
  "tool_unavailable",
  "check_inputs",
  "sign_in_required",
  "approval_required",
  "review_first",
  "approve_tool",
  "deny",
  "denied",
  "approval_expired",
  "tool_disabled",
  "too_large_input",
  "too_large_output",
  "privacy_review_required",
  "handler_unavailable",
  "timed_out",
  "rate_limited",
  "stopped_safely",
  "hidden",
  "dry_run_only",
  "blocked_privacy",
  "transport_disabled",
  "remote_blocked",
  "origin_blocked",
  "host_blocked",
  "auth_required",
  "session_expired",
  "invalid_limit",
  "handler_boundary_required",
  "approval_boundary_required",
  "audit_boundary_required",
  "safe_summary_only",
] as const;

export const LOCAL_MCP_CALL_ERROR_CODES_FOR_APPROVAL_UX_COPY_V1 = [
  "invalid_request",
  "unknown_tool",
  "invalid_tool_name",
  "invalid_arguments",
  "missing_user",
  "approval_required",
  "tool_not_allowlisted",
  "output_too_large",
  "privacy_filter_required",
  "handler_unavailable",
  "timeout",
  "rate_limited",
  "internal_error",
] as const satisfies readonly LocalMcpCallErrorCodeV1[];

export const LOCAL_MCP_REMOTE_TRANSPORT_BLOCK_REASONS_FOR_APPROVAL_UX_COPY_V1 = [
  "transport_disabled",
  "production_transport_not_allowed",
  "missing_origin",
  "origin_not_allowed",
  "missing_host",
  "host_not_allowed",
  "auth_required_before_remote",
  "missing_user",
  "missing_session",
  "invalid_request_size",
  "request_too_large",
  "invalid_response_size",
  "response_too_large",
  "invalid_timeout",
  "invalid_rate_limit",
  "handler_boundary_required",
  "approval_boundary_required",
  "audit_boundary_required",
] as const satisfies readonly LocalMcpRemoteTransportBlockReasonV1[];

export const LOCAL_MCP_TOOL_VISIBILITY_STATES_FOR_APPROVAL_UX_COPY_V1 = [
  "hidden",
  "listed_disabled",
  "listed_dry_run",
  "listed_requires_approval",
  "listed_ready_for_review",
  "blocked_by_privacy",
  "disabled_by_admin",
] as const satisfies readonly LocalMcpToolVisibilityStateV1[];

const COPY_CATALOG: Readonly<Record<LocalMcpApprovalUxCopyKeyV1, LocalMcpApprovalUxCopyEntryV1>> = {
  invalid_request: entry("invalid_request", "Request blocked.", "status", 2),
  tool_unavailable: entry("tool_unavailable", "Tool unavailable.", "status", 2),
  check_inputs: entry("check_inputs", "Check inputs.", "status", 2),
  sign_in_required: entry("sign_in_required", "Sign in required.", "status", 3),
  approval_required: entry("approval_required", "Approval required.", "status", 2),
  review_first: entry("review_first", "Review first. Nothing runs.", "body", 4),
  approve_tool: entry("approve_tool", "Approve this tool?", "action", 3),
  deny: entry("deny", "Deny", "button", 3),
  denied: entry("denied", "Denied. Nothing ran.", "status", 3),
  approval_expired: entry("approval_expired", "Approval expired. Try again.", "status", 4),
  tool_disabled: entry("tool_disabled", "Tool disabled.", "status", 2),
  too_large_input: entry("too_large_input", "Input too large.", "status", 3),
  too_large_output: entry("too_large_output", "Output too large.", "status", 3),
  privacy_review_required: entry(
    "privacy_review_required",
    "Privacy review required.",
    "status",
    3,
  ),
  handler_unavailable: entry("handler_unavailable", "No handler available.", "status", 3),
  timed_out: entry("timed_out", "Timed out. Try again.", "status", 4),
  rate_limited: entry("rate_limited", "Slow down. Try again.", "status", 4),
  stopped_safely: entry("stopped_safely", "Stopped safely.", "status", 2),
  hidden: entry("hidden", "Hidden.", "status", 1),
  dry_run_only: entry("dry_run_only", "Dry run only.", "status", 3),
  blocked_privacy: entry("blocked_privacy", "Blocked. Review privacy.", "status", 3),
  transport_disabled: entry("transport_disabled", "Transport disabled.", "status", 2),
  remote_blocked: entry("remote_blocked", "Remote blocked.", "status", 2),
  origin_blocked: entry("origin_blocked", "Origin blocked.", "status", 2),
  host_blocked: entry("host_blocked", "Host blocked.", "status", 2),
  auth_required: entry("auth_required", "Auth required.", "status", 2),
  session_expired: entry("session_expired", "Session expired.", "status", 2),
  invalid_limit: entry("invalid_limit", "Limit invalid.", "status", 2),
  handler_boundary_required: entry(
    "handler_boundary_required",
    "Handler boundary required.",
    "status",
    3,
  ),
  approval_boundary_required: entry(
    "approval_boundary_required",
    "Approval boundary required.",
    "status",
    3,
  ),
  audit_boundary_required: entry(
    "audit_boundary_required",
    "Audit boundary required.",
    "status",
    3,
  ),
  safe_summary_only: entry("safe_summary_only", "Safe summary only.", "status", 3),
} as const;

const CALL_ERROR_CODE_TO_COPY_KEY: Readonly<
  Record<LocalMcpCallErrorCodeV1, LocalMcpApprovalUxCopyKeyV1>
> = {
  invalid_request: "invalid_request",
  unknown_tool: "tool_unavailable",
  invalid_tool_name: "tool_unavailable",
  invalid_arguments: "check_inputs",
  missing_user: "sign_in_required",
  approval_required: "approval_required",
  tool_not_allowlisted: "tool_unavailable",
  output_too_large: "too_large_output",
  privacy_filter_required: "privacy_review_required",
  handler_unavailable: "handler_unavailable",
  timeout: "timed_out",
  rate_limited: "rate_limited",
  internal_error: "stopped_safely",
} as const;

const REMOTE_TRANSPORT_BLOCK_REASON_TO_COPY_KEY: Readonly<
  Record<LocalMcpRemoteTransportBlockReasonV1, LocalMcpApprovalUxCopyKeyV1>
> = {
  transport_disabled: "transport_disabled",
  production_transport_not_allowed: "remote_blocked",
  missing_origin: "origin_blocked",
  origin_not_allowed: "origin_blocked",
  missing_host: "host_blocked",
  host_not_allowed: "host_blocked",
  auth_required_before_remote: "auth_required",
  missing_user: "sign_in_required",
  missing_session: "session_expired",
  invalid_request_size: "invalid_limit",
  request_too_large: "too_large_input",
  invalid_response_size: "invalid_limit",
  response_too_large: "too_large_output",
  invalid_timeout: "invalid_limit",
  invalid_rate_limit: "invalid_limit",
  handler_boundary_required: "handler_boundary_required",
  approval_boundary_required: "approval_boundary_required",
  audit_boundary_required: "audit_boundary_required",
} as const;

const TOOL_VISIBILITY_STATE_TO_COPY_KEY: Readonly<
  Record<LocalMcpToolVisibilityStateV1, LocalMcpApprovalUxCopyKeyV1>
> = {
  hidden: "hidden",
  listed_disabled: "tool_disabled",
  listed_dry_run: "dry_run_only",
  listed_requires_approval: "approval_required",
  listed_ready_for_review: "review_first",
  blocked_by_privacy: "blocked_privacy",
  disabled_by_admin: "tool_disabled",
} as const;

const FORBIDDEN_COPY_PHRASES = [
  "raw payload",
  "raw arguments",
  "source quote",
  "stack trace",
  "private fact",
  "never use",
  "secret",
  "token",
  "prod",
  "production",
  "ready to send",
  "ready to apply",
  "ready to submit",
  "ready to export",
  "send",
  "submit",
  "apply",
  "export",
  "download",
] as const;

export function getLocalMcpApprovalUxCopy(
  key: LocalMcpApprovalUxCopyKeyV1,
): LocalMcpApprovalUxCopyEntryV1 {
  const copy = COPY_CATALOG[key];
  assertLocalMcpApprovalUxCopyEntry(copy);
  return copy;
}

export function localMcpCallErrorCodeToApprovalUxCopyKey(
  code: LocalMcpCallErrorCodeV1,
): LocalMcpApprovalUxCopyKeyV1 {
  return CALL_ERROR_CODE_TO_COPY_KEY[code];
}

export function localMcpRemoteTransportBlockReasonToApprovalUxCopyKey(
  reason: LocalMcpRemoteTransportBlockReasonV1,
): LocalMcpApprovalUxCopyKeyV1 {
  return REMOTE_TRANSPORT_BLOCK_REASON_TO_COPY_KEY[reason];
}

export function localMcpToolVisibilityStateToApprovalUxCopyKey(
  state: LocalMcpToolVisibilityStateV1,
): LocalMcpApprovalUxCopyKeyV1 {
  return TOOL_VISIBILITY_STATE_TO_COPY_KEY[state];
}

export function buildLocalMcpApprovalUxCopyFixtureOutput(
  key: LocalMcpApprovalUxCopyKeyV1,
  overrideCopy?: LocalMcpApprovalUxCopyEntryV1,
  fixtureSet?: LocalMcpPrivacyFixtureSetV1,
): LocalMcpApprovalUxCopyFixtureOutputV1 {
  const copy = overrideCopy ?? getLocalMcpApprovalUxCopy(key);
  if (copy.key !== key) throw new TypeError("Local MCP approval UX copy key mismatch");
  assertLocalMcpApprovalUxCopyEntry(copy, fixtureSet);

  const output: LocalMcpApprovalUxCopyFixtureOutputV1 = {
    kind: "local_mcp_approval_ux_copy_fixture_output",
    key: copy.key,
    text: copy.text,
    tone: copy.tone,
    version: 1,
  };
  assertLocalMcpPrivacySafeOutput(output, fixtureSet);
  return output;
}

export function buildLocalMcpApprovalUxCopyFixtureOutputs(
  fixtureSet?: LocalMcpPrivacyFixtureSetV1,
): readonly LocalMcpApprovalUxCopyFixtureOutputV1[] {
  return LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1.map((key) =>
    buildLocalMcpApprovalUxCopyFixtureOutput(key, undefined, fixtureSet),
  );
}

export function assertLocalMcpApprovalUxCopyEntry(
  copy: LocalMcpApprovalUxCopyEntryV1,
  fixtureSet?: LocalMcpPrivacyFixtureSetV1,
): void {
  if (!copy || typeof copy !== "object") throw new TypeError("Local MCP copy must be an object");
  if (!LOCAL_MCP_APPROVAL_UX_COPY_KEYS_V1.includes(copy.key)) {
    throw new TypeError("Local MCP copy key is unknown");
  }
  if (!isNonEmptyString(copy.text)) throw new TypeError("Local MCP copy text is required");
  if (!isCopyTone(copy.tone)) throw new TypeError("Local MCP copy tone is unknown");
  if (!Number.isInteger(copy.maxWords) || copy.maxWords <= 0) {
    throw new TypeError("Local MCP copy max words is invalid");
  }
  if (copy.tone === "button" && copy.maxWords !== 3) {
    throw new TypeError("Local MCP button copy max words must be 3");
  }
  if (copy.tone === "button" && copy.text.trim().endsWith(".")) {
    throw new TypeError("Local MCP button copy must not end with a period");
  }
  if (countWords(copy.text) > copy.maxWords) {
    throw new TypeError("Local MCP copy exceeds max words");
  }
  assertQuestionMark(copy);
  assertNoForbiddenCopyTerms(copy.text);
  assertLocalMcpPrivacySafeOutput(copy, fixtureSet);
}

export function countLocalMcpApprovalUxCopyWords(text: string): number {
  return countWords(text);
}

function entry(
  key: LocalMcpApprovalUxCopyKeyV1,
  text: string,
  tone: LocalMcpApprovalUxCopyToneV1,
  maxWords: number,
): LocalMcpApprovalUxCopyEntryV1 {
  return {
    key,
    text,
    tone,
    maxWords,
    version: 1,
  };
}

function assertQuestionMark(copy: LocalMcpApprovalUxCopyEntryV1): void {
  if (!copy.text.includes("?")) return;
  if (copy.key === "approve_tool" && copy.tone === "action" && copy.text === "Approve this tool?") {
    return;
  }
  throw new TypeError("Local MCP copy question marks are restricted to approve_tool");
}

function assertNoForbiddenCopyTerms(text: string): void {
  const normalized = text.normalize("NFKC").toLowerCase();
  if (/\braw\b/u.test(normalized)) {
    throw new TypeError("Local MCP copy must not expose raw payload markers");
  }
  for (const phrase of FORBIDDEN_COPY_PHRASES) {
    if (normalized.includes(phrase)) {
      throw new TypeError("Local MCP copy contains forbidden action or payload language");
    }
  }
}

function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/u)
    .filter((token) => token.length > 0).length;
}

function isCopyTone(value: unknown): value is LocalMcpApprovalUxCopyToneV1 {
  return value === "status" || value === "body" || value === "button" || value === "action";
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}
