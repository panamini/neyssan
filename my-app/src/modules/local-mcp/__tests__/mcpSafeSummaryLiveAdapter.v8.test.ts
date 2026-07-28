import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
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
  classifyMcpSafeSummaryToolsCallResponseV8,
  resolveMcpSafeSummaryLiveAdapterHostV8,
  type McpSafeSummaryLiveAdapterInputV8,
} from "../mcpSafeSummaryLiveAdapter";
import {
  validateMcpSafeSummaryBaselineV8,
  validateMcpSafeSummaryPostSeedDeltasV8,
  type McpSafeSummarySnapshotV8,
} from "../mcpSafeSummaryDeltaProof";
import {
  MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
  MCP_SAFE_SUMMARY_PROOF_TOOLS,
} from "../mcpSafeSummaryProjectionProofHarness";
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
  const resolvedCounts = { ...safeCounts, ...overrides, version: 1 };
  return {
    safeCounts: resolvedCounts,
    ...(toolName === "twoweeks.review_cockpit.summarize"
      ? {
          safeFlags: {
            approvalNeeded: resolvedCounts.approvalNeeded > 0,
            staleData: resolvedCounts.staleInputs > 0,
            overLimit: resolvedCounts.overLimitCollections > 0,
            version: 1,
          },
        }
      : {}),
    version: 1,
  };
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
  // Minimal zero-baseline effects of the four controlled rows across each
  // active summary. Latest-package fields use replacement, not additive, counts.
  const counts = fullSnapshot({
    "A.twoweeks.application_package.summarize": {
      packages: 1,
      artifacts: 2,
      provenanceLinks: 2,
      reviewItems: 1,
    },
    "A.twoweeks.evidence_graph.summarize": {
      sourceDocuments: 1,
      candidateFacts: 1,
      approvedFacts: 1,
      provenanceLinks: 2,
      allowedClaims: 1,
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
      applicationPackages: 1,
      pendingReviews: 2,
      missingReviewItems: 1,
      approvalNeeded: 3,
    },
  });
  return replaceSummary(
    counts,
    "A",
    "twoweeks.application_package.summarize",
    {
      ...counts.A["twoweeks.application_package.summarize"],
      status: "available",
      packageRef: { status: "available", count: 1 },
      safeCategories: {
        packageStatus: "needs_review",
        resumeVariantArtifactStatus: "draft",
        coverLetterArtifactStatus: "needs_review",
        version: 1,
      },
    },
  );
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
  return {
    status: "ready",
    createdCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
    reusedCount: 0,
    expectedCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
    ownerBound: true,
    version: 1,
  };
}

function validCleanup() {
  return {
    status: "clean",
    deletedCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
    residualCount: 0,
    expectedCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
    ownerBound: true,
    version: 1,
  };
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
    readPostSeed: vi.fn(async (role, toolName) => postSeed[role][toolName]),
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
  it("binds internal tools/call traffic to the canonical protected-resource host", () => {
    expect(resolveMcpSafeSummaryLiveAdapterHostV8(TEST_RESOURCE)).toBe(TEST_HOST);
    expect(resolveMcpSafeSummaryLiveAdapterHostV8("http://127.0.0.1:5196/mcp")).toBeUndefined();
    expect(resolveMcpSafeSummaryLiveAdapterHostV8("not-a-resource")).toBeUndefined();
    expect(resolveMcpSafeSummaryLiveAdapterHostV8(undefined)).toBeUndefined();

    const viteSource = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    const runnerPath = viteSource.slice(
      viteSource.indexOf("async function buildProductionMcpSafeSummaryLiveAdapterRunner"),
      viteSource.indexOf("function sameLiveAdapterIdentity"),
    );
    expect(runnerPath).toContain("resolveMcpSafeSummaryLiveAdapterHostV8(");
    expect(runnerPath).toContain("dependencies.authorizationRequestConfig?.canonicalResource");
    expect(runnerPath).not.toContain("headerValue(req.headers.host)");
  });

  it("uses opaque in-memory MCP bearers instead of Clerk operator credentials for tools/call", () => {
    const viteSource = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    const runnerPath = viteSource.slice(
      viteSource.indexOf("async function buildProductionMcpSafeSummaryLiveAdapterRunner"),
      viteSource.indexOf("function sameLiveAdapterIdentity"),
    );

    expect(runnerPath).toContain('randomBytes(32).toString("base64url")');
    expect(runnerPath).toContain("identityByAccessTokenDigest.set(hashSubject(mcpBearerCredentials.A), identityA)");
    expect(runnerPath).toContain("identityByAccessTokenDigest.set(hashSubject(mcpBearerCredentials.B), identityB)");
    expect(runnerPath).toContain("bearerCredential: mcpBearerCredentials[input.role]");
    expect(runnerPath).not.toContain("identityByAccessTokenDigest.set(hashSubject(credential), identity)");
  });

  it("authorizes the controlled proof from any two authenticated distinct operators", () => {
    const viteSource = readFileSync(resolve(process.cwd(), "vite.config.ts"), "utf8");
    const submissionAuthPath = viteSource.slice(
      viteSource.indexOf("async function readAuthorizedControlledProofOperatorIdentityKey"),
      viteSource.indexOf("async function buildProductionMcpSafeSummaryLiveAdapterRunner"),
    );
    const runnerPath = viteSource.slice(
      viteSource.indexOf("async function buildProductionMcpSafeSummaryLiveAdapterRunner"),
      viteSource.indexOf("function sameLiveAdapterIdentity"),
    );

    expect(submissionAuthPath).toContain("isValidControlledProofAuthenticatedIdentity(identity)");
    expect(submissionAuthPath).toContain("${identity.issuer}\\u0000${identity.subject}");
    expect(submissionAuthPath).not.toContain("readControlledProofOwnerConfig");
    expect(submissionAuthPath).not.toContain("readPrivateBetaSubjectDigestEnv");
    expect(runnerPath).toContain("sameLiveAdapterIdentity(identityA, identityB)");
    expect(runnerPath).toContain("allowedSubjectDigests: Object.freeze([");
    expect(runnerPath).toContain("hashSubject(identityA.subject)");
    expect(runnerPath).toContain("hashSubject(identityB.subject)");
    expect(runnerPath).toContain("config: proofConfig");
    expect(runnerPath).not.toContain("readControlledProofOwnerConfig");
  });

  it("classifies only allowlisted first-call fields and drops free text and sensitive values", () => {
    const sensitive = "raw-bearer-or-private-identity-sentinel";
    const routeDiagnostic = classifyMcpSafeSummaryToolsCallResponseV8({
      handled: true,
      status: 403,
      headers: {},
      json: {
        reason: "invalid_host",
        message: sensitive,
        bearer: sensitive,
        digest: sensitive,
        refId: sensitive,
      },
    });
    const rpcDiagnostic = classifyMcpSafeSummaryToolsCallResponseV8({
      handled: true,
      status: 400,
      headers: {},
      json: {
        jsonrpc: "2.0",
        id: sensitive,
        error: { code: -32_600, message: sensitive, data: sensitive },
      },
    });
    const unknownDiagnostic = classifyMcpSafeSummaryToolsCallResponseV8({
      handled: true,
      status: 418,
      headers: {},
      json: { reason: sensitive, message: sensitive },
    });

    expect(routeDiagnostic).toEqual({
      kind: "mcp_safe_summary_first_tools_call_diagnostic",
      step: "FIRST_TOOLS_CALL",
      failureKind: "ROUTE_REJECTED",
      httpStatus: 403,
      publicReason: "invalid_host",
      safeForLogging: true,
      version: 1,
    });
    expect(rpcDiagnostic).toMatchObject({
      failureKind: "JSON_RPC_ERROR",
      httpStatus: 400,
      jsonRpcCode: -32_600,
    });
    expect(unknownDiagnostic).toMatchObject({
      failureKind: "RESULT_MALFORMED",
      httpStatus: 418,
    });
    expect(JSON.stringify([routeDiagnostic, rpcDiagnostic, unknownDiagnostic])).not.toContain(sensitive);
  });

  it("requires two ephemeral operator bearers and executes exactly eight handler calls", async () => {
    const baseline = fullSnapshot();
    const postSeed = validPostSeedSnapshot();
    const input = inputFor(baseline, postSeed);
    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(true);
    expect(result.completed).toBe(false);
    expect(result.proof.staticProof.kind).toBe("STATIC_ONLY");
    expect(result.proof.sequence).toMatchObject({
      protectedCallCount: 8,
      seedCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
      cleanupCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
      recovery: "RECOVERED",
      baseline: "ACCEPTED",
      postSeedDelta: "ACCEPTED",
    });
    expect(input.callToolsCall).toHaveBeenCalledTimes(8);
    expect(input.verifyOperatorCredential).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(result)).not.toContain("operator-a-synthetic");
    expect(JSON.stringify(result)).not.toContain("operator-b-synthetic");
  });

  it("validates the public V2 tools/call result while keeping delta counts server-only", async () => {
    const baseline = fullSnapshot();
    const postSeed = validPostSeedSnapshot();
    const input = inputFor(baseline, postSeed);
    input.callToolsCall = vi.fn(async ({ role, toolName }) => ({
      jsonrpc: "2.0",
      id: `${role}:${toolName}`,
      result: {
        structuredContent: {
          kind: "mcp_readonly_summary_result",
          status: "OK",
          toolName,
          freshness: "FRESH",
          data: {},
          nextActionCode: "ready_for_review",
          version: 2,
        },
      },
    }));

    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(true);
    expect(result.proof.sequence).toMatchObject({
      protectedCallCount: 8,
      postSeedDelta: "ACCEPTED",
    });
    expect(input.callToolsCall).toHaveBeenCalledTimes(8);
    expect(input.readPostSeed).toHaveBeenCalledTimes(8);
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

  it("accepts latest-package replacement counts for a populated account A", () => {
    const baseline = fullSnapshot({
      "A.twoweeks.application_package.summarize": {
        packages: 3,
        artifacts: 8,
        provenanceLinks: 7,
        reviewItems: 6,
        warnings: 4,
        blockers: 1,
      },
    });
    const expectedPostSeed = validPostSeedSnapshot();
    const postSeed = replaceSummary(
      expectedPostSeed,
      "A",
      "twoweeks.application_package.summarize",
      {
        ...expectedPostSeed.A["twoweeks.application_package.summarize"],
        safeCounts: snapshot("twoweeks.application_package.summarize", {
          packages: 4,
          artifacts: 2,
          provenanceLinks: 2,
          reviewItems: 1,
          warnings: 0,
          blockers: 0,
        }).safeCounts,
        packageRef: { status: "available", count: 4 },
      },
    );

    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, postSeed)).toMatchObject({
      accepted: true,
    });

    const wrongPackageState = replaceSummary(
      postSeed,
      "A",
      "twoweeks.application_package.summarize",
      {
        ...postSeed.A["twoweeks.application_package.summarize"],
        safeCategories: {
          packageStatus: "ready_for_review",
          resumeVariantArtifactStatus: "draft",
          coverLetterArtifactStatus: "needs_review",
          version: 1,
        },
      },
    );
    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, wrongPackageState)).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
      diagnostic: {
        check: "DERIVED_METADATA",
        toolName: "twoweeks.application_package.summarize",
      },
    });
  });

  it("accepts bounded stale-source changes caused by advancing the latest package", () => {
    const baseline = fullSnapshot({
      "A.twoweeks.evidence_graph.summarize": {
        sourceDocuments: 2,
        candidateFacts: 1,
        approvedFacts: 1,
      },
    });
    const expectedPostSeed = validPostSeedSnapshot();
    const postSeed = replaceSummary(
      expectedPostSeed,
      "A",
      "twoweeks.evidence_graph.summarize",
      snapshot("twoweeks.evidence_graph.summarize", {
        sourceDocuments: 3,
        candidateFacts: 2,
        approvedFacts: 2,
        provenanceLinks: 2,
        allowedClaims: 1,
        staleSources: 3,
        warnings: 3,
      }),
    );

    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, postSeed)).toMatchObject({
      accepted: true,
    });

    const warningMismatch = replaceSummary(
      postSeed,
      "A",
      "twoweeks.evidence_graph.summarize",
      snapshot("twoweeks.evidence_graph.summarize", {
        sourceDocuments: 3,
        candidateFacts: 2,
        approvedFacts: 2,
        provenanceLinks: 2,
        allowedClaims: 1,
        staleSources: 3,
        warnings: 2,
      }),
    );
    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, warningMismatch)).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
      diagnostic: {
        check: "COUNT_DELTA",
        countKey: "warnings",
        expected: 3,
        actual: 2,
      },
    });
  });

  it("rejects absent deltas, saturation, and concurrent B drift", async () => {
    const baseline = fullSnapshot();
    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, undefined)).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
      diagnostic: {
        kind: "mcp_safe_summary_post_seed_delta_diagnostic",
        step: "POST_SEED_DELTA",
        check: "SNAPSHOT_SHAPE",
        safeForLogging: true,
      },
    });
    const malformedCounts = replaceSummary(
      validPostSeedSnapshot(),
      "A",
      "twoweeks.evidence_graph.summarize",
      {
        ...validPostSeedSnapshot().A["twoweeks.evidence_graph.summarize"],
        safeCounts: {
          ...(validPostSeedSnapshot().A["twoweeks.evidence_graph.summarize"].safeCounts as object),
          unexpectedCount: 1,
        },
      },
    );
    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, malformedCounts)).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
      diagnostic: {
        check: "COUNT_SHAPE",
        role: "A",
        toolName: "twoweeks.evidence_graph.summarize",
      },
    });
    const malformedSummary = {
      ...validPostSeedSnapshot(),
      B: {
        ...validPostSeedSnapshot().B,
        "twoweeks.review_cockpit.summarize": undefined,
      },
    } as unknown as McpSafeSummarySnapshotV8;
    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, malformedSummary)).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
      diagnostic: {
        check: "SNAPSHOT_SHAPE",
        role: "B",
        toolName: "twoweeks.review_cockpit.summarize",
      },
    });
    expect(validateMcpSafeSummaryBaselineV8(fullSnapshot({
      "A.twoweeks.evidence_graph.summarize": { sourceDocuments: 99 },
      "A.twoweeks.resume_variant_plan.summarize": { plans: 99 },
      "A.twoweeks.review_cockpit.summarize": { reviewArtifacts: 99 },
    }))).toMatchObject({ accepted: false, reason: "BASELINE_SATURATED" });

    expect(validateMcpSafeSummaryBaselineV8(fullSnapshot({
      "A.twoweeks.application_package.summarize": { packages: 100 },
    }))).toMatchObject({ accepted: false, reason: "BASELINE_SATURATED" });

    expect(validateMcpSafeSummaryBaselineV8(fullSnapshot({
      "B.twoweeks.evidence_graph.summarize": { sourceDocuments: 99 },
    }))).toMatchObject({ accepted: true });

    const drifted = fullSnapshot({ "B.twoweeks.review_cockpit.summarize": { reviewArtifacts: 1 } });
    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, drifted)).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
      diagnostic: {
        check: "UNEXPECTED_CHANGE",
        role: "B",
        toolName: "twoweeks.review_cockpit.summarize",
      },
    });

    const expectedPostSeed = validPostSeedSnapshot();
    const countMismatch = replaceSummary(
      expectedPostSeed,
      "A",
      "twoweeks.evidence_graph.summarize",
      snapshot("twoweeks.evidence_graph.summarize", {
        sourceDocuments: 2,
        candidateFacts: 1,
        approvedFacts: 1,
        provenanceLinks: 2,
        allowedClaims: 1,
      }),
    );
    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, countMismatch)).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
      diagnostic: {
        check: "COUNT_DELTA",
        role: "A",
        toolName: "twoweeks.evidence_graph.summarize",
        countKey: "sourceDocuments",
        expected: 1,
        actual: 2,
      },
    });

    const rejectedResult = await buildMcpSafeSummaryLiveAdapterV8(
      inputFor(baseline, countMismatch),
    ).run();
    expect(rejectedResult.proof.sequence).toMatchObject({
      outcome: "STOPPED",
      postSeedDelta: "REJECTED",
      postSeedDiagnostic: {
        check: "COUNT_DELTA",
        role: "A",
        toolName: "twoweeks.evidence_graph.summarize",
        countKey: "sourceDocuments",
        expected: 1,
        actual: 2,
      },
    });
  });

  it("accepts only the explicit derived metadata changes from seeding evidence, resume, and review", () => {
    const baseline = fullSnapshot();
    const baselineWithMetadata = replaceSummary(
      replaceSummary(
        replaceSummary(baseline, "A", "twoweeks.evidence_graph.summarize", {
          ...baseline.A["twoweeks.evidence_graph.summarize"],
          status: "no_data_available",
          evidenceGraphRef: { status: "no_data_available", count: 0 },
          safeCategories: { version: 1 },
          missingDataReason: "evidence_graph_not_available",
        }),
        "A",
        "twoweeks.resume_variant_plan.summarize",
        {
          ...baseline.A["twoweeks.resume_variant_plan.summarize"],
          status: "no_data_available",
          resumeVariantPlanRef: { status: "no_data_available", count: 0 },
          safeCategories: { version: 1 },
          missingDataReason: "resume_variant_plan_not_available",
        },
      ),
      "A",
      "twoweeks.review_cockpit.summarize",
      {
        ...baseline.A["twoweeks.review_cockpit.summarize"],
        status: "no_data_available",
        reviewCockpitRef: { status: "no_data_available", count: 0 },
        safeCategories: { version: 1 },
        safeFlags: { approvalNeeded: false, staleData: false, overLimit: false, version: 1 },
        missingDataReason: "review_cockpit_not_available",
      },
    );
    const postSeedWithMetadata = replaceSummary(
      replaceSummary(
        replaceSummary(validPostSeedSnapshot(), "A", "twoweeks.evidence_graph.summarize", {
          ...validPostSeedSnapshot().A["twoweeks.evidence_graph.summarize"],
          status: "available",
          evidenceGraphRef: { status: "available", count: 2, updatedAt: "2026-07-25T00:00:00.000Z" },
          safeCategories: { evidenceCoverage: "partial", version: 1 },
          updatedAt: "2026-07-25T00:00:00.000Z",
        }),
        "A",
        "twoweeks.resume_variant_plan.summarize",
        {
          ...validPostSeedSnapshot().A["twoweeks.resume_variant_plan.summarize"],
          status: "available",
          resumeVariantPlanRef: { status: "available", count: 1, updatedAt: "2026-07-25T00:00:00.000Z" },
          safeCategories: { planStatus: "needs_review", version: 1 },
          updatedAt: "2026-07-25T00:00:00.000Z",
        },
      ),
      "A",
      "twoweeks.review_cockpit.summarize",
      {
        ...validPostSeedSnapshot().A["twoweeks.review_cockpit.summarize"],
        status: "available",
        reviewCockpitRef: { status: "available", count: 1, updatedAt: "2026-07-25T00:00:00.000Z" },
        safeCategories: { reviewReadiness: "needs_user_review", version: 1 },
        safeFlags: { approvalNeeded: true, staleData: false, overLimit: false, version: 1 },
        updatedAt: "2026-07-25T00:00:00.000Z",
      },
    );

    expect(validateMcpSafeSummaryPostSeedDeltasV8(
      baselineWithMetadata,
      postSeedWithMetadata,
    )).toMatchObject({ accepted: true });
  });

  it.each([
    {
      name: "boolean drift",
      mutate: (summary: Readonly<Record<string, unknown>>) => ({
        ...summary,
        safeFlags: {
          ...(summary.safeFlags as Record<string, unknown>),
          approvalNeeded: false,
        },
      }),
    },
    {
      name: "extra key",
      mutate: (summary: Readonly<Record<string, unknown>>) => ({
        ...summary,
        safeFlags: {
          ...(summary.safeFlags as Record<string, unknown>),
          unexpected: true,
        },
      }),
    },
  ])("rejects review safeFlags $name instead of dropping the block", ({ mutate }) => {
    const baseline = fullSnapshot();
    const postSeed = validPostSeedSnapshot();
    const driftedPost = replaceSummary(
      postSeed,
      "A",
      "twoweeks.review_cockpit.summarize",
      mutate(postSeed.A["twoweeks.review_cockpit.summarize"]),
    );

    expect(validateMcpSafeSummaryPostSeedDeltasV8(baseline, driftedPost)).toMatchObject({
      accepted: false,
      reason: "BASELINE_DRIFT",
    });
  });

  it.each([
    {
      toolName: "twoweeks.evidence_graph.summarize" as const,
      baselineFields: { capabilities: { dataReads: "convex_evidence_graph_summary", version: 1 } },
      postSeedFields: { capabilities: { dataReads: "unexpected_read", version: 1 } },
    },
    {
      toolName: "twoweeks.resume_variant_plan.summarize" as const,
      baselineFields: { availability: { source: "convex_resume_variant_plan_summary", version: 1 } },
      postSeedFields: { availability: { source: "unexpected_source", version: 1 } },
    },
    {
      toolName: "twoweeks.review_cockpit.summarize" as const,
      baselineFields: { kind: "mcp_review_cockpit_summary_result" },
      postSeedFields: { kind: "unexpected_summary_kind" },
    },
  ])("rejects non-derived A drift for $toolName", ({
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
    { name: "seed reject", seed: async () => Promise.reject(new Error("seed rejected")) },
    {
      name: "seed throw",
      seed: async () => {
        throw new Error("seed thrown");
      },
    },
  ])("maps $name to SEED_FAILED and recovers without protected calls", async ({ seed }) => {
    const input = inputFor(fullSnapshot(), validPostSeedSnapshot());
    input.seedA = vi.fn(seed);

    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.proof.sequence).toMatchObject({
      outcome: "STOPPED",
      stopCode: "SEED_FAILED",
      protectedCallCount: 0,
      seedCount: 0,
      cleanupCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
      recovery: "RECOVERED",
      baseline: "ACCEPTED",
      postSeedDelta: "REJECTED",
    });
    expect(input.callToolsCall).not.toHaveBeenCalled();
    expect(input.cleanupA).toHaveBeenCalledTimes(1);
    expect(input.recover).toHaveBeenCalledTimes(1);
  });

  it.each([
    {
      name: "JSON-RPC error",
      response: {
        jsonrpc: "2.0",
        id: "v8-error",
        error: { code: -32_000, message: "synthetic failure" },
      },
      expectedDiagnostic: {
        failureKind: "JSON_RPC_ERROR",
        httpStatus: 200,
        jsonRpcCode: -32_000,
      },
    },
    {
      name: "absent result",
      response: { jsonrpc: "2.0", id: "v8-absent" },
      expectedDiagnostic: {
        failureKind: "RESULT_MALFORMED",
        httpStatus: 200,
      },
    },
    {
      name: "malformed result",
      response: { jsonrpc: "2.0", id: "v8-malformed", result: { structuredContent: null } },
      expectedDiagnostic: {
        failureKind: "RESULT_MALFORMED",
        httpStatus: 200,
      },
    },
  ])("rejects $name tools/call envelopes", async ({ response, expectedDiagnostic }) => {
    const baseline = fullSnapshot();
    const input = inputFor(baseline, validPostSeedSnapshot());
    input.callToolsCall = vi.fn(async () => response);

    const result = await buildMcpSafeSummaryLiveAdapterV8(input).run();

    expect(result.sequenceCompleted).toBe(false);
    expect(result.proof.sequence).toMatchObject({
      outcome: "STOPPED",
      stopCode: "PROTECTED_CALL_FAILED",
      protectedCallCount: 1,
      seedCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
      cleanupCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
      recovery: "RECOVERED",
      baseline: "ACCEPTED",
      postSeedDelta: "REJECTED",
      firstToolsCallDiagnostic: {
        kind: "mcp_safe_summary_first_tools_call_diagnostic",
        step: "FIRST_TOOLS_CALL",
        ...expectedDiagnostic,
        safeForLogging: true,
        version: 1,
      },
    });
    expect(input.readPostSeed).not.toHaveBeenCalled();
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
      seedCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
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
      seedCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
      cleanupCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
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
    const postSeed = validPostSeedSnapshot();
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
    const postSeed = validPostSeedSnapshot();
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
      seedCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
      cleanupCount: MCP_SAFE_SUMMARY_CONTROLLED_FIXTURE_COUNT,
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
    const localHostHandler = buildMcpSafeSummaryLiveAdapterHandlerV8({
      config,
      dependencies,
      host: "127.0.0.1:5196",
      remoteAddress: "127.0.0.1",
    });
    const responses: unknown[] = [];

    expect(config.preflight.decision).toBe("ready_to_wire");
    const localHostResponse = await localHostHandler({
      role: "A",
      bearerCredential: TEST_BEARER_A,
      toolName: "twoweeks.application_package.summarize",
      reference: { id: TOOL_METADATA["twoweeks.application_package.summarize"].refId },
    });
    expect(localHostResponse).toEqual({
      kind: "mcp_safe_summary_live_adapter_call_failure",
      diagnostic: {
        kind: "mcp_safe_summary_first_tools_call_diagnostic",
        step: "FIRST_TOOLS_CALL",
        failureKind: "ROUTE_REJECTED",
        httpStatus: 403,
        publicReason: "invalid_host",
        safeForLogging: true,
        version: 1,
      },
      version: 1,
    });
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
    expect(responses[0]).toMatchObject({
      kind: "mcp_safe_summary_live_adapter_call_response",
      httpStatus: 200,
      json: { jsonrpc: "2.0" },
      version: 1,
    });
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
      "json" in response &&
      typeof response.json === "object" &&
      response.json !== null &&
      "result" in response.json &&
      !("error" in response.json)
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
