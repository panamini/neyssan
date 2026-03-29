import React from "react";
import { useLocation } from "react-router-dom";
import { Eye, Pencil } from "@/lib/icons";
import { ProfileReviewCard } from "../components/ProfileReviewCard";
import { VerbatiCvPreviewPanel } from "../features/verbati/VerbatiCvPreviewPanel";

type CvForgeWorkspaceMode = "edit" | "preview";

const CV_FORGE_WORKSPACE_MODE_STORAGE_KEY = "dasti:cv-forge-workspace-mode:v1";

function readStoredCvForgeWorkspaceMode(): CvForgeWorkspaceMode {
  if (typeof window === "undefined") {
    return "edit";
  }

  return window.localStorage.getItem(CV_FORGE_WORKSPACE_MODE_STORAGE_KEY) ===
    "preview"
    ? "preview"
    : "edit";
}

/**
 * CvForge — page Resume
 *
 * CvLibraryProvider et Sidebar sont montés au niveau App.tsx.
 * Cette page rend uniquement le contenu scrollable.
 * Intro panel .ip : eyebrow + h2 Fraunces + description (§13 dasti-spec-v1).
 */
export function CvForge(): JSX.Element {
  const { search } = useLocation();
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [workspaceMode, setWorkspaceMode] =
    React.useState<CvForgeWorkspaceMode>(() => readStoredCvForgeWorkspaceMode());
  const requestedCvId = React.useMemo(
    () => new URLSearchParams(search).get("id") || undefined,
    [search],
  );
  const isSplitCanvas = viewportWidth >= 1240;

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleResize = () => {
      setViewportWidth(window.innerWidth);
    };

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    window.localStorage.setItem(
      CV_FORGE_WORKSPACE_MODE_STORAGE_KEY,
      workspaceMode,
    );
  }, [workspaceMode]);

  const workspaceModeToggle = (
    <button
      type="button"
      className="dasti-icon-button dasti-proposal-mode-toggle"
      aria-label={
        workspaceMode === "preview"
          ? "Return to resume editing"
          : "Open resume preview"
      }
      title={
        workspaceMode === "preview"
          ? "Return to resume editing"
          : "Open resume preview"
      }
      onClick={() =>
        setWorkspaceMode((current) =>
          current === "preview" ? "edit" : "preview",
        )
      }
    >
      {workspaceMode === "preview" ? (
        <Pencil size={15} strokeWidth={1.7} aria-hidden="true" />
      ) : (
        <Eye size={15} strokeWidth={1.7} aria-hidden="true" />
      )}
    </button>
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
            "--page-shell-max-width":
              workspaceMode === "preview"
                ? "1480px"
                : isSplitCanvas
                  ? "1240px"
                  : "var(--cv-editor-shell-max-width)",
            "--page-shell-gap": "var(--layout-panel-stack)",
            "--page-shell-pad-inline-mobile": "var(--space-3)",
          } as React.CSSProperties
        }
      >
        {workspaceMode === "edit" ? (
          <div className="dasti-cv-workbench-bar">
            <div className="dasti-proposal-rail-cluster" data-no-pan="true">
              {workspaceModeToggle}
            </div>
          </div>
        ) : null}

        {workspaceMode === "preview" ? (
          <VerbatiCvPreviewPanel
            layoutMode="stacked"
            hostMode="workspace"
            railLeadControl={workspaceModeToggle}
          />
        ) : (
          <div
            className="dasti-grid-split"
            style={
              {
                "--grid-columns": isSplitCanvas
                  ? "minmax(0, 1fr) clamp(360px, 34vw, 420px)"
                  : "minmax(0, 1fr)",
                "--grid-gap": "var(--layout-card-grid)",
                "--grid-align": "start",
              } as React.CSSProperties
            }
          >
            <ProfileReviewCard cvId={requestedCvId} />
            <VerbatiCvPreviewPanel
              layoutMode={isSplitCanvas ? "rail" : "stacked"}
              hostMode="panel"
            />
          </div>
        )}
      </div>
    </div>
  );
}
