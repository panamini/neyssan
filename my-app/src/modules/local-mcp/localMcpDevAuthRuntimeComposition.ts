import type { JSONWebKeySet } from "jose";
import {
  buildLocalMcpDevAuthConfig,
  type LocalMcpDevAuthConfigInputV1,
  type LocalMcpDevAuthConfigV1,
} from "./localMcpDevAuthConfig";
import type { LocalMcpDevEndpointDependenciesV1 } from "./localMcpDevEndpoint";
import {
  buildMcpAuthCompositionDependencies,
  type McpAuthCompositionBoundaryConfigV1,
  type McpAuthCompositionFailureReasonV1,
} from "./mcpAuthCompositionBoundary";
import {
  MCP_CONVEX_ACCOUNT_LINK_LOOKUP_MALFORMED_RESULT,
  type McpConvexAccountLinkLookupRunQueryV1,
} from "./mcpConvexAccountLinkLookupAdapter";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "./mcpAuthPolicyBoundary";

export const LOCAL_MCP_DEV_STYTCH_COMPOSITION_FLAG = "LOCAL_MCP_DEV_STYTCH_COMPOSITION";
export const LOCAL_MCP_DEV_STYTCH_JWKS_JSON_VAR = "LOCAL_MCP_DEV_STYTCH_JWKS_JSON";
export const LOCAL_MCP_DEV_STYTCH_JWKS_JSON_MAX_BYTES = 32 * 1024;
export const LOCAL_MCP_DEV_STYTCH_JWKS_MAX_KEYS = 5;

const LOCAL_MCP_DEV_AUTH_COMPOSITION_QUERY_REF = Object.freeze({
  name: "mcpAccountLinks.internalLookupMcpAuthPolicyAccountLinkCandidates",
  localDevOnly: true,
  version: 1,
} as const);

export type LocalMcpDevAuthRuntimeCompositionInputV1 = Readonly<{
  endpointEnabled: boolean;
  fixtureDemoEnabled: boolean;
  authPolicyEnabled: boolean;
  compositionEnabled: boolean;
  authConfigInput?: LocalMcpDevAuthConfigInputV1;
  jwksJson?: string;
}>;

export type LocalMcpDevAuthRuntimeCompositionResultV1 = Readonly<
  | {
      kind: "local_mcp_dev_auth_runtime_composition_result";
      enabled: false;
      reason: "disabled";
      dependencies: LocalMcpDevEndpointDependenciesV1;
      parsedJwks: false;
      builtComposition: false;
      version: 1;
    }
  | {
      kind: "local_mcp_dev_auth_runtime_composition_result";
      enabled: false;
      reason:
        | "auth_config_unavailable"
        | "jwks_unavailable"
        | "jwks_malformed"
        | McpAuthCompositionFailureReasonV1;
      dependencies: LocalMcpDevEndpointDependenciesV1;
      parsedJwks: boolean;
      builtComposition: boolean;
      version: 1;
    }
  | {
      kind: "local_mcp_dev_auth_runtime_composition_result";
      enabled: true;
      reason: "configured";
      dependencies: Required<Pick<LocalMcpDevEndpointDependenciesV1, "tokenVerifier" | "accountLinkLookup">>;
      parsedJwks: true;
      builtComposition: true;
      version: 1;
    }
>;

type LocalMcpDevAuthRuntimeCompositionFailureReasonV1 =
  | "auth_config_unavailable"
  | "jwks_unavailable"
  | "jwks_malformed"
  | McpAuthCompositionFailureReasonV1;

export function buildLocalMcpDevAuthRuntimeCompositionDependencies(
  input: LocalMcpDevAuthRuntimeCompositionInputV1,
): LocalMcpDevAuthRuntimeCompositionResultV1 {
  if (!shouldActivateComposition(input)) {
    return disabledResult();
  }

  const authConfig = buildLocalMcpDevAuthConfig({
    ...(input.authConfigInput ?? {}),
    enabled: true,
  });
  if (!authConfig) {
    return failureResult("auth_config_unavailable", false, false);
  }

  const parsedJwks = parseLocalMcpDevPublicJwks(input.jwksJson);
  if (!parsedJwks.ok) {
    return failureResult(parsedJwks.reason, false, false);
  }

  const composition = buildMcpAuthCompositionDependencies(
    buildCompositionConfig(authConfig, parsedJwks.jwks),
  );
  if (!composition.configured) {
    return failureResult(composition.reason, true, true);
  }

  return Object.freeze({
    kind: "local_mcp_dev_auth_runtime_composition_result",
    enabled: true,
    reason: "configured",
    dependencies: Object.freeze({
      tokenVerifier: composition.tokenVerifier,
      accountLinkLookup: composition.accountLinkLookup,
    }),
    parsedJwks: true,
    builtComposition: true,
    version: 1,
  });
}

export function parseLocalMcpDevPublicJwks(
  value: unknown,
): Readonly<{ ok: true; jwks: JSONWebKeySet } | { ok: false; reason: "jwks_unavailable" | "jwks_malformed" }> {
  if (typeof value !== "string") return { ok: false, reason: "jwks_unavailable" };
  const trimmed = value.trim();
  if (trimmed.length === 0) return { ok: false, reason: "jwks_unavailable" };
  if (Buffer.byteLength(trimmed, "utf8") > LOCAL_MCP_DEV_STYTCH_JWKS_JSON_MAX_BYTES) {
    return { ok: false, reason: "jwks_malformed" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return { ok: false, reason: "jwks_malformed" };
  }

  const jwks = readPublicJwks(parsed);
  return jwks ? { ok: true, jwks } : { ok: false, reason: "jwks_malformed" };
}

function shouldActivateComposition(input: LocalMcpDevAuthRuntimeCompositionInputV1): boolean {
  return (
    input.endpointEnabled === true &&
    input.fixtureDemoEnabled === true &&
    input.authPolicyEnabled === true &&
    input.compositionEnabled === true
  );
}

function buildCompositionConfig(
  authConfig: LocalMcpDevAuthConfigV1,
  jwks: JSONWebKeySet,
): McpAuthCompositionBoundaryConfigV1 {
  return Object.freeze({
    kind: "mcp_auth_composition_boundary_config",
    localDevAuthConfig: authConfig,
    stytchVerifierConfig: Object.freeze({
      kind: "stytch_mcp_bearer_verifier_config",
      provider: "stytch",
      issuer: authConfig.authorizationServerIssuerUrl,
      audience: authConfig.resourceUrl,
      approvedClientIds: authConfig.allowedClientIds,
      requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
      jwks,
      jwksSource: "server_only_config",
      serverOnly: true,
      providerEnvironment: authConfig.providerEnvironment,
      allowedAlgorithm: "RS256",
      clockToleranceSeconds: 0,
      tokenStorage: "none",
      version: 1,
    }),
    canonicalResourceAudience: authConfig.resourceUrl,
    authorizationServerIssuerUrl: authConfig.authorizationServerIssuerUrl,
    providerEnvironment: authConfig.providerEnvironment,
    approvedClientIds: authConfig.allowedClientIds,
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    accountLinkLookupAdapterConfig: Object.freeze({
      kind: "mcp_convex_account_link_lookup_adapter_config",
      queryRef: LOCAL_MCP_DEV_AUTH_COMPOSITION_QUERY_REF,
      runQuery: runNoLinkLocalMcpDevAccountLinkLookup,
      serverOnly: true,
      version: 1,
    }),
    localDevOnly: true,
    nonProductionOnly: true,
    version: 1,
  });
}

const runNoLinkLocalMcpDevAccountLinkLookup: McpConvexAccountLinkLookupRunQueryV1 = async (queryRef) => {
  if (queryRef !== LOCAL_MCP_DEV_AUTH_COMPOSITION_QUERY_REF) {
    return Object.freeze([MCP_CONVEX_ACCOUNT_LINK_LOOKUP_MALFORMED_RESULT]);
  }
  return Object.freeze([]);
};

function disabledResult(): LocalMcpDevAuthRuntimeCompositionResultV1 {
  return Object.freeze({
    kind: "local_mcp_dev_auth_runtime_composition_result",
    enabled: false,
    reason: "disabled",
    dependencies: Object.freeze({}),
    parsedJwks: false,
    builtComposition: false,
    version: 1,
  });
}

function failureResult(
  reason: LocalMcpDevAuthRuntimeCompositionFailureReasonV1,
  parsedJwks: boolean,
  builtComposition: boolean,
): LocalMcpDevAuthRuntimeCompositionResultV1 {
  return Object.freeze({
    kind: "local_mcp_dev_auth_runtime_composition_result",
    enabled: false,
    reason,
    dependencies: Object.freeze({}),
    parsedJwks,
    builtComposition,
    version: 1,
  });
}

const TOP_LEVEL_JWKS_KEYS = ["keys"] as const;
const PUBLIC_RSA_JWK_KEYS = ["kty", "kid", "n", "e", "alg", "use"] as const;
const PRIVATE_JWK_KEYS = new Set(["d", "p", "q", "dp", "dq", "qi", "oth"]);
const SAFE_KID_PATTERN = /^[A-Za-z0-9._:-]+$/u;
const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/u;

function readPublicJwks(value: unknown): JSONWebKeySet | undefined {
  const record = readDescriptorSafeExactRecord(value, TOP_LEVEL_JWKS_KEYS);
  if (!record || !Array.isArray(record.keys)) return undefined;
  if (record.keys.length === 0 || record.keys.length > LOCAL_MCP_DEV_STYTCH_JWKS_MAX_KEYS) return undefined;

  const kids = new Set<string>();
  const keys = [];
  for (const key of record.keys) {
    const parsedKey = readPublicRsaJwk(key);
    if (!parsedKey || kids.has(parsedKey.kid)) return undefined;
    kids.add(parsedKey.kid);
    keys.push(parsedKey);
  }
  return deepFreeze({ keys });
}

function readPublicRsaJwk(value: unknown): { kty: "RSA"; kid: string; n: string; e: string; alg?: "RS256"; use?: "sig" } | undefined {
  if (containsPrivateJwkMaterial(value)) return undefined;
  const record = readDescriptorSafeExactRecord(value, PUBLIC_RSA_JWK_KEYS);
  if (!record) return undefined;
  if (record.kty !== "RSA") return undefined;
  if (record.alg !== undefined && record.alg !== "RS256") return undefined;
  if (record.use !== undefined && record.use !== "sig") return undefined;

  const kid = readSafeKid(record.kid);
  const n = readBase64Url(record.n);
  const e = readBase64Url(record.e);
  if (!kid || !n || !e) return undefined;

  return Object.freeze({
    kty: "RSA",
    kid,
    n,
    e,
    ...(record.alg === undefined ? {} : { alg: "RS256" as const }),
    ...(record.use === undefined ? {} : { use: "sig" as const }),
  });
}

function containsPrivateJwkMaterial(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (PRIVATE_JWK_KEYS.has(key)) return true;
    if ("get" in descriptor || "set" in descriptor) return true;
    if ("value" in descriptor && containsPrivateJwkMaterial(descriptor.value)) return true;
  }
  return false;
}

function readDescriptorSafeExactRecord<T extends readonly string[]>(
  value: unknown,
  allowedKeys: T,
): Record<T[number], unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  if (Object.getOwnPropertySymbols(value).length !== 0) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Object.keys(descriptors).sort();
  const allowed = [...allowedKeys].sort();
  if (keys.some((key) => !allowed.includes(key))) return undefined;
  for (const descriptor of Object.values(descriptors)) {
    if ("get" in descriptor || "set" in descriptor || !descriptor.enumerable) return undefined;
  }
  return value as Record<T[number], unknown>;
}

function readSafeKid(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 256) return undefined;
  return SAFE_KID_PATTERN.test(trimmed) ? trimmed : undefined;
}

function readBase64Url(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > 8192) return undefined;
  return BASE64URL_PATTERN.test(trimmed) ? trimmed : undefined;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    for (const nested of Object.values(value as Record<string, unknown>)) {
      deepFreeze(nested);
    }
    Object.freeze(value);
  }
  return value;
}
