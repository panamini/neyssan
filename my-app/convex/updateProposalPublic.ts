import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { PROPOSAL_TEMPLATE_IDS } from "./lib/proposals/renderTemplates";

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

const proposalTemplateChoice = v.union(
  ...PROPOSAL_TEMPLATE_IDS.map((templateId) => v.literal(templateId)),
);

const proposalVerbatiStyleChoice = v.object({
  layout: v.string(),
  typography: v.string(),
  palette: v.string(),
  accentHex: v.optional(v.string()),
});

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
    title: v.optional(v.string()),
    content: v.optional(v.string()),
    sections: v.optional(
      v.array(
        v.object({
          type: v.union(
            v.literal("text"),
            v.literal("code"),
            v.literal("image"),
          ),
          content: v.string(),
        }),
      ),
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
        templateId: v.optional(proposalTemplateChoice),
        verbatiStyle: v.optional(proposalVerbatiStyleChoice),
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

    const hasTitlePatch = typeof args.title === "string";
    const hasContentPatch = typeof args.content === "string";
    const hasSectionsPatch = Array.isArray(args.sections);
    const hasStatusPatch = typeof args.status === "string";
    const hasMetadataPatch = typeof args.metadata === "object";

    if (
      !hasTitlePatch &&
      !hasContentPatch &&
      !hasSectionsPatch &&
      !hasStatusPatch &&
      !hasMetadataPatch
    ) {
      throw new Error("No proposal fields were provided to update.");
    }

    const patch: {
      title?: string;
      content?: string;
      sections?: Array<{ type: "text" | "code" | "image"; content: string }>;
      status?: string;
      metadata?: typeof proposal.metadata;
      updatedAt: number;
      version: number;
    } = {
      updatedAt: Date.now(),
      version: (proposal.version ?? 1) + 1,
    };

    if (hasTitlePatch) {
      patch.title = args.title!.trim() || proposal.title;
    }

    if (hasContentPatch) {
      patch.content = args.content!;
    }

    if (hasSectionsPatch) {
      patch.sections = args.sections as Array<{
        type: "text" | "code" | "image";
        content: string;
      }>;
    } else if (hasContentPatch) {
      patch.sections = [{ type: "text", content: args.content! }];
    }

    if (hasStatusPatch) {
      patch.status = args.status;
    }

    if (hasMetadataPatch) {
      patch.metadata = {
        ...proposal.metadata,
        ...args.metadata,
      };
    }

    await ctx.db.patch(args.id, patch);

    return { success: true };
  },
});
