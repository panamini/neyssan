import {
  buildLocalMcpDevProtectedResourceMetadata,
  type LocalMcpDevAuthConfigV1,
} from "./localMcpDevAuthConfig";
import {
  buildMcpConvexAccountLinkLookupAdapter,
  type McpConvexAccountLinkLookupAdapterConfigV1,
} from "./mcpConvexAccountLinkLookupAdapter";
import type {
  McpAccountLinkLookupPortV1,
  McpBearerTokenVerifierPortV1,
} from "./mcpAuthRequestOrchestrator";
import {
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type TwoweeksApplicationsReadScopeV1,
} from "./mcpAuthPolicyBoundary";
import {
  buildStytchMcpBearerTokenVerifier,
  type StytchMcpBearerVerifierConfigV1,
} from "./mcpStytchBearerVerifierBoundary";

export type McpAuthCompositionFailureReasonV1 =
  | "malformed_config"
  | "issuer_mismatch"
  | "audience_mismatch"
  | "resource_mismatch"
  | "environment_mismatch"
  | "allowed_client_mismatch"
  | "scope_mismatch"
  | "verifier_config_mismatch"
  | "endpoint_auth_config_mismatch";

export type McpAuthCompositionBoundaryConfigV1 = Readonly<{
  kind: "mcp_auth_composition_boundary_config";
  localDevAuthConfig: LocalMcpDevAuthConfigV1;
  stytchVerifierConfig: StytchMcpBearerVerifierConfigV1;
  canonicalResourceAudience: string;
  authorizationServerIssuerUrl: string;
  providerEnvironment: string;
  approvedClientIds: readonly string[];
  requiredScope: TwoweeksApplicationsReadScopeV1;
  accountLinkLookupAdapterConfig: McpConvexAccountLinkLookupAdapterConfigV1;
  localDevOnly: true;
  nonProductionOnly: true;
  version: 1;
}>;

export type McpAuthCompositionMetadataV1 = Readonly<{
  kind: "mcp_auth_composition_metadata";
  localDevOnly: true;
  nonProductionOnly: true;
  network: "none";
  productionRuntime: "none";
  requiredScope: TwoweeksApplicationsReadScopeV1;
  version: 1;
}>;

export type McpAuthCompositionDependenciesResultV1 = Readonly<
  | {
      kind: "mcp_auth_composition_dependencies_result";
      configured: true;
      tokenVerifier: McpBearerTokenVerifierPortV1;
      accountLinkLookup: McpAccountLinkLookupPortV1;
      metadata: McpAuthCompositionMetadataV1;
      version: 1;
    }
  | {
      kind: "mcp_auth_composition_dependencies_result";
      configured: false;
      reason: McpAuthCompositionFailureReasonV1;
      metadata: McpAuthCompositionMetadataV1;
      version: 1;
    }
>;

type ParsedCompositionConfigV1 = Readonly<{
  localDevAuthConfig: LocalMcpDevAuthConfigV1;
  stytchVerifierConfig: StytchMcpBearerVerifierConfigV1;
  canonicalResourceAudience: string;
  authorizationServerIssuerUrl: string;
  providerEnvironment: string;
  approvedClientIds: readonly string[];
  requiredScope: TwoweeksApplicationsReadScopeV1;
  accountLinkLookupAdapterConfig: McpConvexAccountLinkLookupAdapterConfigV1;
}>;

type ConfigParseResultV1 = Readonly<
  | { ok: true; config: ParsedCompositionConfigV1 }
  | { ok: false; reason: McpAuthCompositionFailureReasonV1 }
>;

const CONFIG_KEYS = [
  "kind",
  "localDevAuthConfig",
  "stytchVerifierConfig",
  "canonicalResourceAudience",
  "authorizationServerIssuerUrl",
  "providerEnvironment",
  "approvedClientIds",
  "requiredScope",
  "accountLinkLookupAdapterConfig",
  "localDevOnly",
  "nonProductionOnly",
  "version",
] as const;

const LOCAL_DEV_AUTH_CONFIG_KEYS = [
  "kind",
  "enabled",
  "resourceUrl",
  "authorizationServerIssuerUrl",
  "protectedResourceMetadataUrl",
  "providerEnvironment",
  "allowedClientIds",
  "requiredScope",
  "localDevOnly",
  "fixtureOnly",
  "version",
] as const;

const STYTCH_VERIFIER_CONFIG_KEYS = [
  "kind",
  "provider",
  "issuer",
  "audience",
  "approvedClientIds",
  "requiredScope",
  "jwks",
  "jwksSource",
  "serverOnly",
  "providerEnvironment",
  "allowedAlgorithm",
  "clockToleranceSeconds",
  "tokenStorage",
  "version",
] as const;

const ACCOUNT_LINK_LOOKUP_CONFIG_KEYS = [
  "kind",
  "queryRef",
  "runQuery",
  "serverOnly",
  "version",
] as const;

const SAFE_TOKEN_VALUE_PATTERN = /^[A-Za-z0-9._:-]+$/u;

export function buildMcpAuthCompositionDependencies(
  input: unknown,
): McpAuthCompositionDependenciesResultV1 {
  const metadata = buildMetadata();
  const parsed = parseCompositionConfig(input);
  if (!parsed.ok) return buildFailure(parsed.reason, metadata);

  return Object.freeze({
    kind: "mcp_auth_composition_dependencies_result",
    configured: true,
    tokenVerifier: buildStytchMcpBearerTokenVerifier(parsed.config.stytchVerifierConfig),
    accountLinkLookup: buildMcpConvexAccountLinkLookupAdapter(parsed.config.accountLinkLookupAdapterConfig),
    metadata,
    version: 1,
  });
}

function parseCompositionConfig(input: unknown): ConfigParseResultV1 {
  const record = readExactRecord(input, CONFIG_KEYS);
  if (!record) return { ok: false, reason: "malformed_config" };
  if (
    record.kind !== "mcp_auth_composition_boundary_config" ||
    record.localDevOnly !== true ||
    record.nonProductionOnly !== true ||
    record.version !== 1
  ) {
    return { ok: false, reason: "malformed_config" };
  }

  const canonicalResourceAudience = readHttpsUrl(record.canonicalResourceAudience);
  if (!canonicalResourceAudience) return { ok: false, reason: "resource_mismatch" };
  const authorizationServerIssuerUrl = readHttpsUrl(record.authorizationServerIssuerUrl);
  if (!authorizationServerIssuerUrl) return { ok: false, reason: "issuer_mismatch" };
  const providerEnvironment = readSafeTokenValue(record.providerEnvironment);
  if (!providerEnvironment) return { ok: false, reason: "environment_mismatch" };
  const approvedClientIds = readSafeStringList(record.approvedClientIds);
  if (!approvedClientIds) return { ok: false, reason: "allowed_client_mismatch" };
  if (record.requiredScope !== TWOWEEKS_APPLICATIONS_READ_SCOPE) {
    return { ok: false, reason: "scope_mismatch" };
  }

  const localDevAuthConfig = readLocalDevAuthConfig(record.localDevAuthConfig);
  if (!localDevAuthConfig) return { ok: false, reason: "endpoint_auth_config_mismatch" };
  const stytchVerifierConfig = readStytchVerifierConfig(record.stytchVerifierConfig);
  if (!stytchVerifierConfig.ok) return { ok: false, reason: stytchVerifierConfig.reason };
  const accountLinkLookupAdapterConfig = readAccountLinkLookupAdapterConfig(record.accountLinkLookupAdapterConfig);
  if (!accountLinkLookupAdapterConfig) return { ok: false, reason: "malformed_config" };

  const parsed = Object.freeze({
    localDevAuthConfig,
    stytchVerifierConfig: stytchVerifierConfig.config,
    canonicalResourceAudience,
    authorizationServerIssuerUrl,
    providerEnvironment,
    approvedClientIds,
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    accountLinkLookupAdapterConfig,
  });
  return validateCrossComponentConsistency(parsed);
}

function validateCrossComponentConsistency(
  config: ParsedCompositionConfigV1,
): ConfigParseResultV1 {
  if (config.localDevAuthConfig.resourceUrl !== config.canonicalResourceAudience) {
    return { ok: false, reason: "resource_mismatch" };
  }
  if (config.stytchVerifierConfig.audience !== config.canonicalResourceAudience) {
    return { ok: false, reason: "audience_mismatch" };
  }
  if (
    config.localDevAuthConfig.authorizationServerIssuerUrl !== config.authorizationServerIssuerUrl ||
    config.stytchVerifierConfig.issuer !== config.authorizationServerIssuerUrl
  ) {
    return { ok: false, reason: "issuer_mismatch" };
  }
  if (
    config.localDevAuthConfig.providerEnvironment !== config.providerEnvironment ||
    config.stytchVerifierConfig.providerEnvironment !== config.providerEnvironment
  ) {
    return { ok: false, reason: "environment_mismatch" };
  }
  if (
    !sameStringList(config.localDevAuthConfig.allowedClientIds, config.approvedClientIds) ||
    !sameStringList(config.stytchVerifierConfig.approvedClientIds, config.approvedClientIds)
  ) {
    return { ok: false, reason: "allowed_client_mismatch" };
  }
  if (
    config.localDevAuthConfig.requiredScope !== config.requiredScope ||
    config.stytchVerifierConfig.requiredScope !== config.requiredScope
  ) {
    return { ok: false, reason: "scope_mismatch" };
  }

  return { ok: true, config };
}

function readLocalDevAuthConfig(value: unknown): LocalMcpDevAuthConfigV1 | undefined {
  const record = readExactRecord(value, LOCAL_DEV_AUTH_CONFIG_KEYS);
  if (!record) return undefined;
  if (
    record.kind !== "local_mcp_dev_auth_config" ||
    record.enabled !== true ||
    record.localDevOnly !== true ||
    record.fixtureOnly !== true ||
    record.version !== 1 ||
    record.requiredScope !== TWOWEEKS_APPLICATIONS_READ_SCOPE
  ) {
    return undefined;
  }
  if (!readHttpsUrl(record.resourceUrl) || !readHttpsUrl(record.authorizationServerIssuerUrl)) return undefined;
  if (!readHttpsUrl(record.protectedResourceMetadataUrl)) return undefined;
  if (!readSafeTokenValue(record.providerEnvironment)) return undefined;
  if (!readSafeStringList(record.allowedClientIds)) return undefined;

  try {
    buildLocalMcpDevProtectedResourceMetadata(record as LocalMcpDevAuthConfigV1);
  } catch {
    return undefined;
  }
  return record as LocalMcpDevAuthConfigV1;
}

function readStytchVerifierConfig(
  value: unknown,
): Readonly<
  | { ok: true; config: StytchMcpBearerVerifierConfigV1 }
  | { ok: false; reason: "verifier_config_mismatch" | "scope_mismatch" }
> {
  const record = readExactRecord(value, STYTCH_VERIFIER_CONFIG_KEYS);
  if (!record) return { ok: false, reason: "verifier_config_mismatch" };
  if (record.requiredScope !== TWOWEEKS_APPLICATIONS_READ_SCOPE) {
    return { ok: false, reason: "scope_mismatch" };
  }
  if (
    record.kind !== "stytch_mcp_bearer_verifier_config" ||
    record.provider !== "stytch" ||
    record.jwksSource !== "server_only_config" ||
    record.serverOnly !== true ||
    record.allowedAlgorithm !== "RS256" ||
    record.tokenStorage !== "none" ||
    record.version !== 1
  ) {
    return { ok: false, reason: "verifier_config_mismatch" };
  }
  if (!readHttpsUrl(record.issuer) || !readHttpsUrl(record.audience)) {
    return { ok: false, reason: "verifier_config_mismatch" };
  }
  if (!readSafeStringList(record.approvedClientIds) || !readSafeTokenValue(record.providerEnvironment)) {
    return { ok: false, reason: "verifier_config_mismatch" };
  }
  if (!isJsonWebKeySet(record.jwks)) return { ok: false, reason: "verifier_config_mismatch" };
  if (
    typeof record.clockToleranceSeconds !== "number" ||
    !Number.isInteger(record.clockToleranceSeconds) ||
    record.clockToleranceSeconds < 0
  ) {
    return { ok: false, reason: "verifier_config_mismatch" };
  }

  return { ok: true, config: record as StytchMcpBearerVerifierConfigV1 };
}

function readAccountLinkLookupAdapterConfig(
  value: unknown,
): McpConvexAccountLinkLookupAdapterConfigV1 | undefined {
  const record = readExactRecord(value, ACCOUNT_LINK_LOOKUP_CONFIG_KEYS);
  if (!record) return undefined;
  if (
    record.kind !== "mcp_convex_account_link_lookup_adapter_config" ||
    record.queryRef === undefined ||
    typeof record.runQuery !== "function" ||
    record.serverOnly !== true ||
    record.version !== 1
  ) {
    return undefined;
  }
  return record as McpConvexAccountLinkLookupAdapterConfigV1;
}

function buildFailure(
  reason: McpAuthCompositionFailureReasonV1,
  metadata: McpAuthCompositionMetadataV1,
): McpAuthCompositionDependenciesResultV1 {
  return Object.freeze({
    kind: "mcp_auth_composition_dependencies_result",
    configured: false,
    reason,
    metadata,
    version: 1,
  });
}

function buildMetadata(): McpAuthCompositionMetadataV1 {
  return Object.freeze({
    kind: "mcp_auth_composition_metadata",
    localDevOnly: true,
    nonProductionOnly: true,
    network: "none",
    productionRuntime: "none",
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    version: 1,
  });
}

function readExactRecord<T extends readonly string[]>(
  value: unknown,
  allowedKeys: T,
): Record<T[number], unknown> | undefined {
  if (!isPlainRecord(value)) return undefined;
  const keys = Object.keys(value).sort();
  const expected = [...allowedKeys].sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    return undefined;
  }
  return value as Record<T[number], unknown>;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.trim() !== value) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) return undefined;
  return parsed.href === value ? value : undefined;
}

function readSafeTokenValue(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (value.length === 0 || value.length > 256 || value.trim() !== value) return undefined;
  return SAFE_TOKEN_VALUE_PATTERN.test(value) ? value : undefined;
}

function readSafeStringList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const items = value.map(readSafeTokenValue);
  if (items.some((item) => item === undefined)) return undefined;
  const strings = items as string[];
  return new Set(strings).size === strings.length ? Object.freeze([...strings]) : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && /\S/u.test(value) ? value : undefined;
}

function sameStringList(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function isJsonWebKeySet(value: unknown): boolean {
  const record = readDescriptorSafePlainObjectRecord(value);
  if (!record || !Array.isArray(record.keys) || record.keys.length === 0) return false;
  return record.keys.every(isRsaSigningJsonWebKey);
}

function isRsaSigningJsonWebKey(value: unknown): boolean {
  const record = readDescriptorSafePlainObjectRecord(value);
  if (!record) return false;
  const alg = record.alg;
  const use = record.use;
  return (
    record.kty === "RSA" &&
    readNonEmptyString(record.kid) !== undefined &&
    readNonEmptyString(record.n) !== undefined &&
    readNonEmptyString(record.e) !== undefined &&
    (alg === undefined || alg === "RS256") &&
    (use === undefined || use === "sig")
  );
}

function readDescriptorSafePlainObjectRecord(value: unknown): Record<string, unknown> | undefined {
  const descriptors = readDescriptorSafePlainObjectDescriptors(value);
  if (!descriptors) return undefined;
  const record: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    const descriptor = descriptors[key];
    if (typeof key !== "string" || !descriptor || descriptor.enumerable !== true || !("value" in descriptor)) {
      return undefined;
    }
    record[key] = descriptor.value;
  }
  return record;
}

function readDescriptorSafePlainObjectDescriptors(
  value: unknown,
): Record<PropertyKey, PropertyDescriptor | undefined> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) return undefined;
    return Object.getOwnPropertyDescriptors(value) as Record<PropertyKey, PropertyDescriptor | undefined>;
  } catch {
    return undefined;
  }
}
