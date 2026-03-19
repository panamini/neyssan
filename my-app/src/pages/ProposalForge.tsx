import React from "react";
import { useConvexAuth, useQuery } from "convex/react";
import ProposalInputForm from "../components/ProposalInputForm";
import ProposalDisplay from "../components/ProposalDisplay";
import ProposalsList from "../components/ProposalsList";
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
  const handoffId = React.useMemo(
    () => new URLSearchParams(window.location.search).get("handoffId"),
    [],
  );
  const { isLoading: isConvexAuthLoading, isAuthenticated: isConvexAuthenticated } = useConvexAuth();
  const [proposalContent, setProposalContent] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [errorDetail, setErrorDetail] = React.useState<string | null>(null);
  const [proposalType, setProposalType] = React.useState<FormValues["proposalType"] | null>(null);
  const [fallbackInfo, setFallbackInfo] = React.useState<ProposalGenerationFallbackInfo | null>(null);
  const [activeView, setActiveView] = React.useState<ProposalForgeView>("compose");

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
    setProposalContent(null);
    setError(null);
    setErrorDetail(null);
    setFallbackInfo(null);
  }, []);

  const handleProposalSubmit = React.useCallback(
    (values: FormValues, proposal: string, nextFallbackInfo?: ProposalGenerationFallbackInfo) => {
      setProposalType(values.proposalType);
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
      setProposalContent(null);
      setError(message);
      setErrorDetail(rawReason ?? null);
      setFallbackInfo(null);
    },
    [],
  );

  const [hoveredTab, setHoveredTab] = React.useState<ProposalForgeView | null>(null);

  const isComposeView = activeView === "compose";
  const isSavedView = activeView === "saved";
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
    borderRadius: "var(--rm)",
    border: "1px solid var(--bo)",
    background: "var(--sfr)",
    boxShadow: "var(--sha)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const panelHeader: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "var(--s3) var(--s5)",
    background: "var(--sf2)",
    borderBottom: "1px solid var(--bo)",
    flexShrink: 0,
  };

  /* ── φ grid — §13 dasti-spec-v1 ──────────────────────────── */
  const phiGrid: React.CSSProperties = {
    display: "grid",
    gridTemplateColumns: "minmax(320px,1fr) minmax(0,1.618fr)",
    gap: "var(--s5)",
    alignItems: "start",
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", overflowX: "hidden", minWidth: 0 }}>
      <div style={{ padding: "var(--s8) var(--s7)", display: "flex", flexDirection: "column", gap: "var(--s5)" }}>

        {/* Tab toggle — underline style §13 */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--bo)" }}>
          <button
            type="button"
            style={tabStyle("compose")}
            onClick={() => setActiveView("compose")}
            onMouseEnter={() => setHoveredTab("compose")}
            onMouseLeave={() => setHoveredTab(null)}
          >
            Compose
          </button>
          <button
            type="button"
            style={tabStyle("saved")}
            onClick={() => setActiveView("saved")}
            onMouseEnter={() => setHoveredTab("saved")}
            onMouseLeave={() => setHoveredTab(null)}
          >
            Open
          </button>
        </div>

        {/* ── COMPOSE VIEW — φ grid ──────────────────────────── */}
        <section style={{ display: isComposeView ? "block" : "none" }} aria-hidden={!isComposeView}>
          <div style={phiGrid}>

            {/* Left panel — .cpn : form */}
            <div style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <div style={eyebrow}>Compose</div>
                  <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: "var(--tm)", fontWeight: 600, letterSpacing: "-.01em", color: "var(--ti)" }}>
                    New letter
                  </h2>
                </div>
              </div>
              <div style={{ flex: 1 }}>
                {isLoadingHandoff ? (
                  <div style={{ padding: "var(--s5)" }}>
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
            <div style={panelCard}>
              <div style={panelHeader}>
                <div>
                  <div style={eyebrow}>Output</div>
                  <h2 style={{ fontFamily: '"Fraunces", serif', fontSize: "var(--tm)", fontWeight: 600, letterSpacing: "-.01em", color: "var(--ti)" }}>
                    Generated
                  </h2>
                </div>
              </div>
              <div style={{ flex: 1, padding: "var(--s5)" }}>
                <ProposalDisplay
                  proposalContent={proposalContent}
                  loading={loading}
                  error={error}
                  errorDetail={errorDetail}
                  proposalType={proposalType}
                  fallbackInfo={fallbackInfo}
                />
              </div>
            </div>

          </div>
        </section>

        {/* ── LIBRARY VIEW — .plib grid (260px 1fr) ──────────── */}
        <section style={{ display: isSavedView ? "block" : "none" }} aria-hidden={!isSavedView}>
          <ProposalsList />
        </section>

      </div>
    </div>
  );
}
