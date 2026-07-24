import type {
  McpSafeSummaryProofEffectObserver,
  McpSafeSummaryProofEffectSnapshot,
} from "./mcpSafeSummaryProjectionProofHarness";

export type McpSafeSummaryProofEffectKind =
  | "retry"
  | "repair"
  | "fallback"
  | "provider"
  | "model";

type MutableCounters = {
  retryCount: number;
  repairCount: number;
  fallbackCount: number;
  providerCallCount: number;
  modelCallCount: number;
};

export type McpSafeSummaryProofEffectLedgerV1 = Readonly<{
  observer: McpSafeSummaryProofEffectObserver;
  record: (kind: McpSafeSummaryProofEffectKind) => void;
  recordSummaryQuery: () => void;
  observedEventCount: () => number;
}>;

/**
 * A separate monotonic ledger for effects observed at the execution boundary.
 * The proof harness receives only its observer; the runner retains the writer.
 */
export function createMcpSafeSummaryProofEffectLedger(): McpSafeSummaryProofEffectLedgerV1 {
  const counters: MutableCounters = {
    retryCount: 0,
    repairCount: 0,
    fallbackCount: 0,
    providerCallCount: 0,
    modelCallCount: 0,
  };
  let observedEvents = 0;

  const record = (kind: McpSafeSummaryProofEffectKind): void => {
    observedEvents += 1;
    switch (kind) {
      case "retry":
        counters.retryCount += 1;
        return;
      case "repair":
        counters.repairCount += 1;
        return;
      case "fallback":
        counters.fallbackCount += 1;
        return;
      case "provider":
        counters.providerCallCount += 1;
        return;
      case "model":
        counters.modelCallCount += 1;
        return;
    }
  };

  const recordSummaryQuery = (): void => {
    observedEvents += 1;
  };

  const observer: McpSafeSummaryProofEffectObserver = Object.freeze({
    independence: "separate_monotonic_ledger" as const,
    snapshot: async (): Promise<McpSafeSummaryProofEffectSnapshot> =>
      Object.freeze({ ...counters, version: 1 as const }),
  });

  return Object.freeze({
    observer,
    record,
    recordSummaryQuery,
    observedEventCount: () => observedEvents,
  });
}
