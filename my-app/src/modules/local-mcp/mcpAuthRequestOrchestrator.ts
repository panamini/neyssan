import {
  buildBearerAuthChallenge,
  buildMcpWwwAuthenticateMeta,
  evaluateMcpAuthVerifiedClaimsPolicy,
  resolveMcpAuthPolicyAccountLink,
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpAuthPolicyAccountLinkResolutionReasonV1,
  type McpAuthVerifiedAccessTokenClaimsV1,
  type McpAuthVerifiedClaimsPolicyFailureReasonV1,
  type McpBearerAuthChallengeReasonV1,
  type McpBearerAuthChallengeV1,
  type McpWwwAuthenticateMetaV1,
  type TwoweeksApplicationsReadScopeV1,
} from "./mcpAuthPolicyBoundary";

export type McpBearerAuthorizationHeaderInputV1 =
  | string
  | readonly string[]
  | undefined;

export type McpAuthRequestOrchestratorFailureStageV1 =
  | "authorization_header"
  | "token_verifier"
  | "claims_policy"
  | "account_link_lookup"
  | "account_link_resolution";

export type McpAuthRequestOrchestratorHeaderFailureReasonV1 =
  | "missing_token"
  | "multiple_header_values"
  | "unsupported_authorization_scheme"
  | "comma_combined_credentials"
  | "control_characters"
  | "excessive_length"
  | "extra_credential_segments"
  | "malformed_authorization_header";

export type McpBearerAuthorizationHeaderParseDecisionV1 = Readonly<
  | {
      parsed: true;
      bearerToken: string;
    }
  | {
      parsed: false;
      failureStage: "authorization_header";
      reason: McpAuthRequestOrchestratorHeaderFailureReasonV1;
    }
>;

type McpBearerAuthorizationHeaderParseFailureV1 = Extract<
  McpBearerAuthorizationHeaderParseDecisionV1,
  { parsed: false }
>;

export type McpBearerTokenVerifierInputV1 = Readonly<{
  rawBearerToken: string;
  expectedIssuer: string;
  expectedAudience: string;
  requiredScope: TwoweeksApplicationsReadScopeV1;
  expectedProviderEnvironment: string;
  allowedClientIds: readonly string[];
  version: 1;
}>;

export type McpBearerTokenVerifierRejectionReasonV1 =
  | "invalid_request"
  | "invalid_token"
  | "insufficient_scope";

export type McpBearerTokenVerificationResultV1 = Readonly<
  | {
      kind: "mcp_bearer_token_verification_result";
      verified: true;
      claims: McpAuthVerifiedAccessTokenClaimsV1;
      version: 1;
    }
  | {
      kind: "mcp_bearer_token_verification_result";
      verified: false;
      reason: McpBearerTokenVerifierRejectionReasonV1;
      version: 1;
    }
>;

export type McpBearerTokenVerifierPortV1 = (
  input: McpBearerTokenVerifierInputV1,
) => Promise<McpBearerTokenVerificationResultV1>;

export const denyAllMcpBearerTokenVerifier: McpBearerTokenVerifierPortV1 = async () =>
  Object.freeze({
    kind: "mcp_bearer_token_verification_result",
    verified: false,
    reason: "invalid_token",
    version: 1,
  });

export type McpAccountLinkLookupPortInputV1 = Readonly<{
  issuer: string;
  subject: string;
  providerEnvironment: string;
  version: 1;
}>;

export type McpAccountLinkLookupPortV1 = (
  input: McpAccountLinkLookupPortInputV1,
) => Promise<readonly unknown[]>;

export type McpAuthRequestOrchestratorFailureReasonV1 =
  | McpAuthRequestOrchestratorHeaderFailureReasonV1
  | McpBearerTokenVerifierRejectionReasonV1
  | "verifier_exception"
  | McpAuthVerifiedClaimsPolicyFailureReasonV1
  | "lookup_exception"
  | Exclude<McpAuthPolicyAccountLinkResolutionReasonV1, "resolved">;

export type McpAuthRequestOrchestratorDenialDecisionV1 = Readonly<{
  kind: "mcp_auth_request_orchestrator_result";
  authorized: false;
  failureStage: McpAuthRequestOrchestratorFailureStageV1;
  reason: McpAuthRequestOrchestratorFailureReasonV1;
  challengeReason: McpBearerAuthChallengeReasonV1;
  message: "Authentication required.";
  challenge: McpBearerAuthChallengeV1;
  mcpWwwAuthenticateMeta: McpWwwAuthenticateMetaV1;
  httpStatus: 401;
  safeForModel: true;
  tokenEchoed: false;
  identityEchoed: false;
  modelVisible: false;
  version: 1;
}>;

export type McpAuthRequestAuthorizedContextV1 = Readonly<{
  kind: "mcp_auth_request_orchestrator_result";
  authorized: true;
  reason: "authorized";
  serverOnly: {
    twoweeksClerkId: string;
    grantedScopes: readonly [TwoweeksApplicationsReadScopeV1];
    version: 1;
  };
  modelVisible: false;
  version: 1;
}>;

export type McpAuthRequestOrchestratorResultV1 =
  | McpAuthRequestAuthorizedContextV1
  | McpAuthRequestOrchestratorDenialDecisionV1;

export type McpAuthRequestOrchestratorInputV1 = Readonly<{
  authorizationHeader?: McpBearerAuthorizationHeaderInputV1;
  tokenVerifier: McpBearerTokenVerifierPortV1;
  accountLinkLookup: McpAccountLinkLookupPortV1;
  expectedIssuer: string;
  expectedAudience: string;
  expectedProviderEnvironment: string;
  allowedClientIds: readonly string[];
  requiredScope: TwoweeksApplicationsReadScopeV1;
  nowEpochSeconds: number;
  clockSkewSeconds?: number;
  protectedResourceMetadataUrl: string;
  requestArguments?: unknown;
  version: 1;
}>;

const MAX_AUTHORIZATION_HEADER_LENGTH = 8_192;
const MAX_BEARER_TOKEN_LENGTH = 4_096;
const BEARER_TOKEN_PATTERN = /^[A-Za-z0-9._~+/-]+=*$/u;
const AUTHENTICATION_REQUIRED_MESSAGE = "Authentication required." as const;

export function parseMcpBearerAuthorizationHeader(
  input: McpBearerAuthorizationHeaderInputV1,
): McpBearerAuthorizationHeaderParseDecisionV1 {
  if (input === undefined) {
    return denyHeaderParse("missing_token");
  }

  if (Array.isArray(input)) {
    if (input.length === 0) return denyHeaderParse("missing_token");
    if (input.length !== 1) return denyHeaderParse("multiple_header_values");
    const [singleValue] = input;
    if (typeof singleValue !== "string") return denyHeaderParse("malformed_authorization_header");
    return parseSingleAuthorizationHeader(singleValue);
  }

  if (typeof input !== "string") return denyHeaderParse("malformed_authorization_header");
  return parseSingleAuthorizationHeader(input);
}

export async function authenticateMcpBearerRequest(
  input: McpAuthRequestOrchestratorInputV1,
): Promise<McpAuthRequestOrchestratorResultV1> {
  const parsedAuthorization = parseMcpBearerAuthorizationHeader(input.authorizationHeader);
  if (!parsedAuthorization.parsed) {
    return buildDenialDecision(parsedAuthorization, input.protectedResourceMetadataUrl);
  }

  const verifierInput: McpBearerTokenVerifierInputV1 = Object.freeze({
    rawBearerToken: parsedAuthorization.bearerToken,
    expectedIssuer: input.expectedIssuer,
    expectedAudience: input.expectedAudience,
    requiredScope: input.requiredScope,
    expectedProviderEnvironment: input.expectedProviderEnvironment,
    allowedClientIds: Object.freeze([...input.allowedClientIds]),
    version: 1,
  });

  let verificationResult: McpBearerTokenVerificationResultV1;
  try {
    verificationResult = await input.tokenVerifier(verifierInput);
  } catch {
    return buildFailureDecision(
      {
        failureStage: "token_verifier",
        reason: "verifier_exception",
      },
      input.protectedResourceMetadataUrl,
    );
  }

  if (!verificationResult || verificationResult.verified !== true) {
    const verifierRejectionReason =
      verificationResult?.verified === false ? verificationResult.reason : undefined;
    return buildFailureDecision(
      {
        failureStage: "token_verifier",
        reason: readSafeVerifierRejectionReason(verifierRejectionReason),
      },
      input.protectedResourceMetadataUrl,
    );
  }

  const claimsDecision = evaluateMcpAuthVerifiedClaimsPolicy({
    claims: verificationResult.claims,
    policy: {
      expectedIssuer: input.expectedIssuer,
      expectedAudience: input.expectedAudience,
      requiredScope: input.requiredScope,
      allowedClientIds: input.allowedClientIds,
      expectedProviderEnvironment: input.expectedProviderEnvironment,
      nowEpochSeconds: input.nowEpochSeconds,
      clockSkewSeconds: input.clockSkewSeconds,
      version: 1,
    },
  });

  if (!claimsDecision.authorized) {
    return buildFailureDecision(
      {
        failureStage: "claims_policy",
        reason: claimsDecision.reason,
      },
      input.protectedResourceMetadataUrl,
    );
  }

  const principal = claimsDecision.serverOnly.policyAuthorizedPrincipal;
  const lookupInput: McpAccountLinkLookupPortInputV1 = Object.freeze({
    issuer: principal.issuer,
    subject: principal.subject,
    providerEnvironment: principal.providerEnvironment,
    version: 1,
  });

  let accountLinkCandidates: readonly unknown[];
  try {
    accountLinkCandidates = await input.accountLinkLookup(lookupInput);
  } catch {
    return buildFailureDecision(
      {
        failureStage: "account_link_lookup",
        reason: "lookup_exception",
      },
      input.protectedResourceMetadataUrl,
    );
  }

  if (!Array.isArray(accountLinkCandidates)) {
    return buildFailureDecision(
      {
        failureStage: "account_link_lookup",
        reason: "lookup_exception",
      },
      input.protectedResourceMetadataUrl,
    );
  }

  const accountLinkResolution = resolveMcpAuthPolicyAccountLink({
    principal,
    accountLinks: accountLinkCandidates,
    requiredScope: input.requiredScope,
    nowEpochSeconds: input.nowEpochSeconds,
    requestArguments: input.requestArguments,
    version: 1,
  });

  if (!accountLinkResolution.resolved) {
    return buildFailureDecision(
      {
        failureStage: "account_link_resolution",
        reason: accountLinkResolution.reason,
      },
      input.protectedResourceMetadataUrl,
    );
  }

  return Object.freeze({
    kind: "mcp_auth_request_orchestrator_result",
    authorized: true,
    reason: "authorized",
    serverOnly: Object.freeze({
      twoweeksClerkId: accountLinkResolution.serverOnly.twoweeksClerkId,
      grantedScopes: Object.freeze([TWOWEEKS_APPLICATIONS_READ_SCOPE] as const),
      version: 1,
    }),
    modelVisible: false,
    version: 1,
  });
}

function parseSingleAuthorizationHeader(
  header: string,
): McpBearerAuthorizationHeaderParseDecisionV1 {
  if (header.length === 0) return denyHeaderParse("missing_token");
  if (containsControlCharacters(header)) return denyHeaderParse("control_characters");
  if (header.length > MAX_AUTHORIZATION_HEADER_LENGTH) return denyHeaderParse("excessive_length");

  const normalized = header.trim();
  if (normalized.length === 0) return denyHeaderParse("missing_token");
  if (normalized.includes(",")) return denyHeaderParse("comma_combined_credentials");

  const credentialSegments = normalized.split(/\s+/u);
  const scheme = credentialSegments[0];
  if (scheme.toLowerCase() !== "bearer") {
    return denyHeaderParse("unsupported_authorization_scheme");
  }
  if (credentialSegments.length === 1) return denyHeaderParse("missing_token");
  if (credentialSegments.length !== 2) return denyHeaderParse("extra_credential_segments");

  const bearerToken = credentialSegments[1];
  if (bearerToken.length === 0) return denyHeaderParse("missing_token");
  if (bearerToken.length > MAX_BEARER_TOKEN_LENGTH) return denyHeaderParse("excessive_length");
  if (containsControlCharacters(bearerToken)) return denyHeaderParse("control_characters");
  if (!BEARER_TOKEN_PATTERN.test(bearerToken)) {
    return denyHeaderParse("malformed_authorization_header");
  }

  return {
    parsed: true,
    bearerToken,
  };
}

function buildDenialDecision(
  failure: McpBearerAuthorizationHeaderParseFailureV1,
  protectedResourceMetadataUrl: string,
): McpAuthRequestOrchestratorDenialDecisionV1 {
  return buildFailureDecision(
    {
      failureStage: failure.failureStage,
      reason: failure.reason,
    },
    protectedResourceMetadataUrl,
  );
}

function buildFailureDecision(
  failure: Readonly<{
    failureStage: McpAuthRequestOrchestratorFailureStageV1;
    reason: McpAuthRequestOrchestratorFailureReasonV1;
  }>,
  protectedResourceMetadataUrl: string,
): McpAuthRequestOrchestratorDenialDecisionV1 {
  const challengeReason = mapFailureToChallengeReason(failure);
  const challenge = buildBearerAuthChallenge({
    reason: challengeReason,
    protectedResourceMetadataUrl,
  });

  return Object.freeze({
    kind: "mcp_auth_request_orchestrator_result",
    authorized: false,
    failureStage: failure.failureStage,
    reason: failure.reason,
    challengeReason,
    message: AUTHENTICATION_REQUIRED_MESSAGE,
    challenge,
    mcpWwwAuthenticateMeta: buildMcpWwwAuthenticateMeta(challenge),
    httpStatus: 401,
    safeForModel: true,
    tokenEchoed: false,
    identityEchoed: false,
    modelVisible: false,
    version: 1,
  });
}

function mapFailureToChallengeReason(
  failure: Readonly<{
    failureStage: McpAuthRequestOrchestratorFailureStageV1;
    reason: McpAuthRequestOrchestratorFailureReasonV1;
  }>,
): McpBearerAuthChallengeReasonV1 {
  switch (failure.failureStage) {
    case "authorization_header":
      return failure.reason === "missing_token" ? "missing_token" : "invalid_token";
    case "token_verifier":
      return failure.reason === "insufficient_scope" ? "insufficient_scope" : "invalid_token";
    case "claims_policy":
      return failure.reason === "missing_scope" ? "insufficient_scope" : "invalid_token";
    case "account_link_lookup":
      return "reauthorization_required";
    case "account_link_resolution":
      switch (failure.reason) {
        case "missing_account_link":
          return "account_link_required";
        case "missing_required_scope":
          return "insufficient_scope";
        case "identity_override_forbidden":
          return "invalid_token";
        default:
          return "reauthorization_required";
      }
    default:
      return exhaustive(failure.failureStage);
  }
}

function denyHeaderParse(
  reason: McpAuthRequestOrchestratorHeaderFailureReasonV1,
): McpBearerAuthorizationHeaderParseDecisionV1 {
  return {
    parsed: false,
    failureStage: "authorization_header",
    reason,
  };
}

function containsControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function readSafeVerifierRejectionReason(value: unknown): McpBearerTokenVerifierRejectionReasonV1 {
  switch (value) {
    case "invalid_request":
    case "invalid_token":
    case "insufficient_scope":
      return value;
    default:
      return "invalid_token";
  }
}

function exhaustive(value: never): never {
  throw new TypeError(`Unhandled MCP auth request orchestrator value: ${String(value)}`);
}
