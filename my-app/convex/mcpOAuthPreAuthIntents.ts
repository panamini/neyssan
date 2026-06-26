import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type { McpOAuthPreAuthAuthorizationRequestProjectionV1 } from "../src/modules/local-mcp/mcpOAuthAuthorizationRequestBoundary";

export const MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS = 10 * 60 * 1_000;
export const MCP_OAUTH_PRE_AUTH_INTENT_MIN_TTL_MS = 60 * 1_000;
export const MCP_OAUTH_PRE_AUTH_INTENT_MAX_TTL_MS = 15 * 60 * 1_000;
const MAX_EXPIRED_PRE_AUTH_INTENT_CLEANUP_BATCH = 100;

const TWOWEEKS_APPLICATIONS_READ_SCOPE = "twoweeks:applications:read" as const;
const PRE_AUTH_HANDLE_HASH_PATTERN = /^[0-9a-f]{64}$/u;
const PKCE_S256_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const SAFE_SCOPE_PATTERN = /^[A-Za-z][A-Za-z0-9:._-]{0,127}$/u;
const MAX_SAFE_TIMESTAMP_BEFORE_TTL = Number.MAX_SAFE_INTEGER - MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS;
const MAX_OAUTH_PARAMETER_LENGTH = 512;
const MAX_AUTHORIZATION_PAGE_PATH_LENGTH = 256;
const MAX_STATE_LENGTH = 512;

const CREATE_ARGS_KEYS = ["authorizationRequestProjection", "preAuthHandleHash", "now", "version"] as const;
const CLAIM_ARGS_KEYS = ["preAuthHandleHash", "now", "version"] as const;
const CLEANUP_ARGS_KEYS = ["now", "version"] as const;
const PROJECTION_KEYS = [
  "kind",
  "authorizationPage",
  "providerForwardRequest",
  "providerValidation",
  "preAuthIntent",
  "modelVisible",
  "safeForLogging",
  "version",
] as const;
const AUTHORIZATION_PAGE_KEYS = ["origin", "path"] as const;
const PROVIDER_FORWARD_REQUEST_KEYS = [
  "responseType",
  "clientId",
  "redirectUri",
  "resource",
  "scopes",
  "state",
  "pkce",
  "approvedOptionalParameters",
  "version",
] as const;
const PROVIDER_FORWARD_REQUEST_REQUIRED_KEYS = [
  "responseType",
  "clientId",
  "redirectUri",
  "resource",
  "scopes",
  "state",
  "pkce",
  "version",
] as const;
const PKCE_KEYS = ["codeChallenge", "codeChallengeMethod"] as const;
const PROVIDER_VALIDATION_KEYS = [
  "status",
  "clientRegistrationValidated",
  "redirectUriValidatedByProvider",
  "consentCompleted",
  "authorizationCodeIssued",
  "tokenIssued",
  "stytchSubjectResolved",
  "accountLinkCreated",
  "version",
] as const;
const PRE_AUTH_INTENT_KEYS = [
  "status",
  "containsOwnerIdentity",
  "containsProviderSubject",
  "containsAccountLinkId",
  "authorizationGranted",
  "consentCompleted",
  "authorizationCodeIssued",
  "tokenIssued",
  "accountLinkCreated",
  "modelVisible",
  "version",
] as const;
const STORAGE_OPTIONAL_PARAMETER_KEYS = ["nonce", "prompt"] as const;
const SENSITIVE_OPTIONAL_PARAMETER_KEYS = ["login_hint", "id_token_hint"] as const;
const PROVIDER_FORWARD_OPTIONAL_PARAMETER_KEYS = [
  ...STORAGE_OPTIONAL_PARAMETER_KEYS,
  ...SENSITIVE_OPTIONAL_PARAMETER_KEYS,
] as const;
const STORAGE_RECORD_KEYS = [
  "kind",
  "version",
  "preAuthHandleHash",
  "authorizationPageOrigin",
  "authorizationPagePath",
  "responseType",
  "clientId",
  "redirectUri",
  "resource",
  "scopes",
  "state",
  "codeChallenge",
  "codeChallengeMethod",
  "approvedOptionalParameters",
  "providerValidationStatus",
  "status",
  "createdAt",
  "updatedAt",
  "expiresAt",
  "claimedAt",
  "storageVersion",
  "_id",
  "_creationTime",
] as const;
const STORAGE_RECORD_REQUIRED_KEYS = [
  "kind",
  "version",
  "preAuthHandleHash",
  "authorizationPageOrigin",
  "authorizationPagePath",
  "responseType",
  "clientId",
  "redirectUri",
  "resource",
  "scopes",
  "state",
  "codeChallenge",
  "codeChallengeMethod",
  "providerValidationStatus",
  "status",
  "createdAt",
  "updatedAt",
  "expiresAt",
  "storageVersion",
] as const;

type ApprovedOptionalParameterKeyV1 = (typeof STORAGE_OPTIONAL_PARAMETER_KEYS)[number];

export type McpOAuthPreAuthIntentStatusV1 = "pre_auth_pending" | "claimed" | "expired";

export type McpOAuthPreAuthIntentStorageReasonV1 =
  | "created"
  | "claimed"
  | "invalid_input"
  | "invalid_handle_hash"
  | "handle_collision"
  | "not_found_or_forbidden"
  | "malformed_storage_record"
  | "expired"
  | "already_claimed"
  | "duplicate_storage_record";

export type McpOAuthPreAuthIntentRecordV1 = Readonly<{
  kind: "mcp_oauth_pre_auth_intent_record";
  version: 1;
  preAuthHandleHash: string;
  authorizationPageOrigin: string;
  authorizationPagePath: string;
  responseType: "code";
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  approvedOptionalParameters?: Readonly<Partial<Record<ApprovedOptionalParameterKeyV1, string>>>;
  providerValidationStatus: "pending";
  status: McpOAuthPreAuthIntentStatusV1;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  claimedAt?: number;
  storageVersion: 1;
}>;

type StoredMcpOAuthPreAuthIntentRecordV1 = McpOAuthPreAuthIntentRecordV1 &
  Readonly<{
    _id?: unknown;
    _creationTime?: number;
  }>;

type ParsedProviderForwardRequestV1 = Readonly<{
  responseType: "code";
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: readonly string[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  approvedOptionalParameters?: Readonly<Partial<Record<ApprovedOptionalParameterKeyV1, string>>>;
}>;

type ParsedPreAuthProjectionV1 = Readonly<{
  authorizationPageOrigin: string;
  authorizationPagePath: string;
  providerForwardRequest: ParsedProviderForwardRequestV1;
}>;

export type McpOAuthPreAuthIntentCreateResultV1 = Readonly<
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
      reason: Exclude<McpOAuthPreAuthIntentStorageReasonV1, "created" | "claimed">;
      safeFailure: SafePreAuthIntentFailureV1;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthPreAuthIntentClaimResultV1 = Readonly<
  | {
      kind: "mcp_oauth_pre_auth_intent_claim_result";
      ok: true;
      reason: "claimed";
      serverOnly: {
        authorizationRequestProjection: McpOAuthPreAuthAuthorizationRequestProjectionV1;
        status: "claimed";
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_pre_auth_intent_claim_result";
      ok: false;
      reason: Exclude<McpOAuthPreAuthIntentStorageReasonV1, "created" | "claimed" | "handle_collision">;
      safeFailure: SafePreAuthIntentFailureV1;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthPreAuthIntentCleanupResultV1 = Readonly<{
  kind: "mcp_oauth_pre_auth_intent_cleanup_result";
  ok: true;
  deletedCount: number;
  modelVisible: false;
  safeForLogging: true;
  version: 1;
}>;

type SafePreAuthIntentFailureV1 = Readonly<{
  code: "mcp_oauth_pre_auth_intent_denied";
  message: "Pre-auth intent denied.";
  safeForModel: true;
  sensitiveValuesEchoed: false;
  version: 1;
}>;

export type McpOAuthPreAuthIntentStorageClassificationV1 =
  | "pre_auth_pending_valid"
  | "claimed_valid"
  | "expired_valid"
  | "malformed";

export const internalCreateMcpOAuthPreAuthIntent = internalMutation({
  args: {
    authorizationRequestProjection: v.any(),
    preAuthHandleHash: v.string(),
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthPreAuthIntentCreateResultV1> => {
    if (!readRecord(args, CREATE_ARGS_KEYS)) return denyCreate("invalid_input");
    if (!isValidStorageTimestamp(args.now) || args.now > MAX_SAFE_TIMESTAMP_BEFORE_TTL) {
      return denyCreate("invalid_input");
    }
    if (!isValidPreAuthHandleHash(args.preAuthHandleHash)) return denyCreate("invalid_handle_hash");

    const projection = parsePreAuthProjection(args.authorizationRequestProjection);
    if (!projection.ok) return denyCreate(projection.reason);

    const existingRows = await ctx.db
      .query("mcpOAuthPreAuthIntents")
      .withIndex("by_pre_auth_handle_hash", (q) => q.eq("preAuthHandleHash", args.preAuthHandleHash))
      .collect();
    if (existingRows.length > 0) return denyCreate("handle_collision");

    const record = buildPreAuthIntentRecord(args.preAuthHandleHash, projection.value, args.now);
    await ctx.db.insert("mcpOAuthPreAuthIntents", record);

    return {
      kind: "mcp_oauth_pre_auth_intent_create_result",
      ok: true,
      reason: "created",
      serverOnly: {
        status: "pre_auth_pending",
        expiresAt: record.expiresAt,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    };
  },
});

export const internalClaimMcpOAuthPreAuthIntent = internalMutation({
  args: {
    preAuthHandleHash: v.string(),
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthPreAuthIntentClaimResultV1> => {
    if (!readRecord(args, CLAIM_ARGS_KEYS) || !isValidStorageTimestamp(args.now)) {
      return denyClaim("invalid_input");
    }
    if (!isValidPreAuthHandleHash(args.preAuthHandleHash)) return denyClaim("invalid_handle_hash");

    const rows = await ctx.db
      .query("mcpOAuthPreAuthIntents")
      .withIndex("by_pre_auth_handle_hash", (q) => q.eq("preAuthHandleHash", args.preAuthHandleHash))
      .collect();
    if (rows.length === 0) return denyClaim("not_found_or_forbidden");
    if (rows.length > 1) return denyClaim("duplicate_storage_record");

    const row = rows[0] as StoredMcpOAuthPreAuthIntentRecordV1;
    const parsedRow = parseStorageRecord(row);
    if (!parsedRow) return denyClaim("malformed_storage_record");
    if (parsedRow.status === "claimed") return denyClaim("already_claimed");
    if (parsedRow.status === "expired") return denyClaim("expired");
    if (args.now < parsedRow.createdAt) return denyClaim("invalid_input");
    if (args.now >= parsedRow.expiresAt) {
      await ctx.db.patch(parsedRow._id as never, {
        status: "expired",
        updatedAt: args.now,
      });
      return denyClaim("expired");
    }

    const projection = buildPreAuthProjection(parsedRow);
    await ctx.db.patch(parsedRow._id as never, {
      status: "claimed",
      updatedAt: args.now,
      claimedAt: args.now,
    });

    return {
      kind: "mcp_oauth_pre_auth_intent_claim_result",
      ok: true,
      reason: "claimed",
      serverOnly: {
        authorizationRequestProjection: projection,
        status: "claimed",
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    };
  },
});

export const internalDeleteExpiredMcpOAuthPreAuthIntents = internalMutation({
  args: {
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthPreAuthIntentCleanupResultV1> => {
    if (!readRecord(args, CLEANUP_ARGS_KEYS) || !isValidStorageTimestamp(args.now)) {
      return cleanupResult(0);
    }

    const expiredRows = await ctx.db
      .query("mcpOAuthPreAuthIntents")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", args.now))
      .take(MAX_EXPIRED_PRE_AUTH_INTENT_CLEANUP_BATCH);

    for (const row of expiredRows) {
      await ctx.db.delete(row._id);
    }

    return cleanupResult(expiredRows.length);
  },
});

export function classifyMcpOAuthPreAuthIntentStorageRecord(
  value: unknown,
): McpOAuthPreAuthIntentStorageClassificationV1 {
  const record = parseStorageRecord(value);
  if (!record) return "malformed";
  if (record.status === "pre_auth_pending") return "pre_auth_pending_valid";
  if (record.status === "claimed") return "claimed_valid";
  return "expired_valid";
}

function buildPreAuthIntentRecord(
  preAuthHandleHash: string,
  projection: ParsedPreAuthProjectionV1,
  now: number,
): McpOAuthPreAuthIntentRecordV1 {
  const optionalParameters = projection.providerForwardRequest.approvedOptionalParameters;
  return {
    kind: "mcp_oauth_pre_auth_intent_record",
    version: 1,
    preAuthHandleHash,
    authorizationPageOrigin: projection.authorizationPageOrigin,
    authorizationPagePath: projection.authorizationPagePath,
    responseType: "code",
    clientId: projection.providerForwardRequest.clientId,
    redirectUri: projection.providerForwardRequest.redirectUri,
    resource: projection.providerForwardRequest.resource,
    scopes: [...projection.providerForwardRequest.scopes],
    state: projection.providerForwardRequest.state,
    codeChallenge: projection.providerForwardRequest.codeChallenge,
    codeChallengeMethod: "S256",
    ...(optionalParameters ? { approvedOptionalParameters: optionalParameters } : {}),
    providerValidationStatus: "pending",
    status: "pre_auth_pending",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS,
    storageVersion: 1,
  };
}

function parsePreAuthProjection(
  value: unknown,
):
  | { ok: true; value: ParsedPreAuthProjectionV1 }
  | { ok: false; reason: Extract<McpOAuthPreAuthIntentStorageReasonV1, "invalid_input"> } {
  const projection = readRecord(value, PROJECTION_KEYS);
  if (
    !projection ||
    projection.kind !== "mcp_oauth_pre_auth_authorization_request_projection" ||
    projection.modelVisible !== false ||
    projection.safeForLogging !== false ||
    projection.version !== 1
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const authorizationPage = parseAuthorizationPage(projection.authorizationPage);
  const providerForwardRequest = parseProviderForwardRequest(projection.providerForwardRequest);
  if (!authorizationPage) return { ok: false, reason: "invalid_input" };
  if (!providerForwardRequest.ok) return providerForwardRequest;
  if (!hasPendingProviderValidation(projection.providerValidation)) return { ok: false, reason: "invalid_input" };
  if (!hasExpectedPreAuthIntent(projection.preAuthIntent)) return { ok: false, reason: "invalid_input" };

  return {
    ok: true,
    value: {
      authorizationPageOrigin: authorizationPage.origin,
      authorizationPagePath: authorizationPage.path,
      providerForwardRequest: providerForwardRequest.value,
    },
  };
}

function parseAuthorizationPage(value: unknown): { origin: string; path: string } | undefined {
  const record = readRecord(value, AUTHORIZATION_PAGE_KEYS);
  if (!record) return undefined;
  const origin = readAuthorizationOrigin(record.origin);
  const path = readAuthorizationPagePath(record.path);
  return origin && path ? { origin, path } : undefined;
}

function parseProviderForwardRequest(
  value: unknown,
):
  | { ok: true; value: ParsedProviderForwardRequestV1 }
  | { ok: false; reason: Extract<McpOAuthPreAuthIntentStorageReasonV1, "invalid_input"> } {
  const record = readRecord(value, PROVIDER_FORWARD_REQUEST_KEYS, PROVIDER_FORWARD_REQUEST_REQUIRED_KEYS);
  if (!record || record.responseType !== "code" || record.version !== 1) return { ok: false, reason: "invalid_input" };
  const clientId = readBoundedStorageText(record.clientId, MAX_OAUTH_PARAMETER_LENGTH);
  const redirectUri = readSafeHttpsUrl(record.redirectUri, { allowSearch: true });
  const resource = readSafeHttpsUrl(record.resource, { allowSearch: false });
  const scopes = parseScopes(record.scopes);
  const state = readBoundedStorageText(record.state, MAX_STATE_LENGTH);
  const pkce = readRecord(record.pkce, PKCE_KEYS);
  const codeChallenge = pkce ? readBoundedStorageText(pkce.codeChallenge, 128) : undefined;
  if (
    !clientId ||
    !redirectUri ||
    !resource ||
    !scopes ||
    !state ||
    !pkce ||
    !codeChallenge ||
    pkce.codeChallengeMethod !== "S256" ||
    !PKCE_S256_CHALLENGE_PATTERN.test(codeChallenge)
  ) {
    return { ok: false, reason: "invalid_input" };
  }

  const optionalParameters = parseOptionalParameters(record.approvedOptionalParameters);
  if (!optionalParameters.ok) return optionalParameters;

  return {
    ok: true,
    value: {
      responseType: "code",
      clientId,
      redirectUri,
      resource,
      scopes,
      state,
      codeChallenge,
      codeChallengeMethod: "S256",
      ...(optionalParameters.value ? { approvedOptionalParameters: optionalParameters.value } : {}),
    },
  };
}

function parseOptionalParameters(
  value: unknown,
):
  | { ok: true; value?: Readonly<Partial<Record<ApprovedOptionalParameterKeyV1, string>>> }
  | { ok: false; reason: "invalid_input" } {
  if (value === undefined) return { ok: true };
  const record = readRecord(value, PROVIDER_FORWARD_OPTIONAL_PARAMETER_KEYS, []);
  if (!record) return { ok: false, reason: "invalid_input" };
  for (const key of SENSITIVE_OPTIONAL_PARAMETER_KEYS) {
    if (Object.prototype.hasOwnProperty.call(record, key)) return { ok: false, reason: "invalid_input" };
  }
  const parsed: Partial<Record<ApprovedOptionalParameterKeyV1, string>> = {};
  for (const key of STORAGE_OPTIONAL_PARAMETER_KEYS) {
    if (record[key] === undefined) continue;
    const value = readBoundedStorageText(record[key], MAX_OAUTH_PARAMETER_LENGTH);
    if (!value) return { ok: false, reason: "invalid_input" };
    parsed[key] = value;
  }
  return Object.keys(parsed).length > 0 ? { ok: true, value: Object.freeze(parsed) } : { ok: true };
}

function hasPendingProviderValidation(value: unknown): boolean {
  const record = readRecord(value, PROVIDER_VALIDATION_KEYS);
  return (
    record !== undefined &&
    record.status === "pending" &&
    record.clientRegistrationValidated === false &&
    record.redirectUriValidatedByProvider === false &&
    record.consentCompleted === false &&
    record.authorizationCodeIssued === false &&
    record.tokenIssued === false &&
    record.stytchSubjectResolved === false &&
    record.accountLinkCreated === false &&
    record.version === 1
  );
}

function hasExpectedPreAuthIntent(value: unknown): boolean {
  const record = readRecord(value, PRE_AUTH_INTENT_KEYS);
  return (
    record !== undefined &&
    record.status === "pre_auth_pending" &&
    record.containsOwnerIdentity === false &&
    record.containsProviderSubject === false &&
    record.containsAccountLinkId === false &&
    record.authorizationGranted === false &&
    record.consentCompleted === false &&
    record.authorizationCodeIssued === false &&
    record.tokenIssued === false &&
    record.accountLinkCreated === false &&
    record.modelVisible === false &&
    record.version === 1
  );
}

function parseStorageRecord(value: unknown): StoredMcpOAuthPreAuthIntentRecordV1 | undefined {
  const record = readRecord(value, STORAGE_RECORD_KEYS, STORAGE_RECORD_REQUIRED_KEYS);
  if (!record || record.kind !== "mcp_oauth_pre_auth_intent_record" || record.version !== 1) return undefined;
  if (!isValidPreAuthHandleHash(record.preAuthHandleHash)) return undefined;
  const authorizationPageOrigin = readAuthorizationOrigin(record.authorizationPageOrigin);
  const authorizationPagePath = readAuthorizationPagePath(record.authorizationPagePath);
  const clientId = readBoundedStorageText(record.clientId, MAX_OAUTH_PARAMETER_LENGTH);
  const redirectUri = readSafeHttpsUrl(record.redirectUri, { allowSearch: true });
  const resource = readSafeHttpsUrl(record.resource, { allowSearch: false });
  const scopes = parseScopes(record.scopes);
  const state = readBoundedStorageText(record.state, MAX_STATE_LENGTH);
  const codeChallenge = readBoundedStorageText(record.codeChallenge, 128);
  const optionalParameters = parseOptionalParameters(record.approvedOptionalParameters);
  if (
    !authorizationPageOrigin ||
    !authorizationPagePath ||
    record.responseType !== "code" ||
    !clientId ||
    !redirectUri ||
    !resource ||
    !scopes ||
    !state ||
    !codeChallenge ||
    record.codeChallengeMethod !== "S256" ||
    !PKCE_S256_CHALLENGE_PATTERN.test(codeChallenge) ||
    !optionalParameters.ok ||
    record.providerValidationStatus !== "pending" ||
    !isValidStorageStatus(record.status) ||
    !isValidStorageTimestamp(record.createdAt) ||
    !isValidStorageTimestamp(record.updatedAt) ||
    !isValidStorageTimestamp(record.expiresAt) ||
    record.expiresAt - record.createdAt !== MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS ||
    record.storageVersion !== 1 ||
    !hasValidTerminalTimestamp(record)
  ) {
    return undefined;
  }

  return {
    kind: "mcp_oauth_pre_auth_intent_record",
    version: 1,
    preAuthHandleHash: record.preAuthHandleHash,
    authorizationPageOrigin,
    authorizationPagePath,
    responseType: "code",
    clientId,
    redirectUri,
    resource,
    scopes: [...scopes],
    state,
    codeChallenge,
    codeChallengeMethod: "S256",
    ...(optionalParameters.value ? { approvedOptionalParameters: optionalParameters.value } : {}),
    providerValidationStatus: "pending",
    status: record.status,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    ...(typeof record.claimedAt === "number" ? { claimedAt: record.claimedAt } : {}),
    storageVersion: 1,
    ...(record._id !== undefined ? { _id: record._id } : {}),
    ...(typeof record._creationTime === "number" ? { _creationTime: record._creationTime } : {}),
  };
}

function hasValidTerminalTimestamp(record: Record<string, unknown>): boolean {
  if (record.status === "pre_auth_pending" || record.status === "expired") return record.claimedAt === undefined;
  return (
    record.status === "claimed" &&
    isValidStorageTimestamp(record.claimedAt) &&
    typeof record.createdAt === "number" &&
    record.claimedAt >= record.createdAt
  );
}

function buildPreAuthProjection(
  record: StoredMcpOAuthPreAuthIntentRecordV1,
): McpOAuthPreAuthAuthorizationRequestProjectionV1 {
  const approvedOptionalParameters = record.approvedOptionalParameters;
  return {
    kind: "mcp_oauth_pre_auth_authorization_request_projection",
    authorizationPage: {
      origin: record.authorizationPageOrigin,
      path: record.authorizationPagePath,
    },
    providerForwardRequest: {
      responseType: "code",
      clientId: record.clientId,
      redirectUri: record.redirectUri,
      resource: record.resource,
      scopes: [...record.scopes],
      state: record.state,
      pkce: {
        codeChallenge: record.codeChallenge,
        codeChallengeMethod: "S256",
      },
      ...(approvedOptionalParameters ? { approvedOptionalParameters } : {}),
      version: 1,
    },
    providerValidation: {
      status: "pending",
      clientRegistrationValidated: false,
      redirectUriValidatedByProvider: false,
      consentCompleted: false,
      authorizationCodeIssued: false,
      tokenIssued: false,
      stytchSubjectResolved: false,
      accountLinkCreated: false,
      version: 1,
    },
    preAuthIntent: {
      status: "pre_auth_pending",
      containsOwnerIdentity: false,
      containsProviderSubject: false,
      containsAccountLinkId: false,
      authorizationGranted: false,
      consentCompleted: false,
      authorizationCodeIssued: false,
      tokenIssued: false,
      accountLinkCreated: false,
      modelVisible: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  };
}

function parseScopes(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0) return undefined;
  const scopes = value.map((scope) => readBoundedStorageText(scope, 128));
  if (scopes.some((scope) => scope === undefined)) return undefined;
  const parsed = scopes.filter((scope): scope is string => scope !== undefined);
  if (new Set(parsed).size !== parsed.length) return undefined;
  if (!parsed.includes(TWOWEEKS_APPLICATIONS_READ_SCOPE)) return undefined;
  if (parsed.some((scope) => scope !== TWOWEEKS_APPLICATIONS_READ_SCOPE && !["openid", "email", "profile"].includes(scope))) {
    return undefined;
  }
  if (parsed.some((scope) => !SAFE_SCOPE_PATTERN.test(scope))) return undefined;
  return Object.freeze([...parsed]);
}

function readAuthorizationOrigin(value: unknown): string | undefined {
  const text = readBoundedStorageText(value, MAX_OAUTH_PARAMETER_LENGTH);
  if (!text) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return undefined;
  }
  if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return undefined;
  if (parsed.protocol === "https:") return parsed.origin;
  return parsed.protocol === "http:" && isLocalhost(parsed.hostname) ? parsed.origin : undefined;
}

function readAuthorizationPagePath(value: unknown): string | undefined {
  const text = readBoundedStorageText(value, MAX_AUTHORIZATION_PAGE_PATH_LENGTH);
  if (!text || !text.startsWith("/") || text.startsWith("//")) return undefined;
  if (text.includes("?") || text.includes("#")) return undefined;
  return text;
}

function readSafeHttpsUrl(value: unknown, options: { allowSearch: boolean }): string | undefined {
  const text = readBoundedStorageText(value, MAX_OAUTH_PARAMETER_LENGTH);
  if (!text) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "https:" || parsed.username || parsed.password || parsed.hash || parsed.hostname.includes("*")) {
    return undefined;
  }
  if (!options.allowSearch && parsed.search) return undefined;
  return parsed.toString();
}

function readBoundedStorageText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return undefined;
  return containsControlCharacters(value) ? undefined : value;
}

function readRecord(
  value: unknown,
  allowedKeys: readonly string[],
  requiredKeys: readonly string[] = allowedKeys,
): Record<string, unknown> | undefined {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return undefined;
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const keys = Reflect.ownKeys(descriptors);
  const record: Record<string, unknown> = {};
  for (const key of keys) {
    if (typeof key !== "string" || !allowedKeys.includes(key)) return undefined;
    const descriptor = descriptors[key];
    if (!descriptor?.enumerable || !("value" in descriptor)) return undefined;
    record[key] = descriptor.value;
  }
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key)) ? record : undefined;
}

function isValidPreAuthHandleHash(value: unknown): value is string {
  return typeof value === "string" && PRE_AUTH_HANDLE_HASH_PATTERN.test(value);
}

function isValidStorageTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isValidStorageStatus(value: unknown): value is McpOAuthPreAuthIntentStatusV1 {
  return value === "pre_auth_pending" || value === "claimed" || value === "expired";
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

function denyCreate(
  reason: Exclude<McpOAuthPreAuthIntentStorageReasonV1, "created" | "claimed">,
): McpOAuthPreAuthIntentCreateResultV1 {
  return {
    kind: "mcp_oauth_pre_auth_intent_create_result",
    ok: false,
    reason,
    safeFailure: safeFailure(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function denyClaim(
  reason: Exclude<McpOAuthPreAuthIntentStorageReasonV1, "created" | "claimed" | "handle_collision">,
): McpOAuthPreAuthIntentClaimResultV1 {
  return {
    kind: "mcp_oauth_pre_auth_intent_claim_result",
    ok: false,
    reason,
    safeFailure: safeFailure(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function safeFailure(): SafePreAuthIntentFailureV1 {
  return {
    code: "mcp_oauth_pre_auth_intent_denied",
    message: "Pre-auth intent denied.",
    safeForModel: true,
    sensitiveValuesEchoed: false,
    version: 1,
  };
}

function cleanupResult(deletedCount: number): McpOAuthPreAuthIntentCleanupResultV1 {
  return {
    kind: "mcp_oauth_pre_auth_intent_cleanup_result",
    ok: true,
    deletedCount,
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}
