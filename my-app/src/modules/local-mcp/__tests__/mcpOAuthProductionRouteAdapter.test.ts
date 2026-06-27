// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createLocalMcpDevEndpointPlugin } from "../../../../vite.config";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../mcpAuthPolicyBoundary";
import {
  buildMcpOAuthLocalDevRouteAdapterConfig,
  handleMcpOAuthLocalDevRouteRequest,
  LOCAL_MCP_DEV_OAUTH_APPLICATION_ORIGIN_VAR,
  LOCAL_MCP_DEV_OAUTH_AUTHORIZATION_FLAG,
  LOCAL_MCP_DEV_OAUTH_REDIRECT_URI_VAR,
} from "../mcpOAuthLocalDevRouteAdapter";
import {
  buildMcpOAuthProductionRouteAdapterConfig,
  handleMcpOAuthProductionRouteRequest,
  isMcpOAuthProductionRouteHandledPath,
  MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
  MCP_OAUTH_PRODUCTION_CALLBACK_PATH,
  MCP_OAUTH_PRODUCTION_MCP_PATH,
  type McpOAuthProductionRouteAdapterRequestV1,
  type McpOAuthProductionRoutePathV1,
} from "../mcpOAuthProductionRouteAdapter";
import { MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG } from "../mcpOAuthProductionRoutePreflightBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpOAuthProductionRouteAdapter.ts");
const VITE_CONFIG_SOURCE = resolve(TEST_DIR, "../../../../vite.config.ts");
const APP_ORIGIN = "http://localhost:5173";
const REDIRECT_URI = "https://chatgpt.example.test/connector/oauth/callback-fixture";
const RESOURCE = "https://mcp.twoweeks.example.test/resource";
const CLIENT_ID = "chatgpt_apps_sdk_client";
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
const PROVIDER_CONFIG = {
  provider: "stytch",
  issuer: "https://stytch.example.test/",
  resource: RESOURCE,
  providerEnvironment: "prod_us_1",
  allowedClientIds: [CLIENT_ID],
  requiredReadScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
  version: 1,
} as const;

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

  it("reaches only guarded inert handlers when all production flags and config are valid", async () => {
    const config = routeConfig({ runtime: "1", approved: "1", routeWiring: "1" });

    for (const path of [
      MCP_OAUTH_PRODUCTION_AUTHORIZATION_PATH,
      MCP_OAUTH_PRODUCTION_CALLBACK_PATH,
      MCP_OAUTH_PRODUCTION_MCP_PATH,
    ] as const) {
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

function routeConfig(flags: Readonly<{ runtime?: string; approved?: string; routeWiring?: string }>) {
  return buildMcpOAuthProductionRouteAdapterConfig({
    flags,
    providerConfig: PROVIDER_CONFIG,
  });
}

function request(
  path: McpOAuthProductionRoutePathV1,
  method = path === MCP_OAUTH_PRODUCTION_MCP_PATH ? "POST" : "GET",
): McpOAuthProductionRouteAdapterRequestV1 {
  return {
    method,
    path,
    url: path,
    headers: { host: "mcp.twoweeks.example.test" },
  };
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

function expectNoRouteLeakage(value: unknown, extraForbidden: readonly string[] = []): void {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    PROVIDER_CONFIG.provider,
    PROVIDER_CONFIG.issuer,
    PROVIDER_CONFIG.resource,
    PROVIDER_CONFIG.providerEnvironment,
    PROVIDER_CONFIG.allowedClientIds[0],
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
}

function expectSourceNotToMatch(source: string, patterns: readonly RegExp[]): void {
  for (const pattern of patterns) {
    expect(source).not.toMatch(pattern);
  }
}
