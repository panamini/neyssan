// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createLocalMcpDevEndpointPlugin } from "../../../../vite.config";
import {
  internalConsumeMcpOAuthAuthorizationIntent,
  type McpOAuthAuthorizationIntentRecordV1,
} from "../../../../convex/mcpOAuthAuthorizationIntents";
import { internalBindMcpOAuthPreAuthIntentToAuthenticatedOwner } from "../../../../convex/mcpOAuthPreAuthOwnerBinding";
import {
  internalCreateMcpOAuthPreAuthIntent,
  type McpOAuthPreAuthIntentRecordV1,
} from "../../../../convex/mcpOAuthPreAuthIntents";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../mcpAuthPolicyBoundary";
import type { McpOAuthAuthorizationTrustedOwnerV1 } from "../mcpOAuthAuthorizationRequestBoundary";
import {
  defaultMcpOAuthContinuationHandleCodecV1,
  type McpOAuthContinuationHandleCodecV1,
} from "../mcpOAuthLoginReturnContinuationBoundary";
import {
  buildMcpOAuthLocalDevRouteAdapterConfig,
  handleMcpOAuthLocalDevRouteRequest,
  LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR,
  LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG,
  LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_PATH,
  LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR,
  type McpOAuthLocalDevRouteAdapterDependenciesV1,
  type McpOAuthLocalDevRouteAdapterRequestV1,
} from "../mcpOAuthLocalDevRouteAdapter";
import {
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
} from "../../../pages/sign-in-return";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpOAuthLocalDevRouteAdapter.ts");
const APP_ORIGIN = "http://localhost:5173";
const HOST = "localhost:5173";
const RESOURCE = "https://mcp.twoweeks.example.test/mcp";
const REDIRECT_URI = "https://chatgpt.example.test/connector/oauth/callback-fixture";
const CLIENT_ID = "chatgpt-apps-sdk-client-fixture";
const STATE = "opaque_state_1234567890";
const PKCE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER_ID = "user_twoweeks_fixture_123";
const OTHER_OWNER_ID = "user_twoweeks_fixture_456";
const NOW = Date.parse("2026-06-26T16:00:00.000Z");
const RAW_HANDLE = "0123456789abcdef".repeat(4);
const HANDLE_HASH = sha256Hex(RAW_HANDLE);

type StoredPreAuthIntentRecord = McpOAuthPreAuthIntentRecordV1 & {
  _id: string;
  _creationTime: number;
};

type StoredAuthorizationIntentRecord = McpOAuthAuthorizationIntentRecordV1 & {
  _id: string;
  _creationTime: number;
};

type Constraint = Readonly<{ field: string; op: "eq" | "lte"; value: unknown }>;
type IndexConstraintBuilder = Readonly<{
  eq: (field: string, value: unknown) => IndexConstraintBuilder;
  lte: (field: string, value: unknown) => IndexConstraintBuilder;
}>;

const deterministicCodec: McpOAuthContinuationHandleCodecV1 = Object.freeze({
  generate: () => Object.freeze({ rawHandle: RAW_HANDLE, intentHandleHash: HANDLE_HASH }),
  validate: (rawHandle: unknown): rawHandle is string =>
    defaultMcpOAuthContinuationHandleCodecV1.validate(rawHandle),
  hash: (rawHandle: string) => sha256Hex(rawHandle),
});

describe("MCP OAuth local/dev two-phase route adapter", () => {
  it("validates, stores pre-auth, redirects to Clerk sign-in, binds owner, and resumes continuation without issuing tokens or codes", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);

    const authorizationResponse = await handleMcpOAuthLocalDevRouteRequest(
      request(authorizationRequestPath({ nonce: "nonce_fixture", prompt: "consent" })),
      routeConfig(),
      dependencies,
    );

    expect(authorizationResponse).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
      approvedOptionalParameters: { nonce: "nonce_fixture", prompt: "consent" },
    });
    expect(Object.keys(ctx.preAuthRows[0])).not.toContain("twoweeksClerkId");
    expect(ctx.authorizationRows).toHaveLength(0);
    expect(authorizationResponse.headers.location).toBe(
      `${APP_ORIGIN}/sign-in?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}`,
    );
    expectNoOAuthLeakage(authorizationResponse, { allowRawHandle: true });

    const continuationResponse = await handleMcpOAuthLocalDevRouteRequest(
      request(continuationPath()),
      routeConfig(),
      dependencies,
    );

    expect(continuationResponse).toMatchObject({
      handled: true,
      status: 200,
      json: {
        kind: "mcp_oauth_local_dev_authorization_state",
        status: "authorization_request_restored",
        authorizationRequestRestored: true,
        authorizationGranted: false,
        providerValidationPending: true,
        consentCompleted: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
        externalProviderCalled: false,
      },
    });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).toHaveBeenCalledTimes(1);
    expect(dependencies.consumeAuthorizationIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "claimed", claimedAt: NOW });
    expect(ctx.authorizationRows).toHaveLength(1);
    expect(ctx.authorizationRows[0]).toMatchObject({
      intentHandleHash: HANDLE_HASH,
      twoweeksClerkId: OWNER_ID,
      status: "consumed",
      consumedAt: NOW,
    });
    expect(ctx.authorizationRows[0]).not.toHaveProperty("authorizationCode");
    expect(ctx.authorizationRows[0]).not.toHaveProperty("accessToken");
    expect(ctx.authorizationRows[0]).not.toHaveProperty("refreshToken");
    expectNoOAuthLeakage(continuationResponse);
  });

  it("fails replay after a successful continuation without re-consuming the owner-bound intent", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    await handleMcpOAuthLocalDevRouteRequest(request(authorizationRequestPath()), routeConfig(), dependencies);
    const first = await handleMcpOAuthLocalDevRouteRequest(request(continuationPath()), routeConfig(), dependencies);
    const second = await handleMcpOAuthLocalDevRouteRequest(request(continuationPath()), routeConfig(), dependencies);

    expect(first).toMatchObject({ status: 200 });
    expect(second).toMatchObject({
      handled: true,
      status: 409,
      json: {
        reason: "owner_binding_failed",
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.consumeAuthorizationIntent).toHaveBeenCalledTimes(1);
    expect(ctx.authorizationRows).toHaveLength(1);
    expect(ctx.authorizationRows[0].status).toBe("consumed");
    expectNoOAuthLeakage(second);
  });

  it("fails closed when the bound owner and continuation owner-bound intent do not match", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx, { tamperBindingOwner: OTHER_OWNER_ID });
    await handleMcpOAuthLocalDevRouteRequest(request(authorizationRequestPath()), routeConfig(), dependencies);

    const response = await handleMcpOAuthLocalDevRouteRequest(request(continuationPath()), routeConfig(), dependencies);

    expect(response).toMatchObject({
      handled: true,
      status: 409,
      json: {
        reason: "continuation_resume_failed",
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "claimed" });
    expect(ctx.authorizationRows).toHaveLength(1);
    expect(ctx.authorizationRows[0]).toMatchObject({
      twoweeksClerkId: OWNER_ID,
      status: "pending",
    });
    expectNoOAuthLeakage(response);
  });

  it("rejects request-supplied owner values before storage", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);

    const response = await handleMcpOAuthLocalDevRouteRequest(
      request(authorizationRequestPath({ owner: OTHER_OWNER_ID })),
      routeConfig(),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 400,
      json: {
        reason: "invalid_authorization_request",
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expect(ctx.authorizationRows).toHaveLength(0);
    expect(JSON.stringify(response)).not.toContain(OTHER_OWNER_ID);
  });

  it("is absent unless the explicit local/dev route flag is enabled", async () => {
    const ctx = makeCtx();
    const disabled = await handleMcpOAuthLocalDevRouteRequest(
      request(authorizationRequestPath()),
      buildMcpOAuthLocalDevRouteAdapterConfig(),
      routeDependencies(ctx),
    );

    expect(disabled).toMatchObject({ handled: false, status: 404 });
    expect(ctx.preAuthRows).toHaveLength(0);
    expect(createLocalMcpDevEndpointPlugin({ env: {} })).toBeUndefined();
    expect(
      createLocalMcpDevEndpointPlugin({
        env: {
          [LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG]: "1",
          [LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR]: APP_ORIGIN,
          [LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR]: REDIRECT_URI,
          LOCAL_MCP_DEV_AUTH_RESOURCE: RESOURCE,
          LOCAL_MCP_DEV_AUTH_CLIENT_ID: CLIENT_ID,
        },
      }),
    ).toBeTruthy();
  });

  it("keeps the route adapter free of provider calls, browser storage, package SDK wiring, and successful code or token issuance", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    expect(source).not.toMatch(/\b(?:fetch|axios|XMLHttpRequest|WebSocket|EventSource)\b/u);
    expect(source).not.toMatch(/\b(?:localStorage|sessionStorage|document\.cookie)\b/u);
    expect(source).not.toMatch(/\b(?:@stytch|Stytch|OAuthProvider|ChatGPTConnector)\b/u);
    expect(source).not.toMatch(/authorizationCodeIssued:\s*true|tokenIssued:\s*true|accountLinkCreated:\s*true/u);
    expect(source).not.toMatch(/\binternal(?:Link|Refresh|Revoke)CanonicalMcpAccount/u);
  });
});

function routeConfig() {
  return buildMcpOAuthLocalDevRouteAdapterConfig({
    enabled: true,
    applicationOrigin: APP_ORIGIN,
    canonicalResource: RESOURCE,
    allowedRedirectUris: [REDIRECT_URI],
    allowedClientIds: [CLIENT_ID],
    allowHttpLocalhostApplicationOrigin: true,
  });
}

function routeDependencies(
  ctx: ReturnType<typeof makeCtx>,
  options: Readonly<{ tamperBindingOwner?: string }> = {},
): Required<Pick<
  McpOAuthLocalDevRouteAdapterDependenciesV1,
  "createPreAuthIntent" | "bindPreAuthIntentToAuthenticatedOwner" | "consumeAuthorizationIntent" | "handleCodec" | "now"
>> {
  return {
    createPreAuthIntent: vi.fn(async (input) =>
      await internalCreateMcpOAuthPreAuthIntent._handler(ctx.ctx as any, input),
    ),
    bindPreAuthIntentToAuthenticatedOwner: vi.fn(async (input) => {
      const result = await internalBindMcpOAuthPreAuthIntentToAuthenticatedOwner._handler(
        ctx.ctx as any,
        input,
      );
      if (!result.ok || options.tamperBindingOwner === undefined) return result;
      return {
        ...result,
        serverOnly: {
          ...result.serverOnly,
          trustedOwner: trustedOwner(options.tamperBindingOwner),
        },
      };
    }),
    consumeAuthorizationIntent: vi.fn(async (input) =>
      await internalConsumeMcpOAuthAuthorizationIntent._handler(ctx.ctx as any, input),
    ),
    handleCodec: deterministicCodec,
    now: vi.fn(() => NOW),
  };
}

function request(url: string, method = "GET"): McpOAuthLocalDevRouteAdapterRequestV1 {
  return {
    method,
    path: url.split("?")[0] ?? url,
    url,
    headers: {
      host: HOST,
    },
  };
}

function authorizationRequestPath(
  overrides: Readonly<Partial<Record<string, string>>> = {},
): string {
  const params = new URLSearchParams();
  params.append("response_type", overrides.response_type ?? "code");
  params.append("client_id", overrides.client_id ?? CLIENT_ID);
  params.append("redirect_uri", overrides.redirect_uri ?? REDIRECT_URI);
  params.append("scope", overrides.scope ?? `${TWOWEEKS_APPLICATIONS_READ_SCOPE} openid`);
  params.append("state", overrides.state ?? STATE);
  params.append("code_challenge", overrides.code_challenge ?? PKCE);
  params.append("code_challenge_method", overrides.code_challenge_method ?? "S256");
  params.append("resource", overrides.resource ?? RESOURCE);
  if (overrides.nonce !== undefined) params.append("nonce", overrides.nonce);
  if (overrides.prompt !== undefined) params.append("prompt", overrides.prompt);
  if (overrides.owner !== undefined) params.append("owner", overrides.owner);
  return `${LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_PATH}?${params.toString()}`;
}

function continuationPath(): string {
  return `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}`;
}

function makeCtx(
  options: Readonly<{
    subject?: string | null;
  }> = {},
) {
  const preAuthRows: StoredPreAuthIntentRecord[] = [];
  const authorizationRows: StoredAuthorizationIntentRecord[] = [];
  let nextPreAuthId = 1;
  let nextAuthorizationId = 1;
  let subject = options.subject === undefined ? OWNER_ID : options.subject;

  const ctx = {
    auth: {
      getUserIdentity: async () => (subject === null ? null : { subject }),
    },
    db: {
      query: (tableName: string) => {
        if (!["mcpOAuthPreAuthIntents", "mcpOAuthAuthorizationIntents"].includes(tableName)) {
          throw new Error(`Unexpected table ${tableName}`);
        }
        return {
          withIndex: (
            indexName: string,
            buildQuery: (query: IndexConstraintBuilder) => unknown,
          ) => {
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
            expectKnownIndex(tableName, indexName, constraints);
            const rows = tableName === "mcpOAuthPreAuthIntents" ? preAuthRows : authorizationRows;
            const matching = rows.filter((row) =>
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
      insert: async (tableName: string, record: unknown) => {
        if (tableName === "mcpOAuthPreAuthIntents") {
          const id = `mcpOAuthPreAuthIntents_fixture_${nextPreAuthId++}`;
          preAuthRows.push({
            ...(record as McpOAuthPreAuthIntentRecordV1),
            scopes: [...(record as McpOAuthPreAuthIntentRecordV1).scopes],
            _id: id,
            _creationTime: NOW,
          });
          return id;
        }
        if (tableName === "mcpOAuthAuthorizationIntents") {
          const id = `mcpOAuthAuthorizationIntents_fixture_${nextAuthorizationId++}`;
          authorizationRows.push({
            ...(record as McpOAuthAuthorizationIntentRecordV1),
            scopes: [...(record as McpOAuthAuthorizationIntentRecordV1).scopes],
            _id: id,
            _creationTime: NOW,
          });
          return id;
        }
        throw new Error(`Unexpected insert table ${tableName}`);
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        const row = [...preAuthRows, ...authorizationRows].find((candidate) => candidate._id === id);
        if (!row) throw new Error(`Missing row ${id}`);
        Object.assign(row, patch);
      },
      delete: async (id: string) => {
        const preAuthIndex = preAuthRows.findIndex((row) => row._id === id);
        if (preAuthIndex >= 0) {
          preAuthRows.splice(preAuthIndex, 1);
          return;
        }
        const authorizationIndex = authorizationRows.findIndex((row) => row._id === id);
        if (authorizationIndex >= 0) authorizationRows.splice(authorizationIndex, 1);
      },
    },
  };

  return {
    ctx,
    preAuthRows,
    authorizationRows,
    setSubject(nextSubject: string | null) {
      subject = nextSubject;
    },
  };
}

function expectKnownIndex(
  tableName: string,
  indexName: string,
  constraints: readonly Constraint[],
): void {
  if (tableName === "mcpOAuthPreAuthIntents" && indexName === "by_pre_auth_handle_hash") {
    expect(constraints).toEqual([expect.objectContaining({ field: "preAuthHandleHash", op: "eq" })]);
    return;
  }
  if (tableName === "mcpOAuthAuthorizationIntents" && indexName === "by_intent_handle_hash") {
    expect(constraints).toEqual([expect.objectContaining({ field: "intentHandleHash", op: "eq" })]);
    return;
  }
  throw new Error(`Unexpected index ${tableName}.${indexName}`);
}

function trustedOwner(twoweeksClerkId = OWNER_ID): McpOAuthAuthorizationTrustedOwnerV1 {
  return {
    kind: "mcp_oauth_authorization_trusted_owner",
    twoweeksClerkId,
    version: 1,
  };
}

function expectNoOAuthLeakage(
  value: unknown,
  options: Readonly<{ allowRawHandle?: boolean }> = {},
): void {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    STATE,
    PKCE,
    CLIENT_ID,
    REDIRECT_URI,
    RESOURCE,
    OWNER_ID,
    OTHER_OWNER_ID,
    HANDLE_HASH,
    "authorization_code",
    "access_token",
    "refresh_token",
    "id_token",
  ]) {
    expect(serialized).not.toContain(forbidden);
  }
  if (!options.allowRawHandle) expect(serialized).not.toContain(RAW_HANDLE);
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
