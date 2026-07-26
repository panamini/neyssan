import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { internalSummarizeMcpApplicationPackage } from "../mcpApplicationPackageSummary";

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const SUMMARY_SOURCE_FILE = resolve(TEST_DIR, "../mcpApplicationPackageSummary.ts");
const NOW = Date.UTC(2026, 5, 15, 12, 0, 0, 0);

type TableName = "userProfiles" | "applicationPackages";
type Constraint = Readonly<{ field: string; value: unknown }>;
type StoredDocument = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};

function applicationPackageRef(overrides: Record<string, unknown> = {}) {
  return {
    id: "mcp-safe-ref:application-package:latest",
    label: "Application package availability",
    status: "available",
    category: "application_package",
    count: 1,
    updatedAt: "2026-06-15T11:59:59.750Z",
    version: 1,
    ...overrides,
  };
}

function makeCtx(seed: Partial<Record<TableName, StoredDocument[]>> = {}) {
  const tables: Record<TableName, StoredDocument[]> = {
    userProfiles: [],
    applicationPackages: [],
    ...seed,
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
        return {
          collect: async () => matching,
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

function applicationPackage(overrides: Partial<StoredDocument> = {}): StoredDocument {
  return {
    _id: "package_storage_id_DO_NOT_ECHO",
    _creationTime: NOW,
    applicationPackageId: "application-package:hash_DO_NOT_ECHO",
    userId: "profile_storage_id_DO_NOT_ECHO",
    applicationContextId: "application-context:hash_DO_NOT_ECHO",
    status: "ready_for_review",
    resumeVariantArtifactId: "resume-variant-artifact:hash_DO_NOT_ECHO",
    coverLetterArtifactId: "cover-letter-artifact:hash_DO_NOT_ECHO",
    resumeVariantArtifactStatus: "ready_for_generation",
    coverLetterArtifactStatus: "ready_for_review",
    sourceFactIds: ["candidate-fact:source quote"],
    allowedClaimIds: ["allowed-claim:hash"],
    evidenceMatchIds: ["evidence-match:hash"],
    demandIds: ["demand:hash"],
    riskFlagIds: ["risk:hash"],
    reviewItemIds: ["review:item"],
    packageHash: "hash_DO_NOT_ECHO",
    contentHash: "content-hash_DO_NOT_ECHO",
    pkg: {
      id: "application-package:hash_DO_NOT_ECHO",
      content: "proposal content",
      generatedArtifactContent: "generated artifact content",
      rawCvText: "RAW_CV_TEXT_DO_NOT_ECHO",
      rawJobText: "RAW_JOB_TEXT_DO_NOT_ECHO",
      sourceText: "sourceText",
      sourceQuote: "source quote",
      privateFacts: ["privateFacts"],
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

function assertSafeResult(result: unknown): void {
  const serialized = JSON.stringify(result);
  for (const fragment of [
    "package_storage_id_DO_NOT_ECHO",
    "profile_storage_id_DO_NOT_ECHO",
    "application-package:hash_DO_NOT_ECHO",
    "application-context:hash_DO_NOT_ECHO",
    "resume-variant-artifact:hash_DO_NOT_ECHO",
    "cover-letter-artifact:hash_DO_NOT_ECHO",
    "content-hash_DO_NOT_ECHO",
    "clerk_DO_NOT_ECHO",
    "real-user@example.test",
    "stytch_subject_DO_NOT_ECHO",
    "rawClaims",
    "RAW_CV_TEXT_DO_NOT_ECHO",
    "RAW_JOB_TEXT_DO_NOT_ECHO",
    "proposal content",
    "generated artifact content",
    "sourceText",
    "source quote",
    "privateFacts",
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
    .replace(/\/(?:\\.|[^/\\\n])+\/[dgimsuvy]*/gu, "")
    .replace(/(["'`])(?:\\.|(?!\1)[\s\S])*?\1/gu, "");
}

describe("PR60 Convex application package summary", () => {
  it("returns onboarding safe metadata when the owner profile is missing", async () => {
    const { ctx } = makeCtx();

    const result = await internalSummarizeMcpApplicationPackage._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      applicationPackageRef: applicationPackageRef({ status: "onboarding_required", count: 0 }),
    });

    expect(result).toMatchObject({
      kind: "mcp_application_package_summary_result",
      allowed: true,
      status: "onboarding_required",
      missingDataReason: "owner_onboarding_required",
      packageRef: {
        id: "mcp-safe-ref:application-package:latest",
        status: "onboarding_required",
        category: "application_package",
        count: 0,
      },
      safeCounts: {
        packages: 0,
        artifacts: 0,
        provenanceLinks: 0,
        reviewItems: 0,
        warnings: 0,
        blockers: 0,
      },
      capabilities: {
        ownerResolution: "blocked",
        dataReads: "convex_application_package_summary",
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

  it("returns only safe package summary metadata for available application packages", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      applicationPackages: [applicationPackage()],
    });

    const result = await internalSummarizeMcpApplicationPackage._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      applicationPackageRef: applicationPackageRef(),
    });

    expect(result).toEqual({
      kind: "mcp_application_package_summary_result",
      allowed: true,
      status: "available",
      packageRef: applicationPackageRef(),
      availability: {
        source: "convex_application_package_summary",
        ownerState: "resolved",
        version: 1,
      },
      safeCounts: {
        packages: 1,
        artifacts: 2,
        provenanceLinks: 5,
        reviewItems: 1,
        warnings: 0,
        blockers: 0,
        version: 1,
      },
      safeCategories: {
        packageStatus: "ready_for_review",
        resumeVariantArtifactStatus: "ready_for_generation",
        coverLetterArtifactStatus: "ready_for_review",
        version: 1,
      },
      updatedAt: "2026-06-15T11:59:59.750Z",
      capabilities: {
        ownerResolution: "server_only",
        dataReads: "convex_application_package_summary",
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

  it("aggregates packages across every profile owned by the Clerk user", async () => {
    const secondProfileId = "profile_storage_id_SECOND_DO_NOT_ECHO";
    const { ctx } = makeCtx({
      userProfiles: [profile(), profile({ _id: secondProfileId, updatedAt: NOW - 1 })],
      applicationPackages: [
        applicationPackage(),
        applicationPackage({
          _id: "package_storage_id_SECOND_DO_NOT_ECHO",
          applicationPackageId: "application-package:second_DO_NOT_ECHO",
          userId: secondProfileId,
        }),
      ],
    });

    const result = await internalSummarizeMcpApplicationPackage._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      applicationPackageRef: applicationPackageRef(),
    });

    expect(result.status).toBe("available");
    expect(result.safeCounts.packages).toBe(2);
    expect(result.packageRef.count).toBe(2);
    assertSafeResult(result);
  });

  it("omits raw package content, generated artifacts, source text, identities, and database ids", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      applicationPackages: [applicationPackage()],
    });

    const result = await internalSummarizeMcpApplicationPackage._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      applicationPackageRef: applicationPackageRef(),
    });

    assertSafeResult(result);
  });

  it("returns safe no-data state when applicationPackageRef is missing available data", async () => {
    const { ctx } = makeCtx({
      userProfiles: [profile()],
      applicationPackages: [],
    });

    const result = await internalSummarizeMcpApplicationPackage._handler(ctx as any, {
      twoweeksClerkId: "clerk_DO_NOT_ECHO",
      applicationPackageRef: applicationPackageRef({ status: "no_data_available", count: 0 }),
    });

    expect(result).toMatchObject({
      allowed: true,
      status: "no_data_available",
      missingDataReason: "application_package_not_available",
      safeCounts: {
        packages: 0,
        artifacts: 0,
        provenanceLinks: 0,
        reviewItems: 0,
        warnings: 0,
        blockers: 0,
      },
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
