import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  classifyMcpOAuthAuthorizationCodeStorageRecord,
  internalConsumeMcpOAuthAuthorizationCode,
  internalCreateMcpOAuthAuthorizationCode,
  internalValidateMcpOAuthAuthorizationCodeForTokenBoundary,
  MCP_OAUTH_AUTHORIZATION_CODE_PRODUCTION_ENVIRONMENT,
  MCP_OAUTH_AUTHORIZATION_CODE_TTL_MS,
  type McpOAuthAuthorizationCodeRecordV1,
} from "../mcpOAuthAuthorizationCodes";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../../src/modules/local-mcp/mcpAuthPolicyBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpOAuthAuthorizationCodes.ts");
const SCHEMA_FILE = resolve(TEST_DIR, "../schema.ts");
const NOW = Date.UTC(2026, 5, 28, 12, 0, 0, 0);
const RAW_CODE = "C".repeat(43);
const CODE_DIGEST = sha256Hex(RAW_CODE);
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

type Constraint = Readonly<{ field: string; op: "eq" | "lte"; value: unknown }>;
type IndexConstraintBuilder = Readonly<{
  eq: (field: string, value: unknown) => IndexConstraintBuilder;
  lte: (field: string, value: unknown) => IndexConstraintBuilder;
}>;

describe("Convex MCP OAuth authorization codes", () => {
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
    expect(source).toContain("internalMutation");
    expect(source).toContain("internalQuery");
    expect(source).not.toMatch(/export\s+const\s+\w+\s*=\s*(?:query|mutation|httpAction)\s*\(/u);
    expect(source).not.toMatch(/\b(?:fetch|axios|XMLHttpRequest|localStorage|sessionStorage)\b/u);
    expect(source).not.toMatch(/\b(?:@stytch|@clerk|openai|react|vite|exchangeAuthorizationCode)\b/u);
    expect(source).not.toMatch(/\binternal(?:Link|Refresh|Revoke)CanonicalMcpAccount/u);
    expect(schemaSource).toContain("mcpOAuthAuthorizationCodes: defineTable");
    expect(schemaSource).toContain('.index("by_authorization_code_digest", ["authorizationCodeDigest"])');
    expect(schemaSource).toContain('.index("by_expires_at", ["expiresAt"])');
    expect(schemaSource).not.toContain("authorizationCode: v.string()");
  });
});

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

function makeCtx(seed: StoredCodeRecord[] = []) {
  const rows = seed.map((row) => ({ ...row, scopes: [...row.scopes] }));
  const inserts: Array<{ tableName: string; record: unknown }> = [];
  const patches: Array<{ id: string; patch: Record<string, unknown> }> = [];
  let nextId = rows.length + 1;

  const ctx = {
    db: {
      query: (tableName: string) => {
        if (tableName !== "mcpOAuthAuthorizationCodes") throw new Error(`Unexpected table ${tableName}`);
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
            expect(["by_authorization_code_digest", "by_expires_at"]).toContain(indexName);
            const matching = rows.filter((row) =>
              constraints.every((constraint) => {
                const fieldValue = row[constraint.field as keyof StoredCodeRecord];
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
      insert: async (tableName: string, record: McpOAuthAuthorizationCodeRecordV1) => {
        if (tableName !== "mcpOAuthAuthorizationCodes") throw new Error(`Unexpected insert table ${tableName}`);
        const id = `mcpOAuthAuthorizationCodes_fixture_${nextId++}`;
        inserts.push({ tableName, record });
        rows.push({ ...record, scopes: [...record.scopes], _id: id, _creationTime: NOW });
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
        if (index !== -1) rows.splice(index, 1);
      },
    },
  };

  return { ctx, rows, inserts, patches };
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

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
