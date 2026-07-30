import { internalMutation } from "./_generated/server";
import type { Infer } from "convex/values";
import { v } from "convex/values";
import { applicationHarnessContextValidator } from "./lib/applicationHarness";
import { buildApplicationContextV1FromExistingData } from "./lib/applicationContextBuilder";
import { persistApplicationContext } from "./lib/applicationContextPersistence";

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
type ProjectedApplicationContext = Infer<typeof applicationHarnessContextValidator>;

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
    const persisted = await persistApplicationContext(
      ctx.db,
      contextForWrite,
    );

    return {
      contextStorageId: persisted.contextStorageId,
      context: projectApplicationContext(persisted.context),
      reused: persisted.reused,
      hashes: projectHashes(result),
    };
  },
});

function projectApplicationContext(
  context: BuiltApplicationContext | StoredApplicationContext,
): ProjectedApplicationContext {
  return {
    id: context.id,
    userId: context.userId,
    job: { ...context.job },
    candidate: { ...context.candidate },
    settingsHash: context.settingsHash,
    contextHash: context.contextHash,
    reviewState: context.reviewState,
    sourceRefs: context.sourceRefs.map((sourceRef) => ({ ...sourceRef })),
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
