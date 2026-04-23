import { internalAction, internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { llmConfig } from "../config/llmConfig";

import {
  type CanonicalUserProfile,
  ensureCanonicalProfileForClerk,
  getPrimaryProfileForClerk,
  listProfilesForClerk,
} from "./lib/userProfiles";
import {
  buildCanonicalJobDraftFromSource,
  flattenExtractionValues,
  type CanonicalJobExtraction,
  resolveReparsedLocation,
  resolveCanonicalJobReviewState,
  resolveReviewItemsAfterApprove,
  resolveReviewItemsAfterFieldUpdate,
} from "./lib/jobs/canonicalJobs";
import {
  buildMatchReadTelemetryArgs,
  buildMatchReadSynthesisCacheKey,
  computeMatchRead,
  type MatchRead,
  type MatchReadTier,
} from "./lib/jobs/matchRead";
import { buildJobsMetricArgs } from "./lib/jobs/telemetry";
import {
  buildMatchReadSynthesisMetricMetadata,
  createPendingMatchReadSynthesisCache,
  isMatchReadSynthesisEnabled,
  synthesizeMatchReadWithMistral,
  type MatchReadSynthesisCache,
} from "./lib/jobs/matchReadSynthesis";

const COHORT_MIN_TOTAL_DECISIONS = 500;
const COHORT_MIN_TIER_DECISIONS = 10;
const NEXT_STEP_FALLBACK_ACTION_ORDER = [
  "cover_letter",
  "resume",
  "save_for_later",
] as const;

function buildSampleJobDraft(now: number) {
  const rawDescription = [
    "TwoWeeks sample role: Content Operations Coordinator.",
    "Own the weekly publishing calendar for proposal and resume assets across the workspace.",
    "Coordinate with design, writing, and operations partners to keep deliverables on track.",
    "Required: strong project coordination, clear written communication, and comfort working in Notion and Google Workspace.",
    "Experience with content operations, editorial planning, or workflow management is preferred.",
    "This sample is pre-parsed so first-time users can review a complete job brief immediately.",
  ].join(" ");

  return {
    createdAt: now,
    updatedAt: now,
    importedAt: now,
    lastOpenedAt: now,
    sourceUrl: "https://twoweeks.app/sample-job",
    sourceDomain: "twoweeks.app",
    sourceType: "sample",
    applicationUrl: "",
    dedupeKey: "sample:content-operations-coordinator",
    parseVersion: "sample-v1",
    parseStatus: "parsed" as const,
    reviewState: "ready" as const,
    title: "Content Operations Coordinator",
    company: "TwoWeeks Studio",
    location: "Remote",
    rawDescription,
    rawLanguageDetected: "en",
    summary:
      "Own the publishing calendar and coordinate cross-functional document delivery across the workspace.",
    summaryExtraction: {
      value:
        "Own the publishing calendar and coordinate cross-functional document delivery across the workspace.",
      confidence: 0.96,
      sourceSpan: { start: 41, end: 123 },
    },
    responsibilities: [
      "Own the weekly publishing calendar for proposal and resume assets across the workspace",
      "Coordinate with design, writing, and operations partners to keep deliverables on track",
      "Keep document production moving across cross-functional stakeholders",
    ],
    responsibilitiesExtraction: [
      {
        value:
          "Own the weekly publishing calendar for proposal and resume assets across the workspace",
        confidence: 0.94,
        sourceSpan: { start: 41, end: 123 },
      },
      {
        value:
          "Coordinate with design, writing, and operations partners to keep deliverables on track",
        confidence: 0.93,
        sourceSpan: { start: 125, end: 211 },
      },
      {
        value:
          "Keep document production moving across cross-functional stakeholders",
        confidence: 0.9,
        sourceSpan: null,
      },
    ],
    keywords: [
      "content operations",
      "editorial planning",
      "project coordination",
      "notion",
      "google workspace",
    ],
    keywordsExtraction: [
      {
        value: "content operations",
        confidence: 0.94,
        sourceSpan: { start: 286, end: 304 },
      },
      {
        value: "editorial planning",
        confidence: 0.9,
        sourceSpan: { start: 308, end: 326 },
      },
      {
        value: "project coordination",
        confidence: 0.95,
        sourceSpan: { start: 223, end: 243 },
      },
      {
        value: "notion",
        confidence: 0.9,
        sourceSpan: { start: 301, end: 307 },
      },
      {
        value: "google workspace",
        confidence: 0.9,
        sourceSpan: { start: 312, end: 328 },
      },
    ],
    mustHaves: [
      "Strong project coordination",
      "Clear written communication",
      "Comfort working in Notion and Google Workspace",
    ],
    mustHavesExtraction: [
      {
        value: "Strong project coordination",
        confidence: 0.95,
        sourceSpan: { start: 223, end: 250 },
      },
      {
        value: "Clear written communication",
        confidence: 0.95,
        sourceSpan: { start: 252, end: 279 },
      },
      {
        value: "Comfort working in Notion and Google Workspace",
        confidence: 0.95,
        sourceSpan: { start: 285, end: 330 },
      },
    ],
    toneCues: ["clear", "structured", "collaborative"],
    toneCuesExtraction: [
      {
        value: "clear",
        confidence: 0.88,
        sourceSpan: { start: 252, end: 257 },
      },
      {
        value: "structured",
        confidence: 0.86,
        sourceSpan: null,
      },
      {
        value: "collaborative",
        confidence: 0.86,
        sourceSpan: { start: 125, end: 136 },
      },
    ],
    contacts: [],
    isSample: true,
    status: "active",
    archivedAt: null,
    reviewItems: [],
  };
}

async function listJobsForProfileId(ctx: any, profileId: string) {
  return ctx.db
    .query("jobs")
    .withIndex("by_user_updated", (q: any) => q.eq("userId", profileId))
    .order("desc")
    .collect();
}

async function archiveActiveSampleJobsForProfile(ctx: any, profileId: string) {
  const jobs = await listJobsForProfileId(ctx, profileId);
  const activeSampleJobs = jobs.filter(
    (job: any) =>
      Boolean(job.isSample) &&
      (job.archivedAt === null || job.archivedAt === undefined),
  );

  if (activeSampleJobs.length === 0) {
    return;
  }

  const now = Date.now();
  await Promise.all(
    activeSampleJobs.map((job: any) =>
      ctx.db.patch(job._id, {
        archivedAt: now,
        updatedAt: now,
      }),
    ),
  );
}

async function scheduleFirstRunPathMetric(
  ctx: any,
  path: "import" | "sample" | "bounce",
) {
  await ctx.scheduler.runAfter(
    0,
    internal.metrics.recordMetric,
    buildJobsMetricArgs({
      event: "first_run_path",
      path,
    }),
  );
}

async function scheduleMatchReadComputedMetric(ctx: any, matchRead: MatchRead) {
  await ctx.scheduler.runAfter(
    0,
    internal.metrics.recordMetric,
    buildMatchReadTelemetryArgs(matchRead),
  );
}

async function scheduleMatchReadSynthesisWarm(args: {
  ctx: any;
  job: any;
  profile: any;
}) {
  if (!isMatchReadSynthesisEnabled()) {
    return;
  }

  const keywordMatchRead = computeMatchRead({
    job: {
      id: String(args.job._id),
      updatedAt: args.job.updatedAt,
      parseVersion: args.job.parseVersion,
      parseStatus: args.job.parseStatus,
      mustHaves: args.job.mustHaves ?? [],
      keywords: args.job.keywords ?? [],
      mustHavesExtraction: args.job.mustHavesExtraction ?? [],
      keywordsExtraction: args.job.keywordsExtraction ?? [],
    },
    profile: args.profile
      ? {
          id: String(args.profile._id ?? args.profile.id ?? ""),
          version: args.profile.version,
          skills: args.profile.skills ?? [],
          keywords: args.profile.keywords ?? [],
        }
      : null,
  });

  if (keywordMatchRead.fallback !== "none") {
    return;
  }

  const cacheKey = buildMatchReadSynthesisCacheKey({
    job: {
      id: String(args.job._id),
      updatedAt: args.job.updatedAt,
      parseVersion: args.job.parseVersion,
    },
    profile: args.profile
      ? {
          id: String(args.profile._id ?? args.profile.id ?? ""),
          version: args.profile.version,
        }
      : null,
    matchRead: keywordMatchRead,
  });

  const currentCache = args.job.matchReadSynthesis as MatchReadSynthesisCache | undefined;
  if (
    currentCache?.cacheKey === cacheKey &&
    (currentCache.status === "pending" || currentCache.status === "ready")
  ) {
    return;
  }

  await args.ctx.db.patch(args.job._id, {
    matchReadSynthesis: createPendingMatchReadSynthesisCache(cacheKey),
  });

  await args.ctx.scheduler.runAfter(
    0,
    (internal as any).jobsPublic.runMatchReadSynthesis,
    {
      jobId: args.job._id,
      cacheKey,
      title: args.job.title,
      company: args.job.company,
      tier: keywordMatchRead.tier,
      confidence: keywordMatchRead.confidence,
      matched: keywordMatchRead.matched,
      missing: keywordMatchRead.missing,
    },
  );
}

function normalizeDecisionOutcome(
  value: string | undefined,
): "cover_letter" | "resume" | "save_for_later" | null {
  if (value === "cover_letter" || value === "resume" || value === "save_for_later") {
    return value;
  }
  if (value === "bounce") {
    return "save_for_later";
  }
  return null;
}

function buildNextStepHeadline(
  tier: MatchReadTier,
  outcome: "cover_letter" | "resume" | "save_for_later",
): string {
  const tierLabel = tier === "unknown" ? "unknown" : tier;

  if (outcome === "resume") {
    return `Most users with a ${tierLabel} match opened the resume with this job.`;
  }
  if (outcome === "save_for_later") {
    return `Most users with a ${tierLabel} match saved the job for later.`;
  }
  return `Most users with a ${tierLabel} match generated a cover letter first.`;
}

async function resolveNextStepBlock(ctx: any, tier: MatchReadTier) {
  const metrics = await ctx.db
    .query("metrics")
    .withIndex("by_name_time", (q: any) => q.eq("name", "jobs-v2:job_decision_made"))
    .collect();

  const normalizedOutcomes = metrics
    .map((metric: any) => ({
      tier: String(metric?.labels?.tier ?? ""),
      outcome: normalizeDecisionOutcome(String(metric?.labels?.outcome ?? "")),
    }))
    .filter((entry) => entry.outcome !== null);

  const hasEnoughTotalData = normalizedOutcomes.length >= COHORT_MIN_TOTAL_DECISIONS;
  const tierMetrics = normalizedOutcomes.filter((entry) => entry.tier === tier);
  const hasEnoughTierData = tierMetrics.length >= COHORT_MIN_TIER_DECISIONS;
  const actionOrder = [...NEXT_STEP_FALLBACK_ACTION_ORDER];

  if (!hasEnoughTotalData || !hasEnoughTierData) {
    return {
      headline: "Common next steps",
      usesCohortData: false,
      actions: actionOrder,
    };
  }

  const counts = new Map<string, number>();
  for (const entry of tierMetrics) {
    counts.set(entry.outcome!, (counts.get(entry.outcome!) ?? 0) + 1);
  }

  const orderedActions = [...actionOrder].sort((left, right) => {
    const countDiff = (counts.get(right) ?? 0) - (counts.get(left) ?? 0);
    if (countDiff !== 0) {
      return countDiff;
    }
    return actionOrder.indexOf(left) - actionOrder.indexOf(right);
  });

  return {
    headline: buildNextStepHeadline(tier, orderedActions[0]),
    usesCohortData: true,
    actions: orderedActions,
  };
}

function getLegacyFieldConfidence(
  job: any,
  fieldKey: string,
  fallbackConfidence: number,
) {
  const reviewItem = (job.reviewItems ?? []).find(
    (item: any) => item.fieldKey === fieldKey,
  );

  if (typeof reviewItem?.confidence === "number") {
    return reviewItem.confidence;
  }

  return fallbackConfidence;
}

function buildExtractionProjection(args: {
  job: any;
  fieldKey: string;
  extractionKey: string;
  fallbackValues: string[];
  fallbackConfidence: number;
}): CanonicalJobExtraction[] {
  const structuredValues = args.job[args.extractionKey];
  if (Array.isArray(structuredValues) && structuredValues.length > 0) {
    return structuredValues.map((item: any) => ({
      value: String(item?.value ?? "").trim(),
      confidence: Number(item?.confidence ?? args.fallbackConfidence),
      sourceSpan:
        item?.sourceSpan &&
        typeof item.sourceSpan.start === "number" &&
        typeof item.sourceSpan.end === "number"
          ? {
              start: item.sourceSpan.start,
              end: item.sourceSpan.end,
            }
          : null,
    }));
  }

  const confidence = getLegacyFieldConfidence(
    args.job,
    args.fieldKey,
    args.fallbackConfidence,
  );

  return args.fallbackValues.map((value) => ({
    value,
    confidence,
    sourceSpan: null,
  }));
}

function buildJobProjection(
  job: any,
  matchRead: ReturnType<typeof computeMatchRead> | null = null,
  nextStepBlock: {
    headline: string;
    usesCohortData: boolean;
    actions: readonly ("cover_letter" | "resume" | "save_for_later")[];
  } | null = null,
  linkedProposalCount = 0,
  linkedProposals: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: number;
  }> = [],
) {
  const responsibilitiesExtraction = buildExtractionProjection({
    job,
    fieldKey: "responsibilities",
    extractionKey: "responsibilitiesExtraction",
    fallbackValues: job.responsibilities ?? [],
    fallbackConfidence: 0.52,
  });
  const keywordsExtraction = buildExtractionProjection({
    job,
    fieldKey: "keywords",
    extractionKey: "keywordsExtraction",
    fallbackValues: job.keywords ?? [],
    fallbackConfidence: 0.42,
  });
  const mustHavesExtraction = buildExtractionProjection({
    job,
    fieldKey: "mustHaves",
    extractionKey: "mustHavesExtraction",
    fallbackValues: job.mustHaves ?? [],
    fallbackConfidence: 0.48,
  });
  const toneCuesExtraction = buildExtractionProjection({
    job,
    fieldKey: "toneCues",
    extractionKey: "toneCuesExtraction",
    fallbackValues: job.toneCues ?? [],
    fallbackConfidence: 0.46,
  });
  const summaryExtraction =
    job.summaryExtraction && typeof job.summaryExtraction.value === "string"
      ? {
          value: job.summaryExtraction.value,
          confidence: Number(job.summaryExtraction.confidence ?? 0.35),
          sourceSpan:
            job.summaryExtraction.sourceSpan &&
            typeof job.summaryExtraction.sourceSpan.start === "number" &&
            typeof job.summaryExtraction.sourceSpan.end === "number"
              ? {
                  start: job.summaryExtraction.sourceSpan.start,
                  end: job.summaryExtraction.sourceSpan.end,
                }
              : null,
        }
      : {
          value: String(job.summary ?? ""),
          confidence: 0.35,
          sourceSpan: null,
        };

  return {
    id: String(job._id),
    title: job.title,
    company: job.company,
    location: job.location,
    isSample: Boolean(job.isSample),
    sourceUrl: job.sourceUrl,
    sourceDomain: job.sourceDomain,
    sourceType: job.sourceType,
    applicationUrl: job.applicationUrl,
    parseStatus: job.parseStatus,
    reviewState: job.reviewState,
    summary: summaryExtraction.value,
    summaryExtraction,
    rawDescription: job.rawDescription,
    responsibilities: flattenExtractionValues(responsibilitiesExtraction),
    responsibilitiesExtraction,
    keywords: flattenExtractionValues(keywordsExtraction),
    keywordsExtraction,
    mustHaves: flattenExtractionValues(mustHavesExtraction),
    mustHavesExtraction,
    toneCues: flattenExtractionValues(toneCuesExtraction),
    toneCuesExtraction,
    contacts: job.contacts ?? [],
    isSample: Boolean(job.isSample),
    status: job.status,
    matchRead,
    nextStepBlock,
    linkedProposalCount,
    linkedProposals,
    reviewItems: (job.reviewItems ?? []).map((item: any) => ({
      id: item.id,
      fieldKey: item.fieldKey,
      label: item.label,
      reviewStatus: item.reviewStatus,
      suggestedValue: item.suggestedValue,
      approvedValue: item.approvedValue ?? undefined,
      sourceText: item.sourceText,
      confidence: item.confidence,
      updatedAt: item.updatedAt,
    })),
  };
}

async function requireCanonicalUserProfile(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const profile = await ensureCanonicalProfileForClerk({
    ctx,
    clerkId: identity.subject,
    fallbackEmail: identity.email,
    fallbackName: identity.name,
  });

  return {
    _id: profile.id,
    clerkId: profile.clerkId,
    email: profile.email,
    name: profile.name,
    version: profile.version,
    skills: profile.skills,
    keywords: profile.keywords,
  };
}

async function listProjectedJobsForProfile(ctx: any, profile: {
  _id?: string | CanonicalUserProfile["id"];
  id?: string | CanonicalUserProfile["id"];
  skills?: string[];
  keywords?: string[];
}, options?: { trackMatchRead?: boolean }) {
  const profileId = String(profile._id ?? profile.id ?? "");
  const jobs = await listJobsForProfileId(ctx, profileId);

  const proposals = await ctx.db
    .query("proposals")
    .withIndex("by_user", (q: any) => q.eq("userId", profileId))
    .collect();

  const linkedProposalStats = new Map<
    string,
    { count: number; latestUpdatedAt: number }
  >();

  for (const proposal of proposals) {
    const jobId = typeof proposal.jobId === "string" ? proposal.jobId : "";
    if (!jobId) {
      continue;
    }

    const current = linkedProposalStats.get(jobId) ?? {
      count: 0,
      latestUpdatedAt: 0,
    };

    linkedProposalStats.set(jobId, {
      count: current.count + 1,
      latestUpdatedAt: Math.max(
        current.latestUpdatedAt,
        proposal.updatedAt ?? proposal.createdAt ?? 0,
      ),
    });
  }

  const visibleJobs = jobs.filter(
    (job: any) => job.archivedAt === null || job.archivedAt === undefined,
  );

  const projections = visibleJobs.map((job: any) => {
      const stats = linkedProposalStats.get(String(job._id));
      const lastActivityAt = Math.max(
        job.updatedAt ?? 0,
        job.lastOpenedAt ?? 0,
        stats?.latestUpdatedAt ?? 0,
      );
      const matchRead = computeMatchRead({
        job: {
          id: String(job._id),
          parseStatus: job.parseStatus,
          mustHaves: job.mustHaves ?? [],
          keywords: job.keywords ?? [],
          mustHavesExtraction: job.mustHavesExtraction ?? [],
          keywordsExtraction: job.keywordsExtraction ?? [],
        },
        profile: {
          id: profileId,
          skills: profile.skills ?? [],
          keywords: profile.keywords ?? [],
        },
      });

      return {
        id: String(job._id),
        title: job.title,
        company: job.company,
        location: job.location,
        isSample: Boolean(job.isSample),
        sourceUrl: job.sourceUrl,
        sourceDomain: job.sourceDomain,
        sourceType: job.sourceType,
        parseStatus: job.parseStatus,
        reviewState: job.reviewState,
        matchTier: matchRead.tier,
        status: job.status,
        importedAt: job.importedAt,
        updatedAt: job.updatedAt,
        lastOpenedAt: job.lastOpenedAt,
        lastActivityAt,
        linkedDocumentCount: stats?.count ?? 0,
      };
    });

  if (options?.trackMatchRead) {
    await Promise.all(
      visibleJobs.map((job: any) => {
        const matchRead = computeMatchRead({
          job: {
            id: String(job._id),
            parseStatus: job.parseStatus,
            mustHaves: job.mustHaves ?? [],
            keywords: job.keywords ?? [],
            mustHavesExtraction: job.mustHavesExtraction ?? [],
            keywordsExtraction: job.keywordsExtraction ?? [],
          },
          profile: {
            id: profileId,
            skills: profile.skills ?? [],
            keywords: profile.keywords ?? [],
          },
        });
        return scheduleMatchReadComputedMetric(ctx, matchRead);
      }),
    );
  }

  return projections;
}

export const createOrReuseFromSource = mutation({
  args: {
    title: v.string(),
    rawDescription: v.string(),
    sourceUrl: v.optional(v.string()),
    sourceDomain: v.optional(v.string()),
    sourceType: v.optional(v.string()),
    applicationUrl: v.optional(v.string()),
  },
  returns: v.object({
    jobId: v.string(),
    dedupeHit: v.boolean(),
    parseStatus: v.string(),
    reviewState: v.string(),
  }),
  handler: async (ctx, args) => {
    const profile = await requireCanonicalUserProfile(ctx);
    const draft = buildCanonicalJobDraftFromSource(args);

    await archiveActiveSampleJobsForProfile(ctx, String(profile._id));

    const existing = await ctx.db
      .query("jobs")
      .withIndex("by_user_dedupe", (q) =>
        q.eq("userId", profile._id).eq("dedupeKey", draft.dedupeKey),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        lastOpenedAt: Date.now(),
        updatedAt: Date.now(),
      });
      return {
        jobId: String(existing._id),
        dedupeHit: true,
        parseStatus: existing.parseStatus,
        reviewState: existing.reviewState,
      };
    }

    const jobId = await ctx.db.insert("jobs", {
      userId: profile._id,
      createdAt: draft.createdAt,
      updatedAt: draft.updatedAt,
      importedAt: draft.importedAt,
      lastOpenedAt: draft.lastOpenedAt,
      sourceUrl: draft.sourceUrl,
      sourceDomain: draft.sourceDomain,
      sourceType: draft.sourceType,
      applicationUrl: draft.applicationUrl,
      dedupeKey: draft.dedupeKey,
      parseVersion: draft.parseVersion,
      parseStatus: "parsing",
      reviewState: "pending",
      title: draft.title,
      company: "",
      location: "",
      rawDescription: draft.rawDescription,
      rawLanguageDetected: draft.rawLanguageDetected,
      summary: "",
      responsibilities: [],
      keywords: [],
      mustHaves: [],
      toneCues: [],
      contacts: [],
      isSample: false,
      status: draft.status,
      archivedAt: draft.archivedAt,
      reviewItems: [],
    });

    await ctx.scheduler.runAfter(
      0,
      (internal as any).jobsPublic.parseCreatedJob,
      { jobId: String(jobId) },
    );

    return {
      jobId: String(jobId),
      dedupeHit: false,
      parseStatus: "parsing",
      reviewState: "pending",
    };
  },
});

export const getById = query({
  args: {
    jobId: v.string(),
  },
  returns: v.union(
    v.null(),
    v.object({
      id: v.string(),
      title: v.string(),
      company: v.string(),
      location: v.string(),
      isSample: v.boolean(),
      sourceUrl: v.string(),
      sourceDomain: v.string(),
      sourceType: v.string(),
      applicationUrl: v.string(),
      parseStatus: v.string(),
      reviewState: v.string(),
      summary: v.string(),
      summaryExtraction: v.object({
        value: v.string(),
        confidence: v.number(),
        sourceSpan: v.union(
          v.object({
            start: v.number(),
            end: v.number(),
          }),
          v.null(),
        ),
      }),
      rawDescription: v.string(),
      responsibilities: v.array(v.string()),
      responsibilitiesExtraction: v.array(
        v.object({
          value: v.string(),
          confidence: v.number(),
          sourceSpan: v.union(
            v.object({
              start: v.number(),
              end: v.number(),
            }),
            v.null(),
          ),
        }),
      ),
      keywords: v.array(v.string()),
      keywordsExtraction: v.array(
        v.object({
          value: v.string(),
          confidence: v.number(),
          sourceSpan: v.union(
            v.object({
              start: v.number(),
              end: v.number(),
            }),
            v.null(),
          ),
        }),
      ),
      mustHaves: v.array(v.string()),
      mustHavesExtraction: v.array(
        v.object({
          value: v.string(),
          confidence: v.number(),
          sourceSpan: v.union(
            v.object({
              start: v.number(),
              end: v.number(),
            }),
            v.null(),
          ),
        }),
      ),
      toneCues: v.array(v.string()),
      toneCuesExtraction: v.array(
        v.object({
          value: v.string(),
          confidence: v.number(),
          sourceSpan: v.union(
            v.object({
              start: v.number(),
              end: v.number(),
            }),
            v.null(),
          ),
        }),
      ),
      contacts: v.array(v.string()),
      status: v.string(),
      matchRead: v.union(
        v.null(),
        v.object({
          tier: v.string(),
          score: v.union(v.number(), v.null()),
          scoreVisible: v.boolean(),
          confidence: v.string(),
          matched: v.array(v.string()),
          missing: v.array(v.string()),
          basedOn: v.object({
            profileId: v.string(),
            profileLabel: v.string(),
            jobId: v.string(),
          }),
          computedAt: v.number(),
          method: v.string(),
          fallback: v.string(),
        }),
      ),
      nextStepBlock: v.union(
        v.null(),
        v.object({
          headline: v.string(),
          usesCohortData: v.boolean(),
          actions: v.array(
            v.union(
              v.literal("cover_letter"),
              v.literal("resume"),
              v.literal("save_for_later"),
            ),
          ),
        }),
      ),
      linkedProposalCount: v.number(),
      linkedProposals: v.array(
        v.object({
          id: v.string(),
          title: v.string(),
          status: v.string(),
          updatedAt: v.number(),
        }),
      ),
      reviewItems: v.array(
        v.object({
          id: v.string(),
          fieldKey: v.string(),
          label: v.string(),
          reviewStatus: v.string(),
          suggestedValue: v.any(),
          approvedValue: v.optional(v.any()),
          sourceText: v.string(),
          confidence: v.number(),
          updatedAt: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, args) => {
    const profiles = await listProfilesForClerk(
      ctx,
      (await ctx.auth.getUserIdentity())?.subject ?? "",
    );
    if (profiles.length === 0) {
      return null;
    }

    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      return null;
    }

    const job = await ctx.db.get(normalizedJobId);
    if (
      !job ||
      !profiles.some((profile) => String(profile._id) === String(job.userId)) ||
      (job.archivedAt !== null && job.archivedAt !== undefined)
    ) {
      return null;
    }

    const linkedProposals = await ctx.db
      .query("proposals")
      .withIndex("by_job", (q) => q.eq("jobId", String(job._id)))
      .collect();

    const projectedLinkedProposals = linkedProposals
      .map((proposal) => ({
        id: String(proposal._id),
        title: proposal.title ?? "Untitled proposal",
        status: proposal.status ?? "draft",
        updatedAt: proposal.updatedAt ?? 0,
      }))
      .sort((left, right) => right.updatedAt - left.updatedAt);

    const profile = await ctx.db.get(job.userId);
    const matchRead = computeMatchRead({
      job: {
        id: String(job._id),
        updatedAt: job.updatedAt,
        parseVersion: job.parseVersion,
        parseStatus: job.parseStatus,
        mustHaves: job.mustHaves ?? [],
        keywords: job.keywords ?? [],
        mustHavesExtraction: job.mustHavesExtraction ?? [],
        keywordsExtraction: job.keywordsExtraction ?? [],
      },
      profile: profile
        ? {
            id: String(profile._id),
            version: profile.version,
            skills: profile.skills ?? [],
            keywords: profile.keywords ?? [],
          }
        : null,
      synthesis: job.matchReadSynthesis ?? null,
    });
    const nextStepBlock = await resolveNextStepBlock(ctx, matchRead.tier);

    return buildJobProjection(
      job,
      matchRead,
      nextStepBlock,
      linkedProposals.length,
      projectedLinkedProposals,
    );
  },
});

export const listForUser = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      company: v.string(),
      location: v.string(),
      isSample: v.boolean(),
      sourceUrl: v.string(),
      sourceDomain: v.string(),
      sourceType: v.string(),
      parseStatus: v.string(),
      reviewState: v.string(),
      matchTier: v.union(
        v.literal("strong"),
        v.literal("partial"),
        v.literal("weak"),
        v.literal("unknown"),
      ),
      status: v.string(),
      importedAt: v.number(),
      updatedAt: v.number(),
      lastOpenedAt: v.number(),
      lastActivityAt: v.number(),
      linkedDocumentCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const profile = await getPrimaryProfileForClerk(ctx, identity.subject);
    if (!profile) {
      return [];
    }

    return listProjectedJobsForProfile(ctx, profile);
  },
});

export const loadForUser = mutation({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      company: v.string(),
      location: v.string(),
      isSample: v.boolean(),
      sourceUrl: v.string(),
      sourceDomain: v.string(),
      sourceType: v.string(),
      parseStatus: v.string(),
      reviewState: v.string(),
      matchTier: v.union(
        v.literal("strong"),
        v.literal("partial"),
        v.literal("weak"),
        v.literal("unknown"),
      ),
      status: v.string(),
      importedAt: v.number(),
      updatedAt: v.number(),
      lastOpenedAt: v.number(),
      lastActivityAt: v.number(),
      linkedDocumentCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const profile = await requireCanonicalUserProfile(ctx);
    return listProjectedJobsForProfile(ctx, profile, { trackMatchRead: true });
  },
});

export const storeMatchReadSynthesis = internalMutation({
  args: {
    jobId: v.id("jobs"),
    cacheKey: v.string(),
    status: v.union(v.literal("ready"), v.literal("error")),
    provider: v.string(),
    model: v.string(),
    matched: v.optional(v.array(v.string())),
    missing: v.optional(v.array(v.string())),
    computedAt: v.optional(v.number()),
    promptTokens: v.optional(v.number()),
    completionTokens: v.optional(v.number()),
    estimatedCostUsd: v.optional(v.number()),
    error: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job || job.matchReadSynthesis?.cacheKey !== args.cacheKey) {
      return null;
    }

    await ctx.db.patch(args.jobId, {
      matchReadSynthesis: {
        cacheKey: args.cacheKey,
        status: args.status,
        provider: args.provider,
        model: args.model,
        ...(args.matched ? { matched: args.matched } : {}),
        ...(args.missing ? { missing: args.missing } : {}),
        ...(args.computedAt ? { computedAt: args.computedAt } : {}),
        ...(args.promptTokens !== undefined ? { promptTokens: args.promptTokens } : {}),
        ...(args.completionTokens !== undefined
          ? { completionTokens: args.completionTokens }
          : {}),
        ...(args.estimatedCostUsd !== undefined
          ? { estimatedCostUsd: args.estimatedCostUsd }
          : {}),
        ...(args.error ? { error: args.error } : {}),
      },
    });

    return null;
  },
});

export const runMatchReadSynthesis = internalAction({
  args: {
    jobId: v.id("jobs"),
    cacheKey: v.string(),
    title: v.string(),
    company: v.string(),
    tier: v.union(
      v.literal("strong"),
      v.literal("partial"),
      v.literal("weak"),
      v.literal("unknown"),
    ),
    confidence: v.union(
      v.literal("high"),
      v.literal("medium"),
      v.literal("low"),
    ),
    matched: v.array(v.string()),
    missing: v.array(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      const synthesis = await synthesizeMatchReadWithMistral({
        jobId: String(args.jobId),
        title: args.title,
        company: args.company,
        tier: args.tier,
        confidence: args.confidence,
        matched: args.matched,
        missing: args.missing,
      });

      if (synthesis.status === "error") {
        await ctx.runMutation((internal as any).jobsPublic.storeMatchReadSynthesis, {
          jobId: args.jobId,
          cacheKey: args.cacheKey,
          status: "error",
          provider: synthesis.provider,
          model: synthesis.model,
          error: synthesis.error,
        });
        return null;
      }

      await ctx.runMutation((internal as any).jobsPublic.storeMatchReadSynthesis, {
        jobId: args.jobId,
        cacheKey: args.cacheKey,
        status: "ready",
        provider: synthesis.provider,
        model: synthesis.model,
        matched: synthesis.matched,
        missing: synthesis.missing,
        computedAt: synthesis.computedAt,
        promptTokens: synthesis.promptTokens,
        completionTokens: synthesis.completionTokens,
        estimatedCostUsd: synthesis.estimatedCostUsd,
      });

      await ctx.runMutation(
        internal.metrics.recordMetric,
        buildJobsMetricArgs({
          event: "match_read_computed",
          jobId: String(args.jobId),
          tier: args.tier,
          confidence: args.confidence,
          method: "llm",
          fallback: "none",
          ...buildMatchReadSynthesisMetricMetadata(synthesis),
        }),
      );
    } catch (error) {
      const model =
        llmConfig.mistralModel ??
        llmConfig.model ??
        process.env.MISTRAL_MODEL ??
        "mistral-small-latest";

      await ctx.runMutation((internal as any).jobsPublic.storeMatchReadSynthesis, {
        jobId: args.jobId,
        cacheKey: args.cacheKey,
        status: "error",
        provider: "mistral",
        model,
        error: error instanceof Error ? error.message : String(error ?? "unknown_error"),
      });
    }

    return null;
  },
});

export const recordFirstRunPath = mutation({
  args: {
    path: v.union(v.literal("import"), v.literal("sample"), v.literal("bounce")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await scheduleFirstRunPathMetric(ctx, args.path);
    return null;
  },
});

export const trackEvent = mutation({
  args: {
    event: v.union(
      v.literal("job_opened"),
      v.literal("job_decision_made"),
      v.literal("match_read_computed"),
      v.literal("field_corrected"),
      v.literal("first_run_path"),
      v.literal("import_accepted"),
      v.literal("import_rejected"),
    ),
    jobId: v.optional(v.string()),
    path: v.optional(v.union(v.literal("import"), v.literal("sample"), v.literal("bounce"))),
    outcome: v.optional(
      v.union(
        v.literal("cover_letter"),
        v.literal("resume"),
        v.literal("save_for_later"),
        v.literal("bounce"),
      ),
    ),
    timeToDecisionMs: v.optional(v.number()),
    fieldKey: v.optional(v.string()),
    beforeConfidence: v.optional(v.number()),
    hasMatchRead: v.optional(v.boolean()),
    reviewState: v.optional(v.string()),
    tier: v.optional(v.string()),
    confidence: v.optional(v.string()),
    method: v.optional(v.string()),
    fallback: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    await ctx.scheduler.runAfter(0, internal.metrics.recordMetric, buildJobsMetricArgs(args));
    return null;
  },
});

export const seedSampleJob = mutation({
  args: {},
  returns: v.object({
    jobId: v.string(),
  }),
  handler: async (ctx) => {
    const profile = await requireCanonicalUserProfile(ctx);
    const jobs = await listJobsForProfileId(ctx, String(profile._id));

    const activeSampleJob = jobs.find(
      (job: any) =>
        Boolean(job.isSample) &&
        (job.archivedAt === null || job.archivedAt === undefined),
    );

    if (activeSampleJob) {
      const now = Date.now();
      await ctx.db.patch(activeSampleJob._id, {
        lastOpenedAt: now,
        updatedAt: now,
      });
      await scheduleFirstRunPathMetric(ctx, "sample");
      return { jobId: String(activeSampleJob._id) };
    }

    const archivedSampleJob = jobs.find(
      (job: any) =>
        Boolean(job.isSample) &&
        job.archivedAt !== null &&
        job.archivedAt !== undefined,
    );

    if (archivedSampleJob) {
      const now = Date.now();
      await ctx.db.patch(archivedSampleJob._id, {
        archivedAt: null,
        lastOpenedAt: now,
        updatedAt: now,
      });
      await scheduleFirstRunPathMetric(ctx, "sample");
      return { jobId: String(archivedSampleJob._id) };
    }

    const now = Date.now();
    const sampleJob = buildSampleJobDraft(now);
    const jobId = await ctx.db.insert("jobs", {
      userId: profile._id,
      ...sampleJob,
    });
    await scheduleFirstRunPathMetric(ctx, "sample");
    return { jobId: String(jobId) };
  },
});

export const markOpened = mutation({
  args: {
    jobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireCanonicalUserProfile(ctx);
    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      throw new Error("Invalid jobId");
    }

    const job = await ctx.db.get(normalizedJobId);
    if (!job || String(job.userId) !== String(profile._id)) {
      throw new Error("Job not found");
    }

    const now = Date.now();
    await ctx.db.patch(normalizedJobId, {
      lastOpenedAt: now,
      updatedAt: now,
    });

    await scheduleMatchReadSynthesisWarm({
      ctx,
      job: {
        ...job,
        lastOpenedAt: now,
        updatedAt: now,
      },
      profile,
    });

    return null;
  },
});

export const updateField = mutation({
  args: {
    jobId: v.string(),
    fieldKey: v.string(),
    value: v.any(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireCanonicalUserProfile(ctx);
    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      throw new Error("Invalid jobId");
    }

    const job = await ctx.db.get(normalizedJobId);
    if (!job || String(job.userId) !== String(profile._id)) {
      throw new Error("Job not found");
    }

    const now = Date.now();
    const reviewItems = resolveReviewItemsAfterFieldUpdate({
      reviewItems: job.reviewItems ?? [],
      fieldKey: args.fieldKey,
      nextValue: args.value,
      now,
    });

    await ctx.db.patch(normalizedJobId, {
      [args.fieldKey]: args.value,
      reviewItems,
      reviewState: resolveCanonicalJobReviewState(reviewItems),
      updatedAt: now,
    });

    return null;
  },
});

export const approveReviewItem = mutation({
  args: {
    jobId: v.string(),
    reviewItemId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireCanonicalUserProfile(ctx);
    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      throw new Error("Invalid jobId");
    }

    const job = await ctx.db.get(normalizedJobId);
    if (!job || String(job.userId) !== String(profile._id)) {
      throw new Error("Job not found");
    }

    const now = Date.now();
    const reviewItems = resolveReviewItemsAfterApprove({
      reviewItems: job.reviewItems ?? [],
      reviewItemId: args.reviewItemId,
      now,
    });
    const approvedItem = reviewItems.find((item) => item.id === args.reviewItemId);

    await ctx.db.patch(normalizedJobId, {
      ...(approvedItem
        ? {
            [approvedItem.fieldKey]:
              approvedItem.approvedValue ?? approvedItem.suggestedValue,
          }
        : {}),
      reviewItems,
      reviewState: resolveCanonicalJobReviewState(reviewItems),
      updatedAt: now,
    });

    return null;
  },
});

export const parseCreatedJob = internalMutation({
  args: {
    jobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const normalizedJobId = ctx.db.normalizeId("jobs", args.jobId);
    if (!normalizedJobId) {
      return null;
    }

    const job = await ctx.db.get(normalizedJobId);
    if (!job) {
      return null;
    }

    try {
      const draft = buildCanonicalJobDraftFromSource({
        title: job.title,
        rawDescription: job.rawDescription,
        sourceUrl: job.sourceUrl,
        sourceDomain: job.sourceDomain,
        sourceType: job.sourceType,
        applicationUrl: job.applicationUrl,
      });

      await ctx.db.patch(normalizedJobId, {
        company: draft.company,
        location: resolveReparsedLocation({
          existingLocation: job.location,
          parsedLocation: draft.location,
        }),
        rawLanguageDetected: draft.rawLanguageDetected,
        summary: draft.summary,
        summaryExtraction: draft.summaryExtraction,
        responsibilities: draft.responsibilities,
        responsibilitiesExtraction: draft.responsibilitiesExtraction,
        keywords: draft.keywords,
        keywordsExtraction: draft.keywordsExtraction,
        mustHaves: draft.mustHaves,
        mustHavesExtraction: draft.mustHavesExtraction,
        toneCues: draft.toneCues,
        toneCuesExtraction: draft.toneCuesExtraction,
        contacts: draft.contacts,
        parseVersion: draft.parseVersion,
        parseStatus: "parsed",
        reviewState: draft.reviewState,
        reviewItems: draft.reviewItems,
        updatedAt: Date.now(),
      });
    } catch (error) {
      console.error("[jobsPublic.parseCreatedJob] parse failed", error);
      await ctx.db.patch(normalizedJobId, {
        parseStatus: "failed",
        reviewState: "pending",
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});
