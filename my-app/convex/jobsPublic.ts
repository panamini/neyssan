import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

import { getPrimaryProfileForClerk, listProfilesForClerk } from "./lib/userProfiles";
import {
  buildCanonicalJobDraftFromSource,
  resolveCanonicalJobReviewState,
  resolveReviewItemsAfterApprove,
  resolveReviewItemsAfterFieldUpdate,
} from "./lib/jobs/canonicalJobs";

function buildJobProjection(
  job: any,
  linkedProposalCount = 0,
  linkedProposals: Array<{
    id: string;
    title: string;
    status: string;
    updatedAt: number;
  }> = [],
) {
  return {
    id: String(job._id),
    title: job.title,
    company: job.company,
    location: job.location,
    sourceUrl: job.sourceUrl,
    sourceDomain: job.sourceDomain,
    sourceType: job.sourceType,
    applicationUrl: job.applicationUrl,
    parseStatus: job.parseStatus,
    reviewState: job.reviewState,
    summary: job.summary,
    rawDescription: job.rawDescription,
    responsibilities: job.responsibilities ?? [],
    keywords: job.keywords ?? [],
    mustHaves: job.mustHaves ?? [],
    toneCues: job.toneCues ?? [],
    contacts: job.contacts ?? [],
    status: job.status,
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

async function requireUserProfile(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) {
    throw new Error("Not authenticated");
  }

  const profile = await getPrimaryProfileForClerk(ctx, identity.subject);
  if (!profile) {
    throw new Error("User profile not found");
  }

  return profile;
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
    const profile = await requireUserProfile(ctx);
    const draft = buildCanonicalJobDraftFromSource(args);

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
      sourceUrl: v.string(),
      sourceDomain: v.string(),
      sourceType: v.string(),
      applicationUrl: v.string(),
      parseStatus: v.string(),
      reviewState: v.string(),
      summary: v.string(),
      rawDescription: v.string(),
      responsibilities: v.array(v.string()),
      keywords: v.array(v.string()),
      mustHaves: v.array(v.string()),
      toneCues: v.array(v.string()),
      contacts: v.array(v.string()),
      status: v.string(),
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
    if (!job || !profiles.some((profile) => String(profile._id) === String(job.userId))) {
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

    return buildJobProjection(job, linkedProposals.length, projectedLinkedProposals);
  },
});

export const listForUser = query({
  args: {},
  returns: v.array(
    v.object({
      id: v.string(),
      title: v.string(),
      company: v.string(),
      sourceUrl: v.string(),
      sourceDomain: v.string(),
      sourceType: v.string(),
      parseStatus: v.string(),
      reviewState: v.string(),
      status: v.string(),
      importedAt: v.number(),
      updatedAt: v.number(),
      lastOpenedAt: v.number(),
      lastActivityAt: v.number(),
      linkedDocumentCount: v.number(),
    }),
  ),
  handler: async (ctx) => {
    const profile = await requireUserProfile(ctx);

    const jobs = await ctx.db
      .query("jobs")
      .withIndex("by_user_updated", (q) => q.eq("userId", profile._id))
      .order("desc")
      .collect();

    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_user", (q) => q.eq("userId", profile._id))
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

    return jobs
      .filter((job) => job.archivedAt === null || job.archivedAt === undefined)
      .map((job) => {
        const stats = linkedProposalStats.get(String(job._id));
        const lastActivityAt = Math.max(
          job.updatedAt ?? 0,
          job.lastOpenedAt ?? 0,
          stats?.latestUpdatedAt ?? 0,
        );

        return {
          id: String(job._id),
          title: job.title,
          company: job.company,
          sourceUrl: job.sourceUrl,
          sourceDomain: job.sourceDomain,
          sourceType: job.sourceType,
          parseStatus: job.parseStatus,
          reviewState: job.reviewState,
          status: job.status,
          importedAt: job.importedAt,
          updatedAt: job.updatedAt,
          lastOpenedAt: job.lastOpenedAt,
          lastActivityAt,
          linkedDocumentCount: stats?.count ?? 0,
        };
      });
  },
});

export const markOpened = mutation({
  args: {
    jobId: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await requireUserProfile(ctx);
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
    const profile = await requireUserProfile(ctx);
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
    const profile = await requireUserProfile(ctx);
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
        location: draft.location,
        rawLanguageDetected: draft.rawLanguageDetected,
        summary: draft.summary,
        responsibilities: draft.responsibilities,
        keywords: draft.keywords,
        mustHaves: draft.mustHaves,
        toneCues: draft.toneCues,
        contacts: draft.contacts,
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
