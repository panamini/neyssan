import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { internalSummarizeMcpReviewCockpit } from "../mcpReviewCockpitSummary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SUMMARY_SOURCE_FILE = resolve(TEST_DIR, "../mcpReviewCockpitSummary.ts");
const NOW = Date.UTC(2026, 5, 15, 12, 0, 0, 0);
const TEST_QUERY_READ_LIMIT = 101;

type TableName =
  | "userProfiles"
  | "applicationContexts"
  | "applicationRuns"
  | "applicationArtifacts"
  | "applicationPackages"
  | "candidateSourceDocuments"
  | "candidateFacts";
type Constraint = Readonly<{ field: string; value: unknown }>;
type StoredDocument = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};
type QueryCallLog = {
  collectCalls: number;
  takeLimits: number[];
  orderBeforeTake: number;
  tableNames: string[];
};

function reviewCockpitRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcp-safe-ref:review-cockpit:latest",
    label: "Review cockpit availability",
    status: "available",
    category: "review_cockpit",
    count: 3,
    updatedAt: "2026-06-15T11:59:59.750Z",
    version: 1,
    ...overrides,
  };
}

function makeCtx(seed: Partial<Record<TableName, StoredDocument[]>> = {}) {
  const tables: Record<TableName, StoredDocument[]> = {
    userProfiles: [],
    applicationContexts: [],
    applicationRuns: [],
    applicationArtifacts: [],
    applicationPackages: [],
    candidateSourceDocuments: [],
    candidateFacts: [],
    ...seed,
  };
  const queryCalls: QueryCallLog = {
    collectCalls: 0,
    takeLimits: [],
    orderBeforeTake: 0,
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
          order: () => {
            queryCalls.orderBeforeTake += 1;
            return {
              take: async (limit: number) => {
                queryCalls.takeLimits.push(limit);
                return orderedMatching.slice(0, limit);
              },
            };
          },
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

function context(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "context_storage_id_DO_NOT_ECHO",
    _creationTime: NOW - 1_000,
    id: "application-context:hash_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    reviewState: "needs_review",
    sourceRefs: [
      {
        sourceType: "job",
        sourceId: "job_DO_NOT_ECHO",
        sourcePath: "sourceText",
        sourceHash: "job-hash_DO_NOT_ECHO",
      },
    ],
    job: {
      title: "RAW_JOB_DESCRIPTION_DO_NOT_ECHO",
      company: "company_DO_NOT_ECHO",
      rawTextHash: "raw-job-hash_DO_NOT_ECHO",
    },
    createdAt: NOW - 1_000,
    updatedAt: NOW - 1_000,
    version: 1,
    ...overrides,
  };
}

function run(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "run_storage_id_DO_NOT_ECHO",
    _creationTime: NOW - 750,
    id: "application-run:hash_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    contextId: "application-context:hash_DO_NOT_ECHO",
    operation: "plan_resume_variant",
    status: "blocked",
    attemptCount: 1,
    resultIds: ["application-artifact:resume-plan_DO_NOT_ECHO"],
    blockedReason: "source quote",
    error: "RAW_RESUME_TEXT_DO_NOT_ECHO",
    createdAt: NOW - 750,
    updatedAt: NOW - 750,
    version: 1,
    ...overrides,
  };
}

function artifact(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "artifact_storage_id_DO_NOT_ECHO",
    _creationTime: NOW - 500,
    id: "application-artifact:cover_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    contextId: "application-context:hash_DO_NOT_ECHO",
    runId: "application-run:hash_DO_NOT_ECHO",
    type: "cover_letter",
    status: "needs_review",
    title: "Cover letter RAW_RESUME_TEXT_DO_NOT_ECHO",
    content: {
      coverLetter: "coverLetter",
      generatedArtifactContent: "generated artifact content",
      _id: "j97convexdocumentid",
    },
    textPreview: "proposal content",
    sourceHashes: {
      contextHash: "context-hash_DO_NOT_ECHO",
      evidenceGraphHash: "evidence-hash_DO_NOT_ECHO",
    },
    provenance: {
      jobId: "job_DO_NOT_ECHO",
      cvId: "cv_DO_NOT_ECHO",
      evidenceGraphId: "evidence-graph:hash_DO_NOT_ECHO",
      sourceFactIds: ["candidate-fact:typescript_DO_NOT_ECHO"],
    },
    sourceRefs: [
      {
        sourceType: "proposal",
        sourceId: "proposal_DO_NOT_ECHO",
        sourcePath: "sourceText",
      },
    ],
    createdAt: NOW - 500,
    updatedAt: NOW - 500,
    version: 1,
    ...overrides,
  };
}

function applicationPackage(
  overrides: Partial<StoredDocument> = {},
): StoredDocument {
  return {
    _id: "package_storage_id_DO_NOT_ECHO",
    _creationTime: NOW - 250,
    applicationPackageId: "application-package:hash_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    applicationContextId: "application-context:hash_DO_NOT_ECHO",
    status: "needs_review",
    resumeVariantArtifactId: "application-artifact:resume_DO_NOT_ECHO",
    coverLetterArtifactId: "application-artifact:cover_DO_NOT_ECHO",
    sourceFactIds: ["candidate-fact:typescript_DO_NOT_ECHO"],
    allowedClaimIds: ["allowed-claim:typescript_DO_NOT_ECHO"],
    evidenceMatchIds: ["evidence-match:typescript_DO_NOT_ECHO"],
    demandIds: ["demand:typescript_DO_NOT_ECHO"],
    riskFlagIds: ["risk:private_DO_NOT_ECHO"],
    reviewItemIds: [
      "review-item:one_DO_NOT_ECHO",
      "review-item:two_DO_NOT_ECHO",
    ],
    packageHash: "package-hash_DO_NOT_ECHO",
    pkg: {
      id: "application-package:hash_DO_NOT_ECHO",
      warnings: ["source quote"],
      blockedReason: "private fact detail",
    },
    createdAt: NOW - 250,
    updatedAt: NOW - 250,
    version: 1,
    ...overrides,
  };
}

function sourceDocument(
  overrides: Partial<StoredDocument> = {},
): StoredDocument {
  return {
    _id: "source_doc_storage_id_DO_NOT_ECHO",
    _creationTime: NOW,
    id: "candidate-source-document:hash_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    reviewState: "approved",
    visibility: "use_in_applications",
    sourceText: "sourceText",
    rawText: "RAW_CV_TEXT_DO_NOT_ECHO",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function fact(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "fact_storage_id_DO_NOT_ECHO",
    _creationTime: NOW,
    id: "candidate-fact:typescript_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    reviewState: "approved",
    visibility: "use_in_applications",
    sourceQuote: "source quote",
    privateFact: "private fact detail",
    neverUseFact: "never_use fact detail",
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function assertSafeResult(result: unknown): void {
  const serialized = JSON.stringify(result);
  for (const fragment of [
    "artifact_storage_id_DO_NOT_ECHO",
    "profile_storage_id_DO_NOT_ECHO",
    "context_storage_id_DO_NOT_ECHO",
    "run_storage_id_DO_NOT_ECHO",
    "package_storage_id_DO_NOT_ECHO",
    "application-artifact:cover_DO_NOT_ECHO",
    "application-context:hash_DO_NOT_ECHO",
    "application-run:hash_DO_NOT_ECHO",
    "application-package:hash_DO_NOT_ECHO",
    "candidate-fact:typescript_DO_NOT_ECHO",
    "allowed-claim:typescript_DO_NOT_ECHO",
    "demand:typescript_DO_NOT_ECHO",
    "risk:private_DO_NOT_ECHO",
    "clerk_DO_NOT_ECHO",
    "real-user@example.test",
    "RAW_CV_TEXT_DO_NOT_ECHO",
    "RAW_RESUME_TEXT_DO_NOT_ECHO",
    "RAW_JOB_DESCRIPTION_DO_NOT_ECHO",
    "proposal content",
    "coverLetter",
    "generated artifact content",
    "sourceText",
    "source quote",
    "private fact detail",
    "never_use fact detail",
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

describe("PR63 Convex review cockpit summary", () => {
  it("returns onboarding safe metadata when the owner profile is missing", async () => {
    const { ctx } = makeCtx();

    const result = await internalSummarizeMcpReviewCockpit._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        reviewCockpitRef: reviewCockpitRef({
          status: "onboarding_required",
          count: 0,
        }),
      },
    );

    expect(result).toMatchObject({
      kind: "mcp_review_cockpit_summary_result",
      allowed: true,
      status: "onboarding_required",
      missingDataReason: "owner_onboarding_required",
      reviewCockpitRef: {
        id: "mcp-safe-ref:review-cockpit:latest",
        status: "onboarding_required",
        category: "review_cockpit",
        count: 0,
      },
      safeCounts: {
        reviewContexts: 0,
        reviewRuns: 0,
        reviewArtifacts: 0,
        applicationPackages: 0,
      },
      safeFlags: {
        approvalNeeded: false,
        staleData: false,
        overLimit: false,
      },
      capabilities: {
        ownerResolution: "blocked",
        dataReads: "convex_review_cockpit_summary",
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

  it("returns only safe review cockpit status and aggregate metadata", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      applicationContexts: [context()],
      applicationRuns: [
        run(),
        run({
          _id: "run_success_DO_NOT_ECHO",
          id: "application-run:success_DO_NOT_ECHO",
          status: "succeeded",
          _creationTime: NOW - 400,
          updatedAt: NOW - 400,
        }),
      ],
      applicationArtifacts: [
        artifact(),
        artifact({
          _id: "artifact_approved_DO_NOT_ECHO",
          id: "application-artifact:approved_DO_NOT_ECHO",
          status: "approved",
          _creationTime: NOW - 100,
          updatedAt: NOW - 100,
        }),
      ],
      applicationPackages: [applicationPackage()],
      candidateSourceDocuments: [sourceDocument()],
      candidateFacts: [fact()],
    });

    const result = await internalSummarizeMcpReviewCockpit._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        reviewCockpitRef: reviewCockpitRef(),
      },
    );

    expect(result).toEqual({
      kind: "mcp_review_cockpit_summary_result",
      allowed: true,
      status: "available",
      reviewCockpitRef: {
        id: "mcp-safe-ref:review-cockpit:latest",
        label: "Review cockpit availability",
        status: "available",
        category: "review_cockpit",
        count: 5,
        updatedAt: "2026-06-15T11:59:59.900Z",
        version: 1,
      },
      availability: {
        source: "convex_review_cockpit_summary",
        ownerState: "resolved",
        version: 1,
      },
      safeCounts: {
        reviewContexts: 1,
        reviewRuns: 2,
        reviewArtifacts: 2,
        applicationPackages: 1,
        pendingReviews: 3,
        approvedReviews: 1,
        blockedReviews: 1,
        failedRuns: 0,
        blockedRuns: 1,
        blockedArtifacts: 0,
        blockedPackages: 0,
        missingReviewItems: 2,
        approvalNeeded: 5,
        staleInputs: 2,
        overLimitCollections: 0,
        version: 1,
      },
      safeCategories: {
        reviewReadiness: "blocked",
        reviewGateStatus: "blocked",
        blockerCategory: "blocked_run",
        missingReviewCategory: "pending_review_items",
        nextReviewHint: "review_blockers",
        nextUserAction: "review_blockers",
        version: 1,
      },
      safeFlags: {
        approvalNeeded: true,
        staleData: true,
        overLimit: false,
        version: 1,
      },
      updatedAt: "2026-06-15T11:59:59.900Z",
      capabilities: {
        ownerResolution: "server_only",
        dataReads: "convex_review_cockpit_summary",
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

  it("returns safe no-data state when no review cockpit data exists", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
    });

    const result = await internalSummarizeMcpReviewCockpit._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        reviewCockpitRef: reviewCockpitRef(),
      },
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "no_data_available",
      missingDataReason: "review_cockpit_not_available",
      safeCounts: {
        reviewContexts: 0,
        reviewRuns: 0,
        reviewArtifacts: 0,
        applicationPackages: 0,
      },
    });
    assertSafeResult(result);
  });

  it("uses bounded reads and clamps over-limit aggregate counts", async () => {
    const contexts = Array.from({ length: 120 }, (_, index) =>
      context({
        _id: `context_${index}_DO_NOT_ECHO`,
        id: `application-context:${index}_DO_NOT_ECHO`,
        _creationTime: NOW - index,
        updatedAt: NOW - index,
      }),
    );
    const { ctx, queryCalls } = makeCtx({
      userProfiles: [profile()],
      applicationContexts: contexts,
    });

    const result = await internalSummarizeMcpReviewCockpit._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        reviewCockpitRef: reviewCockpitRef({ count: 100 }),
      },
    );

    expect(queryCalls.collectCalls).toBe(0);
    expect(queryCalls.takeLimits.length).toBeGreaterThanOrEqual(7);
    expect(
      queryCalls.takeLimits.every((limit) => limit === TEST_QUERY_READ_LIMIT),
    ).toBe(true);
    expect(result).toMatchObject({
      allowed: true,
      status: "available",
      reviewCockpitRef: {
        count: 100,
      },
      safeCounts: {
        reviewContexts: 100,
        overLimitCollections: 1,
      },
      safeFlags: {
        overLimit: true,
      },
    });
    assertSafeResult(result);
  });

  it("orders before bounded take so the latest review state remains in scope", async () => {
    const staleContexts = Array.from({ length: 120 }, (_, index) =>
      context({
        _id: `stale_context_${index}_DO_NOT_ECHO`,
        id: `application-context:stale-${index}_DO_NOT_ECHO`,
        _creationTime: NOW - 10_000 - index,
        updatedAt: NOW - 10_000 - index,
      }),
    );
    const latestContext = context({
      _id: "latest_context_DO_NOT_ECHO",
      id: "application-context:latest_DO_NOT_ECHO",
      reviewState: "approved",
      _creationTime: NOW,
      updatedAt: NOW,
    });
    const { ctx, queryCalls } = makeCtx({
      userProfiles: [profile()],
      applicationContexts: [...staleContexts, latestContext],
    });

    const result = await internalSummarizeMcpReviewCockpit._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        reviewCockpitRef: reviewCockpitRef({ count: 100 }),
      },
    );

    expect(queryCalls.collectCalls).toBe(0);
    expect(queryCalls.orderBeforeTake).toBe(queryCalls.takeLimits.length);
    expect(result).toMatchObject({
      allowed: true,
      status: "available",
      updatedAt: "2026-06-15T12:00:00.000Z",
      safeCounts: {
        reviewContexts: 100,
        approvedReviews: 1,
      },
    });
    assertSafeResult(result);
  });

  it("ignores raw artifact and review notes while summarizing safely", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      applicationArtifacts: [
        artifact({
          content: {
            rawResumeText: "RAW_RESUME_TEXT_DO_NOT_ECHO",
            generatedArtifactContent: "generated artifact content",
            _id: "j97convexdocumentid",
          },
          textPreview: "source quote",
          updatedAt: NOW - 1,
        }),
      ],
    });

    const result = await internalSummarizeMcpReviewCockpit._handler(
      ctx as any,
      {
        twoweeksClerkId: "clerk_DO_NOT_ECHO",
        reviewCockpitRef: reviewCockpitRef(),
      },
    );

    expect(result).toMatchObject({
      allowed: true,
      status: "available",
      safeCounts: {
        reviewArtifacts: 1,
        pendingReviews: 1,
      },
      safeCategories: {
        reviewGateStatus: "needs_review",
        nextReviewHint: "review_pending_items",
      },
    });
    assertSafeResult(result);
  });

  it("does not add runtime wiring, writes, network, model calls, or PR64 behavior", () => {
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
    expect(sourceWithoutLiterals).not.toMatch(
      /real read-only E2E|developer mode|ChatGPT test/u,
    );
  });
});
