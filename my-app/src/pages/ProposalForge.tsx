import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAction, useConvexAuth, useMutation, useQuery } from "convex/react";
import {
  ArrowsOutSimple,
  Check,
  CornersIn,
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
import ProposalsList from "../components/ProposalsList";
import { useToast } from "../components/ui/toast";
import type { FormValues } from "../components/ProposalInputForm.schemas";
import { api } from "../../convex/_generated/api";
import {
  buildAppProposalPersonalizationPayload,
  getActiveLocalPersonalizationSource,
} from "../lib/proposal-personalization";
import {
  getProposalGenerationUiErrorMessage,
  type ProposalGenerationFallbackInfo,
} from "../lib/proposal-generation-ui";

type ProposalForgePrefill = {
  handoffId: string;
  jobTitle: string;
  jobDescription: string;
  sourceUrl?: string;
  platform?: string;
} | null;

type ProposalForgeView = "compose" | "saved";

type StoredProposalOutputDraft = {
  proposalContent: string | null;
  proposalType: FormValues["proposalType"] | null;
  proposalVoicePreset: FormValues["voicePreset"] | null;
  proposalDocumentTitle: string;
  proposalDocumentMeta: string;
  generatedProposalId: string | null;
  proposalOutputMode: "preview" | "edit";
};

type GenerateProposalResult = {
  proposalId: string;
  proposalContent: string;
} & Required<ProposalGenerationFallbackInfo>;

const PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY = "dasti:proposal-output-draft:v1";

function readStoredProposalOutputDraft(): StoredProposalOutputDraft | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StoredProposalOutputDraft> | null;
    if (!parsed || typeof parsed !== "object") return null;

    return {
      proposalContent:
        typeof parsed.proposalContent === "string"
          ? parsed.proposalContent
          : null,
      proposalType:
        parsed.proposalType === "cover_letter" ||
        parsed.proposalType === "application_message" ||
        parsed.proposalType === "freelance_proposal"
          ? parsed.proposalType
          : null,
      proposalVoicePreset:
        typeof parsed.proposalVoicePreset === "string"
          ? (parsed.proposalVoicePreset as FormValues["voicePreset"])
          : null,
      proposalDocumentTitle:
        typeof parsed.proposalDocumentTitle === "string"
          ? parsed.proposalDocumentTitle
          : "",
      proposalDocumentMeta:
        typeof parsed.proposalDocumentMeta === "string"
          ? parsed.proposalDocumentMeta
          : "",
      generatedProposalId:
        typeof parsed.generatedProposalId === "string"
          ? parsed.generatedProposalId
          : null,
      proposalOutputMode:
        parsed.proposalOutputMode === "edit" ? "edit" : "preview",
    };
  } catch {
    return null;
  }
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
  const { search } = useLocation();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const storedOutputDraft = React.useMemo(
    () => readStoredProposalOutputDraft(),
    [],
  );
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const handoffId = React.useMemo(
    () => new URLSearchParams(search).get("handoffId"),
    [search],
  );
  const requestedView = React.useMemo<ProposalForgeView>(() => {
    const view = new URLSearchParams(search).get("view");
    return view === "saved" ? "saved" : "compose";
  }, [search]);
  const selectedProposalId = React.useMemo(
    () => new URLSearchParams(search).get("id"),
    [search],
  );
  const {
    isLoading: isConvexAuthLoading,
    isAuthenticated: isConvexAuthenticated,
  } = useConvexAuth();
  const generateProposalAction = useAction(
    api.functions.generateProposal as any,
  );
  const updateProposal = useMutation(
    (api as any).updateProposalPublic?.default,
  );
  const deleteProposal = useMutation(
    (api as any).deleteProposalPublic?.default,
  );
  const [proposalContent, setProposalContent] = React.useState<string | null>(
    storedOutputDraft?.proposalContent ?? null,
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorDetail, setErrorDetail] = React.useState<string | null>(null);
  const [proposalType, setProposalType] = React.useState<
    FormValues["proposalType"] | null
  >(storedOutputDraft?.proposalType ?? null);
  const [proposalVoicePreset, setProposalVoicePreset] = React.useState<
    FormValues["voicePreset"] | null
  >(storedOutputDraft?.proposalVoicePreset ?? null);
  const [proposalDocumentTitle, setProposalDocumentTitle] =
    React.useState<string>(storedOutputDraft?.proposalDocumentTitle ?? "");
  const [proposalDocumentMeta, setProposalDocumentMeta] =
    React.useState<string>(storedOutputDraft?.proposalDocumentMeta ?? "");
  const [fallbackInfo, setFallbackInfo] =
    React.useState<ProposalGenerationFallbackInfo | null>(null);
  const [generatedProposalId, setGeneratedProposalId] = React.useState<
    string | null
  >(storedOutputDraft?.generatedProposalId ?? null);
  const [proposalOutputMode, setProposalOutputMode] = React.useState<
    "preview" | "edit"
  >(storedOutputDraft?.proposalOutputMode ?? "preview");
  const [isSavingGeneratedProposal, setIsSavingGeneratedProposal] =
    React.useState(false);
  const [isSavingOutputToLibrary, setIsSavingOutputToLibrary] =
    React.useState(false);
  const [lastProposalRequest, setLastProposalRequest] =
    React.useState<FormValues | null>(null);
  const [isRegeneratingGeneratedProposal, setIsRegeneratingGeneratedProposal] =
    React.useState(false);
  const [isConfirmingGeneratedDelete, setIsConfirmingGeneratedDelete] =
    React.useState(false);
  const [isOutputFocused, setIsOutputFocused] = React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState<"idle" | "copied">(
    "idle",
  );
  const copyFeedbackTimeoutRef = React.useRef<number | null>(null);
  const lastSavedProposalContentRef = React.useRef<string | null>(
    storedOutputDraft?.proposalContent ?? null,
  );
  const lastSavedProposalTitleRef = React.useRef<string>(
    storedOutputDraft?.proposalDocumentTitle ?? "",
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
    (preset: FormValues["voicePreset"]) => {
      if (preset === "signature") return "Balanced";
      if (preset === "expert") return "Formal";
      if (preset === "engaging") return "Warm";
      return preset;
    },
    [],
  );

  const handleProposalStart = React.useCallback(
    (values: FormValues) => {
      setLastProposalRequest(values);
      setLoading(true);
      setProposalType(values.proposalType);
      setProposalVoicePreset(values.voicePreset);
      setProposalDocumentTitle(
        values.jobTitle.trim() || formatProposalTypeLabel(values.proposalType),
      );
      setProposalDocumentMeta(
        [
          formatProposalTypeLabel(values.proposalType),
          formatProposalToneLabel(values.voicePreset),
        ].join(" · "),
      );
      setProposalContent(null);
      setGeneratedProposalId(null);
      setProposalOutputMode("preview");
      setError(null);
      setErrorDetail(null);
      setFallbackInfo(null);
    },
    [formatProposalToneLabel, formatProposalTypeLabel],
  );

  const handleProposalSubmit = React.useCallback(
    (
      values: FormValues,
      proposal: string,
      nextFallbackInfo?: ProposalGenerationFallbackInfo,
      nextProposalId?: string,
    ) => {
      setLastProposalRequest(values);
      setProposalType(values.proposalType);
      setProposalVoicePreset(values.voicePreset);
      setProposalDocumentTitle(
        values.jobTitle.trim() || formatProposalTypeLabel(values.proposalType),
      );
      setProposalDocumentMeta(
        [
          formatProposalTypeLabel(values.proposalType),
          formatProposalToneLabel(values.voicePreset),
        ].join(" · "),
      );
      setProposalContent(proposal);
      setGeneratedProposalId(nextProposalId ?? null);
      setProposalOutputMode("preview");
      lastSavedProposalContentRef.current = proposal;
      lastSavedProposalTitleRef.current =
        values.jobTitle.trim() || formatProposalTypeLabel(values.proposalType);
      setIsConfirmingGeneratedDelete(false);
      setError(null);
      setFallbackInfo(nextFallbackInfo ?? null);
      setLoading(false);
    },
    [formatProposalToneLabel, formatProposalTypeLabel],
  );

  const handleProposalError = React.useCallback(
    (message: string, values: FormValues, rawReason?: string | null) => {
      setLastProposalRequest(values);
      setLoading(false);
      setProposalType(values.proposalType);
      setProposalVoicePreset(values.voicePreset);
      setProposalDocumentTitle(
        values.jobTitle.trim() || formatProposalTypeLabel(values.proposalType),
      );
      setProposalDocumentMeta(
        [
          formatProposalTypeLabel(values.proposalType),
          formatProposalToneLabel(values.voicePreset),
        ].join(" · "),
      );
      setProposalContent(null);
      setGeneratedProposalId(null);
      setProposalOutputMode("preview");
      setIsConfirmingGeneratedDelete(false);
      setError(message);
      setErrorDetail(rawReason ?? null);
      setFallbackInfo(null);
    },
    [formatProposalToneLabel, formatProposalTypeLabel],
  );

  const handleProposalContentChange = React.useCallback(
    (nextContent: string) => {
      setProposalContent(nextContent);
    },
    [],
  );

  const handleProposalDocumentCommit = React.useCallback(async () => {
    if (!generatedProposalId || isSavingGeneratedProposal) return;
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
    proposalContent,
    proposalDocumentTitle,
    proposalType,
    formatProposalTypeLabel,
    showToast,
    updateProposal,
  ]);

  React.useEffect(() => {
    return () => {
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
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

    if (!hasDraft) {
      window.localStorage.removeItem(PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY);
      return;
    }

    try {
      window.localStorage.setItem(
        PROPOSAL_OUTPUT_DRAFT_STORAGE_KEY,
        JSON.stringify({
          proposalContent,
          proposalType,
          proposalVoicePreset,
          proposalDocumentTitle,
          proposalDocumentMeta,
          generatedProposalId,
          proposalOutputMode,
        } satisfies StoredProposalOutputDraft),
      );
    } catch {
      // Ignore browser storage failures; keep in-memory output intact.
    }
  }, [
    generatedProposalId,
    proposalContent,
    proposalDocumentMeta,
    proposalDocumentTitle,
    proposalOutputMode,
    proposalType,
    proposalVoicePreset,
  ]);

  const updateProposalRoute = React.useCallback(
    (view: ProposalForgeView, nextProposalId: string | null = null) => {
      const params = new URLSearchParams(search);
      if (view === "saved") {
        params.set("view", "saved");
        params.delete("handoffId");
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
    if (!proposalContent) return;

    const displayedProposalText = getDisplayedProposalText(
      proposalContent,
      proposalType,
    );

    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(displayedProposalText);
      } else if (!fallbackCopyText(displayedProposalText)) {
        throw new Error("Clipboard unavailable");
      }

      setCopyFeedback("copied");
      if (copyFeedbackTimeoutRef.current !== null) {
        window.clearTimeout(copyFeedbackTimeoutRef.current);
      }
      copyFeedbackTimeoutRef.current = window.setTimeout(() => {
        setCopyFeedback("idle");
        copyFeedbackTimeoutRef.current = null;
      }, 2000);
      showToast("Proposal copied", { variant: "success" });
    } catch (copyError) {
      console.warn("Failed to copy proposal:", copyError);
      showToast("Copy failed", {
        variant: "error",
        description: "Clipboard access was unavailable.",
      });
    }
  }, [proposalContent, proposalType, showToast]);

  const handleRegenerateOutput = React.useCallback(async () => {
    if (!lastProposalRequest || isRegeneratingGeneratedProposal) {
      return;
    }

    const currentActiveCvSource = getActiveLocalPersonalizationSource();
    const hasCandidateContext = Boolean(
      currentActiveCvSource.personalizationContext,
    );

    try {
      setIsRegeneratingGeneratedProposal(true);
      setLoading(true);
      setError(null);
      setErrorDetail(null);
      setFallbackInfo(null);

      const result = await (
        generateProposalAction as unknown as (
          input: FormValues &
            ReturnType<typeof buildAppProposalPersonalizationPayload>,
        ) => Promise<GenerateProposalResult | null>
      )({
        ...lastProposalRequest,
        ...buildAppProposalPersonalizationPayload(currentActiveCvSource),
      });

      if (!result) {
        const nextErrorMessage = "No proposal returned from the server.";
        handleProposalError(nextErrorMessage, lastProposalRequest);
        return;
      }

      try {
        await updateProposal({
          id: result.proposalId,
          content: result.proposalContent,
          sections: [{ type: "text", content: result.proposalContent }],
          status: "draft",
        });
      } catch (saveErr) {
        console.warn("Failed to update regenerated proposal status:", saveErr);
      }

      handleProposalSubmit(
        lastProposalRequest,
        result.proposalContent,
        {
          requestedModelType: result.requestedModelType,
          actualModelType: result.actualModelType,
          fallbackTriggerCode: result.fallbackTriggerCode,
        },
        result.proposalId,
      );
      showToast("Proposal regenerated", { variant: "success" });
    } catch (regenerateError) {
      const nextErrorMessage = getProposalGenerationUiErrorMessage({
        error: regenerateError,
        proposalType: lastProposalRequest.proposalType,
        hasCandidateContext,
      });
      const rawReason =
        regenerateError instanceof Error ? regenerateError.message : null;
      handleProposalError(nextErrorMessage, lastProposalRequest, rawReason);
      showToast("Regeneration failed", {
        variant: "error",
        description: nextErrorMessage,
      });
    } finally {
      setLoading(false);
      setIsRegeneratingGeneratedProposal(false);
    }
  }, [
    generateProposalAction,
    handleProposalError,
    handleProposalSubmit,
    isRegeneratingGeneratedProposal,
    lastProposalRequest,
    showToast,
    updateProposal,
  ]);

  const handleDeleteOutput = React.useCallback(async () => {
    if (!generatedProposalId) return;

    try {
      await deleteProposal({ id: generatedProposalId });
      setProposalContent(null);
      setProposalType(null);
      setProposalVoicePreset(null);
      setProposalDocumentTitle("");
      setProposalDocumentMeta("");
      setGeneratedProposalId(null);
      setFallbackInfo(null);
      setError(null);
      setErrorDetail(null);
      setIsConfirmingGeneratedDelete(false);
      lastSavedProposalContentRef.current = null;
      showToast("Proposal deleted", { variant: "success" });
    } catch (deleteError) {
      console.error("Failed to delete proposal draft:", deleteError);
      showToast("Delete failed", {
        variant: "error",
        description: "The generated proposal could not be removed.",
      });
    }
  }, [deleteProposal, generatedProposalId, showToast]);

  const handleSaveOutputToLibrary = React.useCallback(async () => {
    if (
      !generatedProposalId ||
      !proposalContent ||
      isSavingOutputToLibrary ||
      isSavingGeneratedProposal
    ) {
      return;
    }

    const trimmed = proposalContent.trim();
    if (!trimmed) {
      return;
    }

    setIsSavingOutputToLibrary(true);
    try {
      await updateProposal({
        id: generatedProposalId,
        title:
          proposalDocumentTitle.trim() ||
          (proposalType
            ? formatProposalTypeLabel(proposalType)
            : "Generated proposal"),
        content: trimmed,
        sections: [{ type: "text", content: trimmed }],
        status: "saved",
      });
      lastSavedProposalContentRef.current = trimmed;
      lastSavedProposalTitleRef.current =
        proposalDocumentTitle.trim() ||
        (proposalType
          ? formatProposalTypeLabel(proposalType)
          : "Generated proposal");
      showToast("Saved to library", {
        variant: "success",
        description: "This proposal draft is now stored in Proposal Library.",
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
    generatedProposalId,
    isSavingGeneratedProposal,
    isSavingOutputToLibrary,
    proposalContent,
    proposalDocumentTitle,
    proposalType,
    formatProposalTypeLabel,
    showToast,
    updateProposal,
  ]);

  const activeView = requestedView;
  const isComposeView = activeView === "compose";
  const isSavedView = activeView === "saved";
  const isCompactComposeLayout = viewportWidth < 1240;
  const isNarrowLaptop = viewportWidth < 1360;
  const isComposeFocusLayout = isComposeView && isOutputFocused;
  const isLoadingHandoff =
    Boolean(handoffId) &&
    (isConvexAuthLoading ||
      (isConvexAuthenticated && handoffRecord === undefined));

  const stackedCardWidthStyle: React.CSSProperties = isCompactComposeLayout
    ? { width: "min(100%, 560px)", marginInline: "auto" }
    : { width: "100%" };
  const focusedOutputWidthStyle: React.CSSProperties = {
    width: "100%",
  };

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
            "--page-shell-max-width": isComposeFocusLayout
              ? "calc(100vw - (var(--space-6) * 2))"
              : isCompactComposeLayout
                ? "720px"
                : isNarrowLaptop
                  ? "1000px"
                  : "1200px",
            "--page-shell-gap": "var(--layout-page-stack)",
          } as React.CSSProperties
        }
      >
        {isComposeView ? (
          <section aria-hidden={false}>
            <div
              className="dasti-grid-split"
              style={
                {
                  "--grid-columns":
                    isCompactComposeLayout || isComposeFocusLayout
                      ? "minmax(0, 1fr)"
                      : "repeat(2, minmax(0, 560px))",
                  "--grid-gap": "var(--layout-card-grid)",
                  "--grid-align": "start",
                  "--grid-justify": "center",
                } as React.CSSProperties
              }
            >
              {!isComposeFocusLayout ? (
                <div className="dasti-flow">
                  <div style={stackedCardWidthStyle}>
                    {isLoadingHandoff ? (
                      <div style={{ paddingTop: "var(--s2)" }}>
                        <p className="dasti-hint">
                          Loading imported job offer…
                        </p>
                      </div>
                    ) : (
                      <ProposalInputForm
                        onStart={handleProposalStart}
                        onSubmit={handleProposalSubmit}
                        onError={handleProposalError}
                        prefill={prefill}
                      />
                    )}
                  </div>
                </div>
              ) : null}

              <div className="dasti-flow">
                <div
                  style={
                    isComposeFocusLayout
                      ? focusedOutputWidthStyle
                      : stackedCardWidthStyle
                  }
                >
                  <ProposalDisplay
                    proposalContent={proposalContent}
                    loading={loading}
                    error={error}
                    errorDetail={errorDetail}
                    proposalType={proposalType}
                    voicePreset={proposalVoicePreset}
                    fallbackInfo={fallbackInfo}
                    documentTitle={
                      proposalDocumentTitle || "Generated proposal"
                    }
                    documentMeta={proposalDocumentMeta || "Compose output"}
                    mode={proposalOutputMode}
                    onModeChange={setProposalOutputMode}
                    onPreviewInteract={() => setProposalOutputMode("edit")}
                    showModeToggle={false}
                    size={isComposeFocusLayout ? "focused" : "default"}
                    documentHeaderMode="actions-only"
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
                            title={
                              isOutputFocused
                                ? "Return to split view"
                                : "Focus the output"
                            }
                            className="dasti-icon-button"
                            onClick={() =>
                              setIsOutputFocused((value) => !value)
                            }
                          >
                            {isOutputFocused ? (
                              <CornersIn size={16} strokeWidth={1.7} />
                            ) : (
                              <ArrowsOutSimple size={16} strokeWidth={1.7} />
                            )}
                          </button>
                          <button
                            type="button"
                            title={
                              isSavingOutputToLibrary
                                ? "Saving…"
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
                          <button
                            type="button"
                            title={
                              isRegeneratingGeneratedProposal
                                ? "Regenerating…"
                                : "Regenerate"
                            }
                            className="dasti-icon-button"
                            style={{
                              opacity: isRegeneratingGeneratedProposal
                                ? 0.5
                                : 1,
                            }}
                            onClick={() => {
                              void handleRegenerateOutput();
                            }}
                            disabled={isRegeneratingGeneratedProposal}
                          >
                            <RotateCcw size={16} strokeWidth={1.5} />
                          </button>
                          <div className="dasti-icon-cluster__divider" />
                          {isConfirmingGeneratedDelete ? (
                            <button
                              type="button"
                              title="Confirm delete"
                              className="dasti-icon-button dasti-icon-button--confirm"
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
                              title="Delete"
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
                              title="Cancel delete"
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
        ) : null}

        {isSavedView ? (
          <section aria-hidden={false}>
            <ProposalsList
              selectedProposalId={selectedProposalId}
              onSelectedProposalIdChange={(id) =>
                updateProposalRoute("saved", id)
              }
            />
          </section>
        ) : null}
      </div>
    </div>
  );
}
