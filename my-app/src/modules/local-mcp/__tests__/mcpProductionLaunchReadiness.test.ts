// @vitest-environment node
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  evaluateMcpProductionLaunchReadiness,
  type McpProductionLaunchReadinessDecisionCodeV1,
  type McpProductionLaunchReadinessEvidenceInputV1,
} from "../mcpProductionLaunchReadiness";
import type { McpProductionPrivateBetaGateDecisionV1 } from "../mcpProductionPrivateBetaGate";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SOURCE_FILE = resolve(TEST_DIR, "../mcpProductionLaunchReadiness.ts");
const FORBIDDEN_READINESS_LAYER_PATTERNS = Object.freeze([
  /mcpOAuthProductionRouteAdapter/u,
  /mcpProductionPolicyKernel/u,
  /mcpProductionTools(?:CallBoundary|ListProjection)/u,
  /mcpLocalJsonSchemaMatcher/u,
  /buildMcpJsonRpcError|jsonResponse|failClosedResponse/u,
  /\b(?:fetch|axios|XMLHttpRequest|WebSocket|EventSource)\b/u,
  /\b(?:insert|patch|replace|delete)\s*\(/u,
] as const);

describe("MCP production launch readiness", () => {
  it("does not block private beta access when launch readiness config is missing", () => {
    const decision = evaluateMcpProductionLaunchReadiness({
      privateBetaDecision: allowedPrivateBetaDecision(),
    });

    expectLaunchReadinessDecision(decision, "launch_config_missing", true);
  });

  it("fails the public launch decision closed for malformed launch config", () => {
    expectLaunchReadinessDecision(
      evaluateMcpProductionLaunchReadiness({
        privateBetaDecision: allowedPrivateBetaDecision(),
        config: { publicLaunchRequested: true, rawConfig: "Bearer secret" },
      }),
      "launch_config_invalid",
      true,
    );
    expectLaunchReadinessDecision(
      evaluateMcpProductionLaunchReadiness({
        privateBetaDecision: allowedPrivateBetaDecision(),
        config: { evidence: { privateBetaGateReviewed: "yes" } },
      }),
      "launch_config_invalid",
      true,
    );
  });

  it("keeps public launch blocked when readiness evidence is missing or incomplete", () => {
    expectLaunchReadinessDecision(
      evaluateMcpProductionLaunchReadiness({
        privateBetaDecision: allowedPrivateBetaDecision(),
        config: { version: 1 },
      }),
      "launch_evidence_missing",
      true,
    );
    expectLaunchReadinessDecision(
      evaluateMcpProductionLaunchReadiness({
        privateBetaDecision: allowedPrivateBetaDecision(),
        config: {
          evidence: completeEvidence({ schemaMatcherReviewed: false }),
          version: 1,
        },
      }),
      "launch_evidence_missing",
      true,
    );
  });

  it("blocks public launch even when complete readiness evidence requests it", () => {
    expectLaunchReadinessDecision(
      evaluateMcpProductionLaunchReadiness({
        privateBetaDecision: allowedPrivateBetaDecision(),
        config: {
          publicLaunchRequested: true,
          evidence: completeEvidence(),
          version: 1,
        },
      }),
      "public_launch_blocked",
      true,
    );
  });

  it("records private beta readiness separately from public launch exposure", () => {
    expectLaunchReadinessDecision(
      evaluateMcpProductionLaunchReadiness({
        privateBetaDecision: allowedPrivateBetaDecision(),
        config: {
          publicLaunchRequested: false,
          evidence: completeEvidence(),
          version: 1,
        },
      }),
      "private_beta_ready_public_launch_blocked",
      true,
    );
  });

  it("does not mark launch readiness when private beta eligibility has not allowed access", () => {
    expectLaunchReadinessDecision(
      evaluateMcpProductionLaunchReadiness({
        privateBetaDecision: deniedPrivateBetaDecision(),
        config: {
          publicLaunchRequested: true,
          evidence: completeEvidence(),
          version: 1,
        },
      }),
      "private_beta_not_ready",
      false,
    );
  });

  it("stays isolated from route, policy, schema, tool, provider, and response layers", () => {
    const source = readFileSync(SOURCE_FILE, "utf8");

    expect(source).toContain("from \"./mcpProductionPrivateBetaGate\"");
    expect(source).toContain("function readLaunchReadinessConfig");
    expect(source).toContain("function isCompleteLaunchReadinessEvidence");
    for (const pattern of FORBIDDEN_READINESS_LAYER_PATTERNS) {
      expect(source).not.toMatch(pattern);
    }
  });
});

function expectLaunchReadinessDecision(
  decision: ReturnType<typeof evaluateMcpProductionLaunchReadiness>,
  code: McpProductionLaunchReadinessDecisionCodeV1,
  privateBetaAccessAllowed: boolean,
) {
  expect(decision).toEqual({
    kind: "mcp_production_launch_readiness_decision",
    privateBetaAccessAllowed,
    publicLaunchAllowed: false,
    publicLaunchBlocked: true,
    code,
    safeForModel: true,
    inputEchoed: false,
    configEchoed: false,
    evidenceEchoed: false,
    methodPolicyDecision: false,
    responseConstructed: false,
    toolValidation: false,
    schemaValidation: false,
    providerCalled: false,
    storageWritten: false,
    version: 1,
  });
}

function allowedPrivateBetaDecision(): McpProductionPrivateBetaGateDecisionV1 {
  return Object.freeze({
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
}

function deniedPrivateBetaDecision(): McpProductionPrivateBetaGateDecisionV1 {
  return Object.freeze({
    kind: "mcp_production_private_beta_gate_decision",
    allowed: false,
    code: "private_beta_subject_not_allowed",
    safeForModel: true,
    inputEchoed: false,
    configEchoed: false,
    methodPolicyDecision: false,
    responseConstructed: false,
    version: 1,
  });
}

function completeEvidence(
  overrides: Partial<McpProductionLaunchReadinessEvidenceInputV1> = {},
): McpProductionLaunchReadinessEvidenceInputV1 {
  return {
    privateBetaGateReviewed: true,
    authenticatedMcpProtocolReviewed: true,
    policyKernelReviewed: true,
    toolsListMetadataReviewed: true,
    toolsCallReadOnlyReviewed: true,
    schemaMatcherReviewed: true,
    providerWriteExpansionBlocked: true,
    unresolvedBlockingFindings: false,
    version: 1,
    ...overrides,
  };
}
