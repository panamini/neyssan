import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../mcpAuthPolicyBoundary";
import {
  defaultMcpOAuthContinuationHandleCodecV1,
  prepareMcpOAuthLoginReturnContinuation,
  resumeMcpOAuthAuthorizationAfterLoginReturn,
  type McpOAuthContinuationHandleCodecV1,
  type McpOAuthIntentConsumeInputV1,
  type McpOAuthIntentConsumeResultV1,
  type McpOAuthIntentCreateInputV1,
  type McpOAuthIntentCreateResultV1,
  type McpOAuthLoginReturnContinuationBoundaryConfigV1,
} from "../mcpOAuthLoginReturnContinuationBoundary";
import type {
  McpOAuthAuthorizationRequestBoundaryHandoffV1,
  McpOAuthAuthorizationTrustedOwnerV1,
} from "../mcpOAuthAuthorizationRequestBoundary";
import {
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
  MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
} from "../../../pages/sign-in-return";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_PATH = resolve(TEST_DIR, "../mcpOAuthLoginReturnContinuationBoundary.ts");

const RAW_HANDLE = "A".repeat(43);
const OTHER_RAW_HANDLE = "B".repeat(43);
const HANDLE_HASH = sha256Hex(RAW_HANDLE);
const OTHER_HANDLE_HASH = sha256Hex(OTHER_RAW_HANDLE);
const NOW = Date.parse("2026-06-26T08:00:00.000Z");
const EXPIRES_AT = NOW + 10 * 60 * 1_000;
const APP_ORIGIN = "https://app.twoweeks.example.test";
const AUTHORIZATION_ORIGIN = "https://auth.twoweeks.example.test";
const AUTHORIZATION_PATH = "/oauth/authorize";
const CLIENT_ID = "chatgpt-apps-sdk-client-fixture";
const REDIRECT_URI = "https://chatgpt.example.test/connector/oauth/callback-fixture";
const RESOURCE = "https://mcp.twoweeks.example.test/mcp";
const STATE = "opaque_state_1234567890";
const PKCE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const OWNER: McpOAuthAuthorizationTrustedOwnerV1 = {
  kind: "mcp_oauth_authorization_trusted_owner",
  twoweeksClerkId: "user_twoweeks_fixture_123",
  version: 1,
};
const OTHER_OWNER: McpOAuthAuthorizationTrustedOwnerV1 = {
  kind: "mcp_oauth_authorization_trusted_owner",
  twoweeksClerkId: "user_twoweeks_fixture_456",
  version: 1,
};

const deterministicCodec: McpOAuthContinuationHandleCodecV1 = Object.freeze({
  generate: () => Object.freeze({ rawHandle: RAW_HANDLE, intentHandleHash: HANDLE_HASH }),
  validate: (rawHandle: unknown): rawHandle is string =>
    defaultMcpOAuthContinuationHandleCodecV1.validate(rawHandle),
  hash: (rawHandle: string) => sha256Hex(rawHandle),
});

describe("MCP OAuth login-return continuation boundary", () => {
  it("generates canonical high-entropy handles and SHA-256 lowercase digests", () => {
    const first = defaultMcpOAuthContinuationHandleCodecV1.generate();
    const second = defaultMcpOAuthContinuationHandleCodecV1.generate();

    expect(first.rawHandle).toMatch(/^[A-Za-z0-9_-]{43}$/u);
    expect(first.rawHandle).not.toBe(second.rawHandle);
    expect(first.intentHandleHash).toMatch(/^[0-9a-f]{64}$/u);
    expect(first.intentHandleHash).toBe(sha256Hex(first.rawHandle));
    expect(defaultMcpOAuthContinuationHandleCodecV1.hash(RAW_HANDLE)).toBe(HANDLE_HASH);
    expect(defaultMcpOAuthContinuationHandleCodecV1.hash(OTHER_RAW_HANDLE)).toBe(OTHER_HANDLE_HASH);
    expect(defaultMcpOAuthContinuationHandleCodecV1.validate(`${RAW_HANDLE}=`)).toBe(false);
    expect(defaultMcpOAuthContinuationHandleCodecV1.validate(`${RAW_HANDLE}\n`)).toBe(false);
    expect(defaultMcpOAuthContinuationHandleCodecV1.validate("short")).toBe(false);
  });

  it("prepares a digest-only intent and a fixed same-origin sign-in return", async () => {
    const createIntent = vi.fn<[McpOAuthIntentCreateInputV1], Promise<McpOAuthIntentCreateResultV1>>(
      async () => createOk(),
    );

    const result = await prepareMcpOAuthLoginReturnContinuation({
      kind: "prepare_mcp_oauth_login_return_continuation_input",
      authorizationRequestHandoff: handoff(),
      trustedOwner: OWNER,
      createIntent,
      handleCodec: deterministicCodec,
      now: NOW,
      config: config(),
      version: 1,
    });

    expect(result.prepared).toBe(true);
    expect(createIntent).toHaveBeenCalledTimes(1);
    expect(createIntent.mock.calls[0]?.[0]).toMatchObject({
      authorizationRequestHandoff: handoff(),
      intentHandleHash: HANDLE_HASH,
      now: NOW,
      version: 1,
    });
    expect(JSON.stringify(createIntent.mock.calls[0]?.[0])).not.toContain(RAW_HANDLE);

    if (!result.prepared) throw new Error("expected prepare success");
    const expectedContinuationPath = `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}`;
    expect(result.serverOnly.continuationPath).toBe(expectedContinuationPath);
    expect(result.serverOnly.continuationUrl).toBe(`${APP_ORIGIN}${expectedContinuationPath}`);
    expect(result.serverOnly.signInUrl).toBe(
      `${APP_ORIGIN}/sign-in?${MCP_OAUTH_SIGN_IN_RETURN_PARAMETER}=${encodeURIComponent(expectedContinuationPath)}`,
    );
    expect(result.serverOnly.signInUrl).not.toContain(STATE);
    expect(result.serverOnly.signInUrl).not.toContain(PKCE);
    expect(result.serverOnly.signInUrl).not.toContain(CLIENT_ID);
    expect(result.serverOnly.signInUrl).not.toContain(REDIRECT_URI);
    expect(result.serverOnly.signInUrl).not.toContain(RESOURCE);
    expect(result.serverOnly.signInUrl).not.toContain(OWNER.twoweeksClerkId);
    expect(result.serverOnly.signInUrl).not.toContain(HANDLE_HASH);
    expect(result.serverOnly).toMatchObject({
      authorizationGranted: false,
      providerValidationPending: true,
      consentCompleted: false,
      authorizationCodeIssued: false,
      tokenIssued: false,
      accountLinkCreated: false,
    });
    expect(result.modelVisible).toBe(false);
    expect(result.safeForLogging).toBe(false);
  });

  it("fails closed on create failure without echoing raw handle, digest, or storage text", async () => {
    const result = await prepareMcpOAuthLoginReturnContinuation({
      kind: "prepare_mcp_oauth_login_return_continuation_input",
      authorizationRequestHandoff: handoff(),
      trustedOwner: OWNER,
      createIntent: async () => createDenied("database leaked fixture text"),
      handleCodec: deterministicCodec,
      now: NOW,
      config: config(),
      version: 1,
    });

    expect(result).toMatchObject({
      prepared: false,
      reason: "intent_create_failed",
      safeFailure: {
        message: "OAuth continuation unavailable.",
        rawHandleEchoed: false,
        digestEchoed: false,
        sensitiveValuesEchoed: false,
      },
      safeForLogging: true,
    });
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain(RAW_HANDLE);
    expect(serialized).not.toContain(HANDLE_HASH);
    expect(serialized).not.toContain("database leaked fixture text");
  });

  it("rejects a generated digest that does not match the generated raw handle", async () => {
    const createIntent = vi.fn<[McpOAuthIntentCreateInputV1], Promise<McpOAuthIntentCreateResultV1>>(
      async () => createOk(),
    );
    const mismatchedCodec: McpOAuthContinuationHandleCodecV1 = Object.freeze({
      ...deterministicCodec,
      generate: () => Object.freeze({ rawHandle: RAW_HANDLE, intentHandleHash: OTHER_HANDLE_HASH }),
    });

    const result = await prepareMcpOAuthLoginReturnContinuation({
      kind: "prepare_mcp_oauth_login_return_continuation_input",
      authorizationRequestHandoff: handoff(),
      trustedOwner: OWNER,
      createIntent,
      handleCodec: mismatchedCodec,
      now: NOW,
      config: config(),
      version: 1,
    });

    expect(result).toMatchObject({
      prepared: false,
      reason: "invalid_continuation_handle",
    });
    expect(createIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(RAW_HANDLE);
    expect(JSON.stringify(result)).not.toContain(OTHER_HANDLE_HASH);
  });

  it("requires an explicit sensitive-hint decision instead of silently omitting hints", async () => {
    const createIntent = vi.fn<[McpOAuthIntentCreateInputV1], Promise<McpOAuthIntentCreateResultV1>>(
      async () => createOk(),
    );

    const result = await prepareMcpOAuthLoginReturnContinuation({
      kind: "prepare_mcp_oauth_login_return_continuation_input",
      authorizationRequestHandoff: handoff({
        approvedOptionalParameters: { login_hint: "person@example.test" },
      }),
      trustedOwner: OWNER,
      createIntent,
      handleCodec: deterministicCodec,
      now: NOW,
      config: config(),
      version: 1,
    });

    expect(result).toMatchObject({
      prepared: false,
      reason: "sensitive_hint_continuation_decision_required",
    });
    expect(createIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain("person@example.test");
  });

  it("resumes by hashing the handle, consuming once, and reconstructing the normalized authorization URL", async () => {
    const consumeIntent = vi.fn<[McpOAuthIntentConsumeInputV1], Promise<McpOAuthIntentConsumeResultV1>>(
      async () => consumeOk(handoff({ approvedOptionalParameters: { nonce: "nonce-123", prompt: "consent" } })),
    );
    const continuationUrl = `${APP_ORIGIN}${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}`;

    const result = await resumeMcpOAuthAuthorizationAfterLoginReturn({
      kind: "resume_mcp_oauth_authorization_after_login_return_input",
      continuationUrlOrPath: continuationUrl,
      trustedOwner: OWNER,
      consumeIntent,
      handleCodec: deterministicCodec,
      now: NOW,
      config: config(),
      version: 1,
    });

    expect(result.resumed).toBe(true);
    expect(consumeIntent).toHaveBeenCalledTimes(1);
    expect(consumeIntent.mock.calls[0]?.[0]).toEqual({
      trustedOwner: OWNER,
      intentHandleHash: HANDLE_HASH,
      now: NOW,
      version: 1,
    });
    expect(JSON.stringify(consumeIntent.mock.calls[0]?.[0])).not.toContain(RAW_HANDLE);

    if (!result.resumed) throw new Error("expected resume success");
    expect(result.serverOnly.authorizationUrl).toBe(
      expectedAuthorizationUrl({ nonce: "nonce-123", prompt: "consent" }),
    );
    expect(result.serverOnly.authorizationUrl).not.toContain(RAW_HANDLE);
    expect(result.serverOnly.authorizationUrl).not.toContain(HANDLE_HASH);
    expect(result.serverOnly.authorizationUrl).not.toContain(OWNER.twoweeksClerkId);
    expect(result.serverOnly.authorizationGranted).toBe(false);
    expect(result.safeForLogging).toBe(false);
  });

  it("rejects malformed codec digests before calling consume storage", async () => {
    const consumeIntent = vi.fn<[McpOAuthIntentConsumeInputV1], Promise<McpOAuthIntentConsumeResultV1>>(
      async () => consumeOk(handoff()),
    );
    const rawHandleHashingCodec: McpOAuthContinuationHandleCodecV1 = Object.freeze({
      ...deterministicCodec,
      hash: () => RAW_HANDLE,
    });

    const result = await resumeMcpOAuthAuthorizationAfterLoginReturn({
      kind: "resume_mcp_oauth_authorization_after_login_return_input",
      continuationUrlOrPath: `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}`,
      trustedOwner: OWNER,
      consumeIntent,
      handleCodec: rawHandleHashingCodec,
      now: NOW,
      config: config(),
      version: 1,
    });

    expect(result).toMatchObject({
      resumed: false,
      reason: "invalid_continuation_handle",
    });
    expect(consumeIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(RAW_HANDLE);
  });

  it.each([
    ["wrong origin", "https://evil.example.test/mcp/oauth/authorize/continue?mcp_oauth_intent=abc"],
    ["wrong path", "/cv?mcp_oauth_intent=abc"],
    ["credentials", "https://user:pass@app.twoweeks.example.test/mcp/oauth/authorize/continue?mcp_oauth_intent=abc"],
    ["fragment", "/mcp/oauth/authorize/continue?mcp_oauth_intent=abc#fragment"],
    ["missing handle", "/mcp/oauth/authorize/continue"],
    ["duplicate handle", "/mcp/oauth/authorize/continue?mcp_oauth_intent=abc&mcp_oauth_intent=def"],
    ["unknown query", "/mcp/oauth/authorize/continue?mcp_oauth_intent=abc&next=/cv"],
    ["owner override", "/mcp/oauth/authorize/continue?mcp_oauth_intent=abc&owner=user"],
    ["path traversal", "/mcp/oauth/authorize/%2e%2e/continue?mcp_oauth_intent=abc"],
    ["encoded origin confusion", "/mcp/oauth/authorize/continue?mcp_oauth_intent=https%3A%2F%2Fevil.example"],
  ])("rejects invalid continuation URL: %s", async (_label, continuationUrlOrPath) => {
    const consumeIntent = vi.fn<[McpOAuthIntentConsumeInputV1], Promise<McpOAuthIntentConsumeResultV1>>(
      async () => consumeOk(handoff()),
    );

    const result = await resumeMcpOAuthAuthorizationAfterLoginReturn({
      kind: "resume_mcp_oauth_authorization_after_login_return_input",
      continuationUrlOrPath,
      trustedOwner: OWNER,
      consumeIntent,
      handleCodec: deterministicCodec,
      now: NOW,
      config: config(),
      version: 1,
    });

    expect(result.resumed).toBe(false);
    expect(consumeIntent).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain(RAW_HANDLE);
    expect(JSON.stringify(result)).not.toContain(HANDLE_HASH);
  });

  it.each([
    ["replay", "already_consumed", "intent_expired_or_consumed"],
    ["expired", "expired", "intent_expired_or_consumed"],
    ["wrong owner", "not_found_or_forbidden", "owner_or_intent_mismatch"],
    ["missing intent", "not_found_or_forbidden", "owner_or_intent_mismatch"],
  ] as const)("fails generically on %s consume denial", async (_label, storageReason, boundaryReason) => {
    const result = await resumeMcpOAuthAuthorizationAfterLoginReturn({
      kind: "resume_mcp_oauth_authorization_after_login_return_input",
      continuationUrlOrPath: `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}`,
      trustedOwner: OWNER,
      consumeIntent: async () => consumeDenied(storageReason),
      handleCodec: deterministicCodec,
      now: NOW,
      config: config(),
      version: 1,
    });

    expect(result).toMatchObject({
      resumed: false,
      reason: boundaryReason,
      safeFailure: {
        message: "OAuth continuation unavailable.",
        rawHandleEchoed: false,
        digestEchoed: false,
        identityEchoed: false,
      },
    });
    expect(JSON.stringify(result)).not.toContain(RAW_HANDLE);
    expect(JSON.stringify(result)).not.toContain(HANDLE_HASH);
  });

  it("does not let owner fields in OAuth values authorize a different trusted owner", async () => {
    const result = await resumeMcpOAuthAuthorizationAfterLoginReturn({
      kind: "resume_mcp_oauth_authorization_after_login_return_input",
      continuationUrlOrPath: `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}`,
      trustedOwner: OWNER,
      consumeIntent: async () => consumeOk(handoff({ trustedOwner: OTHER_OWNER })),
      handleCodec: deterministicCodec,
      now: NOW,
      config: config(),
      version: 1,
    });

    expect(result).toMatchObject({
      resumed: false,
      reason: "malformed_consumed_handoff",
    });
    expect(JSON.stringify(result)).not.toContain(OTHER_OWNER.twoweeksClerkId);
  });

  it("keeps source route-independent and free of provider/runtime wiring", () => {
    const source = readFileSync(SOURCE_PATH, "utf8");

    expect(source).not.toMatch(/\b(?:React|jsx|Route|createBrowserRouter|RouterProvider|Vite|vite)\b/iu);
    expect(source).not.toMatch(/@clerk|@stytch|\b(?:SignInButton|SignInPage|Stytch)\b|Trusted Auth Token/iu);
    expect(source).not.toMatch(/\b(?:fetch|axios|XMLHttpRequest)\b/u);
    expect(source).not.toMatch(/\b(?:window|document|localStorage|sessionStorage|process\.env|console\.)\b/u);
    expect(source).not.toMatch(/Math\.random/u);
    expect(source).not.toMatch(/token\s*endpoint|refresh[_-]?token|account[_-]?link.*mutation/iu);
  });
});

function config(
  overrides: Partial<McpOAuthLoginReturnContinuationBoundaryConfigV1> = {},
): McpOAuthLoginReturnContinuationBoundaryConfigV1 {
  return {
    kind: "mcp_oauth_login_return_continuation_boundary_config",
    applicationOrigin: APP_ORIGIN,
    fixedSignInPath: "/sign-in",
    fixedContinuationPath: MCP_OAUTH_CONTINUATION_PATH,
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

function handoff(
  overrides: Readonly<{
    trustedOwner?: McpOAuthAuthorizationTrustedOwnerV1;
    approvedOptionalParameters?: McpOAuthAuthorizationRequestBoundaryHandoffV1["providerForwardRequest"]["approvedOptionalParameters"];
  }> = {},
): McpOAuthAuthorizationRequestBoundaryHandoffV1 {
  const approvedOptionalParameters = overrides.approvedOptionalParameters;
  return {
    authorizationPage: {
      origin: AUTHORIZATION_ORIGIN,
      path: AUTHORIZATION_PATH,
    },
    providerForwardRequest: {
      responseType: "code",
      clientId: CLIENT_ID,
      redirectUri: REDIRECT_URI,
      resource: RESOURCE,
      scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE, "openid"],
      state: STATE,
      pkce: {
        codeChallenge: PKCE,
        codeChallengeMethod: "S256",
      },
      ...(approvedOptionalParameters ? { approvedOptionalParameters } : {}),
      version: 1,
    },
    trustedOwner: overrides.trustedOwner ?? OWNER,
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
      path: `${AUTHORIZATION_PATH}?response_type=code`,
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

function createOk(): McpOAuthIntentCreateResultV1 {
  return {
    kind: "mcp_oauth_authorization_intent_create_result",
    ok: true,
    reason: "created",
    serverOnly: {
      status: "pending",
      expiresAt: EXPIRES_AT,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  };
}

function createDenied(reason: string): McpOAuthIntentCreateResultV1 {
  return {
    kind: "mcp_oauth_authorization_intent_create_result",
    ok: false,
    reason,
    safeFailure: {
      message: reason,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function consumeOk(
  authorizationRequestHandoff: McpOAuthAuthorizationRequestBoundaryHandoffV1,
): McpOAuthIntentConsumeResultV1 {
  return {
    kind: "mcp_oauth_authorization_intent_consume_result",
    ok: true,
    reason: "consumed",
    serverOnly: {
      authorizationRequestHandoff,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  };
}

function consumeDenied(reason: string): McpOAuthIntentConsumeResultV1 {
  return {
    kind: "mcp_oauth_authorization_intent_consume_result",
    ok: false,
    reason,
    safeFailure: {
      message: reason,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  };
}

function expectedAuthorizationUrl(optional: Readonly<Partial<Record<"nonce" | "prompt", string>>> = {}): string {
  const query = new URLSearchParams();
  query.append("response_type", "code");
  query.append("client_id", CLIENT_ID);
  query.append("redirect_uri", REDIRECT_URI);
  query.append("scope", `${TWOWEEKS_APPLICATIONS_READ_SCOPE} openid`);
  query.append("state", STATE);
  query.append("code_challenge", PKCE);
  query.append("code_challenge_method", "S256");
  query.append("resource", RESOURCE);
  if (optional.nonce !== undefined) query.append("nonce", optional.nonce);
  if (optional.prompt !== undefined) query.append("prompt", optional.prompt);
  return `${AUTHORIZATION_ORIGIN}${AUTHORIZATION_PATH}?${query.toString()}`;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
