"use client";

import React from "react";
import { useForm } from "react-hook-form";
import styles from "./ProposalInputForm.module.css";
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
import { ArrowUp, ChevronDown, FileText, Plus, Square, X } from "lucide-react";

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
    <div className={styles.container}>
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <div className="inline-flex max-w-full items-center overflow-hidden rounded-[var(--rs)] border border-transparent [background:transparent] transition-colors hover:[background:var(--sf2)]">
          <button
            type="button"
            onClick={handleOpenCvPicker}
            className="inline-flex min-w-0 items-center gap-1 px-2 py-1 text-left transition-colors hover:text-foreground focus:outline-none focus-visible:[box-shadow:inset_0_0_0_1px_var(--bm)]"
            title="Choose resume"
          >
            <span>Resume:</span>
            <span className="truncate font-medium text-foreground">
              {activeCvSource.title ?? "none"}
            </span>
          </button>
          <button
            type="button"
            onClick={activeCvSource.title ? handleClearCv : handleOpenCvPicker}
            className="dasti-icon-button shrink-0"
            aria-label={activeCvSource.title ? "Clear resume" : "Choose resume"}
            title={activeCvSource.title ? "Clear resume" : "Choose resume"}
          >
            {activeCvSource.title ? (
              <X className="h-3.5 w-3.5" aria-hidden />
            ) : (
              <Plus className="h-3.5 w-3.5" aria-hidden />
            )}
          </button>
        </div>
      </div>
      {(prefill?.platform || prefill?.sourceUrl) && (
        <div className="mb-3 text-sm text-muted-foreground">
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
                className="underline underline-offset-2 hover:text-foreground"
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
        className="max-w-2xl [background:var(--sf1)]"
      >
        <DialogContent className="space-y-4 [background:var(--sf1)]">
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
                const dateStr = (() => {
                  const raw = option.updatedAt ?? option.createdAt;
                  if (!raw) return null;
                  const d = new Date(raw);
                  return isNaN(d.getTime()) ? null : d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit", year: "2-digit" });
                })();
                return (
                  <div
                    key={option.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "var(--s3)",
                      padding: "var(--s3) var(--s4)",
                      borderRadius: "var(--rm)",
                      border: `1px solid ${option.isActive ? "var(--ac)" : "var(--bo)"}`,
                      background: option.isActive ? "var(--as)" : "var(--sfr)",
                      boxShadow: "var(--sha)",
                      transition: "border-color .12s var(--ez), background .12s var(--ez)",
                    }}
                  >
                    {/* Doc icon */}
                    <div style={{
                      width: 30, height: 30, flexShrink: 0,
                      borderRadius: "var(--rs)",
                      background: "var(--sf2)",
                      border: "1px solid var(--bo)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      marginTop: 1,
                    }}>
                      <FileText size={13} strokeWidth={1.5} color="var(--am)" />
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      {/* Title + date */}
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--s2)" }}>
                        <span style={{ fontSize: "var(--ts)", fontWeight: 600, color: "var(--ti)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {option.title}
                        </span>
                        {dateStr && (
                          <span style={{ fontSize: "var(--tx)", color: "var(--tg2)", flexShrink: 0 }}>{dateStr}</span>
                        )}
                      </div>

                      {/* Name · position */}
                      {(option.profileName || option.desiredPosition) && (
                        <div style={{ fontSize: "var(--tx)", color: "var(--tm2)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {[option.profileName, option.desiredPosition].filter(Boolean).join(" · ")}
                        </div>
                      )}

                      {/* Summary snippet */}
                      {option.summarySnippet && (
                        <div style={{
                          fontSize: "var(--tx)", color: "var(--tg2)", marginTop: 4,
                          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
                          lineHeight: 1.5,
                        }}>
                          {option.summarySnippet}
                        </div>
                      )}
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", flexShrink: 0, alignItems: "center", gap: "var(--s2)", marginTop: 2 }}>
                      {option.isActive ? (
                        <span style={{
                          fontSize: 10, fontWeight: 600, letterSpacing: ".06em",
                          padding: "2px 8px", borderRadius: 99,
                          background: "var(--ap)", color: "var(--am)",
                          border: "1px solid var(--ac)",
                          whiteSpace: "nowrap",
                        }}>
                          ✓ In use
                        </span>
                      ) : (
                        <Button type="button" variant="primary" size="sm" onClick={() => handleSelectCv(option.id)}>
                          Use
                        </Button>
                      )}
                      <Button type="button" variant="ghost" size="sm" onClick={() => handleEditCv(option.id)}>
                        Edit
                      </Button>
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
            <div className={styles.composeWell}>
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
                {/* Type dropdown */}
                <button
                  ref={typeChipRef}
                  type="button"
                  title="Document type"
                  onClick={(e) => { e.stopPropagation(); toggleMenu("type"); }}
                  style={{
                    height: 26,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "0 var(--s2)",
                    borderRadius: "var(--rs)",
                    border: "1px solid transparent",
                    background: "transparent",
                    color: "var(--tm2)",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "background .12s var(--ez), color .12s var(--ez)",
                  }}
                  onMouseEnter={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = "var(--sf2)";
                    b.style.color = "var(--ti)";
                  }}
                  onMouseLeave={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = "transparent";
                    b.style.color = "var(--tm2)";
                  }}
                >
                  <span style={{ fontSize: "var(--tx)", fontWeight: 500 }}>{typeLabel}</span>
                  <ChevronDown size={12} strokeWidth={1.5} aria-hidden="true" />
                </button>
                {/* Tone dropdown */}
                <button
                  ref={toneChipRef}
                  type="button"
                  title="Tone"
                  onClick={(e) => { e.stopPropagation(); toggleMenu("tone"); }}
                  style={{
                    height: 26,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px",
                    padding: "0 var(--s2)",
                    borderRadius: "var(--rs)",
                    border: "1px solid transparent",
                    background: "transparent",
                    color: "var(--tm2)",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "background .12s var(--ez), color .12s var(--ez)",
                  }}
                  onMouseEnter={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = "var(--sf2)";
                    b.style.color = "var(--ti)";
                  }}
                  onMouseLeave={(e) => {
                    const b = e.currentTarget as HTMLButtonElement;
                    b.style.background = "transparent";
                    b.style.color = "var(--tm2)";
                  }}
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
                  style={{
                    padding: "var(--s3) var(--s4)",
                    borderRadius: "var(--rs)",
                    cursor: "pointer",
                    background: "transparent",
                    transition: "background .1s var(--ez)",
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--sf2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
                >
                  <div style={{ fontSize: "var(--ts)", fontWeight: 600, color: "var(--ti)" }}>{opt.label}</div>
                  <div style={{ fontSize: "var(--tx)", color: "var(--tg2)", marginTop: 3, lineHeight: 1.5 }}>{opt.desc}</div>
                </div>
              ))}
            </>
          )}
          {openMenu === "tone" && TONE_OPTIONS.filter((opt) => opt.id !== displayedVoicePreset).map((opt) => (
            <div
              key={opt.id}
              onClick={() => { handleVoicePresetChange(opt.id); setOpenMenu(null); }}
              style={{
                padding: "var(--s3) var(--s4)",
                borderRadius: "var(--rs)",
                cursor: "pointer",
                background: "transparent",
                transition: "background .1s var(--ez)",
              }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = "var(--sf2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = "transparent"; }}
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
