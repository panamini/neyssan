import type { McpSafeSummaryLiveAdapterResultV8 } from "./mcpSafeSummaryLiveAdapter";

export const MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OPERATOR_PAGE_PATH =
  "/debug/mcp-safe-summary-proof-operator" as const;

export const MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OPERATOR_TOKEN_PATH =
  "/__twoweeks/mcp-safe-summary-proof/operator-token" as const;

export type McpSafeSummaryProofOperatorRole = "A" | "B";

const SAFE_OPERATOR_TOKEN_PATTERN = /^[A-Za-z0-9._-]{20,8192}$/u;
const SAFE_PROOF_SESSION_ID_PATTERN = /^[A-Za-z0-9_-]{16,128}$/u;

export function normalizeMcpSafeSummaryOperatorToken(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  const token = trimmed.replace(/^Bearer\s+/u, "");
  return SAFE_OPERATOR_TOKEN_PATTERN.test(token) ? token : undefined;
}

export function normalizeMcpSafeSummaryProofSessionId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const sessionId = value.trim();
  return SAFE_PROOF_SESSION_ID_PATTERN.test(sessionId) ? sessionId : undefined;
}

export function createMcpSafeSummaryProofSessionId(): string {
  return globalThis.crypto.randomUUID().replace(/-/gu, "");
}

/**
 * Keep the sanitized proof sequence addressable at the response root as well
 * as under `proof`. This makes the operator page resilient to a transport
 * layer that projects nested proof fields while preserving the full proof.
 */
export function buildMcpSafeSummaryProofOperatorResponse(
  result: McpSafeSummaryLiveAdapterResultV8,
): Readonly<Record<string, unknown>> {
  return Object.freeze({
    kind: "mcp_safe_summary_controlled_proof_operator_response",
    status: result.sequenceCompleted ? "completed" : "stopped",
    contractId: result.contractId,
    contractVersion: result.contractVersion,
    completed: result.completed,
    sequenceCompleted: result.sequenceCompleted,
    liveCalls: result.liveCalls,
    proof: result.proof,
    sequence: result.proof.sequence,
    safeForModel: true,
    version: 1,
  });
}
