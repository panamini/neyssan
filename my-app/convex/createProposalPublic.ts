/* eslint-disable @typescript-eslint/no-unnecessary-type-assertion -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import { mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { PROPOSAL_TEMPLATE_IDS } from "./lib/proposals/renderTemplates";
import { getPrimaryProfileForClerk } from "./lib/userProfiles";
import { sanitizeRemoteMetadataImages } from "./lib/documentAssets";

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
  suppressed: v.optional(v.boolean()),
  assetId: v.optional(v.string()),
  dataUrl: v.optional(v.string()),
  resolvedUrl: v.optional(v.string()),
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

const PROPOSAL_STYLE_TRACE_MARKER = "[proposal-style-trace]";

function isProposalStyleTraceEnabled(): boolean {
  return /^(?:1|true|yes)$/i.test(
    (process.env.ENABLE_PROPOSAL_STYLE_TRACE ?? "").trim(),
  );
}

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
        premium_quality_shadow_passed: v.optional(
          v.union(v.boolean(), v.null()),
        ),
        premium_quality_gate_passed: v.optional(v.union(v.boolean(), v.null())),
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
        closing: v.optional(proposalClosingChoice),
        documentDecoration: v.optional(proposalDocumentDecorationChoice),
        documentIcons: v.optional(documentIconSettingsChoice),
        proposalDocument: v.optional(v.any()),
        proposalDocumentRevision: v.optional(v.number()),
        proposalDocumentUpdatedAt: v.optional(v.number()),
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

    if (isProposalStyleTraceEnabled()) {
      console.info(PROPOSAL_STYLE_TRACE_MARKER, {
        route: "createProposalPublic",
        step: "create-proposal-public:before-insert",
        proposalId: null,
        generatedProposalId: null,
        selectedProposalId: null,
        composeToken: null,
        persistedToken: null,
        winnerSource: "server_row",
        winnerReason: "public mutation received create payload",
        rawServerRow: null,
        rawQueryRow: null,
        rawLocalOutputDraft: null,
        rawSessionOutputDraft: null,
        rawComposeDraft: null,
        rawCvStyleSource: null,
        resolvedRenderState: {
          proposalId: null,
          metadata: snapshotTraceMetadata(args.metadata),
        },
      });
    }

    const sanitizedMetadata = sanitizeRemoteMetadataImages(
      args.metadata ?? {},
    ) as NonNullable<typeof args.metadata>;

    const proposalId = await ctx.db.insert("proposals", {
      userId: user._id,
      jobId: args.metadata?.jobId,
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
      metadata: sanitizedMetadata,
    });

    if (isProposalStyleTraceEnabled()) {
      const insertedProposal = await ctx.db.get(proposalId);
      console.info(PROPOSAL_STYLE_TRACE_MARKER, {
        route: "createProposalPublic",
        step: "create-proposal-public:after-insert",
        proposalId: String(proposalId),
        generatedProposalId: String(proposalId),
        selectedProposalId: null,
        composeToken: null,
        persistedToken: null,
        winnerSource: "server_row",
        winnerReason: "server row after insert",
        rawServerRow: snapshotTraceRow(insertedProposal),
        rawQueryRow: null,
        rawLocalOutputDraft: null,
        rawSessionOutputDraft: null,
        rawComposeDraft: null,
        rawCvStyleSource: null,
        resolvedRenderState: snapshotTraceRow(insertedProposal),
      });
    }

    return proposalId;
  },
});
