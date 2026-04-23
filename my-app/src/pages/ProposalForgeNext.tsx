import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FloppyDisk,
  RotateCcw,
  Trash,
  X,
} from "@/lib/icons";
import ProposalInputForm from "../components/ProposalInputForm";
import ProposalDisplay, {
  fallbackCopyText,
  getDisplayedProposalText,
} from "../components/ProposalDisplay";
import { ProposalBriefCard } from "../components/ProposalBriefCard";
import { ProposalArtifactInspector } from "../components/ProposalArtifactInspector";
import { ProposalComposeToolbar } from "../components/ProposalComposeToolbar";
import { useToast } from "../components/ui/toast";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import type { FormValues } from "../components/ProposalInputForm.schemas";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import {
  buildAppProposalPersonalizationPayload,
  clearActiveLocalCvId,
  getActiveLocalPersonalizationSource,
  getProposalApplicantHeaderData,
  getProposalApplicantIdentity,
  listLocalCvPickerOptions,
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
  PROPOSAL_WORKSPACE_RESET_STATE_KEY,
  readProposalWorkspaceResetToken,
} from "../lib/proposal-workspace-state";
import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  type ProposalVoicePreset,
} from "../../convex/lib/proposals/voicePresets";
import { selectAutoTone } from "../../convex/lib/proposals/autoToneSelector";
import {
  applyProposalVoiceSelection,
  buildProposalGenerationRequest,
  type ProposalGenerationRequestPayload,
} from "../lib/proposal-generation-request";
import {
  findProposalTemplateBundleIdByStylePreset,
  getProposalTemplateBundleDefinition,
  type ProposalTemplateBundleId,
} from "../lib/proposal-template-bundles";
import {
  getProposalTwinTemplateId,
  getVerbatiStyleFromCv,
  serializeVerbatiStyle,
} from "../features/verbati/style";
import {
  resolveProposalCharacterLimitSelection,
  PROPOSAL_CHARACTER_LIMIT_TOAST_THRESHOLDS,
} from "../../convex/lib/proposals/generationControls";
import { resolveProposalRenderState } from "../lib/proposal-render-state";
import { type ProposalPaletteId } from "../lib/proposal-style-display";
import { type ProposalStyleChoice } from "../lib/proposal-style-choice";
import { buildProposalSourceSummary } from "../lib/proposal-source-summary";

type ProposalForgePrefill = {
  handoffId: string;
  jobTitle: string;
  jobDescription: string;
  sourceUrl?: string;
  platform?: string;
} | null;

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
  styleChoice?: ProposalStyleChoice;
  templateBundleId?: ProposalTemplateBundleId;
  characterLimitMode?: FormValues["characterLimitMode"];
  characterLimitValue?: number | null;
};

type GenerateProposalResult = {
  proposalId: Id<"proposals">;
  proposalContent: string;
} & Required<ProposalGenerationFallbackInfo>;

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
  metadata?: ProposalDocumentMetadata & {
    requestedModelType?: string;
    actualModelType?: string;
    fallbackTriggerCode?: string;
    accentHex?: string | null;
    paletteOverride?: ProposalPaletteId | null;
  };
};

function isProposalPaletteId(value: unknown): value is ProposalPaletteId {
  return (
    value === "sauge" ||
    value === "ocre" ||
    value === "pierre" ||
    value === "bordeaux" ||
    value === "encre"
  );
}

function inferSavedProposalType(
  content: string | undefined,
): FormValues["proposalType"] {
  if (!content) return "cover_letter";
  const normalized = content.trim();
  if (!normalized) return "cover_letter";
  if (/(^|\n)\s{0,3}(#|[-*]\s|\d+\.\s)/m.test(normalized)) {
    return "freelance_proposal";
  }
  const lines = normalized
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const firstLine = lines[0] ?? "";
  const wordCount = normalized.split(/\s+/).filter(Boolean).length;
  if (/^(dear|hello|hi)\b/i.test(firstLine)) return "cover_letter";
  if (wordCount <= 120) return "application_message";
  return "cover_letter";
}

function resolveSavedAppearanceState(proposal: SavedProposalRecord | null): {
  bundleId: ProposalTemplateBundleId | null;
  paletteOverride: ProposalPaletteId | null;
  customAccentHex: string | null;
} {
  if (!proposal) {
    return {
      bundleId: null,
      paletteOverride: null,
      customAccentHex: null,
    };
  }

  const storedStyle = proposal.metadata?.verbatiStyle ?? null;
  const derivedBundleId =
    normalizeProposalNextBundleId(proposal.metadata?.templateBundleId) ??
    (storedStyle?.layout === "editorial"
      ? "magazine_editorial"
      : storedStyle?.layout === "modernist"
        ? "grid_mono"
        : "swiss_serif");
  const customAccentHex =
    storedStyle?.palette === "custom"
      ? normalizeAccentHex(storedStyle.accentHex)
      : normalizeAccentHex(proposal.metadata?.accentHex);
  const storedPalette = isProposalPaletteId(storedStyle?.palette)
    ? storedStyle.palette
    : isProposalPaletteId(proposal.metadata?.paletteOverride)
      ? proposal.metadata.paletteOverride
      : null;
  const bundleDefaultPalette = derivedBundleId
    ? getProposalTemplateBundleDefinition(derivedBundleId).stylePreset.palette
    : null;

  return {
    bundleId: derivedBundleId,
    paletteOverride:
      customAccentHex ||
      !storedPalette ||
      storedPalette === bundleDefaultPalette
        ? null
        : storedPalette,
    customAccentHex,
  };
}

function resolveInitialAttachedCv(): {
  id: string | null;
  title: string | null;
} {
  const active =
    listLocalCvPickerOptions().find((option) => option.isActive) ?? null;
  return {
    id: active?.id ?? null,
    title: active?.title ?? null,
  };
}

function resolveDefaultBundleIdFromStyleChoice(
  styleChoice: unknown,
): ProposalTemplateBundleId {
  if (styleChoice === "warm") return "magazine_editorial";
  if (styleChoice === "technical") return "grid_mono";
  if (styleChoice === "formal") return "swiss_serif";
  return "swiss_serif";
}

function normalizeProposalNextBundleId(
  bundleId: ProposalTemplateBundleId | null | undefined,
): ProposalTemplateBundleId | null {
  if (!bundleId) return null;
  if (bundleId === "swiss_serif") return "swiss_serif";
  if (bundleId === "magazine_editorial" || bundleId === "magazine_serif") {
    return "magazine_editorial";
  }
  if (bundleId === "grid_mono" || bundleId === "swiss_mono") {
    return "grid_mono";
  }
  return "swiss_serif";
}

function normalizeAccentHex(value: unknown): string | null {
  return typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value)
    ? value.toUpperCase()
    : null;
}

function resolveInitialTemplateBundleId(
  storedOutputDraft: StoredProposalOutputDraft | null,
): ProposalTemplateBundleId | null {
  if (storedOutputDraft?.templateBundleId) {
    return normalizeProposalNextBundleId(storedOutputDraft.templateBundleId);
  }

  if (storedOutputDraft?.proposalVerbatiStyle) {
    const matchedBundle = normalizeProposalNextBundleId(
      findProposalTemplateBundleIdByStylePreset(
        storedOutputDraft.proposalVerbatiStyle,
      ),
    );
    if (matchedBundle) {
      return matchedBundle;
    }
  }

  return null;
}

function formatProposalTypeLabel(type: FormValues["proposalType"]): string {
  if (type === "cover_letter") return "Letter";
  if (type === "application_message") return "Message";
  return "Proposal";
}

function buildAutoProposalTitle(
  values: Pick<FormValues, "jobTitle" | "jobDescription" | "proposalType">,
): string {
  const jobTitle = values.jobTitle.trim();
  if (!jobTitle) {
    return values.proposalType === "freelance_proposal"
      ? "Project proposal"
      : "Application for the role";
  }

  const summary = buildProposalSourceSummary({
    jobTitle,
    jobDescription: values.jobDescription,
  });
  const company = summary.company?.trim();

  if (company) {
    return `Application for the ${jobTitle} role at ${company}`;
  }

  return `Application for the ${jobTitle} role`;
}

function resolveNextProposalTitle(
  values: Pick<FormValues, "jobTitle" | "jobDescription" | "proposalType">,
  currentTitle: string,
  manual: boolean,
): string {
  if (manual) {
    return currentTitle.trim() || buildAutoProposalTitle(values);
  }

  return buildAutoProposalTitle(values);
}

function resolveActiveApplicantContext() {
  const source = getActiveLocalPersonalizationSource();

  return {
    source,
    applicantIdentity: getProposalApplicantIdentity(source),
    applicantHeader: getProposalApplicantHeaderData(source),
  };
}

export function ProposalForgeNext(): JSX.Element {
  const location = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { currentCv, loadCv } = useCvLibrary();
  const { search } = location;
  const searchParams = React.useMemo(
    () => new URLSearchParams(search),
    [search],
  );
  const savedProposalId = React.useMemo(
    () => searchParams.get("id"),
    [searchParams],
  );
  const isLegacySavedRoute = React.useMemo(
    () => searchParams.get("view") === "saved",
    [searchParams],
  );
  const isSavedProposalRoute = Boolean(savedProposalId);

  const storedOutputDraft = React.useMemo(
    () => readStoredProposalOutputDraft(),
    [],
  );
  const initialTemplateBundleId = React.useMemo(
    () => resolveInitialTemplateBundleId(storedOutputDraft),
    [storedOutputDraft],
  );
  const initialApplicantContext = React.useMemo(
    () => resolveActiveApplicantContext(),
    [],
  );
  const initialApplicantIdentity = initialApplicantContext.applicantIdentity;
  const initialApplicantHeader = initialApplicantContext.applicantHeader;
  const initialAttachedCv = React.useMemo(() => resolveInitialAttachedCv(), []);

  const handoffId = React.useMemo(
    () => new URLSearchParams(search).get("handoffId"),
    [search],
  );
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
  const deleteProposal = useMutation(api.deleteProposalPublic.default);
  const savedProposals = useQuery(
    api.proposalsPublic.default as any,
    isConvexAuthenticated ? {} : "skip",
  ) as SavedProposalRecord[] | undefined;
  const currentProposalSettings = useQuery(
    api.proposalSettings.getCurrent,
    isConvexAuthenticated ? {} : "skip",
  );

  const handoffRecord = useQuery(
    api.proposalHandoffs.get as any,
    handoffId && isConvexAuthenticated ? { handoffId } : "skip",
  ) as
    | {
        jobTitle: string;
        jobDescription: string;
        sourceUrl?: string;
        platform?: string;
      }
    | null
    | undefined;
  const openedSavedProposal = React.useMemo(
    () =>
      savedProposalId
        ? savedProposals?.find(
            (proposal) => String(proposal._id) === savedProposalId,
          ) ?? null
        : null,
    [savedProposalId, savedProposals],
  );
  const savedAppearanceState = React.useMemo(
    () => resolveSavedAppearanceState(openedSavedProposal),
    [openedSavedProposal],
  );

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
  const [proposalApplicantName, setProposalApplicantName] = React.useState(
    storedOutputDraft?.proposalApplicantName ||
      initialApplicantIdentity.name ||
      "",
  );
  const [proposalApplicantRole, setProposalApplicantRole] = React.useState(
    storedOutputDraft?.proposalApplicantRole ||
      initialApplicantIdentity.role ||
      "",
  );
  const [proposalDocumentTitle, setProposalDocumentTitle] = React.useState(
    storedOutputDraft?.proposalDocumentTitle ?? "",
  );
  const [proposalDocumentTitleManual, setProposalDocumentTitleManual] =
    React.useState(false);
  const [proposalDocumentMeta, setProposalDocumentMeta] = React.useState(
    storedOutputDraft?.proposalDocumentMeta ?? "",
  );
  const [generatedProposalId, setGeneratedProposalId] =
    React.useState<Id<"proposals"> | null>(
      storedOutputDraft?.generatedProposalId ?? null,
    );
  const [proposalOutputMode, setProposalOutputMode] = React.useState<
    "preview" | "edit"
  >(storedOutputDraft?.proposalOutputMode ?? "preview");
  const [lastProposalRequest, setLastProposalRequest] =
    React.useState<FormValues | null>(null);
  const [fallbackInfo, setFallbackInfo] =
    React.useState<ProposalGenerationFallbackInfo | null>(null);
  const [copyFeedback, setCopyFeedback] = React.useState<"idle" | "copied">(
    "idle",
  );
  const [composeFormInstanceKey, setComposeFormInstanceKey] = React.useState(0);
  const [isCvPickerOpen, setIsCvPickerOpen] = React.useState(false);
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [leftPanelVisible, setLeftPanelVisible] = React.useState(true);
  const [briefExpanded, setBriefExpanded] = React.useState(
    !storedOutputDraft?.proposalContent,
  );
  const [inspectorVoicePreset, setInspectorVoicePreset] = React.useState<
    FormValues["voicePreset"] | null
  >(storedOutputDraft?.proposalVoicePreset ?? null);
  const [tonePendingRefresh, setTonePendingRefresh] = React.useState(false);
  const [isRegeneratingGeneratedProposal, setIsRegeneratingGeneratedProposal] =
    React.useState(false);
  const [isSavingGeneratedProposal, setIsSavingGeneratedProposal] =
    React.useState(false);
  const [isSavingOutputToLibrary, setIsSavingOutputToLibrary] =
    React.useState(false);
  const [isConfirmingGeneratedDelete, setIsConfirmingGeneratedDelete] =
    React.useState(false);
  const [attachedCvId, setAttachedCvId] = React.useState<string | null>(
    initialAttachedCv.id,
  );
  const [attachedCvTitle, setAttachedCvTitle] = React.useState<string | null>(
    initialAttachedCv.title,
  );
  const [templateBundleId, setTemplateBundleId] =
    React.useState<ProposalTemplateBundleId | null>(initialTemplateBundleId);
  const [paletteOverride, setPaletteOverride] =
    React.useState<ProposalPaletteId | null>(
      storedOutputDraft?.customAccentHex
        ? null
        : storedOutputDraft?.paletteOverride ?? null,
    );
  const [customAccentHex, setCustomAccentHex] = React.useState<string | null>(
    normalizeAccentHex(storedOutputDraft?.customAccentHex),
  );
  const draftCharacterLimitMode =
    lastProposalRequest?.characterLimitMode ??
    storedOutputDraft?.characterLimitMode ??
    null;
  const draftCharacterLimitValue =
    lastProposalRequest?.characterLimitValue ??
    storedOutputDraft?.characterLimitValue ??
    null;

  const copyFeedbackTimeoutRef = React.useRef<number | null>(null);
  const lastCharacterLimitToastIdRef = React.useRef<string | null>(null);
  const lastSavedProposalContentRef = React.useRef<string | null>(
    storedOutputDraft?.proposalContent ?? null,
  );
  const lastSavedProposalTitleRef = React.useRef<string>(
    storedOutputDraft?.proposalDocumentTitle ?? "",
  );

  const canPersistProposalState = isConvexAuthenticated && !isConvexAuthLoading;
  const isCompactLayout = viewportWidth < 1240;

  const settingsDefaultBundleId = React.useMemo(
    () =>
      resolveDefaultBundleIdFromStyleChoice(
        currentProposalSettings?.styleChoice,
      ),
    [currentProposalSettings?.styleChoice],
  );
  const settingsAccentHex = React.useMemo(
    () => normalizeAccentHex(currentProposalSettings?.accentHex),
    [currentProposalSettings?.accentHex],
  );
  const settingsPaletteOverride = React.useMemo<ProposalPaletteId | null>(
    () =>
      settingsAccentHex
        ? null
        : (currentProposalSettings?.paletteOverride as
            | ProposalPaletteId
            | undefined) ?? null,
    [currentProposalSettings?.paletteOverride, settingsAccentHex],
  );

  React.useEffect(() => {
    if (attachedCvId && String(currentCv?.id ?? "") !== attachedCvId) {
      loadCv(attachedCvId);
    }
  }, [attachedCvId, currentCv?.id, loadCv]);

  React.useEffect(() => {
    const activeOption =
      listLocalCvPickerOptions().find((option) => option.isActive) ?? null;
    setAttachedCvId(activeOption?.id ?? null);
    setAttachedCvTitle(activeOption?.title ?? null);
  }, [currentCv?.id, currentCv?.metadata?.updatedAt, currentCv?.title]);

  const activeCvStylePreset = React.useMemo(() => {
    if (
      !attachedCvId ||
      String(currentCv?.id ?? "") !== attachedCvId ||
      !currentCv
    ) {
      return null;
    }
    return getVerbatiStyleFromCv(currentCv);
  }, [attachedCvId, currentCv]);
  const activeApplicantHeader = React.useMemo(
    () => resolveActiveApplicantContext().applicantHeader,
    [
      attachedCvId,
      attachedCvTitle,
      currentCv?.id,
      currentCv?.metadata?.updatedAt,
      currentCv?.title,
    ],
  );

  const defaultStylePreset = React.useMemo(
    () =>
      getProposalTemplateBundleDefinition(settingsDefaultBundleId).stylePreset,
    [settingsDefaultBundleId],
  );

  const resolvedRenderState = React.useMemo(
    () =>
      resolveProposalRenderState({
        storedTemplateId: isSavedProposalRoute
          ? openedSavedProposal?.metadata?.templateId
          : undefined,
        storedStylePreset: isSavedProposalRoute
          ? openedSavedProposal?.metadata?.verbatiStyle
          : undefined,
        activeCvStylePreset,
        defaultStylePreset,
        templateBundleId,
      }),
    [
      activeCvStylePreset,
      defaultStylePreset,
      isSavedProposalRoute,
      openedSavedProposal?.metadata?.templateId,
      openedSavedProposal?.metadata?.verbatiStyle,
      templateBundleId,
    ],
  );

  const selectedStyleBundleId = React.useMemo(
    () =>
      normalizeProposalNextBundleId(
        templateBundleId ??
          findProposalTemplateBundleIdByStylePreset(
            resolvedRenderState.stylePreset,
          ),
      ),
    [resolvedRenderState.stylePreset, templateBundleId],
  );

  const effectiveStylePresetWithPalette = React.useMemo(() => {
    const effectiveAccentHex = customAccentHex ?? settingsAccentHex;
    const effectivePalette = effectiveAccentHex
      ? null
      : paletteOverride ?? settingsPaletteOverride;
    const withPalette = effectivePalette
      ? { ...resolvedRenderState.stylePreset, palette: effectivePalette }
      : resolvedRenderState.stylePreset;

    if (!effectiveAccentHex) {
      return withPalette;
    }

    return {
      ...withPalette,
      palette: "custom" as const,
      accentHex: effectiveAccentHex,
    };
  }, [
    customAccentHex,
    paletteOverride,
    resolvedRenderState.stylePreset,
    settingsAccentHex,
    settingsPaletteOverride,
  ]);

  const proposalRenderMetadata = React.useMemo<
    ProposalDocumentMetadata | undefined
  >(() => {
    if (!proposalContent) return undefined;

    const nextMetadata: ProposalDocumentMetadata = {
      proposalType: proposalType ?? undefined,
      voicePreset: proposalVoicePreset ?? undefined,
      resolvedVoicePreset: proposalVoicePreset ?? undefined,
      templateId: resolvedRenderState.templateId,
      verbatiStyle: serializeVerbatiStyle(effectiveStylePresetWithPalette),
    };

    if (templateBundleId) {
      nextMetadata.templateBundleId = templateBundleId;
    }

    if (lastProposalRequest?.voicePreset !== undefined) {
      nextMetadata.requestedVoicePreset =
        lastProposalRequest.voicePreset ?? null;
    }
    if (lastProposalRequest?.jobDescription) {
      nextMetadata.sourceJobDescription = lastProposalRequest.jobDescription;
    }
    if (lastProposalRequest?.formalityLevel) {
      nextMetadata.formalityLevel = lastProposalRequest.formalityLevel;
    }
    if (lastProposalRequest?.creativity) {
      nextMetadata.creativity = lastProposalRequest.creativity;
    }
    if (draftCharacterLimitMode) {
      nextMetadata.characterLimitMode = draftCharacterLimitMode;
      nextMetadata.characterLimitValue = draftCharacterLimitValue;
    }

    return nextMetadata;
  }, [
    draftCharacterLimitMode,
    draftCharacterLimitValue,
    effectiveStylePresetWithPalette,
    lastProposalRequest?.creativity,
    lastProposalRequest?.formalityLevel,
    lastProposalRequest?.jobDescription,
    lastProposalRequest?.voicePreset,
    proposalContent,
    proposalType,
    proposalVoicePreset,
    resolvedRenderState.templateId,
    templateBundleId,
  ]);

  const prefill: ProposalForgePrefill = React.useMemo(() => {
    if (!handoffRecord || !handoffId) return null;
    return {
      handoffId,
      jobTitle: handoffRecord.jobTitle,
      jobDescription: handoffRecord.jobDescription,
      sourceUrl: handoffRecord.sourceUrl,
      platform: handoffRecord.platform,
    };
  }, [handoffId, handoffRecord]);

  const applyVisualDefaults = React.useCallback(() => {
    setTemplateBundleId(settingsDefaultBundleId);
    setCustomAccentHex(settingsAccentHex);
    setPaletteOverride(settingsAccentHex ? null : settingsPaletteOverride);
  }, [settingsAccentHex, settingsDefaultBundleId, settingsPaletteOverride]);

  const clearProposalOutputState = React.useCallback(
    (options?: { clearAttachedCv?: boolean; resetComposeKey?: boolean }) => {
      setProposalContent(null);
      setProposalType(null);
      setProposalVoicePreset(null);
      setProposalApplicantName(initialApplicantIdentity.name ?? "");
      setProposalApplicantRole(initialApplicantIdentity.role ?? "");
      setProposalDocumentTitle("");
      setProposalDocumentTitleManual(false);
      setProposalDocumentMeta(initialApplicantHeader.email ?? "");
      setGeneratedProposalId(null);
      setProposalOutputMode("preview");
      setFallbackInfo(null);
      setError(null);
      setStatusMessage(null);
      setErrorDetail(null);
      setLastProposalRequest(null);
      setBriefExpanded(true);
      setLeftPanelVisible(true);
      setIsCvPickerOpen(false);
      setInspectorVoicePreset(
        currentProposalSettings?.savedVoicePreset ?? null,
      );
      setTonePendingRefresh(false);
      setIsConfirmingGeneratedDelete(false);
      lastSavedProposalContentRef.current = null;
      lastSavedProposalTitleRef.current = "";
      if (options?.clearAttachedCv) {
        clearActiveLocalCvId();
        setAttachedCvId(null);
        setAttachedCvTitle(null);
      }
      applyVisualDefaults();
      if (options?.resetComposeKey) {
        setComposeFormInstanceKey((value) => value + 1);
      }
    },
    [
      applyVisualDefaults,
      currentProposalSettings?.savedVoicePreset,
      initialApplicantHeader.email,
      initialApplicantIdentity.name,
      initialApplicantIdentity.role,
    ],
  );

  const restoreComposeDraftFromStorage = React.useCallback(() => {
    const liveDraft = readStoredProposalOutputDraft();

    if (!liveDraft) {
      clearProposalOutputState();
      return;
    }

    setProposalContent(liveDraft.proposalContent ?? null);
    setProposalType(liveDraft.proposalType ?? null);
    setProposalVoicePreset(liveDraft.proposalVoicePreset ?? null);
    setProposalApplicantName(
      liveDraft.proposalApplicantName || initialApplicantIdentity.name || "",
    );
    setProposalApplicantRole(
      liveDraft.proposalApplicantRole || initialApplicantIdentity.role || "",
    );
    setProposalDocumentTitle(liveDraft.proposalDocumentTitle ?? "");
    setProposalDocumentTitleManual(
      liveDraft.proposalDocumentTitleManual === true,
    );
    setProposalDocumentMeta(
      liveDraft.proposalDocumentMeta ?? initialApplicantHeader.email ?? "",
    );
    setGeneratedProposalId(liveDraft.generatedProposalId ?? null);
    setProposalOutputMode(liveDraft.proposalOutputMode ?? "preview");
    setFallbackInfo(null);
    setError(null);
    setStatusMessage(null);
    setErrorDetail(null);
    setLastProposalRequest(null);
    setLeftPanelVisible(true);
    setBriefExpanded(!liveDraft.proposalContent);
    setInspectorVoicePreset(
      liveDraft.proposalVoicePreset ??
        currentProposalSettings?.savedVoicePreset ??
        null,
    );
    setTonePendingRefresh(false);
    setIsConfirmingGeneratedDelete(false);
    setTemplateBundleId(resolveInitialTemplateBundleId(liveDraft));
    setPaletteOverride(
      liveDraft.customAccentHex ? null : liveDraft.paletteOverride ?? null,
    );
    setCustomAccentHex(normalizeAccentHex(liveDraft.customAccentHex));
  }, [
    clearProposalOutputState,
    currentProposalSettings?.savedVoicePreset,
    initialApplicantHeader.email,
    initialApplicantIdentity.name,
    initialApplicantIdentity.role,
  ]);

  const lastAppliedResetTokenRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!proposalWorkspaceResetToken) return;
    if (lastAppliedResetTokenRef.current === proposalWorkspaceResetToken)
      return;
    lastAppliedResetTokenRef.current = proposalWorkspaceResetToken;
    clearProposalOutputState({ resetComposeKey: true });
    const nextState =
      location.state && typeof location.state === "object"
        ? (() => {
            const {
              [PROPOSAL_WORKSPACE_RESET_STATE_KEY]: _resetToken,
              ...rest
            } = location.state as Record<string, unknown>;
            return Object.keys(rest).length > 0 ? rest : null;
          })()
        : null;
    void navigate(`${location.pathname}${search}`, {
      replace: true,
      state: nextState,
    });
  }, [
    clearProposalOutputState,
    location.pathname,
    location.state,
    navigate,
    proposalWorkspaceResetToken,
    search,
  ]);

  React.useEffect(() => {
    if (!isLegacySavedRoute) return;
    const params = new URLSearchParams(search);
    params.delete("view");
    void navigate(
      params.toString() ? `/proposal?${params.toString()}` : "/proposal",
      {
        replace: true,
      },
    );
  }, [isLegacySavedRoute, navigate, search]);

  const appliedSavedSettingsRef = React.useRef(false);
  React.useEffect(() => {
    if (!currentProposalSettings || appliedSavedSettingsRef.current) return;
    appliedSavedSettingsRef.current = true;
    if (storedOutputDraft) return;

    setInspectorVoicePreset(currentProposalSettings.savedVoicePreset ?? null);
    setTemplateBundleId(settingsDefaultBundleId);
    setCustomAccentHex(settingsAccentHex);
    setPaletteOverride(settingsAccentHex ? null : settingsPaletteOverride);
  }, [
    currentProposalSettings,
    settingsAccentHex,
    settingsDefaultBundleId,
    settingsPaletteOverride,
    storedOutputDraft,
  ]);

  const lastHydratedSavedProposalIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!isSavedProposalRoute) {
      if (lastHydratedSavedProposalIdRef.current !== null) {
        lastHydratedSavedProposalIdRef.current = null;
        restoreComposeDraftFromStorage();
      }
      return;
    }

    if (!openedSavedProposal) return;

    const nextSavedProposalId = String(openedSavedProposal._id);
    if (lastHydratedSavedProposalIdRef.current === nextSavedProposalId) {
      return;
    }

    lastHydratedSavedProposalIdRef.current = nextSavedProposalId;
    const savedVoicePreset =
      openedSavedProposal.metadata?.resolvedVoicePreset ??
      openedSavedProposal.metadata?.voicePreset ??
      DEFAULT_PROPOSAL_VOICE_PRESET;
    const savedProposalType =
      openedSavedProposal.metadata?.proposalType ??
      inferSavedProposalType(openedSavedProposal.content);
    const savedContent = resolveProposalStoredText({
      content: openedSavedProposal.content,
      sections: openedSavedProposal.sections,
    });

    setProposalContent(savedContent);
    setProposalType(savedProposalType);
    setProposalVoicePreset(savedVoicePreset);
    setProposalApplicantName(initialApplicantIdentity.name ?? "");
    setProposalApplicantRole(initialApplicantIdentity.role ?? "");
    setProposalDocumentTitle(openedSavedProposal.title || "Saved proposal");
    setProposalDocumentTitleManual(
      Boolean((openedSavedProposal.title || "").trim()),
    );
    setProposalDocumentMeta(initialApplicantHeader.email ?? "");
    setGeneratedProposalId(openedSavedProposal._id);
    setProposalOutputMode("preview");
    setFallbackInfo({
      requestedModelType: openedSavedProposal.metadata?.requestedModelType,
      actualModelType: openedSavedProposal.metadata?.actualModelType,
      fallbackTriggerCode: openedSavedProposal.metadata?.fallbackTriggerCode,
    });
    setError(null);
    setStatusMessage(null);
    setErrorDetail(null);
    setLastProposalRequest(null);
    setLeftPanelVisible(false);
    setBriefExpanded(false);
    setIsCvPickerOpen(false);
    setInspectorVoicePreset(savedVoicePreset);
    setTonePendingRefresh(false);
    setIsConfirmingGeneratedDelete(false);
    setTemplateBundleId(savedAppearanceState.bundleId);
    setPaletteOverride(savedAppearanceState.paletteOverride);
    setCustomAccentHex(savedAppearanceState.customAccentHex);
    lastSavedProposalContentRef.current = savedContent;
    lastSavedProposalTitleRef.current =
      openedSavedProposal.title || "Saved proposal";
  }, [
    initialApplicantIdentity.name,
    initialApplicantIdentity.role,
    isSavedProposalRoute,
    openedSavedProposal,
    restoreComposeDraftFromStorage,
    savedAppearanceState.bundleId,
    savedAppearanceState.customAccentHex,
    savedAppearanceState.paletteOverride,
  ]);

  React.useEffect(() => {
    const handleResize = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  React.useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    if (!proposalContent) {
      lastCharacterLimitToastIdRef.current = null;
      return;
    }

    const activeCharacterLimit = resolveProposalCharacterLimitSelection({
      mode: draftCharacterLimitMode,
      value: draftCharacterLimitValue,
    });
    if (!activeCharacterLimit.value) return;

    const displayedCount = getDisplayedProposalText(proposalContent).length;
    const matchedThreshold = PROPOSAL_CHARACTER_LIMIT_TOAST_THRESHOLDS.find(
      (threshold) =>
        displayedCount >= threshold.limit &&
        lastCharacterLimitToastIdRef.current !== threshold.id,
    );

    if (matchedThreshold) {
      lastCharacterLimitToastIdRef.current = matchedThreshold.id;
      showToast(matchedThreshold.title, {
        variant: "warning",
        description: matchedThreshold.description,
      });
    }
  }, [
    draftCharacterLimitMode,
    draftCharacterLimitValue,
    proposalContent,
    showToast,
  ]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    if (isSavedProposalRoute) return;

    const hasDraft =
      Boolean(proposalContent) ||
      Boolean(proposalDocumentTitle) ||
      Boolean(proposalDocumentMeta) ||
      Boolean(generatedProposalId);

    if (!hasDraft) {
      writeStoredProposalOutputDraft(null);
      return;
    }

    writeStoredProposalOutputDraft({
      proposalContent,
      proposalType,
      proposalVoicePreset,
      proposalTemplateId: resolvedRenderState.templateId,
      proposalVerbatiStyle: effectiveStylePresetWithPalette,
      proposalStyleLinkMode: attachedCvId ? "inherit_cv" : "proposal_local",
      proposalStyleChoice: "auto",
      proposalApplicantName,
      proposalApplicantRole,
      proposalDocumentTitle,
      proposalDocumentMeta,
      generatedProposalId,
      proposalOutputMode,
      paletteOverride,
      customAccentHex,
      templateBundleId,
      typographyOverride: null,
      layoutOverride: null,
      proposalDocumentTitleManual,
      characterLimitMode: draftCharacterLimitMode,
      characterLimitValue: draftCharacterLimitValue,
    } satisfies StoredProposalOutputDraft);
  }, [
    attachedCvId,
    customAccentHex,
    effectiveStylePresetWithPalette,
    generatedProposalId,
    paletteOverride,
    proposalApplicantName,
    proposalApplicantRole,
    proposalContent,
    proposalDocumentMeta,
    proposalDocumentTitle,
    proposalDocumentTitleManual,
    proposalOutputMode,
    proposalType,
    proposalVoicePreset,
    resolvedRenderState.templateId,
    templateBundleId,
    draftCharacterLimitMode,
    draftCharacterLimitValue,
    isSavedProposalRoute,
  ]);

  const resolveProposalVoicePresetFromValues = React.useCallback(
    (values: FormValues): ProposalVoicePreset => {
      if (values.voicePreset) return values.voicePreset;
      const local = getActiveLocalPersonalizationSource();
      return (
        selectAutoTone({
          jobTitle: values.jobTitle,
          jobDescription: values.jobDescription,
          personalizationContext: local.personalizationContext,
          personalizationRichness: local.richness,
        }).preset ?? DEFAULT_PROPOSAL_VOICE_PRESET
      );
    },
    [],
  );

  const applyProposalHeaderFromValues = React.useCallback(
    (values: Pick<FormValues, "jobTitle" | "jobDescription" | "proposalType">) => {
      const applicantHeader = resolveActiveApplicantContext().applicantHeader;
      setProposalDocumentTitle((currentTitle) =>
        resolveNextProposalTitle(
          values,
          currentTitle,
          proposalDocumentTitleManual,
        ),
      );
      setProposalDocumentMeta(applicantHeader.email ?? "");
    },
    [proposalDocumentTitleManual],
  );

  const persistProposalOutputDraftSnapshot = React.useCallback(
    (input: {
      values: FormValues;
      proposal: string;
      resolvedVoice: ProposalVoicePreset;
      applicantIdentity: ReturnType<typeof getProposalApplicantIdentity>;
      title: string;
      proposalId?: Id<"proposals">;
    }) => {
      if (isSavedProposalRoute) {
        return;
      }

      writeStoredProposalOutputDraft({
        proposalContent: input.proposal,
        proposalType: input.values.proposalType,
        proposalVoicePreset: input.resolvedVoice,
        proposalTemplateId: resolvedRenderState.templateId,
        proposalVerbatiStyle: effectiveStylePresetWithPalette,
        proposalStyleLinkMode: attachedCvId ? "inherit_cv" : "proposal_local",
        proposalStyleChoice: "auto",
        proposalApplicantName: input.applicantIdentity.name ?? "",
        proposalApplicantRole: input.applicantIdentity.role ?? "",
        proposalDocumentTitle: input.title,
        proposalDocumentMeta:
          resolveActiveApplicantContext().applicantHeader.email ?? "",
        generatedProposalId: input.proposalId ?? null,
        proposalOutputMode: "preview",
        paletteOverride,
        customAccentHex,
        templateBundleId,
        typographyOverride: null,
        layoutOverride: null,
        proposalDocumentTitleManual,
        characterLimitMode: input.values.characterLimitMode ?? null,
        characterLimitValue: input.values.characterLimitValue ?? null,
      } satisfies StoredProposalOutputDraft);
    },
    [
      attachedCvId,
      customAccentHex,
      effectiveStylePresetWithPalette,
      isSavedProposalRoute,
      paletteOverride,
      proposalDocumentTitleManual,
      resolvedRenderState.templateId,
      templateBundleId,
    ],
  );

  const persistProposalTitle = React.useCallback(
    async (nextTitle: string) => {
      if (
        !generatedProposalId ||
        !canPersistProposalState ||
        isSavedProposalRoute
      ) {
        return;
      }

      const normalizedTitle =
        nextTitle.trim() ||
        (proposalType
          ? formatProposalTypeLabel(proposalType)
          : "Generated proposal");
      if (normalizedTitle === lastSavedProposalTitleRef.current.trim()) {
        return;
      }

      try {
        await updateProposal({
          id: generatedProposalId,
          title: normalizedTitle,
        });
        lastSavedProposalTitleRef.current = normalizedTitle;
      } catch (commitError) {
        console.warn("[ProposalForgeNext] Title save failed:", commitError);
      }
    },
    [
      canPersistProposalState,
      generatedProposalId,
      isSavedProposalRoute,
      proposalType,
      updateProposal,
    ],
  );

  React.useEffect(() => {
    if (
      !generatedProposalId ||
      !canPersistProposalState ||
      isSavedProposalRoute
    ) {
      return;
    }

    const normalizedTitle =
      proposalDocumentTitle.trim() ||
      (proposalType
        ? formatProposalTypeLabel(proposalType)
        : "Generated proposal");
    if (normalizedTitle === lastSavedProposalTitleRef.current.trim()) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void persistProposalTitle(normalizedTitle);
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [
    canPersistProposalState,
    generatedProposalId,
    isSavedProposalRoute,
    persistProposalTitle,
    proposalDocumentTitle,
    proposalType,
  ]);

  const handleToggleCvPicker = React.useCallback(() => {
    setIsCvPickerOpen((current) => !current);
  }, []);

  const handleAttachedCvChange = React.useCallback(
    (nextId: string | null) => {
      if (!nextId) {
        setAttachedCvId(null);
        setAttachedCvTitle(null);
        applyVisualDefaults();
        return;
      }

      const nextOptions = listLocalCvPickerOptions();
      const match = nextOptions.find((option) => option.id === nextId) ?? null;
      const didChange = nextId !== attachedCvId;
      setAttachedCvId(nextId);
      setAttachedCvTitle(match?.title ?? currentCv?.title ?? null);

      if (didChange) {
        setTemplateBundleId(null);
        setPaletteOverride(null);
        setCustomAccentHex(null);
      }
    },
    [applyVisualDefaults, attachedCvId, currentCv?.title],
  );

  const handleTemplateBundleChange = React.useCallback(
    (bundleId: ProposalTemplateBundleId | null) => {
      setTemplateBundleId(bundleId);
      setPaletteOverride(null);
      setCustomAccentHex(null);
    },
    [],
  );

  const handlePaletteOverrideChange = React.useCallback(
    (nextPalette: ProposalPaletteId | null) => {
      setPaletteOverride(nextPalette);
      if (nextPalette !== null) {
        setCustomAccentHex(null);
      }
    },
    [],
  );

  const handleCustomAccentHexChange = React.useCallback(
    (nextHex: string | null) => {
      setCustomAccentHex(nextHex);
      if (nextHex !== null) {
        setPaletteOverride(null);
      }
    },
    [],
  );

  const handleInspectorVoicePresetChange = React.useCallback(
    (preset: FormValues["voicePreset"] | null) => {
      setInspectorVoicePreset(preset);
      if (proposalContent) {
        setTonePendingRefresh(true);
      }
    },
    [proposalContent],
  );

  const handleProposalFormValuesChange = React.useCallback(
    (values: FormValues) => {
      setLastProposalRequest(values);
      setProposalDocumentTitleManual(false);
      setProposalDocumentTitle(buildAutoProposalTitle(values));
      setProposalDocumentMeta(
        resolveActiveApplicantContext().applicantHeader.email ?? "",
      );
    },
    [],
  );

  const handleProposalStart = React.useCallback(
    (values: FormValues) => {
      const { applicantIdentity } = resolveActiveApplicantContext();
      const resolvedVoice = resolveProposalVoicePresetFromValues(values);
      setLastProposalRequest(values);
      setLoading(true);
      setProposalType(values.proposalType);
      setProposalVoicePreset(resolvedVoice);
      setProposalApplicantName(applicantIdentity.name ?? "");
      setProposalApplicantRole(applicantIdentity.role ?? "");
      applyProposalHeaderFromValues(values);
      setProposalContent(null);
      setGeneratedProposalId(null);
      setProposalOutputMode("preview");
      setError(null);
      setStatusMessage(null);
      setErrorDetail(null);
      setFallbackInfo(null);
      setTonePendingRefresh(false);
    },
    [applyProposalHeaderFromValues, resolveProposalVoicePresetFromValues],
  );

  const handleProposalSubmit = React.useCallback(
    (
      values: FormValues,
      proposal: string,
      nextFallbackInfo?: ProposalGenerationFallbackInfo,
      nextProposalId?: Id<"proposals">,
    ) => {
      const { applicantIdentity, applicantHeader } = resolveActiveApplicantContext();
      const resolvedVoice = resolveProposalVoicePresetFromValues(values);
      const nextTitle = resolveNextProposalTitle(
        values,
        proposalDocumentTitle,
        proposalDocumentTitleManual,
      );
      const nextMetaLine = applicantHeader.email ?? "";

      persistProposalOutputDraftSnapshot({
        values,
        proposal,
        resolvedVoice,
        applicantIdentity,
        title: nextTitle,
        proposalId: nextProposalId,
      });

      setLastProposalRequest(values);
      setProposalType(values.proposalType);
      setProposalVoicePreset(resolvedVoice);
      setProposalApplicantName(applicantIdentity.name ?? "");
      setProposalApplicantRole(applicantIdentity.role ?? "");
      setProposalDocumentTitle(nextTitle);
      setProposalDocumentMeta(nextMetaLine);
      setProposalContent(proposal);
      setGeneratedProposalId(nextProposalId ?? null);
      setProposalOutputMode("preview");
      setError(null);
      setStatusMessage(null);
      setErrorDetail(null);
      setFallbackInfo(nextFallbackInfo ?? null);
      setLoading(false);
      setTonePendingRefresh(false);
      setIsConfirmingGeneratedDelete(false);
      lastSavedProposalContentRef.current = proposal;
      lastSavedProposalTitleRef.current = nextTitle;
    },
    [
      persistProposalOutputDraftSnapshot,
      proposalDocumentTitle,
      proposalDocumentTitleManual,
      resolveProposalVoicePresetFromValues,
    ],
  );

  const handleProposalError = React.useCallback(
    (message: string, values: FormValues, rawReason?: string | null) => {
      const { applicantIdentity } = resolveActiveApplicantContext();
      const resolvedVoice = resolveProposalVoicePresetFromValues(values);
      setLastProposalRequest(values);
      setLoading(false);
      setProposalType(values.proposalType);
      setProposalVoicePreset(resolvedVoice);
      setProposalApplicantName(applicantIdentity.name ?? "");
      setProposalApplicantRole(applicantIdentity.role ?? "");
      applyProposalHeaderFromValues(values);
      setProposalContent(null);
      setGeneratedProposalId(null);
      setProposalOutputMode("preview");
      setIsConfirmingGeneratedDelete(false);
      setError(message);
      setStatusMessage(null);
      setErrorDetail(rawReason ?? null);
      setFallbackInfo(null);
    },
    [applyProposalHeaderFromValues, resolveProposalVoicePresetFromValues],
  );

  const handleProposalStop = React.useCallback(() => {
    setLoading(false);
    setProposalContent(null);
    setGeneratedProposalId(null);
    setProposalOutputMode("preview");
    setError(null);
    setStatusMessage("Generation stopped.");
    setErrorDetail(null);
    setFallbackInfo(null);
    setTonePendingRefresh(false);
    setIsConfirmingGeneratedDelete(false);
  }, []);

  const handleProposalContentChange = React.useCallback(
    (nextContent: string) => {
      setProposalContent(nextContent);
    },
    [],
  );

  const handleProposalDocumentCommit = React.useCallback(async () => {
    if (
      !generatedProposalId ||
      isSavingGeneratedProposal ||
      !canPersistProposalState
    ) {
      return;
    }

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
        content: trimmed,
        sections: [{ type: "text", content: trimmed }],
        status: isSavedProposalRoute ? "saved" : "draft",
        metadata: proposalRenderMetadata,
      });
      lastSavedProposalContentRef.current = trimmed;
      lastSavedProposalTitleRef.current = normalizedTitle;
    } catch (commitError) {
      console.warn("[ProposalForgeNext] Auto-save failed:", commitError);
    } finally {
      setIsSavingGeneratedProposal(false);
    }
  }, [
    canPersistProposalState,
    generatedProposalId,
    isSavedProposalRoute,
    isSavingGeneratedProposal,
    proposalContent,
    proposalDocumentTitle,
    proposalRenderMetadata,
    proposalType,
    updateProposal,
  ]);

  const handleCopyOutput = React.useCallback(async () => {
    const text = proposalContent
      ? getDisplayedProposalText(proposalContent)
      : null;
    if (!text) return;

    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback("copied");
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopyFeedback("idle");
        copyFeedbackTimeoutRef.current = null;
      }, 1800);
    } catch {
      try {
        const fallback = fallbackCopyText(text);
        setCopyFeedback(fallback ? "copied" : "idle");
      } catch {
        setCopyFeedback("idle");
      }
    }
  }, [proposalContent]);

  const handleRegenerateOutput = React.useCallback(async () => {
    if (isRegeneratingGeneratedProposal) return;

    const sourceJobDescription = isSavedProposalRoute
      ? openedSavedProposal?.metadata?.sourceJobDescription?.trim() ?? ""
      : lastProposalRequest?.jobDescription?.trim() ?? "";
    const baseRequest =
      isSavedProposalRoute && openedSavedProposal
        ? {
            jobTitle:
              proposalDocumentTitle.trim() ||
              openedSavedProposal.title.trim() ||
              buildAutoProposalTitle({
                jobTitle: "",
                proposalType: proposalType ?? "cover_letter",
              }),
            jobDescription: sourceJobDescription,
            proposalType:
              proposalType ??
              openedSavedProposal.metadata?.proposalType ??
              inferSavedProposalType(openedSavedProposal.content),
            voicePreset: proposalVoicePreset ?? DEFAULT_PROPOSAL_VOICE_PRESET,
            formalityLevel: openedSavedProposal.metadata?.formalityLevel,
            creativity: openedSavedProposal.metadata?.creativity,
            characterLimitMode:
              openedSavedProposal.metadata?.characterLimitMode ?? "none",
            characterLimitValue:
              openedSavedProposal.metadata?.characterLimitValue ?? null,
            toneTuning: null,
            modelType: "chatgpt" as const,
          }
        : lastProposalRequest;

    if (!baseRequest) return;
    if (isSavedProposalRoute && !sourceJobDescription) {
      showToast("Original job post is unavailable for this saved proposal.", {
        variant: "warning",
      });
      return;
    }

    const currentActiveCvSource = getActiveLocalPersonalizationSource();
    const hasCandidateContext = Boolean(
      currentActiveCvSource.personalizationContext,
    );
    const requestWithVoice = applyProposalVoiceSelection(
      baseRequest,
      inspectorVoicePreset,
    );
    const requestPayload = buildProposalGenerationRequest(
      requestWithVoice,
      buildAppProposalPersonalizationPayload(currentActiveCvSource),
    );

    try {
      setIsRegeneratingGeneratedProposal(true);
      setLoading(true);
      setError(null);
      setErrorDetail(null);
      setFallbackInfo(null);
      setTonePendingRefresh(false);

      const result = await (
        generateProposalAction as unknown as (
          input: ProposalGenerationRequestPayload,
        ) => Promise<GenerateProposalResult | null>
      )(requestPayload);

      if (!result) {
        setError("No proposal returned from the server.");
        setLoading(false);
        return;
      }

      if (canPersistProposalState) {
        try {
          await updateProposal({
            id: result.proposalId,
            title:
              proposalDocumentTitle.trim() ||
              buildAutoProposalTitle(requestWithVoice),
            content: result.proposalContent,
            sections: [{ type: "text", content: result.proposalContent }],
            status: isSavedProposalRoute ? "saved" : "draft",
            metadata: {
              ...proposalRenderMetadata,
              ...(sourceJobDescription ? { sourceJobDescription } : null),
            },
          });
        } catch (saveError) {
          console.warn(
            "[ProposalForgeNext] Failed to update regenerated proposal:",
            saveError,
          );
        }
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
      if (
        isSavedProposalRoute &&
        String(result.proposalId) !== savedProposalId
      ) {
        void navigate(
          `/proposal?id=${encodeURIComponent(String(result.proposalId))}`,
          {
            replace: true,
          },
        );
      }
      showToast("Proposal regenerated", { variant: "success" });
    } catch (regenerateError) {
      const message = getProposalGenerationUiErrorMessage({
        error: regenerateError,
        proposalType: requestWithVoice.proposalType,
        hasCandidateContext,
      });
      const rawReason =
        regenerateError instanceof Error ? regenerateError.message : null;
      handleProposalError(message, requestWithVoice, rawReason);
      showToast("Regeneration failed", {
        variant: "error",
        description: message,
      });
    } finally {
      setLoading(false);
      setIsRegeneratingGeneratedProposal(false);
    }
  }, [
    canPersistProposalState,
    generateProposalAction,
    handleProposalError,
    handleProposalSubmit,
    inspectorVoicePreset,
    isSavedProposalRoute,
    isRegeneratingGeneratedProposal,
    lastProposalRequest,
    openedSavedProposal,
    proposalDocumentTitle,
    proposalRenderMetadata,
    proposalType,
    proposalVoicePreset,
    savedProposalId,
    navigate,
    showToast,
    updateProposal,
  ]);

  const handleDeleteOutput = React.useCallback(async () => {
    if (!generatedProposalId) {
      clearProposalOutputState();
      return;
    }

    if (!canPersistProposalState) {
      showToast("Sign in required", {
        variant: "info",
        description: "Delete requires an account.",
      });
      return;
    }

    try {
      await deleteProposal({ id: generatedProposalId });
      clearProposalOutputState();
      if (isSavedProposalRoute) {
        void navigate("/proposal", { replace: true });
      }
      showToast("Proposal deleted", { variant: "success" });
    } catch (deleteError) {
      console.error(
        "[ProposalForgeNext] Failed to delete proposal:",
        deleteError,
      );
      showToast("Delete failed", {
        variant: "error",
        description: "The generated proposal could not be removed.",
      });
    }
  }, [
    canPersistProposalState,
    clearProposalOutputState,
    deleteProposal,
    generatedProposalId,
    isSavedProposalRoute,
    navigate,
    showToast,
  ]);

  const handleSaveOutputToLibrary = React.useCallback(async () => {
    if (
      !generatedProposalId ||
      !proposalContent ||
      isSavingOutputToLibrary ||
      isSavingGeneratedProposal
    ) {
      return;
    }

    if (!canPersistProposalState) {
      showToast("Sign in required", {
        variant: "info",
        description: "Save requires an account.",
      });
      return;
    }

    const trimmed = proposalContent.trim();
    if (!trimmed) return;

    setIsSavingOutputToLibrary(true);
    try {
      const normalizedTitle =
        proposalDocumentTitle.trim() ||
        (proposalType
          ? formatProposalTypeLabel(proposalType)
          : "Generated proposal");
      await updateProposal({
        id: generatedProposalId,
        title: normalizedTitle,
        content: trimmed,
        sections: [{ type: "text", content: trimmed }],
        status: "saved",
        metadata: proposalRenderMetadata,
      });
      lastSavedProposalContentRef.current = trimmed;
      lastSavedProposalTitleRef.current = normalizedTitle;
      showToast(
        isSavedProposalRoute ? "Saved proposal updated" : "Saved to library",
        {
          variant: "success",
        },
      );
    } catch (saveError) {
      console.error(
        "[ProposalForgeNext] Failed to save to library:",
        saveError,
      );
      showToast("Save failed", {
        variant: "error",
        description: "The proposal could not be saved.",
      });
    } finally {
      setIsSavingOutputToLibrary(false);
    }
  }, [
    canPersistProposalState,
    generatedProposalId,
    isSavingGeneratedProposal,
    isSavingOutputToLibrary,
    proposalContent,
    proposalDocumentTitle,
    proposalRenderMetadata,
    proposalType,
    isSavedProposalRoute,
    showToast,
    updateProposal,
  ]);

  const hasContent = Boolean(proposalContent) || loading;
  const briefJobTitle =
    lastProposalRequest?.jobTitle?.trim() ?? prefill?.jobTitle?.trim() ?? "";
  const briefJobDescription =
    lastProposalRequest?.jobDescription?.trim() ??
    prefill?.jobDescription?.trim() ??
    "";
  const hasBriefContent = Boolean(briefJobTitle || briefJobDescription);
  const showBriefCard = hasBriefContent && !briefExpanded && leftPanelVisible;
  const showComposePanel = leftPanelVisible && !isSavedProposalRoute;
  const shouldLockDesktopWorkbenchFrame =
    hasContent && !isCompactLayout && !isSavedProposalRoute;
  const shouldShowCollapsedComposeToolbar =
    !leftPanelVisible && !isSavedProposalRoute && !isCompactLayout;
  const isLoadingHandoff =
    Boolean(handoffId) &&
    (isConvexAuthLoading ||
      (isConvexAuthenticated && handoffRecord === undefined));
  const activeCharacterLimitSelection = React.useMemo(
    () =>
      resolveProposalCharacterLimitSelection({
        mode: draftCharacterLimitMode,
        value: draftCharacterLimitValue,
      }),
    [draftCharacterLimitMode, draftCharacterLimitValue],
  );

  const stackedCardWidthStyle: React.CSSProperties = isCompactLayout
    ? { width: "min(100%, 560px)", minWidth: 0 }
    : { width: "100%", minWidth: 0 };

  const proposalWorkbenchToolbar = shouldShowCollapsedComposeToolbar ? (
    <ProposalComposeToolbar
      value={inspectorVoicePreset}
      resolvedValue={proposalVoicePreset ?? null}
      onChange={handleInspectorVoicePresetChange}
      onToggleCvPicker={handleToggleCvPicker}
      onClearCv={() => handleAttachedCvChange(null)}
      cvTitle={attachedCvTitle}
      isCvPickerOpen={isCvPickerOpen}
      disabled={loading}
      collapsed
      onRestoreCompose={() => {
        setLeftPanelVisible(true);
      }}
    />
  ) : leftPanelVisible && !isSavedProposalRoute ? (
    <ProposalComposeToolbar
      value={inspectorVoicePreset}
      resolvedValue={proposalVoicePreset ?? null}
      onChange={handleInspectorVoicePresetChange}
      onToggleCvPicker={handleToggleCvPicker}
      onClearCv={() => handleAttachedCvChange(null)}
      cvTitle={attachedCvTitle}
      isCvPickerOpen={isCvPickerOpen}
      disabled={loading}
      compact={isCompactLayout}
      onCollapseCompose={
        !isCompactLayout
          ? () => {
              setLeftPanelVisible(false);
              setIsCvPickerOpen(false);
            }
          : undefined
      }
    />
  ) : null;

  return (
    <div className="dasti-page-scroll" style={{ minWidth: 0 }}>
      <div
        className="dasti-page-shell"
        style={
          {
            "--page-shell-max-width": "100%",
            "--page-shell-gap": "var(--layout-page-stack)",
          } as React.CSSProperties
        }
      >
        {proposalWorkbenchToolbar ? (
          <div className="dasti-cv-workbench-bar">
            <div
              className="dasti-forge-compose-toolbar-slot"
              style={
                {
                  "--proposal-compose-toolbar-max-inline-size": isCompactLayout
                    ? "560px"
                    : "480px",
                } as React.CSSProperties
              }
            >
              {proposalWorkbenchToolbar}
            </div>
          </div>
        ) : null}
        <div
          style={{
            width: "100%",
            maxWidth: "1280px",
            marginInline: "auto",
            minWidth: 0,
          }}
        >
          <section aria-hidden={false}>
          <div
            className="dasti-grid-split"
            style={
              {
                "--grid-columns": isCompactLayout
                  ? "minmax(0, 1fr)"
                  : shouldLockDesktopWorkbenchFrame
                    ? "minmax(0, 480px) minmax(0, 640px)"
                    : leftPanelVisible
                      ? "minmax(0, 480px) minmax(0, 640px)"
                      : "minmax(0, 0px) minmax(0, 1fr)",
                "--grid-gap":
                  leftPanelVisible || shouldLockDesktopWorkbenchFrame
                    ? "var(--layout-card-grid)"
                    : "0px",
                "--grid-align": "start",
                "--grid-justify": isCompactLayout ? "start" : "center",
              } as React.CSSProperties
            }
          >
            <div
              className={[
                "dasti-flow",
                "dasti-forge-left-col",
                !leftPanelVisible && !isCompactLayout
                  ? "dasti-forge-left-col--hidden"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div style={stackedCardWidthStyle}>
                {showBriefCard ? (
                  <ProposalBriefCard
                    sourceJobTitle={briefJobTitle}
                    outputDocumentTitle={proposalDocumentTitle}
                    jobDescription={briefJobDescription}
                    hideRawSource={showBriefCard}
                    onToggleBrief={() => setBriefExpanded(true)}
                  />
                ) : null}

                <div
                  style={
                    showBriefCard || !showComposePanel
                      ? { display: "none" }
                      : undefined
                  }
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
                      onSubmitAnimationComplete={() => setBriefExpanded(false)}
                      onError={handleProposalError}
                      onValuesChange={handleProposalFormValuesChange}
                      onActiveCvChange={handleAttachedCvChange}
                      prefill={prefill}
                      cvPickerOpen={isCvPickerOpen}
                      onCvPickerOpenChange={setIsCvPickerOpen}
                      suppressToneControls
                      suppressCvPicker
                      headerLabel={null}
                      headerAction={
                        hasBriefContent ? (
                          <button
                            type="button"
                            className="dasti-proposal-compose-shell__toggle"
                            onClick={() =>
                              setBriefExpanded((current) => !current)
                            }
                            aria-label={
                              briefExpanded ? "Collapse brief" : "Edit brief"
                            }
                            title={
                              briefExpanded ? "Collapse brief" : "Edit brief"
                            }
                          >
                            {briefExpanded ? (
                              <ChevronUp
                                size={14}
                                strokeWidth={1.8}
                                aria-hidden="true"
                              />
                            ) : (
                              <ChevronDown
                                size={14}
                                strokeWidth={1.8}
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
                style={{
                  ...stackedCardWidthStyle,
                  position: "relative",
                }}
                className="dasti-proposal-output-shell dasti-proposal-output-shell--next"
              >
                <ProposalDisplay
                  proposalContent={proposalContent}
                  loading={loading}
                  error={error}
                  statusMessage={statusMessage}
                  errorDetail={errorDetail}
                  proposalType={proposalType}
                  voicePreset={proposalVoicePreset}
                  templateId={resolvedRenderState.templateId}
                  stylePreset={effectiveStylePresetWithPalette}
                  railTitle={proposalApplicantName || null}
                  railMeta={proposalApplicantRole || null}
                  applicantHeader={activeApplicantHeader}
                  fallbackInfo={fallbackInfo}
                  documentTitle={proposalDocumentTitle || "Generated proposal"}
                  documentMeta={
                    proposalDocumentMeta ||
                    (isSavedProposalRoute ? "Saved proposal" : "Compose output")
                  }
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
                  documentHeaderMode="actions-only"
                  railStartAddon={
                    hasContent ? (
                      <ProposalArtifactInspector
                        variant="header"
                        styleBundleId={selectedStyleBundleId}
                        onStyleBundleChange={handleTemplateBundleChange}
                        paletteOverride={paletteOverride}
                        onPaletteOverrideChange={handlePaletteOverrideChange}
                        customAccentHex={customAccentHex}
                        onCustomAccentHexChange={handleCustomAccentHexChange}
                        resolvedPaletteId={
                          effectiveStylePresetWithPalette.palette === "custom"
                            ? null
                            : effectiveStylePresetWithPalette.palette
                        }
                        hasGenerated={hasContent}
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
                          className={[
                            "dasti-icon-button dasti-icon-button--regen",
                            tonePendingRefresh
                              ? "dasti-icon-button--pending"
                              : "",
                          ]
                            .filter(Boolean)
                            .join(" ")}
                          disabled={
                            isRegeneratingGeneratedProposal ||
                            !lastProposalRequest
                          }
                          onClick={() => {
                            void handleRegenerateOutput();
                          }}
                          data-toolbar-tooltip={
                            isRegeneratingGeneratedProposal
                              ? "Regenerating"
                              : "Regenerate"
                          }
                          aria-label={
                            tonePendingRefresh
                              ? "Apply tone change"
                              : "Regenerate"
                          }
                        >
                          <RotateCcw size={15} strokeWidth={1.6} />
                        </button>

                        <div className="dasti-icon-cluster__divider" />

                        <button
                          type="button"
                          data-toolbar-tooltip={
                            isSavingOutputToLibrary ? "Saving" : "Save"
                          }
                          aria-label={
                            isSavedProposalRoute
                              ? "Save changes"
                              : "Save to library"
                          }
                          className="dasti-icon-button"
                          onClick={() => {
                            void handleSaveOutputToLibrary();
                          }}
                          disabled={isSavingOutputToLibrary}
                          style={{
                            opacity: isSavingOutputToLibrary ? 0.55 : 1,
                          }}
                        >
                          <FloppyDisk size={16} strokeWidth={1.7} />
                        </button>

                        {isConfirmingGeneratedDelete ? (
                          <>
                            <button
                              type="button"
                              data-toolbar-tooltip="Confirm delete"
                              aria-label={
                                isSavedProposalRoute
                                  ? "Confirm delete saved proposal"
                                  : "Confirm delete"
                              }
                              className="dasti-icon-button dasti-icon-button--confirm"
                              onClick={() => {
                                void handleDeleteOutput();
                              }}
                            >
                              <Check size={15} strokeWidth={2} />
                            </button>
                            <button
                              type="button"
                              data-toolbar-tooltip="Cancel"
                              className="dasti-icon-button"
                              onClick={() =>
                                setIsConfirmingGeneratedDelete(false)
                              }
                            >
                              <X size={15} strokeWidth={1.8} />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            data-toolbar-tooltip="Delete"
                            aria-label={
                              isSavedProposalRoute
                                ? "Delete saved proposal"
                                : "Delete draft"
                            }
                            className="dasti-icon-button"
                            onClick={() => setIsConfirmingGeneratedDelete(true)}
                          >
                            <Trash size={15} strokeWidth={1.7} />
                          </button>
                        )}
                      </span>
                    ) : null
                  }
                />
              </div>
            </div>
          </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default ProposalForgeNext;
