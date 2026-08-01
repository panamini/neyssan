import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { upsertJobCatalogProjection } from "./lib/jobCatalog";
import { upsertProfileCatalogProjection } from "./lib/profileCatalog";

const MAX_SUMMARY_ROWS = 36;
const PROFILE_BACKFILL_PAGE_SIZE = 4;
const JOB_BACKFILL_PAGE_SIZE = 8;
const JOBS_TRAVERSAL_VERSION = 1 as const;

function boundedLimit(value: number | undefined): number {
  if (!Number.isFinite(value)) return MAX_SUMMARY_ROWS;
  return Math.max(1, Math.min(MAX_SUMMARY_ROWS, Math.floor(value!)));
}

const profileSummaryValidator = v.object({
  profileId: v.id("userProfiles"),
  profileIdString: v.string(),
  ownerClerkId: v.string(),
  externalProfileId: v.optional(v.string()),
  label: v.optional(v.string()),
  defaultResumeId: v.optional(v.union(v.string(), v.null())),
  defaultResumeName: v.optional(v.union(v.string(), v.null())),
  updatedAt: v.number(),
  profileCreatedAt: v.number(),
  version: v.literal(1),
});

const jobSummaryValidator = v.object({
  jobId: v.id("jobs"),
  profileId: v.id("userProfiles"),
  ownerClerkId: v.string(),
  title: v.string(),
  company: v.string(),
  location: v.string(),
  sourceLanguage: v.string(),
  sourceUrl: v.string(),
  sourceDomain: v.string(),
  sourceType: v.string(),
  parseStatus: v.string(),
  reviewState: v.string(),
  status: v.string(),
  isSample: v.boolean(),
  isFavorite: v.boolean(),
  archived: v.boolean(),
  importedAt: v.number(),
  updatedAt: v.number(),
  lastOpenedAt: v.number(),
  lastActivityAt: v.number(),
  version: v.literal(1),
});

function stripConvexSystemFields(row: Record<string, any>) {
  const { _id: _ignoredId, _creationTime: _ignoredCreationTime, ...summary } = row;
  return summary;
}

async function isAccountDeletionActive(ctx: any, clerkId: string) {
  return Boolean(
    await ctx.db
      .query("accountDeletionStates")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
      .unique(),
  );
}

export const listProfileSummaries = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(profileSummaryValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    if (await isAccountDeletionActive(ctx, identity.subject)) return [];
    const rows = await ctx.db
      .query("profileCatalog")
      .withIndex("by_owner_primary", (q) =>
        q.eq("ownerClerkId", identity.subject),
      )
      .order("desc")
      .take(boundedLimit(args.limit));
    return rows.map(stripConvexSystemFields);
  },
});

export const listJobSummaries = query({
  args: {
    limit: v.optional(v.number()),
    archived: v.optional(v.boolean()),
  },
  returns: v.array(jobSummaryValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    if (await isAccountDeletionActive(ctx, identity.subject)) return [];
    const rows = await ctx.db
      .query("jobCatalog")
      .withIndex("by_owner_archived_updated", (q) =>
        q
          .eq("ownerClerkId", identity.subject)
          .eq("archived", Boolean(args.archived)),
      )
      .order("desc")
      .take(boundedLimit(args.limit));
    return rows.map(stripConvexSystemFields);
  },
});

async function getOrCreateBackfillState(ctx: any, ownerClerkId: string) {
  const existing = await ctx.db
    .query("catalogBackfillStates")
    .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", ownerClerkId))
    .unique();
  if (existing) return existing;
  const stateId = await ctx.db.insert("catalogBackfillStates", {
    ownerClerkId,
    status: "pending",
    phase: "profiles",
    revision: 0,
    scanRevision: 0,
    jobsTraversalVersion: JOBS_TRAVERSAL_VERSION,
    updatedAt: Date.now(),
    version: 1,
  });
  return ctx.db.get(stateId);
}

function resultForState(state: Record<string, any>, processed: number) {
  return {
    status: state.status as "pending" | "running" | "ready",
    phase: state.phase as "profiles" | "jobs" | "ready",
    processed,
  };
}

export async function ensureCatalogsForOwnerPage(
  ctx: any,
  ownerClerkId: string,
): Promise<{
  status: "pending" | "running" | "ready";
  phase: "profiles" | "jobs" | "ready";
  processed: number;
}> {
  if (await isAccountDeletionActive(ctx, ownerClerkId)) {
    return { status: "ready", phase: "ready", processed: 0 };
  }
  const state = await getOrCreateBackfillState(ctx, ownerClerkId);
  if (!state) throw new Error("Catalog materialization state unavailable");
  if (
    (state.phase === "jobs" || state.phase === "ready") &&
    state.jobsTraversalVersion !== JOBS_TRAVERSAL_VERSION
  ) {
    await ctx.db.patch(state._id, {
      status: "running",
      phase: "jobs",
      profileCursor: undefined,
      profileScanAfter: undefined,
      currentProfileId: undefined,
      currentProfileScanKey: undefined,
      currentJobCursor: undefined,
      nextProfileCursor: undefined,
      profileScanDone: undefined,
      scanRevision: state.revision,
      jobsTraversalVersion: JOBS_TRAVERSAL_VERSION,
      updatedAt: Date.now(),
    });
    return { status: "running", phase: "jobs", processed: 0 };
  }
  if (state.status === "ready") {
    if (state.scanRevision === state.revision) {
      return resultForState(state, 0);
    }
    await ctx.db.patch(state._id, {
      status: "running",
      phase: "jobs",
      profileCursor: undefined,
      profileScanAfter: undefined,
      currentProfileId: undefined,
      currentProfileScanKey: undefined,
      currentJobCursor: undefined,
      nextProfileCursor: undefined,
      profileScanDone: undefined,
      scanRevision: state.revision,
      jobsTraversalVersion: JOBS_TRAVERSAL_VERSION,
      updatedAt: Date.now(),
    });
    return { status: "running", phase: "jobs", processed: 0 };
  }

  if (state.phase === "profiles") {
    const page = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", ownerClerkId))
      .paginate({
        cursor: state.profileCursor ?? null,
        numItems: PROFILE_BACKFILL_PAGE_SIZE,
      });
    for (const profile of page.page) {
      await upsertProfileCatalogProjection(ctx, profile, {
        touchRevision: false,
      });
    }
    if (page.isDone) {
      await ctx.db.patch(state._id, {
        status: "running",
        phase: "jobs",
        profileCursor: undefined,
        profileScanAfter: undefined,
        scanRevision: state.revision,
        jobsTraversalVersion: JOBS_TRAVERSAL_VERSION,
        updatedAt: Date.now(),
      });
      return { status: "running", phase: "jobs", processed: page.page.length };
    }
    await ctx.db.patch(state._id, {
      status: "running",
      profileCursor: page.continueCursor,
      updatedAt: Date.now(),
    });
    return { status: "running", phase: "profiles", processed: page.page.length };
  }

  if (state.phase !== "jobs") {
    await ctx.db.patch(state._id, {
      status: "ready",
      phase: "ready",
      updatedAt: Date.now(),
    });
    return { status: "ready", phase: "ready", processed: 0 };
  }

  if (state.scanRevision !== state.revision) {
    await ctx.db.patch(state._id, {
      profileCursor: undefined,
      profileScanAfter: undefined,
      currentProfileId: undefined,
      currentProfileScanKey: undefined,
      currentJobCursor: undefined,
      nextProfileCursor: undefined,
      profileScanDone: undefined,
      scanRevision: state.revision,
      jobsTraversalVersion: JOBS_TRAVERSAL_VERSION,
      updatedAt: Date.now(),
    });
    return { status: "running", phase: "jobs", processed: 0 };
  }

  let currentProfileId = state.currentProfileId;
  let currentProfileScanKey = state.currentProfileScanKey;
  let currentJobCursor = state.currentJobCursor;

  if (!currentProfileId) {
    const profilePage = await ctx.db
      .query("profileCatalog")
      .withIndex("by_owner_profile_id", (q: any) => {
        const owner = q.eq("ownerClerkId", ownerClerkId);
        return state.profileScanAfter
          ? owner.gt("profileIdString", state.profileScanAfter)
          : owner;
      })
      .take(1);
    const currentProfile = profilePage[0] ?? null;
    if (!currentProfile) {
      await ctx.db.patch(state._id, {
        status: "ready",
        phase: "ready",
        profileCursor: undefined,
        profileScanAfter: undefined,
        currentProfileId: undefined,
        currentProfileScanKey: undefined,
        currentJobCursor: undefined,
        nextProfileCursor: undefined,
        profileScanDone: undefined,
        jobsTraversalVersion: JOBS_TRAVERSAL_VERSION,
        updatedAt: Date.now(),
      });
      return { status: "ready", phase: "ready", processed: 0 };
    }
    currentProfileId = currentProfile.profileId;
    currentProfileScanKey = currentProfile.profileIdString;
    currentJobCursor = undefined;
  }

  const jobsPage = await ctx.db
    .query("jobs")
    .withIndex("by_user", (q: any) => q.eq("userId", currentProfileId))
    .paginate({
      cursor: currentJobCursor ?? null,
      numItems: JOB_BACKFILL_PAGE_SIZE,
    });
  for (const job of jobsPage.page) {
    await upsertJobCatalogProjection(ctx, job, ownerClerkId);
  }

  if (!jobsPage.isDone) {
    await ctx.db.patch(state._id, {
      status: "running",
      currentProfileId,
      currentProfileScanKey,
      currentJobCursor: jobsPage.continueCursor,
      updatedAt: Date.now(),
    });
    return { status: "running", phase: "jobs", processed: jobsPage.page.length };
  }

  await ctx.db.patch(state._id, {
    status: "running",
    profileCursor: undefined,
    profileScanAfter: currentProfileScanKey ?? String(currentProfileId),
    currentProfileId: undefined,
    currentProfileScanKey: undefined,
    currentJobCursor: undefined,
    nextProfileCursor: undefined,
    profileScanDone: undefined,
    updatedAt: Date.now(),
  });
  return { status: "running", phase: "jobs", processed: jobsPage.page.length };
}

export const ensureCatalogs = mutation({
  args: {},
  returns: v.object({
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("ready")),
    phase: v.union(v.literal("profiles"), v.literal("jobs"), v.literal("ready")),
    processed: v.number(),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");
    return ensureCatalogsForOwnerPage(ctx, identity.subject);
  },
});
