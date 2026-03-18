import { mutation } from "./_generated/server";
import { v } from "convex/values";

const proposalVoicePresetChoice = v.union(
  v.literal("signature"),
  v.literal("expert"),
  v.literal("direct"),
  v.literal("engaging"),
  v.literal("storyteller"),
);

const proposalFormalityLevelChoice = v.union(
  v.literal("informal"),
  v.literal("neutral"),
  v.literal("formal"),
);

const proposalCreativityChoice = v.union(
  v.literal("low"),
  v.literal("medium"),
  v.literal("high"),
);

/**
 * Public mutation to update a proposal owned by the authenticated user.
 * Args:
 *  - id: Id<"proposals">
 *  - content: string
 *  - sections: array of { type, content }
 */
export default mutation({
  args: {
    id: v.id("proposals"),
    content: v.string(),
    sections: v.array(
      v.object({
        type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
        content: v.string(),
      }),
    ),
    status: v.optional(v.string()),
    metadata: v.optional(
      v.object({
        platform: v.optional(v.string()),
        jobId: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        sourceJobDescription: v.optional(v.string()),
        requestedModelType: v.optional(v.string()),
        actualModelType: v.optional(v.string()),
        fallbackTriggerCode: v.optional(v.string()),
        voicePreset: v.optional(proposalVoicePresetChoice),
        formalityLevel: v.optional(proposalFormalityLevelChoice),
        creativity: v.optional(proposalCreativityChoice),
        proposalType: v.optional(
          v.union(
            v.literal("cover_letter"),
            v.literal("application_message"),
            v.literal("freelance_proposal"),
          ),
        ),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const proposal = await ctx.db.get(args.id);
    if (!proposal) throw new Error("Proposal not found");
    if (proposal.userId !== user._id)
      throw new Error("Not authorized to update this proposal");

    await ctx.db.patch(args.id, {
      content: args.content,
      sections: args.sections,
      status: args.status ?? proposal.status,
      metadata: args.metadata ?? proposal.metadata,
      updatedAt: Date.now(),
      version: (proposal.version ?? 1) + 1,
    });

    return { success: true };
  },
});
