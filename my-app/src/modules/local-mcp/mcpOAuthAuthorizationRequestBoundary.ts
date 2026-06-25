import {
  TWOWEEKS_APPLICATIONS_READ_SCOPE,
  type TwoweeksApplicationsReadScopeV1,
} from "./mcpAuthPolicyBoundary";

export type McpOAuthAuthorizationTrustedOwnerV1 = Readonly<{
  kind: "mcp_oauth_authorization_trusted_owner";
  twoweeksClerkId: string;
  version: 1;
}>;

export type McpOAuthAuthorizationOptionalScopeV1 = "openid" | "email" | "profile";

export type McpOAuthAuthorizationOptionalParameterV1 =
  | "nonce"
  | "prompt"
  | "login_hint"
  | "id_token_hint";

export type McpOAuthAuthorizationClientIdPolicyV1 = Readonly<{
  mode: "predefined_allowlist";
  allowedClientIds: readonly string[];
  version: 1;
}>;

export type McpOAuthAuthorizationRequestBoundaryConfigV1 = Readonly<{
  kind: "mcp_oauth_authorization_request_boundary_config";
  authorizationPageOrigin: string;
  authorizationPagePath: string;
  canonicalResource: string;
  allowedRedirectUris: readonly string[];
  requiredScope: TwoweeksApplicationsReadScopeV1;
  approvedOptionalScopes: readonly McpOAuthAuthorizationOptionalScopeV1[];
  allowedOptionalParameters: readonly McpOAuthAuthorizationOptionalParameterV1[];
  maxUrlLength: number;
  maxParameterLength: number;
  maxStateLength: number;
  maxIdTokenHintLength: number;
  clientIdPolicy: McpOAuthAuthorizationClientIdPolicyV1;
  localDevelopmentOnly: true;
  allowHttpLocalhostAuthorizationOrigin: boolean;
  version: 1;
}>;

export type McpOAuthAuthorizationRequestBoundaryDenialReasonV1 =
  | "malformed_input"
  | "malformed_config"
  | "invalid_owner"
  | "wrong_authorization_origin"
  | "wrong_authorization_path"
  | "unsupported_response_type"
  | "missing_parameter"
  | "duplicate_parameter"
  | "invalid_client_id"
  | "unapproved_redirect_uri"
  | "wrong_resource"
  | "missing_canonical_scope"
  | "legacy_scope"
  | "unapproved_scope"
  | "duplicate_scope"
  | "malformed_scope"
  | "invalid_state"
  | "invalid_pkce"
  | "unsupported_parameter"
  | "identity_override_forbidden";

export type McpOAuthAuthorizationRequestBoundarySafeFailureV1 = Readonly<{
  code: "authorization_request_denied";
  message: "Authorization request denied.";
  safeForModel: true;
  sensitiveValuesEchoed: false;
  version: 1;
}>;

export type McpOAuthAuthorizationRequestBoundaryResultV1 = Readonly<
  | {
      kind: "mcp_oauth_authorization_request_boundary_result";
      accepted: true;
      reason: "accepted";
      serverOnly: McpOAuthAuthorizationRequestBoundaryHandoffV1;
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_authorization_request_boundary_result";
      accepted: false;
      reason: McpOAuthAuthorizationRequestBoundaryDenialReasonV1;
      safeFailure: McpOAuthAuthorizationRequestBoundarySafeFailureV1;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthAuthorizationRequestBoundaryHandoffV1 = Readonly<{
  authorizationPage: Readonly<{
    origin: string;
    path: string;
  }>;
  providerForwardRequest: Readonly<{
    responseType: "code";
    clientId: string;
    redirectUri: string;
    resource: string;
    scopes: readonly string[];
    state: string;
    pkce: Readonly<{
      codeChallenge: string;
      codeChallengeMethod: "S256";
    }>;
    approvedOptionalParameters?: Readonly<Partial<Record<McpOAuthAuthorizationOptionalParameterV1, string>>>;
    version: 1;
  }>;
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
  providerValidation: Readonly<{
    status: "pending";
    clientRegistrationValidated: false;
    redirectUriValidatedByProvider: false;
    consentCompleted: false;
    authorizationCodeIssued: false;
    tokenIssued: false;
    stytchSubjectResolved: false;
    accountLinkCreated: false;
    version: 1;
  }>;
  futureIntent: Readonly<{
    kind: "mcp_oauth_authorization_intent_contract";
    storage: "future_short_lived_server_store";
    modelVisible: false;
    version: 1;
  }>;
  loginReturn: Readonly<{
    path: string;
    target: "authorization_page";
    usesClientRedirectUri: false;
    containsOwnerIdentity: false;
    persisted: false;
    version: 1;
  }>;
  modelVisible: false;
  safeForLogging: false;
  version: 1;
}>;

type ParsedConfigV1 = Readonly<{
  authorizationPageOrigin: string;
  authorizationPagePath: string;
  canonicalResource: string;
  allowedRedirectUris: readonly string[];
  approvedOptionalScopes: readonly McpOAuthAuthorizationOptionalScopeV1[];
  allowedOptionalParameters: readonly McpOAuthAuthorizationOptionalParameterV1[];
  maxUrlLength: number;
  maxParameterLength: number;
  maxStateLength: number;
  maxIdTokenHintLength: number;
  clientIdPolicy: Readonly<{
    allowedClientIds: readonly string[];
  }>;
  allowHttpLocalhostAuthorizationOrigin: boolean;
}>;

type ParsedRequestParametersV1 = Readonly<{
  responseType: "code";
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: readonly string[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  approvedOptionalParameters: Readonly<Partial<Record<McpOAuthAuthorizationOptionalParameterV1, string>>>;
  normalizedQuery: string;
}>;

type QueryValuesV1 = ReadonlyMap<string, readonly string[]>;

type RequiredParameterNameV1 = (typeof REQUIRED_PARAMETERS)[number];

type RequiredParametersV1 = Record<RequiredParameterNameV1, string>;

type BoundaryParseFailureV1 = Readonly<{
  ok: false;
  reason: McpOAuthAuthorizationRequestBoundaryDenialReasonV1;
}>;

type BoundaryParseSuccessV1<T> = Readonly<{
  ok: true;
  value: T;
}>;

type BoundaryParseResultV1<T> = BoundaryParseSuccessV1<T> | BoundaryParseFailureV1;

type ConfigUrlPartsV1 = Readonly<{
  authorizationPageOrigin: string;
  authorizationPagePath: string;
  canonicalResource: string;
  allowedRedirectUris: readonly string[];
}>;

type ConfigListPartsV1 = Readonly<{
  approvedOptionalScopes: readonly McpOAuthAuthorizationOptionalScopeV1[];
  allowedOptionalParameters: readonly McpOAuthAuthorizationOptionalParameterV1[];
}>;

type ConfigLimitPartsV1 = Readonly<{
  maxUrlLength: number;
  maxParameterLength: number;
  maxStateLength: number;
  maxIdTokenHintLength: number;
}>;

type ConfigHeaderRecordV1 = Record<string, unknown> & Readonly<{
  allowHttpLocalhostAuthorizationOrigin: boolean;
}>;

const INPUT_KEYS = ["kind", "authorizationUrl", "trustedOwner", "config", "version"] as const;
const OWNER_KEYS = ["kind", "twoweeksClerkId", "version"] as const;
const CONFIG_KEYS = [
  "kind",
  "authorizationPageOrigin",
  "authorizationPagePath",
  "canonicalResource",
  "allowedRedirectUris",
  "requiredScope",
  "approvedOptionalScopes",
  "allowedOptionalParameters",
  "maxUrlLength",
  "maxParameterLength",
  "maxStateLength",
  "maxIdTokenHintLength",
  "clientIdPolicy",
  "localDevelopmentOnly",
  "allowHttpLocalhostAuthorizationOrigin",
  "version",
] as const;
const CLIENT_ID_POLICY_KEYS = ["mode", "allowedClientIds", "version"] as const;
const REQUIRED_PARAMETERS = [
  "response_type",
  "client_id",
  "redirect_uri",
  "scope",
  "state",
  "code_challenge",
  "code_challenge_method",
  "resource",
] as const;
const NORMALIZED_QUERY_ORDER = REQUIRED_PARAMETERS;
const IDENTITY_OVERRIDE_PARAMETERS = new Set([
  "userId",
  "clerkId",
  "twoweeksClerkId",
  "owner",
  "ownerId",
  "workspaceId",
  "email",
]);
const OPTIONAL_PARAMETERS = new Set<McpOAuthAuthorizationOptionalParameterV1>([
  "nonce",
  "prompt",
  "login_hint",
  "id_token_hint",
]);
const PROVIDER_FORWARD_OPTIONAL_QUERY_PARAMETERS: readonly McpOAuthAuthorizationOptionalParameterV1[] = [
  "nonce",
  "prompt",
  "login_hint",
  "id_token_hint",
];
const LOGIN_RETURN_OPTIONAL_QUERY_PARAMETERS: readonly McpOAuthAuthorizationOptionalParameterV1[] = ["nonce", "prompt"];
const OPTIONAL_SCOPE_ORDER: readonly McpOAuthAuthorizationOptionalScopeV1[] = ["openid", "email", "profile"];
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9._:-]{1,256}$/u;
const SAFE_SCOPE_PATTERN = /^[A-Za-z][A-Za-z0-9:._-]{0,127}$/u;
const PKCE_S256_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;

export function parseMcpOAuthAuthorizationRequestBoundary(
  input: unknown,
): McpOAuthAuthorizationRequestBoundaryResultV1 {
  const inputRecord = readExactRecord(input, INPUT_KEYS);
  if (!inputRecord || inputRecord.kind !== "mcp_oauth_authorization_request_boundary_input" || inputRecord.version !== 1) {
    return deny("malformed_input");
  }

  const config = parseConfig(inputRecord.config);
  if (!config) return deny("malformed_config");

  const owner = parseTrustedOwner(inputRecord.trustedOwner);
  if (!owner) return deny("invalid_owner");

  const authorizationUrl = readBoundedText(inputRecord.authorizationUrl, config.maxUrlLength);
  if (!authorizationUrl || hasMalformedPercentEncoding(authorizationUrl)) return deny("malformed_input");

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(authorizationUrl);
  } catch {
    return deny("malformed_input");
  }

  if (parsedUrl.username || parsedUrl.password || parsedUrl.hash) return deny("malformed_input");
  if (parsedUrl.origin !== config.authorizationPageOrigin) return deny("wrong_authorization_origin");
  if (!authorizationProtocolAllowed(parsedUrl, config)) return deny("wrong_authorization_origin");
  if (parsedUrl.pathname !== config.authorizationPagePath) return deny("wrong_authorization_path");

  const queryValues = collectQueryValues(parsedUrl.searchParams);
  const parameters = parseRequestParameters(queryValues, config);
  if (!parameters.ok) return deny(parameters.reason);

  const handoff = buildHandoff(parsedUrl, owner, parameters.value);
  return Object.freeze({
    kind: "mcp_oauth_authorization_request_boundary_result",
    accepted: true,
    reason: "accepted",
    serverOnly: handoff,
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

function parseConfig(value: unknown): ParsedConfigV1 | undefined {
  const record = readExactRecord(value, CONFIG_KEYS);
  if (!isConfigRecordHeader(record)) return undefined;

  const urls = parseConfigUrls(record);
  if (!urls) return undefined;
  const lists = parseConfigLists(record);
  if (!lists) return undefined;
  const limits = parseConfigLimits(record);
  if (!limits) return undefined;
  const clientIdPolicy = parseClientIdPolicy(record.clientIdPolicy);
  if (!clientIdPolicy) return undefined;

  return Object.freeze({
    authorizationPageOrigin: urls.authorizationPageOrigin,
    authorizationPagePath: urls.authorizationPagePath,
    canonicalResource: urls.canonicalResource,
    allowedRedirectUris: Object.freeze([...new Set(urls.allowedRedirectUris)]),
    approvedOptionalScopes: lists.approvedOptionalScopes,
    allowedOptionalParameters: lists.allowedOptionalParameters,
    maxUrlLength: limits.maxUrlLength,
    maxParameterLength: limits.maxParameterLength,
    maxStateLength: limits.maxStateLength,
    maxIdTokenHintLength: limits.maxIdTokenHintLength,
    clientIdPolicy,
    allowHttpLocalhostAuthorizationOrigin: record.allowHttpLocalhostAuthorizationOrigin,
  });
}

function isConfigRecordHeader(record: Record<string, unknown> | undefined): record is ConfigHeaderRecordV1 {
  return (
    record !== undefined &&
    record.kind === "mcp_oauth_authorization_request_boundary_config" &&
    record.requiredScope === TWOWEEKS_APPLICATIONS_READ_SCOPE &&
    record.localDevelopmentOnly === true &&
    typeof record.allowHttpLocalhostAuthorizationOrigin === "boolean" &&
    record.version === 1
  );
}

function parseConfigUrls(record: Record<string, unknown>): ConfigUrlPartsV1 | undefined {
  const authorizationPageOrigin = readAuthorizationOrigin(
    record.authorizationPageOrigin,
    record.allowHttpLocalhostAuthorizationOrigin,
  );
  const authorizationPagePath = readExactPath(record.authorizationPagePath);
  const canonicalResource = readSafeHttpsUrl(record.canonicalResource, "resource");
  const allowedRedirectUris = readSafeHttpsUrlList(record.allowedRedirectUris, "redirect");
  if (!authorizationPageOrigin || !authorizationPagePath || !canonicalResource || !allowedRedirectUris) {
    return undefined;
  }
  return Object.freeze({ authorizationPageOrigin, authorizationPagePath, canonicalResource, allowedRedirectUris });
}

function parseConfigLists(record: Record<string, unknown>): ConfigListPartsV1 | undefined {
  const approvedOptionalScopes = readOptionalScopes(record.approvedOptionalScopes);
  const allowedOptionalParameters = readOptionalParameters(record.allowedOptionalParameters);
  if (!approvedOptionalScopes || !allowedOptionalParameters) return undefined;
  return Object.freeze({ approvedOptionalScopes, allowedOptionalParameters });
}

function parseConfigLimits(record: Record<string, unknown>): ConfigLimitPartsV1 | undefined {
  const maxUrlLength = readPositiveInteger(record.maxUrlLength);
  const maxParameterLength = readPositiveInteger(record.maxParameterLength);
  const maxStateLength = readPositiveInteger(record.maxStateLength);
  const maxIdTokenHintLength = readPositiveInteger(record.maxIdTokenHintLength);
  if (
    maxUrlLength === undefined ||
    maxParameterLength === undefined ||
    maxStateLength === undefined ||
    maxIdTokenHintLength === undefined
  ) {
    return undefined;
  }
  return Object.freeze({ maxUrlLength, maxParameterLength, maxStateLength, maxIdTokenHintLength });
}

function parseClientIdPolicy(value: unknown): ParsedConfigV1["clientIdPolicy"] | undefined {
  const record = readExactRecord(value, CLIENT_ID_POLICY_KEYS);
  if (!record || record.mode !== "predefined_allowlist" || record.version !== 1) return undefined;
  const allowedClientIds = readStringList(record.allowedClientIds);
  if (!allowedClientIds || allowedClientIds.length === 0 || !allowedClientIds.every(isSafeIdentifier)) {
    return undefined;
  }
  return Object.freeze({
    allowedClientIds: Object.freeze([...new Set(allowedClientIds)]),
  });
}

function parseTrustedOwner(value: unknown): McpOAuthAuthorizationTrustedOwnerV1 | undefined {
  const record = readExactRecord(value, OWNER_KEYS);
  if (!record || record.kind !== "mcp_oauth_authorization_trusted_owner" || record.version !== 1) {
    return undefined;
  }
  const twoweeksClerkId = readNonEmptyString(record.twoweeksClerkId);
  if (!twoweeksClerkId || !isSafeIdentifier(twoweeksClerkId)) return undefined;
  return Object.freeze({
    kind: "mcp_oauth_authorization_trusted_owner",
    twoweeksClerkId,
    version: 1,
  });
}

function parseRequestParameters(
  queryValues: QueryValuesV1,
  config: ParsedConfigV1,
): BoundaryParseResultV1<ParsedRequestParametersV1> {
  const envelope = validateQueryParameterEnvelope(queryValues, config);
  if (!envelope.ok) return envelope;

  const required = readRequiredParameters(queryValues);
  if (!required.ok) return required;

  const requiredParameters = validateRequiredParameterValues(required.value, config);
  if (!requiredParameters.ok) return requiredParameters;

  const scopes = parseScopes(required.value.scope, config.approvedOptionalScopes);
  if (!scopes.ok) return scopes;

  const optional = readApprovedOptionalParameters(queryValues, config);
  if (!optional.ok) return optional;

  const normalizedQuery = buildNormalizedQuery(required.value, scopes.value, optional.value);

  return {
    ok: true,
    value: Object.freeze({
      responseType: "code",
      clientId: required.value.client_id,
      redirectUri: required.value.redirect_uri,
      resource: required.value.resource,
      scopes: scopes.value,
      state: required.value.state,
      codeChallenge: required.value.code_challenge,
      codeChallengeMethod: "S256",
      approvedOptionalParameters: optional.value,
      normalizedQuery,
    }),
  };
}

function validateQueryParameterEnvelope(
  queryValues: QueryValuesV1,
  config: ParsedConfigV1,
): BoundaryParseResultV1<undefined> {
  for (const [key, values] of queryValues.entries()) {
    if (IDENTITY_OVERRIDE_PARAMETERS.has(key)) return { ok: false, reason: "identity_override_forbidden" };
    if (values.length > 1) return { ok: false, reason: "duplicate_parameter" };
    if (!isKnownParameter(key, config.allowedOptionalParameters)) {
      return { ok: false, reason: "unsupported_parameter" };
    }
    const value = values[0];
    if (
      value === "" &&
      REQUIRED_PARAMETERS.includes(key as (typeof REQUIRED_PARAMETERS)[number])
    ) {
      return { ok: false, reason: "missing_parameter" };
    }
    const boundedValue = readBoundedEnvelopeValue(key, value, config);
    if (!boundedValue.ok) return boundedValue;
  }
  return { ok: true, value: undefined };
}

function readBoundedEnvelopeValue(
  key: string,
  value: string | undefined,
  config: ParsedConfigV1,
): BoundaryParseResultV1<undefined> {
  if (value === undefined) return { ok: false, reason: "malformed_input" };
  if (key === "state") return readBoundedStateValue(value, config);
  if (key === "id_token_hint") return readBoundedOptionalValue(value, config.maxIdTokenHintLength);
  return readBoundedOptionalValue(value, config.maxParameterLength);
}

function readBoundedStateValue(value: string, config: ParsedConfigV1): BoundaryParseResultV1<undefined> {
  return readBoundedText(value, config.maxStateLength)
    ? { ok: true, value: undefined }
    : { ok: false, reason: "invalid_state" };
}

function readBoundedOptionalValue(value: string, maxLength: number): BoundaryParseResultV1<undefined> {
  return readBoundedText(value, maxLength)
    ? { ok: true, value: undefined }
    : { ok: false, reason: "malformed_input" };
}

function validateRequiredParameterValues(
  required: RequiredParametersV1,
  config: ParsedConfigV1,
): BoundaryParseResultV1<undefined> {
  const protocolParameters = validateProtocolParameters(required);
  if (!protocolParameters.ok) return protocolParameters;
  const bindingParameters = validateBindingParameters(required, config);
  if (!bindingParameters.ok) return bindingParameters;
  return { ok: true, value: undefined };
}

function validateProtocolParameters(required: RequiredParametersV1): BoundaryParseResultV1<undefined> {
  if (required.response_type !== "code") return { ok: false, reason: "unsupported_response_type" };
  if (required.code_challenge_method !== "S256") return { ok: false, reason: "invalid_pkce" };
  if (!PKCE_S256_CHALLENGE_PATTERN.test(required.code_challenge)) {
    return { ok: false, reason: "invalid_pkce" };
  }
  return { ok: true, value: undefined };
}

function validateBindingParameters(
  required: RequiredParametersV1,
  config: ParsedConfigV1,
): BoundaryParseResultV1<undefined> {
  if (!readBoundedText(required.state, config.maxStateLength)) return { ok: false, reason: "invalid_state" };
  if (!config.clientIdPolicy.allowedClientIds.includes(required.client_id)) {
    return { ok: false, reason: "invalid_client_id" };
  }
  if (!isAllowedRedirectUri(required.redirect_uri, config)) {
    return { ok: false, reason: "unapproved_redirect_uri" };
  }
  if (required.resource !== config.canonicalResource) return { ok: false, reason: "wrong_resource" };
  return { ok: true, value: undefined };
}

function isAllowedRedirectUri(redirectUri: string, config: ParsedConfigV1): boolean {
  return config.allowedRedirectUris.includes(redirectUri) && readSafeHttpsUrl(redirectUri, "redirect") !== undefined;
}

function readRequiredParameters(
  queryValues: QueryValuesV1,
): BoundaryParseResultV1<RequiredParametersV1> {
  const collected = collectRequiredParameterValues(queryValues);
  if (!collected.ok) return collected;

  return {
    ok: true,
    value: requiredParameterRecordFromMap(collected.value),
  };
}

function collectRequiredParameterValues(
  queryValues: QueryValuesV1,
): BoundaryParseResultV1<ReadonlyMap<RequiredParameterNameV1, string>> {
  const collected = new Map<RequiredParameterNameV1, string>();
  for (const parameter of REQUIRED_PARAMETERS) {
    const result = readRequiredParameterValue(queryValues, parameter);
    if (!result.ok) return result;
    collected.set(parameter, result.value);
  }
  return { ok: true, value: collected };
}

function readRequiredParameterValue(
  queryValues: QueryValuesV1,
  parameter: RequiredParameterNameV1,
): BoundaryParseResultV1<string> {
  const values = queryValues.get(parameter);
  if (!values || values.length === 0) return { ok: false, reason: "missing_parameter" };
  if (values.length > 1) return { ok: false, reason: "duplicate_parameter" };
  const value = values[0];
  if (value === undefined || value.length === 0) return { ok: false, reason: "missing_parameter" };
  return { ok: true, value };
}

function requiredParameterRecordFromMap(values: ReadonlyMap<RequiredParameterNameV1, string>): RequiredParametersV1 {
  return {
    response_type: values.get("response_type") ?? "",
    client_id: values.get("client_id") ?? "",
    redirect_uri: values.get("redirect_uri") ?? "",
    scope: values.get("scope") ?? "",
    state: values.get("state") ?? "",
    code_challenge: values.get("code_challenge") ?? "",
    code_challenge_method: values.get("code_challenge_method") ?? "",
    resource: values.get("resource") ?? "",
  };
}

function parseScopes(
  scopeValue: string,
  approvedOptionalScopes: readonly McpOAuthAuthorizationOptionalScopeV1[],
): BoundaryParseResultV1<readonly string[]> {
  const rawScopes = scopeValue.split(" ");
  const rawValidation = validateRawScopes(rawScopes);
  if (!rawValidation.ok) return rawValidation;

  const scopeSet = buildScopeSet(rawScopes);
  if (!scopeSet.ok) return scopeSet;
  const policyValidation = validateScopePolicy(scopeSet.value, approvedOptionalScopes);
  if (!policyValidation.ok) return policyValidation;

  return {
    ok: true,
    value: Object.freeze([
      TWOWEEKS_APPLICATIONS_READ_SCOPE,
      ...OPTIONAL_SCOPE_ORDER.filter((scope) => scopeSet.value.has(scope)),
    ]),
  };
}

function validateRawScopes(rawScopes: readonly string[]): BoundaryParseResultV1<undefined> {
  if (rawScopes.length === 0) return { ok: false, reason: "malformed_scope" };
  if (rawScopes.some((scope) => scope.length === 0)) return { ok: false, reason: "malformed_scope" };
  return { ok: true, value: undefined };
}

function buildScopeSet(rawScopes: readonly string[]): BoundaryParseResultV1<ReadonlySet<string>> {
  const seen = new Set<string>();
  for (const scope of rawScopes) {
    if (seen.has(scope)) return { ok: false, reason: "duplicate_scope" };
    seen.add(scope);
    if (scope.startsWith("twoweeks.")) return { ok: false, reason: "legacy_scope" };
    if (!SAFE_SCOPE_PATTERN.test(scope)) return { ok: false, reason: "malformed_scope" };
  }
  return { ok: true, value: seen };
}

function validateScopePolicy(
  seen: ReadonlySet<string>,
  approvedOptionalScopes: readonly McpOAuthAuthorizationOptionalScopeV1[],
): BoundaryParseResultV1<undefined> {
  if (!seen.has(TWOWEEKS_APPLICATIONS_READ_SCOPE)) {
    return { ok: false, reason: "missing_canonical_scope" };
  }

  for (const scope of seen) {
    if (scope === TWOWEEKS_APPLICATIONS_READ_SCOPE) continue;
    if (!approvedOptionalScopes.includes(scope as McpOAuthAuthorizationOptionalScopeV1)) {
      return { ok: false, reason: "unapproved_scope" };
    }
  }
  return { ok: true, value: undefined };
}

function readApprovedOptionalParameters(
  queryValues: QueryValuesV1,
  config: ParsedConfigV1,
):
  | { ok: true; value: Readonly<Partial<Record<McpOAuthAuthorizationOptionalParameterV1, string>>> }
  | { ok: false; reason: "duplicate_parameter" | "unsupported_parameter" | "malformed_input" } {
  const approved: Partial<Record<McpOAuthAuthorizationOptionalParameterV1, string>> = {};

  for (const parameter of config.allowedOptionalParameters) {
    const values = queryValues.get(parameter);
    if (!values || values.length === 0) continue;
    if (values.length > 1) return { ok: false, reason: "duplicate_parameter" };
    const value = values[0];
    if (value === undefined || value.length === 0) return { ok: false, reason: "unsupported_parameter" };
    const maximumLength = parameter === "id_token_hint" ? config.maxIdTokenHintLength : config.maxParameterLength;
    if (!readBoundedText(value, maximumLength)) return { ok: false, reason: "malformed_input" };
    approved[parameter] = value;
  }

  return { ok: true, value: Object.freeze(approved) };
}

function buildHandoff(
  parsedUrl: URL,
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1,
  request: ParsedRequestParametersV1,
): McpOAuthAuthorizationRequestBoundaryHandoffV1 {
  const optionalParameters = Object.keys(request.approvedOptionalParameters).length > 0
    ? { approvedOptionalParameters: request.approvedOptionalParameters }
    : {};

  return Object.freeze({
    authorizationPage: Object.freeze({
      origin: parsedUrl.origin,
      path: parsedUrl.pathname,
    }),
    providerForwardRequest: Object.freeze({
      responseType: request.responseType,
      clientId: request.clientId,
      redirectUri: request.redirectUri,
      resource: request.resource,
      scopes: request.scopes,
      state: request.state,
      pkce: Object.freeze({
        codeChallenge: request.codeChallenge,
        codeChallengeMethod: request.codeChallengeMethod,
      }),
      ...optionalParameters,
      version: 1,
    }),
    trustedOwner,
    providerValidation: Object.freeze({
      status: "pending",
      clientRegistrationValidated: false,
      redirectUriValidatedByProvider: false,
      consentCompleted: false,
      authorizationCodeIssued: false,
      tokenIssued: false,
      stytchSubjectResolved: false,
      accountLinkCreated: false,
      version: 1,
    }),
    futureIntent: Object.freeze({
      kind: "mcp_oauth_authorization_intent_contract",
      storage: "future_short_lived_server_store",
      modelVisible: false,
      version: 1,
    }),
    loginReturn: Object.freeze({
      path: `${parsedUrl.pathname}?${buildLoginReturnQuery(request)}`,
      target: "authorization_page",
      usesClientRedirectUri: false,
      containsOwnerIdentity: false,
      persisted: false,
      version: 1,
    }),
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

function buildNormalizedQuery(
  required: RequiredParametersV1,
  scopes: readonly string[],
  optional: Readonly<Partial<Record<McpOAuthAuthorizationOptionalParameterV1, string>>>,
  optionalQueryParameters: readonly McpOAuthAuthorizationOptionalParameterV1[] = PROVIDER_FORWARD_OPTIONAL_QUERY_PARAMETERS,
): string {
  const query = new URLSearchParams();
  for (const parameter of NORMALIZED_QUERY_ORDER) {
    const value = parameter === "scope" ? scopes.join(" ") : required[parameter];
    query.append(parameter, value);
  }
  for (const parameter of optionalQueryParameters) {
    const value = optional[parameter];
    if (value !== undefined) query.append(parameter, value);
  }
  return query.toString();
}

function buildLoginReturnQuery(request: ParsedRequestParametersV1): string {
  return buildNormalizedQuery(
    {
      response_type: request.responseType,
      client_id: request.clientId,
      redirect_uri: request.redirectUri,
      scope: request.scopes.join(" "),
      state: request.state,
      code_challenge: request.codeChallenge,
      code_challenge_method: request.codeChallengeMethod,
      resource: request.resource,
    },
    request.scopes,
    request.approvedOptionalParameters,
    LOGIN_RETURN_OPTIONAL_QUERY_PARAMETERS,
  );
}

function collectQueryValues(searchParams: URLSearchParams): QueryValuesV1 {
  const collected = new Map<string, string[]>();
  searchParams.forEach((value, key) => {
    const existing = collected.get(key);
    if (existing) {
      existing.push(value);
    } else {
      collected.set(key, [value]);
    }
  });
  return collected;
}

function isKnownParameter(
  key: string,
  allowedOptionalParameters: readonly McpOAuthAuthorizationOptionalParameterV1[],
): boolean {
  return (
    REQUIRED_PARAMETERS.includes(key as (typeof REQUIRED_PARAMETERS)[number]) ||
    (OPTIONAL_PARAMETERS.has(key as McpOAuthAuthorizationOptionalParameterV1) &&
      allowedOptionalParameters.includes(key as McpOAuthAuthorizationOptionalParameterV1))
  );
}

function readAuthorizationOrigin(value: unknown, allowHttpLocalhost: unknown): string | undefined {
  const parsed = readUrlFromText(value);
  if (!parsed || !isOriginOnlyUrl(parsed)) return undefined;
  return readAllowedAuthorizationOrigin(parsed, allowHttpLocalhost);
}

function readExactPath(value: unknown): string | undefined {
  const path = readNonEmptyString(value);
  if (!path || !path.startsWith("/") || path.startsWith("//") || containsControlCharacters(path)) return undefined;
  if (path.includes("?") || path.includes("#")) return undefined;
  return path;
}

function readSafeHttpsUrl(value: unknown, kind: "redirect" | "resource"): string | undefined {
  const parsed = readSafeUrlFromText(value);
  if (!parsed || !isSafeHttpsUrl(parsed)) return undefined;
  if (kind === "resource" && parsed.search) return undefined;
  return parsed.toString();
}

function readSafeHttpsUrlList(value: unknown, kind: "redirect" | "resource"): readonly string[] | undefined {
  const values = readStringList(value);
  if (!values) return undefined;
  const parsed = values.map((uri) => readSafeHttpsUrl(uri, kind));
  if (parsed.length === 0 || parsed.some((uri) => uri === undefined)) return undefined;
  return Object.freeze(parsed.filter((uri): uri is string => uri !== undefined));
}

function authorizationProtocolAllowed(parsedUrl: URL, config: ParsedConfigV1): boolean {
  if (parsedUrl.protocol === "https:") return true;
  return (
    config.allowHttpLocalhostAuthorizationOrigin &&
    parsedUrl.protocol === "http:" &&
    isLocalhost(parsedUrl.hostname)
  );
}

function readUrlFromText(value: unknown): URL | undefined {
  const text = readNonEmptyString(value);
  if (!text) return undefined;
  return parseUrl(text);
}

function readSafeUrlFromText(value: unknown): URL | undefined {
  const text = readNonEmptyString(value);
  if (!text || containsControlCharacters(text) || hasMalformedPercentEncoding(text)) return undefined;
  return parseUrl(text);
}

function parseUrl(text: string): URL | undefined {
  try {
    return new URL(text);
  } catch {
    return undefined;
  }
}

function isOriginOnlyUrl(parsed: URL): boolean {
  return !parsed.username && !parsed.password && parsed.pathname === "/" && !parsed.search && !parsed.hash;
}

function readAllowedAuthorizationOrigin(parsed: URL, allowHttpLocalhost: unknown): string | undefined {
  if (parsed.protocol === "https:") return parsed.origin;
  if (allowHttpLocalhost !== true) return undefined;
  return parsed.protocol === "http:" && isLocalhost(parsed.hostname) ? parsed.origin : undefined;
}

function isSafeHttpsUrl(parsed: URL): boolean {
  return parsed.protocol === "https:" && !parsed.username && !parsed.password && !parsed.hash;
}

function hasMalformedPercentEncoding(value: string): boolean {
  if (/%(?![0-9A-Fa-f]{2})/u.test(value)) return true;
  for (const component of value.split(/[&=]/u)) {
    try {
      decodeURIComponent(component.replace(/\+/gu, " "));
    } catch {
      return true;
    }
  }
  return false;
}

function readOptionalScopes(value: unknown): readonly McpOAuthAuthorizationOptionalScopeV1[] | undefined {
  const scopes = readStringList(value);
  if (!scopes) return undefined;
  const parsed: McpOAuthAuthorizationOptionalScopeV1[] = [];
  for (const scope of scopes) {
    if (!OPTIONAL_SCOPE_ORDER.includes(scope as McpOAuthAuthorizationOptionalScopeV1)) return undefined;
    parsed.push(scope as McpOAuthAuthorizationOptionalScopeV1);
  }
  return Object.freeze([...new Set(parsed)]);
}

function readOptionalParameters(value: unknown): readonly McpOAuthAuthorizationOptionalParameterV1[] | undefined {
  const parameters = readStringList(value);
  if (!parameters) return undefined;
  const parsed: McpOAuthAuthorizationOptionalParameterV1[] = [];
  for (const parameter of parameters) {
    if (!OPTIONAL_PARAMETERS.has(parameter as McpOAuthAuthorizationOptionalParameterV1)) return undefined;
    parsed.push(parameter as McpOAuthAuthorizationOptionalParameterV1);
  }
  return Object.freeze([...new Set(parsed)]);
}

function readStringList(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.map(readNonEmptyString);
  return strings.every((item): item is string => item !== undefined) ? Object.freeze(strings) : undefined;
}

function readBoundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return undefined;
  return containsControlCharacters(value) ? undefined : value;
}

function readNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0 ? value : undefined;
}

function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : undefined;
}

function isSafeIdentifier(value: string): boolean {
  return SAFE_IDENTIFIER_PATTERN.test(value) && !value.includes("*");
}

function containsControlCharacters(value: string): boolean {
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function isLocalhost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1" || normalized === "::1" || normalized === "[::1]";
}

function readExactRecord(value: unknown, allowedKeys: readonly string[]): Record<string, unknown> | undefined {
  if (!isPlainRecordObject(value)) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const actualKeys = Reflect.ownKeys(descriptors);
  if (actualKeys.length !== allowedKeys.length) return undefined;
  return readRecordValues(descriptors, actualKeys, allowedKeys);
}

function isPlainRecordObject(value: unknown): value is object {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function readRecordValues(
  descriptors: PropertyDescriptorMap,
  actualKeys: readonly PropertyKey[],
  allowedKeys: readonly string[],
): Record<string, unknown> | undefined {
  const record: Record<string, unknown> = {};
  for (const key of actualKeys) {
    const entry = readRecordEntry(descriptors, key, allowedKeys);
    if (!entry) return undefined;
    record[entry.key] = entry.value;
  }
  return record;
}

function readRecordEntry(
  descriptors: PropertyDescriptorMap,
  key: PropertyKey,
  allowedKeys: readonly string[],
): Readonly<{ key: string; value: unknown }> | undefined {
  if (typeof key !== "string" || !allowedKeys.includes(key)) return undefined;
  const descriptor = descriptors[key];
  if (!isEnumerableValueDescriptor(descriptor)) return undefined;
  return { key, value: descriptor.value };
}

function isEnumerableValueDescriptor(
  descriptor: PropertyDescriptor | undefined,
): descriptor is PropertyDescriptor & Readonly<{ value: unknown }> {
  return descriptor !== undefined && descriptor.enumerable === true && "value" in descriptor;
}

function deny(
  reason: McpOAuthAuthorizationRequestBoundaryDenialReasonV1,
): McpOAuthAuthorizationRequestBoundaryResultV1 {
  return Object.freeze({
    kind: "mcp_oauth_authorization_request_boundary_result",
    accepted: false,
    reason,
    safeFailure: Object.freeze({
      code: "authorization_request_denied",
      message: "Authorization request denied.",
      safeForModel: true,
      sensitiveValuesEchoed: false,
      version: 1,
    }),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}
