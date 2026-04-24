import { afterEach, describe, expect, it, vi } from "vitest";

import {
  archiveJob,
  debugInspectMatchInputByJobId,
  deleteArchivedJob,
  duplicateJob,
  getById,
  getValidJobExtractionShadowByHash,
  listArchivedForUser,
  listForUser,
  parseCreatedJob,
  restoreArchivedJob,
  setJobFavorite,
  setResumeForJob,
  storeJobExtractionShadow,
} from "../jobsPublic";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("jobsPublic.listForUser", () => {
  it("returns jobs across linked profiles without reading active CV state", async () => {
    const linkedProfiles = [
      {
        _id: "profile_new",
        _creationTime: 200,
        clerkId: "clerk_123",
        updatedAt: 200,
        createdAt: 200,
        version: 2,
        skills: ["react"],
        keywords: ["react"],
        email: "new@example.com",
      },
      {
        _id: "profile_old",
        _creationTime: 100,
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        skills: ["typescript"],
        keywords: ["typescript"],
        email: "old@example.com",
      },
    ];
    const jobsByProfileId = new Map([
      [
        "profile_old",
        [
          {
            _id: "job_old",
            _creationTime: 100,
            userId: "profile_old",
            title: "Legacy job",
            company: "Acme",
            location: "Remote",
            isSample: false,
            sourceUrl: "https://example.com/job",
            sourceDomain: "example.com",
            sourceType: "manual",
            parseStatus: "parsed",
            reviewState: "ready",
            status: "active",
            importedAt: 100,
            updatedAt: 100,
            lastOpenedAt: 100,
            archivedAt: null,
            mustHaves: ["TypeScript"],
            keywords: ["TypeScript"],
            mustHavesExtraction: [],
            keywordsExtraction: [],
          },
        ],
      ],
      ["profile_new", []],
    ]);

    const result = await listForUser._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          query(table: string) {
            if (table === "activeCvSnapshots") {
              throw new Error("listForUser should not read active CV state");
            }

            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      linkedProfiles.filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }

            if (table === "jobs") {
              return {
                withIndex(indexName: string, buildIndex: any) {
                  expect(indexName).toBe("by_user_updated");
                  const scope = {
                    values: [] as string[],
                    eq(_field: string, value: string) {
                      this.values.push(value);
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order(direction: string) {
                      expect(direction).toBe("desc");
                      return this;
                    },
                    collect: async () =>
                      jobsByProfileId.get(scope.values[0]) ?? [],
                  };
                },
              };
            }

            if (table === "proposals") {
              return {
                withIndex(indexName: string, buildIndex: any) {
                  expect(indexName).toBe("by_user");
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => [],
                  };
                },
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      {},
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "job_old",
        title: "Legacy job",
        company: "Acme",
        isFavorite: false,
        matchTier: "weak",
      }),
    ]);
  });

  it("prefers a job resume override over the user default resume when computing match tier", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 300,
        profileId: "cv_primary",
        clerkId: "clerk_123",
        updatedAt: 300,
        createdAt: 300,
        version: 3,
        skills: ["design"],
        keywords: ["design"],
        defaultResumeId: "cv_default",
        defaultResumeName: "Default Resume",
        email: "primary@example.com",
      },
      {
        _id: "profile_default",
        _creationTime: 200,
        profileId: "cv_default",
        clerkId: "clerk_123",
        updatedAt: 200,
        createdAt: 200,
        version: 2,
        skills: ["typescript"],
        keywords: ["typescript"],
        email: "default@example.com",
      },
      {
        _id: "profile_override",
        _creationTime: 100,
        profileId: "cv_override",
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        skills: ["react"],
        keywords: ["react"],
        email: "override@example.com",
      },
    ];
    const jobsByProfileId = new Map([
      [
        "profile_primary",
        [
          {
            _id: "job_default",
            _creationTime: 100,
            userId: "profile_primary",
            title: "Default-backed job",
            company: "Acme",
            location: "Remote",
            isSample: false,
            sourceUrl: "https://example.com/job-default",
            sourceDomain: "example.com",
            sourceType: "manual",
            parseStatus: "parsed",
            reviewState: "ready",
            status: "active",
            importedAt: 100,
            updatedAt: 100,
            lastOpenedAt: 100,
            archivedAt: null,
            mustHaves: ["TypeScript"],
            keywords: ["TypeScript"],
            mustHavesExtraction: [],
            keywordsExtraction: [],
          },
          {
            _id: "job_override",
            _creationTime: 120,
            userId: "profile_primary",
            title: "Override-backed job",
            company: "Acme",
            location: "Remote",
            isSample: false,
            sourceUrl: "https://example.com/job-override",
            sourceDomain: "example.com",
            sourceType: "manual",
            parseStatus: "parsed",
            reviewState: "ready",
            status: "active",
            importedAt: 120,
            updatedAt: 120,
            lastOpenedAt: 120,
            archivedAt: null,
            lastResumeId: "cv_override",
            lastResumeName: "Override Resume",
            mustHaves: ["React"],
            keywords: ["React"],
            mustHavesExtraction: [],
            keywordsExtraction: [],
          },
        ],
      ],
      ["profile_default", []],
      ["profile_override", []],
    ]);

    const result = await listForUser._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          query(table: string) {
            if (table === "activeCvSnapshots") {
              throw new Error("listForUser should not read active CV state");
            }

            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      linkedProfiles.filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }

            if (table === "jobs") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    values: [] as string[],
                    eq(_field: string, value: string) {
                      this.values.push(value);
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order() {
                      return this;
                    },
                    collect: async () =>
                      jobsByProfileId.get(scope.values[0]) ?? [],
                  };
                },
              };
            }

            if (table === "proposals") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => [],
                  };
                },
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      {},
    );

    expect(result).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "job_default",
          matchTier: "strong",
        }),
        expect.objectContaining({
          id: "job_override",
          matchTier: "strong",
        }),
      ]),
    );
  });
});

describe("jobsPublic.getById", () => {
  it("does not fall back to owner profile scoring when the attached resume cannot be resolved", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 100,
        profileId: "cv_primary",
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        skills: ["Airtable"],
        keywords: ["Program management"],
        email: "primary@example.com",
      },
    ];
    const job = {
      _id: "job_unresolved_resume",
      _creationTime: 100,
      userId: "profile_primary",
      title: "Operations job",
      company: "Acme",
      location: "Remote",
      isSample: false,
      isFavorite: false,
      sourceUrl: "https://example.com/job",
      sourceDomain: "example.com",
      sourceType: "manual",
      applicationUrl: "",
      parseStatus: "parsed",
      parseVersion: "v1b",
      reviewState: "ready",
      status: "active",
      importedAt: 100,
      updatedAt: 100,
      lastOpenedAt: 100,
      archivedAt: null,
      lastResumeId: "cv_missing",
      lastResumeName: "Deleted resume",
      rawDescription: "Requires Airtable and program management.",
      rawLanguageDetected: "en",
      summary: "Operations role",
      responsibilities: [],
      keywords: [],
      mustHaves: [],
      toneCues: [],
      contacts: [],
      mustHavesExtraction: [
        { value: "Airtable", confidence: 0.9, sourceSpan: null },
      ],
      keywordsExtraction: [
        { value: "Program management", confidence: 0.8, sourceSpan: null },
      ],
      reviewItems: [],
    };

    const result = await getById._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          normalizeId(table: string, id: string) {
            expect(table).toBe("jobs");
            return id;
          },
          get: async (id: string) => (id === job._id ? job : null),
          query(table: string) {
            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      linkedProfiles.filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }

            if (table === "proposals") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => [],
                  };
                },
              };
            }

            if (table === "metrics") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => [],
                  };
                },
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: job._id },
    );

    expect(result?.resumeId).toBe("cv_missing");
    expect(result?.matchRead).toMatchObject({
      fallback: "profile_missing",
      tier: "unknown",
      score: null,
      matched: [],
      missing: ["Airtable", "Program management"],
    });
  });
});

describe("jobsPublic.debugInspectMatchInputByJobId", () => {
  it("returns the full match-input chain for the attached resume source", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 100,
        profileId: "cv_primary",
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        skills: ["legacy"],
        keywords: ["legacy"],
        email: "primary@example.com",
      },
      {
        _id: "profile_attached",
        _creationTime: 120,
        profileId: "cv_attached",
        clerkId: "clerk_123",
        updatedAt: 120,
        createdAt: 120,
        version: 2,
        skills: [],
        keywords: [],
        summary:
          "Operations lead with Airtable workflow automation experience.",
        experience: [
          {
            company: "Acme",
            title: "Program Manager",
            description: "Program management and stakeholder reporting",
          },
        ],
        raw_text: "airtable automation program management",
        email: "attached@example.com",
      },
    ];
    const job = {
      _id: "job_debug_case",
      _creationTime: 100,
      userId: "profile_primary",
      title: "Operations role",
      company: "Acme",
      location: "Remote",
      isSample: false,
      isFavorite: false,
      sourceUrl: "https://example.com/job",
      sourceDomain: "example.com",
      sourceType: "manual",
      applicationUrl: "",
      parseStatus: "parsed",
      parseVersion: "v1b",
      reviewState: "ready",
      status: "active",
      importedAt: 100,
      updatedAt: 100,
      lastOpenedAt: 100,
      archivedAt: null,
      lastResumeId: "cv_attached",
      lastResumeName: "Attached CV",
      rawDescription: "Requires Airtable and program management.",
      rawLanguageDetected: "en",
      summary: "Operations role",
      responsibilities: [],
      keywords: [],
      mustHaves: [],
      toneCues: [],
      contacts: [],
      mustHavesExtraction: [
        { value: "Airtable", confidence: 0.9, sourceSpan: null },
      ],
      keywordsExtraction: [
        { value: "Program management", confidence: 0.8, sourceSpan: null },
      ],
      reviewItems: [],
    };

    const result = await debugInspectMatchInputByJobId._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          normalizeId(table: string, id: string) {
            expect(table).toBe("jobs");
            return id;
          },
          get: async (id: string) => (id === job._id ? job : null),
          query(table: string) {
            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      linkedProfiles.filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: job._id },
    );

    expect(result).toMatchObject({
      jobId: "job_debug_case",
      lastResumeId: "cv_attached",
      resolvedProfileId: "cv_attached",
      profileSkills: [],
      profileKeywords: [],
      summary: "Operations lead with Airtable workflow automation experience.",
      raw_text: "airtable automation program management",
      matchReadFallback: "none",
      score: 100,
      matchedSignals: ["Airtable", "Program management"],
      missingSignals: [],
    });
    expect(result?.experience).toEqual([
      {
        company: "Acme",
        title: "Program Manager",
        description: "Program management and stakeholder reporting",
      },
    ]);
    expect(result?.derivedKeywords).toEqual(
      expect.arrayContaining(["airtable", "program", "management"]),
    );
  });
});

describe("jobsPublic.setResumeForJob", () => {
  it("backfills empty attached resume scoring fields from the saved cvDocument snapshot", async () => {
    const primaryProfile = {
      _id: "profile_primary",
      _creationTime: 100,
      profileId: "cv_primary",
      clerkId: "clerk_123",
      updatedAt: 100,
      createdAt: 100,
      version: 1,
      skills: ["legacy"],
      keywords: ["legacy"],
      email: "primary@example.com",
    };
    const attachedProfile = {
      _id: "profile_attached",
      _creationTime: 110,
      profileId: "cv_attached",
      clerkId: "clerk_123",
      updatedAt: 110,
      createdAt: 110,
      version: 1,
      skills: [],
      keywords: [],
      experience: [],
      summary: null,
      raw_text: null,
      email: "attached@example.com",
      cvDocument: {
        id: "cv_attached",
        title: "Retail Resume",
        sections: [
          {
            type: "summary",
            blocks: [],
            structuredContent: [
              {
                summary:
                  "Retail design specialist for Miami Design District stores.",
              },
            ],
          },
          {
            type: "skills",
            blocks: [],
            structuredContent: [{ name: "Retail design" }],
          },
        ],
      },
    };
    const job = {
      _id: "job_attach",
      userId: "profile_primary",
    };
    const patchCalls: Array<[string, Record<string, unknown>]> = [];

    await setResumeForJob._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          normalizeId(table: string, id: string) {
            expect(table).toBe("jobs");
            return id;
          },
          get: async (id: string) => (id === job._id ? job : null),
          patch: async (id: string, patch: Record<string, unknown>) => {
            patchCalls.push([id, patch]);
          },
          query(table: string) {
            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      [primaryProfile, attachedProfile].filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      {
        jobId: "job_attach",
        resumeId: "cv_attached",
        resumeName: "Retail Resume",
      },
    );

    const profilePatch = patchCalls.find(
      ([id]) => id === "profile_attached",
    )?.[1];
    const jobPatch = patchCalls.find(([id]) => id === "job_attach")?.[1];

    expect(profilePatch).toEqual(
      expect.objectContaining({
        summary: "Retail design specialist for Miami Design District stores.",
        skills: ["Retail design"],
        raw_text: expect.stringContaining("Miami Design District"),
        keywords: expect.arrayContaining(["retail", "design", "miami"]),
      }),
    );
    expect(jobPatch).toEqual(
      expect.objectContaining({
        lastResumeId: "cv_attached",
        lastResumeName: "Retail Resume",
      }),
    );
  });
});

describe("jobsPublic.listArchivedForUser", () => {
  it("returns only archived jobs across linked profiles", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 100,
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        skills: ["react"],
        keywords: ["react"],
        email: "primary@example.com",
      },
    ];
    const jobsByProfileId = new Map([
      [
        "profile_primary",
        [
          {
            _id: "job_active",
            _creationTime: 100,
            userId: "profile_primary",
            title: "Active job",
            company: "Acme",
            location: "Remote",
            isSample: false,
            sourceUrl: "https://example.com/active",
            sourceDomain: "example.com",
            sourceType: "manual",
            parseStatus: "parsed",
            reviewState: "ready",
            status: "active",
            importedAt: 100,
            updatedAt: 100,
            lastOpenedAt: 100,
            archivedAt: null,
            mustHaves: ["React"],
            keywords: ["React"],
            mustHavesExtraction: [],
            keywordsExtraction: [],
          },
          {
            _id: "job_archived",
            _creationTime: 200,
            userId: "profile_primary",
            title: "Archived job",
            company: "Northwind",
            location: "Paris",
            isSample: false,
            sourceUrl: "https://example.com/archived",
            sourceDomain: "example.com",
            sourceType: "manual",
            parseStatus: "parsed",
            reviewState: "ready",
            status: "active",
            importedAt: 200,
            updatedAt: 250,
            lastOpenedAt: 200,
            archivedAt: 300,
            mustHaves: ["React"],
            keywords: ["React"],
            mustHavesExtraction: [],
            keywordsExtraction: [],
          },
        ],
      ],
    ]);

    const result = await (listArchivedForUser as any)._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          query(table: string) {
            if (table === "activeCvSnapshots") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  buildIndex(scope);
                  return {
                    unique: async () => null,
                  };
                },
              };
            }
            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      linkedProfiles.filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }

            if (table === "jobs") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    values: [] as string[],
                    eq(_field: string, value: string) {
                      this.values.push(value);
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order() {
                      return this;
                    },
                    collect: async () =>
                      jobsByProfileId.get(scope.values[0]) ?? [],
                  };
                },
              };
            }

            if (table === "proposals") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => [],
                  };
                },
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      {},
    );

    expect(result).toEqual([
      expect.objectContaining({
        id: "job_archived",
        title: "Archived job",
      }),
    ]);
  });
});

describe("jobsPublic archive recovery mutations", () => {
  it("archives a visible job owned by a linked profile", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 200,
        clerkId: "clerk_123",
        updatedAt: 200,
        createdAt: 200,
        version: 2,
        email: "primary@example.com",
      },
      {
        _id: "profile_legacy",
        _creationTime: 100,
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        email: "legacy@example.com",
      },
    ];
    const job = {
      _id: "job_legacy",
      userId: "profile_legacy",
      archivedAt: null,
      updatedAt: 300,
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> =
      [];

    const result = await (archiveJob as any)._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          normalizeId: (_table: string, id: string) => id,
          get: async (id: string) => (id === job._id ? job : null),
          patch: async (id: string, patch: Record<string, unknown>) => {
            patchCalls.push({ id, patch });
            Object.assign(job, patch);
          },
          query(table: string) {
            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      linkedProfiles.filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: "job_legacy" },
    );

    expect(result).toBeNull();
    expect(patchCalls).toEqual([
      {
        id: "job_legacy",
        patch: {
          archivedAt: expect.any(Number),
          updatedAt: expect.any(Number),
        },
      },
    ]);
    expect(job.archivedAt).toEqual(expect.any(Number));
  });

  it("restores an archived job by clearing archivedAt", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 200,
        clerkId: "clerk_123",
        updatedAt: 200,
        createdAt: 200,
        version: 2,
        email: "primary@example.com",
      },
      {
        _id: "profile_legacy",
        _creationTime: 100,
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        email: "legacy@example.com",
      },
    ];
    const job = {
      _id: "job_archived",
      userId: "profile_legacy",
      archivedAt: 300,
      updatedAt: 300,
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> =
      [];

    const result = await (restoreArchivedJob as any)._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          normalizeId: (_table: string, id: string) => id,
          get: async (id: string) => (id === job._id ? job : null),
          patch: async (id: string, patch: Record<string, unknown>) => {
            patchCalls.push({ id, patch });
            Object.assign(job, patch);
          },
          query(table: string) {
            if (table === "activeCvSnapshots") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  buildIndex(scope);
                  return {
                    unique: async () => null,
                  };
                },
              };
            }
            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      linkedProfiles.filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: "job_archived" },
    );

    expect(result).toBeNull();
    expect(patchCalls).toEqual([
      {
        id: "job_archived",
        patch: {
          archivedAt: null,
          updatedAt: expect.any(Number),
        },
      },
    ]);
  });

  it("permanently deletes only an archived job", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 200,
        clerkId: "clerk_123",
        updatedAt: 200,
        createdAt: 200,
        version: 2,
        email: "primary@example.com",
      },
      {
        _id: "profile_legacy",
        _creationTime: 100,
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        email: "legacy@example.com",
      },
    ];
    const job = {
      _id: "job_archived",
      userId: "profile_legacy",
      archivedAt: 300,
      updatedAt: 300,
    };
    const deleteCalls: string[] = [];

    const result = await (deleteArchivedJob as any)._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          normalizeId: (_table: string, id: string) => id,
          get: async (id: string) => (id === job._id ? job : null),
          delete: async (id: string) => {
            deleteCalls.push(id);
          },
          query(table: string) {
            if (table === "activeCvSnapshots") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  buildIndex(scope);
                  return {
                    unique: async () => null,
                  };
                },
              };
            }
            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      linkedProfiles.filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: "job_archived" },
    );

    expect(result).toBeNull();
    expect(deleteCalls).toEqual(["job_archived"]);
  });

  it("duplicates a visible job owned by a linked profile", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 200,
        clerkId: "clerk_123",
        updatedAt: 200,
        createdAt: 200,
        version: 2,
        email: "primary@example.com",
      },
      {
        _id: "profile_legacy",
        _creationTime: 100,
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        email: "legacy@example.com",
      },
    ];
    const job = {
      _id: "job_legacy",
      userId: "profile_legacy",
      sourceUrl: "https://example.com/job",
      sourceDomain: "example.com",
      sourceType: "manual",
      applicationUrl: "https://example.com/apply",
      dedupeKey: "example:job",
      parseVersion: "v1b",
      parseStatus: "parsed",
      reviewState: "ready",
      title: "Legacy job",
      company: "Acme",
      location: "Remote",
      rawDescription: "Build internal tools.",
      rawLanguageDetected: "en",
      summary: "Build internal tools.",
      responsibilities: ["Build"],
      keywords: ["tools"],
      mustHaves: ["TypeScript"],
      toneCues: [],
      contacts: [],
      isSample: false,
      isFavorite: true,
      status: "active",
      archivedAt: null,
      reviewItems: [],
    };
    const insertCalls: Array<{ table: string; value: Record<string, unknown> }> =
      [];

    const result = await (duplicateJob as any)._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          normalizeId: (_table: string, id: string) => id,
          get: async (id: string) => (id === job._id ? job : null),
          insert: async (table: string, value: Record<string, unknown>) => {
            insertCalls.push({ table, value });
            return "job_copy";
          },
          query(table: string) {
            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      linkedProfiles.filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: "job_legacy" },
    );

    expect(result).toEqual({ jobId: "job_copy" });
    expect(insertCalls).toHaveLength(1);
    expect(insertCalls[0]).toEqual({
      table: "jobs",
      value: expect.objectContaining({
        userId: "profile_legacy",
        title: "Legacy job",
        archivedAt: null,
        isSample: false,
        isFavorite: true,
      }),
    });
  });
});

describe("jobsPublic.setJobFavorite", () => {
  it("persists favorite state on the job record", async () => {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 100,
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        email: "primary@example.com",
      },
    ];
    const job = {
      _id: "job_alpha",
      userId: "profile_primary",
      isFavorite: false,
      updatedAt: 100,
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> =
      [];

    const result = await setJobFavorite._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
          normalizeId(table: string, id: string) {
            expect(table).toBe("jobs");
            return id;
          },
          get: async (id: string) => (id === job._id ? job : null),
          patch: async (id: string, patch: Record<string, unknown>) => {
            patchCalls.push({ id, patch });
            Object.assign(job, patch);
          },
          query(table: string) {
            if (table === "userProfiles") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  const clerkId = buildIndex(scope);
                  return {
                    collect: async () =>
                      linkedProfiles.filter(
                        (profile) => profile.clerkId === clerkId,
                      ),
                  };
                },
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: "job_alpha", isFavorite: true },
    );

    expect(result).toBeNull();
    expect(patchCalls).toEqual([
      {
        id: "job_alpha",
        patch: {
          isFavorite: true,
          updatedAt: expect.any(Number),
        },
      },
    ]);
    expect(job.isFavorite).toBe(true);
  });
});

describe("jobsPublic.parseCreatedJob shadow extraction", () => {
  function buildParseContext() {
    const job = {
      _id: "job_shadow",
      title: "Security Guard",
      company: "",
      location: "",
      rawDescription:
        "Required: guard card, retail loss prevention experience, and weekend availability.",
      sourceUrl: "https://example.com/security-guard",
      sourceDomain: "example.com",
      sourceType: "manual",
      applicationUrl: "",
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> = [];
    const scheduleCalls: Array<{ delay: number; args: Record<string, unknown> }> = [];

    return {
      patchCalls,
      scheduleCalls,
      ctx: {
        db: {
          normalizeId(table: string, id: string) {
            expect(table).toBe("jobs");
            return id;
          },
          get: async (id: string) => (id === job._id ? job : null),
          patch: async (id: string, patch: Record<string, unknown>) => {
            patchCalls.push({ id, patch });
          },
        },
        scheduler: {
          runAfter: async (
            delay: number,
            _functionReference: unknown,
            args: Record<string, unknown>,
          ) => {
            scheduleCalls.push({ delay, args });
          },
        },
      },
    };
  }

  it("does not schedule shadow extraction when the feature flag is off", async () => {
    vi.stubEnv("JOB_LLM_EXTRACTION_SHADOW", "0");
    const { ctx, scheduleCalls } = buildParseContext();

    await parseCreatedJob._handler(ctx as any, { jobId: "job_shadow" });

    expect(scheduleCalls).toEqual([]);
  });

  it("schedules shadow extraction after heuristic parsing when the feature flag is on", async () => {
    vi.stubEnv("JOB_LLM_EXTRACTION_SHADOW", "1");
    const { ctx, patchCalls, scheduleCalls } = buildParseContext();

    await parseCreatedJob._handler(ctx as any, { jobId: "job_shadow" });

    expect(patchCalls[0]?.patch).toEqual(
      expect.objectContaining({
        parseStatus: "parsed",
        mustHaves: expect.any(Array),
        keywords: expect.any(Array),
      }),
    );
    expect(scheduleCalls).toEqual([
      {
        delay: 0,
        args: { jobId: "job_shadow" },
      },
    ]);
  });
});

describe("jobsPublic job extraction shadow cache", () => {
  const validRow = {
    llm_raw_output: "{\"summary_short\":\"ok\"}",
    llm_normalized_output: { summary_short: "ok" },
    validation_status: "valid",
    fallback_used: false,
    model: "mistral-small-latest",
    prompt_version: "p9_v1",
    model_confidence: "high",
    final_confidence: "high",
  };

  function buildCacheCtx(rows: Array<typeof validRow>) {
    return {
      db: {
        query(table: string) {
          expect(table).toBe("job_extraction_shadow");
          return {
            withIndex(indexName: string, buildIndex: any) {
              expect(indexName).toBe("by_cache_identity");
              const criteria: Record<string, unknown> = {};
              const scope = {
                eq(field: string, value: unknown) {
                  criteria[field] = value;
                  return this;
                },
              };
              buildIndex(scope);
              return {
                first: async () =>
                  rows.find(
                    (row) =>
                      criteria.job_text_hash === "hash_1" &&
                      row.model === criteria.model &&
                      row.prompt_version === criteria.prompt_version &&
                      row.validation_status === criteria.validation_status,
                  ) ?? null,
              };
            },
          };
        },
      },
    };
  }

  it("cache-hits only with the same job text hash, model, prompt version, and valid status", async () => {
    const result = await getValidJobExtractionShadowByHash._handler(
      buildCacheCtx([validRow]) as any,
      {
        jobTextHash: "hash_1",
        model: "mistral-small-latest",
        promptVersion: "p9_v1",
      },
    );

    expect(result?.llm_normalized_output).toEqual({ summary_short: "ok" });
  });

  it("does not cache-hit when the model differs", async () => {
    const result = await getValidJobExtractionShadowByHash._handler(
      buildCacheCtx([validRow]) as any,
      {
        jobTextHash: "hash_1",
        model: "ministral-3b-2512",
        promptVersion: "p9_v1",
      },
    );

    expect(result).toBeNull();
  });

  it("does not cache-hit when the prompt version differs", async () => {
    const result = await getValidJobExtractionShadowByHash._handler(
      buildCacheCtx([validRow]) as any,
      {
        jobTextHash: "hash_1",
        model: "mistral-small-latest",
        promptVersion: "p9_v2",
      },
    );

    expect(result).toBeNull();
  });

  it("stores fallback output separately by leaving llm_normalized_output null", async () => {
    const inserts: unknown[] = [];

    await storeJobExtractionShadow._handler(
      {
        db: {
          insert: async (table: string, value: unknown) => {
            expect(table).toBe("job_extraction_shadow");
            inserts.push(value);
          },
        },
      } as any,
      {
        jobId: "job_shadow" as any,
        jobTextHash: "hash_1",
        llmRawOutput: "{\"summary_short\":\"partial\"",
        llmNormalizedOutput: null,
        validationStatus: "invalid_json",
        fallbackUsed: true,
        model: "mistral-small-latest",
        promptVersion: "p9_v1",
        latencyMs: 123,
        modelConfidence: null,
        finalConfidence: "medium",
        createdAt: 456,
      },
    );

    expect(inserts[0]).toEqual(
      expect.objectContaining({
        llm_raw_output: "{\"summary_short\":\"partial\"",
        llm_normalized_output: null,
        validation_status: "invalid_json",
        fallback_used: true,
      }),
    );
  });
});
