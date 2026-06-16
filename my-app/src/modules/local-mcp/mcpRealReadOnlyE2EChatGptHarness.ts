import {
  projectMcpRealApplicationPackageSummary,
  type McpRealApplicationPackageSummaryResultV1,
} from "./mcpRealApplicationPackageSummary";
import {
  projectMcpRealEvidenceGraphSummary,
  type McpRealEvidenceGraphSummaryResultV1,
} from "./mcpRealEvidenceGraphSummary";
import {
  projectMcpRealResumeVariantPlanSummary,
  type McpRealResumeVariantPlanSummaryResultV1,
} from "./mcpRealResumeVariantPlanSummary";
import {
  projectMcpRealReviewCockpitSummary,
  type McpRealReviewCockpitSummaryResultV1,
} from "./mcpRealReviewCockpitSummary";
import {
  projectMcpReadOnlyTwoweeksDataAdapter,
  type McpReadOnlyTwoweeksDataAdapterBlockedReasonV1,
  type McpReadOnlyTwoweeksDataRefV1,
  type McpReadOnlyTwoweeksDataAdapterResultV1,
} from "./mcpReadOnlyTwoweeksDataAdapter";
import {
  buildLocalMcpRedactedAuditEntry,
  type LocalMcpRedactedAuditEntryV1,
  type LocalMcpRedactedAuditEventTypeV1,
  type LocalMcpRedactedAuditOutcomeV1,
} from "./mcpRedactedAuditLog";
import type { LocalMcpToolIdV1 } from "./schema";

export type McpRealReadOnlyE2EChatGptToolNameV1 =
  | "twoweeks.application_package.summarize"
  | "twoweeks.evidence_graph.summarize"
  | "twoweeks.resume_variant_plan.summarize"
  | "twoweeks.review_cockpit.summarize";

export type McpRealReadOnlyE2EChatGptBlockedReasonV1 =
  | McpReadOnlyTwoweeksDataAdapterBlockedReasonV1
  | "unknown_tool"
  | "unsafe_request_arguments"
  | "write_action_refused"
  | "summary_blocked";

export type McpRealReadOnlyE2EChatGptHarnessCapabilitiesV1 = Readonly<{
  auth: "blocked" | "production_stytch_verified";
  accountLink: "blocked" | "server_only_owner_resolved";
  consent: "blocked" | "future_real_data_read";
  audit: "not_evaluated" | "redacted_boundary_checked";
  retention: "blocked" | "boundary_checked";
  dataReads: "blocked" | "convex_read_only_refs" | "convex_read_only_refs_and_safe_summaries";
  dataWrites: "blocked";
  handlerExecution: "blocked";
  productionConnector: "blocked";
  networkAccess: "blocked";
  modelCalls: "blocked";
  writeActions: "blocked";
  rawDataProjection: "blocked";
  credentialStorage: "none";
  tokenStorage: "none";
  runtimeWiring: "blocked";
  version: 1;
}>;

export type McpRealReadOnlyE2EChatGptSafeRefusalV1 = Readonly<{
  code: "real_read_only_e2e_chatgpt_harness_blocked";
  message: "Refused. Real read-only E2E ChatGPT harness blocked.";
  safeForModel: true;
  rawDataExposed: false;
  credentialsExposed: false;
  ownerIdentityExposed: false;
  writeActionExecuted: false;
  version: 1;
}>;

export type McpRealReadOnlyE2EChatGptSafeSummaryResultV1 =
  | McpRealApplicationPackageSummaryResultV1
  | McpRealEvidenceGraphSummaryResultV1
  | McpRealResumeVariantPlanSummaryResultV1
  | McpRealReviewCockpitSummaryResultV1;

export type McpRealReadOnlyE2EChatGptHarnessResultV1 = Readonly<
  | {
      kind: "mcp_real_read_only_e2e_chatgpt_harness_result";
      allowed: true;
      reason: "safe_summary_projected";
      toolName: McpRealReadOnlyE2EChatGptToolNameV1;
      summary: Extract<McpRealReadOnlyE2EChatGptSafeSummaryResultV1, { allowed: true }>;
      adapterAudit: Extract<McpReadOnlyTwoweeksDataAdapterResultV1, { allowed: true }>["audit"];
      auditLog: readonly LocalMcpRedactedAuditEntryV1[];
      capabilities: McpRealReadOnlyE2EChatGptHarnessCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
  | {
      kind: "mcp_real_read_only_e2e_chatgpt_harness_result";
      allowed: false;
      reason: McpRealReadOnlyE2EChatGptBlockedReasonV1;
      safeRefusal: McpRealReadOnlyE2EChatGptSafeRefusalV1;
      auditLog: readonly LocalMcpRedactedAuditEntryV1[];
      capabilities: McpRealReadOnlyE2EChatGptHarnessCapabilitiesV1;
      modelVisible: true;
      version: 1;
    }
>;

type ParsedHarnessInput = Readonly<{
  request: ParsedRequest;
  authBoundary: unknown;
  accountLinkBoundary: unknown;
  accountLinkResolution: unknown;
  consent?: unknown;
  retentionRecord: unknown;
  readOnlyDataRefs: unknown;
  summaries: Record<string, unknown>;
  now: Date;
}>;

type ParsedRequest = Readonly<{
  toolName: McpRealReadOnlyE2EChatGptToolNameV1;
  arguments: Record<string, unknown>;
}>;

type ToolRefKey =
  | "applicationPackageRef"
  | "evidenceGraphRef"
  | "resumeVariantPlanRef"
  | "reviewCockpitRef";

type RequestValidation =
  | Readonly<{ ok: true }>
  | Readonly<{ ok: false; reason: "unsafe_request_arguments" | "write_action_refused" }>;

type SummaryProjection =
  | Readonly<{ ok: true; summary: Extract<McpRealReadOnlyE2EChatGptSafeSummaryResultV1, { allowed: true }> }>
  | Readonly<{ ok: false; rawSummary: unknown }>;

const INPUT_KEYS = [
  "kind",
  "request",
  "authBoundary",
  "accountLinkBoundary",
  "accountLinkResolution",
  "consent",
  "retentionRecord",
  "readOnlyDataRefs",
  "summaries",
  "now",
  "version",
] as const;

const INPUT_REQUIRED_KEYS = [
  "kind",
  "request",
  "authBoundary",
  "accountLinkBoundary",
  "accountLinkResolution",
  "retentionRecord",
  "readOnlyDataRefs",
  "summaries",
  "version",
] as const;

const REQUEST_KEYS = ["kind", "toolName", "arguments", "version"] as const;
const SUMMARY_KEYS = [
  "applicationPackageSummary",
  "evidenceGraphSummary",
  "resumeVariantPlanSummary",
  "reviewCockpitSummary",
] as const;

const TOOL_CONFIGS: Record<
  McpRealReadOnlyE2EChatGptToolNameV1,
  Readonly<{
    argumentName: string;
    refKey: ToolRefKey;
    argumentValue: string;
    localToolId: LocalMcpToolIdV1;
  }>
> = {
  "twoweeks.application_package.summarize": {
    argumentName: "applicationPackageRef",
    refKey: "applicationPackageRef",
    argumentValue: "mcp-safe-ref:application-package:latest",
    localToolId: "local_mcp.application_package.summarize",
  },
  "twoweeks.evidence_graph.summarize": {
    argumentName: "evidenceGraphRef",
    refKey: "evidenceGraphRef",
    argumentValue: "mcp-safe-ref:evidence-graph:profile",
    localToolId: "local_mcp.evidence_graph.summarize",
  },
  "twoweeks.resume_variant_plan.summarize": {
    argumentName: "resumeVariantPlanRef",
    refKey: "resumeVariantPlanRef",
    argumentValue: "mcp-safe-ref:resume-variant-plan:latest",
    localToolId: "local_mcp.resume_variant_plan.summarize",
  },
  "twoweeks.review_cockpit.summarize": {
    argumentName: "reviewCockpitRef",
    refKey: "reviewCockpitRef",
    argumentValue: "mcp-safe-ref:review-cockpit:latest",
    localToolId: "local_mcp.review_cockpit.summarize",
  },
} as const;

const WRITE_ACTION_TEXT_PATTERN =
  /\b(?:apply|delete|download|edit|export|mutate|publish|remove|send|submit|update|upload|write)\b/uim;

const UNSAFE_REQUEST_KEY_PATTERN =
  /(?:authorization|credential|debug|email|private|raw|secret|session|shadow|sourceText|sourceQuote|token|userId|_id)/uim;

const UNSAFE_REQUEST_VALUE_PATTERN =
  /(?:bearer\s+\S+|private[_ -]?fact|raw[_ -]?arguments|secret[_ -]?token|source[_ -]?quote|source[_ -]?text)/uim;

export function runMcpRealReadOnlyE2EChatGptHarness(
  input: unknown,
): McpRealReadOnlyE2EChatGptHarnessResultV1 {
  const parsedInput = parseHarnessInput(input);
  if (!parsedInput) {
    return deny({
      reason: "invalid_input",
      eventType: "tool_call_refused",
      outcome: "invalid",
      occurredAt: new Date(0).toISOString(),
      rawPayload: input,
    });
  }

  const requestValidation = validateRequest(parsedInput.request);
  if (!requestValidation.ok) {
    return deny({
      reason: requestValidation.reason,
      eventType:
        requestValidation.reason === "write_action_refused"
          ? "write_action_refused"
          : "tool_call_refused",
      outcome: requestValidation.reason === "write_action_refused" ? "refused" : "blocked",
      occurredAt: parsedInput.now.toISOString(),
      request: parsedInput.request,
      rawPayload: parsedInput.request.arguments,
    });
  }

  const adapterResult = projectMcpReadOnlyTwoweeksDataAdapter({
    kind: "mcp_read_only_twoweeks_data_adapter_input",
    authBoundary: parsedInput.authBoundary,
    accountLinkBoundary: parsedInput.accountLinkBoundary,
    accountLinkResolution: parsedInput.accountLinkResolution,
    ...(parsedInput.consent !== undefined ? { consent: parsedInput.consent } : {}),
    retentionRecord: parsedInput.retentionRecord,
    readOnlyDataRefs: parsedInput.readOnlyDataRefs,
    now: parsedInput.now,
    version: 1,
  });

  if (!adapterResult.allowed) {
    return deny({
      reason: adapterResult.reason,
      eventType: adapterResult.reason === "auth_required" ? "auth_boundary_refused" : "tool_call_refused",
      outcome: "refused",
      occurredAt: parsedInput.now.toISOString(),
      request: parsedInput.request,
      rawPayload: parsedInput.request.arguments,
    });
  }

  const summaryProjection = projectRequestedSummary(
    parsedInput.request.toolName,
    buildToolScopedAdapterResult(parsedInput.request.toolName, adapterResult),
    parsedInput.summaries,
  );
  if (!summaryProjection.ok) {
    return deny({
      reason: "summary_blocked",
      eventType: "tool_call_refused",
      outcome: "blocked",
      occurredAt: parsedInput.now.toISOString(),
      request: parsedInput.request,
      rawPayload: summaryProjection.rawSummary,
      capabilities: buildHarnessCapabilities("refs_only"),
    });
  }

  return {
    kind: "mcp_real_read_only_e2e_chatgpt_harness_result",
    allowed: true,
    reason: "safe_summary_projected",
    toolName: parsedInput.request.toolName,
    summary: summaryProjection.summary,
    adapterAudit: adapterResult.audit,
    auditLog: [
      buildHarnessAuditEntry({
        eventType: "consent_boundary_checked",
        outcome: "boundary_only",
        occurredAt: parsedInput.now.toISOString(),
        request: parsedInput.request,
        rawPayload: parsedInput.request.arguments,
        consentBoundarySatisfied: true,
      }),
    ],
    capabilities: buildHarnessCapabilities("summary"),
    modelVisible: true,
    version: 1,
  };
}

export function buildMcpRealReadOnlyE2EChatGptSafeRefusal(): McpRealReadOnlyE2EChatGptSafeRefusalV1 {
  return {
    code: "real_read_only_e2e_chatgpt_harness_blocked",
    message: "Refused. Real read-only E2E ChatGPT harness blocked.",
    safeForModel: true,
    rawDataExposed: false,
    credentialsExposed: false,
    ownerIdentityExposed: false,
    writeActionExecuted: false,
    version: 1,
  };
}

function parseHarnessInput(value: unknown): ParsedHarnessInput | undefined {
  const record = readRecord(value, INPUT_KEYS, INPUT_REQUIRED_KEYS);
  if (!record) return undefined;
  if (record.kind !== "mcp_real_read_only_e2e_chatgpt_harness_input" || record.version !== 1) {
    return undefined;
  }
  const request = parseRequest(record.request);
  const summaries = readRecord(record.summaries, SUMMARY_KEYS, SUMMARY_KEYS);
  const now = record.now === undefined ? new Date() : readDate(record.now);
  if (!request || !summaries || !now) return undefined;

  return {
    request,
    authBoundary: record.authBoundary,
    accountLinkBoundary: record.accountLinkBoundary,
    accountLinkResolution: record.accountLinkResolution,
    ...(record.consent !== undefined ? { consent: record.consent } : {}),
    retentionRecord: record.retentionRecord,
    readOnlyDataRefs: record.readOnlyDataRefs,
    summaries,
    now,
  };
}

function parseRequest(value: unknown): ParsedRequest | undefined {
  const record = readRecord(value, REQUEST_KEYS, REQUEST_KEYS);
  if (!record) return undefined;
  if (record.kind !== "mcp_real_read_only_e2e_chatgpt_request" || record.version !== 1) {
    return undefined;
  }
  if (!isToolName(record.toolName)) return undefined;
  const args = readPlainObjectRecord(record.arguments);
  if (!args) return undefined;
  return {
    toolName: record.toolName,
    arguments: args,
  };
}

function validateRequest(request: ParsedRequest): RequestValidation {
  if (containsWriteActionIntent(request.toolName) || containsWriteActionIntent(request.arguments)) {
    return { ok: false, reason: "write_action_refused" };
  }
  if (containsUnsafeRequestMaterial(request.arguments)) {
    return { ok: false, reason: "unsafe_request_arguments" };
  }
  const toolConfig = TOOL_CONFIGS[request.toolName];
  const keys = Object.keys(request.arguments);
  if (keys.length !== 1 || keys[0] !== toolConfig.argumentName) {
    return { ok: false, reason: "unsafe_request_arguments" };
  }
  return request.arguments[toolConfig.argumentName] === toolConfig.argumentValue
    ? { ok: true }
    : { ok: false, reason: "unsafe_request_arguments" };
}

function projectRequestedSummary(
  toolName: McpRealReadOnlyE2EChatGptToolNameV1,
  adapterResult: Extract<McpReadOnlyTwoweeksDataAdapterResultV1, { allowed: true }>,
  summaries: Record<string, unknown>,
): SummaryProjection {
  switch (toolName) {
    case "twoweeks.application_package.summarize": {
      const summary = projectMcpRealApplicationPackageSummary({
        kind: "mcp_real_application_package_summary_input",
        adapterResult,
        applicationPackageSummary: summaries.applicationPackageSummary,
        version: 1,
      });
      return summary.allowed ? { ok: true, summary } : { ok: false, rawSummary: summaries.applicationPackageSummary };
    }
    case "twoweeks.evidence_graph.summarize": {
      const summary = projectMcpRealEvidenceGraphSummary({
        kind: "mcp_real_evidence_graph_summary_input",
        adapterResult,
        evidenceGraphSummary: summaries.evidenceGraphSummary,
        version: 1,
      });
      return summary.allowed ? { ok: true, summary } : { ok: false, rawSummary: summaries.evidenceGraphSummary };
    }
    case "twoweeks.resume_variant_plan.summarize": {
      const summary = projectMcpRealResumeVariantPlanSummary({
        kind: "mcp_real_resume_variant_plan_summary_input",
        adapterResult,
        resumeVariantPlanSummary: summaries.resumeVariantPlanSummary,
        version: 1,
      });
      return summary.allowed ? { ok: true, summary } : { ok: false, rawSummary: summaries.resumeVariantPlanSummary };
    }
    case "twoweeks.review_cockpit.summarize": {
      const summary = projectMcpRealReviewCockpitSummary({
        kind: "mcp_real_review_cockpit_summary_input",
        adapterResult,
        reviewCockpitSummary: summaries.reviewCockpitSummary,
        version: 1,
      });
      return summary.allowed ? { ok: true, summary } : { ok: false, rawSummary: summaries.reviewCockpitSummary };
    }
  }
}

function buildToolScopedAdapterResult(
  toolName: McpRealReadOnlyE2EChatGptToolNameV1,
  adapterResult: Extract<McpReadOnlyTwoweeksDataAdapterResultV1, { allowed: true }>,
): Extract<McpReadOnlyTwoweeksDataAdapterResultV1, { allowed: true }> {
  const refKey = TOOL_CONFIGS[toolName].refKey;
  const ref = adapterResult.refs[refKey];
  return {
    ...adapterResult,
    refs: ref ? { [refKey]: ref } : {},
    availabilitySummary: summarizeScopedRef(ref),
  };
}

function summarizeScopedRef(ref: McpReadOnlyTwoweeksDataRefV1 | undefined) {
  return {
    available: ref?.status === "available" ? 1 : 0,
    noData: ref?.status === "no_data_available" ? 1 : 0,
    onboarding: ref?.status === "onboarding_required" ? 1 : 0,
    blocked: ref?.status === "blocked" ? 1 : 0,
    version: 1 as const,
  };
}

function deny(input: {
  reason: McpRealReadOnlyE2EChatGptBlockedReasonV1;
  eventType: LocalMcpRedactedAuditEventTypeV1;
  outcome: LocalMcpRedactedAuditOutcomeV1;
  occurredAt: string;
  request?: ParsedRequest;
  rawPayload?: unknown;
  capabilities?: McpRealReadOnlyE2EChatGptHarnessCapabilitiesV1;
}): McpRealReadOnlyE2EChatGptHarnessResultV1 {
  return {
    kind: "mcp_real_read_only_e2e_chatgpt_harness_result",
    allowed: false,
    reason: input.reason,
    safeRefusal: buildMcpRealReadOnlyE2EChatGptSafeRefusal(),
    auditLog: [
      buildHarnessAuditEntry({
        eventType: input.eventType,
        outcome: input.outcome,
        occurredAt: input.occurredAt,
        request: input.request,
        rawPayload: input.rawPayload,
      }),
    ],
    capabilities: input.capabilities ?? buildHarnessCapabilities("blocked"),
    modelVisible: true,
    version: 1,
  };
}

function buildHarnessAuditEntry(input: {
  eventType: LocalMcpRedactedAuditEventTypeV1;
  outcome: LocalMcpRedactedAuditOutcomeV1;
  occurredAt: string;
  request?: ParsedRequest;
  rawPayload?: unknown;
  consentBoundarySatisfied?: boolean;
}): LocalMcpRedactedAuditEntryV1 {
  return buildLocalMcpRedactedAuditEntry({
    eventId: `redacted-audit:pr64:${input.eventType}`,
    eventType: input.eventType,
    occurredAt: input.occurredAt,
    outcome: input.outcome,
    ...(input.request ? { toolName: input.request.toolName } : {}),
    ...(input.request ? { localToolId: TOOL_CONFIGS[input.request.toolName].localToolId } : {}),
    safeSummary: "Read-only local MCP boundary event recorded. No product action executed.",
    consentBoundarySatisfied: input.consentBoundarySatisfied === true,
    rawPayload: input.rawPayload,
  });
}

function buildHarnessCapabilities(
  phase: "blocked" | "refs_only" | "summary",
): McpRealReadOnlyE2EChatGptHarnessCapabilitiesV1 {
  const boundaryPassed = phase !== "blocked";
  return {
    auth: boundaryPassed ? "production_stytch_verified" : "blocked",
    accountLink: boundaryPassed ? "server_only_owner_resolved" : "blocked",
    consent: boundaryPassed ? "future_real_data_read" : "blocked",
    audit: phase === "blocked" ? "not_evaluated" : "redacted_boundary_checked",
    retention: boundaryPassed ? "boundary_checked" : "blocked",
    dataReads:
      phase === "summary"
        ? "convex_read_only_refs_and_safe_summaries"
        : phase === "refs_only"
          ? "convex_read_only_refs"
          : "blocked",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    networkAccess: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    rawDataProjection: "blocked",
    credentialStorage: "none",
    tokenStorage: "none",
    runtimeWiring: "blocked",
    version: 1,
  };
}

function isToolName(value: unknown): value is McpRealReadOnlyE2EChatGptToolNameV1 {
  return (
    value === "twoweeks.application_package.summarize" ||
    value === "twoweeks.evidence_graph.summarize" ||
    value === "twoweeks.resume_variant_plan.summarize" ||
    value === "twoweeks.review_cockpit.summarize"
  );
}

function containsWriteActionIntent(value: unknown): boolean {
  return visitRequestMaterial(value, (text) => WRITE_ACTION_TEXT_PATTERN.test(text));
}

function containsUnsafeRequestMaterial(value: unknown): boolean {
  return visitRequestMaterial(
    value,
    (text, isKey) =>
      (isKey && UNSAFE_REQUEST_KEY_PATTERN.test(text)) || UNSAFE_REQUEST_VALUE_PATTERN.test(text),
  );
}

function visitRequestMaterial(
  value: unknown,
  predicate: (text: string, isKey: boolean) => boolean,
): boolean {
  return visitRequestMaterialInner(value, predicate, new WeakSet<object>());
}

function visitRequestMaterialInner(
  value: unknown,
  predicate: (text: string, isKey: boolean) => boolean,
  seen: WeakSet<object>,
): boolean {
  if (typeof value === "string") return predicate(value, false);
  if (value === null || typeof value !== "object") return false;
  if (seen.has(value)) return true;
  seen.add(value);

  if (Array.isArray(value)) {
    return value.some((item) => visitRequestMaterialInner(item, predicate, seen));
  }
  const record = readPlainObjectRecord(value);
  if (!record) return true;
  return Object.keys(record).some(
    (key) => predicate(key, true) || visitRequestMaterialInner(record[key], predicate, seen),
  );
}

function readRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[],
): Record<string, unknown> | undefined {
  const record = readPlainObjectRecord(value);
  if (!record) return undefined;
  const actualKeys = Reflect.ownKeys(record);
  if (!actualKeys.every((key) => typeof key === "string" && allowedKeys.includes(key))) {
    return undefined;
  }
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))
    ? record
    : undefined;
}

function readPlainObjectRecord(value: unknown): Record<string, unknown> | undefined {
  const descriptors = readPlainObjectDescriptors(value);
  if (!descriptors) return undefined;
  const record: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string") return undefined;
    const descriptor = descriptors[key];
    if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) return undefined;
    record[key] = descriptor.value;
  }
  return record;
}

function readPlainObjectDescriptors(
  value: unknown,
): Record<PropertyKey, PropertyDescriptor | undefined> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    return Object.getOwnPropertyDescriptors(value) as Record<
      PropertyKey,
      PropertyDescriptor | undefined
    >;
  } catch {
    return undefined;
  }
}

function readDate(value: unknown): Date | undefined {
  return value instanceof Date ? value : undefined;
}
