import { internalMutation, internalQuery } from "./_generated/server";
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

const proposalClosingChoice = v.object({
  enabled: v.boolean(),
  signOff: v.string(),
  signatureName: v.string(),
  source: v.union(
    v.literal("settings"),
    v.literal("document"),
    v.literal("legacy"),
    v.literal("language_default"),
    v.literal("custom"),
  ),
  closingNeedsUserChoice: v.optional(v.boolean()),
  handwrittenSignatureEnabled: v.optional(v.boolean()),
});

const proposalDocumentDecorationChoice = v.object({
  visible: v.boolean(),
  source: v.literal("upload"),
  assetId: v.optional(v.string()),
  dataUrl: v.optional(v.string()),
  fileName: v.optional(v.string()),
  mimeType: v.optional(
    v.union(
      v.literal("image/png"),
      v.literal("image/jpeg"),
      v.literal("image/svg+xml"),
    ),
  ),
  alt: v.optional(v.string()),
  sizePreset: v.union(
    v.literal(18),
    v.literal(35),
    v.literal(52),
    v.literal("custom"),
  ),
  customSizeMm: v.optional(v.number()),
  fit: v.union(v.literal("contain"), v.literal("cover")),
  placementMode: v.union(v.literal("default"), v.literal("custom")),
  xMm: v.optional(v.number()),
  yMm: v.optional(v.number()),
});

const proposalVerbatiStyleChoice = v.object({
  layout: v.string(),
  typography: v.string(),
  palette: v.string(),
  accentHex: v.optional(v.string()),
});

const documentStyleSlotIdChoice = v.union(
  v.literal(1),
  v.literal(2),
  v.literal(3),
);

const documentStyleSlotSourceChoice = v.union(
  v.literal("factory"),
  v.literal("settings"),
);

const documentAppearanceSnapshotChoice = v.object({
  familyId: v.optional(v.string()),
  layout: v.string(),
  typography: v.string(),
  palette: v.string(),
  accentHex: v.optional(v.string()),
});

const documentIconSettingsChoice = v.object({
  listMarkerType: v.optional(
    v.union(v.literal("dot"), v.literal("dash"), v.literal("icon")),
  ),
  defaultListMarkerKey: v.optional(v.union(v.string(), v.null())),
  sectionHeadingIconMode: v.union(
    v.literal("none"),
    v.literal("auto"),
    v.literal("custom"),
  ),
  sectionIconMap: v.optional(v.record(v.string(), v.string())),
  color: v.union(v.literal("ink"), v.literal("muted"), v.literal("accent")),
  sizePt: v.union(v.literal(8), v.literal(9), v.literal(10), v.literal(12)),
});

export const storeProposal = internalMutation({
  args: {
    userId: v.id("userProfiles"),
    jobId: v.optional(v.string()),
    title: v.string(),
    content: v.string(),
    status: v.string(),
    version: v.number(),
    createdAt: v.number(),
    updatedAt: v.number(),
    sections: v.array(
      v.object({
        type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
        content: v.string(),
      }),
    ),
    metrics: v.object({
      score: v.optional(v.number()),
      confidence: v.optional(v.number()),
    }),
    metadata: v.object({
      platform: v.optional(v.string()),
      jobId: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      sourceJobTitle: v.optional(v.string()),
      sourceJobDescription: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
      sourceCvId: v.optional(v.string()),
      planned_path: v.optional(v.string()),
      executed_path: v.optional(v.string()),
      fallback_reason: v.optional(v.string()),
      validator_outcome: v.optional(v.string()),
      save_outcome: v.optional(v.string()),
      requestedModelType: v.optional(v.string()),
      actualModelType: v.optional(v.string()),
      actualModelName: v.optional(v.string()),
      fallbackTriggerCode: v.optional(v.string()),
      premium_path_saved: v.optional(v.union(v.boolean(), v.null())),
      premium_validation_passed: v.optional(v.union(v.boolean(), v.null())),
      premium_quality_shadow_passed: v.optional(v.union(v.boolean(), v.null())),
      premium_quality_gate_passed: v.optional(v.union(v.boolean(), v.null())),
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
      verbatiStyleSlotId: v.optional(documentStyleSlotIdChoice),
      verbatiStyleSlotSource: v.optional(documentStyleSlotSourceChoice),
      verbatiStyleSlotNameSnapshot: v.optional(v.string()),
      verbatiStyleBaseSnapshot: v.optional(documentAppearanceSnapshotChoice),
      documentStyleVersion: v.optional(v.literal(1)),
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
      applicantCompany: v.optional(v.string()),
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
      requestedLanguage: v.optional(v.union(v.string(), v.null())),
      resolvedLanguage: v.optional(v.union(v.string(), v.null())),
      languageSource: v.optional(v.union(v.string(), v.null())),
      jobDetectedLanguage: v.optional(v.union(v.string(), v.null())),
      closing: v.optional(proposalClosingChoice),
      documentDecoration: v.optional(proposalDocumentDecorationChoice),
      documentIcons: v.optional(documentIconSettingsChoice),
      proposalType: v.optional(
        v.union(
          v.literal("cover_letter"),
          v.literal("application_message"),
          v.literal("freelance_proposal"),
        ),
      ),
    }),
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("proposals", args);
  },
});

export const getProposal = internalQuery({
  args: {
    id: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    return ctx.db.get(args.id);
  },
});

export const listUserProposals = internalQuery({
  args: {
    userId: v.id("userProfiles"),
  },
  handler: async (ctx, args) => {
    return ctx.db
      .query("proposals")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
  },
});

export const updateProposal = internalMutation({
  args: {
    id: v.id("proposals"),
    jobId: v.optional(v.string()),
    sections: v.array(
      v.object({
        type: v.union(v.literal("text"), v.literal("code"), v.literal("image")),
        content: v.string(),
      }),
    ),
    metrics: v.object({
      score: v.optional(v.number()),
      confidence: v.optional(v.number()),
    }),
    metadata: v.object({
      platform: v.optional(v.string()),
      jobId: v.optional(v.string()),
      tags: v.optional(v.array(v.string())),
      sourceJobTitle: v.optional(v.string()),
      sourceJobDescription: v.optional(v.string()),
      sourceUrl: v.optional(v.string()),
      sourceCvId: v.optional(v.string()),
      planned_path: v.optional(v.string()),
      executed_path: v.optional(v.string()),
      fallback_reason: v.optional(v.string()),
      validator_outcome: v.optional(v.string()),
      save_outcome: v.optional(v.string()),
      requestedModelType: v.optional(v.string()),
      actualModelType: v.optional(v.string()),
      actualModelName: v.optional(v.string()),
      fallbackTriggerCode: v.optional(v.string()),
      premium_path_saved: v.optional(v.union(v.boolean(), v.null())),
      premium_validation_passed: v.optional(v.union(v.boolean(), v.null())),
      premium_quality_shadow_passed: v.optional(v.union(v.boolean(), v.null())),
      premium_quality_gate_passed: v.optional(v.union(v.boolean(), v.null())),
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
      verbatiStyleSlotId: v.optional(documentStyleSlotIdChoice),
      verbatiStyleSlotSource: v.optional(documentStyleSlotSourceChoice),
      verbatiStyleSlotNameSnapshot: v.optional(v.string()),
      verbatiStyleBaseSnapshot: v.optional(documentAppearanceSnapshotChoice),
      documentStyleVersion: v.optional(v.literal(1)),
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
      applicantCompany: v.optional(v.string()),
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
      requestedLanguage: v.optional(v.union(v.string(), v.null())),
      resolvedLanguage: v.optional(v.union(v.string(), v.null())),
      languageSource: v.optional(v.union(v.string(), v.null())),
      jobDetectedLanguage: v.optional(v.union(v.string(), v.null())),
      closing: v.optional(proposalClosingChoice),
      documentDecoration: v.optional(proposalDocumentDecorationChoice),
      documentIcons: v.optional(documentIconSettingsChoice),
      proposalType: v.optional(
        v.union(
          v.literal("cover_letter"),
          v.literal("application_message"),
          v.literal("freelance_proposal"),
        ),
      ),
    }),
    status: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const deleteProposal = internalMutation({
  args: {
    id: v.id("proposals"),
  },
  handler: async (ctx, args) => {
    return ctx.db.delete(args.id);
  },
});
