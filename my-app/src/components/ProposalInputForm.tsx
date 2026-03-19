"use client";

import React from "react";
import { useForm } from "react-hook-form";
import styles from "./ProposalInputForm.module.css";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { createPortal } from "react-dom";
import { Button } from "./ui/button";
import { Dialog, DialogActions, DialogContent } from "./ui/dialog";

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
  { id: "signature", uiLabel: "Neutre", description: "Balanced, natural, and credible." },
  { id: "expert", uiLabel: "Formel", description: "More precise, structured, and authoritative." },
  { id: "engaging", uiLabel: "Chaleureux", description: "Warmer, more lively, and still professional." },
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
  const appliedPrefillRef = React.useRef<string | null>(null);
  const appliedSavedVoicePresetRef = React.useRef(false);
  const lastSharedSnapshotSyncStateRef = React.useRef<string | null>(null);

  const refreshActiveCvState = React.useCallback(() => {
    setActiveCvSource(getActiveLocalPersonalizationSource());
    setCvOptions(listLocalCvPickerOptions());
  }, []);

  const formatCvDate = React.useCallback((value?: string) => {
    if (!value) return null;
    const parsed = Date.parse(value);
    if (!Number.isFinite(parsed)) return null;
    try {
      return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
        new Date(parsed),
      );
    } catch {
      return new Date(parsed).toLocaleDateString();
    }
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
    if (!prefill?.handoffId) return;
    if (appliedPrefillRef.current === prefill.handoffId) return;

    const currentValues = form.getValues();
    const hasUserContent =
      form.formState.isDirty ||
      currentValues.jobTitle.trim().length > 0 ||
      currentValues.jobDescription.trim().length > 0;

    if (!hasUserContent) {
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
    }

    appliedPrefillRef.current = prefill.handoffId;
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
      <div className="flex flex-wrap items-center gap-2 mb-3 text-sm text-muted-foreground">
        <span>
          Using CV:{" "}
          <span className="font-medium text-foreground">
            {activeCvSource.title ?? "none"}
          </span>
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="px-2"
          onClick={handleOpenCvPicker}
        >
          Change CV
        </Button>
        {activeCvSource.title && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="px-2"
            onClick={handleClearCv}
          >
            Use no CV
          </Button>
        )}
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
        title="Choose CV"
        className="max-w-lg"
      >
        <DialogContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select the CV Proposal Forge should use for personalization.
          </p>
          {cvOptions.length === 0 ? (
            <div className="rounded-md border border-[color:var(--bo)] bg-background px-3 py-4 text-sm text-muted-foreground">
              No local CVs found yet. Create or import one in CV Forge.
            </div>
          ) : (
            <div className="space-y-2 max-h-[50vh] overflow-y-auto">
              {cvOptions.map((option) => {
                const updatedLabel = formatCvDate(
                  option.updatedAt ?? option.createdAt,
                );
                return (
                  <div
                    key={option.id}
                    className={clsx(
                      "w-full rounded-lg border p-3 transition-colors",
                      option.isActive
                        ? "border-[color:var(--ac)] [background:var(--as)]"
                        : "border-[color:var(--bo)] bg-background hover:[background:var(--as)]",
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-foreground">
                          {option.title}
                        </div>
                        {(option.profileName || option.desiredPosition) && (
                          <div className="mt-1 text-sm text-foreground/90">
                            {[option.profileName, option.desiredPosition]
                              .filter(Boolean)
                              .join(" · ")}
                          </div>
                        )}
                        {option.email && (
                          <div className="mt-1 text-sm text-muted-foreground">
                            {option.email}
                          </div>
                        )}
                        {option.summarySnippet && (
                          <div className="mt-2 text-sm text-muted-foreground line-clamp-2">
                            {option.summarySnippet}
                          </div>
                        )}
                      </div>
                      <div className="flex shrink-0 flex-col items-end gap-2">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button
                            type="button"
                            variant={option.isActive ? "secondary" : "primary"}
                            size="sm"
                            onClick={() => handleSelectCv(option.id)}
                          >
                            {option.isActive ? "Using this CV" : "Use this CV"}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditCv(option.id)}
                          >
                            Edit in CV Forge
                          </Button>
                        </div>
                        <div className="flex flex-col items-end gap-2 text-xs text-muted-foreground">
                          {option.isActive && (
                            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-primary">
                              Current
                            </span>
                          )}
                          {updatedLabel && <span>Updated {updatedLabel}</span>}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </DialogContent>
        <DialogActions className="justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleClearCv}
          >
            Use no CV
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsCvPickerOpen(false)}
          >
            Close
          </Button>
        </DialogActions>
      </Dialog>
      <form
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
              />
              {form.formState.errors.jobTitle && (
                <p className={styles.errorMessage}>
                  {form.formState.errors.jobTitle.message}
                </p>
              )}
            </div>
            {/* .siw — chatbox well */}
            <div
              style={{
                border: "1px solid var(--bm)",
                borderRadius: "var(--rm)",
                background: "var(--sf1)",
                marginTop: "var(--s2)",
                transition: "box-shadow .12s var(--ez), border-color .12s var(--ez)",
              }}
            >
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
                {/* Type ichip */}
                <button
                  ref={typeChipRef}
                  type="button"
                  title="Document type"
                  onClick={(e) => { e.stopPropagation(); toggleMenu("type"); }}
                  style={{
                    width: 26, height: 26,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "var(--rs)",
                    border: "1px solid var(--ac)",
                    background: "var(--as)",
                    color: "var(--am)",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all .12s var(--ez)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <rect x="3" y="1" width="10" height="14" rx="2" />
                    <path d="M6 5h4M6 8h4M6 11h2" />
                  </svg>
                </button>
                {/* Tone ichip */}
                <button
                  ref={toneChipRef}
                  type="button"
                  title="Tone"
                  onClick={(e) => { e.stopPropagation(); toggleMenu("tone"); }}
                  style={{
                    width: 26, height: 26,
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    borderRadius: "var(--rs)",
                    border: "1px solid var(--ac)",
                    background: "var(--as)",
                    color: "var(--am)",
                    cursor: "pointer",
                    flexShrink: 0,
                    transition: "all .12s var(--ez)",
                  }}
                >
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    <path d="M2 4h8M2 8h12M2 12h5" />
                    <circle cx="12" cy="4" r="2" fill="currentColor" stroke="none" />
                  </svg>
                </button>
                {/* .cbar-status */}
                <span
                  style={{
                    flex: 1,
                    fontSize: "var(--tx)",
                    color: "var(--tm2)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    padding: "0 var(--s2)",
                    minWidth: 0,
                  }}
                >
                  <strong style={{ color: "var(--ti)", fontWeight: 600 }}>{typeLabel}</strong>
                  {" · "}
                  {toneUiLabel}
                </span>
                {/* .gbtn — generate / stop */}
                <button
                  type="submit"
                  aria-busy={isGenerating}
                  disabled={!isGenerating && watchedJobDescription.length < 10}
                  title={isGenerating ? "Generating…" : watchedJobDescription.length < 10 ? "Minimum 10 characters required" : "Generate"}
                  style={{
                    width: "var(--hs)",
                    height: "var(--hs)",
                    borderRadius: "var(--rp)",
                    background: isGenerating ? "var(--sf2)" : "var(--ac)",
                    color: isGenerating ? "var(--ti)" : "var(--op)",
                    border: "none",
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
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                      <rect x="4" y="4" width="8" height="8" rx="1.5" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M8 14V2M4 6l4-4 4 4" />
                    </svg>
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
              ] as const).map((opt) => (
                <div
                  key={opt.value}
                  onClick={() => { form.setValue("proposalType", opt.value, { shouldDirty: true, shouldValidate: true }); setOpenMenu(null); }}
                  style={{
                    padding: "var(--s3) var(--s4)",
                    borderRadius: "var(--rs)",
                    cursor: "pointer",
                    background: selectedProposalType === opt.value ? "var(--as)" : "transparent",
                    transition: "background .1s var(--ez)",
                  }}
                  onMouseEnter={(e) => { if (selectedProposalType !== opt.value) (e.currentTarget as HTMLDivElement).style.background = "var(--sf2)"; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = selectedProposalType === opt.value ? "var(--as)" : "transparent"; }}
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
              style={{
                padding: "var(--s3) var(--s4)",
                borderRadius: "var(--rs)",
                cursor: "pointer",
                background: displayedVoicePreset === opt.id ? "var(--as)" : "transparent",
                transition: "background .1s var(--ez)",
              }}
              onMouseEnter={(e) => { if (displayedVoicePreset !== opt.id) (e.currentTarget as HTMLDivElement).style.background = "var(--sf2)"; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = displayedVoicePreset === opt.id ? "var(--as)" : "transparent"; }}
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
