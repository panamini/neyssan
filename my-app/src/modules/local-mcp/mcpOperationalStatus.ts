import {
  mapMcpOperationalReasonToCategory,
  type McpOperationalErrorCategoryV1,
} from "./mcpOperationalErrorTaxonomy";
import {
  MCP_OAUTH_PRODUCTION_APPROVED_FLAG,
  MCP_OAUTH_PRODUCTION_RUNTIME_FLAG,
} from "./mcpOAuthProductionActivationBoundary";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "./mcpAuthPolicyBoundary";

export type McpOperationalStatusCapabilityV1 =
  | "manual_handoff"
  | "live_external_action"
  | "account_link"
  | "production_oauth_activation"
  | "outbound_egress"
  | "write_action";

export type McpOperationalStatusV1 = {
  kind: "mcp_operational_status";
  capability: McpOperationalStatusCapabilityV1;
  enabled: boolean;
  configValid: boolean;
  featureState: "enabled" | "disabled" | "blocked" | "misconfigured";
  category?: McpOperationalErrorCategoryV1;
  valuesExposed: false;
  version: 1;
};

const STATUS_ALLOWED_SAFE_STORAGE_KEYS = new Set([
  "credentialstorage",
  "tokenstorage",
]);

const STATUS_FORBIDDEN_KEY_RE =
  /(?:authorization|cookie|session|secret|clientsecret|providersubject|stytchsubject|clerk|claims|jwt|jwks|raw|url|metadata|labels|error|stack|artifact|answer|source)/iu;
const STATUS_FORBIDDEN_VALUE_RE =
  /\b(?:bearer|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|api[_-]?key|authorization|cookie|session|credential|private_fact|never_use|generated artifact|answer text|source quote)\b|https?:\/\/\S+|\beyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/iu;
const STATUS_OPAQUE_IDENTIFIER_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{1,191}$/u;
const PRODUCTION_OAUTH_ACTIVATION_CONFIG_KEYS = new Set([
  "kind",
  "enabled",
  "requiredFlags",
  "providerConfig",
  "providerAbstraction",
  "tokenExchange",
  "accountLinkLifecycle",
  "publicEndpointExposed",
  "frontendWiring",
  "tokenStorage",
  "refreshTokenStorage",
  "defaultProductionBehavior",
  "version",
]);
const PRODUCTION_OAUTH_PROVIDER_CONFIG_KEYS = new Set([
  "provider",
  "issuer",
  "resource",
  "providerEnvironment",
  "allowedClientIds",
  "requiredReadScopes",
  "version",
]);
const PRODUCTION_OAUTH_ACTIVATION_CONFIG_SHAPE_CHECKS = [
  (value: Record<string, unknown>) => value.kind === "mcp_oauth_production_activation_config",
  (value: Record<string, unknown>) => typeof value.enabled === "boolean",
  (value: Record<string, unknown>) => value.publicEndpointExposed === false,
  (value: Record<string, unknown>) => value.frontendWiring === false,
  (value: Record<string, unknown>) => value.tokenStorage === "none",
  (value: Record<string, unknown>) => value.refreshTokenStorage === "none",
  (value: Record<string, unknown>) => value.defaultProductionBehavior === "disabled",
  (value: Record<string, unknown>) => value.version === 1,
] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function containsUnsafeStatusMaterial(value: unknown): boolean {
  if (typeof value === "string") {
    return STATUS_FORBIDDEN_VALUE_RE.test(value);
  }

  if (Array.isArray(value)) {
    return value.some((item) => containsUnsafeStatusMaterial(item));
  }

  if (!isPlainRecord(value)) {
    return false;
  }

  return Object.entries(value).some(
    ([key, nestedValue]) =>
      (!STATUS_ALLOWED_SAFE_STORAGE_KEYS.has(key.toLowerCase()) &&
        (STATUS_FORBIDDEN_KEY_RE.test(key) || /token|credential/iu.test(key))) ||
      containsUnsafeStatusMaterial(nestedValue),
  );
}

function buildStatus(input: {
  capability: McpOperationalStatusCapabilityV1;
  enabled: boolean;
  configValid: boolean;
  featureState: McpOperationalStatusV1["featureState"];
  category?: McpOperationalErrorCategoryV1;
}): McpOperationalStatusV1 {
  return {
    kind: "mcp_operational_status",
    capability: input.capability,
    enabled: input.enabled,
    configValid: input.configValid,
    featureState: input.featureState,
    ...(input.category ? { category: input.category } : {}),
    valuesExposed: false,
    version: 1,
  };
}

function unsafeConfigStatus(
  capability: McpOperationalStatusCapabilityV1,
): McpOperationalStatusV1 {
  return buildStatus({
    capability,
    enabled: false,
    configValid: false,
    featureState: "misconfigured",
    category: "config_invalid",
  });
}

function readSafeConfigStatus(
  value: unknown,
): Record<string, unknown> | undefined {
  if (!isPlainRecord(value) || containsUnsafeStatusMaterial(value)) {
    return undefined;
  }

  if (
    value.valuesExposed !== false ||
    value.credentialStorage !== "none" ||
    value.tokenStorage !== "none" ||
    typeof value.enabled !== "boolean" ||
    typeof value.status !== "string"
  ) {
    return undefined;
  }

  return value;
}

export function buildMcpOperationalManualHandoffStatus(
  safeConfigStatus: unknown,
): McpOperationalStatusV1 {
  const status = readSafeConfigStatus(safeConfigStatus);
  if (!status) {
    return unsafeConfigStatus("manual_handoff");
  }

  if (status.status === "feature_disabled" || status.enabled === false) {
    return buildStatus({
      capability: "manual_handoff",
      enabled: false,
      configValid: true,
      featureState: "disabled",
      category: "feature_disabled",
    });
  }

  if (status.status !== "enabled") {
    return unsafeConfigStatus("manual_handoff");
  }

  return buildStatus({
    capability: "manual_handoff",
    enabled: true,
    configValid: true,
    featureState: "enabled",
  });
}

export function buildMcpOperationalLiveExternalActionStatus(
  safeConfigStatus: unknown,
): McpOperationalStatusV1 {
  const status = readSafeConfigStatus(safeConfigStatus);
  if (!status) {
    return unsafeConfigStatus("live_external_action");
  }

  if (status.status === "feature_disabled" || status.enabled === false) {
    return buildStatus({
      capability: "live_external_action",
      enabled: false,
      configValid: true,
      featureState: "disabled",
      category: "feature_disabled",
    });
  }

  if (status.status === "provider_authorization_required") {
    return buildStatus({
      capability: "live_external_action",
      enabled: true,
      configValid: true,
      featureState: "blocked",
      category: "external_action_disabled",
    });
  }

  return unsafeConfigStatus("live_external_action");
}

export function buildMcpOperationalProductionOAuthActivationStatus(
  activationConfig: unknown,
): McpOperationalStatusV1 {
  const config = readProductionOAuthActivationConfig(activationConfig);
  if (!config) {
    return unsafeConfigStatus("production_oauth_activation");
  }

  if (config.runtimeValue !== "1" || config.approvedValue !== "1") {
    return buildStatus({
      capability: "production_oauth_activation",
      enabled: false,
      configValid: true,
      featureState: "disabled",
      category: "feature_disabled",
    });
  }

  if (!config.enabled || config.providerConfigPresent !== true) {
    return unsafeConfigStatus("production_oauth_activation");
  }

  return buildStatus({
    capability: "production_oauth_activation",
    enabled: true,
    configValid: true,
    featureState: "blocked",
    category: "auth_invalid",
  });
}

export function buildMcpOperationalAccountLinkStatus(
  reason: unknown,
): McpOperationalStatusV1 {
  const category = mapMcpOperationalReasonToCategory(reason);
  if (
    category !== "account_link_missing" &&
    category !== "account_link_invalid" &&
    category !== "auth_invalid"
  ) {
    return buildStatus({
      capability: "account_link",
      enabled: false,
      configValid: false,
      featureState: "blocked",
      category: "internal_validation_error",
    });
  }

  return buildStatus({
    capability: "account_link",
    enabled: false,
    configValid: true,
    featureState: "blocked",
    category,
  });
}

function readProductionOAuthActivationConfig(
  value: unknown,
):
  | Readonly<{
      enabled: boolean;
      runtimeValue: string;
      approvedValue: string;
      providerConfigPresent: boolean;
    }>
  | undefined {
  if (!isPlainRecord(value)) {
    return undefined;
  }

  if (hasUnknownProductionOAuthActivationConfigKeys(value)) {
    return undefined;
  }

  if (!hasProductionOAuthActivationConfigShape(value)) {
    return undefined;
  }

  const enabled = value.enabled;
  if (typeof enabled !== "boolean") {
    return undefined;
  }

  const requiredFlags = readProductionOAuthActivationRequiredFlags(value.requiredFlags);
  if (!requiredFlags) {
    return undefined;
  }
  const providerConfigPresent = readProductionOAuthActivationProviderConfigPresent(value.providerConfig);
  if (providerConfigPresent === undefined) {
    return undefined;
  }

  return {
    enabled,
    runtimeValue: requiredFlags.runtimeValue,
    approvedValue: requiredFlags.approvedValue,
    providerConfigPresent,
  };
}

function hasProductionOAuthActivationConfigShape(
  value: Record<string, unknown>,
): boolean {
  return PRODUCTION_OAUTH_ACTIVATION_CONFIG_SHAPE_CHECKS.every((check) => check(value));
}

function hasUnknownProductionOAuthActivationConfigKeys(
  value: Record<string, unknown>,
): boolean {
  return Object.keys(value).some((key) => !PRODUCTION_OAUTH_ACTIVATION_CONFIG_KEYS.has(key));
}

function readProductionOAuthActivationProviderConfigPresent(
  value: unknown,
): boolean | undefined {
  if (value === undefined) {
    return false;
  }

  if (!isPlainRecord(value)) {
    return undefined;
  }

  if (Object.keys(value).some((key) => !PRODUCTION_OAUTH_PROVIDER_CONFIG_KEYS.has(key))) {
    return undefined;
  }

  if (
    value.provider !== "stytch" ||
    !isSafeProductionOAuthConfigHttpsUrl(value.issuer, "issuer") ||
    !isSafeProductionOAuthConfigHttpsUrl(value.resource, "resource") ||
    !isSafeProductionOAuthOpaqueIdentifier(value.providerEnvironment) ||
    !isSafeProductionOAuthOpaqueIdentifierList(value.allowedClientIds) ||
    !isCanonicalProductionOAuthReadScopeList(value.requiredReadScopes) ||
    value.version !== 1
  ) {
    return undefined;
  }

  return true;
}

function readProductionOAuthActivationRequiredFlags(
  value: unknown,
): Readonly<{
  runtimeValue: "1" | "not_enabled";
  approvedValue: "1" | "not_enabled";
}> | undefined {
  if (
    !isPlainRecord(value) ||
    value.runtimeFlagName !== MCP_OAUTH_PRODUCTION_RUNTIME_FLAG ||
    value.approvedFlagName !== MCP_OAUTH_PRODUCTION_APPROVED_FLAG ||
    value.bothRequired !== true ||
    value.version !== 1
  ) {
    return undefined;
  }

  if (!isProductionOAuthActivationFlagValue(value.runtimeValue)) {
    return undefined;
  }

  if (!isProductionOAuthActivationFlagValue(value.approvedValue)) {
    return undefined;
  }

  return {
    runtimeValue: value.runtimeValue,
    approvedValue: value.approvedValue,
  };
}

function isProductionOAuthActivationFlagValue(
  value: unknown,
): value is "1" | "not_enabled" {
  return value === "1" || value === "not_enabled";
}

function isSafeProductionOAuthConfigHttpsUrl(
  value: unknown,
  kind: "issuer" | "resource",
): boolean {
  if (typeof value !== "string" || value.length === 0 || hasControlCharacter(value)) {
    return false;
  }

  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return false;
  }

  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
    return false;
  }
  if (kind === "issuer" && parsed.search) {
    return false;
  }
  return Boolean(parsed.hostname) && !parsed.hostname.includes("*");
}

function isSafeProductionOAuthOpaqueIdentifier(value: unknown): boolean {
  return typeof value === "string" && STATUS_OPAQUE_IDENTIFIER_RE.test(value.trim());
}

function isSafeProductionOAuthOpaqueIdentifierList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item) => isSafeProductionOAuthOpaqueIdentifier(item))
  );
}

function isCanonicalProductionOAuthReadScopeList(value: unknown): boolean {
  return (
    Array.isArray(value) &&
    value.length === 1 &&
    value[0] === TWOWEEKS_APPLICATIONS_READ_SCOPE
  );
}

function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function buildMcpOperationalEgressStatus(
  reason: unknown,
): McpOperationalStatusV1 {
  const category = mapMcpOperationalReasonToCategory(reason);
  if (category !== "privacy_blocked" && category !== "destination_invalid") {
    return buildStatus({
      capability: "outbound_egress",
      enabled: false,
      configValid: false,
      featureState: "blocked",
      category: "internal_validation_error",
    });
  }

  return buildStatus({
    capability: "outbound_egress",
    enabled: false,
    configValid: true,
    featureState: "blocked",
    category,
  });
}

export function buildMcpOperationalWriteActionStatus(
  reason: unknown,
): McpOperationalStatusV1 {
  const category = mapMcpOperationalReasonToCategory(reason);
  if (
    category !== "feature_disabled" &&
    category !== "external_action_disabled" &&
    category !== "operation_conflict"
  ) {
    return buildStatus({
      capability: "write_action",
      enabled: false,
      configValid: false,
      featureState: "blocked",
      category: "internal_validation_error",
    });
  }

  return buildStatus({
    capability: "write_action",
    enabled: false,
    configValid: true,
    featureState: "blocked",
    category,
  });
}
