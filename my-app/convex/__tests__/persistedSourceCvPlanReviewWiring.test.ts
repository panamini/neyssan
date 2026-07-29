import { describe, expect, expectTypeOf, it, vi } from "vitest";

import type { CvDocument } from "../../src/types/cvDocument";
import { buildCandidateCvFacts } from "../../src/modules/candidate-evidence/candidateCvFacts";
import { buildCandidateCvItemReferences } from "../../src/modules/candidate-evidence/cvItemReferences";
import { buildCandidateFactHash } from "../../src/modules/candidate-evidence/fingerprints";
import type { CandidateFactV1 } from "../../src/modules/candidate-evidence/schema";
import { api } from "../_generated/api";
import {
  prepareAttachedSourceCvVariantPlanReview,
  prepareSourceCvVariantPlanForReview,
  reviewSourceCvVariantPlan,
} from "../jobsPublic";
import { buildApplicationContextV1FromExistingData } from "../lib/applicationContextBuilder";

const T = Date.UTC(2026, 6, 29);
const USER_ID = "profile-owner";
const CLERK_ID = "clerk-owner";
const JOB_ID = "job-bakery";
const OTHER_JOB_ID = "job-other";
const SOURCE_DOCUMENT_ID = "candidate-source-document:linked";

type StoredRow = Record<string, any> & { _id: string };
type Tables = Record<string, StoredRow[]>;

function sourceCv(id = "cv-source-1"): CvDocument {
  return {
    id,
    title: "Source CV",
    metadata: {
      createdAt: "2026-07-29T00:00:00.000Z",
      updatedAt: "2026-07-29T00:00:00.000Z",
      version: 1,
    },
    sections: [
      {
        id: "section-experience",
        title: "Experience",
        type: "experience",
        blocks: [],
        structuredContent: [
          {
            id: "exp-bakery",
            company: "Bakery One",
            position: "Sales associate",
            startDate: "2024-01-01",
            responsibilityBullets: ["Customer service"],
          },
        ],
      },
    ],
  };
}

function profile(document: CvDocument) {
  return {
    _id: USER_ID,
    _creationTime: T,
    clerkId: CLERK_ID,
    email: "owner@example.test",
    name: "Owner",
    version: 1,
    createdAt: T,
    updatedAt: T,
    preferences: {
      writingStyle: "natural",
      tonePreference: "auto",
      autoSend: false,
    },
    skills: [],
    keywords: [],
    experience: [],
    cvDocument: document,
  };
}

function job(id = JOB_ID) {
  return {
    _id: id,
    _creationTime: T,
    userId: USER_ID,
    title: "Bakery sales associate",
    company: "Bakery One",
    sourceUrl: "https://example.test/jobs/bakery",
    rawDescription: "Customer service in a bakery.",
    responsibilities: ["Customer service"],
    keywords: [],
    mustHaves: ["Customer service"],
    archivedAt: null,
  };
}

async function withPersistedProvenance(
  fact: CandidateFactV1,
): Promise<CandidateFactV1> {
  const sourceQuote = `persisted:${fact.sourcePath}`;
  const hash = await buildCandidateFactHash({
    userId: fact.userId,
    sourceDocumentId: fact.sourceDocumentId,
    sourcePath: fact.sourcePath,
    sourceQuote,
    factType: fact.factType,
    value: fact.value,
    ...(fact.normalizedText ? { normalizedText: fact.normalizedText } : {}),
  });

  return {
    ...fact,
    id: `candidate-fact:${hash}`,
    sourceQuote,
    confidence: 0.91,
    createdAt: T - 100,
    updatedAt: T - 50,
  };
}

async function fixture() {
  const document = sourceCv();
  const ownerProfile = profile(document);
  const ownerJob = job();
  const built = await buildApplicationContextV1FromExistingData({
    userId: USER_ID,
    job: ownerJob,
    candidateProfile: ownerProfile,
    now: T,
  });
  const currentFacts = await buildCandidateCvFacts({
    userId: USER_ID,
    sourceDocumentId: SOURCE_DOCUMENT_ID,
    document,
    references: buildCandidateCvItemReferences(document),
    reviewState: "approved",
    visibility: "use_in_applications",
    createdAt: T,
    updatedAt: T,
  });
  const eligibleFacts = await Promise.all(
    currentFacts.map(withPersistedProvenance),
  );
  const firstFact = eligibleFacts[0];
  if (!firstFact) {
    throw new Error("fixture requires at least one candidate fact");
  }

  const tables: Tables = {
    userProfiles: [ownerProfile],
    jobs: [ownerJob, job(OTHER_JOB_ID)],
    applicationContexts: [
      {
        ...built.context,
        _id: "application-context-storage",
        _creationTime: T,
      },
    ],
    candidateSourceDocuments: [
      {
        _id: "source-storage-linked",
        _creationTime: T,
        id: SOURCE_DOCUMENT_ID,
        userId: USER_ID,
        canonicalCvId: document.id,
        sourceType: "uploaded_cv",
        textHash: "text:linked",
        sourceHash: "source:linked",
        reviewState: "approved",
        visibility: "use_in_applications",
        createdAt: T,
        updatedAt: T,
        version: 1,
      },
      {
        _id: "source-storage-unlinked",
        _creationTime: T,
        id: "candidate-source-document:unlinked",
        userId: USER_ID,
        sourceType: "uploaded_cv",
        textHash: "text:unlinked",
        sourceHash: "source:unlinked",
        reviewState: "approved",
        visibility: "use_in_applications",
        createdAt: T,
        updatedAt: T,
        version: 1,
      },
      {
        _id: "source-storage-other-cv",
        _creationTime: T,
        id: "candidate-source-document:other-cv",
        userId: USER_ID,
        canonicalCvId: "cv-other",
        sourceType: "uploaded_cv",
        textHash: "text:other-cv",
        sourceHash: "source:other-cv",
        reviewState: "approved",
        visibility: "use_in_applications",
        createdAt: T,
        updatedAt: T,
        version: 1,
      },
      {
        _id: "source-storage-cross-user",
        _creationTime: T,
        id: "candidate-source-document:cross-user",
        userId: "profile-attacker",
        canonicalCvId: document.id,
        sourceType: "uploaded_cv",
        textHash: "text:cross-user",
        sourceHash: "source:cross-user",
        reviewState: "approved",
        visibility: "use_in_applications",
        createdAt: T,
        updatedAt: T,
        version: 1,
      },
    ],
    candidateFacts: [
      ...eligibleFacts.map((fact, index) => ({
        ...fact,
        _id: `fact-storage-${index}`,
        _creationTime: T,
      })),
      {
        ...firstFact,
        _id: "fact-storage-pending",
        _creationTime: T,
        id: "candidate-fact:pending",
        reviewState: "pending",
      },
      {
        ...firstFact,
        _id: "fact-storage-private",
        _creationTime: T,
        id: "candidate-fact:private",
        visibility: "private",
      },
      {
        ...firstFact,
        _id: "fact-storage-never-use",
        _creationTime: T,
        id: "candidate-fact:never-use",
        visibility: "never_use",
      },
      {
        ...firstFact,
        _id: "fact-storage-stale",
        _creationTime: T,
        id: "candidate-fact:stale",
        value: { stale: true },
      },
      {
        ...firstFact,
        _id: "fact-storage-unlinked",
        _creationTime: T,
        id: "candidate-fact:unlinked",
        sourceDocumentId: "candidate-source-document:unlinked",
      },
      {
        ...firstFact,
        _id: "fact-storage-other-cv",
        _creationTime: T,
        id: "candidate-fact:other-cv",
        sourceDocumentId: "candidate-source-document:other-cv",
      },
      {
        ...firstFact,
        _id: "fact-storage-cross-user",
        _creationTime: T,
        id: "candidate-fact:cross-user",
        userId: "profile-attacker",
        sourceDocumentId: "candidate-source-document:cross-user",
      },
    ],
    applicationArtifacts: [],
  };

  return {
    context: built.context,
    document,
    eligibleFacts,
    tables,
  };
}

function readPath(row: StoredRow, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    return (value as Record<string, unknown>)[key];
  }, row);
}

function makeCtx(
  tables: Tables,
  clerkId: string | null = CLERK_ID,
): {
  ctx: any;
  reads: Array<{ table: string; scope: Record<string, unknown> }>;
} {
  const reads: Array<{ table: string; scope: Record<string, unknown> }> = [];
  const db = {
    normalizeId(table: string, id: string) {
      return (tables[table] ?? []).some((row) => row._id === id) ? id : null;
    },
    async get(id: string) {
      for (const rows of Object.values(tables)) {
        const row = rows.find((candidate) => candidate._id === id);
        if (row) {
          return row;
        }
      }
      return null;
    },
    async insert(table: string, value: Record<string, unknown>) {
      const rows = tables[table] ?? (tables[table] = []);
      const id = `${table}-storage-${rows.length + 1}`;
      rows.push({ ...value, _id: id, _creationTime: T });
      return id;
    },
    async patch(id: string, value: Record<string, unknown>) {
      for (const rows of Object.values(tables)) {
        const index = rows.findIndex((candidate) => candidate._id === id);
        if (index >= 0) {
          rows[index] = { ...rows[index], ...value };
          return;
        }
      }
      throw new Error(`Missing row to patch: ${id}`);
    },
    query(table: string) {
      return {
        withIndex(
          _indexName: string,
          buildIndex: (q: {
            eq(field: string, value: unknown): unknown;
          }) => unknown,
        ) {
          const scope: Record<string, unknown> = {};
          const q = {
            eq(field: string, value: unknown) {
              scope[field] = value;
              return q;
            },
          };
          buildIndex(q);
          reads.push({ table, scope: { ...scope } });
          const rows = (tables[table] ?? []).filter((row) =>
            Object.entries(scope).every(
              ([field, value]) => readPath(row, field) === value,
            ),
          );
          return {
            unique: async () => {
              if (rows.length > 1) {
                throw new Error(`Expected unique ${table} row`);
              }
              return rows[0] ?? null;
            },
            collect: async () => rows,
          };
        },
      };
    },
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: async () =>
          clerkId ? { subject: clerkId, email: `${clerkId}@example.test` } : null,
      },
      db,
    },
    reads,
  };
}

describe("persisted source CV plan review wiring", () => {
  it("exposes a job-only attached-CV bootstrap mutation", () => {
    type MutationArgs = Parameters<
      typeof prepareAttachedSourceCvVariantPlanReview._handler
    >[1];

    expectTypeOf<MutationArgs>().toEqualTypeOf<{ jobId: string }>();
    expectTypeOf(
      api.jobsPublic.prepareAttachedSourceCvVariantPlanReview,
    ).not.toBeAny();
    expect(typeof prepareAttachedSourceCvVariantPlanReview._handler).toBe(
      "function",
    );
  });

  it("exposes an owner-scoped decision-only review mutation", () => {
    type MutationArgs = Parameters<typeof reviewSourceCvVariantPlan._handler>[1];

    expectTypeOf<MutationArgs>().toEqualTypeOf<{
      jobId: string;
      contextId: string;
      expectedPlanId: string;
      decisions: Array<{
        planItemId: string;
        reviewState: "accepted" | "rejected";
      }>;
    }>();
    expectTypeOf(api.jobsPublic.reviewSourceCvVariantPlan).not.toBeAny();
    expect(typeof reviewSourceCvVariantPlan._handler).toBe("function");
  });

  it("accepts only product identifiers and derives every authority server-side", () => {
    type QueryArgs = Parameters<
      typeof prepareSourceCvVariantPlanForReview._handler
    >[1];

    expectTypeOf<QueryArgs>().toEqualTypeOf<{
      jobId: string;
      contextId: string;
    }>();
    expectTypeOf(
      api.jobsPublic.prepareSourceCvVariantPlanForReview,
    ).not.toBeAny();
  });

  it("returns the authenticated owner's current eligible facts as a pending plan without mutation or Convex metadata", async () => {
    const value = await fixture();
    const beforeCv = JSON.stringify(value.document);
    const beforeTables = JSON.stringify(value.tables);
    const { ctx, reads } = makeCtx(value.tables);

    const result = await prepareSourceCvVariantPlanForReview._handler(ctx, {
      jobId: JOB_ID,
      contextId: value.context.id,
    });

    expect(result.mode).toBe("auto_recommended");
    expect(result.plan.items.length).toBeGreaterThan(0);
    expect(
      result.plan.items.every(
        (item: { reviewState: string }) => item.reviewState === "pending",
      ),
    ).toBe(true);
    expect(result.candidateFacts).toHaveLength(value.eligibleFacts.length);
    expect(
      result.candidateFacts
        .map((fact: CandidateFactV1) => fact.id)
        .sort(),
    ).toEqual(value.eligibleFacts.map((fact) => fact.id).sort());
    expect(
      result.candidateFacts.every(
        (fact: CandidateFactV1) =>
          fact.sourceQuote?.startsWith("persisted:") &&
          fact.confidence === 0.91 &&
          fact.createdAt === T - 100 &&
          fact.updatedAt === T - 50,
      ),
    ).toBe(true);
    expect(JSON.stringify(result)).not.toContain('"_id"');
    expect(JSON.stringify(result)).not.toContain('"_creationTime"');
    expect(reads).toContainEqual({
      table: "applicationContexts",
      scope: { userId: USER_ID, id: value.context.id },
    });
    expect(reads).toContainEqual({
      table: "candidateSourceDocuments",
      scope: { userId: USER_ID, canonicalCvId: value.document.id },
    });
    expect(JSON.stringify(value.document)).toBe(beforeCv);
    expect(JSON.stringify(value.tables)).toBe(beforeTables);
  });

  it("bootstraps and reuses a context from the same-account CV attached to the job", async () => {
    const value = await fixture();
    const attachedCv = sourceCv("cv-attached");
    value.tables.userProfiles.push({
      ...profile(attachedCv),
      _id: "profile-storage-attached",
      profileId: attachedCv.id,
      clerkId: CLERK_ID,
    });
    value.tables.jobs[0] = {
      ...value.tables.jobs[0],
      lastResumeId: attachedCv.id,
      lastResumeName: "Attached source CV",
    };
    value.tables.candidateSourceDocuments[0] = {
      ...value.tables.candidateSourceDocuments[0],
      canonicalCvId: attachedCv.id,
    };
    value.tables.applicationContexts = [];
    const protectedBefore = JSON.stringify({
      ...value.tables,
      applicationContexts: undefined,
    });
    const cvBefore = JSON.stringify(attachedCv);
    const { ctx } = makeCtx(value.tables);
    const now = vi.spyOn(Date, "now").mockReturnValue(T + 50);

    const first =
      await prepareAttachedSourceCvVariantPlanReview._handler(ctx, {
        jobId: JOB_ID,
      });

    expect(first.applicationContextId).toMatch(/^application-context:/);
    expect(first.sourceCvId).toBe(attachedCv.id);
    expect(
      first.plan.items.every(
        (item: { reviewState: string }) => item.reviewState === "pending",
      ),
    ).toBe(true);
    expect(value.tables.applicationContexts).toHaveLength(1);

    now.mockReturnValue(T + 60);
    const second =
      await prepareAttachedSourceCvVariantPlanReview._handler(ctx, {
        jobId: JOB_ID,
      });
    expect(second.applicationContextId).toBe(first.applicationContextId);
    expect(second.plan.id).toBe(first.plan.id);
    expect(value.tables.applicationContexts).toHaveLength(1);
    expect(JSON.stringify(attachedCv)).toBe(cvBefore);
    expect(
      JSON.stringify({
        ...value.tables,
        applicationContexts: undefined,
      }),
    ).toBe(protectedBefore);

    now.mockReturnValue(T + 70);
    const reviewed = await reviewSourceCvVariantPlan._handler(ctx, {
      jobId: JOB_ID,
      contextId: first.applicationContextId,
      expectedPlanId: first.plan.id,
      decisions: [
        {
          planItemId: first.plan.items[0].id,
          reviewState: "accepted",
        },
      ],
    });
    now.mockReturnValue(T + 80);
    const resumed =
      await prepareAttachedSourceCvVariantPlanReview._handler(ctx, {
        jobId: JOB_ID,
      });
    expect(resumed.plan.id).toBe(reviewed.plan.id);
    expect(resumed.plan.items[0].reviewState).toBe("accepted");
    expect(JSON.stringify(attachedCv)).toBe(cvBefore);
    now.mockRestore();
  });

  it("rejects missing and cross-account attached CVs before context persistence", async () => {
    const missing = await fixture();
    missing.tables.applicationContexts = [];
    const missingCtx = makeCtx(missing.tables);
    await expect(
      prepareAttachedSourceCvVariantPlanReview._handler(missingCtx.ctx, {
        jobId: JOB_ID,
      }),
    ).rejects.toThrow(/no attached source CV/);
    expect(missing.tables.applicationContexts).toHaveLength(0);

    const crossAccount = await fixture();
    const foreignCv = sourceCv("cv-foreign");
    crossAccount.tables.userProfiles.push({
      ...profile(foreignCv),
      _id: "profile-storage-foreign",
      profileId: foreignCv.id,
      clerkId: "clerk-attacker",
    });
    crossAccount.tables.jobs[0] = {
      ...crossAccount.tables.jobs[0],
      lastResumeId: foreignCv.id,
    };
    crossAccount.tables.applicationContexts = [];
    const foreignCtx = makeCtx(crossAccount.tables);
    await expect(
      prepareAttachedSourceCvVariantPlanReview._handler(foreignCtx.ctx, {
        jobId: JOB_ID,
      }),
    ).rejects.toThrow(/not found for authenticated owner/);
    expect(crossAccount.tables.applicationContexts).toHaveLength(0);
  });

  it("persists only immutable pending decisions and resumes the reviewed plan across calls", async () => {
    const value = await fixture();
    const { ctx } = makeCtx(value.tables);
    const protectedBefore = JSON.stringify({
      ...value.tables,
      applicationArtifacts: undefined,
    });
    const sourceCvBefore = JSON.stringify(value.document);
    const now = vi.spyOn(Date, "now").mockReturnValue(T + 100);

    const pending = await prepareSourceCvVariantPlanForReview._handler(ctx, {
      jobId: JOB_ID,
      contextId: value.context.id,
    });
    const selectedItem = pending.plan.items[0];
    expect(selectedItem?.reviewState).toBe("pending");

    now.mockReturnValue(T + 200);
    const reviewed = await reviewSourceCvVariantPlan._handler(ctx, {
      jobId: JOB_ID,
      contextId: value.context.id,
      expectedPlanId: pending.plan.id,
      decisions: [
        {
          planItemId: selectedItem.id,
          reviewState: "accepted",
        },
      ],
    });

    expect(reviewed.plan.id).not.toBe(pending.plan.id);
    expect(reviewed.plan.items[0].reviewState).toBe("accepted");
    expect(value.tables.applicationArtifacts).toHaveLength(1);
    expect(
      value.tables.applicationArtifacts[0]?.content.plan.items[0].reviewState,
    ).toBe("accepted");
    expect(JSON.stringify(value.document)).toBe(sourceCvBefore);
    expect(
      JSON.stringify({
        ...value.tables,
        applicationArtifacts: undefined,
      }),
    ).toBe(protectedBefore);

    now.mockReturnValue(T + 300);
    const resumed = await prepareSourceCvVariantPlanForReview._handler(ctx, {
      jobId: JOB_ID,
      contextId: value.context.id,
    });
    expect(resumed.plan.id).toBe(reviewed.plan.id);
    expect(resumed.plan.items[0].reviewState).toBe("accepted");

    await expect(
      reviewSourceCvVariantPlan._handler(ctx, {
        jobId: JOB_ID,
        contextId: value.context.id,
        expectedPlanId: reviewed.plan.id,
        decisions: [
          {
            planItemId: selectedItem.id,
            reviewState: "rejected",
          },
        ],
      }),
    ).rejects.toThrow(/not selectable/);
    await expect(
      reviewSourceCvVariantPlan._handler(ctx, {
        jobId: JOB_ID,
        contextId: value.context.id,
        expectedPlanId: pending.plan.id,
        decisions: [
          {
            planItemId: selectedItem.id,
            reviewState: "rejected",
          },
        ],
      }),
    ).rejects.toThrow(/stale ResumeVariantPlan review/);

    now.mockRestore();
  });

  it("rejects missing auth and cross-user access before loading application evidence", async () => {
    const value = await fixture();

    for (const clerkId of [null, "clerk-attacker"]) {
      const { ctx, reads } = makeCtx(value.tables, clerkId);
      await expect(
        prepareSourceCvVariantPlanForReview._handler(ctx, {
          jobId: JOB_ID,
          contextId: value.context.id,
        }),
      ).rejects.toThrow(
        clerkId === null ? /Not authenticated/ : /authenticated owner/,
      );
      await expect(
        reviewSourceCvVariantPlan._handler(ctx, {
          jobId: JOB_ID,
          contextId: value.context.id,
          expectedPlanId: "resume-variant-plan:untrusted",
          decisions: [
            {
              planItemId: "resume-variant-plan-item:untrusted",
              reviewState: "accepted",
            },
          ],
        }),
      ).rejects.toThrow(
        clerkId === null ? /Not authenticated/ : /authenticated owner/,
      );
      expect(
        reads.some(({ table }) => table === "candidateSourceDocuments"),
      ).toBe(false);
    }
  });

  it("persists rejected decisions without mutating source evidence", async () => {
    const value = await fixture();
    const { ctx } = makeCtx(value.tables);
    const sourceFactsBefore = JSON.stringify(value.tables.candidateFacts);
    const sourcesBefore = JSON.stringify(value.tables.candidateSourceDocuments);
    const now = vi.spyOn(Date, "now").mockReturnValue(T + 400);
    const pending = await prepareSourceCvVariantPlanForReview._handler(ctx, {
      jobId: JOB_ID,
      contextId: value.context.id,
    });

    now.mockReturnValue(T + 500);
    const rejected = await reviewSourceCvVariantPlan._handler(ctx, {
      jobId: JOB_ID,
      contextId: value.context.id,
      expectedPlanId: pending.plan.id,
      decisions: [
        {
          planItemId: pending.plan.items[0].id,
          reviewState: "rejected",
        },
      ],
    });

    expect(rejected.plan.items[0].reviewState).toBe("rejected");
    expect(JSON.stringify(value.tables.candidateFacts)).toBe(sourceFactsBefore);
    expect(JSON.stringify(value.tables.candidateSourceDocuments)).toBe(
      sourcesBefore,
    );
    now.mockRestore();
  });

  it("rejects wrong job, context, and current CV bindings before selecting facts", async () => {
    const value = await fixture();

    const wrongJob = makeCtx(value.tables);
    await expect(
      prepareSourceCvVariantPlanForReview._handler(wrongJob.ctx, {
        jobId: OTHER_JOB_ID,
        contextId: value.context.id,
      }),
    ).rejects.toThrow(/does not match requested job/);

    const missingContext = makeCtx(value.tables);
    await expect(
      prepareSourceCvVariantPlanForReview._handler(missingContext.ctx, {
        jobId: JOB_ID,
        contextId: "application-context:missing",
      }),
    ).rejects.toThrow(/ApplicationContext not found for caller/);

    const wrongCvTables = structuredClone(value.tables);
    wrongCvTables.userProfiles[0] = {
      ...wrongCvTables.userProfiles[0],
      cvDocument: sourceCv("cv-other"),
    };
    const wrongCv = makeCtx(wrongCvTables);
    await expect(
      prepareSourceCvVariantPlanForReview._handler(wrongCv.ctx, {
        jobId: JOB_ID,
        contextId: value.context.id,
      }),
    ).rejects.toThrow(
      /current source CV does not match ApplicationContext|source CV profile not found/,
    );

    for (const reads of [wrongJob.reads, missingContext.reads, wrongCv.reads]) {
      expect(
        reads.some(({ table }) => table === "candidateSourceDocuments"),
      ).toBe(false);
    }
  });
});
