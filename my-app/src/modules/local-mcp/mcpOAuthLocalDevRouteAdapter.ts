import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "./mcpAuthPolicyBoundary";
import {
  projectMcpOAuthPreAuthAuthorizationRequest,
  type McpOAuthAuthorizationOptionalParameterV1,
  type McpOAuthAuthorizationOptionalScopeV1,
  type McpOAuthAuthorizationRequestBoundaryConfigV1,
  type McpOAuthAuthorizationTrustedOwnerV1,
  type McpOAuthPreAuthAuthorizationRequestProjectionV1,
} from "./mcpOAuthAuthorizationRequestBoundary";
import {
  defaultMcpOAuthContinuationHandleCodecV1,
  resumeMcpOAuthAuthorizationAfterLoginReturn,
  type McpOAuthContinuationHandleCodecV1,
  type McpOAuthIntentConsumePortV1,
  type McpOAuthLoginReturnContinuationBoundaryConfigV1,
} from "./mcpOAuthLoginReturnContinuationBoundary";
import {
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
  MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
} from "../../pages/sign-in-return";

export const LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_PATH = "/oauth/authorize";
export const LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG = "LOCAL_MCP_DEV_OAUTH_AUTHORIZATION";
export const LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR = "LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN";
export const LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR = "LOCAL_MCP_DEV_OAUTH_REDIRECT_URI";

const DEFAULT_APPLICATION_ORIGIN = "http://localhost:5173";
const DEFAULT_MAX_URL_LENGTH = 4_096;
const DEFAULT_MAX_PARAMETER_LENGTH = 512;
const DEFAULT_MAX_STATE_LENGTH = 512;
const DEFAULT_MAX_ID_TOKEN_HINT_LENGTH = 1_024;
const DEFAULT_MAX_CONTINUATION_URL_LENGTH = 2_048;
const DEFAULT_MAX_RAW_HANDLE_LENGTH = 256;
const DEFAULT_APPROVED_OPTIONAL_SCOPES = [
  "openid",
  "email",
  "profile",
] as const satisfies readonly McpOAuthAuthorizationOptionalScopeV1[];
const DEFAULT_ALLOWED_OPTIONAL_PARAMETERS = [
  "nonce",
  "prompt",
] as const satisfies readonly McpOAuthAuthorizationOptionalParameterV1[];
const INTENT_HANDLE_HASH_PATTERN = /^[0-9a-f]{64}$/u;

export type McpOAuthPreAuthIntentCreatePortInputV1 = Readonly<{
  authorizationRequestProjection: McpOAuthPreAuthAuthorizationRequestProjectionV1;
  preAuthHandleHash: string;
  now: number;
  version: 1;
}>;

export type McpOAuthPreAuthIntentCreatePortResultV1 = Readonly<
  | {
      kind: "mcp_oauth_pre_auth_intent_create_result";
      ok: true;
      reason: "created";
      serverOnly: {
        status: "pre_auth_pending";
        expiresAt: number;
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

export type McpOAuthPreAuthIntentCreatePortV1 = (
  input: McpOAuthPreAuthIntentCreatePortInputV1,
) => Promise<McpOAuthPreAuthIntentCreatePortResultV1>;

export type McpOAuthPreAuthOwnerBindingPortInputV1 = Readonly<{
  preAuthHandleHash: string;
  now: number;
  version: 1;
}>;

export type McpOAuthPreAuthOwnerBindingPortResultV1 = Readonly<
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

export type McpOAuthPreAuthOwnerBindingPortV1 = (
  input: McpOAuthPreAuthOwnerBindingPortInputV1,
) => Promise<McpOAuthPreAuthOwnerBindingPortResultV1>;

export type McpOAuthLocalDevRouteAdapterConfigInputV1 = Readonly<{
  enabled?: boolean;
  applicationOrigin?: string;
  authorizationPath?: typeof LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_PATH;
  canonicalResource?: string;
  allowedRedirectUris?: readonly string[];
  allowedClientIds?: readonly string[];
  approvedOptionalScopes?: readonly McpOAuthAuthorizationOptionalScopeV1[];
  allowedOptionalParameters?: readonly McpOAuthAuthorizationOptionalParameterV1[];
  allowHttpLocalhostApplicationOrigin?: boolean;
  maxUrlLength?: number;
  maxParameterLength?: number;
  maxStateLength?: number;
  maxIdTokenHintLength?: number;
  maxContinuationUrlLength?: number;
  maxRawHandleLength?: number;
}>;

export type McpOAuthLocalDevRouteAdapterConfigV1 = Readonly<{
  kind: "mcp_oauth_local_dev_route_adapter_config";
  enabled: boolean;
  applicationOrigin: string;
  authorizationPath: typeof LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_PATH;
  continuationPath: typeof MCP_OAUTH_CONTINUATION_PATH;
  signInPath: "/sign-in";
  authorizationRequestConfig: McpOAuthAuthorizationRequestBoundaryConfigV1;
  continuationConfig: McpOAuthLoginReturnContinuationBoundaryConfigV1;
  localDevelopmentOnly: true;
  version: 1;
}>;

export type McpOAuthLocalDevRouteAdapterDependenciesV1 = Readonly<{
  createPreAuthIntent?: McpOAuthPreAuthIntentCreatePortV1;
  bindPreAuthIntentToAuthenticatedOwner?: McpOAuthPreAuthOwnerBindingPortV1;
  consumeAuthorizationIntent?: McpOAuthIntentConsumePortV1;
  handleCodec?: McpOAuthContinuationHandleCodecV1;
  now?: () => number;
}>;

export type McpOAuthLocalDevRouteAdapterRequestV1 = Readonly<{
  method: string;
  path: string;
  url: string;
  headers: Readonly<Record<string, string | readonly string[] | undefined>>;
}>;

export type McpOAuthLocalDevRouteAdapterFailureReasonV1 =
  | "disabled"
  | "unsupported_method"
  | "invalid_host"
  | "invalid_configuration"
  | "dependency_unavailable"
  | "invalid_authorization_request"
  | "pre_auth_create_failed"
  | "invalid_continuation_request"
  | "owner_binding_failed"
  | "continuation_resume_failed";

export type McpOAuthLocalDevRouteAdapterResponseV1 = Readonly<{
  handled: boolean;
  status: number;
  headers: Readonly<Record<string, string>>;
  json?: unknown;
  bodyText?: string;
}>;

export function buildMcpOAuthLocalDevRouteAdapterConfig(
  input: McpOAuthLocalDevRouteAdapterConfigInputV1 = {},
): McpOAuthLocalDevRouteAdapterConfigV1 {
  const allowHttpLocalhostApplicationOrigin = input.allowHttpLocalhostApplicationOrigin ?? true;
  const applicationOrigin = readCanonicalOrigin(
    input.applicationOrigin ?? DEFAULT_APPLICATION_ORIGIN,
    allowHttpLocalhostApplicationOrigin,
  );
  const authorizationPath = input.authorizationPath ?? LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_PATH;
  const allowedRedirectUris = uniqueNonEmptyStrings(input.allowedRedirectUris ?? []);
  const allowedClientIds = uniqueNonEmptyStrings(input.allowedClientIds ?? []);
  const canonicalResource = input.canonicalResource ?? "";
  const enabled =
    input.enabled === true &&
    applicationOrigin !== undefined &&
    authorizationPath === LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_PATH &&
    allowedRedirectUris.length > 0 &&
    allowedClientIds.length > 0 &&
    canonicalResource.length > 0;
  const origin = applicationOrigin ?? DEFAULT_APPLICATION_ORIGIN;
  const requestConfig: McpOAuthAuthorizationRequestBoundaryConfigV1 = Object.freeze({
    kind: "mcp_oauth_authorization_request_boundary_config",
    authorizationPageOrigin: origin,
    authorizationPagePath: authorizationPath,
    canonicalResource,
    allowedRedirectUris,
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    approvedOptionalScopes: freezeOptionalScopes(
      input.approvedOptionalScopes ?? DEFAULT_APPROVED_OPTIONAL_SCOPES,
    ),
    allowedOptionalParameters: freezeOptionalParameters(
      input.allowedOptionalParameters ?? DEFAULT_ALLOWED_OPTIONAL_PARAMETERS,
    ),
    maxUrlLength: input.maxUrlLength ?? DEFAULT_MAX_URL_LENGTH,
    maxParameterLength: input.maxParameterLength ?? DEFAULT_MAX_PARAMETER_LENGTH,
    maxStateLength: input.maxStateLength ?? DEFAULT_MAX_STATE_LENGTH,
    maxIdTokenHintLength: input.maxIdTokenHintLength ?? DEFAULT_MAX_ID_TOKEN_HINT_LENGTH,
    clientIdPolicy: Object.freeze({
      mode: "predefined_allowlist",
      allowedClientIds,
      version: 1,
    }),
    localDevelopmentOnly: true,
    allowHttpLocalhostAuthorizationOrigin: allowHttpLocalhostApplicationOrigin,
    version: 1,
  });
  const continuationConfig: McpOAuthLoginReturnContinuationBoundaryConfigV1 = Object.freeze({
    kind: "mcp_oauth_login_return_continuation_boundary_config",
    applicationOrigin: origin,
    fixedSignInPath: "/sign-in",
    fixedContinuationPath: MCP_OAUTH_CONTINUATION_PATH,
    fixedAuthorizationPageOrigin: origin,
    fixedAuthorizationPagePath: authorizationPath,
    signInReturnParameterName: MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
    continuationHandleParameterName: MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
    maxContinuationUrlLength: input.maxContinuationUrlLength ?? DEFAULT_MAX_CONTINUATION_URL_LENGTH,
    maxRawHandleLength: input.maxRawHandleLength ?? DEFAULT_MAX_RAW_HANDLE_LENGTH,
    routeContract: Object.freeze({
      recommendsHttpStatus: 303,
      cacheControl: "no-store",
      pragma: "no-cache",
      referrerPolicy: "no-referrer",
      robotsTag: "noindex, nofollow",
      version: 1,
    }),
    localDevelopmentOnly: true,
    allowHttpLocalhostApplicationOrigin,
    version: 1,
  });

  return Object.freeze({
    kind: "mcp_oauth_local_dev_route_adapter_config",
    enabled,
    applicationOrigin: origin,
    authorizationPath,
    continuationPath: MCP_OAUTH_CONTINUATION_PATH,
    signInPath: "/sign-in",
    authorizationRequestConfig: requestConfig,
    continuationConfig,
    localDevelopmentOnly: true,
    version: 1,
  });
}

export function isMcpOAuthLocalDevRouteHandledPath(path: string): boolean {
  return path === LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_PATH || path === MCP_OAUTH_CONTINUATION_PATH;
}

export async function handleMcpOAuthLocalDevRouteRequest(
  request: McpOAuthLocalDevRouteAdapterRequestV1,
  config: McpOAuthLocalDevRouteAdapterConfigV1 = buildMcpOAuthLocalDevRouteAdapterConfig(),
  dependencies: McpOAuthLocalDevRouteAdapterDependenciesV1 = {},
): Promise<McpOAuthLocalDevRouteAdapterResponseV1> {
  if (!isMcpOAuthLocalDevRouteHandledPath(request.path)) {
    return notHandled();
  }
  if (!config.enabled) {
    return notHandled();
  }
  if (request.method.toUpperCase() !== "GET") {
    return safeFailureResponse("unsupported_method", 405);
  }
  if (!requestHostMatchesApplicationOrigin(request, config)) {
    return safeFailureResponse("invalid_host", 403);
  }
  if (request.path === config.authorizationPath) {
    return handleAuthorizationRequest(request, config, dependencies);
  }
  return handleContinuationRequest(request, config, dependencies);
}

async function handleAuthorizationRequest(
  request: McpOAuthLocalDevRouteAdapterRequestV1,
  config: McpOAuthLocalDevRouteAdapterConfigV1,
  dependencies: McpOAuthLocalDevRouteAdapterDependenciesV1,
): Promise<McpOAuthLocalDevRouteAdapterResponseV1> {
  if (!dependencies.createPreAuthIntent) {
    return safeFailureResponse("dependency_unavailable", 503);
  }
  const authorizationUrl = readSameOriginRequestUrl(request.url, config);
  if (!authorizationUrl) {
    return safeFailureResponse("invalid_authorization_request", 400);
  }
  const projection = projectMcpOAuthPreAuthAuthorizationRequest({
    kind: "mcp_oauth_pre_auth_authorization_request_projection_input",
    authorizationUrl,
    config: config.authorizationRequestConfig,
    version: 1,
  });
  if (!projection.accepted) {
    return safeFailureResponse("invalid_authorization_request", 400);
  }
  const codec = dependencies.handleCodec ?? defaultMcpOAuthContinuationHandleCodecV1;
  const generated = readGeneratedHandle(codec);
  if (!generated) {
    return safeFailureResponse("invalid_configuration", 500);
  }
  const now = readNow(dependencies);

  let createResult: McpOAuthPreAuthIntentCreatePortResultV1;
  try {
    createResult = await dependencies.createPreAuthIntent({
      authorizationRequestProjection: projection.serverOnly,
      preAuthHandleHash: generated.intentHandleHash,
      now,
      version: 1,
    });
  } catch {
    return safeFailureResponse("pre_auth_create_failed", 409);
  }
  if (!isPreAuthCreateSuccess(createResult, now)) {
    return safeFailureResponse("pre_auth_create_failed", 409);
  }

  return redirectToSignIn(generated.rawHandle, config);
}

async function handleContinuationRequest(
  request: McpOAuthLocalDevRouteAdapterRequestV1,
  config: McpOAuthLocalDevRouteAdapterConfigV1,
  dependencies: McpOAuthLocalDevRouteAdapterDependenciesV1,
): Promise<McpOAuthLocalDevRouteAdapterResponseV1> {
  if (!dependencies.bindPreAuthIntentToAuthenticatedOwner || !dependencies.consumeAuthorizationIntent) {
    return safeFailureResponse("dependency_unavailable", 503);
  }
  const codec = dependencies.handleCodec ?? defaultMcpOAuthContinuationHandleCodecV1;
  const rawHandle = readContinuationRawHandle(request.url, config, codec);
  if (!rawHandle) {
    return safeFailureResponse("invalid_continuation_request", 400);
  }
  const intentHandleHash = readHandleHash(rawHandle, codec);
  if (!intentHandleHash) {
    return safeFailureResponse("invalid_continuation_request", 400);
  }
  const now = readNow(dependencies);

  let bindingResult: McpOAuthPreAuthOwnerBindingPortResultV1;
  try {
    bindingResult = await dependencies.bindPreAuthIntentToAuthenticatedOwner({
      preAuthHandleHash: intentHandleHash,
      now,
      version: 1,
    });
  } catch {
    return safeFailureResponse("owner_binding_failed", 409);
  }
  if (!isOwnerBindingSuccess(bindingResult, now)) {
    return safeFailureResponse("owner_binding_failed", bindingResult.reason === "unauthenticated" ? 401 : 409);
  }

  const resumeResult = await resumeMcpOAuthAuthorizationAfterLoginReturn({
    kind: "resume_mcp_oauth_authorization_after_login_return_input",
    continuationUrlOrPath: request.url,
    trustedOwner: bindingResult.serverOnly.trustedOwner,
    consumeIntent: dependencies.consumeAuthorizationIntent,
    handleCodec: codec,
    now,
    config: config.continuationConfig,
    version: 1,
  });
  if (!resumeResult.resumed) {
    return safeFailureResponse("continuation_resume_failed", 409);
  }

  return jsonResponse(200, {
    kind: "mcp_oauth_local_dev_authorization_state",
    status: "authorization_request_restored",
    localDevelopmentOnly: true,
    authorizationRequestRestored: true,
    authorizationGranted: false,
    providerValidationPending: resumeResult.serverOnly.providerValidationPending,
    consentCompleted: resumeResult.serverOnly.consentCompleted,
    authorizationCodeIssued: false,
    tokenIssued: false,
    accountLinkCreated: false,
    externalProviderCalled: false,
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function redirectToSignIn(
  rawHandle: string,
  config: McpOAuthLocalDevRouteAdapterConfigV1,
): McpOAuthLocalDevRouteAdapterResponseV1 {
  const continuationPath = `${config.continuationPath}?${new URLSearchParams({
    [MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER]: rawHandle,
  }).toString()}`;
  const signInUrl = `${config.applicationOrigin}${config.signInPath}?${new URLSearchParams({
    [MCP_OAUTH_SIGN_IN_RETURN_PARAMETER]: continuationPath,
  }).toString()}`;
  return {
    handled: true,
    status: 303,
    headers: {
      ...noStoreHeaders(),
      location: signInUrl,
    },
    bodyText: "",
  };
}

function readSameOriginRequestUrl(
  urlOrPath: string,
  config: McpOAuthLocalDevRouteAdapterConfigV1,
): string | undefined {
  if (isUnsafeRouteInput(urlOrPath)) return undefined;
  try {
    const parsed = new URL(urlOrPath, config.applicationOrigin);
    const queryStart = urlOrPath.indexOf("?");
    const rawPath = queryStart === -1 ? urlOrPath : urlOrPath.slice(0, queryStart);
    if (
      parsed.origin !== config.applicationOrigin ||
      parsed.pathname !== config.authorizationPath ||
      rawPath !== config.authorizationPath ||
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

function readContinuationRawHandle(
  urlOrPath: string,
  config: McpOAuthLocalDevRouteAdapterConfigV1,
  codec: McpOAuthContinuationHandleCodecV1,
): string | undefined {
  if (isUnsafePathInput(urlOrPath)) return undefined;
  try {
    const parsed = new URL(urlOrPath, config.applicationOrigin);
    const queryStart = urlOrPath.indexOf("?");
    const rawPath = queryStart === -1 ? urlOrPath : urlOrPath.slice(0, queryStart);
    if (
      parsed.origin !== config.applicationOrigin ||
      parsed.pathname !== config.continuationPath ||
      rawPath !== config.continuationPath ||
      parsed.hash
    ) {
      return undefined;
    }
    const keys = [...parsed.searchParams.keys()];
    if (
      keys.length !== 1 ||
      keys[0] !== MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER ||
      parsed.searchParams.getAll(MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER).length !== 1
    ) {
      return undefined;
    }
    const rawHandle = parsed.searchParams.get(MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER);
    if (
      typeof rawHandle !== "string" ||
      rawHandle.length === 0 ||
      rawHandle.length > config.continuationConfig.maxRawHandleLength ||
      !codec.validate(rawHandle)
    ) {
      return undefined;
    }
    return rawHandle;
  } catch {
    return undefined;
  }
}

function isUnsafePathInput(value: string): boolean {
  return (
    isUnsafeRouteInput(value) ||
    hasDotSegment(value) ||
    /%2e|%2f|%5c/iu.test(value)
  );
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

function readHandleHash(rawHandle: string, codec: McpOAuthContinuationHandleCodecV1): string | undefined {
  try {
    const digest = codec.hash(rawHandle);
    return isValidIntentHandleHash(digest) ? digest : undefined;
  } catch {
    return undefined;
  }
}

function isPreAuthCreateSuccess(value: McpOAuthPreAuthIntentCreatePortResultV1, now: number): value is Extract<
  McpOAuthPreAuthIntentCreatePortResultV1,
  { ok: true }
> {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_pre_auth_intent_create_result" &&
    value.ok === true &&
    value.reason === "created" &&
    isPlainRecord(value.serverOnly) &&
    value.serverOnly.status === "pre_auth_pending" &&
    typeof value.serverOnly.expiresAt === "number" &&
    value.serverOnly.expiresAt > now &&
    value.serverOnly.version === 1 &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function isOwnerBindingSuccess(value: McpOAuthPreAuthOwnerBindingPortResultV1, now: number): value is Extract<
  McpOAuthPreAuthOwnerBindingPortResultV1,
  { ok: true }
> {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_pre_auth_owner_binding_result" &&
    value.ok === true &&
    value.reason === "bound" &&
    isPlainRecord(value.serverOnly) &&
    isPlainRecord(value.serverOnly.ownerBoundIntent) &&
    value.serverOnly.ownerBoundIntent.status === "pending" &&
    typeof value.serverOnly.ownerBoundIntent.expiresAt === "number" &&
    value.serverOnly.ownerBoundIntent.expiresAt > now &&
    isPlainRecord(value.serverOnly.preAuthIntent) &&
    value.serverOnly.preAuthIntent.status === "claimed" &&
    isTrustedOwner(value.serverOnly.trustedOwner) &&
    value.serverOnly.version === 1 &&
    value.modelVisible === false &&
    value.safeForLogging === false &&
    value.version === 1
  );
}

function isTrustedOwner(value: unknown): value is McpOAuthAuthorizationTrustedOwnerV1 {
  return (
    isPlainRecord(value) &&
    value.kind === "mcp_oauth_authorization_trusted_owner" &&
    typeof value.twoweeksClerkId === "string" &&
    value.twoweeksClerkId.length > 0 &&
    value.version === 1
  );
}

function requestHostMatchesApplicationOrigin(
  request: McpOAuthLocalDevRouteAdapterRequestV1,
  config: McpOAuthLocalDevRouteAdapterConfigV1,
): boolean {
  const host = readFirstHeaderValue(request.headers.host).trim().toLowerCase();
  if (!host) return false;
  return host === new URL(config.applicationOrigin).host.toLowerCase();
}

function readNow(dependencies: McpOAuthLocalDevRouteAdapterDependenciesV1): number {
  const now = dependencies.now?.() ?? Date.now();
  return Number.isSafeInteger(now) && now >= 0 ? now : Date.now();
}

function notHandled(): McpOAuthLocalDevRouteAdapterResponseV1 {
  return Object.freeze({
    handled: false,
    status: 404,
    headers: noStoreHeaders(),
    bodyText: "",
  });
}

function safeFailureResponse(
  reason: McpOAuthLocalDevRouteAdapterFailureReasonV1,
  status: number,
): McpOAuthLocalDevRouteAdapterResponseV1 {
  return jsonResponse(status, {
    kind: "mcp_oauth_local_dev_route_failure",
    code: "mcp_oauth_local_dev_route_denied",
    reason,
    message: "Local dev OAuth authorization unavailable.",
    safeForModel: true,
    localDevelopmentOnly: true,
    authorizationCodeIssued: false,
    tokenIssued: false,
    accountLinkCreated: false,
    externalProviderCalled: false,
    sensitiveValuesEchoed: false,
    version: 1,
  });
}

function jsonResponse(status: number, json: unknown): McpOAuthLocalDevRouteAdapterResponseV1 {
  return Object.freeze({
    handled: true,
    status,
    headers: {
      ...noStoreHeaders(),
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

function readCanonicalOrigin(value: string, allowHttpLocalhost: boolean): string | undefined {
  try {
    const url = new URL(value);
    if (url.username || url.password || url.pathname !== "/" || url.search || url.hash) return undefined;
    if (url.protocol === "https:" && !url.hostname.includes("*")) return url.origin;
    if (url.protocol === "http:" && allowHttpLocalhost && isLocalhost(url.hostname)) return url.origin;
    return undefined;
  } catch {
    return undefined;
  }
}

function uniqueNonEmptyStrings(values: readonly string[]): readonly string[] {
  return Object.freeze([...new Set(values.map((value) => value.trim()).filter((value) => value.length > 0))]);
}

function freezeOptionalScopes(
  values: readonly McpOAuthAuthorizationOptionalScopeV1[],
): readonly McpOAuthAuthorizationOptionalScopeV1[] {
  return Object.freeze([...values]);
}

function freezeOptionalParameters(
  values: readonly McpOAuthAuthorizationOptionalParameterV1[],
): readonly McpOAuthAuthorizationOptionalParameterV1[] {
  return Object.freeze([...values]);
}

function readFirstHeaderValue(value: string | readonly string[] | undefined): string {
  if (typeof value === "string") return value;
  return Array.isArray(value) ? value[0] ?? "" : "";
}

function isValidIntentHandleHash(value: unknown): value is string {
  return typeof value === "string" && INTENT_HANDLE_HASH_PATTERN.test(value);
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

function isLocalhost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}
