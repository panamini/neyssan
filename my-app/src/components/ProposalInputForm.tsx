"use client";

import React from "react";
import { useForm } from "react-hook-form";
import styles from "./ProposalInputForm.module.css";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { Dialog, DialogContent } from "./ui/dialog";

import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { formSchema, FormValues } from "./ProposalInputForm.schemas";
import {
  DEFAULT_PROPOSAL_VOICE_PRESET,
  getProposalVoicePresetDefinition,
  getSupportedProposalVoicePresetIds,
  isProposalVoicePresetSupportedForMode,
  PROPOSAL_VOICE_PRESET_DEFINITIONS,
  type ProposalVoicePreset,
} from "../../convex/lib/proposals/voicePresets";
import {
  buildAppProposalPersonalizationPayload,
  clearActiveLocalCvId,
  formatCvDisplaySubtitle,
  getActiveLocalPersonalizationSource,
  getLocalActiveCvSnapshotById,
  listLocalCvPickerOptions,
  setActiveLocalCvId,
  type LocalCvPickerOption,
  type ProposalGenerationPersonalizationPayload,
} from "../lib/proposal-personalization";
import {
  getProposalGenerationUiErrorMessage,
  type ProposalGenerationFallbackInfo,
} from "../lib/proposal-generation-ui";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";
import { formatUiDate } from "../lib/ui-date";
import { useScrollEdgeFades } from "../hooks/use-scroll-edge-fades";
import {
  Check,
  ChevronDown,
  FolderTree,
  Paperclip,
  Pencil,
  SendHorizontal,
  Square,
  X,
} from "@/lib/icons";

interface ProposalInputFormProps {
  onSubmit: (
    values: FormValues,
    proposalContent: string,
    fallbackInfo?: ProposalGenerationFallbackInfo,
    proposalId?: string,
  ) => void;
  onStart?: (values: FormValues) => void;
  onError?: (
    message: string,
    values: FormValues,
    rawReason?: string | null,
  ) => void;
  prefill?: {
    handoffId: string;
    jobTitle: string;
    jobDescription: string;
    sourceUrl?: string;
    platform?: string;
  } | null;
}

type GenerateProposalPayload = FormValues &
  ProposalGenerationPersonalizationPayload;

type GenerateProposalResult = {
  proposalId: Id<"proposals">;
  proposalContent: string;
} & Required<ProposalGenerationFallbackInfo>;

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
    uiLabel: "Balanced",
    description: "Balanced, natural, and credible.",
  },
  {
    id: "expert",
    uiLabel: "Formal",
    description: "More precise, structured, and authoritative.",
  },
  {
    id: "engaging",
    uiLabel: "Warm",
    description: "Warmer, more lively, and still professional.",
  },
];

const PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY = "dasti:proposal-compose-draft:v1";

function readStoredComposeDraft(): Partial<FormValues> {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY);
    if (!raw) return {};

    const parsed = JSON.parse(raw) as Partial<FormValues> | null;
    if (!parsed || typeof parsed !== "object") return {};

    return {
      jobTitle: typeof parsed.jobTitle === "string" ? parsed.jobTitle : "",
      jobDescription:
        typeof parsed.jobDescription === "string" ? parsed.jobDescription : "",
      proposalType:
        parsed.proposalType === "freelance_proposal" ||
        parsed.proposalType === "cover_letter"
          ? parsed.proposalType
          : "cover_letter",
      voicePreset:
        typeof parsed.voicePreset === "string"
          ? (parsed.voicePreset as ProposalVoicePreset)
          : DEFAULT_PROPOSAL_VOICE_PRESET,
    };
  } catch {
    return {};
  }
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

const ProposalInputForm: React.FC<ProposalInputFormProps> = ({
  onSubmit,
  onStart,
  onError,
  prefill = null,
}) => {
  const generateProposalAction = useAction(api.functions.generateProposal);
  const setSharedActiveCvSnapshot = useMutation(
    api.activeCvSnapshots.setCurrent,
  );
  const updateGeneratedProposal = useMutation(api.updateProposalPublic.default);
  const currentProposalSettings = useQuery(api.proposalSettings.getCurrent, {});
  const setCurrentVoicePreset = useMutation(api.proposalSettings.setCurrent);
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [voicePresetSaveError, setVoicePresetSaveError] = React.useState<
    string | null
  >(null);
  const [activeCvSource, setActiveCvSource] = React.useState(() =>
    getActiveLocalPersonalizationSource(),
  );
  const [isCvPickerOpen, setIsCvPickerOpen] = React.useState(false);
  const [pendingCvId, setPendingCvId] = React.useState<string | null>(null);
  const [cvOptions, setCvOptions] = React.useState<LocalCvPickerOption[]>(() =>
    listLocalCvPickerOptions(),
  );
  const {
    attach: attachComposeScrollEdges,
    showTop: showComposeScrollTop,
    showBottom: showComposeScrollBottom,
    update: updateComposeScrollEdges,
  } = useScrollEdgeFades<HTMLTextAreaElement>();
  const appliedPrefillRef = React.useRef<{
    handoffId: string;
    jobTitle: string;
    jobDescription: string;
  } | null>(null);
  const appliedSavedVoicePresetRef = React.useRef(false);
  const lastSharedSnapshotSyncStateRef = React.useRef<string | null>(null);

  const refreshActiveCvState = React.useCallback(() => {
    setActiveCvSource(getActiveLocalPersonalizationSource());
    setCvOptions(listLocalCvPickerOptions());
  }, []);

  React.useEffect(() => {
    refreshActiveCvState();
  }, [refreshActiveCvState]);

  React.useEffect(() => {
    if (activeCvSource.title !== null) {
      lastSharedSnapshotSyncStateRef.current = activeCvSource.title;
      return;
    }

    clearActiveLocalCvId();

    if (lastSharedSnapshotSyncStateRef.current === "none") {
      return;
    }

    void setSharedActiveCvSnapshot({ snapshot: null })
      .then(() => {
        lastSharedSnapshotSyncStateRef.current = "none";
      })
      .catch((err) => {
        console.warn(
          "[ProposalInputForm] Shared active CV snapshot clear failed",
          err,
        );
      });
  }, [activeCvSource.title, setSharedActiveCvSnapshot]);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      jobTitle: "",
      jobDescription: "",
      proposalType: "cover_letter" as const,
      voicePreset: DEFAULT_PROPOSAL_VOICE_PRESET,
      formalityLevel: "neutral",
      creativity: "medium",
      modelType: "chatgpt" as const,
      ...readStoredComposeDraft(),
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
      if (typeof window === "undefined") return;

      try {
        window.localStorage.setItem(
          PROPOSAL_COMPOSE_DRAFT_STORAGE_KEY,
          JSON.stringify({
            jobTitle: values.jobTitle ?? "",
            jobDescription: values.jobDescription ?? "",
            proposalType: values.proposalType ?? "cover_letter",
            voicePreset: values.voicePreset ?? DEFAULT_PROPOSAL_VOICE_PRESET,
          } satisfies Partial<FormValues>),
        );
      } catch {
        // Ignore storage failures and keep the in-memory compose draft.
      }
    });

    return () => subscription.unsubscribe();
  }, [form]);
  const supportedVoicePresetIds = React.useMemo(
    () =>
      getSupportedProposalVoicePresetIds({
        proposalType: selectedProposalType,
        modelType: selectedModelType,
      }),
    [selectedModelType, selectedProposalType],
  );
  const isPresetSupportedForSelectedMode = React.useCallback(
    (preset: ProposalVoicePreset) =>
      isProposalVoicePresetSupportedForMode({
        preset,
        proposalType: selectedProposalType,
        modelType: selectedModelType,
      }),
    [selectedModelType, selectedProposalType],
  );
  const displayedVoicePreset = !isPresetSupportedForSelectedMode(
    selectedVoicePreset,
  )
    ? DEFAULT_PROPOSAL_VOICE_PRESET
    : selectedVoicePreset;
  const availableVoicePresets = React.useMemo(
    () =>
      PROPOSAL_VOICE_PRESET_DEFINITIONS.filter((preset) =>
        supportedVoicePresetIds.includes(preset.id),
      ),
    [supportedVoicePresetIds],
  );
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

  const applyVoicePresetDefaults = React.useCallback(
    (
      preset: ProposalVoicePreset,
      options?: {
        shouldDirty?: boolean;
        shouldTouch?: boolean;
      },
    ) => {
      const presetDefinition = getProposalVoicePresetDefinition(preset);
      const fieldOptions = {
        shouldDirty: options?.shouldDirty ?? true,
        shouldTouch: options?.shouldTouch ?? false,
        shouldValidate: true,
      };

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
    const savedVoicePreset = currentProposalSettings?.voicePreset;
    if (!savedVoicePreset || appliedSavedVoicePresetRef.current) return;

    const hasTouchedToneControls =
      Boolean(form.formState.dirtyFields.voicePreset) ||
      Boolean(form.formState.dirtyFields.formalityLevel) ||
      Boolean(form.formState.dirtyFields.creativity);

    if (hasTouchedToneControls) return;

    applyVoicePresetDefaults(savedVoicePreset, {
      shouldDirty: false,
      shouldTouch: false,
    });
    appliedSavedVoicePresetRef.current = true;
  }, [
    applyVoicePresetDefaults,
    currentProposalSettings?.voicePreset,
    form.formState.dirtyFields.creativity,
    form.formState.dirtyFields.formalityLevel,
    form.formState.dirtyFields.voicePreset,
  ]);

  React.useEffect(() => {
    if (isPresetSupportedForSelectedMode(selectedVoicePreset)) {
      return;
    }

    applyVoicePresetDefaults(DEFAULT_PROPOSAL_VOICE_PRESET, {
      shouldDirty: false,
      shouldTouch: false,
    });
  }, [
    applyVoicePresetDefaults,
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

  function handleVoicePresetChange(preset: ProposalVoicePreset) {
    const currentFormPreset = form.getValues("voicePreset");
    appliedSavedVoicePresetRef.current = true;

    if (preset !== currentFormPreset) {
      applyVoicePresetDefaults(preset);
    }

    if (currentProposalSettings?.voicePreset === preset) {
      return;
    }

    setVoicePresetSaveError(null);

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

    const currentActiveCvSource = getActiveLocalPersonalizationSource();
    const hasCandidateContext = Boolean(
      currentActiveCvSource.personalizationContext,
    );

    if (import.meta.env.DEV) {
      console.debug("[ProposalInputForm] Audit A — active CV context", {
        cvTitle: currentActiveCvSource.title,
        hasCv: hasCandidateContext,
        topSkills:
          currentActiveCvSource.personalizationContext?.topSkills ?? null,
        recentExperience:
          currentActiveCvSource.personalizationContext?.recentExperience ??
          null,
        standoutAchievements:
          currentActiveCvSource.personalizationContext?.standoutAchievements ??
          null,
        desiredPosition:
          currentActiveCvSource.personalizationContext?.desiredPosition ?? null,
      });
      console.debug("[ProposalInputForm] Audit B — job values", {
        jobTitle: values.jobTitle,
        jobDescriptionLength: values.jobDescription?.length ?? 0,
        jobDescriptionPreview: values.jobDescription?.slice(0, 200) ?? null,
        proposalType: values.proposalType,
      });
    }

    try {
      setIsGenerating(true);
      setErrorMessage(null);
      onStart?.(values);

      const payload: GenerateProposalPayload = {
        ...values,
        ...buildAppProposalPersonalizationPayload(currentActiveCvSource),
      };

      const result = await (
        generateProposalAction as unknown as (
          input: GenerateProposalPayload,
        ) => Promise<GenerateProposalResult | null>
      )(payload);
      if (result) {
        // The generation action already stores the proposal. Mark that row as a
        // draft instead of inserting a second saved-history entry from the client.
        try {
          await updateGeneratedProposal({
            id: result.proposalId,
            content: result.proposalContent,
            sections: [{ type: "text", content: result.proposalContent }],
            status: "draft",
          });
        } catch (saveErr) {
          console.warn("Failed to update generated proposal status:", saveErr);
        }

        onSubmit(
          values,
          result.proposalContent,
          {
            requestedModelType: result.requestedModelType,
            actualModelType: result.actualModelType,
            fallbackTriggerCode: result.fallbackTriggerCode,
          },
          result.proposalId,
        );
      } else {
        const nextErrorMessage = "No proposal returned from the server.";
        setErrorMessage(nextErrorMessage);
        onError?.(nextErrorMessage, values);
      }
    } catch (error: unknown) {
      console.error("Error generating proposal:", error);
      const nextErrorMessage = getProposalGenerationUiErrorMessage({
        error,
        proposalType: values.proposalType,
        hasCandidateContext,
      });
      const rawReason = error instanceof Error ? error.message : null;
      setErrorMessage(nextErrorMessage);
      onError?.(nextErrorMessage, values, rawReason);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleOpenCvPicker() {
    const nextOptions = listLocalCvPickerOptions();
    setActiveCvSource(getActiveLocalPersonalizationSource());
    setCvOptions(nextOptions);
    setPendingCvId(nextOptions.find((option) => option.isActive)?.id ?? null);
    setIsCvPickerOpen(true);
  }

  function handleCloseCvPicker() {
    setIsCvPickerOpen(false);
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

      void setSharedActiveCvSnapshot({ snapshot }).catch((err) => {
        console.warn(
          "[ProposalInputForm] Shared active CV snapshot sync failed",
          err,
        );
      });
    },
    [setSharedActiveCvSnapshot],
  );

  function handleSelectCv(id: string) {
    setActiveLocalCvId(id);
    refreshActiveCvState();
    setPendingCvId(id);
    setIsCvPickerOpen(false);
    syncSelectedCvToSharedActiveSnapshot(id);
  }

  function handleClearCv() {
    clearActiveLocalCvId();
    setIsCvPickerOpen(false);
    setPendingCvId(null);
    setActiveCvSource({ title: null, personalizationContext: null });
    setCvOptions(listLocalCvPickerOptions());
    lastSharedSnapshotSyncStateRef.current = "none";
    void setSharedActiveCvSnapshot({ snapshot: null }).catch((err) => {
      console.warn(
        "[ProposalInputForm] Shared active CV snapshot clear failed",
        err,
      );
    });
  }

  function handleOpenCvInForge(id: string) {
    setActiveLocalCvId(id);
    refreshActiveCvState();
    setPendingCvId(id);
    setIsCvPickerOpen(false);
    syncSelectedCvToSharedActiveSnapshot(id);
    window.history.pushState({}, "", `/cv?id=${encodeURIComponent(id)}`);
    window.dispatchEvent(new PopStateEvent("popstate"));
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
  const toneUiLabel =
    TONE_OPTIONS.find((t) => t.id === displayedVoicePreset)?.uiLabel ??
    selectedVoicePresetDefinition.label;
  const proposalDocumentTypography = React.useMemo(
    () => getProposalDocumentTypography(displayedVoicePreset),
    [displayedVoicePreset],
  );
  const { ref: jobDescriptionFieldRef, ...jobDescriptionFieldProps } =
    form.register("jobDescription");

  return (
    <div className={styles.container}>
      <Dialog
        open={isCvPickerOpen}
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

                      <div className="dasti-doc-card__footer dasti-doc-card__footer--chooser">
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
                  <div
                    className="dasti-proposal-sheet__heading"
                    style={{ width: "100%" }}
                  >
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
                  </div>
                </div>
                <div
                  className="dasti-proposal-sheet__body dasti-proposal-sheet__body--composer"
                  data-scroll-top={showComposeScrollTop ? "true" : "false"}
                  data-scroll-bottom={
                    showComposeScrollBottom ? "true" : "false"
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
                      fontFamily: proposalDocumentTypography.fontFamily,
                      fontSize: "var(--tb)",
                      lineHeight: "var(--lb)",
                      fontWeight: proposalDocumentTypography.fontWeight,
                      letterSpacing: proposalDocumentTypography.letterSpacing,
                      outline: "none",
                      display: "block",
                      background: "transparent",
                      width: "100%",
                      height: "100%",
                      resize: "none",
                      overflowY: "auto",
                    }}
                    placeholder="Paste the job description here…"
                  />
                </div>
                {/* .cbar */}
                <div className="dasti-proposal-toolbar dasti-proposal-toolbar--inside">
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
                          ? "dasti-proposal-chip dasti-proposal-chip--resume dasti-proposal-chip--active"
                          : "dasti-proposal-chip dasti-proposal-chip--resume dasti-proposal-chip--resume-empty"
                      }
                      aria-label="Choose resume"
                      title={
                        activeCvTitle ?? "Pick a resume for personalization"
                      }
                    >
                      <span className="dasti-proposal-chip__icon-wrap">
                        {activeCvTitle ? (
                          <Paperclip size={15} strokeWidth={1.5} aria-hidden />
                        ) : (
                          <FolderTree size={15} strokeWidth={1.5} aria-hidden />
                        )}
                      </span>
                      <span className="dasti-proposal-chip__label dasti-proposal-chip__label--resume">
                        {formatToolbarResumeLabel(activeCvTitle)}
                      </span>
                    </button>
                    {activeCvTitle ? (
                      <button
                        type="button"
                        className="dasti-proposal-chip__clear"
                        aria-label="Remove resume"
                        title="Remove resume"
                        onClick={(event) => {
                          event.stopPropagation();
                          handleClearCv();
                        }}
                      >
                        <X size={13} strokeWidth={1.9} aria-hidden />
                      </button>
                    ) : null}
                  </div>
                  <button
                    ref={typeChipRef}
                    type="button"
                    title="Document type"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenu("type");
                    }}
                    className="dasti-proposal-chip"
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
                  <button
                    ref={toneChipRef}
                    type="button"
                    title="Tone"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMenu("tone");
                    }}
                    className="dasti-proposal-chip"
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
                  <button
                    type="submit"
                    className={
                      isGenerating
                        ? "dasti-proposal-submit dasti-proposal-submit--busy"
                        : "dasti-proposal-submit"
                    }
                    aria-busy={isGenerating}
                    disabled={
                      !isGenerating && watchedJobDescription.length < 10
                    }
                    title={
                      isGenerating
                        ? "Generating…"
                        : watchedJobDescription.length < 10
                          ? "Minimum 10 characters required"
                          : "Generate"
                    }
                    style={{
                      cursor:
                        !isGenerating && watchedJobDescription.length < 10
                          ? "not-allowed"
                          : "pointer",
                      transition:
                        "background .15s var(--ez), border-color .15s var(--ez), opacity .15s var(--ez), color .15s var(--ez)",
                      opacity:
                        !isGenerating && watchedJobDescription.length < 10
                          ? 0.4
                          : 1,
                    }}
                  >
                    {isGenerating ? (
                      <Square
                        size="1em"
                        fill="none"
                        strokeWidth={1.8}
                        className="dasti-proposal-submit__icon"
                      />
                    ) : (
                      <SendHorizontal
                        size="1em"
                        strokeWidth={1.8}
                        className="dasti-proposal-submit__icon"
                      />
                    )}
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
            {openMenu === "tone" &&
              TONE_OPTIONS.filter((opt) => opt.id !== displayedVoicePreset).map(
                (opt) => (
                  <div
                    key={opt.id}
                    onClick={() => {
                      handleVoicePresetChange(opt.id);
                      setOpenMenu(null);
                    }}
                    className="dasti-menu-option"
                  >
                    <div className="dasti-menu-option__title">
                      {opt.uiLabel}
                    </div>
                    <div className="dasti-menu-option__description">
                      {opt.description}
                    </div>
                  </div>
                ),
              )}
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
