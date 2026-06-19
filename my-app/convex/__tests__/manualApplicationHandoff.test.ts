import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ApplicationPackageV1 } from "../../src/modules/application-package/schema";
import {
  confirm,
  getDeliveryContentForHandoff,
  getForJob,
  prepare,
  recordCopySucceeded,
  recordDestinationOpenRequested,
  recordFileDownloadRequested,
  reportOutcome,
} from "../manualApplicationHandoff";
import {
  MANUAL_APPLICATION_HANDOFF_EVIDENCE,
  MANUAL_APPLICATION_HANDOFF_EVENT_KINDS,
  MANUAL_APPLICATION_HANDOFF_RATE_LIMIT_CAPABILITIES,
  MANUAL_APPLICATION_HANDOFF_STATES,
  buildManualApplicationHandoffManifestDigest,
  readManualApplicationHandoffServerConfigStatus,
  validateManualApplicationDestination,
} from "../lib/manualApplicationHandoff";

const NOW = Date.UTC(2026, 5, 19, 8, 0, 0, 0);
const OWNER_PROFILE_ID = "profile_owner";
const OTHER_PROFILE_ID = "profile_other";
const JOB_ID = "job_1";
const APPLICATION_CONTEXT_ID = "application-context:abc";
const APPLICATION_PACKAGE_ID = "application-package:hash-a";
const RESUME_ARTIFACT_ID = "resume-variant-artifact:hash-a";
const COVER_LETTER_ARTIFACT_ID = "cover-letter-artifact:hash-a";
const APPLICATION_URL =
  "https://jobs.example.com/apply/123?candidate=private#section";
const APPROVED_RESUME_EXPORT_TEXT =
  "Jane Example\n\nOperations lead resume export approved for handoff.";
const APPROVED_COVER_LETTER_TEXT =
  "Dear Example co,\n\nI am excited to apply for the Operations lead role.";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

type StoredDocument<T> = T & {
  _id: string;
  _creationTime: number;
};

type TableName =
  | "userProfiles"
  | "jobs"
  | "applicationContexts"
  | "applicationPackages"
  | "applicationArtifacts"
  | "manualApplicationHandoffs"
  | "manualApplicationHandoffEvents"
  | "manualApplicationHandoffRateLimits"
  | "liveExternalActionExecutions";

type Constraint = Readonly<{
  field: string;
  op: "eq" | "lt";
  val: unknown;
}>;

function buildApplicationPackageFixture(
  overrides: Partial<ApplicationPackageV1> = {},
): ApplicationPackageV1 {
  return {
    id: APPLICATION_PACKAGE_ID,
    userId: OWNER_PROFILE_ID,
    applicationContextId: APPLICATION_CONTEXT_ID,
    status: "ready_for_review",
    artifacts: [
      {
        id: RESUME_ARTIFACT_ID,
        kind: "resume_variant_artifact",
        contentHash: "resume-content-hash-a",
        status: "ready_for_generation",
        version: 1,
      },
      {
        id: COVER_LETTER_ARTIFACT_ID,
        kind: "cover_letter_artifact",
        contentHash: "cover-letter-content-hash-a",
        status: "ready_for_review",
        version: 1,
      },
    ],
    items: [
      {
        id: "application-package-item:resume",
        kind: "resume_variant",
        artifactId: RESUME_ARTIFACT_ID,
        artifactContentHash: "resume-content-hash-a",
        status: "included",
        label: "Resume variant artifact included.",
        note: "Package references the resume variant artifact without duplicating resume text.",
        sourceFactIds: ["candidate-fact:a"],
        allowedClaimIds: ["allowed-claim:a"],
        evidenceMatchIds: ["evidence-match:a"],
        demandIds: ["demand:a"],
        riskFlagIds: ["risk:a"],
        reviewItemIds: ["review:a"],
        version: 1,
      },
      {
        id: "application-package-item:cover-letter",
        kind: "cover_letter",
        artifactId: COVER_LETTER_ARTIFACT_ID,
        artifactContentHash: "cover-letter-content-hash-a",
        status: "included",
        label: "Cover-letter artifact included.",
        note: "Package references the cover-letter artifact without duplicating cover-letter text.",
        sourceFactIds: ["candidate-fact:b"],
        allowedClaimIds: ["allowed-claim:b"],
        evidenceMatchIds: ["evidence-match:b"],
        demandIds: ["demand:b"],
        riskFlagIds: ["risk:b"],
        reviewItemIds: ["review:b"],
        version: 1,
      },
    ],
    warnings: [],
    provenance: {
      applicationContextId: APPLICATION_CONTEXT_ID,
      resumeVariantArtifactId: RESUME_ARTIFACT_ID,
      coverLetterArtifactId: COVER_LETTER_ARTIFACT_ID,
      sourceFactIds: ["candidate-fact:a", "candidate-fact:b"],
      allowedClaimIds: ["allowed-claim:a", "allowed-claim:b"],
      evidenceMatchIds: ["evidence-match:a", "evidence-match:b"],
      demandIds: ["demand:a", "demand:b"],
      riskFlagIds: ["risk:a", "risk:b"],
      reviewItemIds: ["review:a", "review:b"],
      version: 1,
    },
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function buildStoredPackage(
  overrides: Partial<StoredDocument<any>> = {},
): StoredDocument<any> {
  const pkg = buildApplicationPackageFixture(overrides.package);
  return {
    _id: "applicationPackages_1",
    _creationTime: NOW,
    applicationPackageId: pkg.id,
    userId: pkg.userId,
    applicationContextId: pkg.applicationContextId,
    status: pkg.status,
    resumeVariantArtifactId: pkg.provenance.resumeVariantArtifactId,
    coverLetterArtifactId: pkg.provenance.coverLetterArtifactId,
    resumeVariantArtifactStatus: "ready_for_generation",
    coverLetterArtifactStatus: "ready_for_review",
    sourceFactIds: pkg.provenance.sourceFactIds,
    allowedClaimIds: pkg.provenance.allowedClaimIds,
    evidenceMatchIds: pkg.provenance.evidenceMatchIds,
    demandIds: pkg.provenance.demandIds,
    riskFlagIds: pkg.provenance.riskFlagIds,
    reviewItemIds: pkg.provenance.reviewItemIds,
    packageHash: "hash-a",
    contentHash: "package-content-hash-a",
    package: pkg,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function buildCoverLetterArtifactFixture() {
  return {
    id: COVER_LETTER_ARTIFACT_ID,
    userId: OWNER_PROFILE_ID,
    applicationContextId: APPLICATION_CONTEXT_ID,
    status: "ready_for_review",
    text: {
      value: APPROVED_COVER_LETTER_TEXT,
      format: "markdown",
      sourceKind: "manual_text",
      textHash: "cover-letter-text-hash-a",
      paragraphCount: 2,
      characterCount: APPROVED_COVER_LETTER_TEXT.length,
      version: 1,
    },
    warnings: [],
    provenance: {
      applicationContextId: APPLICATION_CONTEXT_ID,
      resumeVariantArtifactId: RESUME_ARTIFACT_ID,
      resumeVariantArtifactContentHash: "resume-content-hash-a",
      evidenceGraphId: "evidence-graph:hash-a",
      evidenceGraphHash: "hash-a",
      resumeVariantPlanId: "resume-variant-plan:hash-a",
      resumeVariantPlanHash: "hash-a",
      reviewCockpitId: "review-cockpit:hash-a",
      sourceFactIds: ["candidate-fact:b"],
      allowedClaimIds: ["allowed-claim:b"],
      evidenceMatchIds: ["evidence-match:b"],
      demandIds: ["demand:b"],
      riskFlagIds: [],
      reviewItemIds: ["review:b"],
      version: 1,
    },
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function buildApprovedResumeExportArtifact(
  overrides: Partial<StoredDocument<any>> = {},
): StoredDocument<any> {
  return {
    _id: "applicationArtifacts_resume_export",
    _creationTime: NOW,
    id: "application-export:resume-a",
    userId: OWNER_PROFILE_ID,
    contextId: APPLICATION_CONTEXT_ID,
    type: "export",
    status: "approved",
    title: "Approved resume export",
    content: {
      kind: "mcp_resume_export_payload",
      artifactKind: "resume_variant",
      fileName: "resume-export.md",
      mimeType: "text/markdown",
      content: APPROVED_RESUME_EXPORT_TEXT,
      checksum: "resume-export-checksum-a",
      persisted: false,
      urlCreated: false,
      writeActionExecuted: false,
      version: 1,
    },
    textPreview: "Resume export ready",
    sourceHashes: {
      contextHash: "context-hash",
    },
    provenance: {
      jobId: JOB_ID,
      sourceFactIds: ["candidate-fact:a"],
    },
    sourceRefs: [
      {
        sourceType: "artifact",
        sourceId: RESUME_ARTIFACT_ID,
        sourceHash: "resume-content-hash-a",
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function buildApprovedCoverLetterExportArtifact(
  overrides: Partial<StoredDocument<any>> = {},
): StoredDocument<any> {
  return {
    _id: "applicationArtifacts_cover_letter_export",
    _creationTime: NOW,
    id: "application-export:cover-letter-a",
    userId: OWNER_PROFILE_ID,
    contextId: APPLICATION_CONTEXT_ID,
    type: "export",
    status: "approved",
    title: "Approved cover letter export",
    content: {
      kind: "mcp_cover_letter_application_package_export_payload",
      artifactKind: "cover_letter",
      fileName: "cover-letter-export.md",
      mimeType: "text/markdown",
      content: APPROVED_COVER_LETTER_TEXT,
      checksum: "cover-letter-export-checksum-a",
      persisted: false,
      urlCreated: false,
      writeActionExecuted: false,
      version: 1,
    },
    textPreview: "Cover letter export ready",
    sourceHashes: {
      contextHash: "context-hash",
    },
    provenance: {
      jobId: JOB_ID,
      sourceFactIds: ["candidate-fact:b"],
    },
    sourceRefs: [
      {
        sourceType: "artifact",
        sourceId: COVER_LETTER_ARTIFACT_ID,
        sourceHash: "cover-letter-content-hash-a",
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function buildRawApprovedCoverLetterArtifact(): StoredDocument<any> {
  return {
    _id: "applicationArtifacts_cover_letter_raw",
    _creationTime: NOW,
    id: COVER_LETTER_ARTIFACT_ID,
    userId: OWNER_PROFILE_ID,
    contextId: APPLICATION_CONTEXT_ID,
    type: "cover_letter",
    status: "approved",
    title: "Approved cover letter",
    content: {
      kind: "cover_letter_artifact",
      artifact: buildCoverLetterArtifactFixture(),
      version: 1,
    },
    textPreview: "Dear Example co,",
    sourceHashes: {
      contextHash: "context-hash",
    },
    provenance: {
      jobId: JOB_ID,
      sourceFactIds: ["candidate-fact:b"],
    },
    sourceRefs: [
      {
        sourceType: "artifact",
        sourceId: COVER_LETTER_ARTIFACT_ID,
        sourceHash: "cover-letter-content-hash-a",
      },
    ],
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
  };
}

function buildPackageWithApprovedCoverLetterExport() {
  return {
    packagePayload: buildApplicationPackageFixture(),
    coverLetterContentHash: "cover-letter-content-hash-a",
    storedArtifact: buildApprovedCoverLetterExportArtifact(),
  };
}

function buildPackageWithApprovedResumeExport(
  storedArtifact: StoredDocument<any> = buildApprovedResumeExportArtifact(),
) {
  return {
    packagePayload: buildApplicationPackageFixture(),
    resumeContentHash: "resume-content-hash-a",
    storedArtifact,
  };
}

function makeCtx(options: {
  clerkId?: string | null;
  applicationUrl?: string | null;
  sourceUrl?: string | null;
  packageOverrides?: Partial<StoredDocument<any>>;
  includePackage?: boolean;
  applicationArtifacts?: StoredDocument<any>[];
} = {}) {
  const tables: Record<TableName, StoredDocument<any>[]> = {
    userProfiles: [
      {
        _id: OWNER_PROFILE_ID,
        _creationTime: NOW,
        clerkId: "clerk_owner",
        email: "owner@example.com",
        updatedAt: NOW,
      },
      {
        _id: OTHER_PROFILE_ID,
        _creationTime: NOW - 1,
        clerkId: "clerk_other",
        email: "other@example.com",
        updatedAt: NOW - 1,
      },
    ],
    jobs: [
      {
        _id: JOB_ID,
        _creationTime: NOW,
        userId: OWNER_PROFILE_ID,
        title: "Operations lead",
        company: "Example co",
        applicationUrl:
          options.applicationUrl === undefined
            ? APPLICATION_URL
            : options.applicationUrl,
        sourceUrl:
          options.sourceUrl === undefined
            ? "https://source.example.com/job"
            : options.sourceUrl,
        archivedAt: null,
        updatedAt: NOW,
      },
    ],
    applicationContexts: [
      {
        _id: "applicationContexts_1",
        _creationTime: NOW,
        id: APPLICATION_CONTEXT_ID,
        userId: OWNER_PROFILE_ID,
        job: {
          jobId: JOB_ID,
          sourceUrl: "https://source.example.com/job",
          title: "Operations lead",
          company: "Example co",
          rawTextHash: "raw-job-text-hash",
        },
        candidate: {
          sourceKind: "cv",
          cvId: "cv_1",
          candidateHash: "candidate-hash",
        },
        settingsHash: "settings-hash",
        contextHash: "context-hash",
        reviewState: "approved",
        sourceRefs: [],
        createdAt: NOW,
        updatedAt: NOW,
        version: 1,
      },
    ],
    applicationPackages:
      options.includePackage === false
        ? []
        : [buildStoredPackage(options.packageOverrides)],
    applicationArtifacts: options.applicationArtifacts ?? [],
    manualApplicationHandoffs: [],
    manualApplicationHandoffEvents: [],
    manualApplicationHandoffRateLimits: [],
    liveExternalActionExecutions: [],
  };
  let sequence = 0;

  const applyConstraints = <T>(
    documents: StoredDocument<T>[],
    constraints: Constraint[],
  ) =>
    documents.filter((doc) =>
      constraints.every((constraint) => {
        const value = readField(doc, constraint.field);
        if (constraint.op === "lt") {
          return (
            typeof value === "number" &&
            typeof constraint.val === "number" &&
            value < constraint.val
          );
        }
        return value === constraint.val;
      }),
    );

  const db = {
    normalizeId: (tableName: TableName, id: string) =>
      tables[tableName]?.some((doc) => String(doc._id) === String(id)) ? id : null,
    get: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const found = rows.find((doc) => String(doc._id) === String(id));
        if (found) return found;
      }
      return null;
    },
    insert: async (tableName: TableName, doc: any) => {
      sequence += 1;
      const stored = {
        _id: `${tableName}_${sequence}`,
        _creationTime: NOW + sequence,
        ...doc,
      };
      tables[tableName].push(stored);
      return stored._id;
    },
    patch: async (id: string, patch: Record<string, unknown>) => {
      for (const rows of Object.values(tables)) {
        const found = rows.find((doc) => String(doc._id) === String(id));
        if (found) {
          Object.assign(found, patch);
          return;
        }
      }
      throw new Error(`record not found: ${id}`);
    },
    delete: async (id: string) => {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex((doc) => String(doc._id) === String(id));
        if (index >= 0) {
          rows.splice(index, 1);
          return;
        }
      }
      throw new Error(`record not found: ${id}`);
    },
    query: (tableName: TableName) => ({
      withIndex: (_indexName: string, buildQuery: (query: any) => unknown) => {
        const constraints: Constraint[] = [];
        const query = {
          eq(field: string, val: unknown) {
            constraints.push({ field, op: "eq", val });
            return query;
          },
          lt(field: string, val: unknown) {
            constraints.push({ field, op: "lt", val });
            return query;
          },
        };
        buildQuery(query);
        const matching = applyConstraints(tables[tableName], constraints);
        const result = {
          collect: async () => matching,
          first: async () => matching[0] ?? null,
          unique: async () => {
            if (matching.length > 1) {
              throw new Error("expected unique result");
            }
            return matching[0] ?? null;
          },
          order: () => ({
            take: async (limit: number) => matching.slice(0, limit),
          }),
          take: async (limit: number) => matching.slice(0, limit),
        };
        return result;
      },
      collect: async () => tables[tableName],
    }),
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: async () =>
          options.clerkId === null
            ? null
            : { subject: options.clerkId ?? "clerk_owner" },
      },
      db,
    },
    tables,
  };
}

function readField(doc: Record<string, unknown>, field: string): unknown {
  return field.split(".").reduce<unknown>((current, part) => {
    if (!current || typeof current !== "object") {
      return undefined;
    }
    return (current as Record<string, unknown>)[part];
  }, doc);
}

async function prepareConfirmedHandoff() {
  vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
  const { ctx, tables } = makeCtx();
  const prepared = await prepare._handler(ctx as any, {
    jobId: JOB_ID,
    applicationPackageId: APPLICATION_PACKAGE_ID,
    now: NOW,
  });
  const confirmed = await confirm._handler(ctx as any, {
    handoffId: prepared.handoffId,
    manifestDigest: prepared.manifestDigest,
    confirmationCopy: prepared.requiredConfirmationCopy,
    now: NOW + 1,
  });
  return { ctx, tables, prepared, confirmed };
}

describe("manual application handoff", () => {
  it("defaults the PR80B feature flag off and mutations fail closed before writing", async () => {
    expect(readManualApplicationHandoffServerConfigStatus({})).toMatchObject({
      enabled: false,
      configured: false,
      featureFlagId: "TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED",
      status: "feature_disabled",
    });
    expect(
      readManualApplicationHandoffServerConfigStatus({
        TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "1",
      }).enabled,
    ).toBe(false);

    const { ctx, tables } = makeCtx();
    const safeStatus = await getForJob._handler(ctx as any, { jobId: JOB_ID });
    expect(safeStatus).toMatchObject({
      status: "disabled",
      persistedState: null,
      canPrepare: false,
    });

    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).rejects.toThrow(/disabled/i);
    expect(tables.manualApplicationHandoffs).toHaveLength(0);
    expect(tables.manualApplicationHandoffEvents).toHaveLength(0);
  });

  it("prepares a redacted owner-scoped package handoff without creating PR80A records", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const { ctx, tables } = makeCtx();
    const result = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
    });

    expect(result).toMatchObject({
      status: "handoff_prepared",
      destinationHostname: "jobs.example.com",
      destinationOrigin: "https://jobs.example.com",
      applicationPackageId: APPLICATION_PACKAGE_ID,
      applicationContextId: APPLICATION_CONTEXT_ID,
      resumeVariantArtifactId: RESUME_ARTIFACT_ID,
      coverLetterArtifactId: COVER_LETTER_ARTIFACT_ID,
    });
    expect(result.applicationUrl).toBe(APPLICATION_URL);
    expect(result.requiredConfirmationCopy).toContain(result.manifestDigest);
    expect(result.approvedAnswers).toEqual([]);
    expect(result.downloadableArtifacts).toEqual([]);
    expect(result.answerCopyBlockedReason).toMatch(/blocked/i);
    expect(result.downloadBlockedReason).toMatch(/blocked/i);
    expect(tables.manualApplicationHandoffs).toHaveLength(1);
    expect(tables.manualApplicationHandoffEvents).toHaveLength(1);
    expect(tables.liveExternalActionExecutions).toHaveLength(0);

    const persisted = JSON.stringify({
      handoff: tables.manualApplicationHandoffs[0],
      event: tables.manualApplicationHandoffEvents[0],
    });
    expect(persisted).toContain(OWNER_PROFILE_ID);
    expect(persisted).not.toContain("clerk_owner");
    expect(persisted).not.toContain(APPLICATION_URL);
    expect(persisted).not.toContain("candidate=private");
    expect(persisted).not.toContain("#section");
    expect(persisted).not.toMatch(
      /answer text|CV text|cover-letter text|job-description text|provider receipt/i,
    );
    expect(tables.manualApplicationHandoffEvents[0]).toMatchObject({
      eventKind: "manual_handoff.prepared",
      evidence: "twoweeks_prepared",
      stateAfter: "handoff_prepared",
    });
  });

  it("derives ownership from ctx.auth and rejects non-owner access", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const { ctx } = makeCtx({ clerkId: "clerk_other" });
    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).rejects.toThrow(/job not found/i);
    await expect(
      getForJob._handler(ctx as any, {
        jobId: JOB_ID,
      }),
    ).rejects.toThrow(/job not found/i);
  });

  it("requires a ready application package bound to the job application context", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const blockedPackage = buildStoredPackage({
      status: "draft",
      package: buildApplicationPackageFixture({ status: "draft" }),
    });
    const { ctx } = makeCtx({ packageOverrides: blockedPackage });
    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).rejects.toThrow(/ready_for_review/i);

    const blockedResumeArtifact = makeCtx({
      packageOverrides: {
        resumeVariantArtifactStatus: "needs_review",
      },
    });
    await expect(
      prepare._handler(blockedResumeArtifact.ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).rejects.toThrow(/artifact/i);

    const staleArtifactPackage = buildApplicationPackageFixture({
      artifacts: [
        {
          id: RESUME_ARTIFACT_ID,
          kind: "resume_variant_artifact",
          contentHash: "changed-resume-content-hash",
          status: "ready_for_generation",
          version: 1,
        },
        {
          id: COVER_LETTER_ARTIFACT_ID,
          kind: "cover_letter_artifact",
          contentHash: "cover-letter-content-hash-a",
          status: "ready_for_review",
          version: 1,
        },
      ],
    });
    const staleArtifact = makeCtx({
      packageOverrides: {
        package: staleArtifactPackage,
      },
    });
    await expect(
      prepare._handler(staleArtifact.ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).rejects.toThrow(/artifact/i);
  });

  it("fails closed when the resume artifact contentHash is missing", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const packageMissingResumeHash = buildApplicationPackageFixture({
      artifacts: [
        {
          id: RESUME_ARTIFACT_ID,
          kind: "resume_variant_artifact",
          status: "ready_for_generation",
          version: 1,
        },
        {
          id: COVER_LETTER_ARTIFACT_ID,
          kind: "cover_letter_artifact",
          contentHash: "cover-letter-content-hash-a",
          status: "ready_for_review",
          version: 1,
        },
      ],
    });
    const { ctx } = makeCtx({
      packageOverrides: { package: packageMissingResumeHash },
    });

    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).rejects.toThrow(/artifact contentHash/i);
  });

  it("fails closed when the cover-letter artifact contentHash is missing", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const packageMissingCoverLetterHash = buildApplicationPackageFixture({
      artifacts: [
        {
          id: RESUME_ARTIFACT_ID,
          kind: "resume_variant_artifact",
          contentHash: "resume-content-hash-a",
          status: "ready_for_generation",
          version: 1,
        },
        {
          id: COVER_LETTER_ARTIFACT_ID,
          kind: "cover_letter_artifact",
          status: "ready_for_review",
          version: 1,
        },
      ],
    });
    const { ctx } = makeCtx({
      packageOverrides: { package: packageMissingCoverLetterHash },
    });

    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).rejects.toThrow(/artifact contentHash/i);
  });

  it("fails closed when an included artifact item contentHash is missing", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const basePackage = buildApplicationPackageFixture();
    const packageMissingItemHash = buildApplicationPackageFixture({
      items: basePackage.items.map((item) => {
        if (item.artifactId !== RESUME_ARTIFACT_ID) return item;
        const nextItem = { ...item };
        delete (nextItem as Record<string, unknown>).artifactContentHash;
        return nextItem;
      }),
    });
    const { ctx } = makeCtx({
      packageOverrides: { package: packageMissingItemHash },
    });

    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).rejects.toThrow(/artifactContentHash/i);
  });

  it("fails closed when artifact and item content hashes differ", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const packageWithMismatchedHashes = buildApplicationPackageFixture({
      artifacts: [
        {
          id: RESUME_ARTIFACT_ID,
          kind: "resume_variant_artifact",
          contentHash: "changed-resume-content-hash",
          status: "ready_for_generation",
          version: 1,
        },
        {
          id: COVER_LETTER_ARTIFACT_ID,
          kind: "cover_letter_artifact",
          contentHash: "cover-letter-content-hash-a",
          status: "ready_for_review",
          version: 1,
        },
      ],
    });
    const { ctx } = makeCtx({
      packageOverrides: { package: packageWithMismatchedHashes },
    });

    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).rejects.toThrow(/artifact contentHash/i);
  });

  it("allows prepare when artifact and included item content hashes match", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const { ctx } = makeCtx();

    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).resolves.toMatchObject({
      status: "handoff_prepared",
      resumeVariantArtifactId: RESUME_ARTIFACT_ID,
      coverLetterArtifactId: COVER_LETTER_ARTIFACT_ID,
    });
  });

  it("uses stable manifest digests and rejects stale or inexact confirmations", async () => {
    const destination = await validateManualApplicationDestination(APPLICATION_URL);
    const baseManifest = {
      ownerProfileId: OWNER_PROFILE_ID,
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      applicationContextId: APPLICATION_CONTEXT_ID,
      packageHash: "hash-a",
      contentHash: "package-content-hash-a",
      resumeVariantArtifactId: RESUME_ARTIFACT_ID,
      resumeVariantArtifactContentHash: "resume-content-hash-a",
      coverLetterArtifactId: COVER_LETTER_ARTIFACT_ID,
      coverLetterArtifactContentHash: "cover-letter-content-hash-a",
      destinationUrlHash: destination.destinationUrlHash,
      destinationHostname: destination.destinationHostname,
      destinationOrigin: destination.destinationOrigin,
    };
    await expect(
      buildManualApplicationHandoffManifestDigest(baseManifest),
    ).resolves.toBe(
      await buildManualApplicationHandoffManifestDigest({
        destinationHostname: baseManifest.destinationHostname,
        destinationOrigin: baseManifest.destinationOrigin,
        destinationUrlHash: baseManifest.destinationUrlHash,
        coverLetterArtifactContentHash:
          baseManifest.coverLetterArtifactContentHash,
        coverLetterArtifactId: baseManifest.coverLetterArtifactId,
        resumeVariantArtifactContentHash:
          baseManifest.resumeVariantArtifactContentHash,
        resumeVariantArtifactId: baseManifest.resumeVariantArtifactId,
        contentHash: baseManifest.contentHash,
        packageHash: baseManifest.packageHash,
        applicationContextId: baseManifest.applicationContextId,
        applicationPackageId: baseManifest.applicationPackageId,
        jobId: baseManifest.jobId,
        ownerProfileId: baseManifest.ownerProfileId,
      }),
    );
    await expect(
      buildManualApplicationHandoffManifestDigest({
        ...baseManifest,
        contentHash: "changed-package-content-hash",
      }),
    ).resolves.not.toBe(
      await buildManualApplicationHandoffManifestDigest(baseManifest),
    );

    const { ctx, tables } = makeCtx();
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const prepared = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
    });
    await expect(
      confirm._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: "0".repeat(64),
        confirmationCopy: prepared.requiredConfirmationCopy,
        now: NOW + 1,
      }),
    ).rejects.toThrow(/digest/i);
    await expect(
      confirm._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        confirmationCopy: "I confirm a different package.",
        now: NOW + 1,
      }),
    ).rejects.toThrow(/confirmation/i);

    await confirm._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      confirmationCopy: prepared.requiredConfirmationCopy,
      now: NOW + 1,
    });
    tables.applicationPackages[0].contentHash = "changed-package-content-hash";
    await expect(
      recordDestinationOpenRequested._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        now: NOW + 2,
      }),
    ).rejects.toThrow(/stale/i);
  });

  it("keeps answer copy blocked behind a tight attempt limit and blocks downloads without approved exports", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + 2);
    const { ctx, tables, prepared } = await prepareConfirmedHandoff();

    await expect(
      recordCopySucceeded._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        answerRef: "application-answer:screening-question-1",
        answerDigest: "a".repeat(64),
        now: NOW + 2,
      }),
    ).resolves.toMatchObject({
      status: "handoff_confirmed",
      approvedAnswers: [],
      answerCopyBlockedReason:
        "Approved answer copy is blocked until approved answers are server-derived.",
    });
    expect(tables.manualApplicationHandoffEvents).toHaveLength(2);
    expect(
      tables.manualApplicationHandoffRateLimits.map((row) => row.capability),
    ).toContain("manual_handoff.answer_copy_blocked_attempt");
    const persistedLimits = JSON.stringify(tables.manualApplicationHandoffRateLimits);
    expect(persistedLimits).not.toContain("application-answer text");
    expect(persistedLimits).not.toContain(APPROVED_COVER_LETTER_TEXT);

    await expect(
      recordFileDownloadRequested._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        artifactRef: RESUME_ARTIFACT_ID,
        artifactDigest: "b".repeat(64),
        now: NOW + 3,
      }),
    ).rejects.toThrow(/blocked/i);
  });

  it("rate limits repeated blocked answer-copy attempts without enabling answer copy", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW + 2);
    const { ctx, tables, prepared } = await prepareConfirmedHandoff();

    for (let index = 0; index < 3; index += 1) {
      await expect(
        recordCopySucceeded._handler(ctx as any, {
          handoffId: prepared.handoffId,
          manifestDigest: prepared.manifestDigest,
          answerRef: "application-answer:screening-question-1",
          answerDigest: "a".repeat(64),
        }),
      ).resolves.toMatchObject({
        approvedAnswers: [],
        answerCopyBlockedReason:
          "Approved answer copy is blocked until approved answers are server-derived.",
      });
    }

    await expect(
      recordCopySucceeded._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        answerRef: "application-answer:screening-question-1",
        answerDigest: "a".repeat(64),
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({
        code: "manual_application_handoff_rate_limited",
        category: "rate_limited",
      }),
    });

    const answerCopyQuotaRows = tables.manualApplicationHandoffRateLimits.filter(
      (row) => row.capability === "manual_handoff.answer_copy_blocked_attempt",
    );
    expect(answerCopyQuotaRows).toHaveLength(1);
    expect(answerCopyQuotaRows[0]).toMatchObject({
      shortWindowCount: 3,
      longWindowCount: 3,
    });
    expect(tables.manualApplicationHandoffEvents).toHaveLength(2);
  });

  it("delivers approved artifact export content through an owner-scoped confirmed handoff mutation", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const { packagePayload, coverLetterContentHash, storedArtifact } =
      buildPackageWithApprovedCoverLetterExport();
    expect(storedArtifact).toMatchObject({
      type: "export",
      content: {
        kind: "mcp_cover_letter_application_package_export_payload",
        artifactKind: "cover_letter",
      },
    });
    const { ctx, tables } = makeCtx({
      packageOverrides: {
        package: packagePayload,
      },
      applicationArtifacts: [storedArtifact],
    });
    const prepared = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
    });
    await confirm._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      confirmationCopy: prepared.requiredConfirmationCopy,
      now: NOW + 1,
    });

    const delivery = await getDeliveryContentForHandoff._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
    });

    expect(delivery.approvedAnswers).toEqual([]);
    expect(delivery.answerCopyBlockedReason).toMatch(/blocked/i);
    expect(delivery.downloadBlockedReason).toBeNull();
    expect(delivery.downloadableArtifacts).toEqual([
      expect.objectContaining({
        artifactRef: COVER_LETTER_ARTIFACT_ID,
        label: "Cover letter export",
        filename: "cover-letter-export.md",
        mimeType: "text/markdown",
        text: APPROVED_COVER_LETTER_TEXT,
        artifactDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        approvalProof: expect.objectContaining({
          artifactStatus: "approved",
          packageStatus: "ready_for_review",
          manifestDigest: prepared.manifestDigest,
        }),
        freshnessProof: expect.objectContaining({
          applicationPackageId: APPLICATION_PACKAGE_ID,
          applicationContextId: APPLICATION_CONTEXT_ID,
          artifactContentHash: coverLetterContentHash,
        }),
      }),
    ]);
    expect(tables.manualApplicationHandoffEvents).toHaveLength(2);
  });

  it("rate limits delivery content loads with one redacted owner-scoped quota record", async () => {
    vi.spyOn(Date, "now").mockReturnValue(NOW);
    const { ctx, tables, prepared } = await prepareConfirmedHandoff();
    tables.manualApplicationHandoffRateLimits.push({
      _id: "manualApplicationHandoffRateLimits_expired",
      _creationTime: NOW - 100,
      rateLimitId: "manual-application-handoff-rate-limit:expired",
      ownerProfileId: OWNER_PROFILE_ID,
      capability: "manual_handoff.delivery_content_load",
      resourceHash: "0".repeat(64),
      shortWindowStartedAt: NOW - 120_000,
      shortWindowCount: 1,
      longWindowStartedAt: NOW - 90_000_000,
      longWindowCount: 1,
      lastAllowedAt: NOW - 90_000_000,
      createdAt: NOW - 90_000_000,
      updatedAt: NOW - 90_000_000,
      expiresAt: NOW - 1,
      version: 1,
    });

    for (let index = 0; index < 12; index += 1) {
      await expect(
        getDeliveryContentForHandoff._handler(ctx as any, {
          handoffId: prepared.handoffId,
          manifestDigest: prepared.manifestDigest,
        }),
      ).resolves.toMatchObject({
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        approvedAnswers: [],
        providerVerified: false,
      });
    }

    await expect(
      getDeliveryContentForHandoff._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
      }),
    ).rejects.toMatchObject({
      data: expect.objectContaining({
        code: "manual_application_handoff_rate_limited",
        category: "rate_limited",
        retryAfterSeconds: expect.any(Number),
        refusalVersion: 1,
      }),
    });

    const deliveryQuotaRows = tables.manualApplicationHandoffRateLimits.filter(
      (row) => row.capability === "manual_handoff.delivery_content_load",
    );
    expect(deliveryQuotaRows).toHaveLength(1);
    expect(
      tables.manualApplicationHandoffRateLimits.some(
        (row) => row.rateLimitId === "manual-application-handoff-rate-limit:expired",
      ),
    ).toBe(false);
    expect(deliveryQuotaRows[0]).toMatchObject({
      ownerProfileId: OWNER_PROFILE_ID,
      capability: "manual_handoff.delivery_content_load",
      shortWindowCount: 12,
      longWindowCount: 12,
      resourceHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      version: 1,
    });
    expect(tables.manualApplicationHandoffEvents).toHaveLength(2);

    const persistedQuota = JSON.stringify(deliveryQuotaRows);
    expect(persistedQuota).not.toContain("clerk_owner");
    expect(persistedQuota).not.toContain("owner@example.com");
    expect(persistedQuota).not.toContain(APPLICATION_URL);
    expect(persistedQuota).not.toContain("candidate=private");
    expect(persistedQuota).not.toContain("#section");
    expect(persistedQuota).not.toContain(APPROVED_RESUME_EXPORT_TEXT);
    expect(persistedQuota).not.toContain(APPROVED_COVER_LETTER_TEXT);
  });

  it("delivers approved resume export content from the real export payload", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const { packagePayload, resumeContentHash, storedArtifact } =
      buildPackageWithApprovedResumeExport();
    expect(storedArtifact).toMatchObject({
      type: "export",
      content: {
        kind: "mcp_resume_export_payload",
        artifactKind: "resume_variant",
      },
    });
    const { ctx } = makeCtx({
      packageOverrides: {
        package: packagePayload,
      },
      applicationArtifacts: [storedArtifact],
    });
    const prepared = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
    });
    await confirm._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      confirmationCopy: prepared.requiredConfirmationCopy,
      now: NOW + 1,
    });

    const delivery = await getDeliveryContentForHandoff._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
    });

    expect(delivery.approvedAnswers).toEqual([]);
    expect(delivery.downloadBlockedReason).toBeNull();
    expect(delivery.downloadableArtifacts).toEqual([
      expect.objectContaining({
        artifactRef: RESUME_ARTIFACT_ID,
        label: "Resume export",
        filename: "resume-export.md",
        mimeType: "text/markdown",
        text: APPROVED_RESUME_EXPORT_TEXT,
        artifactDigest: expect.stringMatching(/^[a-f0-9]{64}$/),
        freshnessProof: expect.objectContaining({
          applicationPackageId: APPLICATION_PACKAGE_ID,
          applicationContextId: APPLICATION_CONTEXT_ID,
          artifactContentHash: resumeContentHash,
        }),
      }),
    ]);
  });

  it("does not deliver stale or wrong-user approved resume exports", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const staleResumeExport = buildApprovedResumeExportArtifact({
      sourceRefs: [
        {
          sourceType: "artifact",
          sourceId: RESUME_ARTIFACT_ID,
          sourceHash: "stale-resume-content-hash",
        },
      ],
    });
    const wrongUserResumeExport = buildApprovedResumeExportArtifact({
      _id: "applicationArtifacts_resume_export_wrong_user",
      id: "application-export:resume-wrong-user",
      userId: OTHER_PROFILE_ID,
    });
    const { ctx } = makeCtx({
      applicationArtifacts: [staleResumeExport, wrongUserResumeExport],
    });
    const prepared = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
    });
    await confirm._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      confirmationCopy: prepared.requiredConfirmationCopy,
      now: NOW + 1,
    });

    const delivery = await getDeliveryContentForHandoff._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
    });

    expect(delivery.downloadableArtifacts).toEqual([]);
    expect(delivery.downloadBlockedReason).toMatch(/blocked/i);
  });

  it("records resume download requests with only safe refs and rejects wrong digests", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const { packagePayload, storedArtifact } =
      buildPackageWithApprovedResumeExport();
    const { ctx, tables } = makeCtx({
      packageOverrides: {
        package: packagePayload,
      },
      applicationArtifacts: [storedArtifact],
    });
    const prepared = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
    });
    await confirm._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      confirmationCopy: prepared.requiredConfirmationCopy,
      now: NOW + 1,
    });
    const delivery = await getDeliveryContentForHandoff._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
    });
    const artifact = delivery.downloadableArtifacts[0];

    await expect(
      recordFileDownloadRequested._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        artifactRef: artifact.artifactRef,
        artifactDigest: "d".repeat(64),
        now: NOW + 2,
      }),
    ).rejects.toThrow(/blocked/i);

    await expect(
      recordFileDownloadRequested._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        artifactRef: artifact.artifactRef,
        artifactDigest: artifact.artifactDigest,
        now: NOW + 3,
      }),
    ).resolves.toMatchObject({
      status: "handoff_confirmed",
    });

    expect(tables.manualApplicationHandoffEvents.at(-1)).toMatchObject({
      eventKind: "manual_handoff.file_download_requested",
      evidence: "user_interaction_observed",
      artifactRef: RESUME_ARTIFACT_ID,
      artifactDigest: artifact.artifactDigest,
    });
    const persisted = JSON.stringify(tables.manualApplicationHandoffEvents);
    expect(persisted).not.toContain(APPROVED_RESUME_EXPORT_TEXT);
    expect(persisted).not.toContain(APPLICATION_URL);
  });

  it("selects the newest matching resume export when more than 50 context artifacts exist", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const newestResumeExportText =
      "Jane Example\n\nNewest approved resume export selected for handoff.";
    const olderResumeExport = buildApprovedResumeExportArtifact({
      _id: "applicationArtifacts_resume_export_older",
      id: "application-export:resume-older",
      updatedAt: NOW + 1,
    });
    const fillerArtifacts = Array.from({ length: 60 }, (_, index) =>
      buildApprovedResumeExportArtifact({
        _id: `applicationArtifacts_resume_export_noise_${index}`,
        _creationTime: NOW + 100 + index,
        id: `application-export:resume-noise-${index}`,
        sourceRefs: [
          {
            sourceType: "artifact",
            sourceId: `resume-variant-artifact:noise-${index}`,
            sourceHash: "resume-content-hash-a",
          },
        ],
        updatedAt: NOW + 100 + index,
      }),
    );
    const newestResumeExport = buildApprovedResumeExportArtifact({
      _id: "applicationArtifacts_resume_export_newest",
      _creationTime: NOW + 10_000,
      id: "application-export:resume-newest",
      content: {
        kind: "mcp_resume_export_payload",
        artifactKind: "resume_variant",
        fileName: "resume-export-newest.md",
        mimeType: "text/markdown",
        content: newestResumeExportText,
        checksum: "resume-export-checksum-newest",
        persisted: false,
        urlCreated: false,
        writeActionExecuted: false,
        version: 1,
      },
      updatedAt: NOW + 10_000,
    });
    const { ctx } = makeCtx({
      applicationArtifacts: [
        olderResumeExport,
        ...fillerArtifacts,
        newestResumeExport,
      ],
    });
    const prepared = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
    });
    await confirm._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      confirmationCopy: prepared.requiredConfirmationCopy,
      now: NOW + 1,
    });

    const delivery = await getDeliveryContentForHandoff._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
    });

    expect(delivery.downloadableArtifacts).toEqual([
      expect.objectContaining({
        artifactRef: RESUME_ARTIFACT_ID,
        filename: "resume-export-newest.md",
        text: newestResumeExportText,
      }),
    ]);
  });

  it("does not deliver raw approved artifact content without an export payload", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const { ctx } = makeCtx({
      applicationArtifacts: [buildRawApprovedCoverLetterArtifact()],
    });
    const prepared = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
    });
    await confirm._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      confirmationCopy: prepared.requiredConfirmationCopy,
      now: NOW + 1,
    });

    const delivery = await getDeliveryContentForHandoff._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
    });

    expect(delivery.downloadableArtifacts).toEqual([]);
    expect(delivery.downloadBlockedReason).toMatch(/blocked/i);
  });

  it("records artifact download requests with only artifact refs and digests", async () => {
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    const { packagePayload, storedArtifact } =
      buildPackageWithApprovedCoverLetterExport();
    const { ctx, tables } = makeCtx({
      packageOverrides: {
        package: packagePayload,
      },
      applicationArtifacts: [storedArtifact],
    });
    const prepared = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
    });
    await confirm._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      confirmationCopy: prepared.requiredConfirmationCopy,
      now: NOW + 1,
    });
    const delivery = await getDeliveryContentForHandoff._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
    });
    const artifact = delivery.downloadableArtifacts[0];

    await expect(
      recordFileDownloadRequested._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        artifactRef: artifact.artifactRef,
        artifactDigest: artifact.artifactDigest,
        now: NOW + 2,
      }),
    ).resolves.toMatchObject({
      status: "handoff_confirmed",
    });

    expect(tables.manualApplicationHandoffEvents.at(-1)).toMatchObject({
      eventKind: "manual_handoff.file_download_requested",
      evidence: "user_interaction_observed",
      artifactRef: COVER_LETTER_ARTIFACT_ID,
      artifactDigest: artifact.artifactDigest,
    });
    expect(
      tables.manualApplicationHandoffRateLimits.map((row) => row.capability),
    ).toContain("manual_handoff.file_download_request");
    const persisted = JSON.stringify(tables.manualApplicationHandoffEvents);
    expect(persisted).not.toContain(APPROVED_COVER_LETTER_TEXT);
    expect(persisted).not.toContain(APPLICATION_URL);
  });

  it("records destination-open request and user-reported outcome with approved event names", async () => {
    const { ctx, tables, prepared } = await prepareConfirmedHandoff();

    const openResult = await recordDestinationOpenRequested._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      now: NOW + 4,
    });
    const outcome = await reportOutcome._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      outcome: "user_reported_submitted",
      now: NOW + 5,
    });

    expect(openResult).toMatchObject({
      status: "destination_open_requested",
      applicationUrl: APPLICATION_URL,
    });
    expect(outcome).toMatchObject({
      status: "user_reported_submitted",
      providerVerified: false,
    });
    expect(tables.manualApplicationHandoffs[0].state).toBe(
      "user_reported_submitted",
    );
    expect(
      tables.manualApplicationHandoffEvents.map((event) => event.eventKind),
    ).toEqual([
      "manual_handoff.prepared",
      "manual_handoff.confirmed",
      "manual_handoff.destination_open_requested",
      "manual_handoff.outcome_reported",
    ]);
    expect(
      tables.manualApplicationHandoffEvents.map((event) => event.evidence),
    ).toEqual([
      "twoweeks_prepared",
      "user_interaction_observed",
      "user_interaction_observed",
      "user_reported",
    ]);
    const persisted = JSON.stringify(tables.manualApplicationHandoffEvents);
    expect(persisted).not.toContain("application-answer text");
    expect(persisted).not.toContain(APPLICATION_URL);
    expect(persisted).not.toMatch(/provider|receipt|verified/i);
    expect(
      tables.manualApplicationHandoffRateLimits.map((row) => row.capability),
    ).toEqual([
      "manual_handoff.prepare",
      "manual_handoff.confirm",
      "manual_handoff.destination_open_request",
      "manual_handoff.outcome_report",
    ]);
    const persistedLimits = JSON.stringify(
      tables.manualApplicationHandoffRateLimits,
    );
    expect(persistedLimits).not.toContain("clerk_owner");
    expect(persistedLimits).not.toContain("owner@example.com");
    expect(persistedLimits).not.toContain(APPLICATION_URL);
  });

  it("invalidates confirmation when the owned job application URL changes", async () => {
    const { ctx, tables, prepared } = await prepareConfirmedHandoff();
    tables.jobs[0].applicationUrl =
      "https://jobs.example.com/apply/changed?candidate=changed#later";

    await expect(
      recordDestinationOpenRequested._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        now: NOW + 2,
      }),
    ).rejects.toThrow(/stale/i);

    expect(
      tables.manualApplicationHandoffEvents.map((event) => event.eventKind),
    ).toContain("manual_handoff.confirmation_invalidated");
    const persisted = JSON.stringify(tables.manualApplicationHandoffEvents);
    expect(persisted).not.toContain("changed?candidate=changed");
    expect(persisted).not.toContain("#later");
    expect(tables.manualApplicationHandoffs[0].state).toBe("handoff_confirmed");
  });

  it("keeps terminal outcomes idempotent and rejects conflicting terminal reports", async () => {
    const { ctx, tables, prepared } = await prepareConfirmedHandoff();

    await recordDestinationOpenRequested._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      now: NOW + 2,
    });
    const submitted = await reportOutcome._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      outcome: "user_reported_submitted",
      now: NOW + 3,
    });
    const eventCount = tables.manualApplicationHandoffEvents.length;

    await expect(
      reportOutcome._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        outcome: "user_reported_not_submitted",
        now: NOW + 4,
      }),
    ).rejects.toThrow(/conflict/i);
    const repeated = await reportOutcome._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      outcome: "user_reported_submitted",
      now: NOW + 5,
    });
    const preparedAgain = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW + 6,
    });

    expect(submitted.status).toBe("user_reported_submitted");
    expect(repeated.status).toBe("user_reported_submitted");
    expect(preparedAgain.status).toBe("user_reported_submitted");
    expect(tables.manualApplicationHandoffs[0].state).toBe(
      "user_reported_submitted",
    );
    expect(tables.manualApplicationHandoffEvents).toHaveLength(eventCount);
  });

  it("allows only the approved persisted states, evidence values, and event names", () => {
    expect(MANUAL_APPLICATION_HANDOFF_STATES).toEqual([
      "handoff_prepared",
      "handoff_confirmed",
      "destination_open_requested",
      "user_reported_submitted",
      "user_reported_not_submitted",
      "abandoned",
    ]);
    expect(MANUAL_APPLICATION_HANDOFF_STATES).not.toContain("not_started");
    expect(MANUAL_APPLICATION_HANDOFF_STATES).not.toContain(
      "provider_verified_submitted",
    );
    expect(MANUAL_APPLICATION_HANDOFF_STATES).not.toContain(
      "provider_receipt_verified",
    );
    expect(MANUAL_APPLICATION_HANDOFF_EVIDENCE).toEqual([
      "twoweeks_prepared",
      "user_interaction_observed",
      "user_reported",
    ]);
    expect(MANUAL_APPLICATION_HANDOFF_EVENT_KINDS).toEqual([
      "manual_handoff.prepared",
      "manual_handoff.confirmed",
      "manual_handoff.item_copy_succeeded",
      "manual_handoff.file_download_requested",
      "manual_handoff.destination_open_requested",
      "manual_handoff.outcome_reported",
      "manual_handoff.abandoned",
      "manual_handoff.confirmation_invalidated",
    ]);
    expect(MANUAL_APPLICATION_HANDOFF_EVENT_KINDS).not.toContain(
      "manual_handoff.copy_succeeded",
    );
    expect(MANUAL_APPLICATION_HANDOFF_EVENT_KINDS).not.toContain(
      "manual_handoff.user_reported_submitted",
    );
    expect(MANUAL_APPLICATION_HANDOFF_RATE_LIMIT_CAPABILITIES).toEqual([
      "manual_handoff.prepare",
      "manual_handoff.confirm",
      "manual_handoff.delivery_content_load",
      "manual_handoff.file_download_request",
      "manual_handoff.destination_open_request",
      "manual_handoff.outcome_report",
      "manual_handoff.answer_copy_blocked_attempt",
    ]);
  });

  it("validates destination URL from job.applicationUrl only and stores only origin host and hash", async () => {
    await expect(validateManualApplicationDestination("http://example.com")).rejects.toThrow(
      /https/i,
    );
    await expect(
      validateManualApplicationDestination("https://localhost/apply"),
    ).rejects.toThrow(/destination/i);
    await expect(
      validateManualApplicationDestination("https://jobs.local/apply"),
    ).rejects.toThrow(/destination/i);
    await expect(
      validateManualApplicationDestination("https://user:pass@example.com/apply"),
    ).rejects.toThrow(/auth/i);
    await expect(
      validateManualApplicationDestination("https://8.8.8.8/apply"),
    ).rejects.toThrow(/destination/i);
    await expect(
      validateManualApplicationDestination("https://127.0.0.1/apply"),
    ).rejects.toThrow(/destination/i);
    await expect(
      validateManualApplicationDestination("https://[2606:4700:4700::1111]/apply"),
    ).rejects.toThrow(/destination/i);
    await expect(
      validateManualApplicationDestination("data:text/plain,hello"),
    ).rejects.toThrow(/https/i);
    await expect(
      validateManualApplicationDestination("file:///tmp/application"),
    ).rejects.toThrow(/https/i);
    await expect(
      validateManualApplicationDestination("javascript:alert(1)"),
    ).rejects.toThrow(/https/i);

    const { ctx } = makeCtx({ applicationUrl: "", sourceUrl: APPLICATION_URL });
    vi.stubEnv("TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED", "true");
    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
      }),
    ).rejects.toThrow(/applicationUrl/i);
  });

  it("keeps PR80B runtime files free of provider, network, automation, and PR80A dispatch paths", () => {
    const runtimeText = [
      readFileSync("convex/manualApplicationHandoff.ts", "utf8"),
      readFileSync("convex/lib/manualApplicationHandoff.ts", "utf8"),
      readFileSync("src/components/jobs/ManualApplicationHandoffPanel.tsx", "utf8"),
    ].join("\n");
    expect(runtimeText).not.toMatch(
      /\b(fetch|axios|undici|XMLHttpRequest|WebSocket|EventSource)\b/u,
    );
    expect(runtimeText).not.toMatch(/\bnode:(?:http|https)\b/u);
    expect(runtimeText).not.toMatch(/\b(Authorization|Bearer|Basic|OAuth)\b/u);
    expect(runtimeText).not.toMatch(/\b(credentials|cookies|tokens)\b/iu);
    expect(runtimeText).not.toMatch(
      /api\.smartrecruiters\.com|lever|ashby|teamtailor|greenhouse/iu,
    );
    expect(runtimeText).not.toMatch(/playwright|puppeteer|selenium/iu);
    expect(runtimeText).not.toMatch(/scraping|autofill|submit automation/iu);
    expect(runtimeText).not.toMatch(
      /liveExternalActionExecutions|reserveExternalAction|markExternalActionDispatching|finalizeExternalAction/u,
    );
    expect(runtimeText).not.toContain("TWOWEEKS_LIVE_EXTERNAL_ACTIONS_ENABLED");
  });
});
