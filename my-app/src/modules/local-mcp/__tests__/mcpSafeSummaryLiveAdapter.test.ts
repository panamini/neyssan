// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import { createLocalMcpDevEndpointPlugin } from "../../../../vite.config";
import {
  buildMcpSafeSummaryControlledProofActivation,
  buildMcpSafeSummaryControlledProofRunner,
  MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH,
} from "../mcpSafeSummaryControlledProofRunner";
import { MCP_PRODUCTION_OPERATION_TIMEOUT_MS } from "../mcpProductionOperationTimeout";
import { createMcpSafeSummaryProofEffectLedger } from "../mcpSafeSummaryProofEffectLedger";
import { MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5 } from "../mcpSafeSummaryProofMarker";
import type { McpSafeSummaryProofToolName } from "../mcpSafeSummaryProjectionProofHarness";
import type { McpSafeSummaryServerIdentityV1 } from "../mcpSafeSummaryServerSession";

const OWNER_A = {
  subject: "subject_A",
  issuer: "https://issuer-a.example.test",
  ownerProfileId: "profile_A",
  version: 1 as const,
};
const OWNER_B = {
  subject: "subject_B",
  issuer: "https://issuer-b.example.test",
  ownerProfileId: "profile_B",
  version: 1 as const,
};

const SAFE_REFS: Record<McpSafeSummaryProofToolName, string> = {
  "twoweeks.application_package.summarize": "mcp-safe-ref:application-package:latest",
  "twoweeks.evidence_graph.summarize": "mcp-safe-ref:evidence-graph:profile",
  "twoweeks.resume_variant_plan.summarize": "mcp-safe-ref:resume-variant-plan:latest",
  "twoweeks.review_cockpit.summarize": "mcp-safe-ref:review-cockpit:latest",
};

const CONVEX_SUMMARY_STRUCTURAL_EXPECTATIONS = [
  {
    fileName: "mcpApplicationPackageSummary.ts",
    internalFunctionName: "internalSummarizeMcpApplicationPackage",
    summarizeFunctionName: "summarizeMcpApplicationPackage",
    dataReads: "convex_application_package_summary",
  },
  {
    fileName: "mcpEvidenceGraphSummary.ts",
    internalFunctionName: "internalSummarizeMcpEvidenceGraph",
    summarizeFunctionName: "summarizeMcpEvidenceGraph",
    dataReads: "convex_evidence_graph_summary",
  },
  {
    fileName: "mcpResumeVariantPlanSummary.ts",
    internalFunctionName: "internalSummarizeMcpResumeVariantPlan",
    summarizeFunctionName: "summarizeMcpResumeVariantPlan",
    dataReads: "convex_resume_variant_plan_summary",
  },
  {
    fileName: "mcpReviewCockpitSummary.ts",
    internalFunctionName: "internalSummarizeMcpReviewCockpit",
    summarizeFunctionName: "summarizeMcpReviewCockpit",
    dataReads: "convex_review_cockpit_summary",
  },
] as const;

const BLOCKED_CAPABILITIES = [
  "dataWrites",
  "handlerExecution",
  "productionConnector",
  "networkAccess",
  "modelCalls",
  "writeActions",
  "rawDataProjection",
] as const;

const PROHIBITED_IMPORT_PATTERN =
  /\b(?:retry|repair|fallback|provider|model)\b/iu;
const PROHIBITED_CALL_PATTERN =
  /\b(?:retry|repair|fallback|provider|model)\w*\s*\(/iu;

function readSourceBetween(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Structural proof anchor missing: ${startMarker} -> ${endMarker}`);
  }
  return source.slice(start, end);
}

function queryResult(
  toolName: McpSafeSummaryProofToolName,
  status: "available" | "no_data_available",
) {
  const category = toolName.split(".")[1].replace("_", "_");
  const updatedAt = "2026-07-24T00:00:00.000Z";
  const kindByTool = {
    "twoweeks.application_package.summarize": "mcp_application_package_summary_result",
    "twoweeks.evidence_graph.summarize": "mcp_evidence_graph_summary_result",
    "twoweeks.resume_variant_plan.summarize": "mcp_resume_variant_plan_summary_result",
    "twoweeks.review_cockpit.summarize": "mcp_review_cockpit_summary_result",
  } as const;
  const refKeyByTool = {
    "twoweeks.application_package.summarize": "packageRef",
    "twoweeks.evidence_graph.summarize": "evidenceGraphRef",
    "twoweeks.resume_variant_plan.summarize": "resumeVariantPlanRef",
    "twoweeks.review_cockpit.summarize": "reviewCockpitRef",
  } as const;
  const dataReadsByTool = {
    "twoweeks.application_package.summarize": "convex_application_package_summary",
    "twoweeks.evidence_graph.summarize": "convex_evidence_graph_summary",
    "twoweeks.resume_variant_plan.summarize": "convex_resume_variant_plan_summary",
    "twoweeks.review_cockpit.summarize": "convex_review_cockpit_summary",
  } as const;
  const refKey = refKeyByTool[toolName];
  return {
    kind: kindByTool[toolName],
    allowed: true,
    status,
    [refKey]: {
      id: SAFE_REFS[toolName],
      label: "Safe summary reference",
      status,
      category,
      count: 1,
      updatedAt,
      version: 1,
    },
    availability: {
      source: dataReadsByTool[toolName],
      ownerState: "resolved",
      version: 1,
    },
    safeCounts: safeCountsByTool[toolName],
    safeCategories: safeCategoriesByTool[toolName],
    capabilities: {
      ownerResolution: "server_only",
      dataReads: dataReadsByTool[toolName],
      dataWrites: "blocked",
      handlerExecution: "blocked",
      productionConnector: "blocked",
      networkAccess: "blocked",
      modelCalls: "blocked",
      writeActions: "blocked",
      rawDataProjection: "blocked",
      version: 1,
    },
    ...(toolName === "twoweeks.review_cockpit.summarize"
      ? { safeFlags: { approvalNeeded: false, staleData: false, overLimit: false, version: 1 } }
      : {}),
    updatedAt,
    modelVisible: true,
    version: 1,
  };
}

const safeCountsByTool: Record<McpSafeSummaryProofToolName, Readonly<Record<string, number>>> = {
  "twoweeks.application_package.summarize": {
    packages: 1,
    artifacts: 1,
    provenanceLinks: 1,
    reviewItems: 0,
    warnings: 0,
    blockers: 0,
    version: 1,
  },
  "twoweeks.evidence_graph.summarize": {
    sourceDocuments: 1,
    candidateFacts: 1,
    approvedFacts: 1,
    pendingFacts: 0,
    rejectedFacts: 0,
    restrictedEvidence: 0,
    archivedEvidence: 0,
    provenanceLinks: 1,
    evidenceMatches: 1,
    allowedClaims: 1,
    missingEvidence: 0,
    riskFlags: 0,
    staleSources: 0,
    warnings: 0,
    blockers: 0,
    version: 1,
  },
  "twoweeks.resume_variant_plan.summarize": {
    plans: 1,
    planItems: 1,
    claimBackedItems: 1,
    missingInputItems: 0,
    reviewNeededItems: 0,
    acceptedItems: 1,
    rejectedItems: 0,
    blockedItems: 0,
    warnings: 0,
    blockers: 0,
    restrictedFactBlockers: 0,
    excludedFactBlockers: 0,
    artifactTextBlockers: 0,
    allowedClaims: 1,
    sourceFacts: 1,
    evidenceMatches: 1,
    demands: 1,
    riskFlags: 0,
    version: 1,
  },
  "twoweeks.review_cockpit.summarize": {
    reviewContexts: 1,
    reviewRuns: 1,
    reviewArtifacts: 1,
    applicationPackages: 1,
    pendingReviews: 0,
    approvedReviews: 1,
    blockedReviews: 0,
    failedRuns: 0,
    blockedRuns: 0,
    blockedArtifacts: 0,
    blockedPackages: 0,
    missingReviewItems: 0,
    approvalNeeded: 0,
    staleInputs: 0,
    overLimitCollections: 0,
    version: 1,
  },
};

const safeCategoriesByTool: Record<McpSafeSummaryProofToolName, Readonly<Record<string, string | number>>> = {
  "twoweeks.application_package.summarize": {
    packageStatus: "ready_for_review",
    version: 1,
  },
  "twoweeks.evidence_graph.summarize": {
    evidenceCoverage: "complete",
    provenanceCoverage: "complete",
    qualityStatus: "ready_for_review",
    blockerCategory: "none",
    version: 1,
  },
  "twoweeks.resume_variant_plan.summarize": {
    planStatus: "ready_for_review",
    targetDocumentKind: "resume",
    tailoringCompleteness: "complete",
    blockerCategory: "none",
    missingInputCategory: "none",
    version: 1,
  },
  "twoweeks.review_cockpit.summarize": {
    reviewReadiness: "ready_for_review",
    reviewGateStatus: "ready",
    blockerCategory: "none",
    missingReviewCategory: "none",
    version: 1,
  },
};

function runnerFor(resolveIdentity: (
  role: "A" | "B",
) => Promise<McpSafeSummaryServerIdentityV1>, options: {
  seedA?: (identity: McpSafeSummaryServerIdentityV1) => Promise<unknown>;
  cleanupA?: (identity: McpSafeSummaryServerIdentityV1) => Promise<unknown>;
  recoverOldRuntime?: () => Promise<boolean>;
} = {}) {
  const calls: string[] = [];
  const protectedSubjects: string[] = [];
  let activeSubject: string | undefined;
  const runner = buildMcpSafeSummaryControlledProofRunner({
    activation: {
      environment: "development",
      enabled: true,
      contractId: "CC-20260724-mcp-safe-summary-live-adapter",
      contractVersion: 5,
    },
    resolveIdentity: async (role) => {
      const identity = await resolveIdentity(role);
      activeSubject = identity.subject;
      return identity;
    },
    resolveReference: async (_identity, toolName) => ({ id: SAFE_REFS[toolName] }),
    runQuery: async (input) => {
      calls.push(input.query);
      if (activeSubject !== undefined) protectedSubjects.push(activeSubject);
      const toolName = Object.entries(SAFE_REFS).find(([, id]) =>
        JSON.stringify(input.args).includes(id),
      )?.[0] as McpSafeSummaryProofToolName | undefined;
      if (!toolName) throw new Error("missing resolved reference");
      return queryResult(toolName, calls.length <= 4 ? "available" : "no_data_available");
    },
    seedA: options.seedA ?? (async () => ({
      status: "ready",
      createdCount: 3,
      reusedCount: 0,
      expectedCount: 3,
      ownerBound: true,
      version: 1,
    })),
    cleanupA: options.cleanupA ?? (async () => ({
      status: "clean",
      deletedCount: 3,
      residualCount: 0,
      expectedCount: 3,
      ownerBound: true,
      version: 1,
    })),
    runtime: {
      start: async () => true,
      recoverOldRuntime: options.recoverOldRuntime ?? (async () => true),
    },
  });
  return { runner, calls, protectedSubjects };
}

describe("v5 controlled MCP safe-summary adapter", () => {
  it("wires the normal Vite composition only for the explicit development contract", () => {
    const activePlugin = createLocalMcpDevEndpointPlugin({ env: controlledProofEnv() });
    expect(activePlugin).toBeDefined();

    const middleware = configuredMiddleware(activePlugin);
    const response = {
      statusCode: undefined as number | undefined,
      setHeader: vi.fn(),
      end: vi.fn(),
    };
    middleware(
      { method: "GET", url: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH },
      response,
      vi.fn(),
    );
    expect(response.statusCode).toBe(405);
    expect(response.end).toHaveBeenCalledTimes(1);

    expect(createLocalMcpDevEndpointPlugin({ env: {} })).toBeUndefined();
    const productionPlugin = createLocalMcpDevEndpointPlugin({
      env: {
        ...controlledProofEnv(),
        NODE_ENV: "production",
        MCP_OAUTH_PRODUCTION_ROUTE_WIRING: "1",
      },
    });
    expect(productionPlugin).toBeDefined();
    const productionNext = vi.fn();
    configuredMiddleware(productionPlugin)(
      { method: "POST", url: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH },
      { setHeader: vi.fn(), end: vi.fn() },
      productionNext,
    );
    expect(productionNext).toHaveBeenCalledTimes(1);
  });

  it("requires development plus the exact explicit contract flag", () => {
    expect(buildMcpSafeSummaryControlledProofActivation({})).toBeUndefined();
    expect(buildMcpSafeSummaryControlledProofActivation({
      NODE_ENV: "test",
      MCP_SAFE_SUMMARY_CONTROLLED_PROOF: "1",
    })).toBeUndefined();
    expect(buildMcpSafeSummaryControlledProofActivation({
      NODE_ENV: "development",
      MCP_SAFE_SUMMARY_CONTROLLED_PROOF: "1",
    })).toMatchObject({
      enabled: true,
      contractId: "CC-20260724-mcp-safe-summary-live-adapter",
      contractVersion: 5,
    });
  });

  it("keeps STATIC_PROOF separate from runtime observation", () => {
    const executorSource = readFileSync(
      new URL("../mcpProductionReadonlySummaryExecutor.ts", import.meta.url),
      "utf8",
    );
    const executorPath = executorSource.slice(
      executorSource.indexOf("export function buildMcpProductionReadonlySummaryExecutor"),
      executorSource.indexOf("function buildConvexSummaryArgs"),
    );
    expect(executorPath.match(/runQuery\(/gu)).toHaveLength(1);
    expect(executorPath).not.toMatch(/\b(?:retry|repair|fallback|provider|model)\b/iu);
    expect(executorPath).not.toMatch(/(?:retry|repair|fallback|provider|model)\s*\(/iu);
    const viteSource = readFileSync(
      new URL("../../../../vite.config.ts", import.meta.url),
      "utf8",
    );
    const queryPortPath = viteSource.slice(
      viteSource.indexOf("function buildProductionReadonlySummaryQueryPort"),
      viteSource.indexOf("function buildProductionMcpSafeSummaryControlledProofRunner"),
    );
    expect(queryPortPath.match(/convexClient\.query\(/gu)).toHaveLength(1);
    expect(queryPortPath).not.toMatch(/\b(?:retry|repair|fallback|provider|model)\b/iu);

    for (const expectation of CONVEX_SUMMARY_STRUCTURAL_EXPECTATIONS) {
      const convexSource = readFileSync(
        new URL(`../../../../convex/${expectation.fileName}`, import.meta.url),
        "utf8",
      );
      const importLines = convexSource
        .split("\n")
        .filter((line) => line.trimStart().startsWith("import "))
        .join("\n");
      expect(importLines).not.toMatch(PROHIBITED_IMPORT_PATTERN);

      const internalFunctionPath = readSourceBetween(
        convexSource,
        `export const ${expectation.internalFunctionName}`,
        `async function ${expectation.summarizeFunctionName}`,
      );
      expect(internalFunctionPath).toContain("internalQuery(");
      expect(internalFunctionPath).toContain(`summarize${expectation.internalFunctionName.slice("internalSummarize".length)}(`);

      const exactQueryPath = readSourceBetween(
        convexSource,
        `export const ${expectation.internalFunctionName}`,
        "function buildCapabilities(",
      );
      expect(exactQueryPath).toContain("capabilities: buildCapabilities(");
      expect(exactQueryPath).not.toMatch(PROHIBITED_CALL_PATTERN);

      const capabilitiesPath = readSourceBetween(
        convexSource,
        "function buildCapabilities(",
        "\nfunction zeroCounts(",
      );
      expect(capabilitiesPath).toContain(`dataReads: "${expectation.dataReads}"`);
      for (const capability of BLOCKED_CAPABILITIES) {
        expect(capabilitiesPath).toContain(`${capability}: "blocked"`);
      }
    }
  });

  it("executes the real executor path with exactly A to B to A and honest completion", async () => {
    const identities: Array<"A" | "B"> = [];
    const { runner, calls } = runnerFor(async (role) => {
      identities.push(role);
      return role === "B" ? OWNER_B : OWNER_A;
    });
    expect(runner).toBeDefined();
    const result = await runner!.run();

    expect(result.completed).toBe(true);
    expect(result.liveCalls).toBe(true);
    expect(result.proof).toMatchObject({
      sequence: {
        outcome: "PASS",
        protectedCallCount: 8,
        seedCount: 3,
        cleanupCount: 3,
        recovery: "RECOVERED",
      },
    });
    expect(result.proof.effectObservation).toEqual({
      retry: "NOT_OBSERVED",
      repair: "NOT_OBSERVED",
      fallback: "NOT_OBSERVED",
      provider: "NOT_OBSERVED",
      model: "NOT_OBSERVED",
      version: 1,
    });
    expect(result.proof.staticProof).toMatchObject({
      kind: "STATIC_PROOF",
      exactQueryKindCount: 4,
      runtimeObservation: "NOT_OBSERVED",
    });
    expect(identities).toEqual(["A", "B", "A"]);
    expect(calls).toHaveLength(8);
    expect(JSON.stringify(result)).not.toContain("subject_A");
    expect(JSON.stringify(result)).not.toContain("profile_A");
    expect(JSON.stringify(result)).not.toContain("subject_B");
    expect(JSON.stringify(result)).not.toContain("profile_B");
  });

  it("does not expose the deterministic recovery marker in the operator response", async () => {
    const { runner } = runnerFor(async (role) => role === "B" ? OWNER_B : OWNER_A);
    const plugin = createLocalMcpDevEndpointPlugin({
      env: controlledProofEnv(),
      controlledSummaryProofRunner: runner,
      productionOAuthAuthorizationDependencies: operatorAuthDependencies(),
    });
    const response = responseCapture();
    configuredMiddleware(plugin)(
      {
        method: "POST",
        url: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH,
        headers: { authorization: "Bearer fixture" },
      } as never,
      response,
      vi.fn(),
    );
    await response.done;

    expect(response.statusCode).toBe(200);
    expect(response.body()).not.toContain(MCP_SAFE_SUMMARY_CONTROLLED_PROOF_MARKER_V5);
  });

  it("fails closed before runner or seed when bearer auth is missing or not A", async () => {
    const { runner, calls } = runnerFor(async (role) => role === "B" ? OWNER_B : OWNER_A);
    const noBearerPlugin = createLocalMcpDevEndpointPlugin({
      env: controlledProofEnv(),
      controlledSummaryProofRunner: runner,
      productionOAuthAuthorizationDependencies: operatorAuthDependencies(),
    });
    const noBearerResponse = responseCapture();
    configuredMiddleware(noBearerPlugin)(
      { method: "POST", url: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH, headers: {} } as never,
      noBearerResponse,
      vi.fn(),
    );
    await noBearerResponse.done;
    expect(noBearerResponse.statusCode).toBe(401);
    expect(calls).toHaveLength(0);

    const wrongOwnerResponse = responseCapture();
    const wrongOwnerPlugin = createLocalMcpDevEndpointPlugin({
      env: controlledProofEnv(),
      controlledSummaryProofRunner: runner,
      productionOAuthAuthorizationDependencies: operatorAuthDependencies(OWNER_B),
    });
    configuredMiddleware(wrongOwnerPlugin)(
      { method: "POST", url: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH, headers: { authorization: "Bearer fixture" } } as never,
      wrongOwnerResponse,
      vi.fn(),
    );
    await wrongOwnerResponse.done;
    expect(wrongOwnerResponse.statusCode).toBe(401);
    expect(calls).toHaveLength(0);
  });

  it("stops before B protected calls when the server resolves the same identity", async () => {
    const { runner, calls, protectedSubjects } = runnerFor(async () => OWNER_A);
    const result = await runner!.run();
    expect(result.completed).toBe(false);
    expect(result.liveCalls).toBe(true);
    expect(result.proof).toMatchObject({
      sequence: {
        outcome: "STOPPED",
        stopCode: "IDENTITY_B_NOT_DISTINCT",
        protectedCallCount: 4,
        cleanupCount: 3,
        recovery: "RECOVERED",
      },
    });
    expect(calls).toHaveLength(4);
    expect(protectedSubjects).toEqual([OWNER_A.subject, OWNER_A.subject, OWNER_A.subject, OWNER_A.subject]);
  });

  it("stops before B protected calls when owner profile matches despite a different issuer", async () => {
    const ownerB = {
      ...OWNER_B,
      issuer: "https://issuer-b-different.example.test",
      ownerProfileId: OWNER_A.ownerProfileId,
    };
    const { runner, calls, protectedSubjects } = runnerFor(async (role) =>
      role === "B" ? ownerB : OWNER_A,
    );
    const result = await runner!.run();

    expect(result.completed).toBe(false);
    expect(result.proof).toMatchObject({
      sequence: {
        outcome: "STOPPED",
        stopCode: "IDENTITY_B_NOT_DISTINCT",
        protectedCallCount: 4,
        cleanupCount: 3,
        recovery: "RECOVERED",
      },
    });
    expect(calls).toHaveLength(4);
    expect(protectedSubjects).toEqual([OWNER_A.subject, OWNER_A.subject, OWNER_A.subject, OWNER_A.subject]);
  });

  it("stops before B protected calls for the same subject across issuer and profile variations", async () => {
    const ownerB = {
      ...OWNER_B,
      subject: OWNER_A.subject,
      issuer: "https://issuer-b-different.example.test",
      ownerProfileId: "profile_B_different",
    };
    const { runner, calls, protectedSubjects } = runnerFor(async (role) =>
      role === "B" ? ownerB : OWNER_A,
    );
    const result = await runner!.run();

    expect(result.completed).toBe(false);
    expect(result.proof).toMatchObject({
      sequence: {
        outcome: "STOPPED",
        stopCode: "IDENTITY_B_NOT_DISTINCT",
        protectedCallCount: 4,
        cleanupCount: 3,
        recovery: "RECOVERED",
      },
    });
    expect(calls).toHaveLength(4);
    expect(protectedSubjects).toEqual([OWNER_A.subject, OWNER_A.subject, OWNER_A.subject, OWNER_A.subject]);
  });

  it("rejects a non-canonical issuer URL before any B protected call", async () => {
    const ownerB = { ...OWNER_B, issuer: "https://issuer-b.example.test/path" };
    const { runner, calls } = runnerFor(async (role) => role === "B" ? ownerB : OWNER_A);
    const result = await runner!.run();

    expect(result.completed).toBe(false);
    expect(result.proof.sequence).toMatchObject({
      outcome: "STOPPED",
      stopCode: "IDENTITY_B_NOT_DISTINCT",
      protectedCallCount: 4,
      cleanupCount: 3,
      recovery: "RECOVERED",
    });
    expect(calls).toHaveLength(4);
  });

  it("settles a timed-out seed before cleanup and recovery can complete", async () => {
    vi.useFakeTimers();
    try {
      let markSeedStarted!: () => void;
      let releaseSeed!: () => void;
      const seedStarted = new Promise<void>((resolve) => {
        markSeedStarted = resolve;
      });
      const seedRelease = new Promise<void>((resolve) => {
        releaseSeed = resolve;
      });
      const events: string[] = [];
      let residualCount = 0;
      let runFinished = false;
      let seedCalls = 0;
      let cleanupCalls = 0;
      let recoveryCalls = 0;
      const { runner, calls } = runnerFor(
        async (role) => role === "B" ? OWNER_B : OWNER_A,
        {
          seedA: async () => {
            seedCalls += 1;
            markSeedStarted();
            await seedRelease;
            residualCount = 3;
            events.push("seed_settled");
            return {
              status: "ready",
              createdCount: 3,
              reusedCount: 0,
              expectedCount: 3,
              ownerBound: true,
              version: 1,
            };
          },
          cleanupA: async () => {
            cleanupCalls += 1;
            events.push(`cleanup_started_with_${residualCount}`);
            residualCount = 0;
            return {
              status: "clean",
              deletedCount: 3,
              residualCount,
              expectedCount: 3,
              ownerBound: true,
              version: 1,
            };
          },
          recoverOldRuntime: async () => {
            recoveryCalls += 1;
            events.push(`recovery_started_with_${residualCount}`);
            return residualCount === 0;
          },
        },
      );

      const runPromise = runner!.run();
      void runPromise.then(() => {
        runFinished = true;
      });
      await seedStarted;
      await vi.advanceTimersByTimeAsync(MCP_PRODUCTION_OPERATION_TIMEOUT_MS);

      expect(runFinished).toBe(false);
      expect(events).toEqual([]);
      expect(cleanupCalls).toBe(0);
      expect(recoveryCalls).toBe(0);

      releaseSeed();
      const result = await runPromise;

      expect(runFinished).toBe(true);
      expect(seedCalls).toBe(1);
      expect(cleanupCalls).toBe(1);
      expect(recoveryCalls).toBe(1);
      expect(residualCount).toBe(0);
      expect(events).toEqual([
        "seed_settled",
        "cleanup_started_with_3",
        "recovery_started_with_0",
      ]);
      expect(calls).toHaveLength(0);
      expect(result.completed).toBe(false);
      expect(result.proof.sequence).toMatchObject({
        outcome: "STOPPED",
        stopCode: "SEED_FAILED",
        seedCount: 0,
        cleanupCount: 3,
        protectedCallCount: 0,
        recovery: "RECOVERED",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("settles a timed-out cleanup before recovery can complete", async () => {
    vi.useFakeTimers();
    try {
      let markCleanupStarted!: () => void;
      let releaseCleanup!: () => void;
      const cleanupStarted = new Promise<void>((resolve) => {
        markCleanupStarted = resolve;
      });
      const cleanupRelease = new Promise<void>((resolve) => {
        releaseCleanup = resolve;
      });
      const events: string[] = [];
      let residualCount = 0;
      let runFinished = false;
      let seedCalls = 0;
      let cleanupCalls = 0;
      let recoveryCalls = 0;
      const { runner, calls } = runnerFor(
        async (role) => role === "B" ? OWNER_B : OWNER_A,
        {
          seedA: async () => {
            seedCalls += 1;
            residualCount = 3;
            return {
              status: "ready",
              createdCount: 3,
              reusedCount: 0,
              expectedCount: 3,
              ownerBound: true,
              version: 1,
            };
          },
          cleanupA: async () => {
            cleanupCalls += 1;
            markCleanupStarted();
            await cleanupRelease;
            residualCount = 0;
            events.push("cleanup_settled");
            return {
              status: "clean",
              deletedCount: 3,
              residualCount,
              expectedCount: 3,
              ownerBound: true,
              version: 1,
            };
          },
          recoverOldRuntime: async () => {
            recoveryCalls += 1;
            events.push(`recovery_started_with_${residualCount}`);
            return residualCount === 0;
          },
        },
      );

      const runPromise = runner!.run();
      void runPromise.then(() => {
        runFinished = true;
      });
      await cleanupStarted;
      await vi.advanceTimersByTimeAsync(MCP_PRODUCTION_OPERATION_TIMEOUT_MS);

      expect(runFinished).toBe(false);
      expect(events).toEqual([]);
      expect(recoveryCalls).toBe(0);

      releaseCleanup();
      const result = await runPromise;

      expect(runFinished).toBe(true);
      expect(seedCalls).toBe(1);
      expect(cleanupCalls).toBe(1);
      expect(recoveryCalls).toBe(1);
      expect(residualCount).toBe(0);
      expect(events).toEqual([
        "cleanup_settled",
        "recovery_started_with_0",
      ]);
      expect(calls).toHaveLength(8);
      expect(result.completed).toBe(false);
      expect(result.proof.sequence).toMatchObject({
        outcome: "STOPPED",
        stopCode: "CLEANUP_FAILED",
        seedCount: 3,
        cleanupCount: 0,
        protectedCallCount: 8,
        recovery: "RECOVERED",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("settles a timed-out recovery before returning its failed result", async () => {
    vi.useFakeTimers();
    try {
      let markRecoveryStarted!: () => void;
      let releaseRecovery!: () => void;
      const recoveryStarted = new Promise<void>((resolve) => {
        markRecoveryStarted = resolve;
      });
      const recoveryRelease = new Promise<void>((resolve) => {
        releaseRecovery = resolve;
      });
      const events: string[] = [];
      let residualCount = 0;
      let runFinished = false;
      let seedCalls = 0;
      let cleanupCalls = 0;
      let recoveryCalls = 0;
      const { runner, calls } = runnerFor(
        async (role) => role === "B" ? OWNER_B : OWNER_A,
        {
          seedA: async () => {
            seedCalls += 1;
            residualCount = 3;
            return {
              status: "ready",
              createdCount: 3,
              reusedCount: 0,
              expectedCount: 3,
              ownerBound: true,
              version: 1,
            };
          },
          cleanupA: async () => {
            cleanupCalls += 1;
            residualCount = 0;
            return {
              status: "clean",
              deletedCount: 3,
              residualCount,
              expectedCount: 3,
              ownerBound: true,
              version: 1,
            };
          },
          recoverOldRuntime: async () => {
            recoveryCalls += 1;
            markRecoveryStarted();
            await recoveryRelease;
            events.push(`recovery_settled_with_${residualCount}`);
            return residualCount === 0;
          },
        },
      );

      const runPromise = runner!.run();
      void runPromise.then(() => {
        runFinished = true;
      });
      await recoveryStarted;
      await vi.advanceTimersByTimeAsync(MCP_PRODUCTION_OPERATION_TIMEOUT_MS);

      expect(runFinished).toBe(false);
      expect(events).toEqual([]);

      releaseRecovery();
      const result = await runPromise;

      expect(runFinished).toBe(true);
      expect(seedCalls).toBe(1);
      expect(cleanupCalls).toBe(1);
      expect(recoveryCalls).toBe(1);
      expect(residualCount).toBe(0);
      expect(events).toEqual(["recovery_settled_with_0"]);
      expect(calls).toHaveLength(8);
      expect(result.completed).toBe(false);
      expect(result.proof.sequence).toMatchObject({
        outcome: "STOPPED",
        stopCode: "RECOVERY_FAILED",
        seedCount: 3,
        cleanupCount: 3,
        protectedCallCount: 8,
        recovery: "FAILED",
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("uses a separate monotonic ledger whose delta changes when a prohibited effect is observed", async () => {
    const ledger = createMcpSafeSummaryProofEffectLedger();
    expect(await ledger.observer.snapshot()).toMatchObject({
      retryCount: 0,
      modelCallCount: 0,
    });
    ledger.record("retry");
    ledger.record("model");
    const final = await ledger.observer.snapshot();
    expect(final).toMatchObject({ retryCount: 1, modelCallCount: 1 });
    expect(ledger.observedEventCount()).toBe(2);
  });

  it("rejects a concurrent operator POST before a second seed or protected call", async () => {
    let seedEntered!: () => void;
    let releaseFirst!: () => void;
    const seedEnteredPromise = new Promise<void>((resolve) => {
      seedEntered = resolve;
    });
    const releaseFirstPromise = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    let seedCount = 0;
    let cleanupCount = 0;
    const { runner, calls } = runnerFor(
      async (role) => role === "B" ? OWNER_B : OWNER_A,
      {
        seedA: async () => {
          seedCount += 1;
          seedEntered();
          await releaseFirstPromise;
          return {
            status: "ready",
            ownerBound: true,
            createdCount: 3,
            reusedCount: 0,
            expectedCount: 3,
            version: 1,
          };
        },
        cleanupA: async () => {
          cleanupCount += 1;
          return {
            status: "clean",
            ownerBound: true,
            deletedCount: 3,
            residualCount: 0,
            expectedCount: 3,
            version: 1,
          };
        },
      },
    );
    const plugin = createLocalMcpDevEndpointPlugin({
      env: controlledProofEnv(),
      controlledSummaryProofRunner: runner,
      productionOAuthAuthorizationDependencies: operatorAuthDependencies(),
    });
    const middleware = configuredMiddleware(plugin);
    const firstResponse = responseCapture();
    const secondResponse = responseCapture();

    middleware({ method: "POST", url: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH, headers: { authorization: "Bearer fixture" } } as never, firstResponse, vi.fn());
    await seedEnteredPromise;
    middleware({ method: "POST", url: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH, headers: { authorization: "Bearer fixture" } } as never, secondResponse, vi.fn());

    expect(secondResponse.statusCode).toBe(409);
    expect(secondResponse.body()).toBe(JSON.stringify({
      kind: "mcp_safe_summary_controlled_proof_operator_response",
      status: "blocked",
      reason: "proof_run_already_in_progress",
      safeForModel: true,
      version: 1,
    }));
    expect(seedCount).toBe(1);
    expect(calls).toHaveLength(0);

    releaseFirst();
    await firstResponse.done;
    expect(firstResponse.statusCode).toBe(200);
    expect(seedCount).toBe(1);
    expect(cleanupCount).toBe(1);
    expect(calls).toHaveLength(8);
    expect(JSON.parse(firstResponse.body())).toMatchObject({
      status: "completed",
      completed: true,
      liveCalls: true,
      proof: { sequence: { protectedCallCount: 8, seedCount: 3, cleanupCount: 3, recovery: "RECOVERED" } },
    });
  });
});

type ControlledProofMiddleware = (
  request: { method: string; url: string },
  response: { statusCode?: number; setHeader: (name: string, value: string) => void; end: (body?: string) => void },
  next: () => void,
) => void;

function responseCapture() {
  let resolveDone!: () => void;
  const done = new Promise<void>((resolve) => {
    resolveDone = resolve;
  });
  let capturedBody: string | undefined;
  return {
    statusCode: undefined as number | undefined,
    setHeader: vi.fn(),
    end: (body?: string) => {
      capturedBody = body;
      resolveDone();
    },
    body: () => capturedBody,
    done,
  };
}

function configuredMiddleware(
  plugin: ReturnType<typeof createLocalMcpDevEndpointPlugin>,
): ControlledProofMiddleware {
  let middleware: ControlledProofMiddleware | undefined;
  plugin?.configureServer?.({
    middlewares: {
      use: (candidate: ControlledProofMiddleware) => {
        middleware = candidate;
      },
    },
  } as never);
  if (!middleware) throw new Error("expected Vite MCP middleware");
  return middleware;
}

function controlledProofEnv(): Record<string, string> {
  return {
    NODE_ENV: "development",
    MCP_SAFE_SUMMARY_CONTROLLED_PROOF: "1",
    CONVEX_URL: "https://convex.example.test",
    CONVEX_KEY: "fixture-admin-auth",
    MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OWNER_A_SUBJECT: "subject_A",
    MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OWNER_A_ISSUER: "https://issuer-a.example.test",
    MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OWNER_B_SUBJECT: "subject_B",
    MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OWNER_B_ISSUER: "https://issuer-b.example.test",
    CLERK_JWT_ISSUER_DOMAIN: "https://issuer-a.example.test",
  };
}

function operatorAuthDependencies(identity = OWNER_A) {
  return {
    readAuthenticatedOwnerIdentity: async () => ({
      subject: identity.subject,
      issuer: identity.issuer,
      version: 1 as const,
    }),
  };
}
