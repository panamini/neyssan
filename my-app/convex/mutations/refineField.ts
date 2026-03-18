import { mutation } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";

/**
 * Public mutation: refineFieldByString
 *  refineFieldByString is implemented but not yet used in the UI.

 * Accepts an external profileId string (UUID or other), a field name, and the field
 * content to refine. Normalizes the profileId to a Convex Id<"userProfiles"> and
 * enqueues an LLM job via the internal jobs.start mutation.
 *
 * Args:
 *  - profileId: string (external UUID or Convex id string)
 *  - field: string (e.g., "summary", "experience", "skills")
 *  - content: string (the current value / draft to refine)
 *  - options: optional any (forwarded to job options)
 *
 * Returns:
 *  - Id<"llmJobs">: Convex job id that was created
 */
export const refineFieldByString: any = mutation({
  args: {
    profileId: v.string(),
    field: v.string(),
    content: v.string(),
    options: v.optional(v.any()),
  },
  returns: v.id("llmJobs"),
  handler: async (ctx, args): Promise<any> => {
    // Normalize incoming profileId string to Convex Id<"userProfiles">.
    let normalizedProfileId: any = null;
    try {
      normalizedProfileId = ctx.db.normalizeId("userProfiles", args.profileId);
    } catch (e) {
      normalizedProfileId = null;
    }

    if (!normalizedProfileId) {
      // Attempt a lookup by external profileId field (backwards compatibility)
      try {
        const rows = await ctx.db
          .query("userProfiles")
          .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId))
          .take(1);
        if (rows && rows.length > 0) {
          normalizedProfileId = rows[0]._id;
        }
      } catch (e) {
        normalizedProfileId = null;
      }
    }

    if (!normalizedProfileId) {
      throw new Error(`Invalid profileId: "${args.profileId}". Could not normalize to a Convex id nor find a userProfiles document with that external profileId.`);
    }

    // Defensive: ensure profile exists
    const profileDoc = await ctx.db.get(normalizedProfileId);
    if (!profileDoc) {
      throw new Error(`Profile not found for id "${normalizedProfileId}" (original: "${args.profileId}").`);
    }

    // Compose a field-specific prompt. Keep it concise and structured so the worker
    // action (llm.refine) receives rawText that the LLM can parse and operate on.
    // We include the field name and the content, and a short instruction to "refine".
    const safeField = String(args.field).trim();
    const rawText = `REFINE_FIELD\nfield: ${safeField}\n\ncontent:\n${args.content}\n\nINSTRUCTIONS:\nPlease provide a refined version of the above content for the field "${safeField}" suitable for a professional CV/profile. Return the full refined text. If the field contains structured data (JSON, lists), prefer returning JSON or a clearly delimited result. Include an optional "confidence" numeric value if you can estimate it.`;

    // Create the llm job using the internal strict mutation.
    const jobId = await ctx.runMutation(internal.jobs.start, {
      profileId: normalizedProfileId,
      rawText,
      options: args.options,
      reason: `refineField:${safeField}`,
    });

    return jobId;
  },
});