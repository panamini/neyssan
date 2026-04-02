import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  FloppyDisk,
  RotateCcw,
  Trash,
  X,
} from "@/lib/icons";
import ProposalInputForm, {
  type ProposalGenerateControl,
} from "../components/ProposalInputForm";
import { ProposalComposeToolbar } from "../components/ProposalComposeToolbar";
import { ProposalArtifactInspector } from "../components/ProposalArtifactInspector";
import { ProposalBriefCard } from "../components/ProposalBriefCard";
import ProposalSaveDialog from "../components/ProposalSaveDialog";
import ProposalDisplay, {
  fallbackCopyText,
  getDisplayedProposalText,
} from "../components/ProposalDisplay";
import ProposalsList from "../components/ProposalsList";
import { useToast } from "../components/ui/toast";
import type { FormValues } from "../components/ProposalInputForm.schemas";
import { api } from "../../convex/_generated/api";
import {
  buildAppProposalPersonalizationPayload,
  clearActiveLocalCvId,
  getProposalApplicantIdentity,
  getActiveLocalPersonalizationSource,
  getLocalActiveCvSnapshotById,
  getProposalAttachedCvId,
  getProposalAttachedCvLocalDocument,
  PROPOSAL_ATTACHED_CV_UPDATED_EVENT,
} from "../lib/proposal-personalization";
import {
  getProposalGenerationUiErrorMessage,
  type ProposalGenerationFallbackInfo,
} from "../lib/proposal-generation-ui";
import {
  readStoredProposalOutputDraft,
  resolveProposalStoredText,
  type StoredProposalOutputDraft,
  writeStoredProposalOutputDraft,
} from "../lib/proposal-output-draft";
import {
  readProposalWorkspaceResetToken,
  readStoredProposalComposeDraft,
  writeStoredProposalComposeDraft,
  type StoredProposalComposeDraft,
} from "../lib/proposal-workspace-state";
import { readStoredSavedProposalFixtures } from "../lib/proposal-saved-fixtures";
import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import {
  getProposalTwinTemplateId,
  getVerbatiStyleFromCv,
  resolveVerbatiStyle,
  serializeVerbatiStyle,
  stylesEqual,
} from "../features/verbati/style";
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
import { formatUiDate } from "../lib/ui-date";
import {
  resolveProposalStyleChoice,
  resolveProposalStyleChoiceFromRenderState,
  resolveProposalStyleRenderState,
  type ProposalStyleChoice,
} from "../lib/proposal-style-choice";
import {
  applyProposalVoiceSelection,
  buildProposalGenerationRequest,
  type ProposalGenerationRequestPayload,
} from "../lib/proposal-generation-request";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";
import type { ProposalPaletteId } from "../lib/proposal-style-display";
import {
  findProposalTemplateBundleIdByStylePreset,
  getProposalTemplateBundleDefinition,
  type ProposalTemplateBundleId,
} from "../lib/proposal-template-bundles";

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

const PROPOSAL_BRIEF_SWAP_MS = 160;
const PROPOSAL_BRIEF_SETTLE_MS = 260;
const PROPOSAL_TOOLBAR_ENTER_MS = 320;

const COMPOSE_TOOLBAR_VISIBLE_VOICE_PRESETS = new Set<
  NonNullable<FormValues["voicePreset"]>
>(["signature", "expert", "engaging"]);

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

function isProposalPaletteId(value: unknown): value is ProposalPaletteId {
  return (
    value === "sauge" ||
    value === "ocre" ||
    value === "pierre" ||
    value === "bordeaux" ||
    value === "encre"
  );
}

type GenerateProposalResult = {
  proposalId: Id<"proposals">;
  proposalContent: string;
} & Required<ProposalGenerationFallbackInfo>;

type GenerateProposalPayload = ProposalGenerationRequestPayload;

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
  const { showToast } = useToast();
  const storedOutputDraft = React.useMemo(
    () => readStoredProposalOutputDraft(),
    [],
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
  const fallbackProposalTemplateId = React.useMemo(
    () =>
      getProposalTwinTemplateId(
        storedOutputDraft?.proposalVerbatiStyle ??
          activeCvProposalStylePreset ??
          undefined,
      ),
    [activeCvProposalStylePreset, storedOutputDraft?.proposalVerbatiStyle],
  );
  const initialApplicantIdentity = React.useMemo(
    () => getProposalApplicantIdentity(getActiveLocalPersonalizationSource()),
    [],
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
    storedOutputDraft?.proposalVerbatiStyle ?? activeCvProposalStylePreset,
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
        "",
    );
  const [proposalApplicantRole, setProposalApplicantRole] =
    React.useState<string>(
      storedOutputDraft?.proposalApplicantRole ||
        initialApplicantIdentity.role ||
        "",
    );
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
  const [isSavingGeneratedProposal, setIsSavingGeneratedProposal] =
    React.useState(false);
  const [isSavingOutputToLibrary, setIsSavingOutputToLibrary] =
    React.useState(false);
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
  const draftCharacterLimitMode =
    composePreviewValues?.characterLimitMode ??
    storedOutputDraft?.characterLimitMode ??
    null;
  const draftCharacterLimitValue =
    composePreviewValues?.characterLimitValue ??
    storedOutputDraft?.characterLimitValue ??
    null;
  const [isRegeneratingGeneratedProposal, setIsRegeneratingGeneratedProposal] =
    React.useState(false);
  const [isConfirmingGeneratedDelete, setIsConfirmingGeneratedDelete] =
    React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState<"idle" | "copied">(
    "idle",
  );
  const [composeFormInstanceKey, setComposeFormInstanceKey] = React.useState(0);
  const [isCvPickerOpen, setIsCvPickerOpen] = React.useState(false);
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
  const composeGenerateTriggerRef = React.useRef<(() => void) | null>(null);
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

  React.useEffect(() => {
    hasCompletedInitialRenderRef.current = true;
  }, []);
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
  const lastStampedTemplateTokenRef = React.useRef<string | null>(null);
  const canPersistProposalState = isConvexAuthenticated && !isConvexAuthLoading;

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
    };
    pendingComposeDraftSyncRef.current = null;
    if (composeDraftSyncTimeoutRef.current !== null) {
      window.clearTimeout(composeDraftSyncTimeoutRef.current);
      composeDraftSyncTimeoutRef.current = null;
    }
    writeStoredProposalComposeDraft(nextComposeDraft);
    setComposePreviewValues(nextComposeDraft);
  }, [
    prefill?.handoffId,
    prefill?.jobDescription,
    prefill?.jobTitle,
    requestedView,
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
    () =>
      resolveProposalStyleRenderState({
        choice: proposalStyleChoice,
        jobTitle: composePreviewValues?.jobTitle ?? proposalDocumentTitle,
        jobDescription: composePreviewValues?.jobDescription,
      }),
    [
      composePreviewValues?.jobDescription,
      composePreviewValues?.jobTitle,
      proposalDocumentTitle,
      proposalStyleChoice,
    ],
  );

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
    resolvedProposalLocalStyle.stylePreset,
    resolvedProposalLocalStyle.templateId,
    resolvedStyleLinkMode,
    selectedProposalBundleDefinition,
  ]);

  const effectiveProposalStylePreset = React.useMemo(
    () =>
      resolvedStyleLinkMode === "inherit_cv" && activeCvProposalStylePreset
        ? activeCvProposalStylePreset
        : resolveVerbatiStyle(proposalStylePreset ?? undefined),
    [activeCvProposalStylePreset, proposalStylePreset, resolvedStyleLinkMode],
  );
  const effectiveProposalStylePresetWithPalette = React.useMemo(
    () => {
      if (proposalCustomAccentHex) {
        return resolveVerbatiStyle({
          ...effectiveProposalStylePreset,
          palette: "custom",
          accentHex: proposalCustomAccentHex,
        });
      }

      if (proposalPaletteOverride) {
        return resolveVerbatiStyle({
          ...effectiveProposalStylePreset,
          palette: proposalPaletteOverride,
        });
      }

      return effectiveProposalStylePreset;
    },
    [
      effectiveProposalStylePreset,
      proposalCustomAccentHex,
      proposalPaletteOverride,
    ],
  );
  const effectiveProposalTemplateId = React.useMemo(
    () =>
      resolvedStyleLinkMode === "inherit_cv" && activeCvProposalStylePreset
        ? getProposalTwinTemplateId(activeCvProposalStylePreset)
        : proposalTemplateId ??
          getProposalTwinTemplateId(effectiveProposalStylePreset),
    [
      activeCvProposalStylePreset,
      effectiveProposalStylePreset,
      proposalTemplateId,
      resolvedStyleLinkMode,
    ],
  );
  const selectedStyleBundleId = React.useMemo(
    () =>
      proposalTemplateBundleId ??
      findProposalTemplateBundleIdByStylePreset(effectiveProposalStylePreset),
    [effectiveProposalStylePreset, proposalTemplateBundleId],
  );

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
    nextMetadata.styleLinkMode = resolvedStyleLinkMode;
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
    currentProposalSettings?.templateId,
    draftCharacterLimitMode,
    draftCharacterLimitValue,
    effectiveProposalStylePresetWithPalette,
    effectiveProposalTemplateId,
    fallbackProposalTemplateId,
    proposalTemplateBundleId,
    proposalStyleChoice,
    resolvedStyleLinkMode,
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
    if (lastProposalRequest?.formalityLevel) {
      nextMetadata.formalityLevel = lastProposalRequest.formalityLevel;
    }
    if (lastProposalRequest?.creativity) {
      nextMetadata.creativity = lastProposalRequest.creativity;
    }

    return Object.keys(nextMetadata).length > 0 ? nextMetadata : undefined;
  }, [
    composePreviewValues?.jobDescription,
    lastProposalRequest?.creativity,
    lastProposalRequest?.formalityLevel,
    lastProposalRequest?.voicePreset,
    outputSourceComposeDraft?.jobDescription,
    proposalRenderMetadata,
    proposalType,
    proposalVoicePreset,
  ]);
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
      mergedProposals.set(
        String(optimisticSavedDraftProposal._id),
        optimisticSavedDraftProposal,
      );
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
  const resolvedSavedProposalStyleLinkMode =
    savedProposalStyleLinkMode === "inherit_cv" && activeCvProposalStylePreset
      ? "inherit_cv"
      : "proposal_local";
  const effectiveSavedProposalStylePreset = React.useMemo(
    () =>
      resolvedSavedProposalStyleLinkMode === "inherit_cv" &&
      activeCvProposalStylePreset
        ? activeCvProposalStylePreset
        : resolveVerbatiStyle(savedProposalStylePreset ?? undefined),
    [
      activeCvProposalStylePreset,
      resolvedSavedProposalStyleLinkMode,
      savedProposalStylePreset,
    ],
  );
  const effectiveSavedProposalTemplateId = React.useMemo(
    () =>
      resolvedSavedProposalStyleLinkMode === "inherit_cv" &&
      activeCvProposalStylePreset
        ? getProposalTwinTemplateId(activeCvProposalStylePreset)
        : savedProposalTemplateId ??
          getProposalTwinTemplateId(effectiveSavedProposalStylePreset),
    [
      activeCvProposalStylePreset,
      effectiveSavedProposalStylePreset,
      resolvedSavedProposalStyleLinkMode,
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
      templateId: effectiveSavedProposalTemplateId,
      verbatiStyle: serializeVerbatiStyle(effectiveSavedProposalStylePreset),
      styleLinkMode: resolvedSavedProposalStyleLinkMode,
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
    resolvedSavedProposalStyleLinkMode,
    savedProposalType,
    savedProposalVoicePreset,
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
    const nextStylePreset =
      activeCvProposalStylePreset ?? resolveVerbatiStyle(undefined);
    const nextTemplateId = getProposalTwinTemplateId(nextStylePreset);
    const nextStyleChoice = activeCvProposalStylePreset ? "auto" : "balanced";

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
    setProposalApplicantName(initialApplicantIdentity.name || "");
    setProposalApplicantRole(initialApplicantIdentity.role || "");
    setProposalDocumentTitle("");
    setProposalDocumentMeta("");
    setFallbackInfo(null);
    setGeneratedProposalId(null);
    setProposalOutputMode("preview");
    setComposePreviewValues(null);
    setOutputSourceComposeDraft(null);
    setComposeDraftInitialSeed(null);
    setIsSavingGeneratedProposal(false);
    setIsSavingOutputToLibrary(false);
    setLastProposalRequest(null);
    setIsRegeneratingGeneratedProposal(false);
    setIsConfirmingGeneratedDelete(false);
    setIsCvPickerOpen(false);
    setIsComposePanelVisible(true);
    setIsBriefExpanded(true);
    setCopyFeedback("idle");
    lastSavedProposalContentRef.current = null;
    lastSavedProposalTitleRef.current = "";
    lastStampedTemplateTokenRef.current = null;
  }, [
    activeCvProposalStylePreset,
    cancelPendingComposeDraftSync,
    currentProposalSettings?.savedVoicePreset,
    initialApplicantIdentity.name,
    initialApplicantIdentity.role,
  ]);

  React.useEffect(() => {
    if (!proposalWorkspaceResetToken) {
      return;
    }

    setComposeFormInstanceKey((currentKey) => currentKey + 1);
    resetProposalWorkspace();
    void navigate("/proposal", { replace: true });
  }, [navigate, proposalWorkspaceResetToken, resetProposalWorkspace]);

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
    (values: FormValues): StoredProposalComposeDraft => ({
      jobTitle: values.jobTitle,
      jobDescription: values.jobDescription,
      proposalType: values.proposalType,
      voicePreset: values.voicePreset ?? null,
      toneTuning: values.toneTuning ?? null,
      characterLimitMode: values.characterLimitMode ?? null,
      characterLimitValue: values.characterLimitValue ?? null,
    }),
    [],
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
      setSavedProposalStylePreset(activeCvProposalStylePreset);
      setSavedProposalDocumentTitle("");
      setSavedProposalDocumentMeta("");
      setSavedProposalOutputMode("preview");
      return;
    }

    const storedRenderState = resolveProposalRenderState({
      storedTemplateId: openedSavedProposal.metadata?.templateId,
      storedStylePreset: openedSavedProposal.metadata?.verbatiStyle,
      activeCvStylePreset: activeCvProposalStylePreset,
    });
    const nextVoicePreset =
      openedSavedProposal.metadata?.resolvedVoicePreset ??
      openedSavedProposal.metadata?.voicePreset ??
      DEFAULT_PROPOSAL_VOICE_PRESET;
    const nextProposalType = openedSavedProposal.metadata?.proposalType ?? null;

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
    activeCvProposalStylePreset,
    buildProposalToneMetaLabel,
    formatProposalToneLabel,
    formatProposalTypeLabel,
    openedSavedProposal,
  ]);

  const handleToolbarCvPickerToggle = React.useCallback(() => {
    setIsCvPickerOpen((current) => !current);
    setCvPickerRequestKey((currentKey) => currentKey + 1);
  }, []);

  const handleToolbarVoicePresetChange = React.useCallback(
    (preset: FormValues["voicePreset"] | null) => {
      setComposeToolbarVoicePreset(preset);
    },
    [],
  );

  const handleTemplateBundleChange = React.useCallback(
    (nextBundleId: ProposalTemplateBundleId | null) => {
      if (nextBundleId === null) {
        setProposalTemplateBundleId(null);
        setProposalPaletteOverride(null);
        setProposalCustomAccentHex(null);
        setProposalStyleChoice(activeCvProposalStylePreset ? "auto" : "balanced");
        setProposalStyleLinkMode(
          activeCvProposalStylePreset ? "inherit_cv" : "proposal_local",
        );
        return;
      }

      setProposalTemplateBundleId(nextBundleId);
      setProposalStyleLinkMode("proposal_local");

      const nextBundleDefinition =
        getProposalTemplateBundleDefinition(nextBundleId);
      setProposalStyleChoice(
        resolveProposalStyleChoiceFromRenderState({
          templateId: nextBundleDefinition.templateId,
          stylePreset: nextBundleDefinition.stylePreset,
        }) ?? "auto",
      );
    },
    [activeCvProposalStylePreset],
  );

  const handlePaletteOverrideChange = React.useCallback(
    (nextPalette: ProposalPaletteId | null) => {
      setProposalPaletteOverride(nextPalette);
      if (nextPalette) {
        setProposalStyleLinkMode("proposal_local");
        setProposalCustomAccentHex(null);
      } else if (!proposalTemplateBundleId && activeCvProposalStylePreset) {
        setProposalStyleLinkMode("inherit_cv");
      }
    },
    [activeCvProposalStylePreset, proposalTemplateBundleId],
  );

  const handleCustomAccentHexChange = React.useCallback(
    (nextHex: string | null) => {
      setProposalCustomAccentHex(nextHex);
      if (nextHex) {
        setProposalStyleLinkMode("proposal_local");
        setProposalPaletteOverride(null);
      } else if (!proposalTemplateBundleId && activeCvProposalStylePreset) {
        setProposalStyleLinkMode("inherit_cv");
      }
    },
    [activeCvProposalStylePreset, proposalTemplateBundleId],
  );

  const handleProposalStart = React.useCallback(
    (values: FormValues) => {
      cancelPendingComposeDraftSync();
      setComposePreviewValues(buildStoredProposalComposeDraftSnapshot(values));
      const applicantIdentity = getProposalApplicantIdentity(
        getActiveLocalPersonalizationSource(),
      );
      const resolvedVoicePreset = resolveProposalVoicePreset(values);
      setLastProposalRequest(values);
      setLoading(true);
      setProposalType(values.proposalType);
      setProposalVoicePreset(resolvedVoicePreset);
      setProposalApplicantName(applicantIdentity.name ?? "");
      setProposalApplicantRole(applicantIdentity.role ?? "");
      setProposalDocumentTitle(
        values.jobTitle.trim() || formatProposalTypeLabel(values.proposalType),
      );
      setProposalDocumentMeta(
        [
          formatProposalTypeLabel(values.proposalType),
          buildProposalToneMetaLabel(values.voicePreset, resolvedVoicePreset),
        ].join(" · "),
      );
      setProposalContent(null);
      setGeneratedProposalId(null);
      setProposalOutputMode("preview");
      setIsComposePanelVisible(true);
      setIsBriefExpanded(true);
      setStatusMessage(null);
      setError(null);
      setErrorDetail(null);
      setFallbackInfo(null);
    },
    [
      buildProposalToneMetaLabel,
      buildStoredProposalComposeDraftSnapshot,
      cancelPendingComposeDraftSync,
      formatProposalToneLabel,
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
      const applicantIdentity = getProposalApplicantIdentity(
        getActiveLocalPersonalizationSource(),
      );
      const resolvedVoicePreset = resolveProposalVoicePreset(values);
      const submittedComposeDraft =
        buildStoredProposalComposeDraftSnapshot(values);
      const nextDocumentTitle =
        values.jobTitle.trim() || formatProposalTypeLabel(values.proposalType);
      const nextDocumentMeta = [
        formatProposalTypeLabel(values.proposalType),
        buildProposalToneMetaLabel(values.voicePreset, resolvedVoicePreset),
      ].join(" · ");
      writeStoredProposalComposeDraft(submittedComposeDraft);
      setComposePreviewValues(submittedComposeDraft);
      setOutputSourceComposeDraft(submittedComposeDraft);
      setComposeDraftInitialSeed(submittedComposeDraft);
      writeStoredProposalOutputDraft({
        proposalContent: proposal,
        proposalType: values.proposalType,
        proposalVoicePreset: resolvedVoicePreset,
        proposalTemplateId:
          effectiveProposalTemplateId ?? fallbackProposalTemplateId,
        proposalVerbatiStyle: serializeVerbatiStyle(
          effectiveProposalStylePresetWithPalette,
        ),
        proposalStyleLinkMode: resolvedStyleLinkMode,
        proposalStyleChoice,
        proposalApplicantName: applicantIdentity.name ?? "",
        proposalApplicantRole: applicantIdentity.role ?? "",
        proposalDocumentTitle: nextDocumentTitle,
        proposalDocumentMeta: nextDocumentMeta,
        generatedProposalId: nextProposalId ?? null,
        proposalOutputMode: "preview",
        paletteOverride: proposalPaletteOverride,
        customAccentHex: proposalCustomAccentHex,
        templateBundleId: proposalTemplateBundleId,
        typographyOverride: null,
        layoutOverride: null,
        proposalDocumentTitleManual: false,
        characterLimitMode: values.characterLimitMode ?? null,
        characterLimitValue: values.characterLimitValue ?? null,
        sourceComposeDraft: submittedComposeDraft,
      });
      setLastProposalRequest(values);
      setProposalType(values.proposalType);
      setProposalVoicePreset(resolvedVoicePreset);
      setProposalApplicantName(applicantIdentity.name ?? "");
      setProposalApplicantRole(applicantIdentity.role ?? "");
      setProposalDocumentTitle(nextDocumentTitle);
      setProposalDocumentMeta(nextDocumentMeta);
      setProposalContent(proposal);
      setGeneratedProposalId(nextProposalId ?? null);
      setProposalOutputMode("preview");
      setIsComposePanelVisible(true);
      setIsBriefExpanded(false);
      lastSavedProposalContentRef.current = proposal;
      lastSavedProposalTitleRef.current = nextDocumentTitle;
      setIsConfirmingGeneratedDelete(false);
      setStatusMessage(null);
      setError(null);
      setFallbackInfo(nextFallbackInfo ?? null);
      setLoading(false);
    },
    [
      buildProposalToneMetaLabel,
      cancelPendingComposeDraftSync,
      effectiveProposalStylePresetWithPalette,
      effectiveProposalTemplateId,
      fallbackProposalTemplateId,
      buildStoredProposalComposeDraftSnapshot,
      formatProposalToneLabel,
      formatProposalTypeLabel,
      proposalCustomAccentHex,
      proposalPaletteOverride,
      proposalTemplateBundleId,
      proposalStyleChoice,
      resolvedStyleLinkMode,
      resolveProposalVoicePreset,
    ],
  );

  const handleProposalError = React.useCallback(
    (message: string, values: FormValues, rawReason?: string | null) => {
      cancelPendingComposeDraftSync();
      setComposePreviewValues(buildStoredProposalComposeDraftSnapshot(values));
      const applicantIdentity = getProposalApplicantIdentity(
        getActiveLocalPersonalizationSource(),
      );
      const resolvedVoicePreset = resolveProposalVoicePreset(values);
      setLastProposalRequest(values);
      setLoading(false);
      setProposalType(values.proposalType);
      setProposalVoicePreset(resolvedVoicePreset);
      setProposalApplicantName(applicantIdentity.name ?? "");
      setProposalApplicantRole(applicantIdentity.role ?? "");
      setProposalDocumentTitle(
        values.jobTitle.trim() || formatProposalTypeLabel(values.proposalType),
      );
      setProposalDocumentMeta(
        [
          formatProposalTypeLabel(values.proposalType),
          buildProposalToneMetaLabel(values.voicePreset, resolvedVoicePreset),
        ].join(" · "),
      );
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
      buildProposalToneMetaLabel,
      buildStoredProposalComposeDraftSnapshot,
      cancelPendingComposeDraftSync,
      formatProposalToneLabel,
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

  const handleProposalStop = React.useCallback(() => {
    setLoading(false);
    setProposalContent(null);
    setGeneratedProposalId(null);
    setProposalOutputMode("preview");
    setOutputSourceComposeDraft(null);
    setIsComposePanelVisible(true);
    setIsBriefExpanded(true);
    setError(null);
    setStatusMessage("Generation stopped.");
    setErrorDetail(null);
    setFallbackInfo(null);
    setIsConfirmingGeneratedDelete(false);
  }, []);

  const handleProposalDocumentCommit = React.useCallback(async () => {
    if (
      !generatedProposalId ||
      isSavingGeneratedProposal ||
      !canPersistProposalState
    )
      return;
    const trimmed = proposalContent?.trim() ?? "";
    const normalizedTitle =
      proposalDocumentTitle.trim() ||
      (proposalType
        ? formatProposalTypeLabel(proposalType)
        : "Generated proposal");
    const lastSavedTrimmed = lastSavedProposalContentRef.current?.trim() ?? "";
    const lastSavedTitle = lastSavedProposalTitleRef.current.trim();
    const titleChanged = normalizedTitle !== lastSavedTitle;
    const contentChanged = Boolean(trimmed) && trimmed !== lastSavedTrimmed;
    if (!titleChanged && !contentChanged) return;
    if (!trimmed && !titleChanged) return;

    if (proposalDocumentTitle !== normalizedTitle) {
      setProposalDocumentTitle(normalizedTitle);
    }

    setIsSavingGeneratedProposal(true);
    try {
      await updateProposal({
        id: generatedProposalId,
        title: normalizedTitle,
        metadata: proposalPersistenceMetadata,
        ...(trimmed
          ? {
              content: trimmed,
              sections: [{ type: "text", content: trimmed }],
            }
          : {}),
      });
      if (trimmed) {
        lastSavedProposalContentRef.current = trimmed;
      }
      lastSavedProposalTitleRef.current = normalizedTitle;
    } catch (saveError) {
      console.error("Failed to persist generated proposal edits:", saveError);
      const errorMessage =
        saveError instanceof Error ? saveError.message : String(saveError);
      if (errorMessage.includes("Proposal not found")) {
        // The stored draft id is stale (deleted/expired). Keep local content
        // and stop retrying invalid mutations until a fresh generation happens.
        setGeneratedProposalId(null);
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
    } finally {
      setIsSavingGeneratedProposal(false);
    }
  }, [
    generatedProposalId,
    isSavingGeneratedProposal,
    canPersistProposalState,
    proposalContent,
    proposalDocumentTitle,
    proposalPersistenceMetadata,
    proposalType,
    formatProposalTypeLabel,
    showToast,
    updateProposal,
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

    const hasDraft =
      Boolean(proposalContent) ||
      Boolean(proposalDocumentTitle) ||
      Boolean(proposalDocumentMeta) ||
      Boolean(generatedProposalId);
    const hasPersistableOutput =
      proposalContent !== null || Boolean(generatedProposalId);

    if (!hasDraft) {
      if (hasCompletedInitialRenderRef.current) {
        writeStoredProposalOutputDraft(null);
      }
      return;
    }

    if (!hasPersistableOutput) {
      return;
    }

    writeStoredProposalOutputDraft({
      proposalContent,
      proposalType,
      proposalVoicePreset,
      proposalTemplateId: effectiveProposalTemplateId,
      proposalVerbatiStyle: effectiveProposalStylePresetWithPalette
        ? serializeVerbatiStyle(effectiveProposalStylePresetWithPalette)
        : null,
      proposalStyleLinkMode: resolvedStyleLinkMode,
      proposalStyleChoice,
      proposalApplicantName,
      proposalApplicantRole,
      proposalDocumentTitle,
      proposalDocumentMeta,
      generatedProposalId,
      proposalOutputMode,
      paletteOverride: proposalPaletteOverride,
      customAccentHex: proposalCustomAccentHex,
      templateBundleId: proposalTemplateBundleId,
      typographyOverride: null,
      layoutOverride: null,
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
    proposalDocumentMeta,
    proposalDocumentTitle,
    proposalOutputMode,
    proposalStyleChoice,
    effectiveProposalStylePresetWithPalette,
    proposalCustomAccentHex,
    proposalPaletteOverride,
    proposalTemplateBundleId,
    resolvedStyleLinkMode,
    draftCharacterLimitMode,
    draftCharacterLimitValue,
    effectiveProposalTemplateId,
    proposalType,
    proposalVoicePreset,
  ]);

  React.useEffect(() => {
    if (!proposalContent) {
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
  }, [proposalContent, proposalType, showToast]);

  React.useEffect(() => {
    if (
      !generatedProposalId ||
      !proposalPersistenceMetadata ||
      !canPersistProposalState
    ) {
      return;
    }

    const nextToken = `${generatedProposalId}:${JSON.stringify(
      proposalPersistenceMetadata,
    )}`;
    if (lastStampedTemplateTokenRef.current === nextToken) {
      return;
    }

    lastStampedTemplateTokenRef.current = nextToken;

    void updateProposal({
      id: generatedProposalId,
      metadata: proposalPersistenceMetadata,
    }).catch((error) => {
      console.warn("Failed to persist proposal template metadata:", error);
      lastStampedTemplateTokenRef.current = null;
    });
  }, [
    canPersistProposalState,
    generatedProposalId,
    proposalPersistenceMetadata,
    updateProposal,
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
    setProposalStyleLinkMode(resolvedSavedProposalStyleLinkMode);
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
    setProposalTemplateBundleId(restoredTemplateBundleId);
    setProposalPaletteOverride(restoredPaletteOverride);
    setProposalCustomAccentHex(restoredCustomAccentHex);
    setProposalDocumentTitle(savedProposalDocumentTitle);
    setProposalDocumentMeta(savedProposalDocumentMeta);
    setGeneratedProposalId(null);
    setProposalOutputMode(savedProposalOutputMode);
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
    resolvedSavedProposalStyleLinkMode,
    savedProposalContent,
    savedProposalDocumentMeta,
    savedProposalDocumentTitle,
    savedProposalOutputMode,
    savedProposalType,
    savedProposalVoicePreset,
    showToast,
    updateProposalRoute,
  ]);

  const handleRegenerateOutput = React.useCallback(
    async (voiceOverride?: FormValues["voicePreset"] | null) => {
      if (!lastProposalRequest || isRegeneratingGeneratedProposal) {
        return;
      }

      const currentActiveCvSource = getActiveLocalPersonalizationSource();
      const hasCandidateContext = Boolean(
        currentActiveCvSource.personalizationContext,
      );
      const requestWithVoice = applyProposalVoiceSelection(
        lastProposalRequest,
        voiceOverride === undefined ? composeToolbarVoicePreset : voiceOverride,
      );
      const requestPayload = buildProposalGenerationRequest(
        requestWithVoice,
        buildAppProposalPersonalizationPayload(currentActiveCvSource),
      );

      try {
        setIsRegeneratingGeneratedProposal(true);
        setLoading(true);
        setError(null);
        setStatusMessage(null);
        setErrorDetail(null);
        setFallbackInfo(null);

        const result = await (
          generateProposalAction as unknown as (
            input: GenerateProposalPayload,
          ) => Promise<GenerateProposalResult | null>
        )(requestPayload);

        if (!result) {
          const nextErrorMessage = "No proposal returned from the server.";
          handleProposalError(nextErrorMessage, requestWithVoice);
          return;
        }

        try {
          if (canPersistProposalState) {
            await updateProposal({
              id: result.proposalId,
              content: result.proposalContent,
              sections: [{ type: "text", content: result.proposalContent }],
              status: "draft",
              metadata: proposalRenderMetadata,
            });
          }
        } catch (saveErr) {
          console.warn(
            "Failed to update regenerated proposal status:",
            saveErr,
          );
        }

        handleProposalSubmit(
          requestWithVoice,
          result.proposalContent,
          {
            requestedModelType: result.requestedModelType,
            actualModelType: result.actualModelType,
            fallbackTriggerCode: result.fallbackTriggerCode,
          },
          result.proposalId,
        );
        showToast("Proposal refined", { variant: "success" });
      } catch (regenerateError) {
        const nextErrorMessage = getProposalGenerationUiErrorMessage({
          error: regenerateError,
          proposalType: requestWithVoice.proposalType,
          hasCandidateContext,
        });
        const rawReason =
          regenerateError instanceof Error ? regenerateError.message : null;
        handleProposalError(nextErrorMessage, requestWithVoice, rawReason);
        showToast("Refinement failed", {
          variant: "error",
          description: nextErrorMessage,
        });
      } finally {
        setLoading(false);
        setIsRegeneratingGeneratedProposal(false);
      }
    },
    [
      generateProposalAction,
      handleProposalError,
      handleProposalSubmit,
      canPersistProposalState,
      isRegeneratingGeneratedProposal,
      lastProposalRequest,
      composeToolbarVoicePreset,
      proposalRenderMetadata,
      showToast,
      updateProposal,
    ],
  );

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
      setProposalApplicantName("");
      setProposalApplicantRole("");
      setProposalDocumentTitle("");
      setProposalDocumentMeta("");
      setGeneratedProposalId(null);
      setProposalOutputMode("preview");
      setComposePreviewValues(null);
      setOutputSourceComposeDraft(null);
      setFallbackInfo(null);
      setError(null);
      setStatusMessage(null);
      setErrorDetail(null);
      setIsConfirmingGeneratedDelete(false);
      lastSavedProposalContentRef.current = null;
      lastStampedTemplateTokenRef.current = null;
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
    if (
      !proposalContent ||
      isSavingOutputToLibrary ||
      isSavingGeneratedProposal
    ) {
      return;
    }
    if (!canPersistProposalState) {
      showConvexAuthRequiredToast("Save");
      return;
    }

    setIsSaveDialogOpen(true);
  }, [
    canPersistProposalState,
    isSavingGeneratedProposal,
    isSavingOutputToLibrary,
    proposalContent,
    showConvexAuthRequiredToast,
  ]);

  const handleSaveOutputToLibrary = React.useCallback(async (requestedTitle: string) => {
    if (
      !proposalContent ||
      isSavingOutputToLibrary ||
      isSavingGeneratedProposal
    ) {
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
      const persistedProposalId =
        generatedProposalId ??
        (await createProposal({
          title: normalizedTitle,
          content: trimmed,
          sections: [{ type: "text", content: trimmed }],
          status: "saved",
          metadata: proposalPersistenceMetadata,
        }));

      if (generatedProposalId) {
        await updateProposal({
          id: generatedProposalId,
          title: normalizedTitle,
          content: trimmed,
          sections: [{ type: "text", content: trimmed }],
          status: "saved",
          metadata: proposalPersistenceMetadata,
        });
      } else {
        setGeneratedProposalId(persistedProposalId);
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
    createProposal,
    isSavingGeneratedProposal,
    isSavingOutputToLibrary,
    proposalContent,
    proposalDocumentTitle,
    proposalPersistenceMetadata,
    proposalType,
    formatProposalTypeLabel,
    generatedProposalId,
    showConvexAuthRequiredToast,
    showToast,
    updateProposal,
    navigate,
    search,
  ]);

  const isSavedView = requestedView === "saved";
  const proposalDesktopComposeWidthPx = 480;
  const proposalDesktopComposeWidth = `${proposalDesktopComposeWidthPx}px`;
  const proposalTwoPaneMinViewportWidth = 1440;
  const proposalWorkspaceOutputShellInlineSize =
    "calc(var(--document-sheet-inline-size) - (var(--s4) * 2))";
  const proposalWorkspaceShellBlockSize =
    "min(var(--document-viewer-shell-max-block), calc(100dvh - var(--header-height) - (var(--space-2) * 2) - (var(--document-viewer-toolbar-block-size) + var(--space-2))))";
  const isCompactComposeLayout =
    viewportWidth < proposalTwoPaneMinViewportWidth;
  const proposalComposeColumnInlineSize = isCompactComposeLayout
    ? "560px"
    : proposalDesktopComposeWidth;
  const showComposePanel = isComposePanelVisible && !isSavedView;
  const briefJobDescription =
    composePreviewValues?.jobDescription?.trim() ||
    prefill?.jobDescription?.trim() ||
    (typeof window !== "undefined"
      ? readStoredProposalComposeDraft()?.jobDescription?.trim() || ""
      : "");
  const hasBriefContent = Boolean(briefJobDescription);
  const showBriefCard =
    Boolean(proposalContent) && !isBriefExpanded && showComposePanel;
  const shouldShowDesktopBriefCapsule =
    showBriefCard && !isCompactComposeLayout;
  const shouldLeftAnchorStackedWorkbench =
    isCompactComposeLayout && viewportWidth >= 768;
  const canCollapseComposePanel = !isSavedView && !isCompactComposeLayout;
  const isNarrowLaptop = viewportWidth < 1360;
  const shouldCenterOutputStage =
    !isSavedView &&
    !isComposePanelVisible &&
    !isCompactComposeLayout &&
    !shouldShowDesktopBriefCapsule;
  const isLoadingHandoff =
    Boolean(handoffId) &&
    (isConvexAuthLoading ||
      (isConvexAuthenticated && handoffRecord === undefined));
  const shouldShowCollapsedComposeToolbar =
    !isComposePanelVisible && !isSavedView && canCollapseComposePanel;
  const liveWorkbenchMaxWidth = isCompactComposeLayout
    ? "560px"
    : shouldCenterOutputStage
      ? "860px"
      : `calc(${proposalDesktopComposeWidth} + var(--proposal-workspace-output-shell-inline-size) + var(--layout-card-grid))`;
  const toolbarWorkbenchMaxWidth =
    shouldShowCollapsedComposeToolbar && !isCompactComposeLayout
      ? `calc(${proposalDesktopComposeWidth} + var(--proposal-workspace-output-shell-inline-size) + var(--layout-card-grid))`
      : liveWorkbenchMaxWidth;

  const stackedCardWidthStyle: React.CSSProperties = isCompactComposeLayout
    ? { width: "min(100%, 560px)", minWidth: 0 }
    : { width: "100%", minWidth: 0 };
  const proposalToolbarWidthStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: isCompactComposeLayout ? "560px" : proposalDesktopComposeWidth,
    minWidth: 0,
  };
  const proposalWorkbenchFrameStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: liveWorkbenchMaxWidth,
    marginInline:
      shouldLeftAnchorStackedWorkbench || shouldShowDesktopBriefCapsule
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
    maxWidth: toolbarWorkbenchMaxWidth,
    marginInline:
      shouldLeftAnchorStackedWorkbench || shouldShowDesktopBriefCapsule
        ? 0
        : "auto",
    minWidth: 0,
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
      if (briefSettleTimerRef.current !== null) {
        window.clearTimeout(briefSettleTimerRef.current);
      }
      setBriefAnimationPhase(phase);
      briefSettleTimerRef.current = window.setTimeout(() => {
        setBriefAnimationPhase("idle");
        briefSettleTimerRef.current = null;
      }, PROPOSAL_BRIEF_SETTLE_MS);
    },
    [],
  );

  const triggerToolbarEnterTransition = React.useCallback(() => {
    if (toolbarTransitionTimerRef.current !== null) {
      window.clearTimeout(toolbarTransitionTimerRef.current);
    }
    setToolbarTransitionState("entering");
    toolbarTransitionTimerRef.current = window.setTimeout(() => {
      setToolbarTransitionState(null);
      toolbarTransitionTimerRef.current = null;
    }, PROPOSAL_TOOLBAR_ENTER_MS);
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
    }, PROPOSAL_BRIEF_SWAP_MS);
  }, [
    clearBriefAnimationTimers,
    scheduleBriefAnimationSettle,
    shouldAnimateDesktopBriefTransition,
    showBriefCard,
  ]);
  const handleToggleComposeBrief = React.useCallback(() => {
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

    if (isBriefExpanded) {
      setBriefAnimationPhase("form-exit");
      briefSwapTimerRef.current = window.setTimeout(() => {
        setIsBriefExpanded(false);
        scheduleBriefAnimationSettle("brief-enter");
        briefSwapTimerRef.current = null;
      }, PROPOSAL_BRIEF_SWAP_MS);
      return;
    }

    pendingComposeBriefFocusRef.current = true;
    setIsCvPickerOpen(false);
    setBriefAnimationPhase("brief-exit");
    briefSwapTimerRef.current = window.setTimeout(() => {
      setIsBriefExpanded(true);
      scheduleBriefAnimationSettle("form-enter");
      briefSwapTimerRef.current = null;
    }, PROPOSAL_BRIEF_SWAP_MS);
  }, [
    clearBriefAnimationTimers,
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

  const proposalWorkbenchToolbar = shouldShowCollapsedComposeToolbar ? (
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
        className="dasti-page-shell"
        style={
          {
            "--page-shell-max-width": isSavedView
              ? isCompactComposeLayout
                ? "860px"
                : isNarrowLaptop
                  ? "1180px"
                  : "1380px"
              : "100%",
            "--page-shell-gap": isSavedView
              ? "var(--layout-panel-stack)"
              : "var(--space-2)",
            "--page-shell-pad-top": "var(--space-2)",
          } as React.CSSProperties
        }
      >
        {isSavedView ? (
          <section aria-hidden={false}>
            <div className="dasti-workbench-top-left-slot dasti-workbench-top-left-slot--proposal">
              <div className="dasti-cv-workbench-bar">
                <div
                  className="dasti-proposal-saved-view-toolbar"
                  role="group"
                  aria-label="Saved proposal actions"
                >
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
                    <Copy size={16} strokeWidth={1.7} />
                  </button>
                </div>
              </div>
            </div>
            <ProposalsList
              selectedProposalId={selectedProposalId}
              onSelectedProposalIdChange={(id) =>
                updateProposalRoute("saved", id)
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
                  style={stackedCardWidthStyle}
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
                          proposalDocumentTitle || "Generated proposal"
                        }
                        jobDescription={briefJobDescription}
                        onToggleBrief={handleOpenComposeBrief}
                        variant={shouldShowDesktopBriefCapsule ? "compact" : "card"}
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
                                <ChevronDown
                                  size={14}
                                  strokeWidth={1.7}
                                  aria-hidden="true"
                                />
                              ) : (
                                <ChevronUp
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
                    fallbackInfo={fallbackInfo}
                    documentTitle={
                      proposalDocumentTitle || "Generated proposal"
                    }
                    documentMeta={proposalDocumentMeta || "Compose output"}
                    mode={proposalOutputMode}
                    onModeChange={setProposalOutputMode}
                    characterLimit={activeCharacterLimitSelection.value}
                    characterLimitAdvisory={
                      activeCharacterLimitSelection.advisory
                    }
                    showModeToggle
                    showZoomControls
                    zoomStorageKey={null}
                    previewAnchor="top"
                    size="default"
                    documentHeaderMode="hidden"
                    railStartAddon={
                      proposalContent ? (
                        <ProposalArtifactInspector
                          variant="header"
                          styleBundleId={selectedStyleBundleId}
                          onStyleBundleChange={handleTemplateBundleChange}
                          paletteOverride={proposalPaletteOverride}
                          onPaletteOverrideChange={handlePaletteOverrideChange}
                          customAccentHex={proposalCustomAccentHex}
                          onCustomAccentHexChange={handleCustomAccentHexChange}
                          resolvedPaletteId={
                            effectiveProposalStylePresetWithPalette.palette ===
                            "custom"
                              ? null
                              : effectiveProposalStylePresetWithPalette.palette
                          }
                          hasGenerated={Boolean(proposalContent)}
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
                            aria-label="Refine proposal"
                            data-toolbar-tooltip={
                              isRegeneratingGeneratedProposal
                                ? "Refining"
                                : "Refine"
                            }
                            onClick={() => {
                              void handleRegenerateOutput();
                            }}
                            disabled={
                              isRegeneratingGeneratedProposal ||
                              !proposalContent ||
                              loading ||
                              !lastProposalRequest
                            }
                            style={{
                              opacity: isRegeneratingGeneratedProposal ? 0.55 : 1,
                            }}
                          >
                            <RotateCcw size={16} strokeWidth={1.7} />
                          </button>
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
