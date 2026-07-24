import {
  MCP_SAFE_SUMMARY_PROOF_TOOLS,
  runMcpSafeSummaryProjectionProof,
  type McpSafeSummaryProofLedger,
} from "./mcpSafeSummaryProjectionProofHarness";
import {
  buildMcpProductionReadonlySummaryExecutor,
  type McpProductionReadonlySummaryQueryPortV1,
} from "./mcpProductionReadonlySummaryExecutor";
import {
  buildMcpSafeSummaryServerSession,
  type McpSafeSummaryServerIdentityResolverV1,
  type McpSafeSummaryServerReferenceResolverV1,
  type McpSafeSummaryServerRuntimePortV1,
  type McpSafeSummaryServerSeedPortV1,
  type McpSafeSummaryServerCleanupPortV1,
} from "./mcpSafeSummaryServerSession";
import {
  createMcpSafeSummaryProofEffectLedger,
  type McpSafeSummaryProofEffectLedgerV1,
} from "./mcpSafeSummaryProofEffectLedger";

export const MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_ID =
  "CC-20260724-mcp-safe-summary-live-adapter" as const;
export const MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_VERSION = 4 as const;
export const MCP_SAFE_SUMMARY_CONTROLLED_PROOF_FLAG =
  "MCP_SAFE_SUMMARY_CONTROLLED_PROOF" as const;
export const MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH =
  "/__twoweeks/mcp-safe-summary-proof" as const;

export type McpSafeSummaryControlledProofActivationV1 = Readonly<{
  environment: "development";
  enabled: boolean;
  contractId: typeof MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_ID;
  contractVersion: typeof MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_VERSION;
}>;

export type McpSafeSummaryControlledProofRunnerInputV1 = Readonly<{
  activation: McpSafeSummaryControlledProofActivationV1;
  resolveIdentity: McpSafeSummaryServerIdentityResolverV1;
  resolveReference: McpSafeSummaryServerReferenceResolverV1;
  runQuery: McpProductionReadonlySummaryQueryPortV1;
  seedA: McpSafeSummaryServerSeedPortV1;
  cleanupA: McpSafeSummaryServerCleanupPortV1;
  runtime: McpSafeSummaryServerRuntimePortV1;
  nowEpochMs?: () => number;
  forbiddenSubstrings?: readonly string[];
}>;

export type McpSafeSummaryControlledProofResultV1 = Readonly<{
  contractId: typeof MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_ID;
  contractVersion: typeof MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_VERSION;
  completed: boolean;
  liveCalls: boolean;
  proof: McpSafeSummaryProofLedger;
  version: 1;
}>;

export type McpSafeSummaryControlledProofRunnerV1 = Readonly<{
  run: () => Promise<McpSafeSummaryControlledProofResultV1>;
}>;

export function buildMcpSafeSummaryControlledProofActivation(
  env: Readonly<Record<string, string | undefined>>,
): McpSafeSummaryControlledProofActivationV1 | undefined {
  if (env.NODE_ENV !== "development" || env[MCP_SAFE_SUMMARY_CONTROLLED_PROOF_FLAG] !== "1") {
    return undefined;
  }
  return Object.freeze({
    environment: "development" as const,
    enabled: true,
    contractId: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_ID,
    contractVersion: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_VERSION,
  });
}

export function buildMcpSafeSummaryControlledProofRunner(
  input: McpSafeSummaryControlledProofRunnerInputV1,
): McpSafeSummaryControlledProofRunnerV1 | undefined {
  if (!isExactActivation(input.activation)) return undefined;

  return Object.freeze({
    run: async (): Promise<McpSafeSummaryControlledProofResultV1> => {
      const effectLedger: McpSafeSummaryProofEffectLedgerV1 =
        createMcpSafeSummaryProofEffectLedger();
      const executeSummary = buildMcpProductionReadonlySummaryExecutor(async (queryInput) => {
        effectLedger.recordSummaryQuery();
        return input.runQuery(queryInput);
      });
      const session = buildMcpSafeSummaryServerSession({
        resolveIdentity: input.resolveIdentity,
        resolveReference: input.resolveReference,
        executeSummary,
        seedA: input.seedA,
        cleanupA: input.cleanupA,
        runtime: input.runtime,
        nowEpochMs: input.nowEpochMs,
      });
      const proof = await runMcpSafeSummaryProjectionProof({
        adapter: session.adapter,
        effectObserver: effectLedger.observer,
        forbiddenSubstrings: input.forbiddenSubstrings,
      });
      const completed = proof.outcome === "PASS" &&
        proof.protectedCallCount === MCP_SAFE_SUMMARY_PROOF_TOOLS.length * 2 &&
        proof.seedCount === 3 &&
        proof.cleanupCount === 3 &&
        proof.recovery === "RECOVERED";
      return Object.freeze({
        contractId: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_ID,
        contractVersion: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_VERSION,
        completed,
        liveCalls: proof.protectedCallCount > 0,
        proof,
        version: 1,
      });
    },
  });
}

function isExactActivation(
  activation: McpSafeSummaryControlledProofActivationV1,
): boolean {
  return activation.environment === "development" &&
    activation.enabled === true &&
    activation.contractId === MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_ID &&
    activation.contractVersion === MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_VERSION;
}
