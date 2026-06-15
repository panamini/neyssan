import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { internalSummarizeMcpResumeVariantPlan } from "../mcpResumeVariantPlanSummary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SUMMARY_SOURCE_FILE = resolve(
  TEST_DIR,
  "../mcpResumeVariantPlanSummary.ts",
);
const NOW = Date.UTC(2026, 5, 15, 12, 0, 0, 0);
const TEST_QUERY_READ_LIMIT = 101;

type TableName = "userProfiles" | "applicationArtifacts";
type Constraint = Readonly<{ field: string; value: unknown }>;
type StoredDocument = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};
type QueryCallLog = {
  collectCalls: number;
  takeLimits: number[];
  tableNames: string[];
};

function resumeVariantPlanRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcp-safe-ref:resume-variant-plan:latest",
    label: "Resume variant plan availability",
    status: "available",
    category: "resume_variant_plan",
    count: 1,
    updatedAt: "2026-06-15T11:59:59.750Z",
    version: 1,
    ...overrides,
  };
}

function makeCtx(seed: Partial<Record<TableName, StoredDocument[]>> = {}) {
  const tables: Record<TableName, StoredDocument[]> = {
    userProfiles: [],
    applicationArtifacts: [],
    ...seed,
  };
  const queryCalls: QueryCallLog = {
    collectCalls: 0,
    takeLimits: [],
    tableNames: [],
  };

  function applyConstraints(
    documents: StoredDocument[],
    constraints: Constraint[],
  ) {
    return documents.filter((doc) =>
      constraints.every(
        (constraint) => readField(doc, constraint.field) === constraint.value,
      ),
    );
  }

  const db = {
    query: (tableName: TableName) => ({
      withIndex: (_indexName: string, buildQuery: (query: any) => unknown) => {
        const constraints: Constraint[] = [];
        const query = {
          eq(field: string, value: unknown) {
            constraints.push({ field, value });
            return query;
          },
        };
        buildQuery(query);
        const matching = applyConstraints(tables[tableName], constraints);
        const orderedMatching = [...matching].sort(
          (left, right) => right._creationTime - left._creationTime,
        );
        queryCalls.tableNames.push(tableName);
        return {
          collect: async () => {
            queryCalls.collectCalls += 1;
            return matching;
          },
          order: () => ({
            collect: async () => {
              queryCalls.collectCalls += 1;
              return matching;
            },
            take: async (limit: number) => {
              queryCalls.takeLimits.push(limit);
              return orderedMatching.slice(0, limit);
            },
          }),
          take: async (limit: number) => {
            queryCalls.takeLimits.push(limit);
            return matching.slice(0, limit);
          },
        };
      },
    }),
  };

  return { ctx: { db }, queryCalls, tables };
}

function readField(doc: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, doc);
}

function profile(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "profile_storage_id_DO_NOT_ECHO",
    _creationTime: NOW,
    clerkId: "clerk_DO_NOT_ECHO",
    email: "real-user@example.test",
    raw_text: "RAW_CV_TEXT_DO_NOT_ECHO",
    updatedAt: NOW,
    ...overrides,
  };
}

function planContent(overrides: Record<string, unknown> = {}) {
  return {
    kind: "resume_variant_plan",
    plan: {
      id: "resume-variant-plan:hash_DO_NOT_ECHO",
      userId: "profile_storage_id_DO_NOT_ECHO",
      applicationContextId: "application-context:hash_DO_NOT_ECHO",
      evidenceGraphId: "evidence-graph:hash_DO_NOT_ECHO",
      evidenceGraphHash: "hash_DO_NOT_ECHO",
      targetDocumentKind: "resume",
      language: "en",
      market: "global",
      items: [
        {
          id: "resume-variant-plan-item:skills:add_DO_NOT_ECHO",
          section: "skills",
          action: "add_from_allowed_claim",
          priority: "required",
          reviewState: "pending",
          allowedClaimIds: ["allowed-claim:typescript_DO_NOT_ECHO"],
          candidateFactIds: ["candidate-fact:typescript_DO_NOT_ECHO"],
          evidenceMatchIds: ["evidence-match:typescript_DO_NOT_ECHO"],
          demandIds: ["demand:typescript_DO_NOT_ECHO"],
          riskFlagIds: [],
          reason: "source quote",
          version: 1,
        },
        {
          id: "resume-variant-plan-item:other:block_DO_NOT_ECHO",
          section: "other",
          action: "block",
          priority: "required",
          reviewState: "blocked",
          allowedClaimIds: [],
          candidateFactIds: [],
          evidenceMatchIds: [],
          demandIds: ["demand:missing_DO_NOT_ECHO"],
          riskFlagIds: ["risk:private_DO_NOT_ECHO"],
          reason: "private fact detail",
          version: 1,
        },
      ],
      warnings: [
        {
          id: "resume-variant-plan-warning:missing_DO_NOT_ECHO",
          category: "missing_evidence",
          severity: "blocker",
          demandId: "demand:missing_DO_NOT_ECHO",
          reason: "source quote",
          version: 1,
        },
        {
          id: "resume-variant-plan-warning:private_DO_NOT_ECHO",
          category: "private_fact",
          severity: "blocker",
          candidateFactId: "candidate-fact:private_DO_NOT_ECHO",
          reason: "private fact detail",
          version: 1,
        },
      ],
      blockedClaimIds: ["blocked-claim:private_DO_NOT_ECHO"],
      sourceFactIds: ["candidate-fact:typescript_DO_NOT_ECHO"],
      allowedClaimIds: ["allowed-claim:typescript_DO_NOT_ECHO"],
      riskFlagIds: ["risk:private_DO_NOT_ECHO"],
      blocked: true,
      blockedReason: "private fact detail",
      createdAt: NOW - 500,
      updatedAt: NOW - 250,
      version: 1,
      ...overrides,
    },
    version: 1,
  };
}

function artifact(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "artifact_storage_id_DO_NOT_ECHO",
    _creationTime: NOW - 250,
    id: "application-artifact:resume-plan_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    contextId: "application-context:hash_DO_NOT_ECHO",
    runId: "application-run:hash_DO_NOT_ECHO",
    type: "resume_variant_plan",
    status: "needs_review",
    title: "Resume Variant Plan RAW_RESUME_TEXT_DO_NOT_ECHO",
    content: planContent(),
    textPreview: "generated resume variant content",
    sourceHashes: {
      contextHash: "context-hash_DO_NOT_ECHO",
      evidenceGraphHash: "evidence-hash_DO_NOT_ECHO",
      generatorInputHash: "generator-input_DO_NOT_ECHO",
    },
    provenance: {
      jobId: "job_DO_NOT_ECHO",
      cvId: "cv_DO_NOT_ECHO",
      evidenceGraphId: "evidence-graph:hash_DO_NOT_ECHO",
      sourceFactIds: ["candidate-fact:typescript_DO_NOT_ECHO"],
    },
    sourceRefs: [
      {
        sourceType: "cv",
        sourceId: "candidate-source-document:hash_DO_NOT_ECHO",
        sourcePath: "sourceText",
        sourceHash: "source-hash_DO_NOT_ECHO",
      },
    ],
    createdAt: NOW - 500,
    updatedAt: NOW - 250,
    version: 1,
    ...overrides,
  };
}

function assertSafeResult(result: unknown): void {
  const serialized = JSON.stringify(result);
  for (const fragment of [
    "artifact_storage_id_DO_NOT_ECHO",
    "profile_storage_id_DO_NOT_ECHO",
    "application-artifact:resume-plan_DO_NOT_ECHO",
    "application-context:hash_DO_NOT_ECHO",
    "application-run:hash_DO_NOT_ECHO",
    "resume-variant-plan:hash_DO_NOT_ECHO",
    "evidence-graph:hash_DO_NOT_ECHO",
    "candidate-fact:typescript_DO_NOT_ECHO",
    "allowed-claim:typescript_DO_NOT_ECHO",
    "demand:typescript_DO_NOT_ECHO",
    "risk:private_DO_NOT_ECHO",
    "clerk_DO_NOT_ECHO",
    "real-user@example.test",
    "RAW_CV_TEXT_DO_NOT_ECHO",
    "RAW_RESUME_TEXT_DO_NOT_ECHO",
    "generated resume variant content",
    "sourceText",
    "source quote",
    "private fact detail",
    "j97convexdocumentid",
  ] as const) {
    expect(serialized).not.toContain(fragment);
  }
}

function stripStringAndPatternLiterals(source: string): string {
  return source
    .replace(/\/(?:\\.|[^/\\\n])+\//gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR62 Convex resume variant plan summary", () => {
  it("returns onboarding safe metadata when the owner profile is missing", async () => {
    const { ctx } = makeCtx();

    const result = await internalSummarizeMcpResumeVariantPlan._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        resumeVariantPlanRef: resumeVariantPlanRef({
          status: "onboarding_required",
          count: 0,
        }),
      },
    );

    expect(result).toMatchObject({
      kind: "mcp_resume_variant_plan_summary_result",
      allowed: true,
      status: "onboarding_required",
      missingDataReason: "owner_onboarding_required",
      resumeVariantPlanRef: {
        id: "mcp-safe-ref:resume-variant-plan:latest",
        status: "onboarding_required",
        category: "resume_variant_plan",
        count: 0,
      },
      safeCounts: {
        plans: 0,
        planItems: 0,
        warnings: 0,
        blockers: 0,
      },
      capabilities: {
        ownerResolution: "blocked",
        dataReads: "convex_resume_variant_plan_summary",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
      },
      modelVisible: true,
      version: 1,
    });
    assertSafeResult(result);
  });

  it("returns only safe resume variant plan status and aggregate metadata", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      applicationArtifacts: [artifact()],
    });

    const result = await internalSummarizeMcpResumeVariantPlan._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        resumeVariantPlanRef: resumeVariantPlanRef(),
      },
    );

    expect(result).toEqual({
      kind: "mcp_resume_variant_plan_summary_result",
      allowed: true,
      status: "available",
      resumeVariantPlanRef: {
        id: "mcp-safe-ref:resume-variant-plan:latest",
        label: "Resume variant plan availability",
        status: "available",
        category: "resume_variant_plan",
        count: 1,
        updatedAt: "2026-06-15T11:59:59.750Z",
        version: 1,
      },
      availability: {
        source: "convex_resume_variant_plan_summary",
        ownerState: "resolved",
        version: 1,
      },
      safeCounts: {
        plans: 1,
        planItems: 2,
        claimBackedItems: 1,
        missingInputItems: 1,
        reviewNeededItems: 1,
        acceptedItems: 0,
        rejectedItems: 0,
        blockedItems: 1,
        warnings: 2,
        blockers: 3,
        restrictedFactBlockers: 1,
        excludedFactBlockers: 0,
        artifactTextBlockers: 0,
        allowedClaims: 1,
        sourceFacts: 1,
        evidenceMatches: 1,
        demands: 2,
        riskFlags: 1,
        version: 1,
      },
      safeCategories: {
        planStatus: "blocked",
        targetDocumentKind: "resume",
        tailoringCompleteness: "partial",
        blockerCategory: "missing_evidence",
        missingInputCategory: "missing_evidence",
        reviewNeededCategory: "blocked",
        nextReviewHint: "review_blockers",
        version: 1,
      },
      updatedAt: "2026-06-15T11:59:59.750Z",
      capabilities: {
        ownerResolution: "server_only",
        dataReads: "convex_resume_variant_plan_summary",
        dataWrites: "blocked",
        handlerExecution: "blocked",
        productionConnector: "blocked",
        networkAccess: "blocked",
        modelCalls: "blocked",
        writeActions: "blocked",
        rawDataProjection: "blocked",
        version: 1,
      },
      modelVisible: true,
      version: 1,
    });
    assertSafeResult(result);
  });

  it("returns safe no-data state when no resume variant plan artifacts exist", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
    });

    const result = await internalSummarizeMcpResumeVariantPlan._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        resumeVariantPlanRef: resumeVariantPlanRef(),
      },
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "no_data_available",
      missingDataReason: "resume_variant_plan_not_available",
      safeCounts: {
        plans: 0,
        planItems: 0,
        warnings: 0,
        blockers: 0,
      },
    });
    assertSafeResult(result);
  });

  it("uses bounded reads and clamps over-limit aggregate counts", async () => {
    const artifacts = Array.from({ length: 120 }, (_, index) =>
      artifact({
        _id: `artifact_${index}_DO_NOT_ECHO`,
        id: `application-artifact:${index}_DO_NOT_ECHO`,
        _creationTime: NOW - index,
        updatedAt: NOW - index,
      }),
    );
    const { ctx, queryCalls } = makeCtx({
      userProfiles: [profile()],
      applicationArtifacts: artifacts,
    });

    const result = await internalSummarizeMcpResumeVariantPlan._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        resumeVariantPlanRef: resumeVariantPlanRef({ count: 100 }),
      },
    );

    expect(queryCalls.collectCalls).toBe(0);
    expect(queryCalls.takeLimits.length).toBeGreaterThanOrEqual(2);
    expect(
      queryCalls.takeLimits.every((limit) => limit === TEST_QUERY_READ_LIMIT),
    ).toBe(true);
    expect(result).toMatchObject({
      allowed: true,
      status: "available",
      resumeVariantPlanRef: {
        count: 100,
      },
      safeCounts: {
        plans: 100,
      },
    });
    assertSafeResult(result);
  });

  it("orders before bounded take so the latest artifact remains in scope", async () => {
    const staleArtifacts = Array.from({ length: 120 }, (_, index) =>
      artifact({
        _id: `stale_artifact_${index}_DO_NOT_ECHO`,
        id: `application-artifact:stale-${index}_DO_NOT_ECHO`,
        _creationTime: NOW - 10_000 - index,
        updatedAt: NOW - 10_000 - index,
      }),
    );
    const latestArtifact = artifact({
      _id: "latest_artifact_DO_NOT_ECHO",
      id: "application-artifact:latest_DO_NOT_ECHO",
      _creationTime: NOW,
      updatedAt: NOW,
      status: "approved",
      content: planContent({
        items: [
          {
            id: "resume-variant-plan-item:skills:accepted_DO_NOT_ECHO",
            section: "skills",
            action: "add_from_allowed_claim",
            priority: "required",
            reviewState: "accepted",
            allowedClaimIds: ["allowed-claim:accepted_DO_NOT_ECHO"],
            candidateFactIds: ["candidate-fact:accepted_DO_NOT_ECHO"],
            evidenceMatchIds: ["evidence-match:accepted_DO_NOT_ECHO"],
            demandIds: ["demand:accepted_DO_NOT_ECHO"],
            riskFlagIds: [],
            reason: "source quote",
            version: 1,
          },
        ],
        warnings: [],
        riskFlagIds: [],
        blocked: false,
        blockedReason: undefined,
      }),
    });
    const { ctx, queryCalls } = makeCtx({
      userProfiles: [profile()],
      applicationArtifacts: [...staleArtifacts, latestArtifact],
    });

    const result = await internalSummarizeMcpResumeVariantPlan._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        resumeVariantPlanRef: resumeVariantPlanRef({ count: 100 }),
      },
    );

    expect(queryCalls.collectCalls).toBe(0);
    expect(
      queryCalls.takeLimits.every((limit) => limit === TEST_QUERY_READ_LIMIT),
    ).toBe(true);
    expect(result).toMatchObject({
      allowed: true,
      status: "available",
      updatedAt: "2026-06-15T12:00:00.000Z",
      safeCategories: {
        planStatus: "ready_for_review",
        nextReviewHint: "ready_for_review",
      },
    });
    assertSafeResult(result);
  });

  it("ignores raw artifact text while summarizing malformed content safely", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      applicationArtifacts: [
        artifact({
          content: {
            rawResumeText: "RAW_RESUME_TEXT_DO_NOT_ECHO",
            generatedResumeVariantContent: "generated resume variant content",
            _id: "j97convexdocumentid",
          },
          updatedAt: NOW - 1,
        }),
      ],
    });

    const result = await internalSummarizeMcpResumeVariantPlan._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        resumeVariantPlanRef: resumeVariantPlanRef(),
      },
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "available",
      safeCounts: {
        plans: 1,
        planItems: 0,
        warnings: 0,
      },
      safeCategories: {
        tailoringCompleteness: "missing",
        missingInputCategory: "missing_claims",
      },
    });
    assertSafeResult(result);
  });

  it("does not add runtime wiring, writes, network, model calls, or PR63 behavior", () => {
    const source = readFileSync(SUMMARY_SOURCE_FILE, "utf8");
    expect(source).toContain("internalQuery");
    expect(source).toContain("take(QUERY_READ_LIMIT)");
    expect(source).not.toContain(".collect(");
    expect(source).not.toContain("internalMutation");
    expect(source).not.toContain("mutation(");
    expect(source).not.toContain("ctx.db.insert");
    expect(source).not.toContain("ctx.db.patch");
    expect(source).not.toContain("ctx.db.delete");
    expect(source).not.toContain("tools/list");
    expect(source).not.toContain("tools/call");
    expect(source).not.toContain("review_cockpit");
    expect(source).not.toContain("reviewCockpit");

    const sourceWithoutLiterals = stripStringAndPatternLiterals(source);
    expect(sourceWithoutLiterals).not.toMatch(
      /\bfetch\s*\(|XMLHttpRequest|axios|OpenAI|chat\.completions|responses\.create|LLM/u,
    );
    expect(sourceWithoutLiterals).not.toMatch(
      /\b(?:OAuth|oauth|token|bearer|refresh|revocation|callback|Stytch|providerSubject|claims|JWKS|issuer|audience)\b/u,
    );
    expect(sourceWithoutLiterals).not.toMatch(
      /\b(?:exportArtifact|download|sendApplication|submitApplication|applyToJob)\b/u,
    );
  });
});
