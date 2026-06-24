import type { LocalMcpAccountLinkingStorageRecordStateV1 } from "./mcpAccountLinkingStorageBoundary";

export const TWOWEEKS_APPLICATIONS_READ_SCOPE = "twoweeks:applications:read" as const;

export type TwoweeksApplicationsReadScopeV1 = typeof TWOWEEKS_APPLICATIONS_READ_SCOPE;

export type McpProtectedResourceMetadataV1 = Readonly<{
  resource: string;
  authorization_servers: readonly string[];
  scopes_supported: readonly TwoweeksApplicationsReadScopeV1[];
  resource_documentation?: string;
}>;

export type McpProtectedResourceMetadataInputV1 = Readonly<{
  resourceUrl: string;
  protectedResourceMetadataUrl: string;
  authorizationServerIssuerUrl: string;
  supportedScopes: readonly string[];
  resourceDocumentationUrl?: string;
}>;

export type McpBearerAuthChallengeReasonV1 =
  | "missing_token"
  | "invalid_token"
  | "insufficient_scope"
  | "account_link_required"
  | "reauthorization_required";

export type McpBearerAuthChallengeErrorV1 =
  | "invalid_token"
  | "insufficient_scope"
  | "account_link_required"
  | "reauthorization_required";

export type McpBearerAuthChallengeInputV1 = Readonly<{
  reason: McpBearerAuthChallengeReasonV1;
  protectedResourceMetadataUrl: string;
  error?: string;
  errorDescription?: string;
}>;

export type McpBearerAuthChallengeV1 = Readonly<{
  kind: "mcp_auth_bearer_challenge";
  reason: McpBearerAuthChallengeReasonV1;
  header: string;
  version: 1;
}>;

export type McpWwwAuthenticateMetaV1 = Readonly<{
  "mcp/www_authenticate": readonly string[];
}>;

export type McpFutureApplicationsReadSecuritySchemeV1 = Readonly<{
  type: "oauth2";
  scopes: readonly [TwoweeksApplicationsReadScopeV1];
}>;

export type McpAuthVerifiedClaimsProofV1 = "already_verified_by_provider_adapter";

export type McpAuthVerifiedAccessTokenClaimsV1 = Readonly<{
  kind: "mcp_auth_verified_access_token_claims";
  cryptographicVerification: McpAuthVerifiedClaimsProofV1;
  issuer: string;
  audience: string | readonly string[];
  subject: string;
  expiresAtEpochSeconds: number;
  notBeforeEpochSeconds?: number;
  clientId?: string;
  grantedScopes: readonly string[];
  providerEnvironment: string;
  version: 1;
}>;

export type McpAuthVerifiedClaimsPolicyV1 = Readonly<{
  expectedIssuer: string;
  expectedAudience: string;
  requiredScope: TwoweeksApplicationsReadScopeV1;
  allowedClientIds?: readonly string[];
  expectedProviderEnvironment: string;
  nowEpochSeconds: number;
  clockSkewSeconds?: number;
  version: 1;
}>;

export type McpAuthPolicyAuthorizedPrincipalV1 = Readonly<{
  kind: "mcp_auth_policy_authorized_principal";
  issuer: string;
  subject: string;
  audience: string;
  clientId?: string;
  grantedScopes: readonly TwoweeksApplicationsReadScopeV1[];
  providerEnvironment: string;
  version: 1;
}>;

export type McpAuthVerifiedClaimsPolicyFailureReasonV1 =
  | "cryptographic_verification_prerequisite_missing"
  | "wrong_issuer"
  | "wrong_audience"
  | "expired"
  | "not_yet_valid"
  | "unknown_client"
  | "missing_scope"
  | "missing_subject"
  | "wrong_environment"
  | "malformed_claims"
  | "malformed_policy";

export type McpAuthVerifiedClaimsPolicyDecisionV1 = Readonly<
  | {
      kind: "mcp_auth_verified_claims_policy_decision";
      authorized: true;
      reason: "authorized";
      serverOnly: {
        policyAuthorizedPrincipal: McpAuthPolicyAuthorizedPrincipalV1;
      };
      modelVisible: false;
      version: 1;
    }
  | {
      kind: "mcp_auth_verified_claims_policy_decision";
      authorized: false;
      reason: McpAuthVerifiedClaimsPolicyFailureReasonV1;
      safeFailure: McpAuthPolicySafeFailureV1;
      modelVisible: false;
      version: 1;
    }
>;

export type McpAuthPolicySafeFailureV1 = Readonly<{
  code: "auth_policy_denied";
  message: "Authorization denied.";
  safeForModel: true;
  rawClaimsExposed: false;
  tokenEchoed: false;
  version: 1;
}>;

export type McpAuthPolicyAccountLinkRecordV1 = Readonly<{
  kind: "mcp_auth_policy_account_link_record";
  issuer: string;
  subject: string;
  providerEnvironment: string;
  clientId: string;
  twoweeksClerkId: string;
  grantedScopes: readonly string[];
  state: LocalMcpAccountLinkingStorageRecordStateV1;
  createdAtEpochSeconds: number;
  updatedAtEpochSeconds: number;
  expiresAtEpochSeconds: number;
  displayEmail?: string;
  version: 1;
}>;

export type McpAuthPolicyAccountLinkResolutionReasonV1 =
  | "resolved"
  | "missing_account_link"
  | "duplicate_account_link"
  | "revoked_account_link"
  | "stale_account_link"
  | "expired_account_link"
  | "issuer_mismatch"
  | "subject_mismatch"
  | "wrong_environment"
  | "disallowed_client"
  | "missing_required_scope"
  | "identity_override_forbidden"
  | "malformed_account_link";

export type McpAuthPolicyAccountLinkResolutionV1 = Readonly<
  | {
      kind: "mcp_auth_account_link_resolution";
      resolved: true;
      reason: "resolved";
      serverOnly: {
        twoweeksClerkId: string;
        grantedScopes: readonly TwoweeksApplicationsReadScopeV1[];
        version: 1;
      };
      modelVisible: false;
      version: 1;
    }
  | {
      kind: "mcp_auth_account_link_resolution";
      resolved: false;
      reason: Exclude<McpAuthPolicyAccountLinkResolutionReasonV1, "resolved">;
      safeFailure: McpAuthPolicyAccountLinkSafeFailureV1;
      modelVisible: false;
      version: 1;
    }
>;

export type McpAuthPolicyAccountLinkSafeFailureV1 = Readonly<{
  code: "account_link_denied";
  message: "Account link denied.";
  safeForModel: true;
  identityEchoed: false;
  version: 1;
}>;

const METADATA_INPUT_KEYS = [
  "resourceUrl",
  "protectedResourceMetadataUrl",
  "authorizationServerIssuerUrl",
  "supportedScopes",
  "resourceDocumentationUrl",
] as const;
const VERIFIED_CLAIMS_ALLOWED_KEYS = [
  "kind",
  "cryptographicVerification",
  "issuer",
  "audience",
  "subject",
  "expiresAtEpochSeconds",
  "notBeforeEpochSeconds",
  "clientId",
  "grantedScopes",
  "providerEnvironment",
  "version",
] as const;
const VERIFIED_CLAIMS_REQUIRED_KEYS = [
  "kind",
  "cryptographicVerification",
  "issuer",
  "audience",
  "subject",
  "expiresAtEpochSeconds",
  "grantedScopes",
  "providerEnvironment",
  "version",
] as const;
const POLICY_KEYS = [
  "expectedIssuer",
  "expectedAudience",
  "requiredScope",
  "allowedClientIds",
  "expectedProviderEnvironment",
  "nowEpochSeconds",
  "clockSkewSeconds",
  "version",
] as const;
const ACCOUNT_LINK_ALLOWED_KEYS = [
  "kind",
  "issuer",
  "subject",
  "providerEnvironment",
  "clientId",
  "twoweeksClerkId",
  "grantedScopes",
  "state",
  "createdAtEpochSeconds",
  "updatedAtEpochSeconds",
  "expiresAtEpochSeconds",
  "displayEmail",
  "version",
] as const;
const ACCOUNT_LINK_REQUIRED_KEYS = [
  "kind",
  "issuer",
  "subject",
  "providerEnvironment",
  "clientId",
  "twoweeksClerkId",
  "grantedScopes",
  "state",
  "createdAtEpochSeconds",
  "updatedAtEpochSeconds",
  "expiresAtEpochSeconds",
  "version",
] as const;
const IDENTITY_OVERRIDE_KEYS = new Set([
  "userId",
  "workspaceId",
  "clerkId",
  "twoweeksClerkId",
  "owner",
  "ownerId",
  "email",
]);
const SAFE_HEADER_TOKEN_PATTERN = /^[a-z][a-z0-9_]{2,64}$/u;
const SAFE_DESCRIPTION_PATTERN = /^[A-Za-z0-9 .,:;!?()/-]{1,160}$/u;

export function buildProtectedResourceMetadata(
  input: McpProtectedResourceMetadataInputV1,
): McpProtectedResourceMetadataV1 {
  const record = readRecordWithAllowedKeys(input, METADATA_INPUT_KEYS);
  if (!record) throw new TypeError("Protected-resource metadata input is malformed.");

  const resource = parseSafeHttpsUrl(record.resourceUrl, "resource URL");
  parseSafeHttpsUrl(record.protectedResourceMetadataUrl, "protected resource metadata URL");
  const authorizationServer = parseSafeHttpsUrl(
    record.authorizationServerIssuerUrl,
    "authorization server issuer URL",
  );
  const scopes = parseApprovedScopeList(record.supportedScopes);
  const documentation =
    record.resourceDocumentationUrl === undefined
      ? undefined
      : parseSafeHttpsUrl(record.resourceDocumentationUrl, "resource documentation URL");

  const metadata: McpProtectedResourceMetadataV1 = Object.freeze({
    resource,
    authorization_servers: Object.freeze([authorizationServer]),
    scopes_supported: scopes,
    ...(documentation ? { resource_documentation: documentation } : {}),
  });
  return metadata;
}

export function buildBearerAuthChallenge(
  input: McpBearerAuthChallengeInputV1,
): McpBearerAuthChallengeV1 {
  const metadataUrl = parseSafeHttpsUrl(
    input.protectedResourceMetadataUrl,
    "protected resource metadata URL",
  );
  const error = readSafeHeaderToken(input.error ?? defaultChallengeError(input.reason));
  const errorDescription = readSafeDescription(
    input.errorDescription ?? defaultChallengeDescription(input.reason),
  );

  return Object.freeze({
    kind: "mcp_auth_bearer_challenge",
    reason: input.reason,
    header: [
      `Bearer resource_metadata="${metadataUrl}"`,
      `error="${error}"`,
      `error_description="${errorDescription}"`,
      `scope="${TWOWEEKS_APPLICATIONS_READ_SCOPE}"`,
    ].join(", "),
    version: 1,
  });
}

export function buildMcpWwwAuthenticateMeta(
  challenge: McpBearerAuthChallengeV1,
): McpWwwAuthenticateMetaV1 {
  return Object.freeze({
    "mcp/www_authenticate": Object.freeze([challenge.header]),
  });
}

export function buildFutureTwoweeksApplicationsReadSecuritySchemes(): readonly [
  McpFutureApplicationsReadSecuritySchemeV1,
] {
  const scopes = Object.freeze([TWOWEEKS_APPLICATIONS_READ_SCOPE] as const);
  const scheme: McpFutureApplicationsReadSecuritySchemeV1 = Object.freeze({
    type: "oauth2",
    scopes,
  });
  return Object.freeze([scheme] as const);
}

export function evaluateMcpAuthVerifiedClaimsPolicy(
  input: Readonly<{
    claims: McpAuthVerifiedAccessTokenClaimsV1;
    policy: McpAuthVerifiedClaimsPolicyV1;
  }>,
): McpAuthVerifiedClaimsPolicyDecisionV1 {
  const policy = parsePolicy(input.policy);
  if (!policy) return denyClaims("malformed_policy");

  const claims = parseVerifiedClaims(input.claims);
  if (!claims.ok) return denyClaims(claims.reason);

  if (claims.value.issuer !== policy.expectedIssuer) return denyClaims("wrong_issuer");
  if (!claims.value.audience.includes(policy.expectedAudience)) return denyClaims("wrong_audience");
  if (!claims.value.subject) return denyClaims("missing_subject");
  if (isExpired(claims.value.expiresAtEpochSeconds, policy.nowEpochSeconds, policy.clockSkewSeconds)) {
    return denyClaims("expired");
  }
  if (
    claims.value.notBeforeEpochSeconds !== undefined &&
    isNotYetValid(claims.value.notBeforeEpochSeconds, policy.nowEpochSeconds, policy.clockSkewSeconds)
  ) {
    return denyClaims("not_yet_valid");
  }
  if (policy.allowedClientIds.length > 0) {
    if (!claims.value.clientId || !policy.allowedClientIds.includes(claims.value.clientId)) {
      return denyClaims("unknown_client");
    }
  }
  if (!claims.value.grantedScopes.includes(policy.requiredScope)) return denyClaims("missing_scope");
  if (claims.value.providerEnvironment !== policy.expectedProviderEnvironment) {
    return denyClaims("wrong_environment");
  }

  return Object.freeze({
    kind: "mcp_auth_verified_claims_policy_decision",
    authorized: true,
    reason: "authorized",
    serverOnly: {
      policyAuthorizedPrincipal: Object.freeze({
        kind: "mcp_auth_policy_authorized_principal",
        issuer: claims.value.issuer,
        subject: claims.value.subject,
        audience: policy.expectedAudience,
        ...(claims.value.clientId ? { clientId: claims.value.clientId } : {}),
        grantedScopes: Object.freeze([TWOWEEKS_APPLICATIONS_READ_SCOPE]),
        providerEnvironment: claims.value.providerEnvironment,
        version: 1,
      }),
    },
    modelVisible: false,
    version: 1,
  });
}

export function resolveMcpAuthPolicyAccountLink(
  input: Readonly<{
    principal: McpAuthPolicyAuthorizedPrincipalV1;
    accountLinks: readonly unknown[];
    requiredScope: TwoweeksApplicationsReadScopeV1;
    nowEpochSeconds: number;
    requestArguments?: unknown;
    version: 1;
  }>,
): McpAuthPolicyAccountLinkResolutionV1 {
  if (containsIdentityOverride(input.requestArguments)) {
    return denyAccountLink("identity_override_forbidden");
  }
  if (!Number.isInteger(input.nowEpochSeconds) || input.requiredScope !== TWOWEEKS_APPLICATIONS_READ_SCOPE) {
    return denyAccountLink("missing_required_scope");
  }
  if (input.accountLinks.length === 0) return denyAccountLink("missing_account_link");

  const records = input.accountLinks.map(parseAccountLinkRecord);
  if (records.some((record) => record === undefined)) return denyAccountLink("malformed_account_link");
  const links = records.filter((record): record is ParsedAccountLinkRecordV1 => record !== undefined);

  const issuerMatches = links.filter((link) => link.issuer === input.principal.issuer);
  if (issuerMatches.length === 0) return denyAccountLink("issuer_mismatch");

  const subjectMatches = issuerMatches.filter((link) => link.subject === input.principal.subject);
  if (subjectMatches.length === 0) return denyAccountLink("subject_mismatch");

  const environmentMatches = subjectMatches.filter(
    (link) => link.providerEnvironment === input.principal.providerEnvironment,
  );
  if (environmentMatches.length === 0) return denyAccountLink("wrong_environment");

  const clientMatches = environmentMatches.filter(
    (link) => input.principal.clientId !== undefined && link.clientId === input.principal.clientId,
  );
  if (clientMatches.length === 0) return denyAccountLink("disallowed_client");
  if (clientMatches.length > 1) return denyAccountLink("duplicate_account_link");

  const link = clientMatches[0];
  if (link.state === "revoked") return denyAccountLink("revoked_account_link");
  if (link.state === "stale") return denyAccountLink("stale_account_link");
  if (link.expiresAtEpochSeconds <= input.nowEpochSeconds) return denyAccountLink("expired_account_link");
  if (
    !input.principal.grantedScopes.includes(input.requiredScope) ||
    !link.grantedScopes.includes(input.requiredScope)
  ) {
    return denyAccountLink("missing_required_scope");
  }

  const grantedScopes: readonly TwoweeksApplicationsReadScopeV1[] = Object.freeze([
    TWOWEEKS_APPLICATIONS_READ_SCOPE,
  ]);

  return Object.freeze({
    kind: "mcp_auth_account_link_resolution",
    resolved: true,
    reason: "resolved",
    serverOnly: {
      twoweeksClerkId: link.twoweeksClerkId,
      grantedScopes,
      version: 1 as const,
    },
    modelVisible: false,
    version: 1,
  });
}

type ParsedVerifiedClaimsV1 = Readonly<{
  issuer: string;
  audience: readonly string[];
  subject: string;
  expiresAtEpochSeconds: number;
  notBeforeEpochSeconds?: number;
  clientId?: string;
  grantedScopes: readonly TwoweeksApplicationsReadScopeV1[];
  providerEnvironment: string;
}>;

type ParsedPolicyV1 = Readonly<{
  expectedIssuer: string;
  expectedAudience: string;
  requiredScope: TwoweeksApplicationsReadScopeV1;
  allowedClientIds: readonly string[];
  expectedProviderEnvironment: string;
  nowEpochSeconds: number;
  clockSkewSeconds: number;
}>;

type ParsedAccountLinkRecordV1 = Readonly<{
  issuer: string;
  subject: string;
  providerEnvironment: string;
  clientId: string;
  twoweeksClerkId: string;
  grantedScopes: readonly TwoweeksApplicationsReadScopeV1[];
  state: LocalMcpAccountLinkingStorageRecordStateV1;
  expiresAtEpochSeconds: number;
}>;

function parseSafeHttpsUrl(value: unknown, label: string): string {
  if (typeof value !== "string" || !isSafeHeaderText(value)) {
    throw new TypeError(`${label} is malformed.`);
  }
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new TypeError(`${label} is malformed.`);
  }
  if (parsed.protocol !== "https:") throw new TypeError(`${label} must use HTTPS.`);
  if (parsed.username || parsed.password) throw new TypeError(`${label} must not include credentials.`);
  if (parsed.hash) throw new TypeError(`${label} must not include fragments.`);
  return parsed.href;
}

function parseApprovedScopeList(value: unknown): readonly [TwoweeksApplicationsReadScopeV1] {
  if (
    !Array.isArray(value) ||
    value.length !== 1 ||
    value[0] !== TWOWEEKS_APPLICATIONS_READ_SCOPE
  ) {
    throw new TypeError("Protected-resource metadata requires the approved read scope.");
  }
  return Object.freeze([TWOWEEKS_APPLICATIONS_READ_SCOPE]);
}

function defaultChallengeError(
  reason: McpBearerAuthChallengeReasonV1,
): McpBearerAuthChallengeErrorV1 {
  switch (reason) {
    case "missing_token":
    case "invalid_token":
      return "invalid_token";
    case "insufficient_scope":
      return "insufficient_scope";
    case "account_link_required":
      return "account_link_required";
    case "reauthorization_required":
      return "reauthorization_required";
    default:
      return exhaustive(reason);
  }
}

function defaultChallengeDescription(reason: McpBearerAuthChallengeReasonV1): string {
  switch (reason) {
    case "missing_token":
      return "Access token required.";
    case "invalid_token":
      return "Access token is invalid.";
    case "insufficient_scope":
      return "Required read scope missing.";
    case "account_link_required":
      return "Account link required.";
    case "reauthorization_required":
      return "Reauthorization required.";
    default:
      return exhaustive(reason);
  }
}

function readSafeHeaderToken(value: string): string {
  if (!SAFE_HEADER_TOKEN_PATTERN.test(value)) {
    throw new TypeError("Bearer challenge error value is unsafe.");
  }
  return value;
}

function readSafeDescription(value: string): string {
  if (!SAFE_DESCRIPTION_PATTERN.test(value)) {
    throw new TypeError("Bearer challenge error description is unsafe.");
  }
  return value;
}

function parseVerifiedClaims(
  value: unknown,
):
  | { ok: true; value: ParsedVerifiedClaimsV1 }
  | {
      ok: false;
      reason:
        | "cryptographic_verification_prerequisite_missing"
        | "missing_subject"
        | "malformed_claims";
    } {
  const record = readRecordWithAllowedKeys(value, VERIFIED_CLAIMS_ALLOWED_KEYS);
  if (!record || !hasOwnRequiredKeys(record, VERIFIED_CLAIMS_REQUIRED_KEYS)) {
    return { ok: false, reason: "cryptographic_verification_prerequisite_missing" };
  }
  if (
    record.kind !== "mcp_auth_verified_access_token_claims" ||
    record.cryptographicVerification !== "already_verified_by_provider_adapter" ||
    record.version !== 1
  ) {
    return { ok: false, reason: "cryptographic_verification_prerequisite_missing" };
  }
  const issuer = readNonEmptyString(record.issuer);
  const audience = readAudience(record.audience);
  const subject = readNonEmptyString(record.subject);
  const expiresAtEpochSeconds = readInteger(record.expiresAtEpochSeconds);
  const notBeforeEpochSeconds = readOptionalInteger(record.notBeforeEpochSeconds);
  const clientId = readOptionalNonEmptyString(record.clientId);
  const grantedScopes = readCanonicalScopeList(record.grantedScopes);
  const providerEnvironment = readNonEmptyString(record.providerEnvironment);
  if (!issuer || !audience || expiresAtEpochSeconds === undefined || !grantedScopes || !providerEnvironment) {
    return { ok: false, reason: "malformed_claims" };
  }
  if (subject === undefined) return { ok: false, reason: "missing_subject" };
  if (notBeforeEpochSeconds === false || clientId === false) return { ok: false, reason: "malformed_claims" };

  return {
    ok: true,
    value: {
      issuer,
      audience,
      subject,
      expiresAtEpochSeconds,
      ...(notBeforeEpochSeconds !== undefined ? { notBeforeEpochSeconds } : {}),
      ...(clientId !== undefined ? { clientId } : {}),
      grantedScopes,
      providerEnvironment,
    },
  };
}

function parsePolicy(value: unknown): ParsedPolicyV1 | undefined {
  const record = readRecordWithAllowedKeys(value, POLICY_KEYS);
  if (!record || record.version !== 1) return undefined;
  const expectedIssuer = readNonEmptyString(record.expectedIssuer);
  const expectedAudience = readNonEmptyString(record.expectedAudience);
  const expectedProviderEnvironment = readNonEmptyString(record.expectedProviderEnvironment);
  const allowedClientIds = readOptionalStringList(record.allowedClientIds);
  const nowEpochSeconds = readInteger(record.nowEpochSeconds);
  const clockSkewSeconds = readOptionalInteger(record.clockSkewSeconds);
  if (
    !expectedIssuer ||
    !expectedAudience ||
    record.requiredScope !== TWOWEEKS_APPLICATIONS_READ_SCOPE ||
    !expectedProviderEnvironment ||
    allowedClientIds === false ||
    nowEpochSeconds === undefined ||
    clockSkewSeconds === false ||
    (clockSkewSeconds !== undefined && clockSkewSeconds < 0)
  ) {
    return undefined;
  }
  return {
    expectedIssuer,
    expectedAudience,
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    allowedClientIds: allowedClientIds ?? [],
    expectedProviderEnvironment,
    nowEpochSeconds,
    clockSkewSeconds: clockSkewSeconds ?? 0,
  };
}

function parseAccountLinkRecord(value: unknown): ParsedAccountLinkRecordV1 | undefined {
  const record = readRecordWithAllowedKeys(value, ACCOUNT_LINK_ALLOWED_KEYS);
  if (!record || !hasOwnRequiredKeys(record, ACCOUNT_LINK_REQUIRED_KEYS)) return undefined;
  if (record.kind !== "mcp_auth_policy_account_link_record" || record.version !== 1) return undefined;
  const issuer = readNonEmptyString(record.issuer);
  const subject = readNonEmptyString(record.subject);
  const providerEnvironment = readNonEmptyString(record.providerEnvironment);
  const clientId = readNonEmptyString(record.clientId);
  const twoweeksClerkId = readNonEmptyString(record.twoweeksClerkId);
  const grantedScopes = readCanonicalScopeList(record.grantedScopes);
  const state = readAccountLinkState(record.state);
  const expiresAtEpochSeconds = readInteger(record.expiresAtEpochSeconds);
  if (
    !issuer ||
    !subject ||
    !providerEnvironment ||
    !clientId ||
    !twoweeksClerkId ||
    !grantedScopes ||
    !state ||
    expiresAtEpochSeconds === undefined
  ) {
    return undefined;
  }
  return {
    issuer,
    subject,
    providerEnvironment,
    clientId,
    twoweeksClerkId,
    grantedScopes,
    state,
    expiresAtEpochSeconds,
  };
}

function readAudience(value: unknown): readonly string[] | undefined {
  if (typeof value === "string") {
    const audience = readNonEmptyString(value);
    return audience ? [audience] : undefined;
  }
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const values = value.map(readNonEmptyString);
  return values.every((item): item is string => item !== undefined) ? values : undefined;
}

function readCanonicalScopeList(value: unknown): readonly TwoweeksApplicationsReadScopeV1[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const scopes = new Set<TwoweeksApplicationsReadScopeV1>();
  for (const item of value) {
    if (item === TWOWEEKS_APPLICATIONS_READ_SCOPE) scopes.add(TWOWEEKS_APPLICATIONS_READ_SCOPE);
  }
  return Object.freeze([...scopes]);
}

function readOptionalStringList(value: unknown): readonly string[] | undefined | false {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return false;
  const values = value.map(readNonEmptyString);
  return values.every((item): item is string => item !== undefined) ? [...new Set(values)] : false;
}

function isExpired(expiresAtEpochSeconds: number, nowEpochSeconds: number, clockSkewSeconds: number): boolean {
  return nowEpochSeconds - clockSkewSeconds >= expiresAtEpochSeconds;
}

function isNotYetValid(notBeforeEpochSeconds: number, nowEpochSeconds: number, clockSkewSeconds: number): boolean {
  return nowEpochSeconds + clockSkewSeconds < notBeforeEpochSeconds;
}

function denyClaims(reason: McpAuthVerifiedClaimsPolicyFailureReasonV1): McpAuthVerifiedClaimsPolicyDecisionV1 {
  return Object.freeze({
    kind: "mcp_auth_verified_claims_policy_decision",
    authorized: false,
    reason,
    safeFailure: Object.freeze({
      code: "auth_policy_denied",
      message: "Authorization denied.",
      safeForModel: true,
      rawClaimsExposed: false,
      tokenEchoed: false,
      version: 1,
    }),
    modelVisible: false,
    version: 1,
  });
}

function denyAccountLink(
  reason: Exclude<McpAuthPolicyAccountLinkResolutionReasonV1, "resolved">,
): McpAuthPolicyAccountLinkResolutionV1 {
  return Object.freeze({
    kind: "mcp_auth_account_link_resolution",
    resolved: false,
    reason,
    safeFailure: Object.freeze({
      code: "account_link_denied",
      message: "Account link denied.",
      safeForModel: true,
      identityEchoed: false,
      version: 1,
    }),
    modelVisible: false,
    version: 1,
  });
}

function containsIdentityOverride(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.some(containsIdentityOverride);
  if (!isPlainRecord(value)) return false;
  return Object.entries(value).some(
    ([key, item]) => IDENTITY_OVERRIDE_KEYS.has(key) || containsIdentityOverride(item),
  );
}

function readAccountLinkState(value: unknown): LocalMcpAccountLinkingStorageRecordStateV1 | undefined {
  switch (value) {
    case "active":
    case "revoked":
    case "stale":
      return value;
    default:
      return undefined;
  }
}

function readRecordWithAllowedKeys(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | undefined {
  if (!isPlainRecord(value)) return undefined;
  const actualKeys = Object.keys(value);
  if (actualKeys.some((key) => !allowedKeys.includes(key))) return undefined;
  return value;
}

function hasOwnRequiredKeys(record: Record<string, unknown>, requiredKeys: readonly string[]): boolean {
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key));
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isSafeHeaderText(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f || character === '"' || character === "\\") return false;
  }
  return true;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && /\S/u.test(value) ? value : undefined;
}

function readOptionalNonEmptyString(value: unknown): string | undefined | false {
  if (value === undefined) return undefined;
  return readNonEmptyString(value) ?? false;
}

function readInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isInteger(value) ? value : undefined;
}

function readOptionalInteger(value: unknown): number | undefined | false {
  if (value === undefined) return undefined;
  return typeof value === "number" && Number.isInteger(value) ? value : false;
}

function exhaustive(value: never): never {
  throw new TypeError(`Unhandled MCP auth policy value: ${String(value)}`);
}
