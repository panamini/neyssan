import React from "react";
import { useLocation } from "react-router-dom";
import { ProfileReviewCard } from "../components/ProfileReviewCard";

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
      style={{
        height: "100%",
        overflowY: "auto",
        overflowX: "hidden",
        overscrollBehaviorY: "contain",
        background: "var(--bg)",
      }}
    >
      <div
        style={{
          padding: "var(--space-page-pad)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--space-panel-stack)",
          maxWidth: 960,
          margin: "0 auto",
          width: "100%",
        }}
      >
        {/* Main editor / review canvas (toolbar intégrée dans ProfileReviewCard) */}
        <ProfileReviewCard cvId={requestedCvId} />
      </div>
    </div>
  );
}
