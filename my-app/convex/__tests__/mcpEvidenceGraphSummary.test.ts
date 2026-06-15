import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { internalSummarizeMcpEvidenceGraph } from "../mcpEvidenceGraphSummary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SUMMARY_SOURCE_FILE = resolve(TEST_DIR, "../mcpEvidenceGraphSummary.ts");
const NOW = Date.UTC(2026, 5, 15, 12, 0, 0, 0);
const TEST_QUERY_READ_LIMIT = 101;

type TableName =
  | "userProfiles"
  | "candidateSourceDocuments"
  | "candidateFacts"
  | "applicationPackages"
  | "applicationRuns";
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

function evidenceGraphRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcp-safe-ref:evidence-graph:profile",
    label: "Candidate evidence availability",
    status: "available",
    category: "evidence_graph",
    count: 3,
    updatedAt: "2026-06-15T11:59:59.750Z",
    version: 1,
    ...overrides,
  };
}

function makeCtx(seed: Partial<Record<TableName, StoredDocument[]>> = {}) {
  const tables: Record<TableName, StoredDocument[]> = {
    userProfiles: [],
    candidateSourceDocuments: [],
    candidateFacts: [],
    applicationPackages: [],
    applicationRuns: [],
    ...seed,
  };
  const queryCalls: QueryCallLog = {
    collectCalls: 0,
    takeLimits: [],
    tableNames: [],
  };

  function applyConstraints(documents: StoredDocument[], constraints: Constraint[]) {
    return documents.filter((doc) =>
      constraints.every((constraint) => readField(doc, constraint.field) === constraint.value),
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
              return matching.slice(0, limit);
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

function sourceDocument(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "source_document_storage_id_DO_NOT_ECHO",
    _creationTime: NOW - 10_000,
    id: "candidate-source-document:hash_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    sourceType: "cv",
    title: "sourceText",
    originalFilename: "resumeText.pdf",
    mimeType: "application/pdf",
    textHash: "raw-document-hash_DO_NOT_ECHO",
    sourceHash: "source-hash_DO_NOT_ECHO",
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: NOW - 2_000,
    updatedAt: NOW - 1_000,
    version: 1,
    ...overrides,
  };
}

function candidateFact(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "candidate_fact_storage_id_DO_NOT_ECHO",
    _creationTime: NOW - 10_000,
    id: "candidate-fact:hash_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    sourceDocumentId: "candidate-source-document:hash_DO_NOT_ECHO",
    sourcePath: "experience.0.summary",
    sourceQuote: "source quote",
    factType: "experience",
    value: "RAW_CV_TEXT_DO_NOT_ECHO",
    normalizedText: "resumeText",
    confidence: 0.92,
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: NOW - 2_000,
    updatedAt: NOW - 1_000,
    version: 1,
    ...overrides,
  };
}

function applicationPackage(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "package_storage_id_DO_NOT_ECHO",
    _creationTime: NOW - 250,
    applicationPackageId: "application-package:hash_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    applicationContextId: "application-context:hash_DO_NOT_ECHO",
    status: "ready_for_review",
    sourceFactIds: ["candidate-fact:source quote"],
    allowedClaimIds: ["allowed-claim:rawClaims"],
    evidenceMatchIds: ["evidence-match:hash"],
    demandIds: ["demand:one", "demand:two"],
    riskFlagIds: ["risk:missing-evidence"],
    packageHash: "hash_DO_NOT_ECHO",
    contentHash: "content-hash_DO_NOT_ECHO",
    pkg: {
      id: "application-package:hash_DO_NOT_ECHO",
      content: "proposal content",
      generatedArtifactContent: "generated artifact content",
      rawCvText: "RAW_CV_TEXT_DO_NOT_ECHO",
      rawJobText: "RAW_JOB_TEXT_DO_NOT_ECHO",
      coverLetter: "coverLetter",
      sourceText: "sourceText",
      sourceQuote: "source quote",
      privateFactNames: ["privateFactNames"],
      never_use: true,
      debugPayload: { unsafe: true },
      structuredShadow: { unsafe: true },
      clerkId: "clerk_DO_NOT_ECHO",
      userId: "profile_storage_id_DO_NOT_ECHO",
      email: "real-user@example.test",
      stytchSubject: "stytch_subject_DO_NOT_ECHO",
      rawClaims: { sub: "stytch_subject_DO_NOT_ECHO" },
      convexDocumentId: "j97convexdocumentid",
    },
    createdAt: NOW - 250,
    updatedAt: NOW - 250,
    version: 1,
    ...overrides,
  };
}

function applicationRun(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "application_run_storage_id_DO_NOT_ECHO",
    _creationTime: NOW - 500,
    id: "application-run:hash_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    operation: "build_evidence_graph",
    status: "succeeded",
    blockedReason: "source quote",
    error: "RAW_JOB_TEXT_DO_NOT_ECHO",
    createdAt: NOW - 500,
    updatedAt: NOW - 500,
    version: 1,
    ...overrides,
  };
}

function assertSafeResult(result: unknown): void {
  const serialized = JSON.stringify(result);
  for (const fragment of [
    "source_document_storage_id_DO_NOT_ECHO",
    "candidate_fact_storage_id_DO_NOT_ECHO",
    "package_storage_id_DO_NOT_ECHO",
    "application_run_storage_id_DO_NOT_ECHO",
    "profile_storage_id_DO_NOT_ECHO",
    "candidate-source-document:hash_DO_NOT_ECHO",
    "candidate-fact:hash_DO_NOT_ECHO",
    "application-package:hash_DO_NOT_ECHO",
    "application-context:hash_DO_NOT_ECHO",
    "content-hash_DO_NOT_ECHO",
    "clerk_DO_NOT_ECHO",
    "real-user@example.test",
    "stytch_subject_DO_NOT_ECHO",
    "rawClaims",
    "RAW_CV_TEXT_DO_NOT_ECHO",
    "RAW_JOB_TEXT_DO_NOT_ECHO",
    "resumeText",
    "proposal content",
    "coverLetter",
    "generated artifact content",
    "sourceText",
    "source quote",
    "privateFactNames",
    "never_use",
    "debugPayload",
    "structuredShadow",
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

describe("PR61 Convex evidence graph summary", () => {
  it("returns onboarding safe metadata when the owner profile is missing", async () => {
    const { ctx } = makeCtx();

    const result = await internalSummarizeMcpEvidenceGraph._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      evidenceGraphRef: evidenceGraphRef({ status: "onboarding_required", count: 0 }),
    });

    expect(result).toMatchObject({
      kind: "mcp_evidence_graph_summary_result",
      allowed: true,
      status: "onboarding_required",
      missingDataReason: "owner_onboarding_required",
      evidenceGraphRef: {
        id: "mcp-safe-ref:evidence-graph:profile",
        status: "onboarding_required",
        category: "evidence_graph",
        count: 0,
      },
      safeCounts: {
        sourceDocuments: 0,
        candidateFacts: 0,
        provenanceLinks: 0,
        warnings: 0,
        blockers: 0,
      },
      capabilities: {
        ownerResolution: "blocked",
        dataReads: "convex_evidence_graph_summary",
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

  it("returns only safe evidence and provenance summary metadata", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      candidateSourceDocuments: [sourceDocument()],
      candidateFacts: [
        candidateFact(),
        candidateFact({
          _id: "candidate_fact_pending_DO_NOT_ECHO",
          id: "candidate-fact:pending_DO_NOT_ECHO",
          reviewState: "pending",
          updatedAt: NOW - 500,
        }),
        candidateFact({
          _id: "candidate_fact_rejected_DO_NOT_ECHO",
          id: "candidate-fact:rejected_DO_NOT_ECHO",
          reviewState: "rejected",
        }),
        candidateFact({
          _id: "candidate_fact_private_DO_NOT_ECHO",
          id: "candidate-fact:private_DO_NOT_ECHO",
          visibility: "private",
        }),
        candidateFact({
          _id: "candidate_fact_never_DO_NOT_ECHO",
          id: "candidate-fact:never_DO_NOT_ECHO",
          visibility: "never_use",
        }),
      ],
      applicationPackages: [applicationPackage()],
      applicationRuns: [applicationRun()],
    });

    const result = await internalSummarizeMcpEvidenceGraph._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      evidenceGraphRef: evidenceGraphRef(),
    });

    expect(result).toEqual({
      kind: "mcp_evidence_graph_summary_result",
      allowed: true,
      status: "available",
      evidenceGraphRef: {
        id: "mcp-safe-ref:evidence-graph:profile",
        label: "Candidate evidence availability",
        status: "available",
        category: "evidence_graph",
        count: 3,
        updatedAt: "2026-06-15T11:59:59.750Z",
        version: 1,
      },
      availability: {
        source: "convex_evidence_graph_summary",
        ownerState: "resolved",
        version: 1,
      },
      safeCounts: {
        sourceDocuments: 1,
        candidateFacts: 2,
        approvedFacts: 1,
        pendingFacts: 1,
        rejectedFacts: 1,
        restrictedEvidence: 2,
        archivedEvidence: 0,
        provenanceLinks: 6,
        evidenceMatches: 1,
        allowedClaims: 1,
        missingEvidence: 1,
        riskFlags: 1,
        staleSources: 3,
        warnings: 5,
        blockers: 1,
        version: 1,
      },
      safeCategories: {
        evidenceCoverage: "partial",
        provenanceCoverage: "partial",
        qualityStatus: "blocked",
        blockerCategory: "missing_evidence",
        nextReviewHint: "review_missing_evidence",
        version: 1,
      },
      updatedAt: "2026-06-15T11:59:59.750Z",
      capabilities: {
        ownerResolution: "server_only",
        dataReads: "convex_evidence_graph_summary",
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

  it("tracks archived evidence separately without inflating active supporting counts", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      candidateSourceDocuments: [
        sourceDocument({
          _id: "source_document_archived_DO_NOT_ECHO",
          id: "candidate-source-document:archived_DO_NOT_ECHO",
          reviewState: "archived",
        }),
      ],
    });

    const result = await internalSummarizeMcpEvidenceGraph._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      evidenceGraphRef: evidenceGraphRef({ count: 1 }),
    });

    expect(result).toMatchObject({
      allowed: true,
      status: "available",
      evidenceGraphRef: {
        id: "mcp-safe-ref:evidence-graph:profile",
        count: 1,
      },
      safeCounts: {
        sourceDocuments: 0,
        candidateFacts: 0,
        archivedEvidence: 1,
        warnings: 1,
      },
      safeCategories: {
        evidenceCoverage: "missing",
        provenanceCoverage: "missing",
        qualityStatus: "needs_review",
        nextReviewHint: "add_candidate_evidence",
      },
    });
    assertSafeResult(result);
  });

  it("returns safe no-data state when no evidence graph inputs exist", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
    });

    const result = await internalSummarizeMcpEvidenceGraph._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      evidenceGraphRef: evidenceGraphRef({ status: "no_data_available", count: 0 }),
    });

    expect(result).toMatchObject({
      allowed: true,
      status: "no_data_available",
      missingDataReason: "evidence_graph_not_available",
      safeCounts: {
        sourceDocuments: 0,
        candidateFacts: 0,
        archivedEvidence: 0,
        provenanceLinks: 0,
        warnings: 0,
        blockers: 0,
      },
    });
    assertSafeResult(result);
  });

  it("uses bounded reads and clamps over-limit aggregate counts", async () => {
    const sourceDocuments = Array.from({ length: 120 }, (_, index) =>
      sourceDocument({
        _id: `source_document_${index}_DO_NOT_ECHO`,
        id: `candidate-source-document:${index}_DO_NOT_ECHO`,
        updatedAt: NOW - index,
      }),
    );
    const candidateFacts = Array.from({ length: 120 }, (_, index) =>
      candidateFact({
        _id: `candidate_fact_${index}_DO_NOT_ECHO`,
        id: `candidate-fact:${index}_DO_NOT_ECHO`,
        updatedAt: NOW - index,
      }),
    );
    const { ctx, queryCalls } = makeCtx({
      userProfiles: [profile()],
      candidateSourceDocuments: sourceDocuments,
      candidateFacts,
    });

    const result = await internalSummarizeMcpEvidenceGraph._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      evidenceGraphRef: evidenceGraphRef({ count: 100 }),
    });

    expect(queryCalls.collectCalls).toBe(0);
    expect(queryCalls.takeLimits.length).toBeGreaterThanOrEqual(5);
    expect(queryCalls.takeLimits.every((limit) => limit === TEST_QUERY_READ_LIMIT)).toBe(true);
    expect(result).toMatchObject({
      allowed: true,
      status: "available",
      evidenceGraphRef: {
        count: 100,
      },
      safeCounts: {
        sourceDocuments: 100,
        candidateFacts: 100,
        approvedFacts: 100,
        archivedEvidence: 0,
      },
    });
    assertSafeResult(result);
  });

  it("omits raw evidence text, generated artifacts, identities, and database ids", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      candidateSourceDocuments: [sourceDocument()],
      candidateFacts: [candidateFact()],
      applicationPackages: [applicationPackage()],
      applicationRuns: [applicationRun()],
    });

    const result = await internalSummarizeMcpEvidenceGraph._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      evidenceGraphRef: evidenceGraphRef(),
    });

    assertSafeResult(result);
  });

  it("keeps the Convex summary query read-only and disconnected from forbidden surfaces", () => {
    const source = readFileSync(SUMMARY_SOURCE_FILE, "utf8");
    const executableSource = stripStringAndPatternLiterals(source);

    for (const forbiddenImport of [
      "activeCvSnapshots",
      "profilesPublic",
      "jobsPublic",
      "proposalsPublic",
      "node:http",
      "node:https",
      "@openai",
      "openai",
      "langchain",
      "tools/list",
      "tools/call",
    ] as const) {
      expect(source).not.toContain(forbiddenImport);
    }

    expect(source).toContain("internalQuery");
    expect(source).toContain("take(QUERY_READ_LIMIT)");
    expect(executableSource).not.toMatch(/\bcollect\s*\(/u);
    expect(source).not.toMatch(/\b(?:mutation|internalMutation|action|internalAction)\b/u);
    for (const pattern of [
      /\bfetch\s*\(/u,
      /\bXMLHttpRequest\b/u,
      /\bctx\.auth\.getUserIdentity\b/u,
      /\bctx\.runMutation\b/u,
      /\bctx\.scheduler\b/u,
      /\bctx\.db\.(?:insert|patch|replace|delete)\s*\(/u,
      /\b(?:exportFile|downloadFile|sendEmail|submitApplication|applyToJob)\s*\(/u,
      /\b(?:tokenEndpoint|refreshToken|revocationEndpoint|oauth\/callback)\b/iu,
    ] as const) {
      expect(executableSource).not.toMatch(pattern);
    }
  });
});
