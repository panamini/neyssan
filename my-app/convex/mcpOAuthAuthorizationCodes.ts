import { internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import type {
  McpOAuthAuthorizationTrustedOwnerV1,
} from "../src/modules/local-mcp/mcpOAuthAuthorizationRequestBoundary";
import type {
  McpOAuthProductionAuthenticatedOwnerIdentityV1,
  McpOAuthProductionAuthorizationCodeCreatePortInputV1,
  McpOAuthProductionAuthorizationCodeCreatePortResultV1,
  McpOAuthProductionAuthorizationCodeValidatePortResultV1,
  McpOAuthProductionAccessTokenIssuePortResultV1,
} from "../src/modules/local-mcp/mcpOAuthProductionRouteAdapter";

export const MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS = 5 * 60 * 1_000;
export const MCP_OAUTH_ACCESS_TOKEN_TTL_MS = 60 * 60 * 1_000;
export const MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT = "mcp_oauth_production_v1";
const MAX_SAFE_TIMESTAMP_BEFORE_TTL = Number.MAX_SAFE_INTEGER - MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS;
const MAX_SAFE_TIMESTAMP_BEFORE_ACCESS_TOKEN_TTL = Number.MAX_SAFE_INTEGER - MCP_OAUTH_ACCESS_TOKEN_TTL_MS;
const MAX_EXPIRED_CODE_CLEANUP_BATCH = 100;
const MAX_EXPIRED_ACCESS_TOKEN_CLEANUP_BATCH = 100;
const CODE_DIGEST_PATTERN = /^[0-9a-f]{64}$/u;
const SAFE_IDENTIFIER_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,511}$/u;
const SAFE_SCOPE_PATTERN = /^[A-Za-z][A-Za-z0-9:._-]{0,127}$/u;
const PKCE_S256_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43,128}$/u;
const MAX_OAUTH_PARAMETER_LENGTH = 512;
const MAX_STATE_LENGTH = 512;
const MAX_SCOPE_COUNT = 4;

const CREATE_ARGS_KEYS = [
  "authorizationCodeDigest",
  "authenticatedOwnerIdentity",
  "trustedOwner",
  "authorizationRequest",
  "productionEnvironment",
  "now",
  "deadlineEpochMs",
  "timeoutMs",
  "version",
] as const;
const CREATE_REQUIRED_ARGS_KEYS = [
  "authorizationCodeDigest",
  "authenticatedOwnerIdentity",
  "trustedOwner",
  "authorizationRequest",
  "productionEnvironment",
  "now",
  "version",
] as const;
const CONSUME_ARGS_KEYS = [
  "authorizationCodeDigest",
  "clientId",
  "redirectUri",
  "now",
  "version",
] as const;
const VALIDATE_ARGS_KEYS = [
  "authorizationCodeDigest",
  "clientId",
  "redirectUri",
  "resource",
  "codeChallenge",
  "now",
  "version",
] as const;
const ISSUE_ACCESS_TOKEN_ARGS_KEYS = [
  "authorizationCodeDigest",
  "accessTokenDigest",
  "clientId",
  "redirectUri",
  "resource",
  "codeChallenge",
  "now",
  "deadlineEpochMs",
  "timeoutMs",
  "version",
] as const;
const CLEANUP_ARGS_KEYS = ["now", "version"] as const;
const OWNER_IDENTITY_KEYS = ["subject", "issuer", "version"] as const;
const TRUSTED_OWNER_KEYS = ["kind", "twoweeksClerkId", "version"] as const;
const AUTHORIZATION_REQUEST_KEYS = [
  "clientId",
  "redirectUri",
  "resource",
  "scopes",
  "state",
  "codeChallenge",
  "codeChallengeMethod",
  "version",
] as const;
const STORAGE_RECORD_KEYS = [
  "kind",
  "version",
  "authorizationCodeDigest",
  "twoweeksClerkId",
  "ownerIssuer",
  "clientId",
  "redirectUri",
  "resource",
  "scopes",
  "state",
  "codeChallenge",
  "codeChallengeMethod",
  "productionEnvironment",
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
  "authorizationCodeDigest",
  "twoweeksClerkId",
  "ownerIssuer",
  "clientId",
  "redirectUri",
  "resource",
  "scopes",
  "state",
  "codeChallenge",
  "codeChallengeMethod",
  "productionEnvironment",
  "status",
  "createdAt",
  "updatedAt",
  "expiresAt",
  "storageVersion",
] as const;
const ACCESS_TOKEN_STORAGE_RECORD_KEYS = [
  "kind",
  "version",
  "accessTokenDigest",
  "authorizationCodeDigest",
  "twoweeksClerkId",
  "ownerIssuer",
  "clientId",
  "redirectUri",
  "resource",
  "scopes",
  "productionEnvironment",
  "status",
  "issuedAt",
  "updatedAt",
  "expiresAt",
  "storageVersion",
  "_id",
  "_creationTime",
] as const;
const ACCESS_TOKEN_STORAGE_RECORD_REQUIRED_KEYS = [
  "kind",
  "version",
  "accessTokenDigest",
  "authorizationCodeDigest",
  "twoweeksClerkId",
  "ownerIssuer",
  "clientId",
  "redirectUri",
  "resource",
  "scopes",
  "productionEnvironment",
  "status",
  "issuedAt",
  "updatedAt",
  "expiresAt",
  "storageVersion",
] as const;

export type McpOAuthAuthorizationCodeStatusV1 = "pending" | "consumed" | "expired";
export type McpOAuthAccessTokenStatusV1 = "active" | "expired" | "revoked";

export type McpOAuthAuthorizationCodeRecordV1 = Readonly<{
  kind: "mcp_oauth_authorization_code_record";
  version: 1;
  authorizationCodeDigest: string;
  twoweeksClerkId: string;
  ownerIssuer: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  state: string;
  codeChallenge: string;
  codeChallengeMethod: "S256";
  productionEnvironment: typeof MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT;
  status: McpOAuthAuthorizationCodeStatusV1;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  consumedAt?: number;
  storageVersion: 1;
}>;

type StoredMcpOAuthAuthorizationCodeRecordV1 = McpOAuthAuthorizationCodeRecordV1 & Readonly<{
  _id?: unknown;
  _creationTime?: number;
}>;

export type McpOAuthAccessTokenRecordV1 = Readonly<{
  kind: "mcp_oauth_access_token_record";
  version: 1;
  accessTokenDigest: string;
  authorizationCodeDigest: string;
  twoweeksClerkId: string;
  ownerIssuer: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  scopes: string[];
  productionEnvironment: typeof MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT;
  status: McpOAuthAccessTokenStatusV1;
  issuedAt: number;
  updatedAt: number;
  expiresAt: number;
  storageVersion: 1;
}>;

type StoredMcpOAuthAccessTokenRecordV1 = McpOAuthAccessTokenRecordV1 & Readonly<{
  _id?: unknown;
  _creationTime?: number;
}>;

type ParsedAuthorizationCodeCreateInputV1 = Readonly<{
  authorizationCodeDigest: string;
  authenticatedOwnerIdentity: McpOAuthProductionAuthenticatedOwnerIdentityV1;
  trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
  authorizationRequest: McpOAuthProductionAuthorizationCodeCreatePortInputV1["authorizationRequest"];
  now: number;
}>;

type ParsedAccessTokenIssueInputV1 = Readonly<{
  authorizationCodeDigest: string;
  accessTokenDigest: string;
  clientId: string;
  redirectUri: string;
  resource: string;
  codeChallenge: string;
  now: number;
  deadlineEpochMs: number;
  timeoutMs: number;
}>;

export type McpOAuthAuthorizationCodeConsumeResultV1 = Readonly<
  | {
      kind: "mcp_oauth_authorization_code_consume_result";
      ok: true;
      reason: "consumed";
      serverOnly: {
        trustedOwner: McpOAuthAuthorizationTrustedOwnerV1;
        clientId: string;
        redirectUri: string;
        resource: string;
        scopes: readonly string[];
        state: string;
        codeChallenge: string;
        codeChallengeMethod: "S256";
        productionEnvironment: typeof MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT;
        version: 1;
      };
      modelVisible: false;
      safeForLogging: false;
      version: 1;
    }
  | {
      kind: "mcp_oauth_authorization_code_consume_result";
      ok: false;
      reason:
        | "invalid_input"
        | "invalid_code_digest"
        | "not_found_or_forbidden"
        | "malformed_storage_record"
        | "expired"
        | "already_consumed"
        | "duplicate_storage_record";
      safeFailure: SafeAuthorizationCodeFailureV1;
      modelVisible: false;
      safeForLogging: true;
      version: 1;
    }
>;

export type McpOAuthAuthorizationCodeCleanupResultV1 = Readonly<{
  kind: "mcp_oauth_authorization_code_cleanup_result";
  ok: true;
  deletedCount: number;
  modelVisible: false;
  safeForLogging: true;
  version: 1;
}>;

export type McpOAuthAccessTokenCleanupResultV1 = Readonly<{
  kind: "mcp_oauth_access_token_cleanup_result";
  ok: true;
  deletedCount: number;
  modelVisible: false;
  safeForLogging: true;
  version: 1;
}>;

type SafeAuthorizationCodeFailureV1 = Readonly<{
  code: "mcp_oauth_authorization_code_denied";
  message: "Authorization code denied.";
  safeForModel: true;
  rawCodeEchoed: false;
  digestEchoed: false;
  identityEchoed: false;
  sensitiveValuesEchoed: false;
  version: 1;
}>;

export const internalCreateMcpOAuthAuthorizationCode = internalMutation({
  args: {
    authorizationCodeDigest: v.string(),
    authenticatedOwnerIdentity: v.any(),
    trustedOwner: v.any(),
    authorizationRequest: v.any(),
    productionEnvironment: v.literal(MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT),
    now: v.number(),
    deadlineEpochMs: v.optional(v.number()),
    timeoutMs: v.optional(v.number()),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthProductionAuthorizationCodeCreatePortResultV1> => {
    const input = parseCreateInput(args);
    if (!input) return denyCreate("invalid_input");

    const existingRows = await ctx.db
      .query("mcpOAuthAuthorizationCodes")
      .withIndex("by_authorization_code_digest", (q) =>
        q.eq("authorizationCodeDigest", input.authorizationCodeDigest),
      )
      .take(1);
    if (existingRows.length > 0) return denyCreate("digest_collision");

    const record = buildAuthorizationCodeRecord(input);
    await ctx.db.insert("mcpOAuthAuthorizationCodes", record);

    return {
      kind: "mcp_oauth_authorization_code_create_result",
      ok: true,
      reason: "created",
      serverOnly: {
        status: "pending",
        expiresAt: record.expiresAt,
        rawAuthorizationCodePersisted: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    };
  },
});

export const internalConsumeMcpOAuthAuthorizationCode = internalMutation({
  args: {
    authorizationCodeDigest: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthAuthorizationCodeConsumeResultV1> => {
    const input = readRecord(args, CONSUME_ARGS_KEYS);
    if (!input || !isValidStorageTimestamp(input.now)) return denyConsume("invalid_input");
    const authorizationCodeDigest = input.authorizationCodeDigest;
    if (!isAuthorizationCodeDigest(authorizationCodeDigest)) return denyConsume("invalid_code_digest");
    const clientId = readBoundedText(input.clientId, MAX_OAUTH_PARAMETER_LENGTH);
    const redirectUri = readSafeHttpsUrl(input.redirectUri, { allowSearch: true });
    if (!clientId || !redirectUri) return denyConsume("invalid_input");

    const rows = await ctx.db
      .query("mcpOAuthAuthorizationCodes")
      .withIndex("by_authorization_code_digest", (q) =>
        q.eq("authorizationCodeDigest", authorizationCodeDigest),
      )
      .collect();
    if (rows.length === 0) return denyConsume("not_found_or_forbidden");
    if (rows.length > 1) return denyConsume("duplicate_storage_record");

    const row = parseStorageRecord(rows[0]);
    if (!row) return denyConsume("malformed_storage_record");
    if (row.clientId !== clientId || row.redirectUri !== redirectUri) {
      return denyConsume("not_found_or_forbidden");
    }
    if (row.status === "consumed") return denyConsume("already_consumed");
    if (row.status === "expired") return denyConsume("expired");
    if (input.now < row.createdAt) return denyConsume("invalid_input");
    if (input.now >= row.expiresAt) {
      await ctx.db.patch(row._id as never, {
        status: "expired",
        updatedAt: input.now,
      });
      return denyConsume("expired");
    }

    await ctx.db.patch(row._id as never, {
      status: "consumed",
      updatedAt: input.now,
      consumedAt: input.now,
    });

    return {
      kind: "mcp_oauth_authorization_code_consume_result",
      ok: true,
      reason: "consumed",
      serverOnly: {
        trustedOwner: {
          kind: "mcp_oauth_authorization_trusted_owner",
          twoweeksClerkId: row.twoweeksClerkId,
          version: 1,
        },
        clientId: row.clientId,
        redirectUri: row.redirectUri,
        resource: row.resource,
        scopes: Object.freeze([...row.scopes]),
        state: row.state,
        codeChallenge: row.codeChallenge,
        codeChallengeMethod: "S256",
        productionEnvironment: row.productionEnvironment,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    };
  },
});

export const internalValidateMcpOAuthAuthorizationCodeForTokenBoundary = internalQuery({
  args: {
    authorizationCodeDigest: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    resource: v.string(),
    codeChallenge: v.string(),
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthProductionAuthorizationCodeValidatePortResultV1> => {
    const input = readRecord(args, VALIDATE_ARGS_KEYS);
    if (!input || !isValidStorageTimestamp(input.now)) return denyValidate("invalid_input");
    const authorizationCodeDigest = input.authorizationCodeDigest;
    if (!isAuthorizationCodeDigest(authorizationCodeDigest)) return denyValidate("invalid_code_digest");
    const clientId = readBoundedText(input.clientId, MAX_OAUTH_PARAMETER_LENGTH);
    const redirectUri = readSafeHttpsUrl(input.redirectUri, { allowSearch: true });
    const resource = readSafeHttpsUrl(input.resource, { allowSearch: false });
    const codeChallenge = readBoundedText(input.codeChallenge, 128);
    if (!clientId || !redirectUri || !resource || !codeChallenge || !PKCE_S256_CHALLENGE_PATTERN.test(codeChallenge)) {
      return denyValidate("invalid_input");
    }

    const rows = await ctx.db
      .query("mcpOAuthAuthorizationCodes")
      .withIndex("by_authorization_code_digest", (q) =>
        q.eq("authorizationCodeDigest", authorizationCodeDigest),
      )
      .collect();
    if (rows.length === 0) return denyValidate("not_found_or_forbidden");
    if (rows.length > 1) return denyValidate("duplicate_storage_record");

    const row = parseStorageRecord(rows[0]);
    if (!row) return denyValidate("malformed_storage_record");
    if (row.clientId !== clientId || row.redirectUri !== redirectUri || row.resource !== resource || row.codeChallenge !== codeChallenge) {
      return denyValidate("not_found_or_forbidden");
    }
    if (row.status === "consumed") return denyValidate("already_consumed");
    if (row.status === "expired") return denyValidate("expired");
    if (input.now < row.createdAt) return denyValidate("invalid_input");
    if (input.now >= row.expiresAt) return denyValidate("expired");

    return {
      kind: "mcp_oauth_authorization_code_validate_result",
      ok: true,
      reason: "validated",
      serverOnly: {
        status: "pending",
        clientId: row.clientId,
        redirectUri: row.redirectUri,
        resource: row.resource,
        scopes: Object.freeze([...row.scopes]),
        state: row.state,
        codeChallenge: row.codeChallenge,
        codeChallengeMethod: "S256",
        productionEnvironment: row.productionEnvironment,
        expiresAt: row.expiresAt,
        codeConsumed: false,
        tokenIssued: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    };
  },
});

export const internalIssueMcpOAuthAccessTokenFromAuthorizationCode = internalMutation({
  args: {
    authorizationCodeDigest: v.string(),
    accessTokenDigest: v.string(),
    clientId: v.string(),
    redirectUri: v.string(),
    resource: v.string(),
    codeChallenge: v.string(),
    now: v.number(),
    deadlineEpochMs: v.number(),
    timeoutMs: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthProductionAccessTokenIssuePortResultV1> => {
    const input = parseAccessTokenIssueInput(args);
    if (!input) return denyAccessTokenIssue("invalid_input");

    const rows = await ctx.db
      .query("mcpOAuthAuthorizationCodes")
      .withIndex("by_authorization_code_digest", (q) =>
        q.eq("authorizationCodeDigest", input.authorizationCodeDigest),
      )
      .collect();
    if (rows.length === 0) return denyAccessTokenIssue("not_found_or_forbidden");
    if (rows.length > 1) return denyAccessTokenIssue("duplicate_storage_record");

    const row = parseStorageRecord(rows[0]);
    if (!row) return denyAccessTokenIssue("malformed_storage_record");
    if (
      row.clientId !== input.clientId ||
      row.redirectUri !== input.redirectUri ||
      row.resource !== input.resource ||
      row.codeChallenge !== input.codeChallenge
    ) {
      return denyAccessTokenIssue("not_found_or_forbidden");
    }
    if (row.status === "consumed") return denyAccessTokenIssue("already_consumed");
    if (row.status === "expired") return denyAccessTokenIssue("expired");
    if (input.now < row.createdAt) return denyAccessTokenIssue("invalid_input");
    if (input.now >= row.expiresAt) {
      await ctx.db.patch(row._id as never, {
        status: "expired",
        updatedAt: input.now,
      });
      return denyAccessTokenIssue("expired");
    }

    const existingTokenRows = await ctx.db
      .query("mcpOAuthAccessTokens")
      .withIndex("by_access_token_digest", (q) => q.eq("accessTokenDigest", input.accessTokenDigest))
      .take(1);
    if (existingTokenRows.length > 0) return denyAccessTokenIssue("access_token_digest_collision");
    if (!isAccessTokenIssueDeadlineActive(input, Date.now())) return denyAccessTokenIssue("invalid_input");

    const accessTokenRecord = buildAccessTokenRecord(row, input.accessTokenDigest, input.now);
    await ctx.db.insert("mcpOAuthAccessTokens", accessTokenRecord);
    await ctx.db.patch(row._id as never, {
      status: "consumed",
      updatedAt: input.now,
      consumedAt: input.now,
    });

    return {
      kind: "mcp_oauth_access_token_issue_result",
      ok: true,
      reason: "issued",
      serverOnly: {
        tokenType: "Bearer",
        expiresAt: accessTokenRecord.expiresAt,
        expiresIn: Math.floor((accessTokenRecord.expiresAt - input.now) / 1_000),
        clientId: row.clientId,
        redirectUri: row.redirectUri,
        resource: row.resource,
        scopes: Object.freeze([...row.scopes]),
        productionEnvironment: row.productionEnvironment,
        codeConsumed: true,
        tokenIssued: true,
        tokenPersisted: true,
        rawAccessTokenPersisted: false,
        refreshTokenPersisted: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    };
  },
});

export const internalDeleteExpiredMcpOAuthAuthorizationCodes = internalMutation({
  args: {
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthAuthorizationCodeCleanupResultV1> => {
    if (!readRecord(args, CLEANUP_ARGS_KEYS) || !isValidStorageTimestamp(args.now)) {
      return cleanupResult(0);
    }
    const expiredRows = await ctx.db
      .query("mcpOAuthAuthorizationCodes")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", args.now))
      .take(MAX_EXPIRED_CODE_CLEANUP_BATCH);
    for (const row of expiredRows) {
      await ctx.db.delete(row._id);
    }
    return cleanupResult(expiredRows.length);
  },
});

export const internalDeleteExpiredMcpOAuthAccessTokens = internalMutation({
  args: {
    now: v.number(),
    version: v.literal(1),
  },
  returns: v.any(),
  handler: async (ctx, args): Promise<McpOAuthAccessTokenCleanupResultV1> => {
    if (!readRecord(args, CLEANUP_ARGS_KEYS) || !isValidStorageTimestamp(args.now)) {
      return accessTokenCleanupResult(0);
    }
    const expiredRows = await ctx.db
      .query("mcpOAuthAccessTokens")
      .withIndex("by_expires_at", (q) => q.lte("expiresAt", args.now))
      .take(MAX_EXPIRED_ACCESS_TOKEN_CLEANUP_BATCH);
    for (const row of expiredRows) {
      await ctx.db.delete(row._id);
    }
    return accessTokenCleanupResult(expiredRows.length);
  },
});

export function classifyMcpOAuthAuthorizationCodeStorageRecord(value: unknown):
  | "pending_valid"
  | "consumed_valid"
  | "expired_valid"
  | "malformed" {
  const record = parseStorageRecord(value);
  if (!record) return "malformed";
  if (record.status === "pending") return "pending_valid";
  if (record.status === "consumed") return "consumed_valid";
  return "expired_valid";
}

export function classifyMcpOAuthAccessTokenStorageRecord(value: unknown):
  | "active_valid"
  | "expired_valid"
  | "revoked_valid"
  | "malformed" {
  const record = parseAccessTokenStorageRecord(value);
  if (!record) return "malformed";
  if (record.status === "active") return "active_valid";
  if (record.status === "expired") return "expired_valid";
  return "revoked_valid";
}

function parseCreateInput(value: unknown): ParsedAuthorizationCodeCreateInputV1 | undefined {
  const record = readRecord(value, CREATE_ARGS_KEYS, CREATE_REQUIRED_ARGS_KEYS);
  if (!record || record.version !== 1) return undefined;
  if (!isAuthorizationCodeDigest(record.authorizationCodeDigest)) return undefined;
  if (!isValidStorageTimestamp(record.now) || record.now > MAX_SAFE_TIMESTAMP_BEFORE_TTL) return undefined;
  if (!hasValidCreateDeadline(record.deadlineEpochMs, record.timeoutMs, record.now, Date.now())) {
    return undefined;
  }
  if (record.productionEnvironment !== MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT) return undefined;

  const authenticatedOwnerIdentity = parseAuthenticatedOwnerIdentity(record.authenticatedOwnerIdentity);
  const trustedOwner = parseTrustedOwner(record.trustedOwner);
  const authorizationRequest = parseAuthorizationRequest(record.authorizationRequest);
  if (
    !authenticatedOwnerIdentity ||
    !trustedOwner ||
    !authorizationRequest ||
    authenticatedOwnerIdentity.subject !== trustedOwner.twoweeksClerkId
  ) {
    return undefined;
  }

  return {
    authorizationCodeDigest: record.authorizationCodeDigest,
    authenticatedOwnerIdentity,
    trustedOwner,
    authorizationRequest,
    now: record.now,
  };
}

function parseAccessTokenIssueInput(value: unknown): ParsedAccessTokenIssueInputV1 | undefined {
  const record = readRecord(value, ISSUE_ACCESS_TOKEN_ARGS_KEYS);
  if (!record || record.version !== 1) return undefined;
  if (!isValidStorageTimestamp(record.now) || record.now > MAX_SAFE_TIMESTAMP_BEFORE_ACCESS_TOKEN_TTL) return undefined;
  const deadlineEpochMs = record.deadlineEpochMs;
  const timeoutMs = record.timeoutMs;
  if (!hasValidAccessTokenIssueDeadline(deadlineEpochMs, timeoutMs, Date.now())) return undefined;
  if (!isAuthorizationCodeDigest(record.authorizationCodeDigest)) return undefined;
  if (!isAuthorizationCodeDigest(record.accessTokenDigest)) return undefined;
  const clientId = readBoundedText(record.clientId, MAX_OAUTH_PARAMETER_LENGTH);
  const redirectUri = readSafeHttpsUrl(record.redirectUri, { allowSearch: true });
  const resource = readSafeHttpsUrl(record.resource, { allowSearch: false });
  const codeChallenge = readBoundedText(record.codeChallenge, 128);
  if (!clientId || !redirectUri || !resource || !codeChallenge || !PKCE_S256_CHALLENGE_PATTERN.test(codeChallenge)) {
    return undefined;
  }
  return {
    authorizationCodeDigest: record.authorizationCodeDigest,
    accessTokenDigest: record.accessTokenDigest,
    clientId,
    redirectUri,
    resource,
    codeChallenge,
    now: record.now,
    deadlineEpochMs: deadlineEpochMs as number,
    timeoutMs: timeoutMs as number,
  };
}

function buildAuthorizationCodeRecord(
  input: ParsedAuthorizationCodeCreateInputV1,
): McpOAuthAuthorizationCodeRecordV1 {
  return {
    kind: "mcp_oauth_authorization_code_record",
    version: 1,
    authorizationCodeDigest: input.authorizationCodeDigest,
    twoweeksClerkId: input.trustedOwner.twoweeksClerkId,
    ownerIssuer: input.authenticatedOwnerIdentity.issuer,
    clientId: input.authorizationRequest.clientId,
    redirectUri: input.authorizationRequest.redirectUri,
    resource: input.authorizationRequest.resource,
    scopes: [...input.authorizationRequest.scopes],
    state: input.authorizationRequest.state,
    codeChallenge: input.authorizationRequest.codeChallenge,
    codeChallengeMethod: "S256",
    productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
    status: "pending",
    createdAt: input.now,
    updatedAt: input.now,
    expiresAt: input.now + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS,
    storageVersion: 1,
  };
}

function buildAccessTokenRecord(
  authorizationCode: StoredMcpOAuthAuthorizationCodeRecordV1,
  accessTokenDigest: string,
  now: number,
): McpOAuthAccessTokenRecordV1 {
  return {
    kind: "mcp_oauth_access_token_record",
    version: 1,
    accessTokenDigest,
    authorizationCodeDigest: authorizationCode.authorizationCodeDigest,
    twoweeksClerkId: authorizationCode.twoweeksClerkId,
    ownerIssuer: authorizationCode.ownerIssuer,
    clientId: authorizationCode.clientId,
    redirectUri: authorizationCode.redirectUri,
    resource: authorizationCode.resource,
    scopes: [...authorizationCode.scopes],
    productionEnvironment: authorizationCode.productionEnvironment,
    status: "active",
    issuedAt: now,
    updatedAt: now,
    expiresAt: now + MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
    storageVersion: 1,
  };
}

function parseAuthenticatedOwnerIdentity(value: unknown): McpOAuthProductionAuthenticatedOwnerIdentityV1 | undefined {
  const record = readRecord(value, OWNER_IDENTITY_KEYS);
  if (!record || record.version !== 1) return undefined;
  const subject = readBoundedText(record.subject, MAX_OAUTH_PARAMETER_LENGTH);
  const issuer = readSafeHttpsUrl(record.issuer, { allowSearch: false });
  if (!subject || !SAFE_IDENTIFIER_PATTERN.test(subject) || !issuer) return undefined;
  return { subject, issuer, version: 1 };
}

function parseTrustedOwner(value: unknown): McpOAuthAuthorizationTrustedOwnerV1 | undefined {
  const record = readRecord(value, TRUSTED_OWNER_KEYS);
  if (!record || record.kind !== "mcp_oauth_authorization_trusted_owner" || record.version !== 1) {
    return undefined;
  }
  const twoweeksClerkId = readBoundedText(record.twoweeksClerkId, MAX_OAUTH_PARAMETER_LENGTH);
  if (!twoweeksClerkId || !SAFE_IDENTIFIER_PATTERN.test(twoweeksClerkId)) return undefined;
  return { kind: "mcp_oauth_authorization_trusted_owner", twoweeksClerkId, version: 1 };
}

function parseAuthorizationRequest(
  value: unknown,
): McpOAuthProductionAuthorizationCodeCreatePortInputV1["authorizationRequest"] | undefined {
  const record = readRecord(value, AUTHORIZATION_REQUEST_KEYS);
  if (!record || record.version !== 1) return undefined;
  const clientId = readBoundedText(record.clientId, MAX_OAUTH_PARAMETER_LENGTH);
  const redirectUri = readSafeHttpsUrl(record.redirectUri, { allowSearch: true });
  const resource = readSafeHttpsUrl(record.resource, { allowSearch: false });
  const scopes = parseScopes(record.scopes);
  const state = readBoundedText(record.state, MAX_STATE_LENGTH);
  const codeChallenge = readBoundedText(record.codeChallenge, 128);
  if (
    !clientId ||
    !redirectUri ||
    !resource ||
    !scopes ||
    !state ||
    !codeChallenge ||
    record.codeChallengeMethod !== "S256" ||
    !PKCE_S256_CHALLENGE_PATTERN.test(codeChallenge)
  ) {
    return undefined;
  }
  return Object.freeze({
    clientId,
    redirectUri,
    resource,
    scopes,
    state,
    codeChallenge,
    codeChallengeMethod: "S256",
    version: 1,
  });
}

function parseStorageRecord(value: unknown): StoredMcpOAuthAuthorizationCodeRecordV1 | undefined {
  const record = readRecord(value, STORAGE_RECORD_KEYS, STORAGE_RECORD_REQUIRED_KEYS);
  if (!record || record.kind !== "mcp_oauth_authorization_code_record" || record.version !== 1) return undefined;
  if (!isAuthorizationCodeDigest(record.authorizationCodeDigest)) return undefined;
  const twoweeksClerkId = readBoundedText(record.twoweeksClerkId, MAX_OAUTH_PARAMETER_LENGTH);
  const ownerIssuer = readSafeHttpsUrl(record.ownerIssuer, { allowSearch: false });
  const authorizationRequest = parseAuthorizationRequest({
    clientId: record.clientId,
    redirectUri: record.redirectUri,
    resource: record.resource,
    scopes: record.scopes,
    state: record.state,
    codeChallenge: record.codeChallenge,
    codeChallengeMethod: record.codeChallengeMethod,
    version: 1,
  });
  if (
    !twoweeksClerkId ||
    !SAFE_IDENTIFIER_PATTERN.test(twoweeksClerkId) ||
    !ownerIssuer ||
    !authorizationRequest ||
    record.productionEnvironment !== MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT ||
    !isValidStatus(record.status) ||
    !isValidStorageTimestamp(record.createdAt) ||
    !isValidStorageTimestamp(record.updatedAt) ||
    !isValidStorageTimestamp(record.expiresAt) ||
    record.expiresAt - record.createdAt !== MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS ||
    record.storageVersion !== 1 ||
    !hasValidTerminalTimestamp(record)
  ) {
    return undefined;
  }
  return {
    kind: "mcp_oauth_authorization_code_record",
    version: 1,
    authorizationCodeDigest: record.authorizationCodeDigest,
    twoweeksClerkId,
    ownerIssuer,
    clientId: authorizationRequest.clientId,
    redirectUri: authorizationRequest.redirectUri,
    resource: authorizationRequest.resource,
    scopes: [...authorizationRequest.scopes],
    state: authorizationRequest.state,
    codeChallenge: authorizationRequest.codeChallenge,
    codeChallengeMethod: "S256",
    productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
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

function parseAccessTokenStorageRecord(value: unknown): StoredMcpOAuthAccessTokenRecordV1 | undefined {
  const record = readRecord(value, ACCESS_TOKEN_STORAGE_RECORD_KEYS, ACCESS_TOKEN_STORAGE_RECORD_REQUIRED_KEYS);
  if (!record || record.kind !== "mcp_oauth_access_token_record" || record.version !== 1) return undefined;
  if (!isAuthorizationCodeDigest(record.accessTokenDigest) || !isAuthorizationCodeDigest(record.authorizationCodeDigest)) {
    return undefined;
  }
  const identity = parseAccessTokenOwnerBinding(record);
  const authorizationRequest = parseAccessTokenAuthorizationBinding(record);
  if (!identity || !authorizationRequest || !hasValidAccessTokenStorageMetadata(record)) return undefined;
  return {
    kind: "mcp_oauth_access_token_record",
    version: 1,
    accessTokenDigest: record.accessTokenDigest,
    authorizationCodeDigest: record.authorizationCodeDigest,
    twoweeksClerkId: identity.twoweeksClerkId,
    ownerIssuer: identity.ownerIssuer,
    clientId: authorizationRequest.clientId,
    redirectUri: authorizationRequest.redirectUri,
    resource: authorizationRequest.resource,
    scopes: [...authorizationRequest.scopes],
    productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
    status: record.status,
    issuedAt: record.issuedAt,
    updatedAt: record.updatedAt,
    expiresAt: record.expiresAt,
    storageVersion: 1,
    ...(record._id !== undefined ? { _id: record._id } : {}),
    ...(typeof record._creationTime === "number" ? { _creationTime: record._creationTime } : {}),
  };
}

function parseAccessTokenOwnerBinding(
  record: Record<string, unknown>,
): Readonly<{ twoweeksClerkId: string; ownerIssuer: string }> | undefined {
  const twoweeksClerkId = readBoundedText(record.twoweeksClerkId, MAX_OAUTH_PARAMETER_LENGTH);
  const ownerIssuer = readSafeHttpsUrl(record.ownerIssuer, { allowSearch: false });
  if (!twoweeksClerkId || !SAFE_IDENTIFIER_PATTERN.test(twoweeksClerkId) || !ownerIssuer) return undefined;
  return { twoweeksClerkId, ownerIssuer };
}

function parseAccessTokenAuthorizationBinding(
  record: Record<string, unknown>,
): Readonly<{ clientId: string; redirectUri: string; resource: string; scopes: readonly string[] }> | undefined {
  const clientId = readBoundedText(record.clientId, MAX_OAUTH_PARAMETER_LENGTH);
  const redirectUri = readSafeHttpsUrl(record.redirectUri, { allowSearch: true });
  const resource = readSafeHttpsUrl(record.resource, { allowSearch: false });
  const scopes = parseScopes(record.scopes);
  if (!clientId || !redirectUri || !resource || !scopes) return undefined;
  return { clientId, redirectUri, resource, scopes };
}

function hasValidAccessTokenStorageMetadata(record: Record<string, unknown>): boolean {
  return (
    record.productionEnvironment === MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT &&
    isValidAccessTokenStatus(record.status) &&
    isValidStorageTimestamp(record.issuedAt) &&
    isValidStorageTimestamp(record.updatedAt) &&
    isValidStorageTimestamp(record.expiresAt) &&
    record.expiresAt - record.issuedAt === MCP_OAUTH_ACCESS_TOKEN_TTL_MS &&
    record.storageVersion === 1
  );
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
  return requiredKeys.every((key) => Object.prototype.hasOwnProperty.call(record, key))
    ? record
    : undefined;
}

function parseScopes(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_SCOPE_COUNT) return undefined;
  const scopes = value.map((scope) => readBoundedText(scope, 128));
  if (scopes.some((scope) => !scope || !SAFE_SCOPE_PATTERN.test(scope))) return undefined;
  const unique = [...new Set(scopes as string[])];
  return unique.length === scopes.length ? Object.freeze(unique) : undefined;
}

function readBoundedText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > maxLength) return undefined;
  return hasControlCharacter(value) ? undefined : value;
}

function readSafeHttpsUrl(value: unknown, options: Readonly<{ allowSearch: boolean }>): string | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > MAX_OAUTH_PARAMETER_LENGTH) {
    return undefined;
  }
  if (hasControlCharacter(value)) return undefined;
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.origin === "null" ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.hash ||
      (!options.allowSearch && url.search)
    ) {
      return undefined;
    }
    return url.toString();
  } catch {
    return undefined;
  }
}

function hasValidCreateDeadline(
  deadlineEpochMs: unknown,
  timeoutMs: unknown,
  now: number,
  wallClockNow: number,
): boolean {
  if (deadlineEpochMs === undefined && timeoutMs === undefined) return true;
  return (
    typeof deadlineEpochMs === "number" &&
    typeof timeoutMs === "number" &&
    Number.isSafeInteger(deadlineEpochMs) &&
    Number.isSafeInteger(timeoutMs) &&
    timeoutMs > 0 &&
    timeoutMs <= 10_000 &&
    deadlineEpochMs === now + timeoutMs &&
    wallClockNow <= deadlineEpochMs
  );
}

function hasValidAccessTokenIssueDeadline(
  deadlineEpochMs: unknown,
  timeoutMs: unknown,
  wallClockNow: number,
): deadlineEpochMs is number {
  return (
    typeof deadlineEpochMs === "number" &&
    typeof timeoutMs === "number" &&
    Number.isSafeInteger(deadlineEpochMs) &&
    Number.isSafeInteger(timeoutMs) &&
    timeoutMs > 0 &&
    timeoutMs <= 10_000 &&
    deadlineEpochMs >= wallClockNow &&
    deadlineEpochMs - wallClockNow <= timeoutMs
  );
}

function isAccessTokenIssueDeadlineActive(
  input: ParsedAccessTokenIssueInputV1,
  wallClockNow: number,
): boolean {
  return hasValidAccessTokenIssueDeadline(input.deadlineEpochMs, input.timeoutMs, wallClockNow);
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

function isAuthorizationCodeDigest(value: unknown): value is string {
  return typeof value === "string" && CODE_DIGEST_PATTERN.test(value);
}

function isValidStorageTimestamp(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function isValidStatus(value: unknown): value is McpOAuthAuthorizationCodeStatusV1 {
  return value === "pending" || value === "consumed" || value === "expired";
}

function isValidAccessTokenStatus(value: unknown): value is McpOAuthAccessTokenStatusV1 {
  return value === "active" || value === "expired" || value === "revoked";
}

function hasControlCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

function denyCreate(reason: string): McpOAuthProductionAuthorizationCodeCreatePortResultV1 {
  return {
    kind: "mcp_oauth_authorization_code_create_result",
    ok: false,
    reason,
    safeFailure: safeFailure(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function denyConsume(
  reason: Extract<McpOAuthAuthorizationCodeConsumeResultV1, { ok: false }>["reason"],
): McpOAuthAuthorizationCodeConsumeResultV1 {
  return {
    kind: "mcp_oauth_authorization_code_consume_result",
    ok: false,
    reason,
    safeFailure: safeFailure(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function denyValidate(
  reason: Extract<McpOAuthProductionAuthorizationCodeValidatePortResultV1, { ok: false }>["reason"],
): McpOAuthProductionAuthorizationCodeValidatePortResultV1 {
  return {
    kind: "mcp_oauth_authorization_code_validate_result",
    ok: false,
    reason,
    safeFailure: safeFailure(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function denyAccessTokenIssue(
  reason: Extract<McpOAuthProductionAccessTokenIssuePortResultV1, { ok: false }>["reason"],
): McpOAuthProductionAccessTokenIssuePortResultV1 {
  return {
    kind: "mcp_oauth_access_token_issue_result",
    ok: false,
    reason,
    safeFailure: safeFailure(),
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function safeFailure(): SafeAuthorizationCodeFailureV1 {
  return {
    code: "mcp_oauth_authorization_code_denied",
    message: "Authorization code denied.",
    safeForModel: true,
    rawCodeEchoed: false,
    digestEchoed: false,
    identityEchoed: false,
    sensitiveValuesEchoed: false,
    version: 1,
  };
}

function cleanupResult(deletedCount: number): McpOAuthAuthorizationCodeCleanupResultV1 {
  return {
    kind: "mcp_oauth_authorization_code_cleanup_result",
    ok: true,
    deletedCount,
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function accessTokenCleanupResult(deletedCount: number): McpOAuthAccessTokenCleanupResultV1 {
  return {
    kind: "mcp_oauth_access_token_cleanup_result",
    ok: true,
    deletedCount,
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}
