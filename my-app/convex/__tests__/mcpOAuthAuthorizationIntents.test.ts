import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  classifyMcpOAuthAuthorizationIntentStorageRecord,
  internalConsumeMcpOAuthAuthorizationIntent,
  internalCreateMcpOAuthAuthorizationIntent,
  MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS,
} from "../mcpOAuthAuthorizationIntents";
import {
  parseMcpOAuthAuthorizationRequestBoundary,
  type McpOAuthAuthorizationRequestBoundaryConfigV1,
  type McpOAuthAuthorizationRequestBoundaryHandoffV1,
  type McpOAuthAuthorizationTrustedOwnerV1,
} from "../../src/modules/local-mcp/mcpOAuthAuthorizationRequestBoundary";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../../src/modules/local-mcp/mcpAuthPolicyBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpOAuthAuthorizationIntents.ts");
const SCHEMA_FILE = resolve(TEST_DIR, "../schema.ts");
const NOW = Date.UTC(2026, 5, 26, 12, 0, 0, 0);
const OWNER_ID = "user_twoweeks_fixture_123";
const OTHER_OWNER_ID = "user_twoweeks_fixture_456";
const AUTHORIZATION_ORIGIN = "https://auth.twoweeks.example.test";
const AUTHORIZATION_PATH = "/oauth/authorize";
const CANONICAL_RESOURCE = "https://mcp.twoweeks.example.test/mcp";
const CHATGPT_REDIRECT_URI = "https://chatgpt.example.test/connector/oauth/callback-fixture";
const CLIENT_ID = "chatgpt-apps-sdk-client-fixture";
const STATE = "opaque_state_1234567890";
const PKCE_CHALLENGE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const VALID_HANDLE_HASH = "a".repeat(64);

type IntentRecord = {
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
  approvedOptionalParameters?: Partial<Record<"nonce" | "prompt", string>>;
  providerValidationStatus: "pending";
  status: "pending" | "consumed" | "expired";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  consumedAt?: number;
  storageVersion: 1;
};

type StoredIntentRecord = IntentRecord & {
  _id: string;
  _creationTime: number;
};

type Constraint = Readonly<{ field: string; value: unknown }>;

function makeCtx(seed: StoredIntentRecord[] = []) {
  const rows = seed.map((row) => ({ ...row, scopes: [...row.scopes] }));
  const inserts: IntentRecord[] = [];
  const patches: Array<{ id: string; patch: Partial<StoredIntentRecord> }> = [];
  let nextId = rows.length + 1;

  const db = {
    query: (tableName: string) => {
      if (tableName !== "mcpOAuthAuthorizationIntents") throw new Error(`Unexpected table ${tableName}`);
      return {
        withIndex: (indexName: string, buildQuery: (query: any) => unknown) => {
          expect(indexName).toBe("by_intent_handle_hash");
          const constraints: Constraint[] = [];
          const query = {
            eq(field: string, value: unknown) {
              constraints.push({ field, value });
              return query;
            },
          };
          buildQuery(query);
          const matching = rows.filter((row) =>
            constraints.every((constraint) => row[constraint.field as keyof StoredIntentRecord] === constraint.value),
          );
          return { collect: async () => matching };
        },
      };
    },
    insert: async (tableName: string, record: IntentRecord) => {
      if (tableName !== "mcpOAuthAuthorizationIntents") throw new Error(`Unexpected table ${tableName}`);
      const id = `mcpOAuthAuthorizationIntents_fixture_${nextId++}`;
      inserts.push(record);
      rows.push({ ...record, _id: id, _creationTime: NOW });
      return id;
    },
    patch: async (id: string, patch: Partial<StoredIntentRecord>) => {
      const row = rows.find((item) => item._id === id);
      if (!row) throw new Error(`Missing row ${id}`);
      patches.push({ id, patch });
      Object.assign(row, patch);
    },
  };

  return { ctx: { db }, rows, inserts, patches };
}

function validHandoff(
  options: Readonly<{
    overrides?: Readonly<Record<string, string | undefined>>;
    config?: McpOAuthAuthorizationRequestBoundaryConfigV1;
  }> = {},
): McpOAuthAuthorizationRequestBoundaryHandoffV1 {
  const result = parseMcpOAuthAuthorizationRequestBoundary({
    kind: "mcp_oauth_authorization_request_boundary_input",
    authorizationUrl: buildAuthorizationUrl(options.overrides),
    trustedOwner: trustedOwner(),
    config: options.config ?? buildConfig(),
    version: 1,
  });
  if (!result.accepted) throw new Error(`Unexpected denied handoff ${result.reason}`);
  return result.serverOnly;
}

function storedIntent(overrides: Partial<StoredIntentRecord> = {}): StoredIntentRecord {
  return {
    kind: "mcp_oauth_authorization_intent_record",
    version: 1,
    intentHandleHash: VALID_HANDLE_HASH,
    twoweeksClerkId: OWNER_ID,
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
    status: "pending",
    createdAt: NOW,
    updatedAt: NOW,
    expiresAt: NOW + MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS,
    storageVersion: 1,
    _id: "mcpOAuthAuthorizationIntents_fixture_1",
    _creationTime: NOW,
    ...overrides,
  };
}

async function createWith(handoff = validHandoff(), handleHash = VALID_HANDLE_HASH) {
  const { ctx, rows, inserts } = makeCtx();
  const result = await internalCreateMcpOAuthAuthorizationIntent._handler(ctx as any, {
    authorizationRequestHandoff: handoff,
    intentHandleHash: handleHash,
    now: NOW,
    version: 1,
  });
  return { result, rows, inserts };
}

describe("Convex MCP OAuth authorization intents", () => {
  it("projects the merged PR265 handoff into bounded pending storage without URL/query or token fields", async () => {
    const handoff = validHandoff({ overrides: { nonce: "nonce_fixture", prompt: "consent" } });
    const { result, rows, inserts } = await createWith(handoff);

    expect(result).toEqual({
      kind: "mcp_oauth_authorization_intent_create_result",
      ok: true,
      reason: "created",
      serverOnly: {
        status: "pending",
        expiresAt: NOW + MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    });
    expect(inserts).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      intentHandleHash: VALID_HANDLE_HASH,
      twoweeksClerkId: OWNER_ID,
      authorizationPageOrigin: AUTHORIZATION_ORIGIN,
      authorizationPagePath: AUTHORIZATION_PATH,
      clientId: CLIENT_ID,
      redirectUri: CHATGPT_REDIRECT_URI,
      resource: CANONICAL_RESOURCE,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
      state: STATE,
      codeChallenge: PKCE_CHALLENGE,
      providerValidationStatus: "pending",
      status: "pending",
      approvedOptionalParameters: { nonce: "nonce_fixture", prompt: "consent" },
    });
    expect(JSON.stringify(rows[0])).not.toContain(`${AUTHORIZATION_ORIGIN}${AUTHORIZATION_PATH}?`);
    expect(Object.keys(rows[0])).not.toEqual(
      expect.arrayContaining(["authorizationUrl", "query", "accessToken", "refreshToken", "clientSecret"]),
    );
  });

  it.each([
    ["uppercase", "A".repeat(64), "invalid_handle_hash"],
    ["too short", "a".repeat(63), "invalid_handle_hash"],
    ["too long", "a".repeat(65), "invalid_handle_hash"],
    ["non-hex", `${"a".repeat(63)}g`, "invalid_handle_hash"],
    ["whitespace", `${"a".repeat(63)} `, "invalid_handle_hash"],
    ["control characters", `${"a".repeat(63)}\n`, "invalid_handle_hash"],
    ["raw handle-shaped value", "raw_handle_fixture_abcdefghijklmnopqrstuvwxyz", "invalid_handle_hash"],
  ] as const)("rejects %s intent handle hash", async (_label, intentHandleHash, reason) => {
    const { result, inserts } = await createWith(validHandoff(), intentHandleHash);
    expect(result).toMatchObject({ ok: false, reason });
    expect(inserts).toHaveLength(0);
  });

  it("fails closed on handle collision and sensitive optional hints without echoing values", async () => {
    const collisionCtx = makeCtx([storedIntent()]);
    await expect(
      internalCreateMcpOAuthAuthorizationIntent._handler(collisionCtx.ctx as any, {
        authorizationRequestHandoff: validHandoff(),
        intentHandleHash: VALID_HANDLE_HASH,
        now: NOW,
        version: 1,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "handle_collision" });
    expect(collisionCtx.inserts).toHaveLength(0);

    for (const overrides of [{ login_hint: "person@example.test" }, { id_token_hint: "id-token-sensitive" }] as const) {
      const { result, inserts } = await createWith(validHandoff({ overrides }));
      expect(result).toMatchObject({ ok: false, reason: "sensitive_optional_parameter_not_supported" });
      expect(JSON.stringify(result)).not.toContain(Object.values(overrides)[0]);
      expect(inserts).toHaveLength(0);
    }
  });

  it("consumes the exact owner-bound pending handoff once and preserves provider-pending flags", async () => {
    const handoff = validHandoff({ overrides: { nonce: "nonce_fixture", prompt: "consent" } });
    const created = await createWith(handoff);
    const { ctx, rows, patches } = makeCtx([rowsToStored(created.rows[0])]);

    const first = await internalConsumeMcpOAuthAuthorizationIntent._handler(ctx as any, {
      trustedOwner: trustedOwner(),
      intentHandleHash: VALID_HANDLE_HASH,
      now: NOW + 1,
      version: 1,
    });
    const second = await internalConsumeMcpOAuthAuthorizationIntent._handler(ctx as any, {
      trustedOwner: trustedOwner(),
      intentHandleHash: VALID_HANDLE_HASH,
      now: NOW + 2,
      version: 1,
    });

    expect(first).toMatchObject({
      ok: true,
      reason: "consumed",
      serverOnly: {
        authorizationRequestHandoff: handoff,
      },
      modelVisible: false,
      safeForLogging: false,
    });
    expect(first.ok && first.serverOnly.authorizationRequestHandoff.providerValidation).toMatchObject({
      status: "pending",
      consentCompleted: false,
      authorizationCodeIssued: false,
      tokenIssued: false,
      accountLinkCreated: false,
    });
    expect(second).toMatchObject({ ok: false, reason: "already_consumed" });
    expect(second.ok).toBe(false);
    expect(rows[0]).toMatchObject({ status: "consumed", consumedAt: NOW + 1, updatedAt: NOW + 1 });
    expect(rows[0].expiresAt).toBe(NOW + MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS);
    expect(patches).toHaveLength(1);
  });

  it("marks expired pending records atomically and never returns the handoff", async () => {
    const { ctx, rows, patches } = makeCtx([storedIntent()]);

    const result = await internalConsumeMcpOAuthAuthorizationIntent._handler(ctx as any, {
      trustedOwner: trustedOwner(),
      intentHandleHash: VALID_HANDLE_HASH,
      now: NOW + MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS,
      version: 1,
    });

    expect(result).toMatchObject({ ok: false, reason: "expired" });
    expect(JSON.stringify(result)).not.toContain(STATE);
    expect(rows[0]).toMatchObject({ status: "expired", updatedAt: NOW + MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS });
    expect(rows[0]).not.toHaveProperty("consumedAt");
    expect(patches).toHaveLength(1);
  });

  it("fails closed on wrong owner, missing rows, duplicate rows, and malformed storage", async () => {
    await expect(consumeWith([], trustedOwner())).resolves.toMatchObject({ ok: false, reason: "not_found_or_forbidden" });
    await expect(consumeWith([storedIntent()], trustedOwner(OTHER_OWNER_ID))).resolves.toMatchObject({
      ok: false,
      reason: "not_found_or_forbidden",
    });
    await expect(
      consumeWith([
        storedIntent({ _id: "mcpOAuthAuthorizationIntents_fixture_1" }),
        storedIntent({ _id: "mcpOAuthAuthorizationIntents_fixture_2" }),
      ]),
    ).resolves.toMatchObject({ ok: false, reason: "duplicate_storage_record" });
    await expect(consumeWith([storedIntent({ state: "" })])).resolves.toMatchObject({
      ok: false,
      reason: "malformed_storage_record",
    });
  });

  it.each([
    ["pending", storedIntent(), "pending_valid"],
    ["consumed", storedIntent({ status: "consumed", consumedAt: NOW + 1 }), "consumed_valid"],
    ["expired", storedIntent({ status: "expired", updatedAt: NOW + MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS }), "expired_valid"],
    ["missing owner", storedIntent({ twoweeksClerkId: "" }), "malformed"],
    ["wrong PKCE method", { ...storedIntent(), codeChallengeMethod: "plain" }, "malformed"],
    ["malformed resource", storedIntent({ resource: "https://mcp.twoweeks.example.test/mcp?x=1" }), "malformed"],
    ["missing canonical scope", storedIntent({ scopes: ["openid"] }), "malformed"],
    ["unsupported extra field", { ...storedIntent(), debugPayload: "private" }, "malformed"],
    ["invalid status", { ...storedIntent(), status: "approved" }, "malformed"],
    ["invalid timestamp", storedIntent({ expiresAt: Number.MAX_SAFE_INTEGER }), "malformed"],
    ["invalid terminal field", storedIntent({ status: "pending", consumedAt: NOW + 1 }), "malformed"],
    ["sensitive optional hint present", { ...storedIntent(), approvedOptionalParameters: { login_hint: "person@example.test" } }, "malformed"],
  ] as const)("classifies %s storage as %s", (_label, record, expected) => {
    expect(classifyMcpOAuthAuthorizationIntentStorageRecord(record)).toBe(expected);
  });

  it("does not echo sensitive values in serialized failures", async () => {
    const sensitiveValues = [
      STATE,
      PKCE_CHALLENGE,
      CLIENT_ID,
      CHATGPT_REDIRECT_URI,
      OWNER_ID,
      VALID_HANDLE_HASH,
      "id-token-sensitive",
      "person@example.test",
      `${AUTHORIZATION_ORIGIN}${AUTHORIZATION_PATH}?`,
      "authorization_code",
      "access_token",
      "provider_payload",
    ];
    const failures = [
      (await createWith(validHandoff({ overrides: { id_token_hint: "id-token-sensitive" } }))).result,
      await consumeWith([storedIntent()], trustedOwner(OTHER_OWNER_ID)),
      await consumeWith([storedIntent({ status: "expired", updatedAt: NOW + MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS })]),
    ];

    for (const failure of failures) {
      expect(failure.ok).toBe(false);
      const serialized = JSON.stringify(failure);
      for (const value of sensitiveValues) {
        expect(serialized).not.toContain(value);
      }
    }
  });

  it("keeps the storage boundary server-only without routes, providers, browser APIs, or account-link writes", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");
    const schemaSource = readFileSync(SCHEMA_FILE, "utf8");

    expect(source).toContain("internalMutation");
    expect(source).not.toMatch(/export\s+const\s+\w+\s*=\s*(?:query|mutation|httpAction)\s*\(/u);
    expect(source).not.toMatch(/\b(?:fetch|axios|XMLHttpRequest)\b/u);
    expect(source).not.toMatch(/\b(?:localStorage|sessionStorage|Math\.random|process\.env)\b/u);
    expect(source).not.toMatch(/\b(?:@stytch|@clerk|openai|react|vite)\b/u);
    expect(source).not.toMatch(/\binternal(?:Link|Refresh|Revoke)CanonicalMcpAccount/u);
    expect(source).not.toMatch(/\bctx\.run(?:Mutation|Action|Query)\b/u);
    expect(schemaSource).toContain("mcpOAuthAuthorizationIntents: defineTable");
    expect(schemaSource).toContain('.index("by_intent_handle_hash", ["intentHandleHash"])');
    expect(schemaSource).toContain('.index("by_expires_at", ["expiresAt"])');
  });
});

async function consumeWith(seed: StoredIntentRecord[], owner = trustedOwner()) {
  const { ctx } = makeCtx(seed);
  return await internalConsumeMcpOAuthAuthorizationIntent._handler(ctx as any, {
    trustedOwner: owner,
    intentHandleHash: VALID_HANDLE_HASH,
    now: NOW,
    version: 1,
  });
}

function rowsToStored(record: IntentRecord): StoredIntentRecord {
  return {
    ...record,
    _id: "mcpOAuthAuthorizationIntents_fixture_1",
    _creationTime: NOW,
  };
}

function trustedOwner(twoweeksClerkId = OWNER_ID): McpOAuthAuthorizationTrustedOwnerV1 {
  return {
    kind: "mcp_oauth_authorization_trusted_owner",
    twoweeksClerkId,
    version: 1,
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
