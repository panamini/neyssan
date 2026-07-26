import { describe, expect, it } from "vitest";
import { buildApplicationContextV1FromExistingData } from "../applicationContextBuilder";
import { buildCandidateHash } from "../applicationHarnessHashes";

const NOW = 1_725_000_000_000;

function buildJob(overrides: Record<string, unknown> = {}) {
  return {
    _id: "job_123",
    sourceUrl: "https://example.com/jobs/123",
    title: "Senior Product Engineer",
    company: "Example Co",
    rawDescription: "Build reliable product workflows and data pipelines.",
    ...overrides,
  };
}

function buildCandidateProfile(overrides: Record<string, unknown> = {}) {
  return {
    _id: "cv_123",
    profileId: "profile_external_123",
    defaultResumeId: "resume_default_123",
    defaultResumeName: "Product Engineer Resume",
    summary: "Product engineer focused on durable full-stack systems.",
    skills: ["TypeScript", "React", "Convex"],
    keywords: ["systems", "product", "platform"],
    experience: [
      {
        company: "Example Studio",
        title: "Staff Engineer",
        startDate: "2021-01",
        endDate: null,
        current: true,
        description: "Led platform architecture and product delivery.",
      },
    ],
    education: [
      {
        school: "Example University",
        degree: "BS Computer Science",
      },
    ],
    languages: ["English", "French"],
    contact: { phone: "+1 555 0100", address: "Remote" },
    achievements: ["Reduced delivery cycle time by 30%."],
    cvDocument: {
      id: "doc_123",
      title: "Canonical CV",
      metadata: {
        createdAt: "2024-01-01T00:00:00.000Z",
        updatedAt: "2024-02-01T00:00:00.000Z",
        version: 1,
        locale: "en",
      },
      sections: [
        {
          id: "section_skills",
          title: "Skills",
          type: "skills",
          order: 1,
          blocks: [],
          structuredContent: [{ id: "skill_ts", name: "TypeScript", level: "Advanced" }],
        },
      ],
    },
    ...overrides,
  };
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

describe("application context shadow builder", () => {
  it("builds the same contextHash for the same job and candidate profile", async () => {
    const first = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile(),
      settings: { selectedLanguage: "en", market: "US" },
      now: NOW,
    });
    const second = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile(),
      settings: { selectedLanguage: "en", market: "US" },
      now: NOW + 10_000,
    });

    expect(second.contextHash).toBe(first.contextHash);
    expect(second.context.id).toBe(first.context.id);
  });

  it("changes jobHash and contextHash when rawDescription changes", async () => {
    const base = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile(),
      now: NOW,
    });
    const changed = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob({ rawDescription: "Build reliable product workflows, data pipelines, and review systems." }),
      candidateProfile: buildCandidateProfile(),
      now: NOW,
    });

    expect(changed.jobHash).not.toBe(base.jobHash);
    expect(changed.contextHash).not.toBe(base.contextHash);
  });

  it("changes candidateHash and contextHash when candidate snapshot changes", async () => {
    const base = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile(),
      now: NOW,
    });
    const changed = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile({ skills: ["TypeScript", "React", "Convex", "Postgres"] }),
      now: NOW,
    });

    expect(changed.candidateHash).not.toBe(base.candidateHash);
    expect(changed.contextHash).not.toBe(base.contextHash);
  });

  it("changes candidateHash when candidate contact identity changes", async () => {
    const base = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile(),
      now: NOW,
    });
    const changed = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile({
        email: "candidate@example.com",
        contact: {
          phone: "+1 555 0100",
          address: "Remote",
          email: "candidate@example.com",
        },
      }),
      now: NOW,
    });

    expect(changed.candidateHash).not.toBe(base.candidateHash);
    expect(changed.contextHash).not.toBe(base.contextHash);
  });

  it("requires cvSnapshotHash for cv candidate hashes", () => {
    expect(() =>
      buildCandidateHash({
        sourceKind: "cv",
        cvId: "cv_123",
      } as never),
    ).toThrow(/cvSnapshotHash/);
  });

  it("handles missing sourceUrl, company, and title", async () => {
    const result = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob({ sourceUrl: undefined, company: undefined, title: undefined }),
      candidateProfile: buildCandidateProfile(),
      now: NOW,
    });

    expect(result.context.job.jobId).toBe("job_123");
    expect(result.context.job.rawTextHash).toBe(result.rawTextHash);
    expect(result.context.job.sourceUrl).toBeUndefined();
    expect(result.context.job.company).toBeUndefined();
    expect(result.context.job.title).toBeUndefined();
  });

  it("does not mutate job or candidate profile inputs", async () => {
    const job = buildJob();
    const candidateProfile = buildCandidateProfile();
    const originalJob = clone(job);
    const originalCandidateProfile = clone(candidateProfile);

    await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job,
      candidateProfile,
      now: NOW,
    });

    expect(job).toEqual(originalJob);
    expect(candidateProfile).toEqual(originalCandidateProfile);
  });

  it("treats the same shadow build as the same logical context", async () => {
    const first = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile(),
      now: NOW,
    });
    const second = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile(),
      now: NOW,
    });

    expect(second.context.id).toBe(first.context.id);
    expect(second.contextHash).toBe(first.contextHash);
  });

  it("does not treat compressed active snapshots as complete candidate truth", async () => {
    const base = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile(),
      now: NOW,
    });
    const withActiveSnapshot = await buildApplicationContextV1FromExistingData({
      userId: "cv_123",
      job: buildJob(),
      candidateProfile: buildCandidateProfile({
        activeCvSnapshot: {
          title: "Compressed snapshot",
          personalizationContext: {
            summary: "This compressed summary must not replace candidate truth.",
          },
        },
      }),
      now: NOW,
    });

    expect(withActiveSnapshot.candidateHash).toBe(base.candidateHash);
    expect(withActiveSnapshot.contextHash).toBe(base.contextHash);
  });
});
