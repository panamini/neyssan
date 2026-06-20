import {
  mapMcpOperationalReasonToCategory,
  type McpOperationalErrorCategoryV1,
} from "./mcpOperationalErrorTaxonomy";

export type McpOperationalStatusCapabilityV1 =
  | "manual_handoff"
  | "live_external_action"
  | "account_link"
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
