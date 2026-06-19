import { readFileSync } from "node:fs";
import { describe, expect, it, vi } from "vitest";
import type { ApplicationPackageV1 } from "../../src/modules/application-package/schema";
import {
  confirm,
  getForJob,
  prepare,
  recordCopySucceeded,
  recordDestinationOpenRequested,
  recordFileDownloadRequested,
  reportOutcome,
} from "../manualApplicationHandoff";
import {
  MANUAL_APPLICATION_HANDOFF_EVIDENCE,
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

type StoredDocument<T> = T & {
  _id: string;
  _creationTime: number;
};

type TableName =
  | "userProfiles"
  | "jobs"
  | "applicationContexts"
  | "applicationPackages"
  | "manualApplicationHandoffs"
  | "manualApplicationHandoffEvents"
  | "liveExternalActionExecutions";

type Constraint = Readonly<{ field: string; val: unknown }>;

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
  const pkg = buildApplicationPackageFixture(overrides.pkg);
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
    pkg,
    createdAt: NOW,
    updatedAt: NOW,
    version: 1,
    ...overrides,
  };
}

function makeCtx(options: {
  clerkId?: string | null;
  applicationUrl?: string | null;
  sourceUrl?: string | null;
  packageOverrides?: Partial<StoredDocument<any>>;
  includePackage?: boolean;
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
    manualApplicationHandoffs: [],
    manualApplicationHandoffEvents: [],
    liveExternalActionExecutions: [],
  };
  let sequence = 0;

  const applyConstraints = <T>(
    documents: StoredDocument<T>[],
    constraints: Constraint[],
  ) =>
    documents.filter((doc) =>
      constraints.every((constraint) => readField(doc, constraint.field) === constraint.val),
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
    query: (tableName: TableName) => ({
      withIndex: (_indexName: string, buildQuery: (query: any) => unknown) => {
        const constraints: Constraint[] = [];
        const query = {
          eq(field: string, val: unknown) {
            constraints.push({ field, val });
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
  const { ctx, tables } = makeCtx();
  const prepared = await prepare._handler(ctx as any, {
    jobId: JOB_ID,
    applicationPackageId: APPLICATION_PACKAGE_ID,
    now: NOW,
    env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
  });
  const confirmed = await confirm._handler(ctx as any, {
    handoffId: prepared.handoffId,
    manifestDigest: prepared.manifestDigest,
    confirmationCopy: prepared.requiredConfirmationCopy,
    now: NOW + 1,
    env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
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
        env: {},
      }),
    ).rejects.toThrow(/disabled/i);
    expect(tables.manualApplicationHandoffs).toHaveLength(0);
    expect(tables.manualApplicationHandoffEvents).toHaveLength(0);
  });

  it("prepares a redacted owner-scoped package handoff without creating PR80A records", async () => {
    const { ctx, tables } = makeCtx();
    const result = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
      env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
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
    const { ctx } = makeCtx({ clerkId: "clerk_other" });
    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
        env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
      }),
    ).rejects.toThrow(/job not found/i);
    await expect(
      getForJob._handler(ctx as any, {
        jobId: JOB_ID,
        env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
      }),
    ).rejects.toThrow(/job not found/i);
  });

  it("requires a ready application package bound to the job application context", async () => {
    const blockedPackage = buildStoredPackage({
      status: "draft",
      pkg: buildApplicationPackageFixture({ status: "draft" }),
    });
    const { ctx } = makeCtx({ packageOverrides: blockedPackage });
    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
        env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
      }),
    ).rejects.toThrow(/ready_for_review/i);
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
    const prepared = await prepare._handler(ctx as any, {
      jobId: JOB_ID,
      applicationPackageId: APPLICATION_PACKAGE_ID,
      now: NOW,
      env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
    });
    await expect(
      confirm._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: "0".repeat(64),
        confirmationCopy: prepared.requiredConfirmationCopy,
        now: NOW + 1,
        env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
      }),
    ).rejects.toThrow(/digest/i);
    await expect(
      confirm._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        confirmationCopy: "I confirm a different package.",
        now: NOW + 1,
        env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
      }),
    ).rejects.toThrow(/confirmation/i);

    await confirm._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      confirmationCopy: prepared.requiredConfirmationCopy,
      now: NOW + 1,
      env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
    });
    tables.applicationPackages[0].contentHash = "changed-package-content-hash";
    await expect(
      recordCopySucceeded._handler(ctx as any, {
        handoffId: prepared.handoffId,
        manifestDigest: prepared.manifestDigest,
        answerRef: "application-answer:one",
        answerDigest: "a".repeat(64),
        now: NOW + 2,
        env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
      }),
    ).rejects.toThrow(/stale/i);
  });

  it("records copy, file-download request, destination-open request, and user-reported outcome truthfully", async () => {
    const { ctx, tables, prepared } = await prepareConfirmedHandoff();

    await recordCopySucceeded._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      answerRef: "application-answer:screening-question-1",
      answerDigest: "a".repeat(64),
      now: NOW + 2,
      env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
    });
    await recordFileDownloadRequested._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      artifactRef: RESUME_ARTIFACT_ID,
      artifactDigest: "b".repeat(64),
      now: NOW + 3,
      env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
    });
    const openResult = await recordDestinationOpenRequested._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      now: NOW + 4,
      env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
    });
    const outcome = await reportOutcome._handler(ctx as any, {
      handoffId: prepared.handoffId,
      manifestDigest: prepared.manifestDigest,
      outcome: "user_reported_submitted",
      now: NOW + 5,
      env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
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
      "manual_handoff.copy_succeeded",
      "manual_handoff.file_download_requested",
      "manual_handoff.destination_open_requested",
      "manual_handoff.user_reported_submitted",
    ]);
    expect(
      tables.manualApplicationHandoffEvents.map((event) => event.evidence),
    ).toEqual([
      "twoweeks_prepared",
      "user_interaction_observed",
      "user_interaction_observed",
      "user_interaction_observed",
      "user_interaction_observed",
      "user_reported",
    ]);
    const persisted = JSON.stringify(tables.manualApplicationHandoffEvents);
    expect(persisted).not.toContain("application-answer text");
    expect(persisted).not.toContain(APPLICATION_URL);
    expect(persisted).not.toMatch(/provider|receipt|verified/i);
  });

  it("allows only the approved persisted states and evidence values", () => {
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
  });

  it("validates destination URL from job.applicationUrl only and stores only origin host and hash", async () => {
    await expect(validateManualApplicationDestination("http://example.com")).rejects.toThrow(
      /https/i,
    );
    await expect(
      validateManualApplicationDestination("https://localhost/apply"),
    ).rejects.toThrow(/destination/i);
    await expect(
      validateManualApplicationDestination("javascript:alert(1)"),
    ).rejects.toThrow(/https/i);

    const { ctx } = makeCtx({ applicationUrl: "", sourceUrl: APPLICATION_URL });
    await expect(
      prepare._handler(ctx as any, {
        jobId: JOB_ID,
        applicationPackageId: APPLICATION_PACKAGE_ID,
        now: NOW,
        env: { TWOWEEKS_MANUAL_APPLICATION_HANDOFF_ENABLED: "true" },
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
