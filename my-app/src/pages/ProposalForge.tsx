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
    (message: string, values: FormValues) => {
      setLoading(false);
      setProposalType(values.proposalType);
      setProposalContent(null);
      setError(message);
      setFallbackInfo(null);
    },
    [],
  );

  const isComposeView = activeView === "compose";
  const isSavedView = activeView === "saved";
  const isLoadingHandoff =
    Boolean(handoffId) &&
    (isConvexAuthLoading || (isConvexAuthenticated && handoffRecord === undefined));

  /* ── Tab underline style — §13 dasti-spec-v1 ─────────────── */
  const tabBase: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    height: "var(--hs)",
    padding: "0 var(--s3)",
    borderRadius: "var(--rs) var(--rs) 0 0",
    border: "none",
    borderBottom: "2px solid transparent",
    marginBottom: -1,
    background: "transparent",
    fontSize: "var(--ts)",
    fontWeight: 500,
    cursor: "pointer",
    transition: "all .12s var(--ez)",
    fontFamily: "inherit",
  };

  const tabActive: React.CSSProperties = {
    ...tabBase,
    color: "var(--ti)",
    fontWeight: 600,
    borderBottomColor: "var(--ac)",
  };

  const tabInactive: React.CSSProperties = {
    ...tabBase,
    color: "var(--tm2)",
  };

  return (
    /* Full-height scrollable — cohérent avec CvForge */
    <div style={{ height: "100%", overflowY: "auto", overflowX: "hidden", minWidth: 0 }}>
      <div
        style={{
          padding: "var(--s8) var(--s7)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s5)",
          maxWidth: 960,
        }}
      >
        {/* Intro panel — §13 dasti-spec-v1 */}
        <div
          style={{
            padding: "var(--s5)",
            borderRadius: "var(--rm)",
            border: "1px solid var(--bo)",
            background: "var(--sfr)",
            boxShadow: "var(--sha)",
          }}
        >
          <div
            style={{
              fontSize: "var(--tx)",
              fontWeight: 600,
              color: "var(--am)",
              letterSpacing: ".14em",
              textTransform: "uppercase",
              marginBottom: "var(--s2)",
            }}
          >
            Write
          </div>
          <h2
            style={{
              fontFamily: '"Fraunces", serif',
              fontSize: "var(--tx2)",
              fontWeight: 600,
              letterSpacing: "-.01em",
              color: "var(--ti)",
              marginBottom: "var(--s2)",
            }}
          >
            Write
          </h2>
          <p style={{ fontSize: "var(--ts)", color: "var(--tm2)", lineHeight: "var(--ls)" }}>
            Rédigez et gérez vos lettres. Cliquez sur un document dans la barre latérale pour l'ouvrir.
          </p>
        </div>

        {/* Tab toggle — underline style §13 */}
        <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--bo)" }}>
          <button
            type="button"
            style={isComposeView ? tabActive : tabInactive}
            onClick={() => setActiveView("compose")}
            onMouseEnter={(e) => {
              if (!isComposeView) (e.currentTarget as HTMLButtonElement).style.background = "var(--sf2)";
            }}
            onMouseLeave={(e) => {
              if (!isComposeView) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            Compose
          </button>
          <button
            type="button"
            style={isSavedView ? tabActive : tabInactive}
            onClick={() => setActiveView("saved")}
            onMouseEnter={(e) => {
              if (!isSavedView) (e.currentTarget as HTMLButtonElement).style.background = "var(--sf2)";
            }}
            onMouseLeave={(e) => {
              if (!isSavedView) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
            }}
          >
            Open
          </button>
        </div>

        {/* Compose view */}
        <section
          style={{ display: isComposeView ? "flex" : "none", flexDirection: "column", gap: "var(--s4)" }}
          aria-hidden={!isComposeView}
        >
          <ProposalDisplay
            proposalContent={proposalContent}
            loading={loading}
            error={error}
            proposalType={proposalType}
            fallbackInfo={fallbackInfo}
          />

          {isLoadingHandoff ? (
            <div
              style={{
                padding: "var(--s5)",
                borderRadius: "var(--rm)",
                border: "1px solid var(--bo)",
                background: "var(--sfr)",
                boxShadow: "var(--sha)",
              }}
            >
              <p style={{ fontSize: "var(--ts)", color: "var(--tm2)" }}>
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
        </section>

        {/* Open / Saved view */}
        <section
          style={{ display: isSavedView ? "flex" : "none", flexDirection: "column", gap: "var(--s4)" }}
          aria-hidden={!isSavedView}
        >
          <div
            style={{
              padding: "var(--s5)",
              borderRadius: "var(--rm)",
              border: "1px solid var(--bo)",
              background: "var(--sfr)",
              boxShadow: "var(--sha)",
            }}
          >
            <p style={{ fontSize: "var(--ts)", color: "var(--tm2)" }}>
              Browse saved proposals without leaving Proposal Forge.
            </p>
          </div>
          <ProposalsList />
        </section>
      </div>
    </div>
  );
}
