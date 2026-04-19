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
import type { ResumePreviewMetrics } from "./resume/ResumePage";

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

const DEFAULT_RESUME_PREVIEW_METRICS: ResumePreviewMetrics = {
  pageCount: 1,
  pageGapPx: 0,
  stackHeightPx: A4_PAGE_HEIGHT_PX,
};

function roundPx(value: number) {
  return Math.round(value * 100) / 100;
}

function normalizeSignatureValue(value: string | undefined | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function joinSignatureParts(parts: ReadonlyArray<string>) {
  return parts.map((part) => normalizeSignatureValue(part)).join("|");
}

function buildResumeDataSignature(data: ResumeData) {
  return [
    joinSignatureParts([data.name, data.title, data.summary]),
    data.metadata
      .map((item) => joinSignatureParts([item.label, item.value, item.itemId]))
      .join("||"),
    data.contact
      .map((item) => joinSignatureParts([item.label, item.value, item.itemId]))
      .join("||"),
    data.skills.map((skill) => normalizeSignatureValue(skill)).join("||"),
    data.skillItems
      .map((item) => joinSignatureParts([item.id, item.name, item.level]))
      .join("||"),
    data.languages
      .map((item) => joinSignatureParts([item.id, item.name, item.level]))
      .join("||"),
    data.experience
      .map((item) =>
        joinSignatureParts([
          item.id,
          item.role,
          item.company,
          item.period,
          item.location,
          item.description,
          ...item.bullets,
        ]),
      )
      .join("||"),
    data.projects
      .map((item) =>
        joinSignatureParts([
          item.id,
          item.name,
          item.meta,
          item.description,
        ]),
      )
      .join("||"),
    data.education
      .map((item) =>
        joinSignatureParts([item.id, item.degree, item.school, item.period])
      )
      .join("||"),
    (data.achievements ?? []).map((item) => normalizeSignatureValue(item)).join(
      "||",
    ),
    data.achievementItems
      .map((item) => joinSignatureParts([item.id, item.text]))
      .join("||"),
    data.hobbies.map((item) => normalizeSignatureValue(item)).join("||"),
    data.hobbyItems
      .map((item) => joinSignatureParts([item.id, item.name]))
      .join("||"),
    data.certifications
      .map((item) => joinSignatureParts([item.id, item.name, item.issuer, item.meta]))
      .join("||"),
    data.affiliations
      .map((item) =>
        joinSignatureParts([
          item.id,
          item.organizationName,
          item.roleOrMembershipType,
          item.dateRange,
          item.notes,
        ])
      )
      .join("||"),
    data.textSections
      .map((item) =>
        joinSignatureParts([
          item.id,
          item.sectionId,
          item.sectionTitle,
          item.text,
        ])
      )
      .join("||"),
  ].join("::");
}

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
  const dataSignature = React.useMemo(() => buildResumeDataSignature(data), [data]);
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
  const [resumePreviewMetrics, setResumePreviewMetrics] =
    React.useState<ResumePreviewMetrics>(DEFAULT_RESUME_PREVIEW_METRICS);
  const stageMeasureRef = React.useRef<HTMLDivElement | null>(null);
  const isWorkspaceMode = hostMode === "workspace";
  const handlePreviewMetricsChange = React.useCallback(
    (nextMetrics: ResumePreviewMetrics) => {
      setResumePreviewMetrics((current) =>
        current.pageCount === nextMetrics.pageCount &&
        current.pageGapPx === nextMetrics.pageGapPx &&
        current.stackHeightPx === nextMetrics.stackHeightPx
          ? current
          : nextMetrics,
      );
    },
    [],
  );
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
  const previewScale = React.useMemo(
    () => stageLayout.pageWidth / A4_PAGE_WIDTH_PX,
    [stageLayout.pageWidth],
  );
  const stackedCanvasHeight = React.useMemo(
    () =>
      Math.max(
        stageLayout.pageHeight,
        roundPx(resumePreviewMetrics.stackHeightPx * previewScale),
      ),
    [previewScale, resumePreviewMetrics.stackHeightPx, stageLayout.pageHeight],
  );
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
    : stackedCanvasHeight;
  const effectivePageCount = usesWorkshopTemplateRenderer
    ? visiblePageCount
    : resumePreviewMetrics.pageCount;
  const stageMode =
    stageLayout.overflowX ||
    stageLayout.overflowY ||
    canvasHeightPx > stageLayout.stageHeight + 1
      ? "overflow"
      : "fit";
  const { attachViewport, viewportPanProps } = useDocumentPan({
    enabled: !compareLayouts && isWorkspaceMode && userZoom > 1,
  });
  const shouldCenterViewport =
    !compareLayouts && (!isWorkspaceMode || workspaceViewMode === "fit-page");
  const { attachViewport: attachCenterViewport } = useDocumentViewportCentering(
    {
      enabled: shouldCenterViewport,
      layoutKey: `${userZoom}:${stageLayout.stageWidth}:${stageLayout.stageHeight}:${stageLayout.pageWidth}:${canvasHeightPx}:${effectivePageCount}:${stylePreset.layout}:${rendererVariantId}:${dataSignature}`,
      recenterKey: fitRequestCount,
      defaultCenterX: isWorkspaceMode ? 0.5 : 0.5,
      defaultCenterY:
        isWorkspaceMode || effectivePageCount > 1 ? 0 : 0.5,
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

  React.useLayoutEffect(() => {
    const viewport = resumeViewportRef.current;
    if (!viewport) {
      return;
    }

    const clampViewportScroll = () => {
      const maxTop = Math.max(0, viewport.scrollHeight - viewport.clientHeight);
      const maxLeft = Math.max(0, viewport.scrollWidth - viewport.clientWidth);

      if (viewport.scrollTop > maxTop) {
        viewport.scrollTop = maxTop;
      }

      if (viewport.scrollLeft > maxLeft) {
        viewport.scrollLeft = maxLeft;
      }
    };

    clampViewportScroll();

    const frameId = window.requestAnimationFrame(() => {
      clampViewportScroll();
    });

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [
    compareLayouts,
    dataSignature,
    resumePreviewMetrics.pageCount,
    resumePreviewMetrics.stackHeightPx,
    stageLayout.pageHeight,
    stageLayout.pageWidth,
    stackedCanvasHeight,
  ]);

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
  }, [compareLayouts, dataSignature, rendererVariantId, stylePreset, themeVars]);

  if (compareLayouts) {
    const comparisonVariantIds = comparisonLayouts.map(
      (layout) => resolveLegacyResumeRendererVariantId(layout) ?? "swissminima",
    );
    const fitToken = `${stylePreset.layout}:${stylePreset.typography}:${accentToken}:compare:${dataSignature}`;

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

  const fitToken = `${stylePreset.layout}:${stylePreset.typography}:${accentToken}:single:${dataSignature}`;

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
        {effectivePageCount} {effectivePageCount === 1 ? "page" : "pages"}
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
        const maxTop = Math.max(0, node.scrollHeight - node.clientHeight);
        const maxLeft = Math.max(0, node.scrollWidth - node.clientWidth);

        if (Math.abs(event.deltaY) > 0.01) {
          node.scrollTop = Math.min(
            maxTop,
            Math.max(0, node.scrollTop + event.deltaY),
          );
        }

        if (Math.abs(event.deltaX) > 0.01) {
          node.scrollLeft = Math.min(
            maxLeft,
            Math.max(0, node.scrollLeft + event.deltaX),
          );
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

      if (viewportCanScroll) {
        applyScrollDelta(viewport);
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
        data-overflow-x={stageLayout.overflowX ? "true" : "false"}
        data-overflow-y={
          stageLayout.overflowY || canvasHeightPx > stageLayout.stageHeight + 1
            ? "true"
            : "false"
        }
        data-document-stage="true"
        style={{
          width: `${stageLayout.stageWidth}px`,
          height: `${stageLayout.stageHeight}px`,
        }}
        onWheelCapture={handlePreviewWheel}
        {...viewportPanProps}
      >
        <div
          className="dasti-document-stage__canvas"
          data-document-page="true"
          data-document-page-count={effectivePageCount}
          data-document-page-stack={effectivePageCount > 1 ? "true" : undefined}
          data-interactive={onLinkIntent ? "true" : undefined}
          style={{
            width: `${stageLayout.pageWidth}px`,
            height: `${canvasHeightPx}px`,
          }}
          onClick={onLinkIntent ? handlePreviewCanvasClick : undefined}
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
              onPreviewMetricsChange={handlePreviewMetricsChange}
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
