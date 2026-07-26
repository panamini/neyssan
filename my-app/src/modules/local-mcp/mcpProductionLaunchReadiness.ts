import type { McpProductionPrivateBetaGateDecisionV1 } from "./mcpProductionPrivateBetaGate";

export const MCP_PRODUCTION_PUBLIC_CATALOG_SUBMISSION_URL = "https://mcp.twoweeks.ai/mcp";
export const MCP_PRODUCTION_LAUNCH_READINESS_PUBLIC_LAUNCH_REQUESTED_FLAG =
  "MCP_OAUTH_PRODUCTION_PUBLIC_LAUNCH_REQUESTED";
export const MCP_PRODUCTION_LAUNCH_READINESS_PUBLIC_CATALOG_SUBMISSION_URL_REVIEWED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_PUBLIC_CATALOG_SUBMISSION_URL_REVIEWED";
export const MCP_PRODUCTION_LAUNCH_READINESS_PRIVATE_BETA_GATE_REVIEWED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_PRIVATE_BETA_GATE_REVIEWED";
export const MCP_PRODUCTION_LAUNCH_READINESS_AUTHENTICATED_PROTOCOL_REVIEWED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_AUTHENTICATED_PROTOCOL_REVIEWED";
export const MCP_PRODUCTION_LAUNCH_READINESS_POLICY_KERNEL_REVIEWED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_POLICY_KERNEL_REVIEWED";
export const MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_LIST_METADATA_REVIEWED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_TOOLS_LIST_METADATA_REVIEWED";
export const MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_READ_ONLY_REVIEWED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_TOOLS_CALL_READ_ONLY_REVIEWED";
export const MCP_PRODUCTION_LAUNCH_READINESS_TOOLS_CALL_SYNTHETIC_METADATA_CLEANUP_REVIEWED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_TOOLS_CALL_SYNTHETIC_METADATA_CLEANUP_REVIEWED";
export const MCP_PRODUCTION_LAUNCH_READINESS_SCHEMA_MATCHER_REVIEWED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_SCHEMA_MATCHER_REVIEWED";
export const MCP_PRODUCTION_LAUNCH_READINESS_READONLY_SUMMARY_EXECUTION_REVIEWED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_READONLY_SUMMARY_EXECUTION_REVIEWED";
export const MCP_PRODUCTION_LAUNCH_READINESS_READONLY_SUMMARY_STATUS_REVIEWED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_READONLY_SUMMARY_STATUS_REVIEWED";
export const MCP_PRODUCTION_LAUNCH_READINESS_PROVIDER_WRITE_EXPANSION_BLOCKED_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_PROVIDER_WRITE_EXPANSION_BLOCKED";
export const MCP_PRODUCTION_LAUNCH_READINESS_UNRESOLVED_BLOCKING_FINDINGS_FLAG =
  "MCP_OAUTH_PRODUCTION_LAUNCH_UNRESOLVED_BLOCKING_FINDINGS";

export type McpProductionLaunchReadinessEvidenceInputV1 = Readonly<{
  publicCatalogSubmissionUrlReviewed?: boolean;
  privateBetaGateReviewed?: boolean;
  authenticatedMcpProtocolReviewed?: boolean;
  policyKernelReviewed?: boolean;
  toolsListMetadataReviewed?: boolean;
  toolsCallReadOnlyReviewed?: boolean;
  toolsCallSyntheticMetadataCleanupReviewed?: boolean;
  schemaMatcherReviewed?: boolean;
  readonlySummaryExecutionReviewed?: boolean;
  readonlySummaryStatusReviewed?: boolean;
  providerWriteExpansionBlocked?: boolean;
  unresolvedBlockingFindings?: boolean;
  version?: 1;
}>;

export type McpProductionLaunchReadinessConfigInputV1 = Readonly<{
  publicLaunchRequested?: boolean;
  evidence?: McpProductionLaunchReadinessEvidenceInputV1;
  version?: 1;
}>;

export type McpProductionLaunchReadinessDecisionCodeV1 =
  | "private_beta_not_ready"
  | "private_beta_ready_public_launch_blocked"
  | "launch_config_missing"
  | "launch_config_invalid"
  | "launch_evidence_missing"
  | "public_launch_blocked";

export type McpProductionLaunchReadinessDecisionV1 = Readonly<{
  kind: "mcp_production_launch_readiness_decision";
  privateBetaAccessAllowed: boolean;
  privateBetaGateCode: McpProductionPrivateBetaGateDecisionV1["code"];
  publicLaunchAllowed: false;
  publicLaunchBlocked: true;
  code: McpProductionLaunchReadinessDecisionCodeV1;
  safeForModel: true;
  inputEchoed: false;
  configEchoed: false;
  evidenceEchoed: false;
  methodPolicyDecision: false;
  responseConstructed: false;
  toolValidation: false;
  schemaValidation: false;
  providerCalled: false;
  storageWritten: false;
  version: 1;
}>;

type ParsedLaunchReadinessConfig = Readonly<{
  publicLaunchRequested: boolean;
  evidenceComplete: boolean;
}>;

const LAUNCH_READINESS_CONFIG_KEYS = new Set([
  "publicLaunchRequested",
  "evidence",
  "version",
]);
const LAUNCH_READINESS_EVIDENCE_KEYS = new Set([
  "publicCatalogSubmissionUrlReviewed",
  "privateBetaGateReviewed",
  "authenticatedMcpProtocolReviewed",
  "policyKernelReviewed",
  "toolsListMetadataReviewed",
  "toolsCallReadOnlyReviewed",
  "toolsCallSyntheticMetadataCleanupReviewed",
  "schemaMatcherReviewed",
  "readonlySummaryExecutionReviewed",
  "readonlySummaryStatusReviewed",
  "providerWriteExpansionBlocked",
  "unresolvedBlockingFindings",
  "version",
]);

export function evaluateMcpProductionLaunchReadiness(input: Readonly<{
  privateBetaDecision: McpProductionPrivateBetaGateDecisionV1;
  config?: unknown;
}>): McpProductionLaunchReadinessDecisionV1 {
  if (!isPrivateBetaAllowedDecision(input.privateBetaDecision)) {
    return decision("private_beta_not_ready", false, input.privateBetaDecision.code);
  }

  const config = readLaunchReadinessConfig(input.config);
  if (!config.ok) return decision(config.code, true, input.privateBetaDecision.code);
  if (config.config.publicLaunchRequested) {
    return decision("public_launch_blocked", true, input.privateBetaDecision.code);
  }
  if (!config.config.evidenceComplete) {
    return decision("launch_evidence_missing", true, input.privateBetaDecision.code);
  }
  return decision("private_beta_ready_public_launch_blocked", true, input.privateBetaDecision.code);
}

function readLaunchReadinessConfig(value: unknown):
  | {
      ok: true;
      config: ParsedLaunchReadinessConfig;
    }
  | {
      ok: false;
      code: "launch_config_missing" | "launch_config_invalid";
    } {
  if (value === undefined) return { ok: false, code: "launch_config_missing" };
  if (!isPlainRecord(value)) return { ok: false, code: "launch_config_invalid" };
  if (hasUnknownKeys(value, LAUNCH_READINESS_CONFIG_KEYS)) {
    return { ok: false, code: "launch_config_invalid" };
  }
  if (value.version !== undefined && value.version !== 1) {
    return { ok: false, code: "launch_config_invalid" };
  }
  if (
    value.publicLaunchRequested !== undefined &&
    typeof value.publicLaunchRequested !== "boolean"
  ) {
    return { ok: false, code: "launch_config_invalid" };
  }
  if (value.evidence !== undefined && !isLaunchReadinessEvidence(value.evidence)) {
    return { ok: false, code: "launch_config_invalid" };
  }
  return {
    ok: true,
    config: Object.freeze({
      publicLaunchRequested: value.publicLaunchRequested === true,
      evidenceComplete: isCompleteLaunchReadinessEvidence(value.evidence),
    }),
  };
}

function isLaunchReadinessEvidence(value: unknown): value is McpProductionLaunchReadinessEvidenceInputV1 {
  return (
    isPlainRecord(value) &&
    !hasUnknownKeys(value, LAUNCH_READINESS_EVIDENCE_KEYS) &&
    (value.version === undefined || value.version === 1) &&
    optionalBoolean(value.publicCatalogSubmissionUrlReviewed) &&
    optionalBoolean(value.privateBetaGateReviewed) &&
    optionalBoolean(value.authenticatedMcpProtocolReviewed) &&
    optionalBoolean(value.policyKernelReviewed) &&
    optionalBoolean(value.toolsListMetadataReviewed) &&
    optionalBoolean(value.toolsCallReadOnlyReviewed) &&
    optionalBoolean(value.toolsCallSyntheticMetadataCleanupReviewed) &&
    optionalBoolean(value.schemaMatcherReviewed) &&
    optionalBoolean(value.readonlySummaryExecutionReviewed) &&
    optionalBoolean(value.readonlySummaryStatusReviewed) &&
    optionalBoolean(value.providerWriteExpansionBlocked) &&
    optionalBoolean(value.unresolvedBlockingFindings)
  );
}

function isCompleteLaunchReadinessEvidence(value: unknown): boolean {
  return (
    isLaunchReadinessEvidence(value) &&
    value.publicCatalogSubmissionUrlReviewed === true &&
    value.privateBetaGateReviewed === true &&
    value.authenticatedMcpProtocolReviewed === true &&
    value.policyKernelReviewed === true &&
    value.toolsListMetadataReviewed === true &&
    value.toolsCallReadOnlyReviewed === true &&
    value.schemaMatcherReviewed === true &&
    value.readonlySummaryExecutionReviewed === true &&
    value.readonlySummaryStatusReviewed === true &&
    value.providerWriteExpansionBlocked === true &&
    value.unresolvedBlockingFindings === false
  );
}

function isPrivateBetaAllowedDecision(value: McpProductionPrivateBetaGateDecisionV1): boolean {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_production_private_beta_gate_decision" &&
    value.allowed === true &&
    value.code === "private_beta_allowed" &&
    value.methodPolicyDecision === false &&
    value.responseConstructed === false &&
    value.version === 1
  );
}

function decision(
  code: McpProductionLaunchReadinessDecisionCodeV1,
  privateBetaAccessAllowed: boolean,
  privateBetaGateCode: McpProductionPrivateBetaGateDecisionV1["code"],
): McpProductionLaunchReadinessDecisionV1 {
  return Object.freeze({
    kind: "mcp_production_launch_readiness_decision",
    privateBetaAccessAllowed,
    privateBetaGateCode,
    publicLaunchAllowed: false,
    publicLaunchBlocked: true,
    code,
    safeForModel: true,
    inputEchoed: false,
    configEchoed: false,
    evidenceEchoed: false,
    methodPolicyDecision: false,
    responseConstructed: false,
    toolValidation: false,
    schemaValidation: false,
    providerCalled: false,
    storageWritten: false,
    version: 1,
  });
}

function optionalBoolean(value: unknown): boolean {
  return value === undefined || value === true || value === false;
}

function hasUnknownKeys(value: Record<string, unknown>, allowedKeys: ReadonlySet<string>): boolean {
  return Object.keys(value).some((key) => !allowedKeys.has(key));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === null || prototype.constructor === Object;
}
