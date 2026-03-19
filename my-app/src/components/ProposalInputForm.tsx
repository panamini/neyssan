"use client";

import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { Button } from "./ui/button";
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
import { ArrowUp, ChevronDown, Plus, Square, X } from "lucide-react";

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
    refreshActiveCvState();
    setIsCvPickerOpen(true);
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
    setIsCvPickerOpen(false);
    syncSelectedCvToSharedActiveSnapshot(id);
  }

  function handleClearCv() {
    clearActiveLocalCvId();
    setIsCvPickerOpen(false);
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
    <div className="pf-container">
      {/* Resume selector row */}
      <div style={{ marginBottom: "var(--s3)", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "var(--s2)", fontSize: "var(--ts)", color: "var(--tm2)" }}>
        <div className="pf-cv-pill">
          <button
            type="button"
            onClick={handleOpenCvPicker}
            className="pf-cv-pick-btn"
            title="Choose resume"
          >
            <span>Resume:</span>
            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 600, color: "var(--ti)" }}>
              {activeCvSource.title ?? "not selected"}
            </span>
          </button>
          <button
            type="button"
            onClick={activeCvSource.title ? handleClearCv : handleOpenCvPicker}
            className="dasti-icon-button"
            aria-label={activeCvSource.title ? "Clear resume" : "Choose resume"}
            title={activeCvSource.title ? "Clear resume" : "Choose resume"}
          >
            {activeCvSource.title ? (
              <X size={14} aria-hidden />
            ) : (
              <Plus size={14} aria-hidden />
            )}
          </button>
        </div>
      </div>
      {(prefill?.platform || prefill?.sourceUrl) && (
        <div style={{ marginBottom: "var(--s3)", fontSize: "var(--ts)", color: "var(--tm2)" }}>
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
                className="pf-source-link"
              >
                View source
              </a>
            </>
          )}
        </div>
      )}
      <Dialog
        open={isCvPickerOpen}
        onClose={() => setIsCvPickerOpen(false)}
        title="Choose resume"
      >
        <DialogContent>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--s4)" }}>
            <p style={{ fontSize: "var(--ts)", color: "var(--tm2)" }}>
              Select the resume Proposal Forge should use for personalization.
            </p>
            {cvOptions.length === 0 ? (
              <div style={{ borderRadius: "var(--rm)", border: "1px solid var(--bo)", background: "var(--sf2)", padding: "var(--s4)", fontSize: "var(--ts)", color: "var(--tm2)" }}>
                No local resumes found yet. Create or import one in Resume.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "var(--s2)", maxHeight: "50vh", overflowY: "auto" }}>
                {cvOptions.map((option) => (
                  <div
                    key={option.id}
                    className={clsx("pf-cv-option", option.isActive && "pf-cv-option--active")}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "var(--s3)" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div style={{ fontWeight: 600, color: "var(--ti)" }}>
                          {option.title}
                        </div>
                        {(option.profileName || option.desiredPosition) && (
                          <div style={{ marginTop: "var(--s1)", fontSize: "var(--ts)", color: "var(--ti)" }}>
                            {[option.profileName, option.desiredPosition]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                        {option.email && (
                          <div style={{ marginTop: "var(--s1)", fontSize: "var(--ts)", color: "var(--tm2)" }}>
                            {option.email}
                          </div>
                        )}
                        {option.summarySnippet && (
                          <div style={{ marginTop: "var(--s2)", fontSize: "var(--ts)", color: "var(--tm2)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                            {option.summarySnippet}
                          </div>
                        )}
                      </div>
                      <div style={{ display: "flex", flexShrink: 0, flexDirection: "column", alignItems: "flex-end", gap: "var(--s2)" }}>
                        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "flex-end", gap: "var(--s2)" }}>
                          <Button
                            type="button"
                            variant={option.isActive ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => handleSelectCv(option.id)}
                            disabled={option.isActive}
                          >
                            Use
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCv(option.id)}
                          >
                            Edit
                          </Button>
                        </div>
                        {option.isActive && (
                          <span className="pf-cv-badge">Current</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      <form
        autoComplete="off"
        onSubmit={(e) => {
          void form.handleSubmit(handleSubmit)(e);
        }}
      >
        <div>
          <label htmlFor="jobTitle" className="sr-only">Job title</label>
          <input
            type="text"
            id="jobTitle"
            {...form.register("jobTitle")}
            className="pf-input"
            placeholder="Enter Job Title"
            autoComplete="off"
          />
          {form.formState.errors.jobTitle && (
            <p className="pf-error">
              {form.formState.errors.jobTitle.message}
            </p>
          )}
          {/* .siw — chatbox well */}
          <div className="pf-compose-well">
            <textarea
              id="jobDescription"
              {...form.register("jobDescription")}
              style={{
                width: "100%",
                minHeight: 200,
                maxHeight: 360,
                padding: "var(--s3) var(--s4)",
                border: "none",
                background: "transparent",
                color: "var(--ti)",
                fontSize: "var(--ts)",
                lineHeight: "var(--lb)",
                resize: "vertical",
                outline: "none",
                display: "block",
                fontFamily: "inherit",
              }}
              placeholder="Paste the job description here…"
            />
            {/* .cbar */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s2)",
                padding: "var(--s2) var(--s3)",
                borderTop: "1px solid var(--bo)",
                background: "var(--sf1)",
                borderRadius: "0 0 calc(var(--rm) - 1px) calc(var(--rm) - 1px)",
              }}
            >
              <button
                ref={typeChipRef}
                type="button"
                title="Document type"
                className="pf-chip"
                onClick={(e) => { e.stopPropagation(); toggleMenu("type"); }}
              >
                <span style={{ fontSize: "var(--tx)", fontWeight: 500 }}>{typeLabel}</span>
                <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <button
                ref={toneChipRef}
                type="button"
                title="Tone"
                className="pf-chip"
                onClick={(e) => { e.stopPropagation(); toggleMenu("tone"); }}
              >
                <span style={{ fontSize: "var(--tx)", fontWeight: 500 }}>{toneUiLabel}</span>
                <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" />
              </button>
              <div style={{ flex: 1 }} />
              {/* .gbtn — generate / stop */}
              <button
                type="submit"
                aria-busy={isGenerating}
                disabled={!isGenerating && watchedJobDescription.length < 10}
                title={isGenerating ? "Generating…" : watchedJobDescription.length < 10 ? "Minimum 10 characters required" : "Generate"}
                style={{
                  width: "var(--hs)",
                  height: "var(--hs)",
                  borderRadius: "var(--rs)",
                  background: isGenerating ? "var(--sf2)" : "var(--ac)",
                  color: isGenerating ? "var(--ti)" : "var(--op)",
                  border: "1px solid transparent",
                  cursor: (!isGenerating && watchedJobDescription.length < 10) ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
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
          {form.formState.errors.jobDescription && (
            <p className="pf-error">
              {form.formState.errors.jobDescription.message}
            </p>
          )}
          {errorMessage && (
            <p role="alert" className="pf-error">
              {errorMessage}
            </p>
          )}
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
              ] as const).map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => { form.setValue("proposalType", opt.value, { shouldDirty: true, shouldValidate: true }); setOpenMenu(null); }}
                  className={`pf-menu-option${selectedProposalType === opt.value ? " pf-menu-option--active" : ""}`}
                >
                  <div style={{ fontSize: "var(--ts)", fontWeight: 600, color: "var(--ti)" }}>{opt.label}</div>
                  <div style={{ fontSize: "var(--tx)", color: "var(--tg2)", marginTop: 3, lineHeight: 1.5 }}>{opt.desc}</div>
                </div>
              ))}
            </>
          )}
          {openMenu === "tone" && TONE_OPTIONS.map((opt) => (
            <div
              key={opt.id}
              onClick={() => { handleVoicePresetChange(opt.id); setOpenMenu(null); }}
              className={`pf-menu-option${displayedVoicePreset === opt.id ? " pf-menu-option--active" : ""}`}
            >
              <div style={{ fontSize: "var(--ts)", fontWeight: 600, color: "var(--ti)" }}>{opt.uiLabel}</div>
              <div style={{ fontSize: "var(--tx)", color: "var(--tg2)", marginTop: 3, lineHeight: 1.5 }}>{opt.description}</div>
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
