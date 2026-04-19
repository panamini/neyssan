import React from "react";
import {
  CornersIn,
  MagnifyingGlassMinus,
  MagnifyingGlassPlus,
} from "@/lib/icons";
import { useDocumentPan } from "../../hooks/use-document-pan";
import { useDocumentStageLayout } from "../../hooks/use-document-stage-layout";
import { useDocumentViewportCentering } from "../../hooks/use-document-viewport-centering";
import ResumePage from "./resume/ResumePage";
import ResumeTemplateRenderer, {
  WORKSHOP_TEMPLATE_RENDERER_ID,
  getResumeTemplateCanvasHeight,
} from "./resume/ResumeTemplateRenderer";
import {
  buildVerbatiThemeVars,
  getResumeTemplateId,
  resolveLegacyResumeRendererVariantId,
  resolveVerbatiAccentHex,
  VERBATI_LAYOUT_TO_RENDERER,
  VERBATI_LAYOUT_OPTIONS,
} from "./style";
import type { ResumeData, ResumeLayoutVariantId } from "./resume/resume.types";
import {
  buildResumeLinkRequestId,
  isModalCanonicalSectionType,
  resolvePreviewSectionType,
  resolvePreviewSurfaceType,
  type ResumeActiveTarget,
  type ResumeCanonicalSectionType,
  type ResumeLinkIntent,
  type ResumePreviewSectionType,
} from "./resumeLinking";
import {
  A4_PAGE_HEIGHT_PX,
  A4_PAGE_WIDTH_PX,
  DOCUMENT_ZOOM_STEPS,
} from "../../lib/document-stage";
import {
  readDocumentExportDebugConfig,
  setResumePreviewDebugCapture,
} from "../../lib/document-export-debug";
import { collectResumeFontDebugSnapshot } from "../../lib/resume-font-debug";
import type { VerbatiLayoutPreset, VerbatiStylePreset } from "./types";
import { getResumeTemplateDefinition } from "../../lib/layout/resumeTemplates";

type VerbatiResumePreviewProps = {
  data: ResumeData;
  stylePreset: VerbatiStylePreset;
  compareLayouts?: boolean;
  hostMode?: "panel" | "workspace";
  railLeadControl?: React.ReactNode;
  railStartAddon?: React.ReactNode;
  onSelectComparisonLayout?:
    | ((layout: VerbatiLayoutPreset) => void)
    | undefined;
  activeTarget?: ResumeActiveTarget | null;
  onLinkIntent?: (intent: ResumeLinkIntent) => void;
  onRemoveSection?:
    | ((section: {
        sectionId: string;
        sectionType: ResumeCanonicalSectionType;
        sectionTitle?: string;
        previewSectionType?: ResumePreviewSectionType;
      }) => void)
    | undefined;
};

const comparisonLayouts: VerbatiLayoutPreset[] = VERBATI_LAYOUT_OPTIONS.map(
  (option) => option.id,
).filter((layout) => layout !== "workshop");

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
  activeTarget = null,
  onLinkIntent,
  onRemoveSection,
}: VerbatiResumePreviewProps): JSX.Element {
  const previewRootRef = React.useRef<HTMLDivElement | null>(null);
  const resumeViewportRef = React.useRef<HTMLDivElement | null>(null);
  const [stableWorkshopPageCount, setStableWorkshopPageCount] = React.useState(1);
  const themeVars = React.useMemo(
    () => buildVerbatiThemeVars(stylePreset),
    [stylePreset],
  );
  const resolvedResumeTemplateId = React.useMemo(
    () => getResumeTemplateId(stylePreset),
    [stylePreset],
  );
  const resolvedTemplateDefinition = React.useMemo(
    () => getResumeTemplateDefinition(resolvedResumeTemplateId),
    [resolvedResumeTemplateId],
  );
  const rendererVariantId = React.useMemo(
    () => resolveLegacyResumeRendererVariantId(stylePreset) ?? "swissminima",
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
  const stageMode = stageLayout.isFit ? "fit" : "overflow";
  const usesWorkshopTemplateRenderer =
    !compareLayouts &&
    resolvedResumeTemplateId === WORKSHOP_TEMPLATE_RENDERER_ID &&
    resolvedTemplateDefinition.supportsPlanner;
  const visiblePageCount = usesWorkshopTemplateRenderer
    ? stableWorkshopPageCount
    : 1;
  const canvasHeightPx = usesWorkshopTemplateRenderer
    ? getResumeTemplateCanvasHeight({
        pageCount: visiblePageCount,
        pageHeightPx: stageLayout.pageHeight,
      })
    : stageLayout.pageHeight;
  const { attachViewport, viewportPanProps } = useDocumentPan({
    enabled: !compareLayouts && isWorkspaceMode && userZoom > 1,
  });
  const { attachViewport: attachCenterViewport } = useDocumentViewportCentering(
    {
      enabled: !compareLayouts,
      layoutKey: `${userZoom}:${stageLayout.stageWidth}:${stageLayout.stageHeight}:${stylePreset.layout}:${rendererVariantId}:${data.name}:${data.title}`,
      recenterKey: fitRequestCount,
      defaultCenterX: isWorkspaceMode ? 0.5 : 0.5,
      defaultCenterY: usesWorkshopTemplateRenderer ? 0 : 0.5,
    },
  );
  const attachResumeViewport = React.useCallback(
    (node: HTMLDivElement | null) => {
      resumeViewportRef.current = node;
      attachViewport(node);
      attachCenterViewport(node);
    },
    [attachCenterViewport, attachViewport],
  );

  React.useEffect(() => {
    if (!usesWorkshopTemplateRenderer) {
      setStableWorkshopPageCount(1);
    }
  }, [usesWorkshopTemplateRenderer]);

  React.useEffect(() => {
    if (compareLayouts || typeof window === "undefined") {
      return undefined;
    }

    if (!readDocumentExportDebugConfig()) {
      return undefined;
    }

    let cancelled = false;
    const capturePreviewState = async () => {
      try {
        if (document.fonts?.ready) {
          await document.fonts.ready;
        }
      } catch {
        // Continue even if the browser does not expose font readiness.
      }

      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });
      await new Promise<void>((resolve) => {
        window.requestAnimationFrame(() => resolve());
      });

      if (cancelled || !previewRootRef.current) {
        return;
      }

      const snapshot = collectResumeFontDebugSnapshot({
        root: previewRootRef.current,
        stylePreset,
        rendererVariantId,
      });

      setResumePreviewDebugCapture({
        source: "live-preview",
        rendererVariantId,
        stylePreset,
        serializedThemeVars: Object.fromEntries(
          Object.entries(themeVars).map(([key, value]) => [
            key,
            String(value ?? ""),
          ]),
        ),
        snapshot,
        timestamp: Date.now(),
      });
    };

    void capturePreviewState();

    return () => {
      cancelled = true;
    };
  }, [compareLayouts, rendererVariantId, stylePreset, themeVars]);

  if (compareLayouts) {
    const comparisonVariantIds = comparisonLayouts.map(
      (layout) => resolveLegacyResumeRendererVariantId(layout) ?? "swissminima",
    );
    const fitToken = `${stylePreset.layout}:${stylePreset.typography}:${accentToken}:compare:${data.name}:${data.title}:${data.summary.length}:${data.experience.length}:${data.education.length}:${data.skills.length}:${data.languages.length}:${data.projects.length}:${data.achievements?.length ?? 0}`;

    return (
      <div
        key={fitToken}
        ref={previewRootRef}
        className="theme-resume-calm theme-resume-calm--comparison"
        data-live-resume-preview="true"
        data-style-layout={stylePreset.layout}
        data-style-typography={stylePreset.typography}
        data-renderer-variant={rendererVariantId}
        style={themeVars}
      >
        <ResumePage
          data={data}
          mode="comparisonAll"
          comparisonVariantIds={comparisonVariantIds}
          stylePreset={stylePreset}
          fitToken={fitToken}
          activeTarget={activeTarget}
          onRemoveSection={onRemoveSection}
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
    <div
      className="dasti-doc-zoom-bar dasti-doc-zoom-bar--rail"
      data-no-pan="true"
    >
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
        <MagnifyingGlassMinus size={14} strokeWidth={1.7} aria-hidden="true" />
      </button>
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
        <MagnifyingGlassPlus size={14} strokeWidth={1.7} aria-hidden="true" />
      </button>
      <span className="dasti-doc-page-count" aria-label="Page count">
        {visiblePageCount} {visiblePageCount === 1 ? "page" : "pages"}
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

  const handlePreviewCanvasClick = React.useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!onLinkIntent) return;
      const target = e.target as HTMLElement;
      const sectionEl = target.closest(
        "[data-preview-section]",
      ) as HTMLElement | null;
      const headerEl = !sectionEl
        ? (target.closest("header") as HTMLElement | null)
        : null;
      const rawSectionType =
        sectionEl?.dataset.previewSection ?? (headerEl ? "profile" : null);
      const sectionType = resolvePreviewSectionType(rawSectionType);
      if (!sectionType) {
        return;
      }
      const itemEl = target.closest(
        "[data-preview-item-id]",
      ) as HTMLElement | null;
      const rowEl = !itemEl
        ? (target.closest("[data-preview-row-id]") as HTMLElement | null)
        : null;
      const source =
        hostMode === "workspace" ? "preview-workspace" : "preview-panel";

      e.stopPropagation();
      onLinkIntent({
        requestId: buildResumeLinkRequestId(),
        sectionType,
        previewSectionType:
          resolvePreviewSurfaceType(rawSectionType) ?? undefined,
        itemId: (() => {
          const previewItemId = itemEl?.dataset.previewItemId;
          if (previewItemId && previewItemId.trim().length > 0) {
            return previewItemId;
          }
          const previewRowId = rowEl?.dataset.previewRowId;
          return previewRowId && previewRowId.trim().length > 0
            ? previewRowId
            : undefined;
        })(),
        source,
        shouldOpenModal: isModalCanonicalSectionType(sectionType),
        sectionId:
          sectionEl?.dataset.previewSectionId &&
          sectionEl.dataset.previewSectionId.trim().length > 0
            ? sectionEl.dataset.previewSectionId
            : undefined,
        sectionTitle:
          sectionEl?.dataset.previewSectionTitle &&
          sectionEl.dataset.previewSectionTitle.trim().length > 0
            ? sectionEl.dataset.previewSectionTitle
            : undefined,
      });
    },
    [hostMode, onLinkIntent],
  );

  const handlePreviewWheel = React.useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      if (compareLayouts || event.ctrlKey) {
        return;
      }

      const viewport = resumeViewportRef.current;
      if (!viewport) {
        return;
      }

      const applyScrollDelta = (node: HTMLElement | null) => {
        if (!node) {
          return false;
        }

        const previousTop = node.scrollTop;
        const previousLeft = node.scrollLeft;

        if (Math.abs(event.deltaY) > 0.01) {
          node.scrollTop += event.deltaY;
        }

        if (Math.abs(event.deltaX) > 0.01) {
          node.scrollLeft += event.deltaX;
        }

        return previousTop !== node.scrollTop || previousLeft !== node.scrollLeft;
      };

      const viewportCanScroll =
        viewport.scrollHeight > viewport.clientHeight + 1 ||
        viewport.scrollWidth > viewport.clientWidth + 1;

      const shouldDeferToNativeViewportScroll =
        isWorkspaceMode &&
        workspaceViewMode === "manual" &&
        viewportCanScroll;

      if (shouldDeferToNativeViewportScroll) {
        return;
      }

      if (viewportCanScroll && applyScrollDelta(viewport)) {
        event.preventDefault();
        return;
      }

      let ancestor = viewport.parentElement;
      while (ancestor) {
        const style = window.getComputedStyle(ancestor);
        const canScrollY =
          /(auto|scroll|overlay)/.test(style.overflowY) &&
          ancestor.scrollHeight > ancestor.clientHeight + 1;
        const canScrollX =
          /(auto|scroll|overlay)/.test(style.overflowX) &&
          ancestor.scrollWidth > ancestor.clientWidth + 1;

        if (canScrollY || canScrollX) {
          if (applyScrollDelta(ancestor)) {
            event.preventDefault();
          }
          return;
        }

        ancestor = ancestor.parentElement;
      }

      const scrollingElement =
        document.scrollingElement instanceof HTMLElement
          ? document.scrollingElement
          : null;
      if (applyScrollDelta(scrollingElement)) {
        event.preventDefault();
      }
    },
    [compareLayouts, isWorkspaceMode, workspaceViewMode],
  );

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
          data-document-page={usesWorkshopTemplateRenderer ? undefined : "true"}
          data-interactive={onLinkIntent ? "true" : undefined}
          style={{
            width: `${stageLayout.pageWidth}px`,
            height: `${canvasHeightPx}px`,
            alignItems: usesWorkshopTemplateRenderer ? "start" : undefined,
            justifyItems: usesWorkshopTemplateRenderer ? "start" : undefined,
            alignContent: usesWorkshopTemplateRenderer ? "start" : undefined,
            justifyContent: usesWorkshopTemplateRenderer ? "start" : undefined,
            overflow: usesWorkshopTemplateRenderer ? "visible" : undefined,
            background: usesWorkshopTemplateRenderer ? "transparent" : undefined,
            borderRadius: usesWorkshopTemplateRenderer ? 0 : undefined,
            boxShadow: usesWorkshopTemplateRenderer ? "none" : undefined,
          }}
          onClick={onLinkIntent ? handlePreviewCanvasClick : undefined}
          onWheelCapture={handlePreviewWheel}
        >
          {usesWorkshopTemplateRenderer ? (
            <ResumeTemplateRenderer
              data={data}
              stylePreset={stylePreset}
              resumeTemplateId={resolvedResumeTemplateId}
              stageLayout={stageLayout}
              activeTarget={activeTarget}
              onStablePageCountChange={setStableWorkshopPageCount}
            />
          ) : (
            <ResumePage
              data={data}
              mode={rendererVariantId}
              stylePreset={stylePreset}
              fitToken={fitToken}
              userZoom={userZoom}
              stageLayout={stageLayout}
              activeTarget={activeTarget}
              onRemoveSection={onRemoveSection}
            />
          )}
        </div>
      </div>
    </div>
  );

  if (!isWorkspaceMode) {
    return (
      <div className="dasti-doc-viewer-shell dasti-doc-viewer-shell--resume-panel">
        <div
          className="dasti-resume-mini-preview theme-resume-calm theme-resume-calm--single"
          ref={previewRootRef}
          data-live-resume-preview="true"
          data-style-layout={stylePreset.layout}
          data-style-typography={stylePreset.typography}
          data-renderer-variant={rendererVariantId}
          style={themeVars}
        >
          {railStartControls ? (
            <div
              className="dasti-resume-mini-preview__toolbar"
              data-no-pan="true"
            >
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
          ref={previewRootRef}
          data-live-resume-preview="true"
          data-style-layout={stylePreset.layout}
          data-style-typography={stylePreset.typography}
          data-renderer-variant={rendererVariantId}
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
