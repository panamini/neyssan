import type { Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { query } from "./_generated/server";
import type { Infer } from "convex/values";
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
  assetMissing: v.optional(v.boolean()),
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

type ProposalDocumentDecoration = Infer<typeof proposalDocumentDecorationChoice>;

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

function projectDocumentAppearanceSnapshot(value: unknown) {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const snapshot = value as Record<string, unknown>;
  if (
    typeof snapshot.layout !== "string" ||
    typeof snapshot.typography !== "string" ||
    typeof snapshot.palette !== "string"
  ) {
    return undefined;
  }

  return {
    familyId:
      typeof snapshot.familyId === "string" ? snapshot.familyId : undefined,
    layout: snapshot.layout,
    typography: snapshot.typography,
    palette: snapshot.palette,
    accentHex:
      typeof snapshot.accentHex === "string" ? snapshot.accentHex : undefined,
  };
}

async function resolveRuntimeDocumentDecoration(
  ctx: QueryCtx,
  decoration: unknown,
  resolvedUrlCache: Map<string, string | null>,
): Promise<ProposalDocumentDecoration | undefined> {
  const projected = projectProposalDocumentDecoration(decoration);
  if (!projected) return undefined;

  const {
    dataUrl: _dataUrl,
    resolvedUrl: _resolvedUrl,
    assetMissing: _assetMissing,
    ...safeDecoration
  } = projected;
  const next: ProposalDocumentDecoration = { ...safeDecoration };

  if (!next.assetId) {
    return next;
  }

  let resolvedUrl = resolvedUrlCache.get(next.assetId);
  if (resolvedUrl === undefined) {
    try {
      const storageUrl = await ctx.storage.getUrl(next.assetId as Id<"_storage">);
      resolvedUrl = typeof storageUrl === "string" && storageUrl ? storageUrl : null;
    } catch {
      resolvedUrl = null;
    }
    resolvedUrlCache.set(next.assetId, resolvedUrl);
  }

  if (resolvedUrl) {
    next.resolvedUrl = resolvedUrl;
  } else {
    next.assetMissing = true;
  }

  return next;
}

function projectProposalDocumentDecoration(
  value: unknown,
): ProposalDocumentDecoration | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const record = value as Record<string, unknown>;
  if (
    typeof record.visible !== "boolean" ||
    record.source !== "upload" ||
    !isDocumentDecorationSizePreset(record.sizePreset) ||
    !isDocumentDecorationFit(record.fit) ||
    !isDocumentDecorationPlacementMode(record.placementMode)
  ) {
    return undefined;
  }

  const mimeType = isDocumentDecorationMimeType(record.mimeType)
    ? record.mimeType
    : undefined;

  return {
    visible: record.visible,
    source: "upload",
    ...(typeof record.suppressed === "boolean" ? { suppressed: record.suppressed } : {}),
    ...(typeof record.assetId === "string" ? { assetId: record.assetId } : {}),
    ...(typeof record.dataUrl === "string" ? { dataUrl: record.dataUrl } : {}),
    ...(typeof record.resolvedUrl === "string" ? { resolvedUrl: record.resolvedUrl } : {}),
    ...(typeof record.assetMissing === "boolean" ? { assetMissing: record.assetMissing } : {}),
    ...(typeof record.fileName === "string" ? { fileName: record.fileName } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(typeof record.alt === "string" ? { alt: record.alt } : {}),
    sizePreset: record.sizePreset,
    ...(typeof record.customSizeMm === "number" ? { customSizeMm: record.customSizeMm } : {}),
    fit: record.fit,
    placementMode: record.placementMode,
    ...(typeof record.xMm === "number" ? { xMm: record.xMm } : {}),
    ...(typeof record.yMm === "number" ? { yMm: record.yMm } : {}),
  };
}

function isDocumentDecorationSizePreset(
  value: unknown,
): value is ProposalDocumentDecoration["sizePreset"] {
  return value === 18 || value === 35 || value === 52 || value === "custom";
}

function isDocumentDecorationFit(
  value: unknown,
): value is ProposalDocumentDecoration["fit"] {
  return value === "contain" || value === "cover";
}

function isDocumentDecorationPlacementMode(
  value: unknown,
): value is ProposalDocumentDecoration["placementMode"] {
  return value === "default" || value === "custom";
}

function isDocumentDecorationMimeType(
  value: unknown,
): value is NonNullable<ProposalDocumentDecoration["mimeType"]> {
  return value === "image/png" || value === "image/jpeg" || value === "image/svg+xml";
}

/**
 * Public query to list the most recent proposal library rows for the authenticated user.
 * Returns both autosaved drafts and finalized saved proposals.
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
        pageSize: v.optional(v.union(v.literal("a4"), v.literal("letter"))),
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
          .withIndex("by_user", (q) => q.eq("userId", profile._id))
          .collect(),
      ),
    );

    const proposals = proposalGroups.flat();

    const publicProposalStatuses = new Set([
      "draft",
      "saved",
      "sent",
      "exported",
      "submitted",
    ]);
    const libraryProposals = proposals
      .filter((proposal) => publicProposalStatuses.has(proposal.status))
      .sort((left, right) => right._creationTime - left._creationTime)
      .slice(0, 30);

    // Project proposals to the exact public return shape so added storage fields
    // do not trigger ReturnsValidationError in client-facing queries.
    const resolvedUrlCache = new Map<string, string | null>();

    return Promise.all(libraryProposals.map(async (proposal) => ({
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
        jobId: proposal.metadata.jobId ?? proposal.jobId ?? undefined,
        tags: proposal.metadata.tags ?? undefined,
        sourceJobTitle: proposal.metadata.sourceJobTitle ?? undefined,
        sourceJobDescription:
          proposal.metadata.sourceJobDescription ?? undefined,
        sourceUrl: proposal.metadata.sourceUrl ?? undefined,
        sourceCvId: proposal.metadata.sourceCvId ?? undefined,
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
        resolvedVoicePreset: proposal.metadata.resolvedVoicePreset ?? undefined,
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
        verbatiStyleSlotId: proposal.metadata.verbatiStyleSlotId ?? undefined,
        verbatiStyleSlotSource:
          proposal.metadata.verbatiStyleSlotSource ?? undefined,
        verbatiStyleSlotNameSnapshot:
          proposal.metadata.verbatiStyleSlotNameSnapshot ?? undefined,
        verbatiStyleBaseSnapshot: projectDocumentAppearanceSnapshot(
          proposal.metadata.verbatiStyleBaseSnapshot,
        ),
        documentStyleVersion:
          proposal.metadata.documentStyleVersion ?? undefined,
        styleLinkMode: proposal.metadata.styleLinkMode ?? undefined,
        styleChoice: proposal.metadata.styleChoice ?? undefined,
        templateBundleId: proposal.metadata.templateBundleId ?? undefined,
        typographyOverride: proposal.metadata.typographyOverride ?? undefined,
        layoutOverride: proposal.metadata.layoutOverride ?? undefined,
        applicantName: proposal.metadata.applicantName ?? undefined,
        applicantRole: proposal.metadata.applicantRole ?? undefined,
        applicantCompany: proposal.metadata.applicantCompany ?? undefined,
        contactLine: proposal.metadata.contactLine ?? undefined,
        letterDate: proposal.metadata.letterDate ?? undefined,
        recipientDetails: proposal.metadata.recipientDetails ?? undefined,
        headerShowSender: proposal.metadata.headerShowSender ?? undefined,
        headerShowDate: proposal.metadata.headerShowDate ?? undefined,
        headerShowSubject: proposal.metadata.headerShowSubject ?? undefined,
        headerShowRecipient: proposal.metadata.headerShowRecipient ?? undefined,
        headerShowRecipientDetails:
          proposal.metadata.headerShowRecipientDetails ?? undefined,
        characterLimitMode: proposal.metadata.characterLimitMode ?? undefined,
        characterLimitValue: proposal.metadata.characterLimitValue ?? undefined,
        requestedLanguage: proposal.metadata.requestedLanguage ?? undefined,
        resolvedLanguage: proposal.metadata.resolvedLanguage ?? undefined,
        pageSize: proposal.metadata.pageSize ?? undefined,
        languageSource: proposal.metadata.languageSource ?? undefined,
        jobDetectedLanguage:
          proposal.metadata.jobDetectedLanguage ?? undefined,
        closing: proposal.metadata.closing ?? undefined,
        documentDecoration:
          proposal.metadata.documentDecoration !== undefined
            ? await resolveRuntimeDocumentDecoration(
                ctx,
                proposal.metadata.documentDecoration,
                resolvedUrlCache,
              )
            : undefined,
        documentIcons: proposal.metadata.documentIcons ?? undefined,
        proposalDocument: proposal.metadata.proposalDocument ?? undefined,
        proposalDocumentRevision:
          proposal.metadata.proposalDocumentRevision ?? undefined,
        proposalDocumentUpdatedAt:
          proposal.metadata.proposalDocumentUpdatedAt ?? undefined,
        proposalType: proposal.metadata.proposalType ?? undefined,
      },
      metrics: {
        score: proposal.metrics.score ?? undefined,
        confidence: proposal.metrics.confidence ?? undefined,
      },
      version: proposal.version ?? undefined,
    })));
  },
});
