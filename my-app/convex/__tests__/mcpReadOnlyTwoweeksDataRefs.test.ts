import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { internalListMcpReadOnlyTwoweeksDataRefs } from "../mcpReadOnlyTwoweeksDataRefs";

const NOW = Date.UTC(2026, 5, 15, 12, 0, 0, 0);
const ALL_SCOPES = [
  "twoweeks.mcp.read",
  "twoweeks.application_package.read",
  "twoweeks.evidence_graph.read",
  "twoweeks.resume_variant_plan.read",
  "twoweeks.review_cockpit.read",
] as const;

type TableName =
  | "userProfiles"
  | "candidateSourceDocuments"
  | "candidateFacts"
  | "applicationContexts"
  | "applicationRuns"
  | "applicationArtifacts"
  | "applicationPackages";

type Constraint = Readonly<{ field: string; value: unknown }>;
type StoredDocument = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};

function makeCtx(seed: Partial<Record<TableName, StoredDocument[]>> = {}) {
  const tables: Record<TableName, StoredDocument[]> = {
    userProfiles: [],
    candidateSourceDocuments: [],
    candidateFacts: [],
    applicationContexts: [],
    applicationRuns: [],
    applicationArtifacts: [],
    applicationPackages: [],
    ...seed,
  };

  function applyConstraints(documents: StoredDocument[], constraints: Constraint[]) {
    return documents.filter((document) =>
      constraints.every((constraint) => readField(document, constraint.field) === constraint.value),
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
        return {
          collect: async () => matching,
          unique: async () => {
            if (matching.length > 1) throw new Error("expected unique result");
            return matching[0] ?? null;
          },
          order: () => ({
            collect: async () => matching,
            take: async (limit: number) => matching.slice(0, limit),
          }),
          take: async (limit: number) => matching.slice(0, limit),
        };
      },
    }),
  };

  return { ctx: { db }, tables };
}

function readField(document: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[part];
  }, document);
}

function profile(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "profile_storage_id_DO_NOT_ECHO",
    _creationTime: NOW,
    clerkId: "clerk_real_DO_NOT_ECHO",
    email: "real-user@example.test",
    name: "Real User",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
    preferences: {
      writingStyle: "direct",
      tonePreference: "neutral",
      autoSend: false,
    },
    raw_text: "RAW_CV_TEXT_DO_NOT_ECHO",
    cvDocument: { sections: [{ content: "resume body" }] },
    ...overrides,
  };
}

function assertSafeResult(result: unknown): void {
  const serialized = JSON.stringify(result);
  for (const fragment of [
    "profile_storage_id_DO_NOT_ECHO",
    "clerk_real_DO_NOT_ECHO",
    "real-user@example.test",
    "RAW_CV_TEXT_DO_NOT_ECHO",
    "RAW_JOB_TEXT_DO_NOT_ECHO",
    "source quote",
    "proposal content",
    "private",
    "never_use",
    "j97convexdocumentid",
    "debugPayload",
    "structuredShadow",
  ] as const) {
    expect(serialized).not.toContain(fragment);
  }
}

describe("PR59 read-only Twoweeks Convex data refs", () => {
  it("returns onboarding-required safe refs when the owner has no canonical profile", async () => {
    const { ctx } = makeCtx();

    const result = await internalListMcpReadOnlyTwoweeksDataRefs._handler(ctx as any, {
      twoweeksClerkId: "clerk_missing_DO_NOT_ECHO",
      grantedReadScopes: ALL_SCOPES,
    });

    expect(result).toMatchObject({
      kind: "mcp_read_only_twoweeks_data_refs_result",
      ownerState: "onboarding_required",
      refs: [
        { refClass: "applicationPackageRef", status: "onboarding_required", count: 0 },
        { refClass: "evidenceGraphRef", status: "onboarding_required", count: 0 },
        { refClass: "resumeVariantPlanRef", status: "onboarding_required", count: 0 },
        { refClass: "reviewCockpitRef", status: "onboarding_required", count: 0 },
      ],
      blockedRefClasses: [],
      capabilities: {
        ownerResolvedServerOnly: false,
        dataReads: "convex_read_only_refs",
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

  it("returns only fixed opaque refs, categories, counts, and timestamps for available data", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      candidateSourceDocuments: [
        {
          _id: "source_storage_id_DO_NOT_ECHO",
          _creationTime: NOW,
          id: "candidate-source-document:hash-a",
          userId: "profile_storage_id_DO_NOT_ECHO",
          sourceType: "pasted_text",
          title: "Profile notes",
          textHash: "text-hash-a",
          sourceHash: "source-hash-a",
          reviewState: "approved",
          visibility: "use_in_applications",
          createdAt: NOW - 3000,
          updatedAt: NOW - 3000,
          version: 1,
        },
      ],
      candidateFacts: [
        {
          _id: "fact_storage_id_DO_NOT_ECHO",
          _creationTime: NOW,
          id: "candidate-fact:hash-a",
          userId: "profile_storage_id_DO_NOT_ECHO",
          sourceDocumentId: "candidate-source-document:hash-a",
          sourcePath: "document.skills[0].name",
          sourceQuote: "source quote",
          factType: "skill",
          value: { name: "TypeScript" },
          reviewState: "approved",
          visibility: "use_in_applications",
          createdAt: NOW - 2000,
          updatedAt: NOW - 2000,
          version: 1,
        },
      ],
      applicationContexts: [
        {
          _id: "context_storage_id_DO_NOT_ECHO",
          _creationTime: NOW,
          id: "application-context:hash-a",
          userId: "profile_storage_id_DO_NOT_ECHO",
          reviewState: "needs_review",
          updatedAt: NOW - 4000,
        },
      ],
      applicationRuns: [
        {
          _id: "run_storage_id_DO_NOT_ECHO",
          _creationTime: NOW,
          id: "application-run:hash-a",
          userId: "profile_storage_id_DO_NOT_ECHO",
          operation: "build_evidence_graph",
          status: "succeeded",
          updatedAt: NOW - 1000,
        },
      ],
      applicationArtifacts: [
        {
          _id: "artifact_storage_id_DO_NOT_ECHO",
          _creationTime: NOW,
          id: "application-artifact:hash-a",
          userId: "profile_storage_id_DO_NOT_ECHO",
          type: "resume_variant_plan",
          status: "needs_review",
          title: "Resume plan",
          content: "RAW_CV_TEXT_DO_NOT_ECHO",
          updatedAt: NOW - 500,
        },
      ],
      applicationPackages: [
        {
          _id: "package_storage_id_DO_NOT_ECHO",
          _creationTime: NOW,
          applicationPackageId: "application-package:hash-a",
          userId: "profile_storage_id_DO_NOT_ECHO",
          applicationContextId: "application-context:hash-a",
          status: "ready_for_review",
          package: { id: "application-package:hash-a", content: "proposal content" },
          createdAt: NOW - 250,
          updatedAt: NOW - 250,
          version: 1,
        },
      ],
    });

    const result = await internalListMcpReadOnlyTwoweeksDataRefs._handler(ctx as any, {
      twoweeksClerkId: "clerk_real_DO_NOT_ECHO",
      grantedReadScopes: ALL_SCOPES,
    });

    expect(result.refs).toEqual([
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "applicationPackageRef",
        refId: "mcp-safe-ref:application-package:latest",
        label: "Application package availability",
        status: "available",
        category: "application_package",
        count: 1,
        updatedAt: "2026-06-15T12:00:00.000Z",
        version: 1,
      },
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "evidenceGraphRef",
        refId: "mcp-safe-ref:evidence-graph:profile",
        label: "Candidate evidence availability",
        status: "available",
        category: "evidence_graph",
        count: 2,
        updatedAt: "2026-06-15T11:59:58.000Z",
        version: 1,
      },
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "resumeVariantPlanRef",
        refId: "mcp-safe-ref:resume-variant-plan:latest",
        label: "Resume variant plan availability",
        status: "available",
        category: "resume_variant_plan",
        count: 1,
        updatedAt: "2026-06-15T11:59:59.500Z",
        version: 1,
      },
      {
        kind: "mcp_read_only_twoweeks_data_ref_candidate",
        refClass: "reviewCockpitRef",
        refId: "mcp-safe-ref:review-cockpit:latest",
        label: "Review cockpit availability",
        status: "available",
        category: "review_cockpit",
        count: 2,
        updatedAt: "2026-06-15T11:59:59.000Z",
        version: 1,
      },
    ]);
    assertSafeResult(result);
  });

  it("filters restricted evidence out of the evidence availability count", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      candidateFacts: [
        {
          _id: "fact_private_DO_NOT_ECHO",
          _creationTime: NOW,
          id: "candidate-fact:private",
          userId: "profile_storage_id_DO_NOT_ECHO",
          reviewState: "approved",
          visibility: "private",
          updatedAt: NOW,
        },
        {
          _id: "fact_never_DO_NOT_ECHO",
          _creationTime: NOW,
          id: "candidate-fact:never",
          userId: "profile_storage_id_DO_NOT_ECHO",
          reviewState: "approved",
          visibility: "never_use",
          updatedAt: NOW,
        },
        {
          _id: "fact_rejected_DO_NOT_ECHO",
          _creationTime: NOW,
          id: "candidate-fact:rejected",
          userId: "profile_storage_id_DO_NOT_ECHO",
          reviewState: "rejected",
          visibility: "use_in_applications",
          updatedAt: NOW,
        },
      ],
    });

    const result = await internalListMcpReadOnlyTwoweeksDataRefs._handler(ctx as any, {
      twoweeksClerkId: "clerk_real_DO_NOT_ECHO",
      grantedReadScopes: ALL_SCOPES,
    });

    expect(result.refs.find((ref) => ref.refClass === "evidenceGraphRef")).toMatchObject({
      status: "no_data_available",
      count: 0,
    });
    assertSafeResult(result);
  });

  it("does not emit a ref candidate for a class without the matching read scope", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      applicationPackages: [
        {
          _id: "package_storage_id_DO_NOT_ECHO",
          _creationTime: NOW,
          applicationPackageId: "application-package:hash-a",
          userId: "profile_storage_id_DO_NOT_ECHO",
          createdAt: NOW,
          updatedAt: NOW,
        },
      ],
      candidateFacts: [
        {
          _id: "fact_storage_id_DO_NOT_ECHO",
          _creationTime: NOW,
          id: "candidate-fact:hash-a",
          userId: "profile_storage_id_DO_NOT_ECHO",
          reviewState: "approved",
          visibility: "use_in_applications",
          updatedAt: NOW,
        },
      ],
    });

    const result = await internalListMcpReadOnlyTwoweeksDataRefs._handler(ctx as any, {
      twoweeksClerkId: "clerk_real_DO_NOT_ECHO",
      grantedReadScopes: ["twoweeks.mcp.read", "twoweeks.evidence_graph.read"],
    });

    expect(result.refs.map((ref) => ref.refClass)).toEqual(["evidenceGraphRef"]);
    expect(result.blockedRefClasses).toEqual([
      { refClass: "applicationPackageRef", reason: "missing_class_scope", version: 1 },
      { refClass: "resumeVariantPlanRef", reason: "missing_class_scope", version: 1 },
      { refClass: "reviewCockpitRef", reason: "missing_class_scope", version: 1 },
    ]);
    assertSafeResult(result);
  });

  it("keeps the Convex source disconnected from app-facing selectors, handlers, connectors, network, models, and writes", () => {
    const source = readFileSync("convex/mcpReadOnlyTwoweeksDataRefs.ts", "utf8");
    const forbiddenImports = [
      "activeCvSnapshots",
      "profilesPublic",
      "jobsPublic",
      "proposalsPublic",
      "node:http",
      "node:https",
      "@stytch",
      "openai",
      "langchain",
      "tools/list",
      "tools/call",
    ] as const;
    const executableSource = source
      .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
      .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");

    for (const fragment of forbiddenImports) {
      expect(source).not.toContain(fragment);
    }
    for (const pattern of [
      /\bfetch\s*\(/u,
      /\bXMLHttpRequest\b/u,
      /\bctx\.auth\.getUserIdentity\b/u,
      /\b(?:mutation|internalMutation|action|internalAction)\s*\(/u,
      /\bctx\.db\.(?:insert|patch|replace|delete)\s*\(/u,
      /\b(?:exportFile|downloadFile|sendEmail|submitApplication|applyToJob)\s*\(/u,
      /\b(?:tokenEndpoint|refreshToken|revocationEndpoint|oauth\/callback)\b/iu,
    ] as const) {
      expect(executableSource).not.toMatch(pattern);
    }
  });
});
