import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";

/**
 * Public action that serves as a secure gateway for the LLM worker.
 * The worker calls this action, which internally calls the appropriate internal functions.
 */
export const processJobRequest = action({
  args: {
    operation: v.union(
      v.object({
        type: v.literal("listPendingJobs"),
        batchSize: v.optional(v.number()),
      }),
      v.object({
        type: v.literal("claimJob"),
        jobId: v.id("llmJobs"),
        workerId: v.string(),
      }),
      v.object({
        type: v.literal("appendHistory"),
        profileId: v.id("userProfiles"),
        jobId: v.optional(v.union(v.id("llmJobs"), v.null())),
        placeholderId: v.optional(v.union(v.string(), v.null())),
        provider: v.string(),
        model: v.string(),
        full_response: v.any(),
        patch: v.any(),
        confidence: v.optional(v.union(v.number(), v.null())),
        merged: v.optional(v.boolean()),
        createdAt: v.optional(v.number()),
      }),
      v.object({
        type: v.literal("markJobCompleted"),
        jobId: v.id("llmJobs"),
        historyId: v.id("llmHistory"),
      }),
      v.object({
        type: v.literal("markJobFailed"),
        jobId: v.id("llmJobs"),
        error: v.string(),
      })
    ),
  },
  handler: async (ctx, args): Promise<
    | Array<{
        _id: Id<"llmJobs">;
        _creationTime: number;
        profileId: Id<"userProfiles">;
        placeholderId?: string;
        status: string;
        rawText?: string;
        options?: any;
        requestedBy?: string;
        createdAt: number;
        updatedAt: number;
      }>
    | ({
        _id: Id<"llmJobs">;
        profileId: Id<"userProfiles">;
        placeholderId?: string;
        status: string;
        rawText?: string;
        options?: any;
        requestedBy?: string;
        createdAt: number;
        updatedAt: number;
        attempts?: number;
        lockedBy?: string;
        startedAt?: number;
      } | null)
    | Id<"llmHistory">
    | null
  > => {
    switch (args.operation.type) {
      case "listPendingJobs":
        return await ctx.runQuery(internal.jobs.listPendingJobs, {
          batchSize: args.operation.batchSize,
        });

      case "claimJob":
        return await ctx.runMutation(internal.jobs.claimJob, {
          jobId: args.operation.jobId,
          workerId: args.operation.workerId,
        });

      case "appendHistory":
        return await ctx.runMutation(internal.jobs.appendHistory, {
          profileId: args.operation.profileId,
          ...(args.operation.jobId !== undefined ? { jobId: args.operation.jobId } : {}),
          ...(args.operation.placeholderId !== undefined ? { placeholderId: args.operation.placeholderId } : {}),
          provider: args.operation.provider,
          model: args.operation.model,
          full_response: args.operation.full_response,
          patch: args.operation.patch,
          confidence: args.operation.confidence,
          merged: args.operation.merged,
          createdAt: args.operation.createdAt,
        });

      case "markJobCompleted":
        return await ctx.runMutation(internal.jobs.markJobCompleted, {
          jobId: args.operation.jobId,
          historyId: args.operation.historyId,
        });

      case "markJobFailed":
        return await ctx.runMutation(internal.jobs.markJobFailed, {
          jobId: args.operation.jobId,
          error: args.operation.error,
        });
    }
    throw new Error("Invalid operation type");
  },
});
