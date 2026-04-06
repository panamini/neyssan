import { query } from "./_generated/server";
import { v } from "convex/values";
import {
  PROPOSAL_TEMPLATE_IDS,
  resolveProposalTemplateId,
} from "./lib/proposals/renderTemplates";
import { listProfilesForClerk } from "./lib/userProfiles";

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

const proposalStyleLinkModeChoice = v.union(
  v.literal("inherit_cv"),
  v.literal("proposal_local"),
);

const proposalStyleChoiceChoice = v.union(
  v.literal("auto"),
  v.literal("formal"),
  v.literal("warm"),
  v.literal("technical"),
  v.literal("balanced"),
);

const proposalTemplateBundleChoice = v.union(
  v.literal("swiss_serif"),
  v.literal("swiss_mono"),
  v.literal("magazine_editorial"),
  v.literal("magazine_serif"),
  v.literal("grid_mono"),
  v.literal("quire_mono"),
);

const proposalTypographyOverrideChoice = v.union(
  v.literal("signature"),
  v.literal("engaging"),
  v.literal("expert"),
);

const proposalLayoutOverrideChoice = v.union(
  v.literal("swiss"),
  v.literal("editorial"),
  v.literal("modernist"),
  v.literal("quire"),
);

const proposalCharacterLimitModeChoice = v.union(
  v.literal("none"),
  v.literal("linkedin_note_200"),
  v.literal("linkedin_inmail_2000"),
  v.literal("indeed_cover_letter_4000"),
  v.literal("upwork_proposal_advisory"),
  v.literal("custom"),
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
        sourceUrl: v.optional(v.string()),
        planned_path: v.optional(v.string()),
        executed_path: v.optional(v.string()),
        fallback_reason: v.optional(v.string()),
        validator_outcome: v.optional(v.string()),
        save_outcome: v.optional(v.string()),
        requestedModelType: v.optional(v.string()),
        actualModelType: v.optional(v.string()),
        fallbackTriggerCode: v.optional(v.string()),
        voicePreset: v.optional(proposalVoicePresetChoice),
        requestedVoicePreset: v.optional(
          v.union(proposalVoicePresetChoice, v.null()),
        ),
        resolvedVoicePreset: v.optional(proposalVoicePresetChoice),
        autoToneDecisionVersion: v.optional(v.literal("v1")),
        autoToneReason: v.optional(v.string()),
        formalityLevel: v.optional(proposalFormalityLevelChoice),
        creativity: v.optional(proposalCreativityChoice),
        templateId: v.optional(proposalTemplateChoice),
        verbatiStyle: v.optional(proposalVerbatiStyleChoice),
        styleLinkMode: v.optional(proposalStyleLinkModeChoice),
        styleChoice: v.optional(proposalStyleChoiceChoice),
        templateBundleId: v.optional(proposalTemplateBundleChoice),
        typographyOverride: v.optional(
          v.union(proposalTypographyOverrideChoice, v.null()),
        ),
        layoutOverride: v.optional(
          v.union(proposalLayoutOverrideChoice, v.null()),
        ),
        applicantName: v.optional(v.string()),
        applicantRole: v.optional(v.string()),
        contactLine: v.optional(v.string()),
        letterDate: v.optional(v.string()),
        recipientDetails: v.optional(v.string()),
        headerShowSender: v.optional(v.boolean()),
        headerShowDate: v.optional(v.boolean()),
        headerShowSubject: v.optional(v.boolean()),
        headerShowRecipient: v.optional(v.boolean()),
        headerShowRecipientDetails: v.optional(v.boolean()),
        characterLimitMode: v.optional(
          v.union(proposalCharacterLimitModeChoice, v.null()),
        ),
        characterLimitValue: v.optional(v.union(v.number(), v.null())),
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

    const profiles = await listProfilesForClerk(ctx, identity.subject);
    if (profiles.length === 0) return [];

    const proposalGroups = await Promise.all(
      profiles.map((profile) =>
        ctx.db
          .query("proposals")
          .withIndex("by_user_and_status", (q) =>
            q.eq("userId", profile._id).eq("status", "saved"),
          )
          .collect(),
      ),
    );

    const proposals = proposalGroups.flat();

    const savedProposals = proposals
      .filter((proposal) => proposal.status === "saved")
      .sort((left, right) => right._creationTime - left._creationTime)
      .slice(0, 10);

    // Project proposals to the exact public return shape so added storage fields
    // do not trigger ReturnsValidationError in client-facing queries.
    return savedProposals.map((proposal) => ({
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
        sourceUrl: proposal.metadata.sourceUrl ?? undefined,
        planned_path: proposal.metadata.planned_path ?? undefined,
        executed_path: proposal.metadata.executed_path ?? undefined,
        fallback_reason: proposal.metadata.fallback_reason ?? undefined,
        validator_outcome: proposal.metadata.validator_outcome ?? undefined,
        save_outcome: proposal.metadata.save_outcome ?? undefined,
        requestedModelType: proposal.metadata.requestedModelType ?? undefined,
        actualModelType: proposal.metadata.actualModelType ?? undefined,
        fallbackTriggerCode: proposal.metadata.fallbackTriggerCode ?? undefined,
        voicePreset: proposal.metadata.voicePreset ?? undefined,
        requestedVoicePreset:
          proposal.metadata.requestedVoicePreset ?? undefined,
        resolvedVoicePreset:
          proposal.metadata.resolvedVoicePreset ?? undefined,
        autoToneDecisionVersion:
          proposal.metadata.autoToneDecisionVersion ?? undefined,
        autoToneReason: proposal.metadata.autoToneReason ?? undefined,
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
        styleLinkMode: proposal.metadata.styleLinkMode ?? undefined,
        styleChoice: proposal.metadata.styleChoice ?? undefined,
        templateBundleId: proposal.metadata.templateBundleId ?? undefined,
        typographyOverride: proposal.metadata.typographyOverride ?? undefined,
        layoutOverride: proposal.metadata.layoutOverride ?? undefined,
        applicantName: proposal.metadata.applicantName ?? undefined,
        applicantRole: proposal.metadata.applicantRole ?? undefined,
        contactLine: proposal.metadata.contactLine ?? undefined,
        letterDate: proposal.metadata.letterDate ?? undefined,
        recipientDetails: proposal.metadata.recipientDetails ?? undefined,
        headerShowSender: proposal.metadata.headerShowSender ?? undefined,
        headerShowDate: proposal.metadata.headerShowDate ?? undefined,
        headerShowSubject: proposal.metadata.headerShowSubject ?? undefined,
        headerShowRecipient: proposal.metadata.headerShowRecipient ?? undefined,
        headerShowRecipientDetails:
          proposal.metadata.headerShowRecipientDetails ?? undefined,
        characterLimitMode:
          proposal.metadata.characterLimitMode ?? undefined,
        characterLimitValue:
          proposal.metadata.characterLimitValue ?? undefined,
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
