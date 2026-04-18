import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { v4 as uuidv4 } from "uuid";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ClipboardText,
  FloppyDisk,
  RotateCcw,
  Trash,
  X,
} from "@/lib/icons";
import ProposalExportActions from "../components/ProposalExportActions";
import ProposalInputForm, {
  type ProposalGenerateControl,
} from "../components/ProposalInputForm";
import EmbeddedStyleInspector from "../components/EmbeddedStyleInspector";
import { ProposalComposeToolbar } from "../components/ProposalComposeToolbar";
import { ProposalBriefCard } from "../components/ProposalBriefCard";
import {
  CoverLetterStartSurface,
  type CoverLetterStartSurfaceImportState,
} from "../components/CoverLetterStartSurface";
import ProposalSaveDialog from "../components/ProposalSaveDialog";
import ProposalDisplay, {
  fallbackCopyText,
  getDisplayedProposalText,
} from "../components/ProposalDisplay";
import ProposalsList from "../components/ProposalsList";
import {
  SaveIndicator,
  type SaveStatus,
} from "../components/ui/SaveIndicator";
import { useToast } from "../components/ui/toast";
import type { FormValues } from "../components/ProposalInputForm.schemas";
import {
  beginStructuredImportTimingTrace,
  logStructuredImportTiming,
  TRUSTED_MISTRAL_FILE_INPUT_ACCEPT,
  type StructuredImportTimingTrace,
  useStructuredMistralImport,
} from "../components/useStructuredMistralImport";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { api } from "../../convex/_generated/api";
import {
  buildAppProposalPersonalizationPayload,
  clearActiveLocalCvId,
  getProposalApplicantHeaderData,
  getProposalApplicantIdentity,
  getActiveLocalPersonalizationSource,
  getLocalActiveCvSnapshotById,
  getLocalCvDocumentById,
  getProposalAttachedCvId,
  getProposalAttachedCvLocalDocument,
  listLocalCvPickerOptions,
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT,
  setProposalAttachedCvId,
  type ProposalApplicantHeaderData,
} from "../lib/proposal-personalization";
import { type ProposalGenerationFallbackInfo } from "../lib/proposal-generation-ui";
import {
  readStoredProposalOutputDraft,
  resolveProposalStoredText,
  type StoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../lib/proposal-output-draft";
import {
  readProposalEntryIntent,
  readProposalWorkspaceResetToken,
  readStoredProposalComposeDraft,
  writeStoredProposalComposeDraft,
  type StoredProposalComposeDraft,
} from "../lib/proposal-workspace-state";
import { createQuickStartLocationState } from "../lib/quick-start-routing";
import { readStoredSavedProposalFixtures } from "../lib/proposal-saved-fixtures";
import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import {
  getProposalTwinTemplateId,
  getVerbatiStyleFromCv,
  resolveVerbatiStyle,
  serializeVerbatiStyle,
  stylesEqual,
} from "../features/verbati/style";
import { resumeMock } from "../features/verbati/resume/resume.mock";
import {
  PROPOSAL_CHARACTER_LIMIT_TOAST_THRESHOLDS,
  resolveProposalCharacterLimitSelection,
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
import { buildProposalSourceSummary } from "../lib/proposal-source-summary";
import { formatUiDate } from "../lib/ui-date";
import {
  resolveProposalStyleChoice,
  resolveProposalStyleChoiceFromRenderState,
  resolveProposalStyleRenderState,
  type ProposalStyleChoice,
} from "../lib/proposal-style-choice";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";
import type { ProposalPaletteId } from "../lib/proposal-style-display";
import {
  resolveProposalStyle,
  resolveProposalStyleStatus,
} from "../features/verbati/styleState";
import {
  findProposalTemplateBundleIdByStylePreset,
  getProposalTemplateBundleDefinition,
  type ProposalTemplateBundleId,
} from "../lib/proposal-template-bundles";
import { readCssDurationMs } from "../lib/readCssDuration";
import { deriveCvTitleFromSections } from "../lib/normalize-cv";
import {
  buildProposalHeaderVisibilityFromContent,
  buildProposalLetterDateLine,
  buildProposalRecipientPrefill,
  buildProposalSalutation,
  hasProposalHeaderVisibilityOverride,
  readProposalSalutation,
  replaceProposalSalutation,
  resolveProposalHeaderVisibility,
  type ProposalHeaderVisibility,
} from "../lib/proposal-header";
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
import { exportDocumentFile } from "../lib/exportDocumentFile";
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

type ProposalForgePrefill = {
  handoffId: string;
  jobTitle: string;
  jobDescription: string;
  sourceUrl?: string;
  platform?: string;
} | null;

type ProposalForgeView = "compose" | "saved";
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

const PROPOSAL_SAVE_DEBOUNCE_MS = Number(
  (typeof globalThis !== "undefined" &&
    (globalThis as any).process?.env?.TEST_DEBOUNCE_MS) ??
    (typeof process !== "undefined"
      ? (process as any).env?.TEST_DEBOUNCE_MS
      : undefined),
) || 1000;

const COMPOSE_TOOLBAR_VISIBLE_VOICE_PRESETS = new Set<
  NonNullable<FormValues["voicePreset"]>
>(["signature", "expert", "engaging"]);

function getResumeContactValue(
  label: string,
  aliases: string[] = [],
): string | null {
  const normalizedTargets = [label, ...aliases].map((value) =>
    value.trim().toLowerCase(),
  );
  const match = resumeMock.contact.find((entry) =>
    normalizedTargets.includes(entry.label.trim().toLowerCase()),
  );
  return match?.value?.trim() || null;
}

const FALLBACK_PROPOSAL_APPLICANT_HEADER: ProposalApplicantHeaderData = {
  name: resumeMock.name,
  role: resumeMock.title,
  email: getResumeContactValue("Email"),
  phone: getResumeContactValue("Phone"),
  linkedin: getResumeContactValue("LinkedIn"),
  website: getResumeContactValue("Web", ["Website", "Portfolio"]),
  location: getResumeContactValue("Location", ["Address", "City"]),
  tag: resumeMock.metadata[1]?.value ?? null,
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
      header.email ||
      header.phone ||
      header.website ||
      header.linkedin ||
      header.tag,
  );
}

function buildProposalApplicantContactLine(
  header: ProposalApplicantHeaderData | null | undefined,
): string {
  return normalizeProposalContactLine([
    header?.phone?.trim() ?? "",
    header?.email?.trim() ?? "",
    header?.website?.trim() ?? "",
    header?.linkedin?.trim() ?? "",
  ]
    .filter((value) => value.length > 0)
    .join(" · "));
}

function normalizeProposalContactLine(value: string | null | undefined): string {
  return String(value ?? "")
    .split(/\s*(?:,|·|•|\|)\s*/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" · ");
}

function getDefaultProposalLetterDate(location?: string | null): string {
  return buildProposalLetterDateLine({ location });
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
    return normalizeComposeToolbarVoicePreset(args.sourceComposeDraft.voicePreset);
  }

  if (hasOwnProperty(args.composeDraft, "voicePreset")) {
    return normalizeComposeToolbarVoicePreset(args.composeDraft.voicePreset);
  }

  return normalizeComposeToolbarVoicePreset(args.proposalVoicePreset);
}

type ProposalDocumentMetadata = {
  sourceJobDescription?: string;
  sourceUrl?: string;
  sourceCvId?: string;
  platform?: string;
  proposalType?: FormValues["proposalType"];
  voicePreset?: FormValues["voicePreset"];
  requestedVoicePreset?: FormValues["voicePreset"] | null;
  resolvedVoicePreset?: FormValues["voicePreset"];
  autoToneDecisionVersion?: "v1";
  autoToneReason?: string;
  formalityLevel?: FormValues["formalityLevel"];
  creativity?: FormValues["creativity"];
  templateId?: ProposalTemplateId;
  verbatiStyle?: ReturnType<typeof serializeVerbatiStyle>;
  styleLinkMode?: ProposalStyleLinkMode;
  styleChoice?: ProposalStyleChoice;
  templateBundleId?: ProposalTemplateBundleId;
  applicantName?: string;
  applicantRole?: string;
  contactLine?: string;
  letterDate?: string;
  recipientDetails?: string;
  headerShowSender?: boolean;
  headerShowDate?: boolean;
  headerShowSubject?: boolean;
  headerShowRecipient?: boolean;
  headerShowRecipientDetails?: boolean;
  characterLimitMode?: FormValues["characterLimitMode"];
  characterLimitValue?: number | null;
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

function buildProfessionalApplicationSubject(args: {
  jobTitle: string;
  jobDescription: string;
  proposalType?: FormValues["proposalType"] | null;
}): string {
  const jobTitle = args.jobTitle.trim();
  if (!jobTitle) {
    return args.proposalType === "freelance_proposal"
      ? "Project proposal"
      : "Application for the role";
  }

  const summary = buildProposalSourceSummary({
    jobTitle,
    jobDescription: args.jobDescription,
  });
  const company = summary.company?.trim();

  if (company) {
    return `Application for the position of ${jobTitle} at ${company}`;
  }

  return `Application for the position of ${jobTitle}`;
}

function readAttachedCvSelection(): {
  id: string | null;
  title: string | null;
} {
  const attachedCvId = getProposalAttachedCvId();
  if (!attachedCvId) {
    return { id: null, title: null };
  }

  const attachedSnapshot = getLocalActiveCvSnapshotById(attachedCvId);

  return {
    id: attachedCvId,
    title: attachedSnapshot?.title ?? null,
  };
}

function normalizeSourceCvId(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function resolveSourceCvTitle(sourceCvId: string | null | undefined): string | null {
  const normalizedSourceCvId = normalizeSourceCvId(sourceCvId);
  if (!normalizedSourceCvId) {
    return null;
  }

  return getLocalActiveCvSnapshotById(normalizedSourceCvId)?.title ?? null;
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

function isProposalPaletteId(value: unknown): value is ProposalPaletteId {
  return (
    value === "sauge" ||
    value === "ocre" ||
    value === "pierre" ||
    value === "bordeaux" ||
    value === "encre"
  );
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
      typeof input.styleLinkMode === "string" && input.styleLinkMode.trim().length > 0
        ? input.styleLinkMode.trim()
        : null,
  };
}

function buildResolvedRenderTraceSnapshot(args: {
  proposalId?: unknown;
  templateId?: unknown;
  stylePreset?: ReturnType<typeof resolveVerbatiStyle> | null;
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

/**
 * ProposalForge — page Write
 *
 * Toggle Compose / Open : underline tab style (§13 dasti-spec-v1).
 * Intro panel .ip : eyebrow + h2 Fraunces + description.
 * Layout : full-height scrollable (cohérent avec CvForge).
 * Logique métier : intacte.
 */
export function ProposalForge(): JSX.Element {
  const COMPOSE_DRAFT_SYNC_DELAY_MS = 180;
  const location = useLocation();
  const { search } = location;
  const navigate = useNavigate();
  const { currentCvId, importCv } = useCvLibrary();
  const { showToast } = useToast();
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
      rawSessionOutputDraft?: ReturnType<typeof snapshotStoredOutputDraft> | null;
      rawComposeDraft?: ReturnType<typeof snapshotStoredComposeDraft> | null;
      rawCvStyleSource?:
        | {
            cvId: string | null;
            cvLabel: string | null;
            metadata: ProposalStyleTraceMetadataSnapshot;
          }
        | null;
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
  const [attachedCvId, setAttachedCvId] = React.useState<string | null>(
    () => readAttachedCvSelection().id,
  );
  const [attachedCvTitle, setAttachedCvTitle] = React.useState<string | null>(
    () => readAttachedCvSelection().title,
  );
  const activeCvProposalStylePreset = React.useMemo(() => {
    if (!attachedCvId) {
      return null;
    }

    const attachedCvDocument = getProposalAttachedCvLocalDocument();
    if (!attachedCvDocument) {
      return null;
    }

    return getVerbatiStyleFromCv(attachedCvDocument);
  }, [attachedCvId]);
  const storedOutputStylePreset = React.useMemo(() => {
    const hasStoredStyleSignal = Boolean(
      storedOutputDraft?.proposalVerbatiStyle ||
        storedOutputDraft?.layoutOverride ||
        storedOutputDraft?.typographyOverride ||
        storedOutputDraft?.paletteOverride ||
        storedOutputDraft?.customAccentHex,
    );

    if (!hasStoredStyleSignal) {
      return null;
    }

    return resolveVerbatiStyle({
      ...(storedOutputDraft?.proposalVerbatiStyle ?? {}),
      ...(storedOutputDraft?.layoutOverride
        ? { layout: storedOutputDraft.layoutOverride }
        : null),
      ...(storedOutputDraft?.typographyOverride
        ? { typography: storedOutputDraft.typographyOverride }
        : null),
      ...(storedOutputDraft?.customAccentHex
        ? {
            palette: "custom" as const,
            accentHex: storedOutputDraft.customAccentHex,
          }
        : storedOutputDraft?.paletteOverride
          ? { palette: storedOutputDraft.paletteOverride }
          : null),
    });
  }, [
    storedOutputDraft?.customAccentHex,
    storedOutputDraft?.layoutOverride,
    storedOutputDraft?.paletteOverride,
    storedOutputDraft?.proposalVerbatiStyle,
    storedOutputDraft?.typographyOverride,
  ]);
  const fallbackProposalTemplateId = React.useMemo(
    () =>
      getProposalTwinTemplateId(
        storedOutputStylePreset ??
          activeCvProposalStylePreset ??
          undefined,
      ),
    [activeCvProposalStylePreset, storedOutputStylePreset],
  );
  const activePersonalizationSource = React.useMemo(
    () => getActiveLocalPersonalizationSource(),
    [attachedCvId, attachedCvTitle],
  );
  const initialApplicantIdentity = React.useMemo(
    () => getProposalApplicantIdentity(activePersonalizationSource),
    [activePersonalizationSource],
  );
  const activeApplicantHeader = React.useMemo(
    () => getProposalApplicantHeaderData(activePersonalizationSource),
    [activePersonalizationSource],
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
  const refreshAttachedCvSelection = React.useCallback(() => {
    const nextAttachedSelection = readAttachedCvSelection();
    setAttachedCvId(nextAttachedSelection.id);
    setAttachedCvTitle(nextAttachedSelection.title);
  }, []);

  React.useEffect(() => {
    refreshAttachedCvSelection();
  }, [refreshAttachedCvSelection]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleAttachedCvRefresh = () => {
      refreshAttachedCvSelection();
    };

    window.addEventListener(
      PROPOSAL_ATTACHED_CV_UPDATED_EVENT,
      handleAttachedCvRefresh,
    );
    window.addEventListener("storage", handleAttachedCvRefresh);
    window.addEventListener("focus", handleAttachedCvRefresh);

    return () => {
      window.removeEventListener(
        PROPOSAL_ATTACHED_CV_UPDATED_EVENT,
        handleAttachedCvRefresh,
      );
      window.removeEventListener("storage", handleAttachedCvRefresh);
      window.removeEventListener("focus", handleAttachedCvRefresh);
    };
  }, [refreshAttachedCvSelection]);

  const handleAttachedCvChange = React.useCallback(
    (nextId: string | null) => {
      if (nextId === null) {
        clearActiveLocalCvId();
      } else {
        setIsCoverLetterStartSessionActive(false);
        setShowExtensionHelper(false);
      }
      refreshAttachedCvSelection();
    },
    [refreshAttachedCvSelection],
  );

  const handoffId = React.useMemo(
    () => new URLSearchParams(search).get("handoffId"),
    [search],
  );
  const selectedProposalId = React.useMemo(
    () => new URLSearchParams(search).get("id"),
    [search],
  );
  const requestedView = React.useMemo<ProposalForgeView>(() => {
    const params = new URLSearchParams(search);
    const view = params.get("view");
    return view === "saved" || Boolean(params.get("id"))
      ? "saved"
      : "compose";
  }, [search]);
  const proposalWorkspaceResetToken = React.useMemo(
    () => readProposalWorkspaceResetToken(location.state as unknown),
    [location.state],
  );
  const proposalEntryIntent = React.useMemo(
    () => readProposalEntryIntent(location.state as unknown),
    [location.state],
  );
  const shouldInitializeCoverLetterStartSession =
    requestedView === "compose" &&
    proposalEntryIntent === "cover-letter-start" &&
    !handoffId;
  React.useEffect(() => {
    if (
      requestedView === "compose" &&
      proposalEntryIntent === "cover-letter-start" &&
      !handoffId
    ) {
      setIsCoverLetterStartSessionActive(true);
      setShowExtensionHelper(false);
      return;
    }

    setShowExtensionHelper(false);
  }, [handoffId, proposalEntryIntent, proposalWorkspaceResetToken, requestedView]);
  const {
    isLoading: isConvexAuthLoading,
    isAuthenticated: isConvexAuthenticated,
  } = useConvexAuth();
  const generateProposalAction = useAction(api.functions.generateProposal);
  const updateProposal = useMutation(api.updateProposalPublic.default);
  const createProposal = useMutation(
    (api as any).createProposalPublic?.default ?? "createProposalPublic.default",
  );
  const currentProposalSettings = useQuery(
    api.proposalSettings.getCurrent,
    isConvexAuthenticated ? {} : "skip",
  );
  const savedProposals = useQuery(
    api.proposalsPublic.default as any,
    isConvexAuthenticated ? {} : "skip",
  ) as SavedProposalRecord[] | undefined;
  const fallbackSavedProposals = React.useMemo(
    () => (!isConvexAuthenticated ? readStoredSavedProposalFixtures() : []),
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
      storedOutputDraft?.proposalTemplateId ?? fallbackProposalTemplateId,
    );
  const [proposalStyleLinkMode, setProposalStyleLinkMode] =
    React.useState<ProposalStyleLinkMode>(() =>
      resolveProposalStyleLinkMode(
        storedOutputDraft?.proposalStyleLinkMode ??
          (activeCvProposalStylePreset ? "inherit_cv" : "proposal_local"),
      ),
    );
  const [proposalStyleChoice, setProposalStyleChoice] =
    React.useState<ProposalStyleChoice>(() =>
      resolveProposalStyleChoice(
        storedOutputDraft?.proposalStyleChoice ??
          resolveProposalStyleChoiceFromRenderState({
            templateId:
              storedOutputDraft?.proposalTemplateId ??
              fallbackProposalTemplateId,
            stylePreset:
              storedOutputDraft?.proposalVerbatiStyle ??
              activeCvProposalStylePreset,
          }) ??
          (activeCvProposalStylePreset ? "auto" : "balanced"),
      ),
    );
  const [proposalStylePreset, setProposalStylePreset] = React.useState(
    storedOutputStylePreset ?? activeCvProposalStylePreset,
  );
  const shouldRestoreStoredCustomStyle = Boolean(
    storedOutputDraft?.proposalStyleLinkMode === "proposal_local" &&
      storedOutputStylePreset,
  );
  const [hasUserEditedStyle, setHasUserEditedStyle] = React.useState<boolean>(
    () => shouldRestoreStoredCustomStyle,
  );
  const [proposalWorkspaceStyle, setProposalWorkspaceStyle] =
    React.useState<ReturnType<typeof resolveVerbatiStyle> | null>(() =>
      shouldRestoreStoredCustomStyle && storedOutputStylePreset
        ? resolveVerbatiStyle(storedOutputStylePreset)
        : null,
    );
  const [proposalTemplateBundleId, setProposalTemplateBundleId] =
    React.useState<ProposalTemplateBundleId | null>(
      storedOutputDraft?.templateBundleId ?? null,
    );
  const [proposalPaletteOverride, setProposalPaletteOverride] =
    React.useState<ProposalPaletteId | null>(
      storedOutputDraft?.customAccentHex
        ? null
        : storedOutputDraft?.paletteOverride ?? null,
    );
  const [proposalCustomAccentHex, setProposalCustomAccentHex] =
    React.useState<string | null>(storedOutputDraft?.customAccentHex ?? null);
  const [proposalApplicantName, setProposalApplicantName] =
    React.useState<string>(
      storedOutputDraft?.proposalApplicantName ||
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
  const [proposalContactLine, setProposalContactLine] = React.useState<string>(
    storedOutputDraft?.proposalContactLine ?? defaultPreviewContactLine,
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
  const [composeSaveStatus, setComposeSaveStatus] =
    React.useState<SaveStatus>("idle");
  const [isSavingOutputToLibrary, setIsSavingOutputToLibrary] =
    React.useState(false);
  const [proposalExportingFormat, setProposalExportingFormat] =
    React.useState<string | null>(null);
  const [isSaveDialogOpen, setIsSaveDialogOpen] = React.useState(false);
  const [lastProposalRequest, setLastProposalRequest] =
    React.useState<FormValues | null>(null);
  const [composePreviewValues, setComposePreviewValues] =
    React.useState<StoredProposalComposeDraft | null>(() => {
      const storedComposeDraft = readStoredProposalComposeDraft();
      return storedOutputDraft?.sourceComposeDraft ?? storedComposeDraft ?? null;
    });
  const [outputSourceComposeDraft, setOutputSourceComposeDraft] =
    React.useState<StoredProposalComposeDraft | null>(
      storedOutputDraft?.sourceComposeDraft ?? null,
    );
  const [composeDraftInitialSeed, setComposeDraftInitialSeed] =
    React.useState<StoredProposalComposeDraft | null>(
      storedOutputDraft?.sourceComposeDraft ?? null,
    );
  const [stickyImportedSource, setStickyImportedSource] =
    React.useState<ProposalImportedSourceState>(() => {
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
  const draftCharacterLimitMode =
    composePreviewValues?.characterLimitMode ??
    storedOutputDraft?.characterLimitMode ??
    null;
  const draftCharacterLimitValue =
    composePreviewValues?.characterLimitValue ??
    storedOutputDraft?.characterLimitValue ??
    null;
  const [isConfirmingGeneratedDelete, setIsConfirmingGeneratedDelete] =
    React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState<"idle" | "copied">(
    "idle",
  );
  const [composeFormInstanceKey, setComposeFormInstanceKey] = React.useState(0);
  const [isCvPickerOpen, setIsCvPickerOpen] = React.useState(false);
  const [isCoverLetterStartSessionActive, setIsCoverLetterStartSessionActive] =
    React.useState(() => shouldInitializeCoverLetterStartSession);
  const [showExtensionHelper, setShowExtensionHelper] = React.useState(false);
  const [coverLetterInlineImportPhase, setCoverLetterInlineImportPhase] =
    React.useState<ProposalInlineImportPhase>("idle");
  const [coverLetterInlineImportFileName, setCoverLetterInlineImportFileName] =
    React.useState<string | null>(null);
  const [coverLetterInlineImportError, setCoverLetterInlineImportError] =
    React.useState<string | null>(null);
  const [pendingInlineImportedCvId, setPendingInlineImportedCvId] =
    React.useState<string | null>(null);
  const [isComposePanelVisible, setIsComposePanelVisible] = React.useState(true);
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
  const [cvPickerRequestKey, setCvPickerRequestKey] = React.useState(0);
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
  const { importFile: importStructuredResumeFile } = useStructuredMistralImport({
    probeOnMount: false,
  });
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
  const lastAutoApplicantHeaderRef = React.useRef({
    name: defaultPreviewApplicantHeader.name ?? "",
    role: defaultPreviewApplicantHeader.role ?? "",
    contactLine: defaultPreviewContactLine,
  });
  const handleProposalContactLineChange = React.useCallback((value: string) => {
    setProposalContactLine(value);
  }, []);
  const handleProposalContactLineCommit = React.useCallback(() => {
    setProposalContactLine((current) => normalizeProposalContactLine(current));
  }, []);

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
      const trimmedCurrent = current.trim();
      if (!trimmedCurrent || trimmedCurrent === previousAuto.name) {
        return nextAuto.name;
      }
      return current;
    });
    setProposalApplicantRole((current) => {
      const trimmedCurrent = current.trim();
      if (!trimmedCurrent || trimmedCurrent === previousAuto.role) {
        return nextAuto.role;
      }
      return current;
    });
    setProposalContactLine((current) => {
      const normalizedCurrent = normalizeProposalContactLine(current);
      if (
        !normalizedCurrent ||
        normalizedCurrent === previousAuto.contactLine
      ) {
        return nextAuto.contactLine;
      }
      return normalizedCurrent;
    });

    lastAutoApplicantHeaderRef.current = nextAuto;
  }, [
    defaultPreviewApplicantHeader.name,
    defaultPreviewApplicantHeader.role,
    defaultPreviewContactLine,
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
  const copyFeedbackTimeoutRef = React.useRef<number | null>(null);
  const savedCopyFeedbackTimeoutRef = React.useRef<number | null>(null);
  const lastCharacterLimitToastIdRef = React.useRef<string | null>(null);
  const lastSavedProposalContentRef = React.useRef<string | null>(
    storedOutputDraft?.proposalContent ?? null,
  );
  const lastSavedProposalTitleRef = React.useRef<string>(
    storedOutputDraft?.proposalDocumentTitle ?? "",
  );
  const generatedProposalIdRef = React.useRef<Id<"proposals"> | null>(
    storedOutputDraft?.generatedProposalId ?? null,
  );
  const composeAutosaveTimeoutRef =
    React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingComposeSavePromiseRef = React.useRef<Promise<Id<"proposals"> | null> | null>(
    null,
  );
  const pendingQueuedComposeSnapshotRef = React.useRef<{
    id: Id<"proposals"> | null;
    title: string;
    content: string;
    metadata: ProposalDocumentMetadata | undefined;
    status?: string;
    token: string;
  } | null>(null);
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
  const latestTraceSnapshotRef = React.useRef<Record<string, unknown> | null>(null);
  const appliedSettingsAppearanceDefaultsRef = React.useRef(false);
  const canPersistProposalState = isConvexAuthenticated && !isConvexAuthLoading;
  const settingsStyleChoice = React.useMemo(
    () =>
      normalizeProposalSettingsStyleChoice(currentProposalSettings?.styleChoice),
    [currentProposalSettings?.styleChoice],
  );
  const settingsAccentHex = React.useMemo(
    () => normalizeProposalAccentHex(currentProposalSettings?.accentHex),
    [currentProposalSettings?.accentHex],
  );
  const settingsPaletteOverride = React.useMemo(
    () =>
      settingsAccentHex
        ? null
        : isProposalPaletteId(currentProposalSettings?.paletteOverride)
          ? currentProposalSettings.paletteOverride
          : null,
    [currentProposalSettings?.paletteOverride, settingsAccentHex],
  );

  const showConvexAuthRequiredToast = React.useCallback(
    (actionLabel: string) => {
      showToast("Sign in required", {
        variant: "warning",
        description: `${actionLabel} is unavailable until the proposal workspace is authenticated.`,
      });
    },
    [showToast],
  );

  const handoffRecord = useQuery(
    api.proposalHandoffs.get,
    handoffId && isConvexAuthenticated ? { handoffId } : "skip",
  );

  const prefill = React.useMemo<ProposalForgePrefill>(() => {
    if (!handoffRecord) return null;
    return {
      handoffId: handoffRecord.handoffId,
      jobTitle: handoffRecord.jobTitle,
      jobDescription: handoffRecord.jobDescription,
      sourceUrl: handoffRecord.sourceUrl,
      platform: handoffRecord.platform,
    };
  }, [handoffRecord]);

  const proposalHeaderSourceJobTitle =
    composePreviewValues?.jobTitle?.trim() ||
    outputSourceComposeDraft?.jobTitle?.trim() ||
    composeDraftInitialSeed?.jobTitle?.trim() ||
    storedOutputDraft?.sourceComposeDraft?.jobTitle?.trim() ||
    prefill?.jobTitle?.trim() ||
    "";
  const proposalHeaderSourceDescription =
    composePreviewValues?.jobDescription?.trim() ||
    outputSourceComposeDraft?.jobDescription?.trim() ||
    composeDraftInitialSeed?.jobDescription?.trim() ||
    storedOutputDraft?.sourceComposeDraft?.jobDescription?.trim() ||
    prefill?.jobDescription?.trim() ||
    "";
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
        company: proposalHeaderSourceSummary.company,
        role: "",
        address: proposalHeaderSourceSummary.address,
        email: proposalHeaderSourceSummary.email,
        city:
          proposalHeaderSourceSummary.city || proposalHeaderSourceSummary.location,
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
      const trimmedCurrent = current.trim();
      if (!trimmedCurrent || trimmedCurrent === previousAuto.recipientDetails) {
        return nextAuto.recipientDetails;
      }
      return current;
    });
    setProposalLetterDate((current) => {
      const trimmedCurrent = current.trim();
      if (!trimmedCurrent || trimmedCurrent === previousAuto.letterDate) {
        return nextAuto.letterDate;
      }
      return current;
    });
    setProposalContent((current) => {
      if (!current) {
        return current;
      }

      const currentSalutation = readProposalSalutation(current);
      if (!currentSalutation || currentSalutation === previousAuto.salutation) {
        return replaceProposalSalutation({
          content: current,
          salutation: nextAuto.salutation,
        });
      }

      return current;
    });

    lastAutoLetterHeaderRef.current = nextAuto;
  }, [autoProposalLetterDate, autoProposalRecipientDetails]);

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
    setProposalDocumentMeta("");
    setGeneratedProposalId(null);
    generatedProposalIdRef.current = null;
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
      typeof window !== "undefined" ? readStoredProposalComposeDraft() : null;
    const nextSourceUrl =
      prefill?.sourceUrl ??
      outputSourceComposeDraft?.sourceUrl ??
      composePreviewValues?.sourceUrl ??
      composeDraftInitialSeed?.sourceUrl ??
      storedOutputDraft?.sourceComposeDraft?.sourceUrl ??
      storedComposeDraft?.sourceUrl ??
      null;
    const nextPlatform =
      prefill?.platform ??
      outputSourceComposeDraft?.platform ??
      composePreviewValues?.platform ??
      composeDraftInitialSeed?.platform ??
      storedOutputDraft?.sourceComposeDraft?.platform ??
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
    storedOutputDraft?.sourceComposeDraft,
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
    const nextSearch = params.toString();
    void navigate(nextSearch ? `/proposal?${nextSearch}` : "/proposal", {
      replace: true,
    });
  }, [navigate, prefill?.handoffId, requestedView, search]);

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
      normalizeComposeToolbarVoicePreset(currentProposalSettings?.savedVoicePreset),
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

  const resolvedProposalLocalStyle = React.useMemo(
    () => {
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
    },
    [
      composePreviewValues?.jobDescription,
      composePreviewValues?.jobTitle,
      currentProposalSettings?.fontPairId,
      proposalDocumentTitle,
      proposalStyleChoice,
    ],
  );

  React.useEffect(() => {
    if (
      appliedSettingsAppearanceDefaultsRef.current ||
      currentProposalSettings === undefined
    ) {
      return;
    }

    if (
      storedOutputDraft?.proposalStyleChoice ||
      storedOutputDraft?.proposalVerbatiStyle ||
      storedOutputDraft?.proposalTemplateId ||
      storedOutputDraft?.templateBundleId ||
      storedOutputDraft?.customAccentHex ||
      storedOutputDraft?.paletteOverride
    ) {
      appliedSettingsAppearanceDefaultsRef.current = true;
      return;
    }

    if (activeCvProposalStylePreset) {
      appliedSettingsAppearanceDefaultsRef.current = true;
      return;
    }

    setProposalStyleChoice(settingsStyleChoice);
    setProposalPaletteOverride(settingsPaletteOverride);
    setProposalCustomAccentHex(settingsAccentHex);
    appliedSettingsAppearanceDefaultsRef.current = true;
  }, [
    activeCvProposalStylePreset,
    currentProposalSettings,
    settingsAccentHex,
    settingsPaletteOverride,
    settingsStyleChoice,
    storedOutputDraft?.customAccentHex,
    storedOutputDraft?.paletteOverride,
    storedOutputDraft?.proposalStyleChoice,
    storedOutputDraft?.proposalTemplateId,
    storedOutputDraft?.proposalVerbatiStyle,
    storedOutputDraft?.templateBundleId,
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

  React.useEffect(() => {
    if (hasUserEditedStyle) {
      return;
    }

    if (resolvedStyleLinkMode !== "proposal_local") {
      return;
    }

    if (selectedProposalBundleDefinition) {
      setProposalStylePreset((current) =>
        current && stylesEqual(current, selectedProposalBundleDefinition.stylePreset)
          ? current
          : selectedProposalBundleDefinition.stylePreset,
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
    resolvedProposalLocalStyle.stylePreset,
    resolvedProposalLocalStyle.templateId,
    resolvedStyleLinkMode,
    selectedProposalBundleDefinition,
  ]);

  const proposalMetadataStyle = React.useMemo(
    () => {
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
    },
    [
      proposalStylePreset,
      proposalCustomAccentHex,
      proposalPaletteOverride,
    ],
  );
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
  const effectiveProposalTemplateId = React.useMemo(
    () => {
      if (resolvedProposalRuntimeStyle.source === "cv") {
        return getProposalTwinTemplateId(effectiveProposalStylePreset);
      }

      return (
        proposalTemplateId ??
        getProposalTwinTemplateId(effectiveProposalStylePreset)
      );
    },
    [
      effectiveProposalStylePreset,
      proposalTemplateId,
      resolvedProposalRuntimeStyle.source,
    ],
  );
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
        winnerReason: draftWinnerSource === "session_output_draft"
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
  const isCurrentComposeStyleSyncedToCv = React.useMemo(
    () =>
      Boolean(
        activeCvProposalStylePreset &&
          stylesEqual(effectiveProposalStylePreset, activeCvProposalStylePreset),
      ),
    [activeCvProposalStylePreset, effectiveProposalStylePreset],
  );
  const handleResetToCvStyle = React.useCallback(() => {
    if (!activeCvProposalStylePreset) {
      return;
    }

    setProposalStyleLinkMode("inherit_cv");
    setProposalStylePreset(activeCvProposalStylePreset);
    setProposalTemplateId(getProposalTwinTemplateId(activeCvProposalStylePreset));
    setProposalTemplateBundleId(null);
    setProposalPaletteOverride(null);
    setProposalCustomAccentHex(null);
    setHasUserEditedStyle(false);
    setProposalWorkspaceStyle(null);
  }, [activeCvProposalStylePreset]);
  const proposalRenderMetadata = React.useMemo<
    ProposalDocumentMetadata | undefined
  >(() => {
    const nextMetadata: ProposalDocumentMetadata = {};

    const resolvedTemplateId =
      effectiveProposalTemplateId ??
      currentProposalSettings?.templateId ??
      fallbackProposalTemplateId;
    if (resolvedTemplateId) {
      nextMetadata.templateId = resolvedTemplateId;
    }

    nextMetadata.verbatiStyle = serializeVerbatiStyle(
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
      nextMetadata.requestedVoicePreset = lastProposalRequest.voicePreset ?? null;
    }

    const sourceJobDescription =
      outputSourceComposeDraft?.jobDescription?.trim() ||
      composePreviewValues?.jobDescription?.trim() ||
      "";
    if (sourceJobDescription) {
      nextMetadata.sourceJobDescription = sourceJobDescription;
    }
    const sourceUrl =
      outputSourceComposeDraft?.sourceUrl?.trim() ||
      composePreviewValues?.sourceUrl?.trim() ||
      "";
    if (sourceUrl) {
      nextMetadata.sourceUrl = sourceUrl;
    }
    const sourcePlatform =
      outputSourceComposeDraft?.platform?.trim() ||
      composePreviewValues?.platform?.trim() ||
      "";
    if (sourcePlatform) {
      nextMetadata.platform = sourcePlatform;
    }
    if (lastProposalRequest?.formalityLevel) {
      nextMetadata.formalityLevel = lastProposalRequest.formalityLevel;
    }
    if (lastProposalRequest?.creativity) {
      nextMetadata.creativity = lastProposalRequest.creativity;
    }
    if (proposalApplicantName.trim()) {
      nextMetadata.applicantName = proposalApplicantName.trim();
    }
    if (proposalApplicantRole.trim()) {
      nextMetadata.applicantRole = proposalApplicantRole.trim();
    }
    if (proposalContactLine.trim()) {
      nextMetadata.contactLine = proposalContactLine.trim();
    }
    if (proposalLetterDate.trim()) {
      nextMetadata.letterDate = proposalLetterDate.trim();
    }
    if (proposalRecipientDetails.trim()) {
      nextMetadata.recipientDetails = proposalRecipientDetails.trim();
    }
    if (hasProposalHeaderVisibilityOverride(proposalHeaderVisibility)) {
      nextMetadata.headerShowSender = proposalHeaderVisibility.showSender;
      nextMetadata.headerShowDate = proposalHeaderVisibility.showDate;
      nextMetadata.headerShowSubject = proposalHeaderVisibility.showSubject;
      nextMetadata.headerShowRecipient = proposalHeaderVisibility.showRecipient;
      nextMetadata.headerShowRecipientDetails =
        proposalHeaderVisibility.showRecipientDetails;
    }

    return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
  }, [
    composePreviewValues?.jobDescription,
    composePreviewValues?.platform,
    composePreviewValues?.sourceUrl,
    lastProposalRequest?.creativity,
    lastProposalRequest?.formalityLevel,
    lastProposalRequest?.voicePreset,
    outputSourceComposeDraft?.platform,
    outputSourceComposeDraft?.jobDescription,
    outputSourceComposeDraft?.sourceUrl,
    proposalRenderMetadata,
    proposalApplicantName,
    proposalApplicantRole,
    proposalContactLine,
    proposalHeaderVisibility,
    proposalLetterDate,
    proposalRecipientDetails,
    proposalType,
    proposalVoicePreset,
  ]);
  const buildComposeSaveSnapshot = React.useCallback(
    (requestedTitle?: string) => {
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

      const metadata = proposalPersistenceMetadata;
      return {
        id: generatedProposalId,
        title: normalizedTitle,
        content: trimmedContent,
        metadata,
        status: "saved",
        token: JSON.stringify({
          title: normalizedTitle,
          content: trimmedContent,
          metadata: metadata ?? null,
        }),
      };
    },
    [
      generatedProposalId,
      proposalContent,
      proposalDocumentTitle,
      proposalPersistenceMetadata,
      proposalType,
    ],
  );
  const composeAutosaveSnapshot = React.useMemo(
    () => buildComposeSaveSnapshot(),
    [buildComposeSaveSnapshot],
  );
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

      if (isSavingComposeProposalRef.current && pendingComposeSavePromiseRef.current) {
        pendingQueuedComposeSnapshotRef.current = initialSnapshot;
        return pendingComposeSavePromiseRef.current;
      }

      const saveLoop = async () => {
        let nextSnapshot: typeof initialSnapshot | null = initialSnapshot;
        let lastPersistedId: Id<"proposals"> | null = generatedProposalIdRef.current;

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
              generatedProposalId: lastPersistedId ? String(lastPersistedId) : null,
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
                  saveError instanceof Error ? saveError.message : String(saveError),
              },
            });
            console.error("Failed to persist proposal draft:", saveError);
            const errorMessage =
              saveError instanceof Error ? saveError.message : String(saveError);
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

          const queuedSnapshot = pendingQueuedComposeSnapshotRef.current;
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
        void performProposalSave(nextSnapshot, { silent: true }).catch(() => {});
      }, PROPOSAL_SAVE_DEBOUNCE_MS);
    },
    [performProposalSave],
  );
  const flushScheduledProposalSave = React.useCallback(
    async (requestedTitle?: string, options?: { force?: boolean }) => {
      if (composeAutosaveTimeoutRef.current) {
        window.clearTimeout(composeAutosaveTimeoutRef.current);
        composeAutosaveTimeoutRef.current = null;
      }

      const snapshot =
        buildComposeSaveSnapshot(requestedTitle) ??
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
  const optimisticSavedDraftProposal = React.useMemo<SavedProposalRecord | null>(
    () => {
      if (
        !selectedProposalId ||
        !generatedProposalId ||
        String(generatedProposalId) !== String(selectedProposalId)
      ) {
        return null;
      }

      const trimmedContent = proposalContent?.trim() ?? "";
      if (!trimmedContent) {
        return null;
      }

      const optimisticTimestamp = Date.now();
      return {
        _id: generatedProposalId,
        _creationTime: optimisticTimestamp,
        title: proposalDocumentTitle.trim() || "Generated proposal",
        content: trimmedContent,
        status: "saved",
        updatedAt: optimisticTimestamp,
        createdAt: optimisticTimestamp,
        sections: [{ type: "text", content: trimmedContent }],
        metadata: proposalPersistenceMetadata,
      };
    },
    [
      generatedProposalId,
      proposalContent,
      proposalDocumentTitle,
      proposalPersistenceMetadata,
      selectedProposalId,
    ],
  );
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
  }, [
    fallbackSavedProposals,
    optimisticSavedDraftProposal,
    savedProposals,
  ]);
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
        winnerSource: (draftWinnerSource ?? "local_output_draft") as ProposalStyleTraceWinnerSource,
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
          openedSavedProposal?.metadata?.templateId,
      ),
    [openedSavedProposal?.metadata?.templateId, openedSavedProposal?.metadata?.verbatiStyle],
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
                ? getProposalTwinTemplateId(openedSavedProposalSourceCvStylePreset)
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

    if (openedSavedProposalSourceCvId && openedSavedProposalSourceCvStylePreset) {
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
  const savedProposalStyleStatus = React.useMemo(
    () =>
      resolveProposalStyleStatus({
        sourceCvId: openedSavedProposalSourceCvId,
        sourceCvLabel: openedSavedProposalSourceCvLabel,
        styleSource: resolvedSavedProposalRuntimeStyle.source,
        hasSourceCvStyle: Boolean(openedSavedProposalSourceCvStylePreset),
      }),
    [
      openedSavedProposalSourceCvId,
      openedSavedProposalSourceCvLabel,
      openedSavedProposalSourceCvStylePreset,
      resolvedSavedProposalRuntimeStyle.source,
    ],
  );
  const savedProposalStyleStatusLabel = React.useMemo(() => {
    switch (savedProposalStyleStatus.styleSource) {
      case "cv":
        return "CV";
      case "custom":
        return "Custom";
      case "default":
      default:
        return "Default";
    }
  }, [savedProposalStyleStatus.styleSource]);
  const effectiveSavedProposalStylePreset = React.useMemo(
    () => resolvedSavedProposalRuntimeStyle.style,
    [resolvedSavedProposalRuntimeStyle.style],
  );
  const isSavedProposalStyleSyncedToCv = React.useMemo(
    () =>
      Boolean(
        openedSavedProposalSourceCvStylePreset &&
          stylesEqual(
            effectiveSavedProposalStylePreset,
            openedSavedProposalSourceCvStylePreset,
          ),
      ),
    [effectiveSavedProposalStylePreset, openedSavedProposalSourceCvStylePreset],
  );
  const effectiveSavedProposalTemplateId = React.useMemo(
    () =>
      savedProposalTemplateId ??
      getProposalTwinTemplateId(effectiveSavedProposalStylePreset),
    [
      effectiveSavedProposalStylePreset,
      savedProposalTemplateId,
    ],
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
      verbatiStyle: serializeVerbatiStyle(effectiveSavedProposalStylePreset),
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
      generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
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
      generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
      selectedProposalId,
      composeToken: composeAutosaveSnapshot?.token ?? null,
      persistedToken: lastPersistedComposeTokenRef.current,
      winnerSource:
        (() => {
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
      resolvedRenderState: snapshotSavedProposalRecord(optimisticSavedDraftProposal),
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
      generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
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
        mergedProposalIds: sortedSavedProposals.map((proposal) => String(proposal._id)),
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
      proposalId: openedSavedProposal ? String(openedSavedProposal._id) : selectedProposalId,
      generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
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
      generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
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
      generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
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
            proposalId: openedSavedProposal ? String(openedSavedProposal._id) : selectedProposalId,
            generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
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
            proposalId: generatedProposalId ? String(generatedProposalId) : null,
            generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
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
              pendingQueuedComposeSnapshot: pendingQueuedComposeSnapshotRef.current
                ? {
                    proposalId: pendingQueuedComposeSnapshotRef.current.id
                      ? String(pendingQueuedComposeSnapshotRef.current.id)
                      : null,
                    title: pendingQueuedComposeSnapshotRef.current.title,
                    token: pendingQueuedComposeSnapshotRef.current.token,
                    metadata: buildProposalStyleTraceMetadataSnapshot({
                      templateId:
                        pendingQueuedComposeSnapshotRef.current.metadata?.templateId,
                      verbatiStyle:
                        pendingQueuedComposeSnapshotRef.current.metadata?.verbatiStyle,
                      sourceCvId:
                        pendingQueuedComposeSnapshotRef.current.metadata?.sourceCvId,
                      styleLinkMode:
                        pendingQueuedComposeSnapshotRef.current.metadata?.styleLinkMode,
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
        winnerSource: latestSnapshot.winnerSource as ProposalStyleTraceWinnerSource,
        winnerReason:
          typeof latestSnapshot.winnerReason === "string"
            ? latestSnapshot.winnerReason
            : "proposal forge unmounted",
        rawServerRow:
          (latestSnapshot.rawServerRow as ReturnType<typeof snapshotSavedProposalRecord>) ??
          null,
        rawQueryRow:
          (latestSnapshot.rawQueryRow as ReturnType<typeof snapshotSavedProposalRecord>) ??
          null,
        rawCvStyleSource:
          (latestSnapshot.rawCvStyleSource as {
            cvId: string | null;
            cvLabel: string | null;
            metadata: ProposalStyleTraceMetadataSnapshot;
          }) ?? null,
        resolvedRenderState:
          (latestSnapshot.resolvedRenderState as Record<string, unknown>) ?? null,
        traceData: (latestSnapshot.traceData as Record<string, unknown>) ?? undefined,
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
      (previousTrace.proposalStyleLinkMode !== nextTrace.proposalStyleLinkMode ||
        previousTrace.proposalTemplateId !== nextTrace.proposalTemplateId ||
        previousTrace.hasUserEditedStyle !== nextTrace.hasUserEditedStyle ||
        !stylesEqual(
          previousTrace.proposalStylePreset ?? undefined,
          nextTrace.proposalStylePreset ?? undefined,
        ))
    ) {
      traceProposalStyle({
        step: "compose-style-transition",
        proposalId: generatedProposalId ? String(generatedProposalId) : null,
        generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
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
      (previousTrace.savedProposalStyleLinkMode !== nextTrace.savedProposalStyleLinkMode ||
        previousTrace.savedProposalTemplateId !== nextTrace.savedProposalTemplateId ||
        !stylesEqual(
          previousTrace.savedProposalStylePreset ?? undefined,
          nextTrace.savedProposalStylePreset ?? undefined,
        ))
    ) {
      traceProposalStyle({
        step: "saved-style-transition",
        proposalId: selectedProposalId,
        generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
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
            savedProposalStyleLinkMode: previousTrace.savedProposalStyleLinkMode,
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

  const resetProposalWorkspace = React.useCallback(() => {
    cancelPendingComposeDraftSync();
    if (copyFeedbackTimeoutRef.current !== null) {
      window.clearTimeout(copyFeedbackTimeoutRef.current);
      copyFeedbackTimeoutRef.current = null;
    }

    const nextStyleLinkMode = activeCvProposalStylePreset
      ? "inherit_cv"
      : "proposal_local";
    const nextStyleChoice = activeCvProposalStylePreset ? "auto" : settingsStyleChoice;
    const nextResolvedLocalStyle = resolveProposalStyleRenderState({
      choice: nextStyleChoice,
    });
    const nextStylePreset = activeCvProposalStylePreset
      ? activeCvProposalStylePreset
      : applyProposalTypographyPreference({
          stylePreset: nextResolvedLocalStyle.stylePreset,
          fontPairId: currentProposalSettings?.fontPairId,
        });
    const nextTemplateId = getProposalTwinTemplateId(nextStylePreset);

    setProposalContent(null);
    setLoading(false);
    setError(null);
    setErrorDetail(null);
    setProposalType(null);
    setProposalVoicePreset(null);
    setComposeToolbarVoicePreset(
      normalizeComposeToolbarVoicePreset(currentProposalSettings?.savedVoicePreset),
    );
    setProposalTemplateId(nextTemplateId);
    setProposalStyleLinkMode(nextStyleLinkMode);
    setProposalStyleChoice(nextStyleChoice);
    setProposalStylePreset(nextStylePreset);
    setHasUserEditedStyle(false);
    setProposalWorkspaceStyle(null);
    setProposalPaletteOverride(activeCvProposalStylePreset ? null : settingsPaletteOverride);
    setProposalCustomAccentHex(activeCvProposalStylePreset ? null : settingsAccentHex);
    setProposalApplicantName(defaultPreviewApplicantHeader.name || "");
    setProposalApplicantRole(defaultPreviewApplicantHeader.role || "");
    setProposalContactLine(defaultPreviewContactLine);
    setProposalLetterDate(
      getDefaultProposalLetterDate(defaultPreviewApplicantHeader.location),
    );
    setProposalRecipientDetails("");
    setProposalHeaderVisibility(buildProposalHeaderVisibilityFromContent(null));
    setProposalDocumentTitle("");
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
  }, [
    activeCvProposalStylePreset,
    cancelPendingComposeDraftSync,
    currentProposalSettings?.fontPairId,
    currentProposalSettings?.savedVoicePreset,
    defaultPreviewApplicantHeader.name,
    defaultPreviewApplicantHeader.role,
    defaultPreviewContactLine,
    settingsAccentHex,
    settingsPaletteOverride,
    settingsStyleChoice,
  ]);

  React.useEffect(() => {
    if (!proposalWorkspaceResetToken) {
      return;
    }

    setComposeFormInstanceKey((currentKey) => currentKey + 1);
    resetProposalWorkspace();
    void navigate("/proposal", {
      replace: true,
      state:
        proposalEntryIntent === "cover-letter-start"
          ? { proposalEntryIntent }
          : null,
    });
  }, [
    navigate,
    proposalEntryIntent,
    proposalWorkspaceResetToken,
    resetProposalWorkspace,
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

  const resolveProposalVoicePreset = React.useCallback((values: FormValues) => {
    if (values.voicePreset) {
      return values.voicePreset;
    }

    const activeLocalPersonalization = getActiveLocalPersonalizationSource();
    return (
      selectAutoTone({
        jobTitle: values.jobTitle,
        jobDescription: values.jobDescription,
        personalizationContext:
          activeLocalPersonalization.personalizationContext,
        personalizationRichness: activeLocalPersonalization.richness,
      }).preset ?? DEFAULT_PROPOSAL_VOICE_PRESET
    );
  }, []);

  const buildStoredProposalComposeDraftSnapshot = React.useCallback(
    (values: FormValues): StoredProposalComposeDraft => {
      const storedComposeDraft = readStoredProposalComposeDraft();
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

      return {
        jobTitle: values.jobTitle,
        jobDescription: values.jobDescription,
        proposalType: values.proposalType,
        voicePreset: values.voicePreset ?? null,
        toneTuning: values.toneTuning ?? null,
        characterLimitMode: values.characterLimitMode ?? null,
        characterLimitValue: values.characterLimitValue ?? null,
        sourceUrl: preservedSourceUrl,
        platform: preservedPlatform,
      };
    },
    [
      composeDraftInitialSeed?.platform,
      composeDraftInitialSeed?.sourceUrl,
      composePreviewValues?.platform,
      composePreviewValues?.sourceUrl,
      outputSourceComposeDraft?.platform,
      outputSourceComposeDraft?.sourceUrl,
      stickyImportedSource.platform,
      stickyImportedSource.sourceUrl,
      prefill?.platform,
      prefill?.sourceUrl,
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
      generatedProposalId: generatedProposalId ? String(generatedProposalId) : null,
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
          activeCvStylePreset: savedRawCvStyleSource?.metadata?.verbatiStyle ?? null,
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
      openedSavedProposal.title || "Saved proposal",
    );
    setSavedProposalDocumentMeta(
      [
        nextProposalType
          ? formatProposalTypeLabel(nextProposalType)
          : "Proposal",
        buildProposalToneMetaLabel(
          openedSavedProposal.metadata?.requestedVoicePreset,
          nextVoicePreset,
        ),
      ].join(" · "),
    );
    setSavedProposalOutputMode("preview");
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

  const handleToolbarCvPickerToggle = React.useCallback(() => {
    setIsCvPickerOpen((current) => !current);
    setCvPickerRequestKey((currentKey) => currentKey + 1);
  }, []);

  const scheduleJobDescriptionFocus = React.useCallback(() => {
    window.setTimeout(() => {
      const jobDescriptionField =
        document.getElementById("jobDescription") as HTMLTextAreaElement | null;
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
      setProposalAttachedCvId(nextCvId);
      setShowExtensionHelper(false);
      setIsCoverLetterStartSessionActive(false);
      setIsComposePanelVisible(true);
      refreshAttachedCvSelection();
      resetCoverLetterInlineImportUi();
      setCoverLetterInlineImportError(null);
      scheduleJobDescriptionFocus();
      logStructuredImportTiming(trace, "proposal_inline.finalize.finish", {
        cvId: nextCvId,
      });
    },
    [
      refreshAttachedCvSelection,
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
    if (inlineImportRequestIdRef.current !== pendingInlineImportRequestIdRef.current) {
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

      const trace = beginStructuredImportTimingTrace("proposal_inline", file.name);
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
              error instanceof Error ? error.message : "Couldn't read that file.";
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
              error instanceof Error ? error.message : "Couldn't read that file.",
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

  const applyProposalDirectStyle = React.useCallback(
    (
      nextStyle:
        | ReturnType<typeof resolveVerbatiStyle>
        | Partial<ReturnType<typeof resolveVerbatiStyle>>,
    ) => {
      const resolvedStylePreset = resolveVerbatiStyle(nextStyle);
      const nextTemplateId = getProposalTwinTemplateId(resolvedStylePreset);

      setProposalStyleLinkMode("proposal_local");
      setProposalTemplateBundleId(null);
      setProposalPaletteOverride(null);
      setProposalCustomAccentHex(null);
      setProposalStylePreset(resolvedStylePreset);
      setHasUserEditedStyle(true);
      setProposalWorkspaceStyle(resolvedStylePreset);
      setProposalTemplateId(nextTemplateId);
      setProposalStyleChoice(
        resolveProposalStyleChoiceFromRenderState({
          templateId: nextTemplateId,
          stylePreset: resolvedStylePreset,
        }) ?? proposalStyleChoice,
      );
    },
    [proposalStyleChoice],
  );

  const handleProposalStart = React.useCallback(
    (values: FormValues) => {
      cancelPendingComposeDraftSync();
      setComposePreviewValues(buildStoredProposalComposeDraftSnapshot(values));
      const personalizationSource = getActiveLocalPersonalizationSource();
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
      setLastProposalRequest(values);
      setLoading(true);
      setProposalType(values.proposalType);
      setProposalVoicePreset(resolvedVoicePreset);
      setProposalApplicantName(previewApplicantHeader.name ?? "");
      setProposalApplicantRole(previewApplicantHeader.role ?? "");
      setProposalContactLine(
        buildProposalApplicantContactLine(previewApplicantHeader),
      );
      setProposalDocumentTitle(nextDocumentTitle);
      setProposalDocumentMeta(applicantHeader.email ?? "");
      setProposalContent(null);
      setGeneratedProposalId(null);
      generatedProposalIdRef.current = null;
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
    },
    [
      buildStoredProposalComposeDraftSnapshot,
      cancelPendingComposeDraftSync,
      formatProposalTypeLabel,
      resolveProposalVoicePreset,
    ],
  );

  const handleProposalSubmit = React.useCallback(
    (
      values: FormValues,
      proposal: string,
      nextFallbackInfo?: ProposalGenerationFallbackInfo,
      nextProposalId?: Id<"proposals">,
    ) => {
      cancelPendingComposeDraftSync();
      const personalizationSource = getActiveLocalPersonalizationSource();
      const applicantHeader = getProposalApplicantHeaderData(
        personalizationSource,
      );
      const previewApplicantHeader = hasApplicantHeaderContent(applicantHeader)
        ? applicantHeader
        : FALLBACK_PROPOSAL_APPLICANT_HEADER;
      const resolvedVoicePreset = resolveProposalVoicePreset(values);
      const submittedComposeDraft =
        buildStoredProposalComposeDraftSnapshot(values);
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
      writeStoredOutputDraft({
        proposalContent: proposal,
        proposalType: values.proposalType,
        proposalVoicePreset: resolvedVoicePreset,
        proposalTemplateId:
          effectiveProposalTemplateId ?? fallbackProposalTemplateId,
        proposalVerbatiStyle: serializeVerbatiStyle(
          effectiveProposalStylePresetWithPalette,
        ),
        proposalStyleLinkMode: resolvedRuntimeStyleLinkMode,
        proposalStyleChoice,
        proposalApplicantName: previewApplicantHeader.name ?? "",
        proposalApplicantRole: previewApplicantHeader.role ?? "",
        proposalContactLine: buildProposalApplicantContactLine(
          previewApplicantHeader,
        ),
        proposalLetterDate,
        proposalRecipientDetails,
        proposalHeaderShowSender: proposalHeaderVisibility.showSender,
        proposalHeaderShowDate: proposalHeaderVisibility.showDate,
        proposalHeaderShowSubject: proposalHeaderVisibility.showSubject,
        proposalHeaderShowRecipient: proposalHeaderVisibility.showRecipient,
        proposalHeaderShowRecipientDetails:
          proposalHeaderVisibility.showRecipientDetails,
        proposalDocumentTitle: nextDocumentTitle,
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
        proposalDocumentTitleManual: false,
        characterLimitMode: values.characterLimitMode ?? null,
        characterLimitValue: values.characterLimitValue ?? null,
        sourceComposeDraft: submittedComposeDraft,
      });
      setLastProposalRequest(values);
      setProposalType(values.proposalType);
      setProposalVoicePreset(resolvedVoicePreset);
      setProposalApplicantName(previewApplicantHeader.name ?? "");
      setProposalApplicantRole(previewApplicantHeader.role ?? "");
      setProposalContactLine(
        buildProposalApplicantContactLine(previewApplicantHeader),
      );
      setProposalLetterDate((current) =>
        current || getDefaultProposalLetterDate(defaultPreviewApplicantHeader.location),
      );
      setProposalDocumentTitle(nextDocumentTitle);
      setProposalDocumentMeta(nextDocumentMeta);
      setProposalContent(proposal);
      setGeneratedProposalId(nextProposalId ?? null);
      generatedProposalIdRef.current = nextProposalId ?? null;
      setProposalOutputMode("preview");
      setIsComposePanelVisible(true);
      setIsBriefExpanded(false);
      lastSavedProposalContentRef.current = proposal;
      lastSavedProposalTitleRef.current = nextDocumentTitle;
      // Generation can return a persisted proposal id before the full compose
      // artifact metadata has been patched onto that row. Leave the persisted
      // token empty so autosave/save backfills the current style snapshot onto
      // the generated server row.
      lastPersistedComposeTokenRef.current = nextProposalId
        ? null
        : JSON.stringify({
            title: nextDocumentTitle,
            content: proposal.trim(),
            metadata: proposalPersistenceMetadata ?? null,
          });
      composeAutosavePrimedRef.current = true;
      setComposeSaveStatus("idle");
      setIsConfirmingGeneratedDelete(false);
      setStatusMessage(null);
      setError(null);
      setFallbackInfo(nextFallbackInfo ?? null);
      setLoading(false);
    },
    [
      cancelPendingComposeDraftSync,
      effectiveProposalStylePresetWithPalette,
      effectiveProposalTemplateId,
      fallbackProposalTemplateId,
      buildStoredProposalComposeDraftSnapshot,
      formatProposalTypeLabel,
      proposalCustomAccentHex,
      proposalHeaderVisibility,
      proposalLetterDate,
      proposalPaletteOverride,
      proposalRecipientDetails,
      proposalTemplateBundleId,
      proposalStyleChoice,
      resolvedRuntimeStyleLinkMode,
      resolveProposalVoicePreset,
      writeStoredOutputDraft,
    ],
  );

  const handleProposalError = React.useCallback(
    (message: string, values: FormValues, rawReason?: string | null) => {
      cancelPendingComposeDraftSync();
      setComposePreviewValues(buildStoredProposalComposeDraftSnapshot(values));
      const personalizationSource = getActiveLocalPersonalizationSource();
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
      setLastProposalRequest(values);
      setLoading(false);
      setProposalType(values.proposalType);
      setProposalVoicePreset(resolvedVoicePreset);
      setProposalApplicantName(previewApplicantHeader.name ?? "");
      setProposalApplicantRole(previewApplicantHeader.role ?? "");
      setProposalContactLine(
        buildProposalApplicantContactLine(previewApplicantHeader),
      );
      setProposalLetterDate((current) =>
        current || getDefaultProposalLetterDate(defaultPreviewApplicantHeader.location),
      );
      setProposalDocumentTitle(nextDocumentTitle);
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
    },
    [
      buildStoredProposalComposeDraftSnapshot,
      cancelPendingComposeDraftSync,
      formatProposalTypeLabel,
      resolveProposalVoicePreset,
    ],
  );

  const handleProposalContentChange = React.useCallback(
    (nextContent: string) => {
      setProposalContent(nextContent);
    },
    [],
  );
  const handleProposalSalutationChange = React.useCallback((value: string) => {
    setProposalContent((current) =>
      replaceProposalSalutation({
        content: current,
        salutation: value,
      }),
    );
  }, []);

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
        showToast("Draft detached", {
          variant: "error",
          description:
            "This proposal draft no longer exists on the server. Generate again to save new edits.",
        });
        return;
      }
      showToast("Draft update failed", {
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
      showToast("Saved proposal updated", {
        variant: "success",
        description: "Edits were applied to the saved proposal.",
      });
    } catch (error) {
      console.error("Failed to persist saved proposal edits:", error);
      showToast("Saved proposal update failed", {
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
      proposalDocumentTitleManual: false,
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
    proposalType,
    proposalVoicePreset,
    writeStoredOutputDraft,
  ]);

  React.useEffect(() => {
    if (
      !proposalContent ||
      !draftCharacterLimitMode ||
      draftCharacterLimitMode === "none"
    ) {
      lastCharacterLimitToastIdRef.current = null;
      return;
    }

    const displayedCount = getDisplayedProposalText(
      proposalContent,
      proposalType,
    ).length;
    const nextThreshold =
      [...PROPOSAL_CHARACTER_LIMIT_TOAST_THRESHOLDS]
        .reverse()
        .find((threshold) => displayedCount >= threshold.limit) ?? null;

    if (!nextThreshold) {
      lastCharacterLimitToastIdRef.current = null;
      return;
    }

    if (lastCharacterLimitToastIdRef.current === nextThreshold.id) {
      return;
    }

    lastCharacterLimitToastIdRef.current = nextThreshold.id;
    showToast(nextThreshold.title, {
      variant: nextThreshold.advisory ? "warning" : "neutral",
      description: nextThreshold.description,
    });
  }, [
    draftCharacterLimitMode,
    proposalContent,
    proposalType,
    showToast,
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

    if (!composeAutosavePrimedRef.current) {
      composeAutosavePrimedRef.current = true;
      lastPersistedComposeTokenRef.current = composeAutosaveSnapshot.token;
      setComposeSaveStatus("idle");
      return;
    }

    if (composeAutosaveSnapshot.token === lastPersistedComposeTokenRef.current) {
      return;
    }

    scheduleProposalSave(composeAutosaveSnapshot);
  }, [
    canPersistProposalState,
    composeAutosaveSnapshot,
    composeSaveStatus,
    scheduleProposalSave,
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
      showToast("Proposal copied", { variant: "success" });
    } catch (copyError) {
      console.warn("Failed to copy proposal:", copyError);
      showToast("Copy failed", {
        variant: "error",
        description: "Clipboard access was unavailable.",
      });
    }
  }, [
    openedSavedProposal,
    proposalContent,
    proposalType,
    savedProposalContent,
    savedProposalType,
    showToast,
  ]);

  const handleCopySavedProposalToDraft = React.useCallback(() => {
    if (!openedSavedProposal || !savedProposalContent) {
      return;
    }

    const restoredSourceJobDescription =
      openedSavedProposal.metadata?.sourceJobDescription?.trim() ?? "";
    const restoredSourceUrl =
      openedSavedProposal.metadata?.sourceUrl?.trim() ?? "";
    const restoredSourcePlatform =
      openedSavedProposal.metadata?.platform?.trim() ?? "";
    const restoredJobTitle =
      savedProposalDocumentTitle.trim() ||
      openedSavedProposal.title.trim() ||
      "Saved proposal";
    const savedProposalHasRequestedVoicePreset = hasOwnProperty(
      openedSavedProposal.metadata,
      "requestedVoicePreset",
    );
    const restoredRequestedVoicePreset = savedProposalHasRequestedVoicePreset
      ? (openedSavedProposal.metadata?.requestedVoicePreset ?? null)
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
      findProposalTemplateBundleIdByStylePreset(effectiveSavedProposalStylePreset);
    const shouldRestoreSavedDetachedStyle =
      savedProposalStyleLinkMode === "proposal_local";

    if (typeof window !== "undefined") {
      try {
        const existingComposeDraft = readStoredProposalComposeDraft() ?? {};
        const composeDraft: StoredProposalComposeDraft = {
          ...existingComposeDraft,
          jobTitle: restoredJobTitle,
          proposalType: savedProposalType ?? "cover_letter",
        };

        if (restoredSourceJobDescription) {
          composeDraft.jobDescription = restoredSourceJobDescription;
        }
        if (restoredSourceUrl) {
          composeDraft.sourceUrl = restoredSourceUrl;
        }
        if (restoredSourcePlatform) {
          composeDraft.platform = restoredSourcePlatform;
        }

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
          setProposalAttachedCvId(openedSavedProposalSourceCvId);
        }
      } catch {
        // Ignore storage failures and continue with the in-memory draft.
      }
    }

    setProposalContent(savedProposalContent);
    setProposalType(savedProposalType);
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
    setProposalDocumentTitle(savedProposalDocumentTitle);
    setProposalDocumentMeta(savedProposalDocumentMeta);
    setGeneratedProposalId(null);
    generatedProposalIdRef.current = null;
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
    setIsComposePanelVisible(true);
    setIsBriefExpanded(true);
    setFallbackInfo(null);
    setError(null);
    setStatusMessage(null);
    setErrorDetail(null);
    showToast("Copied to live draft", {
      variant: "success",
      description: restoredSourceJobDescription
        ? "A detached draft copy is ready with the saved proposal and its source brief."
        : "A detached draft copy is ready. Review the brief in Compose before refining.",
    });
    updateProposalRoute("compose");
  }, [
    cancelPendingComposeDraftSync,
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
  ]);
  const handleResetSavedProposalToCvStyle = React.useCallback(async () => {
    if (
      !openedSavedProposal ||
      !openedSavedProposalSourceCvStylePreset ||
      !openedSavedProposalSourceCvId
    ) {
      return;
    }

    try {
      const nextMetadata: ProposalDocumentMetadata = {
        ...(savedProposalRenderMetadata ?? openedSavedProposal.metadata ?? {}),
        sourceCvId: openedSavedProposalSourceCvId,
        templateId: getProposalTwinTemplateId(openedSavedProposalSourceCvStylePreset),
        verbatiStyle: serializeVerbatiStyle(openedSavedProposalSourceCvStylePreset),
        styleLinkMode: "inherit_cv",
      };

      setSavedProposalStyleLinkMode("inherit_cv");
      setSavedProposalStylePreset(openedSavedProposalSourceCvStylePreset);
      setSavedProposalTemplateId(nextMetadata.templateId ?? null);
      await persistOpenedSavedProposal({
        metadata: nextMetadata,
      });
      showToast("Reset to CV style", {
        variant: "success",
        description: "The saved proposal will follow its source CV style again.",
      });
    } catch (error) {
      console.error("Failed to reset saved proposal style:", error);
      showToast("Reset failed", {
        variant: "error",
        description: "The saved proposal could not be reset to its CV style.",
      });
    }
  }, [
    openedSavedProposal,
    openedSavedProposalSourceCvId,
    openedSavedProposalSourceCvStylePreset,
    persistOpenedSavedProposal,
    savedProposalRenderMetadata,
    showToast,
  ]);

  const handleDeleteOutput = React.useCallback(async () => {
    if (!generatedProposalId) return;
    if (!canPersistProposalState) {
      showConvexAuthRequiredToast("Delete");
      return;
    }

    try {
      await deleteProposal({ id: generatedProposalId });
      cancelPendingComposeDraftSync();
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
      setProposalContactLine(defaultPreviewContactLine);
      setProposalLetterDate(
        getDefaultProposalLetterDate(defaultPreviewApplicantHeader.location),
      );
      setProposalRecipientDetails("");
      setProposalHeaderVisibility(buildProposalHeaderVisibilityFromContent(null));
      setProposalDocumentTitle("");
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
      showToast("Proposal deleted", { variant: "success" });
    } catch (deleteError) {
      console.error("Failed to delete proposal draft:", deleteError);
      showToast("Delete failed", {
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
  ]);

  const saveDialogTitle = React.useMemo(
    () =>
      proposalDocumentTitle.trim() ||
      (proposalType
        ? formatProposalTypeLabel(proposalType)
        : "Generated proposal"),
    [formatProposalTypeLabel, proposalDocumentTitle, proposalType],
  );

  const handleOpenSaveDialog = React.useCallback(() => {
    if (!proposalContent || isSavingOutputToLibrary) {
      return;
    }
    if (!canPersistProposalState) {
      showConvexAuthRequiredToast("Save");
      return;
    }

    setIsSaveDialogOpen(true);
  }, [
    canPersistProposalState,
    isSavingOutputToLibrary,
    proposalContent,
    showConvexAuthRequiredToast,
  ]);

  const handleSaveOutputToLibrary = React.useCallback(async (requestedTitle: string) => {
    if (!proposalContent || isSavingOutputToLibrary) {
      return;
    }
    if (!canPersistProposalState) {
      showConvexAuthRequiredToast("Save");
      return;
    }

    const trimmed = proposalContent.trim();
    if (!trimmed) {
      return;
    }

    const normalizedTitle =
      requestedTitle.trim() ||
      proposalDocumentTitle.trim() ||
      (proposalType
        ? formatProposalTypeLabel(proposalType)
        : "Generated proposal");

    setIsSavingOutputToLibrary(true);
    try {
      const persistedProposalId = await flushScheduledProposalSave(normalizedTitle, {
        force: true,
      });
      if (!persistedProposalId) {
        return;
      }

      setProposalDocumentTitle(normalizedTitle);
      lastSavedProposalContentRef.current = trimmed;
      lastSavedProposalTitleRef.current = normalizedTitle;
      setIsSaveDialogOpen(false);
      const params = new URLSearchParams(search);
      params.delete("handoffId");
      params.set("view", "saved");
      params.set("id", String(persistedProposalId));
      const nextSearch = params.toString();
      void navigate(nextSearch ? `/proposal?${nextSearch}` : "/proposal");
      showToast("Saved to library", {
        variant: "success",
        description:
          "This proposal is now in Proposal Library. Open the saved copy there or duplicate it back into draft when you want a new variation.",
      });
    } catch (saveError) {
      console.error("Failed to save proposal draft to library:", saveError);
      showToast("Save failed", {
        variant: "error",
        description: "The proposal could not be saved to the library.",
      });
    } finally {
      setIsSavingOutputToLibrary(false);
    }
  }, [
    canPersistProposalState,
    flushScheduledProposalSave,
    isSavingOutputToLibrary,
    proposalContent,
    proposalDocumentTitle,
    proposalType,
    formatProposalTypeLabel,
    showConvexAuthRequiredToast,
    showToast,
    navigate,
    search,
  ]);

  const isSavedView = requestedView === "saved";
  const hasLocalResumes = React.useMemo(
    () => listLocalCvPickerOptions().length > 0,
    [attachedCvId, attachedCvTitle],
  );
  const proposalTwoPaneMinViewportWidth = 1440;
  const proposalWorkspaceOutputShellInlineSize =
    "calc(var(--document-sheet-inline-size) - (var(--s4) * 2))";
  const proposalWorkbenchColumnInlineSize =
    "var(--proposal-workspace-output-shell-inline-size)";
  const proposalDesktopComposeWidth = proposalWorkbenchColumnInlineSize;
  const proposalWorkspaceShellBlockSize =
    "min(var(--document-viewer-shell-max-block), calc(100dvh - var(--header-height) - (var(--space-2) * 2) - (var(--document-viewer-toolbar-block-size) + var(--space-2))))";
  const isCompactComposeLayout =
    viewportWidth < proposalTwoPaneMinViewportWidth;
  const proposalComposeColumnInlineSize = proposalWorkbenchColumnInlineSize;
  const showComposePanel = isComposePanelVisible && !isSavedView;
  const storedComposeDraft =
    typeof window !== "undefined" ? readStoredProposalComposeDraft() : null;
  const briefJobDescription =
    composePreviewValues?.jobDescription?.trim() ||
    prefill?.jobDescription?.trim() ||
    storedComposeDraft?.jobDescription?.trim() ||
    "";
  const briefSourceUrl =
    outputSourceComposeDraft?.sourceUrl ??
    composePreviewValues?.sourceUrl ??
    composeDraftInitialSeed?.sourceUrl ??
    storedOutputDraft?.sourceComposeDraft?.sourceUrl ??
    storedComposeDraft?.sourceUrl ??
    stickyImportedSource.sourceUrl ??
    prefill?.sourceUrl ??
    null;
  const briefSourcePlatform =
    outputSourceComposeDraft?.platform ??
    composePreviewValues?.platform ??
    composeDraftInitialSeed?.platform ??
    storedOutputDraft?.sourceComposeDraft?.platform ??
    storedComposeDraft?.platform ??
    stickyImportedSource.platform ??
    prefill?.platform ??
    null;
  const hasMeaningfulComposeDraft = Boolean(
    composePreviewValues?.jobTitle?.trim() ||
      composePreviewValues?.jobDescription?.trim() ||
      composeDraftInitialSeed?.jobTitle?.trim() ||
      composeDraftInitialSeed?.jobDescription?.trim() ||
      prefill?.jobTitle?.trim() ||
      prefill?.jobDescription?.trim() ||
      briefSourceUrl?.trim() ||
      briefSourcePlatform?.trim(),
  );
  const hasMeaningfulOutputDraft = Boolean(
    proposalContent?.trim() ||
      proposalDocumentTitle?.trim() ||
      storedOutputDraft?.proposalContent?.trim() ||
      storedOutputDraft?.proposalDocumentTitle?.trim() ||
      generatedProposalId,
  );
  const proposalDisplayApplicantHeader = React.useMemo(
    () => ({
      ...defaultPreviewApplicantHeader,
      name: proposalApplicantName.trim() || null,
      role: proposalApplicantRole.trim() || null,
    }),
    [
      defaultPreviewApplicantHeader,
      proposalApplicantName,
      proposalApplicantRole,
    ],
  );
  const proposalSalutationValue = React.useMemo(
    () => readProposalSalutation(proposalContent),
    [proposalContent],
  );
  const proposalSalutationPlaceholder = React.useMemo(
    () => buildProposalSalutation(proposalRecipientDetails || autoProposalRecipientDetails),
    [autoProposalRecipientDetails, proposalRecipientDetails],
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
      }),
    [
      composePreviewValues?.jobDescription,
      composePreviewValues?.jobTitle,
      effectiveProposalTemplateId,
      fallbackProposalTemplateId,
      proposalContactLine,
      proposalDisplayApplicantHeader,
      proposalDocumentMeta,
      proposalDocumentTitle,
      proposalHeaderVisibility,
      proposalLetterDate,
      proposalRecipientDetails,
      proposalRenderMetadata?.templateId,
      proposalType,
      proposalContent,
    ],
  );
  const exportComposeStyledProposalSource = React.useCallback(
    () =>
      buildProposalPreviewPrintSource({
        content: proposalContent,
        proposalType,
        voicePreset: proposalVoicePreset,
        railTitle: proposalApplicantName,
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
      }),
    [
      composePreviewValues?.jobDescription,
      composePreviewValues?.jobTitle,
      effectiveProposalStylePresetWithPalette,
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
      proposalType,
      proposalContent,
      proposalVoicePreset,
    ],
  );
  const exportSavedProposalSource = React.useCallback(() => {
    if (!openedSavedProposal || !savedProposalContent) {
      return null;
    }

    const savedMetadata = openedSavedProposal.metadata;
    const savedApplicantHeader = {
      ...defaultPreviewApplicantHeader,
      name:
        savedMetadata?.applicantName?.trim() ||
        defaultPreviewApplicantHeader.name ||
        "",
      role:
        savedMetadata?.applicantRole?.trim() ||
        defaultPreviewApplicantHeader.role ||
        "",
    };

    return buildProposalExportSource({
      content: savedProposalContent,
      proposalType: savedProposalType,
      documentTitle:
        savedProposalDocumentTitle.trim() ||
        openedSavedProposal.title ||
        "Proposal",
      documentMeta: savedProposalDocumentMeta,
      contactLine:
        savedMetadata?.contactLine ??
        buildProposalApplicantContactLine(savedApplicantHeader),
      letterDate:
        savedMetadata?.letterDate ??
        getDefaultProposalLetterDate(savedApplicantHeader.location),
      recipientDetails: savedMetadata?.recipientDetails ?? "",
      applicantHeader: savedApplicantHeader,
      headerVisibility: resolveProposalHeaderVisibility({
        showSender: savedMetadata?.headerShowSender,
        showDate: savedMetadata?.headerShowDate,
        showSubject: savedMetadata?.headerShowSubject,
        showRecipient: savedMetadata?.headerShowRecipient,
        showRecipientDetails: savedMetadata?.headerShowRecipientDetails,
      }),
      templateId: savedProposalTemplateId,
    });
  }, [
    defaultPreviewApplicantHeader,
    openedSavedProposal,
    savedProposalContent,
    savedProposalDocumentMeta,
    savedProposalDocumentTitle,
    savedProposalTemplateId,
    savedProposalType,
  ]);
  const exportSavedStyledProposalSource = React.useCallback(() => {
    if (!openedSavedProposal || !savedProposalContent) {
      return null;
    }

    const savedMetadata = openedSavedProposal.metadata;
    const savedApplicantHeader = {
      ...defaultPreviewApplicantHeader,
      name:
        savedMetadata?.applicantName?.trim() ||
        defaultPreviewApplicantHeader.name ||
        "",
      role:
        savedMetadata?.applicantRole?.trim() ||
        defaultPreviewApplicantHeader.role ||
        "",
    };

    return buildProposalPreviewPrintSource({
      content: savedProposalContent,
      proposalType: savedProposalType,
      voicePreset: savedProposalVoicePreset,
      railTitle: savedApplicantHeader.name,
      railMeta: savedApplicantHeader.role,
      documentTitle:
        savedProposalDocumentTitle.trim() ||
        openedSavedProposal.title ||
        "Proposal",
      documentMeta: savedProposalDocumentMeta,
      contactLine:
        savedMetadata?.contactLine ??
        buildProposalApplicantContactLine(savedApplicantHeader),
      letterDate:
        savedMetadata?.letterDate ??
        getDefaultProposalLetterDate(savedApplicantHeader.location),
      recipientDetails: savedMetadata?.recipientDetails ?? "",
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
    });
  }, [
    defaultPreviewApplicantHeader,
    effectiveSavedProposalStylePreset,
    effectiveSavedProposalTemplateId,
    openedSavedProposal,
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
        showToast("Proposal export unavailable", {
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
                          ? source.templateId
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

        showToast(`Exported ${exported.filename}`, { variant: "success" });
      } catch (error) {
        console.error("[ProposalForge] export failed", error);
        showToast("Proposal export failed", { variant: "error" });
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
  const briefJobTitle =
    composePreviewValues?.jobTitle?.trim() ||
    prefill?.jobTitle?.trim() ||
    storedComposeDraft?.jobTitle?.trim() ||
    "";
  const hasBriefContent = Boolean(briefJobDescription);
  const showBriefCard =
    hasBriefContent && !isBriefExpanded && showComposePanel;
  const shouldShowDesktopBriefCapsule =
    showBriefCard && !isCompactComposeLayout;
  const shouldLeftAnchorStackedWorkbench =
    isCompactComposeLayout && viewportWidth >= 768;
  const canCollapseComposePanel = !isSavedView && !isCompactComposeLayout;
  const shouldCenterOutputStage =
    !isSavedView &&
    !isComposePanelVisible &&
    !isCompactComposeLayout &&
    !shouldShowDesktopBriefCapsule;
  const isLoadingHandoff =
    Boolean(handoffId) &&
    (isConvexAuthLoading ||
      (isConvexAuthenticated && handoffRecord === undefined));
  const shouldShowCoverLetterStartSurface =
    !isSavedView &&
    proposalEntryIntent === "cover-letter-start" &&
    isCoverLetterStartSessionActive &&
    !handoffId &&
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
  const liveWorkbenchMaxWidth = isCompactComposeLayout
    ? "560px"
    : shouldRenderColdStartInlineOnly
      ? proposalDesktopComposeWidth
    : shouldCenterOutputStage
      ? "860px"
      : `calc(${proposalDesktopComposeWidth} + var(--proposal-workspace-output-shell-inline-size) + var(--layout-card-grid))`;

  const stackedCardWidthStyle: React.CSSProperties = isCompactComposeLayout
    ? {
        width: `min(100%, ${proposalWorkbenchColumnInlineSize})`,
        minWidth: 0,
      }
    : { width: "100%", minWidth: 0 };
  const composeColumnShellWidthStyle: React.CSSProperties = {
    ...stackedCardWidthStyle,
    "--document-viewer-shell-inline-size": proposalWorkbenchColumnInlineSize,
  };
  const proposalToolbarWidthStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: proposalWorkbenchColumnInlineSize,
    minWidth: 0,
  };
  const proposalWorkbenchFrameStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: liveWorkbenchMaxWidth,
    marginInline:
      shouldRenderColdStartInlineOnly
        ? "auto"
        : shouldLeftAnchorStackedWorkbench ||
            shouldShowDesktopBriefCapsule
        ? 0
        : "auto",
    minWidth: 0,
    "--proposal-workspace-output-shell-inline-size":
      proposalWorkspaceOutputShellInlineSize,
    "--proposal-workspace-shell-block-size":
      proposalWorkspaceShellBlockSize,
    "--proposal-compose-column-inline-size": proposalComposeColumnInlineSize,
  };
  const proposalWorkbenchToolbarSlotStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: proposalWorkbenchColumnInlineSize,
    marginInline: 0,
    minWidth: 0,
    "--proposal-workspace-output-shell-inline-size":
      proposalWorkspaceOutputShellInlineSize,
    "--proposal-compose-column-inline-size": proposalComposeColumnInlineSize,
  };
  const activeCharacterLimitSelection = React.useMemo(
    () =>
      resolveProposalCharacterLimitSelection({
        mode: draftCharacterLimitMode,
        value: draftCharacterLimitValue,
      }),
    [draftCharacterLimitMode, draftCharacterLimitValue],
  );
  const showComposeGridColumn = showComposePanel;
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
  const shouldHideComposeShell =
    !showComposePanel || showBriefCard;
  const coverLetterInlineImportState =
    React.useMemo<CoverLetterStartSurfaceImportState>(() => {
      const isBusy = coverLetterInlineImportPhase !== "idle";
      if (coverLetterInlineImportPhase === "preparing") {
        return {
          isBusy,
          label: "Preparing resume import...",
          hint: "Checking the file before upload.",
          fileName: coverLetterInlineImportFileName,
          error: coverLetterInlineImportError,
        };
      }
      if (coverLetterInlineImportPhase === "retrying") {
        return {
          isBusy,
          label: "Retrying resume import...",
          hint: "The connection dropped. The same import is retrying now.",
          fileName: coverLetterInlineImportFileName,
          error: coverLetterInlineImportError,
        };
      }
      if (coverLetterInlineImportPhase === "finalizing") {
        return {
          isBusy,
          label: "Opening imported resume...",
          hint: "Attaching the imported resume to this cover letter.",
          fileName: coverLetterInlineImportFileName,
          error: coverLetterInlineImportError,
        };
      }
      if (coverLetterInlineImportPhase === "importing") {
        return {
          isBusy,
          label: "Importing resume...",
          hint: "Running the trusted Mistral import. This can take a few seconds.",
          fileName: coverLetterInlineImportFileName,
          error: coverLetterInlineImportError,
        };
      }
      return {
        isBusy,
        label: "Import a resume",
        hint: "Upload a trusted PDF or image and attach it here.",
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
        ? (document.getElementById("jobDescription") as
            | HTMLTextAreaElement
            | null)
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
  const handleReturnToDraft = React.useCallback(() => {
    setIsComposePanelVisible(true);
    setIsBriefExpanded(true);
    updateProposalRoute("compose");
  }, [updateProposalRoute]);
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
    if (!shouldAnimateDesktopBriefTransition && briefAnimationPhase !== "idle") {
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

  const proposalWorkbenchToolbar = shouldRenderColdStartInlineOnly ? null : shouldShowCollapsedComposeToolbar ? (
    <ProposalComposeToolbar
      value={composeToolbarVoicePreset}
      resolvedValue={proposalVoicePreset ?? null}
      onChange={handleToolbarVoicePresetChange}
      onToggleCvPicker={handleToolbarCvPickerToggle}
      onClearCv={() => handleAttachedCvChange(null)}
      cvTitle={attachedCvTitle}
      isCvPickerOpen={isCvPickerOpen}
      disabled={loading || isLoadingHandoff}
      collapsed
      transitionState={toolbarTransitionState ?? undefined}
      onRestoreCompose={handleRestoreCompose}
      onGenerateFromBrief={handleGenerateFromCollapsedToolbar}
      generateLabel={composeGenerateControl.label}
      generateDisabled={composeGenerateControl.disabled}
      generateState={composeGenerateControl.state}
      styleStatusLabel={proposalStyleStatusLabel}
      saveStatus={composeSaveStatus}
      canResetToCvStyle={proposalStyleStatus.canResetToCv}
      resetToCvStyleDisabled={isCurrentComposeStyleSyncedToCv}
      onResetToCvStyle={handleResetToCvStyle}
    />
  ) : showComposePanel ? (
    <ProposalComposeToolbar
      value={composeToolbarVoicePreset}
      resolvedValue={proposalVoicePreset ?? null}
      onChange={handleToolbarVoicePresetChange}
      onToggleCvPicker={handleToolbarCvPickerToggle}
      onClearCv={() => handleAttachedCvChange(null)}
      cvTitle={attachedCvTitle}
      isCvPickerOpen={isCvPickerOpen}
      disabled={loading || isLoadingHandoff}
      compact={isCompactComposeLayout}
      transitionState={toolbarTransitionState ?? undefined}
      onCollapseCompose={canCollapseComposePanel ? handleCollapseCompose : undefined}
      styleStatusLabel={proposalStyleStatusLabel}
      saveStatus={composeSaveStatus}
      rightActions={
        proposalContent && !loading && !error ? (
          <ProposalExportActions
            disabled={proposalExportingFormat !== null}
            onExportPdf={(mode) => {
              void handleExportProposalFile({
                target: "compose",
                format: "pdf",
                mode,
              });
            }}
            onExportDocx={() => {
              void handleExportProposalFile({
                target: "compose",
                format: "docx",
              });
            }}
          />
        ) : null
      }
      canResetToCvStyle={proposalStyleStatus.canResetToCv}
      resetToCvStyleDisabled={isCurrentComposeStyleSyncedToCv}
      onResetToCvStyle={handleResetToCvStyle}
    />
  ) : null;

  return (
    <div
      className="dasti-page-scroll"
      style={{
        minWidth: 0,
      }}
    >
      <div
        className={
          isSavedView
            ? "dasti-page-shell dasti-page-shell--proposal-saved"
            : "dasti-page-shell"
        }
        style={
          {
            "--page-shell-max-width": isSavedView
              ? "100%"
              : "100%",
            "--page-shell-gap": isSavedView
              ? "var(--layout-panel-stack)"
              : "var(--space-2)",
            "--page-shell-pad-top": "var(--space-2)",
            "--page-shell-pad-inline": "var(--space-4)",
            "--page-shell-pad-inline-mobile": "var(--space-4)",
          } as React.CSSProperties
        }
      >
        {isSavedView ? (
          <section aria-hidden={false}>
            <ProposalsList
              selectedProposalId={selectedProposalId}
              onSelectedProposalIdChange={(id) =>
                updateProposalRoute("saved", id)
              }
              savedViewActions={
                <div
                  className="dasti-proposal-saved-view-toolbar dasti-toolbar--surface-tooltips"
                  role="group"
                  aria-label="Saved proposal actions"
                >
                  <div
                    className="dasti-proposal-saved-view-toolbar__status"
                    role="group"
                    aria-label="Saved proposal status"
                  >
                    <SaveIndicator
                      label={savedProposalStyleStatusLabel}
                      tone="neutral"
                    />
                  </div>
                  <button
                    type="button"
                    className="dasti-icon-button"
                    data-toolbar-tooltip="Back to draft"
                    onClick={handleReturnToDraft}
                    aria-label="Back to draft"
                  >
                    <ArrowLeft size={16} strokeWidth={1.7} />
                  </button>
                  <button
                    type="button"
                    className="dasti-icon-button"
                    data-toolbar-tooltip="Duplicate to draft"
                    onClick={handleCopySavedProposalToDraft}
                    disabled={!openedSavedProposal || !savedProposalContent}
                    aria-label="Duplicate to draft"
                    >
                      <ClipboardText size={16} strokeWidth={1.6} />
                    </button>
                  <span
                    className="dasti-proposal-saved-view-toolbar__spacer"
                    aria-hidden="true"
                  />
                  {savedProposalStyleStatus.canResetToCv ? (
                    <button
                      type="button"
                      className="dasti-icon-button"
                      data-toolbar-tooltip="Reset to CV style"
                      onClick={() => {
                        void handleResetSavedProposalToCvStyle();
                      }}
                      disabled={isSavedProposalStyleSyncedToCv}
                      aria-label="Reset to CV style"
                    >
                      <RotateCcw size={16} strokeWidth={1.6} />
                    </button>
                  ) : null}
                    <ProposalExportActions
                      disabled={
                        !openedSavedProposal ||
                        !savedProposalContent ||
                        proposalExportingFormat !== null
                    }
                    onExportPdf={(mode) => {
                      void handleExportProposalFile({
                        target: "saved",
                        format: "pdf",
                        mode,
                      });
                    }}
                    onExportDocx={() => {
                      void handleExportProposalFile({
                        target: "saved",
                        format: "docx",
                      });
                    }}
                  />
                </div>
              }
            />
          </section>
        ) : (
          <>
            {proposalWorkbenchToolbar ? (
              <div
                className="dasti-workbench-top-left-slot dasti-workbench-top-left-slot--proposal"
                style={proposalWorkbenchToolbarSlotStyle}
              >
                <div className="dasti-proposal-workbench-left-stack" style={proposalToolbarWidthStyle}>
                  {proposalWorkbenchToolbar ? (
                    <div
                      className="dasti-cv-workbench-bar dasti-cv-workbench-bar--proposal-workspace"
                    >
                      <div
                        className="dasti-forge-compose-toolbar-slot"
                        data-testid="proposal-workbench-toolbar-slot"
                      >
                        {proposalWorkbenchToolbar}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
            <div className="dasti-flow" style={proposalWorkbenchFrameStyle}>
            <section aria-hidden={false}>
              {shouldRenderColdStartInlineOnly ? (
                <>
                  <CoverLetterStartSurface
                    hasResumes={hasLocalResumes}
                    showExtensionHelper={showExtensionHelper}
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
                  className="dasti-grid-split"
                  style={
                    {
                      "--grid-columns": isCompactComposeLayout
                        ? "minmax(0, 1fr)"
                        : showComposeGridColumn
                          ? `${proposalDesktopComposeWidth} minmax(0, var(--proposal-workspace-output-shell-inline-size))`
                          : "minmax(0, 0px) minmax(0, 1fr)",
                      "--grid-gap": showComposeGridColumn
                        ? "var(--layout-card-grid)"
                        : "0px",
                      "--grid-align": "start",
                      "--grid-justify": shouldCenterOutputStage ? "center" : "start",
                    } as React.CSSProperties
                  }
                >
                  <div
                    className={[
                      "dasti-flow",
                      "dasti-forge-left-col",
                      !showComposeGridColumn && !isCompactComposeLayout
                        ? "dasti-forge-left-col--hidden"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div
                      style={composeColumnShellWidthStyle}
                      className="dasti-proposal-compose-column dasti-proposal-compose-column--workspace"
                    >
                      {shouldRenderBriefCard ? (
                        <div
                          className={[
                            "dasti-proposal-brief-stage",
                            briefCardMotionClass,
                          ]
                            .filter(Boolean)
                            .join(" ")}
                        >
                          <ProposalBriefCard
                            documentTitle={
                              proposalDocumentTitle ||
                              briefJobTitle ||
                              "Generated proposal"
                            }
                            jobDescription={briefJobDescription}
                            onToggleBrief={handleOpenComposeBrief}
                            variant={shouldShowDesktopBriefCapsule ? "compact" : "card"}
                            sourceUrl={briefSourceUrl}
                            sourcePlatform={briefSourcePlatform}
                          />
                        </div>
                      ) : null}
                      <div
                        className={[
                          "dasti-proposal-compose-panel-stage",
                          composeShellMotionClass,
                        ]
                          .filter(Boolean)
                          .join(" ")}
                        style={shouldHideComposeShell ? { display: "none" } : undefined}
                      >
                        {isLoadingHandoff ? (
                          <div style={{ paddingTop: "var(--s2)" }}>
                            <p className="dasti-hint">Loading imported job offer…</p>
                          </div>
                        ) : (
                          <ProposalInputForm
                            key={composeFormInstanceKey}
                            onStart={handleProposalStart}
                            onStop={handleProposalStop}
                            onSubmit={handleProposalSubmit}
                            onError={handleProposalError}
                            onValuesChange={handleProposalFormValuesChange}
                            onActiveCvChange={handleAttachedCvChange}
                            prefill={prefill}
                            cvPickerOpen={isCvPickerOpen}
                            onCvPickerOpenChange={setIsCvPickerOpen}
                            cvPickerRequestKey={cvPickerRequestKey}
                            suppressToneControls
                            suppressCvPicker
                            externalVoicePreset={composeToolbarVoicePreset}
                            headerLabel={null}
                            initialComposeDraft={composeDraftInitialSeed}
                            sourceUrl={briefSourceUrl}
                            sourcePlatform={briefSourcePlatform}
                            onGenerateControlChange={handleComposeGenerateControlChange}
                            headerAction={
                              hasBriefContent ? (
                                <button
                                  type="button"
                                  className="dasti-proposal-compose-shell__toggle"
                                  onClick={handleToggleComposeBrief}
                                  aria-label={
                                    isBriefExpanded ? "Collapse" : "Expand"
                                  }
                                >
                                  {isBriefExpanded ? (
                                    <X size={14} strokeWidth={1.9} aria-hidden="true" />
                                  ) : (
                                    <ChevronDown
                                      size={14}
                                      strokeWidth={1.7}
                                      aria-hidden="true"
                                    />
                                  )}
                                </button>
                              ) : null
                            }
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
                    </div>
                  </div>

                  <div className="dasti-flow">
                    <div
                      style={
                        {
                          ...stackedCardWidthStyle,
                          "--document-viewer-shell-inline-size":
                            "var(--proposal-workspace-output-shell-inline-size)",
                        } as React.CSSProperties
                      }
                      className="dasti-proposal-output-shell dasti-proposal-output-shell--workspace"
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
                      stylePreset={effectiveProposalStylePresetWithPalette}
                      railTitle={proposalApplicantName || null}
                      railMeta={proposalApplicantRole || null}
                      contactLine={proposalContactLine || null}
                      letterDate={proposalLetterDate || null}
                      recipientDetails={proposalRecipientDetails || null}
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
                      onModeChange={setProposalOutputMode}
                      showDocumentCaption={false}
                      documentTitleEditable={proposalOutputMode === "edit"}
                      onDocumentTitleChange={setProposalDocumentTitle}
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
                      onRailTitleChange={setProposalApplicantName}
                      onRailMetaChange={setProposalApplicantRole}
                      contactLineEditable={proposalOutputMode === "edit"}
                      onContactLineChange={handleProposalContactLineChange}
                      onContactLineCommit={handleProposalContactLineCommit}
                      letterDateEditable={proposalOutputMode === "edit"}
                      onLetterDateChange={setProposalLetterDate}
                      recipientDetailsEditable={proposalOutputMode === "edit"}
                      onRecipientDetailsChange={setProposalRecipientDetails}
                      salutationEditable={proposalOutputMode === "edit"}
                      salutationPlaceholder={proposalSalutationPlaceholder}
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
                      showModeToggle
                      showZoomControls
                      zoomStorageKey={null}
                      previewAnchor="top"
                      size="default"
                      documentHeaderMode="actions-only"
                      railStartAddon={
                        proposalContent && proposalOutputMode === "preview" ? (
                          <EmbeddedStyleInspector
                            stylePreset={effectiveProposalStylePresetWithPalette}
                            templateId={
                              proposalRenderMetadata?.templateId ??
                              effectiveProposalTemplateId ??
                              fallbackProposalTemplateId
                            }
                            copyMode="title-only"
                            controlMode="direct"
                            showCustomizeControl={false}
                            showPromptControl={false}
                            onSelectBundle={() => {}}
                            onSelectLayout={(layout) =>
                              applyProposalDirectStyle({
                                ...effectiveProposalStylePresetWithPalette,
                                layout,
                              })
                            }
                            onSelectTypography={(typography) =>
                              applyProposalDirectStyle({
                                ...effectiveProposalStylePresetWithPalette,
                                typography,
                              })
                            }
                            onSelectPalette={(palette) =>
                              applyProposalDirectStyle({
                                ...effectiveProposalStylePresetWithPalette,
                                palette,
                                accentHex: undefined,
                              })
                            }
                            onSelectCustomAccent={(accentHex) =>
                              applyProposalDirectStyle({
                                ...effectiveProposalStylePresetWithPalette,
                                palette: "custom",
                                accentHex,
                              })
                            }
                          />
                        ) : null
                      }
                      onCopy={() => {
                        void handleCopyOutput();
                      }}
                      copyFeedback={copyFeedback}
                      onContentChange={handleProposalContentChange}
                      onContentCommit={() => {
                        void handleProposalDocumentCommit();
                      }}
                      actions={
                        proposalContent && !loading && !error ? (
                          <span className="dasti-icon-cluster dasti-icon-cluster--tight">
                            <button
                              type="button"
                              className="dasti-icon-button"
                              aria-label="Save proposal to library"
                              data-toolbar-tooltip={
                                isSavingOutputToLibrary ? "Saving" : "Save"
                              }
                              onClick={() => {
                                handleOpenSaveDialog();
                              }}
                              disabled={isSavingOutputToLibrary}
                              style={{
                                opacity: isSavingOutputToLibrary ? 0.55 : 1,
                              }}
                            >
                              <FloppyDisk size={16} strokeWidth={1.7} />
                            </button>
                            <div className="dasti-icon-cluster__divider" />
                            {isConfirmingGeneratedDelete ? (
                              <button
                                type="button"
                                className="dasti-icon-button dasti-icon-button--confirm"
                                data-toolbar-tooltip="Confirm delete"
                                onClick={() => {
                                  void handleDeleteOutput();
                                }}
                              >
                                <Check size={14} strokeWidth={2.5} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="dasti-icon-button"
                                data-toolbar-tooltip="Delete"
                                onClick={() =>
                                  setIsConfirmingGeneratedDelete(true)
                                }
                              >
                                <Trash size={16} strokeWidth={1.5} />
                              </button>
                            )}
                            {isConfirmingGeneratedDelete ? (
                              <button
                                type="button"
                                className="dasti-icon-button"
                                data-toolbar-tooltip="Cancel"
                                onClick={() =>
                                  setIsConfirmingGeneratedDelete(false)
                                }
                              >
                                <X size={16} strokeWidth={1.8} />
                              </button>
                            ) : null}
                          </span>
                        ) : undefined
                      }
                    />
                  </div>
                </div>
              </div>
              )}
            </section>
          </div>
          </>
        )}
      </div>
      <ProposalSaveDialog
        open={isSaveDialogOpen}
        currentTitle={saveDialogTitle}
        onClose={() => setIsSaveDialogOpen(false)}
        onSave={(nextTitle) => {
          void handleSaveOutputToLibrary(nextTitle);
        }}
      />
    </div>
  );
}
