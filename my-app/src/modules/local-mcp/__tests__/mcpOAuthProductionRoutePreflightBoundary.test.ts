import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../mcpAuthPolicyBoundary";
import {
  MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG,
  buildMcpOAuthProductionRoutePreflight,
} from "../mcpOAuthProductionRoutePreflightBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const BOUNDARY_SOURCE = resolve(TEST_DIR, "../mcpOAuthProductionRoutePreflightBoundary.ts");
const VITE_CONFIG_SOURCE = resolve(TEST_DIR, "../../../../vite.config.ts");
const CONVEX_HTTP_SOURCE = resolve(TEST_DIR, "../../../../convex/http.ts");
const LOCAL_DEV_ENDPOINT_SOURCE = resolve(TEST_DIR, "../localMcpDevEndpoint.ts");

const PROVIDER_CONFIG = {
  provider: "stytch",
  issuer: "https://stytch.example.test/",
  resource: "https://mcp.twoweeks.example.test/resource",
  providerEnvironment: "prod_us_1",
  allowedClientIds: ["chatgpt_apps_sdk_client"],
  requiredReadScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
  version: 1,
} as const;

describe("MCP OAuth production route preflight boundary", () => {
  it("is disabled by default without exposing routes or config values", () => {
    expect(buildMcpOAuthProductionRoutePreflight()).toEqual({
      kind: "mcp_oauth_production_route_preflight",
      decision: "disabled",
      allowedToWire: false,
      safeForModel: true,
      requiredFlags: {
        runtimeFlagName: "MCP_OAUTH_PRODUCTION_RUNTIME",
        approvedFlagName: "MCP_OAUTH_PRODUCTION_APPROVED",
        routeWiringFlagName: MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG,
        runtimeEnabled: false,
        approved: false,
        routeWiringEnabled: false,
        allRequired: true,
        version: 1,
      },
      provider: {
        provider: "unavailable",
        configShape: "invalid_or_missing",
        valuesExposed: false,
        version: 1,
      },
      operationalStatus: {
        capability: "production_oauth_activation",
        agreesWithActivationConfig: false,
        enabled: false,
        configValid: true,
        featureState: "disabled",
        category: "feature_disabled",
        valuesExposed: false,
        version: 1,
      },
      capabilities: expectedBlockedCapabilities(),
      version: 1,
    });
  });

  it("does not allow route wiring when only the production runtime flag is enabled", () => {
    expect(
      buildMcpOAuthProductionRoutePreflight({
        flags: { runtime: "1" },
        providerConfig: PROVIDER_CONFIG,
      }),
    ).toMatchObject({
      decision: "blocked_missing_approval_flag",
      allowedToWire: false,
      requiredFlags: {
        runtimeEnabled: true,
        approved: false,
        routeWiringEnabled: false,
      },
      capabilities: expectedBlockedCapabilities(),
    });
  });

  it("does not allow route wiring without the explicit route exposure flag", () => {
    expect(
      buildMcpOAuthProductionRoutePreflight({
        flags: { runtime: "1", approved: "1" },
        providerConfig: PROVIDER_CONFIG,
      }),
    ).toMatchObject({
      decision: "blocked_endpoint_exposure_not_enabled",
      allowedToWire: false,
      requiredFlags: {
        runtimeEnabled: true,
        approved: true,
        routeWiringEnabled: false,
      },
      operationalStatus: {
        agreesWithActivationConfig: true,
        enabled: true,
        configValid: true,
        featureState: "blocked",
        category: "auth_invalid",
        valuesExposed: false,
      },
    });
  });

  it("fails closed when provider config is malformed", () => {
    expect(
      buildMcpOAuthProductionRoutePreflight({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: {
          ...PROVIDER_CONFIG,
          issuer: "http://stytch.example.test/",
        },
      }),
    ).toMatchObject({
      decision: "blocked_misconfigured_provider",
      allowedToWire: false,
      provider: {
        provider: "unavailable",
        configShape: "invalid_or_missing",
        valuesExposed: false,
      },
      operationalStatus: {
        agreesWithActivationConfig: false,
        enabled: false,
        configValid: false,
        featureState: "misconfigured",
        category: "config_invalid",
        valuesExposed: false,
      },
    });
  });

  it("returns ready_to_wire only when all production flags, provider config, and status agree", () => {
    expect(
      buildMcpOAuthProductionRoutePreflight({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: PROVIDER_CONFIG,
      }),
    ).toEqual({
      kind: "mcp_oauth_production_route_preflight",
      decision: "ready_to_wire",
      allowedToWire: true,
      safeForModel: true,
      requiredFlags: {
        runtimeFlagName: "MCP_OAUTH_PRODUCTION_RUNTIME",
        approvedFlagName: "MCP_OAUTH_PRODUCTION_APPROVED",
        routeWiringFlagName: MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG,
        runtimeEnabled: true,
        approved: true,
        routeWiringEnabled: true,
        allRequired: true,
        version: 1,
      },
      provider: {
        provider: "stytch",
        configShape: "valid",
        valuesExposed: false,
        version: 1,
      },
      operationalStatus: {
        capability: "production_oauth_activation",
        agreesWithActivationConfig: true,
        enabled: true,
        configValid: true,
        featureState: "blocked",
        category: "auth_invalid",
        valuesExposed: false,
        version: 1,
      },
      capabilities: expectedBlockedCapabilities(),
      version: 1,
    });
  });

  it("never exposes secrets, token material, raw provider config, or owner identifiers", () => {
    const result = buildMcpOAuthProductionRoutePreflight({
      flags: { runtime: "1", approved: "1", routeWiring: "1" },
      providerConfig: {
        ...PROVIDER_CONFIG,
        clientSecret: "client_secret_should_not_echo",
        ownerId: "clerk_owner_should_not_echo",
        authorizationCode: "auth_code_should_not_echo",
        accessToken: "access_token_should_not_echo",
      } as never,
    });
    const serialized = JSON.stringify(result);

    for (const forbidden of [
      PROVIDER_CONFIG.issuer,
      PROVIDER_CONFIG.resource,
      PROVIDER_CONFIG.providerEnvironment,
      PROVIDER_CONFIG.allowedClientIds[0],
      "client_secret_should_not_echo",
      "clerk_owner_should_not_echo",
      "auth_code_should_not_echo",
      "access_token_should_not_echo",
      "refresh_token",
      "id_token",
      "clientSecret",
      "accessToken",
    ] as const) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("does not register endpoints or route wiring in this PR", () => {
    const boundarySource = readFileSync(BOUNDARY_SOURCE, "utf8");
    const viteSource = readFileSync(VITE_CONFIG_SOURCE, "utf8");
    const convexHttpSource = readFileSync(CONVEX_HTTP_SOURCE, "utf8");
    const localDevEndpointSource = readFileSync(LOCAL_DEV_ENDPOINT_SOURCE, "utf8");

    expect(viteSource).not.toContain(MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG);
    expect(convexHttpSource).not.toContain(MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG);
    expect(localDevEndpointSource).not.toContain(MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG);
    expect(boundarySource).not.toMatch(/\b(?:app|router)\.(?:get|post|use|all|route)\s*\(/u);
    expect(boundarySource).not.toMatch(/\bhttp\.route\s*\(/u);
    expect(boundarySource).not.toMatch(/\b(?:createServer|serve|listen)\s*\(/u);
    expect(boundarySource).not.toMatch(/\bfetch\s*\(|\bXMLHttpRequest\b/u);
    expect(boundarySource).not.toMatch(/from\s+["']@stytch|from\s+["']node:https|from\s+["']node:http/u);
    expect(boundarySource).not.toMatch(/exchangeAuthorizationCode|executeAccountLinkLifecycle/u);
    expect(boundarySource).not.toMatch(/\/oauth\/(?:authorize|callback|token)|["'`]\/mcp["'`]/u);
  });
});

function expectedBlockedCapabilities() {
  return {
    publicEndpointExposure: "not_exposed",
    routeRegistration: "not_registered",
    viteProductionRouteWiring: "blocked",
    hostedMcp: "blocked",
    providerCalls: "blocked",
    tokenExchange: "blocked",
    accountLinkCreation: "blocked",
    tokenStorage: "none",
    refreshTokenStorage: "none",
    ownerIdentifiers: "not_accepted",
    authorizationCodes: "not_accepted",
    providerSecrets: "not_accepted",
    version: 1,
  } as const;
}
