import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { PROPOSAL_TEMPLATE_IDS } from "./lib/proposals/renderTemplates";
import { getPrimaryProfileForClerk } from "./lib/userProfiles";

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

export default mutation({
  args: {
    title: v.string(),
    content: v.string(),
    profileId: v.optional(v.string()),
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
        sourceUrl: v.optional(v.string()),
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
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    let user = args.profileId
      ? await ctx.db
          .query("userProfiles")
          .withIndex("by_profileId", (q) => q.eq("profileId", args.profileId!))
          .filter((q) => q.eq(q.field("clerkId"), identity.subject))
          .first()
      : await getPrimaryProfileForClerk(ctx, identity.subject);

    if (!user) {
      await ctx.runMutation(internal.users.createOrUpdateUser, {
        clerkId: identity.subject,
        email: identity.email ?? "unknown@example.com",
        name: identity.name,
      });
      user = await getPrimaryProfileForClerk(ctx, identity.subject);
    }

    if (!user) throw new Error("User not found");

    const trimmedContent = args.content.trim();
    if (!trimmedContent) {
      throw new Error("Proposal content is required");
    }

    const trimmedTitle = args.title.trim() || "Generated proposal";
    const now = Date.now();

    return ctx.db.insert("proposals", {
      userId: user._id,
      title: trimmedTitle,
      content: trimmedContent,
      status: args.status ?? "saved",
      version: 1,
      createdAt: now,
      updatedAt: now,
      sections:
        Array.isArray(args.sections) && args.sections.length > 0
          ? args.sections
          : [{ type: "text", content: trimmedContent }],
      metrics: {
        score: 0,
        confidence: 0,
      },
      metadata: args.metadata ?? {},
    });
  },
});
