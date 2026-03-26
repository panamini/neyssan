import React from "react";
import { useLocation } from "react-router-dom";
import { ProfileReviewCard } from "../components/ProfileReviewCard";
import { VerbatiCvPreviewPanel } from "../features/verbati/VerbatiCvPreviewPanel";

/**
 * CvForge — page Resume
 *
 * CvLibraryProvider et Sidebar sont montés au niveau App.tsx.
 * Cette page rend uniquement le contenu scrollable.
 * Intro panel .ip : eyebrow + h2 Fraunces + description (§13 dasti-spec-v1).
 */
export function CvForge(): JSX.Element {
  const { search } = useLocation();
  const requestedCvId = React.useMemo(
    () => new URLSearchParams(search).get("id") || undefined,
    [search],
  );

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
            "--page-shell-max-width": "var(--cv-editor-shell-max-width)",
            "--page-shell-gap": "var(--layout-panel-stack)",
            "--page-shell-pad-inline-mobile": "var(--space-3)",
          } as React.CSSProperties
        }
      >
        {/* Main editor / review canvas (toolbar intégrée dans ProfileReviewCard) */}
        <ProfileReviewCard cvId={requestedCvId} />
        <VerbatiCvPreviewPanel />
      </div>
    </div>
  );
}
