import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { PROPOSAL_TEMPLATE_IDS } from "./lib/proposals/renderTemplates";
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

const proposalClosingChoice = v.object({
  enabled: v.boolean(),
  signOff: v.string(),
  signatureName: v.string(),
  source: v.union(
    v.literal("settings"),
    v.literal("document"),
    v.literal("legacy"),
  ),
  handwrittenSignatureEnabled: v.optional(v.boolean()),
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

const PROPOSAL_STYLE_TRACE_MARKER = "[proposal-style-trace]";

function snapshotTraceMetadata(
  metadata:
    | {
        templateId?: string;
        verbatiStyle?: {
          layout?: string;
          typography?: string;
          palette?: string;
          accentHex?: string;
        };
        sourceCvId?: string;
        styleLinkMode?: string;
      }
    | undefined,
) {
  return {
    templateId: metadata?.templateId ?? null,
    verbatiStyle: metadata?.verbatiStyle
      ? {
          layout: metadata.verbatiStyle.layout ?? null,
          typography: metadata.verbatiStyle.typography ?? null,
          palette: metadata.verbatiStyle.palette ?? null,
          accentHex: metadata.verbatiStyle.accentHex ?? null,
        }
      : null,
    sourceCvId: metadata?.sourceCvId ?? null,
    styleLinkMode: metadata?.styleLinkMode ?? null,
  };
}

function snapshotTraceRow(
  proposal: {
    _id: unknown;
    title?: string;
    status?: string;
    metadata?: {
      templateId?: string;
      verbatiStyle?: {
        layout?: string;
        typography?: string;
        palette?: string;
        accentHex?: string;
      };
      sourceCvId?: string;
      styleLinkMode?: string;
    };
  } | null,
) {
  if (!proposal) {
    return null;
  }

  return {
    proposalId: String(proposal._id),
    title: proposal.title ?? null,
    status: proposal.status ?? null,
    metadata: snapshotTraceMetadata(proposal.metadata),
  };
}

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
        requestedLanguage: v.optional(v.union(v.string(), v.null())),
        resolvedLanguage: v.optional(v.union(v.string(), v.null())),
        languageSource: v.optional(v.string()),
        jobDetectedLanguage: v.optional(v.union(v.string(), v.null())),
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
        closing: v.optional(proposalClosingChoice),
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

    const ownedProfiles = await listProfilesForClerk(ctx, identity.subject);
    const ownedProfileIds = new Set(
      ownedProfiles.map((profile) => String(profile._id)),
    );

    const proposal = await ctx.db.get(args.id);
    if (!proposal) throw new Error("Proposal not found");
    if (!ownedProfileIds.has(String(proposal.userId)))
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
      jobId?: string;
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
      console.info(PROPOSAL_STYLE_TRACE_MARKER, {
        route: "updateProposalPublic",
        step: "update-proposal-public:before-patch",
        proposalId: String(args.id),
        generatedProposalId: String(args.id),
        selectedProposalId: null,
        composeToken: null,
        persistedToken: null,
        winnerSource: "server_row",
        winnerReason: "public mutation received metadata patch",
        rawServerRow: snapshotTraceRow(proposal),
        rawQueryRow: null,
        rawLocalOutputDraft: null,
        rawSessionOutputDraft: null,
        rawComposeDraft: null,
        rawCvStyleSource: null,
        resolvedRenderState: {
          proposalId: String(args.id),
          metadata: snapshotTraceMetadata(args.metadata),
        },
      });
      patch.metadata = {
        ...proposal.metadata,
        ...args.metadata,
      };
      patch.jobId = args.metadata?.jobId ?? proposal.jobId;
    }

    await ctx.db.patch(args.id, patch);

    if (hasMetadataPatch) {
      const updatedProposal = await ctx.db.get(args.id);
      console.info(PROPOSAL_STYLE_TRACE_MARKER, {
        route: "updateProposalPublic",
        step: "update-proposal-public:after-patch",
        proposalId: String(args.id),
        generatedProposalId: String(args.id),
        selectedProposalId: null,
        composeToken: null,
        persistedToken: null,
        winnerSource: "server_row",
        winnerReason: "server row after metadata patch",
        rawServerRow: snapshotTraceRow(updatedProposal),
        rawQueryRow: null,
        rawLocalOutputDraft: null,
        rawSessionOutputDraft: null,
        rawComposeDraft: null,
        rawCvStyleSource: null,
        resolvedRenderState: snapshotTraceRow(updatedProposal),
      });
    }

    return { success: true };
  },
});
