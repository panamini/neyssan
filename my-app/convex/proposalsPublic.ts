import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  PROPOSAL_TEMPLATE_IDS,
  resolveProposalTemplateId,
} from "./lib/proposals/renderTemplates";

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
 * Public query to list the most recent proposals for the authenticated user.
 * Returns up to 10 most recent proposals.
 */
export default query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("proposals"),
      _creationTime: v.number(),
      userId: v.id("userProfiles"),
      title: v.string(),
      content: v.string(),
      status: v.string(),
      updatedAt: v.number(),
      createdAt: v.number(),
      sections: v.array(
        v.object({
          type: v.union(
            v.literal("text"),
            v.literal("code"),
            v.literal("image"),
          ),
          content: v.string(),
        }),
      ),
      metadata: v.object({
        platform: v.optional(v.string()),
        jobId: v.optional(v.string()),
        tags: v.optional(v.array(v.string())),
        sourceJobDescription: v.optional(v.string()),
        planned_path: v.optional(v.string()),
        executed_path: v.optional(v.string()),
        fallback_reason: v.optional(v.string()),
        validator_outcome: v.optional(v.string()),
        save_outcome: v.optional(v.string()),
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
      // optional metrics included because stored proposals include metrics
      metrics: v.object({
        score: v.optional(v.number()),
        confidence: v.optional(v.number()),
      }),
      // optional version field present on stored proposals
      version: v.optional(v.number()),
    }),
  ),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("userProfiles")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) throw new Error("User not found");

    const proposals = await ctx.db
      .query("proposals")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .order("desc")
      .take(10);

    // Project proposals to the exact public return shape so added storage fields
    // do not trigger ReturnsValidationError in client-facing queries.
    return proposals.map((proposal) => ({
      _id: proposal._id,
      _creationTime: proposal._creationTime,
      userId: proposal.userId,
      title: proposal.title,
      content: proposal.content,
      status: proposal.status,
      updatedAt: proposal.updatedAt,
      createdAt: proposal.createdAt,
      sections: proposal.sections.map((section) => ({
        type: section.type,
        content: section.content,
      })),
      metadata: {
        platform: proposal.metadata.platform ?? undefined,
        jobId: proposal.metadata.jobId ?? undefined,
        tags: proposal.metadata.tags ?? undefined,
        sourceJobDescription: proposal.metadata.sourceJobDescription ?? undefined,
        planned_path: proposal.metadata.planned_path ?? undefined,
        executed_path: proposal.metadata.executed_path ?? undefined,
        fallback_reason: proposal.metadata.fallback_reason ?? undefined,
        validator_outcome: proposal.metadata.validator_outcome ?? undefined,
        save_outcome: proposal.metadata.save_outcome ?? undefined,
        requestedModelType: proposal.metadata.requestedModelType ?? undefined,
        actualModelType: proposal.metadata.actualModelType ?? undefined,
        fallbackTriggerCode: proposal.metadata.fallbackTriggerCode ?? undefined,
        voicePreset: proposal.metadata.voicePreset ?? undefined,
        formalityLevel: proposal.metadata.formalityLevel ?? undefined,
        creativity: proposal.metadata.creativity ?? undefined,
        templateId: proposal.metadata.templateId
          ? resolveProposalTemplateId(proposal.metadata.templateId)
          : undefined,
        verbatiStyle: proposal.metadata.verbatiStyle
          ? {
              layout: proposal.metadata.verbatiStyle.layout,
              typography: proposal.metadata.verbatiStyle.typography,
              palette: proposal.metadata.verbatiStyle.palette,
              accentHex: proposal.metadata.verbatiStyle.accentHex ?? undefined,
            }
          : undefined,
        proposalType: proposal.metadata.proposalType ?? undefined,
      },
      metrics: {
        score: proposal.metrics.score ?? undefined,
        confidence: proposal.metrics.confidence ?? undefined,
      },
      version: proposal.version ?? undefined,
    }));
  },
});
