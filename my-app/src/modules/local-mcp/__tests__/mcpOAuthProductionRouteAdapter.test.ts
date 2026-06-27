// @vitest-environment node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { createLocalMcpDevEndpointPlugin } from "../../../../vite.config";
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
  MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER,
  MCP_OAUTH_CONTINUATION_PATH,
  MCP_OAUTH_SIGN_IN_RETURN_PARAMETER,
} from "../../../pages/sign-in-return";

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
  status: "pre_auth_pending";
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
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
      expect(dependencies.now).toHaveBeenCalledTimes(1);
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
    expect(createLocalMcpDevEndpointPlugin({ env: prodRouteEnv() })).toBeUndefined();
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
    expect(viteSource).not.toContain("mcpOAuthProductionRouteAdapter");
  });

  it("uses the PR92 route preflight instead of reimplementing production activation or status logic", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    expect(source).toContain("buildMcpOAuthProductionRoutePreflight");
    expect(source).toContain("from \"./mcpOAuthProductionRoutePreflightBoundary\"");
    expect(source).toContain("config.preflight.allowedToWire");
    expectSourceNotToMatch(source, FORBIDDEN_PREFLIGHT_REIMPLEMENTATION_PATTERNS);
  });

  it("only claims the intended production entrypoint paths", () => {
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_PRODUCTION_CALLBACK_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath(MCP_OAUTH_PRODUCTION_MCP_PATH)).toBe(true);
    expect(isMcpOAuthProductionRouteHandledPath("/oauth/token")).toBe(false);
    expect(isMcpOAuthProductionRouteHandledPath("/oauth/authorize/extra")).toBe(false);
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
    headers: { host: "mcp.twoweeks.example.test" },
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
    handleCodec: deterministicCodec,
    now: vi.fn(() => NOW),
  } satisfies Required<
    Pick<
      McpOAuthProductionRouteAdapterDependenciesV1,
      "authorizationRequestConfig" | "checkPreAuthQuota" | "createPreAuthIntent" | "handleCodec" | "now"
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
  return `${MCP_OAUTH_CONTINUATION_PATH}?${MCP_OAUTH_CONTINUATION_HANDLE_PARAMETER}=${RAW_HANDLE}`;
}

function makeCtx() {
  const preAuthRows: StoredPreAuthIntentRecord[] = [];

  return {
    preAuthRows,
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

function expectedRouteName(path: McpOAuthProductionRoutePathV1) {
  if (path === MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH) return "oauth_authorize";
  if (path === MCP_OAUTH_PRODUCTION_CALLBACK_PATH) return "oauth_callback";
  return "mcp";
}

function prodRouteEnv(): Record<string, string> {
  return {
    MCP_OAUTH_PRODUCTION_RUNTIME: "1",
    MCP_OAUTH_PRODUCTION_APPROVED: "1",
    [MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG]: "1",
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
