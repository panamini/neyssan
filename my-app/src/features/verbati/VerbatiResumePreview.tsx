import React from "react";
import {
  CornersIn,
  Minus,
  Plus,
} from "@/lib/icons";
import { useDocumentPan } from "../../hooks/use-document-pan";
import { useDocumentStageLayout } from "../../hooks/use-document-stage-layout";
import { useDocumentViewportCentering } from "../../hooks/use-document-viewport-centering";
import ResumePage from "./resume/ResumePage";
import {
  buildVerbatiThemeVars,
  resolveVerbatiAccentHex,
  VERBATI_LAYOUT_OPTIONS,
  VERBATI_LAYOUT_TO_RENDERER,
} from "./style";
import type { ResumeData, ResumeLayoutVariantId } from "./resume/resume.types";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
  DOCUMENT_ZOOM_STEPS,
} from "../../lib/document-stage";
import type { VerbatiLayoutPreset, VerbatiStylePreset } from "./types";

type VerbatiResumePreviewProps = {
  data: ResumeData;
  stylePreset: VerbatiStylePreset;
  compareLayouts?: boolean;
  hostMode?: "panel" | "workspace";
  railLeadControl?: React.ReactNode;
  railStartAddon?: React.ReactNode;
  onSelectComparisonLayout?: ((layout: VerbatiLayoutPreset) => void) | undefined;
};

const comparisonLayouts: VerbatiLayoutPreset[] = VERBATI_LAYOUT_OPTIONS.map(
  (option) => option.id,
);

function getLayoutPresetForRenderer(
  variantId: ResumeLayoutVariantId,
): VerbatiLayoutPreset | null {
  const match = comparisonLayouts.find(
    (layoutPreset) => VERBATI_LAYOUT_TO_RENDERER[layoutPreset] === variantId,
  );

  return match ?? null;
}

export function VerbatiResumePreview({
  data,
  stylePreset,
  compareLayouts = false,
  hostMode = "panel",
  railLeadControl = null,
  railStartAddon = null,
  onSelectComparisonLayout,
}: VerbatiResumePreviewProps): JSX.Element {
  const themeVars = React.useMemo(
    () => buildVerbatiThemeVars(stylePreset),
    [stylePreset],
  );
  const accentToken = React.useMemo(
    () => resolveVerbatiAccentHex(stylePreset),
    [stylePreset],
  );
  const [zoomIndex, setZoomIndex] = React.useState(1);
  const [fitRequestCount, setFitRequestCount] = React.useState(0);
  const [workspaceViewMode, setWorkspaceViewMode] = React.useState<
    "fit-page" | "manual"
  >("fit-page");
  const stageMeasureRef = React.useRef<HTMLDivElement | null>(null);
  const isWorkspaceMode = hostMode === "workspace";
  const stageLayout = useDocumentStageLayout({
    enabled: !compareLayouts,
    measurementRef: stageMeasureRef,
    zoomLevel:
      !isWorkspaceMode || workspaceViewMode === "fit-page"
        ? 1
        : workspaceViewMode === "manual"
          ? DOCUMENT_ZOOM_STEPS[zoomIndex]
          : 1,
    fitMode: isWorkspaceMode ? "contain" : "width",
    fillAvailableOnZoom: isWorkspaceMode,
  });
  const fitPageScale = React.useMemo(
    () =>
      Math.min(
        1,
        stageLayout.availableWidth / A4_PAGE_WIDTH_PX,
        stageLayout.availableHeight / A4_PAGE_HEIGHT_PX,
      ),
    [stageLayout.availableHeight, stageLayout.availableWidth],
  );
  const userZoom = React.useMemo(() => {
    if (!isWorkspaceMode || workspaceViewMode === "fit-page") {
      return 1;
    }
    if (workspaceViewMode === "manual") {
      return DOCUMENT_ZOOM_STEPS[zoomIndex];
    }
    return 1;
  }, [fitPageScale, isWorkspaceMode, workspaceViewMode, zoomIndex]);
  const workspaceZoomPercent = React.useMemo(() => {
    if (!isWorkspaceMode) {
      return 100;
    }

    const baseScale = fitPageScale;
    return Math.max(1, Math.round(baseScale * userZoom * 100));
  }, [
    fitPageScale,
    isWorkspaceMode,
    userZoom,
  ]);
  const stageMode = stageLayout.isFit ? "fit" : "overflow";
  const { attachViewport, viewportPanProps } = useDocumentPan({
    enabled: !compareLayouts && isWorkspaceMode && userZoom > 1,
  });
  const { attachViewport: attachCenterViewport } = useDocumentViewportCentering({
    enabled: !compareLayouts,
    layoutKey: `${userZoom}:${stageLayout.stageWidth}:${stageLayout.stageHeight}:${stylePreset.layout}:${data.name}:${data.title}`,
    recenterKey: fitRequestCount,
    defaultCenterX: isWorkspaceMode ? 0.5 : 0.5,
    defaultCenterY: isWorkspaceMode ? 0.5 : 0.5,
  });
  const attachResumeViewport = React.useCallback(
    (node: HTMLDivElement | null) => {
      attachViewport(node);
      attachCenterViewport(node);
    },
    [attachCenterViewport, attachViewport],
  );

  if (compareLayouts) {
    const comparisonVariantIds = comparisonLayouts.map(
      (layout) => VERBATI_LAYOUT_TO_RENDERER[layout],
    );
    const fitToken = `${stylePreset.layout}:${stylePreset.typography}:${accentToken}:compare:${data.name}:${data.title}:${data.summary.length}:${data.experience.length}:${data.education.length}:${data.skills.length}:${data.languages.length}:${data.projects.length}:${data.achievements?.length ?? 0}`;

    return (
      <div
        key={fitToken}
        className="theme-resume-calm theme-resume-calm--comparison"
        style={themeVars}
      >
        <ResumePage
          data={data}
          mode="comparisonAll"
          comparisonVariantIds={comparisonVariantIds}
          fitToken={fitToken}
          onSelectVariantId={
            onSelectComparisonLayout
              ? (variantId) => {
                  const nextLayout = getLayoutPresetForRenderer(variantId);
                  if (!nextLayout) return;
                  onSelectComparisonLayout(nextLayout);
                }
              : undefined
          }
        />
      </div>
    );
  }

  const fitToken = `${stylePreset.layout}:${stylePreset.typography}:${accentToken}:single:${data.name}:${data.title}:${data.summary.length}:${data.experience.length}:${data.education.length}:${data.skills.length}:${data.languages.length}:${data.projects.length}:${data.achievements?.length ?? 0}`;

  const workspaceZoomControls = isWorkspaceMode ? (
    <div className="dasti-doc-zoom-bar dasti-doc-zoom-bar--rail" data-no-pan="true">
      <button
        type="button"
        className={
          workspaceViewMode === "fit-page"
            ? "dasti-doc-zoom-fit dasti-doc-zoom-fit--active"
            : "dasti-doc-zoom-fit"
        }
        onClick={() => {
          setWorkspaceViewMode("fit-page");
          setFitRequestCount((count) => count + 1);
        }}
        aria-label="Fit page"
        title="Fit page"
      >
        <CornersIn size={14} strokeWidth={1.8} aria-hidden="true" />
      </button>
      <button
        type="button"
        className="dasti-icon-button"
        onClick={() => {
          setWorkspaceViewMode("manual");
          setZoomIndex((index) => Math.max(0, index - 1));
        }}
        disabled={zoomIndex === 0 && workspaceViewMode === "manual"}
        aria-label="Zoom out"
        title="Zoom out"
      >
        <Minus size={14} strokeWidth={1.7} aria-hidden="true" />
      </button>
      <span className="dasti-doc-zoom-status" aria-label={`Zoom ${workspaceZoomPercent} percent`}>
        {workspaceZoomPercent}%
      </span>
      <button
        type="button"
        className="dasti-icon-button"
        onClick={() => {
          setWorkspaceViewMode("manual");
          setZoomIndex((index) =>
            Math.min(DOCUMENT_ZOOM_STEPS.length - 1, index + 1),
          );
        }}
        disabled={
          zoomIndex === DOCUMENT_ZOOM_STEPS.length - 1 &&
          workspaceViewMode === "manual"
        }
        aria-label="Zoom in"
        title="Zoom in"
      >
        <Plus size={14} strokeWidth={1.7} aria-hidden="true" />
      </button>
      <span className="dasti-doc-page-count" aria-label="Page count">
        1 page
      </span>
    </div>
  ) : null;

  const railStartControls =
    isWorkspaceMode &&
    (railLeadControl || railStartAddon || workspaceZoomControls) ? (
      <div className="dasti-proposal-rail-cluster" data-no-pan="true">
        {railLeadControl}
        {railLeadControl && workspaceZoomControls ? (
          <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
        ) : null}
        {workspaceZoomControls}
        {railStartAddon ? (
          <>
            {railLeadControl || workspaceZoomControls ? (
              <div className="dasti-icon-cluster__divider dasti-proposal-rail-cluster__divider" />
            ) : null}
            {railStartAddon}
          </>
        ) : null}
      </div>
    ) : railLeadControl || railStartAddon ? (
      <div data-no-pan="true">
        {railLeadControl}
        {railStartAddon}
      </div>
    ) : null;

  const documentStage = (
    <div className="dasti-document-stage-chassis" ref={stageMeasureRef}>
      <div
        key={fitToken}
        ref={attachResumeViewport}
        className={[
          "dasti-doc-viewport",
          "dasti-doc-viewport--resume",
          !isWorkspaceMode ? "dasti-doc-viewport--resume-panel" : "",
        ]
          .filter(Boolean)
          .join(" ")}
        data-stage-mode={stageMode}
        data-document-stage="true"
        style={{
          width: `${stageLayout.stageWidth}px`,
          height: `${stageLayout.stageHeight}px`,
        }}
        {...viewportPanProps}
      >
        <div
          className="dasti-document-stage__canvas"
          data-document-page="true"
          style={{
            width: `${stageLayout.pageWidth}px`,
            height: `${stageLayout.pageHeight}px`,
          }}
        >
          <ResumePage
            data={data}
            mode={VERBATI_LAYOUT_TO_RENDERER[stylePreset.layout]}
            fitToken={fitToken}
            userZoom={userZoom}
            stageLayout={stageLayout}
          />
        </div>
      </div>
    </div>
  );

  if (!isWorkspaceMode) {
    return (
      <div className="dasti-doc-viewer-shell dasti-doc-viewer-shell--resume-panel">
        <div
          className="dasti-resume-mini-preview theme-resume-calm theme-resume-calm--single"
          style={themeVars}
        >
          {railStartControls ? (
            <div className="dasti-resume-mini-preview__toolbar" data-no-pan="true">
              {railStartControls}
            </div>
          ) : null}
          {documentStage}
        </div>
      </div>
    );
  }

  return (
    <div
      className={[
        "dasti-doc-viewer-shell",
        "dasti-doc-viewer-shell--resume-workspace",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className="dasti-document-rail dasti-document-rail--resume-workspace"
        data-no-pan="true"
      >
        <div className="dasti-document-rail__section dasti-document-rail__section--start">
          {railStartControls}
        </div>
        <div className="dasti-document-rail__section dasti-document-rail__section--center" />
        <div className="dasti-document-rail__section dasti-document-rail__section--end" />
      </div>
      <div
        className={[
          "dasti-proposal-sheet-frame",
          hostMode === "workspace"
            ? "dasti-proposal-sheet-frame--resume-workspace"
            : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div
          className="dasti-proposal-sheet dasti-document-shell theme-resume-calm theme-resume-calm--single"
          style={themeVars}
        >
          <div className="dasti-proposal-sheet__body dasti-proposal-sheet__body--document-viewer">
            {documentStage}
          </div>
        </div>
      </div>
    </div>
  );
}

export default VerbatiResumePreview;
