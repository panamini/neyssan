import { createHash, randomBytes } from "node:crypto";
import type {
  McpOAuthAuthorizationRequestBoundaryHandoffV1,
  McpOAuthAuthorizationTrustedOwnerV1,
} from "./mcpOAuthAuthorizationRequestBoundary";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "./mcpAuthPolicyBoundary";
import {
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
  MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
} from "../../pages/sign-in-return";

export type McpOAuthLoginReturnContinuationBoundaryConfigV1 = Readonly<{
  kind: "mcp_oauth_login_return_continuation_boundary_config";
  applicationOrigin: string;
  fixedSignInPath: "/sign-in";
  fixedContinuationPath: typeof MCP_OAUTH_CONTINUATION_PATH;
  fixedAuthorizationPageOrigin: string;
  fixedAuthorizationPagePath: string;
  signInReturnParameterName: typeof MCP_OAUTH_SIGN_IN_RETURN_PARAMETER;
  continuationHandleParameterName: typeof MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER;
  maxContinuationUrlLength: number;
  maxRawHandleLength: number;
  routeContract: Readonly<{
    recommendsHttpStatus: 303;
    cacheControl: "no-store";
    pragma: "no-cache";
    referrerPolicy: "no-referrer";
    robotsTag: "noindex, nofollow";
    version: 1;
  }>;
  localDevelopmentOnly: true;
  allowHttpLocalhostApplicationOrigin: boolean;
  version: 1;
}>;

export type McpOAuthContinuationHandleCodecV1 = Readonly<{
  generate(): Readonly<{
    rawHandle: string;
    intentHandleHash: string;
  }>;
  validate(rawHandle: unknown): rawHandle is string;
  hash(rawHandle: string): string;
}>;

export type McpOAuthIntentCreateInputV1 = Readonly<{
  authorizationRequestHandoff: McpOAuthAuthorizationRequestBoundaryHandoffV1;
  intentHandleHash: string;
  now: number;
  version: 1;
}>;

export type McpOAuthIntentCreateResultV1 = Readonly<
  | {
      kind: "mcp_oauth_authorization_intent_create_result";
      ok: true;
      reason: "created";
      serverOnly: {
        status: "pending";
        expiresAt: number;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_authorization_intent_create_result";
      ok: false;
      reason: string;
      safeFailure: unknown;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthIntentConsumeInputV1 = Readonly<{
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
  intentHandleHash: string;
  now: number;
  version: 1;
}>;

export type McpOAuthIntentConsumeResultV1 = Readonly<
  | {
      kind: "mcp_oauth_authorization_intent_consume_result";
      ok: true;
      reason: "consumed";
      serverOnly: {
        authorizationRequestHandoff: McpOAuthAuthorizationRequestBoundaryHandoffV1;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_authorization_intent_consume_result";
      ok: false;
      reason: string;
      safeFailure: unknown;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthIntentCreatePortV1 = (
  input: McpOAuthIntentCreateInputV1,
) => Promise<McpOAuthIntentCreateResultV1>;

export type McpOAuthIntentConsumePortV1 = (
  input: McpOAuthIntentConsumeInputV1,
) => Promise<McpOAuthIntentConsumeResultV1>;

export type McpOAuthLoginReturnContinuationFailureReasonV1 =
  | "invalid_input"
  | "invalid_configuration"
  | "invalid_continuation_url"
  | "invalid_continuation_handle"
  | "intent_create_failed"
  | "intent_unavailable"
  | "intent_expired_or_consumed"
  | "owner_or_intent_mismatch"
  | "malformed_consumed_handoff"
  | "authorization_url_reconstruction_failed"
  | "sensitive_hint_continuation_decision_required";

export type McpOAuthLoginReturnContinuationSafeFailureV1 = Readonly<{
  code: "mcp_oauth_continuation_unavailable";
  message: "OAuth continuation unavailable.";
  safeForModel: true;
  rawHandleEchoed: false;
  digestEchoed: false;
  tokenEchoed: false;
  identityEchoed: false;
  sensitiveValuesEchoed: false;
  version: 1;
}>;

export type PrepareMcpOAuthLoginReturnContinuationInputV1 = Readonly<{
  kind: "prepare_mcp_oauth_login_return_continuation_input";
  authorizationRequestHandoff: McpOAuthAuthorizationRequestBoundaryHandoffV1;
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
  createIntent: McpOAuthIntentCreatePortV1;
  handleCodec?: McpOAuthContinuationHandleCodecV1;
  now: number;
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1;
  version: 1;
}>;

export type ResumeMcpOAuthAuthorizationAfterLoginReturnInputV1 = Readonly<{
  kind: "resume_mcp_oauth_authorization_after_login_return_input";
  continuationUrlOrPath: string;
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
  consumeIntent: McpOAuthIntentConsumePortV1;
  handleCodec?: McpOAuthContinuationHandleCodecV1;
  now: number;
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1;
  version: 1;
}>;

export type PrepareMcpOAuthLoginReturnContinuationResultV1 = Readonly<
  | {
      kind: "prepare_mcp_oauth_login_return_continuation_result";
      prepared: true;
      reason: "prepared";
      serverOnly: {
        signInUrl: string;
        continuationUrl: string;
        continuationPath: string;
        routeContract: McpOAuthLoginReturnContinuationBoundaryConfigV1["routeContract"];
        intent: {
          status: "pending";
          expiresAt: number;
          version: 1;
        };
        authorizationGranted: false;
        providerValidationPending: true;
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
      kind: "prepare_mcp_oauth_login_return_continuation_result";
      prepared: false;
      reason: McpOAuthLoginReturnContinuationFailureReasonV1;
      safeFailure: McpOAuthLoginReturnContinuationSafeFailureV1;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type ResumeMcpOAuthAuthorizationAfterLoginReturnResultV1 = Readonly<
  | {
      kind: "resume_mcp_oauth_authorization_after_login_return_result";
      resumed: true;
      reason: "resumed";
      serverOnly: {
        authorizationUrl: string;
        authorizationPath: string;
        routeContract: McpOAuthLoginReturnContinuationBoundaryConfigV1["routeContract"];
        authorizationGranted: false;
        providerValidationPending: true;
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
      kind: "resume_mcp_oauth_authorization_after_login_return_result";
      resumed: false;
      reason: McpOAuthLoginReturnContinuationFailureReasonV1;
      safeFailure: McpOAuthLoginReturnContinuationSafeFailureV1;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

const RAW_HANDLE_BYTE_LENGTH = 32;
const RAW_HANDLE_LENGTH = 43;
const RAW_HANDLE_PATTERN = /^[A-Za-z0-9_-]{43}$/u;
const INTENT_HANDLE_HASH_PATTERN = /^[0-9a-f]{64}$/u;
const CONFIG_KEYS = [
  "kind",
  "applicationOrigin",
  "fixedSignInPath",
  "fixedContinuationPath",
  "fixedAuthorizationPageOrigin",
  "fixedAuthorizationPagePath",
  "signInReturnParameterName",
  "continuationHandleParameterName",
  "maxContinuationUrlLength",
  "maxRawHandleLength",
  "routeContract",
  "localDevelopmentOnly",
  "allowHttpLocalhostApplicationOrigin",
  "version",
] as const;
const ROUTE_CONTRACT_KEYS = [
  "recommendsHttpStatus",
  "cacheControl",
  "pragma",
  "referrerPolicy",
  "robotsTag",
  "version",
] as const;
const CREATE_SUCCESS_KEYS = [
  "kind",
  "ok",
  "reason",
  "serverOnly",
  "modelVisible",
  "safeForLogging",
  "version",
] as const;
const CREATE_SUCCESS_SERVER_ONLY_KEYS = ["status", "expiresAt", "version"] as const;
const CONSUME_SUCCESS_KEYS = CREATE_SUCCESS_KEYS;
const CONSUME_SUCCESS_SERVER_ONLY_KEYS = ["authorizationRequestHandoff", "version"] as const;
const GENERATED_HANDLE_KEYS = ["rawHandle", "intentHandleHash"] as const;
const SENSITIVE_OPTIONAL_PARAMETERS = ["login_hint", "id_token_hint"] as const;
const RESTORED_OPTIONAL_PARAMETERS = ["nonce", "prompt"] as const;

export const defaultMcpOAuthContinuationHandleCodecV1: McpOAuthContinuationHandleCodecV1 =
  Object.freeze({
    generate() {
      const rawHandle = randomBytes(RAW_HANDLE_BYTE_LENGTH).toString("base64url");
      return Object.freeze({
        rawHandle,
        intentHandleHash: hashMcpOAuthContinuationHandle(rawHandle),
      });
    },
    validate(rawHandle: unknown): rawHandle is string {
      return isCanonicalRawHandle(rawHandle);
    },
    hash(rawHandle: string): string {
      return hashMcpOAuthContinuationHandle(rawHandle);
    },
  });

export async function prepareMcpOAuthLoginReturnContinuation(
  input: PrepareMcpOAuthLoginReturnContinuationInputV1,
): Promise<PrepareMcpOAuthLoginReturnContinuationResultV1> {
  if (!isPlainRecord(input)) return prepareDenied("invalid_input");
  const config = parseBoundaryConfig(input.config);
  const codec = input.handleCodec ?? defaultMcpOAuthContinuationHandleCodecV1;
  if (!isValidCodec(codec) || !hasValidPrepareInput(input)) {
    return prepareDenied("invalid_input");
  }
  if (!config) {
    return prepareDenied("invalid_configuration");
  }
  if (
    !isAcceptedAuthorizationHandoff(input.authorizationRequestHandoff, config) ||
    !sameTrustedOwner(input.trustedOwner, input.authorizationRequestHandoff.trustedOwner)
  ) {
    return prepareDenied("invalid_input");
  }

  if (hasSensitiveOptionalParameters(input.authorizationRequestHandoff)) {
    return prepareDenied("sensitive_hint_continuation_decision_required");
  }

  const generated = readValidGeneratedContinuationHandle(codec, config);
  if (!generated) return prepareDenied("invalid_continuation_handle");

  const continuationPath = buildContinuationPath(generated.rawHandle, config);
  const continuationUrl = `${config.applicationOrigin}${continuationPath}`;
  const signInUrl = buildSignInUrl(continuationPath, config);
  if (!hasBoundedContinuationUrls(continuationUrl, signInUrl, config)) {
    return prepareDenied("invalid_continuation_url");
  }

  let createResult: McpOAuthIntentCreateResultV1;
  try {
    createResult = await input.createIntent({
      authorizationRequestHandoff: input.authorizationRequestHandoff,
      intentHandleHash: generated.intentHandleHash,
      now: input.now,
      version: 1,
    });
  } catch {
    return prepareDenied("intent_create_failed");
  }

  if (!isCreateIntentSuccess(createResult, input.now)) return prepareDenied("intent_create_failed");

  return Object.freeze({
    kind: "prepare_mcp_oauth_login_return_continuation_result",
    prepared: true,
    reason: "prepared",
    serverOnly: Object.freeze({
      signInUrl,
      continuationUrl,
      continuationPath,
      routeContract: config.routeContract,
      intent: Object.freeze({
        status: createResult.serverOnly.status,
        expiresAt: createResult.serverOnly.expiresAt,
        version: 1,
      }),
      authorizationGranted: false,
      providerValidationPending: true,
      consentCompleted: false,
      authorizationCodeIssued: false,
      tokenIssued: false,
      accountLinkCreated: false,
      version: 1,
    }),
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

export async function resumeMcpOAuthAuthorizationAfterLoginReturn(
  input: ResumeMcpOAuthAuthorizationAfterLoginReturnInputV1,
): Promise<ResumeMcpOAuthAuthorizationAfterLoginReturnResultV1> {
  if (!isPlainRecord(input)) return resumeDenied("invalid_input");
  const config = parseBoundaryConfig(input.config);
  const codec = input.handleCodec ?? defaultMcpOAuthContinuationHandleCodecV1;
  if (
    input.kind !== "resume_mcp_oauth_authorization_after_login_return_input" ||
    input.version !== 1 ||
    !isValidNow(input.now) ||
    !isTrustedOwner(input.trustedOwner) ||
    typeof input.consumeIntent !== "function" ||
    !isValidCodec(codec)
  ) {
    return resumeDenied("invalid_input");
  }
  if (!config) {
    return resumeDenied("invalid_configuration");
  }

  const continuation = parseContinuationUrlOrPath(input.continuationUrlOrPath, config, codec);
  if (!continuation.ok) return resumeDenied(continuation.reason);
  const intentHandleHash = hashContinuationHandleWithCodec(codec, continuation.rawHandle);
  if (!isValidIntentHandleHash(intentHandleHash)) return resumeDenied("invalid_continuation_handle");

  let consumeResult: McpOAuthIntentConsumeResultV1;
  try {
    consumeResult = await input.consumeIntent({
      trustedOwner: input.trustedOwner,
      intentHandleHash,
      now: input.now,
      version: 1,
    });
  } catch {
    return resumeDenied("intent_unavailable");
  }

  if (!isPlainRecord(consumeResult)) return resumeDenied("malformed_consumed_handoff");
  if (consumeResult.ok !== true) return resumeDenied(mapConsumeFailure(readFailureReason(consumeResult.reason)));
  if (!isConsumeIntentSuccess(consumeResult)) return resumeDenied("malformed_consumed_handoff");

  const handoff = consumeResult.serverOnly.authorizationRequestHandoff;
  if (!sameTrustedOwner(input.trustedOwner, handoff.trustedOwner) || !isAcceptedAuthorizationHandoff(handoff, config)) {
    return resumeDenied("malformed_consumed_handoff");
  }
  if (hasSensitiveOptionalParameters(handoff)) {
    return resumeDenied("sensitive_hint_continuation_decision_required");
  }

  const reconstructed = reconstructAuthorizationUrl(handoff, config);
  if (!reconstructed) return resumeDenied("authorization_url_reconstruction_failed");

  return Object.freeze({
    kind: "resume_mcp_oauth_authorization_after_login_return_result",
    resumed: true,
    reason: "resumed",
    serverOnly: Object.freeze({
      authorizationUrl: reconstructed.authorizationUrl,
      authorizationPath: reconstructed.authorizationPath,
      routeContract: config.routeContract,
      authorizationGranted: false,
      providerValidationPending: true,
      consentCompleted: false,
      authorizationCodeIssued: false,
      tokenIssued: false,
      accountLinkCreated: false,
      version: 1,
    }),
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

function hashMcpOAuthContinuationHandle(rawHandle: string): string {
  return createHash("sha256").update(rawHandle, "utf8").digest("hex");
}

function hashContinuationHandleWithCodec(
  codec: McpOAuthContinuationHandleCodecV1,
  rawHandle: string,
): string | undefined {
  try {
    return codec.hash(rawHandle);
  } catch {
    return undefined;
  }
}

function buildContinuationPath(
  rawHandle: string,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): string {
  const params = new URLSearchParams({
    [config.continuationHandleParameterName]: rawHandle,
  });
  return `${config.fixedContinuationPath}?${params.toString()}`;
}

function buildSignInUrl(
  continuationPath: string,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): string {
  const params = new URLSearchParams({
    [config.signInReturnParameterName]: continuationPath,
  });
  return `${config.applicationOrigin}${config.fixedSignInPath}?${params.toString()}`;
}

function reconstructAuthorizationUrl(
  handoff: McpOAuthAuthorizationRequestBoundaryHandoffV1,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): Readonly<{ authorizationUrl: string; authorizationPath: string }> | undefined {
  if (handoff.authorizationPage.origin !== config.fixedAuthorizationPageOrigin) return undefined;
  if (handoff.authorizationPage.path !== config.fixedAuthorizationPagePath) return undefined;

  const query = new URLSearchParams();
  query.append("response_type", handoff.providerForwardRequest.responseType);
  query.append("client_id", handoff.providerForwardRequest.clientId);
  query.append("redirect_uri", handoff.providerForwardRequest.redirectUri);
  query.append("scope", handoff.providerForwardRequest.scopes.join(" "));
  query.append("state", handoff.providerForwardRequest.state);
  query.append("code_challenge", handoff.providerForwardRequest.pkce.codeChallenge);
  query.append("code_challenge_method", handoff.providerForwardRequest.pkce.codeChallengeMethod);
  query.append("resource", handoff.providerForwardRequest.resource);

  for (const parameter of RESTORED_OPTIONAL_PARAMETERS) {
    const value = handoff.providerForwardRequest.approvedOptionalParameters?.[parameter];
    if (value !== undefined) query.append(parameter, value);
  }

  const authorizationPath = `${handoff.authorizationPage.path}?${query.toString()}`;
  return Object.freeze({
    authorizationPath,
    authorizationUrl: `${config.fixedAuthorizationPageOrigin}${authorizationPath}`,
  });
}

function parseContinuationUrlOrPath(
  value: string,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
  codec: McpOAuthContinuationHandleCodecV1,
):
  | { ok: true; rawHandle: string }
  | {
      ok: false;
      reason: Extract<
        McpOAuthLoginReturnContinuationFailureReasonV1,
        "invalid_continuation_url" | "invalid_continuation_handle"
      >;
    } {
  if (isUnsafeContinuationInput(value, config)) {
    return { ok: false, reason: "invalid_continuation_url" };
  }

  const url = readConfiguredContinuationUrl(value, config);
  if (!url || !hasSingleContinuationHandleParameter(url, config)) {
    return { ok: false, reason: "invalid_continuation_url" };
  }

  return readValidContinuationRawHandle(url, config, codec);
}

function parseBoundaryConfig(
  value: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): McpOAuthLoginReturnContinuationBoundaryConfigV1 | undefined {
  const record = readRecord(value, CONFIG_KEYS);
  if (!record) return undefined;
  const routeContract = readRecord(record.routeContract, ROUTE_CONTRACT_KEYS);
  if (!hasValidBoundaryConfigValues(record, routeContract)) {
    return undefined;
  }

  const applicationOrigin = readCanonicalOrigin(
    record.applicationOrigin,
    record.allowHttpLocalhostApplicationOrigin === true,
  );
  const fixedAuthorizationPageOrigin = readCanonicalOrigin(
    record.fixedAuthorizationPageOrigin,
    record.allowHttpLocalhostApplicationOrigin === true,
  );
  if (!applicationOrigin || !fixedAuthorizationPageOrigin) return undefined;

  return Object.freeze({
    ...value,
    applicationOrigin,
    fixedAuthorizationPageOrigin,
  });
}

function hasValidPrepareInput(
  input: Record<string, unknown>,
): input is PrepareMcpOAuthLoginReturnContinuationInputV1 {
  return (
    input.kind === "prepare_mcp_oauth_login_return_continuation_input" &&
    input.version === 1 &&
    isValidNow(input.now) &&
    isTrustedOwner(input.trustedOwner) &&
    typeof input.createIntent === "function"
  );
}

function readValidGeneratedContinuationHandle(
  codec: McpOAuthContinuationHandleCodecV1,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): Readonly<{ rawHandle: string; intentHandleHash: string }> | undefined {
  try {
    const generated = codec.generate();
    if (!isGeneratedContinuationHandle(generated)) return undefined;
    const expectedIntentHandleHash = hashContinuationHandleWithCodec(codec, generated.rawHandle);
    if (!isValidIntentHandleHash(expectedIntentHandleHash)) return undefined;
    if (!hasValidGeneratedContinuationHandle(generated, expectedIntentHandleHash, codec, config)) return undefined;
    return generated;
  } catch {
    return undefined;
  }
}

function hasValidGeneratedContinuationHandle(
  generated: Readonly<{ rawHandle: string; intentHandleHash: string }>,
  expectedIntentHandleHash: string,
  codec: McpOAuthContinuationHandleCodecV1,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): boolean {
  return (
    codec.validate(generated.rawHandle) &&
    isCanonicalRawHandle(generated.rawHandle) &&
    generated.rawHandle.length <= config.maxRawHandleLength &&
    isValidIntentHandleHash(generated.intentHandleHash) &&
    generated.intentHandleHash === expectedIntentHandleHash
  );
}

function hasBoundedContinuationUrls(
  continuationUrl: string,
  signInUrl: string,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): boolean {
  return (
    continuationUrl.length <= config.maxContinuationUrlLength &&
    signInUrl.length <= config.maxContinuationUrlLength
  );
}

function isUnsafeContinuationInput(
  value: string,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): boolean {
  return (
    typeof value !== "string" ||
    value.length === 0 ||
    value.length > config.maxContinuationUrlLength ||
    hasControlCharacter(value) ||
    value.includes("\\") ||
    value.includes("#") ||
    hasDotSegment(value) ||
    /%2e|%2f|%5c/iu.test(value)
  );
}

function readConfiguredContinuationUrl(
  value: string,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): URL | undefined {
  const isPath = value.startsWith("/") && !value.startsWith("//");
  try {
    const url = isPath ? new URL(value, config.applicationOrigin) : new URL(value);
    if (!isConfiguredContinuationUrl(url, config)) return undefined;
    if (!hasConfiguredRawPath(value, isPath, url, config)) return undefined;
    return url;
  } catch {
    return undefined;
  }
}

function isConfiguredContinuationUrl(
  url: URL,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): boolean {
  return (
    !url.username &&
    !url.password &&
    url.origin === config.applicationOrigin &&
    url.pathname === config.fixedContinuationPath &&
    url.hash === ""
  );
}

function hasConfiguredRawPath(
  value: string,
  isPath: boolean,
  url: URL,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): boolean {
  const queryStart = value.indexOf("?");
  const rawPath = isPath && queryStart !== -1 ? value.slice(0, queryStart) : url.pathname;
  return rawPath === config.fixedContinuationPath;
}

function hasSingleContinuationHandleParameter(
  url: URL,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): boolean {
  const searchKeys = [...url.searchParams.keys()];
  return (
    searchKeys.length === 1 &&
    searchKeys[0] === config.continuationHandleParameterName &&
    url.searchParams.getAll(config.continuationHandleParameterName).length === 1
  );
}

function readValidContinuationRawHandle(
  url: URL,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
  codec: McpOAuthContinuationHandleCodecV1,
):
  | { ok: true; rawHandle: string }
  | {
      ok: false;
      reason: "invalid_continuation_handle";
    } {
  const rawHandle = url.searchParams.get(config.continuationHandleParameterName);
  try {
    if (!isBoundedRawHandle(rawHandle, config) || !codec.validate(rawHandle)) {
      return { ok: false, reason: "invalid_continuation_handle" };
    }
  } catch {
    return { ok: false, reason: "invalid_continuation_handle" };
  }
  return { ok: true, rawHandle };
}

function isBoundedRawHandle(
  rawHandle: unknown,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): rawHandle is string {
  return typeof rawHandle === "string" && rawHandle.length <= config.maxRawHandleLength;
}

function hasValidBoundaryConfigValues(
  record: Record<(typeof CONFIG_KEYS)[number], unknown>,
  routeContract: Record<(typeof ROUTE_CONTRACT_KEYS)[number], unknown> | undefined,
): boolean {
  return (
    hasFixedBoundaryConfigValues(record) &&
    hasValidRouteContract(routeContract) &&
    isAbsoluteOrigin(record.applicationOrigin, record.allowHttpLocalhostApplicationOrigin === true) &&
    isAbsoluteOrigin(record.fixedAuthorizationPageOrigin, record.allowHttpLocalhostApplicationOrigin === true) &&
    isSafeAbsolutePath(record.fixedAuthorizationPagePath) &&
    isPositiveBound(record.maxContinuationUrlLength) &&
    isPositiveBound(record.maxRawHandleLength) &&
    record.maxRawHandleLength >= RAW_HANDLE_LENGTH
  );
}

function hasFixedBoundaryConfigValues(record: Record<(typeof CONFIG_KEYS)[number], unknown>): boolean {
  return (
    record.kind === "mcp_oauth_login_return_continuation_boundary_config" &&
    record.fixedSignInPath === "/sign-in" &&
    record.fixedContinuationPath === MCP_OAUTH_CONTINUATION_PATH &&
    record.signInReturnParameterName === MCP_OAUTH_SIGN_IN_RETURN_PARAMETER &&
    record.continuationHandleParameterName === MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER &&
    record.localDevelopmentOnly === true &&
    record.version === 1
  );
}

function hasValidRouteContract(
  routeContract: Record<(typeof ROUTE_CONTRACT_KEYS)[number], unknown> | undefined,
): boolean {
  return (
    routeContract !== undefined &&
    routeContract.recommendsHttpStatus === 303 &&
    routeContract.cacheControl === "no-store" &&
    routeContract.pragma === "no-cache" &&
    routeContract.referrerPolicy === "no-referrer" &&
    routeContract.robotsTag === "noindex, nofollow" &&
    routeContract.version === 1
  );
}

function isAcceptedAuthorizationHandoff(
  handoff: unknown,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): handoff is McpOAuthAuthorizationRequestBoundaryHandoffV1 {
  if (!isPlainRecord(handoff)) return false;
  return (
    hasAcceptedHandoffEnvelope(handoff) &&
    hasAcceptedAuthorizationPage(handoff, config) &&
    hasAcceptedProviderForwardRequest(handoff) &&
    hasPendingProviderValidation(handoff) &&
    hasAcceptedFutureIntent(handoff) &&
    hasAcceptedLoginReturnContract(handoff)
  );
}

function hasAcceptedHandoffEnvelope(handoff: Record<string, unknown>): boolean {
  return handoff.modelVisible === false && handoff.safeForLogging === false && handoff.version === 1;
}

function hasAcceptedAuthorizationPage(
  handoff: Record<string, unknown>,
  config: McpOAuthLoginReturnContinuationBoundaryConfigV1,
): boolean {
  const authorizationPage = handoff.authorizationPage;
  if (!isPlainRecord(authorizationPage)) return false;
  return (
    authorizationPage.origin === config.fixedAuthorizationPageOrigin &&
    authorizationPage.path === config.fixedAuthorizationPagePath &&
    isAbsoluteOrigin(authorizationPage.origin, config.allowHttpLocalhostApplicationOrigin)
  );
}

function hasAcceptedProviderForwardRequest(handoff: Record<string, unknown>): boolean {
  const providerForwardRequest = handoff.providerForwardRequest;
  if (!isPlainRecord(providerForwardRequest)) return false;
  const pkce = providerForwardRequest.pkce;
  if (!isPlainRecord(pkce)) return false;
  return (
    hasAcceptedProviderEnvelope(providerForwardRequest) &&
    hasAcceptedProviderScopes(providerForwardRequest.scopes) &&
    hasAcceptedPkce(pkce) &&
    hasAcceptedOptionalParameters(providerForwardRequest.approvedOptionalParameters)
  );
}

function hasAcceptedProviderEnvelope(providerForwardRequest: Record<string, unknown>): boolean {
  return (
    providerForwardRequest.responseType === "code" &&
    typeof providerForwardRequest.clientId === "string" &&
    typeof providerForwardRequest.redirectUri === "string" &&
    typeof providerForwardRequest.resource === "string" &&
    typeof providerForwardRequest.state === "string"
  );
}

function hasAcceptedProviderScopes(scopes: unknown): scopes is string[] {
  return (
    Array.isArray(scopes) &&
    scopes.every((scope) => typeof scope === "string") &&
    scopes.includes(TWOWEEKS_APPLICATIONS_READ_SCOPE)
  );
}

function hasAcceptedPkce(pkce: Record<string, unknown>): boolean {
  return typeof pkce.codeChallenge === "string" && pkce.codeChallengeMethod === "S256";
}

function hasAcceptedOptionalParameters(value: unknown): boolean {
  if (value === undefined) return true;
  if (!isPlainRecord(value)) return false;
  const acceptedParameters: readonly string[] = [...SENSITIVE_OPTIONAL_PARAMETERS, ...RESTORED_OPTIONAL_PARAMETERS];
  if (!Object.keys(value).every((parameter) => acceptedParameters.includes(parameter))) return false;
  return acceptedParameters.every((parameter) => {
    const parameterValue = value[parameter];
    return parameterValue === undefined || typeof parameterValue === "string";
  });
}

function hasPendingProviderValidation(handoff: Record<string, unknown>): boolean {
  const providerValidation = handoff.providerValidation;
  if (!isPlainRecord(providerValidation)) return false;
  return (
    providerValidation.status === "pending" &&
    providerValidation.clientRegistrationValidated === false &&
    providerValidation.redirectUriValidatedByProvider === false &&
    providerValidation.consentCompleted === false &&
    providerValidation.authorizationCodeIssued === false &&
    providerValidation.tokenIssued === false &&
    providerValidation.stytchSubjectResolved === false &&
    providerValidation.accountLinkCreated === false
  );
}

function hasAcceptedFutureIntent(handoff: Record<string, unknown>): boolean {
  const futureIntent = handoff.futureIntent;
  if (!isPlainRecord(futureIntent)) return false;
  return (
    futureIntent.kind === "mcp_oauth_authorization_intent_contract" &&
    futureIntent.preservesProviderForwardRequest === true &&
    futureIntent.serverMustPersistBeforeLoginReturn === true &&
    futureIntent.modelVisible === false
  );
}

function hasAcceptedLoginReturnContract(handoff: Record<string, unknown>): boolean {
  const loginReturn = handoff.loginReturn;
  if (!isPlainRecord(loginReturn)) return false;
  return (
    loginReturn.target === "authorization_page" &&
    loginReturn.usesClientRedirectUri === false &&
    loginReturn.containsOwnerIdentity === false &&
    loginReturn.sensitiveOptionalParametersInUrl === false &&
    loginReturn.persisted === false
  );
}

function hasSensitiveOptionalParameters(handoff: McpOAuthAuthorizationRequestBoundaryHandoffV1): boolean {
  return SENSITIVE_OPTIONAL_PARAMETERS.some(
    (parameter) => handoff.providerForwardRequest.approvedOptionalParameters?.[parameter] !== undefined,
  );
}

function mapConsumeFailure(reason: string): McpOAuthLoginReturnContinuationFailureReasonV1 {
  if (reason === "expired") return "intent_expired_or_consumed";
  if (reason === "already_consumed") return "intent_expired_or_consumed";
  if (reason === "not_found_or_forbidden") return "owner_or_intent_mismatch";
  if (reason === "malformed_storage_record") return "malformed_consumed_handoff";
  return "intent_unavailable";
}

function readFailureReason(reason: unknown): string {
  return typeof reason === "string" ? reason : "intent_unavailable";
}

function isCreateIntentSuccess(value: McpOAuthIntentCreateResultV1, now: number): value is Extract<
  McpOAuthIntentCreateResultV1,
  { ok: true }
> {
  const record = readSuccessEnvelope(value, CREATE_SUCCESS_KEYS);
  return (
    record !== undefined &&
    hasExpectedSuccessEnvelope(record, "mcp_oauth_authorization_intent_create_result", "created") &&
    hasExpectedCreateSuccessServerOnly(record.serverOnly, now)
  );
}

function isConsumeIntentSuccess(value: McpOAuthIntentConsumeResultV1): value is Extract<
  McpOAuthIntentConsumeResultV1,
  { ok: true }
> {
  const record = readSuccessEnvelope(value, CONSUME_SUCCESS_KEYS);
  return (
    record !== undefined &&
    hasExpectedSuccessEnvelope(record, "mcp_oauth_authorization_intent_consume_result", "consumed") &&
    hasExpectedConsumeSuccessServerOnly(record.serverOnly)
  );
}

function readSuccessEnvelope<T extends readonly string[]>(
  value: unknown,
  keys: T,
): Record<T[number], unknown> | undefined {
  return readRecord(value, keys);
}

function hasExpectedSuccessEnvelope(
  record: Record<string, unknown>,
  kind: string,
  reason: string,
): boolean {
  return (
    record.kind === kind &&
    record.ok === true &&
    record.reason === reason &&
    record.modelVisible === false &&
    record.safeForLogging === false &&
    record.version === 1
  );
}

function hasExpectedCreateSuccessServerOnly(value: unknown, now: number): boolean {
  const serverOnly = readRecord(value, CREATE_SUCCESS_SERVER_ONLY_KEYS);
  return (
    serverOnly !== undefined &&
    serverOnly.status === "pending" &&
    isValidNow(serverOnly.expiresAt) &&
    serverOnly.expiresAt > now &&
    serverOnly.version === 1
  );
}

function hasExpectedConsumeSuccessServerOnly(value: unknown): boolean {
  const serverOnly = readRecord(value, CONSUME_SUCCESS_SERVER_ONLY_KEYS);
  return (
    serverOnly !== undefined &&
    isPlainRecord(serverOnly.authorizationRequestHandoff) &&
    serverOnly.version === 1
  );
}

function isGeneratedContinuationHandle(value: unknown): value is Readonly<{
  rawHandle: string;
  intentHandleHash: string;
}> {
  const generated = readRecord(value, GENERATED_HANDLE_KEYS);
  return (
    generated !== undefined &&
    typeof generated.rawHandle === "string" &&
    typeof generated.intentHandleHash === "string"
  );
}

function isValidCodec(codec: McpOAuthContinuationHandleCodecV1): boolean {
  return (
    typeof codec.generate === "function" &&
    typeof codec.validate === "function" &&
    typeof codec.hash === "function"
  );
}

function isCanonicalRawHandle(value: unknown): value is string {
  return typeof value === "string" && RAW_HANDLE_PATTERN.test(value);
}

function isValidIntentHandleHash(value: unknown): value is string {
  return typeof value === "string" && INTENT_HANDLE_HASH_PATTERN.test(value);
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

function sameTrustedOwner(
  left: McpOAuthAuthorizationTrustedOwnerV1,
  right: McpOAuthAuthorizationTrustedOwnerV1,
): boolean {
  return isTrustedOwner(left) && isTrustedOwner(right) && left.twoweeksClerkId === right.twoweeksClerkId;
}

function isAbsoluteOrigin(value: unknown, allowHttpLocalhost: boolean): value is string {
  if (typeof value !== "string") return false;
  if (hasControlCharacter(value)) return false;
  try {
    const url = new URL(value);
    if (!hasOriginOnlyUrlShape(url)) return false;
    return isAllowedHttpsOrigin(url) || isAllowedLocalHttpOrigin(url, allowHttpLocalhost);
  } catch {
    return false;
  }
}

function readCanonicalOrigin(value: unknown, allowHttpLocalhost: boolean): string | undefined {
  if (!isAbsoluteOrigin(value, allowHttpLocalhost)) return undefined;
  return new URL(value).origin;
}

function hasOriginOnlyUrlShape(url: URL): boolean {
  return !url.username && !url.password && url.pathname === "/" && url.search === "" && url.hash === "";
}

function isAllowedHttpsOrigin(url: URL): boolean {
  return url.protocol === "https:" && !url.hostname.includes("*");
}

function isAllowedLocalHttpOrigin(url: URL, allowHttpLocalhost: boolean): boolean {
  return url.protocol === "http:" && allowHttpLocalhost && isLocalhost(url.hostname);
}

function isSafeAbsolutePath(value: unknown): value is string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//")) return false;
  if (
    hasControlCharacter(value) ||
    value.includes("\\") ||
    value.includes("?") ||
    value.includes("#") ||
    /%2e|%2f|%5c/iu.test(value)
  ) {
    return false;
  }
  return !hasDotSegment(value);
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function isPositiveBound(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function isValidNow(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readRecord<T extends readonly string[]>(
  value: unknown,
  allowedKeys: T,
): Record<T[number], unknown> | undefined {
  if (!isPlainRecord(value)) return undefined;
  const actualKeys = Reflect.ownKeys(value);
  if (actualKeys.length !== allowedKeys.length) return undefined;
  const record: Partial<Record<T[number], unknown>> = {};
  for (const key of actualKeys) {
    if (typeof key !== "string" || !allowedKeys.includes(key)) return undefined;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor)) return undefined;
    record[key as T[number]] = descriptor.value;
  }
  return Object.freeze(record) as Record<T[number], unknown>;
}

function isLocalhost(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/^\[/u, "").replace(/\]$/u, "");
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1";
}

function hasDotSegment(value: string): boolean {
  return value.split(/[/?#]/u).some((part) => part === "." || part === "..");
}

function prepareDenied(
  reason: McpOAuthLoginReturnContinuationFailureReasonV1,
): PrepareMcpOAuthLoginReturnContinuationResultV1 {
  return Object.freeze({
    kind: "prepare_mcp_oauth_login_return_continuation_result",
    prepared: false,
    reason,
    safeFailure: buildSafeFailure(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function resumeDenied(
  reason: McpOAuthLoginReturnContinuationFailureReasonV1,
): ResumeMcpOAuthAuthorizationAfterLoginReturnResultV1 {
  return Object.freeze({
    kind: "resume_mcp_oauth_authorization_after_login_return_result",
    resumed: false,
    reason,
    safeFailure: buildSafeFailure(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function buildSafeFailure(): McpOAuthLoginReturnContinuationSafeFailureV1 {
  return Object.freeze({
    code: "mcp_oauth_continuation_unavailable",
    message: "OAuth continuation unavailable.",
    safeForModel: true,
    rawHandleEchoed: false,
    digestEchoed: false,
    tokenEchoed: false,
    identityEchoed: false,
    sensitiveValuesEchoed: false,
    version: 1,
  });
}
