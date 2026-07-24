// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { createLocalMcpDevEndpointPlugin } from "../../../../vite.config";
import {
  buildMcpSafeSummaryControlledProofActivation,
  buildMcpSafeSummaryControlledProofRunner,
  MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH,
} from "../mcpSafeSummaryControlledProofRunner";
import { createMcpSafeSummaryProofEffectLedger } from "../mcpSafeSummaryProofEffectLedger";
import {
  createMcpSafeSummaryProofReceipt,
  isMcpSafeSummaryProofReceipt,
} from "../mcpSafeSummaryProofReceipt";
import type { McpSafeSummaryProofToolName } from "../mcpSafeSummaryProjectionProofHarness";
import type { McpSafeSummaryServerIdentityV1 } from "../mcpSafeSummaryServerSession";

const OWNER_A = {
  subject: "subject_A",
  issuer: "issuer_A",
  ownerProfileId: "profile_A",
  version: 1 as const,
};
const OWNER_B = {
  subject: "subject_B",
  issuer: "issuer_B",
  ownerProfileId: "profile_B",
  version: 1 as const,
};

const SAFE_REFS: Record<McpSafeSummaryProofToolName, string> = {
  "twoweeks.application_package.summarize": "mcp-safe-ref:application-package:latest",
  "twoweeks.evidence_graph.summarize": "mcp-safe-ref:evidence-graph:profile",
  "twoweeks.resume_variant_plan.summarize": "mcp-safe-ref:resume-variant-plan:latest",
  "twoweeks.review_cockpit.summarize": "mcp-safe-ref:review-cockpit:latest",
};

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
} = {}) {
  const calls: string[] = [];
  const protectedSubjects: string[] = [];
  let activeSubject: string | undefined;
  const runner = buildMcpSafeSummaryControlledProofRunner({
    activation: {
      environment: "development",
      enabled: true,
      contractId: "CC-20260724-mcp-safe-summary-live-adapter",
      contractVersion: 4,
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
      recoverOldRuntime: async () => true,
    },
  });
  return { runner, calls, protectedSubjects };
}

describe("v4 controlled MCP safe-summary adapter", () => {
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
      contractVersion: 4,
    });
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
      outcome: "PASS",
      protectedCallCount: 8,
      seedCount: 3,
      cleanupCount: 3,
      recovery: "RECOVERED",
      retryCount: 0,
      repairCount: 0,
      fallbackCount: 0,
      providerCallCount: 0,
      modelCallCount: 0,
    });
    expect(identities).toEqual(["A", "B", "A"]);
    expect(calls).toHaveLength(8);
    expect(JSON.stringify(result)).not.toContain("subject_A");
    expect(JSON.stringify(result)).not.toContain("profile_A");
    expect(JSON.stringify(result)).not.toContain("subject_B");
    expect(JSON.stringify(result)).not.toContain("profile_B");
  });

  it("passes a contract-valid receipt to seed and omits it from the operator response", async () => {
    const receipt = createMcpSafeSummaryProofReceipt(
      "123e4567-e89b-42d3-a456-426614174000",
    );
    let seededReceipt: unknown;
    const { runner } = runnerFor(
      async (role) => role === "B" ? OWNER_B : OWNER_A,
      {
        seedA: async () => {
          seededReceipt = receipt;
          return {
            status: "ready",
            createdCount: 3,
            reusedCount: 0,
            expectedCount: 3,
            ownerBound: true,
            version: 1,
          };
        },
      },
    );
    const plugin = createLocalMcpDevEndpointPlugin({
      env: controlledProofEnv(),
      controlledSummaryProofRunner: runner,
    });
    const response = responseCapture();
    configuredMiddleware(plugin)(
      { method: "POST", url: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH },
      response,
      vi.fn(),
    );
    await response.done;

    expect(isMcpSafeSummaryProofReceipt(seededReceipt)).toBe(true);
    expect(response.statusCode).toBe(200);
    expect(response.body()).not.toContain(receipt);
    expect(response.body()).not.toContain("mcp-proof-v1:");
  });

  it("stops before B protected calls when the server resolves the same identity", async () => {
    const { runner, calls, protectedSubjects } = runnerFor(async () => OWNER_A);
    const result = await runner!.run();
    expect(result.completed).toBe(false);
    expect(result.liveCalls).toBe(true);
    expect(result.proof).toMatchObject({
      outcome: "STOPPED",
      stopCode: "IDENTITY_B_NOT_DISTINCT",
      protectedCallCount: 4,
      cleanupCount: 3,
      recovery: "RECOVERED",
    });
    expect(calls).toHaveLength(4);
    expect(protectedSubjects).toEqual([OWNER_A.subject, OWNER_A.subject, OWNER_A.subject, OWNER_A.subject]);
  });

  it("stops before B protected calls when owner profile matches despite a different issuer", async () => {
    const ownerB = {
      ...OWNER_B,
      issuer: "issuer_B_different",
      ownerProfileId: OWNER_A.ownerProfileId,
    };
    const { runner, calls, protectedSubjects } = runnerFor(async (role) =>
      role === "B" ? ownerB : OWNER_A,
    );
    const result = await runner!.run();

    expect(result.completed).toBe(false);
    expect(result.proof).toMatchObject({
      outcome: "STOPPED",
      stopCode: "IDENTITY_B_NOT_DISTINCT",
      protectedCallCount: 4,
      cleanupCount: 3,
      recovery: "RECOVERED",
    });
    expect(calls).toHaveLength(4);
    expect(protectedSubjects).toEqual([OWNER_A.subject, OWNER_A.subject, OWNER_A.subject, OWNER_A.subject]);
  });

  it("stops before B protected calls for the same subject across issuer and profile variations", async () => {
    const ownerB = {
      ...OWNER_B,
      subject: OWNER_A.subject,
      issuer: "issuer_B_different",
      ownerProfileId: "profile_B_different",
    };
    const { runner, calls, protectedSubjects } = runnerFor(async (role) =>
      role === "B" ? ownerB : OWNER_A,
    );
    const result = await runner!.run();

    expect(result.completed).toBe(false);
    expect(result.proof).toMatchObject({
      outcome: "STOPPED",
      stopCode: "IDENTITY_B_NOT_DISTINCT",
      protectedCallCount: 4,
      cleanupCount: 3,
      recovery: "RECOVERED",
    });
    expect(calls).toHaveLength(4);
    expect(protectedSubjects).toEqual([OWNER_A.subject, OWNER_A.subject, OWNER_A.subject, OWNER_A.subject]);
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
    });
    const middleware = configuredMiddleware(plugin);
    const firstResponse = responseCapture();
    const secondResponse = responseCapture();

    middleware({ method: "POST", url: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH }, firstResponse, vi.fn());
    await seedEnteredPromise;
    middleware({ method: "POST", url: MCP_SAFE_SUMMARY_CONTROLLED_PROOF_PATH }, secondResponse, vi.fn());

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
      proof: { protectedCallCount: 8, seedCount: 3, cleanupCount: 3, recovery: "RECOVERED" },
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
    MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OWNER_A_ISSUER: "issuer_A",
    MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OWNER_B_SUBJECT: "subject_B",
    MCP_SAFE_SUMMARY_CONTROLLED_PROOF_OWNER_B_ISSUER: "issuer_B",
  };
}
