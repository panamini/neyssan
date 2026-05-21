import React from "react";
import { Menu } from "../../components/ui";
import { useDocumentPan } from "../../hooks/use-document-pan";
import { useDocumentStageLayout } from "../../hooks/use-document-stage-layout";
import { useDocumentViewportCentering } from "../../hooks/use-document-viewport-centering";
import ResumePage from "./resume/ResumePage";
import ResumeTemplateRenderer, {
  RESUME_TEMPLATE_PAGE_GAP_PX,
  getResumeTemplateCanvasHeight,
} from "./resume/ResumeTemplateRenderer";
import type { ResumeInlineEditing } from "./resume/InlineEditableText";
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
import { A4_PAGE_HEIGHT_PX, A4_PAGE_WIDTH_PX } from "../../lib/document-stage";
import {
  readDocumentExportDebugConfig,
  setResumePreviewDebugCapture,
} from "../../lib/document-export-debug";
import { collectResumeFontDebugSnapshot } from "../../lib/resume-font-debug";
import type { VerbatiLayoutPreset, VerbatiStylePreset } from "./types";
import {
  getResumeTemplateDefinition,
  isWorkshopResumeTemplateId,
} from "../../lib/layout/resumeTemplates";
import type { ResumePreviewMetrics } from "./resume/ResumePage";
import type {
  ResumePaperAiState,
  ResumeSectionActions,
} from "./resume/ResumeOneColAtsPage";

type VerbatiResumePreviewProps = {
  data: ResumeData;
  stylePreset: VerbatiStylePreset;
  compareLayouts?: boolean;
  hostMode?: "panel" | "workspace";
  scrollMode?: "contained" | "natural";
  railLeadControl?: React.ReactNode;
  railStartAddon?: React.ReactNode;
  onSelectComparisonLayout?:
    | ((layout: VerbatiLayoutPreset) => void)
    | undefined;
  activeTarget?: ResumeActiveTarget | null;
  onLinkIntent?: (intent: ResumeLinkIntent) => void;
  inlineEditing?: ResumeInlineEditing | null;
  sectionActions?: ResumeSectionActions | null;
  paperAi?: ResumePaperAiState | null;
  showPageCount?: boolean;
  showStageZoomFooter?: boolean;
  onPageCountChange?: (pageCount: number) => void;
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
const CV_DOCUMENT_ZOOM_STEPS = [0.3, 0.5, 0.8, 1, 1.25, 1.5, 2] as const;
const CV_DOCUMENT_ZOOM_DEFAULT_INDEX = 3;
const CV_DOCUMENT_ZOOM_DEFAULT_LEVEL =
  CV_DOCUMENT_ZOOM_STEPS[CV_DOCUMENT_ZOOM_DEFAULT_INDEX];
const CV_DOCUMENT_ZOOM_MIN = CV_DOCUMENT_ZOOM_STEPS[0];
const CV_DOCUMENT_ZOOM_MAX =
  CV_DOCUMENT_ZOOM_STEPS[CV_DOCUMENT_ZOOM_STEPS.length - 1];
const CV_DOCUMENT_ZOOM_SLIDER_STEP = 0.01;

function roundPx(value: number) {
  return Math.round(value * 100) / 100;
}

function formatZoomPercent(value: number) {
  return `${Math.round(value * 100)}%`;
}

function formatZoomOptionLabel(value: number) {
  return `${Math.round(value * 100)} %`;
}

function clampCvDocumentZoomLevel(value: number): number {
  if (!Number.isFinite(value)) return CV_DOCUMENT_ZOOM_DEFAULT_LEVEL;
  return Math.min(CV_DOCUMENT_ZOOM_MAX, Math.max(CV_DOCUMENT_ZOOM_MIN, value));
}

function getNearestCvDocumentZoomIndex(value: number): number {
  let nearestIndex = CV_DOCUMENT_ZOOM_DEFAULT_INDEX;
  let nearestDistance = Number.POSITIVE_INFINITY;
  CV_DOCUMENT_ZOOM_STEPS.forEach((step, index) => {
    const distance = Math.abs(step - value);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

function normalizeSignatureValue(value: string | undefined | null) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function joinSignatureParts(parts: ReadonlyArray<string | null | undefined>) {
  return parts.map((part) => normalizeSignatureValue(part)).join("|");
}

function buildResponsibilitiesRichSignature(
  responsibilitiesRich: ResumeData["experience"][number]["responsibilitiesRich"],
) {
  if (!responsibilitiesRich) {
    return "";
  }

  return responsibilitiesRich.blocks
    .map((block) => {
      if (block.kind === "paragraph") {
        return joinSignatureParts([
          "paragraph",
          ...block.runs.map((run) =>
            joinSignatureParts([
              run.text,
              run.bold ? "b" : "",
              run.italic ? "i" : "",
              run.underline ? "u" : "",
            ]),
          ),
        ]);
      }

      return joinSignatureParts([
        "bullet_list",
        ...block.items.map((item) =>
          joinSignatureParts(
            item.runs.map((run) =>
              joinSignatureParts([
                run.text,
                run.bold ? "b" : "",
                run.italic ? "i" : "",
                run.underline ? "u" : "",
              ]),
            ),
          ),
        ),
      ]);
    })
    .join("||");
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
          buildResponsibilitiesRichSignature(item.responsibilitiesRich),
          ...item.bullets,
        ]),
      )
      .join("||"),
    data.projects
      .map((item) =>
        joinSignatureParts([item.id, item.name, item.meta, item.description]),
      )
      .join("||"),
    data.education
      .map((item) =>
        joinSignatureParts([item.id, item.degree, item.school, item.period]),
      )
      .join("||"),
    (data.achievements ?? [])
      .map((item) => normalizeSignatureValue(item))
      .join("||"),
    data.achievementItems
      .map((item) => joinSignatureParts([item.id, item.text]))
      .join("||"),
    data.hobbies.map((item) => normalizeSignatureValue(item)).join("||"),
    data.hobbyItems
      .map((item) => joinSignatureParts([item.id, item.name]))
      .join("||"),
    data.certifications
      .map((item) =>
        joinSignatureParts([item.id, item.name, item.issuer, item.meta]),
      )
      .join("||"),
    data.affiliations
      .map((item) =>
        joinSignatureParts([
          item.id,
          item.organizationName,
          item.roleOrMembershipType,
          item.dateRange,
          item.notes,
        ]),
      )
      .join("||"),
    data.textSections
      .map((item) =>
        joinSignatureParts([
          item.id,
          item.sectionId,
          item.sectionTitle,
          item.text,
        ]),
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
  scrollMode = "contained",
  railLeadControl = null,
  railStartAddon = null,
  onSelectComparisonLayout,
  activeTarget = null,
  onLinkIntent,
  inlineEditing = null,
  sectionActions = null,
  paperAi = null,
  showPageCount = false,
  showStageZoomFooter = false,
  onPageCountChange,
  onRemoveSection,
}: VerbatiResumePreviewProps): JSX.Element {
  const previewRootRef = React.useRef<HTMLDivElement | null>(null);
  const resumeViewportRef = React.useRef<HTMLDivElement | null>(null);
  const [resumeViewportNode, setResumeViewportNode] =
    React.useState<HTMLDivElement | null>(null);
  const [stableWorkshopPageCount, setStableWorkshopPageCount] =
    React.useState(1);
  const [currentDocumentPage, setCurrentDocumentPage] = React.useState(1);
  const dataSignature = React.useMemo(
    () => buildResumeDataSignature(data),
    [data],
  );
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
  const [zoomLevel, setZoomLevel] = React.useState<number>(
    CV_DOCUMENT_ZOOM_DEFAULT_LEVEL,
  );
  const [fitRequestCount, setFitRequestCount] = React.useState(0);
  const [workspaceViewMode, setWorkspaceViewMode] = React.useState<
    "fit-page" | "manual"
  >("fit-page");
  const [resumePreviewMetrics, setResumePreviewMetrics] =
    React.useState<ResumePreviewMetrics>(DEFAULT_RESUME_PREVIEW_METRICS);
  const stageMeasureRef = React.useRef<HTMLDivElement | null>(null);
  const isWorkspaceMode = hostMode === "workspace";
  const showsStageZoom = isWorkspaceMode || showStageZoomFooter;
  const usesNaturalPageScroll = scrollMode === "natural";
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
      !showsStageZoom || workspaceViewMode === "fit-page"
        ? 1
        : workspaceViewMode === "manual"
          ? zoomLevel
          : 1,
    fitMode:
      showsStageZoom && workspaceViewMode === "manual"
        ? "none"
        : isWorkspaceMode
          ? "contain"
          : "width",
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
    if (!showsStageZoom || workspaceViewMode === "fit-page") {
      return 1;
    }
    if (workspaceViewMode === "manual") {
      return zoomLevel;
    }
    return 1;
  }, [showsStageZoom, workspaceViewMode, zoomLevel]);
  const visibleZoomPercent = React.useMemo(
    () =>
      formatZoomPercent(
        showsStageZoom && workspaceViewMode === "manual" ? zoomLevel : 1,
      ),
    [showsStageZoom, workspaceViewMode, zoomLevel],
  );
  const usesWorkshopTemplateRenderer =
    !compareLayouts &&
    isWorkshopResumeTemplateId(resolvedResumeTemplateId) &&
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
  React.useEffect(() => {
    onPageCountChange?.(effectivePageCount);
  }, [effectivePageCount, onPageCountChange]);
  const shouldShowPageCount = showPageCount && effectivePageCount > 1;
  const pageGapPx = usesWorkshopTemplateRenderer
    ? RESUME_TEMPLATE_PAGE_GAP_PX
    : resumePreviewMetrics.pageGapPx * previewScale;
  const updateCurrentDocumentPage = React.useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || effectivePageCount <= 1 || stageLayout.pageHeight <= 0) {
        setCurrentDocumentPage(1);
        return;
      }

      const pageStride = stageLayout.pageHeight + pageGapPx;
      const visibleMidpoint = node.scrollTop + node.clientHeight / 2;
      const nextPage = Math.min(
        effectivePageCount,
        Math.max(1, Math.floor(visibleMidpoint / pageStride) + 1),
      );

      setCurrentDocumentPage((current) =>
        current === nextPage ? current : nextPage,
      );
    },
    [effectivePageCount, pageGapPx, stageLayout.pageHeight],
  );
  const pageBreakMarkers = React.useMemo(() => {
    if (effectivePageCount <= 1) {
      return [];
    }

    return Array.from({ length: effectivePageCount - 1 }, (_, index) => {
      const pageIndex = index + 1;
      return {
        pageNumber: pageIndex + 1,
        topPx: pageIndex * (stageLayout.pageHeight + pageGapPx) - pageGapPx / 2,
      };
    });
  }, [
    effectivePageCount,
    pageGapPx,
    stageLayout.pageHeight,
  ]);
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
      recenterKey: showStageZoomFooter
        ? `${fitRequestCount}:${workspaceViewMode}:${zoomLevel}`
        : fitRequestCount,
      defaultCenterX: isWorkspaceMode ? 0.5 : 0.5,
      defaultCenterY: isWorkspaceMode || effectivePageCount > 1 ? 0 : 0.5,
    },
  );
  const attachResumeViewport = React.useCallback(
    (node: HTMLDivElement | null) => {
      resumeViewportRef.current = node;
      setResumeViewportNode(node);
      attachViewport(node);
      attachCenterViewport(node);
      updateCurrentDocumentPage(node);
    },
    [attachCenterViewport, attachViewport, updateCurrentDocumentPage],
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
  }, [
    compareLayouts,
    dataSignature,
    rendererVariantId,
    stylePreset,
    themeVars,
  ]);

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

  const fitTokenDataSignature = inlineEditing?.enabled
    ? "inline-editing"
    : dataSignature;
  const fitToken = `${stylePreset.layout}:${stylePreset.typography}:${accentToken}:single:${fitTokenDataSignature}`;
  const shouldFitViewportToPage =
    !isWorkspaceMode && showsStageZoom && workspaceViewMode === "manual";
  const viewportWidthPx = shouldFitViewportToPage
    ? stageLayout.pageWidth
    : stageLayout.stageWidth;
  const viewportHeightPx =
    usesNaturalPageScroll || shouldFitViewportToPage
      ? canvasHeightPx
      : stageLayout.stageHeight;
  const pageCountText = (
    <>
      <span className="dasti-doc-page-count__label">Page</span>
      {" "}
      <span className="dasti-doc-page-count__value">
        {currentDocumentPage}
      </span>
      {" "}
      <span className="dasti-doc-page-count__label">of</span>
      {" "}
      <span className="dasti-doc-page-count__value">
        {effectivePageCount}
      </span>
    </>
  );

  const workspaceZoomFooter = showsStageZoom ? (
    <div className="dasti-cv-stage-footer" data-no-pan="true">
      <div className="dasti-cv-stage-footer__meta">
        {shouldShowPageCount ? (
          <span
            className="dasti-doc-page-count dasti-doc-page-count--resume-footer"
            aria-label="Page count"
          >
            {pageCountText}
          </span>
        ) : null}
      </div>
      <div
        className="dasti-cv-stage-footer__zoom"
        aria-label="CV zoom controls"
      >
        <input
          className="dasti-cv-stage-footer__zoom-slider"
          type="range"
          data-testid="cv-zoom-slider"
          min={CV_DOCUMENT_ZOOM_MIN}
          max={CV_DOCUMENT_ZOOM_MAX}
          step={CV_DOCUMENT_ZOOM_SLIDER_STEP}
          value={
            workspaceViewMode === "fit-page"
              ? CV_DOCUMENT_ZOOM_DEFAULT_LEVEL
              : zoomLevel
          }
          aria-label="CV zoom"
          aria-valuetext={visibleZoomPercent}
          onChange={(event) => {
            setWorkspaceViewMode("manual");
            setZoomLevel(
              clampCvDocumentZoomLevel(Number(event.currentTarget.value)),
            );
          }}
        />
        <Menu
          ariaLabel="CV zoom menu"
          align="end"
          side="top"
          menuClassName="dasti-cv-stage-footer__zoom-menu"
          sections={[
            {
              items: [
                ...CV_DOCUMENT_ZOOM_STEPS.map((step, index) => ({
                  id: `zoom-${index}`,
                  label: formatZoomOptionLabel(step),
                  role: "menuitemradio" as const,
                  selected:
                    workspaceViewMode === "manual" &&
                    getNearestCvDocumentZoomIndex(zoomLevel) === index,
                  onSelect: () => {
                    setWorkspaceViewMode("manual");
                    setZoomLevel(step);
                  },
                })),
                {
                  id: "fit-page",
                  label: "Fit page",
                  role: "menuitemradio" as const,
                  selected: workspaceViewMode === "fit-page",
                  onSelect: () => {
                    setWorkspaceViewMode("fit-page");
                    setFitRequestCount((count) => count + 1);
                  },
                },
              ],
            },
          ]}
          trigger={
            <button
              type="button"
              className="dasti-doc-zoom-status dasti-cv-stage-footer__zoom-status"
              aria-label={`Zoom level ${visibleZoomPercent}`}
              data-testid="cv-zoom-display"
              data-toolbar-tooltip="Zoom presets"
            >
              {visibleZoomPercent}
            </button>
          }
        />
      </div>
    </div>
  ) : null;

  const railStartControls =
    isWorkspaceMode && (railLeadControl || railStartAddon) ? (
      <div className="dasti-proposal-rail-cluster" data-no-pan="true">
        {railLeadControl}
        {railStartAddon ? (
          <>
            {railLeadControl ? (
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
      const target =
        e.target instanceof HTMLElement
          ? e.target
          : ((e.target as Node).parentElement as HTMLElement | null);
      if (!target) return;
      if (inlineEditing?.enabled) {
        return;
      }
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
    [hostMode, inlineEditing?.enabled, onLinkIntent],
  );

  const handlePreviewWheel = React.useCallback(
    (event: WheelEvent) => {
      if (compareLayouts || event.ctrlKey) {
        return;
      }
      if (usesNaturalPageScroll) {
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

        return (
          previousTop !== node.scrollTop || previousLeft !== node.scrollLeft
        );
      };

      const viewportCanScroll =
        viewport.scrollHeight > viewport.clientHeight + 1 ||
        viewport.scrollWidth > viewport.clientWidth + 1;

      const shouldDeferToNativeViewportScroll =
        showsStageZoom && workspaceViewMode === "manual" && viewportCanScroll;

      if (shouldDeferToNativeViewportScroll) {
        return;
      }

      if (viewportCanScroll && applyScrollDelta(viewport)) {
        event.preventDefault();
      }
    },
    [compareLayouts, showsStageZoom, usesNaturalPageScroll, workspaceViewMode],
  );

  React.useEffect(() => {
    if (!resumeViewportNode) {
      return undefined;
    }

    const listener = (event: WheelEvent) => {
      handlePreviewWheel(event);
    };

    resumeViewportNode.addEventListener("wheel", listener, {
      capture: true,
      passive: false,
    });

    return () => {
      resumeViewportNode.removeEventListener("wheel", listener, true);
    };
  }, [handlePreviewWheel, resumeViewportNode]);

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
        data-scroll-mode={scrollMode}
        style={{
          width: `${viewportWidthPx}px`,
          height: `${viewportHeightPx}px`,
        }}
        onScroll={(event) => {
          updateCurrentDocumentPage(event.currentTarget);
        }}
        {...viewportPanProps}
      >
        <div
          className="dasti-document-stage__canvas"
          data-testid="cv-paper"
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
          {pageBreakMarkers.length > 0 ? (
            <div className="dasti-document-page-markers" aria-hidden="true">
              {pageBreakMarkers.map((marker) => (
                <div
                  key={`resume-page-marker-${marker.pageNumber}`}
                  className="dasti-document-page-marker"
                  style={
                    {
                      "--page-marker-top": `${roundPx(marker.topPx)}px`,
                    } as React.CSSProperties
                  }
                >
                  <span className="dasti-document-page-marker__label">
                    Page {marker.pageNumber}
                  </span>
                  <span className="dasti-document-page-marker__line" />
                </div>
              ))}
            </div>
          ) : null}
          {usesWorkshopTemplateRenderer ? (
            <ResumeTemplateRenderer
              data={data}
              stylePreset={stylePreset}
              resumeTemplateId={resolvedResumeTemplateId}
              stageLayout={stageLayout}
              activeTarget={activeTarget}
              inlineEditing={inlineEditing}
              sectionActions={sectionActions}
              paperAi={paperAi}
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
              inlineEditing={inlineEditing}
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
          {shouldShowPageCount && !workspaceZoomFooter ? (
            <span
              className="dasti-doc-page-count dasti-doc-page-count--resume-panel"
              aria-label="Page count"
            >
              {pageCountText}
            </span>
          ) : null}
        </div>
        {workspaceZoomFooter}
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
      {workspaceZoomFooter}
    </div>
  );
}

export default VerbatiResumePreview;
