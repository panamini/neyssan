import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  classifyMcpOAuthAccessTokenStorageRecord,
  classifyMcpOAuthAuthorizationCodeStorageRecord,
  internalConsumeMcpOAuthAuthorizationCode,
  internalCreateMcpOAuthAuthorizationCode,
  internalDeleteExpiredMcpOAuthAccessTokens,
  internalIssueMcpOAuthAccessTokenFromAuthorizationCode,
  internalValidateMcpOAuthAuthorizationCodeForTokenBoundary,
  internalVerifyMcpOAuthAccessTokenForMcpBoundary,
  MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
  MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
  MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS,
  type McpOAuthAccessTokenRecordV1,
  type McpOAuthAuthorizationCodeRecordV1,
} from "../mcpOAuthAuthorizationCodes";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../../src/modules/local-mcp/mcpAuthPolicyBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpOAuthAuthorizationCodes.ts");
const SCHEMA_FILE = resolve(TEST_DIR, "../schema.ts");
const NOW = Date.UTC(2026, 5, 28, 12, 0, 0, 0);
const RAW_CODE = "C".repeat(43);
const CODE_DIGEST = sha256Hex(RAW_CODE);
const RAW_ACCESS_TOKEN = "T".repeat(43);
const ACCESS_TOKEN_DIGEST = sha256Hex(RAW_ACCESS_TOKEN);
const OWNER_ID = "user_twoweeks_fixture_123";
const OWNER_ISSUER = "https://clerk.twoweeks.example.test";
const CLIENT_ID = "chatgpt_apps_sdk_client";
const REDIRECT_URI = "https://chatgpt.example.test/connector/oauth/callback-fixture";
const RESOURCE = "https://mcp.twoweeks.example.test/resource";
const STATE = "opaque_state_1234567890";
const PKCE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

type StoredCodeRecord = McpOAuthAuthorizationCodeRecordV1 & {
  _id: string;
  _creationTime: number;
};

type StoredAccessTokenRecord = McpOAuthAccessTokenRecordV1 & {
  _id: string;
  _creationTime: number;
};

type Constraint = Readonly<{ field: string; op: "eq" | "lte"; value: unknown }>;
type IndexConstraintBuilder = Readonly<{
  eq: (field: string, value: unknown) => IndexConstraintBuilder;
  lte: (field: string, value: unknown) => IndexConstraintBuilder;
}>;

describe("Convex MCP OAuth authorization codes", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stores only a digest-backed pending authorization code state", async () => {
    const { ctx, rows, inserts } = makeCtx();

    const result = await internalCreateMcpOAuthAuthorizationCode._handler(ctx as any, createArgs());

    expect(result).toMatchObject({
      kind: "mcp_oauth_authorization_code_create_result",
      ok: true,
      reason: "created",
      serverOnly: {
        status: "pending",
        expiresAt: NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS,
        rawAuthorizationCodePersisted: false,
      },
      modelVisible: false,
      safeForLogging: false,
    });
    expect(inserts).toHaveLength(1);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      authorizationCodeDigest: CODE_DIGEST,
      twoweeksClerkId: OWNER_ID,
      ownerIssuer: new URL(OWNER_ISSUER).toString(),
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
      state: STATE,
      codeChallenge: PKCE,
      codeChallengeMethod: "S256",
      productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
      status: "pending",
    });
    expect(JSON.stringify(rows[0])).not.toContain(RAW_CODE);
    expect(Object.keys(rows[0])).not.toContain("authorizationCode");
    expect(Object.keys(rows[0])).not.toContain("accessToken");
    expect(Object.keys(rows[0])).not.toContain("refreshToken");
  });

  it("consumes a pending code digest once and rejects replay", async () => {
    const { ctx, rows, patches } = makeCtx([storedCode()]);

    const first = await internalConsumeMcpOAuthAuthorizationCode._handler(ctx as any, consumeArgs({ now: NOW + 1 }));
    const replay = await internalConsumeMcpOAuthAuthorizationCode._handler(ctx as any, consumeArgs({ now: NOW + 2 }));

    expect(first).toMatchObject({
      ok: true,
      reason: "consumed",
      serverOnly: {
        trustedOwner: {
          kind: "mcp_oauth_authorization_trusted_owner",
          twoweeksClerkId: OWNER_ID,
          version: 1,
        },
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        resource: RESOURCE,
        scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
        state: STATE,
        codeChallenge: PKCE,
        codeChallengeMethod: "S256",
        productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
      },
      modelVisible: false,
      safeForLogging: false,
    });
    expect(replay).toMatchObject({ ok: false, reason: "already_consumed" });
    expect(rows[0]).toMatchObject({ status: "consumed", consumedAt: NOW + 1, updatedAt: NOW + 1 });
    expect(patches).toHaveLength(1);
    expect(JSON.stringify(replay)).not.toContain(CODE_DIGEST);
    expect(JSON.stringify(replay)).not.toContain(RAW_CODE);
  });

  it("validates a pending code digest for the token boundary without consuming it", async () => {
    const { ctx, rows, patches } = makeCtx([storedCode()]);

    const result = await internalValidateMcpOAuthAuthorizationCodeForTokenBoundary._handler(
      ctx as any,
      validateArgs({ now: NOW + 1 }),
    );
    const replay = await internalValidateMcpOAuthAuthorizationCodeForTokenBoundary._handler(
      ctx as any,
      validateArgs({ now: NOW + 2 }),
    );

    expect(result).toMatchObject({
      ok: true,
      reason: "validated",
      serverOnly: {
        status: "pending",
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        resource: RESOURCE,
        scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
        state: STATE,
        codeChallenge: PKCE,
        codeChallengeMethod: "S256",
        productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
        codeConsumed: false,
        tokenIssued: false,
      },
      modelVisible: false,
      safeForLogging: false,
    });
    expect(replay).toMatchObject({ ok: true, reason: "validated" });
    expect(rows[0]).toMatchObject({ status: "pending", updatedAt: NOW });
    expect(rows[0]).not.toHaveProperty("consumedAt");
    expect(patches).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(CODE_DIGEST);
    expect(JSON.stringify(result)).not.toContain(RAW_CODE);
  });

  it("atomically issues a digest-backed access token and consumes the authorization code", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + 1);
    const { ctx, rows, accessTokenRows, patches, inserts } = makeCtx([storedCode()]);

    const result = await internalIssueMcpOAuthAccessTokenFromAuthorizationCode._handler(
      ctx as any,
      issueAccessTokenArgs({ now: NOW + 1 }),
    );
    const replay = await internalIssueMcpOAuthAccessTokenFromAuthorizationCode._handler(
      ctx as any,
      issueAccessTokenArgs({ now: NOW + 2, accessTokenDigest: sha256Hex("U".repeat(43)) }),
    );

    expect(result).toMatchObject({
      ok: true,
      reason: "issued",
      serverOnly: {
        tokenType: "Bearer",
        issuedAt: NOW + 1,
        expiresAt: NOW + 1 + MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
        expiresIn: 3_600,
        clientId: CLIENT_ID,
        redirectUri: REDIRECT_URI,
        resource: RESOURCE,
        codeChallenge: PKCE,
        scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
        productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
        codeConsumed: true,
        tokenIssued: true,
        tokenPersisted: true,
        rawAccessTokenPersisted: false,
        refreshTokenPersisted: false,
      },
      modelVisible: false,
      safeForLogging: false,
    });
    expect(replay).toMatchObject({ ok: false, reason: "already_consumed" });
    expect(rows[0]).toMatchObject({ status: "consumed", consumedAt: NOW + 1, updatedAt: NOW + 1 });
    expect(accessTokenRows).toHaveLength(1);
    expect(accessTokenRows[0]).toMatchObject({
      accessTokenDigest: ACCESS_TOKEN_DIGEST,
      authorizationCodeDigest: CODE_DIGEST,
      twoweeksClerkId: OWNER_ID,
      ownerIssuer: new URL(OWNER_ISSUER).toString(),
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
      status: "active",
      issuedAt: NOW + 1,
      expiresAt: NOW + 1 + MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
    });
    expect(inserts).toHaveLength(1);
    expect(patches).toHaveLength(1);
    expect(JSON.stringify(accessTokenRows[0])).not.toContain(RAW_ACCESS_TOKEN);
    expect(Object.keys(accessTokenRows[0])).not.toContain("accessToken");
    expect(JSON.stringify(result)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(replay)).not.toContain(CODE_DIGEST);
  });

  it("verifies active digest-backed access tokens for the MCP boundary", async () => {
    const { ctx, patches } = makeCtx([], [storedAccessToken()]);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const result = await internalVerifyMcpOAuthAccessTokenForMcpBoundary._handler(
      ctx as any,
      verifyAccessTokenArgs(),
    );

    expect(result).toMatchObject({
      kind: "mcp_oauth_access_token_verify_result",
      ok: true,
      reason: "verified",
      serverOnly: {
        status: "active",
        twoweeksClerkId: OWNER_ID,
        ownerIssuer: new URL(OWNER_ISSUER).toString(),
        clientId: CLIENT_ID,
        resource: RESOURCE,
        scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
        productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
        expiresAt: NOW + MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
        tokenActive: true,
        tokenExpired: false,
        tokenRevoked: false,
        rawAccessTokenPersisted: false,
        rawAccessTokenEchoed: false,
        digestEchoed: false,
      },
      modelVisible: false,
      safeForLogging: false,
    });
    expect(patches).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("accepts configured access-token verifier allowlists larger than sixteen clients", async () => {
    const allowedClientIds = Array.from({ length: 20 }, (_value, index) => `chatgpt_apps_sdk_client_${index}`);
    const matchingClientId = allowedClientIds[17];
    const { ctx, patches } = makeCtx([], [storedAccessToken({ clientId: matchingClientId })]);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const result = await internalVerifyMcpOAuthAccessTokenForMcpBoundary._handler(
      ctx as any,
      verifyAccessTokenArgs({ allowedClientIds }),
    );

    expect(result).toMatchObject({
      kind: "mcp_oauth_access_token_verify_result",
      ok: true,
      reason: "verified",
      serverOnly: {
        clientId: matchingClientId,
        resource: RESOURCE,
        tokenActive: true,
        tokenExpired: false,
        tokenRevoked: false,
      },
    });
    expect(patches).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it.each([
    ["digest miss", [], verifyAccessTokenArgs({ accessTokenDigest: sha256Hex("R".repeat(43)) }), "not_found_or_forbidden"],
    [
      "expired token",
      [storedAccessToken({ issuedAt: NOW - MCP_OAUTH_ACCESS_TOKEN_TTL_MS, updatedAt: NOW, expiresAt: NOW })],
      verifyAccessTokenArgs(),
      "expired",
    ],
    ["revoked token", [storedAccessToken({ status: "revoked" })], verifyAccessTokenArgs(), "inactive"],
    ["wrong client", [storedAccessToken({ clientId: "other_client" })], verifyAccessTokenArgs(), "wrong_client"],
    [
      "wrong resource",
      [storedAccessToken({ resource: "https://mcp.twoweeks.example.test/other-resource" })],
      verifyAccessTokenArgs(),
      "wrong_resource",
    ],
    ["missing scope", [storedAccessToken({ scopes: ["openid"] })], verifyAccessTokenArgs(), "missing_required_scope"],
    [
      "unauthorized scope",
      [storedAccessToken({ scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "twoweeks:write"] })],
      verifyAccessTokenArgs(),
      "unauthorized_scope_state",
    ],
  ] as const)("fails access-token verification for %s", async (_label, seed, args, reason) => {
    const { ctx, patches } = makeCtx([], seed);
    vi.spyOn(Date, "now").mockReturnValue(NOW);

    const result = await internalVerifyMcpOAuthAccessTokenForMcpBoundary._handler(ctx as any, args);

    expect(result).toMatchObject({
      kind: "mcp_oauth_access_token_verify_result",
      ok: false,
      reason,
      safeFailure: {
        code: "mcp_oauth_access_token_denied",
        rawTokenEchoed: false,
        digestEchoed: false,
        identityEchoed: false,
        sensitiveValuesEchoed: false,
      },
      modelVisible: false,
      safeForLogging: true,
    });
    expect(patches).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("uses Convex storage time, not caller time, for final access-token expiry checks", async () => {
    const { ctx } = makeCtx([], [storedAccessToken()]);
    vi.spyOn(Date, "now").mockReturnValue(NOW + MCP_OAUTH_ACCESS_TOKEN_TTL_MS + 1);

    const result = await internalVerifyMcpOAuthAccessTokenForMcpBoundary._handler(
      ctx as any,
      verifyAccessTokenArgs({ now: NOW }),
    );

    expect(result).toMatchObject({
      kind: "mcp_oauth_access_token_verify_result",
      ok: false,
      reason: "expired",
    });
    expect(JSON.stringify(result)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("does not reject fresh access tokens when caller time is ahead of Convex storage time", async () => {
    const { ctx } = makeCtx([], [storedAccessToken()]);
    vi.spyOn(Date, "now").mockReturnValue(NOW + 1);

    const result = await internalVerifyMcpOAuthAccessTokenForMcpBoundary._handler(
      ctx as any,
      verifyAccessTokenArgs({ now: NOW + MCP_OAUTH_ACCESS_TOKEN_TTL_MS + 1 }),
    );

    expect(result).toMatchObject({
      kind: "mcp_oauth_access_token_verify_result",
      ok: true,
      reason: "verified",
      serverOnly: {
        tokenActive: true,
        tokenExpired: false,
        tokenRevoked: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("keeps issued-at validation bounded to storage-side clock skew", async () => {
    const { ctx } = makeCtx([], [storedAccessToken()]);
    vi.spyOn(Date, "now").mockReturnValue(NOW - 120_001);

    const result = await internalVerifyMcpOAuthAccessTokenForMcpBoundary._handler(
      ctx as any,
      verifyAccessTokenArgs({ now: NOW }),
    );

    expect(result).toMatchObject({
      kind: "mcp_oauth_access_token_verify_result",
      ok: false,
      reason: "malformed_storage_record",
    });
    expect(JSON.stringify(result)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("treats an unavailable Convex storage clock as retryable storage failure", async () => {
    const { ctx } = makeCtx([], [storedAccessToken()]);
    vi.spyOn(Date, "now").mockReturnValue(Number.NaN);

    const result = await internalVerifyMcpOAuthAccessTokenForMcpBoundary._handler(
      ctx as any,
      verifyAccessTokenArgs({ now: NOW }),
    );

    expect(result).toMatchObject({
      kind: "mcp_oauth_access_token_verify_result",
      ok: false,
      reason: "storage_unavailable",
    });
    expect(JSON.stringify(result)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN_DIGEST);
  });

  it("does not consume the authorization code when access-token persistence cannot proceed", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + 1);
    const { ctx, rows, accessTokenRows, patches } = makeCtx([storedCode()], [storedAccessToken()]);

    const result = await internalIssueMcpOAuthAccessTokenFromAuthorizationCode._handler(
      ctx as any,
      issueAccessTokenArgs({ now: NOW + 1 }),
    );

    expect(result).toMatchObject({ ok: false, reason: "access_token_digest_collision" });
    expect(rows[0]).toMatchObject({ status: "pending", updatedAt: NOW });
    expect(rows[0]).not.toHaveProperty("consumedAt");
    expect(accessTokenRows).toHaveLength(1);
    expect(patches).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(result)).not.toContain(CODE_DIGEST);
  });

  it("does not consume the authorization code after the access-token issue deadline elapses", async () => {
    const { ctx, rows, accessTokenRows, patches } = makeCtx([storedCode()]);

    const result = await internalIssueMcpOAuthAccessTokenFromAuthorizationCode._handler(
      ctx as any,
      issueAccessTokenArgs({ deadlineEpochMs: Date.now() - 1_000 }),
    );

    expect(result).toMatchObject({ ok: false, reason: "invalid_input" });
    expect(rows[0]).toMatchObject({ status: "pending", updatedAt: NOW });
    expect(rows[0]).not.toHaveProperty("consumedAt");
    expect(accessTokenRows).toHaveLength(0);
    expect(patches).toHaveLength(0);
    expect(JSON.stringify(result)).not.toContain(RAW_ACCESS_TOKEN);
    expect(JSON.stringify(result)).not.toContain(ACCESS_TOKEN_DIGEST);
    expect(JSON.stringify(result)).not.toContain(CODE_DIGEST);
  });

  it("rejects stale caller time even when a fresh deadline is supplied", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS);
    const { ctx, rows, accessTokenRows, patches } = makeCtx([storedCode()]);

    const result = await internalIssueMcpOAuthAccessTokenFromAuthorizationCode._handler(
      ctx as any,
      issueAccessTokenArgs({
        now: NOW + 1,
        deadlineEpochMs: NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS + 2_500,
      }),
    );

    expect(result).toMatchObject({ ok: false, reason: "invalid_input" });
    expect(rows[0]).toMatchObject({ status: "pending", updatedAt: NOW });
    expect(rows[0]).not.toHaveProperty("consumedAt");
    expect(accessTokenRows).toHaveLength(0);
    expect(patches).toHaveLength(0);
  });

  it("expires authorization codes using the storage-side clock before token issuance", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS);
    const { ctx, rows, accessTokenRows, patches } = makeCtx([storedCode()]);

    const result = await internalIssueMcpOAuthAccessTokenFromAuthorizationCode._handler(
      ctx as any,
      issueAccessTokenArgs({
        now: NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS,
        deadlineEpochMs: NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS + 2_500,
      }),
    );

    expect(result).toMatchObject({ ok: false, reason: "expired" });
    expect(rows[0]).toMatchObject({
      status: "expired",
      updatedAt: NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS,
    });
    expect(rows[0]).not.toHaveProperty("consumedAt");
    expect(accessTokenRows).toHaveLength(0);
    expect(patches).toHaveLength(1);
  });

  it("accepts token issuance when the storage clock is slightly behind the caller", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW - 500);
    const { ctx, rows, accessTokenRows } = makeCtx([storedCode()]);

    const result = await internalIssueMcpOAuthAccessTokenFromAuthorizationCode._handler(
      ctx as any,
      issueAccessTokenArgs({
        now: NOW,
        deadlineEpochMs: NOW + 2_500,
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      reason: "issued",
      serverOnly: {
        issuedAt: NOW,
        expiresAt: NOW + MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
        expiresIn: 3_600,
      },
    });
    expect(rows[0]).toMatchObject({ status: "consumed", consumedAt: NOW, updatedAt: NOW });
    expect(accessTokenRows[0]).toMatchObject({ issuedAt: NOW, expiresAt: NOW + MCP_OAUTH_ACCESS_TOKEN_TTL_MS });
  });

  it("accepts token issuance when the storage clock is ahead within the skew allowance", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + 3_000);
    const { ctx, rows, accessTokenRows } = makeCtx([storedCode()]);

    const result = await internalIssueMcpOAuthAccessTokenFromAuthorizationCode._handler(
      ctx as any,
      issueAccessTokenArgs({
        now: NOW,
        deadlineEpochMs: NOW + 2_500,
      }),
    );

    expect(result).toMatchObject({
      ok: true,
      reason: "issued",
      serverOnly: {
        issuedAt: NOW + 3_000,
        expiresAt: NOW + 3_000 + MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
        expiresIn: 3_600,
      },
    });
    expect(rows[0]).toMatchObject({ status: "consumed", consumedAt: NOW + 3_000, updatedAt: NOW + 3_000 });
    expect(accessTokenRows[0]).toMatchObject({
      issuedAt: NOW + 3_000,
      expiresAt: NOW + 3_000 + MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
    });
  });

  it("marks expired pending code digests without returning code state", async () => {
    const { ctx, rows, patches } = makeCtx([storedCode()]);

    const result = await internalConsumeMcpOAuthAuthorizationCode._handler(
      ctx as any,
      consumeArgs({ now: NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS }),
    );

    expect(result).toMatchObject({ ok: false, reason: "expired" });
    expect(rows[0]).toMatchObject({
      status: "expired",
      updatedAt: NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS,
    });
    expect(rows[0]).not.toHaveProperty("consumedAt");
    expect(patches).toHaveLength(1);
    expect(JSON.stringify(result)).not.toContain(STATE);
    expect(JSON.stringify(result)).not.toContain(CODE_DIGEST);
  });

  it("deletes expired access-token records in a bounded internal cleanup pass", async () => {
    const expiredAccessToken = storedAccessToken({ _id: "mcpOAuthAccessTokens_expired_active" });
    const activeAccessToken = storedAccessToken({
      _id: "mcpOAuthAccessTokens_active",
      accessTokenDigest: sha256Hex("V".repeat(43)),
      issuedAt: NOW + 2,
      updatedAt: NOW + 2,
      expiresAt: NOW + 2 + MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
    });
    const { ctx, accessTokenRows, deletes } = makeCtx([], [expiredAccessToken, activeAccessToken]);

    const result = await internalDeleteExpiredMcpOAuthAccessTokens._handler(ctx as any, {
      now: NOW + MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
      version: 1,
    });

    expect(result).toEqual({
      kind: "mcp_oauth_access_token_cleanup_result",
      ok: true,
      deletedCount: 1,
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
    expect(deletes).toEqual(["mcpOAuthAccessTokens_expired_active"]);
    expect(accessTokenRows).toHaveLength(1);
    expect(accessTokenRows[0]._id).toBe("mcpOAuthAccessTokens_active");
  });

  it("rejects duplicate, malformed, and client-mismatched code digest access", async () => {
    await expect(consumeWith([], consumeArgs())).resolves.toMatchObject({
      ok: false,
      reason: "not_found_or_forbidden",
    });
    await expect(consumeWith([storedCode(), storedCode({ _id: "duplicate" })], consumeArgs())).resolves.toMatchObject({
      ok: false,
      reason: "duplicate_storage_record",
    });
    await expect(consumeWith([storedCode({ clientId: "other_client" })], consumeArgs())).resolves.toMatchObject({
      ok: false,
      reason: "not_found_or_forbidden",
    });
    await expect(consumeWith([storedCode({ codeChallengeMethod: "plain" as never })], consumeArgs())).resolves.toMatchObject({
      ok: false,
      reason: "malformed_storage_record",
    });
  });

  it("rejects expired, consumed, mismatched, and malformed validation without consuming", async () => {
    await expect(
      validateWith([storedCode()], validateArgs({ now: NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS })),
    ).resolves.toMatchObject({ ok: false, reason: "expired" });
    await expect(
      validateWith([storedCode({ status: "consumed", consumedAt: NOW + 1 })], validateArgs()),
    ).resolves.toMatchObject({ ok: false, reason: "already_consumed" });
    await expect(validateWith([storedCode({ clientId: "other_client" })], validateArgs())).resolves.toMatchObject({
      ok: false,
      reason: "not_found_or_forbidden",
    });
    await expect(
      validateWith([storedCode({ redirectUri: "https://chatgpt.example.test/connector/oauth/other-callback" })], validateArgs()),
    ).resolves.toMatchObject({ ok: false, reason: "not_found_or_forbidden" });
    await expect(validateWith([storedCode({ resource: "https://mcp.twoweeks.example.test/other-resource" })], validateArgs())).resolves.toMatchObject({
      ok: false,
      reason: "not_found_or_forbidden",
    });
    await expect(validateWith([storedCode({ codeChallenge: "B".repeat(43) })], validateArgs())).resolves.toMatchObject({
      ok: false,
      reason: "not_found_or_forbidden",
    });
    await expect(validateWith([storedCode({ codeChallengeMethod: "plain" as never })], validateArgs())).resolves.toMatchObject({
      ok: false,
      reason: "malformed_storage_record",
    });
  });

  it("classifies storage records and keeps the boundary server-only", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");
    const schemaSource = readFileSync(SCHEMA_FILE, "utf8");

    expect(classifyMcpOAuthAuthorizationCodeStorageRecord(storedCode())).toBe("pending_valid");
    expect(classifyMcpOAuthAuthorizationCodeStorageRecord(storedCode({ status: "consumed", consumedAt: NOW + 1 }))).toBe(
      "consumed_valid",
    );
    expect(classifyMcpOAuthAuthorizationCodeStorageRecord(storedCode({ authorizationCodeDigest: "A".repeat(64) }))).toBe(
      "malformed",
    );
    expect(classifyMcpOAuthAccessTokenStorageRecord(storedAccessToken())).toBe("active_valid");
    expect(classifyMcpOAuthAccessTokenStorageRecord(storedAccessToken({ status: "expired" }))).toBe("expired_valid");
    expect(classifyMcpOAuthAccessTokenStorageRecord(storedAccessToken({ accessTokenDigest: "A".repeat(64) }))).toBe(
      "malformed",
    );
    expect(source).toContain("internalMutation");
    expect(source).toContain("internalQuery");
    expect(source).not.toMatch(/export\s+const\s+\w+\s*=\s*(?:query|mutation|httpAction)\s*\(/u);
    expect(source).not.toMatch(/\b(?:fetch|axios|XMLHttpRequest|localStorage|sessionStorage)\b/u);
    expect(source).not.toMatch(/\b(?:@stytch|@clerk|openai|react|vite|exchangeAuthorizationCode)\b/u);
    expect(source).not.toMatch(/\binternal(?:Link|Refresh|Revoke)CanonicalMcpAccount/u);
    expect(schemaSource).toContain("mcpOAuthAuthorizationCodes: defineTable");
    expect(schemaSource).toContain("mcpOAuthAccessTokens: defineTable");
    expect(schemaSource).toContain('.index("by_authorization_code_digest", ["authorizationCodeDigest"])');
    expect(schemaSource).toContain('.index("by_access_token_digest", ["accessTokenDigest"])');
    expect(schemaSource).toContain('.index("by_expires_at", ["expiresAt"])');
    expect(exportedArgsBlock(source, "internalValidateMcpOAuthAuthorizationCodeForTokenBoundary")).not.toMatch(
      /\b(?:deadlineEpochMs|timeoutMs)\b/u,
    );
    expect(exportedArgsBlock(source, "internalIssueMcpOAuthAccessTokenFromAuthorizationCode")).toMatch(
      /\bdeadlineEpochMs:\s*v\.number\(\)[\s\S]*\btimeoutMs:\s*v\.number\(\)/u,
    );
    expect(schemaSource).not.toContain("authorizationCode: v.string()");
    expect(schemaSource).not.toContain("accessToken: v.string()");
  });
});

function exportedArgsBlock(source: string, exportName: string): string {
  const match = source.match(
    new RegExp(`export const ${exportName}[\\s\\S]*?args: \\{([\\s\\S]*?)\\n  \\},\\n  returns:`, "u"),
  );
  expect(match?.[1]).toBeTypeOf("string");
  return match?.[1] ?? "";
}

async function consumeWith(seed: StoredCodeRecord[], args: ReturnType<typeof consumeArgs>) {
  const { ctx } = makeCtx(seed);
  return await internalConsumeMcpOAuthAuthorizationCode._handler(ctx as any, args);
}

async function validateWith(seed: StoredCodeRecord[], args: ReturnType<typeof validateArgs>) {
  const { ctx, patches } = makeCtx(seed);
  const result = await internalValidateMcpOAuthAuthorizationCodeForTokenBoundary._handler(ctx as any, args);
  expect(patches).toHaveLength(0);
  return result;
}

function makeCtx(seed: StoredCodeRecord[] = [], accessTokenSeed: StoredAccessTokenRecord[] = []) {
  const rows = seed.map((row) => ({ ...row, scopes: [...row.scopes] }));
  const accessTokenRows = accessTokenSeed.map((row) => ({ ...row, scopes: [...row.scopes] }));
  const inserts: Array<{ tableName: string; record: unknown }> = [];
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
  const deletes: string[] = [];
  let nextId = rows.length + 1;
  let nextAccessTokenId = accessTokenRows.length + 1;

  const ctx = {
    db: {
      query: (tableName: string) => {
        if (tableName !== "mcpOAuthAuthorizationCodes" && tableName !== "mcpOAuthAccessTokens") {
          throw new Error(`Unexpected table ${tableName}`);
        }
        return {
          withIndex: (indexName: string, buildQuery: (query: IndexConstraintBuilder) => unknown) => {
            const constraints: Constraint[] = [];
            const query: IndexConstraintBuilder = {
              eq(field: string, value: unknown) {
                constraints.push({ field, op: "eq", value });
                return query;
              },
              lte(field: string, value: unknown) {
                constraints.push({ field, op: "lte", value });
                return query;
              },
            };
            buildQuery(query);
            expect(["by_authorization_code_digest", "by_access_token_digest", "by_expires_at"]).toContain(indexName);
            const sourceRows = tableName === "mcpOAuthAuthorizationCodes" ? rows : accessTokenRows;
            const matching = sourceRows.filter((row) =>
              constraints.every((constraint) => {
                const fieldValue = row[constraint.field as keyof typeof row];
                if (constraint.op === "eq") return fieldValue === constraint.value;
                return typeof fieldValue === "number" && fieldValue <= constraint.value;
              }),
            );
            return {
              collect: async () => matching,
              take: async (count: number) => matching.slice(0, count),
            };
          },
        };
      },
      insert: async (tableName: string, record: McpOAuthAuthorizationCodeRecordV1 | McpOAuthAccessTokenRecordV1) => {
        if (tableName !== "mcpOAuthAuthorizationCodes" && tableName !== "mcpOAuthAccessTokens") {
          throw new Error(`Unexpected insert table ${tableName}`);
        }
        const id = tableName === "mcpOAuthAuthorizationCodes"
          ? `mcpOAuthAuthorizationCodes_fixture_${nextId++}`
          : `mcpOAuthAccessTokens_fixture_${nextAccessTokenId++}`;
        inserts.push({ tableName, record });
        if (tableName === "mcpOAuthAuthorizationCodes") {
          rows.push({ ...(record as McpOAuthAuthorizationCodeRecordV1), scopes: [...record.scopes], _id: id, _creationTime: NOW });
        } else {
          accessTokenRows.push({ ...(record as McpOAuthAccessTokenRecordV1), scopes: [...record.scopes], _id: id, _creationTime: NOW });
        }
        return id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        const row = rows.find((candidate) => candidate._id === id);
        if (!row) throw new Error(`Missing row ${id}`);
        patches.push({ id, patch });
        Object.assign(row, patch);
      },
      delete: async (id: string) => {
        const index = rows.findIndex((candidate) => candidate._id === id);
        const accessTokenIndex = accessTokenRows.findIndex((candidate) => candidate._id === id);
        if (index !== -1) {
          rows.splice(index, 1);
          deletes.push(id);
          return;
        }
        if (accessTokenIndex !== -1) {
          accessTokenRows.splice(accessTokenIndex, 1);
          deletes.push(id);
        }
      },
    },
  };

  return { ctx, rows, accessTokenRows, inserts, patches, deletes };
}

function createArgs(overrides: Partial<Parameters<typeof internalCreateMcpOAuthAuthorizationCode._handler>[1]> = {}) {
  return {
    authorizationCodeDigest: CODE_DIGEST,
    authenticatedOwnerIdentity: {
      subject: OWNER_ID,
      issuer: OWNER_ISSUER,
      version: 1,
    },
    trustedOwner: {
      kind: "mcp_oauth_authorization_trusted_owner",
      twoweeksClerkId: OWNER_ID,
      version: 1,
    },
    authorizationRequest: {
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
      state: STATE,
      codeChallenge: PKCE,
      codeChallengeMethod: "S256",
      version: 1,
    },
    productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
    now: NOW,
    version: 1,
    ...overrides,
  };
}

function consumeArgs(overrides: Partial<Parameters<typeof internalConsumeMcpOAuthAuthorizationCode._handler>[1]> = {}) {
  return {
    authorizationCodeDigest: CODE_DIGEST,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    now: NOW,
    version: 1,
    ...overrides,
  };
}

function validateArgs(
  overrides: Partial<Parameters<typeof internalValidateMcpOAuthAuthorizationCodeForTokenBoundary._handler>[1]> = {},
) {
  return {
    authorizationCodeDigest: CODE_DIGEST,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    resource: RESOURCE,
    codeChallenge: PKCE,
    now: NOW,
    version: 1,
    ...overrides,
  };
}

function issueAccessTokenArgs(
  overrides: Partial<Parameters<typeof internalIssueMcpOAuthAccessTokenFromAuthorizationCode._handler>[1]> = {},
) {
  const timeoutMs = 2_500;
  const now = overrides.now ?? NOW;
  return {
    authorizationCodeDigest: CODE_DIGEST,
    accessTokenDigest: ACCESS_TOKEN_DIGEST,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    resource: RESOURCE,
    codeChallenge: PKCE,
    now,
    deadlineEpochMs: now + timeoutMs,
    timeoutMs,
    version: 1,
    ...overrides,
  };
}

function verifyAccessTokenArgs(
  overrides: Partial<Parameters<typeof internalVerifyMcpOAuthAccessTokenForMcpBoundary._handler>[1]> = {},
) {
  return {
    accessTokenDigest: ACCESS_TOKEN_DIGEST,
    allowedClientIds: [CLIENT_ID],
    resource: RESOURCE,
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    now: NOW,
    version: 1,
    ...overrides,
  };
}

function storedCode(overrides: Partial<StoredCodeRecord> = {}): StoredCodeRecord {
  return {
    kind: "mcp_oauth_authorization_code_record",
    version: 1,
    authorizationCodeDigest: CODE_DIGEST,
    twoweeksClerkId: OWNER_ID,
    ownerIssuer: OWNER_ISSUER,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    resource: RESOURCE,
    scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
    state: STATE,
    codeChallenge: PKCE,
    codeChallengeMethod: "S256",
    productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
    status: "pending",
    createdAt: NOW,
    updatedAt: NOW,
    expiresAt: NOW + MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS,
    storageVersion: 1,
    _id: "mcpOAuthAuthorizationCodes_fixture_1",
    _creationTime: NOW,
    ...overrides,
  };
}

function storedAccessToken(overrides: Partial<StoredAccessTokenRecord> = {}): StoredAccessTokenRecord {
  return {
    kind: "mcp_oauth_access_token_record",
    version: 1,
    accessTokenDigest: ACCESS_TOKEN_DIGEST,
    authorizationCodeDigest: CODE_DIGEST,
    twoweeksClerkId: OWNER_ID,
    ownerIssuer: OWNER_ISSUER,
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    resource: RESOURCE,
    scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
    productionEnvironment: MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
    status: "active",
    issuedAt: NOW,
    updatedAt: NOW,
    expiresAt: NOW + MCP_OAUTH_ACCESS_TOKEN_TTL_MS,
    storageVersion: 1,
    _id: "mcpOAuthAccessTokens_fixture_1",
    _creationTime: NOW,
    ...overrides,
  };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
