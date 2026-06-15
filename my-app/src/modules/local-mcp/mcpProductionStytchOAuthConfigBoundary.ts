import {
  createLocalJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  jwtVerify,
} from "jose";
import type { JWK, JSONWebKeySet, JWTPayload } from "jose";

export type McpProductionStytchOAuthReadScopeV1 =
  | "twoweeks.mcp.read"
  | "twoweeks.application_package.read"
  | "twoweeks.evidence_graph.read"
  | "twoweeks.resume_variant_plan.read"
  | "twoweeks.review_cockpit.read";

export type McpProductionStytchOAuthConfigV1 = Readonly<{
  kind: "mcp_production_stytch_oauth_config";
  provider: "stytch";
  issuer: string;
  audience: string;
  approvedClientIds: readonly string[];
  requiredReadScopes: readonly McpProductionStytchOAuthReadScopeV1[];
  jwks: JSONWebKeySet;
  jwksSource: "server_only_config";
  serverOnly: true;
  tokenStorage: "none";
  version: 1;
}>;

type McpProductionStytchOAuthConfigBoundaryInputV1 = Readonly<{
  kind: "mcp_production_stytch_oauth_config_boundary_input";
  authorizationHeader?: string | null;
  config?: unknown;
  now?: Date;
  version: 1;
}>;

export type McpProductionStytchOAuthDenialReasonV1 =
  | "invalid_input"
  | "invalid_configuration"
  | "malformed_jwks"
  | "missing_bearer_token"
  | "unsupported_authorization_scheme"
  | "malformed_authorization_header"
  | "malformed_token"
  | "unsupported_algorithm"
  | "missing_kid"
  | "unknown_kid"
  | "invalid_signature"
  | "missing_subject"
  | "missing_issuer"
  | "wrong_issuer"
  | "missing_audience"
  | "wrong_audience"
  | "missing_client_id"
  | "unauthorized_client"
  | "missing_scope"
  | "missing_required_scope"
  | "expired_token"
  | "future_nbf"
  | "malformed_claims";

export type McpProductionStytchOAuthCapabilitiesV1 = Readonly<{
  authDecision: "blocked" | "server_only";
  provider: "stytch";
  tokenVerification: "local_jwt_only";
  signingAlgorithm: "RS256_only";
  jwks: "server_provided_only";
  remoteJwks: "blocked";
  tokenIntrospection: "blocked";
  tokenStorage: "none";
  refreshTokenStorage: "none";
  dataReads: "blocked";
  dataWrites: "blocked";
  handlerExecution: "blocked";
  productionConnector: "blocked";
  modelCalls: "blocked";
  writeActions: "blocked";
  version: 1;
}>;

export type McpProductionStytchOAuthSafeRefusalV1 = Readonly<{
  code: "production_stytch_oauth_boundary_blocked";
  message: "Authorization required.";
  safeForModel: true;
  tokenEchoed: false;
  rawClaimsExposed: false;
  stytchSubjectExposed: false;
  version: 1;
}>;

export type McpProductionStytchOAuthConfigBoundaryResultV1 = Readonly<
  | {
      kind: "mcp_production_stytch_oauth_config_boundary_result";
      allowed: true;
      reason: "authorized_server_only";
      serverOnly: {
        provider: "stytch";
        authState: "verified_access_token";
        clientCategory: "approved_ai_client";
        resourceCategory: "twoweeks_mcp_resource";
        grantedReadScopes: readonly McpProductionStytchOAuthReadScopeV1[];
        requiredReadScopes: readonly McpProductionStytchOAuthReadScopeV1[];
        subjectBinding: "verified_stytch_subject_server_only_not_returned";
        offlineAccessStoresRefreshTokens: false;
        version: 1;
      };
      capabilities: McpProductionStytchOAuthCapabilitiesV1;
      modelVisible: false;
      version: 1;
    }
  | {
      kind: "mcp_production_stytch_oauth_config_boundary_result";
      allowed: false;
      reason: McpProductionStytchOAuthDenialReasonV1;
      safeRefusal: McpProductionStytchOAuthSafeRefusalV1;
      capabilities: McpProductionStytchOAuthCapabilitiesV1;
      modelVisible: false;
      version: 1;
    }
>;

type ClaimValidationFailure = Readonly<{
  ok: false;
  reason: McpProductionStytchOAuthDenialReasonV1;
}>;

const APPROVED_READ_SCOPES = [
  "twoweeks.application_package.read",
  "twoweeks.evidence_graph.read",
  "twoweeks.mcp.read",
  "twoweeks.resume_variant_plan.read",
  "twoweeks.review_cockpit.read",
] as const satisfies readonly McpProductionStytchOAuthReadScopeV1[];

const CONFIG_KEYS = [
  "kind",
  "provider",
  "issuer",
  "audience",
  "approvedClientIds",
  "requiredReadScopes",
  "jwks",
  "jwksSource",
  "serverOnly",
  "tokenStorage",
  "version",
] as const;

const INPUT_KEYS = [
  "kind",
  "authorizationHeader",
  "config",
  "now",
  "version",
] as const;

const BEARER_AUTHORIZATION_PATTERN =
  /^Bearer\s+([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/u;

export async function verifyMcpProductionStytchOAuthConfigBoundary(
  input: unknown,
): Promise<McpProductionStytchOAuthConfigBoundaryResultV1> {
  const parsedInput = parseInput(input);
  if (!parsedInput) return deny("invalid_input");

  const config = parseConfig(parsedInput.config);
  if (!config) return deny("invalid_configuration");
  if (!isWellFormedJwks(config.jwks)) return deny("malformed_jwks");

  const token = parseBearerToken(parsedInput.authorizationHeader);
  if (!token.ok) return deny(token.reason);

  const header = parseProtectedHeader(token.value);
  if (!header.ok) return deny(header.reason);

  const jwksKidState = validateJwksKid(config.jwks, header.kid);
  if (!jwksKidState.ok) return deny(jwksKidState.reason);

  const decodedClaims = parseUntrustedClaims(token.value);
  if (!decodedClaims.ok) return deny(decodedClaims.reason);

  const claimDecision = validateClaims(decodedClaims.payload, config, parsedInput.now);
  if (!claimDecision.ok) return deny(claimDecision.reason);

  const verified = await verifyLocalJwt(token.value, config, parsedInput.now);
  if (!verified) return deny("invalid_signature");

  return {
    kind: "mcp_production_stytch_oauth_config_boundary_result",
    allowed: true,
    reason: "authorized_server_only",
    serverOnly: {
      provider: "stytch",
      authState: "verified_access_token",
      clientCategory: "approved_ai_client",
      resourceCategory: "twoweeks_mcp_resource",
      grantedReadScopes: claimDecision.grantedReadScopes,
      requiredReadScopes: config.requiredReadScopes,
      subjectBinding: "verified_stytch_subject_server_only_not_returned",
      offlineAccessStoresRefreshTokens: false,
      version: 1,
    },
    capabilities: buildCapabilities("server_only"),
    modelVisible: false,
    version: 1,
  };
}

export function buildMcpProductionStytchOAuthSafeRefusal(): McpProductionStytchOAuthSafeRefusalV1 {
  return {
    code: "production_stytch_oauth_boundary_blocked",
    message: "Authorization required.",
    safeForModel: true,
    tokenEchoed: false,
    rawClaimsExposed: false,
    stytchSubjectExposed: false,
    version: 1,
  };
}

function parseInput(
  value: unknown,
): McpProductionStytchOAuthConfigBoundaryInputV1 | undefined {
  const record = readExactRecord(value, INPUT_KEYS);
  if (!record) return undefined;
  if (!hasValidInputEnvelope(record)) return undefined;
  const authorizationHeader = readOptionalAuthorizationHeader(record.authorizationHeader);
  if (authorizationHeader === false) return undefined;
  const now = readOptionalDate(record.now);
  if (now === false) return undefined;

  return {
    kind: "mcp_production_stytch_oauth_config_boundary_input",
    authorizationHeader,
    config: record.config,
    ...(now !== undefined ? { now } : {}),
    version: 1,
  };
}

function parseConfig(value: unknown): McpProductionStytchOAuthConfigV1 | undefined {
  const record = readExactRecord(value, CONFIG_KEYS);
  if (!record) return undefined;
  if (!hasValidConfigEnvelope(record)) return undefined;
  const fields = parseConfigFields(record);
  if (!fields) return undefined;

  return {
    kind: "mcp_production_stytch_oauth_config",
    provider: "stytch",
    ...fields,
    jwks: record.jwks as JSONWebKeySet,
    jwksSource: "server_only_config",
    serverOnly: true,
    tokenStorage: "none",
    version: 1,
  };
}

function hasValidInputEnvelope(record: Record<string, unknown>): boolean {
  return (
    record.kind === "mcp_production_stytch_oauth_config_boundary_input" &&
    record.version === 1
  );
}

function hasValidConfigEnvelope(record: Record<string, unknown>): boolean {
  return (
    record.kind === "mcp_production_stytch_oauth_config" &&
    record.provider === "stytch" &&
    record.jwksSource === "server_only_config" &&
    record.serverOnly === true &&
    record.tokenStorage === "none" &&
    record.version === 1
  );
}

function parseConfigFields(
  record: Record<string, unknown>,
): Pick<
  McpProductionStytchOAuthConfigV1,
  "issuer" | "audience" | "approvedClientIds" | "requiredReadScopes"
> | undefined {
  const issuer = readNonEmptyString(record.issuer);
  const audience = readNonEmptyString(record.audience);
  const approvedClientIds = readStringList(record.approvedClientIds);
  const requiredReadScopes = readRequiredReadScopes(record.requiredReadScopes);
  if (!issuer || !audience || !approvedClientIds || !requiredReadScopes) return undefined;
  return { issuer, audience, approvedClientIds, requiredReadScopes };
}

function readOptionalAuthorizationHeader(value: unknown): string | null | undefined | false {
  if (value === undefined || value === null) return value;
  return typeof value === "string" ? value : false;
}

function readOptionalDate(value: unknown): Date | undefined | false {
  if (value === undefined) return undefined;
  return value instanceof Date ? value : false;
}

function parseBearerToken(
  authorizationHeader: string | null | undefined,
):
  | { ok: true; value: string }
  | { ok: false; reason: McpProductionStytchOAuthDenialReasonV1 } {
  if (authorizationHeader === undefined || authorizationHeader === null || authorizationHeader.trim() === "") {
    return { ok: false, reason: "missing_bearer_token" };
  }
  const [scheme] = authorizationHeader.trim().split(/\s+/u);
  if (scheme !== "Bearer") return { ok: false, reason: "unsupported_authorization_scheme" };
  const match = BEARER_AUTHORIZATION_PATTERN.exec(authorizationHeader.trim());
  if (!match) return { ok: false, reason: "malformed_authorization_header" };
  return { ok: true, value: match[1] };
}

function parseProtectedHeader(
  token: string,
):
  | { ok: true; kid: string }
  | { ok: false; reason: McpProductionStytchOAuthDenialReasonV1 } {
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "RS256") return { ok: false, reason: "unsupported_algorithm" };
    const kid = readNonEmptyString(header.kid);
    if (!kid) return { ok: false, reason: "missing_kid" };
    return { ok: true, kid };
  } catch {
    return { ok: false, reason: "malformed_token" };
  }
}

function parseUntrustedClaims(
  token: string,
):
  | { ok: true; payload: JWTPayload }
  | { ok: false; reason: McpProductionStytchOAuthDenialReasonV1 } {
  try {
    return { ok: true, payload: decodeJwt(token) };
  } catch {
    return { ok: false, reason: "malformed_token" };
  }
}

function validateClaims(
  payload: JWTPayload,
  config: McpProductionStytchOAuthConfigV1,
  now: Date | undefined,
):
  | {
      ok: true;
      grantedReadScopes: readonly McpProductionStytchOAuthReadScopeV1[];
    }
  | ClaimValidationFailure {
  const subject = validateSubjectClaim(payload);
  if (!subject.ok) return subject;
  const issuer = validateIssuerClaim(payload, config.issuer);
  if (!issuer.ok) return issuer;
  const audience = validateAudienceClaim(payload, config.audience);
  if (!audience.ok) return audience;
  const client = validateClientClaim(payload, config.approvedClientIds);
  if (!client.ok) return client;
  const scope = validateScopeClaim(payload, config.requiredReadScopes);
  if (!scope.ok) return scope;
  const timing = validateTimingClaims(payload, now);
  if (!timing.ok) return timing;

  return { ok: true, grantedReadScopes: scope.grantedReadScopes };
}

function validateSubjectClaim(payload: JWTPayload): { ok: true } | ClaimValidationFailure {
  return readNonEmptyString(payload.sub) ? { ok: true } : invalidClaim("missing_subject");
}

function validateIssuerClaim(
  payload: JWTPayload,
  expectedIssuer: string,
): { ok: true } | ClaimValidationFailure {
  const issuer = readNonEmptyString(payload.iss);
  if (!issuer) return invalidClaim("missing_issuer");
  return issuer === expectedIssuer ? { ok: true } : invalidClaim("wrong_issuer");
}

function validateAudienceClaim(
  payload: JWTPayload,
  expectedAudience: string,
): { ok: true } | ClaimValidationFailure {
  const audience = readAudience(payload.aud);
  if (!audience) return invalidClaim("missing_audience");
  return audience.includes(expectedAudience) ? { ok: true } : invalidClaim("wrong_audience");
}

function validateClientClaim(
  payload: JWTPayload,
  approvedClientIds: readonly string[],
): { ok: true } | ClaimValidationFailure {
  const clientId = readNonEmptyString(payload.client_id);
  if (!clientId) return invalidClaim("missing_client_id");
  if (!approvedClientIds.includes(clientId)) return invalidClaim("unauthorized_client");
  if (payload.azp !== undefined && readNonEmptyString(payload.azp) !== clientId) {
    return invalidClaim("unauthorized_client");
  }
  return { ok: true };
}

function validateScopeClaim(
  payload: JWTPayload,
  requiredReadScopes: readonly McpProductionStytchOAuthReadScopeV1[],
):
  | { ok: true; grantedReadScopes: readonly McpProductionStytchOAuthReadScopeV1[] }
  | ClaimValidationFailure {
  const scope = readScopeClaim(payload.scope);
  if (!scope.ok) return scope;
  const grantedReadScopes = collectGrantedReadScopes(scope.value);
  if (!hasRequiredScopes(grantedReadScopes, requiredReadScopes)) {
    return invalidClaim("missing_required_scope");
  }
  return { ok: true, grantedReadScopes };
}

function validateTimingClaims(
  payload: JWTPayload,
  now: Date | undefined,
): { ok: true } | ClaimValidationFailure {
  const nowSeconds = Math.floor((now ?? new Date()).getTime() / 1000);
  if (!Number.isInteger(payload.exp)) return invalidClaim("malformed_claims");
  if (payload.exp <= nowSeconds) return invalidClaim("expired_token");
  if (payload.nbf !== undefined && !Number.isInteger(payload.nbf)) {
    return invalidClaim("malformed_claims");
  }
  if (typeof payload.nbf === "number" && payload.nbf > nowSeconds) {
    return invalidClaim("future_nbf");
  }
  return { ok: true };
}

function readScopeClaim(
  value: unknown,
): { ok: true; value: string } | ClaimValidationFailure {
  if (value === undefined || value === null || value === "") return invalidClaim("missing_scope");
  if (typeof value !== "string") return invalidClaim("malformed_claims");
  const scope = readNonEmptyString(value);
  return scope ? { ok: true, value: scope } : invalidClaim("missing_scope");
}

function invalidClaim(reason: McpProductionStytchOAuthDenialReasonV1): ClaimValidationFailure {
  return { ok: false, reason };
}

async function verifyLocalJwt(
  token: string,
  config: McpProductionStytchOAuthConfigV1,
  now: Date | undefined,
): Promise<boolean> {
  try {
    await jwtVerify(token, createLocalJWKSet(config.jwks), {
      issuer: config.issuer,
      audience: config.audience,
      algorithms: ["RS256"],
      clockTolerance: 0,
      ...(now ? { currentDate: now } : {}),
    });
    return true;
  } catch {
    return false;
  }
}

function isWellFormedJwks(value: unknown): value is JSONWebKeySet {
  const record = readPlainObjectRecord(value);
  if (!record) return false;
  const keys = record.keys;
  if (!Array.isArray(keys) || keys.length === 0) return false;
  return keys.every(isWellFormedRsaJwk);
}

function isWellFormedRsaJwk(value: unknown): value is JWK {
  const record = readPlainObjectRecord(value);
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

function validateJwksKid(
  jwks: JSONWebKeySet,
  kid: string,
):
  | { ok: true }
  | { ok: false; reason: "malformed_jwks" | "unknown_kid" } {
  const matchingKeys = jwks.keys.filter((key) => key.kid === kid);
  if (matchingKeys.length === 0) return { ok: false, reason: "unknown_kid" };
  if (matchingKeys.length > 1) return { ok: false, reason: "malformed_jwks" };
  return { ok: true };
}

function readAudience(value: unknown): readonly string[] | undefined {
  if (typeof value === "string" && value.trim()) return [value];
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((item): item is string => typeof item === "string" && item.trim().length > 0)
  ) {
    return value;
  }
  return undefined;
}

function collectGrantedReadScopes(scopeClaim: string): readonly McpProductionStytchOAuthReadScopeV1[] {
  const granted = new Set<McpProductionStytchOAuthReadScopeV1>();
  for (const scope of scopeClaim.split(/\s+/u).filter(Boolean)) {
    if (isApprovedReadScope(scope)) granted.add(scope);
  }
  return [...granted].sort();
}

function readRequiredReadScopes(value: unknown): readonly McpProductionStytchOAuthReadScopeV1[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const scopes = new Set<McpProductionStytchOAuthReadScopeV1>();
  for (const item of value) {
    if (!isApprovedReadScope(item)) return undefined;
    scopes.add(item);
  }
  if (!scopes.has("twoweeks.mcp.read")) return undefined;
  return [...scopes].sort();
}

function hasRequiredScopes(
  grantedReadScopes: readonly McpProductionStytchOAuthReadScopeV1[],
  requiredReadScopes: readonly McpProductionStytchOAuthReadScopeV1[],
): boolean {
  const granted = new Set(grantedReadScopes);
  return requiredReadScopes.every((scope) => granted.has(scope));
}

function isApprovedReadScope(value: unknown): value is McpProductionStytchOAuthReadScopeV1 {
  return (APPROVED_READ_SCOPES as readonly string[]).includes(String(value));
}

function readStringList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const strings: string[] = [];
  for (const item of value) {
    const next = readNonEmptyString(item);
    if (!next) return undefined;
    strings.push(next);
  }
  return [...new Set(strings)].sort();
}

function deny(
  reason: McpProductionStytchOAuthDenialReasonV1,
): McpProductionStytchOAuthConfigBoundaryResultV1 {
  return {
    kind: "mcp_production_stytch_oauth_config_boundary_result",
    allowed: false,
    reason,
    safeRefusal: buildMcpProductionStytchOAuthSafeRefusal(),
    capabilities: buildCapabilities("blocked"),
    modelVisible: false,
    version: 1,
  };
}

function buildCapabilities(
  authDecision: McpProductionStytchOAuthCapabilitiesV1["authDecision"],
): McpProductionStytchOAuthCapabilitiesV1 {
  return {
    authDecision,
    provider: "stytch",
    tokenVerification: "local_jwt_only",
    signingAlgorithm: "RS256_only",
    jwks: "server_provided_only",
    remoteJwks: "blocked",
    tokenIntrospection: "blocked",
    tokenStorage: "none",
    refreshTokenStorage: "none",
    dataReads: "blocked",
    dataWrites: "blocked",
    handlerExecution: "blocked",
    productionConnector: "blocked",
    modelCalls: "blocked",
    writeActions: "blocked",
    version: 1,
  };
}

function readExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | undefined {
  const record = readPlainObjectRecord(value);
  if (!record) return undefined;
  const actualKeys = Object.keys(record);
  if (actualKeys.length !== allowedKeys.length) return undefined;
  return allowedKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))
    ? record
    : undefined;
}

function readPlainObjectRecord(value: unknown): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null
    ? (value as Record<string, unknown>)
    : undefined;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && /\S/u.test(value) ? value : undefined;
}
