// @vitest-environment node
import { createHash } from "node:crypto";
import { EventEmitter } from "node:events";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildMcpOAuthProductionViteAllowedHosts,
  createLocalMcpDevEndpointPlugin,
} from "../../../../vite.config";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../mcpAuthPolicyBoundary";
import type { McpOAuthAuthorizationRequestBoundaryConfigV1 } from "../mcpOAuthAuthorizationRequestBoundary";
import {
  buildMcpOAuthLocalDevRouteAdapterConfig,
  handleMcpOAuthLocalDevRouteRequest,
  LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR,
  LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG,
  LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR,
} from "../mcpOAuthLocalDevRouteAdapter";
import type { McpOAuthProductionActivationDependenciesV1 } from "../mcpOAuthProductionActivationBoundary";
import {
  buildMcpOAuthProductionRouteAdapterConfig,
  handleMcpOAuthProductionRouteRequest,
  isMcpOAuthProductionRouteHandledPath,
  MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
  MCP_OAUTH_PRODUCTION_CALLBACK_PATH,
  MCP_OAUTH_PRODUCTION_MCP_PATH,
  type McpOAuthProductionRouteAdapterDependenciesV1,
  type McpOAuthProductionRouteAdapterRequestV1,
  type McpOAuthProductionRoutePathV1,
} from "../mcpOAuthProductionRouteAdapter";
import { MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG } from "../mcpOAuthProductionRoutePreflightBoundary";
import {
  defaultMcpOAuthContinuationHandleCodecV1,
  type McpOAuthContinuationHandleCodecV1,
} from "../mcpOAuthLoginReturnContinuationBoundary";
import {
  MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER,
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
  MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
} from "../../../pages/sign-in-return";

const { convexHttpClientMutation, convexHttpClientSetAdminAuth, ConvexHttpClientMock } = vi.hoisted(() => {
  const mutation = vi.fn();
  const setAdminAuth = vi.fn();
  return {
    convexHttpClientMutation: mutation,
    convexHttpClientSetAdminAuth: setAdminAuth,
    ConvexHttpClientMock: vi.fn(function ConvexHttpClient() {
      return { mutation, setAdminAuth };
    }),
  };
});

const { createRemoteJWKSetMock, jwtVerifyMock } = vi.hoisted(() => ({
  createRemoteJWKSetMock: vi.fn(() => "clerk_jwks_fixture"),
  jwtVerifyMock: vi.fn(),
}));

vi.mock("convex/browser", () => ({
  ConvexHttpClient: ConvexHttpClientMock,
}));

vi.mock("jose", () => ({
  createRemoteJWKSet: createRemoteJWKSetMock,
  jwtVerify: jwtVerifyMock,
}));

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpOAuthProductionRouteAdapter.ts");
const VITE_CONFIG_SOURCE = resolve(TEST_DIR, "../../../../vite.config.ts");
const APP_ORIGIN = "http://localhost:5173";
const PROD_APP_ORIGIN = "https://mcp.twoweeks.example.test";
const REDIRECT_URI = "https://chatgpt.example.test/connector/oauth/callback-fixture";
const RESOURCE = "https://mcp.twoweeks.example.test/resource";
const CLIENT_ID = "chatgpt_apps_sdk_client";
const STATE = "opaque_state_1234567890";
const PKCE = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";
const RAW_HANDLE = "A".repeat(43);
const HANDLE_HASH = sha256Hex(RAW_HANDLE);
const BROWSER_NONCE = "B".repeat(43);
const BROWSER_NONCE_COOKIE = `tw_mcp_oauth_continue=${BROWSER_NONCE}`;
const OWNER_ID = "user_twoweeks_fixture_123";
const OTHER_OWNER_ID = "user_twoweeks_fixture_456";
const CLERK_ISSUER = "https://clerk.twoweeks.example.test";
const CLERK_JWT = "eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiJmaXh0dXJlIn0.signature";
const NOW = Date.parse("2026-06-27T09:00:00.000Z");
const FORBIDDEN_ROUTE_SOURCE_PATTERNS = Object.freeze([
  /\b(?:fetch|axios|XMLHttpRequest|WebSocket|EventSource)\b/u,
  /from\s+["']@stytch|Stytch|OAuthProvider/u,
  /exchangeAuthorizationCode|executeAccountLinkLifecycle/u,
  /\b(?:insert|patch|replace|delete)\s*\(/u,
  /\b(?:localStorage|sessionStorage|document\.cookie)\b/u,
  /authorizationCodeIssued:\s*true|tokenIssued:\s*true|accountLinkCreated:\s*true/u,
  /tokenPersisted:\s*true|refreshTokenPersisted:\s*true/u,
] as const);
const FORBIDDEN_PREFLIGHT_REIMPLEMENTATION_PATTERNS = Object.freeze([
  /buildMcpOAuthProductionActivationConfig/u,
  /buildMcpOperationalProductionOAuthActivationStatus/u,
  /MCP_OAUTH_PRODUCTION_RUNTIME_FLAG/u,
  /MCP_OAUTH_PRODUCTION_APPROVED_FLAG/u,
  /routeWiringEnabled\s*=/u,
] as const);

type StoredPreAuthIntentRecord = {
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
  approvedOptionalParameters?: Readonly<Partial<Record<"nonce" | "prompt", string>>>;
  providerValidationStatus: "pending";
  status: "pre_auth_pending" | "claimed" | "expired";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  claimedAt?: number;
  storageVersion: 1;
  _id: string;
  _creationTime: number;
};

const PROVIDER_CONFIG = {
  provider: "stytch",
  issuer: "https://stytch.example.test/",
  resource: RESOURCE,
  providerEnvironment: "prod_us_1",
  allowedClientIds: [CLIENT_ID],
  requiredReadScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
  version: 1,
} as const;

afterEach(() => {
  convexHttpClientMutation.mockReset();
  convexHttpClientSetAdminAuth.mockReset();
  ConvexHttpClientMock.mockClear();
  createRemoteJWKSetMock.mockClear();
  jwtVerifyMock.mockReset();
  vi.unstubAllEnvs();
});

const deterministicCodec: McpOAuthContinuationHandleCodecV1 = Object.freeze({
  generate: () => Object.freeze({ rawHandle: RAW_HANDLE, intentHandleHash: HANDLE_HASH }),
  validate: (rawHandle: unknown): rawHandle is string =>
    defaultMcpOAuthContinuationHandleCodecV1.validate(rawHandle),
  hash: (rawHandle: string) => sha256Hex(rawHandle),
});

describe("MCP OAuth production route adapter", () => {
  it("keeps production routes disabled by default", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        kind: "mcp_oauth_production_route_response",
        status: "blocked",
        reason: "disabled",
        route: "oauth_authorize",
        safeForModel: true,
        allowedByPreflight: false,
        preflightDecision: "disabled",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
        tokenPersisted: false,
        hostedMcpStarted: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("blocks route handling when only the production runtime flag is enabled", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH),
      routeConfig({ runtime: "1" }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_missing_approval_flag",
        allowedByPreflight: false,
        preflightDecision: "blocked_missing_approval_flag",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("blocks route handling when the production runtime flag is missing", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH),
      routeConfig({ approved: "1", routeWiring: "1" }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_missing_runtime_flag",
        allowedByPreflight: false,
        preflightDecision: "blocked_missing_runtime_flag",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("blocks route handling without the explicit production route wiring flag", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH),
      routeConfig({ runtime: "1", approved: "1" }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_endpoint_exposure_not_enabled",
        allowedByPreflight: false,
        preflightDecision: "blocked_endpoint_exposure_not_enabled",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("blocks route handling when provider config is malformed", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_CALLBACK_PATH),
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: {
          ...PROVIDER_CONFIG,
          issuer: "http://stytch.example.test/",
        },
      }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_misconfigured_provider",
        route: "oauth_callback",
        allowedByPreflight: false,
        preflightDecision: "blocked_misconfigured_provider",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("blocks route handling when activation dependency ports are unavailable", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_CALLBACK_PATH),
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: PROVIDER_CONFIG,
      }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_missing_activation_dependency",
        route: "oauth_callback",
        allowedByPreflight: false,
        preflightDecision: "blocked_missing_activation_dependency",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("allows authorize pre-auth creation when activation dependency ports are unavailable", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = buildMcpOAuthProductionRouteAdapterConfig({
      flags: { runtime: "1", approved: "1", routeWiring: "1" },
      providerConfig: PROVIDER_CONFIG,
    });

    const authorizeResponse = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    const callbackResponse = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_CALLBACK_PATH),
      config,
    );

    expect(authorizeResponse).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
    });
    expect(callbackResponse).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_missing_activation_dependency",
        route: "oauth_callback",
        allowedByPreflight: false,
        preflightDecision: "blocked_missing_activation_dependency",
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(authorizeResponse, [], { allowRawHandle: true });
    expectNoRouteLeakage(callbackResponse);
  });

  it("fails closed when production authorize is ready but missing pre-auth dependencies", async () => {
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH),
      config,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "dependency_unavailable",
        route: "oauth_authorize",
        allowedByPreflight: true,
        preflightDecision: "ready_to_wire",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("rejects invalid production authorization requests before creating pre-auth storage", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      request(
        MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
        "GET",
        authorizationRequestPath({ owner: "owner_should_not_echo" }),
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 400,
      json: {
        status: "blocked",
        reason: "invalid_authorization_request",
        route: "oauth_authorize",
        authorizationCodeIssued: false,
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response, ["owner_should_not_echo"]);
  });

  it("rejects production authorization requests on an unexpected host before storage", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        headers: { host: "unexpected.example.test" },
      },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "invalid_host",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("accepts production authorization requests with an explicit default HTTPS host port", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        headers: { host: "mcp.twoweeks.example.test:443" },
      },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
    });
    expectNoRouteLeakage(response, [], { allowRawHandle: true });
  });

  it("accepts canonical origin-only config with a trailing slash", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      authorizationRequestConfig: {
        ...authorizationRequestConfig(),
        authorizationPageOrigin: `${PROD_APP_ORIGIN}/`,
      },
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(response.headers.location).toContain(`${PROD_APP_ORIGIN}/sign-in?`);
    expect(response.headers.location).not.toContain(`${PROD_APP_ORIGIN}//sign-in`);
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
    });
    expectNoRouteLeakage(response, [], { allowRawHandle: true });
  });

  it("rejects ambiguous multi-valued host headers before storage", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        headers: { host: ["mcp.twoweeks.example.test", "unexpected.example.test"] },
      },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 403,
      json: {
        status: "blocked",
        reason: "invalid_host",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("maps malformed production authorization origins to a server-side failure", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      authorizationRequestConfig: {
        ...authorizationRequestConfig(),
        authorizationPageOrigin: "not-a-url",
      },
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 500,
      json: {
        status: "blocked",
        reason: "invalid_configuration",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("maps malformed production authorization config to a server-side failure", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      authorizationRequestConfig: {
        ...authorizationRequestConfig(),
        allowedRedirectUris: [],
      },
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 500,
      json: {
        status: "blocked",
        reason: "invalid_configuration",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("rejects production authorization config that drifts from the preflighted provider config", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      authorizationRequestConfig: {
        ...authorizationRequestConfig(),
        canonicalResource: "https://mcp.twoweeks.example.test/drifted-resource",
      },
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 500,
      json: {
        status: "blocked",
        reason: "invalid_configuration",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
      },
    });
    expect(dependencies.checkPreAuthQuota).not.toHaveBeenCalled();
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("accepts authorization config when preflight provider client IDs only differ by normalization", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: {
          ...PROVIDER_CONFIG,
          allowedClientIds: [` ${CLIENT_ID} `, CLIENT_ID],
        },
      }),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(1);
    expectNoRouteLeakage(response, [], { allowRawHandle: true });
  });

  it("requires a quota gate before unauthenticated production pre-auth storage", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      checkPreAuthQuota: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_quota_result",
        ok: false,
        reason: "rate_limited",
        safeFailure: {
          code: "mcp_oauth_pre_auth_quota_denied",
          message: "Pre-auth quota denied.",
          safeForModel: true,
          sensitiveValuesEchoed: false,
          version: 1,
        },
        safeForLogging: true,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 429,
      json: {
        status: "blocked",
        reason: "pre_auth_quota_denied",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.checkPreAuthQuota.mock.calls[0]?.[0]).toMatchObject({
      authorizationPageOrigin: PROD_APP_ORIGIN,
      clientId: CLIENT_ID,
      resource: RESOURCE,
      now: NOW,
      version: 1,
    });
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("maps invalid quota requests to bad request instead of throttling", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      checkPreAuthQuota: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_quota_result",
        ok: false,
        reason: "invalid_request",
        safeFailure: {
          code: "mcp_oauth_pre_auth_quota_denied",
          message: "Pre-auth quota denied.",
          safeForModel: true,
          sensitiveValuesEchoed: false,
          version: 1,
        },
        safeForLogging: true,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 400,
      json: {
        status: "blocked",
        reason: "pre_auth_quota_denied",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
      },
    });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("bounds stalled quota checks before awaiting pre-auth storage", async () => {
    vi.useFakeTimers();
    const dependencies = {
      ...routeDependencies(makeCtx()),
      checkPreAuthQuota: vi.fn(
        () => new Promise<never>(() => undefined),
      ),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    try {
      const responsePromise = handleMcpOAuthProductionRouteRequest(
        request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
        dependencies,
      );
      await vi.advanceTimersByTimeAsync(2_500);
      const response = await responsePromise;

      expect(response).toMatchObject({
        handled: true,
        status: 503,
        json: {
          status: "blocked",
          reason: "pre_auth_quota_denied",
          preAuthIntentCreated: false,
        },
      });
      expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
      expect(dependencies.createPreAuthIntent).not.toHaveBeenCalled();
      expectNoRouteLeakage(response);
    } finally {
      vi.useRealTimers();
    }
  });

  it("maps thrown pre-auth storage failures to retryable dependency failure", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      createPreAuthIntent: vi.fn(async () => {
        throw new Error("storage unavailable");
      }),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "pre_auth_create_failed",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("maps pre-auth handle collisions to conflict without leaking the handle", async () => {
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      createPreAuthIntent: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_intent_create_result",
        ok: false,
        reason: "handle_collision",
        safeFailure: {
          code: "mcp_oauth_pre_auth_intent_denied",
          message: "Pre-auth intent denied.",
          safeForModel: true,
          sensitiveValuesEchoed: false,
          version: 1,
        },
        modelVisible: false,
        safeForLogging: true,
        version: 1,
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 409,
      json: {
        status: "blocked",
        reason: "pre_auth_create_failed",
        route: "oauth_authorize",
        preAuthIntentCreated: false,
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(ctx.preAuthRows).toHaveLength(0);
    expectNoRouteLeakage(response);
  });

  it("creates one ownerless pre-auth intent and redirects to the fixed Clerk sign-in return path", async () => {
    const ctx = makeCtx();
    const activation = activationDependencies();
    const dependencies = routeDependencies(ctx);
    const response = await handleMcpOAuthProductionRouteRequest(
      request(
        MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
        "GET",
        authorizationRequestPath({ nonce: "nonce_fixture", prompt: "consent" }),
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303, bodyText: "" });
    expect(response.headers).toMatchObject({
      "cache-control": "no-store",
      pragma: "no-cache",
      location: `${PROD_APP_ORIGIN}/sign-in?${MCP_OAUTH_SIGN_IN_RETURN_PARAMETER}=${encodeURIComponent(
        continuationPath(),
      )}`,
    });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.checkPreAuthQuota.mock.calls[0]?.[0]).toMatchObject({
      callerKey: "unknown",
    });
    expect(dependencies.createPreAuthIntent.mock.calls[0]?.[0]).toMatchObject({
      preAuthHandleHash: HANDLE_HASH,
      now: NOW,
      deadlineEpochMs: NOW + 2_500,
      timeoutMs: 2_500,
      version: 1,
    });
    expect(JSON.stringify(dependencies.createPreAuthIntent.mock.calls[0]?.[0])).not.toContain(RAW_HANDLE);
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
      approvedOptionalParameters: { nonce: "nonce_fixture", prompt: "consent" },
    });
    expect(Object.keys(ctx.preAuthRows[0])).not.toContain("twoweeksClerkId");
    expect(Object.keys(ctx.preAuthRows[0])).not.toContain("stytchSubject");
    expect(Object.keys(ctx.preAuthRows[0])).not.toContain("accountLinkId");
    expect(JSON.stringify(ctx.preAuthRows[0])).not.toContain(RAW_HANDLE);
    expect(activation.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(activation.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    expectNoRouteLeakage(response, [], { allowRawHandle: true });
  });

  it("binds the production login-return continuation to the authenticated owner without provider, code, token, or account-link behavior", async () => {
    const ctx = makeCtx();
    const activation = activationDependencies();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }, activation);

    const authorizeResponse = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    const continuationResponse = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    expect(authorizeResponse).toMatchObject({ handled: true, status: 303 });
    expect(authorizeResponse.headers["set-cookie"]).toContain(BROWSER_NONCE_COOKIE);
    expect(authorizeResponse.headers["set-cookie"]).toContain("HttpOnly");
    expect(authorizeResponse.headers["set-cookie"]).toContain("SameSite=Lax");
    expect(authorizeResponse.headers.location).toContain(
      encodeURIComponent(`${MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER}=${BROWSER_NONCE}`),
    );
    expect(continuationResponse).toMatchObject({
      handled: true,
      status: 200,
      json: {
        kind: "mcp_oauth_production_route_response",
        status: "owner_bound_continuation_prepared",
        reason: "owner_binding_continuation_prepared",
        route: "oauth_login_return",
        preflightDecision: "ready_to_wire",
        preAuthContinuationConsumed: true,
        ownerBound: true,
        ownerBoundIntentPending: true,
        ownerBoundContinuationPrepared: true,
        authorizationCodeIssued: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        tokenIssued: false,
        consentCompleted: false,
        accountLinkCreated: false,
        tokenPersisted: false,
        hostedMcpStarted: false,
        modelVisible: false,
        safeForLogging: true,
      },
    });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).toHaveBeenCalledTimes(1);
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner.mock.calls[0]?.[0]).toEqual({
      preAuthHandleHash: HANDLE_HASH,
      authenticatedOwnerIdentity: {
        subject: OWNER_ID,
        issuer: CLERK_ISSUER,
        version: 1,
      },
      now: NOW,
      version: 1,
    });
    expect(JSON.stringify(dependencies.bindPreAuthIntentToAuthenticatedOwner.mock.calls[0]?.[0])).not.toContain(
      RAW_HANDLE,
    );
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "claimed",
      claimedAt: NOW,
      updatedAt: NOW,
    });
    expect(activation.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(activation.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    expectNoRouteLeakage(authorizeResponse, [], { allowRawHandle: true });
    expectNoRouteLeakage(continuationResponse);
  });

  it("blocks copied production login-return handles without the browser-bound continuation cookie", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    const copiedHandleRequest = {
      ...request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      headers: { host: "mcp.twoweeks.example.test" },
    };
    const response = await handleMcpOAuthProductionRouteRequest(copiedHandleRequest, config, dependencies);

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        status: "blocked",
        reason: "browser_bound_continuation_missing",
        route: "oauth_login_return",
        ownerBound: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "pre_auth_pending" });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("blocks production login-return continuations with a mismatched browser-bound cookie", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    const mismatchedCookieRequest = {
      ...request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      headers: { host: "mcp.twoweeks.example.test", cookie: `tw_mcp_oauth_continue=${"C".repeat(43)}` },
    };
    const response = await handleMcpOAuthProductionRouteRequest(mismatchedCookieRequest, config, dependencies);

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        status: "blocked",
        reason: "browser_bound_continuation_missing",
        route: "oauth_login_return",
        ownerBound: false,
      },
    });
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "pre_auth_pending" });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("fails production login-return continuation closed without authenticated owner identity", async () => {
    const ctx = makeCtx({ subject: null });
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 401,
      json: {
        status: "blocked",
        reason: "owner_binding_failed",
        route: "oauth_login_return",
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "pre_auth_pending" });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("rejects invalid production login-return continuation handles before owner binding", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);

    const response = await handleMcpOAuthProductionRouteRequest(
      request(
        MCP_OAUTH_CONTINUATION_PATH,
        "GET",
        `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=short`,
      ),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 400,
      json: {
        status: "blocked",
        reason: "invalid_continuation_request",
        route: "oauth_login_return",
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        authorizationCodeIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("fails expired production login-return continuations without preparing owner-bound handoff", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );
    ctx.preAuthRows[0].expiresAt = NOW;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 409,
      json: {
        status: "blocked",
        reason: "owner_binding_failed",
        route: "oauth_login_return",
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        authorizationCodeIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "expired", updatedAt: NOW });
    expectNoRouteLeakage(response);
  });

  it("makes production login-return continuation replay explicit and one-time", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });
    await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    const first = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );
    ctx.subject = OTHER_OWNER_ID;
    const replay = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      config,
      dependencies,
    );

    expect(first).toMatchObject({
      handled: true,
      status: 200,
      json: { status: "owner_bound_continuation_prepared", ownerBound: true },
    });
    expect(replay).toMatchObject({
      handled: true,
      status: 409,
      json: {
        status: "blocked",
        reason: "owner_binding_failed",
        route: "oauth_login_return",
        ownerBound: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expect(dependencies.bindPreAuthIntentToAuthenticatedOwner).toHaveBeenCalledTimes(2);
    expect(ctx.preAuthRows[0]).toMatchObject({ status: "claimed", claimedAt: NOW });
    expectNoRouteLeakage(replay);
  });

  it("fails production login-return continuation closed when owner-binding dependencies are unavailable", async () => {
    const dependencies = {
      authorizationRequestConfig: authorizationRequestConfig(),
      handleCodec: deterministicCodec,
      now: vi.fn(() => NOW),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_CONTINUATION_PATH, "GET", continuationPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "dependency_unavailable",
        route: "oauth_login_return",
        ownerBound: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        authorizationCodeIssued: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("matches the production authorization guard against the trimmed provider resource", async () => {
    const dependencies = routeDependencies(makeCtx());
    const config = buildMcpOAuthProductionRouteAdapterConfig({
      flags: { runtime: "1", approved: "1", routeWiring: "1" },
      providerConfig: {
        ...PROVIDER_CONFIG,
        resource: ` ${RESOURCE} `,
      },
      activationDependencies: activationDependencies(),
    });

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      config,
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
  });

  it("scopes pre-auth quota checks to the forwarded caller when present", async () => {
    const dependencies = routeDependencies(makeCtx());

    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        headers: {
          host: "mcp.twoweeks.example.test",
          "x-forwarded-for": " 203.0.113.9, 198.51.100.1 ",
        },
        remoteAddress: "198.51.100.9",
      },
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.checkPreAuthQuota.mock.calls[0]?.[0]).toMatchObject({
      callerKey: "203.0.113.9",
    });
  });

  it("refreshes the pre-auth create deadline after quota succeeds", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      now: vi.fn()
        .mockReturnValueOnce(NOW)
        .mockReturnValueOnce(NOW + 1_000)
        .mockReturnValueOnce(NOW + 1_000),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({ handled: true, status: 303 });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(1);
    expect(dependencies.checkPreAuthQuota.mock.calls[0]?.[0]).toMatchObject({ now: NOW });
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expect(dependencies.createPreAuthIntent.mock.calls[0]?.[0]).toMatchObject({
      now: NOW + 1_000,
      deadlineEpochMs: NOW + 1_000 + 2_500,
      timeoutMs: 2_500,
    });
  });

  it("rejects storage success unless it proves the created intent is still ownerless and non-executing", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      createPreAuthIntent: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_intent_create_result",
        ok: true,
        reason: "created",
        serverOnly: {
          status: "pre_auth_pending",
          expiresAt: NOW + 60_000,
          containsOwnerIdentity: true,
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
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "pre_auth_create_failed",
        preAuthIntentCreated: false,
        ownerBound: false,
        consentCompleted: false,
        authorizationCodeIssued: false,
        tokenIssued: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("rejects non-finite storage expiry before returning the sign-in redirect", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      createPreAuthIntent: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_intent_create_result",
        ok: true,
        reason: "created",
        serverOnly: {
          status: "pre_auth_pending",
          expiresAt: Number.POSITIVE_INFINITY,
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
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "pre_auth_create_failed",
        preAuthIntentCreated: false,
      },
    });
    expectNoRouteLeakage(response);
  });

  it("rejects storage success that expires before post-write validation", async () => {
    const dependencies = {
      ...routeDependencies(makeCtx()),
      now: vi.fn()
        .mockReturnValueOnce(NOW)
        .mockReturnValueOnce(NOW)
        .mockReturnValueOnce(NOW + 2),
      createPreAuthIntent: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_intent_create_result",
        ok: true,
        reason: "created",
        serverOnly: {
          status: "pre_auth_pending",
          expiresAt: NOW + 1,
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
      })),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    const response = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
      routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      dependencies,
    );

    expect(response).toMatchObject({
      handled: true,
      status: 503,
      json: {
        status: "blocked",
        reason: "pre_auth_create_failed",
        preAuthIntentCreated: false,
      },
    });
    expect(dependencies.now).toHaveBeenCalledTimes(3);
    expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
    expectNoRouteLeakage(response);
  });

  it("bounds stalled pre-auth storage before returning a production authorize response", async () => {
    vi.useFakeTimers();
    const dependencies = {
      ...routeDependencies(makeCtx()),
      createPreAuthIntent: vi.fn(
        () => new Promise<never>(() => undefined),
      ),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;

    try {
      const responsePromise = handleMcpOAuthProductionRouteRequest(
        request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
        dependencies,
      );
      await vi.advanceTimersByTimeAsync(2_500);
      const response = await responsePromise;

      expect(response).toMatchObject({
        handled: true,
        status: 503,
        json: {
          status: "blocked",
          reason: "pre_auth_create_failed",
          preAuthIntentCreated: false,
        },
      });
      expect(dependencies.createPreAuthIntent).toHaveBeenCalledTimes(1);
      expect(dependencies.createPreAuthIntent.mock.calls[0]?.[0]).toMatchObject({
        deadlineEpochMs: NOW + 2_500,
        timeoutMs: 2_500,
      });
      expectNoRouteLeakage(response);
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps production authorize guarded when the injected clock throws", async () => {
    const fallbackNow = NOW + 1_000;
    const dateNow = vi.spyOn(Date, "now").mockReturnValue(fallbackNow);
    const ctx = makeCtx();
    const dependencies = {
      ...routeDependencies(ctx),
      now: vi.fn(() => {
        throw new Error("clock unavailable");
      }),
    };

    try {
      const response = await handleMcpOAuthProductionRouteRequest(
        request(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH, "GET", authorizationRequestPath()),
        routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
        dependencies,
      );

      expect(response).toMatchObject({ handled: true, status: 303 });
      expect(dependencies.now).toHaveBeenCalledTimes(3);
      expect(ctx.preAuthRows).toHaveLength(1);
      expect(ctx.preAuthRows[0]).toMatchObject({
        status: "pre_auth_pending",
        preAuthHandleHash: HANDLE_HASH,
        createdAt: fallbackNow,
        updatedAt: fallbackNow,
      });
      expectNoRouteLeakage(response, [], { allowRawHandle: true });
    } finally {
      dateNow.mockRestore();
    }
  });

  it("keeps /oauth/callback and /mcp guarded inert when production preflight is ready", async () => {
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });

    for (const path of [MCP_OAUTH_PRODUCTION_CALLBACK_PATH, MCP_OAUTH_PRODUCTION_MCP_PATH] as const) {
      const response = await handleMcpOAuthProductionRouteRequest(request(path), config);

      expect(response).toMatchObject({
        handled: true,
        status: 501,
        json: {
          kind: "mcp_oauth_production_route_response",
          status: "guarded_inert",
          reason: "inert_handler_only",
          route: expectedRouteName(path),
          safeForModel: true,
          allowedByPreflight: true,
          preflightDecision: "ready_to_wire",
          guardedInertHandlerReached: true,
          oauthExecutionStarted: false,
          authorizationRequestAccepted: false,
          authorizationCodeAccepted: false,
          authorizationCodeIssued: false,
          preAuthIntentCreated: false,
          ownerBound: false,
          providerCalled: false,
          tokenExchangeAttempted: false,
          tokenIssued: false,
          accountLinkCreated: false,
          tokenPersisted: false,
          refreshTokenPersisted: false,
          hostedMcpStarted: false,
          handlerMode: "inert_guarded_only",
        },
      });
      expectNoRouteLeakage(response);
    }

    const unsupported = await handleMcpOAuthProductionRouteRequest(
      request(MCP_OAUTH_PRODUCTION_MCP_PATH, "GET"),
      config,
    );
    expect(unsupported).toMatchObject({
      handled: true,
      status: 405,
      headers: {
        allow: "POST",
        "cache-control": "no-store",
        "content-type": "application/json; charset=utf-8",
      },
      json: {
        status: "blocked",
        reason: "unsupported_method",
        route: "mcp",
        allowedByPreflight: true,
        preflightDecision: "ready_to_wire",
        guardedInertHandlerReached: false,
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
      },
    });
    expectNoRouteLeakage(unsupported);
  });

  it("keeps blocked responses free of secrets, provider config values, owner identifiers, codes, and redirect secrets", async () => {
    const response = await handleMcpOAuthProductionRouteRequest(
      {
        ...request(MCP_OAUTH_PRODUCTION_CALLBACK_PATH),
        url: `${MCP_OAUTH_PRODUCTION_CALLBACK_PATH}?code=auth_code_should_not_echo&state=redirect_secret_should_not_echo&owner=owner_should_not_echo`,
      },
      buildMcpOAuthProductionRouteAdapterConfig({
        flags: { runtime: "1", approved: "1" },
        providerConfig: {
          ...PROVIDER_CONFIG,
          clientSecret: "client_secret_should_not_echo",
          accessToken: "access_token_should_not_echo",
          refreshToken: "refresh_token_should_not_echo",
        } as never,
      }),
    );

    expect(response).toMatchObject({
      handled: true,
      status: 404,
      json: {
        status: "blocked",
        reason: "blocked_endpoint_exposure_not_enabled",
        providerCalled: false,
        tokenExchangeAttempted: false,
        accountLinkCreated: false,
        tokenPersisted: false,
      },
    });
    expectNoRouteLeakage(response, [
      "auth_code_should_not_echo",
      "redirect_secret_should_not_echo",
      "owner_should_not_echo",
      "client_secret_should_not_echo",
      "access_token_should_not_echo",
      "refresh_token_should_not_echo",
    ]);
  });

  it("has no provider call, token exchange, account-link, or token persistence path", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    expectSourceNotToMatch(source, FORBIDDEN_ROUTE_SOURCE_PATTERNS);
  });

  it("leaves local/dev MCP OAuth route behavior unchanged", async () => {
    const disabledLocalDev = await handleMcpOAuthLocalDevRouteRequest(
      {
        method: "GET",
        path: MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
        url: `${MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH}?state=local_state`,
        headers: { host: "localhost:5173" },
      },
      buildMcpOAuthLocalDevRouteAdapterConfig(),
      {},
    );
    const viteSource = readFileSync(VITE_CONFIG_SOURCE, "utf8");

    expect(disabledLocalDev).toMatchObject({ handled: false, status: 404 });
    expect(createLocalMcpDevEndpointPlugin({ env: prodRouteEnv() })).toBeTruthy();
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
    expect(viteSource).toContain("handleMcpOAuthProductionRouteRequest");
    expect(viteSource).toContain("isMcpOAuthProductionRouteHandledPath");
  });

  it("does not claim production authorize paths when only the local MCP endpoint is enabled", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({
      env: { LOCAL_MCP_DEV_ENDPOINT: "1" },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).toHaveBeenCalledTimes(1);
    expect(response.statusCode).toBeUndefined();
    expect(response.body).toBe("");
  });

  it("keeps local /mcp endpoint ahead of production route wiring when both flags are enabled", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        LOCAL_MCP_DEV_ENDPOINT: "1",
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeStreamingMiddleware(middleware, {
      method: "POST",
      url: MCP_OAUTH_PRODUCTION_MCP_PATH,
      headers: {
        host: "localhost:5173",
        "content-type": "application/json",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "init_local_mcp", method: "initialize" }),
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      id: "init_local_mcp",
      result: {
        serverInfo: { name: "twoweeks-local-dev-fixture" },
      },
    });
    expect(response.body).not.toContain("inert_handler_only");
  });

  it("keeps production /oauth/authorize ahead of the local OAuth route when both flags are enabled", async () => {
    convexHttpClientMutation.mockImplementationOnce(async () => ({
      kind: "mcp_oauth_pre_auth_intent_create_result",
      ok: true,
      reason: "created",
      serverOnly: {
        status: "pre_auth_pending",
        expiresAt: Date.now() + 10 * 60 * 1_000,
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
    }));
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        [LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG]: "1",
        [LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR]: APP_ORIGIN,
        [LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR]: REDIRECT_URI,
        LOCAL_MCP_DEV_AUTH_RESOURCE: RESOURCE,
        LOCAL_MCP_DEV_AUTH_CLIENT_ID: CLIENT_ID,
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toContain(`${PROD_APP_ORIGIN}/sign-in?`);
    expect(convexHttpClientMutation).toHaveBeenCalledTimes(1);
  });

  it("keeps production login-return continuation ahead of the local OAuth route when both flags are enabled", async () => {
    const ctx = makeCtx();
    const dependencies = routeDependencies(ctx);
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        [LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG]: "1",
        [LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR]: APP_ORIGIN,
        [LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR]: REDIRECT_URI,
        LOCAL_MCP_DEV_AUTH_RESOURCE: RESOURCE,
        LOCAL_MCP_DEV_AUTH_CLIENT_ID: CLIENT_ID,
      },
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: dependencies,
    });
    const middleware = readConfiguredMiddleware(plugin);

    await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: { host: "mcp.twoweeks.example.test", cookie: BROWSER_NONCE_COOKIE },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      status: "owner_bound_continuation_prepared",
      route: "oauth_login_return",
      ownerBound: true,
      providerCalled: false,
      tokenExchangeAttempted: false,
      authorizationCodeIssued: false,
      accountLinkCreated: false,
    });
    expect(response.body).not.toContain("mcp_oauth_local_dev_route_failure");
    expectNoRouteLeakage(response);
  });

  it("lets localhost login-return continuations fall through to the local OAuth route when production wiring is also enabled", async () => {
    const plugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...prodRouteEnv(),
        [LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG]: "1",
        [LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR]: APP_ORIGIN,
        [LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR]: REDIRECT_URI,
        LOCAL_MCP_DEV_AUTH_RESOURCE: RESOURCE,
        LOCAL_MCP_DEV_AUTH_CLIENT_ID: CLIENT_ID,
      },
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: { host: "localhost:5173" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(503);
    expect(JSON.parse(response.body)).toMatchObject({
      kind: "mcp_oauth_local_dev_route_failure",
      reason: "dependency_unavailable",
    });
    expect(response.body).not.toContain("invalid_host");
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("wires production authorize requests into the live Vite middleware", async () => {
    const ctx = makeCtx();
    const plugin = createLocalMcpDevEndpointPlugin({
      env: prodRouteEnv(),
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: routeDependencies(ctx),
    });
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(303);
    expect(response.headers).toMatchObject({
      "cache-control": "no-store",
      location: `${PROD_APP_ORIGIN}/sign-in?${MCP_OAUTH_SIGN_IN_RETURN_PARAMETER}=${encodeURIComponent(
        continuationPath(),
      )}`,
    });
    expect(ctx.preAuthRows).toHaveLength(1);
    expect(ctx.preAuthRows[0]).toMatchObject({
      status: "pre_auth_pending",
      preAuthHandleHash: HANDLE_HASH,
    });
  });

  it("wires production authorize requests through real no-options Vite defaults", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    convexHttpClientMutation.mockImplementationOnce(async () => ({
      kind: "mcp_oauth_pre_auth_intent_create_result",
      ok: true,
      reason: "created",
      serverOnly: {
        status: "pre_auth_pending",
        expiresAt: Date.now() + 10 * 60 * 1_000,
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
    }));

    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(303);
    expect(response.headers.location).toContain(`${PROD_APP_ORIGIN}/sign-in?`);
    expect(ConvexHttpClientMock).toHaveBeenCalledWith("http://127.0.0.1:3210");
    expect(convexHttpClientSetAdminAuth).toHaveBeenCalledWith("convex_admin_key_fixture", undefined);
    expect(convexHttpClientMutation).toHaveBeenCalledTimes(1);
    expect(convexHttpClientMutation.mock.calls[0]?.[1]).toMatchObject({
      authorizationRequestProjection: {
        authorizationPage: {
          origin: PROD_APP_ORIGIN,
          path: MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
        },
      },
      version: 1,
    });
    expect(convexHttpClientMutation.mock.calls[0]?.[2]).toEqual({ skipQueue: true });
  });

  it("wires production login-return continuation through real no-options Vite defaults", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    jwtVerifyMock.mockResolvedValueOnce({
      payload: {
        sub: OWNER_ID,
        iss: CLERK_ISSUER,
        aud: "convex",
      },
    });
    convexHttpClientMutation.mockImplementationOnce(async () => ({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: true,
      reason: "bound",
      serverOnly: {
        ownerBoundIntent: {
          status: "pending",
          expiresAt: Date.now() + 10 * 60 * 1_000,
          version: 1,
        },
        preAuthIntent: {
          status: "claimed",
          version: 1,
        },
        trustedOwner: {
          kind: "mcp_oauth_authorization_trusted_owner",
          twoweeksClerkId: OWNER_ID,
          version: 1,
        },
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    }));

    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: {
        host: "mcp.twoweeks.example.test",
        authorization: `Bearer ${CLERK_JWT}`,
        cookie: BROWSER_NONCE_COOKIE,
      },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body)).toMatchObject({
      status: "owner_bound_continuation_prepared",
      route: "oauth_login_return",
      ownerBound: true,
      providerCalled: false,
      tokenExchangeAttempted: false,
      authorizationCodeIssued: false,
      accountLinkCreated: false,
    });
    expect(ConvexHttpClientMock).toHaveBeenCalledWith("http://127.0.0.1:3210");
    expect(createRemoteJWKSetMock).toHaveBeenCalledWith(new URL(`${CLERK_ISSUER}/.well-known/jwks.json`));
    expect(jwtVerifyMock).toHaveBeenCalledWith(
      CLERK_JWT,
      "clerk_jwks_fixture",
      {
        issuer: CLERK_ISSUER,
        audience: "convex",
      },
    );
    expect(convexHttpClientSetAdminAuth).toHaveBeenNthCalledWith(1, "convex_admin_key_fixture", undefined);
    expect(convexHttpClientSetAdminAuth).toHaveBeenNthCalledWith(2, "convex_admin_key_fixture", {
      subject: OWNER_ID,
      issuer: CLERK_ISSUER,
    });
    expect(convexHttpClientMutation).toHaveBeenCalledTimes(1);
    expect(convexHttpClientMutation.mock.calls[0]?.[1]).toEqual({
      preAuthHandleHash: HANDLE_HASH,
      now: expect.any(Number),
      version: 1,
    });
    expect(convexHttpClientMutation.mock.calls[0]?.[2]).toEqual({ skipQueue: true });
    expectNoRouteLeakage(response);
  });

  it("fails default production login-return continuation closed without a verified request identity", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: continuationPath(),
      headers: { host: "mcp.twoweeks.example.test", cookie: BROWSER_NONCE_COOKIE },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(401);
    expect(JSON.parse(response.body)).toMatchObject({
      status: "blocked",
      reason: "owner_binding_failed",
      route: "oauth_login_return",
      ownerBound: false,
      authorizationCodeIssued: false,
      tokenExchangeAttempted: false,
      accountLinkCreated: false,
    });
    expect(jwtVerifyMock).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
    expectNoRouteLeakage(response);
  });

  it("fails closed when the default Convex client cannot be constructed", async () => {
    for (const [key, value] of Object.entries(prodRouteEnv())) {
      vi.stubEnv(key, value);
    }
    ConvexHttpClientMock.mockImplementationOnce(() => {
      throw new Error("invalid deployment url");
    });

    const plugin = createLocalMcpDevEndpointPlugin();
    const middleware = readConfiguredMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(503);
    expect(response.body).toContain("pre_auth_create_failed");
    expect(convexHttpClientSetAdminAuth).not.toHaveBeenCalled();
    expect(convexHttpClientMutation).not.toHaveBeenCalled();
  });

  it("registers the production authorize middleware for Vite preview", async () => {
    const ctx = makeCtx();
    const plugin = createLocalMcpDevEndpointPlugin({
      env: prodRouteEnv(),
      productionOAuthAuthorizationConfig: routeConfig({ runtime: "1", approved: "1", routeWiring: "1" }),
      productionOAuthAuthorizationDependencies: routeDependencies(ctx),
    });
    const middleware = readConfiguredPreviewMiddleware(plugin);
    const response = await invokeMiddleware(middleware, {
      method: "GET",
      url: authorizationRequestPath(),
      headers: { host: "mcp.twoweeks.example.test" },
    });

    expect(response.next).not.toHaveBeenCalled();
    expect(response.statusCode).toBe(303);
    expect(ctx.preAuthRows).toHaveLength(1);
  });

  it("allows the production OAuth host through Vite preview host validation", () => {
    expect(buildMcpOAuthProductionViteAllowedHosts(prodRouteEnv())).toEqual([
      "host.docker.internal",
      "mcp.twoweeks.example.test",
    ]);
    expect(buildMcpOAuthProductionViteAllowedHosts({})).toEqual(["host.docker.internal"]);
    expect(buildMcpOAuthProductionViteAllowedHosts({
      MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: "https://mcp.twoweeks.example.test/path",
    })).toEqual(["host.docker.internal"]);
    expect(buildMcpOAuthProductionViteAllowedHosts({
      MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: "file://mcp.twoweeks.example.test/",
    })).toEqual(["host.docker.internal"]);
  });

  it("uses the PR92 route preflight instead of reimplementing production activation or status logic", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    expect(source).toContain("buildMcpOAuthProductionRoutePreflight");
    expect(source).toContain("from \"./mcpOAuthProductionRoutePreflightBoundary\"");
    expect(source).toContain("isRouteAllowedByPreflight(route, config.preflight)");
    expect(source).toContain("preflight.authorizeAllowedToWire");
    expect(source).toContain("preflight.allowedToWire");
    expectSourceNotToMatch(source, FORBIDDEN_PREFLIGHT_REIMPLEMENTATION_PATTERNS);
  });

  it("only claims the intended production entrypoint paths", () => {
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_CONTINUATION_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_PRODUCTION_CALLBACK_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_PRODUCTION_MCP_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath("/oauth/token")).toBe(false);
    expect(isMcpOAuthProductionRouteHandledPath("/oauth/authorize/extra")).toBe(false);
    expect(isMcpOAuthProductionRouteHandledPath("/mcp/oauth/authorize/continue/extra")).toBe(false);
    expect(isMcpOAuthProductionRouteHandledPath("/mcp/tools/list")).toBe(false);
  });
});

function activationDependencies(): McpOAuthProductionActivationDependenciesV1 {
  return {
    providerAdapter: {
      provider: "stytch",
      exchangeAuthorizationCode: vi.fn(async () => ({
        kind: "mcp_oauth_production_token_exchange_result",
        ok: false,
        reason: "not_executed_in_route_adapter_test",
        safeFailure: { code: "not_executed" },
        modelVisible: false,
        safeForLogging: true,
        version: 1,
      })),
      version: 1,
    },
    executeAccountLinkLifecycle: vi.fn(async () => ({
      kind: "mcp_account_link_lifecycle_result",
      operation: "link",
      ok: false,
      reason: "not_executed_in_route_adapter_test",
      safeFailure: { code: "not_executed" },
      modelVisible: false,
      version: 1,
    })),
  };
}

function routeConfig(
  flags: Readonly<{ runtime?: string; approved?: string; routeWiring?: string }>,
  dependencies: McpOAuthProductionActivationDependenciesV1 = activationDependencies(),
) {
  return buildMcpOAuthProductionRouteAdapterConfig({
    flags,
    providerConfig: PROVIDER_CONFIG,
    activationDependencies: dependencies,
  });
}

function request(
  path: McpOAuthProductionRoutePathV1,
  method = path === MCP_OAUTH_PRODUCTION_MCP_PATH ? "POST" : "GET",
  url = path,
): McpOAuthProductionRouteAdapterRequestV1 {
  return {
    method,
    path,
    url,
    headers: {
      host: "mcp.twoweeks.example.test",
      ...(path === MCP_OAUTH_CONTINUATION_PATH ? { cookie: BROWSER_NONCE_COOKIE } : {}),
    },
  };
}

function routeDependencies(ctx: ReturnType<typeof makeCtx>) {
  const dependencies = {
    authorizationRequestConfig: authorizationRequestConfig(),
    checkPreAuthQuota: vi.fn(async () => ({
      kind: "mcp_oauth_pre_auth_quota_result",
      ok: true,
      reason: "accepted",
      safeForLogging: true,
      version: 1,
    })),
    createPreAuthIntent: vi.fn(async (input) => createFakePreAuthIntent(ctx, input)),
    bindPreAuthIntentToAuthenticatedOwner: vi.fn(async (input) =>
      bindFakePreAuthIntentToAuthenticatedOwner(ctx, input),
    ),
    readAuthenticatedOwnerIdentity: vi.fn(async () =>
      ctx.subject === null
        ? undefined
        : {
            subject: ctx.subject,
            issuer: CLERK_ISSUER,
            version: 1,
          },
    ),
    generateBrowserBoundContinuationNonce: vi.fn(() => BROWSER_NONCE),
    handleCodec: deterministicCodec,
    now: vi.fn(() => NOW),
  } satisfies Required<
    Pick<
      McpOAuthProductionRouteAdapterDependenciesV1,
      | "authorizationRequestConfig"
      | "checkPreAuthQuota"
      | "createPreAuthIntent"
      | "bindPreAuthIntentToAuthenticatedOwner"
      | "readAuthenticatedOwnerIdentity"
      | "generateBrowserBoundContinuationNonce"
      | "handleCodec"
      | "now"
      >
  >;
  return dependencies;
}

function authorizationRequestConfig(): McpOAuthAuthorizationRequestBoundaryConfigV1 {
  return Object.freeze({
    kind: "mcp_oauth_authorization_request_boundary_config",
    authorizationPageOrigin: PROD_APP_ORIGIN,
    authorizationPagePath: MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
    canonicalResource: RESOURCE,
    allowedRedirectUris: [REDIRECT_URI],
    requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
    approvedOptionalScopes: ["openid", "email", "profile"],
    allowedOptionalParameters: ["nonce", "prompt"],
    maxUrlLength: 4_096,
    maxParameterLength: 512,
    maxStateLength: 512,
    maxIdTokenHintLength: 1_024,
    clientIdPolicy: Object.freeze({
      mode: "predefined_allowlist",
      allowedClientIds: [CLIENT_ID],
      version: 1,
    }),
    localDevelopmentOnly: true,
    allowHttpLocalhostAuthorizationOrigin: false,
    version: 1,
  });
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
  return `${MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH}?${params.toString()}`;
}

function continuationPath(): string {
  const params = new URLSearchParams({
    [MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER]: RAW_HANDLE,
    [MCP_OAUTH_CONTINUATION_BROWSER_NONCE_PARAMETER]: BROWSER_NONCE,
  });
  return `${MCP_OAUTH_CONTINUATION_PATH}?${params.toString()}`;
}

function makeCtx(options: Readonly<{ subject?: string | null }> = {}) {
  const preAuthRows: StoredPreAuthIntentRecord[] = [];

  return {
    preAuthRows,
    subject: options.subject === undefined ? OWNER_ID : options.subject,
  };
}

function createFakePreAuthIntent(
  ctx: ReturnType<typeof makeCtx>,
  input: Parameters<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createPreAuthIntent"]>>[0],
): ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["createPreAuthIntent"]>> {
  if (ctx.preAuthRows.some((row) => row.preAuthHandleHash === input.preAuthHandleHash)) {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_intent_create_result",
      ok: false,
      reason: "handle_collision",
      safeFailure: {
        code: "mcp_oauth_pre_auth_intent_denied",
        message: "Pre-auth intent denied.",
        safeForModel: true,
        sensitiveValuesEchoed: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }

  const projection = input.authorizationRequestProjection;
  const optionalParameters = projection.providerForwardRequest.approvedOptionalParameters;
  const row: StoredPreAuthIntentRecord = {
    kind: "mcp_oauth_pre_auth_intent_record",
    version: 1,
    preAuthHandleHash: input.preAuthHandleHash,
    authorizationPageOrigin: projection.authorizationPage.origin,
    authorizationPagePath: projection.authorizationPage.path,
    responseType: "code",
    clientId: projection.providerForwardRequest.clientId,
    redirectUri: projection.providerForwardRequest.redirectUri,
    resource: projection.providerForwardRequest.resource,
    scopes: [...projection.providerForwardRequest.scopes],
    state: projection.providerForwardRequest.state,
    codeChallenge: projection.providerForwardRequest.pkce.codeChallenge,
    codeChallengeMethod: "S256",
    ...(optionalParameters ? { approvedOptionalParameters: optionalParameters } : {}),
    providerValidationStatus: "pending",
    status: "pre_auth_pending",
    createdAt: input.now,
    updatedAt: input.now,
    expiresAt: input.now + 10 * 60 * 1_000,
    storageVersion: 1,
    _id: `mcpOAuthPreAuthIntents_fixture_${ctx.preAuthRows.length + 1}`,
    _creationTime: NOW,
  };
  ctx.preAuthRows.push(row);

  return Promise.resolve({
    kind: "mcp_oauth_pre_auth_intent_create_result",
    ok: true,
    reason: "created",
    serverOnly: {
      status: "pre_auth_pending",
      expiresAt: row.expiresAt,
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
}

function bindFakePreAuthIntentToAuthenticatedOwner(
  ctx: ReturnType<typeof makeCtx>,
  input: Parameters<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["bindPreAuthIntentToAuthenticatedOwner"]>>[0],
): ReturnType<NonNullable<McpOAuthProductionRouteAdapterDependenciesV1["bindPreAuthIntentToAuthenticatedOwner"]>> {
  if (ctx.subject === null) {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "unauthenticated",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }
  if (
    input.authenticatedOwnerIdentity.subject !== ctx.subject ||
    input.authenticatedOwnerIdentity.issuer !== CLERK_ISSUER
  ) {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "not_found_or_forbidden",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }

  const rows = ctx.preAuthRows.filter((row) => row.preAuthHandleHash === input.preAuthHandleHash);
  if (rows.length === 0) {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "not_found_or_forbidden",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }
  if (rows.length > 1) {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "duplicate_pre_auth_record",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }

  const row = rows[0];
  if (row.status === "claimed") {
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "already_claimed",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }
  if (row.status === "expired" || input.now >= row.expiresAt) {
    row.status = "expired";
    row.updatedAt = input.now;
    return Promise.resolve({
      kind: "mcp_oauth_pre_auth_owner_binding_result",
      ok: false,
      reason: "expired",
      safeFailure: safeOwnerBindingFailure(),
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    });
  }

  row.status = "claimed";
  row.updatedAt = input.now;
  row.claimedAt = input.now;
  return Promise.resolve({
    kind: "mcp_oauth_pre_auth_owner_binding_result",
    ok: true,
    reason: "bound",
    serverOnly: {
      ownerBoundIntent: {
        status: "pending",
        expiresAt: input.now + 10 * 60 * 1_000,
        version: 1,
      },
      preAuthIntent: {
        status: "claimed",
        version: 1,
      },
      trustedOwner: {
        kind: "mcp_oauth_authorization_trusted_owner",
        twoweeksClerkId: ctx.subject,
        version: 1,
      },
      version: 1,
    },
    modelVisible: false,
    safeForLogging: false,
    version: 1,
  });
}

function safeOwnerBindingFailure() {
  return {
    code: "mcp_oauth_pre_auth_owner_binding_denied",
    message: "Pre-auth owner binding denied.",
    safeForModel: true,
    handleEchoed: false,
    digestEchoed: false,
    identityEchoed: false,
    sensitiveValuesEchoed: false,
    version: 1,
  } as const;
}

function expectedRouteName(path: McpOAuthProductionRoutePathV1) {
  if (path === MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH) return "oauth_authorize";
  if (path === MCP_OAUTH_PRODUCTION_CALLBACK_PATH) return "oauth_callback";
  if (path === MCP_OAUTH_CONTINUATION_PATH) return "oauth_login_return";
  return "mcp";
}

function readConfiguredMiddleware(plugin: ReturnType<typeof createLocalMcpDevEndpointPlugin>) {
  expect(plugin).toBeTruthy();
  const middlewares = {
    use: vi.fn(),
  };
  plugin?.configureServer?.({ middlewares } as never);
  expect(middlewares.use).toHaveBeenCalledTimes(1);
  return middlewares.use.mock.calls[0]?.[0] as (
    req: { method?: string; url?: string; headers: Record<string, string | undefined>; socket?: { remoteAddress?: string } },
    res: {
      statusCode?: number;
      writableEnded?: boolean;
      setHeader: (key: string, value: string) => void;
      end: (body?: string) => void;
    },
    next: () => void,
  ) => void;
}

function readConfiguredPreviewMiddleware(plugin: ReturnType<typeof createLocalMcpDevEndpointPlugin>) {
  expect(plugin).toBeTruthy();
  const middlewares = {
    use: vi.fn(),
  };
  plugin?.configurePreviewServer?.({ middlewares } as never);
  expect(middlewares.use).toHaveBeenCalledTimes(1);
  return middlewares.use.mock.calls[0]?.[0] as ReturnType<typeof readConfiguredMiddleware>;
}

function invokeMiddleware(
  middleware: ReturnType<typeof readConfiguredMiddleware>,
  requestInput: { method: string; url: string; headers: Record<string, string | undefined> },
): Promise<Readonly<{ statusCode: number | undefined; headers: Record<string, string>; body: string; next: ReturnType<typeof vi.fn> }>> {
  const next = vi.fn();
  const headers: Record<string, string> = {};
  return new Promise((resolve) => {
    const response = {
      statusCode: undefined as number | undefined,
      writableEnded: false,
      setHeader(key: string, value: string) {
        headers[key.toLowerCase()] = value;
      },
      end(body = "") {
        response.writableEnded = true;
        resolve({
          statusCode: response.statusCode,
          headers,
          body,
          next,
        });
      },
    };
    middleware({ ...requestInput, socket: {} }, response, () => {
      next();
      resolve({
        statusCode: response.statusCode,
        headers,
        body: "",
        next,
      });
    });
  });
}

function invokeStreamingMiddleware(
  middleware: ReturnType<typeof readConfiguredMiddleware>,
  requestInput: { method: string; url: string; headers: Record<string, string | undefined>; body: string },
): Promise<Readonly<{ statusCode: number | undefined; headers: Record<string, string>; body: string; next: ReturnType<typeof vi.fn> }>> {
  const next = vi.fn();
  const headers: Record<string, string> = {};
  const request = Object.assign(new EventEmitter(), {
    method: requestInput.method,
    url: requestInput.url,
    headers: requestInput.headers,
    socket: { remoteAddress: "127.0.0.1" },
    setEncoding: vi.fn(),
    destroy: vi.fn(),
  });
  return new Promise((resolve) => {
    const response = {
      statusCode: undefined as number | undefined,
      writableEnded: false,
      setHeader(key: string, value: string) {
        headers[key.toLowerCase()] = value;
      },
      end(body = "") {
        response.writableEnded = true;
        resolve({
          statusCode: response.statusCode,
          headers,
          body,
          next,
        });
      },
    };
    middleware(request, response, () => {
      next();
      resolve({
        statusCode: response.statusCode,
        headers,
        body: "",
        next,
      });
    });
    queueMicrotask(() => {
      request.emit("data", requestInput.body);
      request.emit("end");
    });
  });
}

function prodRouteEnv(): Record<string, string> {
  return {
    MCP_OAUTH_PRODUCTION_RUNTIME: "1",
    MCP_OAUTH_PRODUCTION_APPROVED: "1",
    [MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG]: "1",
    MCP_OAUTH_PRODUCTION_RESOURCE: RESOURCE,
    MCP_OAUTH_PRODUCTION_ISSUER: PROVIDER_CONFIG.issuer,
    MCP_OAUTH_PRODUCTION_PROVIDER_ENVIRONMENT: PROVIDER_CONFIG.providerEnvironment,
    MCP_OAUTH_PRODUCTION_CLIENT_IDS: CLIENT_ID,
    MCP_OAUTH_PRODUCTION_AUTHORIZATION_ORIGIN: PROD_APP_ORIGIN,
    MCP_OAUTH_PRODUCTION_REDIRECT_URIS: REDIRECT_URI,
    CLERK_JWT_ISSUER_DOMAIN: CLERK_ISSUER,
    CONVEX_URL: "http://127.0.0.1:3210",
    CONVEX_KEY: "convex_admin_key_fixture",
  };
}

function expectNoRouteLeakage(
  value: unknown,
  extraForbidden: readonly string[] = [],
  options: Readonly<{ allowRawHandle?: boolean }> = {},
): void {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    PROVIDER_CONFIG.provider,
    PROVIDER_CONFIG.issuer,
    PROVIDER_CONFIG.resource,
    PROVIDER_CONFIG.providerEnvironment,
    PROVIDER_CONFIG.allowedClientIds[0],
    REDIRECT_URI,
    STATE,
    PKCE,
    HANDLE_HASH,
    OWNER_ID,
    OTHER_OWNER_ID,
    "authorization_code",
    "auth_code",
    "access_token",
    "refresh_token",
    "id_token",
    "client_secret",
    "redirect_secret",
    "owner_should_not_echo",
    ...extraForbidden,
  ] as const) {
    expect(serialized).not.toContain(forbidden);
  }
  if (!options.allowRawHandle) expect(serialized).not.toContain(RAW_HANDLE);
}

function expectSourceNotToMatch(source: string, patterns: readonly RegExp[]): void {
  for (const pattern of patterns) {
    expect(source).not.toMatch(pattern);
  }
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}
