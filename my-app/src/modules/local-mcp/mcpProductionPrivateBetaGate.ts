import type { McpAuthenticatedProtocolEnvelopeV1 } from "./mcpAuthenticatedProtocolEnvelope";

export const MCP_PRODUCTION_PRIVATE_BETA_ENABLED_FLAG =
  "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_ENABLED";
export const MCP_PRODUCTION_PRIVATE_BETA_CLIENT_IDS_VAR =
  "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_CLIENT_IDS";
export const MCP_PRODUCTION_PRIVATE_BETA_RESOURCES_VAR =
  "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_RESOURCES";
export const MCP_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS_VAR =
  "MCP_OAUTH_PRODUCTION_PRIVATE_BETA_SUBJECT_DIGESTS";
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/u;
const SHA256_HEX_PATTERN = /^[0-9a-f]{64}$/u;

export type McpProductionPrivateBetaGateConfigInputV1 = Readonly<{
  enabled?: boolean;
  allowedClientIds?: readonly string[];
  allowedResources?: readonly string[];
  allowedSubjectDigests?: readonly string[];
  version?: 1;
}>;

export type McpProductionPrivateBetaGateDecisionCodeV1 =
  | "private_beta_allowed"
  | "private_beta_missing_config"
  | "private_beta_disabled"
  | "private_beta_malformed_config"
  | "private_beta_empty_allowlist"
  | "private_beta_ambiguous_eligibility"
  | "private_beta_client_not_allowed"
  | "private_beta_resource_not_allowed"
  | "private_beta_subject_not_allowed";

export type McpProductionPrivateBetaGateDecisionV1 = Readonly<{
  kind: "mcp_production_private_beta_gate_decision";
  allowed: boolean;
  code: McpProductionPrivateBetaGateDecisionCodeV1;
  safeForModel: true;
  inputEchoed: false;
  configEchoed: false;
  methodPolicyDecision: false;
  responseConstructed: false;
  version: 1;
}>;

export function evaluateMcpProductionPrivateBetaGate(input: Readonly<{
  envelope: McpAuthenticatedProtocolEnvelopeV1;
  verifiedSubjectDigest?: string;
  config?: unknown;
}>): McpProductionPrivateBetaGateDecisionV1 {
  const config = readPrivateBetaConfig(input.config);
  if (!config.ok) return denied(config.code);
  if (!config.config.enabled) return denied("private_beta_disabled");
  if (!isSafeEligibilityEnvelope(input.envelope)) {
    return denied("private_beta_ambiguous_eligibility");
  }
  if (!config.config.allowedClientIds.includes(input.envelope.verifiedClientId)) {
    return denied("private_beta_client_not_allowed");
  }
  if (!config.config.allowedResources.includes(input.envelope.verifiedResource)) {
    return denied("private_beta_resource_not_allowed");
  }
  if (!isSha256Hex(input.verifiedSubjectDigest)) {
    return denied("private_beta_ambiguous_eligibility");
  }
  if (!config.config.allowedSubjectDigests.includes(input.verifiedSubjectDigest)) {
    return denied("private_beta_subject_not_allowed");
  }
  return Object.freeze({
    kind: "mcp_production_private_beta_gate_decision",
    allowed: true,
    code: "private_beta_allowed",
    safeForModel: true,
    inputEchoed: false,
    configEchoed: false,
    methodPolicyDecision: false,
    responseConstructed: false,
    version: 1,
  });
}

function readPrivateBetaConfig(value: unknown):
  | {
      ok: true;
      config: Readonly<{
        enabled: boolean;
        allowedClientIds: readonly string[];
        allowedResources: readonly string[];
        allowedSubjectDigests: readonly string[];
      }>;
    }
  | {
      ok: false;
      code: Exclude<
        McpProductionPrivateBetaGateDecisionCodeV1,
        | "private_beta_allowed"
        | "private_beta_client_not_allowed"
        | "private_beta_resource_not_allowed"
        | "private_beta_subject_not_allowed"
        | "private_beta_ambiguous_eligibility"
      >;
    } {
  if (value === undefined) return { ok: false, code: "private_beta_missing_config" };
  if (!isPlainRecord(value)) return { ok: false, code: "private_beta_malformed_config" };
  const enabled = readEnabledFlag(value.enabled);
  if (enabled === undefined) return { ok: false, code: "private_beta_malformed_config" };
  if (!enabled) return disabledPrivateBetaConfig();
  return readEnabledPrivateBetaConfig(value);
}

function readEnabledFlag(value: unknown): boolean | undefined {
  return value === true || value === false ? value : undefined;
}

function disabledPrivateBetaConfig(): {
  ok: true;
  config: Readonly<{
    enabled: false;
    allowedClientIds: readonly string[];
    allowedResources: readonly string[];
    allowedSubjectDigests: readonly string[];
  }>;
} {
  return {
    ok: true,
    config: Object.freeze({
      enabled: false,
      allowedClientIds: Object.freeze([]),
      allowedResources: Object.freeze([]),
      allowedSubjectDigests: Object.freeze([]),
    }),
  };
}

function readEnabledPrivateBetaConfig(value: Record<string, unknown>):
  | {
      ok: true;
      config: Readonly<{
        enabled: true;
        allowedClientIds: readonly string[];
        allowedResources: readonly string[];
        allowedSubjectDigests: readonly string[];
      }>;
    }
  | {
      ok: false;
      code: "private_beta_malformed_config" | "private_beta_empty_allowlist";
    } {
  const requiredAllowlists = readRequiredPrivateBetaAllowlists(value);
  if (!requiredAllowlists.ok) return requiredAllowlists;
  const subjectAllowlist = readRequiredSubjectDigestAllowlist(value);
  if (!subjectAllowlist.ok) return subjectAllowlist;
  return {
    ok: true,
    config: Object.freeze({
      enabled: true,
      allowedClientIds: requiredAllowlists.allowedClientIds,
      allowedResources: requiredAllowlists.allowedResources,
      allowedSubjectDigests: subjectAllowlist.allowedSubjectDigests,
    }),
  };
}

function readRequiredPrivateBetaAllowlists(value: Record<string, unknown>):
  | {
      ok: true;
      allowedClientIds: readonly string[];
      allowedResources: readonly string[];
    }
  | {
      ok: false;
      code: "private_beta_malformed_config" | "private_beta_empty_allowlist";
    } {
  const allowedClientIds = readSafeIdentifierList(value.allowedClientIds);
  const allowedResources = readSafeIdentifierList(value.allowedResources);
  if (allowedClientIds === undefined || allowedResources === undefined) {
    return { ok: false, code: "private_beta_malformed_config" };
  }
  if (allowedClientIds.length === 0 || allowedResources.length === 0) {
    return { ok: false, code: "private_beta_empty_allowlist" };
  }
  return {
    ok: true,
    allowedClientIds,
    allowedResources,
  };
}

function readRequiredSubjectDigestAllowlist(value: Record<string, unknown>):
  | {
      ok: true;
      allowedSubjectDigests: readonly string[];
    }
  | {
      ok: false;
      code: "private_beta_malformed_config" | "private_beta_empty_allowlist";
    } {
  const allowedSubjectDigests = readSha256HexList(value.allowedSubjectDigests);
  if (allowedSubjectDigests === undefined) {
    return { ok: false, code: "private_beta_malformed_config" };
  }
  if (allowedSubjectDigests.length === 0) {
    return { ok: false, code: "private_beta_empty_allowlist" };
  }
  return { ok: true, allowedSubjectDigests };
}

function denied(
  code: Exclude<McpProductionPrivateBetaGateDecisionCodeV1, "private_beta_allowed">,
): McpProductionPrivateBetaGateDecisionV1 {
  return Object.freeze({
    kind: "mcp_production_private_beta_gate_decision",
    allowed: false,
    code,
    safeForModel: true,
    inputEchoed: false,
    configEchoed: false,
    methodPolicyDecision: false,
    responseConstructed: false,
    version: 1,
  });
}

function isSafeEligibilityEnvelope(value: McpAuthenticatedProtocolEnvelopeV1): boolean {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_authenticated_protocol_envelope" &&
    value.authenticated === true &&
    hasSafeVerifiedContext(value) &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function hasSafeVerifiedContext(value: McpAuthenticatedProtocolEnvelopeV1): boolean {
  return (
    isSafeIdentifier(value.verifiedClientId) &&
    isSafeIdentifier(value.verifiedResource) &&
    isSafeScopeList(value.verifiedScopes)
  );
}

function isSafeScopeList(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.length > 0 && value.every(isSafeIdentifier);
}

function readSafeIdentifierList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = mapArrayByIndex(value, (item) =>
    typeof item === "string" ? item.trim() : "",
  );
  if (normalized.some((item) => !isSafeIdentifier(item))) return undefined;
  return Object.freeze([...new Set(normalized)].sort());
}

function readSha256HexList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const normalized = mapArrayByIndex(value, (item) =>
    typeof item === "string" ? item : "",
  );
  if (normalized.some((item) => !isSha256Hex(item))) return undefined;
  return Object.freeze([...new Set(normalized)].sort());
}

function mapArrayByIndex<T>(
  value: readonly unknown[],
  mapper: (item: unknown) => T,
): T[] {
  const mapped: T[] = [];
  for (let index = 0; index < value.length; index += 1) {
    mapped.push(mapper(value[index]));
  }
  return mapped;
}

function isSha256Hex(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX_PATTERN.test(value);
}

function isSafeIdentifier(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= 512 &&
    !hasControlCharacter(value)
  );
}

function hasControlCharacter(value: string): boolean {
  return CONTROL_CHARACTER_PATTERN.test(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Reflect.getPrototypeOf(value);
  return prototype === null || prototype.constructor === Object;
}
