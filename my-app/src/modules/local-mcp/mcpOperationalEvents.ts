import {
  assertMcpOperationalErrorCategory,
  type McpOperationalErrorCategoryV1,
} from "./mcpOperationalErrorTaxonomy";

const MCP_OPERATIONAL_EVENT_CAPABILITIES = [
  "local_mcp",
  "manual_handoff",
  "answer_copy",
  "live_external_action",
  "account_link",
  "outbound_egress",
  "write_action",
  "config_status",
] as const;

const MCP_OPERATIONAL_EVENT_ACTIONS = [
  "authenticate",
  "resolve_account_link",
  "validate_consent",
  "prepare_manual_handoff",
  "confirm_manual_handoff",
  "load_delivery_content",
  "record_file_download",
  "record_destination_open",
  "report_manual_outcome",
  "block_answer_copy",
  "evaluate_egress",
  "reserve_external_action",
  "dispatch_external_action",
  "finalize_external_action",
  "evaluate_write_action",
  "read_config_status",
] as const;

const MCP_OPERATIONAL_EVENT_OUTCOMES = [
  "allowed",
  "refused",
  "blocked",
  "rate_limited",
  "budget_exhausted",
  "failed_closed",
] as const;

const MCP_OPERATIONAL_EVENT_FEATURE_STATES = [
  "enabled",
  "disabled",
  "blocked",
  "configured",
  "misconfigured",
  "unknown",
] as const;

const MCP_OPERATIONAL_EVENT_SEVERITIES = [
  "info",
  "warning",
  "error",
  "critical",
] as const;

const MCP_OPERATIONAL_INCIDENT_SIGNALS = [
  "privacy_guard_failure",
  "sensitive_payload_rejected",
  "cross_owner_mismatch",
  "quota_bypass",
  "impossible_state",
  "unexpected_live_dispatch",
  "unknown_external_result_after_dispatch",
  "kill_switch_enabled_without_prereqs",
  "unsafe_egress_allowed",
  "generic_metrics_sensitive_payload",
] as const;

export type McpOperationalEventCapabilityV1 =
  (typeof MCP_OPERATIONAL_EVENT_CAPABILITIES)[number];
export type McpOperationalEventActionV1 =
  (typeof MCP_OPERATIONAL_EVENT_ACTIONS)[number];
export type McpOperationalEventOutcomeV1 =
  (typeof MCP_OPERATIONAL_EVENT_OUTCOMES)[number];
export type McpOperationalEventFeatureStateV1 =
  (typeof MCP_OPERATIONAL_EVENT_FEATURE_STATES)[number];
export type McpOperationalEventSeverityV1 =
  (typeof MCP_OPERATIONAL_EVENT_SEVERITIES)[number];
export type McpOperationalIncidentSignalV1 =
  (typeof MCP_OPERATIONAL_INCIDENT_SIGNALS)[number];

export type McpOperationalIncidentClassificationV1 = {
  kind: "mcp_operational_incident_classification";
  isIncident: boolean;
  signal?: McpOperationalIncidentSignalV1;
  response: "none" | "operator_review";
  version: 1;
};

export type McpOperationalEventV1 = {
  kind: "mcp_operational_event";
  capability: McpOperationalEventCapabilityV1;
  action: McpOperationalEventActionV1;
  category: McpOperationalErrorCategoryV1;
  outcome: McpOperationalEventOutcomeV1;
  featureState: McpOperationalEventFeatureStateV1;
  severity: McpOperationalEventSeverityV1;
  timeBucket?: string;
  incident: McpOperationalIncidentClassificationV1;
  version: 1;
};

const ALLOWED_EVENT_INPUT_KEYS = new Set([
  "capability",
  "action",
  "category",
  "outcome",
  "featureState",
  "severity",
  "timeBucket",
  "incidentSignal",
  "version",
]);

const TIME_BUCKET_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:00Z$/u;
const URL_OR_PATH_WITH_SECRET_RE = /https?:\/\/\S+|[?#][A-Za-z0-9_=&%.-]+/iu;
const JWT_RE = /\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/u;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/iu;
const LONG_SECRET_RE = /\b(?:[a-f0-9]{40,}|[A-Za-z0-9_-]{48,})\b/u;
const IDENTIFIER_RE =
  /\b(?:clerk|stytch|provider|owner|user|job|package|handoff|mcpAccountLinks)[_:.-][A-Za-z0-9._:-]{4,}\b/iu;
const FORBIDDEN_KEY_RE =
  /(?:metadata|labels|raw|args|payload|error|err|stack|user|owner|clerk|stytch|providerSubject|accountLinkId|handoffId|jobId|packageId|email|phone|ipAddress|session|cookie|token|authorization|jwt|claims|jwks|secret|credential|url|query|fragment|source|artifact|answer|receipt|hash|digest)/iu;
const FORBIDDEN_VALUE_RE =
  /\b(?:bearer|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|authorization|cookie|session|credential|private_fact|never_use|do_not_expose|raw\s*(?:cv|resume|job|source)|job description|source quote|generated artifact|answer text|cover letter text|file bytes|provider receipt)\b/iu;
const FORBIDDEN_STRING_PATTERNS = [
  URL_OR_PATH_WITH_SECRET_RE,
  JWT_RE,
  EMAIL_RE,
  LONG_SECRET_RE,
  IDENTIFIER_RE,
  FORBIDDEN_VALUE_RE,
] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function assertStringLiteral<T extends readonly string[]>(
  value: unknown,
  allowed: T,
  label: string,
): asserts value is T[number] {
  if (typeof value !== "string" || !allowed.includes(value)) {
    throw new Error(`Invalid MCP operational ${label}`);
  }
}

function assertNoForbiddenOperationalString(value: string): void {
  if (FORBIDDEN_STRING_PATTERNS.some((pattern) => pattern.test(value))) {
    throw new Error("Unsafe MCP operational event material");
  }
}

function assertNoForbiddenOperationalRecord(
  value: Record<string, unknown>,
): void {
  for (const [key, nestedValue] of Object.entries(value)) {
    if (FORBIDDEN_KEY_RE.test(key)) {
      throw new Error("Unsafe MCP operational event field");
    }
    assertNoForbiddenOperationalMaterial(nestedValue);
  }
}

function assertNoForbiddenOperationalMaterial(value: unknown): void {
  if (typeof value === "string") {
    assertNoForbiddenOperationalString(value);
  } else if (Array.isArray(value)) {
    value.forEach(assertNoForbiddenOperationalMaterial);
  } else if (isPlainRecord(value)) {
    assertNoForbiddenOperationalRecord(value);
  }
}

function assertExactEventInput(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    if (!ALLOWED_EVENT_INPUT_KEYS.has(key)) {
      throw new Error("Invalid MCP operational event field");
    }
  }
}

function assertTimeBucket(value: unknown): asserts value is string {
  if (typeof value !== "string" || !TIME_BUCKET_RE.test(value)) {
    throw new Error("Invalid MCP operational time bucket");
  }
}

function assertIncidentSignal(
  value: unknown,
): asserts value is McpOperationalIncidentSignalV1 {
  assertStringLiteral(value, MCP_OPERATIONAL_INCIDENT_SIGNALS, "incident signal");
}

const INCIDENT_SIGNAL_ALLOWED_CATEGORIES: Readonly<
  Record<McpOperationalIncidentSignalV1, readonly McpOperationalErrorCategoryV1[]>
> = {
  privacy_guard_failure: ["privacy_blocked"],
  sensitive_payload_rejected: ["privacy_blocked"],
  cross_owner_mismatch: ["ownership_mismatch"],
  quota_bypass: ["rate_limited", "budget_exhausted"],
  impossible_state: ["internal_validation_error", "operation_conflict"],
  unexpected_live_dispatch: ["external_action_disabled"],
  unknown_external_result_after_dispatch: ["unknown_external_result"],
  kill_switch_enabled_without_prereqs: ["feature_disabled", "config_invalid"],
  unsafe_egress_allowed: ["privacy_blocked", "destination_invalid"],
  generic_metrics_sensitive_payload: ["privacy_blocked"],
};

export function classifyMcpOperationalIncident(input: {
  category: McpOperationalErrorCategoryV1;
  incidentSignal?: McpOperationalIncidentSignalV1;
}): McpOperationalIncidentClassificationV1 {
  if (!input.incidentSignal) {
    return {
      kind: "mcp_operational_incident_classification",
      isIncident: false,
      response: "none",
      version: 1,
    };
  }

  const allowedCategories =
    INCIDENT_SIGNAL_ALLOWED_CATEGORIES[input.incidentSignal];
  if (!allowedCategories.includes(input.category)) {
    throw new Error("Invalid MCP operational incident category");
  }

  return {
    kind: "mcp_operational_incident_classification",
    isIncident: true,
    signal: input.incidentSignal,
    response: "operator_review",
    version: 1,
  };
}

export function buildMcpOperationalEvent(
  input: unknown,
): McpOperationalEventV1 {
  if (!isPlainRecord(input)) {
    throw new Error("Invalid MCP operational event input");
  }

  assertExactEventInput(input);
  assertNoForbiddenOperationalMaterial(input);

  assertStringLiteral(
    input.capability,
    MCP_OPERATIONAL_EVENT_CAPABILITIES,
    "capability",
  );
  assertStringLiteral(input.action, MCP_OPERATIONAL_EVENT_ACTIONS, "action");
  assertMcpOperationalErrorCategory(input.category);
  assertStringLiteral(input.outcome, MCP_OPERATIONAL_EVENT_OUTCOMES, "outcome");
  assertStringLiteral(
    input.featureState,
    MCP_OPERATIONAL_EVENT_FEATURE_STATES,
    "feature state",
  );
  assertStringLiteral(
    input.severity,
    MCP_OPERATIONAL_EVENT_SEVERITIES,
    "severity",
  );

  if (input.version !== undefined && input.version !== 1) {
    throw new Error("Invalid MCP operational event version");
  }

  let timeBucket: string | undefined;
  if (input.timeBucket !== undefined) {
    assertTimeBucket(input.timeBucket);
    timeBucket = input.timeBucket;
  }

  let incidentSignal: McpOperationalIncidentSignalV1 | undefined;
  if (input.incidentSignal !== undefined) {
    assertIncidentSignal(input.incidentSignal);
    incidentSignal = input.incidentSignal;
  }

  const incident = classifyMcpOperationalIncident({
    category: input.category,
    incidentSignal,
  });

  return {
    kind: "mcp_operational_event",
    capability: input.capability,
    action: input.action,
    category: input.category,
    outcome: input.outcome,
    featureState: input.featureState,
    severity: input.severity,
    ...(timeBucket ? { timeBucket } : {}),
    incident,
    version: 1,
  };
}
