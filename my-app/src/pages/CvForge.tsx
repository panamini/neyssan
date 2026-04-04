import React from "react";
import { useLocation } from "react-router-dom";
import { Eye, FilePdf, X } from "@/lib/icons";
import { ProfileReviewCard } from "../components/ProfileReviewCard";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { VerbatiCvPreviewPanel } from "../features/verbati/VerbatiCvPreviewPanel";
import { useBoundVerbatiCvStyle } from "../features/verbati/useBoundVerbatiCvStyle";
import { printFirstMatchingNodeAsPdf } from "../lib/document-export";

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
  const { currentCv, importCv } = useCvLibrary();
  const cvPreviewExportRef = React.useRef<HTMLDivElement | null>(null);
  const [viewportWidth, setViewportWidth] = React.useState(() =>
    typeof window === "undefined" ? 1440 : window.innerWidth,
  );
  const [workspaceMode, setWorkspaceMode] =
    React.useState<CvForgeWorkspaceMode>(() =>
      readStoredCvForgeWorkspaceMode(),
    );
  const { stylePreset, setStylePreset } = useBoundVerbatiCvStyle({
    currentCv,
    importCv,
    debounceMs: 700,
    logPrefix: "[CvForge]",
  });
  const requestedCvId = React.useMemo(
    () => new URLSearchParams(search).get("id") || undefined,
    [search],
  );
  const isSplitCanvas = viewportWidth >= 1240;
  const editorGridMaxWidth =
    workspaceMode === "edit"
      ? "100%"
      : isSplitCanvas
        ? "1240px"
        : "var(--cv-editor-shell-max-width)";

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

  const editModeToggle = (
    <button
      type="button"
      className="dasti-icon-button"
      aria-label="Open resume preview"
      onClick={() => setWorkspaceMode("preview")}
      data-toolbar-tooltip="Switch to preview"
      data-no-pan="true"
    >
      <Eye size={15} strokeWidth={1.7} aria-hidden="true" />
    </button>
  );

  const previewModeLeadControl = (
    <button
      type="button"
      className="dasti-cv-workbench-toggle__button"
      aria-label="Back to resume editing"
      onClick={() => setWorkspaceMode("edit")}
      data-toolbar-tooltip="Back to edit"
      data-no-pan="true"
    >
      <X size={15} strokeWidth={1.9} aria-hidden="true" />
    </button>
  );
  const previewModePdfControl = (
    <button
      type="button"
      className="dasti-icon-button"
      aria-label="Export CV as PDF"
      onClick={() => {
        printFirstMatchingNodeAsPdf({
          container: cvPreviewExportRef.current,
          selectors: [".resume-page-frame", ".resume-page-stage"],
          title: currentCv?.title || "Resume",
        });
      }}
      data-toolbar-tooltip="Export PDF"
      data-no-pan="true"
    >
      <FilePdf size={15} strokeWidth={1.7} aria-hidden="true" />
    </button>
  );
  const cvWorkbenchShellStyle: React.CSSProperties = {
    width: "100%",
    maxWidth: editorGridMaxWidth,
    marginInline: "auto",
  };

  return (
    <div
      className="dasti-page-scroll"
      style={{
        minWidth: 0,
      }}
    >
      <div
        className="dasti-page-shell dasti-page-shell--cv-forge"
        style={
          {
            "--page-shell-max-width": "100%",
            "--page-shell-gap": "var(--space-2)",
            "--page-shell-pad-top":
              workspaceMode === "preview" ? "0px" : "var(--space-2)",
            "--page-shell-pad-inline":
              workspaceMode === "preview" ? "0px" : "var(--space-4)",
            "--page-shell-pad-bottom": "var(--space-1)",
            "--cv-preview-toolbar-inset":
              workspaceMode === "preview" ? "var(--space-2)" : undefined,
            "--page-shell-pad-top-mobile":
              workspaceMode === "preview"
                ? "0px"
                : "var(--space-2)",
            "--page-shell-pad-inline-mobile":
              workspaceMode === "preview" ? "0px" : "var(--space-4)",
            "--page-shell-pad-bottom-mobile": "var(--space-1)",
          } as React.CSSProperties
        }
      >
        {workspaceMode === "preview" ? (
          <>
            <div className="dasti-cv-preview-workbench">
              <div
                className="dasti-cv-preview-workbench__main"
                ref={cvPreviewExportRef}
              >
                <VerbatiCvPreviewPanel
                  layoutMode="stacked"
                  hostMode="workspace"
                  railLeadControl={previewModeLeadControl}
                  railTrailingControl={previewModePdfControl}
                  stylePreset={stylePreset}
                  onStylePresetChange={setStylePreset}
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div
              className="dasti-cv-edit-workbench-shell"
              style={cvWorkbenchShellStyle}
            >
              <div
                className="dasti-grid-split"
                style={
                  {
                    "--grid-columns": isSplitCanvas
                      ? "minmax(0, 1fr) clamp(392px, 36vw, 468px)"
                      : "minmax(0, 1fr)",
                    "--grid-gap": "var(--layout-card-grid)",
                    "--grid-align": "start",
                  } as React.CSSProperties
                }
              >
                <ProfileReviewCard
                  cvId={requestedCvId}
                  toolbarLeadControl={editModeToggle}
                  onRequestExport={() => {
                    printFirstMatchingNodeAsPdf({
                      container: cvPreviewExportRef.current,
                      selectors: [".resume-page-frame", ".resume-page-stage"],
                      title: currentCv?.title || "Resume",
                    });
                  }}
                />
                <div
                  className={
                    isSplitCanvas
                      ? "dasti-cv-preview-panel-slot dasti-cv-preview-panel-slot--sticky"
                      : "dasti-cv-preview-panel-slot"
                  }
                  ref={cvPreviewExportRef}
                >
                  <VerbatiCvPreviewPanel
                    layoutMode={isSplitCanvas ? "rail" : "stacked"}
                    hostMode="panel"
                    stylePreset={stylePreset}
                    onStylePresetChange={setStylePreset}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
