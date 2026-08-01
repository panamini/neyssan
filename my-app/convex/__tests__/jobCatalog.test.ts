import { describe, expect, it, vi } from "vitest";

import { storeJobExtractionShadow } from "../jobsPublic";
import {
  syncJobCatalogById,
  toJobListItem,
} from "../lib/jobCatalog";
import {
  buildProfileCatalogProjection,
  upsertProfileCatalog,
} from "../lib/profileCatalog";

function makeFixture() {
  const ownerClerkId = "clerk_catalog";
  const primaryProfile = {
    _id: "profile_primary",
    clerkId: ownerClerkId,
    profileId: "cv_primary",
    defaultResumeId: "cv_attached",
    version: 1,
    updatedAt: 10,
    skills: ["Operations"],
    keywords: ["operations"],
    experience: [],
  };
  let attachedProfile = {
    _id: "profile_attached",
    clerkId: ownerClerkId,
    profileId: "cv_attached",
    version: 1,
    updatedAt: 10,
    skills: ["Catering"],
    keywords: ["food"],
    experience: [],
  };
  const job = {
    _id: "job_catalog",
    userId: primaryProfile._id,
    ownerClerkId,
    lastResumeId: attachedProfile.profileId,
    title: "React Engineer",
    company: "Synthetic Co",
    location: "Remote",
    rawDescription: "React is required for this role.",
    rawLanguageDetected: "en",
    sourceUrl: "https://example.invalid/job",
    sourceDomain: "example.invalid",
    sourceType: "synthetic",
    parseVersion: "v1",
    parseStatus: "parsed",
    reviewState: "ready",
    mustHaves: ["React"],
    keywords: ["React"],
    status: "active",
    importedAt: 10,
    updatedAt: 10,
    lastOpenedAt: 10,
    archivedAt: null,
  };
  let jobCatalog: any = null;
  let profileCatalog: any = {
    _id: "profile_catalog",
    ...buildProfileCatalogProjection(attachedProfile),
  };
  let accountReadModel: any = {
    _id: "read_model",
    clerkId: ownerClerkId,
    status: "ready",
    version: 2,
    profileCursor: "complete",
    updatedAt: 10,
  };
  const shadowRows: any[] = [];

  const ctx = {
    db: {
      get: vi.fn(async (id: string) => {
        if (id === job._id) return job;
        if (id === primaryProfile._id) return primaryProfile;
        if (id === attachedProfile._id) return attachedProfile;
        return null;
      }),
      query: vi.fn((table: string) => {
        const chain: any = {
          withIndex: (_indexName: string, callback: (q: any) => unknown) => {
            const q: any = { eq: () => q };
            callback(q);
            return chain;
          },
          order: () => chain,
          first: async () => {
            if (table === "jobCatalog") return jobCatalog;
            if (table === "profileCatalog") return profileCatalog;
            if (table === "accountReadModels") return accountReadModel;
            throw new Error(`unexpected first query: ${table}`);
          },
          take: async (limit: number) => {
            if (table === "userProfiles") return [attachedProfile].slice(0, limit);
            if (table === "job_extraction_shadow") {
              return [...shadowRows].reverse().slice(0, limit);
            }
            throw new Error(`unexpected take query: ${table}`);
          },
        };
        return chain;
      }),
      insert: vi.fn(async (table: string, value: any) => {
        if (table === "jobCatalog") {
          jobCatalog = { _id: "job_catalog_projection", ...value };
          return jobCatalog._id;
        }
        if (table === "job_extraction_shadow") {
          shadowRows.push({ _id: `shadow_${shadowRows.length}`, ...value });
          return shadowRows.at(-1)._id;
        }
        throw new Error(`unexpected insert: ${table}`);
      }),
      patch: vi.fn(async (id: string, value: any) => {
        if (id === "job_catalog_projection") Object.assign(jobCatalog, value);
        else if (id === "profile_catalog") Object.assign(profileCatalog, value);
        else if (id === job._id) Object.assign(job, value);
        else throw new Error(`unexpected patch: ${id}`);
      }),
      replace: vi.fn(async (id: string, value: any) => {
        if (id !== "read_model") throw new Error(`unexpected replace: ${id}`);
        accountReadModel = { _id: id, ...value };
      }),
    },
  };

  return {
    ctx,
    job,
    getAttachedProfile: () => attachedProfile,
    setAttachedProfile: (next: typeof attachedProfile) => {
      attachedProfile = next;
    },
    getAccountReadModel: () => accountReadModel,
    getJobCatalog: () => jobCatalog,
  };
}

describe("jobCatalog freshness", () => {
  it("invalidates then recomputes the visible tier after an attached CV edit", async () => {
    const fixture = makeFixture();
    await syncJobCatalogById(fixture.ctx as any, fixture.job._id);
    expect(toJobListItem(fixture.getJobCatalog()).matchTier).toBe("weak");

    const updatedAttachedProfile = {
      ...fixture.getAttachedProfile(),
      version: 2,
      updatedAt: 20,
      skills: ["React"],
      keywords: ["React"],
    };
    fixture.setAttachedProfile(updatedAttachedProfile);
    await upsertProfileCatalog(fixture.ctx as any, updatedAttachedProfile);

    expect(fixture.getAccountReadModel()).toEqual(
      expect.objectContaining({
        status: "backfilling",
        version: 2,
      }),
    );
    expect(fixture.getAccountReadModel()).not.toHaveProperty("profileCursor");

    await syncJobCatalogById(fixture.ctx as any, fixture.job._id);
    expect(toJobListItem(fixture.getJobCatalog()).matchTier).toBe("strong");
  });

  it("synchronizes a lightweight structured verdict when the shadow writer changes", async () => {
    const fixture = makeFixture();
    const updatedAttachedProfile = {
      ...fixture.getAttachedProfile(),
      skills: ["React"],
      keywords: ["React"],
    };
    fixture.setAttachedProfile(updatedAttachedProfile);

    await storeJobExtractionShadow._handler(
      fixture.ctx as any,
      {
        jobId: fixture.job._id as any,
        jobTextHash: "synthetic-hash",
        llmRawOutput: {},
        llmNormalizedOutput: {
          summary_short: "React engineer",
          role_title_normalized: "React Engineer",
          requirements: [
            { value: "React", type: "skill", required: true },
          ],
          keywords_canonical: ["React"],
          licenses_or_certifications: [],
          schedule_constraints: [],
          environment: {
            customer_facing: null,
            retail: null,
            physical_standing: null,
            onsite: null,
          },
          confidence: "high",
        },
        validationStatus: "valid",
        fallbackUsed: false,
        model: "ministral-3b-2512",
        promptVersion: "p9_v2",
        latencyMs: 1,
        modelConfidence: "high",
        finalConfidence: "high",
        createdAt: 30,
      },
    );

    const item = toJobListItem(fixture.getJobCatalog());
    expect(item.matchReview).toEqual(
      expect.objectContaining({
        verdict: expect.stringMatching(/^(strong_lead|possible_lead)$/),
        score: expect.any(Number),
      }),
    );
    expect(item.matchReview).not.toHaveProperty("evidence");
    expect(item.matchReview).not.toHaveProperty("watch_out");
  });
});
