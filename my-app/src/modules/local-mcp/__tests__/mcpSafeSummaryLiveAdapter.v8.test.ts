import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { TWOWEEKS_APPLICATIONS_READ_SCOPE } from "../mcpAuthPolicyBoundary";
import {
  buildMcpOAuthProductionRouteAdapterConfig,
  MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
  type McpOAuthProductionRouteAdapterDependenciesV1,
} from "../mcpOAuthProductionRouteAdapter";
import type {
  McpProductionReadonlySummaryExecutionInputV1,
  McpProductionReadonlySummaryExecutionResultV1,
} from "../mcpProductionReadonlySummaryExecutor";
import { buildMcpProductionToolsListResult } from "../mcpProductionToolsListProjection";
import {
  buildMcpSafeSummaryLiveAdapterActivationV8,
  buildMcpSafeSummaryLiveAdapterHandlerV8,
  buildMcpSafeSummaryLiveAdapterV8,
  type McpSafeSummaryLiveAdapterInputV8,
} from "../mcpSafeSummaryLiveAdapter";
import {
  validateMcpSafeSummaryBaselineV8,
  validateMcpSafeSummaryPostSeedDeltasV8,
  type McpSafeSummarySnapshotV8,
} from "../mcpSafeSummaryDeltaProof";
import { MCP_SAFE_SUMMARY_PROOF_TOOLS } from "../mcpSafeSummaryProjectionProofHarness";
import type { McpSafeSummaryServerIdentityV1 } from "../mcpSafeSummaryServerSession";

const IDENTITY_A = {
  subject: "subject_A",
  issuer: "https://issuer-a.example.test",
  ownerProfileId: "profile_A",
  version: 1 as const,
} satisfies McpSafeSummaryServerIdentityV1;
const IDENTITY_B = {
  subject: "subject_B",
  issuer: "https://issuer-b.example.test",
  ownerProfileId: "profile_B",
  version: 1 as const,
} satisfies McpSafeSummaryServerIdentityV1;

const TEST_NOW = 1_782_860_400_000;
const TEST_HOST = "mcp-v8.example.test";
const TEST_RESOURCE = `https://${TEST_HOST}/resource`;
const TEST_CLIENT_ID = "chatgpt_v8_fixture";
const TEST_BEARER_A = "A".repeat(43);
const TEST_BEARER_B = "B".repeat(43);

const KEYS = {
  "twoweeks.application_package.summarize": ["packages", "artifacts", "provenanceLinks", "reviewItems", "warnings", "blockers"],
  "twoweeks.evidence_graph.summarize": ["sourceDocuments", "candidateFacts", "approvedFacts", "pendingFacts", "rejectedFacts", "restrictedEvidence", "archivedEvidence", "provenanceLinks", "evidenceMatches", "allowedClaims", "missingEvidence", "riskFlags", "staleSources", "warnings", "blockers"],
  "twoweeks.resume_variant_plan.summarize": ["plans", "planItems", "claimBackedItems", "missingInputItems", "reviewNeededItems", "acceptedItems", "rejectedItems", "blockedItems", "warnings", "blockers", "restrictedFactBlockers", "excludedFactBlockers", "artifactTextBlockers", "allowedClaims", "sourceFacts", "evidenceMatches", "demands", "riskFlags"],
  "twoweeks.review_cockpit.summarize": ["reviewContexts", "reviewRuns", "reviewArtifacts", "applicationPackages", "pendingReviews", "approvedReviews", "blockedReviews", "failedRuns", "blockedRuns", "blockedArtifacts", "blockedPackages", "missingReviewItems", "approvalNeeded", "staleInputs", "overLimitCollections"],
} as const;

const TOOL_METADATA = {
  "twoweeks.application_package.summarize": {
    kind: "mcp_application_package_summary_result",
    refKey: "packageRef",
    refId: "mcp-safe-ref:application-package:latest",
    category: "application_package",
    dataReads: "convex_application_package_summary",
  },
  "twoweeks.evidence_graph.summarize": {
    kind: "mcp_evidence_graph_summary_result",
    refKey: "evidenceGraphRef",
    refId: "mcp-safe-ref:evidence-graph:profile",
    category: "evidence_graph",
    dataReads: "convex_evidence_graph_summary",
  },
  "twoweeks.resume_variant_plan.summarize": {
    kind: "mcp_resume_variant_plan_summary_result",
    refKey: "resumeVariantPlanRef",
    refId: "mcp-safe-ref:resume-variant-plan:latest",
    category: "resume_variant_plan",
    dataReads: "convex_resume_variant_plan_summary",
  },
  "twoweeks.review_cockpit.summarize": {
    kind: "mcp_review_cockpit_summary_result",
    refKey: "reviewCockpitRef",
    refId: "mcp-safe-ref:review-cockpit:latest",
    category: "review_cockpit",
    dataReads: "convex_review_cockpit_summary",
  },
} as const;

function snapshot(toolName: typeof MCP_SAFE_SUMMARY_PROOF_TOOLS[number], overrides: Readonly<Record<string, number>> = {}): Readonly<Record<string, unknown>> {
  const safeCounts: Record<string, number> = {};
  for (const key of KEYS[toolName]) safeCounts[key] = 0;
  return { safeCounts: { ...safeCounts, ...overrides, version: 1 }, version: 1 };
}

function fullSnapshot(overrides: Readonly<Record<string, Readonly<Record<string, number>>>> = {}): McpSafeSummarySnapshotV8 {
  const result = { A: {}, B: {} } as McpSafeSummarySnapshotV8;
  for (const role of ["A", "B"] as const) {
    for (const toolName of MCP_SAFE_SUMMARY_PROOF_TOOLS) {
      const counts: Record<string, number> = {};
      for (const key of KEYS[toolName]) counts[key] = 0;
      result[role][toolName] = snapshot(toolName, { ...counts, ...overrides[`${role}.${toolName}`] });
    }
  }
  return result;
}

function validPostSeedSnapshot(): McpSafeSummarySnapshotV8 {
  return fullSnapshot({
    "A.twoweeks.evidence_graph.summarize": {
      sourceDocuments: 1,
      candidateFacts: 1,
      approvedFacts: 1,
    },
    "A.twoweeks.resume_variant_plan.summarize": {
      plans: 1,
      planItems: 1,
      claimBackedItems: 1,
      reviewNeededItems: 1,
      allowedClaims: 1,
      sourceFacts: 1,
    },
    "A.twoweeks.review_cockpit.summarize": {
      reviewArtifacts: 1,
      pendingReviews: 1,
      approvalNeeded: 1,
    },
  });
}

function replaceSummary(
  value: McpSafeSummarySnapshotV8,
  role: "A" | "B",
  toolName: typeof MCP_SAFE_SUMMARY_PROOF_TOOLS[number],
  summary: Readonly<Record<string, unknown>>,
): McpSafeSummarySnapshotV8 {
  return {
    ...value,
    [role]: {
      ...value[role],
      [toolName]: summary,
    },
  };
}

function deferred<T>(): Readonly<{
  promise: Promise<T>;
  resolve: (value: T) => void;
}> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function validSeed() {
  return { status: "ready", createdCount: 3, reusedCount: 0, expectedCount: 3, ownerBound: true, version: 1 };
}

function validCleanup() {
  return { status: "clean", deletedCount: 3, residualCount: 0, expectedCount: 3, ownerBound: true, version: 1 };
}

function zeroEffects() {
  return {
    retryCount: 0,
    repairCount: 0,
    fallbackCount: 0,
    providerCallCount: 0,
    modelCallCount: 0,
    version: 1 as const,
  };
}

function sha256(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function offlineExecutionResult(
  input: McpProductionReadonlySummaryExecutionInputV1,
): McpProductionReadonlySummaryExecutionResultV1 {
  const metadata = TOOL_METADATA[input.toolName];
  const updatedAt = new Date(TEST_NOW).toISOString();
  return {
    ok: true,
    content: [{ type: "text", text: "Read-only summary returned." }],
    structuredContent: {
      kind: metadata.kind,
      allowed: true,
      status: "available",
      [metadata.refKey]: {
        id: metadata.refId,
        label: "Safe summary availability",
        status: "available",
        category: metadata.category,
        count: 1,
        updatedAt,
        version: 1,
      },
      availability: {
        source: metadata.dataReads,
        ownerState: "resolved",
        version: 1,
      },
      safeCounts: snapshot(input.toolName).safeCounts,
      safeCategories: { version: 1 },
      capabilities: {
        ownerResolution: "server_only",
        dataReads: metadata.dataReads,
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        rawDataProjection: "blocked",
        version: 1,
      },
      updatedAt,
      modelVisible: true,
      version: 1,
    },
    modelVisible: true,
    version: 1,
  };
}

function inputFor(
  baseline: McpSafeSummarySnapshotV8,
  postSeed: McpSafeSummarySnapshotV8,
): McpSafeSummaryLiveAdapterInputV8 {
  return {
    activation: buildMcpSafeSummaryLiveAdapterActivationV8({
      NODE_ENV: "development",
      MCP_SAFE_SUMMARY_LIVE_ADAPTER_V8: "1",
    })!,
    operatorCredentials: { A: "operator-a-synthetic", B: "operator-b-synthetic" },
    configuredIdentities: { A: IDENTITY_A, B: IDENTITY_B },
    verifyOperatorCredential: vi.fn(async (role) => role === "A" ? IDENTITY_A : IDENTITY_B),
    listTools: vi.fn(async () => buildMcpProductionToolsListResult()),
    readBaseline: vi.fn(async (role, toolName) => baseline[role][toolName]),
    resolveReference: vi.fn(async (_role, toolName) => ({ id: `ref:${toolName}` })),
    callToolsCall: vi.fn(async ({ role, toolName }) => ({
      jsonrpc: "2.0",
      id: `${role}:${toolName}`,
      result: { structuredContent: postSeed[role][toolName] },
    })),
    seedA: vi.fn(async () => validSeed()),
    cleanupA: vi.fn(async () => validCleanup()),
    recover: vi.fn(async () => true),
  };
}

describe("CC-20260724-mcp-safe-summary-live-adapter v8", () => {
  it("requires two ephemeral operator bearers and executes exactly eight handler calls", async () => {
    const baseline = fullSnapshot();
    const postSeed = fullSnapshot({
      "A.twoweeks.evidence_graph.summarize": { sourceDocuments: 1, candidateFacts: 1, approvedFacts: 1 },
      "A.twoweeks.resume_variant_plan.summarize": { plans: 1, planItems: 1, claimBackedItems: 1, reviewNeededItems: 1, allowedClaims: 1, sourceFacts: 1 },
      "A.twoweeks.review_cockpit.summarize": { reviewArtifacts: 1, pendingReviews: 1, approvalNeeded: 1 },
    });
    const input = inputFor(baseline, postSeed);
    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.proof.staticProof.kind).toBe("STATIC_ONLY");
    expect(result.proof.sequence).toMatchObject({
      protectedCallCount: 8,
      seedCount: 3,
      cleanupCount: 3,
      recovery: "RECOVERED",
      baseline: "ACCEPTED",
      postSeedDelta: "ACCEPTED",
    });
    expect(input.callToolsCall).toHaveBeenCalledTimes(8);
    expect(input.verifyOperatorCredential).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(result)).not.toContain("operator-a-synthetic");
    expect(JSON.stringify(result)).not.toContain("operator-b-synthetic");
  });

  it("fails closed before seed when bearer B is missing", async () => {
    const baseline = fullSnapshot();
    const input = inputFor(baseline, baseline);
    input.operatorCredentials = { A: "operator-a-synthetic", B: "" };
    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(false);
    expect(result.proof.sequence.stopCode).toBe("MISSING_OPERATOR_CREDENTIAL");
    expect(input.seedA).not.toHaveBeenCalled();
    expect(input.callToolsCall).not.toHaveBeenCalled();
  });

  it("rejects identical operator bearers before auth or seed", async () => {
    const baseline = fullSnapshot();
    const input = inputFor(baseline, baseline);
    input.operatorCredentials = {
      A: "same-operator-synthetic-bearer",
      B: "same-operator-synthetic-bearer",
    };

    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(false);
    expect(result.proof.sequence).toMatchObject({
      outcome: "STOPPED",
      stopCode: "DUPLICATE_OPERATOR_CREDENTIAL",
      baseline: "REJECTED",
    });
    expect(input.verifyOperatorCredential).not.toHaveBeenCalled();
    expect(input.seedA).not.toHaveBeenCalled();
    expect(input.callToolsCall).not.toHaveBeenCalled();
  });

  it("rejects absent deltas, saturation, and concurrent B drift", () => {
    const baseline = fullSnapshot();
    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, undefined)).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
    });
    expect(validateMcpSafeSummaryBaselineV8(fullSnapshot({
      "A.twoweeks.evidence_graph.summarize": { sourceDocuments: 100 },
    }))).toMatchObject({ accepted: false, reason: "BASELINE_SATURATED" });

    const drifted = fullSnapshot({ "B.twoweeks.review_cockpit.summarize": { reviewArtifacts: 1 } });
    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, drifted)).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
    });
  });

  it.each([
    {
      toolName: "twoweeks.evidence_graph.summarize" as const,
      baselineFields: { status: "available" },
      postSeedFields: { status: "stale" },
    },
    {
      toolName: "twoweeks.resume_variant_plan.summarize" as const,
      baselineFields: { safeCategories: { ready: true, version: 1 } },
      postSeedFields: { safeCategories: { ready: false, version: 1 } },
    },
    {
      toolName: "twoweeks.review_cockpit.summarize" as const,
      baselineFields: { updatedAt: "2026-07-24T00:00:00.000Z" },
      postSeedFields: { updatedAt: "2026-07-24T00:00:01.000Z" },
    },
  ])("rejects non-safeCounts A drift for $toolName", ({
    toolName,
    baselineFields,
    postSeedFields,
  }) => {
    const baseline = fullSnapshot();
    const postSeed = validPostSeedSnapshot();
    const baselineWithMetadata = replaceSummary(baseline, "A", toolName, {
      ...baseline.A[toolName],
      ...baselineFields,
    });
    const postSeedWithDrift = replaceSummary(postSeed, "A", toolName, {
      ...postSeed.A[toolName],
      ...postSeedFields,
    });

    expect(validateMcpSafeSummaryPostSeedDeltasV8(
      baselineWithMetadata,
      postSeedWithDrift,
    )).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
    });
  });

  it.each([
    {
      name: "JSON-RPC error",
      response: {
        jsonrpc: "2.0",
        id: "v8-error",
        error: { code: -32_000, message: "synthetic failure" },
      },
    },
    { name: "absent result", response: { jsonrpc: "2.0", id: "v8-absent" } },
    {
      name: "malformed result",
      response: { jsonrpc: "2.0", id: "v8-malformed", result: { structuredContent: null } },
    },
  ])("rejects $name tools/call envelopes", async ({ response }) => {
    const baseline = fullSnapshot();
    const input = inputFor(baseline, validPostSeedSnapshot());
    input.callToolsCall = vi.fn(async () => response);

    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(false);
    expect(result.proof.sequence).toMatchObject({
      outcome: "STOPPED",
      stopCode: "PROTECTED_CALL_FAILED",
      protectedCallCount: 1,
      seedCount: 3,
      cleanupCount: 3,
      recovery: "RECOVERED",
      baseline: "ACCEPTED",
      postSeedDelta: "REJECTED",
    });
  });

  it.each([
    {
      name: "false cleanup result",
      cleanup: async () => false,
      stopCode: "CLEANUP_COUNT_MISMATCH",
    },
    {
      name: "thrown cleanup",
      cleanup: async () => {
        throw new Error("synthetic cleanup failure");
      },
      stopCode: "CLEANUP_FAILED",
    },
    {
      name: "cleanup count mismatch",
      cleanup: async () => ({ ...validCleanup(), deletedCount: 2, residualCount: 1 }),
      stopCode: "CLEANUP_COUNT_MISMATCH",
    },
  ])("fails closed on $name", async ({ cleanup, stopCode }) => {
    const baseline = fullSnapshot();
    const input = inputFor(baseline, validPostSeedSnapshot());
    input.cleanupA = vi.fn(cleanup);

    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(false);
    expect(result.proof.sequence).toMatchObject({
      outcome: "STOPPED",
      stopCode,
      protectedCallCount: 8,
      seedCount: 3,
      cleanupCount: 0,
      recovery: "RECOVERED",
      baseline: "ACCEPTED",
      postSeedDelta: "ACCEPTED",
    });
  });

  it.each([
    { name: "false recovery result", recover: async () => false },
    {
      name: "thrown recovery",
      recover: async () => {
        throw new Error("synthetic recovery failure");
      },
    },
  ])("fails closed on $name", async ({ recover }) => {
    const baseline = fullSnapshot();
    const input = inputFor(baseline, validPostSeedSnapshot());
    input.recover = vi.fn(recover);

    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(false);
    expect(result.proof.sequence).toMatchObject({
      outcome: "STOPPED",
      stopCode: "RECOVERY_FAILED",
      protectedCallCount: 8,
      seedCount: 3,
      cleanupCount: 3,
      recovery: "FAILED",
      baseline: "ACCEPTED",
      postSeedDelta: "ACCEPTED",
    });
  });

  it("keeps single-flight locked until the first run really settles", async () => {
    const baseline = fullSnapshot();
    const input = inputFor(baseline, validPostSeedSnapshot());
    const cleanupStarted = deferred<void>();
    const cleanupSettlement = deferred<ReturnType<typeof validCleanup>>();
    input.cleanupA = vi.fn(async () => {
      cleanupStarted.resolve();
      return cleanupSettlement.promise;
    });
    const adapter = buildMcpSafeSummaryLiveAdapterV8(input);
    let firstSettled = false;

    const firstRun = adapter.run();
    void firstRun.finally(() => {
      firstSettled = true;
    });
    await cleanupStarted.promise;

    const secondRun = await adapter.run();
    expect(secondRun.proof.sequence.stopCode).toBe("SINGLE_FLIGHT");
    expect(firstSettled).toBe(false);

    cleanupSettlement.resolve(validCleanup());
    const firstResult = await firstRun;
    expect(firstSettled).toBe(true);
    expect(firstResult.sequenceCompleted).toBe(true);
  });

  it("fails closed when the separate effect ledger reports a forbidden effect", async () => {
    const baseline = fullSnapshot();
    const postSeed = fullSnapshot({
      "A.twoweeks.evidence_graph.summarize": { sourceDocuments: 1, candidateFacts: 1, approvedFacts: 1 },
      "A.twoweeks.resume_variant_plan.summarize": { plans: 1, planItems: 1, claimBackedItems: 1, reviewNeededItems: 1, allowedClaims: 1, sourceFacts: 1 },
      "A.twoweeks.review_cockpit.summarize": { reviewArtifacts: 1, pendingReviews: 1, approvalNeeded: 1 },
    });
    const input = inputFor(baseline, postSeed);
    input.effectObservation = vi.fn(async () => ({
      retryCount: 0,
      repairCount: 0,
      fallbackCount: 0,
      providerCallCount: 1,
      modelCallCount: 0,
      version: 1 as const,
    }));

    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(false);
    expect(result.proof.sequence.stopCode).toBe("EFFECT_OBSERVER_FAILED");
    expect(input.seedA).not.toHaveBeenCalled();
    expect(input.callToolsCall).not.toHaveBeenCalled();
    expect(result.proof.effectObservation.provider).toBe("NOT_OBSERVED");
  });

  it("reports STOPPED when the final effect observation detects a forbidden effect", async () => {
    const baseline = fullSnapshot();
    const postSeed = fullSnapshot({
      "A.twoweeks.evidence_graph.summarize": { sourceDocuments: 1, candidateFacts: 1, approvedFacts: 1 },
      "A.twoweeks.resume_variant_plan.summarize": { plans: 1, planItems: 1, claimBackedItems: 1, reviewNeededItems: 1, allowedClaims: 1, sourceFacts: 1 },
      "A.twoweeks.review_cockpit.summarize": { reviewArtifacts: 1, pendingReviews: 1, approvalNeeded: 1 },
    });
    const input = inputFor(baseline, postSeed);
    let observationCount = 0;
    input.effectObservation = vi.fn(async () => {
      observationCount += 1;
      return {
        ...zeroEffects(),
        providerCallCount: observationCount === 1 ? 0 : 1,
      };
    });

    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(false);
    expect(result.proof.sequence).toMatchObject({
      outcome: "STOPPED",
      stopCode: "EFFECT_OBSERVER_FAILED",
      protectedCallCount: 8,
      seedCount: 3,
      cleanupCount: 3,
      baseline: "ACCEPTED",
      postSeedDelta: "ACCEPTED",
    });
    expect(input.effectObservation).toHaveBeenCalledTimes(2);
  });

  it("reports a saturated captured baseline as rejected", async () => {
    const saturated = fullSnapshot({
      "A.twoweeks.evidence_graph.summarize": { sourceDocuments: 100 },
    });
    const input = inputFor(saturated, saturated);

    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(false);
    expect(result.proof.sequence).toMatchObject({
      outcome: "STOPPED",
      stopCode: "BASELINE_SATURATED",
      baseline: "REJECTED",
      postSeedDelta: "REJECTED",
    });
    expect(input.seedA).not.toHaveBeenCalled();
    expect(input.callToolsCall).not.toHaveBeenCalled();
  });

  it("executes eight offline tools/call requests through the real OAuth JSON-RPC handler", async () => {
    const tokenDigests = new Map([
      [sha256(TEST_BEARER_A), IDENTITY_A],
      [sha256(TEST_BEARER_B), IDENTITY_B],
    ]);
    const verifyAccessToken = vi.fn(async (input: {
      accessTokenDigest: string;
      allowedClientIds: readonly string[];
      resource: string;
      requiredScope: typeof TWOWEEKS_APPLICATIONS_READ_SCOPE;
      now: number;
      version: 1;
    }) => {
      const identity = tokenDigests.get(input.accessTokenDigest);
      if (!identity) {
        return {
          kind: "mcp_oauth_access_token_verify_result" as const,
          ok: false as const,
          reason: "not_found_or_forbidden" as const,
          safeFailure: {
            code: "mcp_oauth_access_token_denied" as const,
            message: "Access token denied." as const,
            safeForModel: true as const,
            rawTokenEchoed: false as const,
            digestEchoed: false as const,
            identityEchoed: false as const,
            sensitiveValuesEchoed: false as const,
            version: 1 as const,
          },
          modelVisible: false as const,
          safeForLogging: true as const,
          version: 1 as const,
        };
      }
      return {
        kind: "mcp_oauth_access_token_verify_result" as const,
        ok: true as const,
        reason: "verified" as const,
        serverOnly: {
          status: "active" as const,
          twoweeksClerkId: identity.subject,
          ownerIssuer: identity.issuer,
          clientId: TEST_CLIENT_ID,
          resource: TEST_RESOURCE,
          scopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
          productionEnvironment: MCP_OAUTH_PRODUCTION_AUTHORIZATION_CODE_ENVIRONMENT,
          expiresAt: TEST_NOW + 60_000,
          tokenActive: true as const,
          tokenExpired: false as const,
          tokenRevoked: false as const,
          rawAccessTokenPersisted: false as const,
          rawAccessTokenEchoed: false as const,
          digestEchoed: false as const,
          version: 1 as const,
        },
        modelVisible: false as const,
        safeForLogging: false as const,
        version: 1 as const,
      };
    });
    const executeReadonlySummaryTool = vi.fn(async (
      input: McpProductionReadonlySummaryExecutionInputV1,
    ) => offlineExecutionResult(input));
    const dependencies = {
      authorizationRequestConfig: {
        kind: "mcp_oauth_authorization_request_boundary_config" as const,
        authorizationPageOrigin: `https://${TEST_HOST}`,
        authorizationPagePath: "/oauth/authorize",
        canonicalResource: TEST_RESOURCE,
        allowedRedirectUris: ["https://chatgpt.example.test/oauth/callback"],
        requiredScope: TWOWEEKS_APPLICATIONS_READ_SCOPE,
        approvedOptionalScopes: ["openid", "email", "profile"],
        allowedOptionalParameters: ["nonce", "prompt", "ui_locales"],
        maxUrlLength: 4_096,
        maxParameterLength: 512,
        maxStateLength: 512,
        maxIdTokenHintLength: 1_024,
        clientIdPolicy: {
          mode: "predefined_allowlist" as const,
          allowedClientIds: [TEST_CLIENT_ID],
          version: 1 as const,
        },
        localDevelopmentOnly: true,
        allowHttpLocalhostAuthorizationOrigin: false,
        version: 1 as const,
      },
      checkPreAuthQuota: vi.fn(async () => ({
        kind: "mcp_oauth_pre_auth_quota_result" as const,
        ok: true as const,
        reason: "accepted" as const,
        safeForLogging: true as const,
        version: 1 as const,
      })),
      verifyAccessToken,
      executeReadonlySummaryTool,
      now: vi.fn(() => TEST_NOW),
    } satisfies McpOAuthProductionRouteAdapterDependenciesV1;
    const providerExchange = vi.fn(async () => ({
      kind: "mcp_oauth_production_token_exchange_result" as const,
      ok: false as const,
      reason: "not_executed_in_v8_offline_test",
      safeFailure: { code: "not_executed" },
      modelVisible: false as const,
      safeForLogging: true as const,
      version: 1 as const,
    }));
    const accountLinkLifecycle = vi.fn(async () => ({
      kind: "mcp_account_link_lifecycle_result" as const,
      operation: "link" as const,
      ok: false as const,
      reason: "not_executed_in_v8_offline_test",
      safeFailure: { code: "not_executed" },
      modelVisible: false as const,
      version: 1 as const,
    }));
    const config = buildMcpOAuthProductionRouteAdapterConfig({
      flags: { runtime: "1", approved: "1", routeWiring: "1" },
      providerConfig: {
        provider: "stytch",
        issuer: "https://issuer-v8.example.test",
        resource: TEST_RESOURCE,
        providerEnvironment: "test",
        allowedClientIds: [TEST_CLIENT_ID],
        requiredReadScopes: [TWOWEEKS_APPLICATIONS_READ_SCOPE],
        version: 1,
      },
      activationDependencies: {
        providerAdapter: {
          provider: "stytch",
          exchangeAuthorizationCode: providerExchange,
          version: 1,
        },
        executeAccountLinkLifecycle: accountLinkLifecycle,
      },
      privateBeta: {
        enabled: true,
        allowedClientIds: [TEST_CLIENT_ID],
        allowedResources: [TEST_RESOURCE],
        allowedSubjectDigests: [
          sha256(IDENTITY_A.subject),
          sha256(IDENTITY_B.subject),
        ],
      },
    });
    const handler = buildMcpSafeSummaryLiveAdapterHandlerV8({
      config,
      dependencies,
      host: TEST_HOST,
      remoteAddress: "198.51.100.24",
    });
    const responses: unknown[] = [];

    expect(config.preflight.decision).toBe("ready_to_wire");
    for (const [role, bearerCredential] of [
      ["A", TEST_BEARER_A],
      ["B", TEST_BEARER_B],
    ] as const) {
      for (const toolName of MCP_SAFE_SUMMARY_PROOF_TOOLS) {
        responses.push(await handler({
          role,
          bearerCredential,
          toolName,
          reference: { id: TOOL_METADATA[toolName].refId },
        }));
      }
    }

    expect(responses).toHaveLength(8);
    expect(responses[0]).toMatchObject({ jsonrpc: "2.0" });
    expect(dependencies.checkPreAuthQuota).toHaveBeenCalledTimes(8);
    expect(verifyAccessToken).toHaveBeenCalledTimes(8);
    expect(executeReadonlySummaryTool).toHaveBeenCalledTimes(8);
    expect(verifyAccessToken.mock.calls.filter(
      ([input]) => input.accessTokenDigest === sha256(TEST_BEARER_A),
    )).toHaveLength(4);
    expect(verifyAccessToken.mock.calls.filter(
      ([input]) => input.accessTokenDigest === sha256(TEST_BEARER_B),
    )).toHaveLength(4);
    expect(responses.every((response) =>
      typeof response === "object" &&
      response !== null &&
      "result" in response &&
      !("error" in response)
    )).toBe(true);
    expect(executeReadonlySummaryTool.mock.calls.filter(
      ([input]) => input.twoweeksClerkId === IDENTITY_A.subject,
    )).toHaveLength(4);
    expect(executeReadonlySummaryTool.mock.calls.filter(
      ([input]) => input.twoweeksClerkId === IDENTITY_B.subject,
    )).toHaveLength(4);
    expect(providerExchange).not.toHaveBeenCalled();
    expect(accountLinkLifecycle).not.toHaveBeenCalled();
    expect(dependencies).not.toHaveProperty("issueAccessToken");
    expect(dependencies).not.toHaveProperty("createAuthorizationCode");
    const publicOutput = JSON.stringify(responses);
    const verifierInput = JSON.stringify(verifyAccessToken.mock.calls);
    expect(publicOutput).not.toContain(TEST_BEARER_A);
    expect(publicOutput).not.toContain(TEST_BEARER_B);
    expect(publicOutput).not.toContain(IDENTITY_A.subject);
    expect(publicOutput).not.toContain(IDENTITY_B.subject);
    expect(verifierInput).not.toContain(TEST_BEARER_A);
    expect(verifierInput).not.toContain(TEST_BEARER_B);
  });
});
