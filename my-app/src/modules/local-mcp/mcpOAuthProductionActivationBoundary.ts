import {
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type TwoweeksApplicationsReadScopeV1,
} from "./mcpAuthPolicyBoundary";
import type { McpOAuthAuthorizationTrustedOwnerV1 } from "./mcpOAuthAuthorizationRequestBoundary";

export const MCP_OAUTH_PRODUCTION_RUNTIME_FLAG = "MCP_OAUTH_PRODUCTION_RUNTIME";
export const MCP_OAUTH_PRODUCTION_APPROVED_FLAG = "MCP_OAUTH_PRODUCTION_APPROVED";

export type McpOAuthProductionActivationReadScopeV1 =
  | TwoweeksApplicationsReadScopeV1
  | "twoweeks.mcp.read"
  | "twoweeks.evidence_graph.read"
  | "twoweeks.resume_variant_plan.read"
  | "twoweeks.review_cockpit.read";

export type McpOAuthProductionActivationFlagsV1 = Readonly<{
  runtime?: string;
  approved?: string;
}>;

export type McpOAuthProductionProviderConfigV1 = Readonly<{
  provider: "stytch";
  issuer: string;
  resource: string;
  providerEnvironment: string;
  allowedClientIds: readonly string[];
  requiredReadScopes: readonly McpOAuthProductionActivationReadScopeV1[];
  version: 1;
}>;

export type McpOAuthProductionActivationConfigInputV1 = Readonly<{
  flags?: McpOAuthProductionActivationFlagsV1;
  providerConfig?: Partial<McpOAuthProductionProviderConfigV1>;
}>;

export type McpOAuthProductionActivationConfigV1 = Readonly<{
  kind: "mcp_oauth_production_activation_config";
  enabled: boolean;
  requiredFlags: {
    runtimeFlagName: typeof MCP_OAUTH_PRODUCTION_RUNTIME_FLAG;
    approvedFlagName: typeof MCP_OAUTH_PRODUCTION_APPROVED_FLAG;
    runtimeValue: "1" | "not_enabled";
    approvedValue: "1" | "not_enabled";
    bothRequired: true;
    version: 1;
  };
  providerConfig: McpOAuthProductionProviderConfigV1 | undefined;
  providerAbstraction: "stytch_adapter_required";
  tokenExchange: "provider_adapter_only";
  accountLinkLifecycle: "provider_verified_server_hook_only";
  publicEndpointExposed: false;
  frontendWiring: false;
  tokenStorage: "none";
  refreshTokenStorage: "none";
  defaultProductionBehavior: "disabled";
  version: 1;
}>;

export type McpOAuthProductionTokenExchangeRequestV1 = Readonly<{
  kind: "mcp_oauth_production_token_exchange_request";
  provider: "stytch";
  authorizationCode: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
  issuer: string;
  resource: string;
  providerEnvironment: string;
  version: 1;
}>;

export type McpOAuthProductionProviderExchangeResultV1 = Readonly<
  | {
      kind: "mcp_oauth_production_token_exchange_result";
      ok: true;
      reason: "exchanged";
      serverOnly: {
        provider: "stytch";
        subject: string;
        issuer: string;
        resource: string;
        providerEnvironment: string;
        clientId: string;
        grantedScopes: readonly McpOAuthProductionActivationReadScopeV1[];
        expiresAtEpochSeconds: number;
        verifiedAtEpochSeconds: number;
        tokenMaterial: "handled_by_provider_adapter";
        accessTokenStored: false;
        refreshTokenStored: false;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_production_token_exchange_result";
      ok: false;
      reason: string;
      safeFailure: unknown;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthProductionProviderAdapterV1 = Readonly<{
  provider: "stytch";
  exchangeAuthorizationCode: (
    request: McpOAuthProductionTokenExchangeRequestV1,
  ) => Promise<McpOAuthProductionProviderExchangeResultV1>;
  version: 1;
}>;

export type McpOAuthProductionVerifiedAccountLinkEvidenceV1 = Readonly<{
  kind: "mcp_verified_account_link_evidence";
  provider: "stytch";
  issuer: string;
  subject: string;
  providerEnvironment: string;
  clientId: string;
  resource: string;
  grantedScopes: readonly string[];
  expiresAtEpochSeconds: number;
  verifiedAtEpochSeconds: number;
  cryptographicVerification: "already_verified_by_provider_adapter";
  version: 1;
}>;

export type McpOAuthProductionAccountLinkLifecycleRequestV1 = Readonly<{
  kind: "mcp_oauth_production_account_link_lifecycle_request";
  operation: "link";
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
  verifiedEvidence: McpOAuthProductionVerifiedAccountLinkEvidenceV1;
  lifecycleConfig: {
    kind: "mcp_account_link_lifecycle_config";
    expectedIssuer: string;
    expectedResource: string;
    expectedProviderEnvironment: string;
    allowedClientIds: readonly string[];
    version: 1;
  };
  nowEpochSeconds: number;
  version: 1;
}>;

export type McpOAuthProductionAccountLinkLifecycleResultV1 = Readonly<
  | {
      kind: "mcp_account_link_lifecycle_result";
      operation: "link";
      ok: true;
      reason: "linked" | "already_linked" | "refreshed" | "unchanged";
      serverOnly: {
        twoweeksClerkId: string;
        provider: "stytch";
        subject: string;
        clientId: string;
        version: 1;
      };
      modelVisible: false;
      version: 1;
    }
  | {
      kind: "mcp_account_link_lifecycle_result";
      operation: "link";
      ok: false;
      reason: string;
      safeFailure: unknown;
      modelVisible: false;
      version: 1;
    }
>;

export type McpOAuthProductionAccountLinkLifecyclePortV1 = (
  request: McpOAuthProductionAccountLinkLifecycleRequestV1,
) => Promise<McpOAuthProductionAccountLinkLifecycleResultV1>;

export type McpOAuthProductionActivationDependenciesV1 = Readonly<{
  providerAdapter?: McpOAuthProductionProviderAdapterV1;
  executeAccountLinkLifecycle?: McpOAuthProductionAccountLinkLifecyclePortV1;
}>;

export type McpOAuthProductionActivationInputV1 = Readonly<{
  kind: "mcp_oauth_production_activation_input";
  authorizationCode: string;
  redirectUri: string;
  codeVerifier: string;
  clientId: string;
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
  config: McpOAuthProductionActivationConfigV1;
  dependencies: McpOAuthProductionActivationDependenciesV1;
  nowEpochSeconds: number;
  version: 1;
}>;

export type McpOAuthProductionActivationReasonV1 =
  | "disabled_missing_runtime_flag"
  | "disabled_missing_approval_flag"
  | "invalid_input"
  | "invalid_configuration"
  | "dependency_unavailable"
  | "token_exchange_failed"
  | "account_link_lifecycle_failed";

export type McpOAuthProductionActivationCapabilitiesV1 = Readonly<{
  provider: "stytch";
  productionRuntime: "disabled" | "strict_flags_enabled";
  tokenExchange: "blocked" | "provider_adapter_only";
  accountLinkLifecycle: "blocked" | "server_hook_only";
  publicEndpointExposure: "blocked";
  frontendWiring: "blocked";
  tokenStorage: "none";
  refreshTokenStorage: "none";
  dataReads: "blocked";
  dataWrites: "blocked";
  handlerExecution: "blocked";
  modelCalls: "blocked";
  writeActions: "blocked";
  version: 1;
}>;

export type McpOAuthProductionActivationSafeRefusalV1 = Readonly<{
  code: "mcp_oauth_production_activation_blocked";
  message: "Production OAuth activation blocked.";
  safeForModel: true;
  tokenEchoed: false;
  authorizationCodeEchoed: false;
  providerSubjectExposed: false;
  ownerExposed: false;
  publicEndpointExposed: false;
  frontendWired: false;
  version: 1;
}>;

export type McpOAuthProductionActivationResultV1 = Readonly<
  | {
      kind: "mcp_oauth_production_activation_result";
      allowed: true;
      reason: "production_activation_completed";
      serverOnly: {
        provider: "stytch";
        tokenExchange: "completed_by_provider_adapter";
        accountLinkLifecycle: "linked_or_already_linked";
        subjectBinding: "verified_stytch_subject_server_only_not_returned";
        ownerBinding: "twoweeks_owner_server_only_not_returned";
        grantedReadScopes: readonly McpOAuthProductionActivationReadScopeV1[];
        requiredReadScopes: readonly McpOAuthProductionActivationReadScopeV1[];
        version: 1;
      };
      capabilities: McpOAuthProductionActivationCapabilitiesV1;
      modelVisible: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_production_activation_result";
      allowed: false;
      reason: McpOAuthProductionActivationReasonV1;
      safeRefusal: McpOAuthProductionActivationSafeRefusalV1;
      capabilities: McpOAuthProductionActivationCapabilitiesV1;
      modelVisible: false;
      version: 1;
    }
>;

const APPROVED_READ_SCOPES = [
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  "twoweeks.evidence_graph.read",
  "twoweeks.mcp.read",
  "twoweeks.resume_variant_plan.read",
  "twoweeks.review_cockpit.read",
] as const satisfies readonly McpOAuthProductionActivationReadScopeV1[];

const OPAQUE_TEXT_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,191}$/u;
const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/u;
const FORBIDDEN_STORED_TEXT_PATTERN =
  /@|bearer\s+\S+|authorization|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|credential|cookie|session|raw[_-]?(cv|resume|job|proposal|claims)|private[_-]?fact|never[_-]?use|source[_-]?(text|quote)|structured[_-]?shadow|convex[_-]?(id|document)|debug[_-]?payload/iu;

export function buildMcpOAuthProductionActivationConfig(
  input: McpOAuthProductionActivationConfigInputV1 = {},
): McpOAuthProductionActivationConfigV1 {
  const runtimeValue = input.flags?.runtime === "1" ? "1" : "not_enabled";
  const approvedValue = input.flags?.approved === "1" ? "1" : "not_enabled";
  const providerConfig = parseProviderConfig(input.providerConfig);
  return Object.freeze({
    kind: "mcp_oauth_production_activation_config",
    enabled: runtimeValue === "1" && approvedValue === "1" && providerConfig !== undefined,
    requiredFlags: Object.freeze({
      runtimeFlagName: MCP_OAUTH_PRODUCTION_RUNTIME_FLAG,
      approvedFlagName: MCP_OAUTH_PRODUCTION_APPROVED_FLAG,
      runtimeValue,
      approvedValue,
      bothRequired: true,
      version: 1,
    }),
    providerConfig,
    providerAbstraction: "stytch_adapter_required",
    tokenExchange: "provider_adapter_only",
    accountLinkLifecycle: "provider_verified_server_hook_only",
    publicEndpointExposed: false,
    frontendWiring: false,
    tokenStorage: "none",
    refreshTokenStorage: "none",
    defaultProductionBehavior: "disabled",
    version: 1,
  });
}

export function isMcpOAuthProductionActivationEnabled(
  config: McpOAuthProductionActivationConfigV1,
): config is McpOAuthProductionActivationConfigV1 & Readonly<{ enabled: true; providerConfig: McpOAuthProductionProviderConfigV1 }> {
  return config.enabled === true && config.providerConfig !== undefined;
}

export async function executeMcpOAuthProductionActivation(
  input: unknown,
): Promise<McpOAuthProductionActivationResultV1> {
  const parsed = parseActivationInput(input);
  if (!parsed) return deny("invalid_input", false);
  const config = parsed.config;
  if (config.requiredFlags.runtimeValue !== "1") return deny("disabled_missing_runtime_flag", false);
  if (config.requiredFlags.approvedValue !== "1") return deny("disabled_missing_approval_flag", false);
  if (!isMcpOAuthProductionActivationEnabled(config)) return deny("invalid_configuration", false);

  const dependencies = parsed.dependencies;
  const providerAdapter = dependencies.providerAdapter;
  const executeAccountLinkLifecycle = dependencies.executeAccountLinkLifecycle;
  if (
    providerAdapter?.provider !== "stytch" ||
    providerAdapter.version !== 1 ||
    typeof providerAdapter.exchangeAuthorizationCode !== "function" ||
    typeof executeAccountLinkLifecycle !== "function"
  ) {
    return deny("dependency_unavailable", true);
  }

  const exchangeResult = await exchangeToken(parsed, config.providerConfig, providerAdapter);
  if (!isAcceptedExchangeResult(exchangeResult, config.providerConfig, parsed.nowEpochSeconds)) {
    return deny("token_exchange_failed", true);
  }

  const lifecycleResult = await executeAccountLinkLifecycle(
    buildAccountLinkLifecycleRequest(parsed, config.providerConfig, exchangeResult.serverOnly),
  );
  if (!isAcceptedLifecycleResult(lifecycleResult, exchangeResult.serverOnly, parsed.trustedOwner)) {
    return deny("account_link_lifecycle_failed", true);
  }

  return {
    kind: "mcp_oauth_production_activation_result",
    allowed: true,
    reason: "production_activation_completed",
    serverOnly: {
      provider: "stytch",
      tokenExchange: "completed_by_provider_adapter",
      accountLinkLifecycle: "linked_or_already_linked",
      subjectBinding: "verified_stytch_subject_server_only_not_returned",
      ownerBinding: "twoweeks_owner_server_only_not_returned",
      grantedReadScopes: exchangeResult.serverOnly.grantedScopes,
      requiredReadScopes: config.providerConfig.requiredReadScopes,
      version: 1,
    },
    capabilities: buildCapabilities(true),
    modelVisible: false,
    version: 1,
  };
}

export function buildMcpOAuthProductionActivationSafeRefusal(): McpOAuthProductionActivationSafeRefusalV1 {
  return {
    code: "mcp_oauth_production_activation_blocked",
    message: "Production OAuth activation blocked.",
    safeForModel: true,
    tokenEchoed: false,
    authorizationCodeEchoed: false,
    providerSubjectExposed: false,
    ownerExposed: false,
    publicEndpointExposed: false,
    frontendWired: false,
    version: 1,
  };
}

function parseProviderConfig(
  value: Partial<McpOAuthProductionProviderConfigV1> | undefined,
): McpOAuthProductionProviderConfigV1 | undefined {
  if (!value || value.provider !== "stytch" || value.version !== 1) return undefined;
  const issuer = readSafeHttpsUrl(value.issuer, "issuer");
  const resource = readSafeHttpsUrl(value.resource, "resource");
  const providerEnvironment = readOpaqueIdentifier(value.providerEnvironment);
  const allowedClientIds = readOpaqueIdentifierList(value.allowedClientIds);
  const requiredReadScopes = readRequiredReadScopes(value.requiredReadScopes);
  if (!issuer || !resource || !providerEnvironment || !allowedClientIds || !requiredReadScopes) return undefined;
  return Object.freeze({
    provider: "stytch",
    issuer,
    resource,
    providerEnvironment,
    allowedClientIds,
    requiredReadScopes,
    version: 1,
  });
}

function parseActivationInput(value: unknown): McpOAuthProductionActivationInputV1 | undefined {
  if (!isPlainRecord(value)) return undefined;
  if (value.kind !== "mcp_oauth_production_activation_input" || value.version !== 1) return undefined;
  const config = readActivationConfig(value.config);
  const trustedOwner = readTrustedOwner(value.trustedOwner);
  const authorizationCode = readBoundedSecret(value.authorizationCode, 4_096);
  const redirectUri = readSafeHttpsUrl(value.redirectUri, "redirect");
  const codeVerifier = readCodeVerifier(value.codeVerifier);
  const clientId = readClientId(value.clientId, config?.providerConfig);
  const nowEpochSeconds = readSafeEpochSeconds(value.nowEpochSeconds);
  const dependencies = isPlainRecord(value.dependencies) ? value.dependencies : undefined;
  if (
    !config ||
    !trustedOwner ||
    !authorizationCode ||
    !redirectUri ||
    !codeVerifier ||
    !clientId ||
    !nowEpochSeconds ||
    !dependencies
  ) {
    return undefined;
  }
  return {
    kind: "mcp_oauth_production_activation_input",
    authorizationCode,
    redirectUri,
    codeVerifier,
    clientId,
    trustedOwner,
    config,
    dependencies: dependencies as McpOAuthProductionActivationDependenciesV1,
    nowEpochSeconds,
    version: 1,
  };
}

function readActivationConfig(value: unknown): McpOAuthProductionActivationConfigV1 | undefined {
  if (!isPlainRecord(value)) return undefined;
  if (value.kind !== "mcp_oauth_production_activation_config" || value.version !== 1) return undefined;
  if (value.publicEndpointExposed !== false || value.frontendWiring !== false) return undefined;
  if (value.tokenStorage !== "none" || value.refreshTokenStorage !== "none") return undefined;
  if (value.defaultProductionBehavior !== "disabled") return undefined;
  const requiredFlags = isPlainRecord(value.requiredFlags) ? value.requiredFlags : undefined;
  if (
    !requiredFlags ||
    requiredFlags.runtimeFlagName !== MCP_OAUTH_PRODUCTION_RUNTIME_FLAG ||
    requiredFlags.approvedFlagName !== MCP_OAUTH_PRODUCTION_APPROVED_FLAG ||
    (requiredFlags.runtimeValue !== "1" && requiredFlags.runtimeValue !== "not_enabled") ||
    (requiredFlags.approvedValue !== "1" && requiredFlags.approvedValue !== "not_enabled") ||
    requiredFlags.bothRequired !== true ||
    requiredFlags.version !== 1
  ) {
    return undefined;
  }
  return value as McpOAuthProductionActivationConfigV1;
}

async function exchangeToken(
  input: McpOAuthProductionActivationInputV1,
  providerConfig: McpOAuthProductionProviderConfigV1,
  providerAdapter: McpOAuthProductionProviderAdapterV1,
): Promise<McpOAuthProductionProviderExchangeResultV1> {
  try {
    return await providerAdapter.exchangeAuthorizationCode({
      kind: "mcp_oauth_production_token_exchange_request",
      provider: "stytch",
      authorizationCode: input.authorizationCode,
      redirectUri: input.redirectUri,
      codeVerifier: input.codeVerifier,
      clientId: input.clientId,
      issuer: providerConfig.issuer,
      resource: providerConfig.resource,
      providerEnvironment: providerConfig.providerEnvironment,
      version: 1,
    });
  } catch {
    return tokenExchangeFailure();
  }
}

function buildAccountLinkLifecycleRequest(
  input: McpOAuthProductionActivationInputV1,
  providerConfig: McpOAuthProductionProviderConfigV1,
  evidence: Extract<McpOAuthProductionProviderExchangeResultV1, { ok: true }>["serverOnly"],
): McpOAuthProductionAccountLinkLifecycleRequestV1 {
  return {
    kind: "mcp_oauth_production_account_link_lifecycle_request",
    operation: "link",
    trustedOwner: input.trustedOwner,
    verifiedEvidence: {
      kind: "mcp_verified_account_link_evidence",
      provider: "stytch",
      issuer: evidence.issuer,
      subject: evidence.subject,
      providerEnvironment: evidence.providerEnvironment,
      clientId: evidence.clientId,
      resource: evidence.resource,
      grantedScopes: evidence.grantedScopes,
      expiresAtEpochSeconds: evidence.expiresAtEpochSeconds,
      verifiedAtEpochSeconds: evidence.verifiedAtEpochSeconds,
      cryptographicVerification: "already_verified_by_provider_adapter",
      version: 1,
    },
    lifecycleConfig: {
      kind: "mcp_account_link_lifecycle_config",
      expectedIssuer: providerConfig.issuer,
      expectedResource: providerConfig.resource,
      expectedProviderEnvironment: providerConfig.providerEnvironment,
      allowedClientIds: providerConfig.allowedClientIds,
      version: 1,
    },
    nowEpochSeconds: input.nowEpochSeconds,
    version: 1,
  };
}

function isAcceptedExchangeResult(
  value: McpOAuthProductionProviderExchangeResultV1,
  config: McpOAuthProductionProviderConfigV1,
  nowEpochSeconds: number,
): value is Extract<McpOAuthProductionProviderExchangeResultV1, { ok: true }> {
  if (!isPlainRecord(value) || value.kind !== "mcp_oauth_production_token_exchange_result") return false;
  if (value.ok !== true || value.reason !== "exchanged" || value.modelVisible !== false || value.version !== 1) return false;
  if (!isPlainRecord(value.serverOnly)) return false;
  const evidence = value.serverOnly;
  return (
    evidence.provider === "stytch" &&
    readOpaqueIdentifier(evidence.subject) !== undefined &&
    evidence.issuer === config.issuer &&
    evidence.resource === config.resource &&
    evidence.providerEnvironment === config.providerEnvironment &&
    config.allowedClientIds.includes(String(evidence.clientId)) &&
    hasRequiredScopes(evidence.grantedScopes, config.requiredReadScopes) &&
    readSafeEpochSeconds(evidence.expiresAtEpochSeconds) !== undefined &&
    readSafeEpochSeconds(evidence.verifiedAtEpochSeconds) !== undefined &&
    evidence.expiresAtEpochSeconds > nowEpochSeconds &&
    evidence.verifiedAtEpochSeconds <= nowEpochSeconds &&
    evidence.tokenMaterial === "handled_by_provider_adapter" &&
    evidence.accessTokenStored === false &&
    evidence.refreshTokenStored === false &&
    evidence.version === 1
  );
}

function isAcceptedLifecycleResult(
  value: McpOAuthProductionAccountLinkLifecycleResultV1,
  evidence: Extract<McpOAuthProductionProviderExchangeResultV1, { ok: true }>["serverOnly"],
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1,
): value is Extract<McpOAuthProductionAccountLinkLifecycleResultV1, { ok: true }> {
  if (!isPlainRecord(value) || value.kind !== "mcp_account_link_lifecycle_result") return false;
  if (value.operation !== "link" || value.ok !== true || value.modelVisible !== false || value.version !== 1) return false;
  if (!["linked", "already_linked", "refreshed", "unchanged"].includes(String(value.reason))) return false;
  if (!isPlainRecord(value.serverOnly)) return false;
  return (
    value.serverOnly.provider === "stytch" &&
    value.serverOnly.subject === evidence.subject &&
    value.serverOnly.clientId === evidence.clientId &&
    value.serverOnly.twoweeksClerkId === trustedOwner.twoweeksClerkId &&
    value.serverOnly.version === 1
  );
}

function deny(
  reason: McpOAuthProductionActivationReasonV1,
  flagsEnabled: boolean,
): McpOAuthProductionActivationResultV1 {
  return {
    kind: "mcp_oauth_production_activation_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpOAuthProductionActivationSafeRefusal(),
    capabilities: buildCapabilities(flagsEnabled),
    modelVisible: false,
    version: 1,
  };
}

function tokenExchangeFailure(): Extract<McpOAuthProductionProviderExchangeResultV1, { ok: false }> {
  return {
    kind: "mcp_oauth_production_token_exchange_result",
    ok: false,
    reason: "provider_adapter_failed",
    safeFailure: buildMcpOAuthProductionActivationSafeRefusal(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function buildCapabilities(flagsEnabled: boolean): McpOAuthProductionActivationCapabilitiesV1 {
  return {
    provider: "stytch",
    productionRuntime: flagsEnabled ? "strict_flags_enabled" : "disabled",
    tokenExchange: flagsEnabled ? "provider_adapter_only" : "blocked",
    accountLinkLifecycle: flagsEnabled ? "server_hook_only" : "blocked",
    publicEndpointExposure: "blocked",
    frontendWiring: "blocked",
    tokenStorage: "none",
    refreshTokenStorage: "none",
    dataReads: "blocked",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    version: 1,
  };
}

function readTrustedOwner(value: unknown): McpOAuthAuthorizationTrustedOwnerV1 | undefined {
  if (!isPlainRecord(value)) return undefined;
  const twoweeksClerkId = readOpaqueIdentifier(value.twoweeksClerkId);
  if (
    value.kind !== "mcp_oauth_authorization_trusted_owner" ||
    !twoweeksClerkId ||
    value.version !== 1
  ) {
    return undefined;
  }
  return {
    kind: "mcp_oauth_authorization_trusted_owner",
    twoweeksClerkId,
    version: 1,
  };
}

function readClientId(
  value: unknown,
  providerConfig: McpOAuthProductionProviderConfigV1 | undefined,
): string | undefined {
  const clientId = readOpaqueIdentifier(value);
  if (!clientId) return undefined;
  return providerConfig === undefined || providerConfig.allowedClientIds.includes(clientId) ? clientId : undefined;
}

function readRequiredReadScopes(
  value: unknown,
): readonly McpOAuthProductionActivationReadScopeV1[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const scopes = new Set<McpOAuthProductionActivationReadScopeV1>();
  for (const scope of value) {
    if (!isApprovedReadScope(scope)) return undefined;
    scopes.add(scope);
  }
  if (!scopes.has(TWOWEEKS_APPLICATIONS_READ_SCOPE)) return undefined;
  return [...scopes].sort();
}

function readOpaqueIdentifierList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const identifiers = value.map(readOpaqueIdentifier);
  if (identifiers.some((identifier) => identifier === undefined)) return undefined;
  return Object.freeze([...new Set(identifiers as string[])].sort());
}

function readOpaqueIdentifier(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (!OPAQUE_TEXT_PATTERN.test(trimmed) || FORBIDDEN_STORED_TEXT_PATTERN.test(trimmed)) return undefined;
  return trimmed;
}

function readBoundedSecret(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return undefined;
  return hasControlCharacter(value) ? undefined : value;
}

function readCodeVerifier(value: unknown): string | undefined {
  return typeof value === "string" && CODE_VERIFIER_PATTERN.test(value) ? value : undefined;
}

function readSafeHttpsUrl(value: unknown, kind: "issuer" | "resource" | "redirect"): string | undefined {
  if (typeof value !== "string" || value.length === 0 || hasControlCharacter(value)) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) return undefined;
  if (kind !== "redirect" && parsed.search) return undefined;
  if (!parsed.hostname || parsed.hostname.includes("*")) return undefined;
  return parsed.toString();
}

function readSafeEpochSeconds(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : undefined;
}

function hasRequiredScopes(
  grantedScopes: readonly unknown[],
  requiredScopes: readonly McpOAuthProductionActivationReadScopeV1[],
): grantedScopes is readonly McpOAuthProductionActivationReadScopeV1[] {
  const normalized = new Set<McpOAuthProductionActivationReadScopeV1>();
  for (const scope of grantedScopes) {
    if (!isApprovedReadScope(scope)) return false;
    normalized.add(scope);
  }
  return requiredScopes.every((scope) => normalized.has(scope));
}

function isApprovedReadScope(value: unknown): value is McpOAuthProductionActivationReadScopeV1 {
  return (APPROVED_READ_SCOPES as readonly string[]).includes(String(value));
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
