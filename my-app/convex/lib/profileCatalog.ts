import type { Id } from "../_generated/dataModel";
import {
  isReviewedSourceCvVariant,
  type StoredUserProfile,
} from "./userProfiles";
import { assertAccountProfileWriteAllowed } from "./accountDeletion";

export const PROFILE_CATALOG_VERSION = 1 as const;
export const ACCOUNT_DELETION_BATCH_SIZE = 8;
const OWNER_JOB_CATALOG_PAGE_SIZE = ACCOUNT_DELETION_BATCH_SIZE / 2;

export type ProfileCatalogProjection = {
  profileId: Id<"userProfiles">;
  profileIdString: string;
  ownerClerkId: string;
  externalProfileId?: string;
  label?: string;
  defaultResumeId?: string | null;
  defaultResumeName?: string | null;
  updatedAt: number;
  profileCreatedAt: number;
  version: typeof PROFILE_CATALOG_VERSION;
};

function compactString(value: unknown): string | undefined {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || undefined;
}

export function buildProfileCatalogProjection(
  profile: StoredUserProfile,
): ProfileCatalogProjection | null {
  const ownerClerkId = compactString(profile.clerkId);
  if (!ownerClerkId || isReviewedSourceCvVariant(profile)) {
    return null;
  }

  const externalProfileId = compactString(profile.profileId);
  const label =
    compactString(profile.cvDocument?.title) ??
    compactString(profile.name) ??
    externalProfileId;
  const updatedAt = Number(
    profile.updatedAt ?? profile.createdAt ?? profile._creationTime ?? 0,
  );

  return {
    profileId: profile._id,
    profileIdString: String(profile._id),
    ownerClerkId,
    ...(externalProfileId ? { externalProfileId } : {}),
    ...(label ? { label } : {}),
    ...(profile.defaultResumeId !== undefined
      ? { defaultResumeId: profile.defaultResumeId }
      : {}),
    ...(profile.defaultResumeName !== undefined
      ? { defaultResumeName: profile.defaultResumeName }
      : {}),
    updatedAt,
    profileCreatedAt: Number(profile._creationTime ?? profile.createdAt ?? 0),
    version: PROFILE_CATALOG_VERSION,
  };
}

export function selectPrimaryProfileCatalog(
  rows: ProfileCatalogProjection[],
): ProfileCatalogProjection | null {
  return [...rows].sort((left, right) => {
    if (right.updatedAt !== left.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }
    if (right.profileCreatedAt !== left.profileCreatedAt) {
      return right.profileCreatedAt - left.profileCreatedAt;
    }
    return right.profileIdString.localeCompare(left.profileIdString);
  })[0] ?? null;
}

async function getCatalogRowForProfile(ctx: any, profileId: Id<"userProfiles">) {
  return ctx.db
    .query("profileCatalog")
    .withIndex("by_profile_id", (q: any) => q.eq("profileId", profileId))
    .unique();
}

function profileCatalogProjectionEquals(
  existing: Record<string, any>,
  projection: ProfileCatalogProjection,
): boolean {
  const keys: Array<keyof ProfileCatalogProjection> = [
    "profileId",
    "profileIdString",
    "ownerClerkId",
    "externalProfileId",
    "label",
    "defaultResumeId",
    "defaultResumeName",
    "updatedAt",
    "profileCreatedAt",
    "version",
  ];
  return keys.every((key) => existing[key] === projection[key]);
}

export async function touchCatalogBackfillRevision(
  ctx: any,
  ownerClerkId: string,
): Promise<void> {
  const state = await ctx.db
    .query("catalogBackfillStates")
    .withIndex("by_owner", (q: any) => q.eq("ownerClerkId", ownerClerkId))
    .unique();
  const now = Date.now();
  if (!state) {
    await ctx.db.insert("catalogBackfillStates", {
      ownerClerkId,
      status: "pending",
      phase: "profiles",
      revision: 1,
      scanRevision: 0,
      updatedAt: now,
      version: PROFILE_CATALOG_VERSION,
    });
    return;
  }
  await ctx.db.patch(state._id, {
    revision: Number(state.revision ?? 0) + 1,
    updatedAt: now,
  });
}

export async function upsertProfileCatalogProjection(
  ctx: any,
  profile: StoredUserProfile,
  options: { touchRevision?: boolean } = {},
): Promise<ProfileCatalogProjection | null> {
  const projection = buildProfileCatalogProjection(profile);
  const existing = await getCatalogRowForProfile(ctx, profile._id);

  if (!projection) {
    if (existing) {
      await ctx.db.delete(existing._id);
      if (options.touchRevision !== false) {
        await touchCatalogBackfillRevision(ctx, existing.ownerClerkId);
      }
    }
    return null;
  }

  if (existing) {
    if (!profileCatalogProjectionEquals(existing, projection)) {
      await ctx.db.patch(existing._id, projection);
    }
    if (
      options.touchRevision !== false &&
      existing.ownerClerkId !== projection.ownerClerkId
    ) {
      await touchCatalogBackfillRevision(ctx, existing.ownerClerkId);
      await touchCatalogBackfillRevision(ctx, projection.ownerClerkId);
    }
  } else {
    await ctx.db.insert("profileCatalog", projection);
    if (options.touchRevision !== false) {
      await touchCatalogBackfillRevision(ctx, projection.ownerClerkId);
    }
  }
  return projection;
}

export async function syncProfileCatalogById(
  ctx: any,
  profileId: Id<"userProfiles">,
  options: { touchRevision?: boolean } = {},
): Promise<ProfileCatalogProjection | null> {
  const profile = (await ctx.db.get(profileId)) as StoredUserProfile | null;
  if (!profile) {
    const existing = await getCatalogRowForProfile(ctx, profileId);
    if (existing) {
      await ctx.db.delete(existing._id);
      if (options.touchRevision !== false) {
        await touchCatalogBackfillRevision(ctx, existing.ownerClerkId);
      }
    }
    return null;
  }
  return upsertProfileCatalogProjection(ctx, profile, options);
}

export async function insertProfileWithCatalog(
  ctx: any,
  value: Record<string, unknown>,
): Promise<Id<"userProfiles">> {
  await assertAccountProfileWriteAllowed(ctx, value.clerkId);
  const profileId = await ctx.db.insert("userProfiles", value);
  await syncProfileCatalogById(ctx, profileId);
  return profileId;
}

export async function patchProfileWithCatalog(
  ctx: any,
  profileId: Id<"userProfiles">,
  value: Record<string, unknown>,
): Promise<void> {
  await ctx.db.patch(profileId, value);
  await syncProfileCatalogById(ctx, profileId);
}

export async function deleteProfileWithCatalogPage(
  ctx: any,
  profileId: Id<"userProfiles">,
): Promise<void> {
  const jobCatalogRows = await ctx.db
    .query("jobCatalog")
    .withIndex("by_profile_id", (q: any) => q.eq("profileId", profileId))
    .take(ACCOUNT_DELETION_BATCH_SIZE);
  if (jobCatalogRows.length > 0) {
    for (const row of jobCatalogRows) await ctx.db.delete(row._id);
    return;
  }

  const jobs = await ctx.db
    .query("jobs")
    .withIndex("by_user", (q: any) => q.eq("userId", profileId))
    .take(ACCOUNT_DELETION_BATCH_SIZE);
  if (jobs.length > 0) {
    for (const job of jobs) await ctx.db.delete(job._id);
    return;
  }

  const existing = await getCatalogRowForProfile(ctx, profileId);
  if (existing) await ctx.db.delete(existing._id);
  await ctx.db.delete(profileId);
}

export async function deleteOwnedCatalogRowsPage(
  ctx: any,
  ownerClerkId: string,
): Promise<boolean> {
  const profileRows = await ctx.db
    .query("profileCatalog")
    .withIndex("by_owner_profile_id", (q: any) =>
      q.eq("ownerClerkId", ownerClerkId),
    )
    .take(ACCOUNT_DELETION_BATCH_SIZE);
  if (profileRows.length > 0) {
    for (const row of profileRows) await ctx.db.delete(row._id);
    return true;
  }

  const jobRows = await ctx.db
    .query("jobCatalog")
    .withIndex("by_owner_archived_updated", (q: any) =>
      q.eq("ownerClerkId", ownerClerkId),
    )
    .take(OWNER_JOB_CATALOG_PAGE_SIZE);
  if (jobRows.length > 0) {
    for (const row of jobRows) {
      const job = await ctx.db.get(row.jobId);
      if (job) {
        const profile = await ctx.db.get(job.userId);
        if (!profile || profile.clerkId === ownerClerkId) {
          await ctx.db.delete(job._id);
        }
      }
      await ctx.db.delete(row._id);
    }
    return true;
  }

  return false;
}
