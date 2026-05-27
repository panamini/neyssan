import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { v4 as uuidv4 } from "uuid";
import {
  ArrowSquareOut,
  Briefcase,
  CaretRight,
  Check,
  DotsThree,
  FileUser,
  FolderSimple,
  FolderTree,
  PaperPlaneRight,
  Paperclip,
  TrashSimple,
  X,
} from "@/lib/icons";
import { Menu, type MenuSection } from "../components/ui/menu";
import ProposalInputForm, {
  type ProposalGenerateControl,
} from "../components/ProposalInputForm";
import ProposalAIStream from "../components/proposal/ProposalAIStream";
import ProposalDocumentStage, {
  type ProposalDocumentStageLabels,
} from "../components/proposal/ProposalDocumentStage";
import ProposalHeadingFields, {
  type ProposalHeadingField,
} from "../components/proposal/ProposalHeadingFields";
import ProposalDesignFields from "../components/proposal/ProposalDesignFields";
import ProposalRail, {
  type ProposalRailAskReview,
  type ProposalRailJobMatchSummary,
  type ProposalRailTab,
} from "../components/proposal/ProposalRail";
import ComposerDrawer from "../components/ComposerDrawer";
import {
  CoverLetterStartSurface,
  type CoverLetterStartSurfaceImportState,
} from "../components/CoverLetterStartSurface";
import ProposalDisplay, {
  fallbackCopyText,
  getDisplayedProposalText,
} from "../components/ProposalDisplay";
import ProposalsList from "../components/ProposalsList";
import { type SaveStatus } from "../components/ui/SaveIndicator";
import { useToast } from "../components/ui/toast";
import { AUTH_REQUIRED_TOAST } from "../lib/toast-copy";
import type { FormValues } from "../components/ProposalInputForm.schemas";
import {
  beginStructuredImportTimingTrace,
  logStructuredImportTiming,
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT,
  type StructuredImportTimingTrace,
  useStructuredMistralImport,
} from "../components/useStructuredMistralImport";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import {
  useForgeTemplatePanel,
  useRegisterForgePanel,
  useRegisterForgeTemplates,
} from "../contexts/ForgeTemplatePanelContext";
import { useRegisterProposalForgeTopbar } from "../contexts/ProposalForgeTopbarContext";
import {
  DrawerDocumentTile,
  DrawerUnavailableThumbnail,
} from "../components/library/LibraryDocumentPreview";
import { api } from "../../convex/_generated/api";
import {
  buildAppProposalPersonalizationPayload,
  getProposalApplicantHeaderData,
  getProposalApplicantIdentity,
  getLocalPersonalizationSourceByCvId,
  getLocalActiveCvSnapshotById,
  getLocalCvDocumentById,
  getProposalAttachedCvId,
  listLocalCvPickerOptions,
  setProposalAttachedCvId,
  clearProposalAttachedCvId,
  type ProposalApplicantHeaderData,
} from "../lib/proposal-personalization";
import { type ProposalGenerationFallbackInfo } from "../lib/proposal-generation-ui";
import {
  readStoredProposalOutputDraft,
  resolveProposalStoredText,
  type StoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../lib/proposal-output-draft";
import type {
  DocumentLanguageGenerationMetadata,
  DocumentLanguageSource,
} from "../lib/document-language";
import {
  PROPOSAL_DRAWER_QUERY_PARAM,
  PROPOSAL_DRAFT_DRAWER_QUERY_VALUE,
  readProposalEntryIntent,
  readProposalDrawerRouteIntent,
  readProposalJobImportFocus,
  readProposalWorkspaceResetToken,
  readStoredProposalComposeDraft,
  startFreshProposalWorkspace,
  writeStoredProposalComposeDraft,
  type StoredProposalComposeDraft,
} from "../lib/proposal-workspace-state";
import { createQuickStartLocationState } from "../lib/quick-start-routing";
import { translateUi } from "../lib/i18n";
import { useUiLanguagePreference } from "../lib/ui-preferences";
import { readStoredSavedProposalFixtures } from "../lib/proposal-saved-fixtures";
import { resolveProposalStyleCommitTemplateId } from "../lib/proposal-style-commit";
import {
  CANONICAL_PROPOSAL_TEMPLATE_ID,
  PROPOSAL_TEMPLATE_DEFINITIONS,
  isProposalTemplateId,
  resolveProposalTemplateId,
  type ProposalTemplateId,
} from "../../convex/lib/proposals/renderTemplates";
import {
  DEFAULT_VERBATI_STYLE,
  getProposalTwinTemplateId,
  getVerbatiStyleFromCv,
  resolveVerbatiStyle,
  serializeVerbatiStyle,
  stylesEqual,
} from "../features/verbati/style";
import {
  resolveProposalCharacterLimitSelection,
  type ProposalCharacterLimitMode,
} from "../../convex/lib/proposals/generationControls";
import type { Id } from "../../convex/_generated/dataModel";
import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  resolveProposalVoicePreset as normalizeProposalVoicePresetId,
} from "../../convex/lib/proposals/voicePresets";
import { selectAutoTone } from "../../convex/lib/proposals/autoToneSelector";
import {
  resolveProposalStyleLinkMode,
  type ProposalStyleLinkMode,
} from "../lib/proposal-style-link";
import { resolveProposalRenderState } from "../lib/proposal-render-state";
import {
  buildProposalSourceSummary,
  sanitizeProposalCompanyName,
} from "../lib/proposal-source-summary";
import {
  buildProposalSourceDraftFromJob,
  resolveProposalWorkspaceSourceDraft,
  type ResolvedProposalWorkspaceSourceDraft,
} from "../lib/proposal-job-context";
import { getProposalExtensionSourceLinks } from "../lib/proposal-source-platforms";
import { formatUiDate } from "../lib/ui-date";
import {
  resolveProposalStyleChoice,
  resolveProposalStyleChoiceFromRenderState,
  resolveProposalStyleRenderState,
  type ProposalStyleChoice,
} from "../lib/proposal-style-choice";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";
import {
  buildWorkLibraryModel,
  type LibraryItem,
  type LibraryProposalRecord,
} from "../lib/application-library";
import {
  downloadLibraryItems,
  isLibraryItemDownloadable,
} from "../lib/library-download";
import { useJobsQuery, type JobsQueryListItem } from "../hooks/useJobsQuery";
import {
  isProposalPaletteId,
  type ProposalPaletteId,
} from "../lib/proposal-style-display";
import {
  resolveProposalStyle,
  resolveProposalStyleStatus,
} from "../features/verbati/styleState";
import type { VerbatiStylePreset } from "../features/verbati/types";
import {
  DOCUMENT_STYLE_VERSION,
  buildProposalDocumentAppearanceSnapshot,
  getFactoryDocumentStyleSlot,
  getDocumentStyleSlotIdForProposalBundle,
  getProposalBundleForDocumentStyleSlot,
  resolveDocumentStyleSlotId,
  type DocumentStyleSlotId,
  type DocumentStyleMetadata,
} from "../lib/document-style-slots";
import {
  findProposalTemplateBundleIdByStylePreset,
  getProposalTemplateBundleDefinition,
  resolveProposalTemplateBundleId,
  type ProposalTemplateBundleId,
} from "../lib/proposal-template-bundles";
import { readCssDurationMs, readCssPixelValue } from "../lib/readCssDuration";
import { deriveCvTitleFromSections } from "../lib/normalize-cv";
import {
  buildProposalHeaderVisibilityFromContent,
  buildProposalLetterDateLine,
  buildProposalRecipientPrefill,
  buildProposalSalutation,
  readProposalSalutation,
  replaceProposalSalutation,
  resolveProposalHeaderVisibility,
  type ProposalHeaderVisibility,
} from "../lib/proposal-header";
import {
  buildProposalApplicantContactLine,
  buildProposalContactLineFromParts,
  buildProposalApplicantHeaderFromMetadata,
  buildProposalHeadingMetadataPatch,
  mergeProposalContactDefaults,
  normalizeProposalContactLine,
  parseProposalContactLine,
  resolveAutoHeadingField,
  resolveProposalHeadingText,
  type ProposalStructuredContactFields,
} from "../lib/proposal-heading-state";
import {
  buildProposalExportSource,
  buildProposalPreviewPrintSource,
  buildProposalPrintDebugSnapshot,
} from "../lib/document-export-models";
import {
  buildProposalTypographyAuditMetadata,
  readProposalPreviewDebugCapture,
  setStyledProposalExportContext,
} from "../lib/document-export-debug";
import { A4_PAGE_WIDTH_PX } from "../lib/document-stage";
import { exportDocumentFile } from "../lib/exportDocumentFile";
import {
  ensureProposalSignatureName,
  removeProposalSignatureNameFromClosing,
  resolveProposalClosingRef,
  type ProposalClosingRef,
} from "../lib/proposal-closing";
import {
  sanitizeProposalSignatureSettings,
  type ProposalSignatureSettings,
} from "../lib/proposal-signature-settings";
import type { EditorAiJobContext } from "../lib/ai/editorAiJobContext";
import { normalizeEditorAiTextResult } from "../lib/ai/applyAiSuggestion";

type CurrentProposalSettings = {
  voicePreset: string;
  savedVoicePreset?: string | null;
  templateId: ProposalTemplateId;
  styleChoice?: ProposalStyleChoice;
  paletteOverride?: ProposalPaletteId | null;
  accentHex?: string | null;
  fontPairId?: string | null;
  verbatiStyle?: Partial<ReturnType<typeof resolveVerbatiStyle>> | null;
  sourceMode?: ProposalStyleLinkMode;
  signatureSettings?: ProposalSignatureSettings | null;
  proposalDefaultContactEmail?: string | null;
  proposalDefaultContactPhone?: string | null;
  proposalDefaultContactLinkedin?: string | null;
  proposalDefaultContactWebsite?: string | null;
  proposalDefaultContactLocation?: string | null;
};

function resolveProposalStyleSlotIntent(
  value: string | null | undefined,
): DocumentStyleSlotId | null {
  if (value === "minimal") return 1;
  if (value === "direct") return 2;
  if (value === "editorial") return 3;
  return null;
}

type ProposalSettingsPresetSlot = {
  fontPairId?: string | null;
  styleChoice?: ProposalStyleChoice;
  paletteOverride?: ProposalPaletteId | null;
  accentHex?: string | null;
  verbatiStyle?: Partial<ReturnType<typeof resolveVerbatiStyle>> | null;
} | null;

type ProposalSettingsPresets = {
  preset1: ProposalSettingsPresetSlot;
  preset2: ProposalSettingsPresetSlot;
  preset3: ProposalSettingsPresetSlot;
  activeSlot: DocumentStyleSlotId | null;
};
import {
  logProposalStyleTrace,
  readProposalStyleTraceStorageSnapshots,
  resolveOutputDraftWinnerSource,
  snapshotSavedProposalRecord,
  snapshotStoredComposeDraft,
  snapshotStoredOutputDraft,
  type ProposalStyleTraceMetadataSnapshot,
  type ProposalStyleTraceWinnerSource,
} from "../lib/proposal-style-trace";
import {
  isProposalLlmModelType,
  readStoredProposalLlmModel,
  useProposalLlmModelPreference,
} from "../lib/proposal-llm-preference";

type ProposalForgePrefill = {
  handoffId: string;
  jobId?: string;
  jobTitle: string;
  jobDescription: string;
  sourceUrl?: string;
  platform?: string;
} | null;

type ProposalForgeHandoffRecord = {
  handoffId: string;
  jobTitle: string;
  jobDescription: string;
  sourceUrl?: string;
  platform?: string;
  createdAt?: number;
} | null;

// Browser width-map audit confirmed the workspace's visible Proposal paper
// matches the renderer A4 width at the current design scale (~793.7px), while
// --forge-page-inline-size includes legacy frame/gutter space.
const PROPOSAL_PAPER_VISUAL_INLINE_SIZE = `${Math.round(A4_PAGE_WIDTH_PX * 100) / 100}px`;
// Mirrors --app-nav-panel-width-wide from foundation.css so docked drawer
// decisions use the remaining page column, not the full window width.
const FORGE_DOCKED_PANEL_INLINE_SIZE_PX = 320;
const FORGE_DOCKED_PANEL_MIN_VIEWPORT_WIDTH = 1180;

type ProposalForgeReviewItem = {
  id: string;
  fieldKey: string;
  label: string;
  reviewStatus: string;
  suggestedValue: unknown;
  approvedValue?: unknown;
  sourceText: string;
};

type ProposalForgeLinkedProposal = {
  id: string;
  title: string;
  status: string;
  updatedAt: number;
};

type ProposalForgeCanonicalJob = {
  id: string;
  title: string;
  company: string;
  sourceUrl: string;
  sourceDomain: string;
  sourceType: string;
  sourceLanguage?: string | null;
  applicationUrl: string;
  parseStatus: string;
  reviewState: string;
  lastOpenedAt?: number;
  summary: string;
  visibleSummary?: string | null;
  visibleRequirements?: string[];
  visibleKeywords?: string[];
  rawDescription: string;
  responsibilities: string[];
  keywords: string[];
  mustHaves: string[];
  toneCues: string[];
  contacts: string[];
  status: string;
  resumeId?: string;
  resumeName?: string;
  resumeSource?: "job" | "default";
  linkedProposalCount: number;
  linkedProposals: ProposalForgeLinkedProposal[];
  reviewItems: ProposalForgeReviewItem[];
  matchRead?: unknown | null;
  matchReview?: unknown | null;
} | null;

type ProposalForgeView = "compose" | "saved";

type ProposalRailMatchTone = ProposalRailJobMatchSummary["tone"];

type ProposalDraftDrawerProps = {
  jobTitle: string;
  jobMeta: string | null;
  jobSummary: string | null;
  jobContextKind: "empty" | "saved" | "pasted";
  stagedJobTitle?: string | null;
  stagedJobMeta?: string | null;
  stagedJobSummary?: string | null;
  stagedCvTitle?: string | null;
  sourceCvTitle: string | null;
  proposalTypeLabel: string;
  proposalTypeOptions: Array<{
    id: FormValues["proposalType"];
    label: string;
    description?: string;
    selected: boolean;
  }>;
  onSelectProposalType: (proposalType: FormValues["proposalType"]) => void;
  toneLabel: string;
  toneOptions: Array<{
    id: string | null;
    label: string;
    description: string;
    selected: boolean;
  }>;
  onSelectTone: (toneId: string | null) => void;
  generateLabel: string;
  generateDisabled: boolean;
  generateState: string;
  hasExistingDraft?: boolean;
  askReviewReady?: boolean;
  onGenerateDraft: () => void;
  onCancelStagedSource?: () => void;
  onOpenJobs: () => void;
  onOpenPasteJob?: () => void;
  onClearJobContext?: () => void;
  onOpenCvs: () => void;
  onClearCv: () => void;
};

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function readString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function shouldHonorStoredOutputDraftAppearance(
  draft: StoredProposalOutputDraft | null | undefined,
): draft is StoredProposalOutputDraft {
  if (!draft) return false;
  if (
    typeof draft.generatedProposalId === "string" &&
    draft.generatedProposalId
  ) {
    return true;
  }
  if (
    typeof draft.proposalContent === "string" &&
    draft.proposalContent.trim()
  ) {
    return true;
  }
  if (
    typeof draft.proposalDocumentTitle === "string" &&
    draft.proposalDocumentTitle.trim()
  ) {
    return true;
  }
  return false;
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is string =>
          typeof item === "string" && item.trim().length > 0,
      )
    : [];
}

function compactRailText(
  value: string | null | undefined,
  maxLength = 180,
): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/press\s+space\s+or\s+enter\s+keys?\s+to\s+toggle/i.test(normalized)) {
    return null;
  }
  return normalized.length > maxLength
    ? `${normalized.slice(0, maxLength - 1).trimEnd()}…`
    : normalized;
}

function compactStoredJobSummary(
  value: string | null | undefined,
): string | null {
  const normalized = value?.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (/^no\s+summary\.?$/i.test(normalized)) return "No summary";
  return compactRailText(normalized, 180);
}

const PROPOSAL_RAIL_ESTIMATED_CHARS_PER_PAGE = 2400;

function estimateProposalRailPageCount(
  content: string | null | undefined,
): number | null {
  const normalized = content?.trim() ?? "";
  if (!normalized) return null;
  return Math.max(
    1,
    Math.ceil(normalized.length / PROPOSAL_RAIL_ESTIMATED_CHARS_PER_PAGE),
  );
}

export function resolveLiveProposalLengthLabel(
  content: string | null | undefined,
): string | null {
  const characterCount = content?.trim().length ?? 0;
  if (characterCount === 0) return null;
  if (characterCount <= 1400) return "concise";
  if (characterCount <= 2600) return "standard";
  return "detailed";
}

function resolveProposalTopbarLengthLabel(args: {
  content: string | null | undefined;
  requestedLength: number | null;
}): "Concise" | "Standard" | "Detailed" | null {
  const liveLengthLabel = resolveLiveProposalLengthLabel(args.content);
  const lengthSignal =
    liveLengthLabel ??
    (typeof args.requestedLength === "number" &&
    Number.isFinite(args.requestedLength)
      ? args.requestedLength <= 1400
        ? "concise"
        : args.requestedLength <= 2600
          ? "standard"
          : "detailed"
      : null);

  if (lengthSignal === "concise") return "Concise";
  if (lengthSignal === "standard") return "Standard";
  if (lengthSignal === "detailed") return "Detailed";
  return null;
}

function normalizeProposalRailJobTitle(
  value: string | null | undefined,
): string {
  const normalized = value?.replace(/\s+/g, " ").trim() ?? "";
  if (!normalized) return "";
  const applicationMatch = normalized.match(
    /^application\s+for\s+the\s+position\s+of\s+(.+?)(?:\s+at\s+.+)?$/i,
  );
  return applicationMatch?.[1]?.trim() || normalized;
}

function resolveRailMatchTone(
  tier: string | null,
  reviewVerdict: string | null,
): ProposalRailMatchTone {
  if (reviewVerdict === "strong_lead") return "strong";
  if (reviewVerdict === "possible_lead") return "worth";
  if (reviewVerdict === "probably_skip") return "skip";
  if (tier === "strong") return "strong";
  if (tier === "partial") return "worth";
  if (tier === "weak") return "skip";
  return "maybe";
}

function resolveRailMatchLabel(
  tier: string | null,
  reviewVerdict: string | null,
): string {
  if (reviewVerdict === "strong_lead" || tier === "strong")
    return "Strong match";
  if (reviewVerdict === "possible_lead" || tier === "partial")
    return "Worth a shot";
  if (reviewVerdict === "probably_skip" || tier === "weak")
    return "Probably skip";
  return "Match unclear";
}

function resolveProposalRailJobMatch(
  matchRead: unknown,
  matchReview: unknown,
): ProposalRailJobMatchSummary | null {
  const read = readRecord(matchRead);
  if (!read) return null;
  const review = readRecord(matchReview);
  const tier = readString(read.tier);
  const reviewVerdict = readString(review?.verdict);
  const label = resolveRailMatchLabel(tier, reviewVerdict);
  const tone = resolveRailMatchTone(tier, reviewVerdict);
  const oneLiner = compactRailText(readString(review?.one_liner), 96);
  if (oneLiner) return { label, tone, detail: oneLiner };

  const matchedCount = readStringArray(read.matched).length;
  const missingCount = readStringArray(read.missing).length;
  const detailParts = [
    matchedCount > 0
      ? `${matchedCount} overlap${matchedCount === 1 ? "" : "s"}`
      : null,
    missingCount > 0
      ? `${missingCount} gap${missingCount === 1 ? "" : "s"}`
      : null,
  ].filter(Boolean);
  return {
    label,
    tone,
    detail: detailParts.length > 0 ? detailParts.join(" · ") : null,
  };
}
type ProposalBriefAnimationPhase =
  | "idle"
  | "form-exit"
  | "brief-enter"
  | "brief-exit"
  | "form-enter";
type ProposalImportedSourceState = {
  sourceUrl: string | null;
  platform: string | null;
};
type ProposalInlineImportPhase =
  | "idle"
  | "preparing"
  | "importing"
  | "retrying"
  | "finalizing";
type RailAskAiReviewState =
  | {
      status: "idle";
    }
  | {
      status: "ready";
      resultText: string;
    }
  | {
      status: "error";
      errorMessage: string;
    }
  | {
      status: "applied";
      previousProposalContent: string;
    };

const PROPOSAL_SAVE_DEBOUNCE_MS =
  Number(
    (typeof globalThis !== "undefined" &&
      (globalThis as any).process?.env?.TEST_DEBOUNCE_MS) ??
      (typeof process !== "undefined"
        ? (process as any).env?.TEST_DEBOUNCE_MS
        : undefined),
  ) || 1000;

const COMPOSE_TOOLBAR_VISIBLE_VOICE_PRESETS = new Set<
  NonNullable<FormValues["voicePreset"]>
>(["signature", "expert", "engaging"]);

const FALLBACK_PROPOSAL_APPLICANT_HEADER: ProposalApplicantHeaderData = {
  name: null,
  role: null,
  company: null,
  email: null,
  phone: null,
  linkedin: null,
  website: null,
  location: null,
  tag: null,
};

function hasApplicantHeaderContent(
  header: ProposalApplicantHeaderData | null | undefined,
): boolean {
  if (!header) {
    return false;
  }

  return Boolean(
    header.name ||
      header.role ||
      header.company ||
      header.email ||
      header.phone ||
      header.website ||
      header.linkedin ||
      header.location ||
      header.tag,
  );
}

function getDefaultProposalLetterDate(location?: string | null): string {
  return buildProposalLetterDateLine({ location });
}

function cleanProposalContactOverride(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function applyProposalContactOverrides<
  T extends {
    title: string | null;
    personalizationContext: unknown;
    richness?: unknown;
    email?: string | null;
    phone?: string | null;
    linkedin?: string | null;
    website?: string | null;
    location?: string | null;
  },
>(source: T, settings: CurrentProposalSettings | undefined): T {
  const overrides = {
    email: cleanProposalContactOverride(settings?.proposalDefaultContactEmail),
    phone: cleanProposalContactOverride(settings?.proposalDefaultContactPhone),
    linkedin: cleanProposalContactOverride(
      settings?.proposalDefaultContactLinkedin,
    ),
    website: cleanProposalContactOverride(
      settings?.proposalDefaultContactWebsite,
    ),
    location: cleanProposalContactOverride(
      settings?.proposalDefaultContactLocation,
    ),
  };

  if (
    !overrides.email &&
    !overrides.phone &&
    !overrides.linkedin &&
    !overrides.website &&
    !overrides.location
  ) {
    return source;
  }

  return mergeProposalContactDefaults(source, overrides);
}

function normalizeComposeToolbarVoicePreset(
  value: unknown,
): FormValues["voicePreset"] | null {
  if (typeof value !== "string") {
    return null;
  }

  const preset = normalizeProposalVoicePresetId(value);
  return preset && COMPOSE_TOOLBAR_VISIBLE_VOICE_PRESETS.has(preset)
    ? preset
    : null;
}

function hasOwnProperty(
  value: unknown,
  key: string,
): value is Record<string, unknown> {
  return (
    !!value &&
    typeof value === "object" &&
    Object.prototype.hasOwnProperty.call(value, key)
  );
}

function resolveStoredComposeToolbarVoicePreset(args: {
  sourceComposeDraft?: StoredProposalComposeDraft | null;
  composeDraft?: StoredProposalComposeDraft | null;
  proposalVoicePreset?: unknown;
}): FormValues["voicePreset"] | null {
  if (hasOwnProperty(args.sourceComposeDraft, "voicePreset")) {
    return normalizeComposeToolbarVoicePreset(
      args.sourceComposeDraft.voicePreset,
    );
  }

  if (hasOwnProperty(args.composeDraft, "voicePreset")) {
    return normalizeComposeToolbarVoicePreset(args.composeDraft.voicePreset);
  }

  return normalizeComposeToolbarVoicePreset(args.proposalVoicePreset);
}

type ProposalDocumentMetadata = DocumentStyleMetadata & {
  sourceJobTitle?: string;
  sourceJobDescription?: string;
  sourceUrl?: string;
  sourceCvId?: string;
  platform?: string;
  jobId?: string;
  proposalType?: FormValues["proposalType"];
  voicePreset?: FormValues["voicePreset"];
  requestedVoicePreset?: FormValues["voicePreset"] | null;
  resolvedVoicePreset?: FormValues["voicePreset"];
  autoToneDecisionVersion?: "v1";
  autoToneReason?: string;
  formalityLevel?: FormValues["formalityLevel"];
  creativity?: FormValues["creativity"];
  templateId?: ProposalTemplateId;
  verbatiStyle?: VerbatiStylePreset;
  styleLinkMode?: ProposalStyleLinkMode;
  styleChoice?: ProposalStyleChoice;
  templateBundleId?: ProposalTemplateBundleId;
  applicantName?: string;
  applicantRole?: string;
  applicantCompany?: string;
  contactLine?: string;
  letterDate?: string;
  recipientDetails?: string;
  headerShowSender?: boolean;
  headerShowDate?: boolean;
  headerShowSubject?: boolean;
  headerShowRecipient?: boolean;
  headerShowRecipientDetails?: boolean;
  characterLimitMode?: ProposalCharacterLimitMode | null;
  characterLimitValue?: number | null;
  closing?: ProposalClosingRef;
  requestedLanguage?: string | null;
  resolvedLanguage?: string | null;
  languageSource?: DocumentLanguageSource;
  jobDetectedLanguage?: string | null;
};

type ProposalWorkspaceCssVars = React.CSSProperties & {
  "--document-viewer-shell-inline-size"?: string;
  "--proposal-paper-visual-inline-size"?: string;
  "--proposal-workspace-output-shell-inline-size"?: string;
  "--proposal-workspace-shell-block-size"?: string;
  "--proposal-compose-column-inline-size"?: string;
  "--proposal-workspace-stage-inline-size"?: string;
  "--proposal-workspace-rail-inline-size"?: string;
};

type SavedProposalRecord = {
  _id: Id<"proposals">;
  _creationTime: number;
  title: string;
  content: string;
  status: string;
  updatedAt: number;
  createdAt: number;
  sections: Array<{
    type: "text" | "code" | "image";
    content: string;
  }>;
  metadata?: ProposalDocumentMetadata;
};

function forgeDrawerSourceId(item: LibraryItem): string {
  return item.id.slice(item.id.indexOf(":") + 1);
}

function forgeDrawerProposalContext(item: LibraryItem): string {
  if (item.type === "cv") return "CV profile";
  const jobPart = item.jobId || item.jobTitle ? "Job linked" : "No job";
  const cvPart = item.linkedCvTitle
    ? `CV: ${item.linkedCvTitle}`
    : item.linkedCvId
      ? "CV linked"
      : "No CV linked";
  return `${jobPart} · ${cvPart}`;
}

function readForgeDrawerRecentSearches(storageKey: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(window.localStorage.getItem(storageKey) ?? "[]");
    return Array.isArray(parsed)
      ? parsed
          .filter((item): item is string => typeof item === "string")
          .slice(0, 5)
      : [];
  } catch {
    return [];
  }
}

function useForgeDrawerRecentSearches(storageKey: string) {
  const [recentSearches, setRecentSearches] = React.useState<string[]>(() =>
    readForgeDrawerRecentSearches(storageKey),
  );

  const writeRecentSearches = React.useCallback(
    (next: string[]) => {
      setRecentSearches(next);
      if (typeof window === "undefined") return;
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* local-only enhancement */
      }
    },
    [storageKey],
  );

  const rememberSearch = React.useCallback(
    (value: string) => {
      const normalized = value.trim();
      if (!normalized) return;
      writeRecentSearches(
        [
          normalized,
          ...recentSearches.filter(
            (item) => item.toLowerCase() !== normalized.toLowerCase(),
          ),
        ].slice(0, 5),
      );
    },
    [recentSearches, writeRecentSearches],
  );

  const clearRecentSearches = React.useCallback(() => {
    writeRecentSearches([]);
  }, [writeRecentSearches]);

  return { recentSearches, rememberSearch, clearRecentSearches };
}

function ForgeDrawerSearch({
  value,
  onChange,
  placeholder,
  storageKey,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  storageKey: string;
}): JSX.Element {
  const [focused, setFocused] = React.useState(false);
  const { resolvedLanguage } = useUiLanguagePreference();
  const { recentSearches, rememberSearch, clearRecentSearches } =
    useForgeDrawerRecentSearches(storageKey);
  const showRecentSearches =
    focused && value.trim() === "" && recentSearches.length > 0;
  const commitSearch = React.useCallback(() => {
    rememberSearch(value);
  }, [rememberSearch, value]);

  return (
    <div className="forge-rail-drawer__search-wrap">
      <label className="forge-rail-drawer__search">
        <span className="sr-only">{placeholder}</span>
        <input
          type="search"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            commitSearch();
            window.setTimeout(() => setFocused(false), 120);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              commitSearch();
            }
          }}
          placeholder={placeholder}
        />
      </label>
      {showRecentSearches ? (
        <div className="forge-rail-drawer__recent-searches" role="listbox">
          <div className="forge-rail-drawer__recent-searches-head">
            <span>{translateUi(resolvedLanguage, "search.recent")}</span>
            <button
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={clearRecentSearches}
            >
              {translateUi(resolvedLanguage, "search.clear")}
            </button>
          </div>
          {recentSearches.map((recent) => (
            <button
              key={recent}
              type="button"
              role="option"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => onChange(recent)}
            >
              {recent}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ProposalDraftDrawer({
  jobTitle,
  jobMeta,
  jobSummary,
  jobContextKind,
  stagedJobTitle,
  stagedJobMeta,
  stagedJobSummary,
  stagedCvTitle,
  sourceCvTitle,
  proposalTypeLabel,
  proposalTypeOptions,
  onSelectProposalType,
  toneLabel,
  toneOptions,
  onSelectTone,
  generateLabel,
  generateDisabled,
  generateState,
  hasExistingDraft = false,
  askReviewReady = false,
  onGenerateDraft,
  onCancelStagedSource,
  onOpenJobs,
  onOpenPasteJob,
  onClearJobContext,
  onOpenCvs,
  onClearCv,
}: ProposalDraftDrawerProps): JSX.Element {
  const hasActiveJobContext = jobContextKind !== "empty";
  const stagedJobTitleValue = stagedJobTitle?.trim() || null;
  const stagedJobMetaValue = stagedJobMeta || stagedJobSummary || null;
  const stagedCvTitleValue = stagedCvTitle?.trim() || null;
  const hasStagedSource = Boolean(stagedJobTitleValue || stagedCvTitleValue);
  const shouldShowGenerateFooter =
    !askReviewReady && (!hasExistingDraft || hasStagedSource);
  const { resolvedLanguage } = useUiLanguagePreference();
  const footerGenerateLabel =
    hasExistingDraft && hasStagedSource
      ? translateUi(resolvedLanguage, "workspace.regenerate")
      : generateLabel;
  const resolvedJobTitle =
    jobContextKind === "pasted"
      ? translateUi(resolvedLanguage, "jobs.pasteJobOffer")
      : jobTitle || translateUi(resolvedLanguage, "workspace.jobLoaded");
  const displayedJobTitle = stagedJobTitleValue || resolvedJobTitle;
  const stagedSourceMeta = translateUi(
    resolvedLanguage,
    "workspace.stagedLetterUnchanged",
  );
  const displayedJobMeta =
    stagedJobTitleValue
      ? stagedJobMetaValue || stagedSourceMeta
      : jobMeta || jobSummary;
  const hasDisplayedJobContext = hasActiveJobContext || Boolean(stagedJobTitleValue);
  const displayedCvTitle = stagedCvTitleValue || sourceCvTitle;
  const hasDisplayedCv = Boolean(displayedCvTitle);
  const canCancelStagedCv = Boolean(stagedCvTitleValue && onCancelStagedSource);
  const proposalTypeMenuSections = React.useMemo<MenuSection[]>(
    () => [
      {
        label: translateUi(resolvedLanguage, "workspace.documentType"),
        items: proposalTypeOptions.map((option) => ({
          id: option.id,
          role: "menuitemradio" as const,
          selected: option.selected,
          label: option.label,
          description: option.description,
          onSelect: () => onSelectProposalType(option.id),
        })),
      },
    ],
    [onSelectProposalType, proposalTypeOptions, resolvedLanguage],
  );
  const toneMenuSections = React.useMemo<MenuSection[]>(
    () => [
      {
        label: translateUi(resolvedLanguage, "workspace.tone"),
        items: toneOptions.map((option) => ({
          id: option.id ?? "auto",
          role: "menuitemradio" as const,
          selected: option.selected,
          label: option.label,
          description: option.description,
          onSelect: () => onSelectTone(option.id),
        })),
      },
    ],
    [onSelectTone, toneOptions, resolvedLanguage],
  );

  return (
    <div className="forge-rail-drawer forge-rail-drawer--draft">
      <div className="forge-rail-drawer__draft-body">
        <section className="forge-rail-drawer__draft-section">
          <div className="forge-rail-drawer__section-title">
            <span>{translateUi(resolvedLanguage, "workspace.jobSection")}</span>
          </div>
          {hasDisplayedJobContext ? (
            <article className="forge-rail-drawer__draft-card">
              <button
                type="button"
                className="forge-rail-drawer__draft-card-main"
                aria-label={`${translateUi(
                  resolvedLanguage,
                  "workspace.changeJob",
                )}: ${displayedJobTitle}`}
                onClick={onOpenJobs}
              >
                <span className="forge-rail-drawer__draft-card-copy">
                  <strong>{displayedJobTitle}</strong>
                  {displayedJobMeta ? <span>{displayedJobMeta}</span> : null}
                </span>
              </button>
              {stagedJobTitleValue && onCancelStagedSource ? (
                <button
                  type="button"
                  className="forge-rail-drawer__draft-remove"
                  aria-label={translateUi(
                    resolvedLanguage,
                    "workspace.cancelStagedSourceChange",
                  )}
                  onClick={onCancelStagedSource}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : onClearJobContext ? (
                <button
                  type="button"
                  className="forge-rail-drawer__draft-remove"
                  aria-label={translateUi(
                    resolvedLanguage,
                    "workspace.removeJobContext",
                  )}
                  onClick={onClearJobContext}
                >
                  <X size={13} aria-hidden="true" />
                </button>
              ) : null}
            </article>
          ) : (
            <>
              <button
                type="button"
                className="forge-rail-drawer__draft-row"
                onClick={onOpenJobs}
              >
                <span>{translateUi(resolvedLanguage, "workspace.chooseSavedJob")}</span>
                <CaretRight size={14} aria-hidden="true" />
              </button>
              {onOpenPasteJob ? (
                <button
                  type="button"
                  className="forge-rail-drawer__draft-row"
                  onClick={onOpenPasteJob}
                >
                  <span>{translateUi(resolvedLanguage, "jobs.pasteJobOffer")}</span>
                  <CaretRight size={14} aria-hidden="true" />
                </button>
              ) : null}
            </>
          )}
        </section>

        <section className="forge-rail-drawer__draft-section">
          <div className="forge-rail-drawer__section-title">
            <span>{translateUi(resolvedLanguage, "workspace.cvSection")}</span>
          </div>
          {hasDisplayedCv ? (
            <article className="forge-rail-drawer__draft-card">
              <button
                type="button"
                className="forge-rail-drawer__draft-card-main"
                aria-label={`${translateUi(
                  resolvedLanguage,
                  "workspace.changeAttachedCv",
                )}: ${displayedCvTitle}`}
                onClick={onOpenCvs}
              >
                <span className="forge-rail-drawer__draft-card-copy">
                  <strong>{displayedCvTitle}</strong>
                  {stagedCvTitleValue ? <span>{stagedSourceMeta}</span> : null}
                </span>
              </button>
              <button
                type="button"
                className="forge-rail-drawer__draft-remove"
                aria-label={
                  canCancelStagedCv
                    ? translateUi(
                        resolvedLanguage,
                        "workspace.cancelStagedSourceChange",
                      )
                    : translateUi(resolvedLanguage, "workspace.removeAttachedCv")
                }
                onClick={
                  canCancelStagedCv && onCancelStagedSource
                    ? onCancelStagedSource
                    : onClearCv
                }
              >
                <X size={13} aria-hidden="true" />
              </button>
            </article>
          ) : (
            <button
              type="button"
              className="forge-rail-drawer__draft-row"
              onClick={onOpenCvs}
            >
              <span>{translateUi(resolvedLanguage, "workspace.pickCv")}</span>
              <CaretRight size={14} aria-hidden="true" />
            </button>
          )}
        </section>

        <section className="forge-rail-drawer__draft-section">
          <div className="forge-rail-drawer__section-title">
            <span>{translateUi(resolvedLanguage, "workspace.settingsSection")}</span>
          </div>
          <Menu
            ariaLabel={translateUi(resolvedLanguage, "workspace.documentType")}
            align="start"
            side="top"
            matchTriggerWidth
            sections={proposalTypeMenuSections}
            trigger={
              <button
                type="button"
                aria-label={translateUi(resolvedLanguage, "workspace.documentType")}
                className="dasti-proposal-skeleton-rail__setup-row dasti-proposal-skeleton-rail__setup-row--button"
              >
                <span className="dasti-proposal-skeleton-rail__setup-label">
                  {translateUi(resolvedLanguage, "workspace.type")}
                </span>
                <span className="dasti-proposal-skeleton-rail__setup-value">
                  {proposalTypeLabel || translateUi(resolvedLanguage, "workspace.letter")}
                </span>
                <CaretRight className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
              </button>
            }
          />
          <Menu
            ariaLabel={translateUi(resolvedLanguage, "workspace.tone")}
            align="start"
            side="top"
            matchTriggerWidth
            sections={toneMenuSections}
            trigger={
              <button
                type="button"
                aria-label={translateUi(resolvedLanguage, "workspace.tone")}
                className="dasti-proposal-skeleton-rail__setup-row dasti-proposal-skeleton-rail__setup-row--button"
              >
                <span className="dasti-proposal-skeleton-rail__setup-label">
                  {translateUi(resolvedLanguage, "workspace.tone")}
                </span>
                <span className="dasti-proposal-skeleton-rail__setup-value">
                  {toneLabel}
                </span>
                <CaretRight className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
              </button>
            }
          />
        </section>
      </div>
      {shouldShowGenerateFooter ? (
        <div className="forge-rail-drawer__draft-footer">
          <button
            type="button"
            className="ds-btn ds-btn--md ds-btn--primary forge-rail-drawer__draft-generate"
            disabled={generateDisabled}
            data-state={generateState}
            onClick={onGenerateDraft}
          >
            <PaperPlaneRight size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>{footerGenerateLabel}</span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ProposalPasteJobDrawer({
  value,
  onChange,
  onCommit,
  onDone,
}: {
  value: string;
  onChange: (value: string) => void;
  onCommit: () => void;
  onDone: () => void;
}): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const resizeTextarea = React.useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${textarea.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(() => {
    resizeTextarea();
  }, [resizeTextarea, value]);

  const handleDone = () => {
    onCommit();
    onDone();
  };

  return (
    <div className="forge-rail-drawer forge-rail-drawer--draft">
      <div className="forge-rail-drawer__draft-body">
        <section className="forge-rail-drawer__draft-section">
          <div className="forge-rail-drawer__section-title">
            <span>{translateUi(resolvedLanguage, "jobs.pasteJobOffer")}</span>
          </div>
          <p className="forge-rail-drawer__empty">
            {translateUi(resolvedLanguage, "jobs.pasteJobOfferHelp")}
          </p>
          <textarea
            ref={textareaRef}
            className="ds-field ds-field--textarea dasti-proposal-skeleton-rail__job-offer-input forge-rail-drawer__paste-job-input"
            value={value}
            placeholder={translateUi(
              resolvedLanguage,
              "jobs.pasteJobOfferPlaceholder",
            )}
            aria-label={translateUi(resolvedLanguage, "jobs.pasteJobOffer")}
            onChange={(event) => {
              onChange(event.currentTarget.value);
              resizeTextarea();
            }}
            onBlur={onCommit}
          />
        </section>
      </div>
      <div className="forge-rail-drawer__draft-footer">
        <button
          type="button"
          className="ds-btn ds-btn--md ds-btn--primary forge-rail-drawer__draft-generate"
          onClick={handleDone}
        >
          {translateUi(resolvedLanguage, "jobs.useJobContext")}
        </button>
      </div>
    </div>
  );
}

function ForgeDrawerDocumentPreview({
  item,
  hydrateCvDocument,
  badge,
  actionPill,
}: {
  item: LibraryItem;
  hydrateCvDocument: (
    id: string,
  ) => Promise<import("../types/cvDocument").CvDocument | null>;
  badge?: string | null;
  actionPill?: React.ReactNode;
}): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  const [hydratedCv, setHydratedCv] = React.useState<
    import("../types/cvDocument").CvDocument | null
  >(item.type === "cv" && item.cvDocument ? item.cvDocument : null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    if (item.type !== "cv") return () => undefined;
    const summaryOnly = Boolean(
      (
        item.cvDocument?.metadata as
          | { librarySummaryOnly?: boolean }
          | undefined
      )?.librarySummaryOnly,
    );
    if (item.cvDocument && !summaryOnly) {
      setHydratedCv(item.cvDocument);
      setFailed(false);
      return () => undefined;
    }
    setHydratedCv(null);
    setFailed(false);
    hydrateCvDocument(forgeDrawerSourceId(item)).then((doc) => {
      if (cancelled) return;
      if (doc) {
        setHydratedCv(doc);
        setFailed(false);
      } else {
        setFailed(true);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [hydrateCvDocument, item]);

  if (item.type === "cv" && !hydratedCv) {
    return (
      <DrawerUnavailableThumbnail
        label={
          failed
            ? translateUi(resolvedLanguage, "errors.previewUnavailable")
            : translateUi(resolvedLanguage, "loading.preview")
        }
      />
    );
  }

  return (
    <DrawerDocumentTile
      item={item}
      cvDocument={hydratedCv}
      badge={badge}
      actionPill={actionPill}
    />
  );
}

export function ProposalJobsDrawer({
  jobs,
  onSelectJob,
  onOpenJob,
  onOpenPasteJob,
}: {
  jobs: JobsQueryListItem[] | undefined;
  onSelectJob: (jobId: string) => void;
  onOpenJob: (jobId: string) => void;
  onOpenPasteJob?: () => void;
}): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  const [query, setQuery] = React.useState("");
  const allResultsRef = React.useRef<HTMLDivElement | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredJobs = React.useMemo(
    () =>
      (jobs ?? [])
        .filter((job) => {
          if (!normalizedQuery) return true;
          return [job.title, job.company, job.location, job.sourceDomain]
            .filter(Boolean)
            .join(" ")
            .toLowerCase()
            .includes(normalizedQuery);
        })
        .slice(0, 40),
    [jobs, normalizedQuery],
  );
  const recentJobs = filteredJobs.slice(0, 2);
  const handleShowAll = () => {
    setQuery("");
    window.setTimeout(() => {
      allResultsRef.current?.scrollIntoView({ block: "start" });
      allResultsRef.current?.focus();
    }, 0);
  };

  return (
    <div className="forge-rail-drawer">
      <ForgeDrawerSearch
        value={query}
        onChange={setQuery}
        placeholder={translateUi(resolvedLanguage, "search.jobs")}
        storageKey="twoweeks:forge-drawer:recent-job-searches"
      />
      {onOpenPasteJob ? (
        <button
          type="button"
          className="forge-rail-drawer__draft-row"
          onClick={onOpenPasteJob}
        >
          <span>{translateUi(resolvedLanguage, "jobs.pasteJobOffer")}</span>
          <CaretRight size={14} aria-hidden="true" />
        </button>
      ) : null}
      <div className="forge-rail-drawer__list" role="list">
        <ForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.recentlyViewed")}
          actionLabel={
            filteredJobs.length > recentJobs.length
              ? translateUi(resolvedLanguage, "workspace.showAllJobs")
              : undefined
          }
          onAction={handleShowAll}
        />
        {recentJobs.map((job) => (
          <ForgeDrawerJobRow
            key={`recent-${job.id}`}
            job={job}
            onSelectJob={onSelectJob}
            onOpenJob={onOpenJob}
          />
        ))}
        <ForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.allResults")}
          sectionRef={allResultsRef}
          focusable
        />
        {filteredJobs.map((job) => (
          <ForgeDrawerJobRow
            key={job.id}
            job={job}
            onSelectJob={onSelectJob}
            onOpenJob={onOpenJob}
          />
        ))}
        {filteredJobs.length === 0 ? (
          <p className="forge-rail-drawer__empty">
            {translateUi(resolvedLanguage, "emptyState.noJobsFound")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function ForgeDrawerSectionTitle({
  title,
  actionLabel,
  onAction,
  sectionRef,
  focusable = false,
}: {
  title: string;
  actionLabel?: string;
  onAction?: () => void;
  sectionRef?: React.Ref<HTMLDivElement>;
  focusable?: boolean;
}): JSX.Element {
  return (
    <div
      ref={sectionRef}
      className="forge-rail-drawer__section-title"
      tabIndex={focusable ? -1 : undefined}
    >
      <span>{title}</span>
      {actionLabel ? (
        <button type="button" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

function ForgeDrawerJobRow({
  job,
  onSelectJob,
  onOpenJob,
}: {
  job: JobsQueryListItem;
  onSelectJob: (jobId: string) => void;
  onOpenJob: (jobId: string) => void;
}): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  const openJobPageLabel = translateUi(resolvedLanguage, "jobs.openJobPage");
  const untitledJobLabel = translateUi(resolvedLanguage, "jobs.untitled");
  return (
    <article className="forge-rail-drawer__row" role="listitem">
      <button
        type="button"
        className="forge-rail-drawer__row-main"
        onClick={() => onSelectJob(job.id)}
      >
        <strong>{job.title || untitledJobLabel}</strong>
        <span>
          {[job.company, job.location].filter(Boolean).join(" · ") ||
            translateUi(resolvedLanguage, "jobs.savedJob")}
        </span>
        <span className="forge-rail-drawer__row-affordance">
          <Briefcase
            className="forge-rail-drawer__row-affordance-icon"
            size="var(--app-sidebar-icon-size)"
            aria-hidden="true"
          />
          {translateUi(resolvedLanguage, "jobs.attachJob")}
        </span>
      </button>
      <button
        type="button"
        className="forge-rail-drawer__row-icon"
        aria-label={`${openJobPageLabel}: ${job.title || untitledJobLabel}`}
        data-toolbar-tooltip={openJobPageLabel}
        onClick={(event) => {
          event.stopPropagation();
          onOpenJob(job.id);
        }}
      >
        <ArrowSquareOut size={14} aria-hidden="true" />
      </button>
    </article>
  );
}

export function ProposalCvDrawer({
  items,
  activeCvId,
  hydrateCvDocument,
  onSelectCv,
  onOpenCv,
}: {
  items: LibraryItem[];
  activeCvId: string | null;
  hydrateCvDocument: (
    id: string,
  ) => Promise<import("../types/cvDocument").CvDocument | null>;
  onSelectCv: (cvId: string) => void | Promise<void>;
  onOpenCv: (cvId: string) => void;
}): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  const [query, setQuery] = React.useState("");
  const allResultsRef = React.useRef<HTMLDivElement | null>(null);
  const attachedLabel = translateUi(resolvedLanguage, "workspace.attached");
  const attachCvLabel = translateUi(resolvedLanguage, "workspace.attachCv");
  const openFullCvLabel = translateUi(
    resolvedLanguage,
    "workspace.openFullCv",
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) =>
    normalizedQuery
      ? [item.title, item.subtitle]
          .join(" ")
          .toLowerCase()
          .includes(normalizedQuery)
      : true,
  );
  const recentItems = React.useMemo(() => {
    const alternatives = filteredItems.filter(
      (item) => activeCvId !== forgeDrawerSourceId(item),
    );
    return (alternatives.length >= 2 ? alternatives : filteredItems).slice(
      0,
      2,
    );
  }, [activeCvId, filteredItems]);
  const handleShowAll = () => {
    setQuery("");
    window.setTimeout(() => {
      allResultsRef.current?.scrollIntoView({ block: "start" });
      allResultsRef.current?.focus();
    }, 0);
  };
  const renderCvItem = (item: LibraryItem, keyPrefix = "") => {
    const sourceId = forgeDrawerSourceId(item);
    const selected = activeCvId === sourceId;
    return (
      <article
        key={`${keyPrefix}${item.id}`}
        className="forge-rail-drawer__thumb-item"
        data-state={selected ? "attached" : undefined}
        role="listitem"
      >
        <button
          type="button"
          className="forge-template-card forge-rail-drawer__thumb-button"
          aria-label={`${attachCvLabel}: ${item.title}`}
          aria-pressed={selected}
          onClick={() => void onSelectCv(sourceId)}
        >
          <ForgeDrawerDocumentPreview
            item={item}
            hydrateCvDocument={hydrateCvDocument}
            badge={selected ? attachedLabel : null}
            actionPill={
              <>
                <Paperclip size={12} aria-hidden="true" />
                <span>{attachCvLabel}</span>
              </>
            }
          />
        </button>
        <button
          type="button"
          className="forge-rail-drawer__thumb-menu forge-rail-drawer__thumb-menu--direct"
          aria-label={`${openFullCvLabel}: ${item.title}`}
          data-toolbar-tooltip={openFullCvLabel}
          onClick={(event) => {
            event.stopPropagation();
            onOpenCv(sourceId);
          }}
        >
          <ArrowSquareOut size={15} aria-hidden="true" />
        </button>
      </article>
    );
  };

  return (
    <div className="forge-rail-drawer">
      <ForgeDrawerSearch
        value={query}
        onChange={setQuery}
        placeholder={translateUi(resolvedLanguage, "search.cvs")}
        storageKey="twoweeks:forge-drawer:recent-cv-searches"
      />
      <div className="forge-rail-drawer__grid" role="list">
        <ForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.recentlyViewed")}
          actionLabel={
            filteredItems.length > recentItems.length
              ? translateUi(resolvedLanguage, "workspace.showAllCvs")
              : undefined
          }
          onAction={handleShowAll}
        />
        {recentItems.map((item) => renderCvItem(item, "recent-"))}
        <ForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.allResults")}
          sectionRef={allResultsRef}
          focusable
        />
        {filteredItems.map((item) => renderCvItem(item))}
        {filteredItems.length === 0 ? (
          <p className="forge-rail-drawer__empty">
            {translateUi(resolvedLanguage, "emptyState.noCvsFound")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ProposalLibraryDrawer({
  items,
  hydrateCvDocument,
  onOpenItem,
  onOpenProposal,
}: {
  items: LibraryItem[];
  hydrateCvDocument: (
    id: string,
  ) => Promise<import("../types/cvDocument").CvDocument | null>;
  onOpenItem: (item: LibraryItem) => void;
  onOpenProposal: (item: LibraryItem) => void;
}): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  const [query, setQuery] = React.useState("");
  const allResultsRef = React.useRef<HTMLDivElement | null>(null);
  const openProposalLabel = translateUi(
    resolvedLanguage,
    "workspace.openProposal",
  );
  const openFullProposalLabel = translateUi(
    resolvedLanguage,
    "workspace.openFullProposal",
  );
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (item.type !== "proposal") return false;
    if (!normalizedQuery) return true;
    return [
      item.title,
      item.subtitle,
      item.jobTitle,
      item.linkedCvTitle,
      forgeDrawerProposalContext(item),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const recentItems = filteredItems.slice(0, 2);
  const handleShowAll = () => {
    setQuery("");
    window.setTimeout(() => {
      allResultsRef.current?.scrollIntoView({ block: "start" });
      allResultsRef.current?.focus();
    }, 0);
  };
  const renderProposalItem = (item: LibraryItem, keyPrefix = "") => {
    return (
      <article
        key={`${keyPrefix}${item.id}`}
        className="forge-rail-drawer__thumb-item"
        role="listitem"
      >
        <button
          type="button"
          className="forge-template-card forge-rail-drawer__thumb-button"
          aria-label={`${openProposalLabel}: ${item.title}`}
          onClick={() => onOpenItem(item)}
        >
          <ForgeDrawerDocumentPreview
            item={item}
            hydrateCvDocument={hydrateCvDocument}
            actionPill={translateUi(resolvedLanguage, "common.open")}
          />
        </button>
        <button
          type="button"
          className="forge-rail-drawer__thumb-menu forge-rail-drawer__thumb-menu--direct"
          aria-label={`${openFullProposalLabel}: ${item.title}`}
          data-toolbar-tooltip={openProposalLabel}
          onClick={(event) => {
            event.stopPropagation();
            onOpenProposal(item);
          }}
        >
          <ArrowSquareOut size={15} aria-hidden="true" />
        </button>
      </article>
    );
  };

  return (
    <div className="forge-rail-drawer">
      <ForgeDrawerSearch
        value={query}
        onChange={setQuery}
        placeholder={translateUi(resolvedLanguage, "search.proposals")}
        storageKey="twoweeks:forge-drawer:recent-proposal-searches"
      />
      <div className="forge-rail-drawer__grid" role="list">
        <ForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.recentlyViewed")}
          actionLabel={
            filteredItems.length > recentItems.length
              ? translateUi(resolvedLanguage, "workspace.showAllProposals")
              : undefined
          }
          onAction={handleShowAll}
        />
        {recentItems.map((item) => renderProposalItem(item, "recent-"))}
        <ForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.allResults")}
          sectionRef={allResultsRef}
          focusable
        />
        {filteredItems.map((item) => renderProposalItem(item))}
        {filteredItems.length === 0 ? (
          <p className="forge-rail-drawer__empty">
            {translateUi(resolvedLanguage, "emptyState.noProposalsFound")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export function ProjectsLibraryDrawer({
  items,
  initialFilter = "all",
  hydrateCvDocument,
  onOpenItem,
  onOpenLibraryType,
  onDownloadItems,
  onDeleteItems,
}: {
  items: LibraryItem[];
  initialFilter?: "all" | "cvs" | "proposals";
  hydrateCvDocument: (
    id: string,
  ) => Promise<import("../types/cvDocument").CvDocument | null>;
  onOpenItem: (item: LibraryItem) => void;
  onOpenLibraryType: (type: "cvs" | "proposals") => void;
  onDownloadItems: (items: LibraryItem[]) => void;
  onDeleteItems: (items: LibraryItem[]) => void;
}): JSX.Element {
  const { resolvedLanguage } = useUiLanguagePreference();
  const [query, setQuery] = React.useState("");
  const [filter, setFilter] = React.useState<"all" | "cvs" | "proposals">(
    initialFilter,
  );
  const allResultsRef = React.useRef<HTMLDivElement | null>(null);
  const openCvLibraryLabel = translateUi(
    resolvedLanguage,
    "workspace.openCvLibrary",
  );
  const openProposalsLibraryLabel = translateUi(
    resolvedLanguage,
    "workspace.openProposalsLibrary",
  );
  const selectCvLabel = translateUi(resolvedLanguage, "workspace.selectCv");
  const selectProposalLabel = translateUi(
    resolvedLanguage,
    "workspace.selectProposal",
  );
  const openCvLabel = translateUi(resolvedLanguage, "workspace.openCv");
  const openProposalLabel = translateUi(
    resolvedLanguage,
    "workspace.openProposal",
  );
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(
    () => new Set(),
  );
  React.useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);
  const normalizedQuery = query.trim().toLowerCase();
  const filteredItems = items.filter((item) => {
    if (filter === "cvs" && item.type !== "cv") return false;
    if (filter === "proposals" && item.type !== "proposal") return false;
    if (!normalizedQuery) return true;
    return [
      item.title,
      item.subtitle,
      item.jobTitle,
      item.linkedCvTitle,
      forgeDrawerProposalContext(item),
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase()
      .includes(normalizedQuery);
  });
  const recentItems = filteredItems.slice(0, 2);
  const selectedItems = items.filter((item) => selectedIds.has(item.id));
  const downloadableCount = selectedItems.filter(
    isLibraryItemDownloadable,
  ).length;
  const toggleSelected = (itemId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  };
  const renderItem = (item: LibraryItem, keyPrefix = "") => {
    const selected = selectedIds.has(item.id);
    return (
      <article
        key={`${keyPrefix}${item.id}`}
        className="forge-rail-drawer__thumb-item"
        data-selected={selected ? "true" : undefined}
        role="listitem"
      >
        <label className="forge-rail-drawer__select">
          <input
            type="checkbox"
            checked={selected}
            aria-label={
              item.type === "cv"
                ? `${selectCvLabel}: ${item.title}`
                : `${selectProposalLabel}: ${item.title}`
            }
            onChange={() => toggleSelected(item.id)}
            onClick={(event) => event.stopPropagation()}
          />
          <span className="forge-rail-drawer__select-check" aria-hidden="true">
            <Check size={12} strokeWidth={2.3} />
          </span>
        </label>
        <button
          type="button"
          className="forge-template-card forge-rail-drawer__thumb-button"
          aria-label={
            item.type === "cv"
              ? `${openCvLabel}: ${item.title}`
              : `${openProposalLabel}: ${item.title}`
          }
          onClick={() => onOpenItem(item)}
        >
          <ForgeDrawerDocumentPreview
            item={item}
            hydrateCvDocument={hydrateCvDocument}
          />
        </button>
        <button
          type="button"
          className="forge-rail-drawer__thumb-menu forge-rail-drawer__thumb-menu--direct"
          aria-label={
            item.type === "cv"
              ? `${openCvLibraryLabel}: ${item.title}`
              : `${openProposalsLibraryLabel}: ${item.title}`
          }
          data-toolbar-tooltip={
            item.type === "cv"
              ? openCvLibraryLabel
              : openProposalsLibraryLabel
          }
          onClick={(event) => {
            event.stopPropagation();
            onOpenLibraryType(item.type === "cv" ? "cvs" : "proposals");
          }}
        >
          <ArrowSquareOut size={15} aria-hidden="true" />
        </button>
      </article>
    );
  };

  return (
    <div className="forge-rail-drawer">
      <ForgeDrawerSearch
        value={query}
        onChange={setQuery}
        placeholder={translateUi(resolvedLanguage, "search.library")}
        storageKey="twoweeks:forge-drawer:recent-library-searches"
      />
      <div
        className="forge-rail-drawer__tabs"
        role="tablist"
        aria-label={translateUi(resolvedLanguage, "workspace.libraryFilter")}
      >
        {[
          ["all", translateUi(resolvedLanguage, "projects.all")],
          ["cvs", translateUi(resolvedLanguage, "projects.cvs")],
          ["proposals", translateUi(resolvedLanguage, "projects.proposals")],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            data-active={filter === id ? "true" : undefined}
            onClick={() => {
              setFilter(id as "all" | "cvs" | "proposals");
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="forge-rail-drawer__grid" role="list">
        <ForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.recentlyViewed")}
          actionLabel={
            filteredItems.length <= recentItems.length
              ? undefined
              : filter === "cvs"
                ? translateUi(resolvedLanguage, "workspace.showAllCvs")
                : filter === "proposals"
                  ? translateUi(resolvedLanguage, "workspace.showAllProposals")
                  : translateUi(resolvedLanguage, "workspace.showAll")
          }
          onAction={() => {
            setQuery("");
            window.setTimeout(() => {
              allResultsRef.current?.scrollIntoView({ block: "start" });
              allResultsRef.current?.focus();
            }, 0);
          }}
        />
        {recentItems.map((item) => renderItem(item, "recent-"))}
        <ForgeDrawerSectionTitle
          title={translateUi(resolvedLanguage, "workspace.allResults")}
          sectionRef={allResultsRef}
          focusable
        />
        {filteredItems.map((item) => renderItem(item))}
        {filteredItems.length === 0 ? (
          <p className="forge-rail-drawer__empty">
            {translateUi(resolvedLanguage, "emptyState.noDocumentsFound")}
          </p>
        ) : null}
      </div>
      {selectedItems.length > 0 ? (
        <div
          className="forge-rail-drawer__bulk-bar"
          role="status"
          aria-live="polite"
        >
          <button
            type="button"
            onClick={() => setSelectedIds(new Set())}
            aria-label={translateUi(resolvedLanguage, "workspace.clearSelection")}
          >
            <X size={14} aria-hidden="true" />
          </button>
          <span>
            {selectedItems.length}{" "}
            {translateUi(resolvedLanguage, "workspace.selected")}
          </span>
          <button
            type="button"
            disabled={downloadableCount === 0}
            onClick={() => onDownloadItems(selectedItems)}
          >
            Download
          </button>
          <button type="button" onClick={() => onDeleteItems(selectedItems)}>
            Delete
          </button>
        </div>
      ) : null}
    </div>
  );
}

function buildProfessionalApplicationSubject(args: {
  jobTitle: string;
  jobDescription: string;
  proposalType?: FormValues["proposalType"] | null;
}): string {
  const sanitizeSubjectJobTitle = (value: string): string => {
    let normalized = value.replace(/\s+/g, " ").trim();
    for (let index = 0; index < 3; index += 1) {
      const applicationMatch = normalized.match(
        /^application\s+for\s+the\s+position\s+of\s+(.+?)(?:\s+at\s+.+)?$/i,
      );
      if (!applicationMatch?.[1]) {
        break;
      }
      normalized = applicationMatch[1].trim();
    }
    return normalized
      .replace(/\s+at\s+(?:provided|including|with)\b.+$/i, "")
      .trim();
  };
  const jobTitle = sanitizeSubjectJobTitle(args.jobTitle);
  if (!jobTitle) {
    return args.proposalType === "freelance_proposal"
      ? "Project proposal"
      : "Application for the role";
  }

  const summary = buildProposalSourceSummary({
    jobTitle,
    jobDescription: args.jobDescription,
  });
  const company = sanitizeProposalCompanyName(summary.company);

  if (company) {
    return `Application for the position of ${jobTitle} at ${company}`;
  }

  return `Application for the position of ${jobTitle}`;
}

function sanitizeProposalRecipientDetails(
  value: string | null | undefined,
): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }

  const lines = normalized
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    lines.length === 1 &&
    normalized === normalized.replace(/\s+/g, " ") &&
    !sanitizeProposalCompanyName(normalized)
  ) {
    return "";
  }

  return normalized;
}

function isInvalidProposalApplicantName(
  value: string | null | undefined,
): boolean {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return false;
  return (
    /\bapplication\s+for\s+the\s+position\b/i.test(normalized) ||
    /^(?:from|subject)\s*:/i.test(normalized) ||
    normalized.length > 80
  );
}

function sanitizeProposalApplicantName(
  value: string | null | undefined,
): string {
  const normalized = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return isInvalidProposalApplicantName(normalized) ? "" : normalized;
}

function isProposalCharacterLimitMode(
  value: unknown,
): value is ProposalCharacterLimitMode {
  return (
    value === "none" ||
    value === "linkedin_note_200" ||
    value === "linkedin_inmail_2000" ||
    value === "indeed_cover_letter_4000" ||
    value === "upwork_proposal_advisory" ||
    value === "custom"
  );
}

function resolveAttachedCvSelectionById(
  cvId: string | null | undefined,
  fallbackTitle?: string | null,
): {
  id: string | null;
  title: string | null;
} {
  const normalizedCvId = normalizeSourceCvId(cvId);
  if (!normalizedCvId) {
    return { id: null, title: null };
  }

  return {
    id: normalizedCvId,
    title:
      getLocalActiveCvSnapshotById(normalizedCvId)?.title ??
      fallbackTitle?.trim() ??
      null,
  };
}

function normalizeSourceCvId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function resolveSourceCvTitle(
  sourceCvId: string | null | undefined,
): string | null {
  const normalizedSourceCvId = normalizeSourceCvId(sourceCvId);
  if (!normalizedSourceCvId) {
    return null;
  }

  return getLocalActiveCvSnapshotById(normalizedSourceCvId)?.title ?? null;
}

function resolveSafeSendMatchReviewAccepted(
  jobRecord: ProposalForgeCanonicalJob | undefined,
): boolean | null {
  if (!jobRecord) {
    return null;
  }

  return (
    typeof jobRecord.lastOpenedAt === "number" && jobRecord.lastOpenedAt > 0
  );
}

function resolveSafeSendImportIssues(
  sourceCvId: string | null | undefined,
): boolean | null {
  const normalizedSourceCvId = normalizeSourceCvId(sourceCvId);
  if (!normalizedSourceCvId) {
    return null;
  }

  const attachedCvDocument = getLocalCvDocumentById(normalizedSourceCvId);
  if (!attachedCvDocument) {
    return null;
  }

  const importRecoverySession =
    attachedCvDocument.metadata?.importRecoverySession;
  if (!importRecoverySession || typeof importRecoverySession !== "object") {
    return false;
  }

  const session = importRecoverySession as {
    status?: unknown;
    items?: Array<{ reviewStatus?: unknown }>;
  };
  return (
    session.status === "pending" ||
    (Array.isArray(session.items) &&
      session.items.some((item) => item.reviewStatus === "pending"))
  );
}

function resolveSourceCvStylePreset(
  sourceCvId: string | null | undefined,
): ReturnType<typeof getVerbatiStyleFromCv> | null {
  const normalizedSourceCvId = normalizeSourceCvId(sourceCvId);
  if (!normalizedSourceCvId) {
    return null;
  }

  const sourceCvDocument = getLocalCvDocumentById(normalizedSourceCvId);
  return sourceCvDocument ? getVerbatiStyleFromCv(sourceCvDocument) : null;
}

function normalizeProposalAccentHex(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toUpperCase()
    : null;
}

function normalizeProposalSettingsStyleChoice(
  value: unknown,
): ProposalStyleChoice {
  return resolveProposalStyleChoice(value);
}

function applyProposalTypographyPreference(input: {
  stylePreset: ReturnType<typeof resolveVerbatiStyle>;
  fontPairId: unknown;
}) {
  if (typeof input.fontPairId !== "string" || !input.fontPairId.trim()) {
    return input.stylePreset;
  }

  return resolveVerbatiStyle({
    ...input.stylePreset,
    typography: input.fontPairId,
  });
}

function getProposalSettingsPresetForSlot(
  presets: ProposalSettingsPresets | undefined,
  slotId: DocumentStyleSlotId,
): ProposalSettingsPresetSlot {
  switch (slotId) {
    case 1:
      return presets?.preset1 ?? null;
    case 2:
      return presets?.preset2 ?? null;
    case 3:
    default:
      return presets?.preset3 ?? null;
  }
}

function resolveProposalStyleForDocumentSlot(args: {
  slotId: DocumentStyleSlotId;
  savedPreset: ProposalSettingsPresetSlot;
}): ReturnType<typeof resolveVerbatiStyle> {
  const factorySlot = getFactoryDocumentStyleSlot(args.slotId);
  const savedStyle =
    (args.savedPreset?.verbatiStyle as
      | Partial<ReturnType<typeof resolveVerbatiStyle>>
      | null
      | undefined) ?? null;
  const baseStyle = resolveVerbatiStyle({
    ...factorySlot.appearance,
    resumeTemplateId: factorySlot.defaultCvTemplateId,
    ...(savedStyle ?? null),
  });
  const fontPairId =
    typeof args.savedPreset?.fontPairId === "string" &&
    args.savedPreset.fontPairId.trim()
      ? args.savedPreset.fontPairId
      : baseStyle.typography;
  const accentHex = normalizeProposalAccentHex(args.savedPreset?.accentHex);

  return resolveVerbatiStyle({
    ...baseStyle,
    typography: fontPairId,
    ...(accentHex
      ? {
          palette: "custom" as const,
          accentHex,
        }
      : args.savedPreset?.paletteOverride
        ? { palette: args.savedPreset.paletteOverride }
        : null),
  });
}

function shouldPreserveLeadBreak(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^(dear|hello|hi|greetings)\b/i.test(trimmed)) return true;
  return /[:,]$/.test(trimmed) && trimmed.split(/\s+/).length <= 6;
}

function buildProposalSnippet(value: unknown): string {
  if (typeof value !== "string") return "";
  const paragraphs = value
    .replace(/\r/g, "\n")
    .split(/\n\s*\n/)
    .map((paragraph, index) => {
      const lines = paragraph
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

      if (lines.length === 0) return "";
      if (
        index === 0 &&
        lines.length > 1 &&
        shouldPreserveLeadBreak(lines[0])
      ) {
        const lead = lines[0];
        const remainder = lines.slice(1).join(" ").replace(/\s+/g, " ").trim();
        return remainder ? `${lead}\n${remainder}` : lead;
      }

      return lines.join(" ").replace(/\s+/g, " ").trim();
    })
    .filter(Boolean);

  if (paragraphs.length === 0) return "";
  if (paragraphs.length === 1) return paragraphs[0];
  return paragraphs.slice(0, 2).join("\n");
}

function buildProposalStyleTraceRoute(location: {
  pathname: string;
  search: string;
}): string {
  return `${location.pathname}${location.search}`;
}

function buildProposalStyleTraceMetadataSnapshot(input: {
  templateId?: unknown;
  verbatiStyle?:
    | ReturnType<typeof serializeVerbatiStyle>
    | ReturnType<typeof resolveVerbatiStyle>
    | null;
  sourceCvId?: unknown;
  styleLinkMode?: unknown;
}): ProposalStyleTraceMetadataSnapshot {
  const serializedStyle = input.verbatiStyle
    ? serializeVerbatiStyle(input.verbatiStyle)
    : null;

  return {
    templateId:
      typeof input.templateId === "string" && input.templateId.trim().length > 0
        ? input.templateId.trim()
        : null,
    verbatiStyle: serializedStyle
      ? {
          layout: serializedStyle.layout ?? null,
          typography: serializedStyle.typography ?? null,
          palette: serializedStyle.palette ?? null,
          accentHex: serializedStyle.accentHex ?? null,
        }
      : null,
    sourceCvId: normalizeSourceCvId(input.sourceCvId),
    styleLinkMode:
      typeof input.styleLinkMode === "string" &&
      input.styleLinkMode.trim().length > 0
        ? input.styleLinkMode.trim()
        : null,
  };
}

function serializeProposalMetadataVerbatiStyle(
  style:
    | ReturnType<typeof resolveVerbatiStyle>
    | ReturnType<typeof serializeVerbatiStyle>
    | null
    | undefined,
): ProposalDocumentMetadata["verbatiStyle"] {
  if (!style) {
    return undefined;
  }

  const serializedStyle = serializeVerbatiStyle(resolveVerbatiStyle(style));

  return {
    layout: serializedStyle.layout,
    typography: serializedStyle.typography,
    palette: serializedStyle.palette,
    ...(serializedStyle.accentHex
      ? { accentHex: serializedStyle.accentHex }
      : null),
  };
}

function buildResolvedRenderTraceSnapshot(args: {
  proposalId?: unknown;
  templateId?: unknown;
  stylePreset?: VerbatiStylePreset | null;
  sourceCvId?: unknown;
  styleLinkMode?: ProposalStyleLinkMode | null;
  styleSource?: string | null;
}): {
  proposalId: string | null;
  metadata: ProposalStyleTraceMetadataSnapshot;
  styleSource: string | null;
} {
  return {
    proposalId:
      typeof args.proposalId === "string" && args.proposalId.trim().length > 0
        ? args.proposalId.trim()
        : null,
    metadata: buildProposalStyleTraceMetadataSnapshot({
      templateId: args.templateId,
      verbatiStyle: args.stylePreset ?? null,
      sourceCvId: args.sourceCvId,
      styleLinkMode: args.styleLinkMode ?? null,
    }),
    styleSource:
      typeof args.styleSource === "string" && args.styleSource.trim().length > 0
        ? args.styleSource.trim()
        : null,
  };
}

function isPlainProposalWorkspaceRoute(
  search: string,
  state: unknown,
): boolean {
  const params = new URLSearchParams(search);
  const hasExplicitRouteContext =
    params.has("jobId") ||
    params.has("handoffId") ||
    params.has("handoffToken") ||
    params.has(PROPOSAL_DRAWER_QUERY_PARAM) ||
    params.has("id") ||
    params.has("draftId") ||
    params.get("view") === "saved";

  return (
    !hasExplicitRouteContext &&
    !readProposalWorkspaceResetToken(state) &&
    !readProposalEntryIntent(state) &&
    !readProposalJobImportFocus(state)
  );
}

/**
 * ProposalForge — page Write
 *
 * Toggle Compose / Open : underline tab style (§13 dasti-spec-v1).
 * Intro panel .ip : eyebrow + h2 Baskervville + description.
 * Layout : full-height scrollable (cohérent avec CvForge).
 * Logique métier : intacte.
 */
export function ProposalForge(): JSX.Element {
  const COMPOSE_DRAFT_SYNC_DELAY_MS = 180;
  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const { resolvedLanguage } = useUiLanguagePreference();
  const {
    activeSurface: activeTemplateSurface,
    open: templatePanelOpen,
    openMode: templatePanelOpenMode,
    openSurface: openTemplateSurface,
    closePanel: closeForgePanel,
  } = useForgeTemplatePanel();
  const { currentCvId, importCv, cvs, hydrateCvDocument, deleteCv } =
    useCvLibrary();
  const { showToast } = useToast();
  const { model: proposalLlmModel } = useProposalLlmModelPreference();
  const shouldStartFromEmptyProposalWorkspace = isPlainProposalWorkspaceRoute(
    search,
    location.state,
  );
  const traceProposalStyle = React.useCallback(
    (args: {
      step: string;
      proposalId?: string | null;
      generatedProposalId?: string | null;
      selectedProposalId?: string | null;
      composeToken?: string | null;
      persistedToken?: string | null;
      winnerSource: ProposalStyleTraceWinnerSource;
      winnerReason: string;
      rawServerRow?: ReturnType<typeof snapshotSavedProposalRecord> | null;
      rawQueryRow?: ReturnType<typeof snapshotSavedProposalRecord> | null;
      rawLocalOutputDraft?: ReturnType<typeof snapshotStoredOutputDraft> | null;
      rawSessionOutputDraft?: ReturnType<
        typeof snapshotStoredOutputDraft
      > | null;
      rawComposeDraft?: ReturnType<typeof snapshotStoredComposeDraft> | null;
      rawCvStyleSource?: {
        cvId: string | null;
        cvLabel: string | null;
        metadata: ProposalStyleTraceMetadataSnapshot;
      } | null;
      resolvedRenderState?: Record<string, unknown> | null;
      traceData?: Record<string, unknown>;
    }) => {
      const storageSnapshots = readProposalStyleTraceStorageSnapshots();
      logProposalStyleTrace({
        route: buildProposalStyleTraceRoute(location),
        step: args.step,
        proposalId: args.proposalId ?? null,
        generatedProposalId: args.generatedProposalId ?? null,
        selectedProposalId: args.selectedProposalId ?? null,
        composeToken: args.composeToken ?? null,
        persistedToken: args.persistedToken ?? null,
        winnerSource: args.winnerSource,
        winnerReason: args.winnerReason,
        rawServerRow: args.rawServerRow ?? null,
        rawQueryRow: args.rawQueryRow ?? null,
        rawLocalOutputDraft:
          args.rawLocalOutputDraft === undefined
            ? storageSnapshots.rawLocalOutputDraft
            : args.rawLocalOutputDraft,
        rawSessionOutputDraft:
          args.rawSessionOutputDraft === undefined
            ? storageSnapshots.rawSessionOutputDraft
            : args.rawSessionOutputDraft,
        rawComposeDraft:
          args.rawComposeDraft === undefined
            ? storageSnapshots.rawComposeDraft
            : args.rawComposeDraft,
        rawCvStyleSource: args.rawCvStyleSource ?? null,
        resolvedRenderState: args.resolvedRenderState ?? null,
        ...(args.traceData ?? {}),
      });
    },
    [location],
  );
  const [storedOutputDraft, setStoredOutputDraft] =
    React.useState<StoredProposalOutputDraft | null>(() =>
      readStoredProposalOutputDraft(),
    );
  const storedOutputProposalClosing =
    storedOutputDraft?.proposalClosing ?? null;
  const storedOutputProposalClosingToken = React.useMemo(
    () => JSON.stringify(storedOutputProposalClosing),
    [storedOutputProposalClosing],
  );
  const storedOutputAppearanceDraft = React.useMemo(
    () =>
      shouldHonorStoredOutputDraftAppearance(storedOutputDraft)
        ? storedOutputDraft
        : null,
    [storedOutputDraft],
  );
  const canonicalJobId = React.useMemo(
    () => new URLSearchParams(search).get("jobId"),
    [search],
  );
  const [stagedSourceJobId, setStagedSourceJobId] = React.useState<
    string | null
  >(null);
  const [stagedProposalSourceDraft, setStagedProposalSourceDraft] =
    React.useState<StoredProposalComposeDraft | null>(null);
  const [stagedProposalCvSelection, setStagedProposalCvSelection] =
    React.useState<{
      id: string | null;
      title: string | null;
    } | null>(null);
  const writeStoredOutputDraft = React.useCallback(
    (nextDraft: StoredProposalOutputDraft | null) => {
      const storageSnapshots = readProposalStyleTraceStorageSnapshots();
      const draftWinnerSource =
        resolveOutputDraftWinnerSource({
          localDraft: storageSnapshots.rawLocalOutputDraft,
          sessionDraft: storageSnapshots.rawSessionOutputDraft,
        }) ?? "default_fallback";
      writeStoredProposalOutputDraft(nextDraft);
      setStoredOutputDraft(nextDraft);
      traceProposalStyle({
        step: "write-stored-output-draft",
        proposalId: nextDraft?.generatedProposalId ?? null,
        generatedProposalId: nextDraft?.generatedProposalId ?? null,
        selectedProposalId: null,
        composeToken: null,
        persistedToken: null,
        winnerSource: nextDraft ? draftWinnerSource : "default_fallback",
        winnerReason: nextDraft
          ? draftWinnerSource === "session_output_draft"
            ? "session output draft write requested from ProposalForge"
            : "local output draft write requested from ProposalForge"
          : "output draft cleared from ProposalForge",
        rawLocalOutputDraft: storageSnapshots.rawLocalOutputDraft,
        rawSessionOutputDraft: storageSnapshots.rawSessionOutputDraft,
        resolvedRenderState: nextDraft
          ? {
              proposalId: String(nextDraft.generatedProposalId ?? ""),
              metadata: snapshotStoredOutputDraft(nextDraft)?.metadata ?? null,
              proposalOutputMode: nextDraft.proposalOutputMode,
            }
          : null,
        traceData: {
          nextDraft: snapshotStoredOutputDraft(nextDraft),
        },
      });
    },
    [traceProposalStyle],
  );
  const initialAttachedCvSelection = React.useMemo(
    () =>
      canonicalJobId
        ? { id: null, title: null }
        : resolveAttachedCvSelectionById(getProposalAttachedCvId()),
    [canonicalJobId],
  );
  const [attachedCvId, setAttachedCvId] = React.useState<string | null>(
    initialAttachedCvSelection.id,
  );
  const [attachedCvTitle, setAttachedCvTitle] = React.useState<string | null>(
    initialAttachedCvSelection.title,
  );
  const [pendingScopedCvSelection, setPendingScopedCvSelection] =
    React.useState<{
      id: string | null;
      title: string | null;
    } | null>(null);
  const lastRequestedScopedCvSyncKeyRef = React.useRef<string | null>(null);
  const lastScopedJobIdRef = React.useRef<string | null>(null);
  const activeCvProposalStylePreset = React.useMemo(() => {
    if (!attachedCvId) {
      return null;
    }

    const attachedCvDocument = getLocalCvDocumentById(attachedCvId);
    if (!attachedCvDocument) {
      return null;
    }

    return getVerbatiStyleFromCv(attachedCvDocument);
  }, [attachedCvId]);
  const storedOutputStylePreset = React.useMemo(() => {
    const hasStoredStyleSignal = Boolean(
      storedOutputAppearanceDraft?.proposalVerbatiStyle ||
        storedOutputAppearanceDraft?.layoutOverride ||
        storedOutputAppearanceDraft?.typographyOverride ||
        storedOutputAppearanceDraft?.paletteOverride ||
        storedOutputAppearanceDraft?.customAccentHex,
    );

    if (!hasStoredStyleSignal) {
      return null;
    }

    return resolveVerbatiStyle({
      ...(storedOutputAppearanceDraft?.proposalVerbatiStyle ?? {}),
      ...(storedOutputAppearanceDraft?.layoutOverride
        ? { layout: storedOutputAppearanceDraft.layoutOverride }
        : null),
      ...(storedOutputAppearanceDraft?.typographyOverride
        ? { typography: storedOutputAppearanceDraft.typographyOverride }
        : null),
      ...(storedOutputAppearanceDraft?.customAccentHex
        ? {
            palette: "custom" as const,
            accentHex: storedOutputAppearanceDraft.customAccentHex,
          }
        : storedOutputAppearanceDraft?.paletteOverride
          ? { palette: storedOutputAppearanceDraft.paletteOverride }
          : null),
    });
  }, [
    storedOutputAppearanceDraft?.customAccentHex,
    storedOutputAppearanceDraft?.layoutOverride,
    storedOutputAppearanceDraft?.paletteOverride,
    storedOutputAppearanceDraft?.proposalVerbatiStyle,
    storedOutputAppearanceDraft?.typographyOverride,
  ]);
  const fallbackProposalTemplateId = React.useMemo(
    () =>
      getProposalTwinTemplateId(
        storedOutputStylePreset ?? activeCvProposalStylePreset ?? undefined,
      ),
    [activeCvProposalStylePreset, storedOutputStylePreset],
  );
  const {
    isLoading: isConvexAuthLoading,
    isAuthenticated: isConvexAuthenticated,
  } = useConvexAuth();
  const { jobs: proposalRailJobs } = useJobsQuery({
    isLoaded: true,
    isSignedIn: isConvexAuthenticated,
    isConvexAuthenticated,
    selectedJobRefreshKey: 0,
  });
  const currentProposalSettings = useQuery(
    api.proposalSettings.getCurrent,
    isConvexAuthenticated ? {} : "skip",
  ) as CurrentProposalSettings | undefined;
  const proposalSettingsPresets = useQuery(
    api.proposalSettings.getPresets,
    isConvexAuthenticated ? {} : "skip",
  ) as ProposalSettingsPresets | undefined;
  const activePersonalizationSource = React.useMemo(
    () => getLocalPersonalizationSourceByCvId(attachedCvId),
    [attachedCvId],
  );
  const effectivePersonalizationSource = React.useMemo(
    () =>
      applyProposalContactOverrides(
        activePersonalizationSource,
        currentProposalSettings,
      ),
    [activePersonalizationSource, currentProposalSettings],
  );
  const stagedGenerationCvId = stagedProposalCvSelection
    ? stagedProposalCvSelection.id
    : attachedCvId;
  const generationPersonalizationSource = React.useMemo(
    () =>
      applyProposalContactOverrides(
        getLocalPersonalizationSourceByCvId(stagedGenerationCvId),
        currentProposalSettings,
      ),
    [currentProposalSettings, stagedGenerationCvId],
  );
  const initialApplicantIdentity = React.useMemo(
    () => getProposalApplicantIdentity(effectivePersonalizationSource),
    [effectivePersonalizationSource],
  );
  const activeApplicantHeader = React.useMemo(
    () => getProposalApplicantHeaderData(effectivePersonalizationSource),
    [effectivePersonalizationSource],
  );
  const defaultPreviewApplicantHeader = React.useMemo(
    () =>
      hasApplicantHeaderContent(activeApplicantHeader)
        ? activeApplicantHeader
        : FALLBACK_PROPOSAL_APPLICANT_HEADER,
    [activeApplicantHeader],
  );
  const defaultPreviewContactLine = React.useMemo(
    () => buildProposalApplicantContactLine(defaultPreviewApplicantHeader),
    [defaultPreviewApplicantHeader],
  );
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [proposalComposerMode, setProposalComposerMode] =
    React.useState<ProposalRailTab | null>(null);
  const handoffId = React.useMemo(
    () => new URLSearchParams(search).get("handoffId"),
    [search],
  );
  const handoffToken = React.useMemo(
    () => new URLSearchParams(search).get("handoffToken"),
    [search],
  );
  const proposalDrawerRouteIntent = React.useMemo(
    () => readProposalDrawerRouteIntent(search),
    [search],
  );
  const isWideEnoughForDockedForgePanel =
    viewportWidth >= FORGE_DOCKED_PANEL_MIN_VIEWPORT_WIDTH;
  const selectedProposalId = React.useMemo(
    () => new URLSearchParams(search).get("id"),
    [search],
  );
  const selectedDraftProposalId = React.useMemo(
    () => new URLSearchParams(search).get("draftId"),
    [search],
  );
  const proposalStyleSlotIntent = React.useMemo(
    () =>
      resolveProposalStyleSlotIntent(
        new URLSearchParams(search).get("templateId"),
      ),
    [search],
  );
  const proposalDirectTemplateIntent = React.useMemo(() => {
    const value = new URLSearchParams(search).get("templateId");
    return isProposalTemplateId(value) ? resolveProposalTemplateId(value) : null;
  }, [search]);
  const proposalStyleIntent = React.useMemo(
    () =>
      proposalStyleSlotIntent
        ? resolveProposalStyleForDocumentSlot({
            slotId: proposalStyleSlotIntent,
            savedPreset: getProposalSettingsPresetForSlot(
              proposalSettingsPresets,
              proposalStyleSlotIntent,
            ),
          })
        : null,
    [proposalSettingsPresets, proposalStyleSlotIntent],
  );
  const proposalTemplateIntent = React.useMemo(
    () =>
      proposalDirectTemplateIntent ??
      (proposalStyleIntent
        ? getProposalTwinTemplateId(proposalStyleIntent)
        : null),
    [proposalDirectTemplateIntent, proposalStyleIntent],
  );
  const proposalTemplateBundleIntent = React.useMemo(
    () =>
      proposalDirectTemplateIntent
        ? null
        : proposalStyleSlotIntent
        ? getProposalBundleForDocumentStyleSlot(proposalStyleSlotIntent)
        : null,
    [proposalDirectTemplateIntent, proposalStyleSlotIntent],
  );
  const requestedView = React.useMemo<ProposalForgeView>(() => {
    const params = new URLSearchParams(search);
    const view = params.get("view");
    return view === "saved" || params.has("id") ? "saved" : "compose";
  }, [search]);
  const isSavedView = requestedView === "saved";
  const proposalWorkspaceResetToken = React.useMemo(
    () => readProposalWorkspaceResetToken(location.state as unknown),
    [location.state],
  );
  const proposalEntryIntent = React.useMemo(
    () => readProposalEntryIntent(location.state as unknown),
    [location.state],
  );
  const proposalJobImportFocus = React.useMemo(
    () => readProposalJobImportFocus(location.state as unknown),
    [location.state],
  );
  const shouldInitializeCoverLetterStartSession =
    requestedView === "compose" &&
    proposalEntryIntent === "cover-letter-start" &&
    !handoffId &&
    !canonicalJobId;
  React.useEffect(() => {
    if (
      requestedView === "compose" &&
      proposalEntryIntent === "cover-letter-start" &&
      !handoffId &&
      !canonicalJobId
    ) {
      setIsCoverLetterStartSessionActive(true);
      setShowExtensionHelper(proposalJobImportFocus === "supported-sites");
      return;
    }

    setShowExtensionHelper(false);
  }, [
    canonicalJobId,
    handoffId,
    proposalEntryIntent,
    proposalJobImportFocus,
    proposalWorkspaceResetToken,
    requestedView,
  ]);
  React.useEffect(() => {
    setIsTemplateJobContextEmptyStateDismissed(false);
  }, [proposalStyleSlotIntent, proposalWorkspaceResetToken]);
  const generateProposalAction = useAction(api.functions.generateProposal);
  const transformEditorSelectionAction = useAction(
    (api.functions as any).transformEditorSelection,
  );
  const updateProposal = useMutation(api.updateProposalPublic.default);
  const approveJobReviewItem = useMutation(
    (api as any).jobsPublic?.approveReviewItem ??
      "jobsPublic.approveReviewItem",
  );
  const updateJobField = useMutation(
    (api as any).jobsPublic?.updateField ?? "jobsPublic.updateField",
  );
  const setJobResume = useMutation(
    ((api as any).jobsPublic?.setResumeForJob ??
      "jobsPublic.setResumeForJob") as any,
  );
  const createProposal = useMutation(
    (api as any).createProposalPublic?.default ??
      "createProposalPublic.default",
  );
  const handleAttachedCvChange = React.useCallback(
    (nextId: string | null) => {
      if (nextId !== null) {
        setIsCoverLetterStartSessionActive(false);
        setShowExtensionHelper(false);
      }

      if (!canonicalJobId) {
        const nextSelection = resolveAttachedCvSelectionById(nextId);
        if (nextSelection.id) {
          setProposalAttachedCvId(nextSelection.id);
        } else {
          clearProposalAttachedCvId();
        }
        setAttachedCvId(nextSelection.id);
        setAttachedCvTitle(nextSelection.title);
        setPendingScopedCvSelection(null);
        lastRequestedScopedCvSyncKeyRef.current = null;
        return;
      }

      const nextSelection = resolveAttachedCvSelectionById(nextId);
      setAttachedCvId(nextSelection.id);
      setAttachedCvTitle(nextSelection.title);
      setPendingScopedCvSelection(nextSelection);
      lastRequestedScopedCvSyncKeyRef.current = null;
    },
    [canonicalJobId],
  );
  const proposalSignatureSettings = React.useMemo(
    () =>
      sanitizeProposalSignatureSettings(
        currentProposalSettings?.signatureSettings,
      ),
    [currentProposalSettings?.signatureSettings],
  );
  const activeSettingsSlotId = resolveDocumentStyleSlotId(
    proposalSettingsPresets?.activeSlot,
  );
  const activeSettingsSlotPreset = activeSettingsSlotId
    ? getProposalSettingsPresetForSlot(
        proposalSettingsPresets,
        activeSettingsSlotId,
      )
    : null;
  const activeSettingsSlotStylePreset = activeSettingsSlotId
    ? resolveProposalStyleForDocumentSlot({
        slotId: activeSettingsSlotId,
        savedPreset: activeSettingsSlotPreset,
      })
    : null;
  const currentSettingsStylePreset = currentProposalSettings?.verbatiStyle
    ? resolveVerbatiStyle(currentProposalSettings.verbatiStyle)
    : null;
  const initialSettingsStylePreset =
    proposalStyleIntent ??
    (!storedOutputStylePreset && !activeCvProposalStylePreset
      ? activeSettingsSlotStylePreset ?? currentSettingsStylePreset
      : null);
  const initialSettingsTemplateId =
    proposalTemplateIntent ??
    (initialSettingsStylePreset
      ? getProposalTwinTemplateId(initialSettingsStylePreset)
      : currentProposalSettings?.templateId ?? null);
  const savedProposals = useQuery(
    api.proposalsPublic.default as any,
    isConvexAuthenticated ? {} : "skip",
  ) as SavedProposalRecord[] | undefined;
  const fallbackSavedProposals = React.useMemo(
    () =>
      !isConvexAuthenticated
        ? readStoredSavedProposalFixtures().map(
            (proposal): SavedProposalRecord => ({
              ...proposal,
              _id: proposal._id as Id<"proposals">,
              _creationTime:
                proposal._creationTime ??
                proposal.updatedAt ??
                proposal.createdAt ??
                0,
              title: proposal.title ?? "Untitled cover letter",
              content: proposal.content ?? "",
              status: proposal.status ?? "saved",
              updatedAt:
                proposal.updatedAt ??
                proposal._creationTime ??
                proposal.createdAt ??
                0,
              createdAt:
                proposal.createdAt ??
                proposal._creationTime ??
                proposal.updatedAt ??
                0,
              sections: proposal.sections ?? [],
              metadata: proposal.metadata as
                | ProposalDocumentMetadata
                | undefined,
            }),
          )
        : [],
    [isConvexAuthenticated],
  );
  const deleteProposal = useMutation(api.deleteProposalPublic.default);
  const initialProposalHeaderVisibility = resolveProposalHeaderVisibility({
    ...buildProposalHeaderVisibilityFromContent(
      storedOutputDraft?.proposalRecipientDetails ?? null,
    ),
    showSender: storedOutputDraft?.proposalHeaderShowSender,
    showDate: storedOutputDraft?.proposalHeaderShowDate,
    showSubject: storedOutputDraft?.proposalHeaderShowSubject,
    showRecipient: storedOutputDraft?.proposalHeaderShowRecipient,
    showRecipientDetails: storedOutputDraft?.proposalHeaderShowRecipientDetails,
  });
  const [proposalContent, setProposalContent] = React.useState<string | null>(
    storedOutputDraft?.proposalContent ?? null,
  );
  const [proposalSalutationValue, setProposalSalutationValue] =
    React.useState<string>(() =>
      readProposalSalutation(storedOutputDraft?.proposalContent),
    );
  const proposalSalutationValueRef = React.useRef(proposalSalutationValue);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [statusMessage, setStatusMessage] = React.useState<string | null>(null);
  const [errorDetail, setErrorDetail] = React.useState<string | null>(null);
  const [proposalType, setProposalType] = React.useState<
    FormValues["proposalType"] | null
  >(storedOutputDraft?.proposalType ?? null);
  const [proposalVoicePreset, setProposalVoicePreset] = React.useState<
    FormValues["voicePreset"] | null
  >(storedOutputDraft?.proposalVoicePreset ?? null);
  const [proposalTemplateId, setProposalTemplateId] =
    React.useState<ProposalTemplateId | null>(
      proposalTemplateIntent ??
        storedOutputAppearanceDraft?.proposalTemplateId ??
        initialSettingsTemplateId ??
        fallbackProposalTemplateId,
    );
  const [proposalStyleLinkMode, setProposalStyleLinkMode] =
    React.useState<ProposalStyleLinkMode>(() =>
      resolveProposalStyleLinkMode(
        storedOutputAppearanceDraft?.proposalStyleLinkMode ??
          (activeCvProposalStylePreset ? "inherit_cv" : "proposal_local"),
      ),
    );
  const [proposalStyleChoice, setProposalStyleChoice] =
    React.useState<ProposalStyleChoice>(() =>
      resolveProposalStyleChoice(
        storedOutputAppearanceDraft?.proposalStyleChoice ??
          resolveProposalStyleChoiceFromRenderState({
            templateId:
              proposalTemplateIntent ??
              storedOutputAppearanceDraft?.proposalTemplateId ??
              initialSettingsTemplateId ??
              fallbackProposalTemplateId,
            stylePreset:
              proposalStyleIntent ??
              storedOutputAppearanceDraft?.proposalVerbatiStyle ??
              activeCvProposalStylePreset ??
              initialSettingsStylePreset,
          }) ??
          (activeCvProposalStylePreset
            ? "auto"
            : normalizeProposalSettingsStyleChoice(
                currentProposalSettings?.styleChoice,
              )),
      ),
    );
  const [proposalStylePreset, setProposalStylePreset] = React.useState(
    proposalStyleIntent ??
      storedOutputStylePreset ??
      activeCvProposalStylePreset ??
      initialSettingsStylePreset,
  );
  const shouldRestoreStoredCustomStyle = Boolean(
    storedOutputAppearanceDraft?.proposalStyleLinkMode === "proposal_local" &&
      storedOutputStylePreset,
  );
  const [hasUserEditedStyle, setHasUserEditedStyle] = React.useState<boolean>(
    () => shouldRestoreStoredCustomStyle || Boolean(initialSettingsStylePreset),
  );
  const [proposalWorkspaceStyle, setProposalWorkspaceStyle] =
    React.useState<ReturnType<typeof resolveVerbatiStyle> | null>(() =>
      shouldRestoreStoredCustomStyle && storedOutputStylePreset
        ? resolveVerbatiStyle(storedOutputStylePreset)
        : initialSettingsStylePreset
          ? resolveVerbatiStyle(initialSettingsStylePreset)
          : null,
    );
  const [proposalTemplateBundleId, setProposalTemplateBundleId] =
    React.useState<ProposalTemplateBundleId | null>(
      proposalTemplateBundleIntent ??
        storedOutputAppearanceDraft?.templateBundleId ??
        getProposalBundleForDocumentStyleSlot(
          storedOutputAppearanceDraft?.verbatiStyleSlotId,
        ),
    );
  const [proposalPaletteOverride, setProposalPaletteOverride] =
    React.useState<ProposalPaletteId | null>(
      storedOutputAppearanceDraft?.customAccentHex
        ? null
        : storedOutputAppearanceDraft?.paletteOverride ?? null,
    );
  const [proposalCustomAccentHex, setProposalCustomAccentHex] = React.useState<
    string | null
  >(storedOutputAppearanceDraft?.customAccentHex ?? null);
  const [proposalApplicantName, setProposalApplicantName] =
    React.useState<string>(
      sanitizeProposalApplicantName(storedOutputDraft?.proposalApplicantName) ||
        initialApplicantIdentity.name ||
        defaultPreviewApplicantHeader.name ||
        "",
    );
  const [proposalApplicantRole, setProposalApplicantRole] =
    React.useState<string>(
      storedOutputDraft?.proposalApplicantRole ||
        initialApplicantIdentity.role ||
        defaultPreviewApplicantHeader.role ||
        "",
    );
  const [proposalApplicantCompany, setProposalApplicantCompany] =
    React.useState<string>(storedOutputDraft?.proposalApplicantCompany || "");
  const [proposalContactLine, setProposalContactLine] = React.useState<string>(
    storedOutputDraft?.proposalContactLine ?? defaultPreviewContactLine,
  );
  const [proposalStructuredContactDraft, setProposalStructuredContactDraft] =
    React.useState<ProposalStructuredContactFields>(() =>
      parseProposalContactLine(
        storedOutputDraft?.proposalContactLine ?? defaultPreviewContactLine,
      ),
    );
  const [proposalLetterDate, setProposalLetterDate] = React.useState<string>(
    storedOutputDraft?.proposalLetterDate ||
      getDefaultProposalLetterDate(defaultPreviewApplicantHeader.location),
  );
  const [proposalRecipientDetails, setProposalRecipientDetails] =
    React.useState<string>(storedOutputDraft?.proposalRecipientDetails || "");
  const [proposalHeaderVisibility, setProposalHeaderVisibility] =
    React.useState<ProposalHeaderVisibility>(initialProposalHeaderVisibility);
  const [proposalDocumentTitle, setProposalDocumentTitle] =
    React.useState<string>(storedOutputDraft?.proposalDocumentTitle ?? "");
  const [proposalDocumentTitleManual, setProposalDocumentTitleManual] =
    React.useState<boolean>(
      storedOutputDraft?.proposalDocumentTitleManual === true,
    );
  const [proposalDocumentMeta, setProposalDocumentMeta] =
    React.useState<string>(storedOutputDraft?.proposalDocumentMeta ?? "");
  const [fallbackInfo, setFallbackInfo] =
    React.useState<ProposalGenerationFallbackInfo | null>(null);
  const [generatedProposalId, setGeneratedProposalId] =
    React.useState<Id<"proposals"> | null>(
      storedOutputDraft?.generatedProposalId ?? null,
    );
  const [proposalOutputMode, setProposalOutputMode] = React.useState<
    "preview" | "edit"
  >(storedOutputDraft?.proposalOutputMode ?? "preview");
  const [proposalLibraryStatus, setProposalLibraryStatus] = React.useState<
    "draft" | "saved"
  >("draft");
  const [composeSaveStatus, setComposeSaveStatus] =
    React.useState<SaveStatus>("idle");
  const [isSavingOutputToLibrary, setIsSavingOutputToLibrary] =
    React.useState(false);
  const [proposalExportingFormat, setProposalExportingFormat] = React.useState<
    string | null
  >(null);
  const [lastProposalRequest, setLastProposalRequest] =
    React.useState<FormValues | null>(null);
  const [composePreviewValues, setComposePreviewValues] =
    React.useState<StoredProposalComposeDraft | null>(() => {
      if (shouldStartFromEmptyProposalWorkspace) {
        return {};
      }
      const storedComposeDraft = readStoredProposalComposeDraft();
      return (
        storedOutputDraft?.sourceComposeDraft ?? storedComposeDraft ?? null
      );
    });
  const [jobContextCleared, setJobContextCleared] = React.useState(false);
  const [outputSourceComposeDraft, setOutputSourceComposeDraft] =
    React.useState<StoredProposalComposeDraft | null>(
      shouldStartFromEmptyProposalWorkspace
        ? null
        : storedOutputDraft?.sourceComposeDraft ?? null,
    );
  const [composeDraftInitialSeed, setComposeDraftInitialSeed] =
    React.useState<StoredProposalComposeDraft | null>(
      shouldStartFromEmptyProposalWorkspace
        ? {}
        : storedOutputDraft?.sourceComposeDraft ?? null,
    );
  const [stickyImportedSource, setStickyImportedSource] =
    React.useState<ProposalImportedSourceState>(() => {
      if (shouldStartFromEmptyProposalWorkspace) {
        return { sourceUrl: null, platform: null };
      }
      const storedComposeDraft = readStoredProposalComposeDraft();
      return {
        sourceUrl:
          storedOutputDraft?.sourceComposeDraft?.sourceUrl ??
          storedComposeDraft?.sourceUrl ??
          null,
        platform:
          storedOutputDraft?.sourceComposeDraft?.platform ??
          storedComposeDraft?.platform ??
          null,
      };
    });
  const draftCharacterLimitModeCandidate =
    composePreviewValues?.characterLimitMode ??
    storedOutputDraft?.characterLimitMode ??
    null;
  const draftCharacterLimitMode: ProposalCharacterLimitMode | null =
    isProposalCharacterLimitMode(draftCharacterLimitModeCandidate)
      ? draftCharacterLimitModeCandidate
      : null;
  const draftCharacterLimitValue =
    composePreviewValues?.characterLimitValue ??
    storedOutputDraft?.characterLimitValue ??
    null;
  const draftCharacterLimitRef = React.useRef<{
    mode: ProposalCharacterLimitMode | null;
    value: number | null;
  }>({
    mode: draftCharacterLimitMode,
    value: draftCharacterLimitValue,
  });
  React.useEffect(() => {
    draftCharacterLimitRef.current = {
      mode: draftCharacterLimitMode,
      value: draftCharacterLimitValue,
    };
  }, [draftCharacterLimitMode, draftCharacterLimitValue]);
  const [isConfirmingGeneratedDelete, setIsConfirmingGeneratedDelete] =
    React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState<"idle" | "copied">(
    "idle",
  );
  const [composeFormInstanceKey, setComposeFormInstanceKey] = React.useState(0);
  const [isCvPickerOpen, setIsCvPickerOpen] = React.useState(false);
  const [isCoverLetterStartSessionActive, setIsCoverLetterStartSessionActive] =
    React.useState(() => shouldInitializeCoverLetterStartSession);
  const [showExtensionHelper, setShowExtensionHelper] = React.useState(
    () =>
      shouldInitializeCoverLetterStartSession &&
      proposalJobImportFocus === "supported-sites",
  );
  const [
    isTemplateJobContextEmptyStateDismissed,
    setIsTemplateJobContextEmptyStateDismissed,
  ] = React.useState(false);
  const templateJobSiteLinks = React.useMemo(
    () => getProposalExtensionSourceLinks(),
    [],
  );
  const templateJobSiteMenuSections = React.useMemo<MenuSection[]>(
    () => [
      {
        items: templateJobSiteLinks.map((site) => ({
          id: site.key,
          label: site.label,
          onSelect: () => {
            setIsTemplateJobContextEmptyStateDismissed(true);
            if (typeof window === "undefined") return;
            window.open(site.href, "_blank", "noopener,noreferrer");
          },
        })),
      },
    ],
    [templateJobSiteLinks],
  );
  const [coverLetterInlineImportPhase, setCoverLetterInlineImportPhase] =
    React.useState<ProposalInlineImportPhase>("idle");
  const [coverLetterInlineImportFileName, setCoverLetterInlineImportFileName] =
    React.useState<string | null>(null);
  const [coverLetterInlineImportError, setCoverLetterInlineImportError] =
    React.useState<string | null>(null);
  const [pendingInlineImportedCvId, setPendingInlineImportedCvId] =
    React.useState<string | null>(null);
  const [isComposePanelVisible, setIsComposePanelVisible] =
    React.useState(true);
  const [isBriefExpanded, setIsBriefExpanded] = React.useState(true);
  const [briefAnimationPhase, setBriefAnimationPhase] =
    React.useState<ProposalBriefAnimationPhase>("idle");
  const [toolbarTransitionState, setToolbarTransitionState] = React.useState<
    "entering" | null
  >(null);
  const [composeToolbarVoicePreset, setComposeToolbarVoicePreset] =
    React.useState<FormValues["voicePreset"] | null>(() => {
      const storedComposeDraft = readStoredProposalComposeDraft();
      return resolveStoredComposeToolbarVoicePreset({
        sourceComposeDraft: storedOutputDraft?.sourceComposeDraft,
        composeDraft: storedComposeDraft,
        proposalVoicePreset: storedOutputDraft?.proposalVoicePreset,
      });
    });
  const [composeToolbarModelType, setComposeToolbarModelType] = React.useState<
    FormValues["modelType"]
  >(() => {
    const storedComposeDraft = readStoredProposalComposeDraft();
    return isProposalLlmModelType(storedComposeDraft?.modelType)
      ? storedComposeDraft.modelType
      : readStoredProposalLlmModel();
  });
  const proposalLlmModelMountedRef = React.useRef(false);
  React.useEffect(() => {
    if (!proposalLlmModelMountedRef.current) {
      proposalLlmModelMountedRef.current = true;
      return;
    }

    setComposeToolbarModelType(proposalLlmModel);
  }, [proposalLlmModel]);
  const [cvPickerRequestKey, setCvPickerRequestKey] = React.useState(0);
  const [duplicateSourceJobId, setDuplicateSourceJobId] = React.useState<
    string | null
  >(null);
  const coverLetterInlineFileInputRef = React.useRef<HTMLInputElement | null>(
    null,
  );
  const mountedRef = React.useRef(true);
  const inlineImportRequestIdRef = React.useRef(0);
  const pendingInlineImportedCvIdRef = React.useRef<string | null>(null);
  const pendingInlineImportRequestIdRef = React.useRef<number | null>(null);
  const pendingInlineImportTraceRef =
    React.useRef<StructuredImportTimingTrace | null>(null);
  const composeGenerateTriggerRef = React.useRef<(() => void) | null>(null);
  const { importFile: importStructuredResumeFile } = useStructuredMistralImport(
    {
      probeOnMount: false,
    },
  );
  const [composeGenerateControl, setComposeGenerateControl] = React.useState<
    Omit<ProposalGenerateControl, "trigger">
  >({
    label: "Generate",
    disabled: true,
    state: "idle",
  });
  const hasCompletedInitialRenderRef = React.useRef(false);
  const appliedSavedToolbarVoicePresetRef = React.useRef(false);
  const pendingComposeDraftSyncRef =
    React.useRef<StoredProposalComposeDraft | null>(null);
  const composeDraftSyncTimeoutRef = React.useRef<number | null>(null);
  const cancelPendingComposeDraftSync = React.useCallback(() => {
    pendingComposeDraftSyncRef.current = null;
    if (composeDraftSyncTimeoutRef.current !== null) {
      window.clearTimeout(composeDraftSyncTimeoutRef.current);
      composeDraftSyncTimeoutRef.current = null;
    }
  }, []);
  const pendingComposeBriefFocusRef = React.useRef(false);
  const previousShowBriefCardRef = React.useRef(false);
  const briefSwapTimerRef = React.useRef<number | null>(null);
  const briefSettleTimerRef = React.useRef<number | null>(null);
  const toolbarTransitionTimerRef = React.useRef<number | null>(null);
  const syncedStoredOutputSourceComposeRef = React.useRef(false);
  const suppressStoredOutputDraftSyncRef = React.useRef(false);
  const skipNextStoredOutputDraftSyncRef = React.useRef(false);
  const skipNextStructuredContactSyncRef = React.useRef(false);
  const lastAutoApplicantHeaderRef = React.useRef({
    name: defaultPreviewApplicantHeader.name ?? "",
    role: defaultPreviewApplicantHeader.role ?? "",
    contactLine: defaultPreviewContactLine,
  });
  const lastAutoDocumentTitleRef = React.useRef(
    storedOutputDraft?.proposalDocumentTitleManual
      ? ""
      : storedOutputDraft?.proposalDocumentTitle ?? "",
  );
  const headingDirtyRef = React.useRef({
    applicantName: Boolean(storedOutputDraft?.proposalApplicantName),
    applicantRole: Boolean(storedOutputDraft?.proposalApplicantRole),
    applicantCompany: Boolean(storedOutputDraft?.proposalApplicantCompany),
    contactLine: Boolean(storedOutputDraft?.proposalContactLine),
    letterDate: Boolean(storedOutputDraft?.proposalLetterDate),
    recipientDetails: Boolean(storedOutputDraft?.proposalRecipientDetails),
    subject: Boolean(storedOutputDraft?.proposalDocumentTitleManual),
    salutation: Boolean(proposalSalutationValue),
  });
  const markHeadingFieldDirty = React.useCallback(
    (field: keyof typeof headingDirtyRef.current) => {
      headingDirtyRef.current[field] = true;
    },
    [],
  );
  const resetHeadingDirtyState = React.useCallback(
    (next?: Partial<typeof headingDirtyRef.current>) => {
      headingDirtyRef.current = {
        applicantName: false,
        applicantRole: false,
        applicantCompany: false,
        contactLine: false,
        letterDate: false,
        recipientDetails: false,
        subject: false,
        salutation: false,
        ...next,
      };
    },
    [],
  );
  const resolveHeadingFieldFromAuto = React.useCallback(
    (
      field: keyof typeof headingDirtyRef.current,
      args: {
        current: string | null | undefined;
        previousAuto: string | null | undefined;
        nextAuto: string | null | undefined;
        isInvalidCurrent?: (value: string) => boolean;
      },
    ) => {
      const current = String(args.current ?? "");
      const trimmedCurrent = current.trim();
      const previousAuto = String(args.previousAuto ?? "").trim();
      const nextAuto = String(args.nextAuto ?? "").trim();

      if (args.isInvalidCurrent?.(trimmedCurrent)) {
        headingDirtyRef.current[field] = false;
        return nextAuto;
      }
      if (!trimmedCurrent || trimmedCurrent === previousAuto) {
        headingDirtyRef.current[field] = false;
        return nextAuto;
      }
      return current;
    },
    [],
  );
  const handleProposalDocumentTitleChange = React.useCallback(
    (value: string) => {
      markHeadingFieldDirty("subject");
      setProposalDocumentTitleManual(true);
      setProposalDocumentTitle(value);
    },
    [markHeadingFieldDirty],
  );
  const handleProposalApplicantNameChange = React.useCallback(
    (value: string) => {
      markHeadingFieldDirty("applicantName");
      setProposalApplicantName(value);
    },
    [markHeadingFieldDirty],
  );
  const handleProposalApplicantRoleChange = React.useCallback(
    (value: string) => {
      markHeadingFieldDirty("applicantRole");
      setProposalApplicantRole(value);
    },
    [markHeadingFieldDirty],
  );
  const handleProposalApplicantCompanyChange = React.useCallback(
    (value: string) => {
      markHeadingFieldDirty("applicantCompany");
      setProposalApplicantCompany(value);
    },
    [markHeadingFieldDirty],
  );
  const handleProposalContactLineChange = React.useCallback(
    (value: string) => {
      markHeadingFieldDirty("contactLine");
      setProposalContactLine(value);
    },
    [markHeadingFieldDirty],
  );
  const handleProposalContactLineCommit = React.useCallback(() => {
    setProposalContactLine((current) => normalizeProposalContactLine(current));
  }, []);
  React.useEffect(() => {
    if (skipNextStructuredContactSyncRef.current) {
      skipNextStructuredContactSyncRef.current = false;
      return;
    }
    setProposalStructuredContactDraft(
      parseProposalContactLine(proposalContactLine),
    );
  }, [proposalContactLine]);

  const proposalStructuredContactFields = proposalStructuredContactDraft;
  const handleProposalStructuredContactChange = React.useCallback(
    (field: keyof ProposalStructuredContactFields, value: string) => {
      markHeadingFieldDirty("contactLine");
      const nextContactFields = {
        ...proposalStructuredContactDraft,
        [field]: value,
      };
      setProposalStructuredContactDraft(nextContactFields);
      skipNextStructuredContactSyncRef.current = true;
      setProposalContactLine(
        buildProposalContactLineFromParts(nextContactFields),
      );
    },
    [markHeadingFieldDirty, proposalStructuredContactDraft],
  );
  const handleProposalLetterDateChange = React.useCallback(
    (value: string) => {
      markHeadingFieldDirty("letterDate");
      setProposalLetterDate(value);
    },
    [markHeadingFieldDirty],
  );
  const handleProposalRecipientDetailsChange = React.useCallback(
    (value: string) => {
      markHeadingFieldDirty("recipientDetails");
      setProposalRecipientDetails(value);
    },
    [markHeadingFieldDirty],
  );

  React.useEffect(() => {
    hasCompletedInitialRenderRef.current = true;
  }, []);
  React.useEffect(() => {
    generatedProposalIdRef.current = generatedProposalId;
  }, [generatedProposalId]);
  React.useEffect(() => {
    const previousAuto = lastAutoApplicantHeaderRef.current;
    const nextAuto = {
      name: defaultPreviewApplicantHeader.name ?? "",
      role: defaultPreviewApplicantHeader.role ?? "",
      contactLine: defaultPreviewContactLine,
    };

    setProposalApplicantName((current) => {
      return resolveHeadingFieldFromAuto("applicantName", {
        current,
        previousAuto: previousAuto.name,
        nextAuto: nextAuto.name,
        isInvalidCurrent: isInvalidProposalApplicantName,
      });
    });
    setProposalApplicantRole((current) => {
      return resolveHeadingFieldFromAuto("applicantRole", {
        current,
        previousAuto: previousAuto.role,
        nextAuto: nextAuto.role,
      });
    });
    setProposalApplicantCompany((current) => {
      return resolveHeadingFieldFromAuto("applicantCompany", {
        current,
        previousAuto: "",
        nextAuto: "",
      });
    });
    setProposalContactLine((current) => {
      return resolveHeadingFieldFromAuto("contactLine", {
        current: normalizeProposalContactLine(current),
        previousAuto: previousAuto.contactLine,
        nextAuto: nextAuto.contactLine,
      });
    });

    lastAutoApplicantHeaderRef.current = nextAuto;
  }, [
    defaultPreviewApplicantHeader.name,
    defaultPreviewApplicantHeader.role,
    defaultPreviewContactLine,
    resolveHeadingFieldFromAuto,
  ]);
  const [savedProposalContent, setSavedProposalContent] = React.useState<
    string | null
  >(null);
  const [savedProposalType, setSavedProposalType] = React.useState<
    FormValues["proposalType"] | null
  >(null);
  const [savedProposalVoicePreset, setSavedProposalVoicePreset] =
    React.useState<FormValues["voicePreset"] | null>(null);
  const [savedProposalTemplateId, setSavedProposalTemplateId] =
    React.useState<ProposalTemplateId | null>(null);
  const [savedProposalStyleLinkMode, setSavedProposalStyleLinkMode] =
    React.useState<ProposalStyleLinkMode>("proposal_local");
  const [savedProposalStylePreset, setSavedProposalStylePreset] =
    React.useState(activeCvProposalStylePreset);
  const [savedProposalDocumentTitle, setSavedProposalDocumentTitle] =
    React.useState("");
  const [savedProposalDocumentMeta, setSavedProposalDocumentMeta] =
    React.useState("");
  const [savedProposalOutputMode, setSavedProposalOutputMode] = React.useState<
    "preview" | "edit"
  >("preview");
  const [isSavingSavedProposal, setIsSavingSavedProposal] =
    React.useState(false);
  const [savedCopyFeedback, setSavedCopyFeedback] = React.useState<
    "idle" | "copied"
  >("idle");
  const [railAskAiValue, setRailAskAiValue] = React.useState("");
  const [railAskAiBusy, setRailAskAiBusy] = React.useState(false);
  const [railAskAiReview, setRailAskAiReview] =
    React.useState<RailAskAiReviewState>({ status: "idle" });
  const copyFeedbackTimeoutRef = React.useRef<number | null>(null);
  const savedCopyFeedbackTimeoutRef = React.useRef<number | null>(null);
  const lastSavedProposalContentRef = React.useRef<string | null>(
    storedOutputDraft?.proposalContent ?? null,
  );
  const lastSavedProposalTitleRef = React.useRef<string>(
    storedOutputDraft?.proposalDocumentTitle ?? "",
  );
  const generatedProposalIdRef = React.useRef<Id<"proposals"> | null>(
    storedOutputDraft?.generatedProposalId ?? null,
  );
  const latestProposalStyleCommitRevisionRef = React.useRef(0);
  const latestProposalStyleCommitRef = React.useRef<
    | ({
        proposalId: string | null;
        revision: number;
        templateId: ProposalTemplateId;
        verbatiStyle: ProposalDocumentMetadata["verbatiStyle"];
        styleLinkMode: ProposalStyleLinkMode;
        styleChoice: ProposalStyleChoice;
        templateBundleId?: ProposalTemplateBundleId;
      } & DocumentStyleMetadata)
    | null
  >(null);
  const loadedDraftProposalIdRef = React.useRef<string | null>(null);
  const composeAutosaveTimeoutRef = React.useRef<number | null>(null);
  const pendingComposeSavePromiseRef =
    React.useRef<Promise<Id<"proposals"> | null> | null>(null);
  type ComposeSaveSnapshot = {
    id: Id<"proposals"> | null;
    title: string;
    content: string;
    metadata: ProposalDocumentMetadata | undefined;
    status: string;
    token: string;
  };
  const pendingQueuedComposeSnapshotRef =
    React.useRef<ComposeSaveSnapshot | null>(null);
  const latestComposeAutosaveSnapshotRef =
    React.useRef<ComposeSaveSnapshot | null>(null);
  const isSavingComposeProposalRef = React.useRef(false);
  const lastPersistedComposeTokenRef = React.useRef<string | null>(null);
  const composeAutosavePrimedRef = React.useRef(false);
  const previousComposeStyleTraceRef = React.useRef<{
    proposalStyleLinkMode: ProposalStyleLinkMode;
    proposalTemplateId: ProposalTemplateId | null;
    proposalStylePreset: ReturnType<typeof resolveVerbatiStyle> | null;
    hasUserEditedStyle: boolean;
  } | null>(null);
  const previousSavedStyleTraceRef = React.useRef<{
    selectedProposalId: string | null;
    savedProposalStyleLinkMode: ProposalStyleLinkMode;
    savedProposalTemplateId: ProposalTemplateId | null;
    savedProposalStylePreset: ReturnType<typeof resolveVerbatiStyle> | null;
  } | null>(null);
  const latestTraceSnapshotRef = React.useRef<Record<string, unknown> | null>(
    null,
  );
  const appliedSettingsAppearanceDefaultsRef = React.useRef(false);
  const canPersistProposalState = isConvexAuthenticated && !isConvexAuthLoading;
  const settingsStyleChoice = React.useMemo(
    () =>
      normalizeProposalSettingsStyleChoice(
        currentProposalSettings?.styleChoice,
      ),
    [currentProposalSettings?.styleChoice],
  );
  const settingsAccentHex = React.useMemo(
    () =>
      normalizeProposalAccentHex(
        activeSettingsSlotPreset
          ? activeSettingsSlotPreset.accentHex
          : currentProposalSettings?.accentHex,
      ),
    [activeSettingsSlotPreset, currentProposalSettings?.accentHex],
  );
  const settingsPaletteOverride = React.useMemo(
    () =>
      settingsAccentHex
        ? null
        : isProposalPaletteId(
              activeSettingsSlotPreset
                ? activeSettingsSlotPreset.paletteOverride
                : currentProposalSettings?.paletteOverride,
            )
          ? activeSettingsSlotPreset
            ? activeSettingsSlotPreset.paletteOverride
            : currentProposalSettings?.paletteOverride
          : null,
    [
      activeSettingsSlotPreset,
      currentProposalSettings?.paletteOverride,
      settingsAccentHex,
    ],
  );
  const settingsStylePreset = React.useMemo(
    () => activeSettingsSlotStylePreset ?? currentSettingsStylePreset,
    [activeSettingsSlotStylePreset, currentSettingsStylePreset],
  );

  const showConvexAuthRequiredToast = React.useCallback(
    (actionLabel: string) => {
      showToast(AUTH_REQUIRED_TOAST, {
        variant: "warning",
        description: `${actionLabel} is unavailable until the proposal workspace is authenticated.`,
      });
    },
    [showToast],
  );

  const publicHandoffRecord = useQuery(
    ((api as any).proposalHandoffs?.getPublic ??
      "proposalHandoffs.getPublic") as any,
    handoffId && handoffToken ? { handoffId, handoffToken } : "skip",
  ) as ProposalForgeHandoffRecord | undefined;
  const handoffRecord = useQuery(
    api.proposalHandoffs.get,
    handoffId && !handoffToken && isConvexAuthenticated
      ? { handoffId }
      : "skip",
  ) as ProposalForgeHandoffRecord | undefined;
  const jobByIdQueryReference = React.useMemo(
    () => ((api as any).jobsPublic?.getById ?? "jobsPublic.getById") as any,
    [],
  );
  const canonicalJobRecord = useQuery(
    jobByIdQueryReference,
    canonicalJobId && isConvexAuthenticated
      ? { jobId: canonicalJobId }
      : "skip",
  ) as ProposalForgeCanonicalJob | undefined;
  const stagedSourceJobRecord = useQuery(
    jobByIdQueryReference,
    stagedSourceJobId && isConvexAuthenticated
      ? { jobId: stagedSourceJobId }
      : "skip",
  ) as ProposalForgeCanonicalJob | undefined;
  const canonicalRecordCvSelection = React.useMemo(
    () =>
      resolveAttachedCvSelectionById(
        canonicalJobRecord?.resumeId,
        canonicalJobRecord?.resumeName,
      ),
    [canonicalJobRecord?.resumeId, canonicalJobRecord?.resumeName],
  );

  React.useEffect(() => {
    if (lastScopedJobIdRef.current === canonicalJobId) {
      return;
    }

    lastScopedJobIdRef.current = canonicalJobId;
    lastRequestedScopedCvSyncKeyRef.current = null;
    setPendingScopedCvSelection(null);

    if (!canonicalJobId) {
      const nextSelection = resolveAttachedCvSelectionById(
        getProposalAttachedCvId(),
      );
      setAttachedCvId(nextSelection.id);
      setAttachedCvTitle(nextSelection.title);
    }
  }, [canonicalJobId]);

  React.useEffect(() => {
    if (!canonicalJobId) {
      return;
    }

    if (
      pendingScopedCvSelection &&
      pendingScopedCvSelection.id === canonicalRecordCvSelection.id
    ) {
      setPendingScopedCvSelection(null);
      lastRequestedScopedCvSyncKeyRef.current = null;
    }

    if (pendingScopedCvSelection) {
      return;
    }

    setAttachedCvId(canonicalRecordCvSelection.id);
    setAttachedCvTitle(canonicalRecordCvSelection.title);
  }, [
    canonicalJobId,
    canonicalRecordCvSelection.id,
    canonicalRecordCvSelection.title,
    pendingScopedCvSelection,
  ]);

  React.useEffect(() => {
    if (
      !canonicalJobId ||
      !pendingScopedCvSelection ||
      !isConvexAuthenticated ||
      isConvexAuthLoading
    ) {
      return;
    }

    const syncKey = `${canonicalJobId}:${pendingScopedCvSelection.id ?? ""}`;
    if (lastRequestedScopedCvSyncKeyRef.current === syncKey) {
      return;
    }

    lastRequestedScopedCvSyncKeyRef.current = syncKey;
    const requestedSelection = pendingScopedCvSelection;

    void setJobResume({
      jobId: canonicalJobId,
      resumeId: requestedSelection.id,
      resumeName: requestedSelection.title,
    }).catch((error: unknown) => {
      lastRequestedScopedCvSyncKeyRef.current = null;
      setPendingScopedCvSelection(null);
      setAttachedCvId(canonicalRecordCvSelection.id);
      setAttachedCvTitle(canonicalRecordCvSelection.title);
      showToast("Attach failed.", { variant: "error" });
    });
  }, [
    canonicalJobId,
    canonicalRecordCvSelection.id,
    canonicalRecordCvSelection.title,
    isConvexAuthLoading,
    isConvexAuthenticated,
    pendingScopedCvSelection,
    setJobResume,
    showToast,
  ]);

  const canonicalPrefill = React.useMemo<ProposalForgePrefill>(() => {
    if (!canonicalJobRecord) {
      return null;
    }

    return {
      handoffId: `job:${canonicalJobRecord.id}`,
      jobId: canonicalJobRecord.id,
      jobTitle: canonicalJobRecord.title,
      jobDescription: canonicalJobRecord.rawDescription,
      sourceUrl: canonicalJobRecord.sourceUrl,
      platform:
        canonicalJobRecord.sourceDomain || canonicalJobRecord.sourceType,
    };
  }, [canonicalJobRecord]);
  const handoffPrefill = React.useMemo<ProposalForgePrefill>(() => {
    const resolvedHandoffRecord = publicHandoffRecord ?? handoffRecord;
    if (!resolvedHandoffRecord || !handoffId) {
      return null;
    }

    return {
      handoffId,
      ...(canonicalJobId ? { jobId: canonicalJobId } : null),
      jobTitle: resolvedHandoffRecord.jobTitle,
      jobDescription: resolvedHandoffRecord.jobDescription,
      sourceUrl: resolvedHandoffRecord.sourceUrl,
      platform: resolvedHandoffRecord.platform,
    };
  }, [canonicalJobId, handoffId, handoffRecord, publicHandoffRecord]);
  const publicHandoffSeedKey = React.useMemo(
    () => (handoffId && handoffToken ? `${handoffId}:${handoffToken}` : null),
    [handoffId, handoffToken],
  );
  const [lockedPublicHandoffPrefill, setLockedPublicHandoffPrefill] =
    React.useState<ProposalForgePrefill>(null);

  React.useEffect(() => {
    if (!publicHandoffSeedKey || !handoffPrefill) {
      return;
    }

    if (
      lockedPublicHandoffPrefill?.handoffId === handoffPrefill.handoffId &&
      lockedPublicHandoffPrefill?.jobId === handoffPrefill.jobId &&
      lockedPublicHandoffPrefill?.jobTitle === handoffPrefill.jobTitle &&
      lockedPublicHandoffPrefill?.jobDescription ===
        handoffPrefill.jobDescription &&
      lockedPublicHandoffPrefill?.sourceUrl === handoffPrefill.sourceUrl &&
      lockedPublicHandoffPrefill?.platform === handoffPrefill.platform
    ) {
      return;
    }

    setLockedPublicHandoffPrefill(handoffPrefill);
  }, [
    handoffPrefill,
    lockedPublicHandoffPrefill?.handoffId,
    lockedPublicHandoffPrefill?.jobId,
    lockedPublicHandoffPrefill?.jobDescription,
    lockedPublicHandoffPrefill?.jobTitle,
    lockedPublicHandoffPrefill?.platform,
    lockedPublicHandoffPrefill?.sourceUrl,
    publicHandoffSeedKey,
  ]);

  React.useEffect(() => {
    if (publicHandoffSeedKey) {
      return;
    }

    if (
      lockedPublicHandoffPrefill?.jobId &&
      canonicalJobId &&
      canonicalJobId !== lockedPublicHandoffPrefill.jobId
    ) {
      setLockedPublicHandoffPrefill(null);
    }
  }, [canonicalJobId, lockedPublicHandoffPrefill?.jobId, publicHandoffSeedKey]);

  const activeLockedPublicHandoffPrefill =
    React.useMemo<ProposalForgePrefill>(() => {
      if (!lockedPublicHandoffPrefill) {
        return null;
      }

      if (
        canonicalJobId &&
        lockedPublicHandoffPrefill.jobId &&
        canonicalJobId !== lockedPublicHandoffPrefill.jobId
      ) {
        return null;
      }

      return lockedPublicHandoffPrefill;
    }, [canonicalJobId, lockedPublicHandoffPrefill]);

  const prefill = React.useMemo<ProposalForgePrefill>(() => {
    if (activeLockedPublicHandoffPrefill) {
      return activeLockedPublicHandoffPrefill;
    }
    if (handoffPrefill) {
      return handoffPrefill;
    }
    if (canonicalPrefill) {
      return {
        ...canonicalPrefill,
      };
    }
    return null;
  }, [activeLockedPublicHandoffPrefill, canonicalPrefill, handoffPrefill]);

  const storedComposeDraft =
    typeof window !== "undefined" ? readStoredProposalComposeDraft() : null;
  const resolvedProposalWorkspaceSourceDraft =
    React.useMemo<ResolvedProposalWorkspaceSourceDraft | null>(
      () =>
        resolveProposalWorkspaceSourceDraft({
          allowStoredDraftCandidates:
            !shouldStartFromEmptyProposalWorkspace && !jobContextCleared,
          canonicalJobRecord: !jobContextCleared && canonicalJobRecord
            ? {
                title: canonicalJobRecord.title,
                rawDescription: canonicalJobRecord.rawDescription,
                sourceUrl: canonicalJobRecord.sourceUrl,
                sourceDomain: canonicalJobRecord.sourceDomain,
              }
            : null,
          storedOutputSourceDraft:
            shouldStartFromEmptyProposalWorkspace || jobContextCleared
              ? null
              : storedOutputDraft?.sourceComposeDraft ?? null,
          composePreviewValues: stagedProposalSourceDraft
            ? null
            : composePreviewValues,
          outputSourceComposeDraft: stagedProposalSourceDraft
            ? null
            : outputSourceComposeDraft,
          composeDraftInitialSeed: stagedProposalSourceDraft
            ? null
            : composeDraftInitialSeed,
          storedComposeDraft:
            shouldStartFromEmptyProposalWorkspace ||
            jobContextCleared ||
            stagedProposalSourceDraft
              ? null
              : storedComposeDraft,
          prefill: !jobContextCleared && prefill
            ? {
                jobTitle: prefill.jobTitle,
                jobDescription: prefill.jobDescription,
                sourceUrl: prefill.sourceUrl ?? null,
                platform: prefill.platform ?? null,
              }
            : null,
          stickyImportedSource:
            !jobContextCleared &&
            !stagedProposalSourceDraft &&
            stickyImportedSource
              ? {
                  sourceUrl: stickyImportedSource.sourceUrl,
                  platform: stickyImportedSource.platform,
                }
              : null,
        }),
      [
        canonicalJobRecord?.rawDescription,
        canonicalJobRecord?.sourceDomain,
        canonicalJobRecord?.sourceUrl,
        canonicalJobRecord?.title,
        composeDraftInitialSeed,
        composePreviewValues,
        jobContextCleared,
        outputSourceComposeDraft,
        prefill?.jobDescription,
        prefill?.jobTitle,
        prefill?.platform,
        prefill?.sourceUrl,
        stickyImportedSource.platform,
        stickyImportedSource.sourceUrl,
        stagedProposalSourceDraft,
        storedComposeDraft,
        storedOutputDraft?.sourceComposeDraft,
        shouldStartFromEmptyProposalWorkspace,
      ],
    );

  const resolvedProposalJobId =
    canonicalJobId?.trim() ||
    prefill?.jobId?.trim() ||
    duplicateSourceJobId?.trim() ||
    "";

  const proposalHeaderSourceJobTitle =
    resolvedProposalWorkspaceSourceDraft?.jobTitle?.trim() || "";
  const proposalHeaderSourceDescription =
    resolvedProposalWorkspaceSourceDraft?.jobDescription?.trim() || "";
  const proposalHeaderSourceSummary = React.useMemo(
    () =>
      buildProposalSourceSummary({
        jobTitle: proposalHeaderSourceJobTitle,
        jobDescription: proposalHeaderSourceDescription,
      }),
    [proposalHeaderSourceDescription, proposalHeaderSourceJobTitle],
  );
  const autoProposalRecipientDetails = React.useMemo(
    () =>
      buildProposalRecipientPrefill({
        company: sanitizeProposalCompanyName(
          proposalHeaderSourceSummary.company,
        ),
        role: "",
        address: proposalHeaderSourceSummary.address,
        email: proposalHeaderSourceSummary.email,
        city:
          proposalHeaderSourceSummary.city ||
          proposalHeaderSourceSummary.location,
      }),
    [
      proposalHeaderSourceSummary.address,
      proposalHeaderSourceSummary.city,
      proposalHeaderSourceSummary.company,
      proposalHeaderSourceSummary.email,
      proposalHeaderSourceSummary.location,
    ],
  );
  const autoProposalLetterDate = React.useMemo(
    () => getDefaultProposalLetterDate(defaultPreviewApplicantHeader.location),
    [defaultPreviewApplicantHeader.location],
  );
  const lastAutoLetterHeaderRef = React.useRef({
    recipientDetails: autoProposalRecipientDetails,
    letterDate: autoProposalLetterDate,
    salutation: buildProposalSalutation(autoProposalRecipientDetails),
  });

  React.useEffect(() => {
    const previousAuto = lastAutoLetterHeaderRef.current;
    const nextAuto = {
      recipientDetails: autoProposalRecipientDetails,
      letterDate: autoProposalLetterDate,
      salutation: buildProposalSalutation(autoProposalRecipientDetails),
    };

    setProposalRecipientDetails((current) => {
      return resolveHeadingFieldFromAuto("recipientDetails", {
        current,
        previousAuto: previousAuto.recipientDetails,
        nextAuto: nextAuto.recipientDetails,
        isInvalidCurrent: (value) =>
          Boolean(value && !sanitizeProposalRecipientDetails(value)),
      });
    });
    setProposalLetterDate((current) => {
      return resolveHeadingFieldFromAuto("letterDate", {
        current,
        previousAuto: previousAuto.letterDate,
        nextAuto: nextAuto.letterDate,
      });
    });
    setProposalSalutationValue((current) => {
      const nextValue = resolveHeadingFieldFromAuto("salutation", {
        current,
        previousAuto: previousAuto.salutation,
        nextAuto: nextAuto.salutation,
      });
      proposalSalutationValueRef.current = nextValue;
      return nextValue;
    });
    setProposalContent((current) => {
      if (!current) {
        return current;
      }

      const currentSalutation = readProposalSalutation(current);
      if (
        !headingDirtyRef.current.salutation &&
        (!currentSalutation || currentSalutation === previousAuto.salutation)
      ) {
        return replaceProposalSalutation({
          content: current,
          salutation: nextAuto.salutation,
        });
      }

      return current;
    });

    lastAutoLetterHeaderRef.current = nextAuto;
  }, [
    autoProposalLetterDate,
    autoProposalRecipientDetails,
    resolveHeadingFieldFromAuto,
  ]);

  const consumedHandoffIdRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    if (requestedView !== "compose" || !prefill?.handoffId) {
      return;
    }

    const existingComposeDraft = readStoredProposalComposeDraft() ?? {};
    const nextComposeDraft = {
      ...existingComposeDraft,
      jobTitle: prefill.jobTitle,
      jobDescription: prefill.jobDescription,
      // Persist source metadata so "Imported from" survives URL-param removal
      sourceUrl: prefill.sourceUrl ?? null,
      platform: prefill.platform ?? null,
    };
    suppressStoredOutputDraftSyncRef.current = true;
    syncedStoredOutputSourceComposeRef.current = true;
    pendingComposeDraftSyncRef.current = null;
    if (composeDraftSyncTimeoutRef.current !== null) {
      window.clearTimeout(composeDraftSyncTimeoutRef.current);
      composeDraftSyncTimeoutRef.current = null;
    }
    setProposalContent(null);
    setLoading(false);
    setError(null);
    setErrorDetail(null);
    setStatusMessage(null);
    setFallbackInfo(null);
    setProposalType(null);
    setProposalVoicePreset(null);
    setProposalDocumentTitle("");
    setProposalDocumentTitleManual(false);
    setProposalDocumentMeta("");
    setGeneratedProposalId(null);
    generatedProposalIdRef.current = null;
    latestProposalStyleCommitRef.current = null;
    setProposalOutputMode("preview");
    lastSavedProposalContentRef.current = null;
    lastSavedProposalTitleRef.current = "";
    lastPersistedComposeTokenRef.current = null;
    composeAutosavePrimedRef.current = false;
    pendingQueuedComposeSnapshotRef.current = null;
    if (composeAutosaveTimeoutRef.current !== null) {
      window.clearTimeout(composeAutosaveTimeoutRef.current);
      composeAutosaveTimeoutRef.current = null;
    }
    setComposeSaveStatus("idle");
    setLastProposalRequest(null);
    setIsConfirmingGeneratedDelete(false);
    setIsComposePanelVisible(true);
    setIsBriefExpanded(true);
    setCopyFeedback("idle");
    writeStoredOutputDraft(null);
    writeStoredProposalComposeDraft(nextComposeDraft);
    setComposePreviewValues(nextComposeDraft);
    setOutputSourceComposeDraft(nextComposeDraft);
    setComposeDraftInitialSeed(nextComposeDraft);
    setComposeToolbarVoicePreset(
      normalizeComposeToolbarVoicePreset(nextComposeDraft.voicePreset ?? null),
    );
  }, [
    prefill?.handoffId,
    prefill?.jobDescription,
    prefill?.jobTitle,
    prefill?.sourceUrl,
    prefill?.platform,
    requestedView,
    writeStoredOutputDraft,
  ]);

  React.useEffect(() => {
    const storedComposeDraft =
      typeof window !== "undefined" && !shouldStartFromEmptyProposalWorkspace
        ? readStoredProposalComposeDraft()
        : null;
    const nextSourceUrl =
      prefill?.sourceUrl ??
      outputSourceComposeDraft?.sourceUrl ??
      composePreviewValues?.sourceUrl ??
      composeDraftInitialSeed?.sourceUrl ??
      (!shouldStartFromEmptyProposalWorkspace
        ? storedOutputDraft?.sourceComposeDraft?.sourceUrl
        : null) ??
      storedComposeDraft?.sourceUrl ??
      null;
    const nextPlatform =
      prefill?.platform ??
      outputSourceComposeDraft?.platform ??
      composePreviewValues?.platform ??
      composeDraftInitialSeed?.platform ??
      (!shouldStartFromEmptyProposalWorkspace
        ? storedOutputDraft?.sourceComposeDraft?.platform
        : null) ??
      storedComposeDraft?.platform ??
      null;

    if (!nextSourceUrl && !nextPlatform) {
      return;
    }

    setStickyImportedSource((current) => ({
      sourceUrl: nextSourceUrl ?? current.sourceUrl,
      platform: nextPlatform ?? current.platform,
    }));
  }, [
    composeDraftInitialSeed?.platform,
    composeDraftInitialSeed?.sourceUrl,
    composePreviewValues?.platform,
    composePreviewValues?.sourceUrl,
    outputSourceComposeDraft?.platform,
    outputSourceComposeDraft?.sourceUrl,
    prefill?.platform,
    prefill?.sourceUrl,
    shouldStartFromEmptyProposalWorkspace,
    storedOutputDraft?.sourceComposeDraft?.platform,
    storedOutputDraft?.sourceComposeDraft?.sourceUrl,
  ]);

  React.useEffect(() => {
    if (syncedStoredOutputSourceComposeRef.current) {
      return;
    }
    if (
      requestedView !== "compose" ||
      prefill?.handoffId ||
      shouldStartFromEmptyProposalWorkspace ||
      !storedOutputDraft?.sourceComposeDraft
    ) {
      return;
    }

    syncedStoredOutputSourceComposeRef.current = true;
    pendingComposeDraftSyncRef.current = null;
    if (composeDraftSyncTimeoutRef.current !== null) {
      window.clearTimeout(composeDraftSyncTimeoutRef.current);
      composeDraftSyncTimeoutRef.current = null;
    }
    writeStoredProposalComposeDraft(storedOutputDraft.sourceComposeDraft);
    setComposePreviewValues(storedOutputDraft.sourceComposeDraft);
    setComposeDraftInitialSeed(storedOutputDraft.sourceComposeDraft);
    setComposeToolbarVoicePreset(
      normalizeComposeToolbarVoicePreset(
        storedOutputDraft.sourceComposeDraft.voicePreset,
      ),
    );
  }, [
    prefill?.handoffId,
    requestedView,
    shouldStartFromEmptyProposalWorkspace,
    storedOutputDraft?.sourceComposeDraft,
  ]);

  React.useEffect(() => {
    if (!stagedSourceJobId || !stagedSourceJobRecord) {
      return;
    }

    const existingComposeDraft =
      composePreviewValues ??
      outputSourceComposeDraft ??
      storedOutputDraft?.sourceComposeDraft ??
      readStoredProposalComposeDraft() ??
      {};
    const nextDraft = buildProposalSourceDraftFromJob({
      job: stagedSourceJobRecord,
      existingDraft: existingComposeDraft,
      proposalType:
        proposalType ?? existingComposeDraft.proposalType ?? "cover_letter",
      voicePreset:
        proposalVoicePreset ?? existingComposeDraft.voicePreset ?? null,
      characterLimitMode:
        draftCharacterLimitMode ?? existingComposeDraft.characterLimitMode,
      characterLimitValue:
        draftCharacterLimitValue ?? existingComposeDraft.characterLimitValue,
    });

    setStagedProposalSourceDraft(nextDraft);
    setStagedSourceJobId(null);
    if (canonicalJobId) {
      void navigate("/proposal", { replace: true });
    }
    openTemplateSurface("proposal-draft");
    showToast(translateUi(resolvedLanguage, "workspace.jobSourceChanged"), {
      variant: "success",
      description: translateUi(
        resolvedLanguage,
        "workspace.letterUnchangedPickCvOrRegenerate",
      ),
    });
  }, [
    canonicalJobId,
    composePreviewValues,
    draftCharacterLimitMode,
    draftCharacterLimitValue,
    navigate,
    openTemplateSurface,
    outputSourceComposeDraft,
    proposalType,
    proposalVoicePreset,
    resolvedLanguage,
    showToast,
    stagedSourceJobId,
    stagedSourceJobRecord,
    storedOutputDraft,
  ]);

  React.useEffect(() => {
    if (requestedView !== "compose" || !prefill?.handoffId) {
      return;
    }

    if (consumedHandoffIdRef.current === prefill.handoffId) {
      return;
    }

    const params = new URLSearchParams(search);
    if (params.get("handoffId") !== prefill.handoffId) {
      return;
    }

    consumedHandoffIdRef.current = prefill.handoffId;
    params.delete("handoffId");
    params.delete("handoffToken");
    const nextSearch = params.toString();
    void navigate(nextSearch ? `/proposal?${nextSearch}` : "/proposal", {
      replace: true,
    });
  }, [navigate, prefill?.handoffId, requestedView, search]);

  React.useEffect(() => {
    if (
      requestedView !== "compose" ||
      proposalDrawerRouteIntent !== PROPOSAL_DRAFT_DRAWER_QUERY_VALUE
    ) {
      return;
    }

    openTemplateSurface("proposal-draft", {
      mode: isWideEnoughForDockedForgePanel ? "docked" : "overlay",
    });

    if (handoffId || handoffToken) {
      return;
    }

    const params = new URLSearchParams(search);
    if (
      params.get(PROPOSAL_DRAWER_QUERY_PARAM) !==
      PROPOSAL_DRAFT_DRAWER_QUERY_VALUE
    ) {
      return;
    }

    params.delete(PROPOSAL_DRAWER_QUERY_PARAM);
    const nextSearch = params.toString();
    void navigate(
      {
        pathname: location.pathname,
        search: nextSearch ? `?${nextSearch}` : "",
      },
      {
        replace: true,
        state: location.state,
      },
    );
  }, [
    handoffId,
    handoffToken,
    location.pathname,
    location.state,
    navigate,
    openTemplateSurface,
    isWideEnoughForDockedForgePanel,
    proposalDrawerRouteIntent,
    requestedView,
    search,
  ]);

  React.useEffect(() => {
    if (!currentProposalSettings?.templateId) {
      return;
    }

    setProposalTemplateId(
      (currentTemplateId) =>
        currentTemplateId ?? currentProposalSettings.templateId,
    );
  }, [currentProposalSettings?.templateId]);

  React.useEffect(() => {
    if (appliedSavedToolbarVoicePresetRef.current) {
      return;
    }
    if (composeToolbarVoicePreset !== null) {
      appliedSavedToolbarVoicePresetRef.current = true;
      return;
    }
    if (currentProposalSettings === undefined) {
      return;
    }

    setComposeToolbarVoicePreset(
      normalizeComposeToolbarVoicePreset(
        currentProposalSettings?.savedVoicePreset,
      ),
    );
    appliedSavedToolbarVoicePresetRef.current = true;
  }, [composeToolbarVoicePreset, currentProposalSettings]);

  React.useEffect(() => {
    if (
      proposalStyleLinkMode === "inherit_cv" &&
      !activeCvProposalStylePreset
    ) {
      setProposalStyleLinkMode("proposal_local");
      if (!proposalStylePreset) {
        setProposalStylePreset(resolveVerbatiStyle(undefined));
      }
      return;
    }

    if (
      !activeCvProposalStylePreset ||
      proposalStyleLinkMode !== "inherit_cv"
    ) {
      return;
    }

    setProposalStylePreset(activeCvProposalStylePreset);
    setProposalTemplateId(
      getProposalTwinTemplateId(activeCvProposalStylePreset),
    );
  }, [activeCvProposalStylePreset, proposalStyleLinkMode, proposalStylePreset]);

  const resolvedProposalLocalStyle = React.useMemo(() => {
    const baseRenderState = resolveProposalStyleRenderState({
      choice: proposalStyleChoice,
      jobTitle: composePreviewValues?.jobTitle ?? proposalDocumentTitle,
      jobDescription: composePreviewValues?.jobDescription,
    });
    const stylePreset = applyProposalTypographyPreference({
      stylePreset: baseRenderState.stylePreset,
      fontPairId: currentProposalSettings?.fontPairId,
    });

    return {
      ...baseRenderState,
      stylePreset,
      templateId: getProposalTwinTemplateId(stylePreset),
    };
  }, [
    composePreviewValues?.jobDescription,
    composePreviewValues?.jobTitle,
    currentProposalSettings?.fontPairId,
    proposalDocumentTitle,
    proposalStyleChoice,
  ]);

  React.useEffect(() => {
    if (
      appliedSettingsAppearanceDefaultsRef.current ||
      currentProposalSettings === undefined ||
      proposalSettingsPresets === undefined
    ) {
      return;
    }

    if (
      storedOutputAppearanceDraft?.proposalStyleChoice ||
      storedOutputAppearanceDraft?.proposalVerbatiStyle ||
      storedOutputAppearanceDraft?.proposalTemplateId ||
      storedOutputAppearanceDraft?.templateBundleId ||
      storedOutputAppearanceDraft?.customAccentHex ||
      storedOutputAppearanceDraft?.paletteOverride
    ) {
      appliedSettingsAppearanceDefaultsRef.current = true;
      return;
    }

    if (activeCvProposalStylePreset) {
      appliedSettingsAppearanceDefaultsRef.current = true;
      return;
    }

    if (proposalTemplateIntent || proposalStyleIntent) {
      appliedSettingsAppearanceDefaultsRef.current = true;
      return;
    }

    const settingsActiveTemplateBundleId =
      getProposalBundleForDocumentStyleSlot(
        proposalSettingsPresets?.activeSlot,
      );

    if (settingsStylePreset) {
      setProposalStylePreset(settingsStylePreset);
      setProposalWorkspaceStyle(settingsStylePreset);
      setHasUserEditedStyle(true);
      setProposalTemplateId(getProposalTwinTemplateId(settingsStylePreset));
      setProposalTemplateBundleId(settingsActiveTemplateBundleId);
      setProposalStyleChoice(
        resolveProposalStyleChoiceFromRenderState({
          templateId: getProposalTwinTemplateId(settingsStylePreset),
          stylePreset: settingsStylePreset,
        }) ?? settingsStyleChoice,
      );
    } else {
      setProposalStyleChoice(settingsStyleChoice);
    }
    setProposalPaletteOverride(settingsPaletteOverride);
    setProposalCustomAccentHex(settingsAccentHex);
    appliedSettingsAppearanceDefaultsRef.current = true;
  }, [
    activeCvProposalStylePreset,
    currentProposalSettings,
    proposalSettingsPresets,
    proposalSettingsPresets?.activeSlot,
    proposalStyleIntent,
    proposalTemplateIntent,
    settingsAccentHex,
    settingsPaletteOverride,
    settingsStylePreset,
    settingsStyleChoice,
    storedOutputAppearanceDraft?.customAccentHex,
    storedOutputAppearanceDraft?.paletteOverride,
    storedOutputAppearanceDraft?.proposalStyleChoice,
    storedOutputAppearanceDraft?.proposalTemplateId,
    storedOutputAppearanceDraft?.proposalVerbatiStyle,
    storedOutputAppearanceDraft?.templateBundleId,
    storedOutputAppearanceDraft?.verbatiStyleSlotId,
    storedOutputAppearanceDraft?.verbatiStyleBaseSnapshot,
  ]);

  const resolvedStyleLinkMode =
    proposalStyleLinkMode === "inherit_cv" && activeCvProposalStylePreset
      ? "inherit_cv"
      : "proposal_local";

  const selectedProposalBundleDefinition = React.useMemo(
    () =>
      proposalTemplateBundleId
        ? getProposalTemplateBundleDefinition(proposalTemplateBundleId)
        : null,
    [proposalTemplateBundleId],
  );
  const resolveSettingsBackedProposalBundleStyle = React.useCallback(
    (bundleId: ProposalTemplateBundleId) => {
      const slotId = getDocumentStyleSlotIdForProposalBundle(bundleId);
      if (!slotId) {
        return getProposalTemplateBundleDefinition(bundleId).stylePreset;
      }

      return resolveProposalStyleForDocumentSlot({
        slotId,
        savedPreset: getProposalSettingsPresetForSlot(
          proposalSettingsPresets,
          slotId,
        ),
      });
    },
    [proposalSettingsPresets],
  );

  React.useEffect(() => {
    if (hasUserEditedStyle) {
      return;
    }

    const shouldDeferToSettingsStylePreset =
      Boolean(settingsStylePreset) &&
      !activeCvProposalStylePreset &&
      !selectedProposalBundleDefinition &&
      !(
        storedOutputAppearanceDraft?.proposalStyleChoice ||
        storedOutputAppearanceDraft?.proposalVerbatiStyle ||
        storedOutputAppearanceDraft?.proposalTemplateId ||
        storedOutputAppearanceDraft?.templateBundleId ||
        storedOutputAppearanceDraft?.verbatiStyleSlotId ||
        storedOutputAppearanceDraft?.verbatiStyleBaseSnapshot ||
        storedOutputAppearanceDraft?.customAccentHex ||
        storedOutputAppearanceDraft?.paletteOverride
      );

    if (shouldDeferToSettingsStylePreset) {
      return;
    }

    if (resolvedStyleLinkMode !== "proposal_local") {
      return;
    }

    if (proposalTemplateIntent) {
      return;
    }

    if (selectedProposalBundleDefinition) {
      const selectedBundleStyle = resolveSettingsBackedProposalBundleStyle(
        selectedProposalBundleDefinition.id,
      );
      setProposalStylePreset((current) =>
        current && stylesEqual(current, selectedBundleStyle)
          ? current
          : selectedBundleStyle,
      );
      setProposalTemplateId((current) =>
        current === selectedProposalBundleDefinition.templateId
          ? current
          : selectedProposalBundleDefinition.templateId,
      );
      return;
    }

    setProposalStylePreset((current) =>
      current && stylesEqual(current, resolvedProposalLocalStyle.stylePreset)
        ? current
        : resolvedProposalLocalStyle.stylePreset,
    );
    setProposalTemplateId((current) =>
      current === resolvedProposalLocalStyle.templateId
        ? current
        : resolvedProposalLocalStyle.templateId,
    );
  }, [
    hasUserEditedStyle,
    activeCvProposalStylePreset,
    resolvedProposalLocalStyle.stylePreset,
    resolvedProposalLocalStyle.templateId,
    resolvedStyleLinkMode,
    resolveSettingsBackedProposalBundleStyle,
    selectedProposalBundleDefinition,
    settingsStylePreset,
    storedOutputAppearanceDraft?.customAccentHex,
    storedOutputAppearanceDraft?.paletteOverride,
    storedOutputAppearanceDraft?.proposalStyleChoice,
    storedOutputAppearanceDraft?.proposalTemplateId,
    storedOutputAppearanceDraft?.proposalVerbatiStyle,
    storedOutputAppearanceDraft?.templateBundleId,
  ]);

  const proposalMetadataStyle = React.useMemo(() => {
    const baseStyle = resolveVerbatiStyle(proposalStylePreset ?? undefined);

    if (proposalCustomAccentHex) {
      return resolveVerbatiStyle({
        ...baseStyle,
        palette: "custom",
        accentHex: proposalCustomAccentHex,
      });
    }

    if (proposalPaletteOverride) {
      return resolveVerbatiStyle({
        ...baseStyle,
        palette: proposalPaletteOverride,
      });
    }

    return baseStyle;
  }, [proposalStylePreset, proposalCustomAccentHex, proposalPaletteOverride]);
  const resolvedProposalRuntimeStyle = React.useMemo(
    () =>
      resolveProposalStyle({
        workspaceStyle: proposalWorkspaceStyle,
        metadataStyle: proposalMetadataStyle,
        cvStyle: activeCvProposalStylePreset,
        hasUserEditedStyle,
        isCvAttached: Boolean(attachedCvId && activeCvProposalStylePreset),
      }),
    [
      activeCvProposalStylePreset,
      attachedCvId,
      hasUserEditedStyle,
      proposalMetadataStyle,
      proposalWorkspaceStyle,
    ],
  );
  const effectiveProposalStylePreset = resolvedProposalRuntimeStyle.style;
  const effectiveProposalStylePresetWithPalette = effectiveProposalStylePreset;
  const effectiveProposalTemplateBundleId = React.useMemo(
    () =>
      proposalTemplateBundleId ??
      findProposalTemplateBundleIdByStylePreset(
        effectiveProposalStylePresetWithPalette,
      ),
    [effectiveProposalStylePresetWithPalette, proposalTemplateBundleId],
  );
  const effectiveProposalTemplateBundleBaseStyle = React.useMemo(
    () =>
      effectiveProposalTemplateBundleId
        ? resolveSettingsBackedProposalBundleStyle(
            effectiveProposalTemplateBundleId,
          )
        : null,
    [
      effectiveProposalTemplateBundleId,
      resolveSettingsBackedProposalBundleStyle,
    ],
  );
  const resolvedRuntimeStyleLinkMode =
    resolvedProposalRuntimeStyle.source === "cv"
      ? "inherit_cv"
      : "proposal_local";
  const proposalStyleStatus = React.useMemo(
    () =>
      resolveProposalStyleStatus({
        sourceCvId: attachedCvId,
        sourceCvLabel: attachedCvTitle,
        styleSource: resolvedProposalRuntimeStyle.source,
        hasSourceCvStyle: Boolean(activeCvProposalStylePreset),
      }),
    [
      activeCvProposalStylePreset,
      attachedCvId,
      attachedCvTitle,
      resolvedProposalRuntimeStyle.source,
    ],
  );
  const effectiveProposalTemplateId = React.useMemo(() => {
    if (resolvedProposalRuntimeStyle.source === "cv") {
      return getProposalTwinTemplateId(effectiveProposalStylePreset);
    }

    return (
      proposalTemplateId ??
      getProposalTwinTemplateId(effectiveProposalStylePreset)
    );
  }, [
    effectiveProposalStylePreset,
    proposalTemplateId,
    resolvedProposalRuntimeStyle.source,
  ]);
  const proposalStyleStatusLabel = React.useMemo(() => {
    switch (proposalStyleStatus.styleSource) {
      case "cv":
        return "CV";
      case "custom":
        return "Custom";
      case "default":
      default:
        return "Default";
    }
  }, [proposalStyleStatus.styleSource]);
  const composeRawCvStyleSource = React.useMemo(
    () =>
      attachedCvId || activeCvProposalStylePreset
        ? {
            cvId: attachedCvId ?? null,
            cvLabel: attachedCvTitle ?? null,
            metadata: buildProposalStyleTraceMetadataSnapshot({
              templateId: activeCvProposalStylePreset
                ? getProposalTwinTemplateId(activeCvProposalStylePreset)
                : null,
              verbatiStyle: activeCvProposalStylePreset ?? null,
              sourceCvId: attachedCvId,
              styleLinkMode: "inherit_cv",
            }),
          }
        : null,
    [activeCvProposalStylePreset, attachedCvId, attachedCvTitle],
  );
  const composeTraceWinner = React.useMemo(() => {
    const storageSnapshots = readProposalStyleTraceStorageSnapshots();
    const draftWinnerSource = resolveOutputDraftWinnerSource({
      localDraft: storageSnapshots.rawLocalOutputDraft,
      sessionDraft: storageSnapshots.rawSessionOutputDraft,
    });

    if (
      resolvedProposalRuntimeStyle.source === "cv" &&
      attachedCvId &&
      activeCvProposalStylePreset
    ) {
      return {
        winnerSource: "cv_inherit_resolver" as const,
        winnerReason: "styleLinkMode forced inherit_cv",
      };
    }

    if (resolvedProposalRuntimeStyle.source === "custom") {
      return {
        winnerSource:
          draftWinnerSource ??
          ("local_output_draft" as ProposalStyleTraceWinnerSource),
        winnerReason:
          draftWinnerSource === "session_output_draft"
            ? "session output draft carried the detached proposal style"
            : "proposal-local style resolved from the output draft path",
      };
    }

    return {
      winnerSource: "default_fallback" as const,
      winnerReason: "no draft style fields present, fell back to default",
    };
  }, [
    activeCvProposalStylePreset,
    attachedCvId,
    resolvedProposalRuntimeStyle.source,
  ]);
  const proposalRenderMetadata = React.useMemo<
    ProposalDocumentMetadata | undefined
  >(() => {
    const nextMetadata: ProposalDocumentMetadata = {};
    const documentStyleSlotId = getDocumentStyleSlotIdForProposalBundle(
      proposalTemplateBundleId,
    );

    const resolvedTemplateId =
      effectiveProposalTemplateId ??
      currentProposalSettings?.templateId ??
      fallbackProposalTemplateId;
    if (resolvedTemplateId) {
      nextMetadata.templateId = resolvedTemplateId;
    }

    nextMetadata.verbatiStyle = serializeProposalMetadataVerbatiStyle(
      effectiveProposalStylePresetWithPalette,
    );
    nextMetadata.styleLinkMode = resolvedRuntimeStyleLinkMode;
    if (attachedCvId) {
      nextMetadata.sourceCvId = attachedCvId;
    }
    nextMetadata.styleChoice = proposalStyleChoice;
    if (proposalTemplateBundleId) {
      nextMetadata.templateBundleId = proposalTemplateBundleId;
    }
    if (documentStyleSlotId) {
      const documentStyleSlotSource = getProposalSettingsPresetForSlot(
        proposalSettingsPresets,
        documentStyleSlotId,
      )
        ? "settings"
        : "factory";
      nextMetadata.verbatiStyleSlotId = documentStyleSlotId;
      nextMetadata.verbatiStyleSlotSource = documentStyleSlotSource;
      nextMetadata.verbatiStyleSlotNameSnapshot = `Style ${documentStyleSlotId}`;
      nextMetadata.verbatiStyleBaseSnapshot =
        buildProposalDocumentAppearanceSnapshot(
          effectiveProposalStylePresetWithPalette,
        );
      nextMetadata.documentStyleVersion = DOCUMENT_STYLE_VERSION;
    }
    if (draftCharacterLimitMode) {
      nextMetadata.characterLimitMode = draftCharacterLimitMode;
      nextMetadata.characterLimitValue = draftCharacterLimitValue;
    }

    return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
  }, [
    attachedCvId,
    currentProposalSettings?.templateId,
    draftCharacterLimitMode,
    draftCharacterLimitValue,
    effectiveProposalStylePresetWithPalette,
    effectiveProposalTemplateId,
    fallbackProposalTemplateId,
    proposalSettingsPresets,
    proposalTemplateBundleId,
    proposalStyleChoice,
    resolvedRuntimeStyleLinkMode,
  ]);
  const proposalPersistenceMetadata = React.useMemo<
    ProposalDocumentMetadata | undefined
  >(() => {
    const nextMetadata: ProposalDocumentMetadata = {
      ...(proposalRenderMetadata ?? {}),
    };

    if (proposalType) {
      nextMetadata.proposalType = proposalType;
    }
    if (proposalVoicePreset) {
      nextMetadata.voicePreset = proposalVoicePreset;
      nextMetadata.resolvedVoicePreset = proposalVoicePreset;
    }
    if (lastProposalRequest?.voicePreset !== undefined) {
      nextMetadata.requestedVoicePreset =
        lastProposalRequest.voicePreset ?? null;
    }

    const sourceJobTitle =
      resolvedProposalWorkspaceSourceDraft?.jobTitle?.trim() || "";
    if (sourceJobTitle) {
      nextMetadata.sourceJobTitle = sourceJobTitle;
    }
    const sourceJobDescription =
      resolvedProposalWorkspaceSourceDraft?.jobDescription?.trim() || "";
    if (sourceJobDescription) {
      nextMetadata.sourceJobDescription = sourceJobDescription;
    }
    const sourceUrl =
      resolvedProposalWorkspaceSourceDraft?.sourceUrl?.trim() || "";
    if (sourceUrl) {
      nextMetadata.sourceUrl = sourceUrl;
    }
    const sourcePlatform =
      resolvedProposalWorkspaceSourceDraft?.platform?.trim() || "";
    if (sourcePlatform) {
      nextMetadata.platform = sourcePlatform;
    }
    if (resolvedProposalJobId) {
      nextMetadata.jobId = resolvedProposalJobId;
    }
    if (lastProposalRequest?.formalityLevel) {
      nextMetadata.formalityLevel = lastProposalRequest.formalityLevel;
    }
    if (lastProposalRequest?.creativity) {
      nextMetadata.creativity = lastProposalRequest.creativity;
    }
    Object.assign(
      nextMetadata,
      buildProposalHeadingMetadataPatch({
        applicantName: sanitizeProposalApplicantName(proposalApplicantName),
        applicantRole: proposalApplicantRole,
        applicantCompany: proposalApplicantCompany,
        contactLine: proposalContactLine,
        letterDate: proposalLetterDate,
        recipientDetails: proposalRecipientDetails,
        headerVisibility: proposalHeaderVisibility,
      }),
    );

    const closing = resolveProposalClosingRef({
      closing: storedOutputProposalClosing,
      content: proposalContent,
      proposalType,
      applicantName: sanitizeProposalApplicantName(proposalApplicantName),
      voicePreset: proposalVoicePreset,
    });
    if (closing) {
      nextMetadata.closing = closing;
    }

    return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
  }, [
    resolvedProposalJobId,
    resolvedProposalWorkspaceSourceDraft?.jobDescription,
    resolvedProposalWorkspaceSourceDraft?.jobTitle,
    resolvedProposalWorkspaceSourceDraft?.platform,
    resolvedProposalWorkspaceSourceDraft?.sourceUrl,
    lastProposalRequest?.creativity,
    lastProposalRequest?.formalityLevel,
    lastProposalRequest?.voicePreset,
    proposalRenderMetadata,
    proposalApplicantName,
    proposalApplicantRole,
    proposalApplicantCompany,
    proposalContactLine,
    proposalContent,
    proposalHeaderVisibility,
    proposalLetterDate,
    proposalRecipientDetails,
    proposalType,
    proposalVoicePreset,
    storedOutputProposalClosingToken,
  ]);
  const buildComposeSaveSnapshot = React.useCallback(
    (
      requestedTitle?: string,
      status: "draft" | "saved" = proposalLibraryStatus,
    ) => {
      const trimmedContent = proposalContent?.trim() ?? "";
      if (!trimmedContent) {
        return null;
      }

      const normalizedTitle =
        requestedTitle?.trim() ||
        proposalDocumentTitle.trim() ||
        (proposalType
          ? proposalType === "cover_letter"
            ? "Letter"
            : proposalType === "application_message"
              ? "Message"
              : "Proposal"
          : "Generated proposal");

      const renderedMetadata = proposalPersistenceMetadata;
      const latestStyleCommit = latestProposalStyleCommitRef.current;
      const currentProposalId = generatedProposalIdRef.current
        ? String(generatedProposalIdRef.current)
        : null;
      const canApplyLatestStyleCommit =
        latestStyleCommit !== null &&
        latestStyleCommit.proposalId === currentProposalId;
      const metadata = canApplyLatestStyleCommit
        ? (() => {
            const mergedMetadata: ProposalDocumentMetadata = {
              ...(renderedMetadata ?? {}),
              templateId: latestStyleCommit.templateId,
              verbatiStyle: latestStyleCommit.verbatiStyle,
              styleLinkMode: latestStyleCommit.styleLinkMode,
              styleChoice: latestStyleCommit.styleChoice,
              verbatiStyleSlotId: latestStyleCommit.verbatiStyleSlotId,
              verbatiStyleSlotSource: latestStyleCommit.verbatiStyleSlotSource,
              verbatiStyleSlotNameSnapshot:
                latestStyleCommit.verbatiStyleSlotNameSnapshot,
              verbatiStyleBaseSnapshot:
                latestStyleCommit.verbatiStyleBaseSnapshot,
              documentStyleVersion: latestStyleCommit.documentStyleVersion,
            };
            if (latestStyleCommit.templateBundleId) {
              mergedMetadata.templateBundleId =
                latestStyleCommit.templateBundleId;
            } else {
              delete mergedMetadata.templateBundleId;
            }
            return mergedMetadata;
          })()
        : renderedMetadata;
      return {
        id: generatedProposalId,
        title: normalizedTitle,
        content: trimmedContent,
        metadata,
        status,
        token: JSON.stringify({
          title: normalizedTitle,
          content: trimmedContent,
          metadata: metadata ?? null,
          status,
        }),
      };
    },
    [
      generatedProposalId,
      proposalContent,
      proposalDocumentTitle,
      proposalLibraryStatus,
      proposalPersistenceMetadata,
      proposalType,
    ],
  );
  const composeAutosaveSnapshot = React.useMemo(
    () => buildComposeSaveSnapshot(),
    [buildComposeSaveSnapshot],
  );
  React.useEffect(() => {
    latestComposeAutosaveSnapshotRef.current = composeAutosaveSnapshot;
  }, [composeAutosaveSnapshot]);
  const performProposalSave = React.useCallback(
    async (
      initialSnapshot: NonNullable<typeof composeAutosaveSnapshot>,
      options?: { silent?: boolean },
    ) => {
      if (!canPersistProposalState) {
        if (!options?.silent) {
          showConvexAuthRequiredToast("Save");
        }
        return null;
      }

      if (
        isSavingComposeProposalRef.current &&
        pendingComposeSavePromiseRef.current
      ) {
        pendingQueuedComposeSnapshotRef.current = initialSnapshot;
        return pendingComposeSavePromiseRef.current;
      }

      const saveLoop = async () => {
        let nextSnapshot: typeof initialSnapshot | null = initialSnapshot;
        let lastPersistedId: Id<"proposals"> | null =
          generatedProposalIdRef.current;

        while (nextSnapshot) {
          pendingQueuedComposeSnapshotRef.current = null;
          isSavingComposeProposalRef.current = true;
          setComposeSaveStatus("saving");
          try {
            traceProposalStyle({
              step: "perform-proposal-save:before-write",
              proposalId:
                generatedProposalIdRef.current ?? nextSnapshot.id
                  ? String(generatedProposalIdRef.current ?? nextSnapshot.id)
                  : null,
              generatedProposalId: generatedProposalIdRef.current
                ? String(generatedProposalIdRef.current)
                : null,
              selectedProposalId,
              composeToken: nextSnapshot.token,
              persistedToken: lastPersistedComposeTokenRef.current,
              winnerSource: composeTraceWinner.winnerSource,
              winnerReason: composeTraceWinner.winnerReason,
              rawServerRow: null,
              rawQueryRow: null,
              rawCvStyleSource: composeRawCvStyleSource,
              resolvedRenderState: buildResolvedRenderTraceSnapshot({
                proposalId: generatedProposalIdRef.current ?? nextSnapshot.id,
                templateId: nextSnapshot.metadata?.templateId,
                stylePreset: nextSnapshot.metadata?.verbatiStyle ?? null,
                sourceCvId: nextSnapshot.metadata?.sourceCvId,
                styleLinkMode: nextSnapshot.metadata?.styleLinkMode ?? null,
                styleSource: composeTraceWinner.winnerSource,
              }),
              traceData: {
                savePayload: {
                  proposalId: nextSnapshot.id ? String(nextSnapshot.id) : null,
                  title: nextSnapshot.title,
                  status: nextSnapshot.status ?? "saved",
                  metadata: buildProposalStyleTraceMetadataSnapshot({
                    templateId: nextSnapshot.metadata?.templateId,
                    verbatiStyle: nextSnapshot.metadata?.verbatiStyle,
                    sourceCvId: nextSnapshot.metadata?.sourceCvId,
                    styleLinkMode: nextSnapshot.metadata?.styleLinkMode,
                  }),
                },
              },
            });
            if (generatedProposalIdRef.current) {
              await updateProposal({
                id: generatedProposalIdRef.current,
                title: nextSnapshot.title,
                content: nextSnapshot.content,
                sections: [{ type: "text", content: nextSnapshot.content }],
                status: nextSnapshot.status,
                metadata: nextSnapshot.metadata,
              });
              lastPersistedId = generatedProposalIdRef.current;
            } else {
              const createdId = (await createProposal({
                title: nextSnapshot.title,
                content: nextSnapshot.content,
                sections: [{ type: "text", content: nextSnapshot.content }],
                status: nextSnapshot.status,
                metadata: nextSnapshot.metadata,
              })) as Id<"proposals">;
              generatedProposalIdRef.current = createdId;
              setGeneratedProposalId(createdId);
              lastPersistedId = createdId;
            }

            traceProposalStyle({
              step: "perform-proposal-save:after-write",
              proposalId: lastPersistedId ? String(lastPersistedId) : null,
              generatedProposalId: lastPersistedId
                ? String(lastPersistedId)
                : null,
              selectedProposalId,
              composeToken: nextSnapshot.token,
              persistedToken: nextSnapshot.token,
              winnerSource: composeTraceWinner.winnerSource,
              winnerReason: composeTraceWinner.winnerReason,
              rawServerRow: null,
              rawQueryRow: null,
              rawCvStyleSource: composeRawCvStyleSource,
              resolvedRenderState: buildResolvedRenderTraceSnapshot({
                proposalId: lastPersistedId,
                templateId: nextSnapshot.metadata?.templateId,
                stylePreset: nextSnapshot.metadata?.verbatiStyle ?? null,
                sourceCvId: nextSnapshot.metadata?.sourceCvId,
                styleLinkMode: nextSnapshot.metadata?.styleLinkMode ?? null,
                styleSource: composeTraceWinner.winnerSource,
              }),
            });
            lastSavedProposalContentRef.current = nextSnapshot.content;
            lastSavedProposalTitleRef.current = nextSnapshot.title;
            lastPersistedComposeTokenRef.current = nextSnapshot.token;
            const latestStyleCommit = latestProposalStyleCommitRef.current;
            if (
              latestStyleCommit &&
              nextSnapshot.metadata?.templateId ===
                latestStyleCommit.templateId &&
              nextSnapshot.metadata?.styleLinkMode ===
                latestStyleCommit.styleLinkMode &&
              JSON.stringify(nextSnapshot.metadata?.verbatiStyle ?? null) ===
                JSON.stringify(latestStyleCommit.verbatiStyle ?? null)
            ) {
              latestProposalStyleCommitRef.current = null;
            }
            setComposeSaveStatus("saved");
          } catch (saveError) {
            traceProposalStyle({
              step: "perform-proposal-save:error",
              proposalId:
                generatedProposalIdRef.current ?? nextSnapshot.id
                  ? String(generatedProposalIdRef.current ?? nextSnapshot.id)
                  : null,
              generatedProposalId: generatedProposalIdRef.current
                ? String(generatedProposalIdRef.current)
                : null,
              selectedProposalId,
              composeToken: nextSnapshot.token,
              persistedToken: lastPersistedComposeTokenRef.current,
              winnerSource: composeTraceWinner.winnerSource,
              winnerReason: composeTraceWinner.winnerReason,
              rawServerRow: null,
              rawQueryRow: null,
              rawCvStyleSource: composeRawCvStyleSource,
              resolvedRenderState: buildResolvedRenderTraceSnapshot({
                proposalId: generatedProposalIdRef.current ?? nextSnapshot.id,
                templateId: nextSnapshot.metadata?.templateId,
                stylePreset: nextSnapshot.metadata?.verbatiStyle ?? null,
                sourceCvId: nextSnapshot.metadata?.sourceCvId,
                styleLinkMode: nextSnapshot.metadata?.styleLinkMode ?? null,
                styleSource: composeTraceWinner.winnerSource,
              }),
              traceData: {
                error:
                  saveError instanceof Error
                    ? saveError.message
                    : String(saveError),
              },
            });
            console.error("Failed to persist proposal draft:", saveError);
            const errorMessage =
              saveError instanceof Error
                ? saveError.message
                : String(saveError);
            if (errorMessage.includes("Proposal not found")) {
              generatedProposalIdRef.current = null;
              setGeneratedProposalId(null);
              lastPersistedComposeTokenRef.current = null;
            }
            setComposeSaveStatus("error");
            throw saveError;
          } finally {
            isSavingComposeProposalRef.current = false;
          }

          const queuedSnapshot = pendingQueuedComposeSnapshotRef.current as
            | typeof initialSnapshot
            | null;
          nextSnapshot =
            queuedSnapshot &&
            queuedSnapshot.token !== lastPersistedComposeTokenRef.current
              ? queuedSnapshot
              : null;
        }

        return lastPersistedId;
      };

      const pendingPromise = saveLoop();
      pendingComposeSavePromiseRef.current = pendingPromise;

      try {
        return await pendingPromise;
      } finally {
        if (pendingComposeSavePromiseRef.current === pendingPromise) {
          pendingComposeSavePromiseRef.current = null;
        }
      }
    },
    [
      canPersistProposalState,
      composeRawCvStyleSource,
      composeTraceWinner.winnerReason,
      composeTraceWinner.winnerSource,
      createProposal,
      selectedProposalId,
      showConvexAuthRequiredToast,
      traceProposalStyle,
      updateProposal,
    ],
  );
  const scheduleProposalSave = React.useCallback(
    (snapshot: NonNullable<typeof composeAutosaveSnapshot>) => {
      if (composeAutosaveTimeoutRef.current) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
      }

      pendingQueuedComposeSnapshotRef.current = snapshot;
      setComposeSaveStatus("saving");
      composeAutosaveTimeoutRef.current = window.setTimeout(() => {
        composeAutosaveTimeoutRef.current = null;
        const nextSnapshot = pendingQueuedComposeSnapshotRef.current;
        if (!nextSnapshot) {
          return;
        }
        void performProposalSave(nextSnapshot, { silent: true }).catch(
          () => {},
        );
      }, PROPOSAL_SAVE_DEBOUNCE_MS);
    },
    [performProposalSave],
  );
  const flushScheduledProposalSave = React.useCallback(
    async (
      requestedTitle?: string,
      options?: { force?: boolean; status?: "draft" | "saved" },
    ) => {
      if (composeAutosaveTimeoutRef.current) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
        composeAutosaveTimeoutRef.current = null;
      }

      const snapshot =
        buildComposeSaveSnapshot(requestedTitle, options?.status ?? "draft") ??
        pendingQueuedComposeSnapshotRef.current;
      if (!snapshot) {
        traceProposalStyle({
          step: "flush-scheduled-proposal-save:no-snapshot",
          proposalId: generatedProposalIdRef.current
            ? String(generatedProposalIdRef.current)
            : null,
          generatedProposalId: generatedProposalIdRef.current
            ? String(generatedProposalIdRef.current)
            : null,
          selectedProposalId,
          composeToken: null,
          persistedToken: lastPersistedComposeTokenRef.current,
          winnerSource: composeTraceWinner.winnerSource,
          winnerReason: "no save snapshot available to flush",
          rawServerRow: null,
          rawQueryRow: null,
          rawCvStyleSource: composeRawCvStyleSource,
          resolvedRenderState: null,
        });
        return generatedProposalIdRef.current;
      }

      traceProposalStyle({
        step: "flush-scheduled-proposal-save",
        proposalId:
          generatedProposalIdRef.current ?? snapshot.id
            ? String(generatedProposalIdRef.current ?? snapshot.id)
            : null,
        generatedProposalId: generatedProposalIdRef.current
          ? String(generatedProposalIdRef.current)
          : null,
        selectedProposalId,
        composeToken: snapshot.token,
        persistedToken: lastPersistedComposeTokenRef.current,
        winnerSource: composeTraceWinner.winnerSource,
        winnerReason: composeTraceWinner.winnerReason,
        rawServerRow: null,
        rawQueryRow: null,
        rawCvStyleSource: composeRawCvStyleSource,
        resolvedRenderState: buildResolvedRenderTraceSnapshot({
          proposalId: generatedProposalIdRef.current ?? snapshot.id,
          templateId: snapshot.metadata?.templateId,
          stylePreset: snapshot.metadata?.verbatiStyle ?? null,
          sourceCvId: snapshot.metadata?.sourceCvId,
          styleLinkMode: snapshot.metadata?.styleLinkMode ?? null,
          styleSource: composeTraceWinner.winnerSource,
        }),
        traceData: {
          force: options?.force === true,
          requestedTitle: requestedTitle ?? null,
        },
      });

      if (pendingComposeSavePromiseRef.current) {
        await pendingComposeSavePromiseRef.current;
      }

      if (snapshot.token === lastPersistedComposeTokenRef.current) {
        traceProposalStyle({
          step: "flush-scheduled-proposal-save:skip-existing-token",
          proposalId:
            generatedProposalIdRef.current ?? snapshot.id
              ? String(generatedProposalIdRef.current ?? snapshot.id)
              : null,
          generatedProposalId: generatedProposalIdRef.current
            ? String(generatedProposalIdRef.current)
            : null,
          selectedProposalId,
          composeToken: snapshot.token,
          persistedToken: lastPersistedComposeTokenRef.current,
          winnerSource: composeTraceWinner.winnerSource,
          winnerReason: "compose token already persisted",
          rawServerRow: null,
          rawQueryRow: null,
          rawCvStyleSource: composeRawCvStyleSource,
          resolvedRenderState: null,
          traceData: {
            force: options?.force === true,
          },
        });
        if (!options?.force || generatedProposalIdRef.current) {
          return generatedProposalIdRef.current;
        }
      }

      pendingQueuedComposeSnapshotRef.current = snapshot;
      return performProposalSave(snapshot);
    },
    [
      buildComposeSaveSnapshot,
      composeRawCvStyleSource,
      composeTraceWinner.winnerReason,
      composeTraceWinner.winnerSource,
      performProposalSave,
      selectedProposalId,
      traceProposalStyle,
    ],
  );
  const performProposalSaveRef = React.useRef(performProposalSave);
  React.useEffect(() => {
    performProposalSaveRef.current = performProposalSave;
  }, [performProposalSave]);

  React.useEffect(() => {
    return () => {
      const pendingSnapshot =
        pendingQueuedComposeSnapshotRef.current ??
        latestComposeAutosaveSnapshotRef.current;
      if (!pendingSnapshot) return;
      if (pendingSnapshot.token === lastPersistedComposeTokenRef.current)
        return;
      if (composeAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
        composeAutosaveTimeoutRef.current = null;
      }
      void performProposalSaveRef
        .current(pendingSnapshot, { silent: true })
        .catch(() => {});
    };
  }, []);

  const optimisticSavedDraftProposal =
    React.useMemo<SavedProposalRecord | null>(() => null, []);
  const sortedSavedProposals = React.useMemo(() => {
    const mergedProposals = new Map<string, SavedProposalRecord>();

    for (const proposal of savedProposals ?? fallbackSavedProposals) {
      mergedProposals.set(String(proposal._id), proposal);
    }

    if (optimisticSavedDraftProposal) {
      const optimisticId = String(optimisticSavedDraftProposal._id);
      if (!mergedProposals.has(optimisticId)) {
        mergedProposals.set(optimisticId, optimisticSavedDraftProposal);
      }
    }

    return [...mergedProposals.values()]
      .filter((proposal) => proposal.status === "saved")
      .sort((left, right) => right._creationTime - left._creationTime);
  }, [fallbackSavedProposals, optimisticSavedDraftProposal, savedProposals]);
  const openedSavedProposal = React.useMemo(
    () =>
      selectedProposalId
        ? sortedSavedProposals.find(
            (proposal) => String(proposal._id) === String(selectedProposalId),
          ) ?? null
        : null,
    [selectedProposalId, sortedSavedProposals],
  );
  const querySelectedSavedProposal = React.useMemo(
    () =>
      selectedProposalId
        ? (savedProposals ?? []).find(
            (proposal) => String(proposal._id) === String(selectedProposalId),
          ) ?? null
        : null,
    [savedProposals, selectedProposalId],
  );
  const fallbackSelectedSavedProposal = React.useMemo(
    () =>
      selectedProposalId
        ? fallbackSavedProposals.find(
            (proposal) => String(proposal._id) === String(selectedProposalId),
          ) ?? null
        : null,
    [fallbackSavedProposals, selectedProposalId],
  );
  const savedSelectionTraceWinner = React.useMemo(() => {
    const storageSnapshots = readProposalStyleTraceStorageSnapshots();
    const draftWinnerSource = resolveOutputDraftWinnerSource({
      localDraft: storageSnapshots.rawLocalOutputDraft,
      sessionDraft: storageSnapshots.rawSessionOutputDraft,
    });

    if (querySelectedSavedProposal || fallbackSelectedSavedProposal) {
      return {
        winnerSource: "server_row" as const,
        winnerReason: querySelectedSavedProposal
          ? "selected proposal matched saved proposal query row"
          : "selected proposal matched saved proposal fallback row",
        rawServerRow: snapshotSavedProposalRecord(
          querySelectedSavedProposal ?? fallbackSelectedSavedProposal,
        ),
        rawQueryRow: snapshotSavedProposalRecord(querySelectedSavedProposal),
      };
    }

    if (
      selectedProposalId &&
      optimisticSavedDraftProposal &&
      String(optimisticSavedDraftProposal._id) === String(selectedProposalId)
    ) {
      return {
        winnerSource: (draftWinnerSource ??
          "local_output_draft") as ProposalStyleTraceWinnerSource,
        winnerReason: "same-id optimistic overlay matched selected proposal",
        rawServerRow: null,
        rawQueryRow: snapshotSavedProposalRecord(querySelectedSavedProposal),
      };
    }

    return {
      winnerSource: "default_fallback" as const,
      winnerReason: "no server/query row available",
      rawServerRow: snapshotSavedProposalRecord(
        querySelectedSavedProposal ?? fallbackSelectedSavedProposal,
      ),
      rawQueryRow: snapshotSavedProposalRecord(querySelectedSavedProposal),
    };
  }, [
    fallbackSelectedSavedProposal,
    optimisticSavedDraftProposal,
    querySelectedSavedProposal,
    selectedProposalId,
  ]);
  const openedSavedProposalSourceCvId = React.useMemo(
    () => normalizeSourceCvId(openedSavedProposal?.metadata?.sourceCvId),
    [openedSavedProposal?.metadata?.sourceCvId],
  );
  const openedSavedProposalSourceCvLabel = React.useMemo(
    () => resolveSourceCvTitle(openedSavedProposalSourceCvId),
    [openedSavedProposalSourceCvId],
  );
  const openedSavedProposalSourceCvStylePreset = React.useMemo(
    () => resolveSourceCvStylePreset(openedSavedProposalSourceCvId),
    [openedSavedProposalSourceCvId],
  );
  const savedProposalHasPersistedStyleSnapshot = React.useMemo(
    () =>
      Boolean(
        openedSavedProposal?.metadata?.verbatiStyle ||
          openedSavedProposal?.metadata?.templateId ||
          openedSavedProposal?.metadata?.verbatiStyleBaseSnapshot ||
          openedSavedProposal?.metadata?.verbatiStyleSlotId,
      ),
    [
      openedSavedProposal?.metadata?.templateId,
      openedSavedProposal?.metadata?.verbatiStyle,
      openedSavedProposal?.metadata?.verbatiStyleBaseSnapshot,
      openedSavedProposal?.metadata?.verbatiStyleSlotId,
    ],
  );
  const resolvedSavedProposalRuntimeStyle = React.useMemo(
    () => ({
      style:
        savedProposalStylePreset ??
        resolveVerbatiStyle(
          savedProposalHasPersistedStyleSnapshot
            ? openedSavedProposal?.metadata?.verbatiStyle
            : openedSavedProposalSourceCvStylePreset ?? undefined,
        ),
      source:
        savedProposalStyleLinkMode === "proposal_local"
          ? ("custom" as const)
          : openedSavedProposalSourceCvId
            ? ("cv" as const)
            : ("default" as const),
    }),
    [
      openedSavedProposal?.metadata?.verbatiStyle,
      openedSavedProposalSourceCvId,
      openedSavedProposalSourceCvStylePreset,
      savedProposalHasPersistedStyleSnapshot,
      savedProposalStyleLinkMode,
      savedProposalStylePreset,
    ],
  );
  const savedRawCvStyleSource = React.useMemo(
    () =>
      openedSavedProposalSourceCvId || openedSavedProposalSourceCvStylePreset
        ? {
            cvId: openedSavedProposalSourceCvId ?? null,
            cvLabel: openedSavedProposalSourceCvLabel ?? null,
            metadata: buildProposalStyleTraceMetadataSnapshot({
              templateId: openedSavedProposalSourceCvStylePreset
                ? getProposalTwinTemplateId(
                    openedSavedProposalSourceCvStylePreset,
                  )
                : null,
              verbatiStyle: openedSavedProposalSourceCvStylePreset ?? null,
              sourceCvId: openedSavedProposalSourceCvId,
              styleLinkMode: "inherit_cv",
            }),
          }
        : null,
    [
      openedSavedProposalSourceCvId,
      openedSavedProposalSourceCvLabel,
      openedSavedProposalSourceCvStylePreset,
    ],
  );
  const savedRenderTraceWinner = React.useMemo(() => {
    if (
      savedSelectionTraceWinner.winnerSource === "local_output_draft" ||
      savedSelectionTraceWinner.winnerSource === "session_output_draft"
    ) {
      return {
        winnerSource: savedSelectionTraceWinner.winnerSource,
        winnerReason: savedSelectionTraceWinner.winnerReason,
      };
    }

    if (openedSavedProposal && savedProposalHasPersistedStyleSnapshot) {
      return {
        winnerSource: "server_row" as const,
        winnerReason: "saved row carried persisted style snapshot",
      };
    }

    if (
      openedSavedProposalSourceCvId &&
      openedSavedProposalSourceCvStylePreset
    ) {
      return {
        winnerSource: "cv_inherit_resolver" as const,
        winnerReason: "saved row lacked persisted style snapshot",
      };
    }

    return {
      winnerSource: "default_fallback" as const,
      winnerReason: openedSavedProposal
        ? "no draft style fields present, fell back to default"
        : savedSelectionTraceWinner.winnerReason,
    };
  }, [
    openedSavedProposal,
    openedSavedProposalSourceCvId,
    openedSavedProposalSourceCvStylePreset,
    savedProposalHasPersistedStyleSnapshot,
    savedSelectionTraceWinner.winnerReason,
    savedSelectionTraceWinner.winnerSource,
  ]);
  const effectiveSavedProposalStylePreset = React.useMemo(
    () => resolvedSavedProposalRuntimeStyle.style,
    [resolvedSavedProposalRuntimeStyle.style],
  );
  const effectiveSavedProposalTemplateId = React.useMemo(
    () =>
      savedProposalTemplateId ??
      getProposalTwinTemplateId(effectiveSavedProposalStylePreset),
    [effectiveSavedProposalStylePreset, savedProposalTemplateId],
  );
  const savedProposalRenderMetadata = React.useMemo<
    ProposalDocumentMetadata | undefined
  >(() => {
    if (!openedSavedProposal) {
      return undefined;
    }

    return {
      ...openedSavedProposal.metadata,
      proposalType:
        savedProposalType ??
        openedSavedProposal.metadata?.proposalType ??
        undefined,
      voicePreset:
        savedProposalVoicePreset ??
        openedSavedProposal.metadata?.resolvedVoicePreset ??
        openedSavedProposal.metadata?.voicePreset ??
        undefined,
      sourceCvId: openedSavedProposalSourceCvId ?? undefined,
      templateId: effectiveSavedProposalTemplateId,
      verbatiStyle: serializeProposalMetadataVerbatiStyle(
        effectiveSavedProposalStylePreset,
      ),
      styleLinkMode: savedProposalStyleLinkMode,
      styleChoice:
        openedSavedProposal.metadata?.styleChoice ??
        resolveProposalStyleChoiceFromRenderState({
          templateId: effectiveSavedProposalTemplateId,
          stylePreset: effectiveSavedProposalStylePreset,
        }) ??
        undefined,
    };
  }, [
    effectiveSavedProposalStylePreset,
    effectiveSavedProposalTemplateId,
    openedSavedProposal,
    openedSavedProposalSourceCvId,
    savedProposalType,
    savedProposalStyleLinkMode,
    savedProposalVoicePreset,
  ]);

  React.useEffect(() => {
    if (!proposalContent?.trim()) {
      return;
    }

    traceProposalStyle({
      step: "compose-render-ready",
      proposalId: generatedProposalId ? String(generatedProposalId) : null,
      generatedProposalId: generatedProposalId
        ? String(generatedProposalId)
        : null,
      selectedProposalId,
      composeToken: composeAutosaveSnapshot?.token ?? null,
      persistedToken: lastPersistedComposeTokenRef.current,
      winnerSource: composeTraceWinner.winnerSource,
      winnerReason: composeTraceWinner.winnerReason,
      rawServerRow: null,
      rawQueryRow: null,
      rawCvStyleSource: composeRawCvStyleSource,
      resolvedRenderState: buildResolvedRenderTraceSnapshot({
        proposalId: generatedProposalId,
        templateId: effectiveProposalTemplateId,
        stylePreset: effectiveProposalStylePresetWithPalette,
        sourceCvId: attachedCvId,
        styleLinkMode: resolvedRuntimeStyleLinkMode,
        styleSource: resolvedProposalRuntimeStyle.source,
      }),
      traceData: {
        proposalPersistenceMetadata: buildProposalStyleTraceMetadataSnapshot({
          templateId: proposalPersistenceMetadata?.templateId,
          verbatiStyle: proposalPersistenceMetadata?.verbatiStyle,
          sourceCvId: proposalPersistenceMetadata?.sourceCvId,
          styleLinkMode: proposalPersistenceMetadata?.styleLinkMode,
        }),
        composeSaveStatus,
      },
    });
  }, [
    attachedCvId,
    composeAutosaveSnapshot?.token,
    composeRawCvStyleSource,
    composeSaveStatus,
    composeTraceWinner.winnerReason,
    composeTraceWinner.winnerSource,
    effectiveProposalStylePresetWithPalette,
    effectiveProposalTemplateId,
    generatedProposalId,
    proposalContent,
    proposalPersistenceMetadata?.sourceCvId,
    proposalPersistenceMetadata?.styleLinkMode,
    proposalPersistenceMetadata?.templateId,
    proposalPersistenceMetadata?.verbatiStyle,
    resolvedProposalRuntimeStyle.source,
    resolvedRuntimeStyleLinkMode,
    selectedProposalId,
    traceProposalStyle,
  ]);

  React.useEffect(() => {
    if (!optimisticSavedDraftProposal) {
      return;
    }

    traceProposalStyle({
      step: "saved-optimistic-overlay",
      proposalId: String(optimisticSavedDraftProposal._id),
      generatedProposalId: generatedProposalId
        ? String(generatedProposalId)
        : null,
      selectedProposalId,
      composeToken: composeAutosaveSnapshot?.token ?? null,
      persistedToken: lastPersistedComposeTokenRef.current,
      winnerSource: (() => {
        const storageSnapshots = readProposalStyleTraceStorageSnapshots();
        return (
          resolveOutputDraftWinnerSource({
            localDraft: storageSnapshots.rawLocalOutputDraft,
            sessionDraft: storageSnapshots.rawSessionOutputDraft,
          }) ?? "local_output_draft"
        );
      })(),
      winnerReason: "same-id optimistic overlay matched selected proposal",
      rawServerRow: savedSelectionTraceWinner.rawServerRow,
      rawQueryRow: savedSelectionTraceWinner.rawQueryRow,
      rawCvStyleSource: composeRawCvStyleSource,
      resolvedRenderState: snapshotSavedProposalRecord(
        optimisticSavedDraftProposal,
      ),
    });
  }, [
    composeAutosaveSnapshot?.token,
    composeRawCvStyleSource,
    generatedProposalId,
    optimisticSavedDraftProposal,
    selectedProposalId,
    savedSelectionTraceWinner.rawQueryRow,
    savedSelectionTraceWinner.rawServerRow,
    traceProposalStyle,
  ]);

  React.useEffect(() => {
    if (!selectedProposalId) {
      return;
    }

    traceProposalStyle({
      step: "saved-merge",
      proposalId: selectedProposalId,
      generatedProposalId: generatedProposalId
        ? String(generatedProposalId)
        : null,
      selectedProposalId,
      composeToken: composeAutosaveSnapshot?.token ?? null,
      persistedToken: lastPersistedComposeTokenRef.current,
      winnerSource: savedSelectionTraceWinner.winnerSource,
      winnerReason: savedSelectionTraceWinner.winnerReason,
      rawServerRow: savedSelectionTraceWinner.rawServerRow,
      rawQueryRow: savedSelectionTraceWinner.rawQueryRow,
      rawCvStyleSource: savedRawCvStyleSource,
      resolvedRenderState: snapshotSavedProposalRecord(openedSavedProposal),
      traceData: {
        mergedProposalIds: sortedSavedProposals.map((proposal) =>
          String(proposal._id),
        ),
      },
    });
  }, [
    composeAutosaveSnapshot?.token,
    generatedProposalId,
    openedSavedProposal,
    savedRawCvStyleSource,
    savedSelectionTraceWinner.rawQueryRow,
    savedSelectionTraceWinner.rawServerRow,
    savedSelectionTraceWinner.winnerReason,
    savedSelectionTraceWinner.winnerSource,
    selectedProposalId,
    sortedSavedProposals,
    traceProposalStyle,
  ]);

  React.useEffect(() => {
    if (!selectedProposalId) {
      return;
    }

    traceProposalStyle({
      step: "saved-opened-proposal",
      proposalId: openedSavedProposal
        ? String(openedSavedProposal._id)
        : selectedProposalId,
      generatedProposalId: generatedProposalId
        ? String(generatedProposalId)
        : null,
      selectedProposalId,
      composeToken: composeAutosaveSnapshot?.token ?? null,
      persistedToken: lastPersistedComposeTokenRef.current,
      winnerSource: savedSelectionTraceWinner.winnerSource,
      winnerReason: savedSelectionTraceWinner.winnerReason,
      rawServerRow: savedSelectionTraceWinner.rawServerRow,
      rawQueryRow: savedSelectionTraceWinner.rawQueryRow,
      rawCvStyleSource: savedRawCvStyleSource,
      resolvedRenderState: snapshotSavedProposalRecord(openedSavedProposal),
    });
  }, [
    composeAutosaveSnapshot?.token,
    generatedProposalId,
    openedSavedProposal,
    savedRawCvStyleSource,
    savedSelectionTraceWinner.rawQueryRow,
    savedSelectionTraceWinner.rawServerRow,
    savedSelectionTraceWinner.winnerReason,
    savedSelectionTraceWinner.winnerSource,
    selectedProposalId,
    traceProposalStyle,
  ]);

  React.useEffect(() => {
    if (!openedSavedProposal) {
      return;
    }

    traceProposalStyle({
      step: "saved-runtime-style",
      proposalId: String(openedSavedProposal._id),
      generatedProposalId: generatedProposalId
        ? String(generatedProposalId)
        : null,
      selectedProposalId,
      composeToken: composeAutosaveSnapshot?.token ?? null,
      persistedToken: lastPersistedComposeTokenRef.current,
      winnerSource: savedRenderTraceWinner.winnerSource,
      winnerReason: savedRenderTraceWinner.winnerReason,
      rawServerRow: savedSelectionTraceWinner.rawServerRow,
      rawQueryRow: savedSelectionTraceWinner.rawQueryRow,
      rawCvStyleSource: savedRawCvStyleSource,
      resolvedRenderState: buildResolvedRenderTraceSnapshot({
        proposalId: openedSavedProposal._id,
        templateId: effectiveSavedProposalTemplateId,
        stylePreset: effectiveSavedProposalStylePreset,
        sourceCvId: openedSavedProposalSourceCvId,
        styleLinkMode: savedProposalStyleLinkMode,
        styleSource: resolvedSavedProposalRuntimeStyle.source,
      }),
    });
  }, [
    composeAutosaveSnapshot?.token,
    effectiveSavedProposalStylePreset,
    effectiveSavedProposalTemplateId,
    generatedProposalId,
    openedSavedProposal,
    openedSavedProposalSourceCvId,
    resolvedSavedProposalRuntimeStyle.source,
    savedProposalStyleLinkMode,
    savedRawCvStyleSource,
    savedRenderTraceWinner.winnerReason,
    savedRenderTraceWinner.winnerSource,
    savedSelectionTraceWinner.rawQueryRow,
    savedSelectionTraceWinner.rawServerRow,
    selectedProposalId,
    traceProposalStyle,
  ]);

  React.useEffect(() => {
    if (!openedSavedProposal || !savedProposalRenderMetadata) {
      return;
    }

    traceProposalStyle({
      step: "saved-render-metadata",
      proposalId: String(openedSavedProposal._id),
      generatedProposalId: generatedProposalId
        ? String(generatedProposalId)
        : null,
      selectedProposalId,
      composeToken: composeAutosaveSnapshot?.token ?? null,
      persistedToken: lastPersistedComposeTokenRef.current,
      winnerSource: savedRenderTraceWinner.winnerSource,
      winnerReason: savedRenderTraceWinner.winnerReason,
      rawServerRow: savedSelectionTraceWinner.rawServerRow,
      rawQueryRow: savedSelectionTraceWinner.rawQueryRow,
      rawCvStyleSource: savedRawCvStyleSource,
      resolvedRenderState: {
        proposalId: String(openedSavedProposal._id),
        metadata: buildProposalStyleTraceMetadataSnapshot({
          templateId: savedProposalRenderMetadata.templateId,
          verbatiStyle: savedProposalRenderMetadata.verbatiStyle,
          sourceCvId: savedProposalRenderMetadata.sourceCvId,
          styleLinkMode: savedProposalRenderMetadata.styleLinkMode,
        }),
      },
    });
  }, [
    composeAutosaveSnapshot?.token,
    generatedProposalId,
    openedSavedProposal,
    savedProposalRenderMetadata,
    savedRawCvStyleSource,
    savedRenderTraceWinner.winnerReason,
    savedRenderTraceWinner.winnerSource,
    savedSelectionTraceWinner.rawQueryRow,
    savedSelectionTraceWinner.rawServerRow,
    selectedProposalId,
    traceProposalStyle,
  ]);

  React.useEffect(() => {
    latestTraceSnapshotRef.current =
      requestedView === "saved"
        ? {
            step: "proposal-forge-unmount",
            proposalId: openedSavedProposal
              ? String(openedSavedProposal._id)
              : selectedProposalId,
            generatedProposalId: generatedProposalId
              ? String(generatedProposalId)
              : null,
            selectedProposalId,
            composeToken: composeAutosaveSnapshot?.token ?? null,
            persistedToken: lastPersistedComposeTokenRef.current,
            winnerSource: savedRenderTraceWinner.winnerSource,
            winnerReason: savedRenderTraceWinner.winnerReason,
            rawServerRow: savedSelectionTraceWinner.rawServerRow,
            rawQueryRow: savedSelectionTraceWinner.rawQueryRow,
            rawCvStyleSource: savedRawCvStyleSource,
            resolvedRenderState: openedSavedProposal
              ? buildResolvedRenderTraceSnapshot({
                  proposalId: openedSavedProposal._id,
                  templateId: effectiveSavedProposalTemplateId,
                  stylePreset: effectiveSavedProposalStylePreset,
                  sourceCvId: openedSavedProposalSourceCvId,
                  styleLinkMode: savedProposalStyleLinkMode,
                  styleSource: resolvedSavedProposalRuntimeStyle.source,
                })
              : null,
            traceData: {
              requestedView,
              composeSaveStatus,
            },
          }
        : {
            step: "proposal-forge-unmount",
            proposalId: generatedProposalId
              ? String(generatedProposalId)
              : null,
            generatedProposalId: generatedProposalId
              ? String(generatedProposalId)
              : null,
            selectedProposalId,
            composeToken: composeAutosaveSnapshot?.token ?? null,
            persistedToken: lastPersistedComposeTokenRef.current,
            winnerSource: composeTraceWinner.winnerSource,
            winnerReason: composeTraceWinner.winnerReason,
            rawServerRow: null,
            rawQueryRow: null,
            rawCvStyleSource: composeRawCvStyleSource,
            resolvedRenderState: buildResolvedRenderTraceSnapshot({
              proposalId: generatedProposalId,
              templateId: effectiveProposalTemplateId,
              stylePreset: effectiveProposalStylePresetWithPalette,
              sourceCvId: attachedCvId,
              styleLinkMode: resolvedRuntimeStyleLinkMode,
              styleSource: resolvedProposalRuntimeStyle.source,
            }),
            traceData: {
              requestedView,
              composeSaveStatus,
              pendingQueuedComposeSnapshot:
                pendingQueuedComposeSnapshotRef.current
                  ? {
                      proposalId: pendingQueuedComposeSnapshotRef.current.id
                        ? String(pendingQueuedComposeSnapshotRef.current.id)
                        : null,
                      title: pendingQueuedComposeSnapshotRef.current.title,
                      token: pendingQueuedComposeSnapshotRef.current.token,
                      metadata: buildProposalStyleTraceMetadataSnapshot({
                        templateId:
                          pendingQueuedComposeSnapshotRef.current.metadata
                            ?.templateId,
                        verbatiStyle:
                          pendingQueuedComposeSnapshotRef.current.metadata
                            ?.verbatiStyle,
                        sourceCvId:
                          pendingQueuedComposeSnapshotRef.current.metadata
                            ?.sourceCvId,
                        styleLinkMode:
                          pendingQueuedComposeSnapshotRef.current.metadata
                            ?.styleLinkMode,
                      }),
                    }
                  : null,
            },
          };
  }, [
    attachedCvId,
    composeAutosaveSnapshot?.token,
    composeRawCvStyleSource,
    composeSaveStatus,
    composeTraceWinner.winnerReason,
    composeTraceWinner.winnerSource,
    effectiveProposalStylePresetWithPalette,
    effectiveProposalTemplateId,
    effectiveSavedProposalStylePreset,
    effectiveSavedProposalTemplateId,
    generatedProposalId,
    openedSavedProposal,
    openedSavedProposalSourceCvId,
    pendingQueuedComposeSnapshotRef,
    requestedView,
    resolvedProposalRuntimeStyle.source,
    resolvedRuntimeStyleLinkMode,
    resolvedSavedProposalRuntimeStyle.source,
    savedProposalStyleLinkMode,
    savedRawCvStyleSource,
    savedRenderTraceWinner.winnerReason,
    savedRenderTraceWinner.winnerSource,
    savedSelectionTraceWinner.rawQueryRow,
    savedSelectionTraceWinner.rawServerRow,
    selectedProposalId,
  ]);

  React.useEffect(() => {
    return () => {
      const latestSnapshot = latestTraceSnapshotRef.current;
      if (!latestSnapshot) {
        return;
      }

      traceProposalStyle({
        step:
          typeof latestSnapshot.step === "string"
            ? latestSnapshot.step
            : "proposal-forge-unmount",
        proposalId:
          typeof latestSnapshot.proposalId === "string"
            ? latestSnapshot.proposalId
            : null,
        generatedProposalId:
          typeof latestSnapshot.generatedProposalId === "string"
            ? latestSnapshot.generatedProposalId
            : null,
        selectedProposalId:
          typeof latestSnapshot.selectedProposalId === "string"
            ? latestSnapshot.selectedProposalId
            : null,
        composeToken:
          typeof latestSnapshot.composeToken === "string"
            ? latestSnapshot.composeToken
            : null,
        persistedToken:
          typeof latestSnapshot.persistedToken === "string"
            ? latestSnapshot.persistedToken
            : null,
        winnerSource:
          latestSnapshot.winnerSource as ProposalStyleTraceWinnerSource,
        winnerReason:
          typeof latestSnapshot.winnerReason === "string"
            ? latestSnapshot.winnerReason
            : "proposal forge unmounted",
        rawServerRow:
          (latestSnapshot.rawServerRow as ReturnType<
            typeof snapshotSavedProposalRecord
          >) ?? null,
        rawQueryRow:
          (latestSnapshot.rawQueryRow as ReturnType<
            typeof snapshotSavedProposalRecord
          >) ?? null,
        rawCvStyleSource:
          (latestSnapshot.rawCvStyleSource as {
            cvId: string | null;
            cvLabel: string | null;
            metadata: ProposalStyleTraceMetadataSnapshot;
          }) ?? null,
        resolvedRenderState:
          (latestSnapshot.resolvedRenderState as Record<string, unknown>) ??
          null,
        traceData:
          (latestSnapshot.traceData as Record<string, unknown>) ?? undefined,
      });
    };
  }, [traceProposalStyle]);

  React.useEffect(() => {
    const previousTrace = previousComposeStyleTraceRef.current;
    const nextTrace = {
      proposalStyleLinkMode,
      proposalTemplateId,
      proposalStylePreset,
      hasUserEditedStyle,
    };

    if (
      previousTrace &&
      (previousTrace.proposalStyleLinkMode !==
        nextTrace.proposalStyleLinkMode ||
        previousTrace.proposalTemplateId !== nextTrace.proposalTemplateId ||
        previousTrace.hasUserEditedStyle !== nextTrace.hasUserEditedStyle ||
        (previousTrace.proposalStylePreset && nextTrace.proposalStylePreset
          ? !stylesEqual(
              previousTrace.proposalStylePreset,
              nextTrace.proposalStylePreset,
            )
          : previousTrace.proposalStylePreset !==
            nextTrace.proposalStylePreset))
    ) {
      traceProposalStyle({
        step: "compose-style-transition",
        proposalId: generatedProposalId ? String(generatedProposalId) : null,
        generatedProposalId: generatedProposalId
          ? String(generatedProposalId)
          : null,
        selectedProposalId,
        composeToken: composeAutosaveSnapshot?.token ?? null,
        persistedToken: lastPersistedComposeTokenRef.current,
        winnerSource: composeTraceWinner.winnerSource,
        winnerReason: composeTraceWinner.winnerReason,
        rawServerRow: null,
        rawQueryRow: null,
        rawCvStyleSource: composeRawCvStyleSource,
        resolvedRenderState: buildResolvedRenderTraceSnapshot({
          proposalId: generatedProposalId,
          templateId: effectiveProposalTemplateId,
          stylePreset: effectiveProposalStylePresetWithPalette,
          sourceCvId: attachedCvId,
          styleLinkMode: resolvedRuntimeStyleLinkMode,
          styleSource: resolvedProposalRuntimeStyle.source,
        }),
        traceData: {
          previous: {
            proposalStyleLinkMode: previousTrace.proposalStyleLinkMode,
            proposalTemplateId: previousTrace.proposalTemplateId,
            proposalStylePreset: buildProposalStyleTraceMetadataSnapshot({
              verbatiStyle: previousTrace.proposalStylePreset,
            }).verbatiStyle,
            hasUserEditedStyle: previousTrace.hasUserEditedStyle,
          },
          next: {
            proposalStyleLinkMode,
            proposalTemplateId,
            proposalStylePreset: buildProposalStyleTraceMetadataSnapshot({
              verbatiStyle: proposalStylePreset,
            }).verbatiStyle,
            hasUserEditedStyle,
          },
        },
      });
    }

    previousComposeStyleTraceRef.current = nextTrace;
  }, [
    attachedCvId,
    composeAutosaveSnapshot?.token,
    composeRawCvStyleSource,
    composeTraceWinner.winnerReason,
    composeTraceWinner.winnerSource,
    effectiveProposalStylePresetWithPalette,
    effectiveProposalTemplateId,
    generatedProposalId,
    hasUserEditedStyle,
    proposalStyleLinkMode,
    proposalStylePreset,
    proposalTemplateId,
    resolvedProposalRuntimeStyle.source,
    resolvedRuntimeStyleLinkMode,
    selectedProposalId,
    traceProposalStyle,
  ]);

  React.useEffect(() => {
    const previousTrace = previousSavedStyleTraceRef.current;
    const nextTrace = {
      selectedProposalId,
      savedProposalStyleLinkMode,
      savedProposalTemplateId,
      savedProposalStylePreset,
    };

    if (
      previousTrace &&
      previousTrace.selectedProposalId === nextTrace.selectedProposalId &&
      (previousTrace.savedProposalStyleLinkMode !==
        nextTrace.savedProposalStyleLinkMode ||
        previousTrace.savedProposalTemplateId !==
          nextTrace.savedProposalTemplateId ||
        (previousTrace.savedProposalStylePreset &&
        nextTrace.savedProposalStylePreset
          ? !stylesEqual(
              previousTrace.savedProposalStylePreset,
              nextTrace.savedProposalStylePreset,
            )
          : previousTrace.savedProposalStylePreset !==
            nextTrace.savedProposalStylePreset))
    ) {
      traceProposalStyle({
        step: "saved-style-transition",
        proposalId: selectedProposalId,
        generatedProposalId: generatedProposalId
          ? String(generatedProposalId)
          : null,
        selectedProposalId,
        composeToken: composeAutosaveSnapshot?.token ?? null,
        persistedToken: lastPersistedComposeTokenRef.current,
        winnerSource: savedRenderTraceWinner.winnerSource,
        winnerReason: savedRenderTraceWinner.winnerReason,
        rawServerRow: savedSelectionTraceWinner.rawServerRow,
        rawQueryRow: savedSelectionTraceWinner.rawQueryRow,
        rawCvStyleSource: savedRawCvStyleSource,
        resolvedRenderState: buildResolvedRenderTraceSnapshot({
          proposalId: selectedProposalId,
          templateId: effectiveSavedProposalTemplateId,
          stylePreset: effectiveSavedProposalStylePreset,
          sourceCvId: openedSavedProposalSourceCvId,
          styleLinkMode: savedProposalStyleLinkMode,
          styleSource: resolvedSavedProposalRuntimeStyle.source,
        }),
        traceData: {
          previous: {
            savedProposalStyleLinkMode:
              previousTrace.savedProposalStyleLinkMode,
            savedProposalTemplateId: previousTrace.savedProposalTemplateId,
            savedProposalStylePreset: buildProposalStyleTraceMetadataSnapshot({
              verbatiStyle: previousTrace.savedProposalStylePreset,
            }).verbatiStyle,
          },
          next: {
            savedProposalStyleLinkMode,
            savedProposalTemplateId,
            savedProposalStylePreset: buildProposalStyleTraceMetadataSnapshot({
              verbatiStyle: savedProposalStylePreset,
            }).verbatiStyle,
          },
        },
      });
    }

    previousSavedStyleTraceRef.current = nextTrace;
  }, [
    composeAutosaveSnapshot?.token,
    effectiveSavedProposalStylePreset,
    effectiveSavedProposalTemplateId,
    generatedProposalId,
    openedSavedProposalSourceCvId,
    resolvedSavedProposalRuntimeStyle.source,
    savedProposalStyleLinkMode,
    savedProposalStylePreset,
    savedProposalTemplateId,
    savedRawCvStyleSource,
    savedRenderTraceWinner.winnerReason,
    savedRenderTraceWinner.winnerSource,
    savedSelectionTraceWinner.rawQueryRow,
    savedSelectionTraceWinner.rawServerRow,
    selectedProposalId,
    traceProposalStyle,
  ]);

  const persistOpenedSavedProposal = React.useCallback(
    async (patch: {
      content?: string;
      title?: string;
      metadata?: SavedProposalRecord["metadata"];
    }) => {
      if (!openedSavedProposal) {
        return;
      }
      if (!canPersistProposalState) {
        showConvexAuthRequiredToast("Save");
        return;
      }

      await updateProposal({
        id: openedSavedProposal._id,
        ...(typeof patch.title === "string" ? { title: patch.title } : {}),
        ...(typeof patch.content === "string"
          ? {
              content: patch.content,
              sections: [{ type: "text", content: patch.content }],
            }
          : {}),
        ...(patch.metadata ? { metadata: patch.metadata } : {}),
      });
    },
    [
      canPersistProposalState,
      openedSavedProposal,
      showConvexAuthRequiredToast,
      updateProposal,
    ],
  );

  const resetProposalWorkspace = React.useCallback(
    (options?: { appearance?: "canonical-workshop" }) => {
      cancelPendingComposeDraftSync();
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
        copyFeedbackTimeoutRef.current = null;
      }

      const shouldUseCanonicalWorkshop =
        options?.appearance === "canonical-workshop";
      const canonicalWorkshopStyle = resolveVerbatiStyle(DEFAULT_VERBATI_STYLE);
      const nextStyleLinkMode = shouldUseCanonicalWorkshop
        ? "proposal_local"
        : activeCvProposalStylePreset
          ? "inherit_cv"
          : "proposal_local";
      const nextStyleChoice = shouldUseCanonicalWorkshop
        ? "auto"
        : activeCvProposalStylePreset
          ? "auto"
          : settingsStyleChoice;
      const nextResolvedLocalStyle = resolveProposalStyleRenderState({
        choice: nextStyleChoice,
      });
      const nextStylePreset = shouldUseCanonicalWorkshop
        ? canonicalWorkshopStyle
        : activeCvProposalStylePreset
          ? activeCvProposalStylePreset
          : applyProposalTypographyPreference({
              stylePreset: nextResolvedLocalStyle.stylePreset,
              fontPairId: currentProposalSettings?.fontPairId,
            });
      const nextTemplateId = shouldUseCanonicalWorkshop
        ? CANONICAL_PROPOSAL_TEMPLATE_ID
        : getProposalTwinTemplateId(nextStylePreset);

      setProposalContent(null);
      setLoading(false);
      setError(null);
      setErrorDetail(null);
      setProposalType(shouldUseCanonicalWorkshop ? "cover_letter" : null);
      setProposalVoicePreset(null);
      setComposeToolbarVoicePreset(
        normalizeComposeToolbarVoicePreset(
          currentProposalSettings?.savedVoicePreset,
        ),
      );
      setProposalTemplateId(nextTemplateId);
      setProposalStyleLinkMode(nextStyleLinkMode);
      setProposalStyleChoice(nextStyleChoice);
      setProposalStylePreset(nextStylePreset);
      setHasUserEditedStyle(shouldUseCanonicalWorkshop);
      setProposalWorkspaceStyle(
        shouldUseCanonicalWorkshop ? nextStylePreset : null,
      );
      setProposalTemplateBundleId(null);
      setProposalPaletteOverride(
        shouldUseCanonicalWorkshop || activeCvProposalStylePreset
          ? null
          : settingsPaletteOverride,
      );
      setProposalCustomAccentHex(
        shouldUseCanonicalWorkshop || activeCvProposalStylePreset
          ? null
          : settingsAccentHex,
      );
      setProposalApplicantName(defaultPreviewApplicantHeader.name || "");
      setProposalApplicantRole(defaultPreviewApplicantHeader.role || "");
      setProposalApplicantCompany("");
      setProposalContactLine(defaultPreviewContactLine);
      setProposalLetterDate(
        getDefaultProposalLetterDate(defaultPreviewApplicantHeader.location),
      );
      setProposalRecipientDetails("");
      resetHeadingDirtyState();
      setProposalHeaderVisibility(
        buildProposalHeaderVisibilityFromContent(null),
      );
      setProposalDocumentTitle("");
      setProposalDocumentTitleManual(false);
      setProposalDocumentMeta("");
      setFallbackInfo(null);
      setGeneratedProposalId(null);
      generatedProposalIdRef.current = null;
      setProposalOutputMode("preview");
      setComposePreviewValues(null);
      setOutputSourceComposeDraft(null);
      setComposeDraftInitialSeed(null);
      setStickyImportedSource({ sourceUrl: null, platform: null });
      setComposeSaveStatus("idle");
      setIsSavingOutputToLibrary(false);
      setLastProposalRequest(null);
      setIsConfirmingGeneratedDelete(false);
      setIsCvPickerOpen(false);
      setIsComposePanelVisible(true);
      setIsBriefExpanded(true);
      setCopyFeedback("idle");
      lastSavedProposalContentRef.current = null;
      lastSavedProposalTitleRef.current = "";
      lastPersistedComposeTokenRef.current = null;
      composeAutosavePrimedRef.current = false;
      pendingQueuedComposeSnapshotRef.current = null;
      if (composeAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
        composeAutosaveTimeoutRef.current = null;
      }
    },
    [
      activeCvProposalStylePreset,
      cancelPendingComposeDraftSync,
      currentProposalSettings?.fontPairId,
      currentProposalSettings?.savedVoicePreset,
      defaultPreviewApplicantHeader.name,
      defaultPreviewApplicantHeader.role,
      defaultPreviewContactLine,
      resetHeadingDirtyState,
      settingsAccentHex,
      settingsPaletteOverride,
      settingsStyleChoice,
    ],
  );

  const handleNewProposalDraft = React.useCallback(() => {
    const canonicalWorkshopStyle = resolveVerbatiStyle(DEFAULT_VERBATI_STYLE);
    const nextApplicantName = defaultPreviewApplicantHeader.name || "";
    const nextApplicantRole = defaultPreviewApplicantHeader.role || "";
    const nextLetterDate = getDefaultProposalLetterDate(
      defaultPreviewApplicantHeader.location,
    );
    const nextHeaderVisibility = buildProposalHeaderVisibilityFromContent(null);

    startFreshProposalWorkspace();
    skipNextStoredOutputDraftSyncRef.current = true;
    setAttachedCvId(null);
    setAttachedCvTitle(null);
    setPendingScopedCvSelection(null);
    lastRequestedScopedCvSyncKeyRef.current = null;
    lastScopedJobIdRef.current = null;
    resetProposalWorkspace({ appearance: "canonical-workshop" });
    setProposalContent("");
    setProposalLibraryStatus("draft");
    setProposalOutputMode("edit");
    resetHeadingDirtyState();
    writeStoredOutputDraft({
      proposalContent: "",
      proposalType: "cover_letter",
      proposalVoicePreset: null,
      proposalTemplateId: CANONICAL_PROPOSAL_TEMPLATE_ID,
      proposalVerbatiStyle: serializeVerbatiStyle(canonicalWorkshopStyle),
      verbatiStyleSlotId: null,
      verbatiStyleSlotSource: null,
      verbatiStyleSlotNameSnapshot: null,
      verbatiStyleBaseSnapshot: null,
      documentStyleVersion: null,
      proposalStyleLinkMode: "proposal_local",
      proposalStyleChoice: "auto",
      proposalApplicantName: nextApplicantName,
      proposalApplicantRole: nextApplicantRole,
      proposalApplicantCompany: "",
      proposalContactLine: defaultPreviewContactLine,
      proposalLetterDate: nextLetterDate,
      proposalRecipientDetails: "",
      proposalHeaderShowSender: nextHeaderVisibility.showSender,
      proposalHeaderShowDate: nextHeaderVisibility.showDate,
      proposalHeaderShowSubject: nextHeaderVisibility.showSubject,
      proposalHeaderShowRecipient: nextHeaderVisibility.showRecipient,
      proposalHeaderShowRecipientDetails:
        nextHeaderVisibility.showRecipientDetails,
      proposalDocumentTitle: "",
      proposalDocumentMeta: "",
      generatedProposalId: null,
      proposalOutputMode: "edit",
      paletteOverride: null,
      customAccentHex: null,
      templateBundleId: null,
      typographyOverride: canonicalWorkshopStyle.typography,
      layoutOverride: null,
      proposalDocumentTitleManual: false,
      proposalClosing: resolveProposalClosingRef({
        closing: null,
        content: "",
        proposalType: "cover_letter",
        applicantName: nextApplicantName,
        voicePreset: null,
      }),
      characterLimitMode: null,
      characterLimitValue: null,
      sourceComposeDraft: null,
    });
    setComposeFormInstanceKey((currentKey) => currentKey + 1);
    void navigate("/proposal", { replace: true, state: null });
  }, [
    defaultPreviewApplicantHeader.location,
    defaultPreviewApplicantHeader.name,
    defaultPreviewApplicantHeader.role,
    defaultPreviewContactLine,
    navigate,
    resetHeadingDirtyState,
    resetProposalWorkspace,
    writeStoredOutputDraft,
  ]);

  const handleClearJobContext = React.useCallback(() => {
    cancelPendingComposeDraftSync();
    setStagedProposalSourceDraft(null);
    setStagedSourceJobId(null);
    setStagedProposalCvSelection(null);
    setJobContextCleared(true);
    setDuplicateSourceJobId(null);
    setComposePreviewValues({});
    setOutputSourceComposeDraft(null);
    setComposeDraftInitialSeed({});
    setStickyImportedSource({ sourceUrl: null, platform: null });
    writeStoredProposalComposeDraft({});
    setComposeFormInstanceKey((currentKey) => currentKey + 1);

    const currentOutputDraft = readStoredProposalOutputDraft();
    if (currentOutputDraft) {
      writeStoredOutputDraft({
        ...currentOutputDraft,
        sourceComposeDraft: null,
      });
    }

    const params = new URLSearchParams(search);
    if (
      params.has("jobId") ||
      params.has("handoffId") ||
      params.has("handoffToken")
    ) {
      params.delete("jobId");
      params.delete("handoffId");
      params.delete("handoffToken");
      const nextSearch = params.toString();
      void navigate(nextSearch ? `/proposal?${nextSearch}` : "/proposal", {
        replace: true,
        state: null,
      });
    }
  }, [cancelPendingComposeDraftSync, navigate, search, writeStoredOutputDraft]);

  const handleCancelStagedProposalSource = React.useCallback(() => {
    cancelPendingComposeDraftSync();
    setStagedProposalSourceDraft(null);
    setStagedSourceJobId(null);
    setStagedProposalCvSelection(null);
  }, [cancelPendingComposeDraftSync]);

  React.useEffect(() => {
    if (!proposalWorkspaceResetToken) {
      return;
    }

    setComposeFormInstanceKey((currentKey) => currentKey + 1);
    resetProposalWorkspace();
    if (proposalStyleIntent && proposalTemplateIntent) {
      setProposalStyleLinkMode("proposal_local");
      setProposalTemplateBundleId(proposalTemplateBundleIntent ?? null);
      setProposalPaletteOverride(null);
      setProposalCustomAccentHex(null);
      setProposalStylePreset(proposalStyleIntent);
      setHasUserEditedStyle(true);
      setProposalWorkspaceStyle(proposalStyleIntent);
      setProposalTemplateId(proposalTemplateIntent);
      setProposalStyleChoice(
        resolveProposalStyleChoiceFromRenderState({
          templateId: proposalTemplateIntent,
          stylePreset: proposalStyleIntent,
        }) ?? settingsStyleChoice,
      );
    }
    void navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      {
        replace: true,
        state:
          proposalEntryIntent === "cover-letter-start"
            ? {
                proposalEntryIntent,
                ...(proposalJobImportFocus === "supported-sites"
                  ? { jobImportFocus: proposalJobImportFocus }
                  : {}),
              }
            : null,
      },
    );
  }, [
    location.pathname,
    location.search,
    navigate,
    proposalEntryIntent,
    proposalJobImportFocus,
    proposalStyleIntent,
    proposalTemplateBundleIntent,
    proposalTemplateIntent,
    proposalWorkspaceResetToken,
    resetProposalWorkspace,
    settingsStyleChoice,
  ]);

  /* ── Handlers (logique métier intacte) ────────────────────── */

  const formatProposalTypeLabel = React.useCallback(
    (type: FormValues["proposalType"]) => {
      if (type === "cover_letter") return "Letter";
      if (type === "application_message") return "Message";
      return "Proposal";
    },
    [],
  );

  const formatProposalToneLabel = React.useCallback(
    (preset: FormValues["voicePreset"] | null | undefined) => {
      return getVoicePresetDisplayLabel(preset);
    },
    [],
  );

  const buildProposalToneMetaLabel = React.useCallback(
    (
      requestedPreset: FormValues["voicePreset"] | null | undefined,
      resolvedPreset: FormValues["voicePreset"] | null | undefined,
    ) => {
      if (requestedPreset === null) {
        return formatProposalToneLabel(null);
      }
      if (requestedPreset) {
        return formatProposalToneLabel(requestedPreset);
      }
      return formatProposalToneLabel(resolvedPreset);
    },
    [formatProposalToneLabel],
  );

  const resolveProposalVoicePreset = React.useCallback(
    (values: FormValues) => {
      if (values.voicePreset) {
        return values.voicePreset;
      }

      return (
        selectAutoTone({
          jobTitle: values.jobTitle,
          jobDescription: values.jobDescription,
          personalizationContext:
            activePersonalizationSource.personalizationContext,
          personalizationRichness: activePersonalizationSource.richness,
        }).preset ?? DEFAULT_PROPOSAL_VOICE_PRESET
      );
    },
    [activePersonalizationSource],
  );

  const buildStoredProposalComposeDraftSnapshot = React.useCallback(
    (values: FormValues): StoredProposalComposeDraft => {
      const storedComposeDraft = shouldStartFromEmptyProposalWorkspace
        ? null
        : readStoredProposalComposeDraft();
      const preservedSourceUrl =
        outputSourceComposeDraft?.sourceUrl ??
        composePreviewValues?.sourceUrl ??
        composeDraftInitialSeed?.sourceUrl ??
        storedComposeDraft?.sourceUrl ??
        stickyImportedSource.sourceUrl ??
        prefill?.sourceUrl ??
        null;
      const preservedPlatform =
        outputSourceComposeDraft?.platform ??
        composePreviewValues?.platform ??
        composeDraftInitialSeed?.platform ??
        storedComposeDraft?.platform ??
        stickyImportedSource.platform ??
        prefill?.platform ??
        null;
      const nextJobTitle = values.jobTitle.trim();
      const nextJobDescription = values.jobDescription.trim();
      const currentSourceJobTitle =
        resolvedProposalWorkspaceSourceDraft?.jobTitle?.trim() ?? "";
      const currentSourceJobDescription =
        resolvedProposalWorkspaceSourceDraft?.jobDescription?.trim() ?? "";
      const sourceHasBriefText = Boolean(
        currentSourceJobTitle || currentSourceJobDescription,
      );
      const nextHasBriefText = Boolean(nextJobTitle || nextJobDescription);
      const canPreserveSourceIdentity =
        !nextHasBriefText ||
        (sourceHasBriefText &&
          (!currentSourceJobTitle || currentSourceJobTitle === nextJobTitle) &&
          (!currentSourceJobDescription ||
            currentSourceJobDescription === nextJobDescription));

      return {
        jobTitle: values.jobTitle,
        jobDescription: values.jobDescription,
        proposalType: values.proposalType,
        modelType: values.modelType,
        voicePreset: values.voicePreset ?? null,
        toneTuning: values.toneTuning ?? null,
        characterLimitMode: draftCharacterLimitRef.current.mode,
        characterLimitValue: draftCharacterLimitRef.current.value,
        sourceUrl: canPreserveSourceIdentity ? preservedSourceUrl : null,
        platform: canPreserveSourceIdentity ? preservedPlatform : null,
      };
    },
    [
      composeDraftInitialSeed?.platform,
      composeDraftInitialSeed?.sourceUrl,
      composePreviewValues?.platform,
      composePreviewValues?.sourceUrl,
      outputSourceComposeDraft?.platform,
      outputSourceComposeDraft?.sourceUrl,
      resolvedProposalWorkspaceSourceDraft?.jobDescription,
      resolvedProposalWorkspaceSourceDraft?.jobTitle,
      stickyImportedSource.platform,
      stickyImportedSource.sourceUrl,
      prefill?.platform,
      prefill?.sourceUrl,
      shouldStartFromEmptyProposalWorkspace,
    ],
  );
  const commitComposeDraftPreview = React.useCallback(
    (draft: StoredProposalComposeDraft | null) => {
      if (draft) {
        writeStoredProposalComposeDraft(draft);
      }
      React.startTransition(() => {
        setComposePreviewValues(draft);
      });
    },
    [],
  );

  const flushPendingComposeDraftSync = React.useCallback(() => {
    const pendingDraft = pendingComposeDraftSyncRef.current;
    cancelPendingComposeDraftSync();
    if (!pendingDraft) {
      return;
    }
    commitComposeDraftPreview(pendingDraft);
  }, [cancelPendingComposeDraftSync, commitComposeDraftPreview]);

  const scheduleComposeDraftSync = React.useCallback(
    (values: FormValues) => {
      const nextDraft = buildStoredProposalComposeDraftSnapshot(values);
      pendingComposeDraftSyncRef.current = nextDraft;
      if (composeDraftSyncTimeoutRef.current !== null) {
        window.clearTimeout(composeDraftSyncTimeoutRef.current);
      }
      composeDraftSyncTimeoutRef.current = window.setTimeout(() => {
        flushPendingComposeDraftSync();
      }, COMPOSE_DRAFT_SYNC_DELAY_MS);
    },
    [
      buildStoredProposalComposeDraftSnapshot,
      flushPendingComposeDraftSync,
      COMPOSE_DRAFT_SYNC_DELAY_MS,
    ],
  );

  const handleProposalFormValuesChange = React.useCallback(
    (values: FormValues) => {
      scheduleComposeDraftSync(values);
      setComposeToolbarModelType(values.modelType);
      setComposeToolbarVoicePreset(values.voicePreset ?? null);
    },
    [scheduleComposeDraftSync],
  );

  React.useEffect(() => {
    return () => {
      const pendingDraft = pendingComposeDraftSyncRef.current;
      cancelPendingComposeDraftSync();
      if (pendingDraft) {
        writeStoredProposalComposeDraft(pendingDraft);
      }
    };
  }, [cancelPendingComposeDraftSync]);

  React.useEffect(() => {
    if (!openedSavedProposal) {
      setSavedProposalContent(null);
      setSavedProposalType(null);
      setSavedProposalVoicePreset(null);
      setSavedProposalTemplateId(null);
      setSavedProposalStyleLinkMode("proposal_local");
      setSavedProposalStylePreset(null);
      setSavedProposalDocumentTitle("");
      setSavedProposalDocumentMeta("");
      setSavedProposalOutputMode("preview");
      return;
    }

    const storedRenderState = resolveProposalRenderState({
      storedTemplateId: openedSavedProposal.metadata?.templateId,
      storedStylePreset: openedSavedProposal.metadata?.verbatiStyle,
      storedStyleBaseSnapshot:
        openedSavedProposal.metadata?.verbatiStyleBaseSnapshot,
      storedStyleSlotId: openedSavedProposal.metadata?.verbatiStyleSlotId,
      activeCvStylePreset: savedProposalHasPersistedStyleSnapshot
        ? undefined
        : openedSavedProposalSourceCvStylePreset,
    });
    const nextVoicePreset =
      openedSavedProposal.metadata?.resolvedVoicePreset ??
      openedSavedProposal.metadata?.voicePreset ??
      DEFAULT_PROPOSAL_VOICE_PRESET;
    const nextProposalType = openedSavedProposal.metadata?.proposalType ?? null;

    traceProposalStyle({
      step: "saved-restore-effect",
      proposalId: String(openedSavedProposal._id),
      generatedProposalId: generatedProposalId
        ? String(generatedProposalId)
        : null,
      selectedProposalId,
      composeToken: composeAutosaveSnapshot?.token ?? null,
      persistedToken: lastPersistedComposeTokenRef.current,
      winnerSource: savedRenderTraceWinner.winnerSource,
      winnerReason: savedRenderTraceWinner.winnerReason,
      rawServerRow: savedSelectionTraceWinner.rawServerRow,
      rawQueryRow: savedSelectionTraceWinner.rawQueryRow,
      rawCvStyleSource: savedRawCvStyleSource,
      resolvedRenderState: {
        storedRenderState: buildResolvedRenderTraceSnapshot({
          proposalId: openedSavedProposal._id,
          templateId: storedRenderState.templateId,
          stylePreset: storedRenderState.stylePreset,
          sourceCvId: openedSavedProposalSourceCvId,
          styleLinkMode: resolveProposalStyleLinkMode(
            openedSavedProposal.metadata?.styleLinkMode,
          ),
          styleSource: savedRenderTraceWinner.winnerSource,
        }),
      },
      traceData: {
        savedProposalHasPersistedStyleSnapshot,
        restoreInputs: {
          storedTemplateId: openedSavedProposal.metadata?.templateId ?? null,
          storedStylePreset: buildProposalStyleTraceMetadataSnapshot({
            verbatiStyle: openedSavedProposal.metadata?.verbatiStyle,
          }).verbatiStyle,
          activeCvStylePreset:
            savedRawCvStyleSource?.metadata?.verbatiStyle ?? null,
        },
      },
    });

    setSavedProposalContent(
      resolveProposalStoredText({
        content: openedSavedProposal.content,
        sections: openedSavedProposal.sections,
      }),
    );
    setSavedProposalType(nextProposalType);
    setSavedProposalVoicePreset(nextVoicePreset);
    setSavedProposalTemplateId(storedRenderState.templateId);
    setSavedProposalStylePreset(storedRenderState.stylePreset);
    setSavedProposalStyleLinkMode(
      resolveProposalStyleLinkMode(openedSavedProposal.metadata?.styleLinkMode),
    );
    setSavedProposalDocumentTitle(
      openedSavedProposal.title || "Untitled proposal",
    );
    const nextContent = resolveProposalStoredText({
      content: openedSavedProposal.content,
      sections: openedSavedProposal.sections,
    });
    const nextDocumentMeta = [
      nextProposalType ? formatProposalTypeLabel(nextProposalType) : "Proposal",
      buildProposalToneMetaLabel(
        openedSavedProposal.metadata?.requestedVoicePreset,
        nextVoicePreset,
      ),
    ].join(" · ");

    setSavedProposalDocumentMeta(nextDocumentMeta);
    setSavedProposalOutputMode("preview");

    if (requestedView === "saved" && selectedProposalId) {
      const nextStyleLinkMode = resolveProposalStyleLinkMode(
        openedSavedProposal.metadata?.styleLinkMode,
      );
      const nextStylePreset = storedRenderState.stylePreset;
      const nextTemplateBundleId =
        resolveProposalTemplateBundleId(
          openedSavedProposal.metadata?.templateBundleId,
        ) ??
        getProposalBundleForDocumentStyleSlot(
          openedSavedProposal.metadata?.verbatiStyleSlotId,
        ) ??
        findProposalTemplateBundleIdByStylePreset(nextStylePreset);
      const nextPaletteOverride =
        nextStylePreset?.palette &&
        nextStylePreset.palette !== "custom" &&
        isProposalPaletteId(nextStylePreset.palette)
          ? nextStylePreset.palette
          : null;
      const nextCustomAccentHex =
        nextStylePreset?.palette === "custom"
          ? nextStylePreset.accentHex ?? null
          : null;
      const nextRecipientDetails =
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "recipientDetails",
        ) ?? "";
      const nextHeaderVisibility = resolveProposalHeaderVisibility({
        ...buildProposalHeaderVisibilityFromContent(nextRecipientDetails),
        showSender: openedSavedProposal.metadata?.headerShowSender,
        showDate: openedSavedProposal.metadata?.headerShowDate,
        showSubject: openedSavedProposal.metadata?.headerShowSubject,
        showRecipient: openedSavedProposal.metadata?.headerShowRecipient,
        showRecipientDetails:
          openedSavedProposal.metadata?.headerShowRecipientDetails,
      });
      const nextSourceComposeDraft: StoredProposalComposeDraft | null = null;

      setProposalContent(nextContent);
      setProposalType(nextProposalType);
      setProposalLibraryStatus("saved");
      setProposalVoicePreset(nextVoicePreset);
      setProposalTemplateId(storedRenderState.templateId);
      setProposalStylePreset(nextStylePreset);
      setProposalStyleLinkMode(nextStyleLinkMode);
      setProposalStyleChoice(
        resolveProposalStyleChoice(
          openedSavedProposal.metadata?.styleChoice ??
            resolveProposalStyleChoiceFromRenderState({
              templateId: storedRenderState.templateId,
              stylePreset: nextStylePreset,
            }) ??
            "auto",
        ),
      );
      setHasUserEditedStyle(
        Boolean(nextStyleLinkMode === "proposal_local" && nextStylePreset),
      );
      setProposalWorkspaceStyle(
        nextStylePreset ? resolveVerbatiStyle(nextStylePreset) : null,
      );
      setProposalPaletteOverride(nextPaletteOverride);
      setProposalCustomAccentHex(nextCustomAccentHex);
      setProposalTemplateBundleId(nextTemplateBundleId);
      setOutputSourceComposeDraft(nextSourceComposeDraft);
      setComposePreviewValues(nextSourceComposeDraft);
      setComposeDraftInitialSeed(nextSourceComposeDraft);
      setProposalApplicantName(
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "applicantName",
        ) ?? "",
      );
      setProposalApplicantRole(
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "applicantRole",
        ) ?? "",
      );
      setProposalApplicantCompany(
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "applicantCompany",
        ) ?? "",
      );
      setProposalContactLine(
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "contactLine",
        ) ?? "",
      );
      setProposalLetterDate(
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "letterDate",
        ) ?? "",
      );
      setProposalRecipientDetails(nextRecipientDetails);
      setProposalHeaderVisibility(nextHeaderVisibility);
      setProposalDocumentTitle(openedSavedProposal.title || "Untitled proposal");
      setProposalDocumentTitleManual(true);
      setProposalDocumentMeta(nextDocumentMeta);
      setGeneratedProposalId(openedSavedProposal._id as Id<"proposals">);
      generatedProposalIdRef.current =
        openedSavedProposal._id as Id<"proposals">;
      setProposalOutputMode("preview");
      setIsComposePanelVisible(true);
      setIsBriefExpanded(false);
      lastSavedProposalContentRef.current = nextContent;
      lastSavedProposalTitleRef.current =
        openedSavedProposal.title || "Untitled proposal";
      lastPersistedComposeTokenRef.current = null;
      composeAutosavePrimedRef.current = true;
      setComposeSaveStatus("idle");
    }
  }, [
    buildProposalToneMetaLabel,
    formatProposalToneLabel,
    formatProposalTypeLabel,
    openedSavedProposal,
    savedProposalHasPersistedStyleSnapshot,
    openedSavedProposalSourceCvStylePreset,
    openedSavedProposalSourceCvId,
    composeAutosaveSnapshot?.token,
    generatedProposalId,
    savedRawCvStyleSource,
    savedRenderTraceWinner.winnerReason,
    savedRenderTraceWinner.winnerSource,
    savedSelectionTraceWinner.rawQueryRow,
    savedSelectionTraceWinner.rawServerRow,
    selectedProposalId,
    traceProposalStyle,
  ]);

  React.useEffect(() => {
    if (requestedView !== "compose" || !selectedDraftProposalId) {
      loadedDraftProposalIdRef.current = null;
      return;
    }
    if (loadedDraftProposalIdRef.current === selectedDraftProposalId) {
      return;
    }

    const draftProposal = savedProposals?.find(
      (proposal) =>
        String(proposal._id) === selectedDraftProposalId &&
        proposal.status === "draft",
    );
    if (!draftProposal) {
      return;
    }

    const nextContent = resolveProposalStoredText({
      content: draftProposal.content,
      sections: draftProposal.sections,
    });
    const nextType = draftProposal.metadata?.proposalType ?? null;
    const nextVoicePreset =
      draftProposal.metadata?.resolvedVoicePreset ??
      draftProposal.metadata?.voicePreset ??
      DEFAULT_PROPOSAL_VOICE_PRESET;
    const draftHasPersistedStyleSnapshot = Boolean(
      draftProposal.metadata?.verbatiStyle ||
        draftProposal.metadata?.templateId ||
        draftProposal.metadata?.verbatiStyleBaseSnapshot ||
        draftProposal.metadata?.verbatiStyleSlotId,
    );
    const resolvedDraftRenderState = draftHasPersistedStyleSnapshot
      ? resolveProposalRenderState({
          storedTemplateId: draftProposal.metadata?.templateId,
          storedStylePreset: draftProposal.metadata?.verbatiStyle,
          storedStyleBaseSnapshot:
            draftProposal.metadata?.verbatiStyleBaseSnapshot,
          storedStyleSlotId: draftProposal.metadata?.verbatiStyleSlotId,
        })
      : null;
    const nextTemplateId =
      resolvedDraftRenderState?.templateId ??
      draftProposal.metadata?.templateId ??
      fallbackProposalTemplateId;
    const nextStylePreset =
      resolvedDraftRenderState?.stylePreset ??
      (draftProposal.metadata?.verbatiStyle
        ? resolveVerbatiStyle(draftProposal.metadata.verbatiStyle)
        : null);
    const nextStyleLinkMode = resolveProposalStyleLinkMode(
      draftProposal.metadata?.styleLinkMode,
    );
    const nextTitle = draftProposal.title || "Untitled proposal";
    const nextTitleManual = Boolean(draftProposal.title?.trim());
    const nextMeta = nextType ? formatProposalTypeLabel(nextType) : "Draft";
    const nextGeneratedId = draftProposal._id as Id<"proposals">;
    const nextApplicantName =
      resolveProposalHeadingText(draftProposal.metadata, "applicantName") ?? "";
    const nextApplicantRole =
      resolveProposalHeadingText(draftProposal.metadata, "applicantRole") ?? "";
    const nextContactLine =
      resolveProposalHeadingText(draftProposal.metadata, "contactLine") ?? "";
    const nextLetterDate =
      resolveProposalHeadingText(draftProposal.metadata, "letterDate") ?? "";
    const nextRecipientDetails =
      resolveProposalHeadingText(draftProposal.metadata, "recipientDetails") ??
      "";
    const nextHeaderVisibility = resolveProposalHeaderVisibility({
      ...buildProposalHeaderVisibilityFromContent(nextRecipientDetails),
      showSender: draftProposal.metadata?.headerShowSender,
      showDate: draftProposal.metadata?.headerShowDate,
      showSubject: draftProposal.metadata?.headerShowSubject,
      showRecipient: draftProposal.metadata?.headerShowRecipient,
      showRecipientDetails: draftProposal.metadata?.headerShowRecipientDetails,
    });
    const nextPaletteOverride =
      nextStylePreset?.palette &&
      nextStylePreset.palette !== "custom" &&
      isProposalPaletteId(nextStylePreset.palette)
        ? nextStylePreset.palette
        : null;
    const nextCustomAccentHex =
      nextStylePreset?.palette === "custom"
        ? nextStylePreset.accentHex ?? null
        : null;
    const nextTemplateBundleId =
      resolveProposalTemplateBundleId(
        draftProposal.metadata?.templateBundleId,
      ) ??
      getProposalBundleForDocumentStyleSlot(
        draftProposal.metadata?.verbatiStyleSlotId,
      ) ??
      findProposalTemplateBundleIdByStylePreset(nextStylePreset);
    const nextStyleChoice = resolveProposalStyleChoice(
      draftProposal.metadata?.styleChoice ??
        resolveProposalStyleChoiceFromRenderState({
          templateId: nextTemplateId,
          stylePreset: nextStylePreset,
        }) ??
        "auto",
    );
    const shouldRestoreDraftDetachedStyle = Boolean(
      nextStyleLinkMode === "proposal_local" && nextStylePreset,
    );
    const nextSourceComposeDraft: StoredProposalComposeDraft | null = null;

    loadedDraftProposalIdRef.current = selectedDraftProposalId;
    latestProposalStyleCommitRef.current = null;
    cancelPendingComposeDraftSync();
    setDuplicateSourceJobId(draftProposal.metadata?.jobId ?? null);
    setProposalContent(nextContent);
    setProposalType(nextType);
    setProposalLibraryStatus("draft");
    setProposalVoicePreset(nextVoicePreset);
    setProposalTemplateId(nextTemplateId);
    setProposalStylePreset(nextStylePreset);
    setProposalStyleLinkMode(nextStyleLinkMode);
    setProposalStyleChoice(nextStyleChoice);
    setHasUserEditedStyle(shouldRestoreDraftDetachedStyle);
    setProposalWorkspaceStyle(
      shouldRestoreDraftDetachedStyle && nextStylePreset
        ? resolveVerbatiStyle(nextStylePreset)
        : null,
    );
    setProposalPaletteOverride(nextPaletteOverride);
    setProposalCustomAccentHex(nextCustomAccentHex);
    setProposalTemplateBundleId(nextTemplateBundleId);
    setOutputSourceComposeDraft(nextSourceComposeDraft);
    setComposePreviewValues(nextSourceComposeDraft);
    setComposeDraftInitialSeed(nextSourceComposeDraft);
    setProposalApplicantName(nextApplicantName);
    setProposalApplicantRole(nextApplicantRole);
    setProposalContactLine(nextContactLine);
    setProposalLetterDate(nextLetterDate);
    setProposalRecipientDetails(nextRecipientDetails);
    setProposalHeaderVisibility(nextHeaderVisibility);
    setProposalDocumentTitle(nextTitle);
    setProposalDocumentTitleManual(nextTitleManual);
    setProposalDocumentMeta(nextMeta);
    setGeneratedProposalId(nextGeneratedId);
    generatedProposalIdRef.current = nextGeneratedId;
    setProposalOutputMode("preview");
    setIsComposePanelVisible(true);
    setIsBriefExpanded(false);
    lastSavedProposalContentRef.current = nextContent;
    lastSavedProposalTitleRef.current = nextTitle;
    lastPersistedComposeTokenRef.current = null;
    pendingQueuedComposeSnapshotRef.current = null;
    latestComposeAutosaveSnapshotRef.current = null;
    composeAutosavePrimedRef.current = true;
    setComposeSaveStatus("idle");
    writeStoredOutputDraft({
      proposalContent: nextContent,
      proposalType: nextType,
      proposalVoicePreset: nextVoicePreset,
      proposalTemplateId: nextTemplateId,
      proposalVerbatiStyle: nextStylePreset,
      verbatiStyleSlotId: draftProposal.metadata?.verbatiStyleSlotId ?? null,
      verbatiStyleSlotSource:
        draftProposal.metadata?.verbatiStyleSlotSource ?? null,
      verbatiStyleSlotNameSnapshot:
        draftProposal.metadata?.verbatiStyleSlotNameSnapshot ?? null,
      verbatiStyleBaseSnapshot:
        draftProposal.metadata?.verbatiStyleBaseSnapshot ?? null,
      documentStyleVersion:
        draftProposal.metadata?.documentStyleVersion ?? null,
      proposalStyleLinkMode: nextStyleLinkMode,
      proposalStyleChoice: nextStyleChoice,
      proposalApplicantName: nextApplicantName,
      proposalApplicantRole: nextApplicantRole,
      proposalApplicantCompany:
        resolveProposalHeadingText(draftProposal.metadata, "applicantCompany") ??
        "",
      proposalContactLine: nextContactLine,
      proposalLetterDate: nextLetterDate,
      proposalRecipientDetails: nextRecipientDetails,
      proposalHeaderShowSender: nextHeaderVisibility.showSender,
      proposalHeaderShowDate: nextHeaderVisibility.showDate,
      proposalHeaderShowSubject: nextHeaderVisibility.showSubject,
      proposalHeaderShowRecipient: nextHeaderVisibility.showRecipient,
      proposalHeaderShowRecipientDetails:
        nextHeaderVisibility.showRecipientDetails,
      proposalDocumentTitle: nextTitle,
      proposalDocumentMeta: nextMeta,
      generatedProposalId: nextGeneratedId,
      proposalOutputMode: "preview",
      paletteOverride: nextPaletteOverride,
      customAccentHex: nextCustomAccentHex,
      templateBundleId: nextTemplateBundleId,
      typographyOverride: nextStylePreset?.typography,
      layoutOverride:
        nextStylePreset?.layout === "swiss" ||
        nextStylePreset?.layout === "editorial" ||
        nextStylePreset?.layout === "modernist"
          ? nextStylePreset.layout
          : null,
      proposalDocumentTitleManual: nextTitleManual,
      proposalClosing: resolveProposalClosingRef({
        closing: draftProposal.metadata?.closing,
        content: nextContent,
        proposalType: nextType,
        applicantName: nextApplicantName,
        voicePreset: nextVoicePreset,
      }),
      characterLimitMode: draftProposal.metadata?.characterLimitMode ?? null,
      characterLimitValue: draftProposal.metadata?.characterLimitValue ?? null,
      sourceComposeDraft: nextSourceComposeDraft,
    });
  }, [
    cancelPendingComposeDraftSync,
    draftCharacterLimitMode,
    fallbackProposalTemplateId,
    formatProposalTypeLabel,
    requestedView,
    savedProposals,
    selectedDraftProposalId,
    writeStoredOutputDraft,
  ]);

  const handleToolbarCvPickerToggle = React.useCallback(() => {
    setIsCvPickerOpen((current) => !current);
    setCvPickerRequestKey((currentKey) => currentKey + 1);
  }, []);

  const scheduleJobDescriptionFocus = React.useCallback(() => {
    window.setTimeout(() => {
      const jobDescriptionField = document.getElementById(
        "jobDescription",
      ) as HTMLTextAreaElement | null;
      if (jobDescriptionField) {
        try {
          jobDescriptionField.focus({ preventScroll: true });
        } catch {
          jobDescriptionField.focus();
        }
        return;
      }

      const fallbackField = document.querySelector<
        HTMLInputElement | HTMLTextAreaElement
      >('input[name="jobTitle"], textarea[name="jobDescription"], textarea');
      fallbackField?.focus();
    }, 0);
  }, []);

  const openCoverLetterComposeSurface = React.useCallback(
    ({
      focusJobDescription = false,
      openCvPicker = false,
    }: {
      focusJobDescription?: boolean;
      openCvPicker?: boolean;
    } = {}) => {
      setShowExtensionHelper(false);
      setIsCoverLetterStartSessionActive(false);
      setIsComposePanelVisible(true);
      setIsCvPickerOpen(openCvPicker);
      if (openCvPicker) {
        setCvPickerRequestKey((currentKey) => currentKey + 1);
      }
      if (focusJobDescription) {
        scheduleJobDescriptionFocus();
      }
    },
    [scheduleJobDescriptionFocus],
  );

  const handlePasteJobOffer = React.useCallback(() => {
    openCoverLetterComposeSurface({ focusJobDescription: true });
  }, [openCoverLetterComposeSurface]);

  const handleDismissCoverLetterStart = React.useCallback(() => {
    openCoverLetterComposeSurface();
  }, [openCoverLetterComposeSurface]);

  const handleReturnToQuickStart = React.useCallback(() => {
    void navigate(
      {
        pathname: location.pathname,
        search: location.search,
      },
      {
        replace: true,
        state: createQuickStartLocationState(location.state, {
          createType: "resume",
          resumeMode: "choice",
          returnTarget: null,
        }),
      },
    );
  }, [location.pathname, location.search, location.state, navigate]);

  const handleOpenStartSurfaceCvPicker = React.useCallback(() => {
    openCoverLetterComposeSurface({ openCvPicker: true });
  }, [openCoverLetterComposeSurface]);

  const handleCreateCvInForge = React.useCallback(() => {
    void navigate("/cv", {
      state: { cvForgeAction: "createBlank" },
    });
  }, [navigate]);

  const handleImportCvInForge = React.useCallback(() => {
    void navigate("/cv", {
      state: { cvForgeAction: "importCv" },
    });
  }, [navigate]);

  const handleImportResumeIntoCoverLetter = React.useCallback(() => {
    setShowExtensionHelper(false);
    setCoverLetterInlineImportError(null);
    if (coverLetterInlineImportPhase !== "idle") {
      return;
    }

    if (coverLetterInlineFileInputRef.current) {
      coverLetterInlineFileInputRef.current.value = "";
      coverLetterInlineFileInputRef.current.click();
    }
  }, [coverLetterInlineImportPhase]);

  const handleRevealExtensionHelper = React.useCallback(() => {
    setShowExtensionHelper((current) => !current);
  }, []);

  const resetCoverLetterInlineImportUi = React.useCallback(() => {
    setCoverLetterInlineImportPhase("idle");
    setCoverLetterInlineImportFileName(null);
  }, []);

  const clearPendingInlineImportRefs = React.useCallback(() => {
    pendingInlineImportedCvIdRef.current = null;
    pendingInlineImportRequestIdRef.current = null;
    pendingInlineImportTraceRef.current = null;
  }, []);

  const clearPendingInlineImport = React.useCallback(() => {
    clearPendingInlineImportRefs();
    setPendingInlineImportedCvId(null);
  }, [clearPendingInlineImportRefs]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      inlineImportRequestIdRef.current += 1;
      clearPendingInlineImportRefs();
    };
  }, [clearPendingInlineImportRefs]);

  const finalizeInlineImportedCv = React.useCallback(
    (nextCvId: string, trace?: StructuredImportTimingTrace | null) => {
      logStructuredImportTiming(trace, "proposal_inline.finalize.start", {
        cvId: nextCvId,
      });
      handleAttachedCvChange(nextCvId);
      setShowExtensionHelper(false);
      setIsCoverLetterStartSessionActive(false);
      setIsComposePanelVisible(true);
      resetCoverLetterInlineImportUi();
      setCoverLetterInlineImportError(null);
      scheduleJobDescriptionFocus();
      logStructuredImportTiming(trace, "proposal_inline.finalize.finish", {
        cvId: nextCvId,
      });
    },
    [
      handleAttachedCvChange,
      resetCoverLetterInlineImportUi,
      scheduleJobDescriptionFocus,
    ],
  );

  React.useEffect(() => {
    if (!pendingInlineImportedCvId) {
      return;
    }
    if (!mountedRef.current) {
      return;
    }
    if (currentCvId !== pendingInlineImportedCvId) {
      return;
    }
    if (pendingInlineImportRequestIdRef.current === null) {
      return;
    }
    if (
      inlineImportRequestIdRef.current !==
      pendingInlineImportRequestIdRef.current
    ) {
      return;
    }

    const importedCvId = pendingInlineImportedCvId;
    const trace = pendingInlineImportTraceRef.current;
    clearPendingInlineImport();
    finalizeInlineImportedCv(importedCvId, trace);
  }, [
    clearPendingInlineImport,
    currentCvId,
    finalizeInlineImportedCv,
    pendingInlineImportedCvId,
  ]);

  const handleCoverLetterInlineImportChange = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const isInlineImportBusy = coverLetterInlineImportPhase !== "idle";
      if (!file || isInlineImportBusy) {
        return;
      }

      const trace = beginStructuredImportTimingTrace(
        "proposal_inline",
        file.name,
      );
      const requestId = ++inlineImportRequestIdRef.current;
      let awaitingLiveCvHandoff = false;
      const isCurrentRequest = () =>
        mountedRef.current && inlineImportRequestIdRef.current === requestId;

      logStructuredImportTiming(trace, "file.selected", {
        fileSizeBytes: file.size,
        fileType: file.type || null,
      });
      logStructuredImportTiming(trace, "proposal_inline.handler.entered");
      setShowExtensionHelper(false);
      setCoverLetterInlineImportError(null);
      setCoverLetterInlineImportFileName(file.name);
      setCoverLetterInlineImportPhase("preparing");

      try {
        if (!isCurrentRequest()) {
          return;
        }

        setCoverLetterInlineImportPhase("importing");
        const outcome = await importStructuredResumeFile(file, {
          trace,
          onRetrying: () => {
            if (isCurrentRequest()) {
              setCoverLetterInlineImportPhase("retrying");
            }
          },
          onRetrySucceeded: () => {
            if (isCurrentRequest()) {
              setCoverLetterInlineImportPhase("importing");
            }
          },
        });
        if (!isCurrentRequest()) {
          return;
        }

        if (outcome.status === "rejected") {
          setCoverLetterInlineImportError(outcome.message);
          return;
        }
        if (!Array.isArray(outcome.sections) || outcome.sections.length === 0) {
          setCoverLetterInlineImportError(
            outcome.emptyReason
              ? `Parser returned empty result: ${outcome.emptyReason}`
              : "No importable sections were found.",
          );
          return;
        }

        const nextCvId = uuidv4();
        const now = new Date().toISOString();
        setCoverLetterInlineImportPhase("finalizing");
        logStructuredImportTiming(trace, "importCv.start", {
          nextCvId,
        });
        pendingInlineImportedCvIdRef.current = nextCvId;
        pendingInlineImportRequestIdRef.current = requestId;
        pendingInlineImportTraceRef.current = trace;
        setPendingInlineImportedCvId(nextCvId);
        awaitingLiveCvHandoff = true;

        void importCv({
          id: nextCvId,
          title: deriveCvTitleFromSections(
            outcome.sections as any,
            "Imported CV",
          ),
          metadata: {
            createdAt: now,
            updatedAt: now,
            version: 1,
            ...(outcome.authoritativeResume
              ? { authoritativeResume: outcome.authoritativeResume }
              : {}),
          },
          sections: outcome.sections as any,
        })
          .then(() => {
            logStructuredImportTiming(trace, "importCv.finish", {
              nextCvId,
            });
          })
          .catch((error) => {
            const message =
              error instanceof Error
                ? error.message
                : "Couldn't read that file.";
            logStructuredImportTiming(trace, "importCv.error", {
              nextCvId,
              message,
            });
            if (!isCurrentRequest()) {
              return;
            }
            if (pendingInlineImportedCvIdRef.current !== nextCvId) {
              return;
            }
            clearPendingInlineImport();
            setCoverLetterInlineImportError(message);
            resetCoverLetterInlineImportUi();
          });
        return;
      } catch (error) {
        if (isCurrentRequest()) {
          logStructuredImportTiming(trace, "proposal_inline.error", {
            message:
              error instanceof Error
                ? error.message
                : "Couldn't read that file.",
          });
          setCoverLetterInlineImportError(
            error instanceof Error ? error.message : "Couldn't read that file.",
          );
        }
      } finally {
        if (coverLetterInlineFileInputRef.current) {
          coverLetterInlineFileInputRef.current.value = "";
        }
        if (isCurrentRequest() && !awaitingLiveCvHandoff) {
          resetCoverLetterInlineImportUi();
        }
      }
    },
    [
      clearPendingInlineImport,
      coverLetterInlineImportPhase,
      importCv,
      importStructuredResumeFile,
      resetCoverLetterInlineImportUi,
    ],
  );

  const handleToolbarVoicePresetChange = React.useCallback(
    (preset: FormValues["voicePreset"] | null) => {
      setComposeToolbarVoicePreset(preset);
    },
    [],
  );

  const commitProposalLocalStyle = React.useCallback(
    (
      nextStyle:
        | ReturnType<typeof resolveVerbatiStyle>
        | Partial<ReturnType<typeof resolveVerbatiStyle>>,
      helpers: {
        templateId?: ProposalTemplateId | null;
        templateBundleId?: ProposalTemplateBundleId | null;
        paletteOverride?: ProposalPaletteId | null;
        customAccentHex?: string | null;
      } = {},
    ) => {
      const resolvedStylePreset = resolveVerbatiStyle(nextStyle);
      const nextTemplateId = resolveProposalStyleCommitTemplateId({
        currentTemplateId: effectiveProposalTemplateId,
        requestedTemplateId: helpers.templateId,
        stylePreset: resolvedStylePreset,
      });
      const nextTemplateBundleId =
        helpers.templateBundleId === undefined
          ? proposalTemplateBundleId
          : helpers.templateBundleId;
      const nextStyleChoice =
        resolveProposalStyleChoiceFromRenderState({
          templateId: nextTemplateId,
          stylePreset: resolvedStylePreset,
        }) ?? proposalStyleChoice;

      setProposalStyleLinkMode("proposal_local");
      setProposalTemplateBundleId(nextTemplateBundleId ?? null);
      setProposalPaletteOverride(helpers.paletteOverride ?? null);
      setProposalCustomAccentHex(helpers.customAccentHex ?? null);
      setProposalStylePreset(resolvedStylePreset);
      setHasUserEditedStyle(true);
      setProposalWorkspaceStyle(resolvedStylePreset);
      setProposalTemplateId(nextTemplateId);
      setProposalStyleChoice(nextStyleChoice);

      latestProposalStyleCommitRevisionRef.current += 1;
      const nextDocumentStyleSlotId =
        getDocumentStyleSlotIdForProposalBundle(nextTemplateBundleId);
      const nextDocumentStyleSlotSource =
        nextDocumentStyleSlotId &&
        getProposalSettingsPresetForSlot(
          proposalSettingsPresets,
          nextDocumentStyleSlotId,
        )
          ? "settings"
          : "factory";
      const nextDocumentStyleMetadata = nextDocumentStyleSlotId
        ? {
            verbatiStyleSlotId: nextDocumentStyleSlotId,
            verbatiStyleSlotSource: nextDocumentStyleSlotSource,
            verbatiStyleSlotNameSnapshot: `Style ${nextDocumentStyleSlotId}`,
            verbatiStyleBaseSnapshot:
              buildProposalDocumentAppearanceSnapshot(resolvedStylePreset),
            documentStyleVersion: DOCUMENT_STYLE_VERSION,
          }
        : {};

      latestProposalStyleCommitRef.current = {
        proposalId: generatedProposalIdRef.current
          ? String(generatedProposalIdRef.current)
          : null,
        revision: latestProposalStyleCommitRevisionRef.current,
        templateId: nextTemplateId,
        verbatiStyle:
          serializeProposalMetadataVerbatiStyle(resolvedStylePreset),
        styleLinkMode: "proposal_local",
        styleChoice: nextStyleChoice,
        ...nextDocumentStyleMetadata,
        ...(nextTemplateBundleId
          ? { templateBundleId: nextTemplateBundleId }
          : null),
      };
    },
    [
      effectiveProposalTemplateId,
      proposalSettingsPresets,
      proposalStyleChoice,
      proposalTemplateBundleId,
    ],
  );

  const applyProposalDirectStyle = React.useCallback(
    (
      nextStyle:
        | ReturnType<typeof resolveVerbatiStyle>
        | Partial<ReturnType<typeof resolveVerbatiStyle>>,
    ) => {
      commitProposalLocalStyle(nextStyle);
    },
    [commitProposalLocalStyle],
  );

  const handleProposalStyleBundleSelect = React.useCallback(
    (bundleId: string) => {
      const bundleDefinition = getProposalTemplateBundleDefinition(
        bundleId as ProposalTemplateBundleId,
      );
      if (!bundleDefinition) {
        return;
      }

      commitProposalLocalStyle(
        resolveSettingsBackedProposalBundleStyle(bundleDefinition.id),
        {
          templateBundleId: bundleDefinition.id,
          paletteOverride: null,
          customAccentHex: null,
        },
      );
    },
    [commitProposalLocalStyle, resolveSettingsBackedProposalBundleStyle],
  );

  const handleProposalStyleBundleReset = React.useCallback(
    (bundleId: ProposalTemplateBundleId) => {
      const bundleDefinition = getProposalTemplateBundleDefinition(bundleId);

      commitProposalLocalStyle(
        resolveSettingsBackedProposalBundleStyle(bundleDefinition.id),
        {
          templateBundleId: bundleDefinition.id,
          paletteOverride: null,
          customAccentHex: null,
        },
      );
    },
    [commitProposalLocalStyle, resolveSettingsBackedProposalBundleStyle],
  );

  const handleProposalLayoutSelect = React.useCallback(
    (templateId: ProposalTemplateId) => {
      const nextStyleChoice =
        resolveProposalStyleChoiceFromRenderState({
          templateId,
          stylePreset: effectiveProposalStylePresetWithPalette,
        }) ?? proposalStyleChoice;

      setProposalStyleLinkMode("proposal_local");
      setProposalTemplateId(templateId);
      setProposalTemplateBundleId(null);
      setProposalStyleChoice(nextStyleChoice);
      setHasUserEditedStyle(true);

      latestProposalStyleCommitRevisionRef.current += 1;
      const documentStyleSlotId = getDocumentStyleSlotIdForProposalBundle(null);
      const documentStyleSlotSource =
        documentStyleSlotId &&
        getProposalSettingsPresetForSlot(
          proposalSettingsPresets,
          documentStyleSlotId,
        )
          ? "settings"
          : "factory";
      const documentStyleMetadata = documentStyleSlotId
        ? {
            verbatiStyleSlotId: documentStyleSlotId,
            verbatiStyleSlotSource: documentStyleSlotSource,
            verbatiStyleSlotNameSnapshot: `Style ${documentStyleSlotId}`,
            verbatiStyleBaseSnapshot: buildProposalDocumentAppearanceSnapshot(
              effectiveProposalStylePresetWithPalette,
            ),
            documentStyleVersion: DOCUMENT_STYLE_VERSION,
          }
        : {};

      latestProposalStyleCommitRef.current = {
        proposalId: generatedProposalIdRef.current
          ? String(generatedProposalIdRef.current)
          : null,
        revision: latestProposalStyleCommitRevisionRef.current,
        templateId,
        verbatiStyle: serializeProposalMetadataVerbatiStyle(
          effectiveProposalStylePresetWithPalette,
        ),
        styleLinkMode: "proposal_local",
        styleChoice: nextStyleChoice,
        ...documentStyleMetadata,
      };
    },
    [
      effectiveProposalStylePresetWithPalette,
      proposalSettingsPresets,
      proposalStyleChoice,
    ],
  );

  const handleProposalTypographySelect = React.useCallback(
    (typography: VerbatiStylePreset["typography"]) => {
      applyProposalDirectStyle({
        ...effectiveProposalStylePresetWithPalette,
        typography,
      });
    },
    [applyProposalDirectStyle, effectiveProposalStylePresetWithPalette],
  );

  const handleProposalPaletteSelect = React.useCallback(
    (palette: Exclude<VerbatiStylePreset["palette"], "custom">) => {
      commitProposalLocalStyle(
        {
          ...effectiveProposalStylePresetWithPalette,
          palette,
          accentHex: undefined,
        },
        {
          paletteOverride: palette as ProposalPaletteId,
          customAccentHex: null,
        },
      );
    },
    [commitProposalLocalStyle, effectiveProposalStylePresetWithPalette],
  );

  const handleProposalFixedAccentSelect = React.useCallback(
    (hex: string) => {
      commitProposalLocalStyle(
        {
          ...effectiveProposalStylePresetWithPalette,
          palette: "custom",
          accentHex: hex,
        },
        {
          paletteOverride: null,
          customAccentHex: null,
        },
      );
    },
    [commitProposalLocalStyle, effectiveProposalStylePresetWithPalette],
  );

  const handleProposalCustomAccentSelect = React.useCallback(
    (hex: string) => {
      commitProposalLocalStyle(
        {
          ...effectiveProposalStylePresetWithPalette,
          palette: "custom",
          accentHex: hex,
        },
        {
          paletteOverride: null,
          customAccentHex: hex,
        },
      );
    },
    [commitProposalLocalStyle, effectiveProposalStylePresetWithPalette],
  );

  const handleProposalCustomAccentClear = React.useCallback(() => {
    commitProposalLocalStyle(
      {
        ...effectiveProposalStylePresetWithPalette,
        palette: proposalPaletteOverride ?? "terre",
        accentHex: undefined,
      },
      {
        paletteOverride: proposalPaletteOverride,
        customAccentHex: null,
      },
    );
  }, [
    commitProposalLocalStyle,
    effectiveProposalStylePresetWithPalette,
    proposalPaletteOverride,
  ]);

  const handleProposalStart = React.useCallback(
    (values: FormValues) => {
      cancelPendingComposeDraftSync();
      setComposePreviewValues(buildStoredProposalComposeDraftSnapshot(values));
      const personalizationSource = generationPersonalizationSource;
      const applicantHeader = getProposalApplicantHeaderData(
        personalizationSource,
      );
      const previewApplicantHeader = hasApplicantHeaderContent(applicantHeader)
        ? applicantHeader
        : FALLBACK_PROPOSAL_APPLICANT_HEADER;
      const resolvedVoicePreset = resolveProposalVoicePreset(values);
      const nextDocumentTitle = buildProfessionalApplicationSubject({
        jobTitle: values.jobTitle,
        jobDescription: values.jobDescription,
        proposalType: values.proposalType,
      });
      const previousAuto = lastAutoApplicantHeaderRef.current;
      const nextAutoContactLine = buildProposalApplicantContactLine(
        previewApplicantHeader,
      );
      const nextResolvedDocumentTitle = resolveAutoHeadingField({
        current: proposalDocumentTitle,
        previousAuto: lastAutoDocumentTitleRef.current,
        nextAuto: nextDocumentTitle,
      });
      const nextDocumentTitleManual =
        nextResolvedDocumentTitle.trim() !== nextDocumentTitle.trim();
      setDuplicateSourceJobId(null);
      setLastProposalRequest(values);
      setLoading(true);
      setProposalType(values.proposalType);
      setComposeToolbarModelType(values.modelType);
      setProposalVoicePreset(resolvedVoicePreset);
      setProposalApplicantName((current) =>
        resolveHeadingFieldFromAuto("applicantName", {
          current,
          previousAuto: previousAuto.name,
          nextAuto: previewApplicantHeader.name,
          isInvalidCurrent: isInvalidProposalApplicantName,
        }),
      );
      setProposalApplicantRole((current) =>
        resolveHeadingFieldFromAuto("applicantRole", {
          current,
          previousAuto: previousAuto.role,
          nextAuto: previewApplicantHeader.role,
        }),
      );
      setProposalContactLine((current) =>
        resolveHeadingFieldFromAuto("contactLine", {
          current: normalizeProposalContactLine(current),
          previousAuto: previousAuto.contactLine,
          nextAuto: nextAutoContactLine,
        }),
      );
      setProposalDocumentTitle(nextResolvedDocumentTitle);
      setProposalDocumentTitleManual(nextDocumentTitleManual);
      setProposalDocumentMeta(applicantHeader.email ?? "");
      setProposalContent(null);
      setGeneratedProposalId(null);
      generatedProposalIdRef.current = null;
      latestProposalStyleCommitRef.current = null;
      setProposalOutputMode("preview");
      pendingQueuedComposeSnapshotRef.current = null;
      lastPersistedComposeTokenRef.current = null;
      composeAutosavePrimedRef.current = false;
      if (composeAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
        composeAutosaveTimeoutRef.current = null;
      }
      setComposeSaveStatus("idle");
      setIsComposePanelVisible(true);
      setIsBriefExpanded(true);
      setStatusMessage(null);
      setError(null);
      setErrorDetail(null);
      setFallbackInfo(null);
      lastAutoApplicantHeaderRef.current = {
        name: previewApplicantHeader.name ?? "",
        role: previewApplicantHeader.role ?? "",
        contactLine: nextAutoContactLine,
      };
      lastAutoDocumentTitleRef.current = nextDocumentTitle;
    },
    [
      generationPersonalizationSource,
      buildStoredProposalComposeDraftSnapshot,
      cancelPendingComposeDraftSync,
      formatProposalTypeLabel,
      proposalDocumentTitle,
      resolveHeadingFieldFromAuto,
      resolveProposalVoicePreset,
    ],
  );

  const handleProposalSubmit = React.useCallback(
    (
      values: FormValues,
      proposal: string,
      nextFallbackInfo?: ProposalGenerationFallbackInfo,
      nextProposalId?: Id<"proposals">,
      languageMetadata?: DocumentLanguageGenerationMetadata,
    ) => {
      cancelPendingComposeDraftSync();
      const personalizationSource = generationPersonalizationSource;
      const applicantHeader = getProposalApplicantHeaderData(
        personalizationSource,
      );
      const previewApplicantHeader = hasApplicantHeaderContent(applicantHeader)
        ? applicantHeader
        : FALLBACK_PROPOSAL_APPLICANT_HEADER;
      const resolvedVoicePreset = resolveProposalVoicePreset(values);
      const submittedComposeDraft =
        buildStoredProposalComposeDraftSnapshot(values);
      const stagedCvToCommit = stagedProposalCvSelection;
      setStagedProposalSourceDraft(null);
      setStagedSourceJobId(null);
      setStagedProposalCvSelection(null);
      if (stagedCvToCommit) {
        handleAttachedCvChange(stagedCvToCommit.id);
      }
      const nextDocumentTitle = buildProfessionalApplicationSubject({
        jobTitle: values.jobTitle,
        jobDescription: values.jobDescription,
        proposalType: values.proposalType,
      });
      const nextDocumentMeta = applicantHeader.email ?? "";
      writeStoredProposalComposeDraft(submittedComposeDraft);
      setComposePreviewValues(submittedComposeDraft);
      setOutputSourceComposeDraft(submittedComposeDraft);
      setComposeDraftInitialSeed(submittedComposeDraft);
      setComposeToolbarModelType(values.modelType);
      const signedProposal = ensureProposalSignatureName(
        proposal,
        previewApplicantHeader.name,
      );
      const previousAuto = lastAutoApplicantHeaderRef.current;
      const nextAutoContactLine = buildProposalApplicantContactLine(
        previewApplicantHeader,
      );
      const nextApplicantName = resolveHeadingFieldFromAuto("applicantName", {
        current: proposalApplicantName,
        previousAuto: previousAuto.name,
        nextAuto: previewApplicantHeader.name,
        isInvalidCurrent: isInvalidProposalApplicantName,
      });
      const nextApplicantRole = resolveHeadingFieldFromAuto("applicantRole", {
        current: proposalApplicantRole,
        previousAuto: previousAuto.role,
        nextAuto: previewApplicantHeader.role,
      });
      const nextContactLine = resolveHeadingFieldFromAuto("contactLine", {
        current: normalizeProposalContactLine(proposalContactLine),
        previousAuto: previousAuto.contactLine,
        nextAuto: nextAutoContactLine,
      });
      const nextResolvedDocumentTitle = resolveAutoHeadingField({
        current: proposalDocumentTitle,
        previousAuto: lastAutoDocumentTitleRef.current,
        nextAuto: nextDocumentTitle,
      });
      const nextDocumentTitleManual =
        nextResolvedDocumentTitle.trim() !== nextDocumentTitle.trim();
      const previousAutoSalutation =
        lastAutoLetterHeaderRef.current.salutation.trim();
      const manualSalutation = proposalSalutationValueRef.current.trim();
      const proposalContentWithManualHeading =
        manualSalutation && manualSalutation !== previousAutoSalutation
          ? replaceProposalSalutation({
              content: signedProposal,
              salutation: manualSalutation,
              previousSalutation: readProposalSalutation(signedProposal),
            })
          : signedProposal;
      writeStoredOutputDraft({
        proposalContent: proposalContentWithManualHeading,
        proposalType: values.proposalType,
        proposalVoicePreset: resolvedVoicePreset,
        proposalTemplateId:
          effectiveProposalTemplateId ?? fallbackProposalTemplateId,
        proposalVerbatiStyle: serializeVerbatiStyle(
          effectiveProposalStylePresetWithPalette,
        ),
        verbatiStyleSlotId: proposalRenderMetadata?.verbatiStyleSlotId ?? null,
        verbatiStyleSlotSource:
          proposalRenderMetadata?.verbatiStyleSlotSource ?? null,
        verbatiStyleSlotNameSnapshot:
          proposalRenderMetadata?.verbatiStyleSlotNameSnapshot ?? null,
        verbatiStyleBaseSnapshot:
          proposalRenderMetadata?.verbatiStyleBaseSnapshot ?? null,
        documentStyleVersion:
          proposalRenderMetadata?.documentStyleVersion ?? null,
        proposalStyleLinkMode: resolvedRuntimeStyleLinkMode,
        proposalStyleChoice,
        proposalApplicantName: nextApplicantName,
        proposalApplicantRole: nextApplicantRole,
        proposalApplicantCompany,
        proposalContactLine: nextContactLine,
        proposalLetterDate,
        proposalRecipientDetails,
        proposalHeaderShowSender: proposalHeaderVisibility.showSender,
        proposalHeaderShowDate: proposalHeaderVisibility.showDate,
        proposalHeaderShowSubject: proposalHeaderVisibility.showSubject,
        proposalHeaderShowRecipient: proposalHeaderVisibility.showRecipient,
        proposalHeaderShowRecipientDetails:
          proposalHeaderVisibility.showRecipientDetails,
        proposalDocumentTitle: nextResolvedDocumentTitle,
        proposalDocumentMeta: nextDocumentMeta,
        generatedProposalId: nextProposalId ?? null,
        proposalOutputMode: "preview",
        paletteOverride: proposalPaletteOverride,
        customAccentHex: proposalCustomAccentHex,
        templateBundleId: proposalTemplateBundleId,
        typographyOverride: effectiveProposalStylePresetWithPalette.typography,
        layoutOverride:
          effectiveProposalStylePresetWithPalette.layout === "swiss" ||
          effectiveProposalStylePresetWithPalette.layout === "editorial" ||
          effectiveProposalStylePresetWithPalette.layout === "modernist"
            ? effectiveProposalStylePresetWithPalette.layout
            : null,
        proposalDocumentTitleManual: nextDocumentTitleManual,
        proposalClosing: resolveProposalClosingRef({
          content: proposalContentWithManualHeading,
          proposalType: values.proposalType,
          applicantName: nextApplicantName,
          voicePreset: resolvedVoicePreset,
        }),
        characterLimitMode: values.characterLimitMode ?? null,
        characterLimitValue: values.characterLimitValue ?? null,
        requestedLanguage: languageMetadata?.requestedLanguage ?? null,
        resolvedLanguage: languageMetadata?.resolvedLanguage ?? null,
        languageSource: languageMetadata?.languageSource,
        jobDetectedLanguage: languageMetadata?.jobDetectedLanguage ?? null,
        sourceComposeDraft: submittedComposeDraft,
      });
      setLastProposalRequest(values);
      setProposalType(values.proposalType);
      setProposalLibraryStatus("draft");
      setProposalVoicePreset(resolvedVoicePreset);
      setProposalApplicantName(nextApplicantName);
      setProposalApplicantRole(nextApplicantRole);
      setProposalContactLine(nextContactLine);
      setProposalLetterDate(
        (current) =>
          current ||
          getDefaultProposalLetterDate(defaultPreviewApplicantHeader.location),
      );
      setProposalDocumentTitle(nextResolvedDocumentTitle);
      setProposalDocumentTitleManual(nextDocumentTitleManual);
      setProposalDocumentMeta(nextDocumentMeta);
      setProposalContent(proposalContentWithManualHeading);
      setGeneratedProposalId(nextProposalId ?? null);
      generatedProposalIdRef.current = nextProposalId ?? null;
      if (nextProposalId && canPersistProposalState) {
        const immediateMetadata: ProposalDocumentMetadata = {
          ...(proposalPersistenceMetadata ?? {}),
          proposalType: values.proposalType,
          voicePreset: resolvedVoicePreset,
          resolvedVoicePreset,
          requestedVoicePreset: values.voicePreset ?? null,
          requestedLanguage: languageMetadata?.requestedLanguage ?? null,
          resolvedLanguage: languageMetadata?.resolvedLanguage ?? null,
          languageSource: languageMetadata?.languageSource,
          jobDetectedLanguage: languageMetadata?.jobDetectedLanguage ?? null,
          ...(values.jobDescription?.trim()
            ? { sourceJobDescription: values.jobDescription.trim() }
            : {}),
          ...(values.sourceUrl?.trim()
            ? { sourceUrl: values.sourceUrl.trim() }
            : {}),
          ...(values.platform?.trim()
            ? { platform: values.platform.trim() }
            : {}),
          ...buildProposalHeadingMetadataPatch({
            applicantName: nextApplicantName,
            applicantRole: nextApplicantRole,
            applicantCompany: proposalApplicantCompany,
            contactLine: nextContactLine,
            letterDate:
              proposalLetterDate ||
              getDefaultProposalLetterDate(
                defaultPreviewApplicantHeader.location,
              ),
            recipientDetails: proposalRecipientDetails,
            headerVisibility: proposalHeaderVisibility,
          }),
        };
        void updateProposal({
          id: nextProposalId,
          content: proposalContentWithManualHeading,
          sections: [
            { type: "text", content: proposalContentWithManualHeading },
          ],
          status: "draft",
          metadata: immediateMetadata,
        }).catch((saveErr) => {
          console.warn("Failed to patch generated proposal metadata:", saveErr);
        });
      }
      setProposalOutputMode("preview");
      closeForgePanel();
      setProposalComposerMode(null);
      setIsComposePanelVisible(false);
      setIsBriefExpanded(false);
      lastSavedProposalContentRef.current = proposalContentWithManualHeading;
      lastSavedProposalTitleRef.current = nextResolvedDocumentTitle;
      // Generation can return a persisted proposal id before the full compose
      // artifact metadata has been patched onto that row. Leave the persisted
      // token empty so autosave/save backfills the current style snapshot onto
      // the generated server row.
      lastPersistedComposeTokenRef.current = nextProposalId
        ? null
        : JSON.stringify({
            title: nextResolvedDocumentTitle,
            content: proposalContentWithManualHeading.trim(),
            metadata: proposalPersistenceMetadata ?? null,
          });
      lastAutoApplicantHeaderRef.current = {
        name: previewApplicantHeader.name ?? "",
        role: previewApplicantHeader.role ?? "",
        contactLine: nextAutoContactLine,
      };
      lastAutoDocumentTitleRef.current = nextDocumentTitle;
      composeAutosavePrimedRef.current = true;
      setComposeSaveStatus("idle");
      setIsConfirmingGeneratedDelete(false);
      setStatusMessage(null);
      setError(null);
      setFallbackInfo(nextFallbackInfo ?? null);
      setLoading(false);
    },
    [
      generationPersonalizationSource,
      stagedProposalCvSelection,
      handleAttachedCvChange,
      canPersistProposalState,
      cancelPendingComposeDraftSync,
      closeForgePanel,
      effectiveProposalStylePresetWithPalette,
      effectiveProposalTemplateId,
      fallbackProposalTemplateId,
      buildStoredProposalComposeDraftSnapshot,
      formatProposalTypeLabel,
      proposalApplicantName,
      proposalApplicantRole,
      proposalApplicantCompany,
      proposalContactLine,
      proposalCustomAccentHex,
      proposalDocumentTitle,
      proposalPersistenceMetadata,
      proposalHeaderVisibility,
      proposalLetterDate,
      proposalPaletteOverride,
      proposalRecipientDetails,
      proposalTemplateBundleId,
      proposalStyleChoice,
      resolvedRuntimeStyleLinkMode,
      resolveHeadingFieldFromAuto,
      resolveProposalVoicePreset,
      updateProposal,
      defaultPreviewApplicantHeader.location,
      writeStoredOutputDraft,
    ],
  );

  const handleProposalError = React.useCallback(
    (message: string, values: FormValues, rawReason?: string | null) => {
      cancelPendingComposeDraftSync();
      setComposePreviewValues(buildStoredProposalComposeDraftSnapshot(values));
      const personalizationSource = generationPersonalizationSource;
      const applicantHeader = getProposalApplicantHeaderData(
        personalizationSource,
      );
      const previewApplicantHeader = hasApplicantHeaderContent(applicantHeader)
        ? applicantHeader
        : FALLBACK_PROPOSAL_APPLICANT_HEADER;
      const resolvedVoicePreset = resolveProposalVoicePreset(values);
      const nextDocumentTitle = buildProfessionalApplicationSubject({
        jobTitle: values.jobTitle,
        jobDescription: values.jobDescription,
        proposalType: values.proposalType,
      });
      const previousAuto = lastAutoApplicantHeaderRef.current;
      const nextAutoContactLine = buildProposalApplicantContactLine(
        previewApplicantHeader,
      );
      const nextResolvedDocumentTitle = resolveAutoHeadingField({
        current: proposalDocumentTitle,
        previousAuto: lastAutoDocumentTitleRef.current,
        nextAuto: nextDocumentTitle,
      });
      const nextDocumentTitleManual =
        nextResolvedDocumentTitle.trim() !== nextDocumentTitle.trim();
      setLastProposalRequest(values);
      setLoading(false);
      setProposalType(values.proposalType);
      setProposalVoicePreset(resolvedVoicePreset);
      setProposalApplicantName((current) =>
        resolveHeadingFieldFromAuto("applicantName", {
          current,
          previousAuto: previousAuto.name,
          nextAuto: previewApplicantHeader.name,
          isInvalidCurrent: isInvalidProposalApplicantName,
        }),
      );
      setProposalApplicantRole((current) =>
        resolveHeadingFieldFromAuto("applicantRole", {
          current,
          previousAuto: previousAuto.role,
          nextAuto: previewApplicantHeader.role,
        }),
      );
      setProposalContactLine((current) =>
        resolveHeadingFieldFromAuto("contactLine", {
          current: normalizeProposalContactLine(current),
          previousAuto: previousAuto.contactLine,
          nextAuto: nextAutoContactLine,
        }),
      );
      setProposalLetterDate(
        (current) =>
          current ||
          getDefaultProposalLetterDate(defaultPreviewApplicantHeader.location),
      );
      setProposalDocumentTitle(nextResolvedDocumentTitle);
      setProposalDocumentTitleManual(nextDocumentTitleManual);
      setProposalDocumentMeta(applicantHeader.email ?? "");
      setProposalContent(null);
      setGeneratedProposalId(null);
      setProposalOutputMode("preview");
      setIsComposePanelVisible(true);
      setIsBriefExpanded(true);
      setIsConfirmingGeneratedDelete(false);
      setError(message);
      setStatusMessage(null);
      setErrorDetail(rawReason ?? null);
      setFallbackInfo(null);
      lastAutoApplicantHeaderRef.current = {
        name: previewApplicantHeader.name ?? "",
        role: previewApplicantHeader.role ?? "",
        contactLine: nextAutoContactLine,
      };
      lastAutoDocumentTitleRef.current = nextDocumentTitle;
    },
    [
      generationPersonalizationSource,
      buildStoredProposalComposeDraftSnapshot,
      cancelPendingComposeDraftSync,
      formatProposalTypeLabel,
      proposalDocumentTitle,
      resolveHeadingFieldFromAuto,
      resolveProposalVoicePreset,
    ],
  );

  const handleProposalContentChange = React.useCallback(
    (nextContent: string) => {
      setProposalContent(nextContent);
    },
    [],
  );
  const handleRailAskAiChange = React.useCallback((value: string) => {
    setRailAskAiValue(value);
    setRailAskAiReview((current) =>
      current.status === "ready" || current.status === "error"
        ? { status: "idle" }
        : current,
    );
  }, []);

  const handleRailAskAiDiscard = React.useCallback(() => {
    setRailAskAiReview({ status: "idle" });
  }, []);

  const handleRailAskAiApply = React.useCallback(() => {
    if (railAskAiReview.status !== "ready") {
      return;
    }
    const previousProposalContent = proposalContent ?? "";
    setProposalContent(railAskAiReview.resultText);
    setRailAskAiValue("");
    setRailAskAiReview({
      status: "applied",
      previousProposalContent,
    });
  }, [proposalContent, railAskAiReview]);

  const handleRailAskAiUndo = React.useCallback(() => {
    setRailAskAiReview((current) => {
      if (current.status !== "applied") return current;
      setProposalContent(current.previousProposalContent);
      return { status: "idle" };
    });
  }, []);

  const handleRailAskAiSubmit = React.useCallback(async () => {
    const instruction = railAskAiValue.trim();
    const currentContent = proposalContent?.trim();
    if (!instruction || !currentContent || railAskAiBusy) {
      return;
    }

    setRailAskAiBusy(true);
    setRailAskAiReview({ status: "idle" });
    try {
      const jobContext = canonicalJobId
        ? {
            jobId: canonicalJobId,
            title:
              canonicalJobRecord?.title?.trim() ||
              composePreviewValues?.jobTitle?.trim() ||
              null,
            company: canonicalJobRecord?.company?.trim() || null,
            visibleSummary: canonicalJobRecord?.visibleSummary?.trim() || null,
            visibleRequirements: canonicalJobRecord?.visibleRequirements ?? [],
            visibleKeywords: canonicalJobRecord?.visibleKeywords ?? [],
          }
        : null;
      const askCharacterLimit = resolveProposalCharacterLimitSelection({
        mode: draftCharacterLimitMode,
        value: draftCharacterLimitValue,
      }).value;
      const askInstruction = askCharacterLimit
        ? `${instruction}\n\nKeep the revised draft within ${askCharacterLimit} characters.`
        : instruction;
      const result = await transformEditorSelectionAction({
        mode: "custom",
        instruction: askInstruction,
        selectedText: proposalContent,
        ...(jobContext ? { jobContext } : {}),
      });
      const normalizedResult =
        result == null ? null : normalizeEditorAiTextResult(result, "custom");
      if (!normalizedResult) {
        setRailAskAiReview({
          status: "error",
          errorMessage: "Ask AI returned no text. Try a more specific instruction.",
        });
        return;
      }
      setRailAskAiReview({
        status: "ready",
        resultText: normalizedResult.text,
      });
    } catch {
      setRailAskAiReview({
        status: "error",
        errorMessage: "Ask AI could not update the draft. Please try again in a moment.",
      });
    } finally {
      setRailAskAiBusy(false);
    }
  }, [
    canonicalJobId,
    canonicalJobRecord?.company,
    canonicalJobRecord?.title,
    canonicalJobRecord?.visibleKeywords,
    canonicalJobRecord?.visibleRequirements,
    canonicalJobRecord?.visibleSummary,
    composePreviewValues?.jobTitle,
    draftCharacterLimitMode,
    draftCharacterLimitValue,
    proposalContent,
    railAskAiBusy,
    railAskAiValue,
    transformEditorSelectionAction,
  ]);
  const railAskAiReviewModel = React.useMemo<ProposalRailAskReview>(() => {
    if (railAskAiBusy) return { status: "loading" };
    if (railAskAiReview.status === "ready") {
      return {
        status: "ready",
        resultText: railAskAiReview.resultText,
      };
    }
    if (railAskAiReview.status === "error") {
      return {
        status: "error",
        errorMessage: railAskAiReview.errorMessage,
      };
    }
    if (railAskAiReview.status === "applied") {
      return {
        status: "applied",
        canUndo: true,
      };
    }
    return { status: "idle" };
  }, [railAskAiBusy, railAskAiReview]);

  const handleProposalSalutationChange = React.useCallback(
    (value: string) => {
      markHeadingFieldDirty("salutation");
      const previousSalutation = proposalSalutationValueRef.current;
      setProposalSalutationValue(value);
      proposalSalutationValueRef.current = value;
      setProposalContent((current) =>
        replaceProposalSalutation({
          content: current,
          salutation: value,
          previousSalutation,
        }),
      );
    },
    [markHeadingFieldDirty],
  );

  const handleProposalStop = React.useCallback(() => {
    setLoading(false);
    setProposalContent(null);
    setGeneratedProposalId(null);
    generatedProposalIdRef.current = null;
    setProposalOutputMode("preview");
    setOutputSourceComposeDraft(null);
    pendingQueuedComposeSnapshotRef.current = null;
    lastPersistedComposeTokenRef.current = null;
    composeAutosavePrimedRef.current = false;
    if (composeAutosaveTimeoutRef.current !== null) {
      window.clearTimeout(composeAutosaveTimeoutRef.current);
      composeAutosaveTimeoutRef.current = null;
    }
    setComposeSaveStatus("idle");
    setIsComposePanelVisible(true);
    setIsBriefExpanded(true);
    setError(null);
    setStatusMessage("Generation stopped.");
    setErrorDetail(null);
    setFallbackInfo(null);
    setIsConfirmingGeneratedDelete(false);
  }, []);

  const handleProposalDocumentCommit = React.useCallback(async () => {
    const snapshot = buildComposeSaveSnapshot();
    if (!snapshot) return;

    if (proposalDocumentTitle !== snapshot.title) {
      setProposalDocumentTitle(snapshot.title);
    }

    try {
      await flushScheduledProposalSave(snapshot.title);
    } catch (saveError) {
      console.error("Failed to persist generated proposal edits:", saveError);
      const errorMessage =
        saveError instanceof Error ? saveError.message : String(saveError);
      if (errorMessage.includes("Proposal not found")) {
        // The stored draft id is stale (deleted/expired). Keep local content
        // and stop retrying invalid mutations until a fresh generation happens.
        setGeneratedProposalId(null);
        generatedProposalIdRef.current = null;
        showToast("Detached.", {
          variant: "error",
          description:
            "This proposal draft no longer exists on the server. Generate again to save new edits.",
        });
        return;
      }
      showToast("Save failed.", {
        variant: "error",
        description:
          "The proposal text changed locally but could not be saved.",
      });
    }
  }, [
    buildComposeSaveSnapshot,
    flushScheduledProposalSave,
    proposalDocumentTitle,
    showToast,
  ]);
  const handleSavedProposalContentChange = React.useCallback(
    (nextContent: string) => {
      setSavedProposalContent(nextContent);
    },
    [],
  );

  const handleSavedProposalDocumentCommit = React.useCallback(async () => {
    if (!openedSavedProposal || isSavingSavedProposal) {
      return;
    }

    const trimmed = savedProposalContent?.trim() ?? "";
    if (!trimmed) {
      return;
    }

    setIsSavingSavedProposal(true);
    try {
      await persistOpenedSavedProposal({
        title: savedProposalDocumentTitle.trim() || openedSavedProposal.title,
        content: trimmed,
        metadata: savedProposalRenderMetadata,
      });
      showToast("Saved.", {
        variant: "success",
        description: "Edits were applied to the saved proposal.",
      });
    } catch (error) {
      console.error("Failed to persist saved proposal edits:", error);
      showToast("Save failed.", {
        variant: "error",
        description: "The saved proposal could not be updated.",
      });
    } finally {
      setIsSavingSavedProposal(false);
    }
  }, [
    isSavingSavedProposal,
    openedSavedProposal,
    persistOpenedSavedProposal,
    savedProposalContent,
    savedProposalDocumentTitle,
    savedProposalRenderMetadata,
    showToast,
  ]);

  React.useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      if (savedCopyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(savedCopyFeedbackTimeoutRef.current);
      }
      if (composeAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (isSavedView || !proposalContent || loading) {
      return;
    }

    const contentWithoutLegacySignature =
      removeProposalSignatureNameFromClosing(proposalContent);
    if (contentWithoutLegacySignature !== proposalContent) {
      setProposalContent(contentWithoutLegacySignature);
    }
  }, [isSavedView, loading, proposalContent]);

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    if (suppressStoredOutputDraftSyncRef.current) {
      suppressStoredOutputDraftSyncRef.current = false;
      writeStoredOutputDraft(null);
      return;
    }

    if (skipNextStoredOutputDraftSyncRef.current) {
      skipNextStoredOutputDraftSyncRef.current = false;
      return;
    }

    if (isSavedView) {
      return;
    }

    const hasDraft =
      Boolean(proposalContent) ||
      Boolean(proposalDocumentTitle) ||
      Boolean(proposalDocumentMeta) ||
      Boolean(proposalLetterDate) ||
      Boolean(proposalRecipientDetails) ||
      Boolean(generatedProposalId);
    const hasPersistableOutput =
      proposalContent !== null || Boolean(generatedProposalId);

    if (!hasDraft) {
      if (hasCompletedInitialRenderRef.current) {
        writeStoredOutputDraft(null);
      }
      return;
    }

    if (!hasPersistableOutput) {
      return;
    }

    writeStoredOutputDraft({
      proposalContent,
      proposalType,
      proposalVoicePreset,
      proposalTemplateId: effectiveProposalTemplateId,
      proposalVerbatiStyle: effectiveProposalStylePresetWithPalette
        ? serializeVerbatiStyle(effectiveProposalStylePresetWithPalette)
        : null,
      verbatiStyleSlotId: proposalRenderMetadata?.verbatiStyleSlotId ?? null,
      verbatiStyleSlotSource:
        proposalRenderMetadata?.verbatiStyleSlotSource ?? null,
      verbatiStyleSlotNameSnapshot:
        proposalRenderMetadata?.verbatiStyleSlotNameSnapshot ?? null,
      verbatiStyleBaseSnapshot:
        proposalRenderMetadata?.verbatiStyleBaseSnapshot ?? null,
      documentStyleVersion:
        proposalRenderMetadata?.documentStyleVersion ?? null,
      proposalStyleLinkMode: resolvedRuntimeStyleLinkMode,
      proposalStyleChoice,
      proposalApplicantName,
      proposalApplicantRole,
      proposalContactLine,
      proposalLetterDate,
      proposalRecipientDetails,
      proposalHeaderShowSender: proposalHeaderVisibility.showSender,
      proposalHeaderShowDate: proposalHeaderVisibility.showDate,
      proposalHeaderShowSubject: proposalHeaderVisibility.showSubject,
      proposalHeaderShowRecipient: proposalHeaderVisibility.showRecipient,
      proposalHeaderShowRecipientDetails:
        proposalHeaderVisibility.showRecipientDetails,
      proposalDocumentTitle,
      proposalDocumentMeta,
      generatedProposalId,
      proposalOutputMode,
      paletteOverride: proposalPaletteOverride,
      customAccentHex: proposalCustomAccentHex,
      templateBundleId: proposalTemplateBundleId,
      typographyOverride: effectiveProposalStylePresetWithPalette.typography,
      layoutOverride:
        effectiveProposalStylePresetWithPalette.layout === "swiss" ||
        effectiveProposalStylePresetWithPalette.layout === "editorial" ||
        effectiveProposalStylePresetWithPalette.layout === "modernist"
          ? effectiveProposalStylePresetWithPalette.layout
          : null,
      proposalDocumentTitleManual,
      proposalClosing: resolveProposalClosingRef({
        closing: storedOutputProposalClosing,
        content: proposalContent,
        proposalType,
        applicantName: proposalApplicantName,
        voicePreset: proposalVoicePreset,
      }),
      characterLimitMode: draftCharacterLimitMode,
      characterLimitValue: draftCharacterLimitValue,
      sourceComposeDraft: outputSourceComposeDraft,
    });
  }, [
    generatedProposalId,
    outputSourceComposeDraft,
    proposalContent,
    proposalApplicantName,
    proposalApplicantRole,
    proposalContactLine,
    proposalHeaderVisibility,
    proposalLetterDate,
    proposalRecipientDetails,
    proposalDocumentMeta,
    proposalDocumentTitle,
    proposalDocumentTitleManual,
    proposalOutputMode,
    proposalStyleChoice,
    effectiveProposalStylePresetWithPalette,
    proposalCustomAccentHex,
    proposalPaletteOverride,
    proposalTemplateBundleId,
    resolvedRuntimeStyleLinkMode,
    draftCharacterLimitMode,
    draftCharacterLimitValue,
    effectiveProposalTemplateId,
    isSavedView,
    proposalType,
    proposalVoicePreset,
    storedOutputProposalClosingToken,
    writeStoredOutputDraft,
  ]);

  React.useEffect(() => {
    if (!composeAutosaveSnapshot) {
      pendingQueuedComposeSnapshotRef.current = null;
      if (composeAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
        composeAutosaveTimeoutRef.current = null;
      }
      if (composeSaveStatus !== "error") {
        setComposeSaveStatus("idle");
      }
      return;
    }

    if (!canPersistProposalState) {
      setComposeSaveStatus("idle");
      return;
    }

    if (
      requestedView === "compose" &&
      selectedDraftProposalId &&
      String(composeAutosaveSnapshot.id ?? "") !== selectedDraftProposalId
    ) {
      pendingQueuedComposeSnapshotRef.current = null;
      if (composeAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
        composeAutosaveTimeoutRef.current = null;
      }
      setComposeSaveStatus("idle");
      return;
    }

    if (!composeAutosavePrimedRef.current) {
      composeAutosavePrimedRef.current = true;
      if (lastPersistedComposeTokenRef.current) {
        lastPersistedComposeTokenRef.current = composeAutosaveSnapshot.token;
        setComposeSaveStatus("idle");
        return;
      }
      scheduleProposalSave(composeAutosaveSnapshot);
      return;
    }

    if (
      composeAutosaveSnapshot.token === lastPersistedComposeTokenRef.current
    ) {
      return;
    }

    scheduleProposalSave(composeAutosaveSnapshot);
  }, [
    canPersistProposalState,
    composeAutosaveSnapshot,
    composeSaveStatus,
    requestedView,
    scheduleProposalSave,
    selectedDraftProposalId,
  ]);

  const updateProposalRoute = React.useCallback(
    (view: ProposalForgeView, nextProposalId: string | null = null) => {
      const params = new URLSearchParams(search);
      params.delete("handoffId");
      if (view === "saved") {
        params.set("view", "saved");
        if (nextProposalId) {
          params.set("id", nextProposalId);
        } else {
          params.delete("id");
        }
      } else {
        params.delete("view");
        params.delete("id");
        params.delete("jobId");
      }
      const nextSearch = params.toString();
      void navigate(nextSearch ? `/proposal?${nextSearch}` : "/proposal");
    },
    [navigate, search],
  );

  const handleCopyOutput = React.useCallback(async () => {
    const activeContent = openedSavedProposal
      ? savedProposalContent
      : proposalContent;
    const activeProposalType = openedSavedProposal
      ? savedProposalType
      : proposalType;
    if (!activeContent) return;

    const displayedProposalText = getDisplayedProposalText(
      activeContent,
      activeProposalType,
    );

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(displayedProposalText);
      } else if (!fallbackCopyText(displayedProposalText)) {
        throw new Error("Clipboard unavailable");
      }

      if (openedSavedProposal) {
        setSavedCopyFeedback("copied");
        if (savedCopyFeedbackTimeoutRef.current !== null) {
          window.clearTimeout(savedCopyFeedbackTimeoutRef.current);
        }
        savedCopyFeedbackTimeoutRef.current = window.setTimeout(() => {
          setSavedCopyFeedback("idle");
          savedCopyFeedbackTimeoutRef.current = null;
        }, 2000);
      } else {
        setCopyFeedback("copied");
        if (copyFeedbackTimeoutRef.current !== null) {
          window.clearTimeout(copyFeedbackTimeoutRef.current);
        }
        copyFeedbackTimeoutRef.current = window.setTimeout(() => {
          setCopyFeedback("idle");
          copyFeedbackTimeoutRef.current = null;
        }, 2000);
      }
      showToast("Copied.", { variant: "success" });
    } catch (copyError) {
      console.warn("Failed to copy proposal:", copyError);
      showToast("Copy failed.", {
        variant: "error",
        description: "Clipboard access was unavailable.",
      });
    }
  }, [
    openedSavedProposal,
    proposalContent,
    proposalOutputMode,
    proposalType,
    savedProposalContent,
    savedProposalType,
    showToast,
  ]);

  const handleProposalOutputModeChange = React.useCallback(
    (nextMode: "preview" | "edit") => {
      setProposalOutputMode(nextMode);
      const latestStoredOutputDraft =
        readStoredProposalOutputDraft() ?? storedOutputDraft;
      if (
        latestStoredOutputDraft &&
        latestStoredOutputDraft.proposalOutputMode !== nextMode
      ) {
        writeStoredOutputDraft({
          ...latestStoredOutputDraft,
          proposalOutputMode: nextMode,
        });
      }
    },
    [storedOutputDraft, writeStoredOutputDraft],
  );

  const handleChooseSignature = React.useCallback(() => {
    const applicantName = sanitizeProposalApplicantName(proposalApplicantName);
    const nextClosing = resolveProposalClosingRef({
      closing: storedOutputProposalClosing
        ? { ...storedOutputProposalClosing, enabled: true, source: "settings" }
        : null,
      content: proposalContent || storedOutputDraft?.proposalContent || null,
      proposalType,
      applicantName,
      voicePreset: proposalVoicePreset,
      defaultEnabled: true,
    });

    if (!nextClosing?.signatureName) {
      return;
    }

    const latestStoredOutputDraft =
      readStoredProposalOutputDraft() ?? storedOutputDraft;
    const nextClosingToken = JSON.stringify(nextClosing);
    const closingChanged =
      JSON.stringify(latestStoredOutputDraft?.proposalClosing ?? null) !==
      nextClosingToken;

    if (!closingChanged) {
      return;
    }

    if (latestStoredOutputDraft) {
      const nextProposalContent = removeProposalSignatureNameFromClosing(
        latestStoredOutputDraft.proposalContent,
      );
      writeStoredOutputDraft({
        ...latestStoredOutputDraft,
        proposalContent: nextProposalContent,
        proposalClosing: nextClosing,
        proposalOutputMode,
      });
      if (nextProposalContent !== proposalContent) {
        setProposalContent(nextProposalContent);
      }
    }
  }, [
    proposalApplicantName,
    proposalContent,
    proposalOutputMode,
    proposalType,
    proposalVoicePreset,
    storedOutputDraft,
    storedOutputProposalClosing,
    writeStoredOutputDraft,
  ]);

  const handleToggleSignature = React.useCallback(
    (enabled: boolean) => {
      if (enabled) {
        handleChooseSignature();
        return;
      }

      const currentClosing = resolveProposalClosingRef({
        closing: storedOutputProposalClosing,
        content: proposalContent || storedOutputDraft?.proposalContent || null,
        proposalType,
        applicantName: sanitizeProposalApplicantName(proposalApplicantName),
        voicePreset: proposalVoicePreset,
        defaultEnabled: true,
      });
      if (!currentClosing) {
        return;
      }

      const nextClosing = {
        ...currentClosing,
        enabled: false,
        source: "settings" as const,
        handwrittenSignatureEnabled: false,
      };
      const latestStoredOutputDraft =
        readStoredProposalOutputDraft() ?? storedOutputDraft;
      const nextClosingToken = JSON.stringify(nextClosing);
      const closingChanged =
        JSON.stringify(latestStoredOutputDraft?.proposalClosing ?? null) !==
        nextClosingToken;

      if (!closingChanged) {
        return;
      }

      if (latestStoredOutputDraft) {
        const nextProposalContent = removeProposalSignatureNameFromClosing(
          latestStoredOutputDraft.proposalContent,
        );
        writeStoredOutputDraft({
          ...latestStoredOutputDraft,
          proposalContent: nextProposalContent,
          proposalClosing: nextClosing,
          proposalOutputMode,
        });
        if (nextProposalContent !== proposalContent) {
          setProposalContent(nextProposalContent);
        }
      }
    },
    [
      handleChooseSignature,
      proposalApplicantName,
      proposalContent,
      proposalOutputMode,
      proposalType,
      proposalVoicePreset,
      storedOutputDraft,
      storedOutputProposalClosing,
      writeStoredOutputDraft,
    ],
  );

  const handleToggleHandwrittenSignature = React.useCallback(
    (enabled: boolean) => {
      if (!proposalContent) {
        return;
      }

      if (!proposalSignatureSettings.imageDataUrl) {
        return;
      }

      const nextClosing = resolveProposalClosingRef({
        closing: storedOutputProposalClosing
          ? {
              ...storedOutputProposalClosing,
              enabled: true,
              source: "settings",
            }
          : null,
        content: proposalContent,
        proposalType,
        applicantName: sanitizeProposalApplicantName(proposalApplicantName),
        voicePreset: proposalVoicePreset,
        defaultEnabled: true,
      });

      if (!nextClosing?.signatureName) {
        return;
      }

      const nextClosingWithHandwritten = {
        ...nextClosing,
        handwrittenSignatureEnabled: enabled,
      };
      const latestStoredOutputDraft =
        readStoredProposalOutputDraft() ?? storedOutputDraft;
      const nextClosingWithHandwrittenToken = JSON.stringify(
        nextClosingWithHandwritten,
      );
      const closingChanged =
        JSON.stringify(latestStoredOutputDraft?.proposalClosing ?? null) !==
        nextClosingWithHandwrittenToken;

      if (!closingChanged) {
        return;
      }

      if (latestStoredOutputDraft) {
        writeStoredOutputDraft({
          ...latestStoredOutputDraft,
          proposalClosing: nextClosingWithHandwritten,
          proposalOutputMode,
        });
      }
    },
    [
      proposalApplicantName,
      proposalContent,
      proposalOutputMode,
      proposalSignatureSettings.imageDataUrl,
      proposalType,
      proposalVoicePreset,
      storedOutputDraft,
      storedOutputProposalClosing,
      writeStoredOutputDraft,
    ],
  );

  const handleCopySavedProposalToDraft = React.useCallback(
    async (options?: { showFeedback?: boolean; copyTitle?: boolean }) => {
      if (!openedSavedProposal || !savedProposalContent) {
        return;
      }

      const savedProposalHasRequestedVoicePreset = hasOwnProperty(
        openedSavedProposal.metadata,
        "requestedVoicePreset",
      );
      const restoredRequestedVoicePreset = savedProposalHasRequestedVoicePreset
        ? openedSavedProposal.metadata?.requestedVoicePreset ?? null
        : savedProposalVoicePreset;
      const restoredCustomAccentHex =
        effectiveSavedProposalStylePreset.palette === "custom"
          ? effectiveSavedProposalStylePreset.accentHex ?? null
          : null;
      const restoredPaletteOverride =
        restoredCustomAccentHex === null &&
        isProposalPaletteId(effectiveSavedProposalStylePreset.palette)
          ? effectiveSavedProposalStylePreset.palette
          : null;
      const restoredTemplateBundleId =
        resolveProposalTemplateBundleId(
          openedSavedProposal.metadata?.templateBundleId,
        ) ??
        getProposalBundleForDocumentStyleSlot(
          openedSavedProposal.metadata?.verbatiStyleSlotId,
        ) ??
        findProposalTemplateBundleIdByStylePreset(
          effectiveSavedProposalStylePreset,
        );
      const shouldRestoreSavedDetachedStyle =
        savedProposalStyleLinkMode === "proposal_local";
      const restoredJobId = openedSavedProposal.metadata?.jobId?.trim() || null;
      const restoredSourceJobDescription =
        openedSavedProposal.metadata?.sourceJobDescription?.trim() || null;
      const restoredApplicantName =
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "applicantName",
        ) ?? "";
      const restoredApplicantRole =
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "applicantRole",
        ) ?? "";
      const restoredApplicantCompany =
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "applicantCompany",
        ) ?? "";
      const restoredContactLine =
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "contactLine",
        ) ?? "";
      const restoredLetterDate =
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "letterDate",
        ) ?? "";
      const restoredRecipientDetails =
        resolveProposalHeadingText(
          openedSavedProposal.metadata,
          "recipientDetails",
        ) ?? "";
      const restoredHeaderVisibility = resolveProposalHeaderVisibility({
        ...buildProposalHeaderVisibilityFromContent(restoredRecipientDetails),
        showSender: openedSavedProposal.metadata?.headerShowSender,
        showDate: openedSavedProposal.metadata?.headerShowDate,
        showSubject: openedSavedProposal.metadata?.headerShowSubject,
        showRecipient: openedSavedProposal.metadata?.headerShowRecipient,
        showRecipientDetails:
          openedSavedProposal.metadata?.headerShowRecipientDetails,
      });
      let duplicatedDraftId: Id<"proposals"> | null = null;
      const restoredDocumentTitle =
        savedProposalDocumentTitle.trim() ||
        openedSavedProposal.title ||
        "Untitled proposal";
      const nextDraftTitle = options?.copyTitle
        ? `Copy of ${restoredDocumentTitle}`
        : restoredDocumentTitle;
      let restoredModelType = composeToolbarModelType;

      if (canPersistProposalState) {
        const duplicateMetadata: ProposalDocumentMetadata = {
          ...(openedSavedProposal.metadata ?? {}),
          ...(restoredJobId ? { jobId: restoredJobId } : {}),
          ...buildProposalHeadingMetadataPatch({
            applicantName: restoredApplicantName,
            applicantRole: restoredApplicantRole,
            applicantCompany: restoredApplicantCompany,
            contactLine: restoredContactLine,
            letterDate: restoredLetterDate,
            recipientDetails: restoredRecipientDetails,
            headerVisibility: restoredHeaderVisibility,
          }),
        };
        try {
          duplicatedDraftId = (await createProposal({
            title: nextDraftTitle,
            content: savedProposalContent,
            sections: [{ type: "text", content: savedProposalContent }],
            status: "draft",
            metadata: duplicateMetadata,
          })) as Id<"proposals">;
        } catch (error) {
          console.error(
            "Failed to duplicate saved proposal to draft:",
            error,
          );
        }
      }

      if (typeof window !== "undefined") {
        try {
          const existingComposeDraft = readStoredProposalComposeDraft() ?? {};
          restoredModelType =
            isProposalLlmModelType(existingComposeDraft.modelType)
              ? existingComposeDraft.modelType
              : composeToolbarModelType;
          const composeDraft: StoredProposalComposeDraft = {
            proposalType: savedProposalType ?? "cover_letter",
            modelType: restoredModelType,
          };

          const normalizedRestoredToolbarVoicePreset =
            normalizeComposeToolbarVoicePreset(restoredRequestedVoicePreset);
          if (
            savedProposalHasRequestedVoicePreset ||
            normalizedRestoredToolbarVoicePreset !== null
          ) {
            composeDraft.voicePreset = normalizedRestoredToolbarVoicePreset;
          }

          cancelPendingComposeDraftSync();
          writeStoredProposalComposeDraft(composeDraft);
          setComposePreviewValues(composeDraft);
          setOutputSourceComposeDraft(composeDraft);
          setComposeDraftInitialSeed(composeDraft);
          if (openedSavedProposalSourceCvId) {
            handleAttachedCvChange(openedSavedProposalSourceCvId);
          }
        } catch {
          // Ignore storage failures and continue with the in-memory draft.
        }
      }

      setProposalContent(savedProposalContent);
      setProposalType(savedProposalType);
      setComposeToolbarModelType(restoredModelType);
      setProposalVoicePreset(savedProposalVoicePreset);
      setComposeToolbarVoicePreset(
        normalizeComposeToolbarVoicePreset(restoredRequestedVoicePreset),
      );
      setProposalTemplateId(effectiveSavedProposalTemplateId);
      setProposalStyleLinkMode(savedProposalStyleLinkMode);
      setProposalStyleChoice(
        resolveProposalStyleChoice(
          openedSavedProposal.metadata?.styleChoice ??
            resolveProposalStyleChoiceFromRenderState({
              templateId: effectiveSavedProposalTemplateId,
              stylePreset: effectiveSavedProposalStylePreset,
            }) ??
            "auto",
        ),
      );
      setProposalStylePreset(effectiveSavedProposalStylePreset);
      setHasUserEditedStyle(shouldRestoreSavedDetachedStyle);
      setProposalWorkspaceStyle(
        shouldRestoreSavedDetachedStyle
          ? effectiveSavedProposalStylePreset
          : null,
      );
      setProposalTemplateBundleId(restoredTemplateBundleId);
      setProposalPaletteOverride(restoredPaletteOverride);
      setProposalCustomAccentHex(restoredCustomAccentHex);
      setProposalApplicantName(restoredApplicantName);
      setProposalApplicantRole(restoredApplicantRole);
      setProposalApplicantCompany(restoredApplicantCompany);
      setProposalContactLine(restoredContactLine);
      setProposalLetterDate(restoredLetterDate);
      setProposalRecipientDetails(restoredRecipientDetails);
      setProposalHeaderVisibility(restoredHeaderVisibility);
      setProposalDocumentTitle(nextDraftTitle);
      setProposalDocumentTitleManual(Boolean(nextDraftTitle.trim()));
      setProposalDocumentMeta(savedProposalDocumentMeta);
      setDuplicateSourceJobId(restoredJobId);
      setGeneratedProposalId(duplicatedDraftId);
      generatedProposalIdRef.current = duplicatedDraftId;
      setProposalOutputMode(savedProposalOutputMode);
      lastPersistedComposeTokenRef.current = null;
      pendingQueuedComposeSnapshotRef.current = null;
      composeAutosavePrimedRef.current = false;
      if (composeAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
        composeAutosaveTimeoutRef.current = null;
      }
      setComposeSaveStatus("idle");
      setLastProposalRequest(null);
      setComposeFormInstanceKey((currentKey) => currentKey + 1);
      setIsCvPickerOpen(false);
      setCvPickerRequestKey(0);
      setIsComposePanelVisible(true);
      setIsBriefExpanded(true);
      setFallbackInfo(null);
      setError(null);
      setStatusMessage(null);
      setErrorDetail(null);
      if (options?.showFeedback !== false) {
        showToast("Copied to draft.", {
          variant: "success",
          description: restoredSourceJobDescription
            ? "A detached draft copy is ready with the saved proposal and its source brief."
            : "A detached draft copy is ready. Review the brief in Compose before refining.",
        });
      }
      updateProposalRoute("compose");
    },
    [
      cancelPendingComposeDraftSync,
      canPersistProposalState,
      createProposal,
      effectiveSavedProposalStylePreset,
      effectiveSavedProposalTemplateId,
      openedSavedProposal,
      openedSavedProposalSourceCvId,
      savedProposalContent,
      savedProposalDocumentMeta,
      savedProposalDocumentTitle,
      savedProposalOutputMode,
      savedProposalStyleLinkMode,
      savedProposalType,
      savedProposalVoicePreset,
      showToast,
      updateProposalRoute,
    ],
  );
  const handleShareSavedProposal = React.useCallback(async () => {
    if (!openedSavedProposal || !savedProposalContent) {
      return;
    }

    const shareTitle =
      openedSavedProposal.title.trim() ||
      savedProposalDocumentTitle.trim() ||
      "Untitled proposal";
    const shareUrl =
      typeof window === "undefined"
        ? ""
        : `${window.location.origin}/proposal?view=saved&id=${encodeURIComponent(
            String(openedSavedProposal._id),
          )}`;

    if (!shareUrl) {
      return;
    }

    try {
      if (typeof navigator.share === "function") {
        await navigator.share({
          title: shareTitle,
          text: shareTitle,
          url: shareUrl,
        });
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else if (!fallbackCopyText(shareUrl)) {
        throw new Error("Clipboard fallback failed.");
      }
      showToast("Share link copied.", {
        variant: "success",
        description: "The saved proposal link is ready to paste.",
      });
    } catch (shareError) {
      if (
        shareError instanceof DOMException &&
        shareError.name === "AbortError"
      ) {
        return;
      }

      console.warn("Failed to share saved proposal:", shareError);
      showToast("Share failed.", {
        variant: "error",
        description: "Sharing was unavailable in this browser.",
      });
    }
  }, [
    openedSavedProposal,
    savedProposalContent,
    savedProposalDocumentTitle,
    showToast,
  ]);
  const handleDeleteOutput = React.useCallback(async () => {
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete proposal?")
    ) {
      return;
    }
    if (generatedProposalId && !canPersistProposalState) {
      showConvexAuthRequiredToast("Delete");
      return;
    }

    try {
      if (generatedProposalId) {
        await deleteProposal({ id: generatedProposalId });
      }
      cancelPendingComposeDraftSync();
      writeStoredOutputDraft(null);
      setProposalContent(null);
      setProposalType(null);
      setProposalVoicePreset(null);
      setProposalTemplateId(
        getProposalTwinTemplateId(effectiveProposalStylePreset),
      );
      setProposalStylePreset(effectiveProposalStylePreset);
      setProposalStyleLinkMode(
        activeCvProposalStylePreset ? "inherit_cv" : "proposal_local",
      );
      setHasUserEditedStyle(false);
      setProposalWorkspaceStyle(null);
      setProposalApplicantName(defaultPreviewApplicantHeader.name || "");
      setProposalApplicantRole(defaultPreviewApplicantHeader.role || "");
      setProposalApplicantCompany("");
      setProposalContactLine(defaultPreviewContactLine);
      setProposalLetterDate(
        getDefaultProposalLetterDate(defaultPreviewApplicantHeader.location),
      );
      setProposalRecipientDetails("");
      setProposalHeaderVisibility(
        buildProposalHeaderVisibilityFromContent(null),
      );
      setProposalDocumentTitle("");
      setProposalDocumentTitleManual(false);
      setProposalDocumentMeta("");
      setGeneratedProposalId(null);
      setProposalOutputMode("preview");
      setComposePreviewValues(null);
      setOutputSourceComposeDraft(null);
      setStickyImportedSource({ sourceUrl: null, platform: null });
      setFallbackInfo(null);
      setError(null);
      setStatusMessage(null);
      setErrorDetail(null);
      setIsConfirmingGeneratedDelete(false);
      lastSavedProposalContentRef.current = null;
      lastPersistedComposeTokenRef.current = null;
      composeAutosavePrimedRef.current = false;
      generatedProposalIdRef.current = null;
      pendingQueuedComposeSnapshotRef.current = null;
      if (composeAutosaveTimeoutRef.current !== null) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
        composeAutosaveTimeoutRef.current = null;
      }
      setComposeSaveStatus("idle");
      showToast("Draft cleared.", { variant: "success" });
    } catch (deleteError) {
      console.error("Failed to delete proposal draft:", deleteError);
      showToast("Delete failed.", {
        variant: "error",
        description: "The generated proposal could not be removed.",
      });
    }
  }, [
    activeCvProposalStylePreset,
    cancelPendingComposeDraftSync,
    canPersistProposalState,
    defaultPreviewApplicantHeader.name,
    defaultPreviewApplicantHeader.role,
    defaultPreviewContactLine,
    deleteProposal,
    effectiveProposalStylePreset,
    generatedProposalId,
    showConvexAuthRequiredToast,
    showToast,
    writeStoredOutputDraft,
  ]);
  const handleDeleteSavedProposal = React.useCallback(async () => {
    if (!openedSavedProposal) return;
    if (
      typeof window !== "undefined" &&
      !window.confirm("Delete proposal?")
    ) {
      return;
    }
    if (!canPersistProposalState) {
      showConvexAuthRequiredToast("Delete");
      return;
    }

    try {
      await deleteProposal({ id: openedSavedProposal._id });
      showToast("Deleted.", { variant: "success" });
      updateProposalRoute("saved");
    } catch (deleteError) {
      console.error("Failed to delete saved proposal:", deleteError);
      showToast("Delete failed.", {
        variant: "error",
        description: "The saved proposal could not be removed.",
      });
    }
  }, [
    canPersistProposalState,
    deleteProposal,
    openedSavedProposal,
    showConvexAuthRequiredToast,
    showToast,
    updateProposalRoute,
  ]);

  const sourceCvOptions = React.useMemo(
    () =>
      listLocalCvPickerOptions(attachedCvId).map((option) => ({
        id: option.id,
        title: option.title,
        description:
          option.desiredPosition ||
          option.profileName ||
          option.updatedAt ||
          option.createdAt ||
          null,
        selected: option.id === attachedCvId || option.isActive,
      })),
    [attachedCvId],
  );
  const hasLocalResumes = sourceCvOptions.length > 0;
  const railLibraryModel = React.useMemo(
    () =>
      buildWorkLibraryModel({
        proposals: (savedProposals ??
          fallbackSavedProposals) as LibraryProposalRecord[],
        cvs,
        currentCvId,
        outputDraft: storedOutputDraft,
        composeDraft: readStoredProposalComposeDraft(),
      }),
    [
      currentCvId,
      cvs,
      fallbackSavedProposals,
      savedProposals,
      storedOutputDraft,
    ],
  );
  const railCvItems = React.useMemo(
    () => railLibraryModel.items.filter((item) => item.type === "cv"),
    [railLibraryModel.items],
  );
  const railProposalItems = React.useMemo(
    () => railLibraryModel.items.filter((item) => item.type === "proposal"),
    [railLibraryModel.items],
  );
  const handleSelectJobFromRailDrawer = React.useCallback(
    async (jobId: string) => {
      setJobContextCleared(false);
      if (proposalContent?.trim()) {
        setStagedSourceJobId(jobId);
        return;
      }
      try {
        await handleProposalDocumentCommit();
      } catch {
        /* commit handler already surfaces save errors */
      }
      void navigate(`/proposal?jobId=${encodeURIComponent(jobId)}`);
      openTemplateSurface("proposal-draft");
    },
    [
      handleProposalDocumentCommit,
      navigate,
      openTemplateSurface,
      proposalContent,
    ],
  );
  const handleOpenJobDetailsFromRailDrawer = React.useCallback(
    (jobId: string) => {
      closeForgePanel();
      void navigate(`/jobs/${encodeURIComponent(jobId)}`);
    },
    [closeForgePanel, navigate],
  );
  const handleOpenPasteJobFromDraft = React.useCallback(() => {
    openTemplateSurface("proposal-paste-job");
  }, [openTemplateSurface]);
  const handleSelectCvFromRailDrawer = React.useCallback(
    async (cvId: string) => {
      const hydratedCv = await hydrateCvDocument(cvId);
      if (!hydratedCv) {
        showToast("CV unavailable.", {
          variant: "error",
          description: "The full CV could not be loaded for this proposal.",
        });
        return;
      }
      if (proposalContent?.trim()) {
        const nextSelection = resolveAttachedCvSelectionById(cvId);
        setStagedProposalCvSelection({
          id: nextSelection.id ?? cvId,
          title:
            nextSelection.title ??
            hydratedCv.title ??
            translateUi(resolvedLanguage, "workspace.selectedCv"),
        });
        openTemplateSurface("proposal-draft");
        showToast(translateUi(resolvedLanguage, "workspace.cvSourceStaged"), {
          variant: "success",
          description: translateUi(
            resolvedLanguage,
            "workspace.letterUnchangedRegenerate",
          ),
        });
        return;
      }
      handleAttachedCvChange(cvId);
      openTemplateSurface("proposal-draft");
    },
    [
      handleAttachedCvChange,
      hydrateCvDocument,
      openTemplateSurface,
      proposalContent,
      resolvedLanguage,
      showToast,
    ],
  );
  const handleOpenCvFromRailDrawer = React.useCallback(
    (cvId: string) => {
      closeForgePanel();
      void navigate(`/cv?id=${encodeURIComponent(cvId)}`);
    },
    [closeForgePanel, navigate],
  );
  const handleOpenCvLibraryFromRailDrawer = React.useCallback(() => {
    closeForgePanel();
    void navigate("/documents?type=cvs");
  }, [closeForgePanel, navigate]);
  const handleOpenLibraryTypeFromRailDrawer = React.useCallback(
    (type: "cvs" | "proposals") => {
      closeForgePanel();
      void navigate(`/documents?type=${type}`);
    },
    [closeForgePanel, navigate],
  );
  const handleOpenLibraryItemFromRailDrawer = React.useCallback(
    (item: LibraryItem) => {
      closeForgePanel();
      if (item.routeTarget.kind === "route") {
        void navigate(item.routeTarget.to);
      }
    },
    [closeForgePanel, navigate],
  );
  const handleDownloadRailLibraryItems = React.useCallback(
    async (items: LibraryItem[]) => {
      try {
        await downloadLibraryItems(items, { hydrateCvDocument });
      } catch (error) {
        console.warn("Failed to download drawer library items", error);
      }
    },
    [hydrateCvDocument],
  );
  const handleDeleteRailLibraryItems = React.useCallback(
    (items: LibraryItem[]) => {
      if (items.length === 0) return;
      if (
        !window.confirm(
          `Delete ${items.length} selected item${items.length === 1 ? "" : "s"}?`,
        )
      ) {
        return;
      }
      items.forEach((item) => {
        const sourceId = forgeDrawerSourceId(item);
        if (item.type === "cv") {
          deleteCv(sourceId);
          return;
        }
        if (item.source === "local") {
          writeStoredOutputDraft(null);
          return;
        }
        if (canPersistProposalState) {
          void deleteProposal({ id: sourceId as Id<"proposals"> });
        }
      });
    },
    [canPersistProposalState, deleteCv, deleteProposal, writeStoredOutputDraft],
  );
  const jobsPanelRegistration = React.useMemo(
    () => ({
      surface: "jobs" as const,
      title: translateUi(resolvedLanguage, "jobs.attachJob"),
      subtitle: translateUi(resolvedLanguage, "jobs.attachJobHelp"),
      icon: <Briefcase size={16} aria-hidden="true" />,
      backAction: {
        ariaLabel: translateUi(resolvedLanguage, "workspace.backToDraft"),
        onSelect: () => openTemplateSurface("proposal-draft"),
      },
      renderContent: () => (
        <ProposalJobsDrawer
          jobs={proposalRailJobs}
          onSelectJob={(jobId) => void handleSelectJobFromRailDrawer(jobId)}
          onOpenJob={handleOpenJobDetailsFromRailDrawer}
          onOpenPasteJob={handleOpenPasteJobFromDraft}
        />
      ),
      footer: {
        label: translateUi(resolvedLanguage, "jobs.openJobsPage"),
        icon: <Briefcase size={13} aria-hidden="true" />,
        onSelect: () => navigate("/jobs"),
      },
    }),
    [
      handleOpenJobDetailsFromRailDrawer,
      handleOpenPasteJobFromDraft,
      handleSelectJobFromRailDrawer,
      navigate,
      openTemplateSurface,
      proposalRailJobs,
      resolvedLanguage,
    ],
  );
  useRegisterForgePanel(jobsPanelRegistration);
  const cvsPanelRegistration = React.useMemo(
    () => ({
      surface: "cvs" as const,
      title: translateUi(resolvedLanguage, "workspace.attachCv"),
      icon: <FileUser size={16} aria-hidden="true" />,
      backAction: {
        ariaLabel: translateUi(resolvedLanguage, "workspace.backToDraft"),
        onSelect: () => openTemplateSurface("proposal-draft"),
      },
      renderContent: () => (
        <ProposalCvDrawer
          items={railCvItems}
          activeCvId={attachedCvId}
          hydrateCvDocument={hydrateCvDocument}
          onSelectCv={handleSelectCvFromRailDrawer}
          onOpenCv={handleOpenCvFromRailDrawer}
        />
      ),
      footer: {
        label: translateUi(resolvedLanguage, "workspace.openCvForge"),
        icon: <FileUser size={13} aria-hidden="true" />,
        onSelect: () =>
          navigate(
            attachedCvId ? `/cv?id=${encodeURIComponent(attachedCvId)}` : "/cv",
          ),
      },
    }),
    [
      attachedCvId,
      handleOpenCvFromRailDrawer,
      handleSelectCvFromRailDrawer,
      hydrateCvDocument,
      navigate,
      openTemplateSurface,
      railCvItems,
      resolvedLanguage,
    ],
  );
  useRegisterForgePanel(cvsPanelRegistration);
  const proposalsPanelRegistration = React.useMemo(
    () => ({
      surface: "proposals" as const,
      title: translateUi(resolvedLanguage, "nav.proposals"),
      icon: <FolderTree size={16} aria-hidden="true" />,
      renderContent: () => (
        <ProposalLibraryDrawer
          items={railProposalItems}
          hydrateCvDocument={hydrateCvDocument}
          onOpenItem={handleOpenLibraryItemFromRailDrawer}
          onOpenProposal={handleOpenLibraryItemFromRailDrawer}
        />
      ),
      footer: {
        label: translateUi(resolvedLanguage, "workspace.openLibrary"),
        icon: <FolderSimple size={13} aria-hidden="true" />,
        onSelect: () => navigate("/documents?type=proposals"),
      },
    }),
    [
      handleOpenLibraryItemFromRailDrawer,
      hydrateCvDocument,
      navigate,
      railProposalItems,
      resolvedLanguage,
    ],
  );
  useRegisterForgePanel(proposalsPanelRegistration);
  const documentsPanelRegistration = React.useMemo(
    () => ({
      surface: "documents" as const,
      title: translateUi(resolvedLanguage, "workspace.library"),
      icon: <FolderTree size={16} aria-hidden="true" />,
      renderContent: () => (
        <ProjectsLibraryDrawer
          items={railLibraryModel.items}
          initialFilter="proposals"
          hydrateCvDocument={hydrateCvDocument}
          onOpenItem={handleOpenLibraryItemFromRailDrawer}
          onOpenLibraryType={handleOpenLibraryTypeFromRailDrawer}
          onDownloadItems={(items) =>
            void handleDownloadRailLibraryItems(items)
          }
          onDeleteItems={handleDeleteRailLibraryItems}
        />
      ),
      footer: {
        label: translateUi(resolvedLanguage, "workspace.openLibrary"),
        icon: <FolderSimple size={13} aria-hidden="true" />,
        onSelect: () => navigate("/documents?type=proposals"),
      },
    }),
    [
      handleDeleteRailLibraryItems,
      handleDownloadRailLibraryItems,
      handleOpenLibraryTypeFromRailDrawer,
      handleOpenLibraryItemFromRailDrawer,
      hydrateCvDocument,
      navigate,
      railLibraryModel.items,
      resolvedLanguage,
    ],
  );
  useRegisterForgePanel(documentsPanelRegistration);
  const attachedCvDisplayTitle = React.useMemo(() => {
    if (!attachedCvId) return null;
    return (
      listLocalCvPickerOptions(attachedCvId).find(
        (option) => option.id === attachedCvId,
      )?.title ??
      attachedCvTitle ??
      null
    );
  }, [attachedCvId, attachedCvTitle]);
  const isForgeDrawerDockedDesktop =
    templatePanelOpen &&
    templatePanelOpenMode === "docked" &&
    isWideEnoughForDockedForgePanel;
  const proposalLayoutViewportWidth = Math.max(
    0,
    viewportWidth -
      (isForgeDrawerDockedDesktop ? FORGE_DOCKED_PANEL_INLINE_SIZE_PX : 0),
  );
  // Page + rail + grid gap + page padding need room before two-pane mode is safe.
  const proposalTwoPaneMinViewportWidth = 1420;
  const proposalPaperVisualInlineSize = `min(100%, ${PROPOSAL_PAPER_VISUAL_INLINE_SIZE})`;
  const proposalBaseWorkspaceOutputShellInlineSize =
    "var(--proposal-paper-visual-inline-size)";
  const proposalWorkspaceShellBlockSize =
    "min(var(--document-viewer-shell-max-block), calc(100dvh - var(--header-height) - (var(--space-4) * 2) - var(--document-viewer-toolbar-block-size) - var(--space-2)))";
  const isCompactComposeLayout =
    proposalLayoutViewportWidth < proposalTwoPaneMinViewportWidth;
  const proposalWorkspaceOutputShellInlineSize =
    proposalBaseWorkspaceOutputShellInlineSize;
  const proposalWorkbenchColumnInlineSize =
    "var(--proposal-workspace-output-shell-inline-size)";
  const proposalDesktopComposeWidth = proposalWorkbenchColumnInlineSize;
  const proposalComposeColumnInlineSize = proposalWorkbenchColumnInlineSize;
  const showComposePanel = isComposePanelVisible && !isSavedView;
  const briefJobDescription =
    canonicalJobRecord?.rawDescription?.trim() ||
    resolvedProposalWorkspaceSourceDraft?.jobDescription?.trim() ||
    prefill?.jobDescription?.trim() ||
    "";
  const briefSourceUrl =
    canonicalJobRecord?.sourceUrl ??
    resolvedProposalWorkspaceSourceDraft?.sourceUrl ??
    null;
  const briefSourcePlatform =
    canonicalJobRecord?.sourceDomain ??
    resolvedProposalWorkspaceSourceDraft?.platform ??
    null;
  const hasMeaningfulComposeDraft = Boolean(
    canonicalJobRecord?.title?.trim() ||
      canonicalJobRecord?.rawDescription?.trim() ||
      composePreviewValues?.jobTitle?.trim() ||
      composePreviewValues?.jobDescription?.trim() ||
      composeDraftInitialSeed?.jobTitle?.trim() ||
      composeDraftInitialSeed?.jobDescription?.trim() ||
      prefill?.jobTitle?.trim() ||
      prefill?.jobDescription?.trim() ||
      briefSourceUrl?.trim() ||
      briefSourcePlatform?.trim(),
  );
  const proposalEditorAiJobContext =
    React.useMemo<EditorAiJobContext | null>(() => {
      if (!canonicalJobId) return null;

      return {
        jobId: canonicalJobId,
        title:
          canonicalJobRecord?.title?.trim() ||
          resolvedProposalWorkspaceSourceDraft?.jobTitle?.trim() ||
          null,
        company: canonicalJobRecord?.company?.trim() || null,
        visibleSummary: canonicalJobRecord?.visibleSummary?.trim() || null,
        visibleRequirements: canonicalJobRecord?.visibleRequirements ?? [],
        visibleKeywords: canonicalJobRecord?.visibleKeywords ?? [],
      };
    }, [
      canonicalJobId,
      canonicalJobRecord?.company,
      canonicalJobRecord?.title,
      canonicalJobRecord?.visibleKeywords,
      canonicalJobRecord?.visibleRequirements,
      canonicalJobRecord?.visibleSummary,
      resolvedProposalWorkspaceSourceDraft?.jobTitle,
    ]);
  const hasMeaningfulOutputDraft = Boolean(
    proposalContent?.trim() ||
      proposalDocumentTitle?.trim() ||
      storedOutputDraft?.proposalContent?.trim() ||
      storedOutputDraft?.proposalDocumentTitle?.trim() ||
      generatedProposalId,
  );
  const proposalDisplayApplicantHeader = React.useMemo(
    () => ({
      name: sanitizeProposalApplicantName(proposalApplicantName) || null,
      role: proposalApplicantRole.trim() || null,
      company: proposalApplicantCompany.trim() || null,
      email: null,
      phone: null,
      linkedin: null,
      website: null,
      location: null,
      tag: null,
    }),
    [proposalApplicantName, proposalApplicantRole, proposalApplicantCompany],
  );
  const proposalContentSalutation = React.useMemo(
    () => readProposalSalutation(proposalContent),
    [proposalContent],
  );
  React.useEffect(() => {
    if (!proposalContentSalutation) {
      return;
    }

    setProposalSalutationValue(proposalContentSalutation);
    proposalSalutationValueRef.current = proposalContentSalutation;
  }, [proposalContentSalutation]);
  const proposalSalutationPlaceholder = React.useMemo(
    () =>
      buildProposalSalutation(
        proposalRecipientDetails || autoProposalRecipientDetails,
      ),
    [autoProposalRecipientDetails, proposalRecipientDetails],
  );
  const effectiveProposalClosing = React.useMemo(
    () =>
      resolveProposalClosingRef({
        closing: storedOutputProposalClosing,
        content: proposalContent,
        proposalType,
        applicantName:
          sanitizeProposalApplicantName(proposalApplicantName) ||
          proposalDisplayApplicantHeader.name,
        voicePreset: proposalVoicePreset,
      }),
    [
      proposalApplicantName,
      proposalContent,
      proposalDisplayApplicantHeader.name,
      proposalType,
      proposalVoicePreset,
      storedOutputProposalClosingToken,
    ],
  );
  const effectiveProposalClosingToken = React.useMemo(
    () => JSON.stringify(effectiveProposalClosing),
    [effectiveProposalClosing],
  );
  const exportComposeProposalSource = React.useCallback(
    () =>
      buildProposalExportSource({
        content: proposalContent,
        proposalType,
        documentTitle:
          proposalDocumentTitle ||
          buildProfessionalApplicationSubject({
            jobTitle: composePreviewValues?.jobTitle ?? "",
            jobDescription: composePreviewValues?.jobDescription ?? "",
            proposalType,
          }),
        documentMeta:
          proposalDocumentMeta || proposalDisplayApplicantHeader.email || "",
        contactLine: proposalContactLine,
        letterDate: proposalLetterDate,
        recipientDetails: proposalRecipientDetails,
        applicantHeader: proposalDisplayApplicantHeader,
        headerVisibility: proposalHeaderVisibility,
        templateId:
          proposalRenderMetadata?.templateId ??
          effectiveProposalTemplateId ??
          fallbackProposalTemplateId,
        signatureSettings: proposalSignatureSettings,
        closing: effectiveProposalClosing,
        locale: storedOutputDraft?.resolvedLanguage,
      }),
    [
      composePreviewValues?.jobDescription,
      composePreviewValues?.jobTitle,
      effectiveProposalTemplateId,
      fallbackProposalTemplateId,
      effectiveProposalClosing,
      proposalContactLine,
      proposalDisplayApplicantHeader,
      proposalDocumentMeta,
      proposalDocumentTitle,
      proposalHeaderVisibility,
      proposalLetterDate,
      proposalRecipientDetails,
      proposalRenderMetadata?.templateId,
      proposalSignatureSettings,
      proposalType,
      proposalContent,
      storedOutputDraft?.resolvedLanguage,
    ],
  );
  const exportComposeStyledProposalSource = React.useCallback(
    () =>
      buildProposalPreviewPrintSource({
        content: proposalContent,
        proposalType,
        voicePreset: proposalVoicePreset,
        railTitle: sanitizeProposalApplicantName(proposalApplicantName),
        railMeta: proposalApplicantRole,
        documentTitle:
          proposalDocumentTitle ||
          buildProfessionalApplicationSubject({
            jobTitle: composePreviewValues?.jobTitle ?? "",
            jobDescription: composePreviewValues?.jobDescription ?? "",
            proposalType,
          }),
        documentMeta:
          proposalDocumentMeta || proposalDisplayApplicantHeader.email || "",
        contactLine: proposalContactLine,
        letterDate: proposalLetterDate,
        recipientDetails: proposalRecipientDetails,
        applicantHeader: proposalDisplayApplicantHeader,
        headerVisibility: proposalHeaderVisibility,
        templateId:
          proposalRenderMetadata?.templateId ??
          effectiveProposalTemplateId ??
          fallbackProposalTemplateId,
        stylePreset: effectiveProposalStylePresetWithPalette,
        signatureSettings: proposalSignatureSettings,
        closing: effectiveProposalClosing,
        locale: storedOutputDraft?.resolvedLanguage,
      }),
    [
      composePreviewValues?.jobDescription,
      composePreviewValues?.jobTitle,
      effectiveProposalStylePresetWithPalette,
      effectiveProposalClosing,
      effectiveProposalTemplateId,
      fallbackProposalTemplateId,
      proposalApplicantName,
      proposalApplicantRole,
      proposalContactLine,
      proposalDisplayApplicantHeader,
      proposalDocumentMeta,
      proposalDocumentTitle,
      proposalHeaderVisibility,
      proposalLetterDate,
      proposalRecipientDetails,
      proposalRenderMetadata?.templateId,
      proposalSignatureSettings,
      proposalType,
      proposalContent,
      proposalVoicePreset,
      storedOutputDraft?.resolvedLanguage,
    ],
  );
  const exportSavedProposalSource = React.useCallback(() => {
    if (!openedSavedProposal || !savedProposalContent) {
      return null;
    }

    const savedMetadata = openedSavedProposal.metadata;
    const savedApplicantHeader =
      buildProposalApplicantHeaderFromMetadata(savedMetadata);
    const savedContactLine = resolveProposalHeadingText(
      savedMetadata,
      "contactLine",
    );
    const savedLetterDate = resolveProposalHeadingText(
      savedMetadata,
      "letterDate",
    );
    const savedRecipientDetails = resolveProposalHeadingText(
      savedMetadata,
      "recipientDetails",
    );
    const savedClosing = resolveProposalClosingRef({
      closing: savedMetadata?.closing,
      content: savedProposalContent,
      proposalType: savedProposalType,
      applicantName: savedApplicantHeader.name,
      voicePreset: savedProposalVoicePreset,
    });

    return buildProposalExportSource({
      content: savedProposalContent,
      proposalType: savedProposalType,
      documentTitle:
        savedProposalDocumentTitle.trim() ||
        openedSavedProposal.title ||
        "Proposal",
      documentMeta: savedProposalDocumentMeta,
      contactLine: savedContactLine ?? "",
      letterDate: savedLetterDate ?? "",
      recipientDetails: savedRecipientDetails ?? "",
      applicantHeader: savedApplicantHeader,
      headerVisibility: resolveProposalHeaderVisibility({
        showSender: savedMetadata?.headerShowSender,
        showDate: savedMetadata?.headerShowDate,
        showSubject: savedMetadata?.headerShowSubject,
        showRecipient: savedMetadata?.headerShowRecipient,
        showRecipientDetails: savedMetadata?.headerShowRecipientDetails,
      }),
      templateId: savedProposalTemplateId,
      signatureSettings: proposalSignatureSettings,
      closing: savedClosing,
      locale: savedMetadata?.resolvedLanguage,
    });
  }, [
    openedSavedProposal,
    proposalSignatureSettings,
    savedProposalContent,
    savedProposalDocumentMeta,
    savedProposalDocumentTitle,
    savedProposalTemplateId,
    savedProposalType,
    savedProposalVoicePreset,
  ]);
  const exportSavedStyledProposalSource = React.useCallback(() => {
    if (!openedSavedProposal || !savedProposalContent) {
      return null;
    }

    const savedMetadata = openedSavedProposal.metadata;
    const savedApplicantHeader =
      buildProposalApplicantHeaderFromMetadata(savedMetadata);
    const savedRailTitle = resolveProposalHeadingText(
      savedMetadata,
      "applicantName",
    );
    const savedRailMeta = resolveProposalHeadingText(
      savedMetadata,
      "applicantRole",
    );
    const savedContactLine = resolveProposalHeadingText(
      savedMetadata,
      "contactLine",
    );
    const savedLetterDate = resolveProposalHeadingText(
      savedMetadata,
      "letterDate",
    );
    const savedRecipientDetails = resolveProposalHeadingText(
      savedMetadata,
      "recipientDetails",
    );
    const savedClosing = resolveProposalClosingRef({
      closing: savedMetadata?.closing,
      content: savedProposalContent,
      proposalType: savedProposalType,
      applicantName: savedApplicantHeader.name,
      voicePreset: savedProposalVoicePreset,
    });

    return buildProposalPreviewPrintSource({
      content: savedProposalContent,
      proposalType: savedProposalType,
      voicePreset: savedProposalVoicePreset,
      railTitle: savedRailTitle ?? null,
      railMeta: savedRailMeta ?? null,
      documentTitle:
        savedProposalDocumentTitle.trim() ||
        openedSavedProposal.title ||
        "Proposal",
      documentMeta: savedProposalDocumentMeta,
      contactLine: savedContactLine ?? "",
      letterDate: savedLetterDate ?? "",
      recipientDetails: savedRecipientDetails ?? "",
      applicantHeader: savedApplicantHeader,
      headerVisibility: resolveProposalHeaderVisibility({
        showSender: savedMetadata?.headerShowSender,
        showDate: savedMetadata?.headerShowDate,
        showSubject: savedMetadata?.headerShowSubject,
        showRecipient: savedMetadata?.headerShowRecipient,
        showRecipientDetails: savedMetadata?.headerShowRecipientDetails,
      }),
      templateId: effectiveSavedProposalTemplateId,
      stylePreset: effectiveSavedProposalStylePreset,
      signatureSettings: proposalSignatureSettings,
      closing: savedClosing,
      locale: savedMetadata?.resolvedLanguage,
    });
  }, [
    effectiveSavedProposalStylePreset,
    effectiveSavedProposalTemplateId,
    openedSavedProposal,
    proposalSignatureSettings,
    savedProposalContent,
    savedProposalDocumentMeta,
    savedProposalDocumentTitle,
    savedProposalType,
    savedProposalVoicePreset,
  ]);
  const handleExportProposalFile = React.useCallback(
    async (args: {
      target: "compose" | "saved";
      format: "pdf" | "docx";
      mode?: "ats" | "styled";
    }) => {
      if (proposalExportingFormat) {
        return;
      }

      const source =
        args.format === "pdf" && args.mode === "styled"
          ? args.target === "saved"
            ? exportSavedStyledProposalSource()
            : exportComposeStyledProposalSource()
          : args.target === "saved"
            ? exportSavedProposalSource()
            : exportComposeProposalSource();

      const hasExportableContent =
        source &&
        ("body" in source
          ? source.body.length > 0
          : source.content.trim().length > 0);

      if (!hasExportableContent) {
        showToast("Export unavailable.", {
          variant: "warning",
          description: "Generate or open a proposal before exporting.",
        });
        return;
      }

      const exportKey =
        args.format === "pdf"
          ? `${args.target}-${args.mode ?? "ats"}-pdf`
          : `${args.target}-docx`;
      const exportStylePreset =
        args.target === "saved"
          ? effectiveSavedProposalStylePreset
          : effectiveProposalStylePresetWithPalette;

      setProposalExportingFormat(exportKey);

      try {
        if (args.format === "pdf" && args.mode === "styled") {
          const resolvedTemplateId =
            source.kind === "proposal" && "templateId" in source
              ? source.templateId
              : null;
          const previewCapture = readProposalPreviewDebugCapture();
          if (resolvedTemplateId) {
            setStyledProposalExportContext({
              proposalId:
                args.target === "saved" && openedSavedProposal
                  ? String(openedSavedProposal._id)
                  : generatedProposalId
                    ? String(generatedProposalId)
                    : null,
              proposalUrl:
                typeof window !== "undefined" ? window.location.href : null,
              templateId: resolvedTemplateId,
              stylePreset: exportStylePreset,
              previewCapture,
              timestamp: Date.now(),
            });

            console.debug(
              "[ProposalForge] styled proposal export snapshot",
              buildProposalPrintDebugSnapshot({
                stylePreset: exportStylePreset,
                templateId: resolvedTemplateId,
                voicePreset:
                  source.kind === "proposal" && "voicePreset" in source
                    ? source.voicePreset
                    : null,
              }),
            );
          }
        }

        const exported = await exportDocumentFile({
          kind: "proposal",
          format: args.format,
          mode: args.format === "pdf" ? args.mode : undefined,
          data: source,
          stylePreset: exportStylePreset,
          fileNameBase:
            args.format === "docx"
              ? "Proposal - Editable"
              : args.mode === "ats"
                ? "Proposal - ATS"
                : "Proposal - Styled",
          metadata:
            args.format === "pdf" && args.mode === "styled"
              ? {
                  proposalTypographyAudit: buildProposalTypographyAuditMetadata(
                    {
                      proposalId:
                        args.target === "saved" && openedSavedProposal
                          ? String(openedSavedProposal._id)
                          : generatedProposalId
                            ? String(generatedProposalId)
                            : null,
                      proposalUrl:
                        typeof window !== "undefined"
                          ? window.location.href
                          : null,
                      templateId:
                        source.kind === "proposal" && "templateId" in source
                          ? source.templateId ?? fallbackProposalTemplateId
                          : effectiveProposalTemplateId ??
                            fallbackProposalTemplateId,
                      stylePreset: exportStylePreset,
                      previewCapture: readProposalPreviewDebugCapture(),
                      timestamp: Date.now(),
                    },
                  ),
                }
              : undefined,
        });

        showToast("Downloaded.", { variant: "success" });
      } catch (error) {
        console.error("[ProposalForge] export failed", error);
        showToast("Export failed.", { variant: "error" });
      } finally {
        setProposalExportingFormat(null);
      }
    },
    [
      buildProposalTypographyAuditMetadata,
      effectiveProposalTemplateId,
      effectiveProposalStylePresetWithPalette,
      effectiveSavedProposalStylePreset,
      exportComposeStyledProposalSource,
      exportComposeProposalSource,
      exportSavedStyledProposalSource,
      exportSavedProposalSource,
      fallbackProposalTemplateId,
      generatedProposalId,
      openedSavedProposal,
      proposalExportingFormat,
      showToast,
    ],
  );
  const briefJobTitle = normalizeProposalRailJobTitle(
    canonicalJobRecord?.title?.trim() ||
      resolvedProposalWorkspaceSourceDraft?.jobTitle?.trim() ||
      prefill?.jobTitle?.trim() ||
      "",
  );
  const briefSummaryText = canonicalJobRecord?.summary?.trim() || null;
  const proposalRailJobSummary =
    compactStoredJobSummary(canonicalJobRecord?.summary) ||
    compactStoredJobSummary(canonicalJobRecord?.visibleSummary);
  const briefTrustState = canonicalJobRecord?.reviewState ?? null;
  const briefReviewItems = canonicalJobRecord?.reviewItems ?? [];
  const briefLinkedDocumentCount = canonicalJobRecord?.linkedProposalCount ?? 0;
  const briefLinkedProposals = canonicalJobRecord?.linkedProposals ?? [];
  const hasBriefContent = Boolean(briefJobDescription);
  const hasActiveProposalJobContext = Boolean(
    !jobContextCleared &&
      (canonicalJobRecord?.title?.trim() ||
      canonicalJobRecord?.rawDescription?.trim() ||
      resolvedProposalWorkspaceSourceDraft?.jobTitle?.trim() ||
      resolvedProposalWorkspaceSourceDraft?.jobDescription?.trim() ||
      resolvedProposalWorkspaceSourceDraft?.sourceUrl?.trim() ||
      resolvedProposalWorkspaceSourceDraft?.platform?.trim()),
  );
  const showBriefCard = hasBriefContent && !isBriefExpanded && showComposePanel;
  const shouldShowDesktopBriefCapsule =
    showBriefCard && !isCompactComposeLayout;
  const shouldLeftAnchorStackedWorkbench =
    isCompactComposeLayout && proposalLayoutViewportWidth >= 768;
  const canCollapseComposePanel = !isSavedView && !isCompactComposeLayout;
  const shouldCenterOutputStage =
    !isSavedView &&
    !isComposePanelVisible &&
    !isCompactComposeLayout &&
    !shouldShowDesktopBriefCapsule;
  const isLoadingHandoff =
    !prefill?.handoffId &&
    ((Boolean(handoffId && handoffToken) &&
      publicHandoffRecord === undefined) ||
      (Boolean(handoffId && !handoffToken) &&
        (isConvexAuthLoading ||
          (isConvexAuthenticated && handoffRecord === undefined))) ||
      (Boolean(canonicalJobId) &&
        (isConvexAuthLoading ||
          (isConvexAuthenticated && canonicalJobRecord === undefined))));
  const shouldShowTemplateJobContextEmptyState =
    !isSavedView &&
    Boolean(proposalStyleSlotIntent) &&
    !hasActiveProposalJobContext &&
    !isTemplateJobContextEmptyStateDismissed &&
    !handoffId &&
    !canonicalJobId &&
    !isLoadingHandoff;
  const shouldShowProposalAiStream = Boolean(
    isLoadingHandoff ||
      loading ||
      error ||
      statusMessage ||
      composeGenerateControl.state === "loading" ||
      composeGenerateControl.state === "error",
  );
  const shouldShowCoverLetterStartSurface =
    !isSavedView &&
    proposalEntryIntent === "cover-letter-start" &&
    isCoverLetterStartSessionActive &&
    !handoffId &&
    !canonicalJobId &&
    !isLoadingHandoff &&
    !attachedCvId &&
    !hasMeaningfulComposeDraft &&
    !hasMeaningfulOutputDraft;
  const shouldRenderColdStartInlineOnly = shouldShowCoverLetterStartSurface;
  const shouldShowCollapsedComposeToolbar =
    !shouldRenderColdStartInlineOnly &&
    !isComposePanelVisible &&
    !isSavedView &&
    canCollapseComposePanel;
  const shouldAutoCollapseProposalRailForDockedDrawer =
    isForgeDrawerDockedDesktop && viewportWidth < 1760;
  const shouldRenderProposalRail = false;
  const showComposeGridColumn =
    shouldRenderProposalRail &&
    showComposePanel &&
    (isForgeDrawerDockedDesktop || !isCompactComposeLayout);
  const liveWorkbenchMaxWidth = isForgeDrawerDockedDesktop
    ? "100%"
    : isCompactComposeLayout
      ? "100%"
      : shouldRenderColdStartInlineOnly
        ? proposalDesktopComposeWidth
        : shouldAutoCollapseProposalRailForDockedDrawer
          ? "var(--forge-page-inline-size)"
          : showComposeGridColumn
            ? "100%"
            : shouldCenterOutputStage
              ? "var(--forge-page-inline-size)"
              : `calc(${proposalDesktopComposeWidth} + var(--proposal-workspace-output-shell-inline-size) + var(--layout-card-grid))`;

  const stackedCardWidthStyle: React.CSSProperties = isCompactComposeLayout
    ? {
        width: `min(100%, ${proposalWorkbenchColumnInlineSize})`,
        minWidth: 0,
      }
    : { width: "100%", minWidth: 0 };
  const composeColumnShellWidthStyle: ProposalWorkspaceCssVars = {
    ...stackedCardWidthStyle,
    "--document-viewer-shell-inline-size": proposalWorkbenchColumnInlineSize,
  };
  const proposalToolbarInlineSize = isCompactComposeLayout
    ? "var(--document-sheet-inline-size)"
    : proposalWorkbenchColumnInlineSize;
  const proposalToolbarWidthStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: proposalToolbarInlineSize,
    minWidth: 0,
  };
  const proposalWorkbenchFrameStyle: ProposalWorkspaceCssVars = {
    width: "100%",
    maxWidth: liveWorkbenchMaxWidth,
    marginInline: isForgeDrawerDockedDesktop
      ? 0
      : shouldRenderColdStartInlineOnly
        ? "auto"
        : showComposeGridColumn ||
            shouldLeftAnchorStackedWorkbench ||
            shouldShowDesktopBriefCapsule
          ? 0
          : "auto",
    minWidth: 0,
    "--proposal-paper-visual-inline-size": proposalPaperVisualInlineSize,
    "--proposal-workspace-output-shell-inline-size":
      proposalWorkspaceOutputShellInlineSize,
    "--proposal-workspace-shell-block-size": proposalWorkspaceShellBlockSize,
    "--proposal-compose-column-inline-size": proposalComposeColumnInlineSize,
  };
  const proposalWorkbenchToolbarSlotStyle: ProposalWorkspaceCssVars = {
    width: "100%",
    maxWidth: proposalToolbarInlineSize,
    marginInline: 0,
    minWidth: 0,
    "--proposal-workspace-output-shell-inline-size":
      proposalWorkspaceOutputShellInlineSize,
    "--proposal-compose-column-inline-size": proposalComposeColumnInlineSize,
  };
  const proposalJobHref = resolvedProposalJobId
    ? `/jobs/${encodeURIComponent(resolvedProposalJobId)}`
    : null;
  const activeCharacterLimitSelection = React.useMemo(
    () =>
      resolveProposalCharacterLimitSelection({
        mode: draftCharacterLimitMode,
        value: draftCharacterLimitValue,
      }),
    [draftCharacterLimitMode, draftCharacterLimitValue],
  );
  const proposalRailLengthOptions = React.useMemo(() => {
    const activeValue = activeCharacterLimitSelection.value;
    return [
      {
        id: "short" as const,
        label: "concise",
        description: "~1,200 chars · tight, no bloat",
        selected: activeValue !== null && activeValue <= 1400,
      },
      {
        id: "medium" as const,
        label: "standard",
        description: "~2,000 chars · enough, no more",
        selected:
          activeValue === null || (activeValue > 1400 && activeValue <= 2600),
      },
      {
        id: "long" as const,
        label: "detailed",
        description: "~3,200 chars · room for context",
        selected: activeValue !== null && activeValue > 2600,
      },
    ];
  }, [activeCharacterLimitSelection.value]);
  const proposalTopbarLengthLabel = React.useMemo(
    () =>
      resolveProposalTopbarLengthLabel({
        content: proposalContent,
        requestedLength: activeCharacterLimitSelection.value,
      }),
    [activeCharacterLimitSelection.value, proposalContent],
  );
  const proposalTopbarDocumentState = React.useMemo(() => {
    if (composeSaveStatus === "saving" || isSavingOutputToLibrary) {
      return "saving" as const;
    }
    if (composeSaveStatus === "error") return "error" as const;
    if (composeSaveStatus === "saved" || proposalLibraryStatus === "saved") {
      return "saved" as const;
    }
    return "draft" as const;
  }, [
    composeSaveStatus,
    isSavingOutputToLibrary,
    proposalLibraryStatus,
  ]);
  const proposalGeneratedDocumentTitle = React.useMemo(
    () =>
      buildProfessionalApplicationSubject({
        jobTitle: composePreviewValues?.jobTitle ?? "",
        jobDescription: composePreviewValues?.jobDescription ?? "",
        proposalType,
      }),
    [
      composePreviewValues?.jobDescription,
      composePreviewValues?.jobTitle,
      proposalType,
    ],
  );
  const proposalTypeOptions = React.useMemo(
    () =>
      [
        {
          id: "cover_letter" as const,
          label: "Letter",
          description: "A focused cover letter for the selected job.",
        },
        {
          id: "freelance_proposal" as const,
          label: "Proposal",
          description: "A client-facing proposal for freelance work.",
        },
        {
          id: "application_message" as const,
          label: "Message",
          description: "A shorter application note.",
        },
      ].map((option) => ({
        ...option,
        selected: (proposalType ?? "cover_letter") === option.id,
      })),
    [proposalType],
  );
  const handleProposalTypeSelect = React.useCallback(
    (nextProposalType: FormValues["proposalType"]) => {
      setProposalType(nextProposalType);
      const nextDraft: StoredProposalComposeDraft = {
        ...(composePreviewValues ?? readStoredProposalComposeDraft() ?? {}),
        proposalType: nextProposalType,
      };
      writeStoredProposalComposeDraft(nextDraft);
      setComposePreviewValues(nextDraft);
      setOutputSourceComposeDraft((current) => ({
        ...(current ?? nextDraft),
        proposalType: nextProposalType,
      }));
      setComposeDraftInitialSeed((current) => ({
        ...(current ?? nextDraft),
        proposalType: nextProposalType,
      }));

      const nextAutoTitle = buildProfessionalApplicationSubject({
        jobTitle: nextDraft.jobTitle ?? "",
        jobDescription: nextDraft.jobDescription ?? "",
        proposalType: nextProposalType,
      });
      if (!proposalDocumentTitleManual) {
        setProposalDocumentTitle(nextAutoTitle);
        lastAutoDocumentTitleRef.current = nextAutoTitle;
      }
      setComposeFormInstanceKey((currentKey) => currentKey + 1);
    },
    [composePreviewValues, proposalDocumentTitleManual],
  );
  const proposalTopbarDocumentTitle =
    proposalDocumentTitle.trim() ||
    proposalGeneratedDocumentTitle.trim() ||
    "Untitled proposal";
  const handleProposalTopbarTitleCommit = React.useCallback(
    async (nextTitle: string) => {
      const requestedTitle = nextTitle.trim();
      const fallbackTitle =
        proposalGeneratedDocumentTitle.trim() || "Untitled proposal";
      const normalizedTitle = requestedTitle || fallbackTitle;
      const nextManual = Boolean(requestedTitle);

      headingDirtyRef.current.subject = nextManual;
      setProposalDocumentTitle(normalizedTitle);
      setProposalDocumentTitleManual(nextManual);

      if (isSavedView) {
        setSavedProposalDocumentTitle(normalizedTitle);
        if (!openedSavedProposal) return;
        try {
          await persistOpenedSavedProposal({ title: normalizedTitle });
          lastSavedProposalTitleRef.current = normalizedTitle;
        } catch (saveError) {
          console.error("Failed to persist proposal title:", saveError);
          showToast("Save failed.", {
            variant: "error",
            description: "The proposal title could not be updated.",
          });
        }
        return;
      }

      try {
        const persistedId = await flushScheduledProposalSave(normalizedTitle);
        if (persistedId) {
          lastSavedProposalTitleRef.current = normalizedTitle;
        }
      } catch (saveError) {
        console.error("Failed to persist proposal title:", saveError);
        showToast("Save failed.", {
          variant: "error",
          description: "The proposal title changed locally but could not be saved.",
        });
      }
    },
    [
      flushScheduledProposalSave,
      isSavedView,
      openedSavedProposal,
      persistOpenedSavedProposal,
      proposalGeneratedDocumentTitle,
      showToast,
    ],
  );
  const handleNewProposalDocument = React.useCallback(() => {
    const hasPendingAutosave =
      composeSaveStatus === "saving" ||
      pendingQueuedComposeSnapshotRef.current !== null ||
      composeAutosaveTimeoutRef.current !== null;
    if (
      hasPendingAutosave &&
      typeof window !== "undefined" &&
      !window.confirm(
        "Autosave is still finishing. Start a new proposal anyway?",
      )
    ) {
      return;
    }
    handleNewProposalDraft();
  }, [composeSaveStatus, handleNewProposalDraft]);
  const handleDuplicateProposalDocument = React.useCallback(async () => {
    if (isSavedView) {
      await handleCopySavedProposalToDraft({ copyTitle: true });
      return;
    }

    const trimmedContent = proposalContent?.trim();
    if (!trimmedContent) {
      return;
    }

    const baseTitle =
      proposalDocumentTitle.trim() ||
      proposalGeneratedDocumentTitle.trim() ||
      "Untitled proposal";
    const copiedTitle = `Copy of ${baseTitle}`;
    const metadata = proposalPersistenceMetadata;

    cancelPendingComposeDraftSync();
    if (canPersistProposalState) {
      try {
        const createdId = (await createProposal({
          title: copiedTitle,
          content: trimmedContent,
          sections: [{ type: "text", content: trimmedContent }],
          status: "draft",
          metadata,
        })) as Id<"proposals">;
        setGeneratedProposalId(createdId);
        generatedProposalIdRef.current = createdId;
        lastPersistedComposeTokenRef.current = null;
        composeAutosavePrimedRef.current = false;
      } catch (duplicateError) {
        console.error("Failed to duplicate proposal:", duplicateError);
        showToast("Duplicate failed.", {
          variant: "error",
          description: "The proposal copy could not be created.",
        });
        return;
      }
    } else {
      setGeneratedProposalId(null);
      generatedProposalIdRef.current = null;
    }

    setProposalDocumentTitle(copiedTitle);
    setProposalDocumentTitleManual(true);
    setProposalLibraryStatus("draft");
    setProposalOutputMode("edit");
    setComposeSaveStatus("idle");
    const currentOutputDraft = readStoredProposalOutputDraft();
    writeStoredOutputDraft({
      proposalTemplateId: effectiveProposalTemplateId ?? fallbackProposalTemplateId,
      proposalVerbatiStyle: serializeVerbatiStyle(
        effectiveProposalStylePresetWithPalette,
      ),
      proposalStyleLinkMode: resolvedRuntimeStyleLinkMode,
      proposalStyleChoice,
      proposalApplicantName,
      proposalApplicantRole,
      proposalContactLine,
      proposalLetterDate,
      proposalRecipientDetails,
      proposalHeaderShowSender: proposalHeaderVisibility.showSender,
      proposalHeaderShowDate: proposalHeaderVisibility.showDate,
      proposalHeaderShowSubject: proposalHeaderVisibility.showSubject,
      proposalHeaderShowRecipient: proposalHeaderVisibility.showRecipient,
      proposalHeaderShowRecipientDetails:
        proposalHeaderVisibility.showRecipientDetails,
      proposalDocumentMeta,
      paletteOverride: proposalPaletteOverride,
      customAccentHex: proposalCustomAccentHex,
      templateBundleId: proposalTemplateBundleId,
      typographyOverride: effectiveProposalStylePresetWithPalette.typography,
      layoutOverride:
        effectiveProposalStylePresetWithPalette.layout === "swiss" ||
        effectiveProposalStylePresetWithPalette.layout === "editorial" ||
        effectiveProposalStylePresetWithPalette.layout === "modernist"
          ? effectiveProposalStylePresetWithPalette.layout
          : null,
      characterLimitMode: draftCharacterLimitMode ?? null,
      characterLimitValue: draftCharacterLimitValue ?? null,
      ...(currentOutputDraft ?? {}),
      proposalContent: trimmedContent,
      proposalType: proposalType ?? "cover_letter",
      proposalVoicePreset,
      proposalDocumentTitle: copiedTitle,
      proposalDocumentTitleManual: true,
      generatedProposalId: generatedProposalIdRef.current,
      proposalOutputMode: "edit" as const,
    });
    showToast("Duplicated.", {
      variant: "success",
      description: "A copy of this proposal is ready to edit.",
    });
    updateProposalRoute("compose");
  }, [
    canPersistProposalState,
    cancelPendingComposeDraftSync,
    createProposal,
    handleCopySavedProposalToDraft,
    isSavedView,
    proposalContent,
    proposalDocumentTitle,
    proposalGeneratedDocumentTitle,
    proposalPersistenceMetadata,
    proposalType,
    proposalVoicePreset,
    showToast,
    updateProposalRoute,
    writeStoredOutputDraft,
  ]);
  const proposalTopbarRegistration = React.useMemo(
    () => ({
      documentTitle: proposalTopbarDocumentTitle,
      titlePlaceholder: proposalGeneratedDocumentTitle || "Untitled proposal",
      onTitleCommit: handleProposalTopbarTitleCommit,
      documentState: proposalTopbarDocumentState,
      lengthLabel: proposalTopbarLengthLabel,
      hasProposalContent: isSavedView
        ? Boolean(openedSavedProposal && savedProposalContent?.trim())
        : Boolean(proposalContent?.trim()),
      hasJobContext: hasActiveProposalJobContext,
      exporting: proposalExportingFormat !== null,
      savedShareAvailable: Boolean(isSavedView && openedSavedProposal),
      onNewProposal: handleNewProposalDocument,
      onDuplicateProposal: () => {
        void handleDuplicateProposalDocument();
      },
      onDeleteProposal: () => {
        if (isSavedView) {
          void handleDeleteSavedProposal();
          return;
        }
        void handleDeleteOutput();
      },
      onCopyText: () => {
        void handleCopyOutput();
      },
      onExportPdf: (mode: "ats" | "styled") => {
        void handleExportProposalFile({
          target: isSavedView ? "saved" : "compose",
          format: "pdf",
          mode,
        });
      },
      onExportDocx: () => {
        void handleExportProposalFile({
          target: isSavedView ? "saved" : "compose",
          format: "docx",
        });
      },
      onShareSavedProposal: isSavedView
        ? () => {
            void handleShareSavedProposal();
          }
        : undefined,
    }),
    [
      handleCopyOutput,
      handleDeleteOutput,
      handleDeleteSavedProposal,
      handleDuplicateProposalDocument,
      handleExportProposalFile,
      handleNewProposalDocument,
      handleShareSavedProposal,
      handleProposalTopbarTitleCommit,
      hasActiveProposalJobContext,
      isSavedView,
      openedSavedProposal,
      proposalGeneratedDocumentTitle,
      proposalTopbarDocumentTitle,
      proposalContent,
      proposalExportingFormat,
      proposalTopbarDocumentState,
      proposalTopbarLengthLabel,
      savedProposalContent,
    ],
  );
  useRegisterProposalForgeTopbar(proposalTopbarRegistration);
  const hasMeaningfulProposalContent = Boolean(proposalContent?.trim());

  React.useEffect(() => {
    if (!hasMeaningfulProposalContent && proposalComposerMode === "ask") {
      setProposalComposerMode(null);
    }
  }, [hasMeaningfulProposalContent, proposalComposerMode]);

  const handleProposalRailLengthSelect = React.useCallback(
    (lengthId: "short" | "medium" | "long") => {
      const nextValue =
        lengthId === "short" ? 1200 : lengthId === "long" ? 3200 : 2000;
      draftCharacterLimitRef.current = {
        mode: "custom",
        value: nextValue,
      };
      cancelPendingComposeDraftSync();
      const nextDraft = {
        ...(composePreviewValues ?? readStoredProposalComposeDraft() ?? {}),
        characterLimitMode: "custom" as const,
        characterLimitValue: nextValue,
      };
      writeStoredProposalComposeDraft(nextDraft);
      setComposePreviewValues(nextDraft);
      setOutputSourceComposeDraft((current) => ({
        ...(current ?? nextDraft),
        characterLimitMode: "custom",
        characterLimitValue: nextValue,
      }));
      setComposeDraftInitialSeed((current) => ({
        ...(current ?? nextDraft),
        characterLimitMode: "custom",
        characterLimitValue: nextValue,
      }));
    },
    [cancelPendingComposeDraftSync, composePreviewValues],
  );
  const proposalRailTonePreset =
    composeToolbarVoicePreset ?? proposalVoicePreset;
  const proposalRailToneLabel = getVoicePresetDisplayLabel(
    proposalRailTonePreset ?? null,
  );
  const proposalRailToneOptions = React.useMemo(
    () => [
      {
        id: null,
        label: getVoicePresetDisplayLabel(null),
        description: "Auto from job + CV.",
        tone: "auto" as const,
        selected:
          proposalRailTonePreset === null ||
          proposalRailTonePreset === undefined,
      },
      {
        id: "engaging",
        label: getVoicePresetDisplayLabel("engaging"),
        description: "Warm and approachable.",
        tone: "warm" as const,
        selected: proposalRailTonePreset === "engaging",
      },
      {
        id: "signature",
        label: getVoicePresetDisplayLabel("signature"),
        description: "Natural and credible.",
        tone: "natural" as const,
        selected: proposalRailTonePreset === "signature",
      },
      {
        id: "expert",
        label: getVoicePresetDisplayLabel("expert"),
        description: "Formal and composed.",
        tone: "formal" as const,
        selected: proposalRailTonePreset === "expert",
      },
    ],
    [proposalRailTonePreset],
  );
  const proposalRailJobMatch = React.useMemo(
    () =>
      resolveProposalRailJobMatch(
        canonicalJobRecord?.matchRead ?? null,
        canonicalJobRecord?.matchReview ?? null,
      ),
    [canonicalJobRecord?.matchRead, canonicalJobRecord?.matchReview],
  );
  const proposalTemplatePanelItems = React.useMemo(
    () =>
      PROPOSAL_TEMPLATE_DEFINITIONS.map((template) => {
        const family =
          template.id === "director-letterhead"
            ? "director-letterhead"
            : template.id === "volk-letterhead"
              ? "volk-letterhead"
              : template.id === "film-foto-letterhead"
                ? "film-foto-letterhead"
                : template.id === "modernist_signal"
                  ? "bold"
                  : template.id === "quire_margin"
                    ? "letterpress"
                    : "minimal";
        return {
          id: template.id,
          label: template.name,
          description: template.description,
          meta: template.shortLabel,
          preview: { kind: "Cover letter" as const, family },
        };
      }),
    [],
  );
  const proposalTemplatePanelRegistration = React.useMemo(
    () => ({
      surface: "proposal" as const,
      title: translateUi(
        resolvedLanguage,
        "workspace.proposalTemplatesPanel",
      ),
      subtitle: "A4 · 21 × 29.7 cm",
      activeItemId: effectiveProposalTemplateId,
      items: proposalTemplatePanelItems,
      onSelect: (itemId: string) =>
        handleProposalLayoutSelect(resolveProposalTemplateId(itemId)),
    }),
    [
      effectiveProposalTemplateId,
      handleProposalLayoutSelect,
      proposalTemplatePanelItems,
      resolvedLanguage,
    ],
  );
  useRegisterForgeTemplates(proposalTemplatePanelRegistration);
  const proposalTemplatesOpen =
    templatePanelOpen && activeTemplateSurface === "proposal";
  const handleOpenProposalTemplates = React.useCallback(() => {
    if (proposalTemplatesOpen) {
      closeForgePanel();
      return;
    }
    openTemplateSurface("proposal");
  }, [closeForgePanel, openTemplateSurface, proposalTemplatesOpen]);
  const proposalHeadingFields = React.useMemo<ProposalHeadingField[]>(
    () => [
      {
        id: "proposal-subject",
        label: "Subject line",
        value: proposalDocumentTitle,
        placeholder: "Subject line",
        onChange: handleProposalDocumentTitleChange,
        onBlur: () => {
          void handleProposalDocumentCommit();
        },
      },
      {
        id: "applicant-name",
        label: "Full name",
        value: proposalApplicantName,
        placeholder: "Full name",
        onChange: handleProposalApplicantNameChange,
        onBlur: () => {
          void handleProposalDocumentCommit();
        },
      },
      {
        id: "applicant-role",
        label: "Target role",
        value: proposalApplicantRole,
        placeholder: "Target role",
        onChange: handleProposalApplicantRoleChange,
        onBlur: () => {
          void handleProposalDocumentCommit();
        },
      },
      {
        id: "applicant-company",
        label: "Applicant company / studio",
        value: proposalApplicantCompany,
        placeholder: "Studio, company, or practice",
        onChange: handleProposalApplicantCompanyChange,
        onBlur: () => {
          void handleProposalDocumentCommit();
        },
      },
      {
        id: "contact-email",
        label: "Email",
        value: proposalStructuredContactFields.email,
        placeholder: "email@example.com",
        onChange: (value) =>
          handleProposalStructuredContactChange("email", value),
        onBlur: () => {
          handleProposalContactLineCommit();
          void handleProposalDocumentCommit();
        },
      },
      {
        id: "contact-phone",
        label: "Phone",
        value: proposalStructuredContactFields.phone,
        placeholder: "+33 6 00 00 00 00",
        onChange: (value) =>
          handleProposalStructuredContactChange("phone", value),
        onBlur: () => {
          handleProposalContactLineCommit();
          void handleProposalDocumentCommit();
        },
      },
      {
        id: "contact-location",
        label: "City / location",
        value: proposalStructuredContactFields.location,
        placeholder: "Paris",
        onChange: (value) =>
          handleProposalStructuredContactChange("location", value),
        onBlur: () => {
          handleProposalContactLineCommit();
          void handleProposalDocumentCommit();
        },
      },
      {
        id: "contact-linkedin",
        label: "LinkedIn",
        value: proposalStructuredContactFields.linkedin,
        placeholder: "linkedin.com/in/name",
        onChange: (value) =>
          handleProposalStructuredContactChange("linkedin", value),
        onBlur: () => {
          handleProposalContactLineCommit();
          void handleProposalDocumentCommit();
        },
      },
      {
        id: "contact-website",
        label: "Website / portfolio",
        value: proposalStructuredContactFields.website,
        placeholder: "portfolio.example.com",
        onChange: (value) =>
          handleProposalStructuredContactChange("website", value),
        onBlur: () => {
          handleProposalContactLineCommit();
          void handleProposalDocumentCommit();
        },
      },
      ...(proposalStructuredContactFields.other
        ? [
            {
              id: "contact-other",
              label: "Other contact",
              value: proposalStructuredContactFields.other,
              placeholder: "Other contact information",
              onChange: (value: string) =>
                handleProposalStructuredContactChange("other", value),
              onBlur: () => {
                handleProposalContactLineCommit();
                void handleProposalDocumentCommit();
              },
            },
          ]
        : []),
      {
        id: "letter-date",
        label: "Date",
        value: proposalLetterDate,
        placeholder: "Date",
        onChange: handleProposalLetterDateChange,
        onBlur: () => {
          void handleProposalDocumentCommit();
        },
      },
      {
        id: "recipient-details",
        label: "Recipient information",
        value: proposalRecipientDetails,
        placeholder:
          "Hiring manager or team\nCompany name\nCompany city / remote",
        multiline: true,
        onChange: handleProposalRecipientDetailsChange,
        onBlur: () => {
          void handleProposalDocumentCommit();
        },
      },
      {
        id: "salutation",
        label: "Salutation",
        value: proposalSalutationValue,
        placeholder: "Dear Hiring Manager,",
        onChange: handleProposalSalutationChange,
        onBlur: () => {
          void handleProposalDocumentCommit();
        },
      },
    ],
    [
      handleProposalContactLineCommit,
      handleProposalDocumentCommit,
      handleProposalDocumentTitleChange,
      handleProposalApplicantNameChange,
      handleProposalApplicantRoleChange,
      handleProposalApplicantCompanyChange,
      handleProposalStructuredContactChange,
      handleProposalLetterDateChange,
      handleProposalRecipientDetailsChange,
      handleProposalSalutationChange,
      proposalApplicantName,
      proposalApplicantRole,
      proposalApplicantCompany,
      proposalStructuredContactFields,
      proposalDocumentTitle,
      proposalLetterDate,
      proposalRecipientDetails,
      proposalSalutationValue,
    ],
  );
  const proposalHeadingPanelRegistration = React.useMemo(
    () => ({
      surface: "proposal-heading" as const,
      title: translateUi(resolvedLanguage, "workspace.heading"),
      ariaLabel: translateUi(
        resolvedLanguage,
        "workspace.proposalHeadingPanel",
      ),
      renderContent: () => (
        <ProposalHeadingFields variableFields={proposalHeadingFields} />
      ),
    }),
    [proposalHeadingFields, resolvedLanguage],
  );
  useRegisterForgePanel(proposalHeadingPanelRegistration);
  const proposalHeadingOpen =
    templatePanelOpen && activeTemplateSurface === "proposal-heading";
  const handleOpenProposalHeading = React.useCallback(() => {
    if (proposalHeadingOpen) {
      closeForgePanel();
      return;
    }
    openTemplateSurface("proposal-heading");
  }, [closeForgePanel, openTemplateSurface, proposalHeadingOpen]);
  const proposalDesignPanelRegistration = React.useMemo(
    () => ({
      surface: "proposal-design" as const,
      title: translateUi(resolvedLanguage, "workspace.design"),
      ariaLabel: translateUi(
        resolvedLanguage,
        "workspace.proposalDesignPanel",
      ),
      renderContent: () => (
        <ProposalDesignFields
          proposalTemplateId={effectiveProposalTemplateId}
          onSelectProposalLayout={handleProposalLayoutSelect}
          stylePreset={effectiveProposalStylePresetWithPalette}
          styleTemplateBundleBaseStyle={effectiveProposalTemplateBundleBaseStyle}
          styleTemplateBundleId={proposalTemplateBundleId}
          onSelectStyleBundle={handleProposalStyleBundleSelect}
          onResetStyleBundle={handleProposalStyleBundleReset}
          onSelectStyleTypography={handleProposalTypographySelect}
          onSelectStylePalette={handleProposalPaletteSelect}
          onSelectStyleCustomAccent={handleProposalCustomAccentSelect}
          onClearStyleCustomAccent={handleProposalCustomAccentClear}
          signaturePresent={Boolean(
            effectiveProposalClosing?.enabled &&
              effectiveProposalClosing.signatureName,
          )}
          handwrittenSignatureAvailable={Boolean(
            proposalSignatureSettings.imageDataUrl,
          )}
          handwrittenSignatureEnabled={Boolean(
            effectiveProposalClosing?.handwrittenSignatureEnabled,
          )}
          onChooseSignature={handleChooseSignature}
          onToggleSignature={handleToggleSignature}
          onToggleHandwrittenSignature={handleToggleHandwrittenSignature}
        />
      ),
    }),
    [
      effectiveProposalClosing?.enabled,
      effectiveProposalClosing?.handwrittenSignatureEnabled,
      effectiveProposalClosing?.signatureName,
      effectiveProposalStylePresetWithPalette,
      effectiveProposalTemplateBundleBaseStyle,
      effectiveProposalTemplateId,
      handleChooseSignature,
      handleProposalCustomAccentClear,
      handleProposalCustomAccentSelect,
      handleProposalLayoutSelect,
      handleProposalPaletteSelect,
      handleProposalStyleBundleReset,
      handleProposalStyleBundleSelect,
      handleProposalTypographySelect,
      handleToggleHandwrittenSignature,
      handleToggleSignature,
      proposalSignatureSettings.imageDataUrl,
      proposalTemplateBundleId,
      resolvedLanguage,
    ],
  );
  useRegisterForgePanel(proposalDesignPanelRegistration);
  const proposalDesignOpen =
    templatePanelOpen && activeTemplateSurface === "proposal-design";
  const handleOpenProposalDesign = React.useCallback(() => {
    if (proposalDesignOpen) {
      closeForgePanel();
      return;
    }
    openTemplateSurface("proposal-design");
  }, [closeForgePanel, openTemplateSurface, proposalDesignOpen]);
  const shouldAnimateDesktopBriefTransition =
    !isSavedView && !isCompactComposeLayout;
  const shouldRenderBriefCard =
    showBriefCard || briefAnimationPhase === "brief-exit";
  const composeShellMotionClass =
    briefAnimationPhase === "form-exit"
      ? "dasti-proposal-compose-panel-stage--exiting"
      : briefAnimationPhase === "form-enter"
        ? "dasti-proposal-compose-panel-stage--entering"
        : "";
  const briefCardMotionClass =
    briefAnimationPhase === "brief-enter"
      ? "dasti-proposal-brief-stage--entering"
      : briefAnimationPhase === "brief-exit"
        ? "dasti-proposal-brief-stage--exiting"
        : "";
  const shouldHideComposeShell = !showComposePanel || showBriefCard;
  const coverLetterInlineImportState =
    React.useMemo<CoverLetterStartSurfaceImportState>(() => {
      const isBusy = coverLetterInlineImportPhase !== "idle";
      if (coverLetterInlineImportPhase === "preparing") {
        return {
          isBusy,
          label: "Preparing import",
          hint: "Checking the file.",
          fileName: coverLetterInlineImportFileName,
          error: coverLetterInlineImportError,
        };
      }
      if (coverLetterInlineImportPhase === "retrying") {
        return {
          isBusy,
          label: "Retrying import",
          hint: "Connection dropped. Retrying.",
          fileName: coverLetterInlineImportFileName,
          error: coverLetterInlineImportError,
        };
      }
      if (coverLetterInlineImportPhase === "finalizing") {
        return {
          isBusy,
          label: "Opening resume",
          hint: "Attaching to this cover letter.",
          fileName: coverLetterInlineImportFileName,
          error: coverLetterInlineImportError,
        };
      }
      if (coverLetterInlineImportPhase === "importing") {
        return {
          isBusy,
          label: "Importing",
          hint: "Trusted import. Takes a few seconds.",
          fileName: coverLetterInlineImportFileName,
          error: coverLetterInlineImportError,
        };
      }
      return {
        isBusy,
        label: "Import PDF",
        hint: "Upload a PDF or image.",
        fileName: coverLetterInlineImportFileName,
        error: coverLetterInlineImportError,
      };
    }, [
      coverLetterInlineImportError,
      coverLetterInlineImportFileName,
      coverLetterInlineImportPhase,
    ]);

  const clearBriefAnimationTimers = React.useCallback(() => {
    if (briefSwapTimerRef.current !== null) {
      window.clearTimeout(briefSwapTimerRef.current);
      briefSwapTimerRef.current = null;
    }
    if (briefSettleTimerRef.current !== null) {
      window.clearTimeout(briefSettleTimerRef.current);
      briefSettleTimerRef.current = null;
    }
  }, []);

  const scheduleBriefAnimationSettle = React.useCallback(
    (phase: Exclude<ProposalBriefAnimationPhase, "idle">) => {
      const settleDurationMs = readCssDurationMs(
        "--proposal-motion-brief-settle-duration",
        260,
      );
      if (briefSettleTimerRef.current !== null) {
        window.clearTimeout(briefSettleTimerRef.current);
      }
      setBriefAnimationPhase(phase);
      briefSettleTimerRef.current = window.setTimeout(() => {
        setBriefAnimationPhase("idle");
        briefSettleTimerRef.current = null;
      }, settleDurationMs);
    },
    [],
  );

  const triggerToolbarEnterTransition = React.useCallback(() => {
    const toolbarEnterDurationMs = readCssDurationMs(
      "--proposal-motion-toolbar-enter-duration",
      320,
    );
    if (toolbarTransitionTimerRef.current !== null) {
      window.clearTimeout(toolbarTransitionTimerRef.current);
    }
    setToolbarTransitionState("entering");
    toolbarTransitionTimerRef.current = window.setTimeout(() => {
      setToolbarTransitionState(null);
      toolbarTransitionTimerRef.current = null;
    }, toolbarEnterDurationMs);
  }, []);

  const focusComposeBrief = React.useCallback(() => {
    const focusField = (
      element: HTMLTextAreaElement | HTMLInputElement | null,
    ): boolean => {
      if (!element) {
        return false;
      }

      try {
        element.focus({ preventScroll: true });
      } catch {
        element.focus();
      }
      return true;
    };

    const jobDescriptionField =
      typeof document !== "undefined"
        ? (document.getElementById(
            "jobDescription",
          ) as HTMLTextAreaElement | null)
        : null;
    if (focusField(jobDescriptionField)) {
      return;
    }

    const jobTitleField =
      typeof document !== "undefined"
        ? (document.getElementById("jobTitle") as HTMLInputElement | null)
        : null;
    focusField(jobTitleField);
  }, []);
  const handleOpenComposeBrief = React.useCallback(() => {
    const briefSwapDurationMs = readCssDurationMs(
      "--proposal-motion-brief-swap-duration",
      160,
    );
    pendingComposeBriefFocusRef.current = true;
    setIsCvPickerOpen(false);
    if (!shouldAnimateDesktopBriefTransition || !showBriefCard) {
      clearBriefAnimationTimers();
      setBriefAnimationPhase("idle");
      setIsComposePanelVisible(true);
      setIsBriefExpanded(true);
      return;
    }

    clearBriefAnimationTimers();
    setBriefAnimationPhase("brief-exit");
    briefSwapTimerRef.current = window.setTimeout(() => {
      setIsComposePanelVisible(true);
      setIsBriefExpanded(true);
      scheduleBriefAnimationSettle("form-enter");
      briefSwapTimerRef.current = null;
    }, briefSwapDurationMs);
  }, [
    clearBriefAnimationTimers,
    scheduleBriefAnimationSettle,
    shouldAnimateDesktopBriefTransition,
    showBriefCard,
  ]);
  const handleToggleComposeBrief = React.useCallback(() => {
    const briefSwapDurationMs = readCssDurationMs(
      "--proposal-motion-brief-swap-duration",
      160,
    );
    if (!hasBriefContent) {
      return;
    }

    if (!shouldAnimateDesktopBriefTransition) {
      setIsBriefExpanded((current) => {
        const next = !current;
        pendingComposeBriefFocusRef.current = next;
        return next;
      });
      return;
    }

    clearBriefAnimationTimers();
    flushPendingComposeDraftSync();

    if (isBriefExpanded) {
      setBriefAnimationPhase("form-exit");
      briefSwapTimerRef.current = window.setTimeout(() => {
        setIsBriefExpanded(false);
        scheduleBriefAnimationSettle("brief-enter");
        briefSwapTimerRef.current = null;
      }, briefSwapDurationMs);
      return;
    }

    pendingComposeBriefFocusRef.current = true;
    setIsCvPickerOpen(false);
    setBriefAnimationPhase("brief-exit");
    briefSwapTimerRef.current = window.setTimeout(() => {
      setIsBriefExpanded(true);
      scheduleBriefAnimationSettle("form-enter");
      briefSwapTimerRef.current = null;
    }, briefSwapDurationMs);
  }, [
    clearBriefAnimationTimers,
    flushPendingComposeDraftSync,
    hasBriefContent,
    isBriefExpanded,
    scheduleBriefAnimationSettle,
    shouldAnimateDesktopBriefTransition,
  ]);
  const handleCollapseCompose = React.useCallback(() => {
    setIsComposePanelVisible(false);
    setIsCvPickerOpen(false);
    triggerToolbarEnterTransition();
  }, [triggerToolbarEnterTransition]);
  const handleRestoreCompose = React.useCallback(() => {
    setIsComposePanelVisible(true);
    triggerToolbarEnterTransition();
  }, [triggerToolbarEnterTransition]);
  const handleComposeGenerateControlChange = React.useCallback(
    (control: ProposalGenerateControl | null) => {
      if (!control) {
        composeGenerateTriggerRef.current = null;
        setComposeGenerateControl((current) =>
          current.label === "Generate" &&
          current.disabled &&
          current.state === "idle"
            ? current
            : {
                label: "Generate",
                disabled: true,
                state: "idle",
              },
        );
        return;
      }

      composeGenerateTriggerRef.current = control.trigger;
      setComposeGenerateControl((current) =>
        current.label === control.label &&
        current.disabled === control.disabled &&
        current.state === control.state
          ? current
          : {
              label: control.label,
              disabled: control.disabled,
              state: control.state,
            },
      );
    },
    [],
  );
  const handleGenerateFromCollapsedToolbar = React.useCallback(() => {
    composeGenerateTriggerRef.current?.();
  }, []);

  const handleRailJobOfferTextChange = React.useCallback(
    (value: string) => {
      setJobContextCleared(false);
      const nextDraft: StoredProposalComposeDraft = {
        ...(composePreviewValues ?? {}),
        jobTitle: composePreviewValues?.jobTitle ?? "",
        jobDescription: value,
        sourceUrl: composePreviewValues?.sourceUrl ?? null,
        platform: composePreviewValues?.platform ?? null,
        proposalType:
          proposalType ?? composePreviewValues?.proposalType ?? "cover_letter",
        voicePreset:
          proposalVoicePreset ?? composePreviewValues?.voicePreset ?? null,
        characterLimitMode: draftCharacterLimitMode ?? undefined,
        characterLimitValue: draftCharacterLimitValue ?? undefined,
      };
      setComposePreviewValues(nextDraft);
      setOutputSourceComposeDraft(nextDraft);
      setComposeDraftInitialSeed(nextDraft);
      writeStoredProposalComposeDraft(nextDraft);
    },
    [
      composePreviewValues,
      draftCharacterLimitMode,
      draftCharacterLimitValue,
      proposalType,
      proposalVoicePreset,
    ],
  );

  const handleRailJobOfferTextCommit = React.useCallback(() => {
    setComposeFormInstanceKey((currentKey) => currentKey + 1);
  }, []);

  const handleOpenJobsFromRail = React.useCallback(() => {
    setIsTemplateJobContextEmptyStateDismissed(true);
    openTemplateSurface("jobs", {
      mode: isWideEnoughForDockedForgePanel ? "docked" : "overlay",
    });
  }, [isWideEnoughForDockedForgePanel, openTemplateSurface]);
  const handleOpenDraftFromStage = React.useCallback(() => {
    setProposalComposerMode(null);
    openTemplateSurface("proposal-draft", {
      mode: isWideEnoughForDockedForgePanel ? "docked" : "overlay",
    });
  }, [isWideEnoughForDockedForgePanel, openTemplateSurface]);
  const handleOpenCvsFromDraft = React.useCallback(() => {
    openTemplateSurface("cvs", {
      mode: isWideEnoughForDockedForgePanel ? "docked" : "overlay",
    });
  }, [isWideEnoughForDockedForgePanel, openTemplateSurface]);
  const handleClearCvFromDraft = React.useCallback(() => {
    if (proposalContent?.trim()) {
      setStagedProposalCvSelection({
        id: null,
        title: translateUi(resolvedLanguage, "workspace.noCv"),
      });
      openTemplateSurface("proposal-draft");
      showToast(translateUi(resolvedLanguage, "workspace.cvRemovalStaged"), {
        variant: "success",
        description: translateUi(
          resolvedLanguage,
          "workspace.letterUnchangedRegenerate",
        ),
      });
      return;
    }

    handleAttachedCvChange(null);
  }, [
    handleAttachedCvChange,
    openTemplateSurface,
    proposalContent,
    resolvedLanguage,
    showToast,
  ]);
  const handleReturnToDraftFromPasteJob = React.useCallback(() => {
    openTemplateSurface("proposal-draft");
  }, [openTemplateSurface]);
  const proposalDraftOpen =
    templatePanelOpen && activeTemplateSurface === "proposal-draft";
  const proposalDraftJobContextKind = React.useMemo<"empty" | "saved" | "pasted">(() => {
    if (jobContextCleared) {
      return "empty";
    }
    if (canonicalJobId || canonicalJobRecord?.title?.trim()) {
      return "saved";
    }
    if (hasActiveProposalJobContext) {
      return "pasted";
    }
    return "empty";
  }, [
    canonicalJobId,
    canonicalJobRecord?.title,
    hasActiveProposalJobContext,
    jobContextCleared,
  ]);
  const proposalDraftJobMeta = React.useMemo(
    () =>
      [
        canonicalJobRecord?.company?.trim() ||
          proposalHeaderSourceSummary.company,
        briefSourcePlatform,
        proposalHeaderSourceSummary.location,
      ]
        .filter(Boolean)
        .join(" · ") || null,
    [
      briefSourcePlatform,
      canonicalJobRecord?.company,
      proposalHeaderSourceSummary.company,
      proposalHeaderSourceSummary.location,
    ],
  );
  const stagedProposalSourceSummary = React.useMemo(
    () =>
      stagedProposalSourceDraft
        ? buildProposalSourceSummary({
            jobTitle: stagedProposalSourceDraft.jobTitle ?? "",
            jobDescription: stagedProposalSourceDraft.jobDescription ?? "",
          })
        : null,
    [stagedProposalSourceDraft],
  );
  const stagedProposalSourceTitle =
    stagedProposalSourceDraft?.jobTitle?.trim() ||
    stagedProposalSourceSummary?.role ||
    null;
  const stagedProposalSourceMeta =
    stagedProposalSourceDraft
      ? [
          stagedProposalSourceSummary?.company,
          stagedProposalSourceDraft.platform,
          stagedProposalSourceSummary?.location,
        ]
          .filter(Boolean)
          .join(" · ") || null
      : null;
  const stagedProposalSourcePreview =
    stagedProposalSourceDraft?.jobDescription?.trim() || null;
  const stagedProposalCvTitle =
    stagedProposalCvSelection?.title?.trim() ||
    (stagedProposalCvSelection ? "No CV" : null);
  const proposalDraftPanelRegistration = React.useMemo(
    () => ({
      surface: "proposal-draft" as const,
      title: translateUi(resolvedLanguage, "workspace.draftProposalShort"),
      ariaLabel: translateUi(
        resolvedLanguage,
        "workspace.proposalDraftPanel",
      ),
      renderContent: () => (
        <ProposalDraftDrawer
          jobTitle={briefJobTitle}
          jobMeta={proposalDraftJobMeta}
          jobSummary={proposalRailJobSummary}
          jobContextKind={proposalDraftJobContextKind}
          stagedJobTitle={stagedProposalSourceTitle}
          stagedJobMeta={stagedProposalSourceMeta}
          stagedJobSummary={stagedProposalSourcePreview}
          stagedCvTitle={stagedProposalCvTitle}
          sourceCvTitle={attachedCvDisplayTitle}
          proposalTypeLabel={
            proposalType ? formatProposalTypeLabel(proposalType) : "Letter"
          }
          proposalTypeOptions={proposalTypeOptions}
          onSelectProposalType={handleProposalTypeSelect}
          toneLabel={proposalRailToneLabel}
          toneOptions={proposalRailToneOptions}
          onSelectTone={(toneId) => {
            handleToolbarVoicePresetChange(
              toneId === "engaging" || toneId === "signature" || toneId === "expert"
                ? toneId
                : null,
            );
          }}
          generateLabel={composeGenerateControl.label}
          generateDisabled={
            composeGenerateControl.disabled || loading || isLoadingHandoff
          }
          generateState={composeGenerateControl.state}
          hasExistingDraft={hasMeaningfulProposalContent}
          askReviewReady={railAskAiReview.status === "ready"}
          onGenerateDraft={handleGenerateFromCollapsedToolbar}
          onCancelStagedSource={handleCancelStagedProposalSource}
          onOpenJobs={handleOpenJobsFromRail}
          onOpenPasteJob={handleOpenPasteJobFromDraft}
          onClearJobContext={
            hasActiveProposalJobContext ? handleClearJobContext : undefined
          }
          onOpenCvs={handleOpenCvsFromDraft}
          onClearCv={handleClearCvFromDraft}
        />
      ),
    }),
    [
      attachedCvDisplayTitle,
      attachedCvId,
      briefJobTitle,
      composeGenerateControl.disabled,
      composeGenerateControl.label,
      composeGenerateControl.state,
      formatProposalTypeLabel,
      handleGenerateFromCollapsedToolbar,
      handleCancelStagedProposalSource,
      handleOpenCvsFromDraft,
      handleClearCvFromDraft,
      handleOpenJobsFromRail,
      handleOpenPasteJobFromDraft,
      handleClearJobContext,
      handleProposalTypeSelect,
      handleToolbarVoicePresetChange,
      hasActiveProposalJobContext,
      hasMeaningfulProposalContent,
      isLoadingHandoff,
      loading,
      proposalDraftJobMeta,
      proposalDraftJobContextKind,
      proposalRailJobSummary,
      proposalRailToneLabel,
      proposalRailToneOptions,
      proposalType,
      proposalTypeOptions,
      resolvedLanguage,
      stagedProposalSourceMeta,
      stagedProposalSourcePreview,
      stagedProposalSourceTitle,
      stagedProposalCvTitle,
      railAskAiReview.status,
    ],
  );
  useRegisterForgePanel(proposalDraftPanelRegistration);
  const proposalPasteJobPanelRegistration = React.useMemo(
    () => ({
      surface: "proposal-paste-job" as const,
      title: translateUi(resolvedLanguage, "jobs.pasteJobOffer"),
      ariaLabel: translateUi(resolvedLanguage, "jobs.pasteJobOffer"),
      backAction: {
        ariaLabel: translateUi(resolvedLanguage, "workspace.backToDraft"),
        onSelect: handleReturnToDraftFromPasteJob,
      },
      renderContent: () => (
        <ProposalPasteJobDrawer
          value={composePreviewValues?.jobDescription ?? ""}
          onChange={handleRailJobOfferTextChange}
          onCommit={handleRailJobOfferTextCommit}
          onDone={handleReturnToDraftFromPasteJob}
        />
      ),
    }),
    [
      composePreviewValues?.jobDescription,
      handleRailJobOfferTextChange,
      handleRailJobOfferTextCommit,
      handleReturnToDraftFromPasteJob,
      resolvedLanguage,
    ],
  );
  useRegisterForgePanel(proposalPasteJobPanelRegistration);
  const handleDismissTemplateJobContext = React.useCallback(() => {
    setIsTemplateJobContextEmptyStateDismissed(true);
  }, []);

  React.useEffect(() => {
    if (!canCollapseComposePanel && !isComposePanelVisible) {
      setIsComposePanelVisible(true);
    }
  }, [canCollapseComposePanel, isComposePanelVisible]);

  React.useEffect(() => {
    if (!isBriefExpanded || !pendingComposeBriefFocusRef.current) {
      return;
    }

    if (shouldAnimateDesktopBriefTransition && briefAnimationPhase !== "idle") {
      return;
    }

    pendingComposeBriefFocusRef.current = false;
    if (typeof window !== "undefined" && window.requestAnimationFrame) {
      window.requestAnimationFrame(() => {
        focusComposeBrief();
      });
      return;
    }

    focusComposeBrief();
  }, [
    briefAnimationPhase,
    focusComposeBrief,
    isBriefExpanded,
    shouldAnimateDesktopBriefTransition,
  ]);

  React.useEffect(() => {
    return () => {
      clearBriefAnimationTimers();
      if (toolbarTransitionTimerRef.current !== null) {
        window.clearTimeout(toolbarTransitionTimerRef.current);
        toolbarTransitionTimerRef.current = null;
      }
    };
  }, [clearBriefAnimationTimers]);

  React.useEffect(() => {
    if (
      !shouldAnimateDesktopBriefTransition &&
      briefAnimationPhase !== "idle"
    ) {
      clearBriefAnimationTimers();
      setBriefAnimationPhase("idle");
    }
  }, [
    briefAnimationPhase,
    clearBriefAnimationTimers,
    shouldAnimateDesktopBriefTransition,
  ]);

  React.useEffect(() => {
    const didShowBriefCard = showBriefCard && !previousShowBriefCardRef.current;
    previousShowBriefCardRef.current = showBriefCard;
    if (
      shouldAnimateDesktopBriefTransition &&
      didShowBriefCard &&
      briefAnimationPhase === "idle"
    ) {
      scheduleBriefAnimationSettle("brief-enter");
    }
  }, [
    briefAnimationPhase,
    scheduleBriefAnimationSettle,
    shouldAnimateDesktopBriefTransition,
    showBriefCard,
  ]);

  const shouldShowSavedList = isSavedView && !selectedProposalId;
  const proposalDocumentStageLabels = React.useMemo<ProposalDocumentStageLabels>(
    () => ({
      proposalToolbar: translateUi(resolvedLanguage, "workspace.proposalToolbar"),
      proposalViewMode: translateUi(
        resolvedLanguage,
        "workspace.proposalViewMode",
      ),
      documentControls: translateUi(
        resolvedLanguage,
        "workspace.documentControls",
      ),
      switchToPreview: translateUi(
        resolvedLanguage,
        "workspace.switchToPreview",
      ),
      switchToEdit: translateUi(resolvedLanguage, "workspace.switchToEdit"),
      edit: translateUi(resolvedLanguage, "workspace.edit"),
      preview: translateUi(resolvedLanguage, "workspace.preview"),
      editProposal: translateUi(resolvedLanguage, "workspace.editProposal"),
      previewProposal: translateUi(
        resolvedLanguage,
        "workspace.previewProposal",
      ),
      heading: translateUi(resolvedLanguage, "workspace.heading"),
      design: translateUi(resolvedLanguage, "workspace.design"),
      templates: translateUi(resolvedLanguage, "workspace.templates"),
      proposalUndoRedoActions: translateUi(
        resolvedLanguage,
        "workspace.proposalUndoRedoActions",
      ),
      undo: translateUi(resolvedLanguage, "workspace.undo"),
      redo: translateUi(resolvedLanguage, "workspace.redo"),
      proposalLibraryActions: translateUi(
        resolvedLanguage,
        "workspace.proposalLibraryActions",
      ),
      saveProposalToLibrary: translateUi(
        resolvedLanguage,
        "workspace.saveProposalToLibrary",
      ),
      saveToLibrary: translateUi(resolvedLanguage, "workspace.saveToLibrary"),
      deleteDraft: translateUi(resolvedLanguage, "workspace.deleteDraft"),
      primaryWritingAction: translateUi(
        resolvedLanguage,
        "workspace.primaryWritingAction",
      ),
      draftProposal: translateUi(resolvedLanguage, "workspace.draftProposal"),
      draftProposalShort: translateUi(
        resolvedLanguage,
        "workspace.draftProposalShort",
      ),
      ask: translateUi(resolvedLanguage, "workspace.ask"),
    }),
    [resolvedLanguage],
  );

  return (
    <div
      className="dasti-page-scroll"
      style={{
        minWidth: 0,
      }}
    >
      <div
        className={
          shouldShowSavedList
            ? "dasti-page-shell dasti-page-shell--proposal-saved"
            : "dasti-page-shell dasti-page-shell--proposal-forge"
        }
        style={
          {
            "--page-shell-max-width": shouldShowSavedList ? "100%" : "100%",
            "--page-shell-gap": shouldShowSavedList
              ? "var(--layout-panel-stack)"
              : "0px",
            "--page-shell-pad-top": shouldRenderColdStartInlineOnly
              ? "0px"
              : "var(--space-2)",
            "--page-shell-pad-bottom": shouldRenderColdStartInlineOnly
              ? "0px"
              : "0px",
            "--page-shell-pad-top-mobile": shouldRenderColdStartInlineOnly
              ? "0px"
              : "var(--space-2)",
            "--page-shell-pad-bottom-mobile": shouldRenderColdStartInlineOnly
              ? "0px"
              : "0px",
            "--page-shell-pad-inline": shouldRenderColdStartInlineOnly
              ? "0px"
              : "var(--space-4)",
            "--page-shell-pad-inline-mobile": shouldRenderColdStartInlineOnly
              ? "0px"
              : "var(--space-4)",
          } as React.CSSProperties
        }
      >
        {shouldShowSavedList ? (
          <section aria-hidden={false}>
            <ProposalsList
              selectedProposalId={selectedProposalId}
              onSelectedProposalIdChange={(id) =>
                updateProposalRoute("saved", id)
              }
              onOpenDraftProposal={(id) => {
                const params = new URLSearchParams(search);
                params.delete("view");
                params.delete("id");
                params.set("draftId", id);
                void navigate(`/proposal?${params.toString()}`);
              }}
              signatureSettings={proposalSignatureSettings}
            />
          </section>
        ) : (
          <>
            <div className="dasti-flow" style={proposalWorkbenchFrameStyle}>
              <section aria-hidden={false}>
                {shouldRenderColdStartInlineOnly ? (
                  <>
                    <CoverLetterStartSurface
                      hasResumes={hasLocalResumes}
                      showExtensionHelper={showExtensionHelper}
                      initialRoute={
                        proposalJobImportFocus === "supported-sites"
                          ? "job"
                          : "root"
                      }
                      importResumeState={coverLetterInlineImportState}
                      onBackToQuickStart={
                        proposalEntryIntent === "cover-letter-start"
                          ? handleReturnToQuickStart
                          : null
                      }
                      onClose={handleDismissCoverLetterStart}
                      onUseResume={handleOpenStartSurfaceCvPicker}
                      onImportResume={handleImportResumeIntoCoverLetter}
                      onPasteJobOffer={handlePasteJobOffer}
                      onUseChromeExtension={handleRevealExtensionHelper}
                    />
                    <input
                      ref={coverLetterInlineFileInputRef}
                      type="file"
                      accept={TRUSTED_MISTRAL_FILE_INPUT_ACCEPT}
                      onChange={handleCoverLetterInlineImportChange}
                      style={{ display: "none" }}
                      aria-hidden="true"
                    />
                  </>
                ) : (
                  <div
                    className="dasti-proposal-skeleton-forge"
                    data-forge-drawer-docked={
                      isForgeDrawerDockedDesktop ? "true" : undefined
                    }
                    data-forge-drawer-rail-collapsed={
                      shouldAutoCollapseProposalRailForDockedDrawer
                        ? "true"
                        : undefined
                    }
                    style={
                      {
                        "--proposal-paper-visual-inline-size":
                          proposalPaperVisualInlineSize,
                        "--proposal-workspace-stage-inline-size":
                          "var(--proposal-paper-visual-inline-size)",
                        "--proposal-workspace-rail-inline-size": "360px",
                        "--grid-columns": isForgeDrawerDockedDesktop && showComposeGridColumn
                          ? "minmax(0, 1fr) var(--proposal-workspace-rail-inline-size)"
                          : isCompactComposeLayout
                            ? "minmax(0, 1fr)"
                            : showComposeGridColumn
                              ? "minmax(0, var(--proposal-workspace-stage-inline-size)) var(--proposal-workspace-rail-inline-size)"
                              : "minmax(0, 1fr)",
                        "--grid-gap": showComposeGridColumn
                          ? "var(--layout-card-grid)"
                          : "0px",
                        "--grid-align": "start",
                        "--grid-justify": isForgeDrawerDockedDesktop
                          ? "stretch"
                          : shouldAutoCollapseProposalRailForDockedDrawer
                            ? "center"
                            : !isCompactComposeLayout && showComposeGridColumn
                              ? "center"
                              : shouldCenterOutputStage
                                ? "center"
                                : "start",
                      } as ProposalWorkspaceCssVars
                    }
                  >
                    <ComposerDrawer
                      open={proposalComposerMode === "ask"}
                      onOpenChange={(open) => {
                        if (!open && railAskAiBusy) return;
                        if (!open) setProposalComposerMode(null);
                      }}
                      title="Ask"
                      titleHidden
                      ariaLabel="Ask"
                      className="dasti-composer-drawer--stage dasti-composer-drawer--proposal"
                    >
                      <ProposalRail
                        jobTitle={briefJobTitle}
                        company={
                          canonicalJobRecord?.company?.trim() ||
                          proposalHeaderSourceSummary.company ||
                          null
                        }
                        location={proposalHeaderSourceSummary.location || null}
                        jobHref={proposalJobHref}
                        sourceLabel={briefSourcePlatform}
                        sourceUrl={briefSourceUrl}
                        jobSummary={proposalRailJobSummary}
                        jobMatch={proposalRailJobMatch}
                        sourceCvTitle={attachedCvDisplayTitle}
                        sourceCvMeta={
                          attachedCvId ? "Attached to this draft" : null
                        }
                        proposalTypeLabel={
                          proposalType
                            ? formatProposalTypeLabel(proposalType)
                            : "Letter"
                        }
                        proposalTypeOptions={proposalTypeOptions}
                        onSelectProposalType={handleProposalTypeSelect}
                        toneLabel={proposalRailToneLabel}
                        toneOptions={proposalRailToneOptions}
                        onSelectTone={(toneId) => {
                          handleToolbarVoicePresetChange(
                            toneId === "engaging" ||
                              toneId === "signature" ||
                              toneId === "expert"
                              ? toneId
                              : null,
                          );
                        }}
                        lengthOptions={proposalRailLengthOptions}
                        onSelectLength={handleProposalRailLengthSelect}
                        proposalTemplateId={effectiveProposalTemplateId}
                        onSelectProposalLayout={handleProposalLayoutSelect}
                        stylePreset={effectiveProposalStylePresetWithPalette}
                        styleTemplateBundleBaseStyle={
                          effectiveProposalTemplateBundleBaseStyle
                        }
                        styleTemplateBundleId={proposalTemplateBundleId}
                        onSelectStyleBundle={handleProposalStyleBundleSelect}
                        onResetStyleBundle={handleProposalStyleBundleReset}
                        onSelectStyleTypography={handleProposalTypographySelect}
                        onSelectStylePalette={handleProposalPaletteSelect}
                        onSelectStyleFixedAccent={
                          handleProposalFixedAccentSelect
                        }
                        onSelectStyleCustomAccent={
                          handleProposalCustomAccentSelect
                        }
                        onClearStyleCustomAccent={
                          handleProposalCustomAccentClear
                        }
                        signaturePresent={Boolean(
                          effectiveProposalClosing?.enabled &&
                            effectiveProposalClosing.signatureName,
                        )}
                        handwrittenSignatureAvailable={Boolean(
                          proposalSignatureSettings.imageDataUrl,
                        )}
                        handwrittenSignatureEnabled={Boolean(
                          effectiveProposalClosing?.handwrittenSignatureEnabled,
                        )}
                        onChooseSignature={handleChooseSignature}
                        onToggleSignature={handleToggleSignature}
                        onToggleHandwrittenSignature={
                          handleToggleHandwrittenSignature
                        }
                        aiStream={
                          shouldShowProposalAiStream ? (
                            <ProposalAIStream
                              loading={
                                loading ||
                                isLoadingHandoff ||
                                composeGenerateControl.state === "loading"
                              }
                              error={error}
                              statusMessage={statusMessage}
                            />
                          ) : null
                        }
                        cvOptions={sourceCvOptions}
                        onSelectCv={handleAttachedCvChange}
                        onClearCv={() => handleAttachedCvChange(null)}
                        onCreateCv={handleCreateCvInForge}
                        onImportCv={handleImportCvInForge}
                        jobOfferText={
                          composePreviewValues?.jobDescription ?? ""
                        }
                        onJobOfferTextChange={handleRailJobOfferTextChange}
                        onJobOfferTextCommit={handleRailJobOfferTextCommit}
                        onOpenJobs={handleOpenJobsFromRail}
                        onOpenCvs={handleOpenCvsFromDraft}
                        onClearJobContext={
                          hasActiveProposalJobContext
                            ? handleClearJobContext
                            : undefined
                        }
                        generateLabel={composeGenerateControl.label}
                        generateDisabled={
                          composeGenerateControl.disabled ||
                          loading ||
                          isLoadingHandoff
                        }
                        generateState={composeGenerateControl.state}
                        onGenerateDraft={handleGenerateFromCollapsedToolbar}
                        hasExistingDraft={hasMeaningfulProposalContent}
                        askAiValue={railAskAiValue}
                        askAiBusy={railAskAiBusy}
                        askAiDisabled={!hasMeaningfulProposalContent}
                        askAiPlaceholder="Ask for a change"
                        askAiHint={
                          hasMeaningfulProposalContent
                            ? "Apply change"
                            : "Draft first"
                        }
                        askAiReview={railAskAiReviewModel}
                        onAskAiChange={handleRailAskAiChange}
                        onAskAiSubmit={() => {
                          void handleRailAskAiSubmit();
                        }}
                        onAskAiApply={handleRailAskAiApply}
                        onAskAiDiscard={handleRailAskAiDiscard}
                        onAskAiUndo={handleRailAskAiUndo}
                        activeTab="ask"
                        onActiveTabChange={(tab) => {
                          if (tab === "ask") setProposalComposerMode("ask");
                        }}
                        hideTabs
                      />
                    </ComposerDrawer>

                    <div
                      className="dasti-proposal-hidden-implementation"
                      hidden
                      aria-hidden="true"
                    >
                      {isLoadingHandoff ? null : (
                        <ProposalInputForm
                          key={composeFormInstanceKey}
                          onStart={handleProposalStart}
                          onStop={handleProposalStop}
                          onSubmit={handleProposalSubmit}
                          onError={handleProposalError}
                          onValuesChange={handleProposalFormValuesChange}
                          onActiveCvChange={handleAttachedCvChange}
                          activeCvId={
                            stagedProposalCvSelection
                              ? stagedProposalCvSelection.id
                              : attachedCvId
                          }
                          prefill={prefill}
                          cvPickerOpen={isCvPickerOpen}
                          onCvPickerOpenChange={setIsCvPickerOpen}
                          cvPickerRequestKey={cvPickerRequestKey}
                          suppressCvPicker
                          externalVoicePreset={composeToolbarVoicePreset}
                          externalModelType={composeToolbarModelType}
                          externalCharacterLimitMode={draftCharacterLimitMode}
                          externalCharacterLimitValue={draftCharacterLimitValue}
                          headerLabel={null}
                          initialComposeDraft={composeDraftInitialSeed}
                          externalComposeDraft={
                            stagedProposalSourceDraft ?? composePreviewValues
                          }
                          sourceUrl={
                            stagedProposalSourceDraft?.sourceUrl ?? briefSourceUrl
                          }
                          sourcePlatform={
                            stagedProposalSourceDraft?.platform ??
                            briefSourcePlatform
                          }
                          canonicalJobId={canonicalJobId}
                          jobSourceLanguage={
                            stagedSourceJobRecord?.sourceLanguage ??
                            canonicalJobRecord?.sourceLanguage ??
                            null
                          }
                          onGenerateControlChange={
                            handleComposeGenerateControlChange
                          }
                          headerAction={null}
                        />
                      )}
                      <input
                        ref={coverLetterInlineFileInputRef}
                        type="file"
                        accept={TRUSTED_MISTRAL_FILE_INPUT_ACCEPT}
                        onChange={handleCoverLetterInlineImportChange}
                        style={{ display: "none" }}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="dasti-flow dasti-proposal-skeleton-forge__stage">
                      <ProposalDocumentStage
                        mode={proposalOutputMode}
                        hasProposalContent={hasMeaningfulProposalContent}
                        labels={proposalDocumentStageLabels}
                        styleControl={null}
                        headingOpen={proposalHeadingOpen}
                        onOpenHeading={handleOpenProposalHeading}
                        designOpen={proposalDesignOpen}
                        onOpenDesign={handleOpenProposalDesign}
                        templatesOpen={proposalTemplatesOpen}
                        onOpenTemplates={handleOpenProposalTemplates}
                        onOpenDraft={
                          hasMeaningfulProposalContent
                            ? undefined
                            : handleOpenDraftFromStage
                        }
                        onOpenAsk={
                          hasMeaningfulProposalContent
                            ? () => {
                                closeForgePanel();
                                setProposalComposerMode("ask");
                              }
                            : undefined
                        }
                        composerMode={
                          proposalDraftOpen ? "draft" : proposalComposerMode
                        }
                        sourceJobLinked={hasActiveProposalJobContext}
                        sourceCvSelected={Boolean(attachedCvId)}
                        proposalLinked={hasMeaningfulProposalContent}
                        matchReviewAccepted={resolveSafeSendMatchReviewAccepted(
                          canonicalJobRecord,
                        )}
                        hasUnresolvedImportIssues={resolveSafeSendImportIssues(
                          attachedCvId,
                        )}
                        hasPlaceholderText={/(\[[^\]]+\]|\blorem\b|\{\{[^}]+\}\})/i.test(
                          [
                            proposalContent,
                            proposalDocumentTitle,
                            proposalRecipientDetails,
                            proposalSalutationValue,
                            proposalApplicantName,
                            proposalContactLine,
                          ]
                            .filter(Boolean)
                            .join("\n"),
                        )}
                        finalExportReviewed={Boolean(
                          hasMeaningfulProposalContent &&
                            proposalOutputMode === "preview",
                        )}
                        onModeChange={handleProposalOutputModeChange}
                        reserveToolbarBeforeContent={
                          shouldShowTemplateJobContextEmptyState
                        }
                      >
                        {shouldShowTemplateJobContextEmptyState ? (
                          <section
                            className="dasti-proposal-template-job-empty"
                            aria-label="Job context"
                          >
                            <div className="dasti-proposal-template-job-empty__head">
                              <p>Load a job to tailor this letter.</p>
                              <button
                                type="button"
                                className="dasti-proposal-template-job-empty__dismiss"
                                onClick={handleDismissTemplateJobContext}
                                aria-label="Hide job prompt"
                                data-toolbar-tooltip="Hide"
                              >
                                <X size={14} strokeWidth={1.8} aria-hidden="true" />
                              </button>
                            </div>
                            <div className="dasti-proposal-template-job-empty__actions">
                              <button
                                type="button"
                                className="dasti-button dasti-button--secondary dasti-button--sm"
                                onClick={handleOpenJobsFromRail}
                              >
                                Use saved job
                              </button>
                              <Menu
                                ariaLabel="Job boards"
                                align="start"
                                sections={templateJobSiteMenuSections}
                                trigger={
                                  <button
                                    type="button"
                                    className="dasti-button dasti-button--secondary dasti-button--sm"
                                  >
                                    Job boards
                                  </button>
                                }
                              />
                            </div>
                          </section>
                        ) : null}
                        <div
                          style={
                            {
                              ...stackedCardWidthStyle,
                              "--document-viewer-shell-inline-size":
                                "var(--proposal-workspace-output-shell-inline-size)",
                            } as React.CSSProperties
                          }
                          className="dasti-proposal-paper-stage dasti-proposal-output-shell dasti-proposal-output-shell--workspace"
                        >
                          <ProposalDisplay
                            proposalContent={proposalContent}
                            loading={loading}
                            error={error}
                            statusMessage={statusMessage}
                            errorDetail={errorDetail}
                            proposalType={proposalType}
                            voicePreset={proposalVoicePreset}
                            templateId={
                              proposalRenderMetadata?.templateId ??
                              effectiveProposalTemplateId ??
                              fallbackProposalTemplateId
                            }
                            stylePreset={
                              effectiveProposalStylePresetWithPalette
                            }
                            signatureSettings={proposalSignatureSettings}
                            closing={effectiveProposalClosing}
                            railTitle={sanitizeProposalApplicantName(
                              proposalApplicantName,
                            )}
                            railMeta={proposalApplicantRole}
                            contactLine={proposalContactLine}
                            letterDate={proposalLetterDate}
                            recipientDetails={proposalRecipientDetails}
                            salutationValue={proposalSalutationValue || null}
                            applicantHeader={proposalDisplayApplicantHeader}
                            headerVisibility={proposalHeaderVisibility}
                            fallbackInfo={fallbackInfo}
                            documentTitle={
                              proposalDocumentTitle ||
                              buildProfessionalApplicationSubject({
                                jobTitle: composePreviewValues?.jobTitle ?? "",
                                jobDescription:
                                  composePreviewValues?.jobDescription ?? "",
                                proposalType,
                              })
                            }
                            documentMeta={
                              proposalDocumentMeta ||
                              proposalDisplayApplicantHeader.email ||
                              null
                            }
                            mode={proposalOutputMode}
                            onModeChange={handleProposalOutputModeChange}
                            editorAiJobContext={proposalEditorAiJobContext}
                            showDocumentCaption={false}
                            documentTitleEditable={
                              proposalOutputMode === "edit"
                            }
                            onDocumentTitleChange={
                              handleProposalDocumentTitleChange
                            }
                            onDocumentTitleCommit={() => {
                              void handleProposalDocumentCommit();
                            }}
                            documentTitlePlaceholder={buildProfessionalApplicationSubject(
                              {
                                jobTitle: composePreviewValues?.jobTitle ?? "",
                                jobDescription:
                                  composePreviewValues?.jobDescription ?? "",
                                proposalType,
                              },
                            )}
                            onRailTitleChange={
                              handleProposalApplicantNameChange
                            }
                            onRailMetaChange={
                              handleProposalApplicantRoleChange
                            }
                            contactLineEditable={proposalOutputMode === "edit"}
                            onContactLineChange={
                              handleProposalContactLineChange
                            }
                            onContactLineCommit={
                              handleProposalContactLineCommit
                            }
                            letterDateEditable={proposalOutputMode === "edit"}
                            onLetterDateChange={handleProposalLetterDateChange}
                            recipientDetailsEditable={
                              proposalOutputMode === "edit"
                            }
                            onRecipientDetailsChange={
                              handleProposalRecipientDetailsChange
                            }
                            salutationEditable={proposalOutputMode === "edit"}
                            salutationPlaceholder={
                              proposalSalutationPlaceholder
                            }
                            onSalutationChange={handleProposalSalutationChange}
                            onHeaderVisibilityChange={(value) => {
                              setProposalHeaderVisibility((current) => ({
                                ...current,
                                ...(typeof value === "function"
                                  ? value(current)
                                  : value),
                              }));
                            }}
                            characterLimit={activeCharacterLimitSelection.value}
                            characterLimitAdvisory={
                              activeCharacterLimitSelection.advisory
                            }
                            showModeToggle={false}
                            showZoomControls={true}
                            showPreviewParagraphActions={false}
                            zoomStorageKey={null}
                            previewAnchor="top"
                            previewFitMode="width"
                            previewScrollMode="natural"
                            size="default"
                            documentHeaderMode="hidden"
                            copyFeedback={copyFeedback}
                            onContentChange={handleProposalContentChange}
                            onContentCommit={() => {
                              void handleProposalDocumentCommit();
                            }}
                          />
                        </div>
                      </ProposalDocumentStage>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
