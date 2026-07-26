import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  classifyMcpOAuthPreAuthIntentStorageRecord,
  internalClaimMcpOAuthPreAuthIntent,
  internalCreateMcpOAuthPreAuthIntent,
  internalDeleteExpiredMcpOAuthPreAuthIntents,
  MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS,
} from "../mcpOAuthPreAuthIntents";
import {
  projectMcpOAuthPreAuthAuthorizationRequest,
  type McpOAuthAuthorizationRequestBoundaryConfigV1,
  type McpOAuthPreAuthAuthorizationRequestProjectionV1,
} from "../../src/modules/local-mcp/mcpOAuthAuthorizationRequestBoundary";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../../src/modules/local-mcp/mcpAuthPolicyBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpOAuthPreAuthIntents.ts");
const SCHEMA_FILE = resolve(TEST_DIR, "../schema.ts");
const NOW = Date.UTC(2026, 5, 26, 12, 0, 0, 0);
const AUTHORIZATION_ORIGIN = "https://auth.twoweeks.example.test";
const AUTHORIZATION_PATH = "/oauth/authorize";
const CANONICAL_RESOURCE = "https://mcp.twoweeks.example.test/mcp";
const CHATGPT_REDIRECT_URI = "https://chatgpt.example.test/connector/oauth/callback-fixture";
const CLIENT_ID = "chatgpt-apps-sdk-client-fixture";
const STATE = "opaque_state_1234567890";
const PKCE_CHALLENGE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VALID_HANDLE_HASH = "a".repeat(64);

type PreAuthIntentRecord = {
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
  approvedOptionalParameters?: Partial<Record<"nonce" | "prompt", string>>;
  providerValidationStatus: "pending";
  status: "pre_auth_pending" | "claimed" | "expired";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  claimedAt?: number;
  storageVersion: 1;
};

type StoredPreAuthIntentRecord = PreAuthIntentRecord & {
  _id: string;
  _creationTime: number;
};

type Constraint = Readonly<{ field: string; op: "eq" | "lte"; value: unknown }>;
type IndexConstraintBuilder = Readonly<{
  eq: (field: string, value: unknown) => IndexConstraintBuilder;
  lte: (field: string, value: unknown) => IndexConstraintBuilder;
}>;

function makeCtx(seed: StoredPreAuthIntentRecord[] = []) {
  const rows = seed.map((row) => ({ ...row, scopes: [...row.scopes] }));
  const inserts: PreAuthIntentRecord[] = [];
  const patches: Array<{ id: string; patch: Partial<StoredPreAuthIntentRecord> }> = [];
  const deletes: string[] = [];
  let nextId = rows.length + 1;

  const db = {
    query: (tableName: string) => {
      if (tableName !== "mcpOAuthPreAuthIntents") throw new Error(`Unexpected table ${tableName}`);
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
          expectIndexConstraints(indexName, constraints);
          const matching = rows.filter((row) => {
            return constraints.every((constraint) => {
              const fieldValue = row[constraint.field as keyof StoredPreAuthIntentRecord];
              if (constraint.op === "eq") return fieldValue === constraint.value;
              return typeof fieldValue === "number" && typeof constraint.value === "number" && fieldValue <= constraint.value;
            });
          });
          return {
            collect: async () => matching,
            take: async (count: number) => matching.slice(0, count),
          };
        },
      };
    },
    insert: async (tableName: string, record: PreAuthIntentRecord) => {
      if (tableName !== "mcpOAuthPreAuthIntents") throw new Error(`Unexpected table ${tableName}`);
      const id = `mcpOAuthPreAuthIntents_fixture_${nextId++}`;
      inserts.push(record);
      rows.push({ ...record, _id: id, _creationTime: NOW });
      return id;
    },
    patch: async (id: string, patch: Partial<StoredPreAuthIntentRecord>) => {
      const row = rows.find((item) => item._id === id);
      if (!row) throw new Error(`Missing row ${id}`);
      patches.push({ id, patch });
      Object.assign(row, patch);
    },
    delete: async (id: string) => {
      const index = rows.findIndex((item) => item._id === id);
      if (index === -1) throw new Error(`Missing row ${id}`);
      deletes.push(id);
      rows.splice(index, 1);
    },
  };

  return { ctx: { db }, rows, inserts, patches, deletes };
}

function expectIndexConstraints(indexName: string, constraints: readonly Constraint[]): void {
  if (indexName === "by_pre_auth_handle_hash") {
    expect(constraints).toEqual([
      expect.objectContaining({ field: "preAuthHandleHash", op: "eq" }),
    ]);
    return;
  }
  if (indexName === "by_expires_at") {
    expect(constraints).toEqual([
      expect.objectContaining({ field: "expiresAt", op: "lte" }),
    ]);
    return;
  }
  throw new Error(`Unexpected index ${indexName}`);
}

function validProjection(
  overrides: Readonly<Record<string, string | undefined>> = {},
): McpOAuthPreAuthAuthorizationRequestProjectionV1 {
  const result = projectMcpOAuthPreAuthAuthorizationRequest({
    kind: "mcp_oauth_pre_auth_authorization_request_projection_input",
    authorizationUrl: buildAuthorizationUrl(overrides),
    config: buildConfig(),
    version: 1,
  });
  if (!result.accepted) throw new Error(`Unexpected denied projection ${result.reason}`);
  return result.serverOnly;
}

function storedPreAuthIntent(overrides: Partial<StoredPreAuthIntentRecord> = {}): StoredPreAuthIntentRecord {
  return {
    kind: "mcp_oauth_pre_auth_intent_record",
    version: 1,
    preAuthHandleHash: VALID_HANDLE_HASH,
    authorizationPageOrigin: AUTHORIZATION_ORIGIN,
    authorizationPagePath: AUTHORIZATION_PATH,
    responseType: "code",
    clientId: CLIENT_ID,
    redirectUri: CHATGPT_REDIRECT_URI,
    resource: CANONICAL_RESOURCE,
    scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    state: STATE,
    codeChallenge: PKCE_CHALLENGE,
    codeChallengeMethod: "S256",
    providerValidationStatus: "pending",
    status: "pre_auth_pending",
    createdAt: NOW,
    updatedAt: NOW,
    expiresAt: NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS,
    storageVersion: 1,
    _id: "mcpOAuthPreAuthIntents_fixture_1",
    _creationTime: NOW,
    ...overrides,
  };
}

async function createWith(projection = validProjection(), handleHash = VALID_HANDLE_HASH) {
  const { ctx, rows, inserts } = makeCtx();
  const result = await internalCreateMcpOAuthPreAuthIntent._handler(ctx as any, {
    authorizationRequestProjection: projection,
    preAuthHandleHash: handleHash,
    now: NOW,
    version: 1,
  });
  return { result, rows, inserts };
}

describe("Convex MCP OAuth pre-auth intents", () => {
  it("creates ownerless pre_auth_pending storage from a validated projection without raw URL, query, handle, owner, or token fields", async () => {
    const projection = validProjection({ nonce: "nonce_fixture", prompt: "consent" });
    const { result, rows, inserts } = await createWith(projection);

    expect(result).toEqual({
      kind: "mcp_oauth_pre_auth_intent_create_result",
      ok: true,
      reason: "created",
      serverOnly: {
        status: "pre_auth_pending",
        expiresAt: NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS,
        containsOwnerIdentity: false,
        containsProviderSubject: false,
        containsAccountLinkId: false,
        authorizationGranted: false,
        consentCompleted: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    });
    expect(inserts).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      preAuthHandleHash: VALID_HANDLE_HASH,
      authorizationPageOrigin: AUTHORIZATION_ORIGIN,
      authorizationPagePath: AUTHORIZATION_PATH,
      clientId: CLIENT_ID,
      redirectUri: CHATGPT_REDIRECT_URI,
      resource: CANONICAL_RESOURCE,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      state: STATE,
      codeChallenge: PKCE_CHALLENGE,
      providerValidationStatus: "pending",
      status: "pre_auth_pending",
      approvedOptionalParameters: { nonce: "nonce_fixture", prompt: "consent" },
    });
    expect(rows[0].expiresAt - rows[0].createdAt).toBe(MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS);
    expect(JSON.stringify(rows[0])).not.toContain(`${AUTHORIZATION_ORIGIN}${AUTHORIZATION_PATH}?`);
    for (const key of [
      "authorizationUrl",
      "query",
      "rawHandle",
      "twoweeksClerkId",
      "ownerId",
      "email",
      "providerSubject",
      "accountLinkId",
      "accessToken",
      "refreshToken",
      "idToken",
      "authorizationCode",
      "clientSecret",
    ]) {
      expect(Object.keys(rows[0])).not.toContain(key);
    }
  });

  it.each([
    ["uppercase", "A".repeat(64), "invalid_handle_hash"],
    ["too short", "a".repeat(63), "invalid_handle_hash"],
    ["too long", "a".repeat(65), "invalid_handle_hash"],
    ["non-hex", `${"a".repeat(63)}g`, "invalid_handle_hash"],
    ["raw handle-shaped value", "raw_handle_fixture_abcdefghijklmnopqrstuvwxyz", "invalid_handle_hash"],
  ] as const)("rejects %s pre-auth handle hash", async (_label, preAuthHandleHash, reason) => {
    const { result, inserts } = await createWith(validProjection(), preAuthHandleHash);
    expect(result).toMatchObject({ ok: false, reason });
    expect(inserts).toHaveLength(0);
  });

  it("fails closed on handle collision and sensitive OAuth hints without persisting them", async () => {
    const collisionCtx = makeCtx([storedPreAuthIntent()]);
    await expect(
      internalCreateMcpOAuthPreAuthIntent._handler(collisionCtx.ctx as any, {
        authorizationRequestProjection: validProjection(),
        preAuthHandleHash: VALID_HANDLE_HASH,
        now: NOW,
        version: 1,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "handle_collision" });
    expect(collisionCtx.inserts).toHaveLength(0);

    for (const sensitiveHints of [
      { login_hint: "person@example.test" },
      { id_token_hint: "id-token-sensitive" },
      { login_hint: "person@example.test", id_token_hint: "id-token-sensitive" },
    ]) {
      const { result, rows, inserts } = await createWith(validProjection(sensitiveHints));
      expect(result).toMatchObject({ ok: false, reason: "invalid_input", safeForLogging: true, modelVisible: false });
      for (const value of Object.values(sensitiveHints)) {
        expect(JSON.stringify(result)).not.toContain(value);
      }
      expect(inserts).toHaveLength(0);
      expect(rows).toHaveLength(0);
    }
  });

  it("rejects create requests whose caller deadline has already passed on the server", async () => {
    const { ctx, inserts } = makeCtx();
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(NOW + 2_501);
    try {
      const result = await internalCreateMcpOAuthPreAuthIntent._handler(ctx as any, {
        authorizationRequestProjection: validProjection(),
        preAuthHandleHash: VALID_HANDLE_HASH,
        now: NOW,
        deadlineEpochMs: NOW + 2_500,
        timeoutMs: 2_500,
        version: 1,
      });

      expect(result).toMatchObject({ ok: false, reason: "invalid_input" });
      expect(inserts).toHaveLength(0);
    } finally {
      dateNow.mockRestore();
    }
  });

  it("claims one pending pre-auth record once and returns no owner-bound identity", async () => {
    const projection = validProjection({ nonce: "nonce_fixture" });
    const created = await createWith(projection);
    const { ctx, rows, patches } = makeCtx([rowsToStored(created.rows[0])]);

    const first = await internalClaimMcpOAuthPreAuthIntent._handler(ctx as any, {
      preAuthHandleHash: VALID_HANDLE_HASH,
      now: NOW + 1,
      version: 1,
    });
    const second = await internalClaimMcpOAuthPreAuthIntent._handler(ctx as any, {
      preAuthHandleHash: VALID_HANDLE_HASH,
      now: NOW + 2,
      version: 1,
    });

    expect(first).toMatchObject({
      ok: true,
      reason: "claimed",
      serverOnly: {
        authorizationRequestProjection: projection,
        status: "claimed",
      },
      modelVisible: false,
      safeForLogging: false,
    });
    expect(JSON.stringify(first)).not.toContain("twoweeksClerkId");
    expect(JSON.stringify(first)).not.toContain("accountLinkId");
    expect(second).toMatchObject({ ok: false, reason: "already_claimed" });
    expect(rows[0]).toMatchObject({ status: "claimed", claimedAt: NOW + 1, updatedAt: NOW + 1 });
    expect(patches).toHaveLength(1);
  });

  it("marks expired pending records atomically and never returns the projection", async () => {
    const { ctx, rows, patches } = makeCtx([storedPreAuthIntent()]);

    const result = await internalClaimMcpOAuthPreAuthIntent._handler(ctx as any, {
      preAuthHandleHash: VALID_HANDLE_HASH,
      now: NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS,
      version: 1,
    });

    expect(result).toMatchObject({ ok: false, reason: "expired" });
    expect(JSON.stringify(result)).not.toContain(STATE);
    expect(rows[0]).toMatchObject({ status: "expired", updatedAt: NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS });
    expect(rows[0]).not.toHaveProperty("claimedAt");
    expect(patches).toHaveLength(1);
  });

  it("fails closed when claim receives a timestamp before row creation", async () => {
    const { ctx, rows, patches } = makeCtx([storedPreAuthIntent()]);

    const result = await internalClaimMcpOAuthPreAuthIntent._handler(ctx as any, {
      preAuthHandleHash: VALID_HANDLE_HASH,
      now: NOW - 1,
      version: 1,
    });

    expect(result).toMatchObject({ ok: false, reason: "invalid_input" });
    expect(rows[0]).toMatchObject({ status: "pre_auth_pending", updatedAt: NOW });
    expect(rows[0]).not.toHaveProperty("claimedAt");
    expect(patches).toHaveLength(0);
  });

  it("deletes expired pre-auth intent records in a bounded internal cleanup pass", async () => {
    const expiredPending = storedPreAuthIntent({
      _id: "mcpOAuthPreAuthIntents_expired_pending",
      expiresAt: NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS,
    });
    const expiredClaimed = storedPreAuthIntent({
      _id: "mcpOAuthPreAuthIntents_expired_claimed",
      preAuthHandleHash: "b".repeat(64),
      status: "claimed",
      claimedAt: NOW + 1,
      expiresAt: NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS,
    });
    const activePending = storedPreAuthIntent({
      _id: "mcpOAuthPreAuthIntents_active_pending",
      preAuthHandleHash: "c".repeat(64),
      expiresAt: NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS + 2,
    });
    const { ctx, rows, deletes } = makeCtx([expiredPending, expiredClaimed, activePending]);

    const result = await internalDeleteExpiredMcpOAuthPreAuthIntents._handler(ctx as any, {
      now: NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS,
      version: 1,
    });

    expect(result).toEqual({
      kind: "mcp_oauth_pre_auth_intent_cleanup_result",
      ok: true,
      deletedCount: 2,
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
    expect(deletes).toEqual(["mcpOAuthPreAuthIntents_expired_pending", "mcpOAuthPreAuthIntents_expired_claimed"]);
    expect(rows).toHaveLength(1);
    expect(rows[0]._id).toBe("mcpOAuthPreAuthIntents_active_pending");
  });

  it("fails closed on missing rows, duplicate rows, claimed rows, and malformed storage", async () => {
    await expect(claimWith([])).resolves.toMatchObject({ ok: false, reason: "not_found_or_forbidden" });
    await expect(
      claimWith([
        storedPreAuthIntent({ _id: "mcpOAuthPreAuthIntents_fixture_1" }),
        storedPreAuthIntent({ _id: "mcpOAuthPreAuthIntents_fixture_2" }),
      ]),
    ).resolves.toMatchObject({ ok: false, reason: "duplicate_storage_record" });
    await expect(claimWith([storedPreAuthIntent({ status: "claimed", claimedAt: NOW + 1 })])).resolves.toMatchObject({
      ok: false,
      reason: "already_claimed",
    });
    await expect(claimWith([storedPreAuthIntent({ state: "" })])).resolves.toMatchObject({
      ok: false,
      reason: "malformed_storage_record",
    });
  });

  it.each([
    ["pending", storedPreAuthIntent(), "pre_auth_pending_valid"],
    ["claimed", storedPreAuthIntent({ status: "claimed", claimedAt: NOW + 1 }), "claimed_valid"],
    ["expired", storedPreAuthIntent({ status: "expired", updatedAt: NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS }), "expired_valid"],
    ["owner field", { ...storedPreAuthIntent(), twoweeksClerkId: "user_fixture" }, "malformed"],
    ["wrong PKCE method", { ...storedPreAuthIntent(), codeChallengeMethod: "plain" }, "malformed"],
    ["malformed resource", storedPreAuthIntent({ resource: "https://mcp.twoweeks.example.test/mcp?x=1" }), "malformed"],
    ["query-bearing authorization page path", storedPreAuthIntent({ authorizationPagePath: "/oauth/authorize?x=1" }), "malformed"],
    ["missing canonical scope", storedPreAuthIntent({ scopes: ["openid"] }), "malformed"],
    [
      "oversized scope list",
      storedPreAuthIntent({ scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid", "email", "profile", "extra"] }),
      "malformed",
    ],
    ["unsupported extra field", { ...storedPreAuthIntent(), debugPayload: "private" }, "malformed"],
    ["invalid status", { ...storedPreAuthIntent(), status: "consumed" }, "malformed"],
    ["invalid timestamp", storedPreAuthIntent({ expiresAt: Number.MAX_SAFE_INTEGER }), "malformed"],
    ["invalid terminal field", storedPreAuthIntent({ status: "pre_auth_pending", claimedAt: NOW + 1 }), "malformed"],
    [
      "sensitive optional hint present",
      { ...storedPreAuthIntent(), approvedOptionalParameters: { login_hint: "person@example.test" } as any },
      "malformed",
    ],
  ] as const)("classifies %s storage as %s", (_label, record, expected) => {
    expect(classifyMcpOAuthPreAuthIntentStorageRecord(record)).toBe(expected);
  });

  it("does not echo sensitive values in serialized failures", async () => {
    const sensitiveValues = [
      STATE,
      PKCE_CHALLENGE,
      CLIENT_ID,
      CHATGPT_REDIRECT_URI,
      VALID_HANDLE_HASH,
      "id-token-sensitive",
      "person@example.test",
      `${AUTHORIZATION_ORIGIN}${AUTHORIZATION_PATH}?`,
      "authorization_code",
      "access_token",
      "provider_payload",
    ];
    const failures = [
      (await createWith({ ...validProjection(), modelVisible: true })).result,
      await claimWith([]),
      await claimWith([storedPreAuthIntent({ status: "expired", updatedAt: NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS })]),
    ];

    for (const failure of failures) {
      expect(failure.ok).toBe(false);
      const serialized = JSON.stringify(failure);
      for (const value of sensitiveValues) {
        expect(serialized).not.toContain(value);
      }
    }
  });

  it("keeps the pre-auth storage boundary server-only without routes, providers, browser APIs, owner storage, or account-link writes", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");
    const schemaSource = readFileSync(SCHEMA_FILE, "utf8");

    expect(source).toContain("internalMutation");
    expect(source).not.toMatch(/export\s+const\s+\w+\s*=\s*(?:query|mutation|httpAction|action)\s*\(/u);
    expect(source).not.toMatch(/\b(?:fetch|axios|XMLHttpRequest)\b/u);
    expect(source).not.toMatch(/\b(?:localStorage|sessionStorage|Math\.random|process\.env)\b/u);
    expect(source).not.toMatch(/\b(?:@stytch|@clerk|openai|react|vite)\b/u);
    expect(source).not.toMatch(/\binternal(?:Link|Refresh|Revoke)CanonicalMcpAccount/u);
    expect(source).not.toMatch(/\bctx\.run(?:Mutation|Action|Query)\b/u);
    expect(source).not.toMatch(/\btwoweeksClerkId\b/u);
    expect(schemaSource).toContain("mcpOAuthPreAuthIntents: defineTable");
    expect(schemaSource).toContain('.index("by_pre_auth_handle_hash", ["preAuthHandleHash"])');
    expect(schemaSource).toContain('.index("by_expires_at", ["expiresAt"])');
    const tableSource = schemaSource.slice(schemaSource.indexOf("mcpOAuthPreAuthIntents: defineTable"));
    expect(tableSource).toContain("ui_locales: v.optional(v.string())");
    expect(tableSource).not.toContain("login_hint");
    expect(tableSource).not.toContain("id_token_hint");
    expect(tableSource).not.toContain("twoweeksClerkId");
    expect(tableSource).not.toContain("accountLinkId");
  });
});

async function claimWith(seed: StoredPreAuthIntentRecord[]) {
  const { ctx } = makeCtx(seed);
  return await internalClaimMcpOAuthPreAuthIntent._handler(ctx as any, {
    preAuthHandleHash: VALID_HANDLE_HASH,
    now: NOW,
    version: 1,
  });
}

function rowsToStored(record: PreAuthIntentRecord): StoredPreAuthIntentRecord {
  return {
    ...record,
    _id: "mcpOAuthPreAuthIntents_fixture_1",
    _creationTime: NOW,
  };
}

function buildConfig(
  overrides: Partial<McpOAuthAuthorizationRequestBoundaryConfigV1> = {},
): McpOAuthAuthorizationRequestBoundaryConfigV1 {
  return {
    kind: "mcp_oauth_authorization_request_boundary_config",
    authorizationPageOrigin: AUTHORIZATION_ORIGIN,
    authorizationPagePath: AUTHORIZATION_PATH,
    canonicalResource: CANONICAL_RESOURCE,
    allowedRedirectUris: [CHATGPT_REDIRECT_URI],
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    approvedOptionalScopes: [],
    allowedOptionalParameters: ["nonce", "prompt", "login_hint", "id_token_hint"],
    maxUrlLength: 512,
    maxParameterLength: 256,
    maxStateLength: 128,
    maxIdTokenHintLength: 256,
    clientIdPolicy: {
      mode: "predefined_allowlist",
      allowedClientIds: [CLIENT_ID],
      version: 1,
    },
    localDevelopmentOnly: true,
    allowHttpLocalhostAuthorizationOrigin: false,
    version: 1,
    ...overrides,
  };
}

function buildAuthorizationUrl(overrides: Readonly<Record<string, string | undefined>> = {}): string {
  const search = new URLSearchParams({
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: CHATGPT_REDIRECT_URI,
    scope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    state: STATE,
    code_challenge: PKCE_CHALLENGE,
    code_challenge_method: "S256",
    resource: CANONICAL_RESOURCE,
  });
  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) continue;
    search.set(key, value);
  }
  return `${AUTHORIZATION_ORIGIN}${AUTHORIZATION_PATH}?${search.toString()}`;
}
