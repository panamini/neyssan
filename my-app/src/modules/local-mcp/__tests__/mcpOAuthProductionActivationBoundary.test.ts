import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import {
  MCP_OAUTH_PRODUCTION_APPROVED_FLAG,
  MCP_OAUTH_PRODUCTION_RUNTIME_FLAG,
  buildMcpOAuthProductionActivationConfig,
  buildMcpOAuthProductionActivationSafeRefusal,
  executeMcpOAuthProductionActivation,
  isMcpOAuthProductionActivationEnabled,
  type McpOAuthProductionAccountLinkLifecyclePortV1,
  type McpOAuthProductionActivationConfigV1,
  type McpOAuthProductionProviderAdapterV1,
} from "../mcpOAuthProductionActivationBoundary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const BOUNDARY_SOURCE = resolve(TEST_DIR, "../mcpOAuthProductionActivationBoundary.ts");
const VITE_CONFIG_SOURCE = resolve(TEST_DIR, "../../../../vite.config.ts");
const LOCAL_DEV_ENDPOINT_SOURCE = resolve(TEST_DIR, "../localMcpDevEndpoint.ts");

const NOW_EPOCH_SECONDS = 1_782_000_000;
const FIXTURE_AUTH_CODE = "provider-auth-code-secret-do-not-echo";
const FIXTURE_CODE_VERIFIER = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ";
const FIXTURE_PROVIDER_SUBJECT = "stytch_member_prod_123";
const FIXTURE_OWNER = "clerk_prod_owner_123";
const FIXTURE_CLIENT_ID = "chatgpt_apps_sdk_client";

const PROVIDER_CONFIG = {
  provider: "stytch",
  issuer: "https://stytch.example.test/",
  resource: "https://mcp.twoweeks.example.test/resource",
  providerEnvironment: "prod_us_1",
  allowedClientIds: [FIXTURE_CLIENT_ID],
  requiredReadScopes: ["twoweeks:applications:read"],
  version: 1,
} as const;

function enabledConfig(): McpOAuthProductionActivationConfigV1 {
  return buildMcpOAuthProductionActivationConfig({
    flags: { runtime: "1", approved: "1" },
    providerConfig: PROVIDER_CONFIG,
  });
}

function buildInput(
  config = enabledConfig(),
  dependencies: {
    providerAdapter?: McpOAuthProductionProviderAdapterV1;
    executeAccountLinkLifecycle?: McpOAuthProductionAccountLinkLifecyclePortV1;
  } = buildDependencies(),
) {
  return {
    kind: "mcp_oauth_production_activation_input",
    authorizationCode: FIXTURE_AUTH_CODE,
    redirectUri: "https://chat.openai.com/aip/oauth/callback",
    codeVerifier: FIXTURE_CODE_VERIFIER,
    clientId: FIXTURE_CLIENT_ID,
    trustedOwner: {
      kind: "mcp_oauth_authorization_trusted_owner",
      twoweeksClerkId: FIXTURE_OWNER,
      version: 1,
    },
    config,
    dependencies,
    nowEpochSeconds: NOW_EPOCH_SECONDS,
    version: 1,
  } as const;
}

function buildDependencies() {
  const providerAdapter: McpOAuthProductionProviderAdapterV1 = {
    provider: "stytch",
    exchangeAuthorizationCode: vi.fn(async () => ({
      kind: "mcp_oauth_production_token_exchange_result",
      ok: true,
      reason: "exchanged",
      serverOnly: {
        provider: "stytch",
        subject: FIXTURE_PROVIDER_SUBJECT,
        issuer: "https://stytch.example.test/",
        resource: "https://mcp.twoweeks.example.test/resource",
        providerEnvironment: "prod_us_1",
        clientId: FIXTURE_CLIENT_ID,
        grantedScopes: ["twoweeks:applications:read"],
        expiresAtEpochSeconds: NOW_EPOCH_SECONDS + 3_600,
        verifiedAtEpochSeconds: NOW_EPOCH_SECONDS,
        tokenMaterial: "handled_by_provider_adapter",
        accessTokenStored: false,
        refreshTokenStored: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    })),
    version: 1,
  };
  const executeAccountLinkLifecycle: McpOAuthProductionAccountLinkLifecyclePortV1 = vi.fn(async (request) => ({
    kind: "mcp_account_link_lifecycle_result",
    operation: "link",
    ok: true,
    reason: "linked",
    serverOnly: {
      twoweeksClerkId: request.trustedOwner.twoweeksClerkId,
      provider: "stytch",
      subject: request.verifiedEvidence.subject,
      clientId: request.verifiedEvidence.clientId,
      version: 1,
    },
    modelVisible: false,
    version: 1,
  }));
  return { providerAdapter, executeAccountLinkLifecycle };
}

describe("MCP OAuth production activation boundary", () => {
  it("is disabled by default and records the exact required flags", () => {
    const config = buildMcpOAuthProductionActivationConfig({ providerConfig: PROVIDER_CONFIG });

    expect(config).toMatchObject({
      kind: "mcp_oauth_production_activation_config",
      enabled: false,
      requiredFlags: {
        runtimeFlagName: MCP_OAUTH_PRODUCTION_RUNTIME_FLAG,
        approvedFlagName: MCP_OAUTH_PRODUCTION_APPROVED_FLAG,
        runtimeValue: "not_enabled",
        approvedValue: "not_enabled",
        bothRequired: true,
        version: 1,
      },
      publicEndpointExposed: false,
      frontendWiring: false,
      tokenStorage: "none",
      refreshTokenStorage: "none",
      defaultProductionBehavior: "disabled",
      version: 1,
    });
    expect(isMcpOAuthProductionActivationEnabled(config)).toBe(false);
  });

  it("requires both production runtime and production approval flags before executing provider or lifecycle ports", async () => {
    for (const config of [
      buildMcpOAuthProductionActivationConfig({
        flags: { runtime: "1" },
        providerConfig: PROVIDER_CONFIG,
      }),
      buildMcpOAuthProductionActivationConfig({
        flags: { approved: "1" },
        providerConfig: PROVIDER_CONFIG,
      }),
    ] as const) {
      const dependencies = buildDependencies();
      const result = await executeMcpOAuthProductionActivation(buildInput(config, dependencies));

      expect(result.allowed).toBe(false);
      expect(result).toMatchObject({
        safeRefusal: buildMcpOAuthProductionActivationSafeRefusal(),
        capabilities: {
          productionRuntime: "disabled",
          tokenExchange: "blocked",
          accountLinkLifecycle: "blocked",
          publicEndpointExposure: "blocked",
          frontendWiring: "blocked",
        },
      });
      expect(dependencies.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
      expect(dependencies.executeAccountLinkLifecycle).not.toHaveBeenCalled();
    }
  });

  it("executes mock provider token exchange and account-link lifecycle only when both flags are enabled", async () => {
    const dependencies = buildDependencies();
    const result = await executeMcpOAuthProductionActivation(buildInput(enabledConfig(), dependencies));

    expect(result).toMatchObject({
      kind: "mcp_oauth_production_activation_result",
      allowed: true,
      reason: "production_activation_completed",
      serverOnly: {
        provider: "stytch",
        tokenExchange: "completed_by_provider_adapter",
        accountLinkLifecycle: "linked_or_already_linked",
        subjectBinding: "verified_stytch_subject_server_only_not_returned",
        ownerBinding: "twoweeks_owner_server_only_not_returned",
        grantedReadScopes: ["twoweeks:applications:read"],
        requiredReadScopes: ["twoweeks:applications:read"],
        version: 1,
      },
      capabilities: {
        productionRuntime: "strict_flags_enabled",
        tokenExchange: "provider_adapter_only",
        accountLinkLifecycle: "server_hook_only",
        publicEndpointExposure: "blocked",
        frontendWiring: "blocked",
        dataReads: "blocked",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
      },
      modelVisible: false,
      version: 1,
    });

    expect(dependencies.providerAdapter.exchangeAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(dependencies.providerAdapter.exchangeAuthorizationCode).toHaveBeenCalledWith({
      kind: "mcp_oauth_production_token_exchange_request",
      provider: "stytch",
      authorizationCode: FIXTURE_AUTH_CODE,
      redirectUri: "https://chat.openai.com/aip/oauth/callback",
      codeVerifier: FIXTURE_CODE_VERIFIER,
      clientId: FIXTURE_CLIENT_ID,
      issuer: "https://stytch.example.test/",
      resource: "https://mcp.twoweeks.example.test/resource",
      providerEnvironment: "prod_us_1",
      version: 1,
    });
    expect(dependencies.executeAccountLinkLifecycle).toHaveBeenCalledTimes(1);
    expect(dependencies.executeAccountLinkLifecycle).toHaveBeenCalledWith({
      kind: "mcp_oauth_production_account_link_lifecycle_request",
      operation: "link",
      trustedOwner: {
        kind: "mcp_oauth_authorization_trusted_owner",
        twoweeksClerkId: FIXTURE_OWNER,
        version: 1,
      },
      verifiedEvidence: {
        kind: "mcp_verified_account_link_evidence",
        provider: "stytch",
        issuer: "https://stytch.example.test/",
        subject: FIXTURE_PROVIDER_SUBJECT,
        providerEnvironment: "prod_us_1",
        clientId: FIXTURE_CLIENT_ID,
        resource: "https://mcp.twoweeks.example.test/resource",
        grantedScopes: ["twoweeks:applications:read"],
        expiresAtEpochSeconds: NOW_EPOCH_SECONDS + 3_600,
        verifiedAtEpochSeconds: NOW_EPOCH_SECONDS,
        cryptographicVerification: "already_verified_by_provider_adapter",
        version: 1,
      },
      lifecycleConfig: {
        kind: "mcp_account_link_lifecycle_config",
        expectedIssuer: "https://stytch.example.test/",
        expectedResource: "https://mcp.twoweeks.example.test/resource",
        expectedProviderEnvironment: "prod_us_1",
        allowedClientIds: [FIXTURE_CLIENT_ID],
        version: 1,
      },
      nowEpochSeconds: NOW_EPOCH_SECONDS,
      version: 1,
    });
  });

  it("refuses unsafe provider exchange output without running account-link lifecycle", async () => {
    const dependencies = buildDependencies();
    vi.mocked(dependencies.providerAdapter.exchangeAuthorizationCode).mockResolvedValueOnce({
      kind: "mcp_oauth_production_token_exchange_result",
      ok: true,
      reason: "exchanged",
      serverOnly: {
        provider: "stytch",
        subject: FIXTURE_PROVIDER_SUBJECT,
        issuer: "https://stytch.example.test/",
        resource: "https://mcp.twoweeks.example.test/resource",
        providerEnvironment: "prod_us_1",
        clientId: FIXTURE_CLIENT_ID,
        grantedScopes: ["twoweeks:applications:read"],
        expiresAtEpochSeconds: NOW_EPOCH_SECONDS + 3_600,
        verifiedAtEpochSeconds: NOW_EPOCH_SECONDS,
        tokenMaterial: "handled_by_provider_adapter",
        accessTokenStored: true,
        refreshTokenStored: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    } as never);

    const result = await executeMcpOAuthProductionActivation(buildInput(enabledConfig(), dependencies));

    expect(result).toMatchObject({
      allowed: false,
      reason: "token_exchange_failed",
      safeRefusal: { tokenEchoed: false, authorizationCodeEchoed: false },
    });
    expect(dependencies.executeAccountLinkLifecycle).not.toHaveBeenCalled();
  });

  it("refuses malformed provider scopes without throwing or running account-link lifecycle", async () => {
    const dependencies = buildDependencies();
    vi.mocked(dependencies.providerAdapter.exchangeAuthorizationCode).mockResolvedValueOnce({
      kind: "mcp_oauth_production_token_exchange_result",
      ok: true,
      reason: "exchanged",
      serverOnly: {
        provider: "stytch",
        subject: FIXTURE_PROVIDER_SUBJECT,
        issuer: "https://stytch.example.test/",
        resource: "https://mcp.twoweeks.example.test/resource",
        providerEnvironment: "prod_us_1",
        clientId: FIXTURE_CLIENT_ID,
        grantedScopes: 123,
        expiresAtEpochSeconds: NOW_EPOCH_SECONDS + 3_600,
        verifiedAtEpochSeconds: NOW_EPOCH_SECONDS,
        tokenMaterial: "handled_by_provider_adapter",
        accessTokenStored: false,
        refreshTokenStored: false,
        version: 1,
      },
      modelVisible: false,
      safeForLogging: false,
      version: 1,
    } as never);

    await expect(executeMcpOAuthProductionActivation(buildInput(enabledConfig(), dependencies))).resolves.toMatchObject({
      allowed: false,
      reason: "token_exchange_failed",
      safeRefusal: { tokenEchoed: false, authorizationCodeEchoed: false },
    });
    expect(dependencies.executeAccountLinkLifecycle).not.toHaveBeenCalled();
  });

  it("refuses thrown account-link lifecycle hooks without rejecting activation", async () => {
    const dependencies = buildDependencies();
    vi.mocked(dependencies.executeAccountLinkLifecycle).mockRejectedValueOnce(new Error("lifecycle unavailable"));

    await expect(executeMcpOAuthProductionActivation(buildInput(enabledConfig(), dependencies))).resolves.toMatchObject({
      allowed: false,
      reason: "account_link_lifecycle_failed",
      safeRefusal: { tokenEchoed: false, authorizationCodeEchoed: false },
    });
    expect(dependencies.providerAdapter.exchangeAuthorizationCode).toHaveBeenCalledTimes(1);
    expect(dependencies.executeAccountLinkLifecycle).toHaveBeenCalledTimes(1);
  });

  it("refuses forged nested provider config without throwing or calling provider ports", async () => {
    const dependencies = buildDependencies();
    const forgedConfig = {
      ...enabledConfig(),
      providerConfig: {
        ...PROVIDER_CONFIG,
        allowedClientIds: 123,
      },
    } as unknown as McpOAuthProductionActivationConfigV1;

    await expect(executeMcpOAuthProductionActivation(buildInput(forgedConfig, dependencies))).resolves.toMatchObject({
      allowed: false,
      reason: "invalid_input",
      safeRefusal: { tokenEchoed: false, authorizationCodeEchoed: false },
    });
    expect(dependencies.providerAdapter.exchangeAuthorizationCode).not.toHaveBeenCalled();
    expect(dependencies.executeAccountLinkLifecycle).not.toHaveBeenCalled();
  });

  it("does not echo authorization code, provider subject, owner id, or token-shaped values", async () => {
    const dependencies = buildDependencies();
    const result = await executeMcpOAuthProductionActivation(buildInput(enabledConfig(), dependencies));
    const serialized = JSON.stringify(result);

    for (const forbidden of [
      FIXTURE_AUTH_CODE,
      FIXTURE_PROVIDER_SUBJECT,
      FIXTURE_OWNER,
      "access_token",
      "refresh_token",
      "id_token",
      "client_secret",
    ] as const) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("does not wire endpoints, frontend, schemas, network calls, or concrete provider SDKs", () => {
    const boundarySource = readFileSync(BOUNDARY_SOURCE, "utf8");
    const viteSource = readFileSync(VITE_CONFIG_SOURCE, "utf8");
    const endpointSource = readFileSync(LOCAL_DEV_ENDPOINT_SOURCE, "utf8");

    expect(viteSource).not.toContain("MCP_OAUTH_PRODUCTION_RUNTIME");
    expect(viteSource).not.toContain("MCP_OAUTH_PRODUCTION_APPROVED");
    expect(endpointSource).not.toContain("MCP_OAUTH_PRODUCTION_RUNTIME");
    expect(endpointSource).not.toContain("MCP_OAUTH_PRODUCTION_APPROVED");
    expect(boundarySource).not.toMatch(/from\s+["']@stytch|from\s+["']node:https|from\s+["']node:http/u);
    expect(boundarySource).not.toMatch(/\bfetch\s*\(|\bXMLHttpRequest\b/u);
    expect(boundarySource).not.toMatch(/defineTable|internalMutation|internalQuery|httpAction/u);
    expect(boundarySource).not.toMatch(/\/oauth\/token|\/oauth\/callback|\/account\/link/u);
    expect(boundarySource).not.toMatch(/\b(?:download|send|submit|apply)\s*\(/u);
  });
});
