import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import type {
  McpOAuthAuthorizationRequestBoundaryHandoffV1,
  McpOAuthAuthorizationTrustedOwnerV1,
} from "../src/modules/local-mcp/mcpOAuthAuthorizationRequestBoundary";

export const MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS = 10 * 60 * 1_000;
export const MCP_OAUTH_AUTHORIZATION_INTENT_MIN_TTL_MS = 60 * 1_000;
export const MCP_OAUTH_AUTHORIZATION_INTENT_MAX_TTL_MS = 15 * 60 * 1_000;
const MAX_EXPIRED_INTENT_CLEANUP_BATCH = 100;

const TWOWEEKS_APPLICATIONS_READ_SCOPE = "twoweeks:applications:read" as const;
const INTENT_HANDLE_HASH_PATTERN = /^[0-9a-f]{64}$/u;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,255}$/u;
const PKCE_S256_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const SAFE_SCOPE_PATTERN = /^[A-Za-z][A-Za-z0-9:._-]{0,127}$/u;
const MAX_SAFE_TIMESTAMP_BEFORE_TTL = Number.MAX_SAFE_INTEGER - MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS;
const MAX_OAUTH_PARAMETER_LENGTH = 512;
const MAX_AUTHORIZATION_PAGE_PATH_LENGTH = 256;
const MAX_LOGIN_RETURN_PATH_LENGTH = 2_048;
const MAX_STATE_LENGTH = 512;

const trustedOwnerValidator = v.object({
  kind: v.literal("mcp_oauth_authorization_trusted_owner"),
  twoweeksClerkId: v.string(),
  version: v.literal(1),
});

const CREATE_ARGS_KEYS = ["authorizationRequestHandoff", "intentHandleHash", "now", "version"] as const;
const CONSUME_ARGS_KEYS = ["trustedOwner", "intentHandleHash", "now", "version"] as const;
const CLEANUP_ARGS_KEYS = ["now", "version"] as const;
const TRUSTED_OWNER_KEYS = ["kind", "twoweeksClerkId", "version"] as const;
const HANDOFF_KEYS = [
  "authorizationPage",
  "providerForwardRequest",
  "trustedOwner",
  "providerValidation",
  "futureIntent",
  "loginReturn",
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
const FUTURE_INTENT_KEYS = [
  "kind",
  "storage",
  "preservesProviderForwardRequest",
  "serverMustPersistBeforeLoginReturn",
  "serverPreservedSensitiveOptionalParameters",
  "modelVisible",
  "version",
] as const;
const LOGIN_RETURN_KEYS = [
  "path",
  "target",
  "usesClientRedirectUri",
  "containsOwnerIdentity",
  "sensitiveOptionalParametersInUrl",
  "persisted",
  "version",
] as const;
const STORAGE_OPTIONAL_PARAMETER_KEYS = ["nonce", "prompt"] as const;
const SENSITIVE_OPTIONAL_PARAMETER_KEYS = ["login_hint", "id_token_hint"] as const;
const PROVIDER_FORWARD_OPTIONAL_PARAMETER_KEYS = [
  ...STORAGE_OPTIONAL_PARAMETER_KEYS,
  ...SENSITIVE_OPTIONAL_PARAMETER_KEYS,
] as const;
type ApprovedOptionalParameterKeyV1 = (typeof STORAGE_OPTIONAL_PARAMETER_KEYS)[number];
const STORAGE_RECORD_KEYS = [
  "kind",
  "version",
  "intentHandleHash",
  "twoweeksClerkId",
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
  "consumedAt",
  "storageVersion",
  "_id",
  "_creationTime",
] as const;
const STORAGE_RECORD_REQUIRED_KEYS = [
  "kind",
  "version",
  "intentHandleHash",
  "twoweeksClerkId",
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

export type McpOAuthAuthorizationIntentStatusV1 = "pending" | "consumed" | "expired";

export type McpOAuthAuthorizationIntentStorageReasonV1 =
  | "created"
  | "consumed"
  | "invalid_input"
  | "invalid_handle_hash"
  | "handle_collision"
  | "not_found_or_forbidden"
  | "malformed_storage_record"
  | "expired"
  | "already_consumed"
  | "duplicate_storage_record";

export type McpOAuthAuthorizationIntentRecordV1 = Readonly<{
  kind: "mcp_oauth_authorization_intent_record";
  version: 1;
  intentHandleHash: string;
  twoweeksClerkId: string;
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
  status: McpOAuthAuthorizationIntentStatusV1;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  consumedAt?: number;
  storageVersion: 1;
}>;

type StoredMcpOAuthAuthorizationIntentRecordV1 = McpOAuthAuthorizationIntentRecordV1 &
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

type ParsedAuthorizationHandoffV1 = Readonly<{
  authorizationPageOrigin: string;
  authorizationPagePath: string;
  providerForwardRequest: ParsedProviderForwardRequestV1;
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
}>;

export type McpOAuthAuthorizationIntentCreateResultV1 = Readonly<
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
      reason: Exclude<McpOAuthAuthorizationIntentStorageReasonV1, "created" | "consumed">;
      safeFailure: SafeIntentFailureV1;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthAuthorizationIntentConsumeResultV1 = Readonly<
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
      reason: Exclude<McpOAuthAuthorizationIntentStorageReasonV1, "created" | "consumed" | "handle_collision">;
      safeFailure: SafeIntentFailureV1;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthAuthorizationIntentCleanupResultV1 = Readonly<{
  kind: "mcp_oauth_authorization_intent_cleanup_result";
  ok: true;
  deletedCount: number;
  modelVisible: false;
  safeForLogging: true;
  version: 1;
}>;

type SafeIntentFailureV1 = Readonly<{
  code: "mcp_oauth_authorization_intent_denied";
  message: "Authorization intent denied.";
  safeForModel: true;
  sensitiveValuesEchoed: false;
  version: 1;
}>;

export type McpOAuthAuthorizationIntentStorageClassificationV1 =
  | "pending_valid"
  | "consumed_valid"
  | "expired_valid"
  | "malformed";

export const internalCreateMcpOAuthAuthorizationIntent = internalMutation({
  args: {
    authorizationRequestHandoff: v.any(),
    intentHandleHash: v.string(),
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthAuthorizationIntentCreateResultV1> => {
    if (!readRecord(args, CREATE_ARGS_KEYS)) return denyCreate("invalid_input");
    if (!isValidStorageTimestamp(args.now) || args.now > MAX_SAFE_TIMESTAMP_BEFORE_TTL) {
      return denyCreate("invalid_input");
    }
    if (!isValidIntentHandleHash(args.intentHandleHash)) return denyCreate("invalid_handle_hash");

    const handoff = parseAuthorizationHandoff(args.authorizationRequestHandoff);
    if (!handoff.ok) return denyCreate(handoff.reason);

    const existingRows = await ctx.db
      .query("mcpOAuthAuthorizationIntents")
      .withIndex("by_intent_handle_hash", (q) => q.eq("intentHandleHash", args.intentHandleHash))
      .collect();
    if (existingRows.length > 0) return denyCreate("handle_collision");

    const record = buildIntentRecord(args.intentHandleHash, handoff.value, args.now);
    await ctx.db.insert("mcpOAuthAuthorizationIntents", record);

    return {
      kind: "mcp_oauth_authorization_intent_create_result",
      ok: true,
      reason: "created",
      serverOnly: {
        status: "pending",
        expiresAt: record.expiresAt,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    };
  },
});

export const internalConsumeMcpOAuthAuthorizationIntent = internalMutation({
  args: {
    trustedOwner: trustedOwnerValidator,
    intentHandleHash: v.string(),
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthAuthorizationIntentConsumeResultV1> => {
    if (!readRecord(args, CONSUME_ARGS_KEYS)) return denyConsume("invalid_input");
    const trustedOwner = parseTrustedOwner(args.trustedOwner);
    if (!trustedOwner || !isValidStorageTimestamp(args.now)) return denyConsume("invalid_input");
    if (!isValidIntentHandleHash(args.intentHandleHash)) return denyConsume("invalid_handle_hash");

    const rows = await ctx.db
      .query("mcpOAuthAuthorizationIntents")
      .withIndex("by_intent_handle_hash", (q) => q.eq("intentHandleHash", args.intentHandleHash))
      .collect();
    if (rows.length === 0) return denyConsume("not_found_or_forbidden");
    if (rows.length > 1) return denyConsume("duplicate_storage_record");

    const row = rows[0] as StoredMcpOAuthAuthorizationIntentRecordV1;
    const parsedRow = parseStorageRecord(row);
    if (!parsedRow) return denyConsume("malformed_storage_record");
    if (parsedRow.twoweeksClerkId !== trustedOwner.twoweeksClerkId) return denyConsume("not_found_or_forbidden");
    if (parsedRow.status === "consumed") return denyConsume("already_consumed");
    if (parsedRow.status === "expired") return denyConsume("expired");
    if (args.now < parsedRow.createdAt) return denyConsume("invalid_input");
    if (args.now >= parsedRow.expiresAt) {
      await ctx.db.patch(parsedRow._id as never, {
        status: "expired",
        updatedAt: args.now,
      });
      return denyConsume("expired");
    }

    const handoff = buildAuthorizationRequestHandoff(parsedRow);
    await ctx.db.patch(parsedRow._id as never, {
      status: "consumed",
      updatedAt: args.now,
      consumedAt: args.now,
    });

    return {
      kind: "mcp_oauth_authorization_intent_consume_result",
      ok: true,
      reason: "consumed",
      serverOnly: {
        authorizationRequestHandoff: handoff,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    };
  },
});

export const internalDeleteExpiredMcpOAuthAuthorizationIntents = internalMutation({
  args: {
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthAuthorizationIntentCleanupResultV1> => {
    if (!readRecord(args, CLEANUP_ARGS_KEYS) || !isValidStorageTimestamp(args.now)) {
      return cleanupResult(0);
    }

    const expiredRows = await ctx.db
      .query("mcpOAuthAuthorizationIntents")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", args.now))
      .take(MAX_EXPIRED_INTENT_CLEANUP_BATCH);

    for (const row of expiredRows) {
      await ctx.db.delete(row._id);
    }

    return cleanupResult(expiredRows.length);
  },
});

export function classifyMcpOAuthAuthorizationIntentStorageRecord(
  value: unknown,
): McpOAuthAuthorizationIntentStorageClassificationV1 {
  const record = parseStorageRecord(value);
  if (!record) return "malformed";
  if (record.status === "pending") return "pending_valid";
  if (record.status === "consumed") return "consumed_valid";
  return "expired_valid";
}

function buildIntentRecord(
  intentHandleHash: string,
  handoff: ParsedAuthorizationHandoffV1,
  now: number,
): McpOAuthAuthorizationIntentRecordV1 {
  const optionalParameters = handoff.providerForwardRequest.approvedOptionalParameters;
  return {
    kind: "mcp_oauth_authorization_intent_record",
    version: 1,
    intentHandleHash,
    twoweeksClerkId: handoff.trustedOwner.twoweeksClerkId,
    authorizationPageOrigin: handoff.authorizationPageOrigin,
    authorizationPagePath: handoff.authorizationPagePath,
    responseType: "code",
    clientId: handoff.providerForwardRequest.clientId,
    redirectUri: handoff.providerForwardRequest.redirectUri,
    resource: handoff.providerForwardRequest.resource,
    scopes: [...handoff.providerForwardRequest.scopes],
    state: handoff.providerForwardRequest.state,
    codeChallenge: handoff.providerForwardRequest.codeChallenge,
    codeChallengeMethod: "S256",
    ...(optionalParameters ? { approvedOptionalParameters: optionalParameters } : {}),
    providerValidationStatus: "pending",
    status: "pending",
    createdAt: now,
    updatedAt: now,
    expiresAt: now + MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS,
    storageVersion: 1,
  };
}

function parseAuthorizationHandoff(
  value: unknown,
):
  | { ok: true; value: ParsedAuthorizationHandoffV1 }
  | { ok: false; reason: Extract<McpOAuthAuthorizationIntentStorageReasonV1, "invalid_input"> } {
  const handoff = readRecord(value, HANDOFF_KEYS);
  if (!handoff || handoff.modelVisible !== false || handoff.safeForLogging !== false || handoff.version !== 1) {
    return { ok: false, reason: "invalid_input" };
  }

  const authorizationPage = parseAuthorizationPage(handoff.authorizationPage);
  const providerForwardRequest = parseProviderForwardRequest(handoff.providerForwardRequest);
  const trustedOwner = parseTrustedOwner(handoff.trustedOwner);
  if (!authorizationPage || !trustedOwner) return { ok: false, reason: "invalid_input" };
  if (!providerForwardRequest.ok) return providerForwardRequest;
  if (!hasPendingProviderValidation(handoff.providerValidation)) return { ok: false, reason: "invalid_input" };
  if (!hasExpectedFutureIntent(handoff.futureIntent)) return { ok: false, reason: "invalid_input" };
  if (!hasExpectedLoginReturn(handoff.loginReturn)) return { ok: false, reason: "invalid_input" };

  return {
    ok: true,
    value: {
      authorizationPageOrigin: authorizationPage.origin,
      authorizationPagePath: authorizationPage.path,
      providerForwardRequest: providerForwardRequest.value,
      trustedOwner,
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
  | { ok: false; reason: Extract<McpOAuthAuthorizationIntentStorageReasonV1, "invalid_input"> } {
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

function parseTrustedOwner(value: unknown): McpOAuthAuthorizationTrustedOwnerV1 | undefined {
  const record = readRecord(value, TRUSTED_OWNER_KEYS);
  if (!record || record.kind !== "mcp_oauth_authorization_trusted_owner" || record.version !== 1) return undefined;
  const twoweeksClerkId = readBoundedStorageText(record.twoweeksClerkId, MAX_OAUTH_PARAMETER_LENGTH);
  if (!twoweeksClerkId || !SAFE_IDENTIFIER_PATTERN.test(twoweeksClerkId)) return undefined;
  return {
    kind: "mcp_oauth_authorization_trusted_owner",
    twoweeksClerkId,
    version: 1,
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

function hasExpectedFutureIntent(value: unknown): boolean {
  const record = readRecord(value, FUTURE_INTENT_KEYS);
  return (
    record !== undefined &&
    record.kind === "mcp_oauth_authorization_intent_contract" &&
    record.storage === "future_short_lived_server_store" &&
    record.preservesProviderForwardRequest === true &&
    record.serverMustPersistBeforeLoginReturn === true &&
    Array.isArray(record.serverPreservedSensitiveOptionalParameters) &&
    record.serverPreservedSensitiveOptionalParameters.includes("login_hint") &&
    record.serverPreservedSensitiveOptionalParameters.includes("id_token_hint") &&
    record.modelVisible === false &&
    record.version === 1
  );
}

function hasExpectedLoginReturn(value: unknown): boolean {
  const record = readRecord(value, LOGIN_RETURN_KEYS);
  const path = readLoginReturnPath(record?.path);
  return (
    record !== undefined &&
    path !== undefined &&
    record.target === "authorization_page" &&
    record.usesClientRedirectUri === false &&
    record.containsOwnerIdentity === false &&
    record.sensitiveOptionalParametersInUrl === false &&
    record.persisted === false &&
    record.version === 1
  );
}

function readLoginReturnPath(value: unknown): string | undefined {
  const text = readBoundedStorageText(value, MAX_LOGIN_RETURN_PATH_LENGTH);
  if (!text || !text.startsWith("/") || text.startsWith("//")) return undefined;
  if (text.includes("#")) return undefined;
  return text;
}

function parseStorageRecord(value: unknown): StoredMcpOAuthAuthorizationIntentRecordV1 | undefined {
  const record = readRecord(value, STORAGE_RECORD_KEYS, STORAGE_RECORD_REQUIRED_KEYS);
  if (!record || record.kind !== "mcp_oauth_authorization_intent_record" || record.version !== 1) return undefined;
  if (!isValidIntentHandleHash(record.intentHandleHash)) return undefined;
  const twoweeksClerkId = readBoundedStorageText(record.twoweeksClerkId, MAX_OAUTH_PARAMETER_LENGTH);
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
    !twoweeksClerkId ||
    !SAFE_IDENTIFIER_PATTERN.test(twoweeksClerkId) ||
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
    record.expiresAt - record.createdAt !== MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS ||
    record.storageVersion !== 1 ||
    !hasValidTerminalTimestamp(record)
  ) {
    return undefined;
  }

  return {
    kind: "mcp_oauth_authorization_intent_record",
    version: 1,
    intentHandleHash: record.intentHandleHash,
    twoweeksClerkId,
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
    ...(typeof record.consumedAt === "number" ? { consumedAt: record.consumedAt } : {}),
    storageVersion: 1,
    ...(record._id !== undefined ? { _id: record._id } : {}),
    ...(typeof record._creationTime === "number" ? { _creationTime: record._creationTime } : {}),
  };
}

function hasValidTerminalTimestamp(record: Record<string, unknown>): boolean {
  if (record.status === "pending" || record.status === "expired") return record.consumedAt === undefined;
  return (
    record.status === "consumed" &&
    isValidStorageTimestamp(record.consumedAt) &&
    typeof record.createdAt === "number" &&
    record.consumedAt >= record.createdAt
  );
}

function buildAuthorizationRequestHandoff(
  record: StoredMcpOAuthAuthorizationIntentRecordV1,
): McpOAuthAuthorizationRequestBoundaryHandoffV1 {
  const approvedOptionalParameters = record.approvedOptionalParameters;
  const providerForwardRequest = {
    responseType: "code" as const,
    clientId: record.clientId,
    redirectUri: record.redirectUri,
    resource: record.resource,
    scopes: [...record.scopes],
    state: record.state,
    pkce: {
      codeChallenge: record.codeChallenge,
      codeChallengeMethod: "S256" as const,
    },
    ...(approvedOptionalParameters ? { approvedOptionalParameters } : {}),
    version: 1 as const,
  };
  return {
    authorizationPage: {
      origin: record.authorizationPageOrigin,
      path: record.authorizationPagePath,
    },
    providerForwardRequest,
    trustedOwner: {
      kind: "mcp_oauth_authorization_trusted_owner",
      twoweeksClerkId: record.twoweeksClerkId,
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
    futureIntent: {
      kind: "mcp_oauth_authorization_intent_contract",
      storage: "future_short_lived_server_store",
      preservesProviderForwardRequest: true,
      serverMustPersistBeforeLoginReturn: true,
      serverPreservedSensitiveOptionalParameters: ["login_hint", "id_token_hint"],
      modelVisible: false,
      version: 1,
    },
    loginReturn: {
      path: `${record.authorizationPagePath}?${buildLoginReturnQuery(record)}`,
      target: "authorization_page",
      usesClientRedirectUri: false,
      containsOwnerIdentity: false,
      sensitiveOptionalParametersInUrl: false,
      persisted: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  };
}

function buildLoginReturnQuery(record: StoredMcpOAuthAuthorizationIntentRecordV1): string {
  const query = new URLSearchParams();
  query.append("response_type", "code");
  query.append("client_id", record.clientId);
  query.append("redirect_uri", record.redirectUri);
  query.append("scope", record.scopes.join(" "));
  query.append("state", record.state);
  query.append("code_challenge", record.codeChallenge);
  query.append("code_challenge_method", "S256");
  query.append("resource", record.resource);
  if (record.approvedOptionalParameters?.nonce !== undefined) {
    query.append("nonce", record.approvedOptionalParameters.nonce);
  }
  if (record.approvedOptionalParameters?.prompt !== undefined) {
    query.append("prompt", record.approvedOptionalParameters.prompt);
  }
  return query.toString();
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

function isValidIntentHandleHash(value: unknown): value is string {
  return typeof value === "string" && INTENT_HANDLE_HASH_PATTERN.test(value);
}

function isValidStorageTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isValidStorageStatus(value: unknown): value is McpOAuthAuthorizationIntentStatusV1 {
  return value === "pending" || value === "consumed" || value === "expired";
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
  reason: Exclude<McpOAuthAuthorizationIntentStorageReasonV1, "created" | "consumed">,
): McpOAuthAuthorizationIntentCreateResultV1 {
  return {
    kind: "mcp_oauth_authorization_intent_create_result",
    ok: false,
    reason,
    safeFailure: safeFailure(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function denyConsume(
  reason: Exclude<McpOAuthAuthorizationIntentStorageReasonV1, "created" | "consumed" | "handle_collision">,
): McpOAuthAuthorizationIntentConsumeResultV1 {
  return {
    kind: "mcp_oauth_authorization_intent_consume_result",
    ok: false,
    reason,
    safeFailure: safeFailure(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function safeFailure(): SafeIntentFailureV1 {
  return {
    code: "mcp_oauth_authorization_intent_denied",
    message: "Authorization intent denied.",
    safeForModel: true,
    sensitiveValuesEchoed: false,
    version: 1,
  };
}

function cleanupResult(deletedCount: number): McpOAuthAuthorizationIntentCleanupResultV1 {
  return {
    kind: "mcp_oauth_authorization_intent_cleanup_result",
    ok: true,
    deletedCount,
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}
