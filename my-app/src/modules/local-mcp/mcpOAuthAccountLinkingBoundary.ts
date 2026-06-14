import { createLocalJWKSet, jwtVerify } from "jose";
import type { JSONWebKeySet, JWTPayload } from "jose";

export type McpOAuthAccountLinkingBoundaryProviderV1 = "stytch_connected_apps";

export type McpOAuthAccountLinkingBoundaryDenialReasonV1 =
  | "missing_bearer_token"
  | "malformed_authorization_header"
  | "unsupported_authorization_scheme"
  | "invalid_token"
  | "invalid_configuration"
  | "missing_subject"
  | "missing_required_scope"
  | "unauthorized_client";

export type McpOAuthAccountLinkingBoundaryConfigV1 = Readonly<{
  provider: McpOAuthAccountLinkingBoundaryProviderV1;
  issuer: string;
  audience: string;
  requiredScopes: readonly string[];
  allowedClientIds: readonly string[];
  jwks: JSONWebKeySet;
  allowedAlgorithms?: readonly string[];
  clockToleranceSeconds?: number;
}>;

export type McpOAuthAccountLinkingBoundaryInputV1 = Readonly<{
  authorizationHeader?: string | null;
  config: McpOAuthAccountLinkingBoundaryConfigV1;
  now?: Date;
}>;

export type McpOAuthAccountLinkingBoundaryCapabilitiesV1 = Readonly<{
  accountLinking: "verified_subject_contract_only" | "blocked";
  dataAccess: "blocked";
  handlerExecution: "blocked";
  productionConnector: "blocked";
  tokenStorage: "none";
  outboundIntrospection: "blocked";
  writeActions: "blocked";
  version: 1;
}>;

export type McpOAuthAccountLinkingBoundarySubjectMappingV1 = Readonly<{
  kind: "verified_oauth_subject_to_twoweeks_user_ref_contract";
  provider: McpOAuthAccountLinkingBoundaryProviderV1;
  providerSubject: string;
  twoweeksUserLookup: "deferred_until_real_data_pr";
  version: 1;
}>;

export type McpOAuthAccountLinkingBoundaryResultV1 = Readonly<
  | {
      kind: "mcp_oauth_account_linking_boundary_result";
      allowed: true;
      provider: McpOAuthAccountLinkingBoundaryProviderV1;
      serverOnly: {
        subject: string;
        clientId: string;
        issuer: string;
        audience: string;
        grantedScopes: readonly string[];
        subjectMapping: McpOAuthAccountLinkingBoundarySubjectMappingV1;
      };
      capabilities: McpOAuthAccountLinkingBoundaryCapabilitiesV1;
      modelVisible: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_account_linking_boundary_result";
      allowed: false;
      reason: McpOAuthAccountLinkingBoundaryDenialReasonV1;
      safeRefusal: McpOAuthAccountLinkingBoundarySafeRefusalV1;
      capabilities: McpOAuthAccountLinkingBoundaryCapabilitiesV1;
      version: 1;
    }
>;

export type McpOAuthAccountLinkingBoundarySafeRefusalV1 = Readonly<{
  code: "auth_required";
  message: "Authorization required.";
  safeForModel: true;
  tokenEchoed: false;
  version: 1;
}>;

const DEFAULT_ALLOWED_ALGORITHMS = ["RS256"] as const;
const BEARER_AUTHORIZATION_PATTERN = /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u;
const SAFE_SCOPE_PATTERN = /^twoweeks\.[a-z_]+(?:\.[a-z_]+)?$/u;

export async function verifyMcpOAuthAccountLinkingBoundary(
  input: McpOAuthAccountLinkingBoundaryInputV1,
): Promise<McpOAuthAccountLinkingBoundaryResultV1> {
  if (!isValidConfig(input.config)) return deny("invalid_configuration");

  const token = parseBearerToken(input.authorizationHeader);
  if (!token.ok) return deny(token.reason);

  const verified = await verifyJwt(token.value, input.config, input.now);
  if (!verified.ok) return deny("invalid_token");

  const subject = readNonEmptyString(verified.payload.sub);
  if (!subject) return deny("missing_subject");

  const grantedScopes = collectScopes(verified.payload);
  if (!hasRequiredScopes(grantedScopes, input.config.requiredScopes)) return deny("missing_required_scope");

  const clientId = firstAllowedClientId(verified.payload, input.config.allowedClientIds);
  if (!clientId) return deny("unauthorized_client");

  return {
    kind: "mcp_oauth_account_linking_boundary_result",
    allowed: true,
    provider: input.config.provider,
    serverOnly: {
      subject,
      clientId,
      issuer: input.config.issuer,
      audience: input.config.audience,
      grantedScopes,
      subjectMapping: {
        kind: "verified_oauth_subject_to_twoweeks_user_ref_contract",
        provider: input.config.provider,
        providerSubject: subject,
        twoweeksUserLookup: "deferred_until_real_data_pr",
        version: 1,
      },
    },
    capabilities: capabilities("verified_subject_contract_only"),
    modelVisible: false,
    version: 1,
  };
}

function parseBearerToken(
  authorizationHeader: string | null | undefined,
):
  | { ok: true; value: string }
  | { ok: false; reason: McpOAuthAccountLinkingBoundaryDenialReasonV1 } {
  if (authorizationHeader === undefined || authorizationHeader === null || authorizationHeader.trim() === "") {
    return { ok: false, reason: "missing_bearer_token" };
  }

  const [scheme] = authorizationHeader.trim().split(/\s+/u);
  if (scheme !== "Bearer") return { ok: false, reason: "unsupported_authorization_scheme" };

  const match = BEARER_AUTHORIZATION_PATTERN.exec(authorizationHeader.trim());
  if (!match) return { ok: false, reason: "malformed_authorization_header" };

  return { ok: true, value: match[1] };
}

async function verifyJwt(
  token: string,
  config: McpOAuthAccountLinkingBoundaryConfigV1,
  now: Date | undefined,
): Promise<{ ok: true; payload: JWTPayload } | { ok: false }> {
  try {
    const { payload } = await jwtVerify(token, createLocalJWKSet(config.jwks), {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: [...(config.allowedAlgorithms ?? DEFAULT_ALLOWED_ALGORITHMS)],
      clockTolerance: config.clockToleranceSeconds ?? 0,
      ...(now ? { currentDate: now } : {}),
    });

    if (!hasIntegerExpiration(payload.exp)) return { ok: false };
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}

function hasIntegerExpiration(exp: unknown): exp is number {
  return Number.isInteger(exp);
}

function collectScopes(payload: JWTPayload): readonly string[] {
  const scopes = new Set<string>();
  if (typeof payload.scope === "string") {
    payload.scope
      .split(/\s+/u)
      .filter(Boolean)
      .forEach((scope) => scopes.add(scope));
  }

  collectStringArrayClaim(payload.scp).forEach((scope) => scopes.add(scope));
  collectStringArrayClaim(payload.scopes).forEach((scope) => scopes.add(scope));

  return [...scopes].filter(isSafeScope).sort();
}

function collectStringArrayClaim(value: unknown): readonly string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function hasRequiredScopes(grantedScopes: readonly string[], requiredScopes: readonly string[]): boolean {
  const granted = new Set(grantedScopes);
  return requiredScopes.every((scope) => granted.has(scope));
}

function firstAllowedClientId(payload: JWTPayload, allowedClientIds: readonly string[]): string | undefined {
  const allowed = new Set(allowedClientIds);
  const clientCandidates = [readNonEmptyString(payload.client_id), readNonEmptyString(payload.azp)].filter(
    (value): value is string => value !== undefined,
  );
  return clientCandidates.find((clientId) => allowed.has(clientId));
}

function isValidConfig(config: McpOAuthAccountLinkingBoundaryConfigV1): boolean {
  return [
    config.provider === "stytch_connected_apps",
    isNonEmptyString(config.issuer),
    isNonEmptyString(config.audience),
    hasSafeRequiredScopes(config.requiredScopes),
    hasAllowedClientIds(config.allowedClientIds),
    isLocalJsonWebKeySet(config.jwks),
    hasAllowedAlgorithms(config.allowedAlgorithms),
    hasClockTolerance(config.clockToleranceSeconds),
  ].every(Boolean);
}

function isLocalJsonWebKeySet(value: unknown): value is JSONWebKeySet {
  if (typeof value !== "object" || value === null) return false;
  const keys = (value as { keys?: unknown }).keys;
  return Array.isArray(keys) && keys.length > 0 && keys.every(isRecordLike);
}

function hasSafeRequiredScopes(value: readonly string[]): boolean {
  return value.length > 0 && value.every(isSafeScope);
}

function hasAllowedClientIds(value: readonly string[]): boolean {
  return value.length > 0 && value.every(isNonEmptyString);
}

function hasAllowedAlgorithms(value: readonly string[] | undefined): boolean {
  return value === undefined || (value.length > 0 && value.every(isNonEmptyString));
}

function hasClockTolerance(value: number | undefined): boolean {
  return value === undefined || (Number.isInteger(value) && value >= 0);
}

function isSafeScope(value: unknown): value is string {
  return typeof value === "string" && SAFE_SCOPE_PATTERN.test(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function readNonEmptyString(value: unknown): string | undefined {
  return isNonEmptyString(value) ? value : undefined;
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deny(reason: McpOAuthAccountLinkingBoundaryDenialReasonV1): McpOAuthAccountLinkingBoundaryResultV1 {
  return {
    kind: "mcp_oauth_account_linking_boundary_result",
    allowed: false,
    reason,
    safeRefusal: {
      code: "auth_required",
      message: "Authorization required.",
      safeForModel: true,
      tokenEchoed: false,
      version: 1,
    },
    capabilities: capabilities("blocked"),
    version: 1,
  };
}

function capabilities(
  accountLinking: McpOAuthAccountLinkingBoundaryCapabilitiesV1["accountLinking"],
): McpOAuthAccountLinkingBoundaryCapabilitiesV1 {
  return {
    accountLinking,
    dataAccess: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    tokenStorage: "none",
    outboundIntrospection: "blocked",
    writeActions: "blocked",
    version: 1,
  };
}
