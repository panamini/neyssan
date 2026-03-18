"use client";

import React from "react";
import { useForm } from "react-hook-form";
import styles from "./ProposalInputForm.module.css";
import { zodResolver } from "@hookform/resolvers/zod";
import clsx from "clsx";
import { ArrowUp, Loader2 } from "lucide-react";
import CustomToggle from "./CustomToggle";
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
  onError?: (message: string, values: FormValues) => void;
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
      setErrorMessage(nextErrorMessage);
      onError?.(nextErrorMessage, values);
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
            <div className="relative mt-2">
              <textarea
                id="jobDescription"
                rows={2}
                {...form.register("jobDescription")}
                className={clsx(styles.inputElement, styles.jobField)}
                placeholder="Paste Job Description"
              />
              <Button
                type="submit"
                aria-busy={isGenerating}
                disabled={isGenerating || watchedJobDescription.length < 10}
                title={
                  isGenerating
                    ? "Generation in progress"
                    : watchedJobDescription.length < 10
                    ? "Minimum 10 characters required"
                    : ""
                }
                className="absolute -translate-y-1/2 right-4 top-1/2"
                variant="primary"
                size="sm"
              >
                {isGenerating ? (
                  <Loader2 className="text-background animate-spin" />
                ) : (
                  <ArrowUp />
                )}
              </Button>
              {form.formState.errors.jobDescription && (
                <p className={styles.errorMessage}>
                  {form.formState.errors.jobDescription.message}
                </p>
              )}
            </div>
            {errorMessage && (
              <p
                role="alert"
                className={styles.errorMessage}
              >
                {errorMessage}
              </p>
            )}
          </div>
          {/* Controls row */}
          <div className="flex flex-wrap items-center gap-4 md:col-span-2">
            {/* Model Type */}
            {/* Model Type */}
            <div className="flex-1 min-w-[150px] flex items-center gap-2">
              <CustomToggle
                isModelToggle={true}
                options={VISIBLE_MODEL_OPTIONS}
                value={selectedModelType}
                onChange={(value: string) =>
                  form.setValue("modelType", value as "chatgpt")
                }
              />
            </div>

            {/* Proposal Type */}
            <div className="flex-1 min-w-[150px] flex items-center gap-2">
              <CustomToggle
                options={VISIBLE_PROPOSAL_TYPE_OPTIONS}
                value={selectedProposalType}
                onChange={(value: string) =>
                  form.setValue(
                    "proposalType",
                    value as "cover_letter" | "freelance_proposal",
                  )
                }
              />
            </div>
          </div>

          <div className="md:col-span-2 rounded-lg border border-[color:var(--bo)] [background:var(--sfr)] p-4">
            <div className="flex flex-col gap-3">
              <div>
                <div className="text-sm font-medium text-foreground">
                  Voice preset
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Presets are the main tone control. Advanced controls can still
                  override the baseline without removing the preset&apos;s
                  lightweight style guidance.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                {availableVoicePresets.map((preset) => (
                  <Button
                    key={preset.id}
                    type="button"
                    size="sm"
                    variant={
                      preset.id === displayedVoicePreset
                        ? "primary"
                        : "secondary"
                    }
                    className="min-w-[120px]"
                    onClick={() => handleVoicePresetChange(preset.id)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="rounded-md border border-[color:var(--bo)] [background:var(--as)] px-3 py-2 text-sm">
                <div className="font-medium text-foreground">
                  {selectedVoicePresetDefinition.label}
                </div>
                <p className="mt-1 text-muted-foreground">
                  {selectedVoicePresetDefinition.description}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Baseline:{" "}
                  {capitalizeLabel(
                    selectedVoicePresetDefinition.formalityLevel,
                  )}{" "}
                  formality,{" "}
                  {capitalizeLabel(selectedVoicePresetDefinition.creativity)}{" "}
                  creativity
                </p>
              </div>

              {voicePresetSaveError && (
                <p className="text-sm text-muted-foreground">
                  {voicePresetSaveError}
                </p>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};

export default ProposalInputForm;

function capitalizeLabel(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}
