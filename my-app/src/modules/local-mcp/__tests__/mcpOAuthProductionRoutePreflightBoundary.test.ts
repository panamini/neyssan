import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../mcpAuthPolicyBoundary";
import type { McpOAuthProductionActivationDependenciesV1 } from "../mcpOAuthProductionActivationBoundary";
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

const ACTIVATION_DEPENDENCIES = {
  providerAdapter: {
    provider: "stytch",
    exchangeAuthorizationCode: async () => ({
      kind: "mcp_oauth_production_token_exchange_result",
      ok: false,
      reason: "not_executed_in_route_preflight",
      safeFailure: { code: "not_executed" },
      modelVisible: false,
      safeForLogging: true,
      version: 1,
    }),
    version: 1,
  },
  executeAccountLinkLifecycle: async () => ({
    kind: "mcp_account_link_lifecycle_result",
    operation: "link",
    ok: false,
    reason: "not_executed_in_route_preflight",
    safeFailure: { code: "not_executed" },
    modelVisible: false,
    version: 1,
  }),
} as const satisfies McpOAuthProductionActivationDependenciesV1;

describe("MCP OAuth production route preflight boundary", () => {
  it("is disabled by default without exposing routes or config values", () => {
    expect(buildMcpOAuthProductionRoutePreflight()).toEqual({
      kind: "mcp_oauth_production_route_preflight",
      decision: "disabled",
      authorizeAllowedToWire: false,
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
      activationDependencies: {
        providerAdapterAvailable: false,
        accountLinkLifecycleAvailable: false,
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
      authorizeAllowedToWire: false,
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
        activationDependencies: ACTIVATION_DEPENDENCIES,
      }),
    ).toMatchObject({
      decision: "blocked_endpoint_exposure_not_enabled",
      authorizeAllowedToWire: false,
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
        activationDependencies: ACTIVATION_DEPENDENCIES,
      }),
    ).toMatchObject({
      decision: "blocked_misconfigured_provider",
      authorizeAllowedToWire: false,
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

  it("allows authorize route wiring but not activation route wiring when activation dependencies are unavailable", () => {
    expect(
      buildMcpOAuthProductionRoutePreflight({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: PROVIDER_CONFIG,
      }),
    ).toMatchObject({
      decision: "blocked_missing_activation_dependency",
      authorizeAllowedToWire: true,
      allowedToWire: false,
      activationDependencies: {
        providerAdapterAvailable: false,
        accountLinkLifecycleAvailable: false,
        valuesExposed: false,
      },
      capabilities: expectedBlockedCapabilities(),
    });
  });

  it("returns ready_to_wire only when all production flags, provider config, status, and activation dependencies agree", () => {
    expect(
      buildMcpOAuthProductionRoutePreflight({
        flags: { runtime: "1", approved: "1", routeWiring: "1" },
        providerConfig: PROVIDER_CONFIG,
        activationDependencies: ACTIVATION_DEPENDENCIES,
      }),
    ).toEqual({
      kind: "mcp_oauth_production_route_preflight",
      decision: "ready_to_wire",
      authorizeAllowedToWire: true,
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
      activationDependencies: {
        providerAdapterAvailable: true,
        accountLinkLifecycleAvailable: true,
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
      activationDependencies: ACTIVATION_DEPENDENCIES,
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
    const outputKeys = collectJsonKeys(result);
    for (const forbiddenKey of ["ownerId", "authorizationCode"] as const) {
      expect(outputKeys).not.toContain(forbiddenKey);
    }
  });

  it("does not register endpoints or route wiring in this PR", () => {
    const boundarySource = readFileSync(BOUNDARY_SOURCE, "utf8");
    const viteSource = readFileSync(VITE_CONFIG_SOURCE, "utf8");
    const convexHttpSource = readFileSync(CONVEX_HTTP_SOURCE, "utf8");
    const localDevEndpointSource = readFileSync(LOCAL_DEV_ENDPOINT_SOURCE, "utf8");
    const routeEntrypointSources = [
      viteSource,
      convexHttpSource,
      localDevEndpointSource,
    ] as const;

    for (const source of routeEntrypointSources) {
      expect(source).not.toContain(MCP_OAUTH_PRODUCTION_ROUTE_WIRING_FLAG);
      expect(source).not.toMatch(/\bmcpOAuthProductionRoutePreflight\b/u);
      expect(source).not.toMatch(/\bbuildMcpOAuthProductionRoutePreflight\b/u);
      expect(source).not.toMatch(/\bMCP_OAUTH_PRODUCTION_(?:RUNTIME|APPROVED|ROUTE_WIRING)\b/u);
    }
    for (const productionEntrypointSource of [viteSource, convexHttpSource] as const) {
      expect(productionEntrypointSource).not.toMatch(
        /\bpath:\s*["'`](?:\/oauth\/(?:authorize|callback|token)|\/mcp(?:\/[^"'`]*)?)["'`]/u,
      );
      expect(productionEntrypointSource).not.toMatch(
        /\/oauth\/(?:authorize|callback|token)|["'`]\/mcp(?:\/[^"'`]*)?["'`]/u,
      );
    }
    expect(boundarySource).not.toMatch(/\b(?:app|router)\.(?:get|post|use|all|route)\s*\(/u);
    expect(boundarySource).not.toMatch(/\bhttp\.route\s*\(/u);
    expect(boundarySource).not.toMatch(/\b(?:createServer|serve|listen)\s*\(/u);
    expect(boundarySource).not.toMatch(/\bfetch\s*\(|\bXMLHttpRequest\b/u);
    expect(boundarySource).not.toMatch(/from\s+["']@stytch|from\s+["']node:https|from\s+["']node:http/u);
    expect(boundarySource).not.toMatch(/\.exchangeAuthorizationCode\s*\(|executeAccountLinkLifecycle\s*\(/u);
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

function collectJsonKeys(value: unknown): ReadonlySet<string> {
  const keys = new Set<string>();
  collectJsonKeysInto(value, keys);
  return keys;
}

function collectJsonKeysInto(value: unknown, keys: Set<string>): void {
  if (value === null || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) collectJsonKeysInto(item, keys);
    return;
  }
  for (const [key, nestedValue] of Object.entries(value)) {
    keys.add(key);
    collectJsonKeysInto(nestedValue, keys);
  }
}
