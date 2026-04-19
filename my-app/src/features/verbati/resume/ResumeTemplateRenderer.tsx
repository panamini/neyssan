import React from "react";

import { A4_PAGE_HEIGHT_PX, A4_PAGE_WIDTH_PX } from "../../../lib/document-stage";
import { normalizeResumePreviewTokens } from "../../../lib/layout/documentTokenNormalizer";
import {
  getResumeTemplateDefinition,
  type ResumeTemplateId,
} from "../../../lib/layout/resumeTemplates";
import {
  serializeActiveResumePreviewDecorVars,
  serializeResumePreviewVars,
} from "../../../lib/layout/documentTokenSerializers";
import { planWorkshopResumePages } from "../../../lib/resume/resumePagination";
import type { DocumentStageLayout } from "../../../hooks/use-document-stage-layout";
import type { ResumeActiveTarget } from "../resumeLinking";
import type { VerbatiStylePreset } from "../types";
import ResumeOneColAtsPage from "./ResumeOneColAtsPage";
import type { ResumePreviewMetrics } from "./ResumePage";
import type { ResumeData } from "./resume.types";

export const WORKSHOP_TEMPLATE_RENDERER_ID = "workshop_resume_onecol_ats";
export const RESUME_TEMPLATE_PAGE_GAP_PX = 24;

type ResumeTemplateRendererProps = {
  data: ResumeData;
  stylePreset: VerbatiStylePreset;
  resumeTemplateId: ResumeTemplateId;
  activeTarget?: ResumeActiveTarget | null;
  stageLayout?: DocumentStageLayout;
  onStablePageCountChange?: ((pageCount: number) => void) | undefined;
  onPreviewMetricsChange?: ((metrics: ResumePreviewMetrics) => void) | undefined;
};

function buildTemplatePreviewVars(
  resumeTemplateId: ResumeTemplateId,
  stylePreset: VerbatiStylePreset,
) {
  const templateDefinition = getResumeTemplateDefinition(resumeTemplateId);
  const previewTokens = normalizeResumePreviewTokens({
    resumeTemplateId,
    stylePreset,
  });

  return {
    ...serializeResumePreviewVars(previewTokens),
    ...serializeActiveResumePreviewDecorVars({
      variantId: templateDefinition.decorVariantId,
      tokens: previewTokens,
    }),
  };
}

export function getResumeTemplateCanvasHeight(args: {
  pageCount: number;
  pageHeightPx: number;
}) {
  return (
    args.pageCount * args.pageHeightPx +
    Math.max(0, args.pageCount - 1) * RESUME_TEMPLATE_PAGE_GAP_PX
  );
}

export function ResumeTemplateRenderer({
  data,
  stylePreset,
  resumeTemplateId,
  activeTarget = null,
  stageLayout,
  onStablePageCountChange,
  onPreviewMetricsChange,
}: ResumeTemplateRendererProps) {
  const templateDefinition = getResumeTemplateDefinition(resumeTemplateId);
  const isWorkshopTemplateRenderer =
    resumeTemplateId === WORKSHOP_TEMPLATE_RENDERER_ID &&
    templateDefinition.supportsPlanner;
  const plan = React.useMemo(
    () =>
      isWorkshopTemplateRenderer
        ? planWorkshopResumePages({
            data,
            template: templateDefinition,
            stylePreset,
          })
        : null,
    [data, isWorkshopTemplateRenderer, templateDefinition],
  );
  const previewVars = React.useMemo(
    () =>
      isWorkshopTemplateRenderer
        ? buildTemplatePreviewVars(resumeTemplateId, stylePreset)
        : null,
    [isWorkshopTemplateRenderer, resumeTemplateId, stylePreset],
  );
  const previewScale =
    stageLayout && stageLayout.pageWidth > 0
      ? stageLayout.pageWidth / A4_PAGE_WIDTH_PX
      : 1;
  const shellPageWidthPx = stageLayout?.pageWidth ?? A4_PAGE_WIDTH_PX;
  const shellPageHeightPx = stageLayout?.pageHeight ?? A4_PAGE_HEIGHT_PX;
  const lastCommittedPageCountRef = React.useRef<number | null>(null);
  const stackRef = React.useRef<HTMLDivElement | null>(null);

  React.useEffect(() => {
    if (!isWorkshopTemplateRenderer || !onStablePageCountChange || !plan) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (lastCommittedPageCountRef.current === plan.pageCount) {
        return;
      }

      lastCommittedPageCountRef.current = plan.pageCount;
      onStablePageCountChange(plan.pageCount);
    }, 40);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isWorkshopTemplateRenderer, onStablePageCountChange, plan]);

  React.useLayoutEffect(() => {
    if (!isWorkshopTemplateRenderer || !onPreviewMetricsChange || !plan) {
      return undefined;
    }

    const fallbackStackHeightPx =
      A4_PAGE_HEIGHT_PX * Math.max(1, plan.pageCount) +
      RESUME_TEMPLATE_PAGE_GAP_PX * Math.max(0, plan.pageCount - 1);

    const publishMetrics = () => {
      const measuredHeight = stackRef.current?.getBoundingClientRect().height;
      const stackHeightPx =
        measuredHeight && previewScale > 0
          ? measuredHeight / previewScale
          : fallbackStackHeightPx;

      onPreviewMetricsChange({
        pageCount: Math.max(1, plan.pageCount),
        pageGapPx: RESUME_TEMPLATE_PAGE_GAP_PX,
        stackHeightPx,
      });
    };

    publishMetrics();

    let frameId: number | null = window.requestAnimationFrame(() => {
      frameId = null;
      publishMetrics();
    });

    if (!stackRef.current || typeof ResizeObserver === "undefined") {
      return () => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    const resizeObserver = new ResizeObserver(() => {
      publishMetrics();
    });
    resizeObserver.observe(stackRef.current);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      resizeObserver.disconnect();
    };
  }, [isWorkshopTemplateRenderer, onPreviewMetricsChange, plan, previewScale]);

  if (!isWorkshopTemplateRenderer || !plan || !previewVars) {
    return null;
  }

  return (
    <div
      ref={stackRef}
      data-testid="resume-template-renderer"
      style={{
        ...previewVars,
        width: `${shellPageWidthPx}px`,
        minHeight: `${getResumeTemplateCanvasHeight({
          pageCount: plan.pageCount,
          pageHeightPx: shellPageHeightPx,
        })}px`,
        display: "grid",
        gap: `${RESUME_TEMPLATE_PAGE_GAP_PX}px`,
        alignContent: "start",
      }}
    >
      {plan.pages.map((page) => (
        <div
          key={`workshop-page-${page.index + 1}`}
          style={{
            width: `${shellPageWidthPx}px`,
            minHeight: `${shellPageHeightPx}px`,
            boxSizing: "border-box",
            overflow: "hidden",
            display: "grid",
            alignContent: "start",
            justifyItems: "start",
          }}
        >
          <div
            style={{
              width: `${A4_PAGE_WIDTH_PX}px`,
              minHeight: `${A4_PAGE_HEIGHT_PX}px`,
              boxSizing: "border-box",
              background: "var(--paper)",
              boxShadow:
                "0 1px 2px rgba(20, 20, 20, 0.06), 0 18px 36px rgba(20, 20, 20, 0.08)",
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
            }}
          >
            <ResumeOneColAtsPage
              data={data}
              page={page}
              template={templateDefinition}
              activeTarget={activeTarget}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export default ResumeTemplateRenderer;
