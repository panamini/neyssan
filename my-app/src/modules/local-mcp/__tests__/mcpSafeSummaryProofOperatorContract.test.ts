import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildMcpSafeSummaryProofOperatorResponse,
  createMcpSafeSummaryProofSessionId,
  normalizeMcpSafeSummaryOperatorToken,
  normalizeMcpSafeSummaryProofSessionId,
} from "../mcpSafeSummaryProofOperatorContract";
import { MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT } from "../mcpSafeSummaryProjectionProofHarness";
import {
  formatMcpSafeSummaryFirstToolsCallDiagnostic,
  formatMcpSafeSummaryPostSeedDeltaDiagnostic,
} from "../../../pages/McpSafeSummaryProofOperatorPage";

const TOKEN = "eyJ" + "a".repeat(80) + ".payload.signature";

describe("mcp safe-summary operator credential transport", () => {
  it("accepts a raw bearer and an optional Bearer prefix without returning the prefix", () => {
    expect(normalizeMcpSafeSummaryOperatorToken(TOKEN)).toBe(TOKEN);
    expect(normalizeMcpSafeSummaryOperatorToken(`Bearer ${TOKEN}`)).toBe(TOKEN);
  });

  it("rejects malformed, short, whitespace-containing, and oversized values", () => {
    expect(normalizeMcpSafeSummaryOperatorToken("short")).toBeUndefined();
    expect(normalizeMcpSafeSummaryOperatorToken(`${TOKEN} extra`)).toBeUndefined();
    expect(normalizeMcpSafeSummaryOperatorToken(`${"a".repeat(8193)}`)).toBeUndefined();
    expect(normalizeMcpSafeSummaryOperatorToken(undefined)).toBeUndefined();
  });

  it("accepts only bounded URL-safe proof session identifiers", () => {
    expect(normalizeMcpSafeSummaryProofSessionId("proof_session_20260728")).toBe(
      "proof_session_20260728",
    );
    expect(normalizeMcpSafeSummaryProofSessionId("short")).toBeUndefined();
    expect(normalizeMcpSafeSummaryProofSessionId("proof session 20260728")).toBeUndefined();
    expect(normalizeMcpSafeSummaryProofSessionId("a".repeat(129))).toBeUndefined();
  });

  it("creates a valid session identifier for the role-A handoff link", () => {
    expect(normalizeMcpSafeSummaryProofSessionId(
      createMcpSafeSummaryProofSessionId(),
    )).toMatch(/^[a-f0-9]{32}$/u);
  });

  it("keeps the sanitized sequence available at the response root and under proof", () => {
    const sequence = {
      outcome: "STOPPED" as const,
      stopCode: "SEED_FAILED" as const,
      protectedCallCount: 0,
      seedCount: 0,
      cleanupCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
      recovery: "RECOVERED" as const,
      baseline: "ACCEPTED" as const,
      postSeedDelta: "REJECTED" as const,
      version: 1 as const,
    };
    const result = buildMcpSafeSummaryProofOperatorResponse({
      contractId: "CC-20260724-mcp-safe-summary-live-adapter",
      contractVersion: 8,
      completed: false,
      sequenceCompleted: false,
      liveCalls: false,
      proof: {
        sequence,
        effectObservation: {
          retry: "NOT_OBSERVED",
          repair: "NOT_OBSERVED",
          fallback: "NOT_OBSERVED",
          provider: "NOT_OBSERVED",
          model: "NOT_OBSERVED",
          version: 1,
        },
        staticProof: {
          kind: "STATIC_ONLY",
          exactQueryKindCount: 4,
          runtimeObservation: "NOT_OBSERVED",
          version: 1,
        },
        version: 8,
      },
      version: 1,
    });
    expect(result.proof).toMatchObject({ sequence });
    expect(result.sequence).toEqual(sequence);
    expect(result.safeForModel).toBe(true);
  });

  it("renders the current controlled fixture count for seed and cleanup", () => {
    const pageSource = readFileSync(
      resolve(process.cwd(), "src/pages/McpSafeSummaryProofOperatorPage.tsx"),
      "utf8",
    );
    expect(pageSource).toContain(
      'seed=${seedCount ?? "?"}/${MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT}',
    );
    expect(pageSource).toContain(
      'cleanup=${cleanupCount ?? "?"}/${MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT}',
    );
    expect(pageSource).toContain("Ouvrir ou copier le lien opérateur B");
    expect(pageSource).toContain('params.set("proofSession", proofSessionId)');
  });

  it("renders only the bounded first-call classification fields", () => {
    const sensitive = "raw-bearer-or-private-identity-sentinel";
    const rendered = formatMcpSafeSummaryFirstToolsCallDiagnostic({
      kind: "mcp_safe_summary_first_tools_call_diagnostic",
      step: "FIRST_TOOLS_CALL",
      failureKind: "ROUTE_REJECTED",
      httpStatus: 403,
      publicReason: "invalid_host",
      message: sensitive,
      bearer: sensitive,
      version: 1,
    });

    expect(rendered).toBe("ROUTE_REJECTED/HTTP_403/invalid_host");
    expect(rendered).not.toContain(sensitive);
    expect(formatMcpSafeSummaryFirstToolsCallDiagnostic({
      kind: "mcp_safe_summary_first_tools_call_diagnostic",
      step: "FIRST_TOOLS_CALL",
      failureKind: "JSON_RPC_ERROR",
      httpStatus: 400,
      jsonRpcCode: -32_600,
      errorMessage: sensitive,
      version: 1,
    })).toBe("JSON_RPC_ERROR/HTTP_400/JSONRPC_-32600");
  });

  it("renders only allowlisted post-seed delta fields", () => {
    const sensitive = "raw-summary-or-private-reference-sentinel";
    const rendered = formatMcpSafeSummaryPostSeedDeltaDiagnostic({
      kind: "mcp_safe_summary_post_seed_delta_diagnostic",
      step: "POST_SEED_DELTA",
      check: "COUNT_DELTA",
      role: "A",
      toolName: "twoweeks.evidence_graph.summarize",
      countKey: "sourceDocuments",
      expected: 1,
      actual: 2,
      safeForLogging: true,
      rawSummary: sensitive,
      refId: sensitive,
      version: 1,
    });

    expect(rendered).toBe(
      "COUNT_DELTA/A/twoweeks.evidence_graph.summarize/sourceDocuments/expected_1/actual_2",
    );
    expect(rendered).not.toContain(sensitive);
    expect(formatMcpSafeSummaryPostSeedDeltaDiagnostic({
      kind: "mcp_safe_summary_post_seed_delta_diagnostic",
      step: "POST_SEED_DELTA",
      check: "COUNT_DELTA",
      role: "A",
      toolName: "twoweeks.evidence_graph.summarize",
      countKey: "not_allowlisted",
      expected: 1,
      actual: 2,
      safeForLogging: true,
      version: 1,
    })).toBeUndefined();
    expect(formatMcpSafeSummaryPostSeedDeltaDiagnostic({
      kind: "mcp_safe_summary_post_seed_delta_diagnostic",
      step: "POST_SEED_DELTA",
      check: "SNAPSHOT_SHAPE",
      role: "B",
      toolName: "twoweeks.review_cockpit.summarize",
      safeForLogging: true,
      rawSummary: sensitive,
      version: 1,
    })).toBe(
      "SNAPSHOT_SHAPE/B/twoweeks.review_cockpit.summarize",
    );
  });
});
