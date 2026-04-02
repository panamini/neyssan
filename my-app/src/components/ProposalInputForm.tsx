"use client";

import React from "react";
import { useForm } from "react-hook-form";
import styles from "./ProposalInputForm.module.css";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent } from "./ui/dialog";

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
  formatCvDisplaySubtitle,
  getActiveLocalPersonalizationSource,
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
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";
import { formatUiDate } from "../lib/ui-date";
import { useScrollEdgeFades } from "../hooks/use-scroll-edge-fades";
import { getVoicePresetDisplayLabel } from "../lib/proposal-voice-label";
import {
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
  onActiveCvChange?: (cvId: string | null) => void;
  headerLabel?: string | null;
  headerAction?: React.ReactNode;
  jobDescriptionPlaceholder?: string;
  initialComposeDraft?: StoredProposalComposeDraft | null;
}

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
const VISIBLE_PROPOSAL_TYPE_OPTIONS = [
  { value: "cover_letter", label: "Cover Letter" },
  { value: "freelance_proposal", label: "Freelance Proposal" },
] as const;

const TONE_OPTIONS: Array<{
  id: ProposalVoicePreset;
  uiLabel: string;
  description: string;
}> = [
  {
    id: "signature",
    uiLabel: getVoicePresetDisplayLabel("signature"),
    description: "Balanced, natural, and credible.",
  },
  {
    id: "expert",
    uiLabel: getVoicePresetDisplayLabel("expert"),
    description: "More precise, structured, and authoritative.",
  },
  {
    id: "engaging",
    uiLabel: getVoicePresetDisplayLabel("engaging"),
    description: "Warmer, more lively, and still professional.",
  },
];

const AUTO_TONE_OPTION = {
  id: null,
  uiLabel: getVoicePresetDisplayLabel(null),
  description: "Adapt the tone to the client and context.",
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
      values.modelType === "mistral-small-latest" ||
      values.modelType === "mistral-large-latest" ||
      values.modelType === "mistral-agent"
        ? values.modelType
        : "chatgpt",
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

type ProposalGenerateButtonVisualState =
  | "idle"
  | "loading-hiding"
  | "loading-spinning"
  | "loading-revealing-stop"
  | "loading-stop"
  | "stop-undrawing"
  | "stop-revealing"
  | "finishing-hiding"
  | "finishing-spinning"
  | "finishing-revealing";

const PROPOSAL_GENERATE_BUTTON_TIMINGS = {
  loadingHideMs: 0,
  stopRevealDelayMs: 1800,
  stopRevealMs: 1080,
  stopHoldMs: 220,
  stopUndrawMs: 880,
  stopRedrawMs: 1080,
} as const;

const PROPOSAL_GENERATE_FLOW_PATH =
  "M 37 92 C 57 67, 82 52, 111 52 C 134 52, 152 59, 166 73 C 178 86, 185 104, 185 124 C 186 145, 179 165, 166 181 C 153 197, 134 208, 109 208 C 87 208, 71 200, 64 185 C 57 170, 60 151, 73 137 C 87 122, 107 113, 133 112 C 173 111, 211 127, 241 159";
const PROPOSAL_GENERATE_SQUARE_PATH =
  "M 84 74 H 172 Q 184 74, 184 86 V 170 Q 184 182, 172 182 H 96 Q 84 182, 84 170 V 86 Q 84 74, 96 74";

function ProposalGenerateButtonGlyph({
  state,
}: {
  state: ProposalGenerateButtonVisualState;
}) {
  return (
    <svg
      className="dasti-proposal-submit__glyph"
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      fill="none"
      aria-hidden="true"
      data-state={state}
    >
      <path
        className="dasti-proposal-submit__scribble"
        pathLength={100}
        d={PROPOSAL_GENERATE_FLOW_PATH}
      />
      <path
        className="dasti-proposal-submit__spinner"
        pathLength={100}
        d={PROPOSAL_GENERATE_FLOW_PATH}
      />
      <path
        className="dasti-proposal-submit__square"
        pathLength={100}
        d={PROPOSAL_GENERATE_SQUARE_PATH}
      />
    </svg>
  );
}

function getProposalGenerateButtonVisualClass(
  state: ProposalGenerateButtonVisualState,
): string {
  switch (state) {
    case "idle":
      return "is-idle";
    case "loading-hiding":
    case "loading-spinning":
      return "is-spinning";
    case "loading-revealing-stop":
      return "is-revealing";
    case "loading-stop":
      return "is-done";
    case "stop-undrawing":
      return "is-back-undrawing";
    case "stop-revealing":
      return "is-back-revealing";
    case "finishing-hiding":
    case "finishing-spinning":
      return "is-finishing-spinning";
    case "finishing-revealing":
      return "is-finishing-revealing";
    default:
      return "is-idle";
  }
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
  onActiveCvChange,
  headerLabel = null,
  headerAction = null,
  jobDescriptionPlaceholder = "Paste or write the job offer here…",
  initialComposeDraft = null,
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
  const [activeCvSource, setActiveCvSource] = React.useState(() =>
    getActiveLocalPersonalizationSource(),
  );
  const [isCvPickerOpen, setIsCvPickerOpen] = React.useState(false);
  const [pendingCvId, setPendingCvId] = React.useState<string | null>(null);
  const [cvOptions, setCvOptions] = React.useState<LocalCvPickerOption[]>(() =>
    listLocalCvPickerOptions(),
  );
  const { loadCv } = useCvLibrary();
  const {
    attach: attachComposeScrollEdges,
    showTop: showComposeScrollTop,
    showBottom: showComposeScrollBottom,
    topStrength: composeScrollTopStrength,
    bottomStrength: composeScrollBottomStrength,
    update: updateComposeScrollEdges,
  } = useScrollEdgeFades<HTMLTextAreaElement>();
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
    setActiveCvSource(getActiveLocalPersonalizationSource());
    setCvOptions(listLocalCvPickerOptions());
  }, []);

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

  const startGenerateButtonSequence = React.useCallback(() => {
    clearGenerateButtonTimers();
    shouldPlayGenerateButtonReverseRef.current = false;
    setGenerateButtonState("loading-hiding");
    scheduleGenerateButtonState(
      "loading-spinning",
      PROPOSAL_GENERATE_BUTTON_TIMINGS.loadingHideMs,
    );
    scheduleGenerateButtonState(
      "loading-revealing-stop",
      PROPOSAL_GENERATE_BUTTON_TIMINGS.loadingHideMs +
        PROPOSAL_GENERATE_BUTTON_TIMINGS.stopRevealDelayMs,
    );
    scheduleGenerateButtonState(
      "loading-stop",
      PROPOSAL_GENERATE_BUTTON_TIMINGS.loadingHideMs +
        PROPOSAL_GENERATE_BUTTON_TIMINGS.stopRevealDelayMs +
        PROPOSAL_GENERATE_BUTTON_TIMINGS.stopRevealMs,
    );
  }, [clearGenerateButtonTimers, scheduleGenerateButtonState]);

  const playGenerateButtonReverseSequence = React.useCallback(() => {
    clearGenerateButtonTimers();
    shouldPlayGenerateButtonReverseRef.current = false;
    setGenerateButtonState("loading-stop");
    scheduleGenerateButtonState(
      "stop-undrawing",
      PROPOSAL_GENERATE_BUTTON_TIMINGS.stopHoldMs,
    );
    scheduleGenerateButtonState(
      "stop-revealing",
      PROPOSAL_GENERATE_BUTTON_TIMINGS.stopHoldMs +
        PROPOSAL_GENERATE_BUTTON_TIMINGS.stopUndrawMs,
    );
    scheduleGenerateButtonState(
      "idle",
      PROPOSAL_GENERATE_BUTTON_TIMINGS.stopHoldMs +
        PROPOSAL_GENERATE_BUTTON_TIMINGS.stopUndrawMs +
        PROPOSAL_GENERATE_BUTTON_TIMINGS.stopRedrawMs,
    );
  }, [clearGenerateButtonTimers, scheduleGenerateButtonState]);

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
  }, [
    activeCvSource.title,
    canPersistProposalWorkspaceState,
  ]);

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
      modelType: "chatgpt" as const,
      ...readStoredComposeDraft(initialComposeDraft),
    },
  });

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

    const currentActiveCvSource = getActiveLocalPersonalizationSource();
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
        onSubmit(
          normalizedValues,
          result.proposalContent,
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
            content: result.proposalContent,
            sections: [{ type: "text", content: result.proposalContent }],
            status: "draft",
          }).catch((saveErr) => {
            console.warn("Failed to update generated proposal status:", saveErr);
          });
        }
      } else {
        const nextErrorMessage = "No proposal returned from the server.";
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
    const nextOptions = listLocalCvPickerOptions();
    setActiveCvSource(getActiveLocalPersonalizationSource());
    setCvOptions(nextOptions);
    setPendingCvId(nextOptions.find((option) => option.isActive)?.id ?? null);
    setCvPickerOpen(true);
  }

  React.useEffect(() => {
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
    setActiveLocalCvId(id);
    refreshActiveCvState();
    setPendingCvId(id);
    setCvPickerOpen(false);
    syncSelectedCvToSharedActiveSnapshot(id);
    onActiveCvChange?.(id);
  }

  function handleClearCv() {
    clearActiveLocalCvId();
    setCvPickerOpen(false);
    setPendingCvId(null);
    setActiveCvSource({ title: null, personalizationContext: null });
    setCvOptions(listLocalCvPickerOptions());
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
    setActiveLocalCvId(id);
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

  /* ── Cbar state (Type + Tone dropdowns) ─────────────────── */
  const [openMenu, setOpenMenu] = React.useState<"type" | "tone" | null>(null);
  const [menuPos, setMenuPos] = React.useState<{
    left: number;
    bottom: number;
  }>({ left: 0, bottom: 0 });
  const typeChipRef = React.useRef<HTMLButtonElement>(null);
  const toneChipRef = React.useRef<HTMLButtonElement>(null);
  const jobDescriptionRef = React.useRef<HTMLTextAreaElement | null>(null);

  const toggleMenu = React.useCallback(
    (which: "type" | "tone") => {
      const ref = which === "type" ? typeChipRef : toneChipRef;
      if (openMenu === which) {
        setOpenMenu(null);
        return;
      }
      if (ref.current) {
        const r = ref.current.getBoundingClientRect();
        setMenuPos({ left: r.left, bottom: window.innerHeight - r.top + 4 });
      }
      setOpenMenu(which);
    },
    [openMenu],
  );

  React.useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  const typeLabel =
    selectedProposalType === "cover_letter" ? "Letter" : "Proposal";
  const toneUiLabel = selectedVisibleVoicePreset
    ? TONE_OPTIONS.find((t) => t.id === selectedVisibleVoicePreset)?.uiLabel ??
      selectedVoicePresetDefinition.label
    : AUTO_TONE_OPTION.uiLabel;
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

  return (
    <div className={styles.container}>
      <Dialog
        open={resolvedCvPickerOpen}
        onClose={handleCloseCvPicker}
        title="Choose resume"
      >
        <DialogContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select the resume Proposal Forge should use for personalization.
          </p>
          {cvOptions.length === 0 ? (
            <div className="border px-4 py-4 text-sm text-muted-foreground [background:var(--sf2)] [border-color:var(--color-border)] [border-radius:var(--radius-card)]">
              No local resumes found yet. Create or import one in Resume.
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
                const chooserDateSource =
                  option.updatedAt ?? option.createdAt ?? null;
                const chooserDate = formatUiDate(chooserDateSource);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={clsx(
                      "dasti-doc-card dasti-doc-card--library dasti-doc-card--chooser dasti-doc-card--cv-library",
                      isSelected && "dasti-doc-card--selected",
                    )}
                    aria-pressed={isSelected}
                    onClick={() => setPendingCvId(option.id)}
                  >
                    <div className="dasti-doc-card__stack">
                      <div className="dasti-doc-card__header">
                        <div className="dasti-doc-card__title-frame">
                          <h3 className="dasti-doc-card__title">
                            {option.title}
                          </h3>
                        </div>
                      </div>

                      <div className="dasti-doc-card__meta">
                        {formatCvDisplaySubtitle({
                          title: option.title,
                          profileName: option.profileName,
                          desiredPosition: option.desiredPosition,
                          email: option.email,
                          linkedin: option.linkedin,
                          website: option.website,
                          phone: option.phone,
                        }) || "Draft resume"}
                      </div>

                      <div className="dasti-doc-card__footer dasti-doc-card__footer--chooser dasti-doc-card__footer--stamp-only">
                        <div className="dasti-doc-card__stamp">
                          {chooserDate ?? ""}
                        </div>
                      </div>
                    </div>
                  </button>
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
              <span>Confirm</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
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
                          placeholder="Enter Job Title"
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
                        placeholder="Enter Job Title"
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
                  <textarea
                    ref={(node) => {
                      jobDescriptionRef.current = node;
                      jobDescriptionFieldRef(node);
                      attachComposeScrollEdges(node);
                    }}
                    id="jobDescription"
                    {...jobDescriptionFieldProps}
                    className="dasti-proposal-sheet__body--editable"
                    style={{
                      color: "var(--ti)",
                      fontFamily: composeInputTypography.fontFamily,
                      fontSize: "var(--tb)",
                      lineHeight: "var(--lb)",
                      fontWeight: composeInputTypography.fontWeight,
                      letterSpacing: composeInputTypography.letterSpacing,
                      outline: "none",
                      display: "block",
                      background: "transparent",
                      width: "100%",
                      height: "100%",
                      resize: "none",
                      overflowY: "auto",
                      caretColor: "var(--ti)",
                    }}
                    placeholder={jobDescriptionPlaceholder}
                  />
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
                  <button
                    ref={typeChipRef}
                    type="button"
                    aria-label="Document type"
                    data-toolbar-tooltip="Type"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenu("type");
                    }}
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
                  {!suppressToneControls && (
                    <button
                      ref={toneChipRef}
                      type="button"
                      aria-label="Tone"
                      data-toolbar-tooltip="Tone"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleMenu("tone");
                      }}
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
                  )}
                  <button
                    type={canSubmitGeneration ? "submit" : "button"}
                    className={clsx(
                      "dasti-proposal-submit",
                      "dasti-proposal-submit-token",
                      "dasti-proposal-submit--pop",
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
                    style={{
                      ["--dasti-proposal-submit-button-size" as string]: "52px",
                      ["--dasti-proposal-submit-radius" as string]: "16px",
                      ["--dasti-proposal-submit-icon-size" as string]: "28px",
                      ["--dasti-proposal-submit-stroke-width" as string]: "2",
                      ["--dasti-proposal-submit-phase-gap" as string]: "140ms",
                      ["--dasti-proposal-submit-spinner-duration" as string]:
                        "1450ms",
                      ["--dasti-proposal-submit-draw-duration" as string]:
                        "1080ms",
                      cursor:
                        watchedJobDescription.length < 10 ||
                        (isGenerating && !canStopGeneration)
                          ? "not-allowed"
                          : "pointer",
                      transition:
                        "background .15s var(--ez), border-color .15s var(--ez), opacity .15s var(--ez), color .15s var(--ez)",
                      opacity:
                        watchedJobDescription.length < 10
                          ? 0.4
                          : isGenerating && !canStopGeneration
                            ? 0.84
                            : 1,
                    }}
                  >
                    <ProposalGenerateButtonGlyph state={generateButtonState} />
                    <span className="sr-only" aria-live="polite" role="status">
                      {generateButtonLabel}
                    </span>
                  </button>
                </div>
              </div>
            </div>
            {prefill?.platform || prefill?.sourceUrl ? (
              <div className="dasti-proposal-context-band">
                {(prefill?.platform || prefill?.sourceUrl) && (
                  <div className="dasti-proposal-source-meta">
                    Imported from{" "}
                    {prefill?.platform
                      ? capitalizeLabel(prefill.platform)
                      : "external source"}
                    {prefill?.sourceUrl && (
                      <>
                        {" · "}
                        <a
                          href={prefill.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2 hover:[color:var(--tm2)]"
                        >
                          View source
                        </a>
                      </>
                    )}
                  </div>
                )}
              </div>
            ) : null}
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
      {/* Portal dropdowns for cbar */}
      {openMenu !== null &&
        createPortal(
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              zIndex: 900,
              minWidth: 220,
              background: "var(--sfr)",
              border: "1px solid var(--color-border)",
              borderRadius: "var(--radius-card)",
              boxShadow: "var(--shc)",
              padding: "var(--s1)",
              left: menuPos.left,
              bottom: menuPos.bottom,
              top: "auto",
            }}
          >
            {openMenu === "type" && (
              <>
                {(
                  [
                    {
                      value: "cover_letter",
                      label: "Letter",
                      desc: "Cover letter for a job application",
                    },
                    {
                      value: "freelance_proposal",
                      label: "Proposal",
                      desc: "Freelance proposal for a project",
                    },
                  ] as const
                )
                  .filter((opt) => opt.value !== selectedProposalType)
                  .map((opt) => (
                    <div
                      key={opt.value}
                      onClick={() => {
                        form.setValue("proposalType", opt.value, {
                          shouldDirty: true,
                          shouldValidate: true,
                        });
                        setOpenMenu(null);
                      }}
                      className="dasti-menu-option"
                    >
                      <div className="dasti-menu-option__title">
                        {opt.label}
                      </div>
                      <div className="dasti-menu-option__description">
                        {opt.desc}
                      </div>
                    </div>
                  ))}
              </>
            )}
            {!suppressToneControls && openMenu === "tone" ? (
              <div style={{ display: "grid", gap: "var(--s1)" }}>
                {[AUTO_TONE_OPTION, ...TONE_OPTIONS].map((opt) => {
                  const isSelected =
                    opt.id === null
                      ? !selectedVisibleVoicePreset
                      : selectedVisibleVoicePreset === opt.id;

                  return (
                    <button
                      key={opt.id ?? "auto"}
                      type="button"
                      onClick={() => {
                        handleVoicePresetChange(opt.id);
                        setOpenMenu(null);
                      }}
                      className={clsx(
                        "dasti-menu-option dasti-menu-option--tone",
                        isSelected && "dasti-menu-option--selected",
                      )}
                      aria-pressed={isSelected}
                    >
                      <div className="dasti-menu-option__row dasti-menu-option__row--between">
                        <div className="dasti-menu-option__copy">
                          <div className="dasti-menu-option__title">
                            {opt.uiLabel}
                          </div>
                          <div className="dasti-menu-option__description">
                            {opt.description}
                          </div>
                        </div>
                        {isSelected ? (
                          <span
                            className="dasti-menu-option__check"
                            aria-hidden
                          >
                            <Check size={15} strokeWidth={1.8} />
                          </span>
                        ) : null}
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : null}
          </div>,
          document.body,
        )}
    </div>
  );
};

export default ProposalInputForm;

function capitalizeLabel(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
