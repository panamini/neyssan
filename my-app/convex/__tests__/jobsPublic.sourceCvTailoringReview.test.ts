import { describe, expect, it } from "vitest";

import {
  prepareCvTailoringReview,
  submitCvTailoringReview,
} from "../jobsPublic";

const T = Date.UTC(2026, 6, 30);
const CLERK_ID = "clerk-owner";
const PROFILE_ID = "profile-owner";
const SIBLING_PROFILE_ID = "profile-sibling";
const JOB_ID = "job-owner";

type StoredRow = Record<string, unknown> & {
  _id: string;
  _creationTime: number;
};

function sourceCv(
  id = PROFILE_ID,
  options: Readonly<{ legacyIds?: boolean }> = {},
) {
  return {
    id,
    title: "Canonical source CV",
    metadata: {
      createdAt: "2026-07-30T00:00:00.000Z",
      updatedAt: "2026-07-30T00:00:00.000Z",
      version: 1,
    },
    sections: [
      {
        ...(options.legacyIds ? {} : { id: "section-experience" }),
        title: "Experience",
        type: "experience",
        blocks: [],
        structuredContent: [
          {
            ...(options.legacyIds
              ? {}
              : { id: "experience-customer-service" }),
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

function readPath(row: StoredRow, path: string): unknown {
  return path.split(".").reduce<unknown>((value, key) => {
    if (!value || typeof value !== "object") {
      return undefined;
    }
    return (value as Record<string, unknown>)[key];
  }, row);
}

function makeContext(overrides: {
  authenticated?: boolean;
  jobOwnerId?: string;
  archivedAt?: number | null;
  parseStatus?: string;
  reviewState?: string;
  lastResumeId?: string | null;
  cvId?: string;
  legacyCvIds?: boolean;
  siblingAttachedCv?: boolean;
  mustHaves?: readonly string[];
} = {}) {
  const attachedProfileId = overrides.siblingAttachedCv
    ? SIBLING_PROFILE_ID
    : PROFILE_ID;
  const canonicalCvId = overrides.cvId ?? attachedProfileId;
  const attachedProfile: StoredRow = {
    _id: attachedProfileId,
    _creationTime: T,
    clerkId: CLERK_ID,
    profileId: attachedProfileId,
    email: "owner@example.test",
    name: "Owner",
    cvDocument: sourceCv(canonicalCvId, {
      legacyIds: overrides.legacyCvIds,
    }),
    createdAt: T,
    updatedAt: T,
    version: 1,
  };
  const profile: StoredRow = {
    _id: PROFILE_ID,
    _creationTime: T,
    clerkId: CLERK_ID,
    profileId: PROFILE_ID,
    email: "owner@example.test",
    name: "Owner",
    ...(overrides.siblingAttachedCv
      ? {}
      : { cvDocument: attachedProfile.cvDocument }),
    createdAt: T,
    updatedAt: T,
    version: 1,
  };
  const job: StoredRow = {
    _id: JOB_ID,
    _creationTime: T,
    userId: overrides.jobOwnerId ?? PROFILE_ID,
    lastResumeId:
      overrides.lastResumeId === undefined
        ? attachedProfileId
        : overrides.lastResumeId,
    lastResumeName: "Canonical source CV",
    archivedAt:
      overrides.archivedAt === undefined ? null : overrides.archivedAt,
    parseStatus: overrides.parseStatus ?? "parsed",
    reviewState: overrides.reviewState ?? "ready",
    title: "Bakery sales associate",
    company: "Bakery One",
    sourceUrl: "https://example.test/jobs/bakery",
    rawDescription: "Customer service in a bakery.",
    mustHaves: [...(overrides.mustHaves ?? ["Customer service"])],
    responsibilities: ["Customer service"],
    keywords: [],
    createdAt: T,
    updatedAt: T,
  };
  const tables: Record<string, StoredRow[]> = {
    userProfiles: overrides.siblingAttachedCv
      ? [profile, attachedProfile]
      : [profile],
    jobs: [job],
    applicationContexts: [],
    applicationArtifacts: [],
  };
  const writes: string[] = [];
  let readCount = 0;

  const db = {
    normalizeId(table: string, id: string) {
      const rows = tables[table] ?? [];
      return rows.some((row) => row._id === id) ? id : null;
    },
    async get(id: string) {
      readCount += 1;
      return (
        Object.values(tables)
          .flat()
          .find((row) => row._id === id) ?? null
      );
    },
    query(table: string) {
      if (
        table === "candidateSourceDocuments" ||
        table === "candidateFacts"
      ) {
        throw new Error("CandidateEvidence must not be read");
      }
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
          const rows = (tables[table] ?? []).filter((row) =>
            Object.entries(scope).every(
              ([field, value]) => readPath(row, field) === value,
            ),
          );
          return {
            collect: async () => {
              readCount += 1;
              return rows;
            },
            unique: async () => {
              readCount += 1;
              if (rows.length > 1) {
                throw new Error(`Expected unique ${table} row`);
              }
              return rows[0] ?? null;
            },
          };
        },
      };
    },
    async insert(table: string, value: Record<string, unknown>) {
      const rows = tables[table] ?? (tables[table] = []);
      const id = `${table}-storage-${rows.length + 1}`;
      rows.push({ ...value, _id: id, _creationTime: T });
      writes.push(`insert:${table}`);
      return id;
    },
    async patch(id: string, value: Record<string, unknown>) {
      for (const [table, rows] of Object.entries(tables)) {
        const index = rows.findIndex((row) => row._id === id);
        if (index >= 0) {
          rows[index] = { ...rows[index], ...value };
          writes.push(`patch:${table}`);
          return;
        }
      }
      throw new Error(`Missing row to patch: ${id}`);
    },
  };

  return {
    ctx: {
      auth: {
        getUserIdentity: async () =>
          overrides.authenticated === false
            ? null
            : { subject: CLERK_ID },
      },
      db,
    } as any,
    job,
    profile,
    attachedProfile,
    tables,
    writes,
    getReadCount: () => readCount,
  };
}

describe("authenticated source CV tailoring review boundary", () => {
  it("derives the current owned Job/CV/context server-side and returns a narrow pending review DTO", async () => {
    const fixture = makeContext();
    const sourceCvBefore = structuredClone(fixture.profile.cvDocument);

    const result = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });

    expect(result).toEqual({
      mode: "auto_recommended",
      sourceCv: {
        id: PROFILE_ID,
        contextHash: expect.any(String),
      },
      plan: {
        id: expect.stringMatching(/^resume-variant-plan:/),
        blocked: false,
        items: [
          expect.objectContaining({
            id: expect.any(String),
            action: "include",
            reviewState: "pending",
            sourceCvItemReferenceIds: [
              expect.stringMatching(/^candidate-cv-item:v1:/),
            ],
          }),
        ],
        warnings: [],
      },
    });
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("applicationContextId");
    expect(JSON.stringify(result)).not.toContain("_creationTime");
    expect(JSON.stringify(result)).not.toContain("candidateFacts");
    expect(JSON.stringify(result)).not.toContain("evidenceGraph");
    expect(fixture.profile.cvDocument).toEqual(sourceCvBefore);
    expect(fixture.writes).toEqual(["insert:applicationContexts"]);
  });

  it("returns full_source_cv with plan null and no review artifact or CandidateEvidence mutation", async () => {
    const fixture = makeContext();
    const sourceCvBefore = structuredClone(fixture.profile.cvDocument);

    const result = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      mode: "full_source_cv",
    });

    expect(result).toEqual({
      mode: "full_source_cv",
      sourceCv: {
        id: PROFILE_ID,
        contextHash: expect.any(String),
      },
      plan: null,
    });
    expect(fixture.tables.applicationArtifacts).toEqual([]);
    expect(fixture.profile.cvDocument).toEqual(sourceCvBefore);
  });

  it("prepares a stable review for a legacy attached CV without section or item ids", async () => {
    const fixture = makeContext({ legacyCvIds: true });
    const sourceCvBefore = structuredClone(fixture.attachedProfile.cvDocument);

    const first = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });
    const second = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });

    expect(first).toEqual(second);
    expect(first.plan?.items[0]?.sourceCvItemReferenceIds[0]).toMatch(
      /^candidate-cv-item:v1:.*:legacy-section-.*:legacy-item-/,
    );
    expect(fixture.attachedProfile.cvDocument).toEqual(sourceCvBefore);
  });

  it("resolves an attached sibling CV when the owning profile has no CV document", async () => {
    const fixture = makeContext({ siblingAttachedCv: true });
    const sourceCvBefore = structuredClone(
      fixture.attachedProfile.cvDocument,
    );

    const result = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });

    expect(result.sourceCv.id).toBe(SIBLING_PROFILE_ID);
    expect(result.plan?.items).toHaveLength(1);
    expect(fixture.profile).not.toHaveProperty("cvDocument");
    expect(fixture.attachedProfile.cvDocument).toEqual(sourceCvBefore);
  });

  it("keeps a fully reviewed plan blocked when a required Job Brief demand is unmatched", async () => {
    const fixture = makeContext({
      mustHaves: ["Customer service", "Forklift certification"],
    });
    const prepared = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });
    if (!prepared.plan) {
      throw new Error("Expected automatic plan");
    }

    expect(prepared.plan.blocked).toBe(true);
    expect(prepared.plan.warnings).toEqual([
      expect.objectContaining({
        category: "missing_evidence",
        severity: "blocker",
        reason: expect.stringContaining("Forklift certification"),
      }),
    ]);

    await submitCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      expectedPlanId: prepared.plan.id,
      decisions: prepared.plan.items.map((item) => ({
        planItemId: item.id,
        reviewState: "accepted" as const,
      })),
    });

    expect(fixture.tables.applicationArtifacts).toHaveLength(1);
    expect(fixture.tables.applicationArtifacts[0]?.status).toBe("blocked");
  });

  it("rejects unauthenticated, foreign, archived, unready, detached, and mismatched CV requests before persistence", async () => {
    for (const fixture of [
      makeContext({ authenticated: false }),
      makeContext({ jobOwnerId: "profile-foreign" }),
      makeContext({ archivedAt: T + 1 }),
      makeContext({ parseStatus: "parsing" }),
      makeContext({ reviewState: "needs_review" }),
      makeContext({ lastResumeId: null }),
      makeContext({ cvId: "cv-other" }),
    ]) {
      await expect(
        prepareCvTailoringReview._handler(fixture.ctx, { jobId: JOB_ID }),
      ).rejects.toThrow();
      expect(fixture.tables.applicationContexts).toEqual([]);
      expect(fixture.tables.applicationArtifacts).toEqual([]);
      expect(fixture.writes).toEqual([]);
    }
  });

  it("persists only review state and keeps an equivalent public retry write-free", async () => {
    const fixture = makeContext();
    const prepared = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });
    if (!prepared.plan) {
      throw new Error("Expected automatic plan");
    }
    const decision = {
      planItemId: prepared.plan.items[0].id,
      reviewState: "accepted" as const,
    };

    const reviewed = await submitCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      expectedPlanId: prepared.plan.id,
      decisions: [decision],
    });
    const writesAfterFirstReview = [...fixture.writes];
    const replayed = await submitCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      expectedPlanId: prepared.plan.id,
      decisions: [decision],
    });

    expect(reviewed.plan?.items[0]?.reviewState).toBe("accepted");
    expect(replayed).toEqual(reviewed);
    expect(fixture.writes).toEqual(writesAfterFirstReview);
    expect(
      fixture.writes.filter(
        (write) => write === "insert:applicationArtifacts",
      ),
    ).toHaveLength(1);
    expect(
      fixture.writes.some((write) =>
        /candidateFacts|candidateSourceDocuments/.test(write),
      ),
    ).toBe(false);
  });
});
