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
import { ArrowUp, Check, ChevronDown, Paperclip, ScrollText, Square, X } from "lucide-react";

interface ProposalInputFormProps {
  onSubmit: (
    values: FormValues,
    proposalContent: string,
    fallbackInfo?: ProposalGenerationFallbackInfo,
  ) => void;
  onStart?: (values: FormValues) => void;
  onError?: (message: string, values: FormValues, rawReason?: string | null) => void;
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

const TONE_OPTIONS: Array<{ id: ProposalVoicePreset; uiLabel: string; description: string }> = [
  { id: "signature", uiLabel: "Balanced", description: "Balanced, natural, and credible." },
  { id: "expert", uiLabel: "Formal", description: "More precise, structured, and authoritative." },
  { id: "engaging", uiLabel: "Warm", description: "Warmer, more lively, and still professional." },
];

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
    },
  });

  const watchedJobDescription = form.watch("jobDescription");
  const selectedModelType = form.watch("modelType");
  const selectedProposalType = form.watch("proposalType");
  const selectedVoicePreset = form.watch("voicePreset");
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
  const displayedVoicePreset =
    !isPresetSupportedForSelectedMode(selectedVoicePreset)
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
    // Prefill removed (navigated away from handoff URL):
    // clear any fields that still contain the prefill content so stale job
    // description cannot survive into the next generation.
    if (!prefill?.handoffId) {
      if (appliedPrefillRef.current !== null) {
        const prev = appliedPrefillRef.current;
        const currentTitle = form.getValues("jobTitle");
        const currentDesc = form.getValues("jobDescription");
        if (currentTitle === prev.jobTitle) {
          form.setValue("jobTitle", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
        }
        if (currentDesc === prev.jobDescription) {
          form.setValue("jobDescription", "", { shouldDirty: false, shouldTouch: false, shouldValidate: false });
        }
        appliedPrefillRef.current = null;
      }
      return;
    }

    // Same handoff — already applied, nothing to do.
    if (appliedPrefillRef.current?.handoffId === prefill.handoffId) return;

    const isFirstHandoff = appliedPrefillRef.current === null;

    if (isFirstHandoff) {
      // On first mount, only apply if the form is empty (user may have started typing).
      const currentValues = form.getValues();
      const hasUserContent =
        form.formState.isDirty ||
        currentValues.jobTitle.trim().length > 0 ||
        currentValues.jobDescription.trim().length > 0;
      if (hasUserContent) {
        // Record the handoff as seen but don't overwrite.
        appliedPrefillRef.current = {
          handoffId: prefill.handoffId,
          jobTitle: prefill.jobTitle,
          jobDescription: prefill.jobDescription,
        };
        return;
      }
    }

    // First load on empty form, OR a different handoffId arrived — always apply.
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
        topSkills: currentActiveCvSource.personalizationContext?.topSkills ?? null,
        recentExperience: currentActiveCvSource.personalizationContext?.recentExperience ?? null,
        standoutAchievements: currentActiveCvSource.personalizationContext?.standoutAchievements ?? null,
        desiredPosition: currentActiveCvSource.personalizationContext?.desiredPosition ?? null,
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

        onSubmit(values, result.proposalContent, {
          requestedModelType: result.requestedModelType,
          actualModelType: result.actualModelType,
          fallbackTriggerCode: result.fallbackTriggerCode,
        });
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

  function handleEditCv(id: string) {
    setActiveLocalCvId(id);
    refreshActiveCvState();
    setPendingCvId(id);
    setIsCvPickerOpen(false);
    syncSelectedCvToSharedActiveSnapshot(id);
    window.history.pushState({}, "", "/cv");
    window.dispatchEvent(new PopStateEvent("popstate"));
  }

  /* ── Cbar state (Type + Tone dropdowns) ─────────────────── */
  const [openMenu, setOpenMenu] = React.useState<"type" | "tone" | null>(null);
  const [menuPos, setMenuPos] = React.useState<{ left: number; bottom: number }>({ left: 0, bottom: 0 });
  const typeChipRef = React.useRef<HTMLButtonElement>(null);
  const toneChipRef = React.useRef<HTMLButtonElement>(null);
  const jobDescriptionRef = React.useRef<HTMLTextAreaElement>(null);

  const toggleMenu = React.useCallback((which: "type" | "tone") => {
    const ref = which === "type" ? typeChipRef : toneChipRef;
    if (openMenu === which) { setOpenMenu(null); return; }
    if (ref.current) {
      const r = ref.current.getBoundingClientRect();
      setMenuPos({ left: r.left, bottom: window.innerHeight - r.top + 4 });
    }
    setOpenMenu(which);
  }, [openMenu]);

  React.useEffect(() => {
    if (!openMenu) return;
    const close = () => setOpenMenu(null);
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [openMenu]);

  const typeLabel = selectedProposalType === "cover_letter" ? "Letter" : "Proposal";
  const toneUiLabel = TONE_OPTIONS.find(t => t.id === displayedVoicePreset)?.uiLabel ?? selectedVoicePresetDefinition.label;

  return (
      <div className={styles.container}>
      <Dialog
        open={isCvPickerOpen}
        onClose={handleCloseCvPicker}
        title="Choose resume"
        className="max-w-2xl"
      >
        <DialogContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Select the resume Proposal Forge should use for personalization.
          </p>
          {cvOptions.length === 0 ? (
            <div className="rounded-[var(--rm)] border border-[color:var(--bo)] [background:var(--sf2)] px-4 py-4 text-sm text-muted-foreground">
              No local resumes found yet. Create or import one in Resume.
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {cvOptions.map((option) => {
                const isSelected = pendingCvId === option.id || (pendingCvId === null && option.isActive);
                return (
                  <div
                    key={option.id}
                    className="dasti-doc-card dasti-doc-card--chooser"
                    role="button"
                    tabIndex={0}
                    aria-pressed={isSelected}
                    onClick={() => setPendingCvId(option.id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setPendingCvId(option.id);
                      }
                    }}
                    style={{
                      gap: "var(--s3)",
                      borderColor: isSelected ? "var(--bm)" : "var(--bo)",
                      background: isSelected ? "var(--sf2)" : "var(--sfr)",
                    }}
                  >
                    <div className="dasti-doc-card__stack">
                      <div className="dasti-doc-card__header">
                        <h3 className="dasti-doc-card__title">{option.title}</h3>
                      </div>

                      <div className="dasti-doc-card__meta">
                        {[option.profileName, option.desiredPosition].filter(Boolean).join(" · ") || "Draft resume"}
                      </div>
                    </div>

                    <div className="dasti-doc-card__actions-rail dasti-doc-card__actions-rail--chooser">
                      <div className="dasti-doc-card__actions">
                        <button
                          type="button"
                          className={clsx(
                            "dasti-icon-button dasti-icon-button--chooser",
                            isSelected && "dasti-icon-button--chooser-selected",
                          )}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isSelected) {
                              setPendingCvId(option.id);
                              return;
                            }
                            if (!option.isActive) {
                              handleSelectCv(option.id);
                              return;
                            }
                            handleCloseCvPicker();
                          }}
                          aria-label={
                            option.isActive
                              ? "Resume in use"
                              : isSelected
                              ? "Use selected resume"
                              : "Select resume"
                          }
                          title={
                            option.isActive
                              ? "Resume in use"
                              : isSelected
                              ? "Use selected resume"
                              : "Select resume"
                          }
                          style={{
                            background: isSelected ? "var(--sf2)" : undefined,
                            color: isSelected ? "var(--ti)" : undefined,
                          }}
                        >
                          <Check size={20} strokeWidth={2} aria-hidden />
                        </button>
                        <button
                          type="button"
                          className="dasti-icon-button dasti-icon-button--chooser"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditCv(option.id);
                          }}
                          aria-label="Edit resume"
                          title="Edit resume"
                        >
                          <ScrollText size={20} strokeWidth={1.5} aria-hidden />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
            {activeCvSource.title ? (
              <div className="dasti-proposal-context-row" style={{ marginTop: 0, marginBottom: "var(--s2)" }}>
                <Paperclip size={13} strokeWidth={1.5} aria-hidden />
                <span className="dasti-proposal-context-row__text">{activeCvSource.title}</span>
              </div>
            ) : null}
            <div>
              <input
                type="text"
                id="jobTitle"
                {...form.register("jobTitle")}
                className={clsx(styles.inputElement, styles.jobField)}
                placeholder="Enter Job Title"
                autoComplete="off"
              />
              {form.formState.errors.jobTitle && (
                <p className={styles.errorMessage}>
                  {form.formState.errors.jobTitle.message}
                </p>
              )}
            </div>
            {/* .siw — chatbox well */}
            <div className={styles.composeWell} style={{ position: "relative" }}>
              <div className="dasti-proposal-sheet dasti-proposal-sheet--composer">
                <div className="dasti-proposal-sheet__body">
                  <textarea
                    ref={jobDescriptionRef}
                    id="jobDescription"
                    {...form.register("jobDescription")}
                    className="dasti-proposal-sheet__body--editable"
                    style={{
                      color: "var(--ti)",
                      fontSize: "var(--ts)",
                      lineHeight: "var(--lb)",
                      outline: "none",
                      display: "block",
                      fontFamily: "inherit",
                      background: "transparent",
                      width: "100%",
                      height: "100%",
                      resize: "none",
                      overflowY: "auto",
                    }}
                    placeholder="Paste the job description here…"
                  />
                </div>
              </div>
              {/* .cbar */}
              <div className="dasti-proposal-toolbar">
                <div className="dasti-proposal-cv-pill">
                  <button
                    type="button"
                    onClick={handleOpenCvPicker}
                    className="dasti-icon-button dasti-proposal-cv-pill__icon"
                    aria-label="Choose resume"
                    title="Choose resume"
                  >
                    <Paperclip size={15} strokeWidth={1.5} aria-hidden />
                  </button>
                  <button
                    type="button"
                    onClick={handleClearCv}
                    className="dasti-icon-button dasti-proposal-cv-pill__clear"
                    aria-label="Clear resume"
                    title="Clear resume"
                    style={{ visibility: activeCvSource.title ? "visible" : "hidden" }}
                  >
                    <X size={14} strokeWidth={1.5} aria-hidden />
                  </button>
                </div>
                {/* Type dropdown */}
                <button
                  ref={typeChipRef}
                  type="button"
                  title="Document type"
                  onClick={(e) => { e.stopPropagation(); toggleMenu("type"); }}
                  className="dasti-proposal-chip"
                >
                  <span className="dasti-proposal-chip__label">{typeLabel}</span>
                  <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" />
                </button>
                {/* Tone dropdown */}
                <button
                  ref={toneChipRef}
                  type="button"
                  title="Tone"
                  onClick={(e) => { e.stopPropagation(); toggleMenu("tone"); }}
                  className="dasti-proposal-chip"
                >
                  <span className="dasti-proposal-chip__label">{toneUiLabel}</span>
                  <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" />
                </button>
                {/* .gbtn — generate / stop */}
                <button
                  type="submit"
                  className="dasti-proposal-submit"
                  aria-busy={isGenerating}
                  disabled={!isGenerating && watchedJobDescription.length < 10}
                  title={isGenerating ? "Generating…" : watchedJobDescription.length < 10 ? "Minimum 10 characters required" : "Generate"}
                  style={{
                    background: isGenerating ? "var(--sf2)" : "var(--ac)",
                    color: isGenerating ? "var(--ti)" : "var(--op)",
                    border: "1px solid transparent",
                    cursor: (!isGenerating && watchedJobDescription.length < 10) ? "not-allowed" : "pointer",
                    transition: "background .15s var(--ez), opacity .15s var(--ez)",
                    opacity: (!isGenerating && watchedJobDescription.length < 10) ? 0.4 : 1,
                  }}
                >
                  {isGenerating ? (
                    <Square size={16} fill="currentColor" strokeWidth={0} />
                  ) : (
                    <ArrowUp size={16} strokeWidth={1.5} />
                  )}
                </button>
              </div>
            </div>
            {(prefill?.platform || prefill?.sourceUrl) && (
              <div className="dasti-meta-row dasti-meta-row--subtle" style={{ marginTop: "var(--s2)" }}>
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
            {form.formState.errors.jobDescription && (
              <p className={styles.errorMessage}>
                {form.formState.errors.jobDescription.message}
              </p>
            )}
            {errorMessage && (
              <p
                role="alert"
                className={styles.errorMessage}
              >
                {errorMessage}
              </p>
            )}
          </div>
        </div>
      </form>
      {/* Portal dropdowns for cbar */}
      {openMenu !== null && createPortal(
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            zIndex: 900,
            minWidth: 220,
            background: "var(--sfr)",
            border: "1px solid var(--bm)",
            borderRadius: "var(--rm)",
            boxShadow: "var(--shc)",
            padding: "var(--s1)",
            left: menuPos.left,
            bottom: menuPos.bottom,
            top: "auto",
          }}
        >
          {openMenu === "type" && (
            <>
              {([
                { value: "cover_letter", label: "Letter", desc: "Cover letter for a job application" },
                { value: "freelance_proposal", label: "Proposal", desc: "Freelance proposal for a project" },
              ] as const).filter((opt) => opt.value !== selectedProposalType).map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => { form.setValue("proposalType", opt.value, { shouldDirty: true, shouldValidate: true }); setOpenMenu(null); }}
                  className="dasti-menu-option"
                >
                  <div className="dasti-menu-option__title">{opt.label}</div>
                  <div className="dasti-menu-option__description">{opt.desc}</div>
                </div>
              ))}
            </>
          )}
          {openMenu === "tone" && TONE_OPTIONS.filter((opt) => opt.id !== displayedVoicePreset).map((opt) => (
            <div
              key={opt.id}
              onClick={() => { handleVoicePresetChange(opt.id); setOpenMenu(null); }}
              className="dasti-menu-option"
            >
              <div className="dasti-menu-option__title">{opt.uiLabel}</div>
              <div className="dasti-menu-option__description">{opt.description}</div>
            </div>
          ))}
        </div>,
        document.body
      )}
    </div>
  );
};

export default ProposalInputForm;

function capitalizeLabel(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
