import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { Pencil } from "lucide-react";
import ProposalInputForm from "../components/ProposalInputForm";
import ProposalDisplay, { fallbackCopyText, getDisplayedProposalText } from "../components/ProposalDisplay";
import ProposalsList from "../components/ProposalsList";
import { useToast } from "../components/ui/toast";
import type { FormValues } from "../components/ProposalInputForm.schemas";
import { api } from "../../convex/_generated/api";
import type { ProposalGenerationFallbackInfo } from "../lib/proposal-generation-ui";

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
        typeof parsed.proposalContent === "string" ? parsed.proposalContent : null,
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
      proposalOutputMode: parsed.proposalOutputMode === "edit" ? "edit" : "preview",
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
  const storedOutputDraft = React.useMemo(() => readStoredProposalOutputDraft(), []);
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
  const { isLoading: isConvexAuthLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const updateProposal = useMutation((api as any).updateProposalPublic?.default);
  const [proposalContent, setProposalContent] = React.useState<string | null>(
    storedOutputDraft?.proposalContent ?? null,
  );
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorDetail, setErrorDetail] = React.useState<string | null>(null);
  const [proposalType, setProposalType] = React.useState<FormValues["proposalType"] | null>(
    storedOutputDraft?.proposalType ?? null,
  );
  const [proposalVoicePreset, setProposalVoicePreset] = React.useState<FormValues["voicePreset"] | null>(
    storedOutputDraft?.proposalVoicePreset ?? null,
  );
  const [proposalDocumentTitle, setProposalDocumentTitle] = React.useState<string>(
    storedOutputDraft?.proposalDocumentTitle ?? "",
  );
  const [proposalDocumentMeta, setProposalDocumentMeta] = React.useState<string>(
    storedOutputDraft?.proposalDocumentMeta ?? "",
  );
  const [fallbackInfo, setFallbackInfo] = React.useState<ProposalGenerationFallbackInfo | null>(null);
  const [generatedProposalId, setGeneratedProposalId] = React.useState<string | null>(
    storedOutputDraft?.generatedProposalId ?? null,
  );
  const [proposalOutputMode, setProposalOutputMode] = React.useState<"preview" | "edit">(
    storedOutputDraft?.proposalOutputMode ?? "preview",
  );
  const [isSavingGeneratedProposal, setIsSavingGeneratedProposal] = React.useState(false);
  const [copyFeedback, setCopyFeedback] = React.useState<"idle" | "copied">("idle");
  const copyFeedbackTimeoutRef = React.useRef<number | null>(null);
  const previewHintToastRef = React.useRef(0);
  const lastSavedProposalContentRef = React.useRef<string | null>(
    storedOutputDraft?.proposalContent ?? null,
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

  const formatProposalTypeLabel = React.useCallback((type: FormValues["proposalType"]) => {
    if (type === "cover_letter") return "Letter";
    if (type === "application_message") return "Message";
    return "Proposal";
  }, []);

  const formatProposalToneLabel = React.useCallback((preset: FormValues["voicePreset"]) => {
    if (preset === "signature") return "Balanced";
    if (preset === "expert") return "Formal";
    if (preset === "engaging") return "Warm";
    return preset;
  }, []);

  const handleProposalStart = React.useCallback((values: FormValues) => {
    setLoading(true);
    setProposalType(values.proposalType);
    setProposalVoicePreset(values.voicePreset);
    setProposalDocumentTitle(values.jobTitle.trim() || formatProposalTypeLabel(values.proposalType));
    setProposalDocumentMeta([formatProposalTypeLabel(values.proposalType), formatProposalToneLabel(values.voicePreset)].join(" · "));
    setProposalContent(null);
    setGeneratedProposalId(null);
    setProposalOutputMode("preview");
    setError(null);
    setErrorDetail(null);
    setFallbackInfo(null);
  }, [formatProposalToneLabel, formatProposalTypeLabel]);

  const handleProposalSubmit = React.useCallback(
    (
      values: FormValues,
      proposal: string,
      nextFallbackInfo?: ProposalGenerationFallbackInfo,
      nextProposalId?: string,
    ) => {
      setProposalType(values.proposalType);
      setProposalVoicePreset(values.voicePreset);
      setProposalDocumentTitle(values.jobTitle.trim() || formatProposalTypeLabel(values.proposalType));
      setProposalDocumentMeta([formatProposalTypeLabel(values.proposalType), formatProposalToneLabel(values.voicePreset)].join(" · "));
      setProposalContent(proposal);
      setGeneratedProposalId(nextProposalId ?? null);
      setProposalOutputMode("preview");
      lastSavedProposalContentRef.current = proposal;
      setError(null);
      setFallbackInfo(nextFallbackInfo ?? null);
      setLoading(false);
    },
    [formatProposalToneLabel, formatProposalTypeLabel],
  );

  const handleProposalError = React.useCallback(
    (message: string, values: FormValues, rawReason?: string | null) => {
      setLoading(false);
      setProposalType(values.proposalType);
      setProposalVoicePreset(values.voicePreset);
      setProposalDocumentTitle(values.jobTitle.trim() || formatProposalTypeLabel(values.proposalType));
      setProposalDocumentMeta([formatProposalTypeLabel(values.proposalType), formatProposalToneLabel(values.voicePreset)].join(" · "));
      setProposalContent(null);
      setGeneratedProposalId(null);
      setProposalOutputMode("preview");
      setError(message);
      setErrorDetail(rawReason ?? null);
      setFallbackInfo(null);
    },
    [formatProposalToneLabel, formatProposalTypeLabel],
  );

  const handleProposalContentChange = React.useCallback((nextContent: string) => {
    setProposalContent(nextContent);
  }, []);

  const handleProposalContentCommit = React.useCallback(async () => {
    if (!generatedProposalId || !proposalContent || isSavingGeneratedProposal) return;
    const trimmed = proposalContent.trim();
    const lastSavedTrimmed = lastSavedProposalContentRef.current?.trim() ?? "";
    if (!trimmed || trimmed === lastSavedTrimmed) return;

    setIsSavingGeneratedProposal(true);
    try {
      await updateProposal({
        id: generatedProposalId,
        content: trimmed,
        sections: [{ type: "text", content: trimmed }],
      });
      lastSavedProposalContentRef.current = trimmed;
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
        description: "The proposal text changed locally but could not be saved.",
      });
    } finally {
      setIsSavingGeneratedProposal(false);
    }
  }, [generatedProposalId, isSavingGeneratedProposal, proposalContent, showToast, updateProposal]);

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

    const displayedProposalText = getDisplayedProposalText(proposalContent, proposalType);

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

  const handlePreviewInteract = React.useCallback(() => {
    const now = Date.now();
    if (now - previewHintToastRef.current < 1600) return;
    previewHintToastRef.current = now;
    showToast("Preview mode", {
      variant: "info",
      description: "Click the pen to edit this proposal.",
      icon: <Pencil size={16} strokeWidth={1.7} />,
      duration: 2200,
    });
  }, [showToast]);

  const [hoveredTab, setHoveredTab] = React.useState<ProposalForgeView | null>(null);

  const activeView = requestedView;
  const isComposeView = activeView === "compose";
  const isSavedView = activeView === "saved";
  const isCompactComposeLayout = viewportWidth < 1240;
  const isNarrowLaptop = viewportWidth < 1360;
  const isLoadingHandoff =
    Boolean(handoffId) &&
    (isConvexAuthLoading || (isConvexAuthenticated && handoffRecord === undefined));

  /* ── Tab underline style — §13 dasti-spec-v1 ─────────────── */
  const tabStyle = (view: ProposalForgeView): React.CSSProperties => {
    const isActive = activeView === view;
    const isHovered = !isActive && hoveredTab === view;
    return {
      display: "inline-flex",
      alignItems: "center",
      height: "var(--hs)",
      padding: "0 var(--s3)",
      borderRadius: "var(--rs) var(--rs) 0 0",
      border: "none",
      borderBottom: `2px solid ${isActive ? "var(--ac)" : "transparent"}`,
      marginBottom: -1,
      background: isHovered ? "var(--sf2)" : "transparent",
      fontSize: "var(--ts)",
      fontWeight: isActive ? 600 : 500,
      color: isActive ? "var(--ti)" : "var(--tm2)",
      cursor: "pointer",
      transition: "all .12s var(--ez)",
      fontFamily: "inherit",
      outline: "none",
    };
  };

  /* ── φ grid — §13 dasti-spec-v1 ──────────────────────────── */
  const phiGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isCompactComposeLayout
      ? "minmax(0,1fr)"
      : "repeat(2, minmax(0, 560px))",
    gap: "var(--space-card-grid)",
    alignItems: "start",
    justifyContent: "center",
  };
  const stackedCardWidthStyle: React.CSSProperties = isCompactComposeLayout
    ? { width: "min(100%, 560px)", marginInline: "auto" }
    : { width: "100%" };

  return (
    <div
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehaviorY: "contain",
        background: "var(--bg)",
        minWidth: 0,
      }}
    >
      <div
        style={{
          padding: isCompactComposeLayout ? "var(--s6) var(--s4)" : "var(--space-page-pad)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-page-stack)",
          maxWidth: isCompactComposeLayout ? 720 : isNarrowLaptop ? 1000 : 1200,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Tab toggle — underline style §13 */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--bo)" }}>
          <button
            type="button"
            style={tabStyle("compose")}
            onClick={() => updateProposalRoute("compose")}
            onMouseEnter={() => setHoveredTab("compose")}
            onMouseLeave={() => setHoveredTab(null)}
          >
            Compose
          </button>
          <button
            type="button"
            style={tabStyle("saved")}
            onClick={() => updateProposalRoute("saved", selectedProposalId)}
            onMouseEnter={() => setHoveredTab("saved")}
            onMouseLeave={() => setHoveredTab(null)}
          >
            Saved
          </button>
        </div>

        {/* ── COMPOSE VIEW — φ grid ──────────────────────────── */}
        {isComposeView ? (
          <section aria-hidden={false}>
            <div style={phiGrid}>

              {/* Left panel — .cpn : form */}
              <div style={{ display: "grid", minWidth: 0 }}>
                <div style={stackedCardWidthStyle}>
                  {isLoadingHandoff ? (
                    <div style={{ paddingTop: "var(--s2)" }}>
                      <p style={{ fontSize: "var(--ts)", color: "var(--tm2)" }}>Loading imported job offer…</p>
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

              {/* Right panel — .opn : output */}
              <div style={{ display: "grid", minWidth: 0 }}>
                <div style={stackedCardWidthStyle}>
                  <ProposalDisplay
                    proposalContent={proposalContent}
                    loading={loading}
                    error={error}
                    errorDetail={errorDetail}
                    proposalType={proposalType}
                    voicePreset={proposalVoicePreset}
                    documentTitle={proposalDocumentTitle}
                    documentMeta={proposalDocumentMeta}
                    fallbackInfo={fallbackInfo}
                    mode={proposalOutputMode}
                    onModeChange={setProposalOutputMode}
                    onPreviewInteract={handlePreviewInteract}
                    onContentChange={handleProposalContentChange}
                    onContentCommit={() => {
                      void handleProposalContentCommit();
                    }}
                    onCopy={
                      proposalContent && !loading && !error
                        ? () => {
                            void handleCopyOutput();
                          }
                        : undefined
                    }
                    copyFeedback={copyFeedback}
                  />
                </div>
              </div>
            </div>
          </section>
        ) : null}

        {/* ── LIBRARY VIEW — .plib grid (260px 1fr) ──────────── */}
        {isSavedView ? (
          <section aria-hidden={false}>
            <ProposalsList
              selectedProposalId={selectedProposalId}
              onSelectedProposalIdChange={(id) => updateProposalRoute("saved", id)}
            />
          </section>
        ) : null}

      </div>
    </div>
  );
}
