import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import {
  internalConsumeMcpOAuthAuthorizationIntent,
  MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS,
  type McpOAuthAuthorizationIntentRecordV1,
} from "../mcpOAuthAuthorizationIntents";
import {
  internalBindMcpOAuthPreAuthIntentToAuthenticatedOwner,
  type McpOAuthPreAuthOwnerBindingResultV1,
} from "../mcpOAuthPreAuthOwnerBinding";
import {
  MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS,
  type McpOAuthPreAuthIntentRecordV1,
} from "../mcpOAuthPreAuthIntents";
import {
  resumeMcpOAuthAuthorizationAfterLoginReturn,
  type McpOAuthIntentConsumeInputV1,
  type McpOAuthIntentConsumeResultV1,
  type McpOAuthLoginReturnContinuationBoundaryConfigV1,
} from "../../src/modules/local-mcp/mcpOAuthLoginReturnContinuationBoundary";
import type { McpOAuthAuthorizationTrustedOwnerV1 } from "../../src/modules/local-mcp/mcpOAuthAuthorizationRequestBoundary";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../../src/modules/local-mcp/mcpAuthPolicyBoundary";
import {
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
  MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
} from "../../src/pages/sign-in-return";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpOAuthPreAuthOwnerBinding.ts");
const PRE_AUTH_SOURCE_FILE = resolve(TEST_DIR, "../mcpOAuthPreAuthIntents.ts");
const AUTHORIZATION_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpOAuthAuthorizationIntents.ts",
);
const NOW = Date.UTC(2026, 5, 26, 12, 0, 0, 0);
const OWNER_ID = "user_twoweeks_fixture_123";
const OTHER_OWNER_ID = "user_twoweeks_fixture_456";
const APP_ORIGIN = "https://app.twoweeks.example.test";
const AUTHORIZATION_ORIGIN = "https://auth.twoweeks.example.test";
const AUTHORIZATION_PATH = "/oauth/authorize";
const CANONICAL_RESOURCE = "https://mcp.twoweeks.example.test/mcp";
const CHATGPT_REDIRECT_URI =
  "https://chatgpt.example.test/connector/oauth/callback-fixture";
const CLIENT_ID = "chatgpt-apps-sdk-client-fixture";
const STATE = "opaque_state_1234567890";
const PKCE_CHALLENGE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RAW_HANDLE = "a".repeat(64);
const VALID_HANDLE_HASH = sha256Hex(RAW_HANDLE);

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

function makeCtx(
  options: Readonly<{
    preAuthRows?: StoredPreAuthIntentRecord[];
    authorizationRows?: StoredAuthorizationIntentRecord[];
    subject?: string | null;
    throwOnIdentityLookup?: boolean;
  }> = {},
) {
  const preAuthRows = (options.preAuthRows ?? []).map(clonePreAuthRow);
  const authorizationRows = (options.authorizationRows ?? []).map(
    cloneAuthorizationRow,
  );
  const inserts: Array<{ tableName: string; record: unknown }> = [];
  const patches: Array<{
    tableName: string;
    id: string;
    patch: Record<string, unknown>;
  }> = [];
  let nextAuthorizationId = authorizationRows.length + 1;
  let subject = options.subject === undefined ? OWNER_ID : options.subject;

  const ctx = {
    auth: {
      getUserIdentity: async () => {
        if (options.throwOnIdentityLookup)
          throw new Error("identity lookup unavailable");
        return subject === null ? null : { subject };
      },
    },
    db: {
      query: (tableName: string) => {
        if (
          !["mcpOAuthPreAuthIntents", "mcpOAuthAuthorizationIntents"].includes(
            tableName,
          )
        ) {
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
            expectIndexConstraints(tableName, indexName, constraints);
            const rows =
              tableName === "mcpOAuthPreAuthIntents"
                ? preAuthRows
                : authorizationRows;
            const matching = rows.filter((row) => {
              return constraints.every((constraint) => {
                const fieldValue = row[constraint.field as keyof typeof row];
                if (constraint.op === "eq")
                  return fieldValue === constraint.value;
                return (
                  typeof fieldValue === "number" &&
                  typeof constraint.value === "number" &&
                  fieldValue <= constraint.value
                );
              });
            });
            return {
              collect: async () => matching,
              take: async (count: number) => matching.slice(0, count),
            };
          },
        };
      },
      insert: async (
        tableName: string,
        record: McpOAuthAuthorizationIntentRecordV1,
      ) => {
        if (tableName !== "mcpOAuthAuthorizationIntents")
          throw new Error(`Unexpected insert table ${tableName}`);
        const id = `mcpOAuthAuthorizationIntents_fixture_${nextAuthorizationId++}`;
        inserts.push({ tableName, record });
        authorizationRows.push({
          ...record,
          scopes: [...record.scopes],
          _id: id,
          _creationTime: NOW,
        });
        return id;
      },
      patch: async (id: string, patch: Record<string, unknown>) => {
        const preAuthRow = preAuthRows.find((row) => row._id === id);
        if (preAuthRow) {
          patches.push({ tableName: "mcpOAuthPreAuthIntents", id, patch });
          Object.assign(preAuthRow, patch);
          return;
        }
        const authorizationRow = authorizationRows.find(
          (row) => row._id === id,
        );
        if (authorizationRow) {
          patches.push({
            tableName: "mcpOAuthAuthorizationIntents",
            id,
            patch,
          });
          Object.assign(authorizationRow, patch);
          return;
        }
        throw new Error(`Missing row ${id}`);
      },
    },
  };

  return {
    ctx,
    preAuthRows,
    authorizationRows,
    inserts,
    patches,
    setSubject: (nextSubject: string | null) => {
      subject = nextSubject;
    },
  };
}

function expectIndexConstraints(
  tableName: string,
  indexName: string,
  constraints: readonly Constraint[],
): void {
  if (
    tableName === "mcpOAuthPreAuthIntents" &&
    indexName === "by_pre_auth_handle_hash"
  ) {
    expect(constraints).toEqual([
      expect.objectContaining({ field: "preAuthHandleHash", op: "eq" }),
    ]);
    return;
  }
  if (
    tableName === "mcpOAuthAuthorizationIntents" &&
    indexName === "by_intent_handle_hash"
  ) {
    expect(constraints).toEqual([
      expect.objectContaining({ field: "intentHandleHash", op: "eq" }),
    ]);
    return;
  }
  throw new Error(`Unexpected index ${tableName}.${indexName}`);
}

describe("Convex MCP OAuth pre-auth owner binding", () => {
  it("binds one pre_auth_pending record to the authenticated Clerk owner and creates PR267-compatible pending storage", async () => {
    const { ctx, preAuthRows, authorizationRows, patches } = makeCtx({
      preAuthRows: [
        storedPreAuthIntent({
          approvedOptionalParameters: {
            nonce: "nonce_fixture",
            prompt: "consent",
          },
        }),
      ],
    });

    const result = await bindWith(ctx);

    expect(result).toMatchObject({
      ok: true,
      reason: "bound",
      serverOnly: {
        ownerBoundIntent: {
          status: "pending",
          expiresAt: NOW + MCP_OAUTH_AUTHORIZATION_INTENT_TTL_MS,
        },
        preAuthIntent: { status: "claimed" },
        trustedOwner: trustedOwner(),
      },
      modelVisible: false,
      safeForLogging: false,
    });
    expect(preAuthRows[0]).toMatchObject({
      status: "claimed",
      claimedAt: NOW,
      updatedAt: NOW,
    });
    expect(Object.keys(preAuthRows[0])).not.toContain("twoweeksClerkId");
    expect(authorizationRows).toHaveLength(1);
    expect(authorizationRows[0]).toMatchObject({
      kind: "mcp_oauth_authorization_intent_record",
      intentHandleHash: VALID_HANDLE_HASH,
      twoweeksClerkId: OWNER_ID,
      authorizationPageOrigin: AUTHORIZATION_ORIGIN,
      authorizationPagePath: AUTHORIZATION_PATH,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
      status: "pending",
      approvedOptionalParameters: { nonce: "nonce_fixture", prompt: "consent" },
    });
    expect(JSON.stringify(authorizationRows[0])).not.toContain(
      `${AUTHORIZATION_ORIGIN}${AUTHORIZATION_PATH}?`,
    );
    for (const key of [
      "authorizationUrl",
      "query",
      "rawHandle",
      "accessToken",
      "refreshToken",
      "idToken",
      "authorizationCode",
    ]) {
      expect(Object.keys(authorizationRows[0])).not.toContain(key);
      expect(Object.keys(preAuthRows[0])).not.toContain(key);
    }
    expect(patches).toEqual([
      expect.objectContaining({
        tableName: "mcpOAuthPreAuthIntents",
        patch: { status: "claimed", updatedAt: NOW, claimedAt: NOW },
      }),
    ]);
  });

  it("fails closed without an authenticated Clerk session", async () => {
    const { ctx, preAuthRows, authorizationRows, patches } = makeCtx({
      subject: null,
      preAuthRows: [storedPreAuthIntent()],
    });

    const result = await bindWith(ctx);

    expect(result).toMatchObject({ ok: false, reason: "unauthenticated" });
    expect(preAuthRows[0]).toMatchObject({ status: "pre_auth_pending" });
    expect(authorizationRows).toHaveLength(0);
    expect(patches).toHaveLength(0);
    expectFailureDoesNotEchoSensitiveValues(result);
  });

  it("logs a non-sensitive server signal when Clerk identity lookup fails", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    try {
      const { ctx, authorizationRows } = makeCtx({
        throwOnIdentityLookup: true,
        preAuthRows: [storedPreAuthIntent()],
      });

      const result = await bindWith(ctx);

      expect(result).toMatchObject({ ok: false, reason: "unauthenticated" });
      expect(authorizationRows).toHaveLength(0);
      expect(warn).toHaveBeenCalledWith(
        "[mcp-oauth-pre-auth-owner-binding] Clerk identity lookup failed",
      );
      expect(JSON.stringify(warn.mock.calls)).not.toContain(OWNER_ID);
    } finally {
      warn.mockRestore();
    }
  });

  it("rejects request-supplied owner input and uses only the authenticated session owner", async () => {
    const { ctx, authorizationRows } = makeCtx({
      preAuthRows: [storedPreAuthIntent()],
    });

    const injectedOwnerResult =
      await internalBindMcpOAuthPreAuthIntentToAuthenticatedOwner._handler(
        ctx as any,
        {
          preAuthHandleHash: VALID_HANDLE_HASH,
          twoweeksClerkId: OTHER_OWNER_ID,
          now: NOW,
          version: 1,
        } as any,
      );

    expect(injectedOwnerResult).toMatchObject({
      ok: false,
      reason: "invalid_input",
    });
    expect(authorizationRows).toHaveLength(0);
    expectFailureDoesNotEchoSensitiveValues(injectedOwnerResult);
  });

  it("fails expired, claimed, and duplicate pre-auth records without creating owner-bound storage", async () => {
    await expect(
      bindWith(
        makeCtx({ preAuthRows: [storedPreAuthIntent()], subject: OWNER_ID })
          .ctx,
        NOW + MCP_OAUTH_PRE_AUTH_INTENT_TTL_MS,
      ),
    ).resolves.toMatchObject({
      ok: false,
      reason: "expired",
    });
    await expect(
      bindWith(
        makeCtx({
          preAuthRows: [
            storedPreAuthIntent({
              status: "claimed",
              claimedAt: NOW + 1,
              updatedAt: NOW + 1,
            }),
          ],
        }).ctx,
      ),
    ).resolves.toMatchObject({ ok: false, reason: "already_claimed" });
    await expect(
      bindWith(
        makeCtx({
          preAuthRows: [
            storedPreAuthIntent({ _id: "mcpOAuthPreAuthIntents_fixture_1" }),
            storedPreAuthIntent({ _id: "mcpOAuthPreAuthIntents_fixture_2" }),
          ],
        }).ctx,
      ),
    ).resolves.toMatchObject({
      ok: false,
      reason: "duplicate_pre_auth_record",
    });
  });

  it("cannot double-bind or replay the same pre-auth handle", async () => {
    const { ctx, setSubject, preAuthRows, authorizationRows } = makeCtx({
      preAuthRows: [storedPreAuthIntent()],
    });

    await expect(bindWith(ctx)).resolves.toMatchObject({
      ok: true,
      reason: "bound",
    });
    setSubject(OTHER_OWNER_ID);
    await expect(bindWith(ctx, NOW + 1)).resolves.toMatchObject({
      ok: false,
      reason: "already_claimed",
    });

    expect(preAuthRows[0]).toMatchObject({ status: "claimed", claimedAt: NOW });
    expect(authorizationRows).toHaveLength(1);
    expect(authorizationRows[0].twoweeksClerkId).toBe(OWNER_ID);
    await expect(
      internalConsumeMcpOAuthAuthorizationIntent._handler(ctx as any, {
        trustedOwner: trustedOwner(OTHER_OWNER_ID),
        intentHandleHash: VALID_HANDLE_HASH,
        now: NOW + 2,
        version: 1,
      }),
    ).resolves.toMatchObject({ ok: false, reason: "not_found_or_forbidden" });
  });

  it("keeps PR269 continuation resume compatible after binding", async () => {
    const { ctx } = makeCtx({
      preAuthRows: [
        storedPreAuthIntent({
          approvedOptionalParameters: { nonce: "nonce_fixture" },
        }),
      ],
    });
    await expect(bindWith(ctx)).resolves.toMatchObject({
      ok: true,
      reason: "bound",
    });

    const result = await resumeMcpOAuthAuthorizationAfterLoginReturn({
      kind: "resume_mcp_oauth_authorization_after_login_return_input",
      continuationUrlOrPath: `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}`,
      trustedOwner: trustedOwner(),
      consumeIntent: async (
        input: McpOAuthIntentConsumeInputV1,
      ): Promise<McpOAuthIntentConsumeResultV1> =>
        await internalConsumeMcpOAuthAuthorizationIntent._handler(
          ctx as any,
          input,
        ),
      now: NOW + 1,
      config: continuationConfig(),
      version: 1,
    });

    expect(result).toMatchObject({
      resumed: true,
      reason: "resumed",
      serverOnly: {
        authorizationUrl: expectedAuthorizationUrl({ nonce: "nonce_fixture" }),
        authorizationGranted: false,
        providerValidationPending: true,
        consentCompleted: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
      modelVisible: false,
      safeForLogging: false,
    });
    expect(JSON.stringify(result)).not.toContain(RAW_HANDLE);
    expect(JSON.stringify(result)).not.toContain(VALID_HANDLE_HASH);
  });

  it("keeps the adapter internal and free of routes, provider calls, token exchange, and account-link lifecycle", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");
    const preAuthSource = readFileSync(PRE_AUTH_SOURCE_FILE, "utf8");
    const authorizationSource = readFileSync(AUTHORIZATION_SOURCE_FILE, "utf8");

    expect(source).toContain("internalMutation");
    expect(source).not.toMatch(
      /export\s+const\s+\w+\s*=\s*(?:query|mutation|httpAction|action)\s*\(/u,
    );
    expect(source).not.toMatch(/\b(?:fetch|axios|XMLHttpRequest)\b/u);
    expect(source).not.toMatch(
      /\b(?:localStorage|sessionStorage|window|document|Math\.random|process\.env)\b/u,
    );
    expect(source).not.toMatch(/\b(?:@stytch|@clerk|openai|react|vite)\b/u);
    expect(source).not.toMatch(
      /\binternal(?:Link|Refresh|Revoke)CanonicalMcpAccount/u,
    );
    expect(source).not.toMatch(/\bctx\.run(?:Mutation|Action|Query)\b/u);
    expect(source).not.toMatch(
      /authorizationCodeIssued:\s*true|tokenIssued:\s*true|accountLinkCreated:\s*true/u,
    );
    expect(preAuthSource).not.toMatch(/\btwoweeksClerkId\b/u);
    expect(authorizationSource).toContain(
      "internalConsumeMcpOAuthAuthorizationIntent",
    );
  });
});

async function bindWith(
  ctx: unknown,
  now = NOW,
): Promise<McpOAuthPreAuthOwnerBindingResultV1> {
  return await internalBindMcpOAuthPreAuthIntentToAuthenticatedOwner._handler(
    ctx as any,
    {
      preAuthHandleHash: VALID_HANDLE_HASH,
      now,
      version: 1,
    },
  );
}

function storedPreAuthIntent(
  overrides: Partial<StoredPreAuthIntentRecord> = {},
): StoredPreAuthIntentRecord {
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
    scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
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

function trustedOwner(
  twoweeksClerkId = OWNER_ID,
): McpOAuthAuthorizationTrustedOwnerV1 {
  return {
    kind: "mcp_oauth_authorization_trusted_owner",
    twoweeksClerkId,
    version: 1,
  };
}

function clonePreAuthRow(
  row: StoredPreAuthIntentRecord,
): StoredPreAuthIntentRecord {
  return {
    ...row,
    scopes: [...row.scopes],
    ...(row.approvedOptionalParameters
      ? { approvedOptionalParameters: { ...row.approvedOptionalParameters } }
      : {}),
  };
}

function cloneAuthorizationRow(
  row: StoredAuthorizationIntentRecord,
): StoredAuthorizationIntentRecord {
  return {
    ...row,
    scopes: [...row.scopes],
    ...(row.approvedOptionalParameters
      ? { approvedOptionalParameters: { ...row.approvedOptionalParameters } }
      : {}),
  };
}

function continuationConfig(
  overrides: Partial<McpOAuthLoginReturnContinuationBoundaryConfigV1> = {},
): McpOAuthLoginReturnContinuationBoundaryConfigV1 {
  return {
    kind: "mcp_oauth_login_return_continuation_boundary_config",
    applicationOrigin: APP_ORIGIN,
    fixedSignInPath: "/sign-in",
    fixedContinuationPath: MCP_OAUTH_CONTINUATION_PATH,
    fixedAuthorizationPageOrigin: AUTHORIZATION_ORIGIN,
    fixedAuthorizationPagePath: AUTHORIZATION_PATH,
    signInReturnParameterName: MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
    continuationHandleParameterName: MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
    maxContinuationUrlLength: 2_048,
    maxRawHandleLength: 256,
    routeContract: {
      recommendsHttpStatus: 303,
      cacheControl: "no-store",
      pragma: "no-cache",
      referrerPolicy: "no-referrer",
      robotsTag: "noindex, nofollow",
      version: 1,
    },
    localDevelopmentOnly: true,
    allowHttpLocalhostApplicationOrigin: false,
    version: 1,
    ...overrides,
  };
}

function expectedAuthorizationUrl(
  optional: Readonly<Partial<Record<"nonce" | "prompt", string>>> = {},
): string {
  const query = new URLSearchParams();
  query.append("response_type", "code");
  query.append("client_id", CLIENT_ID);
  query.append("redirect_uri", CHATGPT_REDIRECT_URI);
  query.append("scope", `${TWOWEEKS_APPLICATIONS_READ_SCOPE} openid`);
  query.append("state", STATE);
  query.append("code_challenge", PKCE_CHALLENGE);
  query.append("code_challenge_method", "S256");
  query.append("resource", CANONICAL_RESOURCE);
  if (optional.nonce !== undefined) query.append("nonce", optional.nonce);
  if (optional.prompt !== undefined) query.append("prompt", optional.prompt);
  return `${AUTHORIZATION_ORIGIN}${AUTHORIZATION_PATH}?${query.toString()}`;
}

function expectFailureDoesNotEchoSensitiveValues(
  result: McpOAuthPreAuthOwnerBindingResultV1,
): void {
  const serialized = JSON.stringify(result);
  for (const value of [
    STATE,
    PKCE_CHALLENGE,
    CLIENT_ID,
    CHATGPT_REDIRECT_URI,
    OWNER_ID,
    OTHER_OWNER_ID,
    VALID_HANDLE_HASH,
    RAW_HANDLE,
    "person@example.test",
    "id-token-sensitive",
    "authorization_code",
    "access_token",
  ]) {
    expect(serialized).not.toContain(value);
  }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
