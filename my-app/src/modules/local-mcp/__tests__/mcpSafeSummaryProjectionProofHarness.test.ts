// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
  MCP_SAFE_SUMMARY_PROOF_TOOLS,
  runMcpSafeSummaryProjectionProof,
  type McpSafeSummaryIdentityAttestation,
  type McpSafeSummaryProofAdapter,
  type McpSafeSummaryProofEffectObserver,
  type McpSafeSummaryProofEffectSnapshot,
  type McpSafeSummaryProofIdentityRole,
  type McpSafeSummaryProofToolName,
} from "../mcpSafeSummaryProjectionProofHarness";
import {
  MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
} from "../mcpProductionReadonlySummaryProjectorV2";
import { buildMcpProductionToolsListResult } from "../mcpProductionToolsListProjection";

const PRIVATE_SENTINEL = "private-a-only-sentinel";

type MutableEffectSnapshot = {
  -readonly [Key in keyof McpSafeSummaryProofEffectSnapshot]:
    McpSafeSummaryProofEffectSnapshot[Key];
};

type Overrides = Partial<{
  runtimeStarted: boolean;
  toolsList: unknown;
  attestations: readonly McpSafeSummaryIdentityAttestation[];
  seed: unknown;
  cleanup: unknown;
  recovery: unknown;
  throwOnPrepare: boolean;
  effectBaseline: McpSafeSummaryProofEffectSnapshot;
  effectFinal: McpSafeSummaryProofEffectSnapshot;
  sharedMutableEffects: MutableEffectSnapshot;
  mutateEffectsAtCall: number;
  throwEffectSnapshotAt: number;
  callResult: (
    role: McpSafeSummaryProofIdentityRole,
    toolName: McpSafeSummaryProofToolName,
    ordinal: number,
  ) => unknown;
  throwAtCall: number;
}>;

function toolsList() {
  return buildMcpProductionToolsListResult();
}

function attestation(
  role: McpSafeSummaryProofIdentityRole,
  relationToInitialA: McpSafeSummaryIdentityAttestation["relationToInitialA"],
): McpSafeSummaryIdentityAttestation {
  return { role, verified: true, relationToInitialA, version: 1 };
}

function ok(toolName: McpSafeSummaryProofToolName, extraData: Record<string, unknown> = {}) {
  const dataByTool: Record<McpSafeSummaryProofToolName, Record<string, unknown>> = {
    "twoweeks.application_package.summarize": {
      packageStatus: "ready_for_review",
      artifactCount: 2,
      reviewItemCount: 0,
      warningCount: 0,
      blockerCount: 0,
    },
    "twoweeks.evidence_graph.summarize": {
      evidenceCoverage: "complete",
      provenanceCoverage: "complete",
      qualityStatus: "ready_for_review",
      blockerCategory: "none",
      approvedFactCount: 1,
      missingEvidenceCount: 0,
      staleSourceCount: 0,
      blockerCount: 0,
    },
    "twoweeks.resume_variant_plan.summarize": {
      planStatus: "ready_for_review",
      targetDocumentKind: "resume",
      tailoringCompleteness: "complete",
      blockerCategory: "none",
      missingInputCategory: "none",
      planItemCount: 1,
      claimBackedItemCount: 1,
      reviewNeededItemCount: 0,
      blockerCount: 0,
    },
    "twoweeks.review_cockpit.summarize": {
      reviewReadiness: "ready_for_review",
      reviewGateStatus: "ready",
      blockerCategory: "none",
      missingReviewCategory: "none",
      pendingReviewCount: 0,
      approvedReviewCount: 1,
      blockedReviewCount: 0,
      missingReviewItemCount: 0,
      approvalNeeded: false,
      staleData: false,
      overLimit: false,
    },
  };
  return {
    content: [{ type: "text", text: "Read-only summary status: OK." }],
    structuredContent: {
      kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
      status: "OK",
      toolName,
      freshness: "FRESH",
      data: { ...dataByTool[toolName], ...extraData },
      nextActionCode: "ready_for_review",
      version: 2,
    },
  };
}

function noData(
  toolName: McpSafeSummaryProofToolName,
  status: "NO_DATA" | "ONBOARDING_REQUIRED" = "NO_DATA",
) {
  const nextActionByTool: Record<McpSafeSummaryProofToolName, string> = {
    "twoweeks.application_package.summarize": "create_application_package",
    "twoweeks.evidence_graph.summarize": "add_candidate_evidence",
    "twoweeks.resume_variant_plan.summarize": "create_resume_variant_plan",
    "twoweeks.review_cockpit.summarize": "add_application_context",
  };
  return {
    content: [{ type: "text", text: `Read-only summary status: ${status}.` }],
    structuredContent: {
      kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
      status,
      toolName,
      nextActionCode: status === "NO_DATA"
        ? nextActionByTool[toolName]
        : "complete_twoweeks_onboarding",
      version: 2,
    },
  };
}

function makeAdapter(overrides: Overrides = {}) {
  const events: string[] = [];
  const attestations = [...(overrides.attestations ?? [
    attestation("A", "INITIAL"),
    attestation("B", "DISTINCT_FROM_INITIAL_A"),
    attestation("A", "SAME_AS_INITIAL_A"),
  ])];
  let callOrdinal = 0;
  const adapter: McpSafeSummaryProofAdapter = {
    async prepare() {
      events.push("prepare");
      if (overrides.throwOnPrepare) throw new Error("partial startup failure");
      return {
        status: "ready",
        runtimeStarted: overrides.runtimeStarted ?? true,
        version: 1,
      };
    },
    async listTools() {
      events.push("tools/list");
      return overrides.toolsList ?? toolsList();
    },
    async enterIdentity(role) {
      events.push(`identity:${role}`);
      const next = attestations.shift();
      if (!next) throw new Error("missing fixture attestation");
      return next;
    },
    async seedA() {
      events.push("seed:A");
      return overrides.seed ?? {
        status: "ready",
        createdCount: 3,
        reusedCount: 0,
        expectedCount: 3,
        ownerBound: true,
        version: 1,
      };
    },
    async callTool(role, toolName) {
      callOrdinal += 1;
      events.push(`call:${callOrdinal}:${role}:${toolName}`);
      if (overrides.mutateEffectsAtCall === callOrdinal &&
          overrides.sharedMutableEffects) {
        overrides.sharedMutableEffects.modelCallCount += 1;
      }
      if (overrides.throwAtCall === callOrdinal) throw new Error("private raw error");
      return overrides.callResult?.(role, toolName, callOrdinal) ??
        (role === "A" ? ok(toolName) : noData(toolName));
    },
    async cleanupA() {
      events.push("cleanup:A");
      return overrides.cleanup ?? {
        status: "clean",
        deletedCount: 3,
        residualCount: 0,
        expectedCount: 3,
        ownerBound: true,
        version: 1,
      };
    },
    async recover() {
      events.push("recover");
      const recovery = overrides.recovery ?? { status: "recovered", version: 1 };
      return recovery as { status: "recovered"; version: 1 };
    },
  };
  let effectSnapshotOrdinal = 0;
  const zeroEffects: McpSafeSummaryProofEffectSnapshot = {
    retryCount: 0,
    repairCount: 0,
    fallbackCount: 0,
    providerCallCount: 0,
    modelCallCount: 0,
    version: 1,
  };
  const effectObserver: McpSafeSummaryProofEffectObserver = {
    async snapshot() {
      effectSnapshotOrdinal += 1;
      if (overrides.throwEffectSnapshotAt === effectSnapshotOrdinal) {
        throw new Error("effect observer unavailable");
      }
      if (overrides.sharedMutableEffects) return overrides.sharedMutableEffects;
      return effectSnapshotOrdinal === 1
        ? (overrides.effectBaseline ?? zeroEffects)
        : (overrides.effectFinal ?? zeroEffects);
    },
  };
  return { adapter, effectObserver, events };
}

function execute(
  adapter: McpSafeSummaryProofAdapter,
  effectObserver: McpSafeSummaryProofEffectObserver,
  forbiddenSubstrings: readonly string[] = [],
) {
  return runMcpSafeSummaryProjectionProof({
    adapter,
    effectObserver,
    forbiddenSubstrings,
  });
}

describe("runMcpSafeSummaryProjectionProof", () => {
  it("passes exactly one sanitized A→B→A rail", async () => {
    const { adapter, effectObserver, events } = makeAdapter();
    const result = await execute(adapter, effectObserver, [PRIVATE_SENTINEL]);

    expect(result).toMatchObject({
      outcome: "PASS",
      seedCount: 3,
      cleanupCount: 3,
      protectedCallCount: 8,
      retryCount: 0,
      repairCount: 0,
      fallbackCount: 0,
      providerCallCount: 0,
      modelCallCount: 0,
      authTransitionCount: 3,
      toolsListCount: 1,
      recovery: "RECOVERED",
      version: 1,
    });
    expect(result).not.toHaveProperty("stopCode");
    expect(result.calls).toHaveLength(8);
    expect(result.calls.map(({ role, toolName }) => ({ role, toolName }))).toEqual([
      ...MCP_SAFE_SUMMARY_PROOF_TOOLS.map((toolName) => ({ role: "A", toolName })),
      ...MCP_SAFE_SUMMARY_PROOF_TOOLS.map((toolName) => ({ role: "B", toolName })),
    ]);
    expect(events).toEqual([
      "prepare",
      "tools/list",
      "identity:A",
      "seed:A",
      ...MCP_SAFE_SUMMARY_PROOF_TOOLS.map((tool, index) => `call:${index + 1}:A:${tool}`),
      "identity:B",
      ...MCP_SAFE_SUMMARY_PROOF_TOOLS.map((tool, index) => `call:${index + 5}:B:${tool}`),
      "identity:A",
      "cleanup:A",
      "recover",
    ]);
    expect(JSON.stringify(result)).not.toContain(PRIVATE_SENTINEL);
  });

  it.each([
    {
      name: "rejects an unattested initial A without seeding",
      attestations: [{ role: "A", verified: false, relationToInitialA: "INITIAL", version: 1 }],
      stopCode: "IDENTITY_A_NOT_VERIFIED",
      protectedCallCount: 0,
    },
    {
      name: "rejects B when it is not distinct from A",
      attestations: [
        attestation("A", "INITIAL"),
        attestation("B", "SAME_AS_INITIAL_A"),
      ],
      stopCode: "IDENTITY_B_NOT_DISTINCT",
      protectedCallCount: 4,
    },
    {
      name: "rejects a false return to A",
      attestations: [
        attestation("A", "INITIAL"),
        attestation("B", "DISTINCT_FROM_INITIAL_A"),
        attestation("A", "DISTINCT_FROM_INITIAL_A"),
      ],
      stopCode: "IDENTITY_A_RETURN_MISMATCH",
      protectedCallCount: 8,
    },
  ])("$name", async ({ attestations, stopCode, protectedCallCount }) => {
    const { adapter, effectObserver, events } = makeAdapter({
      attestations: attestations as McpSafeSummaryIdentityAttestation[],
    });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode,
      protectedCallCount,
      cleanupCount: protectedCallCount === 0 ? 0 : 3,
      recovery: "RECOVERED",
    });
    expect(events.at(-1)).toBe("recover");
  });

  it("stops before identity and seed when tools/list does not advertise V2", async () => {
    const validTools = toolsList();
    const badTools = {
      tools: [
        { ...validTools.tools[0], outputSchema: { type: "object", oneOf: [] } },
        ...validTools.tools.slice(1),
      ],
    };
    const { adapter, effectObserver, events } = makeAdapter({ toolsList: badTools });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode: "TOOLS_LIST_NOT_V2",
      seedCount: 0,
      protectedCallCount: 0,
      recovery: "RECOVERED",
    });
    expect(events).toEqual(["prepare", "tools/list", "recover"]);
  });

  it("rejects an otherwise valid tools/list with an extra descriptor", async () => {
    const validTools = toolsList();
    const { adapter, effectObserver, events } = makeAdapter({
      toolsList: {
        tools: [
          ...validTools.tools,
          { ...validTools.tools[0], name: "unexpected.tool" },
        ],
      },
    });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode: "TOOLS_LIST_NOT_V2",
      seedCount: 0,
      protectedCallCount: 0,
    });
    expect(events).toEqual(["prepare", "tools/list", "recover"]);
  });

  it("recovers after a prepare failure that may have partially started runtime", async () => {
    const { adapter, effectObserver, events } = makeAdapter({ throwOnPrepare: true });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode: "PREPARE_FAILED",
      seedCount: 0,
      protectedCallCount: 0,
      recovery: "RECOVERED",
    });
    expect(events).toEqual(["prepare", "recover"]);
  });

  it.each([
    {
      name: "wrong seed count",
      seed: {
        status: "ready",
        createdCount: 2,
        reusedCount: 1,
        expectedCount: 3,
        ownerBound: true,
        version: 1,
      },
      stopCode: "SEED_COUNT_MISMATCH",
    },
    {
      name: "wrong cleanup count",
      cleanup: {
        status: "clean",
        deletedCount: 2,
        residualCount: 1,
        expectedCount: 3,
        ownerBound: true,
        version: 1,
      },
      stopCode: "CLEANUP_COUNT_MISMATCH",
    },
  ])("stops and recovers on $name", async ({ seed, cleanup, stopCode }) => {
    const { adapter, effectObserver, events } = makeAdapter({ seed, cleanup });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode,
      recovery: "RECOVERED",
    });
    expect(events).toContain("cleanup:A");
    expect(events.at(-1)).toBe("recover");
  });

  it("counts one failed protected attempt without retry and then contains it", async () => {
    const { adapter, effectObserver, events } = makeAdapter({ throwAtCall: 2 });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode: "PROTECTED_CALL_FAILED",
      protectedCallCount: 2,
      retryCount: 0,
      cleanupCount: 3,
      recovery: "RECOVERED",
    });
    expect(events.filter((event) => event.startsWith("call:"))).toHaveLength(2);
    expect(events.slice(-2)).toEqual(["cleanup:A", "recover"]);
  });

  it.each([
    {
      name: "V1 envelope",
      expectedStop: "RESULT_ENVELOPE_MISMATCH",
      result: (toolName: McpSafeSummaryProofToolName) => ({
        structuredContent: {
          kind: MCP_PRODUCTION_READONLY_SUMMARY_RESULT_KIND_V2,
          status: "OK",
          toolName,
          freshness: "FRESH",
          data: { count: 1 },
          nextActionCode: "ready_for_review",
          version: 1,
        },
      }),
    },
    {
      name: "wrong tool envelope",
      expectedStop: "RESULT_ENVELOPE_MISMATCH",
      result: () => ok("twoweeks.review_cockpit.summarize"),
    },
    {
      name: "duplicate V2 envelope",
      expectedStop: "RESULT_ENVELOPE_MISMATCH",
      result: (toolName: McpSafeSummaryProofToolName) => ({
        first: ok(toolName).structuredContent,
        second: ok(toolName).structuredContent,
      }),
    },
    {
      name: "V2-like envelope with an out-of-schema data field",
      expectedStop: "RESULT_ENVELOPE_MISMATCH",
      result: (toolName: McpSafeSummaryProofToolName) =>
        ok(toolName, { unexpectedCount: 1 }),
    },
    {
      name: "forbidden private sentinel",
      expectedStop: "RESULT_FORBIDDEN_CONTENT",
      result: (toolName: McpSafeSummaryProofToolName) =>
        ok(toolName, { note: PRIVATE_SENTINEL }),
    },
    {
      name: "non-canonical model-visible text without a configured sentinel",
      expectedStop: "RESULT_ENVELOPE_MISMATCH",
      result: (toolName: McpSafeSummaryProofToolName) => ({
        ...ok(toolName),
        content: [{ type: "text", text: "Jane Doe, +33 6 00 00 00 00" }],
      }),
    },
    {
      name: "forbidden token-shaped key",
      expectedStop: "RESULT_FORBIDDEN_CONTENT",
      result: (toolName: McpSafeSummaryProofToolName) =>
        ok(toolName, { accessToken: "not-a-real-value" }),
    },
  ])("rejects $name without retaining raw content", async ({
    result,
    expectedStop,
  }) => {
    const { adapter, effectObserver, events } = makeAdapter({
      callResult: (_role, toolName) => result(toolName),
    });
    const ledger = await execute(adapter, effectObserver, [PRIVATE_SENTINEL]);
    expect(ledger).toMatchObject({
      outcome: "STOPPED",
      stopCode: expectedStop,
      protectedCallCount: 1,
      cleanupCount: 3,
      recovery: "RECOVERED",
    });
    expect(JSON.stringify(ledger)).not.toContain(PRIVATE_SENTINEL);
    expect(JSON.stringify(ledger)).not.toContain("not-a-real-value");
    expect(events.slice(-2)).toEqual(["cleanup:A", "recover"]);
  });

  it("rejects data-bearing B output as a privacy failure", async () => {
    const { adapter, effectObserver } = makeAdapter({
      callResult: (role, toolName) => role === "A" ? ok(toolName) : ok(toolName),
    });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode: "RESULT_STATUS_REJECTED",
      protectedCallCount: 5,
      cleanupCount: 3,
      recovery: "RECOVERED",
    });
  });

  it("requires at least one data-bearing OK result for A", async () => {
    const { adapter, effectObserver } = makeAdapter({
      callResult: (_role, toolName) => noData(toolName),
    });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode: "A_DATA_PROOF_MISSING",
      protectedCallCount: 4,
      cleanupCount: 3,
      recovery: "RECOVERED",
    });
  });

  it("reports failed recovery without retrying it", async () => {
    const { adapter, effectObserver, events } = makeAdapter({
      recovery: { status: "not-recovered", version: 1 },
    });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode: "RECOVERY_FAILED",
      protectedCallCount: 8,
      cleanupCount: 3,
      recovery: "FAILED",
    });
    expect(events.filter((event) => event === "recover")).toHaveLength(1);
  });

  it("does not call recover when prepare attests that no runtime was started", async () => {
    const { adapter, effectObserver, events } = makeAdapter({ runtimeStarted: false });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({ outcome: "PASS", recovery: "NOT_REQUIRED" });
    expect(events).not.toContain("recover");
  });

  it("fails closed when the independent effect observer records any retry", async () => {
    const { adapter, effectObserver } = makeAdapter({
      effectFinal: {
        retryCount: 1,
        repairCount: 0,
        fallbackCount: 0,
        providerCallCount: 0,
        modelCallCount: 0,
        version: 1,
      },
    });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode: "EFFECT_BUDGET_EXCEEDED",
      protectedCallCount: 8,
      retryCount: 1,
      repairCount: 0,
      fallbackCount: 0,
      providerCallCount: 0,
      modelCallCount: 0,
      cleanupCount: 3,
      recovery: "RECOVERED",
    });
  });

  it("copies a reused mutable effect snapshot before the adapter can mutate it", async () => {
    const sharedMutableEffects: MutableEffectSnapshot = {
      retryCount: 0,
      repairCount: 0,
      fallbackCount: 0,
      providerCallCount: 0,
      modelCallCount: 0,
      version: 1,
    };
    const { adapter, effectObserver } = makeAdapter({
      sharedMutableEffects,
      mutateEffectsAtCall: 1,
    });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode: "EFFECT_BUDGET_EXCEEDED",
      protectedCallCount: 8,
      modelCallCount: 1,
      cleanupCount: 3,
      recovery: "RECOVERED",
    });
  });

  it("stops before prepare when the independent effect baseline is unavailable", async () => {
    const { adapter, effectObserver, events } = makeAdapter({
      throwEffectSnapshotAt: 1,
    });
    const result = await execute(adapter, effectObserver);
    expect(result).toMatchObject({
      outcome: "STOPPED",
      stopCode: "EFFECT_OBSERVER_FAILED",
      seedCount: 0,
      protectedCallCount: 0,
      recovery: "NOT_REQUIRED",
    });
    expect(events).toEqual([]);
  });
});
