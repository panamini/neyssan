import React from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useConvexAuth, useQuery } from "convex/react";
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
  const [proposalContent, setProposalContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorDetail, setErrorDetail] = React.useState<string | null>(null);
  const [proposalType, setProposalType] = React.useState<FormValues["proposalType"] | null>(null);
  const [proposalVoicePreset, setProposalVoicePreset] = React.useState<FormValues["voicePreset"] | null>(null);
  const [fallbackInfo, setFallbackInfo] = React.useState<ProposalGenerationFallbackInfo | null>(null);
  const [copyFeedback, setCopyFeedback] = React.useState<"idle" | "copied">("idle");
  const copyFeedbackTimeoutRef = React.useRef<number | null>(null);

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

  const handleProposalStart = React.useCallback((values: FormValues) => {
    setLoading(true);
    setProposalType(values.proposalType);
    setProposalVoicePreset(values.voicePreset);
    setProposalContent(null);
    setError(null);
    setErrorDetail(null);
    setFallbackInfo(null);
  }, []);

  const handleProposalSubmit = React.useCallback(
    (values: FormValues, proposal: string, nextFallbackInfo?: ProposalGenerationFallbackInfo) => {
      setProposalType(values.proposalType);
      setProposalVoicePreset(values.voicePreset);
      setProposalContent(proposal);
      setError(null);
      setFallbackInfo(nextFallbackInfo ?? null);
      setLoading(false);
    },
    [],
  );

  const handleProposalError = React.useCallback(
    (message: string, values: FormValues, rawReason?: string | null) => {
      setLoading(false);
      setProposalType(values.proposalType);
      setProposalVoicePreset(values.voicePreset);
      setProposalContent(null);
      setError(message);
      setErrorDetail(rawReason ?? null);
      setFallbackInfo(null);
    },
    [],
  );

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

  const [hoveredTab, setHoveredTab] = React.useState<ProposalForgeView | null>(null);

  const activeView = requestedView;
  const isComposeView = activeView === "compose";
  const isSavedView = activeView === "saved";
  const isCompactComposeLayout = viewportWidth < 1180;
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

  /* ── Shared styles ───────────────────────────────────────── */
  const eyebrow: React.CSSProperties = {
    fontSize: "var(--tx)",
    fontWeight: 600,
    color: "var(--am)",
    letterSpacing: ".14em",
    textTransform: "uppercase",
    marginBottom: "var(--s2)",
  };

  const panelCard: React.CSSProperties = {
    padding: "var(--s5)",
    gap: "var(--space-card-grid)",
  };

  const panelHeader: React.CSSProperties = {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "var(--s3)",
  };

  const panelTitle: React.CSSProperties = {
    fontFamily: '"Fraunces", serif',
    fontSize: "var(--tx2)",
    fontWeight: 600,
    letterSpacing: "-.01em",
    color: "var(--ti)",
  };

  const panelMeta: React.CSSProperties = {
    fontSize: "var(--tx)",
    color: "var(--tg2)",
    marginTop: "var(--s1)",
    lineHeight: 1.5,
  };

  /* ── φ grid — §13 dasti-spec-v1 ──────────────────────────── */
  const phiGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: isCompactComposeLayout
      ? "minmax(0,1fr)"
      : "1fr 1fr",
    gap: "var(--space-split-gap)",
    alignItems: "start",
  };

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
              <div className="dasti-surface-panel dasti-surface-panel--spacious" style={panelCard}>
                <div style={panelHeader}>
                  <div style={eyebrow}>Job Offer</div>
                </div>
                <div>
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
              <div className="dasti-surface-panel dasti-surface-panel--spacious" style={panelCard}>
                <div style={panelHeader}>
                  <div style={eyebrow}>Draft</div>
                </div>
                <div>
                  <ProposalDisplay
                    proposalContent={proposalContent}
                    loading={loading}
                    error={error}
                    errorDetail={errorDetail}
                    proposalType={proposalType}
                    voicePreset={proposalVoicePreset}
                    fallbackInfo={fallbackInfo}
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
