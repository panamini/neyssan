import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { applicationHarnessContextValidator } from "./lib/applicationHarness";
import { buildApplicationContextV1FromExistingData } from "./lib/applicationContextBuilder";

const buildSettingsValidator = v.object({
  selectedLanguage: v.optional(v.string()),
  market: v.optional(v.string()),
});

const buildAndPersistResultValidator = v.object({
  contextStorageId: v.id("applicationContexts"),
  context: applicationHarnessContextValidator,
  reused: v.boolean(),
  hashes: v.object({
    rawTextHash: v.string(),
    jobHash: v.string(),
    structuredSectionsHash: v.optional(v.string()),
    cvSnapshotHash: v.string(),
    candidateHash: v.string(),
    settingsHash: v.string(),
    contextHash: v.string(),
  }),
});

type BuiltApplicationContext = Awaited<
  ReturnType<typeof buildApplicationContextV1FromExistingData>
>["context"];

type StoredApplicationContext = BuiltApplicationContext & {
  _id: unknown;
  _creationTime: number;
};

export const buildAndPersistFromJobAndProfile = internalMutation({
  args: {
    jobId: v.id("jobs"),
    profileId: v.id("userProfiles"),
    settings: v.optional(buildSettingsValidator),
  },
  returns: buildAndPersistResultValidator,
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);
    if (!job) {
      throw new Error("ApplicationContext builder job not found");
    }

    const profile = await ctx.db.get(args.profileId);
    if (!profile) {
      throw new Error("ApplicationContext builder profile not found");
    }

    if (String(job.userId) !== String(args.profileId)) {
      throw new Error("ApplicationContext builder job/profile ownership mismatch");
    }

    const result = await buildApplicationContextV1FromExistingData({
      userId: String(args.profileId),
      job: { ...job, _id: String(args.jobId) },
      candidateProfile: { ...profile, _id: String(args.profileId) },
      settings: args.settings,
      now: Date.now(),
    });
    const contextForWrite = projectApplicationContext(result.context);

    const existingById = await ctx.db
      .query("applicationContexts")
      .withIndex("by_user_id", (q) =>
        q.eq("userId", contextForWrite.userId).eq("id", contextForWrite.id),
      )
      .unique();

    if (existingById) {
      if (existingById.contextHash !== contextForWrite.contextHash) {
        throw new Error("ApplicationContext builder stable id collision");
      }

      return {
        contextStorageId: existingById._id,
        context: projectApplicationContext(existingById),
        reused: true,
        hashes: projectHashes(result),
      };
    }

    const existingByHash = await ctx.db
      .query("applicationContexts")
      .withIndex("by_user_context_hash", (q) =>
        q
          .eq("userId", contextForWrite.userId)
          .eq("contextHash", contextForWrite.contextHash),
      )
      .unique();

    if (existingByHash) {
      if (existingByHash.id !== contextForWrite.id) {
        throw new Error("ApplicationContext builder contextHash collision with different stable id");
      }

      return {
        contextStorageId: existingByHash._id,
        context: projectApplicationContext(existingByHash),
        reused: true,
        hashes: projectHashes(result),
      };
    }

    const contextStorageId = await ctx.db.insert("applicationContexts", contextForWrite);

    return {
      contextStorageId,
      context: contextForWrite,
      reused: false,
      hashes: projectHashes(result),
    };
  },
});

function projectApplicationContext(
  context: BuiltApplicationContext | StoredApplicationContext,
): BuiltApplicationContext {
  return {
    id: context.id,
    userId: context.userId,
    job: context.job,
    candidate: context.candidate,
    settingsHash: context.settingsHash,
    contextHash: context.contextHash,
    reviewState: context.reviewState,
    sourceRefs: [...context.sourceRefs],
    createdAt: context.createdAt,
    updatedAt: context.updatedAt,
    version: context.version,
  };
}

function projectHashes(result: Awaited<ReturnType<typeof buildApplicationContextV1FromExistingData>>) {
  return {
    rawTextHash: result.rawTextHash,
    jobHash: result.jobHash,
    ...(result.structuredSectionsHash
      ? { structuredSectionsHash: result.structuredSectionsHash }
      : {}),
    cvSnapshotHash: result.cvSnapshotHash,
    candidateHash: result.candidateHash,
    settingsHash: result.settingsHash,
    contextHash: result.contextHash,
  };
}
