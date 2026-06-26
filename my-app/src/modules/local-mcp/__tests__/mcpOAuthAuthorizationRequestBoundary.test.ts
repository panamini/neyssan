import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  parseMcpOAuthAuthorizationRequestBoundary,
  projectMcpOAuthPreAuthAuthorizationRequest,
  type McpOAuthAuthorizationRequestBoundaryConfigV1,
  type McpOAuthAuthorizationRequestBoundaryDenialReasonV1,
  type McpOAuthAuthorizationTrustedOwnerV1,
} from "../mcpOAuthAuthorizationRequestBoundary";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../mcpAuthPolicyBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const BOUNDARY_SOURCE = resolve(TEST_DIR, "../mcpOAuthAuthorizationRequestBoundary.ts");

const AUTHORIZATION_ORIGIN = "https://auth.twoweeks.example.test";
const AUTHORIZATION_PATH = "/oauth/authorize";
const CANONICAL_RESOURCE = "https://mcp.twoweeks.example.test/mcp";
const CHATGPT_REDIRECT_URI = "https://chatgpt.example.test/connector/oauth/callback-fixture";
const CLIENT_ID = "chatgpt-apps-sdk-client-fixture";
const OWNER_ID = "user_twoweeks_fixture_123";
const STATE = "opaque_state_1234567890";
const PKCE_CHALLENGE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const ID_TOKEN_HINT = "id-token-hint-fixture-sensitive";
const STATIC_MODULE_SPECIFIER_PATTERN =
  /^\s*(?:import(?:\s+type)?(?:\s+[\s\S]*?\s+from)?|export[\s\S]*?\sfrom)\s+(["'])([^"'`]+)\1\s*;?/gmu;
const DYNAMIC_MODULE_SPECIFIER_PATTERN =
  /\bimport\s*\(\s*(?:\/\*[\s\S]*?\*\/\s*)*(?:(["'])([^"'`]+)\1|`([^`$]+)`)\s*\)/gmu;
const FORBIDDEN_MODULE_PATTERN =
  /(?:axios|@stytch|@clerk|convex|vite|react|node:https?|openai|@modelcontextprotocol)/iu;

describe("MCP OAuth authorization request boundary", () => {
  it("accepts a valid synthetic authorization request as an immutable provider-pending handoff", () => {
    const result = parseMcpOAuthAuthorizationRequestBoundary(buildInput());

    expect(result).toMatchObject({
      kind: "mcp_oauth_authorization_request_boundary_result",
      accepted: true,
      reason: "accepted",
      serverOnly: {
        authorizationPage: {
          origin: AUTHORIZATION_ORIGIN,
          path: AUTHORIZATION_PATH,
        },
        providerForwardRequest: {
          responseType: "code",
          clientId: CLIENT_ID,
          redirectUri: CHATGPT_REDIRECT_URI,
          resource: CANONICAL_RESOURCE,
          scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
          state: STATE,
          pkce: {
            codeChallenge: PKCE_CHALLENGE,
            codeChallengeMethod: "S256",
          },
        },
        trustedOwner: {
          kind: "mcp_oauth_authorization_trusted_owner",
          twoweeksClerkId: OWNER_ID,
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
        },
        loginReturn: {
          path: expect.stringContaining(AUTHORIZATION_PATH),
          target: "authorization_page",
          usesClientRedirectUri: false,
          containsOwnerIdentity: false,
          sensitiveOptionalParametersInUrl: false,
        },
        futureIntent: {
          preservesProviderForwardRequest: true,
          serverMustPersistBeforeLoginReturn: true,
          serverPreservedSensitiveOptionalParameters: ["login_hint", "id_token_hint"],
        },
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(result.accepted && Object.isFrozen(result.serverOnly.providerForwardRequest.scopes)).toBe(true);
    expect(JSON.stringify(result)).not.toContain("Authorization granted");
    expect(JSON.stringify(result)).not.toContain("account_link_created");
  });

  it("normalizes equivalent parameter order deterministically", () => {
    const first = parseMcpOAuthAuthorizationRequestBoundary(buildInput());
    const second = parseMcpOAuthAuthorizationRequestBoundary(
      buildInput({
        authorizationUrl: buildAuthorizationUrl({
          order: [
            "resource",
            "code_challenge_method",
            "code_challenge",
            "state",
            "scope",
            "redirect_uri",
            "client_id",
            "response_type",
          ],
        }),
      }),
    );

    expect(first).toEqual(second);
  });

  it("projects a validated ownerless pre-auth request without trusting or storing an owner", () => {
    const result = projectMcpOAuthPreAuthAuthorizationRequest(
      buildPreAuthProjectionInput({
        authorizationUrl: buildAuthorizationUrl({
          overrides: {
            nonce: "nonce_fixture",
            prompt: "consent",
          },
        }),
      }),
    );

    expect(result).toMatchObject({
      kind: "mcp_oauth_pre_auth_authorization_request_projection_result",
      accepted: true,
      reason: "accepted",
      serverOnly: {
        kind: "mcp_oauth_pre_auth_authorization_request_projection",
        authorizationPage: {
          origin: AUTHORIZATION_ORIGIN,
          path: AUTHORIZATION_PATH,
        },
        providerForwardRequest: {
          responseType: "code",
          clientId: CLIENT_ID,
          redirectUri: CHATGPT_REDIRECT_URI,
          resource: CANONICAL_RESOURCE,
          scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
          state: STATE,
          pkce: {
            codeChallenge: PKCE_CHALLENGE,
            codeChallengeMethod: "S256",
          },
          approvedOptionalParameters: {
            nonce: "nonce_fixture",
            prompt: "consent",
          },
        },
        preAuthIntent: {
          status: "pre_auth_pending",
          containsOwnerIdentity: false,
          containsProviderSubject: false,
          containsAccountLinkId: false,
          authorizationGranted: false,
          authorizationCodeIssued: false,
          tokenIssued: false,
          accountLinkCreated: false,
        },
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    });
    expect(JSON.stringify(result)).not.toContain(OWNER_ID);
    expect(JSON.stringify(result)).not.toContain("twoweeksClerkId");
    expect(JSON.stringify(result)).not.toContain("accountLinkId");
    expect(Object.isFrozen(result)).toBe(true);
  });

  it("keeps owner-bound parsing unchanged while pre-auth rejects the same invalid request", () => {
    const invalidUrl = buildAuthorizationUrl({ overrides: { scope: "openid" } });

    expectDenied(buildInput({ authorizationUrl: invalidUrl }), "missing_canonical_scope");
    expectPreAuthProjectionDenied(
      buildPreAuthProjectionInput({ authorizationUrl: invalidUrl }),
      "missing_canonical_scope",
    );
  });

  it("denies malformed pre-auth projection inputs before parsing request details", () => {
    expectPreAuthProjectionDenied(
      {
        ...buildPreAuthProjectionInput(),
        kind: "mcp_oauth_authorization_request_boundary_input",
      },
      "malformed_input",
    );
    expectPreAuthProjectionDenied({ ...buildPreAuthProjectionInput(), version: 2 }, "malformed_input");
  });

  it("denies malformed pre-auth projection config before accepting the request", () => {
    expectPreAuthProjectionDenied(
      {
        ...buildPreAuthProjectionInput(),
        config: { ...buildConfig(), version: 2 },
      },
      "malformed_config",
    );
  });

  describe("authorization URL", () => {
    it.each([
      ["relative URL", `${AUTHORIZATION_PATH}?response_type=code`, "malformed_input"],
      ["HTTP URL outside local mode", validUrl().replace("https://", "http://"), "wrong_authorization_origin"],
      ["wrong origin", buildAuthorizationUrl({ origin: "https://evil.example.test" }), "wrong_authorization_origin"],
      ["wrong path", buildAuthorizationUrl({ path: "/oauth/other" }), "wrong_authorization_path"],
      ["credentials", buildAuthorizationUrl({ origin: "https://user:pass@auth.twoweeks.example.test" }), "malformed_input"],
      ["fragment", `${validUrl()}#fragment`, "malformed_input"],
      [
        "malformed percent encoding",
        validUrl().replace(`state=${encodeURIComponent(STATE)}`, "state=%E0%A4%A"),
        "malformed_input",
      ],
      ["oversized URL", `${validUrl()}&extra=${"x".repeat(600)}`, "malformed_input"],
      ["control characters", `${validUrl()}\n`, "malformed_input"],
    ] as const)("rejects %s", (_label, authorizationUrl, reason) => {
      expectDenied(buildInput({ authorizationUrl }), reason);
    });

    it("accepts IPv6 localhost HTTP authorization origin only when local mode allows it", () => {
      const authorizationPageOrigin = "http://[::1]";
      const result = parseMcpOAuthAuthorizationRequestBoundary(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ origin: authorizationPageOrigin }),
          config: buildConfig({
            authorizationPageOrigin,
            allowHttpLocalhostAuthorizationOrigin: true,
          }),
        }),
      );

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.serverOnly.authorizationPage.origin).toBe(authorizationPageOrigin);
      }
    });

    it("rejects IPv6 localhost HTTP authorization origin when local mode is disabled", () => {
      const authorizationPageOrigin = "http://[::1]";

      expectDenied(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ origin: authorizationPageOrigin }),
          config: buildConfig({
            authorizationPageOrigin,
            allowHttpLocalhostAuthorizationOrigin: false,
          }),
        }),
        "malformed_config",
      );
    });
  });

  describe("parameter cardinality", () => {
    it.each([
      "response_type",
      "client_id",
      "redirect_uri",
      "scope",
      "state",
      "code_challenge",
      "code_challenge_method",
      "resource",
    ] as const)("rejects a missing %s parameter", (parameter) => {
      expectDenied(buildInput({ authorizationUrl: buildAuthorizationUrl({ without: [parameter] }) }), "missing_parameter");
    });

    it.each([
      "client_id",
      "redirect_uri",
      "resource",
      "state",
      "code_challenge",
      "scope",
    ] as const)("rejects duplicate %s", (parameter) => {
      expectDenied(buildInput({ authorizationUrl: buildAuthorizationUrl({ duplicate: parameter }) }), "duplicate_parameter");
    });

    it("rejects empty required values", () => {
      expectDenied(buildInput({ authorizationUrl: buildAuthorizationUrl({ overrides: { state: "" } }) }), "missing_parameter");
    });
  });

  describe("redirect URI", () => {
    it("accepts the exact configured redirect URI", () => {
      expect(parseMcpOAuthAuthorizationRequestBoundary(buildInput()).accepted).toBe(true);
    });

    it.each([
      ["unapproved", "https://chatgpt.example.test/connector/oauth/other"],
      ["prefix confusion", `${CHATGPT_REDIRECT_URI}/extra`],
      ["suffix confusion", `${CHATGPT_REDIRECT_URI}.evil.test`],
      ["wildcard-like", "https://*.example.test/connector/oauth/callback-fixture"],
      ["credentialed", "https://user:pass@chatgpt.example.test/connector/oauth/callback-fixture"],
      ["fragment", `${CHATGPT_REDIRECT_URI}#frag`],
      ["lookalike host", "https://chatgpt.example.test.evil.test/connector/oauth/callback-fixture"],
      ["path traversal", "https://chatgpt.example.test/connector/oauth/../callback-fixture"],
    ] as const)("rejects %s redirect URI", (_label, redirectUri) => {
      expectDenied(
        buildInput({ authorizationUrl: buildAuthorizationUrl({ overrides: { redirect_uri: redirectUri } }) }),
        "unapproved_redirect_uri",
      );
    });

    it("rejects wildcard hosts in configured redirect URIs", () => {
      const redirectUri = "https://*.example.test/connector/oauth/callback-fixture";
      expectDenied(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { redirect_uri: redirectUri } }),
          config: buildConfig({ allowedRedirectUris: [redirectUri] }),
        }),
        "malformed_config",
      );
    });
  });

  describe("resource", () => {
    it.each([
      ["different origin", "https://other-resource.example.test/mcp"],
      ["different path", "https://mcp.twoweeks.example.test/other"],
      ["query variant", `${CANONICAL_RESOURCE}?x=1`],
      ["fragment variant", `${CANONICAL_RESOURCE}#fragment`],
      ["encoded lookalike", "https://mcp.twoweeks.example.test/%6dcp"],
    ] as const)("rejects %s", (_label, resource) => {
      expectDenied(
        buildInput({ authorizationUrl: buildAuthorizationUrl({ overrides: { resource } }) }),
        "wrong_resource",
      );
    });

    it("rejects wildcard hosts in the configured canonical resource", () => {
      const resource = "https://*.example.test/mcp";
      expectDenied(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { resource } }),
          config: buildConfig({ canonicalResource: resource }),
        }),
        "malformed_config",
      );
    });
  });

  describe("client ID", () => {
    it("accepts an exact allowlisted CIMD URL client ID", () => {
      const clientId = "https://chatgpt.com/oauth/client-fixture/client.json";
      const result = parseMcpOAuthAuthorizationRequestBoundary(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { client_id: clientId } }),
          config: buildConfig({
            clientIdPolicy: {
              mode: "predefined_allowlist",
              allowedClientIds: [clientId],
              version: 1,
            },
          }),
        }),
      );

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.serverOnly.providerForwardRequest.clientId).toBe(clientId);
      }
    });
  });

  describe("PKCE", () => {
    it("accepts S256", () => {
      expect(parseMcpOAuthAuthorizationRequestBoundary(buildInput()).accepted).toBe(true);
    });

    it.each([
      ["plain method", { code_challenge_method: "plain" }, "invalid_pkce"],
      ["missing challenge", { code_challenge: undefined }, "missing_parameter"],
      ["malformed challenge", { code_challenge: `${PKCE_CHALLENGE}=` }, "invalid_pkce"],
      ["too short challenge", { code_challenge: "short" }, "invalid_pkce"],
      ["oversized challenge", { code_challenge: "a".repeat(129) }, "invalid_pkce"],
    ] as const)("rejects %s", (_label, overrides, reason) => {
      expectDenied(
        buildInput({ authorizationUrl: buildAuthorizationUrl({ overrides }) }),
        reason,
      );
    });
  });

  describe("scope", () => {
    it.each([
      ["missing canonical scope", "openid", "missing_canonical_scope"],
      ["old dotted-only scope", "twoweeks.mcp.read", "legacy_scope"],
      ["canonical plus old dotted scope", `${TWOWEEKS_APPLICATIONS_READ_SCOPE} twoweeks.mcp.read`, "legacy_scope"],
      ["write scope", `${TWOWEEKS_APPLICATIONS_READ_SCOPE} twoweeks:applications:write`, "unapproved_scope"],
      ["duplicate canonical scope", `${TWOWEEKS_APPLICATIONS_READ_SCOPE} ${TWOWEEKS_APPLICATIONS_READ_SCOPE}`, "duplicate_scope"],
      ["unapproved OIDC scope", `${TWOWEEKS_APPLICATIONS_READ_SCOPE} openid`, "unapproved_scope"],
      ["malformed scope", `${TWOWEEKS_APPLICATIONS_READ_SCOPE} bad/scope`, "malformed_scope"],
    ] as const)("rejects %s", (_label, scope, reason) => {
      expectDenied(
        buildInput({ authorizationUrl: buildAuthorizationUrl({ overrides: { scope } }) }),
        reason,
      );
    });

    it("accepts an optional OIDC scope only when explicitly configured", () => {
      const result = parseMcpOAuthAuthorizationRequestBoundary(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { scope: `${TWOWEEKS_APPLICATIONS_READ_SCOPE} openid` } }),
          config: buildConfig({ approvedOptionalScopes: ["openid"] }),
        }),
      );

      expect(result.accepted && result.serverOnly.providerForwardRequest.scopes).toEqual([
        TWOWEEKS_APPLICATIONS_READ_SCOPE,
        "openid",
      ]);
    });
  });

  describe("sensitive optional parameters", () => {
    it("accepts state longer than the generic parameter limit when it is within the state limit", () => {
      const state = "s".repeat(120);
      const result = parseMcpOAuthAuthorizationRequestBoundary(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { state } }),
          config: buildConfig({
            maxParameterLength: 90,
            maxStateLength: 128,
            maxUrlLength: 700,
          }),
        }),
      );

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.serverOnly.providerForwardRequest.state).toBe(state);
      }
    });

    it("rejects state longer than the dedicated state limit", () => {
      expectDenied(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { state: "s".repeat(129) } }),
          config: buildConfig({
            maxParameterLength: 90,
            maxStateLength: 128,
            maxUrlLength: 700,
          }),
        }),
        "invalid_state",
      );
    });

    it("keeps accepted id_token_hint server-only and out of safe metadata", () => {
      const result = parseMcpOAuthAuthorizationRequestBoundary(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { id_token_hint: ID_TOKEN_HINT } }),
        }),
      );

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.serverOnly.providerForwardRequest.approvedOptionalParameters).toEqual({
          id_token_hint: ID_TOKEN_HINT,
        });
        expect(result.serverOnly.futureIntent.preservesProviderForwardRequest).toBe(true);
        expect(result.serverOnly.futureIntent.serverMustPersistBeforeLoginReturn).toBe(true);
        expect(result.serverOnly.futureIntent.serverPreservedSensitiveOptionalParameters).toEqual([
          "login_hint",
          "id_token_hint",
        ]);
        expect(result.serverOnly.loginReturn.path).not.toContain("id_token_hint=");
        expect(result.serverOnly.loginReturn.path).not.toContain(ID_TOKEN_HINT);
        expect(result.serverOnly.loginReturn.sensitiveOptionalParametersInUrl).toBe(false);
        expect(result.modelVisible).toBe(false);
        expect(result.safeForLogging).toBe(false);
      }
    });

    it("accepts id_token_hint longer than the generic parameter limit when it is within the hint limit", () => {
      const idTokenHint = "h".repeat(120);
      const result = parseMcpOAuthAuthorizationRequestBoundary(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { id_token_hint: idTokenHint } }),
          config: buildConfig({
            maxParameterLength: 90,
            maxIdTokenHintLength: 128,
            maxUrlLength: 700,
          }),
        }),
      );

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.serverOnly.providerForwardRequest.approvedOptionalParameters).toEqual({
          id_token_hint: idTokenHint,
        });
      }
    });

    it("rejects id_token_hint longer than the dedicated hint limit", () => {
      expectDenied(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { id_token_hint: "h".repeat(129) } }),
          config: buildConfig({
            maxParameterLength: 90,
            maxIdTokenHintLength: 128,
            maxUrlLength: 700,
          }),
        }),
        "malformed_input",
      );
    });

    it("rejects oversized id_token_hint without echoing it", () => {
      const hint = "sensitive.".repeat(80);
      const result = parseMcpOAuthAuthorizationRequestBoundary(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { id_token_hint: hint } }),
        }),
      );

      expect(result.accepted).toBe(false);
      expect(JSON.stringify(result)).not.toContain(hint);
    });

    it("does not let login_hint or state establish owner identity", () => {
      const result = parseMcpOAuthAuthorizationRequestBoundary(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({
            overrides: {
              login_hint: "other-user@example.test",
              state: "clerk_user_attempt_123",
            },
          }),
        }),
      );

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.serverOnly.trustedOwner.twoweeksClerkId).toBe(OWNER_ID);
        expect(result.serverOnly.trustedOwner.twoweeksClerkId).not.toBe("clerk_user_attempt_123");
        expect(result.serverOnly.providerForwardRequest.approvedOptionalParameters).toEqual({
          login_hint: "other-user@example.test",
        });
        expect(result.serverOnly.loginReturn.path).not.toContain("login_hint=");
        expect(result.serverOnly.loginReturn.path).not.toContain("other-user@example.test");
        expect(result.serverOnly.futureIntent.preservesProviderForwardRequest).toBe(true);
        expect(result.serverOnly.futureIntent.serverMustPersistBeforeLoginReturn).toBe(true);
        expect(result.serverOnly.futureIntent.serverPreservedSensitiveOptionalParameters).toEqual([
          "login_hint",
          "id_token_hint",
        ]);
        expect(result.serverOnly.loginReturn.sensitiveOptionalParametersInUrl).toBe(false);
      }
    });
  });

  describe("owner override", () => {
    it.each([
      "userId",
      "clerkId",
      "twoweeksClerkId",
      "owner",
      "ownerId",
      "workspaceId",
      "email",
    ] as const)("rejects %s query ownership override without echo", (key) => {
      const attempted = `${key}_attempt_fixture`;
      const result = parseMcpOAuthAuthorizationRequestBoundary(
        buildInput({ authorizationUrl: buildAuthorizationUrl({ overrides: { [key]: attempted } }) }),
      );

      expect(result).toMatchObject({
        accepted: false,
        reason: "identity_override_forbidden",
      });
      expect(JSON.stringify(result)).not.toContain(attempted);
    });
  });

  describe("login-return safety", () => {
    it("returns a same-origin authorization-page path that preserves only the validated provider request", () => {
      const result = parseMcpOAuthAuthorizationRequestBoundary(buildInput());

      expect(result.accepted).toBe(true);
      if (result.accepted) {
        expect(result.serverOnly.loginReturn.path.startsWith(`${AUTHORIZATION_PATH}?`)).toBe(true);
        expect(result.serverOnly.loginReturn.path).toContain("response_type=code");
        expect(result.serverOnly.loginReturn.path).toContain("code_challenge=");
        expect(result.serverOnly.loginReturn.path).not.toContain(CHATGPT_REDIRECT_URI);
        expect(result.serverOnly.loginReturn.path).not.toContain(OWNER_ID);
        expect(result.serverOnly.loginReturn.usesClientRedirectUri).toBe(false);
        expect(result.serverOnly.loginReturn.containsOwnerIdentity).toBe(false);
      }
    });

    it("rejects arbitrary return URLs instead of preserving them", () => {
      expectDenied(
        buildInput({
          authorizationUrl: buildAuthorizationUrl({ overrides: { returnTo: "https://evil.example.test" } }),
        }),
        "unsupported_parameter",
      );
    });
  });

  it("does not echo sensitive request values in denial output or logs", () => {
    const spies = [vi.spyOn(console, "log"), vi.spyOn(console, "info"), vi.spyOn(console, "warn"), vi.spyOn(console, "error")];
    const badClientId = "blocked-client-fixture";

    try {
      spies.forEach((spy) => spy.mockImplementation(() => undefined));
      const result = parseMcpOAuthAuthorizationRequestBoundary(
        buildInput({ authorizationUrl: buildAuthorizationUrl({ overrides: { client_id: badClientId } }) }),
      );
      const serialized = JSON.stringify(result);

      expect(result.accepted).toBe(false);
      for (const forbidden of [
        badClientId,
        STATE,
        PKCE_CHALLENGE,
        CHATGPT_REDIRECT_URI,
        CANONICAL_RESOURCE,
        OWNER_ID,
      ] as const) {
        expect(serialized).not.toContain(forbidden);
      }
      spies.forEach((spy) => expect(spy).not.toHaveBeenCalled());
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });

  it("does not import or call forbidden runtime surfaces", () => {
    const source = readFileSync(BOUNDARY_SOURCE, "utf8");

    for (const specifier of collectModuleSpecifiersForTest(source)) {
      expect(specifier).not.toMatch(FORBIDDEN_MODULE_PATTERN);
    }

    expect(source).not.toMatch(/\bfetch\s*\(/u);
    expect(source).not.toMatch(/\bXMLHttpRequest\b/u);
    expect(source).not.toMatch(/\bwindow\b/u);
    expect(source).not.toMatch(/\bdocument\b/u);
    expect(source).not.toMatch(/\blocalStorage\b/u);
    expect(source).not.toMatch(/\bsessionStorage\b/u);
    expect(source).not.toMatch(/\bprocess\.env\b/u);
    expect(source).not.toMatch(/\bconsole\.(?:log|info|warn|error)\s*\(/u);
    expect(source).not.toMatch(/\b(?:jwtVerify|decodeJwt|jsonwebtoken|jose)\b/u);
    expect(source).not.toMatch(/\binternal(?:Link|Refresh|Revoke)CanonicalMcpAccount/u);
    expect(source).not.toMatch(/\b(?:app|router)\.(?:get|post|use|all|route)\s*\(/u);
    expect(source).not.toMatch(/twoweeks\.ai|neyssan\.ai|real-user@example/u);
  });

  it.each([
    ["double-quoted normal import", "import { client } from \"@stytch/vanilla-js\";"],
    ["single-quoted normal import", "import client from '@clerk/backend';"],
    ["type import", "import type { QueryCtx } from 'convex/server';"],
    ["side-effect import", "import 'vite/client';"],
    ["export-from re-export", "export { Client } from '@modelcontextprotocol/sdk';"],
    ["dynamic import", "const sdk = await import('openai');"],
    ["template-literal dynamic import", "const sdk = await import(`openai`);"],
    ["commented dynamic import", 'const sdk = await import(/* webpackIgnore: true */ "openai");'],
  ] as const)("would detect a forbidden %s", (_label, source) => {
    expect(collectModuleSpecifiersForTest(source).some((specifier) => FORBIDDEN_MODULE_PATTERN.test(specifier))).toBe(true);
  });
});

function expectDenied(
  input: unknown,
  reason: McpOAuthAuthorizationRequestBoundaryDenialReasonV1,
): void {
  const result = parseMcpOAuthAuthorizationRequestBoundary(input);

  expect(result).toEqual({
    kind: "mcp_oauth_authorization_request_boundary_result",
    accepted: false,
    reason,
    safeFailure: {
      code: "authorization_request_denied",
      message: "Authorization request denied.",
      safeForModel: true,
      sensitiveValuesEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function buildInput(
  overrides: Readonly<{
    authorizationUrl?: string;
    trustedOwner?: McpOAuthAuthorizationTrustedOwnerV1;
    config?: McpOAuthAuthorizationRequestBoundaryConfigV1;
  }> = {},
) {
  return {
    kind: "mcp_oauth_authorization_request_boundary_input",
    authorizationUrl: overrides.authorizationUrl ?? validUrl(),
    trustedOwner: overrides.trustedOwner ?? trustedOwner(),
    config: overrides.config ?? buildConfig(),
    version: 1,
  } as const;
}

function buildPreAuthProjectionInput(
  overrides: Readonly<{
    authorizationUrl?: string;
    config?: McpOAuthAuthorizationRequestBoundaryConfigV1;
  }> = {},
) {
  return {
    kind: "mcp_oauth_pre_auth_authorization_request_projection_input",
    authorizationUrl: overrides.authorizationUrl ?? validUrl(),
    config: overrides.config ?? buildConfig(),
    version: 1,
  } as const;
}

function expectPreAuthProjectionDenied(
  input: unknown,
  reason: McpOAuthAuthorizationRequestBoundaryDenialReasonV1,
): void {
  const result = projectMcpOAuthPreAuthAuthorizationRequest(input);

  expect(result).toEqual({
    kind: "mcp_oauth_pre_auth_authorization_request_projection_result",
    accepted: false,
    reason,
    safeFailure: {
      code: "authorization_request_denied",
      message: "Authorization request denied.",
      safeForModel: true,
      sensitiveValuesEchoed: false,
      version: 1,
    },
    modelVisible: false,
    safeForLogging: true,
    version: 1,
  });
}

function trustedOwner(): McpOAuthAuthorizationTrustedOwnerV1 {
  return {
    kind: "mcp_oauth_authorization_trusted_owner",
    twoweeksClerkId: OWNER_ID,
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

function validUrl(): string {
  return buildAuthorizationUrl();
}

function buildAuthorizationUrl(
  options: Readonly<{
    origin?: string;
    path?: string;
    overrides?: Readonly<Record<string, string | undefined>>;
    without?: readonly string[];
    duplicate?: string;
    order?: readonly string[];
  }> = {},
): string {
  const params = buildAuthorizationParams(options);
  const search = buildAuthorizationSearch(params, options);
  return `${options.origin ?? AUTHORIZATION_ORIGIN}${options.path ?? AUTHORIZATION_PATH}?${search.toString()}`;
}

function buildAuthorizationParams(
  options: Readonly<{
    overrides?: Readonly<Record<string, string | undefined>>;
    without?: readonly string[];
  }>,
): Record<string, string> {
  const params: Record<string, string> = {
    response_type: "code",
    client_id: CLIENT_ID,
    redirect_uri: CHATGPT_REDIRECT_URI,
    scope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    state: STATE,
    code_challenge: PKCE_CHALLENGE,
    code_challenge_method: "S256",
    resource: CANONICAL_RESOURCE,
    ...(options.overrides ?? {}),
  };

  for (const key of options.without ?? []) {
    delete params[key];
  }
  return params;
}

function buildAuthorizationSearch(
  params: Readonly<Record<string, string>>,
  options: Readonly<{
    duplicate?: string;
    order?: readonly string[];
  }>,
): URLSearchParams {
  const search = new URLSearchParams();
  const orderedKeys = options.order ?? Object.keys(params);
  for (const key of orderedKeys) {
    const value = params[key];
    if (value !== undefined) search.append(key, value);
  }
  if (options.duplicate) {
    search.append(options.duplicate, params[options.duplicate] ?? "duplicate");
  }
  return search;
}

function collectModuleSpecifiersForTest(source: string): readonly string[] {
  return [
    ...[...source.matchAll(STATIC_MODULE_SPECIFIER_PATTERN)].map((match) => match[2]).filter(isString),
    ...[...source.matchAll(DYNAMIC_MODULE_SPECIFIER_PATTERN)].map((match) => match[2] ?? match[3]).filter(isString),
  ];
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}
