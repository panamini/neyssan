import {
  createLocalJWKSet,
  decodeJwt,
  decodeProtectedHeader,
  jwtVerify,
} from "jose";
import type { JWK, JSONWebKeySet, JWTPayload } from "jose";
import {
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpAuthVerifiedAccessTokenClaimsV1,
  type TwoweeksApplicationsReadScopeV1,
} from "./mcpAuthPolicyBoundary";
import type {
  McpBearerTokenVerifierInputV1,
  McpBearerTokenVerifierPortV1,
  McpBearerTokenVerifierRejectionReasonV1,
  McpBearerTokenVerificationResultV1,
} from "./mcpAuthRequestOrchestrator";

export type StytchMcpBearerVerifierConfigV1 = Readonly<{
  kind: "stytch_mcp_bearer_verifier_config";
  provider: "stytch";
  issuer: string;
  audience: string;
  approvedClientIds: readonly string[];
  requiredScope: TwoweeksApplicationsReadScopeV1;
  jwks: JSONWebKeySet;
  jwksSource: "server_only_config";
  serverOnly: true;
  providerEnvironment: string;
  allowedAlgorithm: "RS256";
  clockToleranceSeconds: number;
  tokenStorage: "none";
  version: 1;
}>;

type ParsedStytchMcpBearerVerifierConfigV1 = Readonly<{
  issuer: string;
  audience: string;
  approvedClientIds: readonly string[];
  requiredScope: TwoweeksApplicationsReadScopeV1;
  jwks: JSONWebKeySet;
  providerEnvironment: string;
  clockToleranceSeconds: number;
}>;

type ParsedVerifierInputV1 = Readonly<{
  rawBearerToken: string;
}>;

type ParsedVerifierInputPolicyV1 = Readonly<{
  rawBearerToken: string;
  expectedIssuer: string;
  expectedAudience: string;
  expectedProviderEnvironment: string;
  allowedClientIds: readonly string[];
}>;

type TokenTimingClaimsV1 = Readonly<{
  expiresAtEpochSeconds: number;
  notBeforeEpochSeconds?: number;
}>;

type TokenHeaderDecisionV1 = Readonly<
  | {
      ok: true;
      kid: string;
    }
  | {
      ok: false;
      reason: McpBearerTokenVerifierRejectionReasonV1;
    }
>;

type ClaimValidationDecisionV1 = Readonly<
  | {
      ok: true;
      claims: McpAuthVerifiedAccessTokenClaimsV1;
    }
  | {
      ok: false;
      reason: McpBearerTokenVerifierRejectionReasonV1;
    }
>;

const CONFIG_KEYS = [
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

const VERIFIER_INPUT_KEYS = [
  "rawBearerToken",
  "expectedIssuer",
  "expectedAudience",
  "requiredScope",
  "expectedProviderEnvironment",
  "allowedClientIds",
  "version",
] as const;

const COMPACT_JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u;
const LEGACY_DOTTED_SCOPE_DENYLIST = new Set([
  "twoweeks.application_package.read",
  "twoweeks.evidence_graph.read",
  "twoweeks.mcp.read",
  "twoweeks.resume_variant_plan.read",
  "twoweeks.review_cockpit.read",
]);

export function buildStytchMcpBearerTokenVerifier(
  config: StytchMcpBearerVerifierConfigV1,
): McpBearerTokenVerifierPortV1 {
  const parsedConfig = parseConfig(config);

  return async (input) => {
    if (!parsedConfig) return rejectToken("invalid_request");
    const parsedInput = parseVerifierInput(input, parsedConfig);
    if (!parsedInput.ok) return rejectToken(parsedInput.reason);

    const header = parseProtectedTokenHeader(parsedInput.value.rawBearerToken);
    if (!header.ok) return rejectToken(header.reason);

    const kidDecision = validateJwksKid(parsedConfig.jwks, header.kid);
    if (!kidDecision.ok) return rejectToken(kidDecision.reason);

    const unverifiedPayload = parseUnverifiedPayload(parsedInput.value.rawBearerToken);
    if (!unverifiedPayload.ok) return rejectToken(unverifiedPayload.reason);

    const verifiedPayload = await verifyLocalJwt(parsedInput.value.rawBearerToken, parsedConfig);
    if (!verifiedPayload.ok) return rejectToken("invalid_token");

    const verifiedClaims = validateVerifiedPayloadClaims(verifiedPayload.payload, parsedConfig);
    if (!verifiedClaims.ok) return rejectToken(verifiedClaims.reason);

    return Object.freeze({
      kind: "mcp_bearer_token_verification_result",
      verified: true,
      claims: verifiedClaims.claims,
      version: 1,
    });
  };
}

function parseConfig(
  value: unknown,
): ParsedStytchMcpBearerVerifierConfigV1 | undefined {
  const record = readDescriptorSafeExactRecord(value, CONFIG_KEYS);
  if (!record) return undefined;
  if (!hasValidConfigEnvelope(record)) return undefined;

  const issuer = readHttpsUrl(record.issuer);
  const audience = readHttpsUrl(record.audience);
  const approvedClientIds = readStringList(record.approvedClientIds);
  const providerEnvironment = readNonEmptyString(record.providerEnvironment);
  const clockToleranceSeconds = readNonNegativeInteger(record.clockToleranceSeconds);
  if (!issuer || !audience || !approvedClientIds || !providerEnvironment) return undefined;
  if (clockToleranceSeconds === undefined || !isWellFormedJwks(record.jwks)) return undefined;

  return Object.freeze({
    issuer,
    audience,
    approvedClientIds,
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    jwks: record.jwks,
    providerEnvironment,
    clockToleranceSeconds,
  });
}

function hasValidConfigEnvelope(record: Record<string, unknown>): boolean {
  return (
    record.kind === "stytch_mcp_bearer_verifier_config" &&
    record.provider === "stytch" &&
    record.requiredScope === TWOWEEKS_APPLICATIONS_READ_SCOPE &&
    record.jwksSource === "server_only_config" &&
    record.serverOnly === true &&
    record.allowedAlgorithm === "RS256" &&
    record.tokenStorage === "none" &&
    record.version === 1
  );
}

function parseVerifierInput(
  value: McpBearerTokenVerifierInputV1,
  config: ParsedStytchMcpBearerVerifierConfigV1,
):
  | { ok: true; value: ParsedVerifierInputV1 }
  | { ok: false; reason: McpBearerTokenVerifierRejectionReasonV1 } {
  const record = readDescriptorSafeExactRecord(value, VERIFIER_INPUT_KEYS);
  if (!record || record.version !== 1) return { ok: false, reason: "invalid_request" };

  const policy = readVerifierInputPolicy(record);
  if (!policy) return { ok: false, reason: "invalid_request" };
  if (!COMPACT_JWT_PATTERN.test(policy.rawBearerToken)) {
    return { ok: false, reason: "invalid_token" };
  }
  if (record.requiredScope !== TWOWEEKS_APPLICATIONS_READ_SCOPE) {
    return { ok: false, reason: "insufficient_scope" };
  }
  if (!verifierPolicyMatchesConfig(policy, config)) return { ok: false, reason: "invalid_request" };

  return { ok: true, value: Object.freeze({ rawBearerToken: policy.rawBearerToken }) };
}

function readVerifierInputPolicy(record: Record<string, unknown>): ParsedVerifierInputPolicyV1 | undefined {
  const rawBearerToken = readNonEmptyString(record.rawBearerToken);
  const expectedIssuer = readNonEmptyString(record.expectedIssuer);
  const expectedAudience = readNonEmptyString(record.expectedAudience);
  const expectedProviderEnvironment = readNonEmptyString(record.expectedProviderEnvironment);
  const allowedClientIds = readStringList(record.allowedClientIds);
  if (!rawBearerToken || !expectedIssuer || !expectedAudience || !expectedProviderEnvironment || !allowedClientIds) {
    return undefined;
  }
  return Object.freeze({
    rawBearerToken,
    expectedIssuer,
    expectedAudience,
    expectedProviderEnvironment,
    allowedClientIds,
  });
}

function verifierPolicyMatchesConfig(
  policy: ParsedVerifierInputPolicyV1,
  config: ParsedStytchMcpBearerVerifierConfigV1,
): boolean {
  return (
    policy.expectedIssuer === config.issuer &&
    policy.expectedAudience === config.audience &&
    policy.expectedProviderEnvironment === config.providerEnvironment &&
    sameStringSet(policy.allowedClientIds, config.approvedClientIds)
  );
}

function parseProtectedTokenHeader(token: string): TokenHeaderDecisionV1 {
  try {
    const header = decodeProtectedHeader(token);
    if (header.alg !== "RS256") return { ok: false, reason: "invalid_token" };
    const kid = readNonEmptyString(header.kid);
    if (!kid) return { ok: false, reason: "invalid_token" };
    return { ok: true, kid };
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
}

function parseUnverifiedPayload(
  token: string,
): { ok: true; payload: JWTPayload } | { ok: false; reason: "invalid_token" } {
  try {
    return { ok: true, payload: decodeJwt(token) };
  } catch {
    return { ok: false, reason: "invalid_token" };
  }
}

function validateVerifiedPayloadClaims(
  payload: JWTPayload,
  config: ParsedStytchMcpBearerVerifierConfigV1,
): ClaimValidationDecisionV1 {
  if (!tokenMatchesIssuerAudienceAndEnvironment(payload, config)) return { ok: false, reason: "invalid_token" };
  const subject = readNonEmptyString(payload.sub);
  if (!subject) return { ok: false, reason: "invalid_token" };

  const timing = readValidTimingClaims(payload, config.clockToleranceSeconds);
  if (!timing) return { ok: false, reason: "invalid_token" };
  const clientId = readApprovedClientId(payload, config.approvedClientIds);
  if (!clientId) return { ok: false, reason: "invalid_token" };

  const scopes = collectScopes(payload);
  if (scopes === undefined) return { ok: false, reason: "invalid_token" };
  if (scopes.some((scope) => LEGACY_DOTTED_SCOPE_DENYLIST.has(scope))) {
    return { ok: false, reason: "insufficient_scope" };
  }
  if (!scopes.includes(TWOWEEKS_APPLICATIONS_READ_SCOPE)) {
    return { ok: false, reason: "insufficient_scope" };
  }

  return {
    ok: true,
    claims: Object.freeze({
      kind: "mcp_auth_verified_access_token_claims",
      cryptographicVerification: "already_verified_by_provider_adapter",
      issuer: config.issuer,
      audience: config.audience,
      subject,
      expiresAtEpochSeconds: timing.expiresAtEpochSeconds,
      ...(timing.notBeforeEpochSeconds !== undefined ? { notBeforeEpochSeconds: timing.notBeforeEpochSeconds } : {}),
      clientId,
      grantedScopes: Object.freeze([TWOWEEKS_APPLICATIONS_READ_SCOPE]),
      providerEnvironment: config.providerEnvironment,
      version: 1,
    }),
  };
}

function tokenMatchesIssuerAudienceAndEnvironment(
  payload: JWTPayload,
  config: ParsedStytchMcpBearerVerifierConfigV1,
): boolean {
  return (
    readNonEmptyString(payload.iss) === config.issuer &&
    tokenMatchesAudienceOrResource(payload, config.audience) &&
    providerEnvironmentMatches(payload, config.providerEnvironment)
  );
}

function readValidTimingClaims(
  payload: JWTPayload,
  clockToleranceSeconds: number,
): TokenTimingClaimsV1 | undefined {
  const expiresAtEpochSeconds = readNonNegativeInteger(payload.exp);
  const notBeforeEpochSeconds = readOptionalNonNegativeInteger(payload.nbf);
  if (expiresAtEpochSeconds === undefined || notBeforeEpochSeconds === false) return undefined;

  const nowEpochSeconds = Math.floor(Date.now() / 1000);
  if (nowEpochSeconds - clockToleranceSeconds >= expiresAtEpochSeconds) return undefined;
  if (notBeforeEpochSeconds !== undefined && nowEpochSeconds + clockToleranceSeconds < notBeforeEpochSeconds) {
    return undefined;
  }

  return Object.freeze({
    expiresAtEpochSeconds,
    ...(notBeforeEpochSeconds !== undefined ? { notBeforeEpochSeconds } : {}),
  });
}

async function verifyLocalJwt(
  token: string,
  config: ParsedStytchMcpBearerVerifierConfigV1,
): Promise<{ ok: true; payload: JWTPayload } | { ok: false }> {
  try {
    const { payload } = await jwtVerify(token, createLocalJWKSet(config.jwks), {
      algorithms: ["RS256"],
      clockTolerance: config.clockToleranceSeconds,
    });
    return { ok: true, payload };
  } catch {
    return { ok: false };
  }
}

function tokenMatchesAudienceOrResource(payload: JWTPayload, expectedAudience: string): boolean {
  const audiences = readStringClaimList(payload.aud);
  const resources = readStringClaimList(readPayloadClaim(payload, "resource"));
  return [...audiences, ...resources].includes(expectedAudience);
}

function readApprovedClientId(payload: JWTPayload, approvedClientIds: readonly string[]): string | undefined {
  const clientId = readNonEmptyString(readPayloadClaim(payload, "client_id"));
  const authorizedParty = readNonEmptyString(payload.azp);
  const candidates = [clientId, authorizedParty].filter((value): value is string => value !== undefined);
  if (candidates.length === 0) return undefined;
  if (!candidates.every((candidate) => approvedClientIds.includes(candidate))) return undefined;
  if (new Set(candidates).size !== 1) return undefined;
  return candidates[0];
}

function providerEnvironmentMatches(payload: JWTPayload, expectedProviderEnvironment: string): boolean {
  const environmentClaim = [
    readPayloadClaim(payload, "provider_environment"),
    readPayloadClaim(payload, "project_environment"),
    readPayloadClaim(payload, "stytch_project_environment"),
  ]
    .map(readNonEmptyString)
    .find((value): value is string => value !== undefined);
  return environmentClaim === expectedProviderEnvironment;
}

function collectScopes(payload: JWTPayload): readonly string[] | undefined {
  const scopes = new Set<string>();
  const scopeClaim = readPayloadClaim(payload, "scope");
  if (typeof scopeClaim === "string") {
    scopeClaim
      .split(/\s+/u)
      .filter(Boolean)
      .forEach((scope) => scopes.add(scope));
  } else if (scopeClaim !== undefined) {
    return undefined;
  }
  const scp = readOptionalStringClaimList(readPayloadClaim(payload, "scp"));
  const scopeArray = readOptionalStringClaimList(readPayloadClaim(payload, "scopes"));
  if (scp === false || scopeArray === false) return undefined;
  for (const scope of scp ?? []) scopes.add(scope);
  for (const scope of scopeArray ?? []) scopes.add(scope);
  return Object.freeze([...scopes].sort());
}

function readPayloadClaim(payload: JWTPayload, key: string): unknown {
  return (payload as Readonly<Record<string, unknown>>)[key];
}

function validateJwksKid(
  jwks: JSONWebKeySet,
  kid: string,
): { ok: true } | { ok: false; reason: "invalid_token" } {
  const matchingKeys = jwks.keys.filter((key) => key.kid === kid);
  return matchingKeys.length === 1 ? { ok: true } : { ok: false, reason: "invalid_token" };
}

function isWellFormedJwks(value: unknown): value is JSONWebKeySet {
  const record = readDescriptorSafePlainObjectRecord(value);
  if (!record) return false;
  const keys = record.keys;
  if (!Array.isArray(keys) || keys.length === 0) return false;
  return keys.every(isWellFormedRsaJwk);
}

function isWellFormedRsaJwk(value: unknown): value is JWK {
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

function readDescriptorSafeExactRecord(
  value: unknown,
  allowedKeys: readonly string[],
): Record<string, unknown> | undefined {
  const record = readDescriptorSafePlainObjectRecord(value);
  if (!record) return undefined;
  const actualKeys = Reflect.ownKeys(record);
  if (actualKeys.length !== allowedKeys.length) return undefined;
  return allowedKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))
    ? record
    : undefined;
}

function readDescriptorSafePlainObjectRecord(value: unknown): Record<string, unknown> | undefined {
  const descriptors = readDescriptorSafePlainObjectDescriptors(value);
  return descriptors ? readDescriptorValues(descriptors) : undefined;
}

function readDescriptorSafePlainObjectDescriptors(
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

function readDescriptorValues(
  descriptors: Record<PropertyKey, PropertyDescriptor | undefined>,
): Record<string, unknown> | undefined {
  const record: Record<string, unknown> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    const entry = readDescriptorValue(key, descriptors[key]);
    if (!entry) return undefined;
    record[entry.key] = entry.value;
  }
  return record;
}

function readDescriptorValue(
  key: PropertyKey,
  descriptor: PropertyDescriptor | undefined,
): { key: string; value: unknown } | undefined {
  if (typeof key !== "string") return undefined;
  if (!descriptor || descriptor.enumerable !== true || !("value" in descriptor)) return undefined;
  return { key, value: descriptor.value };
}

function readHttpsUrl(value: unknown): string | undefined {
  const text = readNonEmptyString(value);
  if (!text) return undefined;
  try {
    const parsed = new URL(text);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash) {
      return undefined;
    }
    return parsed.href;
  } catch {
    return undefined;
  }
}

function readStringList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const strings = value.map(readNonEmptyString);
  if (!strings.every((item): item is string => item !== undefined)) return undefined;
  return Object.freeze([...new Set(strings)].sort());
}

function readStringClaimList(value: unknown): readonly string[] {
  if (typeof value === "string") {
    const text = readNonEmptyString(value);
    return text ? Object.freeze([text]) : Object.freeze([]);
  }
  if (!Array.isArray(value)) return Object.freeze([]);
  const strings = value.map(readNonEmptyString);
  return strings.every((item): item is string => item !== undefined)
    ? Object.freeze(strings)
    : Object.freeze([]);
}

function readOptionalStringClaimList(value: unknown): readonly string[] | undefined | false {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return false;
  const strings = value.map(readNonEmptyString);
  return strings.every((item): item is string => item !== undefined)
    ? Object.freeze(strings)
    : false;
}

function sameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item) => right.includes(item));
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && /\S/u.test(value) ? value : undefined;
}

function readNonNegativeInteger(value: unknown): number | undefined {
  return Number.isInteger(value) && typeof value === "number" && value >= 0 ? value : undefined;
}

function readOptionalNonNegativeInteger(value: unknown): number | undefined | false {
  if (value === undefined) return undefined;
  return Number.isInteger(value) && typeof value === "number" && value >= 0 ? value : false;
}

function rejectToken(
  reason: McpBearerTokenVerifierRejectionReasonV1,
): McpBearerTokenVerificationResultV1 {
  return Object.freeze({
    kind: "mcp_bearer_token_verification_result",
    verified: false,
    reason,
    version: 1,
  });
}
