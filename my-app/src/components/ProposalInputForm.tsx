"use client";

import React from "react";
import { useForm } from "react-hook-form";
import styles from "./ProposalInputForm.module.css";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "./ui/dialog";
import { Menu, type MenuSection } from "./ui/menu";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import { formSchema, FormValues } from "./ProposalInputForm.schemas";
import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  getProposalVoicePresetDefinition,
  isProposalVoicePresetSupportedForMode,
  resolveProposalVoicePreset,
  type ProposalVoicePreset,
} from "../../convex/lib/proposals/voicePresets";
import {
  DEFAULT_PROPOSAL_CHARACTER_LIMIT_MODE,
  DEFAULT_PROPOSAL_CHARACTER_LIMIT_VALUE,
  sanitizeProposalCharacterLimit,
} from "../../convex/lib/proposals/generationControls";
import {
  buildAppProposalPersonalizationPayload,
  clearActiveLocalCvId,
  getActiveLocalPersonalizationSource,
  getLocalPersonalizationSourceByCvId,
  getLocalActiveCvSnapshotById,
  listLocalCvPickerOptions,
  setActiveLocalCvId,
  type LocalCvPickerOption,
} from "../lib/proposal-personalization";
import {
  getProposalGenerationUiErrorMessage,
  type ProposalGenerationFallbackInfo,
} from "../lib/proposal-generation-ui";
import {
  buildProposalGenerationRequest,
  type ProposalGenerationRequestPayload,
} from "../lib/proposal-generation-request";
import { ensureProposalSignatureName } from "../lib/proposal-closing";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";
import { useScrollEdgeFades } from "../hooks/use-scroll-edge-fades";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";
import { getProposalSourceLabel } from "../lib/proposal-source-platforms";
import {
  ArrowSquareOut,
  Check,
  ChevronDown,
  FolderTree,
  Paperclip,
  Pencil,
  X,
} from "@/lib/icons";
import {
  readStoredProposalComposeDraft,
  writeStoredProposalComposeDraft,
  type StoredProposalComposeDraft,
} from "../lib/proposal-workspace-state";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { readCssDurationMs } from "../lib/readCssDuration";
import {
  getProposalGenerateButtonVisualClass,
  ProposalGenerateButtonGlyph,
  type ProposalGenerateButtonVisualState,
} from "./ProposalGenerateGlyph";
import { buildProposalSourceSummary } from "../lib/proposal-source-summary";
import { CvPickerCard } from "./cv/CvPickerCard";
import { ToneBadge, type ToneBadgeTone } from "./ui/tone-badge";

interface ProposalInputFormProps {
  onSubmit: (
    values: FormValues,
    proposalContent: string,
    fallbackInfo?: ProposalGenerationFallbackInfo,
    proposalId?: Id<"proposals">,
  ) => void;
  onStart?: (values: FormValues) => void;
  onStop?: () => void;
  onError?: (
    message: string,
    values: FormValues,
    rawReason?: string | null,
  ) => void;
  onSubmitAnimationComplete?: () => void;
  onValuesChange?: (values: FormValues) => void;
  prefill?: {
    handoffId: string;
    jobId?: string;
    jobTitle: string;
    jobDescription: string;
    sourceUrl?: string;
    platform?: string;
  } | null;
  cvPickerRequestKey?: number;
  /** When true, the visible CV picker chip is hidden while the dialog logic stays mounted. */
  suppressCvPicker?: boolean;
  /** Optional controlled state for the CV chooser dialog. */
  cvPickerOpen?: boolean;
  onCvPickerOpenChange?: (open: boolean) => void;
  /** When true, the tone chip and tone menu in the command bar are hidden.
   *  Used by /proposal-next where tone lives in the left compose toolbar. */
  suppressToneControls?: boolean;
  /** Optional external tone source used by workspace-level toolbars. */
  externalVoicePreset?: FormValues["voicePreset"] | null;
  externalCharacterLimitMode?: FormValues["characterLimitMode"] | null;
  externalCharacterLimitValue?: FormValues["characterLimitValue"] | null;
  onActiveCvChange?: (cvId: string | null) => void;
  activeCvId?: string | null;
  headerLabel?: string | null;
  headerAction?: React.ReactNode;
  jobDescriptionPlaceholder?: string;
  initialComposeDraft?: StoredProposalComposeDraft | null;
  onGenerateControlChange?: (control: ProposalGenerateControl | null) => void;
  sourceUrl?: string | null;
  sourcePlatform?: string | null;
  canonicalJobId?: string | null;
}

export type ProposalGenerateControl = {
  trigger: () => void;
  label: string;
  disabled: boolean;
  state: ProposalGenerateButtonVisualState;
};

type GenerateProposalPayload = ProposalGenerationRequestPayload;

type GenerateProposalResult = {
  proposalId: Id<"proposals">;
  proposalContent: string;
} & Required<ProposalGenerationFallbackInfo>;

const DEFAULT_COMPOSE_CHARACTER_LIMIT_MODE =
  DEFAULT_PROPOSAL_CHARACTER_LIMIT_MODE;
const DEFAULT_COMPOSE_CHARACTER_LIMIT_VALUE =
  DEFAULT_PROPOSAL_CHARACTER_LIMIT_VALUE;

const VISIBLE_MODEL_OPTIONS = [{ value: "chatgpt", label: "ChatGPT" }] as const;
const PROPOSAL_FORM_MODEL_TYPES = [
  "chatgpt",
  "mistral-small-latest",
  "mistral-large-latest",
  "mistral-agent",
] as const;
type ProposalFormModelType = (typeof PROPOSAL_FORM_MODEL_TYPES)[number];

function resolveDefaultProposalModelType(): ProposalFormModelType {
  const rawValue = String(
    ((import.meta as any).env?.VITE_PROPOSAL_MODEL_TYPE ??
      (import.meta as any).env?.VITE_PROPOSAL_DEFAULT_MODEL_TYPE ??
      "") as string,
  ).trim();
  return PROPOSAL_FORM_MODEL_TYPES.includes(rawValue as ProposalFormModelType)
    ? (rawValue as ProposalFormModelType)
    : "chatgpt";
}

const DEFAULT_PROPOSAL_MODEL_TYPE = resolveDefaultProposalModelType();
const VISIBLE_PROPOSAL_TYPE_OPTIONS = [
  { value: "cover_letter", label: "Cover letter" },
  { value: "freelance_proposal", label: "Freelance proposal" },
] as const;

const TONE_OPTIONS: Array<{
  id: ProposalVoicePreset;
  uiLabel: string;
  description: string;
  tone: ToneBadgeTone;
}> = [
  {
    id: "engaging",
    uiLabel: getVoicePresetDisplayLabel("engaging"),
    description: "Warm and approachable.",
    tone: "warm",
  },
  {
    id: "signature",
    uiLabel: getVoicePresetDisplayLabel("signature"),
    description: "Natural and credible.",
    tone: "natural",
  },
  {
    id: "expert",
    uiLabel: getVoicePresetDisplayLabel("expert"),
    description: "Formal and composed.",
    tone: "formal",
  },
];

const AUTO_TONE_OPTION = {
  id: null,
  uiLabel: getVoicePresetDisplayLabel(null),
  description: "Auto-fit to the client.",
  tone: "auto",
} as const;

const VISIBLE_TONE_OPTION_IDS = new Set<ProposalVoicePreset>(
  TONE_OPTIONS.map((option) => option.id),
);

function resolveVisibleVoicePreset(
  value: unknown,
): ProposalVoicePreset | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const preset = resolveProposalVoicePreset(value);
  return preset && VISIBLE_TONE_OPTION_IDS.has(preset) ? preset : undefined;
}

function readStoredComposeDraft(
  initialComposeDraft?: StoredProposalComposeDraft | null,
): Partial<FormValues> {
  const parsed = initialComposeDraft ?? readStoredProposalComposeDraft();
  if (!parsed) return {};

  return {
    jobTitle: typeof parsed.jobTitle === "string" ? parsed.jobTitle : "",
    jobDescription:
      typeof parsed.jobDescription === "string" ? parsed.jobDescription : "",
    proposalType:
      parsed.proposalType === "freelance_proposal" ||
      parsed.proposalType === "cover_letter"
        ? parsed.proposalType
        : "cover_letter",
    voicePreset: resolveVisibleVoicePreset(parsed.voicePreset),
    toneTuning: null,
    characterLimitMode: DEFAULT_COMPOSE_CHARACTER_LIMIT_MODE,
    characterLimitValue: DEFAULT_COMPOSE_CHARACTER_LIMIT_VALUE,
  };
}

function normalizeProposalFormValues(values: Partial<FormValues>): FormValues {
  const voicePreset = resolveVisibleVoicePreset(values.voicePreset);
  const voicePresetDefinition = voicePreset
    ? getProposalVoicePresetDefinition(voicePreset)
    : null;

  return {
    jobTitle: typeof values.jobTitle === "string" ? values.jobTitle : "",
    jobDescription:
      typeof values.jobDescription === "string" ? values.jobDescription : "",
    proposalType:
      values.proposalType === "freelance_proposal" ||
      values.proposalType === "cover_letter"
        ? values.proposalType
        : "cover_letter",
    voicePreset,
    formalityLevel: voicePresetDefinition?.formalityLevel,
    creativity: voicePresetDefinition?.creativity,
    toneTuning: null,
    characterLimitMode: DEFAULT_COMPOSE_CHARACTER_LIMIT_MODE,
    characterLimitValue:
      sanitizeProposalCharacterLimit(values.characterLimitValue) ??
      DEFAULT_COMPOSE_CHARACTER_LIMIT_VALUE,
    modelType:
      values.modelType === "chatgpt" ||
      values.modelType === "mistral-small-latest" ||
      values.modelType === "mistral-large-latest" ||
      values.modelType === "mistral-agent"
        ? values.modelType
        : DEFAULT_PROPOSAL_MODEL_TYPE,
  };
}

function formatToolbarResumeLabel(value: string | null | undefined): string {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "Pick a resume";
  }
  if (normalized.length <= 13) {
    return normalized;
  }
  return `${normalized.slice(0, 12).trimEnd()}…`;
}

function formatImportedSourceLabel(
  platform: string | null | undefined,
  sourceUrl: string | null | undefined,
): string | null {
  return getProposalSourceLabel(platform, sourceUrl);
}

function formatImportedSourceHost(
  sourceUrl: string | null | undefined,
): string | null {
  const normalizedSourceUrl = String(sourceUrl ?? "").trim();
  if (!normalizedSourceUrl) {
    return null;
  }

  const readHostname = (value: string): string | null => {
    try {
      return new URL(value).hostname.replace(/^www\./i, "");
    } catch {
      return null;
    }
  };

  const parsedHostname =
    readHostname(normalizedSourceUrl) ??
    (/^[a-z][a-z0-9+.-]*:\/\//i.test(normalizedSourceUrl)
      ? null
      : readHostname(`https://${normalizedSourceUrl}`));

  if (parsedHostname) {
    return parsedHostname;
  }

  try {
    return (
      normalizedSourceUrl
        .replace(/^[a-z][a-z0-9+.-]*:\/\//i, "")
        .replace(/^www\./i, "")
        .split("/")[0]
        .trim() || null
    );
  } catch {
    return null;
  }
}

function normalizeSourceDescriptor(value: string | null | undefined): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^www\./, "")
    .replace(/\.[a-z]{2,}$/, "")
    .replace(/[^a-z0-9]+/g, "");
}

function shouldShowImportedSourceHost(
  label: string | null,
  host: string | null,
): boolean {
  if (!host) return false;
  const normalizedHost = normalizeSourceDescriptor(host);
  const normalizedLabel = normalizeSourceDescriptor(label);
  return !normalizedLabel || normalizedHost !== normalizedLabel;
}

const ProposalInputForm: React.FC<ProposalInputFormProps> = ({
  onSubmit,
  onStart,
  onStop,
  onError,
  onSubmitAnimationComplete,
  onValuesChange,
  prefill = null,
  cvPickerRequestKey = 0,
  suppressCvPicker = false,
  cvPickerOpen,
  onCvPickerOpenChange,
  suppressToneControls = false,
  externalVoicePreset,
  externalCharacterLimitMode,
  externalCharacterLimitValue,
  onActiveCvChange,
  activeCvId,
  headerLabel = null,
  headerAction = null,
  jobDescriptionPlaceholder = "Paste job offer",
  initialComposeDraft = null,
  onGenerateControlChange,
  sourceUrl: liveSourceUrl = null,
  sourcePlatform: liveSourcePlatform = null,
  canonicalJobId = null,
}) => {
  const navigate = useNavigate();
  const hasHeaderLabel = Boolean(headerLabel);
  const hasHeaderAction = Boolean(headerAction);
  const headerActionOnly = hasHeaderAction && !hasHeaderLabel;
  const {
    isAuthenticated: isConvexAuthenticated,
    isLoading: isConvexAuthLoading,
  } = useConvexAuth();
  const generateProposalAction = useAction(api.functions.generateProposal);
  const setSharedActiveCvSnapshot = useMutation(
    api.activeCvSnapshots.setCurrent,
  );
  const updateGeneratedProposal = useMutation(api.updateProposalPublic.default);
  const requestProposalGenerationCancel = useMutation(
    (api.jobs as any).requestProposalGenerationCancel,
  );
  const currentProposalSettings = useQuery(
    api.proposalSettings.getCurrent,
    isConvexAuthenticated ? {} : "skip",
  ) as
    | {
        voicePreset: ProposalVoicePreset;
        savedVoicePreset?: ProposalVoicePreset | null;
      }
    | undefined;
  const setCurrentVoicePreset = useMutation(api.proposalSettings.setCurrent);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [, setVoicePresetSaveError] = React.useState<string | null>(null);
  const hasControlledActiveCvId = activeCvId !== undefined;
  const [activeCvSource, setActiveCvSource] = React.useState(() =>
    hasControlledActiveCvId
      ? getLocalPersonalizationSourceByCvId(activeCvId)
      : getActiveLocalPersonalizationSource(),
  );
  const [isCvPickerOpen, setIsCvPickerOpen] = React.useState(false);
  const [pendingCvId, setPendingCvId] = React.useState<string | null>(null);
  const [cvOptions, setCvOptions] = React.useState<LocalCvPickerOption[]>(() =>
    listLocalCvPickerOptions(hasControlledActiveCvId ? activeCvId : undefined),
  );
  const { loadCv } = useCvLibrary();
  const {
    attach: attachComposeScrollEdges,
    showTop: showComposeScrollTop,
    showBottom: showComposeScrollBottom,
    topStrength: composeScrollTopStrength,
    bottomStrength: composeScrollBottomStrength,
    update: updateComposeScrollEdges,
  } = useScrollEdgeFades<HTMLDivElement>();
  const appliedPrefillRef = React.useRef<{
    handoffId: string;
    jobTitle: string;
    jobDescription: string;
  } | null>(null);
  const [generateButtonState, setGenerateButtonState] =
    React.useState<ProposalGenerateButtonVisualState>("idle");
  const generateButtonStateRef =
    React.useRef<ProposalGenerateButtonVisualState>("idle");
  const [isStopRequested, setIsStopRequested] = React.useState(false);
  const appliedSavedVoicePresetRef = React.useRef(false);
  const lastSharedSnapshotSyncStateRef = React.useRef<string | null>(null);
  const generateButtonTimersRef = React.useRef<number[]>([]);
  const submitAnimationCompleteTimerRef = React.useRef<number | null>(null);
  const activeGenerateRunIdRef = React.useRef(0);
  const activeGenerationClientRunIdRef = React.useRef<string | null>(null);
  const stopRequestedRunIdRef = React.useRef<number | null>(null);
  const lastCvPickerRequestKeyRef = React.useRef(cvPickerRequestKey);
  const shouldNotifySubmitAnimationCompleteRef = React.useRef(false);
  const shouldPlayGenerateButtonReverseRef = React.useRef(false);
  const canPersistProposalWorkspaceState =
    isConvexAuthenticated && !isConvexAuthLoading;
  const isCvPickerControlled = typeof cvPickerOpen === "boolean";
  const resolvedCvPickerOpen = isCvPickerControlled
    ? cvPickerOpen
    : isCvPickerOpen;

  const setCvPickerOpen = React.useCallback(
    (open: boolean) => {
      if (!isCvPickerControlled) {
        setIsCvPickerOpen(open);
      }
      onCvPickerOpenChange?.(open);
    },
    [isCvPickerControlled, onCvPickerOpenChange],
  );

  const refreshActiveCvState = React.useCallback(() => {
    setActiveCvSource(
      hasControlledActiveCvId
        ? getLocalPersonalizationSourceByCvId(activeCvId)
        : getActiveLocalPersonalizationSource(),
    );
    setCvOptions(
      listLocalCvPickerOptions(
        hasControlledActiveCvId ? activeCvId : undefined,
      ),
    );
  }, [activeCvId, hasControlledActiveCvId]);

  const clearGenerateButtonTimers = React.useCallback(() => {
    for (const timerId of generateButtonTimersRef.current) {
      window.clearTimeout(timerId);
    }
    generateButtonTimersRef.current = [];
    if (submitAnimationCompleteTimerRef.current !== null) {
      window.clearTimeout(submitAnimationCompleteTimerRef.current);
      submitAnimationCompleteTimerRef.current = null;
    }
  }, []);

  const notifySubmitAnimationComplete = React.useCallback(() => {
    if (!shouldNotifySubmitAnimationCompleteRef.current) {
      return;
    }
    shouldNotifySubmitAnimationCompleteRef.current = false;
    onSubmitAnimationComplete?.();
  }, [onSubmitAnimationComplete]);

  const scheduleGenerateButtonState = React.useCallback(
    (nextState: ProposalGenerateButtonVisualState, delayMs: number) => {
      const timerId = window.setTimeout(() => {
        setGenerateButtonState(nextState);
        generateButtonTimersRef.current =
          generateButtonTimersRef.current.filter((value) => value !== timerId);
      }, delayMs);

      generateButtonTimersRef.current.push(timerId);
    },
    [],
  );

  const resolveGenerateButtonTimings = React.useCallback(
    () => ({
      loadingHideMs: readCssDurationMs(
        "--proposal-submit-loading-hide-duration",
        0,
      ),
      stopRevealDelayMs: readCssDurationMs(
        "--proposal-submit-stop-reveal-delay",
        1800,
      ),
      stopRevealMs: readCssDurationMs(
        "--proposal-submit-stop-reveal-duration",
        1080,
      ),
      stopHoldMs: readCssDurationMs(
        "--proposal-submit-stop-hold-duration",
        220,
      ),
      stopUndrawMs: readCssDurationMs(
        "--proposal-submit-stop-undraw-duration",
        880,
      ),
      stopRedrawMs: readCssDurationMs(
        "--proposal-submit-stop-redraw-duration",
        1080,
      ),
    }),
    [],
  );

  const startGenerateButtonSequence = React.useCallback(() => {
    const timings = resolveGenerateButtonTimings();
    clearGenerateButtonTimers();
    shouldPlayGenerateButtonReverseRef.current = false;
    setGenerateButtonState("loading-hiding");
    scheduleGenerateButtonState("loading-spinning", timings.loadingHideMs);
    scheduleGenerateButtonState(
      "loading-revealing-stop",
      timings.loadingHideMs + timings.stopRevealDelayMs,
    );
    scheduleGenerateButtonState(
      "loading-stop",
      timings.loadingHideMs + timings.stopRevealDelayMs + timings.stopRevealMs,
    );
  }, [
    clearGenerateButtonTimers,
    resolveGenerateButtonTimings,
    scheduleGenerateButtonState,
  ]);

  const playGenerateButtonReverseSequence = React.useCallback(() => {
    const timings = resolveGenerateButtonTimings();
    clearGenerateButtonTimers();
    shouldPlayGenerateButtonReverseRef.current = false;
    setGenerateButtonState("loading-stop");
    scheduleGenerateButtonState("stop-undrawing", timings.stopHoldMs);
    scheduleGenerateButtonState(
      "stop-revealing",
      timings.stopHoldMs + timings.stopUndrawMs,
    );
    scheduleGenerateButtonState(
      "idle",
      timings.stopHoldMs + timings.stopUndrawMs + timings.stopRedrawMs,
    );
  }, [
    clearGenerateButtonTimers,
    resolveGenerateButtonTimings,
    scheduleGenerateButtonState,
  ]);

  const requestGenerateButtonReverseSequence = React.useCallback(() => {
    if (generateButtonStateRef.current === "loading-stop") {
      if (shouldNotifySubmitAnimationCompleteRef.current) {
        notifySubmitAnimationComplete();
      }
      playGenerateButtonReverseSequence();
      return;
    }
    shouldPlayGenerateButtonReverseRef.current = true;
  }, [notifySubmitAnimationComplete, playGenerateButtonReverseSequence]);

  React.useEffect(() => {
    generateButtonStateRef.current = generateButtonState;
    if (generateButtonState === "loading-stop") {
      if (shouldNotifySubmitAnimationCompleteRef.current) {
        notifySubmitAnimationComplete();
      }
      if (shouldPlayGenerateButtonReverseRef.current) {
        playGenerateButtonReverseSequence();
      }
    }
  }, [
    generateButtonState,
    notifySubmitAnimationComplete,
    playGenerateButtonReverseSequence,
  ]);

  React.useEffect(() => {
    refreshActiveCvState();
  }, [refreshActiveCvState]);

  React.useEffect(() => {
    return () => {
      clearGenerateButtonTimers();
    };
  }, [clearGenerateButtonTimers]);

  React.useEffect(() => {
    if (!canPersistProposalWorkspaceState) {
      return;
    }

    if (activeCvSource.title !== null) {
      lastSharedSnapshotSyncStateRef.current = activeCvSource.title;
    }
  }, [activeCvSource.title, canPersistProposalWorkspaceState]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobTitle: "",
      jobDescription: "",
      proposalType: "cover_letter" as const,
      voicePreset: undefined,
      formalityLevel: undefined,
      creativity: undefined,
      toneTuning: null,
      characterLimitMode: DEFAULT_COMPOSE_CHARACTER_LIMIT_MODE,
      characterLimitValue: DEFAULT_COMPOSE_CHARACTER_LIMIT_VALUE,
      modelType: DEFAULT_PROPOSAL_MODEL_TYPE,
      ...readStoredComposeDraft(initialComposeDraft),
    },
  });

  const watchedJobTitle = form.watch("jobTitle");
  const watchedJobDescription = form.watch("jobDescription");
  const selectedModelType = form.watch("modelType");
  const selectedProposalType = form.watch("proposalType");
  const selectedVoicePreset = form.watch("voicePreset");

  React.useEffect(() => {
    updateComposeScrollEdges();
  }, [updateComposeScrollEdges, watchedJobDescription]);

  React.useEffect(() => {
    const subscription = form.watch((values) => {
      const normalizedValues = normalizeProposalFormValues(values);

      if (!onValuesChange) {
        writeStoredProposalComposeDraft({
          jobTitle: normalizedValues.jobTitle,
          jobDescription: normalizedValues.jobDescription,
          proposalType: normalizedValues.proposalType,
          voicePreset: normalizedValues.voicePreset ?? undefined,
          toneTuning: normalizedValues.toneTuning ?? null,
          characterLimitMode: normalizedValues.characterLimitMode ?? null,
          characterLimitValue: normalizedValues.characterLimitValue ?? null,
        });
      }

      onValuesChange?.(normalizedValues);
    });

    return () => subscription.unsubscribe();
  }, [form, onValuesChange]);
  const isPresetSupportedForSelectedMode = React.useCallback(
    (preset: ProposalVoicePreset) =>
      isProposalVoicePresetSupportedForMode({
        preset,
        proposalType: selectedProposalType,
        modelType: selectedModelType,
      }),
    [selectedModelType, selectedProposalType],
  );
  const savedVoicePreset = resolveVisibleVoicePreset(
    currentProposalSettings?.savedVoicePreset,
  );
  const selectedVisibleVoicePreset =
    selectedVoicePreset &&
    isPresetSupportedForSelectedMode(selectedVoicePreset) &&
    VISIBLE_TONE_OPTION_IDS.has(selectedVoicePreset)
      ? selectedVoicePreset
      : undefined;
  const displayedVoicePreset =
    selectedVisibleVoicePreset ??
    (savedVoicePreset && isPresetSupportedForSelectedMode(savedVoicePreset)
      ? savedVoicePreset
      : DEFAULT_PROPOSAL_VOICE_PRESET);
  const selectedVoicePresetDefinition = React.useMemo(
    () => getProposalVoicePresetDefinition(displayedVoicePreset),
    [displayedVoicePreset],
  );
  const activeCvOption = React.useMemo(
    () => cvOptions.find((option) => option.isActive) ?? null,
    [cvOptions],
  );
  const hasAttachedCv = Boolean(
    activeCvOption?.id || activeCvSource.personalizationContext,
  );
  const activeCvTitle = hasAttachedCv
    ? activeCvOption?.title ?? activeCvSource.title
    : null;
  const pendingCvOption = React.useMemo(
    () => cvOptions.find((option) => option.id === pendingCvId) ?? null,
    [cvOptions, pendingCvId],
  );

  const applyVoicePresetSelection = React.useCallback(
    (
      preset: ProposalVoicePreset | null,
      options?: {
        shouldDirty?: boolean;
        shouldTouch?: boolean;
      },
    ) => {
      const fieldOptions = {
        shouldDirty: options?.shouldDirty ?? true,
        shouldTouch: options?.shouldTouch ?? false,
        shouldValidate: true,
      };

      if (!preset) {
        form.setValue("voicePreset", undefined, fieldOptions);
        form.setValue("formalityLevel", undefined, fieldOptions);
        form.setValue("creativity", undefined, fieldOptions);
        return;
      }

      const presetDefinition = getProposalVoicePresetDefinition(preset);
      form.setValue("voicePreset", preset, fieldOptions);
      form.setValue(
        "formalityLevel",
        presetDefinition.formalityLevel,
        fieldOptions,
      );
      form.setValue("creativity", presetDefinition.creativity, fieldOptions);
    },
    [form],
  );

  React.useEffect(() => {
    if (externalVoicePreset !== undefined) {
      return;
    }

    if (!savedVoicePreset || appliedSavedVoicePresetRef.current) return;

    const hasTouchedToneControls =
      Boolean(form.formState.dirtyFields.voicePreset) ||
      Boolean(form.formState.dirtyFields.formalityLevel) ||
      Boolean(form.formState.dirtyFields.creativity);

    if (hasTouchedToneControls) return;

    applyVoicePresetSelection(savedVoicePreset, {
      shouldDirty: false,
      shouldTouch: false,
    });
    appliedSavedVoicePresetRef.current = true;
  }, [
    applyVoicePresetSelection,
    externalVoicePreset,
    form.formState.dirtyFields.creativity,
    form.formState.dirtyFields.formalityLevel,
    form.formState.dirtyFields.voicePreset,
    savedVoicePreset,
  ]);

  React.useEffect(() => {
    if (externalVoicePreset === undefined) {
      return;
    }

    const currentFormPreset = form.getValues("voicePreset") ?? null;
    if (currentFormPreset === externalVoicePreset) {
      return;
    }

    applyVoicePresetSelection(externalVoicePreset, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [applyVoicePresetSelection, externalVoicePreset, form]);

  React.useEffect(() => {
    if (externalCharacterLimitMode === undefined) {
      return;
    }

    const currentMode = form.getValues("characterLimitMode") ?? null;
    const currentValue = form.getValues("characterLimitValue") ?? null;
    const nextMode = externalCharacterLimitMode ?? DEFAULT_COMPOSE_CHARACTER_LIMIT_MODE;
    const nextValue =
      sanitizeProposalCharacterLimit(externalCharacterLimitValue) ??
      DEFAULT_COMPOSE_CHARACTER_LIMIT_VALUE;

    if (currentMode !== nextMode) {
      form.setValue("characterLimitMode", nextMode, {
        shouldDirty: false,
        shouldTouch: false,
      });
    }

    if (currentValue !== nextValue) {
      form.setValue("characterLimitValue", nextValue, {
        shouldDirty: false,
        shouldTouch: false,
      });
    }
  }, [externalCharacterLimitMode, externalCharacterLimitValue, form]);

  React.useEffect(() => {
    if (!selectedVoicePreset) {
      return;
    }

    if (isPresetSupportedForSelectedMode(selectedVoicePreset)) {
      return;
    }

    applyVoicePresetSelection(DEFAULT_PROPOSAL_VOICE_PRESET, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [
    applyVoicePresetSelection,
    isPresetSupportedForSelectedMode,
    selectedVoicePreset,
  ]);

  React.useEffect(() => {
    if (
      VISIBLE_MODEL_OPTIONS.some((option) => option.value === selectedModelType)
    ) {
      return;
    }

    form.setValue("modelType", "chatgpt", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
  }, [form, selectedModelType]);

  React.useEffect(() => {
    if (
      VISIBLE_PROPOSAL_TYPE_OPTIONS.some(
        (option) => option.value === selectedProposalType,
      )
    ) {
      return;
    }

    form.setValue("proposalType", "cover_letter", {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
  }, [form, selectedProposalType]);

  React.useEffect(() => {
    if (!prefill?.handoffId) {
      appliedPrefillRef.current = null;
      return;
    }

    // Same handoff — already applied, nothing to do.
    if (appliedPrefillRef.current?.handoffId === prefill.handoffId) return;

    // Handoff content is authoritative. Browser draft restore must not block
    // "Open in Proposal Forge" flows coming from the extension or another page.
    form.setValue("jobTitle", prefill.jobTitle, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
    form.setValue("jobDescription", prefill.jobDescription, {
      shouldDirty: false,
      shouldTouch: false,
      shouldValidate: true,
    });
    appliedPrefillRef.current = {
      handoffId: prefill.handoffId,
      jobTitle: prefill.jobTitle,
      jobDescription: prefill.jobDescription,
    };
  }, [form, prefill]);

  function handleVoicePresetChange(preset: ProposalVoicePreset | null) {
    const currentFormPreset = form.getValues("voicePreset") ?? null;
    appliedSavedVoicePresetRef.current = true;

    if (preset !== currentFormPreset) {
      applyVoicePresetSelection(preset);
    }

    if ((currentProposalSettings?.savedVoicePreset ?? null) === preset) {
      return;
    }

    setVoicePresetSaveError(null);

    if (!canPersistProposalWorkspaceState) {
      setVoicePresetSaveError(
        "Preset applied locally. Sign in to save the app default.",
      );
      return;
    }

    void setCurrentVoicePreset({ voicePreset: preset })
      .then(() => {
        setVoicePresetSaveError(null);
      })
      .catch((error: unknown) => {
        console.warn(
          "[ProposalInputForm] Failed to persist proposal voice preset",
          error,
        );
        setVoicePresetSaveError(
          "Preset applied locally, but the app default could not be saved.",
        );
      });
  }

  async function handleSubmit(values: FormValues) {
    if (isGenerating) {
      return;
    }

    const runId = activeGenerateRunIdRef.current + 1;
    const clientRunId = crypto.randomUUID();
    activeGenerateRunIdRef.current = runId;
    activeGenerationClientRunIdRef.current = clientRunId;
    stopRequestedRunIdRef.current = null;

    const currentActiveCvSource = hasControlledActiveCvId
      ? getLocalPersonalizationSourceByCvId(activeCvId)
      : getActiveLocalPersonalizationSource();
    const hasCandidateContext = Boolean(
      currentActiveCvSource.personalizationContext,
    );

    const normalizedValues = normalizeProposalFormValues(values);

    try {
      shouldNotifySubmitAnimationCompleteRef.current = false;
      setIsGenerating(true);
      setIsStopRequested(false);
      startGenerateButtonSequence();
      setErrorMessage(null);
      onStart?.(normalizedValues);

      const payload = {
        ...buildProposalGenerationRequest(
          normalizedValues,
          buildAppProposalPersonalizationPayload(currentActiveCvSource),
          undefined,
          canonicalJobId,
        ),
        clientRunId,
      };

      const runGenerateProposal = generateProposalAction as unknown as (
        input: GenerateProposalPayload,
      ) => Promise<GenerateProposalResult | null>;

      let result: GenerateProposalResult | null;

      try {
        result = await runGenerateProposal(payload);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : String(error);
        const validatorRejectedClientRunId =
          errorMessage.includes("ArgumentValidationError") &&
          errorMessage.includes("extra field `clientRunId`");

        if (!validatorRejectedClientRunId) {
          throw error;
        }

        console.warn(
          "[ProposalInputForm] generateProposal rejected clientRunId, retrying without cancellation metadata",
        );
        if (activeGenerationClientRunIdRef.current === clientRunId) {
          activeGenerationClientRunIdRef.current = null;
        }
        const { clientRunId: _clientRunId, ...legacyPayload } = payload;
        result = await runGenerateProposal(legacyPayload);
      }
      if (stopRequestedRunIdRef.current === runId) {
        return;
      }
      if (result) {
        const signedProposalContent = ensureProposalSignatureName(
          result.proposalContent,
          currentActiveCvSource.personalizationContext?.name,
        );
        onSubmit(
          normalizedValues,
          signedProposalContent,
          {
            requestedModelType: result.requestedModelType,
            actualModelType: result.actualModelType,
            fallbackTriggerCode: result.fallbackTriggerCode,
          },
          result.proposalId,
        );
        shouldNotifySubmitAnimationCompleteRef.current = true;

        // The generation action already stores the proposal. Mark that row as a
        // draft instead of inserting a second saved-history entry from the client.
        if (canPersistProposalWorkspaceState) {
          void updateGeneratedProposal({
            id: result.proposalId,
            content: signedProposalContent,
            sections: [{ type: "text", content: signedProposalContent }],
            status: "draft",
          }).catch((saveErr) => {
            console.warn(
              "Failed to update generated proposal status:",
              saveErr,
            );
          });
        }
      } else {
        const nextErrorMessage = "Empty response. Try again.";
        setErrorMessage(nextErrorMessage);
        onError?.(nextErrorMessage, normalizedValues);
      }
    } catch (error: unknown) {
      console.error("Error generating proposal:", error);
      if (stopRequestedRunIdRef.current === runId) {
        return;
      }
      const nextErrorMessage = getProposalGenerationUiErrorMessage({
        error,
        proposalType: values.proposalType,
        hasCandidateContext,
      });
      const rawReason = error instanceof Error ? error.message : null;
      setErrorMessage(nextErrorMessage);
      onError?.(nextErrorMessage, normalizedValues, rawReason);
      shouldNotifySubmitAnimationCompleteRef.current = false;
    } finally {
      const stoppedRunId = stopRequestedRunIdRef.current;
      if (stoppedRunId !== runId) {
        if (shouldNotifySubmitAnimationCompleteRef.current) {
          requestGenerateButtonReverseSequence();
        } else {
          requestGenerateButtonReverseSequence();
        }
      }
      if (activeGenerateRunIdRef.current === runId) {
        activeGenerateRunIdRef.current = 0;
      }
      if (activeGenerationClientRunIdRef.current === clientRunId) {
        activeGenerationClientRunIdRef.current = null;
      }
      if (stoppedRunId === runId) {
        stopRequestedRunIdRef.current = null;
      }
      setIsStopRequested(false);
      setIsGenerating(false);
    }
  }

  function handleOpenCvPicker() {
    const nextOptions = listLocalCvPickerOptions(
      hasControlledActiveCvId ? activeCvId : undefined,
    );
    setActiveCvSource(
      hasControlledActiveCvId
        ? getLocalPersonalizationSourceByCvId(activeCvId)
        : getActiveLocalPersonalizationSource(),
    );
    setCvOptions(nextOptions);
    setPendingCvId(
      activeCvId ?? nextOptions.find((option) => option.isActive)?.id ?? null,
    );
    setCvPickerOpen(true);
  }

  React.useEffect(() => {
    if (cvPickerRequestKey === lastCvPickerRequestKeyRef.current) {
      return;
    }
    lastCvPickerRequestKeyRef.current = cvPickerRequestKey;

    if (cvPickerRequestKey <= 0) {
      return;
    }
    handleOpenCvPicker();
  }, [cvPickerRequestKey]);

  function handleCloseCvPicker() {
    setCvPickerOpen(false);
    setPendingCvId(null);
  }

  const syncSelectedCvToSharedActiveSnapshot = React.useCallback(
    (id: string) => {
      const snapshot = getLocalActiveCvSnapshotById(id);
      if (!snapshot) {
        console.warn(
          "[ProposalInputForm] Unable to resolve selected CV for shared active snapshot sync",
          { id },
        );
        return;
      }

      if (!canPersistProposalWorkspaceState) {
        return;
      }

      void setSharedActiveCvSnapshot({ snapshot }).catch((err) => {
        console.warn(
          "[ProposalInputForm] Shared active CV snapshot sync failed",
          err,
        );
      });
    },
    [canPersistProposalWorkspaceState, setSharedActiveCvSnapshot],
  );

  function handleSelectCv(id: string) {
    if (!hasControlledActiveCvId) {
      setActiveLocalCvId(id);
    }
    refreshActiveCvState();
    setPendingCvId(id);
    setCvPickerOpen(false);
    syncSelectedCvToSharedActiveSnapshot(id);
    onActiveCvChange?.(id);
  }

  function handleClearCv() {
    if (!hasControlledActiveCvId) {
      clearActiveLocalCvId();
    }
    setCvPickerOpen(false);
    setPendingCvId(null);
    setActiveCvSource({ title: null, personalizationContext: null });
    setCvOptions(
      listLocalCvPickerOptions(hasControlledActiveCvId ? null : undefined),
    );
    lastSharedSnapshotSyncStateRef.current = "none";
    if (!canPersistProposalWorkspaceState) {
      onActiveCvChange?.(null);
      return;
    }
    onActiveCvChange?.(null);
    void setSharedActiveCvSnapshot({ snapshot: null }).catch((err) => {
      console.warn(
        "[ProposalInputForm] Shared active CV snapshot clear failed",
        err,
      );
    });
  }

  function handleOpenCvInForge(id: string) {
    if (!hasControlledActiveCvId) {
      setActiveLocalCvId(id);
    }
    loadCv(id);
    refreshActiveCvState();
    setPendingCvId(id);
    setCvPickerOpen(false);
    syncSelectedCvToSharedActiveSnapshot(id);
    onActiveCvChange?.(id);
    React.startTransition(() => {
      void navigate(`/cv?id=${encodeURIComponent(id)}`);
    });
  }

  function handleConfirmPendingCv() {
    if (!pendingCvId) return;
    handleSelectCv(pendingCvId);
  }

  const jobDescriptionRef = React.useRef<HTMLTextAreaElement | null>(null);

  const typeLabel =
    selectedProposalType === "cover_letter" ? "Letter" : "Proposal";
  const toneUiLabel = selectedVisibleVoicePreset
    ? TONE_OPTIONS.find((t) => t.id === selectedVisibleVoicePreset)?.uiLabel ??
      selectedVoicePresetDefinition.label
    : AUTO_TONE_OPTION.uiLabel;
  const typeMenuSections: MenuSection[] = [
    {
      items: (
        [
          {
            value: "cover_letter",
            label: "Letter",
            desc: "For a job application.",
          },
          {
            value: "freelance_proposal",
            label: "Proposal",
            desc: "For a freelance project.",
          },
        ] as const
      )
        .filter((opt) => opt.value !== selectedProposalType)
        .map((opt) => ({
          id: opt.value,
          label: opt.label,
          description: opt.desc,
          onSelect: () => {
            form.setValue("proposalType", opt.value, {
              shouldDirty: true,
              shouldValidate: true,
            });
          },
        })),
    },
  ];
  const toneMenuSections: MenuSection[] = [
    {
      items: [AUTO_TONE_OPTION, ...TONE_OPTIONS].map((opt) => {
        const isSelected =
          opt.id === null
            ? !selectedVisibleVoicePreset
            : selectedVisibleVoicePreset === opt.id;
        return {
          id: opt.id ?? "auto",
          role: "menuitemradio",
          selected: isSelected,
          label: (
            <ToneBadge tone={opt.tone}>{opt.uiLabel}</ToneBadge>
          ),
          description: opt.description,
          onSelect: () => handleVoicePresetChange(opt.id),
        };
      }),
    },
  ];
  const [isRawJobTextExpanded, setIsRawJobTextExpanded] =
    React.useState<boolean>(true);
  const sourceSummary = React.useMemo(
    () =>
      buildProposalSourceSummary({
        jobTitle: watchedJobTitle,
        jobDescription: watchedJobDescription,
        voicePreset: selectedVisibleVoicePreset ?? null,
      }),
    [selectedVisibleVoicePreset, watchedJobDescription, watchedJobTitle],
  );
  const hasStructuredSourceSummary = React.useMemo(
    () =>
      Boolean(
        sourceSummary.company ||
          sourceSummary.location ||
          sourceSummary.city ||
          sourceSummary.address ||
          sourceSummary.email ||
          sourceSummary.phone ||
          sourceSummary.role ||
          sourceSummary.responsibilities.length ||
          sourceSummary.keywords.length ||
          sourceSummary.toneCues.length,
      ),
    [sourceSummary],
  );
  const sourceMetadataCards = React.useMemo(
    () =>
      [
        { label: "Company", value: sourceSummary.company },
        { label: "Role", value: sourceSummary.role },
        {
          label: "City",
          value:
            sourceSummary.city && sourceSummary.city !== sourceSummary.location
              ? sourceSummary.city
              : null,
        },
        { label: "Location", value: sourceSummary.location },
        { label: "Email", value: sourceSummary.email },
        { label: "Phone", value: sourceSummary.phone },
        { label: "Address", value: sourceSummary.address },
      ].filter(
        (
          item,
        ): item is {
          label: string;
          value: string;
        } => Boolean(item.value),
      ),
    [sourceSummary],
  );
  // Fall back to persisted draft values once handoff URL param is consumed and prefill becomes null
  const draftSourceUrl = React.useMemo(
    () =>
      liveSourceUrl ??
      initialComposeDraft?.sourceUrl ??
      prefill?.sourceUrl ??
      readStoredProposalComposeDraft()?.sourceUrl ??
      null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialComposeDraft?.sourceUrl, liveSourceUrl, prefill?.sourceUrl],
  );
  const draftPlatform = React.useMemo(
    () =>
      liveSourcePlatform ??
      initialComposeDraft?.platform ??
      prefill?.platform ??
      readStoredProposalComposeDraft()?.platform ??
      null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [initialComposeDraft?.platform, liveSourcePlatform, prefill?.platform],
  );
  const [stickyImportedSource, setStickyImportedSource] = React.useState<{
    sourceUrl: string | null;
    platform: string | null;
  }>(() => ({
    sourceUrl: draftSourceUrl,
    platform: draftPlatform,
  }));
  React.useEffect(() => {
    if (!draftSourceUrl && !draftPlatform) {
      return;
    }

    setStickyImportedSource((current) => ({
      sourceUrl: draftSourceUrl ?? current.sourceUrl,
      platform: draftPlatform ?? current.platform,
    }));
  }, [draftPlatform, draftSourceUrl]);
  const resolvedDraftSourceUrl =
    draftSourceUrl ?? stickyImportedSource.sourceUrl;
  const resolvedDraftPlatform = draftPlatform ?? stickyImportedSource.platform;
  const importedSourceLabel = React.useMemo(
    () =>
      formatImportedSourceLabel(resolvedDraftPlatform, resolvedDraftSourceUrl),
    [resolvedDraftPlatform, resolvedDraftSourceUrl],
  );
  const importedSourceHost = React.useMemo(
    () => formatImportedSourceHost(resolvedDraftSourceUrl),
    [resolvedDraftSourceUrl],
  );
  const visibleImportedSourceHost = React.useMemo(
    () =>
      shouldShowImportedSourceHost(importedSourceLabel, importedSourceHost)
        ? importedSourceHost
        : null,
    [importedSourceHost, importedSourceLabel],
  );
  React.useEffect(() => {
    updateComposeScrollEdges();
  }, [
    hasStructuredSourceSummary,
    isRawJobTextExpanded,
    sourceMetadataCards.length,
    sourceSummary.keywords.length,
    sourceSummary.responsibilities.length,
    sourceSummary.toneCues.length,
    updateComposeScrollEdges,
  ]);
  const canStopGeneration =
    isGenerating && !isStopRequested && generateButtonState === "loading-stop";
  const generateButtonLabel = canStopGeneration
    ? "Stop generating"
    : isStopRequested
      ? "Stopping"
      : isGenerating
        ? "Generating"
        : "Generate";
  const generateButtonVisualClass =
    getProposalGenerateButtonVisualClass(generateButtonState);
  const canSubmitGeneration = !isGenerating && generateButtonState === "idle";
  const composeInputTypography = React.useMemo(
    () => getProposalDocumentTypography(null),
    [],
  );
  const { ref: jobDescriptionFieldRef, ...jobDescriptionFieldProps } =
    form.register("jobDescription");
  const hasJobOfferText = watchedJobDescription.trim().length > 0;
  const canToggleRawJobText = hasJobOfferText;
  const shouldShowRawJobEditor = !canToggleRawJobText || isRawJobTextExpanded;
  const shouldShowImportedSourceCard =
    hasJobOfferText && Boolean(importedSourceLabel);
  const shouldShowSourceSummaryStack =
    shouldShowImportedSourceCard || hasStructuredSourceSummary;

  React.useEffect(() => {
    if (!canToggleRawJobText && !isRawJobTextExpanded) {
      setIsRawJobTextExpanded(true);
    }
  }, [canToggleRawJobText, isRawJobTextExpanded]);

  const handleGenerateButtonClick = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      if (!isGenerating || !canStopGeneration) {
        return;
      }

      event.preventDefault();
      stopRequestedRunIdRef.current = activeGenerateRunIdRef.current;
      setIsStopRequested(true);
      setIsGenerating(false);
      const clientRunId = activeGenerationClientRunIdRef.current;
      if (clientRunId) {
        void requestProposalGenerationCancel({ clientRunId }).catch((error) => {
          console.warn(
            "[ProposalInputForm] Failed to request proposal cancellation",
            error,
          );
        });
      }
      onStop?.();
      requestGenerateButtonReverseSequence();
    },
    [
      canStopGeneration,
      isGenerating,
      onStop,
      requestProposalGenerationCancel,
      requestGenerateButtonReverseSequence,
    ],
  );

  const handleGenerateControlTrigger = React.useCallback(() => {
    if (isGenerating) {
      if (!canStopGeneration) {
        return;
      }

      stopRequestedRunIdRef.current = activeGenerateRunIdRef.current;
      setIsStopRequested(true);
      setIsGenerating(false);
      const clientRunId = activeGenerationClientRunIdRef.current;
      if (clientRunId) {
        void requestProposalGenerationCancel({ clientRunId }).catch((error) => {
          console.warn(
            "[ProposalInputForm] Failed to request proposal cancellation",
            error,
          );
        });
      }
      onStop?.();
      requestGenerateButtonReverseSequence();
      return;
    }

    if (watchedJobDescription.length < 10 || !canSubmitGeneration) {
      return;
    }

    void form.handleSubmit(handleSubmit)();
  }, [
    canStopGeneration,
    canSubmitGeneration,
    form,
    handleSubmit,
    isGenerating,
    onStop,
    requestProposalGenerationCancel,
    requestGenerateButtonReverseSequence,
    watchedJobDescription.length,
  ]);

  React.useEffect(() => {
    if (!onGenerateControlChange) {
      return;
    }

    onGenerateControlChange({
      trigger: handleGenerateControlTrigger,
      label: generateButtonLabel,
      disabled:
        watchedJobDescription.length < 10 ||
        (isGenerating && !canStopGeneration),
      state: generateButtonState,
    });
  }, [
    canStopGeneration,
    generateButtonLabel,
    generateButtonState,
    handleGenerateControlTrigger,
    isGenerating,
    onGenerateControlChange,
    watchedJobDescription.length,
  ]);

  React.useEffect(() => {
    return () => {
      onGenerateControlChange?.(null);
    };
  }, [onGenerateControlChange]);

  return (
    <div className={styles.container}>
      {!suppressCvPicker ? (
        <Dialog
          open={resolvedCvPickerOpen}
          onClose={handleCloseCvPicker}
          title="Choose resume"
        >
          <DialogContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Pick a resume to personalize the letter.
          </p>
          {cvOptions.length === 0 ? (
            <div className="border px-4 py-4 text-sm text-muted-foreground [background:var(--sf2)] [border-color:var(--color-border)] [border-radius:var(--radius-card)]">
              No resumes. Create or import.
            </div>
          ) : (
            <div
              className="dasti-grid-auto"
              style={
                {
                  "--grid-min-col": "280px",
                  "--grid-gap": "var(--layout-card-grid)",
                  maxHeight: "50vh",
                  overflowY: "auto",
                } as React.CSSProperties
              }
            >
              {cvOptions.map((option) => {
                const isSelected =
                  pendingCvId === option.id ||
                  (pendingCvId === null && option.isActive);
                return (
                  <CvPickerCard
                    key={option.id}
                    option={option}
                    selected={isSelected}
                    onSelect={setPendingCvId}
                  />
                );
              })}
            </div>
          )}
          <div
            className="dasti-cluster"
            style={
              {
                "--cluster-gap": "var(--space-2)",
                justifyContent: "flex-end",
                paddingTop: "var(--space-2)",
              } as React.CSSProperties
            }
          >
            {activeCvSource.title ? (
              <button
                type="button"
                className="dasti-button dasti-button--secondary dasti-button--sm"
                onClick={handleClearCv}
              >
                <X size={14} strokeWidth={1.8} aria-hidden />
                <span>Remove</span>
              </button>
            ) : null}
            <button
              type="button"
              className="dasti-button dasti-button--secondary dasti-button--sm"
              onClick={() => {
                if (pendingCvOption) {
                  handleOpenCvInForge(pendingCvOption.id);
                }
              }}
              disabled={!pendingCvOption}
            >
              <Pencil size={15} strokeWidth={1.6} aria-hidden />
              <span>Edit</span>
            </button>
            <button
              type="button"
              className="dasti-button dasti-button--accent dasti-button--sm"
              onClick={handleConfirmPendingCv}
              disabled={!pendingCvId}
            >
              <Check size={16} strokeWidth={1.9} aria-hidden />
              <span>Use resume</span>
            </button>
          </div>
          </DialogContent>
        </Dialog>
      ) : null}
      <form
        autoComplete="off"
        onSubmit={(e) => {
          void form.handleSubmit(handleSubmit)(e);
        }}
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {/* Main inputs */}
          <div className="md:col-span-2">
            <div
              className={styles.composeWell}
              style={{ position: "relative" }}
            >
              <div className="dasti-proposal-sheet dasti-proposal-sheet--composer">
                <div className="dasti-proposal-sheet__header dasti-proposal-sheet__header--composer">
                  <div className="dasti-proposal-sheet__heading dasti-proposal-sheet__heading--full">
                    {hasHeaderLabel ||
                    (hasHeaderAction && !headerActionOnly) ? (
                      <div className="dasti-proposal-compose-shell__header-row">
                        {hasHeaderLabel ? (
                          <p className="dasti-proposal-compose-shell__status-heading">
                            {headerLabel}
                          </p>
                        ) : (
                          <span />
                        )}
                        {headerAction}
                      </div>
                    ) : null}
                    {headerActionOnly ? (
                      <div className="dasti-proposal-compose-shell__header-row dasti-proposal-compose-shell__header-row--title">
                        <input
                          type="text"
                          id="jobTitle"
                          {...form.register("jobTitle")}
                          className={clsx(
                            styles.jobTitleField,
                            "dasti-proposal-title-input",
                            "dasti-proposal-title-input--with-header-action",
                          )}
                          placeholder="Job title"
                          autoComplete="off"
                        />
                        {headerAction}
                      </div>
                    ) : (
                      <input
                        type="text"
                        id="jobTitle"
                        {...form.register("jobTitle")}
                        className={clsx(
                          styles.jobTitleField,
                          "dasti-proposal-title-input",
                        )}
                        placeholder="Job title"
                        autoComplete="off"
                      />
                    )}
                  </div>
                </div>
                <div
                  className="dasti-proposal-sheet__body dasti-proposal-sheet__body--composer"
                  data-scroll-top={showComposeScrollTop ? "true" : "false"}
                  data-scroll-bottom={
                    showComposeScrollBottom ? "true" : "false"
                  }
                  style={
                    {
                      "--proposal-scroll-top-strength":
                        composeScrollTopStrength.toFixed(3),
                      "--proposal-scroll-bottom-strength":
                        composeScrollBottomStrength.toFixed(3),
                    } as React.CSSProperties
                  }
                >
                  <div
                    className="dasti-proposal-source-scroll-region"
                    ref={attachComposeScrollEdges}
                  >
                    {shouldShowSourceSummaryStack ? (
                      <div className="dasti-proposal-source-summary-stack">
                        {shouldShowImportedSourceCard ? (
                          <div className="dasti-proposal-source-summary__job-offer-card">
                            <div className="dasti-proposal-source-summary__job-offer-row">
                              <div className="dasti-proposal-source-summary__job-offer-copy">
                                <span className="dasti-proposal-source-summary__job-offer-kicker">
                                  Job offer
                                </span>
                                {resolvedDraftSourceUrl ? (
                                  <a
                                    href={resolvedDraftSourceUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="dasti-proposal-source-summary__job-offer-link"
                                  >
                                    <span>View on {importedSourceLabel}</span>
                                    <ArrowSquareOut
                                      size={13}
                                      strokeWidth={1.8}
                                      aria-hidden="true"
                                    />
                                  </a>
                                ) : (
                                  <span className="dasti-proposal-source-summary__origin-label">
                                    {importedSourceLabel}
                                  </span>
                                )}
                                {visibleImportedSourceHost ? (
                                  <span className="dasti-proposal-source-summary__origin-host">
                                    {visibleImportedSourceHost}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>
                        ) : null}
                        {hasStructuredSourceSummary ? (
                          <div className="dasti-proposal-source-summary">
                            <div className="dasti-proposal-source-summary__grid">
                              {sourceMetadataCards.map((item) => (
                                <div
                                  key={`${item.label}:${item.value}`}
                                  className="ds-card ds-card--muted dasti-proposal-source-summary__card"
                                >
                                  <div className="ds-card__eyebrow dasti-proposal-source-summary__label">
                                    {item.label}
                                  </div>
                                  <div className="ds-card__body dasti-proposal-source-summary__value">
                                    {item.value}
                                  </div>
                                </div>
                              ))}
                              {sourceSummary.toneCues.length > 0 ? (
                                <div className="ds-card ds-card--muted dasti-proposal-source-summary__card">
                                  <div className="ds-card__eyebrow dasti-proposal-source-summary__label">
                                    Tone cues
                                  </div>
                                  <div className="ds-card__body dasti-proposal-source-summary__value dasti-proposal-source-summary__value--chips">
                                    {sourceSummary.toneCues.map((cue) => (
                                      <span
                                        key={cue}
                                        className="dasti-proposal-source-summary__chip"
                                      >
                                        {cue}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </div>
                            {sourceSummary.responsibilities.length > 0 ? (
                              <div className="dasti-proposal-source-summary__block">
                                <div className="dasti-proposal-source-summary__label">
                                  Key responsibilities
                                </div>
                                <ul className="dasti-proposal-source-summary__list">
                                  {sourceSummary.responsibilities.map(
                                    (item) => (
                                      <li key={item}>{item}</li>
                                    ),
                                  )}
                                </ul>
                              </div>
                            ) : null}
                            {sourceSummary.keywords.length > 0 ? (
                              <div className="dasti-proposal-source-summary__block">
                                <div className="dasti-proposal-source-summary__label">
                                  Keywords
                                </div>
                                <div className="dasti-proposal-source-summary__keywords">
                                  {sourceSummary.keywords.map((keyword) => (
                                    <span
                                      key={keyword}
                                      className="dasti-proposal-source-summary__keyword"
                                    >
                                      {keyword}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                    <div className="dasti-proposal-source-raw">
                      {canToggleRawJobText ? (
                        <button
                          type="button"
                          className="dasti-proposal-source-raw__toggle"
                          onClick={() =>
                            setIsRawJobTextExpanded((current) => !current)
                          }
                          aria-expanded={isRawJobTextExpanded}
                          aria-controls="jobDescription"
                        >
                          <span className="dasti-proposal-source-raw__label">
                            {isRawJobTextExpanded
                              ? "Hide job offer"
                              : "Show job offer"}
                          </span>
                          <span
                            className="dasti-proposal-source-raw__toggle-icon"
                            aria-hidden="true"
                          >
                            <ChevronDown size={14} strokeWidth={1.7} />
                          </span>
                        </button>
                      ) : null}
                      {shouldShowRawJobEditor ? (
                        <div className="dasti-proposal-source-raw__editor">
                          <textarea
                            ref={(node) => {
                              jobDescriptionRef.current = node;
                              jobDescriptionFieldRef(node);
                            }}
                            id="jobDescription"
                            {...jobDescriptionFieldProps}
                            className="dasti-proposal-sheet__body--editable"
                            style={{
                              color: "var(--ti)",
                              fontFamily: composeInputTypography.fontFamily,
                              fontSize: "var(--tb)",
                              lineHeight: composeInputTypography.lineHeight,
                              fontWeight: composeInputTypography.fontWeight,
                              letterSpacing:
                                composeInputTypography.letterSpacing,
                              outline: "none",
                              display: "block",
                              background: "transparent",
                              width: "100%",
                              height: "clamp(240px, 34vh, 420px)",
                              resize: "none",
                              overflowY: "auto",
                              caretColor: "var(--ti)",
                            }}
                            placeholder={jobDescriptionPlaceholder}
                          />
                        </div>
                      ) : (
                        <p className="dasti-proposal-source-raw__collapsed-copy">
                          Still saved. Expand to edit.
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                {/* .cbar */}
                <div className="dasti-proposal-toolbar dasti-proposal-toolbar--inside">
                  {!suppressCvPicker ? (
                    <div
                      className={
                        activeCvTitle
                          ? "dasti-proposal-chip-shell dasti-proposal-chip-shell--clearable"
                          : "dasti-proposal-chip-shell"
                      }
                    >
                      <button
                        type="button"
                        onClick={handleOpenCvPicker}
                        className={
                          activeCvTitle
                            ? "dasti-proposal-chip dasti-proposal-chip--resume dasti-proposal-chip--active dasti-toolbar-tooltip-trigger--above"
                            : "dasti-proposal-chip dasti-proposal-chip--resume dasti-proposal-chip--resume-empty dasti-toolbar-tooltip-trigger--above"
                        }
                        aria-label="Choose resume"
                        data-toolbar-tooltip="Resume"
                      >
                        <span className="dasti-proposal-chip__icon-wrap">
                          {activeCvTitle ? (
                            <Paperclip
                              size={15}
                              strokeWidth={1.5}
                              aria-hidden
                            />
                          ) : (
                            <FolderTree
                              size={15}
                              strokeWidth={1.5}
                              aria-hidden
                            />
                          )}
                        </span>
                        <span className="dasti-proposal-chip__label dasti-proposal-chip__label--resume">
                          {formatToolbarResumeLabel(activeCvTitle)}
                        </span>
                      </button>
                      {activeCvTitle ? (
                        <button
                          type="button"
                          className="dasti-proposal-chip__clear dasti-toolbar-tooltip-trigger--above"
                          aria-label="Remove resume"
                          data-toolbar-tooltip="Remove"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleClearCv();
                          }}
                        >
                          <X size={13} strokeWidth={1.9} aria-hidden />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <Menu
                    ariaLabel="Document type"
                    align="end"
                    side="top"
                    sections={typeMenuSections}
                    trigger={
                      <button
                        type="button"
                        aria-label="Document type"
                        data-toolbar-tooltip="Type"
                        onClick={(e) => e.stopPropagation()}
                        className="dasti-proposal-chip dasti-toolbar-tooltip-trigger--above"
                      >
                        <span className="dasti-proposal-chip__label">
                          {typeLabel}
                        </span>
                        <ChevronDown
                          size={12}
                          strokeWidth={1.5}
                          aria-hidden="true"
                        />
                      </button>
                    }
                  />
                  {!suppressToneControls && (
                    <Menu
                      ariaLabel="Tone"
                      align="end"
                      side="top"
                      sections={toneMenuSections}
                      trigger={
                        <button
                          type="button"
                          aria-label="Tone"
                          data-toolbar-tooltip="Tone"
                          onClick={(e) => e.stopPropagation()}
                          className={
                            selectedVisibleVoicePreset
                              ? "dasti-proposal-chip dasti-proposal-chip--active dasti-toolbar-tooltip-trigger--above"
                              : "dasti-proposal-chip dasti-toolbar-tooltip-trigger--above"
                          }
                        >
                          <span className="dasti-proposal-chip__label">
                            {toneUiLabel}
                          </span>
                          <ChevronDown
                            size={12}
                            strokeWidth={1.5}
                            aria-hidden="true"
                          />
                        </button>
                      }
                    />
                  )}
                  <button
                    type={canSubmitGeneration ? "submit" : "button"}
                    className={clsx(
                      "dasti-button",
                      "dasti-button--primary",
                      "dasti-button--pill",
                      "dasti-button--sm",
                      "dasti-proposal-submit",
                      "dasti-proposal-submit--composer",
                      "dasti-toolbar-tooltip-trigger--above",
                      generateButtonVisualClass,
                      isGenerating && "dasti-proposal-submit--busy",
                      canStopGeneration && "dasti-proposal-submit--stop-ready",
                      isStopRequested && "dasti-proposal-submit--stopping",
                    )}
                    aria-busy={isGenerating}
                    disabled={
                      watchedJobDescription.length < 10 ||
                      (isGenerating && !canStopGeneration)
                    }
                    aria-label={generateButtonLabel}
                    data-toolbar-tooltip={generateButtonLabel}
                    onClick={handleGenerateButtonClick}
                  >
                    <ProposalGenerateButtonGlyph state={generateButtonState} />
                    <span
                      className="dasti-proposal-submit__label"
                      aria-live="polite"
                      role="status"
                    >
                      {generateButtonLabel}
                    </span>
                  </button>
                </div>
                {!suppressCvPicker ? (
                  <div
                    className="dasti-proposal-context-note"
                    aria-live="polite"
                  >
                    {activeCvTitle ? (
                      <>
                        Using <strong>{activeCvTitle}</strong> for tone and
                        detail.
                      </>
                    ) : (
                      "No resume attached. Attach one to personalize."
                    )}
                  </div>
                ) : null}
              </div>
            </div>
            {form.formState.errors.jobTitle && (
              <p className={styles.errorMessage}>
                {form.formState.errors.jobTitle.message}
              </p>
            )}
            {form.formState.errors.jobDescription && (
              <p className={styles.errorMessage}>
                {form.formState.errors.jobDescription.message}
              </p>
            )}
            {errorMessage && (
              <p role="alert" className={styles.errorMessage}>
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProposalInputForm;
