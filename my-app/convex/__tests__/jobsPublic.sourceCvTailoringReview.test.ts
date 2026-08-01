import { describe, expect, it } from "vitest";

import {
  materializeCvTailoringReview,
  prepareCvTailoringReview,
  submitCvTailoringReview,
} from "../jobsPublic";
import { listProfilesForClerk } from "../lib/userProfiles";

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
  options: Readonly<{
    educationFieldOfStudy?: string;
    legacyIds?: boolean;
    skillNames?: readonly string[];
    summary?: string;
  }> = {},
) {
  return {
    id,
    title: "Canonical source CV",
    ...(options.summary ? { summary: options.summary } : {}),
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
      ...(options.skillNames?.length
        ? [
            {
              id: "section-skills",
              title: "Skills",
              type: "skills",
              blocks: [],
              structuredContent: options.skillNames.map((name, index) => ({
                id: `skill-${index + 1}`,
                name,
                level: "Advanced",
              })),
            },
          ]
        : []),
      ...(options.educationFieldOfStudy
        ? [
            {
              id: "section-education",
              title: "Education",
              type: "education",
              blocks: [],
              structuredContent: [
                {
                  id: "education-field-only",
                  institution: "",
                  degree: "   ",
                  fieldOfStudy: options.educationFieldOfStudy,
                },
              ],
            },
          ]
        : []),
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
  skillNames?: readonly string[];
  keywords?: readonly string[];
  cvSummary?: string;
  educationFieldOfStudy?: string;
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
      skillNames: overrides.skillNames,
      summary: overrides.cvSummary,
      educationFieldOfStudy: overrides.educationFieldOfStudy,
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
    keywords: [...(overrides.keywords ?? [])],
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
        requiredDemandIds: [expect.stringMatching(/^job-demand:/)],
        items: [
          expect.objectContaining({
            id: expect.any(String),
            action: "include",
            reviewState: "pending",
            displayLabel: "Sales associate · Bakery One",
            demandIds: [expect.stringMatching(/^job-demand:/)],
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
    expect(Object.keys(result.plan?.items[0] ?? {}).sort()).toEqual([
      "action",
      "demandIds",
      "displayLabel",
      "id",
      "priority",
      "reason",
      "reviewState",
      "section",
      "sourceCvItemReferenceIds",
    ]);
    const projectedReview = JSON.stringify(result);
    expect(projectedReview).not.toContain("_creationTime");
    expect(projectedReview).not.toContain("candidateFacts");
    expect(projectedReview).not.toContain("evidenceGraph");
    expect(projectedReview).not.toContain("responsibilityBullets");
    expect(projectedReview).not.toContain("Customer service");
    expect(projectedReview).not.toContain("owner@example.test");
    expect(fixture.profile.cvDocument).toEqual(sourceCvBefore);
    expect(fixture.writes).toEqual(["insert:applicationContexts"]);
  });

  it("keeps the registered public return validator aligned with the projected review DTO", async () => {
    const exportedReturns = JSON.parse(
      (
        prepareCvTailoringReview as unknown as {
          exportReturns(): string;
        }
      ).exportReturns(),
    ) as {
      type: "union";
      value: Array<{
        type: "object";
        value: Record<
          string,
          {
            fieldType: {
              type: string;
              value?: Record<string, unknown>;
            };
          }
        >;
      }>;
    };
    const autoRecommended = exportedReturns.value.find(
      (branch) =>
        (
          branch.value.mode?.fieldType as {
            type?: string;
            value?: unknown;
          }
        )?.value === "auto_recommended",
    );
    const planFields = (
      autoRecommended?.value.plan?.fieldType.value as
        | Record<
            string,
            {
              fieldType: {
                type: string;
                value?: unknown;
              };
            }
          >
        | undefined
    );
    const itemFields = (
      (
        planFields?.items?.fieldType.value as {
          type?: string;
          value?: Record<string, unknown>;
        }
      )?.value ?? {}
    ) as Record<string, unknown>;

    expect(planFields).toHaveProperty("requiredDemandIds");
    expect(itemFields).toHaveProperty("displayLabel");
    expect(itemFields).toHaveProperty("demandIds");

    const fixture = makeContext();
    const result = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      mode: "auto_recommended",
    });

    expect(result.plan).toEqual(
      expect.objectContaining({
        requiredDemandIds: expect.any(Array),
        items: [
          expect.objectContaining({
            displayLabel: expect.any(String),
            demandIds: expect.any(Array),
          }),
        ],
      }),
    );
  });

  it("uses a normalized field of study when an education degree is empty", async () => {
    const fixture = makeContext({
      educationFieldOfStudy: "  Industrial   Design  ",
      mustHaves: ["Industrial Design"],
    });

    const result = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      mode: "auto_recommended",
    });

    expect(
      result.plan?.items.find((item) => item.section === "education")
        ?.displayLabel,
    ).toBe("Industrial Design");
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

  it("blocks the reviewed result when the only item covering a required demand is rejected", async () => {
    const fixture = makeContext();
    const prepared = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });
    if (!prepared.plan) {
      throw new Error("Expected automatic plan");
    }

    const reviewed = await submitCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      expectedPlanId: prepared.plan.id,
      decisions: [
        {
          planItemId: prepared.plan.items[0].id,
          reviewState: "rejected",
        },
      ],
    });

    expect(reviewed.plan?.blocked).toBe(true);
    expect(reviewed.plan?.blockedReason).toMatch(/required.*accepted/i);
    expect(fixture.tables.applicationArtifacts[0]?.status).toBe("blocked");

    const resumed = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });
    expect(resumed.plan?.blocked).toBe(true);
    expect(resumed.plan?.items[0]?.reviewState).toBe("rejected");
  });

  it("keeps required demand coverage when one matching item is accepted and another is rejected", async () => {
    const fixture = makeContext({
      skillNames: ["Customer service"],
      keywords: ["Sales associate"],
    });
    const prepared = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });
    if (!prepared.plan) {
      throw new Error("Expected automatic plan");
    }
    const experienceItem = prepared.plan.items.find(
      (item) => item.section === "experience",
    );
    const skillItem = prepared.plan.items.find(
      (item) => item.section === "skills",
    );
    if (!experienceItem || !skillItem) {
      throw new Error("Expected matching experience and skill items");
    }

    const reviewed = await submitCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      expectedPlanId: prepared.plan.id,
      decisions: [
        {
          planItemId: experienceItem.id,
          reviewState: "rejected",
        },
        {
          planItemId: skillItem.id,
          reviewState: "accepted",
        },
      ],
    });

    expect(reviewed.plan?.blocked).toBe(false);
    expect(fixture.tables.applicationArtifacts[0]?.status).toBe("approved");
  });

  it("matches exact short and punctuated technical skills before token filtering", async () => {
    const technicalSkills = ["C", "R", "C++", "C#"];
    const fixture = makeContext({
      mustHaves: technicalSkills,
      skillNames: technicalSkills,
    });

    const prepared = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });

    expect(prepared.plan?.blocked).toBe(false);
    expect(prepared.plan?.warnings).toEqual([]);
    expect(
      prepared.plan?.items.filter(
        (item) =>
          item.section === "skills" && item.priority === "required",
      ),
    ).toHaveLength(technicalSkills.length);
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

  it("materializes one derived profile from only jobId and expectedPlanId, then attaches a safe identity", async () => {
    const fixture = makeContext({
      cvSummary: "Customer-focused bakery professional",
      skillNames: ["Customer service"],
    });
    const sourceBefore = structuredClone(fixture.profile.cvDocument);
    const jobBefore = structuredClone(fixture.tables.jobs[0]);
    const prepared = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });
    if (!prepared.plan) {
      throw new Error("Expected automatic plan");
    }
    const reviewed = await submitCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      expectedPlanId: prepared.plan.id,
      decisions: prepared.plan.items.map((item) => ({
        planItemId: item.id,
        reviewState: "accepted" as const,
      })),
    });
    if (!reviewed.plan) {
      throw new Error("Expected reviewed plan");
    }
    const writesBeforeMaterialization = [...fixture.writes];

    const result = await materializeCvTailoringReview._handler(
      fixture.ctx,
      {
        jobId: JOB_ID,
        expectedPlanId: reviewed.plan.id,
      },
    );

    expect(result).toEqual({
      jobId: JOB_ID,
      resumeId: expect.stringMatching(/^source-cv-variant:v1:/),
      resumeName: "Canonical source CV",
      sourceCvId: PROFILE_ID,
      reused: false,
    });
    expect(result).not.toHaveProperty("_id");
    expect(result).not.toHaveProperty("_creationTime");
    expect(result).not.toHaveProperty("cvDocument");
    const derivedProfiles = fixture.tables.userProfiles.filter(
      (profile) => profile.profileId === result.resumeId,
    );
    expect(derivedProfiles).toHaveLength(1);
    expect(derivedProfiles[0]?.cvDocument).toMatchObject({
      id: result.resumeId,
      metadata: {
        reviewedSourceCvVariant: {
          kind: "reviewed_source_cv_variant",
          sourceCvId: PROFILE_ID,
          jobId: JOB_ID,
          reviewedPlanId: reviewed.plan.id,
          version: 1,
        },
      },
    });
    expect(derivedProfiles[0]).toMatchObject({
      summary: "Customer-focused bakery professional",
      skills: ["Customer service"],
      experience: [
        expect.objectContaining({
          company: "Bakery One",
          title: "Sales associate",
        }),
      ],
      raw_text: expect.stringContaining("Customer service"),
      keywords: expect.arrayContaining(["customer-focused"]),
    });
    expect(fixture.tables.jobs[0]).toEqual({
      ...jobBefore,
      ownerClerkId: "clerk-owner",
      lastResumeId: result.resumeId,
      lastResumeName: result.resumeName,
      updatedAt: expect.any(Number),
    });
    expect(Number(fixture.tables.jobs[0]?.updatedAt)).toBeGreaterThan(T);
    expect(fixture.profile.cvDocument).toEqual(sourceBefore);
    expect(fixture.tables.applicationArtifacts).toHaveLength(1);
    expect(fixture.writes.slice(writesBeforeMaterialization.length)).toEqual([
      "insert:userProfiles",
      "insert:profileCatalog",
      "patch:jobs",
      "patch:jobs",
      "insert:jobCatalog",
    ]);
    expect(
      fixture.writes.some((write) =>
        /candidateFacts|candidateSourceDocuments/.test(write),
      ),
    ).toBe(false);
  });

  it("keeps a newer reviewed source-CV variant behind the canonical primary profile", async () => {
    const fixture = makeContext();
    const derivedProfileId = "source-cv-variant:v1:derived";
    fixture.tables.userProfiles.push({
      _id: "profile-derived-storage",
      _creationTime: T + 2,
      clerkId: CLERK_ID,
      profileId: derivedProfileId,
      email: "owner@example.test",
      updatedAt: T + 10_000,
      createdAt: T + 1,
      version: 2,
      // Simulates a later full-document edit that replaces provenance metadata.
      cvDocument: sourceCv(derivedProfileId),
    });

    const profiles = await listProfilesForClerk(fixture.ctx, CLERK_ID);

    expect(profiles.map((profile) => profile.profileId)).toEqual([
      PROFILE_ID,
      derivedProfileId,
    ]);
  });

  it("replays the same reviewed plan without overwriting later derived-CV edits", async () => {
    const fixture = makeContext();
    const prepared = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });
    if (!prepared.plan) {
      throw new Error("Expected automatic plan");
    }
    const reviewed = await submitCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      expectedPlanId: prepared.plan.id,
      decisions: prepared.plan.items.map((item) => ({
        planItemId: item.id,
        reviewState: "accepted" as const,
      })),
    });
    if (!reviewed.plan) {
      throw new Error("Expected reviewed plan");
    }
    const first = await materializeCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      expectedPlanId: reviewed.plan.id,
    });
    const derived = fixture.tables.userProfiles.find(
      (profile) => profile.profileId === first.resumeId,
    );
    if (!derived) {
      throw new Error("Expected derived profile");
    }
    const editedDocument = {
      ...(derived.cvDocument as Record<string, unknown>),
      title: "User-edited tailored CV",
      tags: ["edited-after-materialization"],
    };
    derived.cvDocument = editedDocument;
    const profileCountBeforeReplay = fixture.tables.userProfiles.length;

    const replayed = await materializeCvTailoringReview._handler(
      fixture.ctx,
      {
        jobId: JOB_ID,
        expectedPlanId: reviewed.plan.id,
      },
    );

    expect(replayed).toEqual({
      ...first,
      resumeName: "User-edited tailored CV",
      reused: true,
    });
    expect(fixture.tables.userProfiles).toHaveLength(
      profileCountBeforeReplay,
    );
    expect(derived.cvDocument).toBe(editedDocument);
    expect(fixture.tables.jobs[0]?.lastResumeId).toBe(first.resumeId);
    expect(fixture.tables.jobs[0]?.lastResumeName).toBe(
      "User-edited tailored CV",
    );
    expect(
      fixture.writes.filter(
        (write) => write === "insert:userProfiles",
      ),
    ).toHaveLength(1);
  });

  it("fails closed on a deterministic provenance collision", async () => {
    const fixture = makeContext();
    const prepared = await prepareCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
    });
    if (!prepared.plan) {
      throw new Error("Expected automatic plan");
    }
    const reviewed = await submitCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      expectedPlanId: prepared.plan.id,
      decisions: prepared.plan.items.map((item) => ({
        planItemId: item.id,
        reviewState: "accepted" as const,
      })),
    });
    if (!reviewed.plan) {
      throw new Error("Expected reviewed plan");
    }
    const first = await materializeCvTailoringReview._handler(fixture.ctx, {
      jobId: JOB_ID,
      expectedPlanId: reviewed.plan.id,
    });
    const derived = fixture.tables.userProfiles.find(
      (profile) => profile.profileId === first.resumeId,
    );
    const derivedDocument = derived?.cvDocument as
      | Record<string, any>
      | undefined;
    if (!derived || !derivedDocument) {
      throw new Error("Expected derived profile");
    }
    derivedDocument.metadata.reviewedSourceCvVariant.sourceCvId =
      "cv-collision";
    fixture.tables.jobs[0]!.lastResumeId = PROFILE_ID;
    fixture.tables.jobs[0]!.lastResumeName = "Canonical source CV";
    const writesBeforeCollision = [...fixture.writes];

    await expect(
      materializeCvTailoringReview._handler(fixture.ctx, {
        jobId: JOB_ID,
        expectedPlanId: reviewed.plan.id,
      }),
    ).rejects.toThrow(/provenance collision/i);
    expect(fixture.writes).toEqual(writesBeforeCollision);
  });

  it("rejects missing auth, foreign jobs, wrong jobs, pending, blocked, stale, and wrong-current-CV materialization", async () => {
    for (const fixture of [
      makeContext({ authenticated: false }),
      makeContext({ jobOwnerId: "profile-foreign" }),
    ]) {
      await expect(
        materializeCvTailoringReview._handler(fixture.ctx, {
          jobId: JOB_ID,
          expectedPlanId: "resume-variant-plan:not-authorized",
        }),
      ).rejects.toThrow();
      expect(fixture.writes).toEqual([]);
    }
    const wrongJob = makeContext();
    await expect(
      materializeCvTailoringReview._handler(wrongJob.ctx, {
        jobId: "job-missing",
        expectedPlanId: "resume-variant-plan:not-authorized",
      }),
    ).rejects.toThrow();
    expect(wrongJob.writes).toEqual([]);

    const pending = makeContext();
    const pendingPlan = await prepareCvTailoringReview._handler(
      pending.ctx,
      { jobId: JOB_ID },
    );
    if (!pendingPlan.plan) {
      throw new Error("Expected pending plan");
    }
    await expect(
      materializeCvTailoringReview._handler(pending.ctx, {
        jobId: JOB_ID,
        expectedPlanId: pendingPlan.plan.id,
      }),
    ).rejects.toThrow(/fully reviewed/i);
    expect(pending.tables.userProfiles).toHaveLength(1);

    const blocked = makeContext({
      mustHaves: ["Customer service", "Forklift certification"],
    });
    const blockedPending = await prepareCvTailoringReview._handler(
      blocked.ctx,
      { jobId: JOB_ID },
    );
    if (!blockedPending.plan) {
      throw new Error("Expected blocked plan");
    }
    const blockedReviewed = await submitCvTailoringReview._handler(
      blocked.ctx,
      {
        jobId: JOB_ID,
        expectedPlanId: blockedPending.plan.id,
        decisions: blockedPending.plan.items.map((item) => ({
          planItemId: item.id,
          reviewState: "accepted" as const,
        })),
      },
    );
    if (!blockedReviewed.plan) {
      throw new Error("Expected reviewed blocked plan");
    }
    await expect(
      materializeCvTailoringReview._handler(blocked.ctx, {
        jobId: JOB_ID,
        expectedPlanId: blockedReviewed.plan.id,
      }),
    ).rejects.toThrow(/generation-ready/i);

    const ready = makeContext();
    const readyPending = await prepareCvTailoringReview._handler(ready.ctx, {
      jobId: JOB_ID,
    });
    if (!readyPending.plan) {
      throw new Error("Expected ready plan");
    }
    const readyReviewed = await submitCvTailoringReview._handler(
      ready.ctx,
      {
        jobId: JOB_ID,
        expectedPlanId: readyPending.plan.id,
        decisions: readyPending.plan.items.map((item) => ({
          planItemId: item.id,
          reviewState: "accepted" as const,
        })),
      },
    );
    if (!readyReviewed.plan) {
      throw new Error("Expected reviewed ready plan");
    }
    await expect(
      materializeCvTailoringReview._handler(ready.ctx, {
        jobId: JOB_ID,
        expectedPlanId: readyPending.plan.id,
      }),
    ).rejects.toThrow(/stale/i);

    const wrongCv: StoredRow = {
      ...ready.profile,
      _id: "profile-wrong-cv",
      profileId: "profile-wrong-cv",
      cvDocument: sourceCv("profile-wrong-cv"),
    };
    ready.tables.userProfiles.push(wrongCv);
    ready.tables.jobs[0]!.lastResumeId = "profile-wrong-cv";
    ready.tables.jobs[0]!.lastResumeName = "Wrong current CV";
    await expect(
      materializeCvTailoringReview._handler(ready.ctx, {
        jobId: JOB_ID,
        expectedPlanId: readyReviewed.plan.id,
      }),
    ).rejects.toThrow();
    expect(
      ready.tables.userProfiles.some((profile) =>
        String(profile.profileId ?? "").startsWith(
          "source-cv-variant:v1:",
        ),
      ),
    ).toBe(false);
  });
});
