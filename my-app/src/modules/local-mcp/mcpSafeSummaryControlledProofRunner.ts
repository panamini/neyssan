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
  type McpSafeSummaryServerIdentityV1,
} from "./mcpSafeSummaryServerSession";
import { MCP_PRODUCTION_OPERATION_TIMEOUT_MS } from "./mcpProductionOperationTimeout";
import {
  MCP_SAFE_SUMMARY_STATIC_PROOF,
  type McpSafeSummaryStaticProofV1,
} from "./mcpSafeSummaryStaticProof";

const MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_ID =
  "CC-20260724-mcp-safe-summary-live-adapter" as const;
const MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_VERSION = 6 as const;
const MCP_SAFE_SUMMARY_CONTROLLED_PROOF_FLAG =
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
  seedA: (identity: McpSafeSummaryServerIdentityV1, runId: string) => Promise<unknown>;
  cleanupA: (identity: McpSafeSummaryServerIdentityV1, runId: string) => Promise<unknown>;
  runtime: McpSafeSummaryServerRuntimePortV1;
  nowEpochMs?: () => number;
  forbiddenSubstrings?: readonly string[];
}>;

function createRunIdentifier(): string {
  return `mcp-safe-summary-run-${globalThis.crypto.randomUUID()}`;
}

export type McpSafeSummaryControlledProofEffectObservationV5 = Readonly<{
  retry: "NOT_OBSERVED";
  repair: "NOT_OBSERVED";
  fallback: "NOT_OBSERVED";
  provider: "NOT_OBSERVED";
  model: "NOT_OBSERVED";
  version: 1;
}>;

export type McpSafeSummaryControlledProofReportV5 = Readonly<{
  sequence: Readonly<{
    outcome: McpSafeSummaryProofLedger["outcome"];
    stopCode?: McpSafeSummaryProofLedger["stopCode"];
    seedCount: number;
    cleanupCount: number;
    protectedCallCount: number;
    authTransitionCount: number;
    toolsListCount: number;
    recovery: McpSafeSummaryProofLedger["recovery"];
    calls: McpSafeSummaryProofLedger["calls"];
    version: 1;
  }>;
  effectObservation: McpSafeSummaryControlledProofEffectObservationV5;
  staticProof: McpSafeSummaryStaticProofV1;
  version: 5;
}>;

export type McpSafeSummaryControlledProofResultV5 = Readonly<{
  contractId: typeof MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_ID;
  contractVersion: typeof MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_VERSION;
  completed: boolean;
  liveCalls: boolean;
  proof: McpSafeSummaryControlledProofReportV5;
  version: 1;
}>;

export type McpSafeSummaryControlledProofRunnerV1 = Readonly<{
  run: () => Promise<McpSafeSummaryControlledProofResultV5>;
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
    run: async (): Promise<McpSafeSummaryControlledProofResultV5> => {
      const runId = createRunIdentifier();
      const executeSummary = buildMcpProductionReadonlySummaryExecutor((queryInput) =>
        withSharedTimeout(() => input.runQuery(queryInput))
      );
      const session = buildMcpSafeSummaryServerSession({
        resolveIdentity: (role) => withSharedTimeout(() => input.resolveIdentity(role)),
        resolveReference: (identity, toolName) =>
          withSharedTimeout(() => input.resolveReference(identity, toolName)),
        executeSummary,
        seedA: (identity) => withSettledMutationTimeout(() => input.seedA(identity, runId)),
        cleanupA: (identity) => withSettledMutationTimeout(() => input.cleanupA(identity, runId)),
        runtime: {
          start: () => withSharedTimeout(() => input.runtime.start()),
          recoverOldRuntime: () =>
            withSettledMutationTimeout(() => input.runtime.recoverOldRuntime()),
        },
        nowEpochMs: input.nowEpochMs,
      });
      const proof = await runMcpSafeSummaryProjectionProof({
        adapter: session.adapter,
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
        proof: projectV5Report(proof),
        version: 1,
      });
    },
  });
}

function projectV5Report(
  proof: McpSafeSummaryProofLedger,
): McpSafeSummaryControlledProofReportV5 {
  return Object.freeze({
    sequence: Object.freeze({
      outcome: proof.outcome,
      ...(proof.stopCode ? { stopCode: proof.stopCode } : {}),
      seedCount: proof.seedCount,
      cleanupCount: proof.cleanupCount,
      protectedCallCount: proof.protectedCallCount,
      authTransitionCount: proof.authTransitionCount,
      toolsListCount: proof.toolsListCount,
      recovery: proof.recovery,
      calls: proof.calls,
      version: 1 as const,
    }),
    effectObservation: Object.freeze({
      retry: "NOT_OBSERVED" as const,
      repair: "NOT_OBSERVED" as const,
      fallback: "NOT_OBSERVED" as const,
      provider: "NOT_OBSERVED" as const,
      model: "NOT_OBSERVED" as const,
      version: 1 as const,
    }),
    staticProof: MCP_SAFE_SUMMARY_STATIC_PROOF,
    version: 5 as const,
  });
}

function withSharedTimeout<T>(operation: () => Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("mcp_operation_timeout")), MCP_PRODUCTION_OPERATION_TIMEOUT_MS);
    operation().then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("mcp_operation_failed"));
      },
    );
  });
}

async function withSettledMutationTimeout<T>(
  operation: () => Promise<T>,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const settlement = Promise.resolve()
    .then(operation)
    .then(
      (value) => Object.freeze({ status: "fulfilled" as const, value }),
      (error: unknown) => Object.freeze({
        status: "rejected" as const,
        error: error instanceof Error ? error : new Error("mcp_operation_failed"),
      }),
    );
  const timeout = new Promise<Readonly<{ status: "timeout" }>>((resolve) => {
    timer = setTimeout(
      () => resolve(Object.freeze({ status: "timeout" as const })),
      MCP_PRODUCTION_OPERATION_TIMEOUT_MS,
    );
  });
  const first = await Promise.race([settlement, timeout]);
  if (timer !== undefined) clearTimeout(timer);
  if (first.status === "fulfilled") return first.value;
  if (first.status === "rejected") throw first.error;

  await settlement;
  throw new Error("mcp_operation_timeout");
}

function isExactActivation(
  activation: McpSafeSummaryControlledProofActivationV1,
): boolean {
  return activation.environment === "development" &&
    activation.enabled === true &&
    activation.contractId === MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_ID &&
    activation.contractVersion === MCP_SAFE_SUMMARY_CONTROLLED_PROOF_CONTRACT_VERSION;
}
