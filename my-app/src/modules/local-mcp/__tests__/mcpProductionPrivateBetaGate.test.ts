// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../mcpAuthPolicyBoundary";
import {
  buildMcpAuthenticatedProtocolEnvelope,
  parseMcpJsonRpcProtocolMessage,
} from "../mcpAuthenticatedProtocolEnvelope";
import {
  evaluateMcpProductionPrivateBetaGate,
  type McpProductionPrivateBetaGateConfigInputV1,
} from "../mcpProductionPrivateBetaGate";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpProductionPrivateBetaGate.ts");
const CLIENT_ID = "chatgpt_apps_sdk_client";
const RESOURCE = "https://mcp.twoweeks.example.test/resource";
const SUBJECT_ID = "user_twoweeks_fixture_123";
const NOW = Date.parse("2026-06-30T20:00:00.000Z");
const FORBIDDEN_GATE_LAYER_PATTERNS = Object.freeze([
  /mcpOAuthProductionRouteAdapter/u,
  /mcpProductionPolicyKernel/u,
  /mcpProductionTools(?:CallBoundary|ListProjection)/u,
  /buildMcpJsonRpcError|jsonResponse|failClosedResponse/u,
  /\b(?:fetch|axios|XMLHttpRequest|WebSocket|EventSource)\b/u,
  /\b(?:insert|patch|replace|delete)\s*\(/u,
] as const);

describe("MCP production private beta gate", () => {
  it("defaults to denied when private beta config is missing or disabled", () => {
    expect(evaluateMcpProductionPrivateBetaGate({ envelope: envelope() })).toMatchObject({
      allowed: false,
      code: "private_beta_missing_config",
      safeForModel: true,
      responseConstructed: false,
      methodPolicyDecision: false,
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      config: { enabled: false },
    })).toMatchObject({
      allowed: false,
      code: "private_beta_disabled",
    });
  });

  it("fails closed for malformed config and empty enabled allowlists", () => {
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      config: { enabled: "1" } as never,
    })).toMatchObject({
      allowed: false,
      code: "private_beta_malformed_config",
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      config: { enabled: true, allowedClientIds: [], allowedResources: [RESOURCE] },
    })).toMatchObject({
      allowed: false,
      code: "private_beta_empty_allowlist",
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      config: {
        enabled: true,
        allowedClientIds: [CLIENT_ID],
        allowedResources: [RESOURCE],
        allowedSubjectIds: [],
      },
    })).toMatchObject({
      allowed: false,
      code: "private_beta_empty_allowlist",
    });
  });

  it("allows matching client and resource without constructing responses or policy decisions", () => {
    const decision = evaluateMcpProductionPrivateBetaGate({
      envelope: envelope("twoweeks.unreviewed.future_method"),
      config: betaConfig(),
    });

    expect(decision).toEqual({
      kind: "mcp_production_private_beta_gate_decision",
      allowed: true,
      code: "private_beta_allowed",
      safeForModel: true,
      inputEchoed: false,
      configEchoed: false,
      methodPolicyDecision: false,
      responseConstructed: false,
      version: 1,
    });
  });

  it("denies non-allowlisted client, resource, or subject without echoing inputs", () => {
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope("initialize", { verifiedClientId: "other_client" }),
      config: betaConfig(),
    })).toMatchObject({
      allowed: false,
      code: "private_beta_client_not_allowed",
      inputEchoed: false,
      configEchoed: false,
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope("initialize", { verifiedResource: "https://other.example.test/resource" }),
      config: betaConfig(),
    })).toMatchObject({
      allowed: false,
      code: "private_beta_resource_not_allowed",
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      verifiedSubjectId: "other_user",
      config: betaConfig({ allowedSubjectIds: [SUBJECT_ID] }),
    })).toMatchObject({
      allowed: false,
      code: "private_beta_subject_not_allowed",
    });
  });

  it("uses a subject allowlist only when it is configured and fails ambiguous subject state closed", () => {
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      verifiedSubjectId: SUBJECT_ID,
      config: betaConfig({ allowedSubjectIds: [SUBJECT_ID] }),
    })).toMatchObject({
      allowed: true,
      code: "private_beta_allowed",
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      config: betaConfig({ allowedSubjectIds: [SUBJECT_ID] }),
    })).toMatchObject({
      allowed: false,
      code: "private_beta_ambiguous_eligibility",
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      verifiedSubjectId: "user\nunsafe",
      config: betaConfig(),
    })).toMatchObject({
      allowed: false,
      code: "private_beta_ambiguous_eligibility",
    });
  });

  it("keeps eligibility evaluation separate from route, policy, execution, and response construction layers", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    expect(source).toContain("from \"./mcpAuthenticatedProtocolEnvelope\"");
    expect(source).toContain("function readPrivateBetaConfig");
    expect(source).toContain("function isSafeEligibilityEnvelope");
    for (const pattern of FORBIDDEN_GATE_LAYER_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });
});

function betaConfig(
  overrides: Partial<McpProductionPrivateBetaGateConfigInputV1> = {},
): McpProductionPrivateBetaGateConfigInputV1 {
  return {
    enabled: true,
    allowedClientIds: [CLIENT_ID],
    allowedResources: [RESOURCE],
    ...overrides,
  };
}

function envelope(
  method = "initialize",
  overrides: Partial<Parameters<typeof buildMcpAuthenticatedProtocolEnvelope>[0]> = {},
) {
  const message = parseMcpJsonRpcProtocolMessage(JSON.stringify({
    jsonrpc: "2.0",
    id: method,
    method,
    params: {},
  }));
  if (!message) throw new Error("fixture JSON-RPC should parse");
  return buildMcpAuthenticatedProtocolEnvelope({
    verifiedClientId: CLIENT_ID,
    verifiedResource: RESOURCE,
    verifiedScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
    accessTokenExpiresAt: NOW + 60 * 60 * 1_000,
    callerKey: "198.51.100.9",
    jsonRpcMessage: message,
    createdAt: NOW,
    ...overrides,
  });
}
