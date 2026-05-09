import { afterEach, describe, expect, it, vi } from "vitest";

import {
  approveReviewItem,
  archiveJob,
  debugInspectMatchInputByJobId,
  deleteArchivedJob,
  duplicateJob,
  getById,
  getValidJobExtractionShadowByHash,
  listArchivedForUser,
  listForUser,
  parseCreatedJob,
  recordStructuredMatchReview,
  refreshStructuredMatch,
  restoreArchivedJob,
  runShadowJobExtraction,
  setJobFavorite,
  setResumeForJob,
  storeJobExtractionShadow,
  updateField,
} from "../jobsPublic";
import { hashNormalizedJobText } from "../lib/jobs/llmExtractJob";

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
                  order() {
                    return this;
                  },
                  take: async () => [],
                  collect: async () => [],
                };
              },
            };
            }

            if (table === "job_extraction_shadow") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order() {
                      return this;
                    },
                    take: async () => [],
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

  it("sorts jobs globally by latest activity after merging linked profiles", async () => {
    const linkedProfiles = [
      {
        _id: "profile_first",
        _creationTime: 100,
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        skills: ["react"],
        keywords: ["react"],
        email: "first@example.com",
      },
      {
        _id: "profile_second",
        _creationTime: 200,
        clerkId: "clerk_123",
        updatedAt: 200,
        createdAt: 200,
        version: 2,
        skills: ["typescript"],
        keywords: ["typescript"],
        email: "second@example.com",
      },
    ];
    const baseJob = {
      _creationTime: 100,
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
      archivedAt: null,
      mustHaves: ["React"],
      keywords: ["React"],
      mustHavesExtraction: [],
      keywordsExtraction: [],
    };
    const jobsByProfileId = new Map([
      [
        "profile_first",
        [
          {
            ...baseJob,
            _id: "job_stale_first_profile",
            userId: "profile_first",
            title: "Stale first profile job",
            updatedAt: 100,
            lastOpenedAt: 100,
          },
        ],
      ],
      [
        "profile_second",
        [
          {
            ...baseJob,
            _id: "job_fresh_second_profile",
            userId: "profile_second",
            title: "Fresh second profile job",
            updatedAt: 500,
            lastOpenedAt: 500,
          },
        ],
      ],
    ]);

    const result = await listForUser._handler(
      {
        auth: {
          getUserIdentity: async () => ({ subject: "clerk_123" }),
        },
        db: {
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

            if (table === "job_extraction_shadow") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order() {
                      return this;
                    },
                    take: async () => [],
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

    expect(result.map((job) => job.id)).toEqual([
      "job_fresh_second_profile",
      "job_stale_first_profile",
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
                    order() {
                      return this;
                    },
                    take: async () => [],
                    collect: async () => [],
                  };
                },
              };
            }

            if (table === "job_extraction_shadow") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order() {
                      return this;
                    },
                    take: async () => [],
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
  function buildGetByIdProjectionCtx({
    job,
    shadowRows = [],
    linkedProposalRows = [],
    identity = { subject: "clerk_123" },
    failUnboundedDetailReads = false,
  }: {
    job: any;
    shadowRows?: any[];
    linkedProposalRows?: any[];
    identity?: { subject: string; email?: string };
    failUnboundedDetailReads?: boolean;
  }) {
    const linkedProfiles = [
      {
        _id: "profile_primary",
        _creationTime: 100,
        profileId: "cv_primary",
        clerkId: "clerk_123",
        updatedAt: 100,
        createdAt: 100,
        version: 1,
        skills: ["Legacy React"],
        keywords: ["legacy ops"],
        email: "primary@example.com",
      },
    ];

    return {
      auth: {
        getUserIdentity: async () => identity,
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
                const criteria: Record<string, string> = {};
                const scope = {
                  eq(field: string, value: string) {
                    criteria[field] = value;
                    return this;
                  },
                };
                buildIndex(scope);
                const scopedRows = linkedProposalRows.filter((row) => {
                  if (criteria.status && row.status !== criteria.status) {
                    return false;
                  }
                  if (criteria.jobId && row.jobId && row.jobId !== criteria.jobId) {
                    return false;
                  }
                  return true;
                });
                return {
                  order() {
                    return this;
                  },
                  take: async (limit: number) => scopedRows.slice(0, limit),
                  collect: async () => {
                    if (failUnboundedDetailReads) {
                      throw new Error("unbounded proposals collect");
                    }
                    return scopedRows;
                  },
                };
              },
            };
          }

          if (table === "job_extraction_shadow") {
            return {
              withIndex(indexName: string, buildIndex: any) {
                expect(indexName).toBe("by_job_id");
                const scope = {
                  eq(field: string, value: string) {
                    expect(field).toBe("job_id");
                    expect(value).toBe(job._id);
                    return this;
                  },
                };
                buildIndex(scope);
                return {
                  order() {
                    return this;
                  },
                  take: async (limit: number) => shadowRows.slice(0, limit),
                  collect: async () => {
                    if (failUnboundedDetailReads) {
                      throw new Error("unbounded shadow collect");
                    }
                    return shadowRows;
                  },
                };
              },
            };
          }

          throw new Error(`Unexpected table: ${table}`);
        },
      },
    } as any;
  }

  function buildProjectionJob(overrides: Record<string, unknown> = {}) {
    return {
      _id: "job_visible",
      _creationTime: 100,
      userId: "profile_primary",
      title: "Frontend job",
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
      rawDescription: "Requires Legacy React and legacy ops.",
      rawLanguageDetected: "en",
      summary: "Heuristic summary",
      summaryExtraction: {
        value: "Heuristic summary",
        confidence: 0.6,
        sourceSpan: null,
      },
      responsibilities: [],
      responsibilitiesExtraction: [],
      keywords: ["legacy ops"],
      keywordsExtraction: [
        { value: "legacy ops", confidence: 0.8, sourceSpan: null },
      ],
      mustHaves: ["Legacy React"],
      mustHavesExtraction: [
        { value: "Legacy React", confidence: 0.9, sourceSpan: null },
      ],
      toneCues: [],
      toneCuesExtraction: [],
      contacts: [],
      reviewItems: [],
      ...overrides,
    };
  }

  function buildVisibleShadowRow(overrides: Record<string, unknown> = {}) {
    return {
      _id: "shadow_visible",
      _creationTime: 100,
      job_id: "job_visible",
      job_text_hash: "hash",
      llm_raw_output: {},
      llm_normalized_output: {
        summary_short: "LLM display summary",
        role_title_normalized: "Frontend Job",
        requirements: [
          { value: "Modern React", type: "skill", required: true },
          { value: "Design systems", type: "tool", required: true },
        ],
        keywords_canonical: ["react", "design systems"],
        licenses_or_certifications: [],
        schedule_constraints: [],
        environment: {
          customer_facing: null,
          retail: null,
          physical_standing: null,
          onsite: null,
        },
        confidence: "medium",
      },
      validation_status: "valid",
      fallback_used: false,
      model: "ministral-3b-2512",
      prompt_version: "p9_v2",
      latency_ms: 10,
      model_confidence: "medium",
      final_confidence: "medium",
      created_at: 200,
      ...overrides,
    };
  }

  it("projects eligible visible LLM extraction and structured match-read fields", async () => {
    vi.stubEnv("JOB_LLM_VISIBLE_EXTRACTION", "true");
    const job = buildProjectionJob({
      reviewItems: [
        {
          id: "must_haves",
          fieldKey: "mustHaves",
          label: "Must-haves",
          reviewStatus: "pending",
          suggestedValue: ["Legacy React"],
          sourceText: "Requires Legacy React.",
          confidence: 0.9,
          updatedAt: 100,
        },
        {
          id: "keywords",
          fieldKey: "keywords",
          label: "Keywords",
          reviewStatus: "pending",
          suggestedValue: ["legacy ops"],
          sourceText: "legacy ops",
          confidence: 0.8,
          updatedAt: 100,
        },
        {
          id: "responsibilities",
          fieldKey: "responsibilities",
          label: "Responsibilities",
          reviewStatus: "pending",
          suggestedValue: ["Legacy responsibility"],
          sourceText: "Legacy responsibility.",
          confidence: 0.52,
          updatedAt: 100,
        },
      ],
    });

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [buildVisibleShadowRow()],
      }),
      { jobId: job._id },
    );

    expect(result).toMatchObject({
      visibleSummary: "LLM display summary",
      visibleRequirements: ["Modern React", "Design systems"],
      visibleKeywords: ["react", "design systems"],
      visibleExtractionSource: "llm",
      summary: "Heuristic summary",
      mustHaves: ["Legacy React"],
      keywords: ["legacy ops"],
      mustHavesExtraction: [
        { value: "Legacy React", confidence: 0.9, sourceSpan: null },
      ],
      keywordsExtraction: [
        { value: "legacy ops", confidence: 0.8, sourceSpan: null },
      ],
    });
    expect(result?.reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "summary",
          label: "Summary",
          suggestedValue: "LLM display summary",
          reviewStatus: "pending",
          updatedAt: expect.any(Number),
        }),
        expect.objectContaining({
          fieldKey: "mustHaves",
          label: "Must-haves",
          suggestedValue: ["Modern React", "Design systems"],
          reviewStatus: "pending",
          updatedAt: expect.any(Number),
        }),
        expect.objectContaining({
          fieldKey: "keywords",
          suggestedValue: ["react", "design systems"],
          reviewStatus: "pending",
          updatedAt: expect.any(Number),
        }),
      ]),
    );
    expect(result?.reviewItems.map((item) => item.fieldKey)).not.toContain(
      "responsibilities",
    );
    expect(result?.matchRead).toMatchObject({
      score: 25,
      tier: "weak",
      scoreVisible: true,
      confidence: expect.any(String),
      matched: ["Modern React"],
      missing: ["Design systems"],
      method: "llm",
      fallback: "none",
    });
    expect(result?.matchReview).toMatchObject({
      verdict: "probably_skip",
      score: 25,
      suggested_next_step: "review_manually",
      evidence: [
        expect.objectContaining({
          job_signal: "Modern React",
        }),
      ],
    });
  });

  it("bounds detail-only linked proposal and shadow reads for one job", async () => {
    vi.stubEnv("JOB_LLM_VISIBLE_EXTRACTION", "true");
    const job = buildProjectionJob();
    const linkedProposalRows = Array.from({ length: 64 }, (_, index) => ({
      _id: `proposal_${index}`,
      title: `Proposal ${index}`,
      status: "saved",
      updatedAt: 1000 - index,
    }));
    const shadowRows = Array.from({ length: 64 }, (_, index) =>
      buildVisibleShadowRow({
        _id: `shadow_${index}`,
        created_at: 1000 - index,
      }),
    );

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        linkedProposalRows,
        shadowRows,
        failUnboundedDetailReads: true,
      }),
      { jobId: job._id },
    );

    expect(result?.linkedProposalCount).toBeGreaterThan(0);
    expect(result?.linkedProposals.length).toBeLessThan(linkedProposalRows.length);
    expect(result?.visibleExtractionSource).toBe("llm");
  });

  it("returns only saved linked proposals in job detail", async () => {
    const job = buildProjectionJob();
    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        linkedProposalRows: [
          {
            _id: "proposal_draft",
            jobId: job._id,
            title: "Draft proposal",
            status: "draft",
            updatedAt: 300,
          },
          {
            _id: "proposal_saved",
            jobId: job._id,
            title: "Saved proposal",
            status: "saved",
            updatedAt: 200,
          },
        ],
      }),
      { jobId: job._id },
    );

    expect(result?.linkedProposalCount).toBe(1);
    expect(result?.linkedProposals).toEqual([
      expect.objectContaining({
        id: "proposal_saved",
        status: "saved",
      }),
    ]);
  });

  it("uses detected posting language when an existing French job was stored as English", async () => {
    vi.stubEnv("JOB_LLM_VISIBLE_EXTRACTION", "true");
    const job = buildProjectionJob({
      rawDescription:
        "Nous recherchons un contrôleur de gestion avec expérience financière, compétences en reporting, travail en équipe, formation supérieure et missions de pilotage.",
      rawLanguageDetected: "en",
      mustHaves: ["Expérience financière"],
      mustHavesExtraction: [
        { value: "Expérience financière", confidence: 0.9, sourceSpan: null },
      ],
    });

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [
          buildVisibleShadowRow({
            llm_normalized_output: {
              summary_short:
                "Contrôleur de gestion pour structurer le pilotage financier et le reporting.",
              role_title_normalized: "Contrôleur de gestion",
              requirements: [
                {
                  value: "Expérience en contrôle de gestion",
                  type: "experience",
                  required: true,
                },
                {
                  value: "Compétences en reporting financier",
                  type: "skill",
                  required: true,
                },
              ],
              keywords_canonical: ["contrôle de gestion", "reporting"],
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
          }),
        ],
      }),
      { jobId: job._id },
    );

    expect(result).toMatchObject({
      visibleExtractionSource: "llm",
      visibleSummary:
        "Contrôleur de gestion pour structurer le pilotage financier et le reporting.",
      visibleRequirements: [
        "Expérience en contrôle de gestion",
        "Compétences en reporting financier",
      ],
    });
  });

  it("falls back to heuristic visible fields when the flag is off or rows are unsafe", async () => {
    const job = buildProjectionJob({
      reviewItems: [
        {
          id: "responsibilities",
          fieldKey: "responsibilities",
          label: "Responsibilities",
          reviewStatus: "pending",
          suggestedValue: ["Legacy responsibility"],
          sourceText: "Legacy responsibility.",
          confidence: 0.52,
          updatedAt: 100,
        },
        {
          id: "keywords",
          fieldKey: "keywords",
          label: "Keywords",
          reviewStatus: "pending",
          suggestedValue: ["legacy ops"],
          sourceText: "legacy ops",
          confidence: 0.8,
          updatedAt: 100,
        },
      ],
    });

    const flagOffResult = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [buildVisibleShadowRow()],
      }),
      { jobId: job._id },
    );

    vi.stubEnv("JOB_LLM_VISIBLE_EXTRACTION", "true");
    const unsafeResult = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [
          buildVisibleShadowRow({
            llm_normalized_output: {
              ...buildVisibleShadowRow().llm_normalized_output,
              summary_short: "Apply now at https://example.com/jobs",
            },
          }),
        ],
      }),
      { jobId: job._id },
    );

    for (const result of [flagOffResult, unsafeResult]) {
      expect(result).toMatchObject({
        visibleSummary: "Heuristic summary",
        visibleRequirements: ["Legacy React"],
        visibleKeywords: ["legacy ops"],
        visibleExtractionSource: "heuristic",
        summary: "Heuristic summary",
        mustHaves: ["Legacy React"],
        keywords: ["legacy ops"],
        reviewItems: [
          expect.objectContaining({
            fieldKey: "responsibilities",
            suggestedValue: ["Legacy responsibility"],
          }),
          expect.objectContaining({
            fieldKey: "keywords",
            suggestedValue: ["legacy ops"],
          }),
        ],
      });
      expect(result?.matchRead).toMatchObject({
        score: 25,
        tier: "weak",
      });
    }
  });

  it("projects structured shadow summary only for allowlisted internal UI", async () => {
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_INTERNAL_UI", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_INTERNAL_VIEWERS", "internal@example.com");
    const job = buildProjectionJob();

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [buildVisibleShadowRow()],
        identity: {
          subject: "clerk_123",
          email: "internal@example.com",
        },
      }),
      { jobId: job._id },
    );

    expect(result?.matchRead).toMatchObject({
      score: 25,
      tier: "weak",
      matched: ["Modern React"],
      missing: ["Design systems"],
    });
    expect(result?.structuredShadowSummary).toMatchObject({
      flagEnabled: true,
      internalViewer: true,
      uiEnabled: true,
      status: "available",
      oldScore: null,
      oldTier: "unknown",
      structuredScore: expect.any(Number),
      structuredTier: expect.any(String),
      matchedCount: expect.any(Number),
      partialCount: expect.any(Number),
      missingCount: expect.any(Number),
      unknownCount: expect.any(Number),
      hardGateMissingCount: expect.any(Number),
      metadataLeakCount: expect.any(Number),
      languagePreserved: true,
      provenanceComplete: expect.any(Boolean),
    });
  });

  it("projects advisory structured preview for any viewer in local development", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_ADVISORY_BETA", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_ADVISORY_BETA_ALL", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_BETA_VIEWERS", "*");
    const job = buildProjectionJob();

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [buildVisibleShadowRow()],
        identity: {
          subject: "clerk_123",
          email: "dev@example.com",
        },
      }),
      { jobId: job._id },
    );

    expect(result?.matchRead).toMatchObject({
      score: 25,
      tier: "weak",
    });
    expect(result?.structuredShadowSummary).toMatchObject({
      flagEnabled: true,
      internalViewer: false,
      uiEnabled: false,
      advisoryBetaEnabled: true,
      advisoryBetaViewer: true,
      status: "available",
      oldScore: null,
      oldTier: "unknown",
    });
  });

  it("does not expose advisory preview to wildcard viewers outside local development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_ADVISORY_BETA", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_BETA_VIEWERS", "*");
    const job = buildProjectionJob();

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [buildVisibleShadowRow()],
        identity: {
          subject: "clerk_123",
          email: "dev@example.com",
        },
      }),
      { jobId: job._id },
    );

    expect(result?.matchRead).toMatchObject({
      score: 25,
      tier: "weak",
    });
    expect(result?.structuredShadowSummary).toBeNull();
  });

  it("does not expose advisory preview to the explicit all flag outside local development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_ADVISORY_BETA", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_ADVISORY_BETA_ALL", "true");
    const job = buildProjectionJob();

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [buildVisibleShadowRow()],
        identity: {
          subject: "clerk_123",
          email: "dev@example.com",
        },
      }),
      { jobId: job._id },
    );

    expect(result?.matchRead).toMatchObject({
      score: 25,
      tier: "weak",
    });
    expect(result?.structuredShadowSummary).toBeNull();
  });

  it("still requires an allowlisted viewer outside local development", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_ADVISORY_BETA", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_BETA_VIEWERS", "internal@example.com");
    const job = buildProjectionJob();

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [buildVisibleShadowRow()],
        identity: {
          subject: "clerk_123",
          email: "internal@example.com",
        },
      }),
      { jobId: job._id },
    );

    expect(result?.matchRead).toMatchObject({
      score: 25,
      tier: "weak",
    });
    expect(result?.structuredShadowSummary).toMatchObject({
      advisoryBetaEnabled: true,
      advisoryBetaViewer: true,
      status: "available",
    });
  });

  it("does not project structured shadow summary when rollback UI flag is off", async () => {
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_INTERNAL_UI", "false");
    vi.stubEnv("STRUCTURED_MATCH_READ_INTERNAL_VIEWERS", "internal@example.com");
    const job = buildProjectionJob();

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [buildVisibleShadowRow()],
        identity: {
          subject: "clerk_123",
          email: "internal@example.com",
        },
      }),
      { jobId: job._id },
    );

    expect(result?.structuredShadowSummary).toBeNull();
    expect(result?.matchRead).toMatchObject({
      score: 25,
      tier: "weak",
    });
  });

  it("does not project advisory preview when advisory beta is disabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_ADVISORY_BETA", "false");
    vi.stubEnv("STRUCTURED_MATCH_READ_BETA_VIEWERS", "*");
    const job = buildProjectionJob();

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [buildVisibleShadowRow()],
        identity: {
          subject: "clerk_123",
          email: "dev@example.com",
        },
      }),
      { jobId: job._id },
    );

    expect(result?.structuredShadowSummary).toBeNull();
    expect(result?.matchRead).toMatchObject({
      score: 25,
      tier: "weak",
    });
  });

  it("does not project advisory preview when shadow is disabled", async () => {
    vi.stubEnv("NODE_ENV", "development");
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "false");
    vi.stubEnv("STRUCTURED_MATCH_READ_ADVISORY_BETA", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_BETA_VIEWERS", "*");
    const job = buildProjectionJob();

    const result = await getById._handler(
      buildGetByIdProjectionCtx({
        job,
        shadowRows: [buildVisibleShadowRow()],
        identity: {
          subject: "clerk_123",
          email: "dev@example.com",
        },
      }),
      { jobId: job._id },
    );

    expect(result?.structuredShadowSummary).toBeNull();
    expect(result?.matchRead).toMatchObject({
      score: 25,
      tier: "weak",
    });
  });

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
                    order() {
                      return this;
                    },
                    take: async () => [],
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
                    order() {
                      return this;
                    },
                    take: async () => [],
                    collect: async () => [],
                  };
                },
              };
            }

            if (table === "job_extraction_shadow") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order() {
                      return this;
                    },
                    take: async () => [],
                    collect: async () => [],
                  };
                },
              };
            }

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

            if (table === "job_extraction_shadow") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order() {
                      return this;
                    },
                    take: async () => [],
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
      fallback: "structured_pending",
      tier: "unknown",
      score: null,
      matched: [],
      missing: [],
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
      matchReadFallback: "structured_pending",
      score: null,
      matchedSignals: [],
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
    expect(result?.structuredShadowSummary).toMatchObject({
      flagEnabled: false,
      internalViewer: false,
      status: "unavailable",
      reason: "shadow_disabled",
      structuredScore: null,
      metadataLeakCount: 0,
      provenanceComplete: false,
    });
  });

  it("does not compute structured shadow output when the internal viewer gate fails", async () => {
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");

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
        keywords: ["Airtable", "Program management"],
        email: "primary@example.com",
      },
    ];
    const job = {
      _id: "job_debug_gate",
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
      lastResumeId: null,
      lastResumeName: null,
      rawDescription: "Requires Airtable.",
      rawLanguageDetected: "en",
      summary: "Operations role",
      responsibilities: [],
      keywords: [],
      mustHaves: ["Airtable"],
      toneCues: [],
      contacts: [],
      mustHavesExtraction: [],
      keywordsExtraction: [],
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

    expect(result?.structuredShadow).toMatchObject({
      structured: {
        status: "unavailable",
        reason: "internal_viewer_required",
      },
    });
    expect(result?.structuredShadowSummary).toMatchObject({
      flagEnabled: true,
      internalViewer: false,
      status: "unavailable",
      reason: "internal_viewer_required",
      structuredScore: null,
    });
  });

  it("exposes structured shadow comparison only when flag and internal viewer gates pass", async () => {
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_INTERNAL_VIEWERS", "clerk_123,admin@example.com");

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
        keywords: ["Airtable", "Program management"],
        summary: "Operations lead with Airtable and program management experience.",
        experience: [
          {
            company: "Acme",
            title: "Program Manager",
            description: "Program management and Airtable workflow automation",
          },
        ],
        email: "primary@example.com",
      },
    ];
    const job = {
      _id: "job_debug_structured",
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
      lastResumeId: null,
      lastResumeName: null,
      rawDescription: "Requires Airtable and program management.",
      rawLanguageDetected: "en",
      summary: "Operations role",
      responsibilities: [],
      keywords: [],
      mustHaves: ["Airtable", "Program management"],
      toneCues: [],
      contacts: [],
      mustHavesExtraction: [],
      keywordsExtraction: [],
      reviewItems: [],
    };
    const shadowRows = [
      {
        llm_normalized_output: {
          summary_short: "Operations role requiring Airtable and program management.",
          role_title_normalized: "Operations Manager",
          requirements: [
            { value: "Airtable", type: "skill", required: true },
            { value: "Program management", type: "skill", required: true },
          ],
          keywords_canonical: ["Airtable", "Program management"],
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
        validation_status: "valid",
        fallback_used: false,
        model: "ministral-3b-2512",
        prompt_version: "p9_v2",
        created_at: 100,
      },
    ];

    const result = await debugInspectMatchInputByJobId._handler(
      {
        auth: {
          getUserIdentity: async () => ({
            subject: "clerk_123",
            email: "admin@example.com",
          }),
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
            if (table === "job_extraction_shadow") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      expect(value).toBe(job._id);
                      return value;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => shadowRows,
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

    expect(result?.structuredShadow.structured.status).toBe("available");
    expect(result?.structuredShadowSummary).toMatchObject({
      flagEnabled: true,
      internalViewer: true,
      status: "available",
      reason: null,
      oldScore: null,
      oldTier: "unknown",
      structuredScore: expect.any(Number),
      structuredTier: expect.any(String),
      matchedCount: expect.any(Number),
      partialCount: expect.any(Number),
      missingCount: 0,
      unknownCount: expect.any(Number),
      metadataLeakCount: 0,
      provenanceComplete: true,
      jobRequirementCount: expect.any(Number),
      jobConstraintCount: 0,
      profileEvidenceCount: expect.any(Number),
      profileConstraintCount: 0,
    });
  });
});

describe("jobsPublic.recordStructuredMatchReview", () => {
  it("logs reviewer label with current production and structured values without mutating production match", async () => {
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_INTERNAL_VIEWERS", "internal@example.com");
    vi.stubEnv("STRUCTURED_MATCH_REVIEW_APP_GIT_COMMIT_SHA", "abc123review");

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
        keywords: ["Airtable", "Program management"],
        summary: "Operations lead with Airtable and program management experience.",
        experience: [
          {
            company: "Acme",
            title: "Program Manager",
            description: "Program management and Airtable workflow automation",
          },
        ],
        email: "primary@example.com",
      },
    ];
    const job = {
      _id: "job_review_structured",
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
      lastResumeId: "cv_primary",
      lastResumeName: "Primary CV",
      rawDescription: "Requires Airtable and program management.",
      rawLanguageDetected: "en",
      summary: "Operations role",
      responsibilities: [],
      keywords: [],
      mustHaves: ["Airtable", "Program management"],
      toneCues: [],
      contacts: [],
      mustHavesExtraction: [],
      keywordsExtraction: [],
      reviewItems: [],
    };
    const shadowRows = [
      {
        llm_normalized_output: {
          summary_short: "Operations role requiring Airtable and program management.",
          role_title_normalized: "Operations Manager",
          requirements: [
            { value: "Airtable", type: "skill", required: true },
            { value: "Program management", type: "skill", required: true },
          ],
          keywords_canonical: ["Airtable", "Program management"],
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
        validation_status: "valid",
        fallback_used: false,
        model: "ministral-3b-2512",
        prompt_version: "p9_v2",
        created_at: 100,
      },
    ];
    const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];

    const result = await recordStructuredMatchReview._handler(
      {
        auth: {
          getUserIdentity: async () => ({
            subject: "clerk_123",
            email: "internal@example.com",
          }),
        },
        db: {
          normalizeId(table: string, id: string) {
            expect(table).toBe("jobs");
            return id;
          },
          get: async (id: string) => (id === job._id ? job : null),
          insert: async (table: string, value: Record<string, unknown>) => {
            inserts.push({ table, value });
            return "structured_review_1";
          },
          patch: async () => {
            throw new Error("review logging must not mutate production records");
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
            if (table === "job_extraction_shadow") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      expect(value).toBe(job._id);
                      return value;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => shadowRows,
                  };
                },
              };
            }

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      {
        jobId: job._id,
        label: "false weak",
        notes: "Structured scorer underweighted the role evidence.",
        extractionSummaryVerdict: "good",
        extractionRequirementsVerdict: "incomplete",
        extractionKeywordsVerdict: "noisy",
      },
    );

    expect(result).toEqual({ reviewId: "structured_review_1" });
    expect(inserts).toHaveLength(1);
    expect(inserts[0]).toMatchObject({
      table: "structured_match_reviews",
      value: {
        reviewerId: "clerk_123",
        reviewerEmail: "internal@example.com",
        jobId: "job_review_structured",
        profileId: "cv_primary",
        resumeId: "cv_primary",
        productionScore: 100,
        productionTier: "strong",
        structuredScore: expect.any(Number),
        structuredTier: expect.any(String),
        matchedCount: expect.any(Number),
        partialCount: expect.any(Number),
        missingCount: expect.any(Number),
        unknownCount: expect.any(Number),
        hardGateMissingCount: expect.any(Number),
        metadataLeakCount: 0,
        languagePreserved: true,
        provenanceComplete: true,
        reviewerLabel: "false weak",
        notes: "Structured scorer underweighted the role evidence.",
        extractionSummaryVerdict: "good",
        extractionRequirementsVerdict: "incomplete",
        extractionKeywordsVerdict: "noisy",
        appGitCommitSha: "abc123review",
        structuredScorerVersion: "structured-match-read-shadow-v1",
        extractionModel: "ministral-3b-2512",
        extractionPromptVersion: "p9_v2",
        reviewedAt: expect.any(Number),
        scorerVersion: {
          model: "ministral-3b-2512",
          promptVersion: "p9_v2",
        },
        createdAt: expect.any(Number),
      },
    });
  });

  it("rejects invalid extraction verdict values", async () => {
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_INTERNAL_VIEWERS", "internal@example.com");
    vi.stubEnv("STRUCTURED_MATCH_REVIEW_APP_GIT_COMMIT_SHA", "abc123review");

    await expect(
      recordStructuredMatchReview._handler(
        {
          auth: {
            getUserIdentity: async () => ({
              subject: "clerk_123",
              email: "internal@example.com",
            }),
          },
          db: {
            query: () => {
              throw new Error("verdict validation should happen before db reads");
            },
          },
        } as any,
        {
          jobId: "job_review_structured",
          label: "good",
          extractionSummaryVerdict: "too_broad",
        } as any,
      ),
    ).rejects.toThrow(
      "Invalid structured match review extractionSummaryVerdict",
    );
  });

  it("rejects review records that cannot be tied to an app git commit", async () => {
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_INTERNAL_VIEWERS", "internal@example.com");

    await expect(
      recordStructuredMatchReview._handler(
        {
          auth: {
            getUserIdentity: async () => ({
              subject: "clerk_123",
              email: "internal@example.com",
            }),
          },
          db: {
            query: () => {
              throw new Error("versioning failure should happen before db reads");
            },
          },
        } as any,
        {
          jobId: "job_review_structured",
          label: "good",
        },
      ),
    ).rejects.toThrow(
      "Structured match review versioning is not configured: missing app git commit SHA",
    );
  });

  it("uses the short app git commit fallback for local Convex collection", async () => {
    vi.stubEnv("STRUCTURED_MATCH_READ_SHADOW", "true");
    vi.stubEnv("STRUCTURED_MATCH_READ_INTERNAL_VIEWERS", "internal@example.com");
    vi.stubEnv("APP_GIT_COMMIT_SHA", "localfallbacksha");

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
        keywords: ["Airtable", "Program management"],
        summary: "Operations lead with Airtable and program management experience.",
        email: "primary@example.com",
      },
    ];
    const job = {
      _id: "job_review_structured",
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
      lastResumeId: "cv_primary",
      rawLanguageDetected: "en",
      mustHaves: ["Airtable"],
      keywords: [],
      mustHavesExtraction: [],
      keywordsExtraction: [],
      reviewItems: [],
    };
    const inserts: Array<{ table: string; value: Record<string, unknown> }> = [];

    await recordStructuredMatchReview._handler(
      {
        auth: {
          getUserIdentity: async () => ({
            subject: "clerk_123",
            email: "internal@example.com",
          }),
        },
        db: {
          normalizeId: () => job._id,
          get: async () => job,
          insert: async (table: string, value: Record<string, unknown>) => {
            inserts.push({ table, value });
            return "structured_review_1";
          },
          query(table: string) {
            if (table === "userProfiles") {
              return {
                withIndex: (_indexName: string, buildIndex: any) => {
                  buildIndex({ eq: (_field: string, value: string) => value });
                  return { collect: async () => linkedProfiles };
                },
              };
            }
            if (table === "job_extraction_shadow") {
              return {
                withIndex: (_indexName: string, buildIndex: any) => {
                  buildIndex({ eq: (_field: string, value: string) => value });
                  return {
                    collect: async () => [
                      {
                        llm_normalized_output: {
                          summary_short: "Operations role.",
                          role_title_normalized: "Operations Manager",
                          requirements: [
                            { value: "Airtable", type: "skill", required: true },
                          ],
                          keywords_canonical: ["Airtable"],
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
                        validation_status: "valid",
                        fallback_used: false,
                        model: "ministral-3b-2512",
                        prompt_version: "p9_v2",
                        created_at: 100,
                      },
                    ],
                  };
                },
              };
            }
            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: job._id, label: "good" },
    );

    expect(inserts[0]?.value.appGitCommitSha).toBe("localfallbacksha");
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

            if (table === "job_extraction_shadow") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, _value: string) {
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    order() {
                      return this;
                    },
                    take: async () => [],
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

describe("jobsPublic.updateField", () => {
  it("updates a visible job owned by a linked profile", async () => {
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
      summary: "Original summary",
      reviewState: "needs_review",
      reviewItems: [
        {
          id: "summary",
          fieldKey: "summary",
          label: "Summary",
          reviewStatus: "pending",
          suggestedValue: "Original summary",
          sourceText: "Original summary",
          confidence: 0.4,
          updatedAt: 100,
        },
      ],
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> =
      [];

    const result = await updateField._handler(
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
      {
        jobId: "job_legacy",
        fieldKey: "summary",
        value: "Updated linked-profile summary",
      },
    );

    expect(result).toBeNull();
    expect(patchCalls).toEqual([
      {
        id: "job_legacy",
        patch: expect.objectContaining({
          summary: "Updated linked-profile summary",
          reviewState: "ready",
          updatedAt: expect.any(Number),
        }),
      },
    ]);
    expect(patchCalls[0]?.patch.reviewItems).toEqual([
      expect.objectContaining({
        fieldKey: "summary",
        reviewStatus: "approved",
        approvedValue: "Updated linked-profile summary",
      }),
    ]);
  });
});

describe("jobsPublic.approveReviewItem", () => {
  it("approves review items on visible jobs owned by linked profiles", async () => {
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
      title: "Legacy job",
      summary: "Original summary",
      summaryExtraction: {
        value: "Original summary",
        confidence: 0.6,
        sourceSpan: null,
      },
      rawLanguageDetected: "en",
      mustHaves: [],
      mustHavesExtraction: [],
      keywords: [],
      keywordsExtraction: [],
      reviewItems: [
        {
          id: "summary",
          fieldKey: "summary",
          label: "Summary",
          reviewStatus: "pending",
          suggestedValue: "Approved linked-profile summary",
          sourceText: "Approved linked-profile summary",
          confidence: 0.4,
          updatedAt: 100,
        },
      ],
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> =
      [];

    const result = await approveReviewItem._handler(
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

            if (table === "job_extraction_shadow") {
              return {
                withIndex(indexName: string, buildIndex: any) {
                  expect(indexName).toBe("by_job_id");
                  const scope = {
                    eq(field: string, value: string) {
                      expect(field).toBe("job_id");
                      expect(value).toBe(job._id);
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
      { jobId: "job_legacy", reviewItemId: "summary" },
    );

    expect(result).toBeNull();
    expect(patchCalls).toEqual([
      {
        id: "job_legacy",
        patch: expect.objectContaining({
          summary: "Approved linked-profile summary",
          reviewState: "ready",
          updatedAt: expect.any(Number),
        }),
      },
    ]);
    expect(patchCalls[0]?.patch.reviewItems).toEqual([
      expect.objectContaining({
        fieldKey: "summary",
        reviewStatus: "approved",
        approvedValue: "Approved linked-profile summary",
      }),
    ]);
  });

  it("persists projected Mistral review-card values when visible extraction is active", async () => {
    vi.stubEnv("JOB_LLM_VISIBLE_EXTRACTION", "true");
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
      title: "Security Guard",
      summary: "Heuristic summary",
      summaryExtraction: { value: "Heuristic summary", confidence: 0.6, sourceSpan: null },
      rawLanguageDetected: "en",
      mustHaves: ["Location Miami"],
      mustHavesExtraction: [{ value: "Location Miami", confidence: 0.4, sourceSpan: null }],
      keywords: ["location", "miami", "status"],
      keywordsExtraction: [
        { value: "location", confidence: 0.4, sourceSpan: null },
        { value: "miami", confidence: 0.4, sourceSpan: null },
        { value: "status", confidence: 0.4, sourceSpan: null },
      ],
      reviewItems: [
        {
          id: "summary",
          fieldKey: "summary",
          label: "Summary",
          reviewStatus: "pending",
          suggestedValue: "Heuristic summary",
          sourceText: "Heuristic summary",
          confidence: 0.4,
          updatedAt: 100,
        },
        {
          id: "must_haves",
          fieldKey: "mustHaves",
          label: "Must-haves",
          reviewStatus: "pending",
          suggestedValue: ["Location Miami"],
          sourceText: "Location Miami",
          confidence: 0.4,
          updatedAt: 100,
        },
        {
          id: "keywords",
          fieldKey: "keywords",
          label: "Keywords",
          reviewStatus: "pending",
          suggestedValue: ["location", "miami", "status"],
          sourceText: "Location Miami Status",
          confidence: 0.4,
          updatedAt: 100,
        },
      ],
    };
    const patchCalls: Array<{ id: string; patch: Record<string, unknown> }> =
      [];

    const result = await approveReviewItem._handler(
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

            if (table === "job_extraction_shadow") {
              return {
                withIndex(indexName: string, buildIndex: any) {
                  expect(indexName).toBe("by_job_id");
                  const scope = {
                    eq(field: string, value: string) {
                      expect(field).toBe("job_id");
                      expect(value).toBe(job._id);
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => [
                      {
                        job_id: job._id,
                        llm_normalized_output: {
                          summary_short: "Retail security role.",
                          role_title_normalized: "Security Guard",
                          requirements: [
                            {
                              value: "Valid state security guard license",
                              type: "certification",
                              required: true,
                            },
                          ],
                          keywords_canonical: [
                            "security guard",
                            "retail security",
                            "loss prevention",
                          ],
                          licenses_or_certifications: [],
                          schedule_constraints: [],
                          environment: {
                            customer_facing: true,
                            retail: true,
                            physical_standing: true,
                            onsite: true,
                          },
                          confidence: "high",
                        },
                        validation_status: "valid",
                        fallback_used: false,
                        model: "ministral-3b-2512",
                        prompt_version: "p9_v2",
                        created_at: 200,
                      },
                    ],
                  };
                },
              };
            }

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

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: "job_alpha", reviewItemId: "keywords" },
    );

    expect(result).toBeNull();
    expect(patchCalls[0]?.patch.keywords).toEqual([
      "security guard",
      "retail security",
      "loss prevention",
    ]);
    expect(patchCalls[0]?.patch.reviewState).toBe("needs_review");
    expect(patchCalls[0]?.patch.reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "keywords",
          reviewStatus: "approved",
          approvedValue: ["security guard", "retail security", "loss prevention"],
        }),
      ]),
    );

    const mustHavesResult = await approveReviewItem._handler(
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

            if (table === "job_extraction_shadow") {
              return {
                withIndex(indexName: string, buildIndex: any) {
                  expect(indexName).toBe("by_job_id");
                  const scope = {
                    eq(field: string, value: string) {
                      expect(field).toBe("job_id");
                      expect(value).toBe(job._id);
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => [
                      {
                        job_id: job._id,
                        llm_normalized_output: {
                          summary_short: "Retail security role.",
                          role_title_normalized: "Security Guard",
                          requirements: [
                            {
                              value: "Valid state security guard license",
                              type: "certification",
                              required: true,
                            },
                          ],
                          keywords_canonical: [
                            "security guard",
                            "retail security",
                            "loss prevention",
                          ],
                          licenses_or_certifications: [],
                          schedule_constraints: [],
                          environment: {
                            customer_facing: true,
                            retail: true,
                            physical_standing: true,
                            onsite: true,
                          },
                          confidence: "high",
                        },
                        validation_status: "valid",
                        fallback_used: false,
                        model: "ministral-3b-2512",
                        prompt_version: "p9_v2",
                        created_at: 200,
                      },
                    ],
                  };
                },
              };
            }

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

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: "job_alpha", reviewItemId: "must_haves" },
    );

    expect(mustHavesResult).toBeNull();
    expect(patchCalls[1]?.patch.mustHaves).toEqual([
      "Valid state security guard license",
    ]);
    expect(patchCalls[1]?.patch.reviewState).toBe("needs_review");
    expect(patchCalls[1]?.patch.reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "mustHaves",
          reviewStatus: "approved",
          approvedValue: ["Valid state security guard license"],
        }),
      ]),
    );

    const summaryResult = await approveReviewItem._handler(
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

            if (table === "job_extraction_shadow") {
              return {
                withIndex(indexName: string, buildIndex: any) {
                  expect(indexName).toBe("by_job_id");
                  const scope = {
                    eq(field: string, value: string) {
                      expect(field).toBe("job_id");
                      expect(value).toBe(job._id);
                      return this;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => [
                      {
                        job_id: job._id,
                        llm_normalized_output: {
                          summary_short: "Retail security role.",
                          role_title_normalized: "Security Guard",
                          requirements: [
                            {
                              value: "Valid state security guard license",
                              type: "certification",
                              required: true,
                            },
                          ],
                          keywords_canonical: [
                            "security guard",
                            "retail security",
                            "loss prevention",
                          ],
                          licenses_or_certifications: [],
                          schedule_constraints: [],
                          environment: {
                            customer_facing: true,
                            retail: true,
                            physical_standing: true,
                            onsite: true,
                          },
                          confidence: "high",
                        },
                        validation_status: "valid",
                        fallback_used: false,
                        model: "ministral-3b-2512",
                        prompt_version: "p9_v2",
                        created_at: 200,
                      },
                    ],
                  };
                },
              };
            }

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

            throw new Error(`Unexpected table: ${table}`);
          },
        },
      } as any,
      { jobId: "job_alpha", reviewItemId: "summary" },
    );

    expect(summaryResult).toBeNull();
    expect(patchCalls[2]?.patch.summary).toBe("Retail security role.");
    expect(patchCalls[2]?.patch.reviewState).toBe("ready");
    expect(patchCalls[2]?.patch.reviewItems).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          fieldKey: "summary",
          reviewStatus: "approved",
          approvedValue: "Retail security role.",
        }),
      ]),
    );
  });
});

describe("jobsPublic.refreshStructuredMatch", () => {
  function buildRefreshContext(shadowRows: unknown[] = []) {
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
      rawDescription: "Required: guard card and retail loss prevention.",
      updatedAt: 100,
    };
    const scheduleCalls: Array<{ delay: number; args: Record<string, unknown> }> = [];

    return {
      scheduleCalls,
      ctx: {
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

            if (table === "job_extraction_shadow") {
              return {
                withIndex(_indexName: string, buildIndex: any) {
                  const scope = {
                    eq(_field: string, value: string) {
                      return value;
                    },
                  };
                  buildIndex(scope);
                  return {
                    collect: async () => shadowRows,
                  };
                },
              };
            }

            throw new Error(`Unexpected table: ${table}`);
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

  it("queues structured extraction when the current job has no valid structured row", async () => {
    const { ctx, scheduleCalls } = buildRefreshContext();

    await expect(
      refreshStructuredMatch._handler(ctx as any, { jobId: "job_alpha" }),
    ).resolves.toEqual({ queued: true });

    expect(scheduleCalls).toEqual([
      {
        delay: 0,
        args: {
          jobId: "job_alpha",
          force: true,
        },
      },
    ]);
  });

  it("does not queue Mistral extraction when a current valid structured row exists", async () => {
    const currentHash = await hashNormalizedJobText(
      "Required: guard card and retail loss prevention.",
    );
    const { ctx, scheduleCalls } = buildRefreshContext([
      {
        job_text_hash: currentHash,
        model: "ministral-3b-2512",
        prompt_version: "p9_v2",
        validation_status: "valid",
        fallback_used: false,
      },
    ]);

    await expect(
      refreshStructuredMatch._handler(ctx as any, { jobId: "job_alpha" }),
    ).resolves.toEqual({ queued: false });

    expect(scheduleCalls).toEqual([]);
  });

  it("queues structured extraction when the valid row is for stale job text", async () => {
    const staleHash = await hashNormalizedJobText("Old job description.");
    const { ctx, scheduleCalls } = buildRefreshContext([
      {
        job_text_hash: staleHash,
        model: "ministral-3b-2512",
        prompt_version: "p9_v2",
        validation_status: "valid",
        fallback_used: false,
      },
    ]);

    await expect(
      refreshStructuredMatch._handler(ctx as any, { jobId: "job_alpha" }),
    ).resolves.toEqual({ queued: true });

    expect(scheduleCalls).toEqual([
      {
        delay: 0,
        args: {
          jobId: "job_alpha",
          force: true,
        },
      },
    ]);
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
    _creationTime: 100,
    llm_raw_output: "{\"summary_short\":\"ok\"}",
    llm_normalized_output: { summary_short: "ok" },
    validation_status: "valid",
    fallback_used: false,
    model: "mistral-small-latest",
    prompt_version: "p9_v2",
    model_confidence: "high",
    final_confidence: "high",
    created_at: 100,
  };
  const ministralRow = {
    ...validRow,
    model: "ministral-3b-2512",
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
                collect: async () =>
                  rows.filter(
                    (row) =>
                      criteria.job_text_hash === "hash_1" &&
                      row.model === criteria.model &&
                      row.prompt_version === criteria.prompt_version &&
                      row.validation_status === criteria.validation_status,
                  ),
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
        promptVersion: "p9_v2",
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
        promptVersion: "p9_v2",
      },
    );

    expect(result).toBeNull();
  });

  it("ignores old mistral-small-latest cache rows when current model is Ministral 3 3B", async () => {
    const result = await getValidJobExtractionShadowByHash._handler(
      buildCacheCtx([validRow]) as any,
      {
        jobTextHash: "hash_1",
        model: "ministral-3b-2512",
        promptVersion: "p9_v2",
      },
    );

    expect(result).toBeNull();
  });

  it("cache-hits Ministral 3 3B rows under the current prompt version", async () => {
    const result = await getValidJobExtractionShadowByHash._handler(
      buildCacheCtx([ministralRow]) as any,
      {
        jobTextHash: "hash_1",
        model: "ministral-3b-2512",
        promptVersion: "p9_v2",
      },
    );

    expect(result).toEqual(
      expect.objectContaining({
        model: "ministral-3b-2512",
        prompt_version: "p9_v2",
      }),
    );
  });

  it("ignores old p9_v1 rows under the current prompt version", async () => {
    const result = await getValidJobExtractionShadowByHash._handler(
      buildCacheCtx([{ ...validRow, prompt_version: "p9_v1" }]) as any,
      {
        jobTextHash: "hash_1",
        model: "mistral-small-latest",
        promptVersion: "p9_v2",
      },
    );

    expect(result).toBeNull();
  });

  it("does not reuse valid fallback rows as cache hits", async () => {
    const result = await getValidJobExtractionShadowByHash._handler(
      buildCacheCtx([{ ...validRow, fallback_used: true }]) as any,
      {
        jobTextHash: "hash_1",
        model: "mistral-small-latest",
        promptVersion: "p9_v2",
      },
    );

    expect(result).toBeNull();
  });

  it("chooses the newest non-fallback cache row deterministically", async () => {
    const result = await getValidJobExtractionShadowByHash._handler(
      buildCacheCtx([
        {
          ...validRow,
          _creationTime: 300,
          llm_raw_output: "{\"summary_short\":\"same-created-at-newer-creation\"}",
          llm_normalized_output: { summary_short: "same-created-at-newer-creation" },
          created_at: 300,
        },
        {
          ...validRow,
          _creationTime: 500,
          llm_raw_output: "{\"summary_short\":\"newest-tie-break\"}",
          llm_normalized_output: { summary_short: "newest-tie-break" },
          created_at: 300,
        },
        {
          ...validRow,
          _creationTime: 900,
          llm_raw_output: "{\"summary_short\":\"fallback-newer\"}",
          llm_normalized_output: { summary_short: "fallback-newer" },
          fallback_used: true,
          created_at: 400,
        },
        {
          ...validRow,
          _creationTime: 1000,
          llm_raw_output: "{\"summary_short\":\"old\"}",
          llm_normalized_output: { summary_short: "old" },
          created_at: 100,
        },
      ]) as any,
      {
        jobTextHash: "hash_1",
        model: "mistral-small-latest",
        promptVersion: "p9_v2",
      },
    );

    expect(result?.llm_normalized_output).toEqual({
      summary_short: "newest-tie-break",
    });
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
        promptVersion: "p9_v2",
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

  it("shadow writer persists the exact resolved Ministral 3 3B model", async () => {
    vi.stubEnv("JOB_LLM_EXTRACTION_SHADOW", "1");
    vi.stubEnv("JOB_EXTRACTION_MISTRAL_MODEL", "ministral-3b-2512");
    vi.stubEnv("MISTRAL_MODEL", "mistral-small-latest");
    vi.stubEnv("MISTRAL_API_KEY", "sk-test");
    const originalFetch = globalThis.fetch;
    const inserts: any[] = [];
    const job = {
      _id: "job_shadow" as any,
      title: "Security Guard",
      rawDescription: "Required: guard card and weekend availability.",
      sourceUrl: "https://example.com/security-guard",
      sourceDomain: "example.com",
      sourceType: "manual",
      applicationUrl: "",
      company: "",
      location: "",
    };
    const output = {
      summary_short: "Customer-facing security guard role",
      role_title_normalized: "Security Guard",
      requirements: [
        { value: "Guard card", type: "certification", required: true },
      ],
      keywords_canonical: ["security"],
      licenses_or_certifications: ["Guard card"],
      schedule_constraints: ["Weekend availability"],
      environment: {
        customer_facing: true,
        retail: true,
        physical_standing: true,
        onsite: true,
      },
      confidence: "high",
    };

    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: JSON.stringify(output) } }],
      }),
    })) as unknown as typeof fetch;

    try {
      let queryCount = 0;
      await runShadowJobExtraction._handler(
        {
          runQuery: async () => {
            queryCount += 1;
            return queryCount === 1 ? job : null;
          },
          runMutation: async (_functionReference: unknown, args: any) => {
            await storeJobExtractionShadow._handler(
              {
                db: {
                  insert: async (table: string, value: unknown) => {
                    expect(table).toBe("job_extraction_shadow");
                    inserts.push(value);
                  },
                },
              } as any,
              args,
            );
          },
        } as any,
        { jobId: "job_shadow" as any },
      );
    } finally {
      globalThis.fetch = originalFetch;
    }

    expect(inserts[0]).toEqual(
      expect.objectContaining({
        model: "ministral-3b-2512",
        prompt_version: "p9_v2",
        validation_status: "valid",
        fallback_used: false,
      }),
    );
  });
});
