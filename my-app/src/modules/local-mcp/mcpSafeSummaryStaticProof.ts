const MCP_SAFE_SUMMARY_STATIC_PROOF_KIND = "STATIC_PROOF" as const;

export type McpSafeSummaryStaticProofV1 = Readonly<{
  kind: typeof MCP_SAFE_SUMMARY_STATIC_PROOF_KIND;
  exactQueryKindCount: 4;
  prohibitedEffects: Readonly<{
    retry: "ABSENT";
    repair: "ABSENT";
    fallback: "ABSENT";
    provider: "ABSENT";
    model: "ABSENT";
  }>;
  runtimeObservation: "NOT_OBSERVED";
  version: 1;
}>;

export const MCP_SAFE_SUMMARY_STATIC_PROOF: McpSafeSummaryStaticProofV1 = Object.freeze({
  kind: MCP_SAFE_SUMMARY_STATIC_PROOF_KIND,
  exactQueryKindCount: 4,
  prohibitedEffects: Object.freeze({
    retry: "ABSENT" as const,
    repair: "ABSENT" as const,
    fallback: "ABSENT" as const,
    provider: "ABSENT" as const,
    model: "ABSENT" as const,
  }),
  runtimeObservation: "NOT_OBSERVED" as const,
  version: 1 as const,
});
