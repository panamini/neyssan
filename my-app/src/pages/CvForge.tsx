import React from "react";
import { CvLibraryProvider } from "../contexts/CvLibraryContext";
import { Sidebar } from "../components/Sidebar";
import { ProfileReviewCard } from "../components/ProfileReviewCard";
import { CvToolbar } from "../components/header/CvToolbar";

/**
 * CvForge — page Resume
 *
 * Layout : sidebar dasti (248px/52px) + main scrollable flex-1.
 * Intro panel .ip : eyebrow + h2 Fraunces + description (§13 dasti-spec-v1).
 * CvLibraryProvider scoped à cette page uniquement.
 */
export function CvForge(): JSX.Element {
  return (
    <CvLibraryProvider>
      {/* Flex row, h:100% — occupe tout l'espace sous la topbar */}
      <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>
        <Sidebar />

        {/* Main area — scrollable */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            overflowX: "hidden",
            minWidth: 0,
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

            {/* Workspace Toolbar */}
            <CvToolbar />

            {/* Main editor / review canvas */}
            <ProfileReviewCard />
          </div>
        </div>
      </div>
    </CvLibraryProvider>
  );
}
