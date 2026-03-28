import React from "react";
import { Minus, Plus } from "@/lib/icons";
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
import { DOCUMENT_ZOOM_STEPS } from "../../lib/document-stage";
import type { VerbatiLayoutPreset, VerbatiStylePreset } from "./types";

type VerbatiResumePreviewProps = {
  data: ResumeData;
  stylePreset: VerbatiStylePreset;
  compareLayouts?: boolean;
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
  const stageMeasureRef = React.useRef<HTMLDivElement | null>(null);
  const userZoom = DOCUMENT_ZOOM_STEPS[zoomIndex];
  const stageLayout = useDocumentStageLayout({
    enabled: !compareLayouts,
    measurementRef: stageMeasureRef,
    zoomLevel: userZoom,
  });
  const stageMode = stageLayout.isFit ? "fit" : "overflow";
  const { attachViewport, viewportPanProps } = useDocumentPan({
    enabled: !compareLayouts && userZoom > 1,
  });
  const { attachViewport: attachCenterViewport } = useDocumentViewportCentering({
    enabled: !compareLayouts,
    layoutKey: `${userZoom}:${stageLayout.stageWidth}:${stageLayout.stageHeight}:${stylePreset.layout}:${data.name}:${data.title}`,
    recenterKey: fitRequestCount,
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

  const zoomControls = (
    <div className="dasti-doc-zoom-bar" data-no-pan="true">
        <button
          type="button"
          className={
            zoomIndex === 1
              ? "dasti-doc-zoom-fit dasti-doc-zoom-fit--active"
              : "dasti-doc-zoom-fit"
          }
          onClick={() => {
            setZoomIndex(1);
            setFitRequestCount((count) => count + 1);
          }}
          aria-label="Fit page"
          title="Fit page"
        >
          Fit
        </button>
        <button
          type="button"
          className="dasti-icon-button"
          onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
          disabled={zoomIndex === 0}
          aria-label="Zoom out"
          title="Zoom out"
        >
          <Minus size={14} strokeWidth={1.7} aria-hidden="true" />
        </button>
        <button
          type="button"
          className="dasti-icon-button"
          onClick={() =>
            setZoomIndex((i) =>
              Math.min(DOCUMENT_ZOOM_STEPS.length - 1, i + 1),
            )
          }
          disabled={zoomIndex === DOCUMENT_ZOOM_STEPS.length - 1}
          aria-label="Zoom in"
          title="Zoom in"
        >
          <Plus size={14} strokeWidth={1.7} aria-hidden="true" />
        </button>
      </div>
  );

  return (
    <div className="dasti-doc-viewer-shell">
      <div className="dasti-proposal-sheet-frame">
        <div
          className="dasti-proposal-sheet dasti-document-shell theme-resume-calm theme-resume-calm--single"
          style={themeVars}
        >
          <div className="dasti-document-rail" data-no-pan="true">
            <div className="dasti-document-rail__section dasti-document-rail__section--start" />
            <div className="dasti-document-rail__section dasti-document-rail__section--center">
              {zoomControls}
            </div>
            <div className="dasti-document-rail__section dasti-document-rail__section--end" />
          </div>
          <div className="dasti-proposal-sheet__body dasti-proposal-sheet__body--document-viewer">
            <div className="dasti-document-stage-chassis" ref={stageMeasureRef}>
              <div
                key={fitToken}
                ref={attachResumeViewport}
                className="dasti-doc-viewport dasti-doc-viewport--resume"
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
          </div>
        </div>
      </div>
    </div>
  );
}
