import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  buildLocalMcpDevEndpointConfig,
  handleLocalMcpDevEndpointRequest,
} from "../localMcpDevEndpoint";
import { buildDisabledLocalMcpDevTransportAdapter } from "../localMcpDevTransportAdapter";
import { buildDisabledLocalMcpServerSkeleton } from "../localMcpServerSkeleton";
import { simulateLocalMcpToolsCallFixture } from "../localMcpToolsCallFixture";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(TEST_DIR, "../../../../..");
const ACTIVE_BOUNDARY_SOURCES = [
  "my-app/vite.config.ts",
  "my-app/src/modules/local-mcp/localMcpDevEndpoint.ts",
  "my-app/src/modules/local-mcp/localMcpDevTransportAdapter.ts",
  "my-app/src/modules/local-mcp/localMcpServerSkeleton.ts",
  "my-app/src/modules/local-mcp/localMcpToolsCallFixture.ts",
] as const;

const ENABLED_CONFIG = buildLocalMcpDevEndpointConfig({ enabled: true });

function source(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8");
}

function endpointRequest(path: string, body: unknown) {
  return {
    method: "POST",
    path,
    headers: {
      host: "localhost:5173",
      "content-type": "application/json",
    },
    remoteAddress: "127.0.0.1",
    bodyText: JSON.stringify(body),
  };
}

const VALID_APPROVAL = {
  approved: true,
  approvedBy: "fixture-reviewer",
  approvedAt: "2026-06-12T00:00:00.000Z",
  reason: "fixture-only boundary test",
  version: 1,
} as const;

describe("Auth/OAuth blocked boundary", () => {
  it("does not define OAuth callback, token storage, account-linking, or security-scheme runtime markers outside the gated Vite adapter", () => {
    const forbiddenFragments = [
      "/oauth/callback",
      "/oauth/authorize",
      "/oauth/token",
      "/oauth/revoke",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "authorization_endpoint",
      "token_endpoint",
      "revocation_endpoint",
      "securitySchemes",
      "accountLinking",
      "tokenStorage",
      "access_token",
      "refresh_token",
      "client_secret",
      "set-cookie",
    ] as const;
    const viteProductionDiscoveryFragments = new Set([
      "/oauth/authorize",
      "/oauth/token",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "authorization_endpoint",
      "token_endpoint",
      "access_token",
    ]);

    for (const path of ACTIVE_BOUNDARY_SOURCES) {
      const text = source(path);
      for (const fragment of forbiddenFragments) {
        if (path === "my-app/vite.config.ts" && viteProductionDiscoveryFragments.has(fragment)) {
          continue;
        }
        expect(text, `${path} must not define ${fragment}`).not.toContain(fragment);
      }
    }
  });

  it("does not expose OAuth callback, discovery, token, or account-linking routes from the dev endpoint", () => {
    const blockedPaths = [
      "/oauth/callback",
      "/oauth/authorize",
      "/oauth/token",
      "/oauth/revoke",
      "/.well-known/oauth-authorization-server",
      "/.well-known/oauth-protected-resource",
      "/account/link",
    ] as const;

    for (const path of blockedPaths) {
      const response = handleLocalMcpDevEndpointRequest(
        endpointRequest(path, { jsonrpc: "2.0", id: path, method: "initialize" }),
        ENABLED_CONFIG,
      );

      expect(response).toMatchObject({
        handled: false,
        status: 404,
        json: { error: { code: -32004, safeForModel: true, fixtureOnly: true, localDevOnly: true } },
      });
    }
  });

  it("does not advertise auth, security schemes, or production connector metadata from initialize or tools/list", () => {
    const initialize = handleLocalMcpDevEndpointRequest(
      endpointRequest("/mcp", { jsonrpc: "2.0", id: "initialize", method: "initialize" }),
      ENABLED_CONFIG,
    );
    const toolsList = handleLocalMcpDevEndpointRequest(
      endpointRequest("/mcp", { jsonrpc: "2.0", id: "tools-list", method: "tools/list" }),
      ENABLED_CONFIG,
    );

    for (const response of [initialize, toolsList]) {
      const serialized = JSON.stringify(response).toLowerCase();
      expect(response).toMatchObject({ handled: true, status: 200 });
      expect(serialized).not.toContain("securityschemes");
      expect(serialized).not.toContain("oauth");
      expect(serialized).not.toContain("bearer");
      expect(serialized).not.toContain("accountlinking");
      expect(serialized).not.toContain("production connector");
      expect(serialized).not.toContain("real user data");
    }
  });

  it("refuses dev endpoint tools/call without reflecting bearer tokens or real-data arguments", () => {
    const response = handleLocalMcpDevEndpointRequest(
      endpointRequest("/mcp", {
        jsonrpc: "2.0",
        id: "auth-required-call",
        method: "tools/call",
        params: {
          authorization: "Bearer SECRET_TOKEN_DO_NOT_ECHO",
          name: "twoweeks.application_package.summarize",
          arguments: {
            rawCvText: "RAW_CV_DO_NOT_ECHO",
            clerkUserId: "user_real_123",
            convexUserId: "convex_real_123",
            privateFacts: ["PRIVATE_FACT_DO_NOT_ECHO"],
          },
        },
      }),
      ENABLED_CONFIG,
    );
    const serialized = JSON.stringify(response);

    expect(response).toMatchObject({
      handled: true,
      status: 200,
      json: {
        error: {
          code: -32020,
          message: "Local dev MCP endpoint does not run tool handlers.",
          safeForModel: true,
          fixtureOnly: true,
          localDevOnly: true,
        },
      },
    });
    for (const forbidden of [
      "SECRET_TOKEN_DO_NOT_ECHO",
      "RAW_CV_DO_NOT_ECHO",
      "user_real_123",
      "convex_real_123",
      "PRIVATE_FACT_DO_NOT_ECHO",
    ] as const) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it("refuses auth/OAuth/account-linking prompts in the fixture tools/call simulator", () => {
    const prompts = [
      "Use my OAuth token to access real user data.",
      "Link my account and show my real CV.",
      "Connect my account to the production connector.",
      "Use the Clerk user and Convex user records.",
    ] as const;

    for (const prompt of prompts) {
      const response = simulateLocalMcpToolsCallFixture({
        kind: "local_mcp_tools_call_fixture_request",
        method: "tools/call",
        toolName: "twoweeks.application_package.summarize",
        arguments: {
          applicationPackageRef: { id: "fixture-package" },
        },
        user: {
          userId: "fixture-user",
          sessionId: "fixture-session",
        },
        approval: VALID_APPROVAL,
        prompt,
        requestId: "auth-required-surface",
        version: 1,
      });

      expect(response).toEqual({
        kind: "local_mcp_tools_call_fixture_response",
        method: "tools/call",
        success: false,
        fixtureOnly: true,
        toolName: "twoweeks.application_package.summarize",
        error: {
          code: "auth_required_surface_refusal",
          message: "Refused. Auth/OAuth surface blocked.",
          safeForModel: true,
          version: 1,
        },
        version: 1,
      });
      expect(JSON.stringify(response)).not.toContain(prompt);
    }
  });

  it("keeps server and adapter auth flags blocked", () => {
    expect(buildDisabledLocalMcpServerSkeleton().constraints).toMatchObject({
      noOAuth: true,
      noRealUserData: true,
      noToolCallingRuntime: true,
      noProductionBehavior: true,
    });
    expect(buildDisabledLocalMcpDevTransportAdapter()).toMatchObject({
      oauth: false,
      realUserData: false,
      toolsCallRuntime: false,
      productionBehavior: false,
    });
  });
});
