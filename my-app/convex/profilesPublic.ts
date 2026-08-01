import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import {
  canonicalizeUserProfileMetadata,
  userProfileMetadataValidator,
} from "./lib/userProfileMetadata";
import type { UserProfileMetadata } from "./lib/userProfileMetadata";
import {
  getPrimaryProfileForClerk,
  resolveCanonicalProfileKeywordsForWrite,
} from "./lib/userProfiles";
import { sanitizeRemoteMetadataImages } from "./lib/documentAssets";
import { syncProfileCatalogById } from "./lib/profileCatalog";

const PROFILE_LIST_DEFAULT_LIMIT = 40;
const PROFILE_LIST_MAX_LIMIT = 120;

const publicUserProfileValidator = v.object({
  _id: v.id("userProfiles"),
  _creationTime: v.number(),
  profileId: v.optional(v.string()),
  clerkId: v.optional(v.string()),
  email: v.string(),
  name: v.optional(v.string()),
  version: v.number(),
  createdAt: v.number(),
  updatedAt: v.number(),
  preferences: v.object({
    rateLimits: v.optional(v.any()),
    writingStyle: v.string(),
    tonePreference: v.string(),
    autoSend: v.boolean(),
  }),
  summary: v.optional(v.string()),
  skills: v.optional(v.array(v.string())),
  keywords: v.optional(v.array(v.string())),
  experience: v.optional(
    v.array(
      v.object({
        company: v.string(),
        title: v.string(),
        startDate: v.optional(v.union(v.string(), v.number(), v.null())),
        endDate: v.optional(v.union(v.string(), v.number(), v.null())),
        description: v.optional(v.string()),
      }),
    ),
  ),
  education: v.optional(
    v.array(
      v.object({
        school: v.string(),
        degree: v.optional(v.string()),
        fieldOfStudy: v.optional(v.string()),
        startDate: v.optional(v.union(v.string(), v.number(), v.null())),
        endDate: v.optional(v.union(v.string(), v.number(), v.null())),
      }),
    ),
  ),
  linkedIn: v.optional(v.string()),
  raw_text: v.optional(v.string()),
  metadata: v.optional(userProfileMetadataValidator),
  cvDocument: v.optional(v.any()),
});

type UserProfile = {
  _id: Id<"userProfiles">;
  _creationTime: number;
  profileId?: string;
  clerkId?: string;
  email: string;
  name?: string;
  version: number;
  createdAt: number;
  updatedAt: number;
  preferences: {
    rateLimits?: any;
    writingStyle: string;
    tonePreference: string;
    autoSend: boolean;
  };
  summary?: string;
  skills?: string[];
  keywords?: string[];
  experience?: {
    company: string;
    title: string;
    startDate?: string | number | null;
    endDate?: string | number | null;
    description?: string;
  }[];
  education?: {
    school: string;
    degree?: string;
    fieldOfStudy?: string;
    startDate?: string | number | null;
    endDate?: string | number | null;
  }[];
  linkedIn?: string;
  raw_text?: string;
  metadata?: UserProfileMetadata;
  cvDocument?: unknown;
} | null;

function normalizeProfileListLimit(limit: unknown) {
  const numericLimit =
    typeof limit === "number" ? Math.floor(limit) : PROFILE_LIST_DEFAULT_LIMIT;
  if (!Number.isFinite(numericLimit)) {
    return PROFILE_LIST_DEFAULT_LIMIT;
  }
  return Math.max(1, Math.min(PROFILE_LIST_MAX_LIMIT, numericLimit));
}

async function resolveRuntimeDocumentDecoration(
  ctx: any,
  decoration: unknown,
  resolvedUrlCache: Map<string, string | null>,
): Promise<unknown> {
  const sanitized = sanitizeRemoteMetadataImages({
    documentDecoration: decoration,
  }) as { documentDecoration?: unknown };
  const next = sanitized.documentDecoration;
  if (!next || typeof next !== "object" || Array.isArray(next)) {
    return next;
  }

  const record = { ...(next as Record<string, unknown>) };
  if (typeof record.assetId === "string" && record.assetId) {
    try {
      let resolvedUrl = resolvedUrlCache.get(record.assetId);
      if (resolvedUrl === undefined) {
        const storageUrl = await ctx.storage.getUrl(record.assetId as any);
        resolvedUrl =
          typeof storageUrl === "string" && storageUrl ? storageUrl : null;
        resolvedUrlCache.set(record.assetId, resolvedUrl);
      }
      if (typeof resolvedUrl === "string" && resolvedUrl) {
        record.resolvedUrl = resolvedUrl;
        delete record.assetMissing;
      } else {
        delete record.resolvedUrl;
        record.assetMissing = true;
      }
    } catch {
      delete record.resolvedUrl;
      record.assetMissing = true;
    }
  }
  return record;
}

async function resolveRuntimeMetadata(
  ctx: any,
  metadata: unknown,
  resolvedUrlCache: Map<string, string | null>,
): Promise<unknown> {
  const sanitized = sanitizeRemoteMetadataImages(
    canonicalizeUserProfileMetadata(metadata),
  );
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    return sanitized;
  }

  const next = { ...(sanitized as Record<string, unknown>) };
  if ("documentDecoration" in next) {
    next.documentDecoration = await resolveRuntimeDocumentDecoration(
      ctx,
      next.documentDecoration,
      resolvedUrlCache,
    );
  }
  return next;
}

async function resolveRuntimeCvDocument(
  ctx: any,
  cvDocument: unknown,
  resolvedUrlCache: Map<string, string | null>,
): Promise<unknown> {
  if (!cvDocument || typeof cvDocument !== "object" || Array.isArray(cvDocument)) {
    return cvDocument;
  }

  const next = { ...(cvDocument as Record<string, unknown>) };
  if ("metadata" in next) {
    next.metadata = await resolveRuntimeMetadata(
      ctx,
      next.metadata,
      resolvedUrlCache,
    );
  }
  return next;
}

async function projectProfileDoc(
  ctx: any,
  prof: any,
  options: { includeCvDocument?: boolean } = {},
): Promise<Exclude<UserProfile, null>> {
  const resolvedUrlCache = new Map<string, string | null>();
  const metadata =
    (await resolveRuntimeMetadata(ctx, prof.metadata, resolvedUrlCache)) as
      | Exclude<UserProfile, null>["metadata"]
      | undefined;
  const includeCvDocument = options.includeCvDocument !== false;
  return {
    _id: prof._id,
    _creationTime: prof._creationTime,
    profileId: prof.profileId ?? undefined,
    clerkId: prof.clerkId ?? undefined,
    email: prof.email,
    name: prof.name ?? undefined,
    version: prof.version,
    createdAt: prof.createdAt,
    updatedAt: prof.updatedAt,
    preferences: prof.preferences,
    summary: prof.summary ?? undefined,
    skills: prof.skills ?? undefined,
    keywords: prof.keywords ?? undefined,
    experience: prof.experience ?? undefined,
    education: prof.education ?? undefined,
    linkedIn: prof.linkedIn ?? undefined,
    raw_text: prof.raw_text ?? undefined,
    metadata: metadata ?? undefined,
    ...(includeCvDocument
      ? {
          cvDocument: await resolveRuntimeCvDocument(
            ctx,
            prof.cvDocument,
            resolvedUrlCache,
          ),
        }
      : {}),
  };
}

export const get = query({
  args: {},
  returns: v.union(v.null(), publicUserProfileValidator),
  handler: async (ctx): Promise<UserProfile> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }
    const prof = await ctx.runQuery(internal.profiles.get);
    if (!prof) return null;
    return await projectProfileDoc(ctx, prof);
  },
});

export const getByProfileId = query({
  args: {
    profileId: v.string(),
  },
  returns: v.union(v.null(), publicUserProfileValidator),
  handler: async (ctx, args): Promise<UserProfile> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return null;
    }

    const rows = await ctx.db
      .query("userProfiles")
      .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
      .collect();

    const owned = rows.find((row) => row.clerkId === identity.subject);
    if (owned) {
      return await projectProfileDoc(ctx, owned);
    }

    if (rows.some((row) => row.clerkId && row.clerkId !== identity.subject)) {
      return null;
    }

    const unclaimed = rows.find((row) => !row.clerkId);
    return unclaimed ? await projectProfileDoc(ctx, unclaimed) : null;
  },
});

export const listMine = query({
  args: {
    limit: v.optional(v.number()),
    includeCvDocument: v.optional(v.boolean()),
  },
  returns: v.array(publicUserProfileValidator),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      return [];
    }

    const limit = normalizeProfileListLimit(args.limit);
    const indexedQuery = ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_updated_at", (q) =>
        q.eq("clerkId", identity.subject),
      );
    const orderedQuery =
      typeof indexedQuery.order === "function"
        ? indexedQuery.order("desc")
        : indexedQuery;
    const rows =
      typeof orderedQuery.take === "function"
        ? await orderedQuery.take(limit)
        : (await orderedQuery.collect())
            .sort(
              (a: any, b: any) =>
                (b.updatedAt ?? b._creationTime) -
                (a.updatedAt ?? a._creationTime),
            )
            .slice(0, limit);

    return await Promise.all(
      rows.map((profile: any) =>
        projectProfileDoc(ctx, profile, {
          includeCvDocument: args.includeCvDocument === true,
        }),
      ),
    );
  },
});

/**
 * Public mutation that ingests a profile payload from an authenticated caller
 * (the extension) and patches the user's userProfiles document.
 *
 * This is intended to be called from the extension via ConvexHttpClient.mutation
 * (i.e., convex.mutation(api.profiles.ingestFromExtension, { profile }))
 */
export default mutation({
  args: {
    profile: v.object({
      name: v.optional(v.string()),
      summary: v.optional(v.string()),
      // preserve original pasted text (raw resume) if provided
      raw_text: v.optional(v.string()),
      // preserve LinkedIn/original URL separately
      linkedIn: v.optional(v.string()),
      skills: v.optional(v.array(v.string())),
      keywords: v.optional(v.array(v.string())),
      experience: v.optional(
        v.array(
          v.object({
            company: v.string(),
            title: v.string(),
            startDate: v.optional(v.number()),
            endDate: v.optional(v.number()),
            description: v.optional(v.string()),
          }),
        ),
      ),
      education: v.optional(
        v.array(
          v.object({
            school: v.string(),
            degree: v.optional(v.string()),
            fieldOfStudy: v.optional(v.string()),
            startDate: v.optional(v.number()),
            endDate: v.optional(v.number()),
          }),
        ),
      ),
      metadata: v.optional(userProfileMetadataValidator),
    }),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Ensure user profile exists (do not pass identity.name here; we patch name explicitly below when provided by the client)
    await ctx.runMutation(internal.users.createOrUpdateUser, {
      clerkId: identity.subject,
      email: identity.email ?? "unknown@example.com",
    });

    // Find existing profile
    const existing = await getPrimaryProfileForClerk(ctx, identity.subject);

    if (!existing) {
      throw new Error("User profile not found after createOrUpdateUser");
    }

    const updates: any = {
      updatedAt: Date.now(),
      version: (existing.version || 1) + 1,
    };

    if (args.profile.name !== undefined) updates.name = args.profile.name;
    if (args.profile.summary !== undefined)
      updates.summary = args.profile.summary;
    if (args.profile.raw_text !== undefined)
      updates.raw_text = args.profile.raw_text;
    if (args.profile.linkedIn !== undefined)
      updates.linkedIn = args.profile.linkedIn;
    if (args.profile.skills !== undefined) updates.skills = args.profile.skills;
    if (args.profile.experience !== undefined)
      updates.experience = args.profile.experience;
    if (args.profile.education !== undefined)
      updates.education = args.profile.education;
    if (args.profile.metadata !== undefined) {
      updates.metadata = sanitizeRemoteMetadataImages(
        canonicalizeUserProfileMetadata(args.profile.metadata),
      );
    }

    updates.keywords = resolveCanonicalProfileKeywordsForWrite({
      nextKeywords: args.profile.keywords,
      summary: updates.summary ?? existing.summary,
      skills: updates.skills ?? existing.skills,
      experience: updates.experience ?? existing.experience,
      rawText: updates.raw_text ?? existing.raw_text,
    });

    await ctx.db.patch(existing._id, updates);
    await syncProfileCatalogById(ctx, existing._id);
    return null;
  },
});
