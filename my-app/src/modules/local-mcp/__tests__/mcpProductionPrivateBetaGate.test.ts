// @vitest-environment node
import { createHash } from "node:crypto";
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
const SUBJECT_DIGEST = sha256Hex(SUBJECT_ID);
const OTHER_SUBJECT_DIGEST = sha256Hex("other_user");
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
    const sparseSubjectDigests = new Array<string>(2);
    sparseSubjectDigests[0] = SUBJECT_DIGEST;
    const iteratorMaskedSubjectDigests = [SUBJECT_DIGEST, "not-a-digest"];
    Object.defineProperty(iteratorMaskedSubjectDigests, Symbol.iterator, {
      value: function* maskedIterator() {
        yield SUBJECT_DIGEST;
      },
    });
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
        allowedSubjectDigests: [],
      },
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
      },
    })).toMatchObject({
      allowed: false,
      code: "private_beta_malformed_config",
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      verifiedSubjectDigest: SUBJECT_DIGEST,
      config: betaConfig({ allowedSubjectDigests: ["A".repeat(64)] }),
    })).toMatchObject({
      allowed: false,
      code: "private_beta_malformed_config",
    });
    for (const allowedSubjectDigests of [
      [` ${SUBJECT_DIGEST}`],
      [`${SUBJECT_DIGEST} `],
      [SUBJECT_DIGEST, ""],
      sparseSubjectDigests,
      iteratorMaskedSubjectDigests,
    ]) {
      expect(evaluateMcpProductionPrivateBetaGate({
        envelope: envelope(),
        verifiedSubjectDigest: SUBJECT_DIGEST,
        config: betaConfig({ allowedSubjectDigests }),
      })).toMatchObject({
        allowed: false,
        code: "private_beta_malformed_config",
      });
    }
  });

  it("allows matching client, resource, and subject digest without constructing responses", () => {
    const decision = evaluateMcpProductionPrivateBetaGate({
      envelope: envelope("twoweeks.unreviewed.future_method"),
      verifiedSubjectDigest: SUBJECT_DIGEST,
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
      verifiedSubjectDigest: SUBJECT_DIGEST,
      config: betaConfig(),
    })).toMatchObject({
      allowed: false,
      code: "private_beta_client_not_allowed",
      inputEchoed: false,
      configEchoed: false,
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope("initialize", { verifiedResource: "https://other.example.test/resource" }),
      verifiedSubjectDigest: SUBJECT_DIGEST,
      config: betaConfig(),
    })).toMatchObject({
      allowed: false,
      code: "private_beta_resource_not_allowed",
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      verifiedSubjectDigest: OTHER_SUBJECT_DIGEST,
      config: betaConfig(),
    })).toMatchObject({
      allowed: false,
      code: "private_beta_subject_not_allowed",
    });
  });

  it("requires a subject digest allowlist and fails ambiguous subject state closed", () => {
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      verifiedSubjectDigest: SUBJECT_DIGEST,
      config: betaConfig({ allowedSubjectDigests: [OTHER_SUBJECT_DIGEST, SUBJECT_DIGEST] }),
    })).toMatchObject({
      allowed: true,
      code: "private_beta_allowed",
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      config: betaConfig(),
    })).toMatchObject({
      allowed: false,
      code: "private_beta_ambiguous_eligibility",
    });
    expect(evaluateMcpProductionPrivateBetaGate({
      envelope: envelope(),
      verifiedSubjectDigest: "not-a-digest",
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
    allowedSubjectDigests: [SUBJECT_DIGEST],
    ...overrides,
  };
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
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
