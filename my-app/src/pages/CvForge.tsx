import React from "react";
import { ProfileReviewCard } from "../components/ProfileReviewCard";

/**
 * CvForge — page Resume
 *
 * CvLibraryProvider et Sidebar sont montés au niveau App.tsx.
 * Cette page rend uniquement le contenu scrollable.
 * Intro panel .ip : eyebrow + h2 Fraunces + description (§13 dasti-spec-v1).
 */
export function CvForge(): JSX.Element {
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
            Resume workspace
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
            Resume
          </h2>
          <p style={{ fontSize: "var(--ts)", color: "var(--tm2)", lineHeight: "var(--ls)" }}>
            Sélectionnez un CV dans la barre latérale, importez ou éditez les sections ci-dessous.
          </p>
        </div>

        {/* Main editor / review canvas (toolbar intégrée dans ProfileReviewCard) */}
        <ProfileReviewCard />
      </div>
    </div>
  );
}
