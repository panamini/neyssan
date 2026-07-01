import { createHash, randomBytes } from "node:crypto";
import { isIP, SocketAddress } from "node:net";
import {
  buildMcpOAuthProductionRoutePreflight,
  type McpOAuthProductionRoutePreflightDecisionV1,
  type McpOAuthProductionRoutePreflightInputV1,
  type McpOAuthProductionRoutePreflightResultV1,
} from "./mcpOAuthProductionRoutePreflightBoundary";
import {
  projectMcpOAuthPreAuthAuthorizationRequest,
  type McpOAuthAuthorizationRequestBoundaryHandoffV1,
  type McpOAuthAuthorizationTrustedOwnerV1,
  type McpOAuthAuthorizationRequestBoundaryConfigV1,
  type McpOAuthPreAuthAuthorizationRequestProjectionV1,
} from "./mcpOAuthAuthorizationRequestBoundary";
import {
  defaultMcpOAuthContinuationHandleCodecV1,
  type McpOAuthContinuationHandleCodecV1,
  type McpOAuthIntentConsumePortV1,
  type McpOAuthIntentConsumeResultV1,
} from "./mcpOAuthLoginReturnContinuationBoundary";
import {
  buildBearerAuthChallenge,
  buildMcpWwwAuthenticateMeta,
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type McpBearerAuthChallengeErrorV1,
  type McpBearerAuthChallengeReasonV1,
} from "./mcpAuthPolicyBoundary";
import {
  buildMcpAuthenticatedProtocolEnvelope,
  parseMcpJsonRpcProtocolMessage,
  type McpAuthenticatedProtocolEnvelopeV1,
  type McpJsonRpcIdV1,
  type McpJsonRpcProtocolMessageV1,
} from "./mcpAuthenticatedProtocolEnvelope";
import {
  evaluateMcpProductionPrivateBetaGate,
  type McpProductionPrivateBetaGateConfigInputV1,
  type McpProductionPrivateBetaGateDecisionV1,
} from "./mcpProductionPrivateBetaGate";
import {
  evaluateMcpProductionLaunchReadiness,
  type McpProductionLaunchReadinessConfigInputV1,
  type McpProductionLaunchReadinessDecisionV1,
} from "./mcpProductionLaunchReadiness";
import { evaluateMcpProductionPolicy, type McpProductionPolicyDecisionV1 } from "./mcpProductionPolicyKernel";
import {
  messageForMcpProductionToolsCallBoundaryError,
  validateMcpProductionToolsCallBoundary,
} from "./mcpProductionToolsCallBoundary";
import {
  buildMcpProductionReadonlySummaryExecutionInput,
  MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE,
  type McpProductionReadonlySummaryExecutorV1,
} from "./mcpProductionReadonlySummaryExecutor";
import { buildMcpProductionToolsListResult } from "./mcpProductionToolsListProjection";
import {
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
  MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
} from "../../pages/sign-in-return";

export const MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH = "/oauth/authorize";
export const MCP_OAUTH_PRODUCTION_TOKEN_PATH = "/oauth/token";
export const MCP_OAUTH_PRODUCTION_CALLBACK_PATH = "/oauth/callback";
export const MCP_OAUTH_PRODUCTION_MCP_PATH = "/mcp";

export type McpOAuthProductionRoutePathV1 =
  | typeof MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH
  | typeof MCP_OAUTH_PRODUCTION_TOKEN_PATH
  | typeof MCP_OAUTH_PRODUCTION_CALLBACK_PATH
  | typeof MCP_OAUTH_PRODUCTION_MCP_PATH
  | typeof MCP_OAUTH_CONTINUATION_PATH;

type McpOAuthProductionRouteNameV1 =
  | "oauth_authorize"
  | "oauth_login_return"
  | "oauth_token"
  | "oauth_callback"
  | "mcp";

export type McpOAuthProductionRouteAdapterConfigV1 = Readonly<{
  kind: "mcp_oauth_production_route_adapter_config";
  preflight: McpOAuthProductionRoutePreflightResultV1;
  authorizationRequestGuard: McpOAuthProductionAuthorizationRequestGuardV1;
  privateBeta?: McpProductionPrivateBetaGateConfigInputV1;
  launchReadiness?: McpProductionLaunchReadinessConfigInputV1;
  handledPaths: readonly McpOAuthProductionRoutePathV1[];
  failClosedUnlessPreflightReady: true;
  authorizeCreatesOwnerlessPreAuthIntentOnly: true;
  callbackAndMcpInertGuardedHandlersOnly: true;
  safeForModel: true;
  version: 1;
}>;

export type McpOAuthProductionRouteAdapterConfigInputV1 =
  McpOAuthProductionRoutePreflightInputV1 &
    Readonly<{
      privateBeta?: McpProductionPrivateBetaGateConfigInputV1;
      launchReadiness?: McpProductionLaunchReadinessConfigInputV1;
    }>;

type McpOAuthProductionAuthorizationRequestGuardV1 = Readonly<{
  expectedResource?: string;
  allowedClientIds: readonly string[];
  version: 1;
}>;

export type McpOAuthProductionPreAuthQuotaPortInputV1 = Readonly<{
  authorizationPageOrigin: string;
  clientId: string;
  resource: string;
  callerKey: string;
  now: number;
  version: 1;
}>;

export type McpOAuthProductionPreAuthQuotaPortResultV1 = Readonly<
  | {
      kind: "mcp_oauth_pre_auth_quota_result";
      ok: true;
      reason: "accepted";
      safeForLogging: true;
      version: 1;
    }
  | {
      kind: "mcp_oauth_pre_auth_quota_result";
      ok: false;
      reason: "rate_limited" | "quota_exhausted" | "invalid_request";
      safeFailure: unknown;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthProductionPreAuthQuotaPortV1 = (
  input: McpOAuthProductionPreAuthQuotaPortInputV1,
) => Promise<McpOAuthProductionPreAuthQuotaPortResultV1>;

export type McpOAuthProductionPreAuthIntentCreatePortInputV1 = Readonly<{
  authorizationRequestProjection: McpOAuthPreAuthAuthorizationRequestProjectionV1;
  preAuthHandleHash: string;
  now: number;
  deadlineEpochMs: number;
  timeoutMs: number;
  version: 1;
}>;

export type McpOAuthProductionPreAuthIntentCreatePortResultV1 = Readonly<
  | {
      kind: "mcp_oauth_pre_auth_intent_create_result";
      ok: true;
      reason: "created";
      serverOnly: {
        status: "pre_auth_pending";
        expiresAt: number;
        containsOwnerIdentity: false;
        containsProviderSubject: false;
        containsAccountLinkId: false;
        authorizationGranted: false;
        consentCompleted: false;
        authorizationCodeIssued: false;
        tokenIssued: false;
        accountLinkCreated: false;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_pre_auth_intent_create_result";
      ok: false;
      reason: string;
      safeFailure: unknown;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthProductionPreAuthIntentCreatePortV1 = (
  input: McpOAuthProductionPreAuthIntentCreatePortInputV1,
) => Promise<McpOAuthProductionPreAuthIntentCreatePortResultV1>;

export type McpOAuthProductionPreAuthOwnerBindingPortInputV1 = Readonly<{
  preAuthHandleHash: string;
  authenticatedOwnerIdentity: McpOAuthProductionAuthenticatedOwnerIdentityV1;
  now: number;
  version: 1;
}>;

export type McpOAuthProductionPreAuthOwnerBindingPortResultV1 = Readonly<
  | {
      kind: "mcp_oauth_pre_auth_owner_binding_result";
      ok: true;
      reason: "bound";
      serverOnly: {
        ownerBoundIntent: {
          status: "pending";
          expiresAt: number;
          version: 1;
        };
        preAuthIntent: {
          status: "claimed";
          version: 1;
        };
        trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_pre_auth_owner_binding_result";
      ok: false;
      reason: string;
      safeFailure: unknown;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthProductionPreAuthOwnerBindingPortV1 = (
  input: McpOAuthProductionPreAuthOwnerBindingPortInputV1,
) => Promise<McpOAuthProductionPreAuthOwnerBindingPortResultV1>;

export type McpOAuthProductionAuthorizationCodeCreatePortInputV1 = Readonly<{
  authorizationCodeDigest: string;
  authenticatedOwnerIdentity: McpOAuthProductionAuthenticatedOwnerIdentityV1;
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
  authorizationRequest: Readonly<{
    clientId: string;
    redirectUri: string;
    resource: string;
    scopes: readonly string[];
    state: string;
    codeChallenge: string;
    codeChallengeMethod: "S256";
    version: 1;
  }>;
  productionEnvironment: typeof MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT;
  now: number;
  deadlineEpochMs: number;
  timeoutMs: number;
  version: 1;
}>;

export type McpOAuthProductionAuthorizationCodeCreatePortResultV1 = Readonly<
  | {
      kind: "mcp_oauth_authorization_code_create_result";
      ok: true;
      reason: "created";
      serverOnly: {
        status: "pending";
        expiresAt: number;
        rawAuthorizationCodePersisted: false;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_authorization_code_create_result";
      ok: false;
      reason: string;
      safeFailure: unknown;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthProductionAuthorizationCodeCreatePortV1 = (
  input: McpOAuthProductionAuthorizationCodeCreatePortInputV1,
) => Promise<McpOAuthProductionAuthorizationCodeCreatePortResultV1>;

export type McpOAuthProductionAuthorizationCodeValidatePortInputV1 = Readonly<{
  authorizationCodeDigest: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  codeChallenge: string;
  now: number;
  version: 1;
}>;

export type McpOAuthProductionAuthorizationCodeValidatePortResultV1 = Readonly<
  | {
      kind: "mcp_oauth_authorization_code_validate_result";
      ok: true;
      reason: "validated";
      serverOnly: {
        status: "pending";
        clientId: string;
        redirectUri: string;
        resource: string;
        scopes: readonly string[];
        state: string;
        codeChallenge: string;
        codeChallengeMethod: "S256";
        productionEnvironment: typeof MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT;
        expiresAt: number;
        codeConsumed: false;
        tokenIssued: false;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_authorization_code_validate_result";
      ok: false;
      reason:
        | "invalid_input"
        | "invalid_code_digest"
        | "not_found_or_forbidden"
        | "storage_unavailable"
        | "malformed_storage_record"
        | "expired"
        | "already_consumed"
        | "duplicate_storage_record";
      safeFailure: {
        code: "mcp_oauth_authorization_code_denied";
        message: "Authorization code denied.";
        safeForModel: true;
        rawCodeEchoed: false;
        digestEchoed: false;
        identityEchoed: false;
        sensitiveValuesEchoed: false;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthProductionAuthorizationCodeValidatePortV1 = (
  input: McpOAuthProductionAuthorizationCodeValidatePortInputV1,
) => Promise<McpOAuthProductionAuthorizationCodeValidatePortResultV1>;

export type McpOAuthProductionAccessTokenIssuePortInputV1 = Readonly<{
  authorizationCodeDigest: string;
  accessTokenDigest: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  codeChallenge: string;
  now: number;
  deadlineEpochMs: number;
  timeoutMs: number;
  version: 1;
}>;

export type McpOAuthProductionAccessTokenIssuePortResultV1 = Readonly<
  | {
      kind: "mcp_oauth_access_token_issue_result";
      ok: true;
      reason: "issued";
      serverOnly: {
        tokenType: "Bearer";
        issuedAt: number;
        expiresAt: number;
        expiresIn: number;
        clientId: string;
        redirectUri: string;
        resource: string;
        codeChallenge: string;
        scopes: readonly string[];
        productionEnvironment: typeof MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT;
        codeConsumed: true;
        tokenIssued: true;
        tokenPersisted: true;
        rawAccessTokenPersisted: false;
        refreshTokenPersisted: false;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_access_token_issue_result";
      ok: false;
      reason:
        | "invalid_input"
        | "invalid_code_digest"
        | "invalid_access_token_digest"
        | "not_found_or_forbidden"
        | "storage_unavailable"
        | "malformed_storage_record"
        | "expired"
        | "already_consumed"
        | "duplicate_storage_record"
        | "access_token_digest_collision";
      safeFailure: {
        code: "mcp_oauth_authorization_code_denied";
        message: "Authorization code denied.";
        safeForModel: true;
        rawCodeEchoed: false;
        digestEchoed: false;
        identityEchoed: false;
        sensitiveValuesEchoed: false;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthProductionAccessTokenIssuePortV1 = (
  input: McpOAuthProductionAccessTokenIssuePortInputV1,
) => Promise<McpOAuthProductionAccessTokenIssuePortResultV1>;

export type McpOAuthProductionAccessTokenVerifyPortInputV1 = Readonly<{
  accessTokenDigest: string;
  allowedClientIds: readonly string[];
  resource: string;
  requiredScope: typeof TWOWEEKS_APPLICATIONS_READ_SCOPE;
  now: number;
  version: 1;
}>;

export type McpOAuthProductionAccessTokenVerifyPortResultV1 = Readonly<
  | {
      kind: "mcp_oauth_access_token_verify_result";
      ok: true;
      reason: "verified";
      serverOnly: {
        status: "active";
        twoweeksClerkId: string;
        ownerIssuer: string;
        clientId: string;
        resource: string;
        scopes: readonly string[];
        productionEnvironment: typeof MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT;
        expiresAt: number;
        tokenActive: true;
        tokenExpired: false;
        tokenRevoked: false;
        rawAccessTokenPersisted: false;
        rawAccessTokenEchoed: false;
        digestEchoed: false;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_access_token_verify_result";
      ok: false;
      reason:
        | "invalid_input"
        | "invalid_access_token_digest"
        | "not_found_or_forbidden"
        | "storage_unavailable"
        | "malformed_storage_record"
        | "duplicate_storage_record"
        | "expired"
        | "inactive"
        | "wrong_client"
        | "wrong_resource"
        | "missing_required_scope"
        | "unauthorized_scope_state";
      safeFailure: {
        code: "mcp_oauth_access_token_denied";
        message: "Access token denied.";
        safeForModel: true;
        rawTokenEchoed: false;
        digestEchoed: false;
        identityEchoed: false;
        sensitiveValuesEchoed: false;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthProductionAccessTokenVerifyPortV1 = (
  input: McpOAuthProductionAccessTokenVerifyPortInputV1,
) => Promise<McpOAuthProductionAccessTokenVerifyPortResultV1>;

export type McpOAuthProductionAuthenticatedOwnerIdentityV1 = Readonly<{
  subject: string;
  issuer: string;
  version: 1;
}>;

export type McpOAuthProductionAuthenticatedOwnerIdentityReaderV1 = (
  request: McpOAuthProductionRouteAdapterRequestV1,
) => Promise<McpOAuthProductionAuthenticatedOwnerIdentityV1 | undefined>;

export type McpOAuthProductionBrowserBoundContinuationNonceGeneratorV1 = () => string | undefined;
export type McpOAuthProductionAuthorizationCodeGeneratorV1 = () => string | undefined;
export type McpOAuthProductionAccessTokenGeneratorV1 = () => string | undefined;

export type McpOAuthProductionRouteAdapterDependenciesV1 = Readonly<{
  authorizationRequestConfig?: McpOAuthAuthorizationRequestBoundaryConfigV1;
  checkPreAuthQuota?: McpOAuthProductionPreAuthQuotaPortV1;
  createPreAuthIntent?: McpOAuthProductionPreAuthIntentCreatePortV1;
  bindPreAuthIntentToAuthenticatedOwner?: McpOAuthProductionPreAuthOwnerBindingPortV1;
  consumeAuthorizationIntent?: McpOAuthIntentConsumePortV1;
  createAuthorizationCode?: McpOAuthProductionAuthorizationCodeCreatePortV1;
  validateAuthorizationCode?: McpOAuthProductionAuthorizationCodeValidatePortV1;
  issueAccessToken?: McpOAuthProductionAccessTokenIssuePortV1;
  verifyAccessToken?: McpOAuthProductionAccessTokenVerifyPortV1;
  executeReadonlySummaryTool?: McpProductionReadonlySummaryExecutorV1;
  readAuthenticatedOwnerIdentity?: McpOAuthProductionAuthenticatedOwnerIdentityReaderV1;
  generateBrowserBoundContinuationNonce?: McpOAuthProductionBrowserBoundContinuationNonceGeneratorV1;
  generateAuthorizationCode?: McpOAuthProductionAuthorizationCodeGeneratorV1;
  generateAccessToken?: McpOAuthProductionAccessTokenGeneratorV1;
  handleCodec?: McpOAuthContinuationHandleCodecV1;
  now?: () => number;
}>;

export type McpOAuthProductionRouteAdapterRequestV1 = Readonly<{
  method: string;
  path: string;
  url: string;
  headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
  remoteAddress?: string;
  bodyText?: string;
}>;

export type McpOAuthProductionRouteAdapterResponseV1 = Readonly<{
  handled: boolean;
  status: number;
  headers: Readonly<Record<string, string>>;
  json?: unknown;
  bodyText?: string;
}>;

type McpOAuthProductionRouteFailureReasonV1 =
  | McpOAuthProductionRoutePreflightDecisionV1
  | "unsupported_method"
  | "dependency_unavailable"
  | "invalid_host"
  | "invalid_authorization_request"
  | "invalid_configuration"
  | "pre_auth_quota_denied"
  | "token_quota_denied"
  | "bearer_verification_quota_denied"
  | "pre_auth_create_failed"
  | "invalid_continuation_request"
  | "browser_bound_continuation_missing"
  | "owner_binding_failed"
  | "authorization_intent_consume_failed"
  | "authorization_code_generation_failed"
  | "authorization_code_create_failed"
  | "unsupported_token_content_type"
  | "token_request_body_too_large"
  | "invalid_request"
  | "invalid_target"
  | "code_validation_failed"
  | "token_generation_failed"
  | "token_issue_failed"
  | "invalid_authorization_header"
  | "bearer_verification_caller_untrusted"
  | "bearer_verification_failed"
  | "private_beta_gate_denied"
  | "launch_readiness_blocked";

type McpOAuthProductionAuthorizationOriginV1 = Readonly<{
  origin: string;
  protocol: string;
  hostname: string;
  port: string;
}>;

const HANDLED_PATHS = Object.freeze([
  MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
  MCP_OAUTH_PRODUCTION_TOKEN_PATH,
  MCP_OAUTH_CONTINUATION_PATH,
  MCP_OAUTH_PRODUCTION_CALLBACK_PATH,
  MCP_OAUTH_PRODUCTION_MCP_PATH,
] as const);
const PRE_AUTH_CREATE_FALSE_PROOF_KEYS = Object.freeze([
  "containsOwnerIdentity",
  "containsProviderSubject",
  "containsAccountLinkId",
  "authorizationGranted",
  "consentCompleted",
  "authorizationCodeIssued",
  "tokenIssued",
  "accountLinkCreated",
] as const);
const INTENT_HANDLE_HASH_PATTERN = /^[0-9a-f]{64}$/u;
const PRE_AUTH_QUOTA_TIMEOUT_MS = 2_500;
const PRE_AUTH_CREATE_TIMEOUT_MS = 2_500;
const OWNER_BINDING_TIMEOUT_MS = 2_500;
const AUTHORIZATION_INTENT_CONSUME_TIMEOUT_MS = 2_500;
const AUTHORIZATION_CODE_CREATE_TIMEOUT_MS = 2_500;
const AUTHORIZATION_CODE_VALIDATE_TIMEOUT_MS = 2_500;
const ACCESS_TOKEN_ISSUE_TIMEOUT_MS = 2_500;
const ACCESS_TOKEN_VERIFY_TIMEOUT_MS = 2_500;
const ACCESS_TOKEN_RESPONSE_CLOCK_SKEW_SECONDS = 60;
const TOKEN_REQUEST_BODY_MAX_BYTES = 4_096;
const AUTHORIZATION_HEADER_MAX_LENGTH = 128;
const BROWSER_BOUND_CONTINUATION_NONCE_PARAMETER = "mcp_oauth_browser_nonce";
const BROWSER_BOUND_CONTINUATION_COOKIE_NAME = "tw_mcp_oauth_continue";
const BROWSER_BOUND_CONTINUATION_NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const BROWSER_BOUND_CONTINUATION_MAX_AGE_SECONDS = 600;
const AUTHORIZATION_CODE_BYTE_LENGTH = 32;
const ACCESS_TOKEN_BYTE_LENGTH = 32;
const AUTHORIZATION_CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const ACCESS_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const AUTHORIZATION_CODE_DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const MCP_BEARER_VERIFICATION_QUOTA_CLIENT_ID = "mcp_bearer_verification";
const MCP_PRODUCTION_PROTOCOL_VERSION = "2025-11-25";
const PKCE_CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/u;
const PKCE_CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const WELL_KNOWN_PROTECTED_RESOURCE_PATH = "/.well-known/oauth-protected-resource";
const TOKEN_REQUEST_KEYS = Object.freeze([
  "grant_type",
  "code",
  "client_id",
  "redirect_uri",
  "resource",
  "code_verifier",
] as const);
export const MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT = "mcp_oauth_production_v1";
const BASE64_URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function buildMcpOAuthProductionRouteAdapterConfig(
  input: McpOAuthProductionRouteAdapterConfigInputV1 = {},
): McpOAuthProductionRouteAdapterConfigV1 {
  return Object.freeze({
    kind: "mcp_oauth_production_route_adapter_config",
    preflight: buildMcpOAuthProductionRoutePreflight(input),
    authorizationRequestGuard: buildAuthorizationRequestGuard(input),
    ...(input.privateBeta ? { privateBeta: freezePrivateBetaConfigInput(input.privateBeta) } : {}),
    ...(input.launchReadiness ? {
      launchReadiness: freezeLaunchReadinessConfigInput(input.launchReadiness),
    } : {}),
    handledPaths: HANDLED_PATHS,
    failClosedUnlessPreflightReady: true,
    authorizeCreatesOwnerlessPreAuthIntentOnly: true,
    callbackAndMcpInertGuardedHandlersOnly: true,
    safeForModel: true,
    version: 1,
  });
}

export function isMcpOAuthProductionRouteHandledPath(path: string): boolean {
  return routeNameForPath(path) !== undefined;
}

export function isMcpOAuthProductionRouteAllowedByPreflightPath(
  path: string,
  preflight: McpOAuthProductionRoutePreflightResultV1,
): boolean {
  const route = routeNameForPath(path);
  return route ? isRouteAllowedByPreflight(route, preflight) : false;
}

export async function handleMcpOAuthProductionRouteRequest(
  request: McpOAuthProductionRouteAdapterRequestV1,
  config: McpOAuthProductionRouteAdapterConfigV1 = buildMcpOAuthProductionRouteAdapterConfig(),
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1 = {},
): Promise<McpOAuthProductionRouteAdapterResponseV1> {
  const route = routeNameForPath(request.path);
  if (!route) return notHandled();
  if (!isRouteAllowedByPreflight(route, config.preflight)) {
    return failClosedResponse(route, config.preflight, config.preflight.decision, 404);
  }
  if (!isAllowedMethod(route, request.method)) {
    return failClosedResponse(route, config.preflight, "unsupported_method", 405, {
      allow: allowedMethodForRoute(route),
    });
  }
  if (route === "oauth_authorize") {
    return handleAuthorizationRequest(request, config, dependencies);
  }
  if (route === "oauth_login_return") {
    return handleLoginReturnContinuationRequest(request, config, dependencies);
  }
  if (route === "oauth_token") {
    return handleTokenRequest(request, config, dependencies);
  }
  if (route === "mcp") {
    return handleMcpRequest(request, config, dependencies);
  }
  return inertGuardedResponse(route, config.preflight);
}

async function handleAuthorizationRequest(
  request: McpOAuthProductionRouteAdapterRequestV1,
  config: McpOAuthProductionRouteAdapterConfigV1,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): Promise<McpOAuthProductionRouteAdapterResponseV1> {
  const preflight = config.preflight;
  if (!dependencies.authorizationRequestConfig || !dependencies.checkPreAuthQuota || !dependencies.createPreAuthIntent) {
    return failClosedResponse("oauth_authorize", preflight, "dependency_unavailable", 503);
  }
  if (!authorizationRequestConfigMatchesGuard(dependencies.authorizationRequestConfig, config.authorizationRequestGuard)) {
    return failClosedResponse("oauth_authorize", preflight, "invalid_configuration", 500);
  }
  const authorizationOrigin = readAuthorizationOrigin(dependencies.authorizationRequestConfig);
  if (!authorizationOrigin) {
    return failClosedResponse("oauth_authorize", preflight, "invalid_configuration", 500);
  }
  if (!requestHostMatchesOrigin(request, authorizationOrigin)) {
    return failClosedResponse("oauth_authorize", preflight, "invalid_host", 403);
  }

  const authorizationUrl = readSameOriginAuthorizationUrl(
    request.url,
    dependencies.authorizationRequestConfig,
    authorizationOrigin.origin,
  );
  if (!authorizationUrl) {
    return failClosedResponse("oauth_authorize", preflight, "invalid_authorization_request", 400);
  }

  const projection = projectMcpOAuthPreAuthAuthorizationRequest({
    kind: "mcp_oauth_pre_auth_authorization_request_projection_input",
    authorizationUrl,
    config: dependencies.authorizationRequestConfig,
    version: 1,
  });
  if (!projection.accepted) {
    if (projection.reason === "malformed_config") {
      return failClosedResponse("oauth_authorize", preflight, "invalid_configuration", 500);
    }
    return failClosedResponse("oauth_authorize", preflight, "invalid_authorization_request", 400);
  }

  const now = readNow(dependencies);
  let quotaResult: McpOAuthProductionPreAuthQuotaPortResultV1;
  const quotaInput = Object.freeze({
    authorizationPageOrigin: projection.serverOnly.authorizationPage.origin,
    clientId: projection.serverOnly.providerForwardRequest.clientId,
    resource: projection.serverOnly.providerForwardRequest.resource,
    callerKey: readQuotaCallerKey(request),
    now,
    version: 1,
  } satisfies McpOAuthProductionPreAuthQuotaPortInputV1);
  try {
    quotaResult = await checkPreAuthQuotaWithTimeout(
      dependencies.checkPreAuthQuota,
      quotaInput,
      PRE_AUTH_QUOTA_TIMEOUT_MS,
    );
  } catch {
    return failClosedResponse("oauth_authorize", preflight, "pre_auth_quota_denied", 503);
  }
  if (!isQuotaAccepted(quotaResult)) {
    return failClosedResponse(
      "oauth_authorize",
      preflight,
      "pre_auth_quota_denied",
      statusForPreAuthQuotaFailure(quotaResult),
    );
  }

  const codec = dependencies.handleCodec ?? defaultMcpOAuthContinuationHandleCodecV1;
  const generated = readGeneratedHandle(codec);
  if (!generated) {
    return failClosedResponse("oauth_authorize", preflight, "invalid_configuration", 500);
  }

  const createNow = readNow(dependencies);
  const createInput = Object.freeze({
    authorizationRequestProjection: projection.serverOnly,
    preAuthHandleHash: generated.intentHandleHash,
    now: createNow,
    deadlineEpochMs: createNow + PRE_AUTH_CREATE_TIMEOUT_MS,
    timeoutMs: PRE_AUTH_CREATE_TIMEOUT_MS,
    version: 1,
  } satisfies McpOAuthProductionPreAuthIntentCreatePortInputV1);
  let createResult: McpOAuthProductionPreAuthIntentCreatePortResultV1;
  try {
    createResult = await createPreAuthIntentWithTimeout(
      dependencies.createPreAuthIntent,
      createInput,
      PRE_AUTH_CREATE_TIMEOUT_MS,
    );
  } catch {
    return failClosedResponse("oauth_authorize", preflight, "pre_auth_create_failed", 503);
  }
  const validationNow = readNow(dependencies);
  if (!isPreAuthCreateSuccess(createResult, validationNow)) {
    return failClosedResponse(
      "oauth_authorize",
      preflight,
      "pre_auth_create_failed",
      statusForPreAuthCreateFailure(createResult),
    );
  }

  const browserNonce = readGeneratedBrowserBoundContinuationNonce(dependencies);
  if (!browserNonce) {
    return failClosedResponse("oauth_authorize", preflight, "invalid_configuration", 500);
  }

  return redirectToSignIn(generated.rawHandle, browserNonce, authorizationOrigin.origin);
}

async function handleLoginReturnContinuationRequest(
  request: McpOAuthProductionRouteAdapterRequestV1,
  config: McpOAuthProductionRouteAdapterConfigV1,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): Promise<McpOAuthProductionRouteAdapterResponseV1> {
  const preflight = config.preflight;
  if (
    !dependencies.authorizationRequestConfig ||
    !dependencies.bindPreAuthIntentToAuthenticatedOwner ||
    !dependencies.consumeAuthorizationIntent ||
    !dependencies.createAuthorizationCode ||
    !dependencies.readAuthenticatedOwnerIdentity
  ) {
    return failClosedResponse("oauth_login_return", preflight, "dependency_unavailable", 503);
  }
  if (!authorizationRequestConfigMatchesGuard(dependencies.authorizationRequestConfig, config.authorizationRequestGuard)) {
    return failClosedResponse("oauth_login_return", preflight, "invalid_configuration", 500);
  }
  const authorizationOrigin = readAuthorizationOrigin(dependencies.authorizationRequestConfig);
  if (!authorizationOrigin) {
    return failClosedResponse("oauth_login_return", preflight, "invalid_configuration", 500);
  }
  if (!requestHostMatchesOrigin(request, authorizationOrigin)) {
    return failClosedResponse("oauth_login_return", preflight, "invalid_host", 403);
  }

  const codec = dependencies.handleCodec ?? defaultMcpOAuthContinuationHandleCodecV1;
  const continuationRequest = readContinuationRequest(request.url, authorizationOrigin.origin, codec);
  if (!continuationRequest) {
    return failClosedResponse("oauth_login_return", preflight, "invalid_continuation_request", 400);
  }
  if (!browserBoundContinuationCookieMatches(request, continuationRequest.browserNonce)) {
    return failClosedResponse("oauth_login_return", preflight, "browser_bound_continuation_missing", 401);
  }
  const preAuthHandleHash = readHandleHash(continuationRequest.rawHandle, codec);
  if (!preAuthHandleHash) {
    return failClosedResponse("oauth_login_return", preflight, "invalid_continuation_request", 400);
  }

  const now = readNow(dependencies);
  let authenticatedOwnerIdentity: McpOAuthProductionAuthenticatedOwnerIdentityV1 | undefined;
  try {
    authenticatedOwnerIdentity = await dependencies.readAuthenticatedOwnerIdentity(request);
  } catch {
    return failClosedResponse("oauth_login_return", preflight, "owner_binding_failed", 401);
  }
  if (!isAuthenticatedOwnerIdentity(authenticatedOwnerIdentity)) {
    return failClosedResponse("oauth_login_return", preflight, "owner_binding_failed", 401);
  }

  let bindingResult: McpOAuthProductionPreAuthOwnerBindingPortResultV1;
  try {
    bindingResult = await bindPreAuthIntentToAuthenticatedOwnerWithTimeout(
      dependencies.bindPreAuthIntentToAuthenticatedOwner,
      {
        preAuthHandleHash,
        authenticatedOwnerIdentity,
        now,
        version: 1,
      },
      OWNER_BINDING_TIMEOUT_MS,
    );
  } catch {
    return failClosedResponse("oauth_login_return", preflight, "owner_binding_failed", 503);
  }
  if (!isOwnerBindingSuccess(bindingResult, now)) {
    return failClosedResponse(
      "oauth_login_return",
      preflight,
      "owner_binding_failed",
      statusForOwnerBindingFailure(bindingResult),
    );
  }

  let consumeResult: McpOAuthIntentConsumeResultV1;
  try {
    consumeResult = await consumeAuthorizationIntentWithTimeout(
      dependencies.consumeAuthorizationIntent,
      {
        trustedOwner: bindingResult.serverOnly.trustedOwner,
        intentHandleHash: preAuthHandleHash,
        now,
        version: 1,
      },
      AUTHORIZATION_INTENT_CONSUME_TIMEOUT_MS,
    );
  } catch {
    return failClosedResponse("oauth_login_return", preflight, "authorization_intent_consume_failed", 503);
  }
  if (!isAuthorizationIntentConsumeSuccess(consumeResult, bindingResult, dependencies.authorizationRequestConfig)) {
    return failClosedResponse(
      "oauth_login_return",
      preflight,
      "authorization_intent_consume_failed",
      statusForAuthorizationIntentConsumeFailure(consumeResult),
    );
  }

  const rawAuthorizationCode = readGeneratedAuthorizationCode(dependencies);
  if (!rawAuthorizationCode) {
    return failClosedResponse("oauth_login_return", preflight, "authorization_code_generation_failed", 500);
  }
  const codeNow = readNow(dependencies);
  const createCodeInput = buildAuthorizationCodeCreateInput(
    hashAuthorizationCode(rawAuthorizationCode),
    authenticatedOwnerIdentity,
    bindingResult.serverOnly.trustedOwner,
    consumeResult.serverOnly.authorizationRequestHandoff,
    codeNow,
  );

  let createCodeResult: McpOAuthProductionAuthorizationCodeCreatePortResultV1;
  try {
    createCodeResult = await createAuthorizationCodeWithTimeout(
      dependencies.createAuthorizationCode,
      createCodeInput,
      AUTHORIZATION_CODE_CREATE_TIMEOUT_MS,
    );
  } catch {
    return failClosedResponse("oauth_login_return", preflight, "authorization_code_create_failed", 503);
  }
  const codeValidationNow = readNow(dependencies);
  if (!isAuthorizationCodeCreateSuccess(createCodeResult, codeValidationNow)) {
    return failClosedResponse(
      "oauth_login_return",
      preflight,
      "authorization_code_create_failed",
      statusForAuthorizationCodeCreateFailure(createCodeResult),
    );
  }

  return redirectToOAuthClientWithAuthorizationCode(
    consumeResult.serverOnly.authorizationRequestHandoff,
    rawAuthorizationCode,
  );
}

async function handleTokenRequest(
  request: McpOAuthProductionRouteAdapterRequestV1,
  config: McpOAuthProductionRouteAdapterConfigV1,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): Promise<McpOAuthProductionRouteAdapterResponseV1> {
  const preflight = config.preflight;
  if (!dependencies.authorizationRequestConfig || !dependencies.checkPreAuthQuota || !dependencies.issueAccessToken) {
    return failClosedResponse("oauth_token", preflight, "dependency_unavailable", 503);
  }
  if (!authorizationRequestConfigMatchesGuard(dependencies.authorizationRequestConfig, config.authorizationRequestGuard)) {
    return failClosedResponse("oauth_token", preflight, "invalid_configuration", 500);
  }
  const authorizationOrigin = readAuthorizationOrigin(dependencies.authorizationRequestConfig);
  if (!authorizationOrigin) {
    return failClosedResponse("oauth_token", preflight, "invalid_configuration", 500);
  }
  if (!requestHostMatchesOrigin(request, authorizationOrigin)) {
    return failClosedResponse("oauth_token", preflight, "invalid_host", 403);
  }
  const expectedResource = readTokenResource(dependencies.authorizationRequestConfig.canonicalResource);
  if (!expectedResource) {
    return failClosedResponse("oauth_token", preflight, "invalid_configuration", 500);
  }

  const tokenRequest = readTokenRequest(request, expectedResource);
  if (!tokenRequest.ok) {
    return failClosedResponse("oauth_token", preflight, tokenRequest.reason, tokenRequest.status);
  }
  if (!dependencies.authorizationRequestConfig.clientIdPolicy.allowedClientIds.includes(tokenRequest.serverOnly.clientId)) {
    return failClosedResponse("oauth_token", preflight, "invalid_request", 400);
  }

  const now = readNow(dependencies);
  let quotaResult: McpOAuthProductionPreAuthQuotaPortResultV1;
  const quotaInput = Object.freeze({
    authorizationPageOrigin: authorizationOrigin.origin,
    clientId: tokenRequest.serverOnly.clientId,
    resource: tokenRequest.serverOnly.resource,
    callerKey: readQuotaCallerKey(request),
    now,
    version: 1,
  } satisfies McpOAuthProductionPreAuthQuotaPortInputV1);
  try {
    quotaResult = await checkPreAuthQuotaWithTimeout(
      dependencies.checkPreAuthQuota,
      quotaInput,
      PRE_AUTH_QUOTA_TIMEOUT_MS,
    );
  } catch {
    return failClosedResponse("oauth_token", preflight, "token_quota_denied", 503);
  }
  if (!isQuotaAccepted(quotaResult)) {
    return failClosedResponse(
      "oauth_token",
      preflight,
      "token_quota_denied",
      statusForPreAuthQuotaFailure(quotaResult),
    );
  }

  const rawAccessToken = readGeneratedAccessToken(dependencies);
  if (!rawAccessToken) {
    return failClosedResponse("oauth_token", preflight, "token_generation_failed", 500);
  }

  const issueNow = readNow(dependencies);
  let issueResult: McpOAuthProductionAccessTokenIssuePortResultV1;
  try {
    issueResult = await issueAccessTokenWithTimeout(
      dependencies.issueAccessToken,
      {
        authorizationCodeDigest: tokenRequest.serverOnly.authorizationCodeDigest,
        accessTokenDigest: hashAccessToken(rawAccessToken),
        clientId: tokenRequest.serverOnly.clientId,
        redirectUri: tokenRequest.serverOnly.redirectUri,
        resource: tokenRequest.serverOnly.resource,
        codeChallenge: tokenRequest.serverOnly.codeChallenge,
        now: issueNow,
        deadlineEpochMs: issueNow + ACCESS_TOKEN_ISSUE_TIMEOUT_MS,
        timeoutMs: ACCESS_TOKEN_ISSUE_TIMEOUT_MS,
        version: 1,
      },
      ACCESS_TOKEN_ISSUE_TIMEOUT_MS,
    );
  } catch {
    return failClosedResponse("oauth_token", preflight, "token_issue_failed", 503);
  }
  if (!isAccessTokenIssueSuccess(issueResult, tokenRequest.serverOnly, issueNow)) {
    return failClosedResponse(
      "oauth_token",
      preflight,
      "token_issue_failed",
      statusForAccessTokenIssueFailure(issueResult),
    );
  }

  return oauthAccessTokenResponse(rawAccessToken, issueResult, readNow(dependencies));
}

async function handleMcpRequest(
  request: McpOAuthProductionRouteAdapterRequestV1,
  config: McpOAuthProductionRouteAdapterConfigV1,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): Promise<McpOAuthProductionRouteAdapterResponseV1> {
  const preflight = config.preflight;
  if (!dependencies.authorizationRequestConfig || !dependencies.checkPreAuthQuota || !dependencies.verifyAccessToken) {
    return failClosedResponse("mcp", preflight, "dependency_unavailable", 503);
  }
  if (!authorizationRequestConfigMatchesGuard(dependencies.authorizationRequestConfig, config.authorizationRequestGuard)) {
    return failClosedResponse("mcp", preflight, "invalid_configuration", 500);
  }
  const authorizationOrigin = readAuthorizationOrigin(dependencies.authorizationRequestConfig);
  if (!authorizationOrigin) {
    return failClosedResponse("mcp", preflight, "invalid_configuration", 500);
  }
  const expectedResource = readTokenResource(dependencies.authorizationRequestConfig.canonicalResource);
  if (!expectedResource) {
    return failClosedResponse("mcp", preflight, "invalid_configuration", 500);
  }
  const resourceOrigin = readResourceOrigin(expectedResource);
  if (!resourceOrigin) {
    return failClosedResponse("mcp", preflight, "invalid_configuration", 500);
  }
  if (!requestHostMatchesOrigin(request, resourceOrigin)) {
    return failClosedResponse("mcp", preflight, "invalid_host", 403);
  }

  const bearerToken = readBearerAccessToken(request.headers, "authorization");
  if (!bearerToken.ok) {
    return mcpBearerAuthFailureResponse(
      preflight,
      expectedResource,
      "invalid_authorization_header",
      401,
      challengeForAuthorizationHeaderFailure(bearerToken.reason),
    );
  }

  const now = readNow(dependencies);
  const callerKey = readBearerVerificationQuotaCallerKey(request);
  if (!callerKey) {
    return failClosedResponse("mcp", preflight, "bearer_verification_caller_untrusted", 400);
  }
  let quotaResult: McpOAuthProductionPreAuthQuotaPortResultV1;
  const quotaInput = Object.freeze({
    authorizationPageOrigin: authorizationOrigin.origin,
    clientId: MCP_BEARER_VERIFICATION_QUOTA_CLIENT_ID,
    resource: expectedResource,
    callerKey,
    now,
    version: 1,
  } satisfies McpOAuthProductionPreAuthQuotaPortInputV1);
  try {
    quotaResult = await checkPreAuthQuotaWithTimeout(
      dependencies.checkPreAuthQuota,
      quotaInput,
      PRE_AUTH_QUOTA_TIMEOUT_MS,
    );
  } catch {
    return failClosedResponse("mcp", preflight, "bearer_verification_quota_denied", 503);
  }
  if (!isQuotaAccepted(quotaResult)) {
    return failClosedResponse(
      "mcp",
      preflight,
      "bearer_verification_quota_denied",
      statusForPreAuthQuotaFailure(quotaResult),
    );
  }

  let verifyResult: McpOAuthProductionAccessTokenVerifyPortResultV1;
  try {
    verifyResult = await verifyAccessTokenWithTimeout(
      dependencies.verifyAccessToken,
      {
        accessTokenDigest: hashAccessToken(bearerToken.serverOnly.rawAccessToken),
        allowedClientIds: Object.freeze([...dependencies.authorizationRequestConfig.clientIdPolicy.allowedClientIds]),
        resource: expectedResource,
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        now,
        version: 1,
      },
      ACCESS_TOKEN_VERIFY_TIMEOUT_MS,
    );
  } catch {
    return failClosedResponse("mcp", preflight, "bearer_verification_failed", 503);
  }
  if (!isAccessTokenVerifySuccess(verifyResult, dependencies.authorizationRequestConfig, expectedResource, now)) {
    const status = statusForAccessTokenVerifyFailure(verifyResult);
    return mcpBearerAuthFailureResponse(
      preflight,
      expectedResource,
      "bearer_verification_failed",
      status,
      challengeForAccessTokenVerifyFailure(verifyResult),
    );
  }

  if (!isMcpTransportOriginAllowed(request, [resourceOrigin, authorizationOrigin])) {
    return jsonResponse(403, buildMcpJsonRpcError(null, -32600, "Invalid Origin header."));
  }

  const jsonRpcMessage = parseMcpJsonRpcProtocolMessage(request.bodyText ?? "");
  if (!jsonRpcMessage) {
    return jsonResponse(400, buildMcpJsonRpcError(null, -32700, "Invalid JSON-RPC request."));
  }
  if (!isMcpProtocolVersionHeaderAllowed(request, jsonRpcMessage)) {
    const id = "id" in jsonRpcMessage ? jsonRpcMessage.id : null;
    return jsonResponse(400, buildMcpJsonRpcError(id, -32600, "Unsupported MCP protocol version."));
  }
  const envelope = buildMcpAuthenticatedProtocolEnvelope({
    verifiedClientId: verifyResult.serverOnly.clientId,
    verifiedResource: verifyResult.serverOnly.resource,
    verifiedScopes: verifyResult.serverOnly.scopes,
    accessTokenExpiresAt: verifyResult.serverOnly.expiresAt,
    callerKey,
    jsonRpcMessage,
    createdAt: now,
  });
  const privateBetaDecision = evaluateMcpProductionPrivateBetaGate({
    envelope,
    verifiedSubjectId: verifyResult.serverOnly.twoweeksClerkId,
    config: config.privateBeta,
  });
  if (!privateBetaDecision.allowed) {
    return mcpPrivateBetaGateDeniedResponse(preflight, privateBetaDecision);
  }
  const launchReadinessDecision = evaluateMcpProductionLaunchReadiness({
    privateBetaDecision,
    config: config.launchReadiness,
  });

  return await handleLaunchReadinessCheckedMcpJsonRpc(
    preflight,
    launchReadinessDecision,
    envelope,
    dependencies,
    verifyResult.serverOnly.twoweeksClerkId,
  );
}

function buildAuthorizationRequestGuard(
  input: McpOAuthProductionRoutePreflightInputV1,
): McpOAuthProductionAuthorizationRequestGuardV1 {
  const providerConfig = input.providerConfig;
  const expectedResource = typeof providerConfig?.resource === "string"
    ? providerConfig.resource.trim()
    : undefined;
  return Object.freeze({
    expectedResource,
    allowedClientIds: normalizeStringSet(providerConfig?.allowedClientIds),
    version: 1,
  });
}

function authorizationRequestConfigMatchesGuard(
  config: McpOAuthAuthorizationRequestBoundaryConfigV1,
  guard: McpOAuthProductionAuthorizationRequestGuardV1,
): boolean {
  return (
    typeof guard.expectedResource === "string" &&
    guard.expectedResource.length > 0 &&
    config.canonicalResource === guard.expectedResource &&
    config.clientIdPolicy.mode === "predefined_allowlist" &&
    isSameStringSet(config.clientIdPolicy.allowedClientIds, guard.allowedClientIds)
  );
}

function isSameStringSet(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length > 0 &&
    left.length === right.length &&
    left.every((value) => right.includes(value)) &&
    right.every((value) => left.includes(value))
  );
}

function freezePrivateBetaConfigInput(
  input: McpProductionPrivateBetaGateConfigInputV1,
): McpProductionPrivateBetaGateConfigInputV1 {
  return Object.freeze({
    ...(input.enabled !== undefined ? { enabled: input.enabled } : {}),
    ...(input.allowedClientIds ? { allowedClientIds: Object.freeze([...input.allowedClientIds]) } : {}),
    ...(input.allowedResources ? { allowedResources: Object.freeze([...input.allowedResources]) } : {}),
    ...(input.allowedSubjectIds ? { allowedSubjectIds: Object.freeze([...input.allowedSubjectIds]) } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
  });
}

function freezeLaunchReadinessConfigInput(
  input: McpProductionLaunchReadinessConfigInputV1,
): McpProductionLaunchReadinessConfigInputV1 {
  return Object.freeze({
    ...(input.publicLaunchRequested !== undefined ? { publicLaunchRequested: input.publicLaunchRequested } : {}),
    ...(input.evidence ? { evidence: Object.freeze({ ...input.evidence }) } : {}),
    ...(input.version !== undefined ? { version: input.version } : {}),
  });
}

function isQuotaAccepted(
  value: McpOAuthProductionPreAuthQuotaPortResultV1,
): value is Extract<McpOAuthProductionPreAuthQuotaPortResultV1, { ok: true }> {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_pre_auth_quota_result" &&
    value.ok === true &&
    value.reason === "accepted" &&
    value.safeForLogging === true &&
    value.version === 1
  );
}

function statusForPreAuthQuotaFailure(
  value: McpOAuthProductionPreAuthQuotaPortResultV1,
): 400 | 429 {
  return isPlainRecord(value) && value.ok === false && value.reason === "invalid_request" ? 400 : 429;
}

function checkPreAuthQuotaWithTimeout(
  checkPreAuthQuota: McpOAuthProductionPreAuthQuotaPortV1,
  input: McpOAuthProductionPreAuthQuotaPortInputV1,
  timeoutMs: number,
): Promise<McpOAuthProductionPreAuthQuotaPortResultV1> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("pre_auth_quota_timeout"));
    }, timeoutMs);

    try {
      checkPreAuthQuota(input).then(
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(toRejectedError(error, "pre_auth_quota_failed"));
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(toRejectedError(error, "pre_auth_quota_failed"));
    }
  });
}

function createPreAuthIntentWithTimeout(
  createPreAuthIntent: McpOAuthProductionPreAuthIntentCreatePortV1,
  input: McpOAuthProductionPreAuthIntentCreatePortInputV1,
  timeoutMs: number,
): Promise<McpOAuthProductionPreAuthIntentCreatePortResultV1> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("pre_auth_create_timeout"));
    }, timeoutMs);

    try {
      createPreAuthIntent(input).then(
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(toRejectedError(error, "pre_auth_create_failed"));
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(toRejectedError(error, "pre_auth_create_failed"));
    }
  });
}

function bindPreAuthIntentToAuthenticatedOwnerWithTimeout(
  bindPreAuthIntentToAuthenticatedOwner: McpOAuthProductionPreAuthOwnerBindingPortV1,
  input: McpOAuthProductionPreAuthOwnerBindingPortInputV1,
  timeoutMs: number,
): Promise<McpOAuthProductionPreAuthOwnerBindingPortResultV1> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("owner_binding_timeout"));
    }, timeoutMs);

    try {
      bindPreAuthIntentToAuthenticatedOwner(input).then(
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(toRejectedError(error, "owner_binding_failed"));
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(toRejectedError(error, "owner_binding_failed"));
    }
  });
}

function consumeAuthorizationIntentWithTimeout(
  consumeAuthorizationIntent: McpOAuthIntentConsumePortV1,
  input: Parameters<McpOAuthIntentConsumePortV1>[0],
  timeoutMs: number,
): Promise<McpOAuthIntentConsumeResultV1> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("authorization_intent_consume_timeout"));
    }, timeoutMs);

    try {
      consumeAuthorizationIntent(input).then(
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(toRejectedError(error, "authorization_intent_consume_failed"));
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(toRejectedError(error, "authorization_intent_consume_failed"));
    }
  });
}

function createAuthorizationCodeWithTimeout(
  createAuthorizationCode: McpOAuthProductionAuthorizationCodeCreatePortV1,
  input: McpOAuthProductionAuthorizationCodeCreatePortInputV1,
  timeoutMs: number,
): Promise<McpOAuthProductionAuthorizationCodeCreatePortResultV1> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("authorization_code_create_timeout"));
    }, timeoutMs);

    try {
      createAuthorizationCode(input).then(
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(toRejectedError(error, "authorization_code_create_failed"));
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(toRejectedError(error, "authorization_code_create_failed"));
    }
  });
}

function validateAuthorizationCodeWithTimeout(
  validateAuthorizationCode: McpOAuthProductionAuthorizationCodeValidatePortV1,
  input: McpOAuthProductionAuthorizationCodeValidatePortInputV1,
  timeoutMs: number,
): Promise<McpOAuthProductionAuthorizationCodeValidatePortResultV1> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("authorization_code_validate_timeout"));
    }, timeoutMs);

    try {
      validateAuthorizationCode(input).then(
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(toRejectedError(error, "authorization_code_validate_failed"));
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(toRejectedError(error, "authorization_code_validate_failed"));
    }
  });
}

function issueAccessTokenWithTimeout(
  issueAccessToken: McpOAuthProductionAccessTokenIssuePortV1,
  input: McpOAuthProductionAccessTokenIssuePortInputV1,
  timeoutMs: number,
): Promise<McpOAuthProductionAccessTokenIssuePortResultV1> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("access_token_issue_timeout"));
    }, timeoutMs);

    try {
      issueAccessToken(input).then(
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(toRejectedError(error, "access_token_issue_failed"));
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(toRejectedError(error, "access_token_issue_failed"));
    }
  });
}

function verifyAccessTokenWithTimeout(
  verifyAccessToken: McpOAuthProductionAccessTokenVerifyPortV1,
  input: McpOAuthProductionAccessTokenVerifyPortInputV1,
  timeoutMs: number,
): Promise<McpOAuthProductionAccessTokenVerifyPortResultV1> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("access_token_verify_timeout"));
    }, timeoutMs);

    try {
      verifyAccessToken(input).then(
        (result) => {
          clearTimeout(timeout);
          resolve(result);
        },
        (error: unknown) => {
          clearTimeout(timeout);
          reject(toRejectedError(error, "access_token_verify_failed"));
        },
      );
    } catch (error) {
      clearTimeout(timeout);
      reject(toRejectedError(error, "access_token_verify_failed"));
    }
  });
}

function normalizeStringSet(value: unknown): readonly string[] {
  if (!Array.isArray(value)) return [];
  return Object.freeze(
    [...new Set(value.map((item) => (typeof item === "string" ? item.trim() : "")).filter((item) => item.length > 0))]
      .sort(),
  );
}

function routeNameForPath(path: string): McpOAuthProductionRouteNameV1 | undefined {
  if (path === MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH) return "oauth_authorize";
  if (path === MCP_OAUTH_CONTINUATION_PATH) return "oauth_login_return";
  if (path === MCP_OAUTH_PRODUCTION_TOKEN_PATH) return "oauth_token";
  if (path === MCP_OAUTH_PRODUCTION_CALLBACK_PATH) return "oauth_callback";
  if (path === MCP_OAUTH_PRODUCTION_MCP_PATH) return "mcp";
  return undefined;
}

function isRouteAllowedByPreflight(
  route: McpOAuthProductionRouteNameV1,
  preflight: McpOAuthProductionRoutePreflightResultV1,
): boolean {
  return route === "oauth_authorize" || route === "oauth_login_return" || route === "oauth_token" || route === "mcp"
    ? preflight.authorizeAllowedToWire
    : preflight.allowedToWire;
}

function isAllowedMethod(route: McpOAuthProductionRouteNameV1, method: string): boolean {
  return method.toUpperCase() === allowedMethodForRoute(route);
}

function allowedMethodForRoute(route: McpOAuthProductionRouteNameV1): "GET" | "POST" {
  if (route === "mcp" || route === "oauth_token") return "POST";
  return "GET";
}

function failClosedResponse(
  route: McpOAuthProductionRouteNameV1,
  preflight: McpOAuthProductionRoutePreflightResultV1,
  reason: McpOAuthProductionRouteFailureReasonV1,
  status: number,
  headers: Readonly<Record<string, string>> = {},
  extraJson: Readonly<Record<string, unknown>> = {},
): McpOAuthProductionRouteAdapterResponseV1 {
  return jsonResponse(status, {
    kind: "mcp_oauth_production_route_response",
    status: "blocked",
    reason,
    route,
    message: "Production MCP OAuth route unavailable.",
    safeForModel: true,
    allowedByPreflight: isRouteAllowedByPreflight(route, preflight),
    preflightDecision: preflight.decision,
    guardedInertHandlerReached: false,
    authorizationRequestAccepted: false,
    authorizationCodeAccepted: false,
    authorizationCodeIssued: false,
    authorizationCodeConsumed: false,
    redirectSecretAccepted: false,
    providerCalled: false,
    tokenExchangeAttempted: false,
    tokenIssued: false,
    preAuthIntentCreated: false,
    ownerBound: false,
    consentCompleted: false,
    accountLinkCreated: false,
    tokenPersisted: false,
    refreshTokenPersisted: false,
    providerSecretsExposed: false,
    rawProviderConfigExposed: false,
    ownerIdentifiersExposed: false,
    authorizationCodesExposed: false,
    redirectSecretsExposed: false,
    hostedMcpStarted: false,
    ...extraJson,
    version: 1,
  }, headers);
}

function mcpBearerAuthFailureResponse(
  preflight: McpOAuthProductionRoutePreflightResultV1,
  expectedResource: string,
  reason: Extract<McpOAuthProductionRouteFailureReasonV1, "invalid_authorization_header" | "bearer_verification_failed">,
  status: number,
  challengeInput: Readonly<{
    reason: McpBearerAuthChallengeReasonV1;
    error?: McpBearerAuthChallengeErrorV1;
  }> | undefined,
): McpOAuthProductionRouteAdapterResponseV1 {
  if (!challengeInput || status < 400 || status >= 500) {
    return failClosedResponse("mcp", preflight, reason, status);
  }
  const protectedResourceMetadataUrl = protectedResourceMetadataUrlForResource(expectedResource);
  if (!protectedResourceMetadataUrl) {
    return failClosedResponse("mcp", preflight, reason, status);
  }
  const challenge = buildBearerAuthChallenge({
    reason: challengeInput.reason,
    protectedResourceMetadataUrl,
    ...(challengeInput.error ? { error: challengeInput.error } : {}),
  });
  return failClosedResponse(
    "mcp",
    preflight,
    reason,
    status,
    { "WWW-Authenticate": challenge.header },
    { _meta: buildMcpWwwAuthenticateMeta(challenge) },
  );
}

function mcpPrivateBetaGateDeniedResponse(
  preflight: McpOAuthProductionRoutePreflightResultV1,
  decision: Exclude<McpProductionPrivateBetaGateDecisionV1, { allowed: true }>,
): McpOAuthProductionRouteAdapterResponseV1 {
  return failClosedResponse(
    "mcp",
    preflight,
    "private_beta_gate_denied",
    403,
    {},
    {
      message: "Production MCP private beta access denied.",
      privateBetaGateAllowed: false,
      privateBetaGateCode: decision.code,
      privateBetaGateInputEchoed: decision.inputEchoed,
      privateBetaGateConfigEchoed: decision.configEchoed,
    },
  );
}

function mcpLaunchReadinessBlockedResponse(
  preflight: McpOAuthProductionRoutePreflightResultV1,
  decision: McpProductionLaunchReadinessDecisionV1,
): McpOAuthProductionRouteAdapterResponseV1 {
  return failClosedResponse(
    "mcp",
    preflight,
    "launch_readiness_blocked",
    403,
    {},
    {
      message: "Production MCP public launch readiness blocked.",
      launchReadinessCode: decision.code,
      launchReadinessPublicLaunchAllowed: decision.publicLaunchAllowed,
      launchReadinessPublicLaunchBlocked: decision.publicLaunchBlocked,
      launchReadinessPrivateBetaGateCode: decision.privateBetaGateCode,
      launchReadinessInputEchoed: decision.inputEchoed,
      launchReadinessConfigEchoed: decision.configEchoed,
      launchReadinessEvidenceEchoed: decision.evidenceEchoed,
    },
  );
}

function mcpLaunchReadinessBlockedResponseIfNeeded(
  preflight: McpOAuthProductionRoutePreflightResultV1,
  decision: McpProductionLaunchReadinessDecisionV1,
): McpOAuthProductionRouteAdapterResponseV1 | undefined {
  if (decision.code !== "public_launch_blocked") return undefined;
  return mcpLaunchReadinessBlockedResponse(preflight, decision);
}

function challengeForAuthorizationHeaderFailure(
  reason: Exclude<ReturnType<typeof readBearerAccessToken>, { ok: true }>["reason"],
): Readonly<{
  reason: McpBearerAuthChallengeReasonV1;
  error?: McpBearerAuthChallengeErrorV1;
}> {
  return reason === "missing_authorization_header"
    ? { reason: "missing_token" }
    : { reason: "invalid_token", error: "invalid_request" };
}

function challengeForAccessTokenVerifyFailure(
  value: McpOAuthProductionAccessTokenVerifyPortResultV1,
): Readonly<{
  reason: McpBearerAuthChallengeReasonV1;
  error?: McpBearerAuthChallengeErrorV1;
}> | undefined {
  if (!isPlainRecord(value) || value.ok !== false) return { reason: "invalid_token" };
  if (value.reason === "storage_unavailable" || value.reason === "malformed_storage_record" || value.reason === "duplicate_storage_record") {
    return undefined;
  }
  if (value.reason === "missing_required_scope" || value.reason === "unauthorized_scope_state") {
    return { reason: "insufficient_scope" };
  }
  return { reason: "invalid_token" };
}

function protectedResourceMetadataUrlForResource(resource: string): string | undefined {
  try {
    const parsed = new URL(resource);
    const normalizedPath = canonicalResourcePath(parsed.pathname);
    return `${parsed.origin}${WELL_KNOWN_PROTECTED_RESOURCE_PATH}${normalizedPath === "/" ? "" : normalizedPath}`;
  } catch {
    return undefined;
  }
}

function canonicalResourcePath(path: string): string {
  let end = path.length;
  while (end > 1 && path.charCodeAt(end - 1) === 47) {
    end -= 1;
  }
  const normalized = path.slice(0, end);
  return normalized.length === 0 ? "/" : normalized;
}

function inertGuardedResponse(
  route: McpOAuthProductionRouteNameV1,
  preflight: McpOAuthProductionRoutePreflightResultV1,
): McpOAuthProductionRouteAdapterResponseV1 {
  return jsonResponse(501, {
    kind: "mcp_oauth_production_route_response",
    status: "guarded_inert",
    reason: "inert_handler_only",
    route,
    message: "Production MCP OAuth route is guarded and inert.",
    safeForModel: true,
    allowedByPreflight: isRouteAllowedByPreflight(route, preflight),
    preflightDecision: preflight.decision,
    guardedInertHandlerReached: true,
    oauthExecutionStarted: false,
    authorizationRequestAccepted: false,
    authorizationCodeAccepted: false,
    authorizationCodeIssued: false,
    authorizationCodeConsumed: false,
    redirectSecretAccepted: false,
    providerCalled: false,
    tokenExchangeAttempted: false,
    tokenIssued: false,
    preAuthIntentCreated: false,
    ownerBound: false,
    consentCompleted: false,
    accountLinkCreated: false,
    tokenPersisted: false,
    refreshTokenPersisted: false,
    providerSecretsExposed: false,
    rawProviderConfigExposed: false,
    ownerIdentifiersExposed: false,
    authorizationCodesExposed: false,
    redirectSecretsExposed: false,
    hostedMcpStarted: false,
    handlerMode: "inert_guarded_only",
    version: 1,
  });
}

async function handleAuthenticatedMcpJsonRpc(
  envelope: McpAuthenticatedProtocolEnvelopeV1,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
  twoweeksClerkId: string,
): Promise<McpOAuthProductionRouteAdapterResponseV1> {
  const decision = evaluateMcpProductionPolicy(envelope);
  if (decision.decision === "allow_read_only_call") {
    return await toolsCallBoundaryResponse(envelope, dependencies.executeReadonlySummaryTool, twoweeksClerkId);
  }
  if (decision.decision !== "allow_protocol" && decision.decision !== "allow_metadata") {
    return blockedMcpPolicyDecisionResponse(envelope, decision.decision);
  }
  return allowedMcpPolicyDecisionResponse(envelope, decision);
}

async function handleLaunchReadinessCheckedMcpJsonRpc(
  preflight: McpOAuthProductionRoutePreflightResultV1,
  launchReadinessDecision: McpProductionLaunchReadinessDecisionV1,
  envelope: McpAuthenticatedProtocolEnvelopeV1,
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
  twoweeksClerkId: string,
): Promise<McpOAuthProductionRouteAdapterResponseV1> {
  const launchReadinessBlock = mcpLaunchReadinessBlockedResponseIfNeeded(preflight, launchReadinessDecision);
  if (launchReadinessBlock) return launchReadinessBlock;
  return await handleAuthenticatedMcpJsonRpc(envelope, dependencies, twoweeksClerkId);
}

async function toolsCallBoundaryResponse(
  envelope: McpAuthenticatedProtocolEnvelopeV1,
  executeReadonlySummaryTool: McpProductionReadonlySummaryExecutorV1 | undefined,
  twoweeksClerkId: string,
): Promise<McpOAuthProductionRouteAdapterResponseV1> {
  const id = envelope.jsonRpc.id ?? null;
  const validation = validateMcpProductionToolsCallBoundary({
    method: envelope.jsonRpc.method,
    params: envelope.jsonRpc.params,
    version: 1,
  });
  if (!validation.valid) {
    return jsonResponse(
      200,
      buildMcpJsonRpcError(id, -32602, messageForMcpProductionToolsCallBoundaryError(validation.error)),
    );
  }
  if (!executeReadonlySummaryTool) {
    return jsonResponse(200, buildMcpJsonRpcError(id, -32000, MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE));
  }
  const executionInput = buildMcpProductionReadonlySummaryExecutionInput({
    validation,
    twoweeksClerkId,
    version: 1,
  });
  if (!executionInput) {
    return jsonResponse(200, buildMcpJsonRpcError(id, -32000, MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE));
  }
  let executionResult: Awaited<ReturnType<McpProductionReadonlySummaryExecutorV1>>;
  try {
    executionResult = await executeReadonlySummaryTool(executionInput);
  } catch {
    return jsonResponse(200, buildMcpJsonRpcError(id, -32000, MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE));
  }
  if (!executionResult.ok) {
    return jsonResponse(200, buildMcpJsonRpcError(id, -32000, MCP_PRODUCTION_READONLY_SUMMARY_EXECUTION_FAILURE_MESSAGE));
  }
  return jsonResponse(200, {
    jsonrpc: "2.0",
    id,
    result: {
      content: executionResult.content,
      structuredContent: executionResult.structuredContent,
    },
  });
}

function blockedMcpPolicyDecisionResponse(
  envelope: McpAuthenticatedProtocolEnvelopeV1,
  decision: "invalid_params" | "method_not_found",
): McpOAuthProductionRouteAdapterResponseV1 {
  const id = envelope.jsonRpc.id ?? null;
  if (decision === "invalid_params") {
    return jsonResponse(200, buildMcpJsonRpcError(id, -32602, "Invalid tools/list params."));
  }
  return jsonResponse(200, buildMcpJsonRpcError(id, -32601, "Method not found."));
}

function allowedMcpPolicyDecisionResponse(
  envelope: McpAuthenticatedProtocolEnvelopeV1,
  decision: Extract<McpProductionPolicyDecisionV1, { decision: "allow_protocol" | "allow_metadata" }>,
): McpOAuthProductionRouteAdapterResponseV1 {
  const id = envelope.jsonRpc.id ?? null;
  switch (decision.method) {
    case "notifications/initialized":
      return jsonResponse(202, null);
    case "initialize":
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: MCP_PRODUCTION_PROTOCOL_VERSION,
          serverInfo: {
            name: "twoweeks-production-mcp-auth-boundary",
            version: "1.0.0",
          },
          capabilities: {
            tools: {
              listChanged: false,
            },
          },
        },
      });
    case "ping":
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id,
        result: {},
      });
    case "tools/list":
      return jsonResponse(200, {
        jsonrpc: "2.0",
        id,
        result: buildMcpProductionToolsListResult(),
      });
  }
  return assertNeverAllowedMcpPolicyDecision(decision);
}

function buildMcpJsonRpcError(id: McpJsonRpcIdV1, code: number, message: string): unknown {
  return Object.freeze({
    jsonrpc: "2.0",
    id,
    error: Object.freeze({
      code,
      message,
      safeForModel: true,
    }),
  });
}

function assertNeverAllowedMcpPolicyDecision(_decision: never): never {
  throw new Error("Unhandled allowed MCP policy decision.");
}

function notHandled(): McpOAuthProductionRouteAdapterResponseV1 {
  return Object.freeze({
    handled: false,
    status: 404,
    headers: noStoreHeaders(),
    bodyText: "",
  });
}

function oauthAccessTokenResponse(
  rawAccessToken: string,
  issueResult: Extract<McpOAuthProductionAccessTokenIssuePortResultV1, { ok: true }>,
  now: number,
): McpOAuthProductionRouteAdapterResponseV1 {
  const scopes = tokenResponseAccessScopes(issueResult.serverOnly.scopes).join(" ");
  const expiresIn = Math.min(
    issueResult.serverOnly.expiresIn,
    Math.max(0, Math.floor((issueResult.serverOnly.expiresAt - now) / 1_000)),
  );
  return jsonResponse(200, {
    access_token: rawAccessToken,
    token_type: issueResult.serverOnly.tokenType,
    expires_in: expiresIn,
    ...(scopes ? { scope: scopes } : {}),
  });
}

function tokenResponseAccessScopes(scopes: readonly string[]): readonly string[] {
  return Object.freeze(scopes.filter((scope) => !isOpenIdConnectIdentityScope(scope)));
}

function isOpenIdConnectIdentityScope(scope: string): boolean {
  return scope === "openid" || scope === "email" || scope === "profile";
}

function redirectToSignIn(
  rawHandle: string,
  browserNonce: string,
  authorizationPageOrigin: string,
): McpOAuthProductionRouteAdapterResponseV1 {
  const continuationPath = `${MCP_OAUTH_CONTINUATION_PATH}?${new URLSearchParams({
    [MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER]: rawHandle,
    [BROWSER_BOUND_CONTINUATION_NONCE_PARAMETER]: browserNonce,
  }).toString()}`;
  const signInUrl = `${authorizationPageOrigin}/sign-in?${new URLSearchParams({
    [MCP_OAUTH_SIGN_IN_RETURN_PARAMETER]: continuationPath,
  }).toString()}`;
  return Object.freeze({
    handled: true,
    status: 303,
    headers: {
      ...noStoreHeaders(),
      location: signInUrl,
      "set-cookie": browserBoundContinuationCookie(browserNonce),
    },
    bodyText: "",
  });
}

function redirectToOAuthClientWithAuthorizationCode(
  handoff: McpOAuthAuthorizationRequestBoundaryHandoffV1,
  rawAuthorizationCode: string,
): McpOAuthProductionRouteAdapterResponseV1 {
  const redirectUri = new URL(handoff.providerForwardRequest.redirectUri);
  redirectUri.searchParams.append("code", rawAuthorizationCode);
  redirectUri.searchParams.append("state", handoff.providerForwardRequest.state);
  return Object.freeze({
    handled: true,
    status: 303,
    headers: {
      ...noStoreHeaders(),
      location: redirectUri.toString(),
    },
    bodyText: "",
  });
}

function readTokenRequest(
  request: McpOAuthProductionRouteAdapterRequestV1,
  expectedResource: string,
): Readonly<
  | {
      ok: true;
      serverOnly: {
        authorizationCodeDigest: string;
        clientId: string;
        redirectUri: string;
        resource: string;
        codeChallenge: string;
        version: 1;
      };
    }
  | {
      ok: false;
      reason:
        | "unsupported_token_content_type"
        | "token_request_body_too_large"
        | "invalid_request"
        | "invalid_target";
      status: 400 | 413 | 415;
    }
> {
  if (!isFormUrlEncodedContentType(request.headers?.["content-type"])) {
    return Object.freeze({ ok: false, reason: "unsupported_token_content_type", status: 415 });
  }
  const bodyText = request.bodyText;
  if (typeof bodyText !== "string" || bodyText.length === 0 || hasControlCharacter(bodyText)) {
    return Object.freeze({ ok: false, reason: "invalid_request", status: 400 });
  }
  if (byteLength(bodyText) > TOKEN_REQUEST_BODY_MAX_BYTES) {
    return Object.freeze({ ok: false, reason: "token_request_body_too_large", status: 413 });
  }
  if (hasMalformedPercentEncoding(bodyText)) {
    return Object.freeze({ ok: false, reason: "invalid_request", status: 400 });
  }

  const params = new URLSearchParams(bodyText);
  const resourceValues = params.getAll("resource");
  if (resourceValues.length === 0) {
    return Object.freeze({ ok: false, reason: "invalid_target", status: 400 });
  }
  if (!hasExactlyTokenRequestKeys(params)) {
    return Object.freeze({ ok: false, reason: "invalid_request", status: 400 });
  }
  if (params.get("grant_type") !== "authorization_code") {
    return Object.freeze({ ok: false, reason: "invalid_request", status: 400 });
  }

  const code = params.get("code");
  const clientId = readBoundedTokenParameter(params.get("client_id"), 512);
  const redirectUri = readTokenRedirectUri(params.get("redirect_uri"));
  const resource = readTokenResource(resourceValues[0]);
  const codeVerifier = readCodeVerifier(params.get("code_verifier"));
  if (!resource || resource !== expectedResource) {
    return Object.freeze({ ok: false, reason: "invalid_target", status: 400 });
  }
  if (!code || !AUTHORIZATION_CODE_PATTERN.test(code) || !clientId || !redirectUri || !codeVerifier) {
    return Object.freeze({ ok: false, reason: "invalid_request", status: 400 });
  }

  return Object.freeze({
    ok: true,
    serverOnly: Object.freeze({
      authorizationCodeDigest: hashAuthorizationCode(code),
      clientId,
      redirectUri,
      resource,
      codeChallenge: hashPkceCodeVerifierS256(codeVerifier),
      version: 1,
    }),
  });
}

function readBearerAccessToken(
  headers: McpOAuthProductionRouteAdapterRequestV1["headers"],
  name: string,
): Readonly<
  | {
      ok: true;
      serverOnly: {
        rawAccessToken: string;
        version: 1;
      };
    }
  | {
      ok: false;
      reason:
        | "missing_authorization_header"
        | "ambiguous_authorization_header"
        | "malformed_authorization_header"
        | "oversized_authorization_header";
    }
> {
  const value = readHeaderValueByName(headers, name);
  if (value === undefined) {
    return Object.freeze({ ok: false, reason: "missing_authorization_header" });
  }
  if (value === "ambiguous") {
    return Object.freeze({ ok: false, reason: "ambiguous_authorization_header" });
  }
  if (value.length > AUTHORIZATION_HEADER_MAX_LENGTH) {
    return Object.freeze({ ok: false, reason: "oversized_authorization_header" });
  }
  const match = /^Bearer ([A-Za-z0-9_-]{43})$/iu.exec(value);
  if (!match?.[1] || hasControlCharacter(value)) {
    return Object.freeze({ ok: false, reason: "malformed_authorization_header" });
  }
  return Object.freeze({
    ok: true,
    serverOnly: Object.freeze({
      rawAccessToken: match[1],
      version: 1,
    }),
  });
}

function readHeaderValueByName(
  headers: McpOAuthProductionRouteAdapterRequestV1["headers"],
  name: string,
): string | "ambiguous" | undefined {
  if (!headers) return undefined;
  const values: Array<string | readonly string[] | undefined> = [];
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === name) values.push(value);
  }
  if (values.length === 0) return undefined;
  if (values.length > 1) return "ambiguous";
  const value = values[0];
  if (Array.isArray(value)) {
    if (value.length !== 1) return "ambiguous";
    return typeof value[0] === "string" ? value[0].trim() : "ambiguous";
  }
  return typeof value === "string" ? value.trim() : undefined;
}

function hasExactlyTokenRequestKeys(params: URLSearchParams): boolean {
  const keys = [...params.keys()];
  return (
    keys.length === TOKEN_REQUEST_KEYS.length &&
    TOKEN_REQUEST_KEYS.every((key) => params.getAll(key).length === 1) &&
    keys.every((key) => TOKEN_REQUEST_KEYS.includes(key as never))
  );
}

function isFormUrlEncodedContentType(value: string | readonly string[] | undefined): boolean {
  const contentType = readSingleHeaderValue(value);
  return contentType?.toLowerCase().split(";")[0]?.trim() === "application/x-www-form-urlencoded";
}

function readBoundedTokenParameter(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return undefined;
  if (hasControlCharacter(value)) return undefined;
  return value;
}

function readTokenRedirectUri(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return undefined;
  if (hasControlCharacter(value)) return undefined;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.origin === "null" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.hash
    ) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function readTokenResource(value: unknown): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return undefined;
  if (hasControlCharacter(value)) return undefined;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol !== "https:" ||
      parsed.origin === "null" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password ||
      parsed.hash ||
      parsed.search
    ) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function readCodeVerifier(value: unknown): string | undefined {
  if (typeof value !== "string" || !PKCE_CODE_VERIFIER_PATTERN.test(value) || hasControlCharacter(value)) {
    return undefined;
  }
  return value;
}

function hashPkceCodeVerifierS256(codeVerifier: string): string {
  return base64UrlNoPadding(createHash("sha256").update(codeVerifier, "ascii").digest());
}

function readSameOriginAuthorizationUrl(
  urlOrPath: string,
  config: McpOAuthAuthorizationRequestBoundaryConfigV1,
  authorizationPageOrigin: string,
): string | undefined {
  if (isUnsafeRouteInput(urlOrPath)) return undefined;
  try {
    const parsed = new URL(urlOrPath, authorizationPageOrigin);
    const queryStart = urlOrPath.indexOf("?");
    const rawPath = queryStart === -1 ? urlOrPath : urlOrPath.slice(0, queryStart);
    if (
      parsed.origin !== authorizationPageOrigin ||
      parsed.pathname !== config.authorizationPagePath ||
      rawPath !== config.authorizationPagePath ||
      parsed.hash ||
      hasUnsafeRawPath(rawPath)
    ) {
      return undefined;
    }
    return parsed.toString();
  } catch {
    return undefined;
  }
}

function requestHostMatchesOrigin(
  request: McpOAuthProductionRouteAdapterRequestV1,
  origin: McpOAuthProductionAuthorizationOriginV1,
): boolean {
  const host = readSingleHeaderValue(request.headers?.host);
  const parsedHost = host ? parseHostHeader(host, origin.protocol) : undefined;
  return (
    parsedHost !== undefined &&
    parsedHost.hostname === origin.hostname &&
    parsedHost.port === origin.port
  );
}

function readQuotaCallerKey(request: McpOAuthProductionRouteAdapterRequestV1): string {
  return (
    readForwardedCallerKey(request.headers?.["x-forwarded-for"]) ??
    readHeaderCallerKey(request.headers?.["cf-connecting-ip"]) ??
    readHeaderCallerKey(request.headers?.["x-real-ip"]) ??
    normalizeCallerKey(request.remoteAddress) ??
    "unknown"
  );
}

function readBearerVerificationQuotaCallerKey(request: McpOAuthProductionRouteAdapterRequestV1): string | undefined {
  return canonicalizeBearerVerificationQuotaCallerKey(request.remoteAddress);
}

function canonicalizeBearerVerificationQuotaCallerKey(remoteAddress: string | undefined): string | undefined {
  if (remoteAddress !== undefined && hasControlCharacter(remoteAddress)) return undefined;
  const normalized = normalizeCallerKey(remoteAddress);
  if (!normalized) return undefined;
  const ipVersion = isIP(normalized);
  if (ipVersion === 4) return normalized;
  if (ipVersion !== 6) return undefined;
  const canonicalIpv6Address = readCanonicalIpv6SocketAddress(normalized) ?? normalized.toLowerCase();
  return readIpv4MappedIpv6Address(canonicalIpv6Address) ?? canonicalIpv6Address;
}

function readCanonicalIpv6SocketAddress(value: string): string | undefined {
  try {
    const socketAddressParser = SocketAddress as unknown as {
      parse?: (input: string) => Readonly<{ address: string; family: string }> | undefined;
    };
    const parsed = socketAddressParser.parse?.(`[${value}]:0`);
    return parsed?.family === "ipv6" ? parsed.address : undefined;
  } catch {
    return undefined;
  }
}

function readIpv4MappedIpv6Address(value: string): string | undefined {
  const match = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/u.exec(value.toLowerCase());
  const ipv4Address = match?.[1];
  return ipv4Address && isIP(ipv4Address) === 4 ? ipv4Address : undefined;
}

function readForwardedCallerKey(value: string | readonly string[] | undefined): string | undefined {
  const header = readSingleHeaderValue(value);
  if (!header) return undefined;
  return normalizeCallerKey(header.split(",")[0] ?? "");
}

function readHeaderCallerKey(value: string | readonly string[] | undefined): string | undefined {
  const header = readSingleHeaderValue(value);
  return header ? normalizeCallerKey(header) : undefined;
}

function isMcpTransportOriginAllowed(
  request: McpOAuthProductionRouteAdapterRequestV1,
  allowedOrigins: readonly McpOAuthProductionAuthorizationOriginV1[],
): boolean {
  const originHeader = readHeaderValueByName(request.headers, "origin");
  if (originHeader === undefined) return true;
  if (originHeader === "ambiguous") return false;
  const origin = readMcpOriginHeaderOrigin(originHeader);
  return origin !== undefined && allowedOrigins.some((allowedOrigin) => origin === allowedOrigin.origin);
}

function readMcpOriginHeaderOrigin(value: string): string | undefined {
  if (!value || value.length > 512 || hasControlCharacter(value)) return undefined;
  try {
    const parsed = new URL(value);
    return isMcpOriginHeaderUrlShapeAllowed(parsed) ? parsed.origin : undefined;
  } catch {
    return undefined;
  }
}

function isMcpOriginHeaderUrlShapeAllowed(parsed: URL): boolean {
  const pathAllowed = parsed.pathname === "" || parsed.pathname === "/";
  return [
    parsed.origin !== "null",
    parsed.hostname.length > 0,
    parsed.username === "",
    parsed.password === "",
    pathAllowed,
    parsed.search === "",
    parsed.hash === "",
  ].every((allowed) => allowed);
}

function isMcpProtocolVersionHeaderAllowed(
  request: McpOAuthProductionRouteAdapterRequestV1,
  message: McpJsonRpcProtocolMessageV1,
): boolean {
  if (message.method === "initialize") return true;
  const protocolVersion = readHeaderValueByName(request.headers, "mcp-protocol-version");
  return protocolVersion === MCP_PRODUCTION_PROTOCOL_VERSION;
}

function normalizeCallerKey(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  if (!normalized || normalized.length > 128 || hasControlCharacter(normalized)) return undefined;
  return normalized;
}

function readGeneratedHandle(
  codec: McpOAuthContinuationHandleCodecV1,
): Readonly<{ rawHandle: string; intentHandleHash: string }> | undefined {
  try {
    const generated = codec.generate();
    if (
      !generated ||
      typeof generated.rawHandle !== "string" ||
      typeof generated.intentHandleHash !== "string" ||
      !codec.validate(generated.rawHandle) ||
      readHandleHash(generated.rawHandle, codec) !== generated.intentHandleHash
    ) {
      return undefined;
    }
    return isValidIntentHandleHash(generated.intentHandleHash) ? generated : undefined;
  } catch {
    return undefined;
  }
}

function readGeneratedBrowserBoundContinuationNonce(
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): string | undefined {
  try {
    const nonce = dependencies.generateBrowserBoundContinuationNonce?.() ?? generateDefaultBrowserBoundContinuationNonce();
    return isBrowserBoundContinuationNonce(nonce) ? nonce : undefined;
  } catch {
    return undefined;
  }
}

function readGeneratedAuthorizationCode(
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): string | undefined {
  try {
    const authorizationCode = dependencies.generateAuthorizationCode?.() ?? generateDefaultAuthorizationCode();
    return typeof authorizationCode === "string" && AUTHORIZATION_CODE_PATTERN.test(authorizationCode)
      ? authorizationCode
      : undefined;
  } catch {
    return undefined;
  }
}

function readGeneratedAccessToken(
  dependencies: McpOAuthProductionRouteAdapterDependenciesV1,
): string | undefined {
  try {
    const accessToken = dependencies.generateAccessToken?.() ?? generateDefaultAccessToken();
    return typeof accessToken === "string" && ACCESS_TOKEN_PATTERN.test(accessToken)
      ? accessToken
      : undefined;
  } catch {
    return undefined;
  }
}

function generateDefaultAuthorizationCode(): string {
  return randomBytes(AUTHORIZATION_CODE_BYTE_LENGTH).toString("base64url");
}

function generateDefaultAccessToken(): string {
  return randomBytes(ACCESS_TOKEN_BYTE_LENGTH).toString("base64url");
}

function hashAuthorizationCode(rawAuthorizationCode: string): string {
  const digest = createHash("sha256").update(rawAuthorizationCode, "utf8").digest("hex");
  if (!isValidAuthorizationCodeDigest(digest)) throw new TypeError("invalid_authorization_code_digest");
  return digest;
}

function hashAccessToken(rawAccessToken: string): string {
  const digest = createHash("sha256").update(rawAccessToken, "utf8").digest("hex");
  if (!isValidAuthorizationCodeDigest(digest)) throw new TypeError("invalid_access_token_digest");
  return digest;
}

function generateDefaultBrowserBoundContinuationNonce(): string | undefined {
  const crypto = globalThis.crypto;
  if (!crypto?.getRandomValues) return undefined;
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlNoPadding(bytes);
}

function base64UrlNoPadding(bytes: Uint8Array): string {
  let output = "";
  let index = 0;
  for (; index + 2 < bytes.length; index += 3) {
    const value = (bytes[index] << 16) | (bytes[index + 1] << 8) | bytes[index + 2];
    output += BASE64_URL_ALPHABET[(value >> 18) & 63];
    output += BASE64_URL_ALPHABET[(value >> 12) & 63];
    output += BASE64_URL_ALPHABET[(value >> 6) & 63];
    output += BASE64_URL_ALPHABET[value & 63];
  }
  if (index < bytes.length) {
    const remaining = bytes.length - index;
    const value = (bytes[index] << 16) | (remaining === 2 ? bytes[index + 1] << 8 : 0);
    output += BASE64_URL_ALPHABET[(value >> 18) & 63];
    output += BASE64_URL_ALPHABET[(value >> 12) & 63];
    if (remaining === 2) {
      output += BASE64_URL_ALPHABET[(value >> 6) & 63];
    }
  }
  return output;
}

function isBrowserBoundContinuationNonce(value: unknown): value is string {
  return typeof value === "string" && BROWSER_BOUND_CONTINUATION_NONCE_PATTERN.test(value);
}

function browserBoundContinuationCookie(browserNonce: string): string {
  return [
    `${BROWSER_BOUND_CONTINUATION_COOKIE_NAME}=${browserNonce}`,
    `Max-Age=${BROWSER_BOUND_CONTINUATION_MAX_AGE_SECONDS}`,
    `Path=${MCP_OAUTH_CONTINUATION_PATH}`,
    "HttpOnly",
    "Secure",
    "SameSite=Lax",
  ].join("; ");
}

function browserBoundContinuationCookieMatches(
  request: McpOAuthProductionRouteAdapterRequestV1,
  expectedNonce: string,
): boolean {
  const cookie = readSingleHeaderValue(request.headers?.cookie);
  if (!cookie) return false;
  for (const part of cookie.split(";")) {
    const [rawName, ...rawValue] = part.trim().split("=");
    if (rawName === BROWSER_BOUND_CONTINUATION_COOKIE_NAME) {
      return rawValue.join("=") === expectedNonce;
    }
  }
  return false;
}

function readHandleHash(rawHandle: string, codec: McpOAuthContinuationHandleCodecV1): string | undefined {
  try {
    const digest = codec.hash(rawHandle);
    return isValidIntentHandleHash(digest) ? digest : undefined;
  } catch {
    return undefined;
  }
}

function readContinuationRequest(
  urlOrPath: string,
  authorizationPageOrigin: string,
  codec: McpOAuthContinuationHandleCodecV1,
): Readonly<{ rawHandle: string; browserNonce: string }> | undefined {
  if (isUnsafeRouteInput(urlOrPath) || hasUnsafeRawPath(readRawPath(urlOrPath))) return undefined;
  try {
    const parsed = new URL(urlOrPath, authorizationPageOrigin);
    const rawPath = readRawPath(urlOrPath);
    if (
      parsed.origin !== authorizationPageOrigin ||
      parsed.pathname !== MCP_OAUTH_CONTINUATION_PATH ||
      rawPath !== MCP_OAUTH_CONTINUATION_PATH ||
      parsed.hash
    ) {
      return undefined;
    }
    const keys = [...parsed.searchParams.keys()];
    if (
      keys.length !== 2 ||
      keys[0] !== MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER ||
      keys[1] !== BROWSER_BOUND_CONTINUATION_NONCE_PARAMETER ||
      parsed.searchParams.getAll(MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER).length !== 1 ||
      parsed.searchParams.getAll(BROWSER_BOUND_CONTINUATION_NONCE_PARAMETER).length !== 1
    ) {
      return undefined;
    }
    const rawHandle = parsed.searchParams.get(MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER);
    const browserNonce = parsed.searchParams.get(BROWSER_BOUND_CONTINUATION_NONCE_PARAMETER);
    if (typeof rawHandle !== "string" || rawHandle.length === 0 || !codec.validate(rawHandle)) {
      return undefined;
    }
    if (!isBrowserBoundContinuationNonce(browserNonce)) {
      return undefined;
    }
    return Object.freeze({ rawHandle, browserNonce });
  } catch {
    return undefined;
  }
}

function isPreAuthCreateSuccess(
  value: McpOAuthProductionPreAuthIntentCreatePortResultV1,
  now: number,
): value is Extract<McpOAuthProductionPreAuthIntentCreatePortResultV1, { ok: true }> {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_pre_auth_intent_create_result" &&
    value.ok === true &&
    value.reason === "created" &&
    isPlainRecord(value.serverOnly) &&
    value.serverOnly.status === "pre_auth_pending" &&
    typeof value.serverOnly.expiresAt === "number" &&
    Number.isSafeInteger(value.serverOnly.expiresAt) &&
    value.serverOnly.expiresAt > now &&
    PRE_AUTH_CREATE_FALSE_PROOF_KEYS.every((key) => value.serverOnly[key] === false) &&
    value.serverOnly.version === 1 &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function isOwnerBindingSuccess(
  value: McpOAuthProductionPreAuthOwnerBindingPortResultV1,
  now: number,
): value is Extract<McpOAuthProductionPreAuthOwnerBindingPortResultV1, { ok: true }> {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_pre_auth_owner_binding_result" &&
    value.ok === true &&
    value.reason === "bound" &&
    isPlainRecord(value.serverOnly) &&
    isPlainRecord(value.serverOnly.ownerBoundIntent) &&
    value.serverOnly.ownerBoundIntent.status === "pending" &&
    typeof value.serverOnly.ownerBoundIntent.expiresAt === "number" &&
    Number.isSafeInteger(value.serverOnly.ownerBoundIntent.expiresAt) &&
    value.serverOnly.ownerBoundIntent.expiresAt > now &&
    value.serverOnly.ownerBoundIntent.version === 1 &&
    isPlainRecord(value.serverOnly.preAuthIntent) &&
    value.serverOnly.preAuthIntent.status === "claimed" &&
    value.serverOnly.preAuthIntent.version === 1 &&
    isTrustedOwner(value.serverOnly.trustedOwner) &&
    value.serverOnly.version === 1 &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function isAuthorizationIntentConsumeSuccess(
  value: McpOAuthIntentConsumeResultV1,
  bindingResult: Extract<McpOAuthProductionPreAuthOwnerBindingPortResultV1, { ok: true }>,
  config: McpOAuthAuthorizationRequestBoundaryConfigV1,
): value is Extract<McpOAuthIntentConsumeResultV1, { ok: true }> {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_authorization_intent_consume_result" &&
    value.ok === true &&
    value.reason === "consumed" &&
    isPlainRecord(value.serverOnly) &&
    isConsumableAuthorizationHandoff(
      value.serverOnly.authorizationRequestHandoff,
      bindingResult.serverOnly.trustedOwner,
      config,
    ) &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function isConsumableAuthorizationHandoff(
  value: unknown,
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1,
  config: McpOAuthAuthorizationRequestBoundaryConfigV1,
): value is McpOAuthAuthorizationRequestBoundaryHandoffV1 {
  if (!isPlainRecord(value)) return false;
  return (
    isAuthorizationPageForConfig(value.authorizationPage, config) &&
    sameTrustedOwner(value.trustedOwner, trustedOwner) &&
    isProviderForwardRequestForConfig(value.providerForwardRequest, config) &&
    isPendingProviderValidation(value.providerValidation) &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function isAuthorizationPageForConfig(
  value: unknown,
  config: McpOAuthAuthorizationRequestBoundaryConfigV1,
): value is McpOAuthAuthorizationRequestBoundaryHandoffV1["authorizationPage"] {
  return (
    isPlainRecord(value) &&
    value.origin === config.authorizationPageOrigin &&
    value.path === config.authorizationPagePath
  );
}

function isProviderForwardRequestForConfig(
  value: unknown,
  config: McpOAuthAuthorizationRequestBoundaryConfigV1,
): value is McpOAuthAuthorizationRequestBoundaryHandoffV1["providerForwardRequest"] {
  if (!isPlainRecord(value)) return false;
  const pkce = value.pkce;
  return (
    value.responseType === "code" &&
    typeof value.clientId === "string" &&
    config.clientIdPolicy.allowedClientIds.includes(value.clientId) &&
    typeof value.redirectUri === "string" &&
    config.allowedRedirectUris.includes(value.redirectUri) &&
    value.resource === config.canonicalResource &&
    Array.isArray(value.scopes) &&
    value.scopes.includes(config.requiredScope) &&
    typeof value.state === "string" &&
    value.state.length > 0 &&
    value.state.length <= config.maxStateLength &&
    isPlainRecord(pkce) &&
    pkce.codeChallengeMethod === "S256" &&
    typeof pkce.codeChallenge === "string" &&
    value.version === 1
  );
}

function isPendingProviderValidation(
  value: unknown,
): value is McpOAuthAuthorizationRequestBoundaryHandoffV1["providerValidation"] {
  return (
    isPlainRecord(value) &&
    value.status === "pending" &&
    value.clientRegistrationValidated === false &&
    value.redirectUriValidatedByProvider === false &&
    value.consentCompleted === false &&
    value.authorizationCodeIssued === false &&
    value.tokenIssued === false &&
    value.stytchSubjectResolved === false &&
    value.accountLinkCreated === false &&
    value.version === 1
  );
}

function sameTrustedOwner(left: unknown, right: McpOAuthAuthorizationTrustedOwnerV1): boolean {
  return isTrustedOwner(left) && left.twoweeksClerkId === right.twoweeksClerkId;
}

function buildAuthorizationCodeCreateInput(
  authorizationCodeDigest: string,
  authenticatedOwnerIdentity: McpOAuthProductionAuthenticatedOwnerIdentityV1,
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1,
  handoff: McpOAuthAuthorizationRequestBoundaryHandoffV1,
  now: number,
): McpOAuthProductionAuthorizationCodeCreatePortInputV1 {
  return Object.freeze({
    authorizationCodeDigest,
    authenticatedOwnerIdentity,
    trustedOwner,
    authorizationRequest: Object.freeze({
      clientId: handoff.providerForwardRequest.clientId,
      redirectUri: handoff.providerForwardRequest.redirectUri,
      resource: handoff.providerForwardRequest.resource,
      scopes: Object.freeze([...handoff.providerForwardRequest.scopes]),
      state: handoff.providerForwardRequest.state,
      codeChallenge: handoff.providerForwardRequest.pkce.codeChallenge,
      codeChallengeMethod: handoff.providerForwardRequest.pkce.codeChallengeMethod,
      version: 1,
    }),
    productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
    now,
    deadlineEpochMs: now + AUTHORIZATION_CODE_CREATE_TIMEOUT_MS,
    timeoutMs: AUTHORIZATION_CODE_CREATE_TIMEOUT_MS,
    version: 1,
  });
}

function isAuthorizationCodeCreateSuccess(
  value: McpOAuthProductionAuthorizationCodeCreatePortResultV1,
  now: number,
): value is Extract<McpOAuthProductionAuthorizationCodeCreatePortResultV1, { ok: true }> {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_authorization_code_create_result" &&
    value.ok === true &&
    value.reason === "created" &&
    isPlainRecord(value.serverOnly) &&
    value.serverOnly.status === "pending" &&
    typeof value.serverOnly.expiresAt === "number" &&
    Number.isSafeInteger(value.serverOnly.expiresAt) &&
    value.serverOnly.expiresAt > now &&
    value.serverOnly.rawAuthorizationCodePersisted === false &&
    value.serverOnly.version === 1 &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function isAuthorizationCodeValidationSuccess(
  value: McpOAuthProductionAuthorizationCodeValidatePortResultV1,
  tokenRequest: Readonly<{
    clientId: string;
    redirectUri: string;
    resource: string;
    codeChallenge: string;
  }>,
  now: number,
): value is Extract<McpOAuthProductionAuthorizationCodeValidatePortResultV1, { ok: true }> {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_authorization_code_validate_result" &&
    value.ok === true &&
    value.reason === "validated" &&
    isPlainRecord(value.serverOnly) &&
    value.serverOnly.status === "pending" &&
    value.serverOnly.clientId === tokenRequest.clientId &&
    value.serverOnly.redirectUri === tokenRequest.redirectUri &&
    value.serverOnly.resource === tokenRequest.resource &&
    Array.isArray(value.serverOnly.scopes) &&
    typeof value.serverOnly.state === "string" &&
    value.serverOnly.codeChallenge === tokenRequest.codeChallenge &&
    value.serverOnly.codeChallengeMethod === "S256" &&
    value.serverOnly.productionEnvironment === MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT &&
    typeof value.serverOnly.expiresAt === "number" &&
    Number.isSafeInteger(value.serverOnly.expiresAt) &&
    value.serverOnly.expiresAt > now &&
    value.serverOnly.codeConsumed === false &&
    value.serverOnly.tokenIssued === false &&
    value.serverOnly.version === 1 &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function isAccessTokenIssueSuccess(
  value: McpOAuthProductionAccessTokenIssuePortResultV1,
  tokenRequest: Readonly<{
    clientId: string;
    redirectUri: string;
    resource: string;
    codeChallenge: string;
  }>,
  now: number,
): value is Extract<McpOAuthProductionAccessTokenIssuePortResultV1, { ok: true }> {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_access_token_issue_result" &&
    value.ok === true &&
    value.reason === "issued" &&
    isPlainRecord(value.serverOnly) &&
    isAccessTokenIssueExpiryProof(value.serverOnly, now) &&
    isAccessTokenIssueBindingProof(value.serverOnly, tokenRequest) &&
    isAccessTokenIssueStorageProof(value.serverOnly) &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function isAccessTokenIssueExpiryProof(
  value: Record<string, unknown>,
  now: number,
): boolean {
  const expectedExpiresIn = readExpectedExpiresIn(value.expiresAt, now);
  const storageExpectedExpiresIn = readStorageExpiresIn(value.issuedAt, value.expiresAt);
  return (
    value.tokenType === "Bearer" &&
    typeof value.issuedAt === "number" &&
    Number.isSafeInteger(value.issuedAt) &&
    typeof value.expiresAt === "number" &&
    Number.isSafeInteger(value.expiresAt) &&
    value.expiresAt > now &&
    typeof value.expiresIn === "number" &&
    Number.isSafeInteger(value.expiresIn) &&
    value.expiresIn > 0 &&
    expectedExpiresIn !== undefined &&
    storageExpectedExpiresIn !== undefined &&
    value.expiresIn === storageExpectedExpiresIn &&
    value.expiresIn <= expectedExpiresIn + ACCESS_TOKEN_RESPONSE_CLOCK_SKEW_SECONDS
  );
}

function readExpectedExpiresIn(expiresAt: unknown, now: number): number | undefined {
  if (typeof expiresAt !== "number" || !Number.isSafeInteger(expiresAt) || expiresAt <= now) {
    return undefined;
  }
  return Math.floor((expiresAt - now) / 1_000);
}

function readStorageExpiresIn(issuedAt: unknown, expiresAt: unknown): number | undefined {
  if (
    typeof issuedAt !== "number" ||
    typeof expiresAt !== "number" ||
    !Number.isSafeInteger(issuedAt) ||
    !Number.isSafeInteger(expiresAt) ||
    expiresAt <= issuedAt
  ) {
    return undefined;
  }
  return Math.floor((expiresAt - issuedAt) / 1_000);
}

function isAccessTokenIssueBindingProof(
  value: Record<string, unknown>,
  tokenRequest: Readonly<{
    clientId: string;
    redirectUri: string;
    resource: string;
    codeChallenge: string;
  }>,
): boolean {
  return (
    value.clientId === tokenRequest.clientId &&
    value.redirectUri === tokenRequest.redirectUri &&
    value.resource === tokenRequest.resource &&
    value.codeChallenge === tokenRequest.codeChallenge &&
    isAccessTokenIssueScopeProof(value.scopes) &&
    value.productionEnvironment === MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT
  );
}

function isAccessTokenIssueScopeProof(value: unknown): value is readonly string[] {
  if (!Array.isArray(value)) return false;
  const seen = new Set<string>();
  for (const scope of value) {
    if (typeof scope !== "string") return false;
    if (seen.has(scope)) return false;
    seen.add(scope);
    if (scope === TWOWEEKS_APPLICATIONS_READ_SCOPE || isOpenIdConnectIdentityScope(scope)) continue;
    return false;
  }
  return seen.has(TWOWEEKS_APPLICATIONS_READ_SCOPE);
}

function isAccessTokenIssueStorageProof(value: Record<string, unknown>): boolean {
  return (
    value.codeConsumed === true &&
    value.tokenIssued === true &&
    value.tokenPersisted === true &&
    value.rawAccessTokenPersisted === false &&
    value.refreshTokenPersisted === false &&
    value.version === 1
  );
}

function isAccessTokenVerifySuccess(
  value: McpOAuthProductionAccessTokenVerifyPortResultV1,
  config: McpOAuthAuthorizationRequestBoundaryConfigV1,
  expectedResource: string,
  _now: number,
): value is Extract<McpOAuthProductionAccessTokenVerifyPortResultV1, { ok: true }> {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_access_token_verify_result" &&
    value.ok === true &&
    value.reason === "verified" &&
    isPlainRecord(value.serverOnly) &&
    value.serverOnly.status === "active" &&
    typeof value.serverOnly.twoweeksClerkId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u.test(value.serverOnly.twoweeksClerkId) &&
    typeof value.serverOnly.ownerIssuer === "string" &&
    value.serverOnly.ownerIssuer.length > 0 &&
    value.serverOnly.ownerIssuer.length <= 512 &&
    config.clientIdPolicy.allowedClientIds.includes(value.serverOnly.clientId) &&
    value.serverOnly.resource === expectedResource &&
    isAccessTokenIssueScopeProof(value.serverOnly.scopes) &&
    value.serverOnly.productionEnvironment === MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT &&
    typeof value.serverOnly.expiresAt === "number" &&
    Number.isSafeInteger(value.serverOnly.expiresAt) &&
    value.serverOnly.tokenActive === true &&
    value.serverOnly.tokenExpired === false &&
    value.serverOnly.tokenRevoked === false &&
    value.serverOnly.rawAccessTokenPersisted === false &&
    value.serverOnly.rawAccessTokenEchoed === false &&
    value.serverOnly.digestEchoed === false &&
    value.serverOnly.version === 1 &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function isAuthenticatedOwnerIdentity(
  value: unknown,
): value is McpOAuthProductionAuthenticatedOwnerIdentityV1 {
  return (
    isPlainRecord(value) &&
    typeof value.subject === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u.test(value.subject) &&
    typeof value.issuer === "string" &&
    value.issuer.length > 0 &&
    value.issuer.length <= 512 &&
    value.version === 1
  );
}

function statusForPreAuthCreateFailure(
  value: McpOAuthProductionPreAuthIntentCreatePortResultV1,
): 409 | 503 {
  return isPlainRecord(value) && value.reason === "handle_collision" ? 409 : 503;
}

function statusForOwnerBindingFailure(
  value: McpOAuthProductionPreAuthOwnerBindingPortResultV1,
): 400 | 401 | 409 | 503 {
  if (!isPlainRecord(value)) return 503;
  if (value.reason === "unauthenticated") return 401;
  if (value.reason === "invalid_input" || value.reason === "invalid_handle_hash") return 400;
  if (value.reason === "storage_unavailable" || value.reason === "dependency_unavailable") return 503;
  return 409;
}

function statusForAuthorizationIntentConsumeFailure(value: McpOAuthIntentConsumeResultV1): 400 | 409 | 503 {
  if (!isPlainRecord(value)) return 503;
  if (value.reason === "invalid_input" || value.reason === "invalid_handle_hash") return 400;
  return 409;
}

function statusForAuthorizationCodeCreateFailure(
  value: McpOAuthProductionAuthorizationCodeCreatePortResultV1,
): 409 | 503 {
  return isPlainRecord(value) && value.reason === "digest_collision" ? 409 : 503;
}

function statusForAuthorizationCodeValidationFailure(
  value: McpOAuthProductionAuthorizationCodeValidatePortResultV1,
): 400 | 503 {
  if (!isPlainRecord(value)) return 503;
  if (
    value.reason === "storage_unavailable" ||
    value.reason === "malformed_storage_record" ||
    value.reason === "duplicate_storage_record"
  ) {
    return 503;
  }
  return 400;
}

function statusForAccessTokenIssueFailure(
  value: McpOAuthProductionAccessTokenIssuePortResultV1,
): 400 | 503 {
  if (!isPlainRecord(value)) return 503;
  if (value.ok === true) return 503;
  if (
    value.reason === "storage_unavailable" ||
    value.reason === "malformed_storage_record" ||
    value.reason === "duplicate_storage_record" ||
    value.reason === "access_token_digest_collision"
  ) {
    return 503;
  }
  return 400;
}

function statusForAccessTokenVerifyFailure(
  value: McpOAuthProductionAccessTokenVerifyPortResultV1,
): 401 | 403 | 503 {
  if (!isPlainRecord(value)) return 503;
  if (value.ok === true) return 503;
  if (
    value.reason === "storage_unavailable" ||
    value.reason === "malformed_storage_record" ||
    value.reason === "duplicate_storage_record"
  ) {
    return 503;
  }
  if (
    value.reason === "missing_required_scope" ||
    value.reason === "unauthorized_scope_state"
  ) {
    return 403;
  }
  return 401;
}

function readNow(dependencies: McpOAuthProductionRouteAdapterDependenciesV1): number {
  let now: number;
  try {
    now = dependencies.now?.() ?? Date.now();
  } catch {
    now = Date.now();
  }
  return Number.isSafeInteger(now) && now >= 0 ? now : Date.now();
}

function isValidIntentHandleHash(value: unknown): value is string {
  return typeof value === "string" && INTENT_HANDLE_HASH_PATTERN.test(value);
}

function isValidAuthorizationCodeDigest(value: unknown): value is string {
  return typeof value === "string" && AUTHORIZATION_CODE_DIGEST_PATTERN.test(value);
}

function readSingleHeaderValue(value: string | readonly string[] | undefined): string | undefined {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value) && value.length === 1) return value[0]?.trim();
  return undefined;
}

function readAuthorizationOrigin(
  config: McpOAuthAuthorizationRequestBoundaryConfigV1,
): McpOAuthProductionAuthorizationOriginV1 | undefined {
  try {
    const origin = new URL(config.authorizationPageOrigin);
    if (
      origin.origin === "null" ||
      !origin.hostname ||
      origin.username ||
      origin.password ||
      (origin.pathname !== "" && origin.pathname !== "/") ||
      origin.search ||
      origin.hash
    ) {
      return undefined;
    }
    return Object.freeze({
      origin: origin.origin,
      protocol: origin.protocol,
      hostname: origin.hostname.toLowerCase(),
      port: normalizedOriginPort(origin),
    });
  } catch {
    return undefined;
  }
}

function readResourceOrigin(resource: string): McpOAuthProductionAuthorizationOriginV1 | undefined {
  try {
    const parsed = new URL(resource);
    if (
      parsed.protocol !== "https:" ||
      parsed.origin === "null" ||
      !parsed.hostname ||
      parsed.username ||
      parsed.password
    ) {
      return undefined;
    }
    return Object.freeze({
      origin: parsed.origin,
      protocol: parsed.protocol,
      hostname: parsed.hostname.toLowerCase(),
      port: normalizedOriginPort(parsed),
    });
  } catch {
    return undefined;
  }
}

function parseHostHeader(
  host: string,
  protocol: string,
): Readonly<{ hostname: string; port: string }> | undefined {
  if (!host || host.includes("/") || host.includes("@") || hasControlCharacter(host)) {
    return undefined;
  }
  try {
    const parsed = new URL(`${protocol}//${host}`);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return undefined;
    }
    return Object.freeze({
      hostname: parsed.hostname.toLowerCase(),
      port: parsed.port || defaultPortForProtocol(protocol),
    });
  } catch {
    return undefined;
  }
}

function isTrustedOwner(value: unknown): value is McpOAuthAuthorizationTrustedOwnerV1 {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_authorization_trusted_owner" &&
    typeof value.twoweeksClerkId === "string" &&
    /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u.test(value.twoweeksClerkId) &&
    value.version === 1
  );
}

function readRawPath(value: string): string {
  const queryStart = value.indexOf("?");
  return queryStart === -1 ? value : value.slice(0, queryStart);
}

function normalizedOriginPort(origin: URL): string {
  return origin.port || defaultPortForProtocol(origin.protocol);
}

function defaultPortForProtocol(protocol: string): "80" | "443" | "" {
  if (protocol === "https:") return "443";
  if (protocol === "http:") return "80";
  return "";
}

function isUnsafeRouteInput(value: string): boolean {
  return (
    typeof value !== "string" ||
    value.length === 0 ||
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("\\") ||
    value.includes("#") ||
    hasControlCharacter(value)
  );
}

function hasUnsafeRawPath(value: string): boolean {
  return hasDotSegment(value) || /%2e|%2f|%5c/iu.test(value);
}

function hasMalformedPercentEncoding(value: string): boolean {
  if (/%(?![0-9A-Fa-f]{2})/u.test(value)) return true;
  for (const component of value.split(/[&=]/u)) {
    try {
      decodeURIComponent(component.split("+").join(" "));
    } catch {
      return true;
    }
  }
  return false;
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function hasDotSegment(value: string): boolean {
  return value.split(/[/?#]/u).some((part) => part === "." || part === "..");
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function toRejectedError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

function jsonResponse(
  status: number,
  json: unknown,
  headers: Readonly<Record<string, string>> = {},
): McpOAuthProductionRouteAdapterResponseV1 {
  return Object.freeze({
    handled: true,
    status,
    headers: {
      ...noStoreHeaders(),
      ...headers,
      "content-type": "application/json; charset=utf-8",
    },
    json,
  });
}

function noStoreHeaders(): Readonly<Record<string, string>> {
  return Object.freeze({
    "cache-control": "no-store",
    pragma: "no-cache",
    "referrer-policy": "no-referrer",
    "x-robots-tag": "noindex, nofollow",
  });
}
