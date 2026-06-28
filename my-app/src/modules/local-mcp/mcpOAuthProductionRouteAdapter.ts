import {
  buildMcpOAuthProductionRoutePreflight,
  type McpOAuthProductionRoutePreflightDecisionV1,
  type McpOAuthProductionRoutePreflightInputV1,
  type McpOAuthProductionRoutePreflightResultV1,
} from "./mcpOAuthProductionRoutePreflightBoundary";
import {
  projectMcpOAuthPreAuthAuthorizationRequest,
  type McpOAuthAuthorizationTrustedOwnerV1,
  type McpOAuthAuthorizationRequestBoundaryConfigV1,
  type McpOAuthPreAuthAuthorizationRequestProjectionV1,
} from "./mcpOAuthAuthorizationRequestBoundary";
import {
  defaultMcpOAuthContinuationHandleCodecV1,
  type McpOAuthContinuationHandleCodecV1,
} from "./mcpOAuthLoginReturnContinuationBoundary";
import {
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
  MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
} from "../../pages/sign-in-return";

export const MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH = "/oauth/authorize";
export const MCP_OAUTH_PRODUCTION_CALLBACK_PATH = "/oauth/callback";
export const MCP_OAUTH_PRODUCTION_MCP_PATH = "/mcp";

export type McpOAuthProductionRoutePathV1 =
  | typeof MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH
  | typeof MCP_OAUTH_PRODUCTION_CALLBACK_PATH
  | typeof MCP_OAUTH_PRODUCTION_MCP_PATH
  | typeof MCP_OAUTH_CONTINUATION_PATH;

type McpOAuthProductionRouteNameV1 =
  | "oauth_authorize"
  | "oauth_login_return"
  | "oauth_callback"
  | "mcp";

export type McpOAuthProductionRouteAdapterConfigV1 = Readonly<{
  kind: "mcp_oauth_production_route_adapter_config";
  preflight: McpOAuthProductionRoutePreflightResultV1;
  authorizationRequestGuard: McpOAuthProductionAuthorizationRequestGuardV1;
  handledPaths: readonly McpOAuthProductionRoutePathV1[];
  failClosedUnlessPreflightReady: true;
  authorizeCreatesOwnerlessPreAuthIntentOnly: true;
  callbackAndMcpInertGuardedHandlersOnly: true;
  safeForModel: true;
  version: 1;
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

export type McpOAuthProductionAuthenticatedOwnerIdentityV1 = Readonly<{
  subject: string;
  issuer: string;
  version: 1;
}>;

export type McpOAuthProductionAuthenticatedOwnerIdentityReaderV1 = (
  request: McpOAuthProductionRouteAdapterRequestV1,
) => Promise<McpOAuthProductionAuthenticatedOwnerIdentityV1 | undefined>;

export type McpOAuthProductionBrowserBoundContinuationNonceGeneratorV1 = () => string | undefined;

export type McpOAuthProductionRouteAdapterDependenciesV1 = Readonly<{
  authorizationRequestConfig?: McpOAuthAuthorizationRequestBoundaryConfigV1;
  checkPreAuthQuota?: McpOAuthProductionPreAuthQuotaPortV1;
  createPreAuthIntent?: McpOAuthProductionPreAuthIntentCreatePortV1;
  bindPreAuthIntentToAuthenticatedOwner?: McpOAuthProductionPreAuthOwnerBindingPortV1;
  readAuthenticatedOwnerIdentity?: McpOAuthProductionAuthenticatedOwnerIdentityReaderV1;
  generateBrowserBoundContinuationNonce?: McpOAuthProductionBrowserBoundContinuationNonceGeneratorV1;
  handleCodec?: McpOAuthContinuationHandleCodecV1;
  now?: () => number;
}>;

export type McpOAuthProductionRouteAdapterRequestV1 = Readonly<{
  method: string;
  path: string;
  url: string;
  headers?: Readonly<Record<string, string | readonly string[] | undefined>>;
  remoteAddress?: string;
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
  | "pre_auth_create_failed"
  | "invalid_continuation_request"
  | "browser_bound_continuation_missing"
  | "owner_binding_failed";

type McpOAuthProductionAuthorizationOriginV1 = Readonly<{
  origin: string;
  protocol: string;
  hostname: string;
  port: string;
}>;

const HANDLED_PATHS = Object.freeze([
  MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
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
const BROWSER_BOUND_CONTINUATION_NONCE_PARAMETER = "mcp_oauth_browser_nonce";
const BROWSER_BOUND_CONTINUATION_COOKIE_NAME = "tw_mcp_oauth_continue";
const BROWSER_BOUND_CONTINUATION_NONCE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const BROWSER_BOUND_CONTINUATION_MAX_AGE_SECONDS = 600;
const BASE64_URL_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

export function buildMcpOAuthProductionRouteAdapterConfig(
  input: McpOAuthProductionRoutePreflightInputV1 = {},
): McpOAuthProductionRouteAdapterConfigV1 {
  return Object.freeze({
    kind: "mcp_oauth_production_route_adapter_config",
    preflight: buildMcpOAuthProductionRoutePreflight(input),
    authorizationRequestGuard: buildAuthorizationRequestGuard(input),
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
  if (!requestHostMatchesAuthorizationOrigin(request, authorizationOrigin)) {
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
  if (!requestHostMatchesAuthorizationOrigin(request, authorizationOrigin)) {
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

  return ownerBoundContinuationResponse(config.preflight, bindingResult);
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
  if (path === MCP_OAUTH_PRODUCTION_CALLBACK_PATH) return "oauth_callback";
  if (path === MCP_OAUTH_PRODUCTION_MCP_PATH) return "mcp";
  return undefined;
}

function isRouteAllowedByPreflight(
  route: McpOAuthProductionRouteNameV1,
  preflight: McpOAuthProductionRoutePreflightResultV1,
): boolean {
  return route === "oauth_authorize" || route === "oauth_login_return"
    ? preflight.authorizeAllowedToWire
    : preflight.allowedToWire;
}

function isAllowedMethod(route: McpOAuthProductionRouteNameV1, method: string): boolean {
  return method.toUpperCase() === allowedMethodForRoute(route);
}

function allowedMethodForRoute(route: McpOAuthProductionRouteNameV1): "GET" | "POST" {
  if (route === "mcp") return "POST";
  return "GET";
}

function failClosedResponse(
  route: McpOAuthProductionRouteNameV1,
  preflight: McpOAuthProductionRoutePreflightResultV1,
  reason: McpOAuthProductionRouteFailureReasonV1,
  status: number,
  headers: Readonly<Record<string, string>> = {},
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
    version: 1,
  }, headers);
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

function ownerBoundContinuationResponse(
  preflight: McpOAuthProductionRoutePreflightResultV1,
  bindingResult: Extract<McpOAuthProductionPreAuthOwnerBindingPortResultV1, { ok: true }>,
): McpOAuthProductionRouteAdapterResponseV1 {
  return jsonResponse(200, {
    kind: "mcp_oauth_production_route_response",
    status: "owner_bound_continuation_prepared",
    reason: "owner_binding_continuation_prepared",
    route: "oauth_login_return",
    message: "Production MCP OAuth owner-bound continuation prepared.",
    safeForModel: true,
    allowedByPreflight: true,
    preflightDecision: preflight.decision,
    guardedInertHandlerReached: false,
    authorizationRequestAccepted: false,
    authorizationCodeAccepted: false,
    authorizationCodeIssued: false,
    redirectSecretAccepted: false,
    providerCalled: false,
    tokenExchangeAttempted: false,
    tokenIssued: false,
    preAuthIntentCreated: false,
    preAuthContinuationConsumed: true,
    ownerBound: true,
    ownerBoundIntentPending: bindingResult.serverOnly.ownerBoundIntent.status === "pending",
    ownerBoundContinuationPrepared: true,
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
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function notHandled(): McpOAuthProductionRouteAdapterResponseV1 {
  return Object.freeze({
    handled: false,
    status: 404,
    headers: noStoreHeaders(),
    bodyText: "",
  });
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

function requestHostMatchesAuthorizationOrigin(
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

function readForwardedCallerKey(value: string | readonly string[] | undefined): string | undefined {
  const header = readSingleHeaderValue(value);
  if (!header) return undefined;
  return normalizeCallerKey(header.split(",")[0] ?? "");
}

function readHeaderCallerKey(value: string | readonly string[] | undefined): string | undefined {
  const header = readSingleHeaderValue(value);
  return header ? normalizeCallerKey(header) : undefined;
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

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
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
