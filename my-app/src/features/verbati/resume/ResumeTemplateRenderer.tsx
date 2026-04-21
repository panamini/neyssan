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
import {
  planWorkshopResumePages,
  type WorkshopResumeCommittedPage,
} from "../../../lib/resume/resumePagination";
import type { DocumentStageLayout } from "../../../hooks/use-document-stage-layout";
import type { ResumeActiveTarget } from "../resumeLinking";
import type { VerbatiStylePreset } from "../types";
import { buildVerbatiThemeVars } from "../style";
import ResumeOneColAtsPage from "./ResumeOneColAtsPage";
import type { ResumeData } from "./resume.types";

export const WORKSHOP_TEMPLATE_RENDERER_ID = "workshop_resume_onecol_ats";
export const RESUME_TEMPLATE_PAGE_GAP_PX = 24;

type ResumeTemplateRendererProps = {
  data: ResumeData;
  stylePreset: VerbatiStylePreset;
  resumeTemplateId: ResumeTemplateId;
  committedPages?: WorkshopResumeCommittedPage[];
  activeTarget?: ResumeActiveTarget | null;
  stageLayout?: DocumentStageLayout;
  onStablePageCountChange?: ((pageCount: number) => void) | undefined;
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
    ...buildVerbatiThemeVars(stylePreset),
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
  committedPages,
  activeTarget = null,
  stageLayout,
  onStablePageCountChange,
}: ResumeTemplateRendererProps) {
  const templateDefinition = getResumeTemplateDefinition(resumeTemplateId);
  const isWorkshopTemplateRenderer =
    resumeTemplateId === WORKSHOP_TEMPLATE_RENDERER_ID &&
    templateDefinition.supportsPlanner;
  const plannedPages = React.useMemo(
    () =>
      isWorkshopTemplateRenderer && (!committedPages || committedPages.length === 0)
        ? planWorkshopResumePages({
            data,
            template: templateDefinition,
            stylePreset,
          })
        : null,
    [committedPages, data, isWorkshopTemplateRenderer, stylePreset, templateDefinition],
  );
  const resolvedCommittedPages = React.useMemo(
    () =>
      committedPages && committedPages.length > 0
        ? committedPages
        : plannedPages?.committedPages ?? null,
    [committedPages, plannedPages],
  );
  const resolvedPageCount = resolvedCommittedPages?.length ?? 0;
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

  React.useEffect(() => {
    if (
      !isWorkshopTemplateRenderer ||
      !onStablePageCountChange ||
      !resolvedCommittedPages
    ) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      if (lastCommittedPageCountRef.current === resolvedPageCount) {
        return;
      }

      lastCommittedPageCountRef.current = resolvedPageCount;
      onStablePageCountChange(resolvedPageCount);
    }, 40);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    isWorkshopTemplateRenderer,
    onStablePageCountChange,
    resolvedCommittedPages,
    resolvedPageCount,
  ]);

  if (!isWorkshopTemplateRenderer || !resolvedCommittedPages || !previewVars) {
    return null;
  }

  return (
    <div
      data-testid="resume-template-renderer"
      className="resume-template-renderer"
      style={{
        ...previewVars,
        width: `${shellPageWidthPx}px`,
        minHeight: `${getResumeTemplateCanvasHeight({
          pageCount: resolvedPageCount,
          pageHeightPx: shellPageHeightPx,
        })}px`,
        display: "grid",
        gap: `${RESUME_TEMPLATE_PAGE_GAP_PX}px`,
        alignContent: "start",
      }}
    >
      {resolvedCommittedPages.map((page) => (
        <div
          key={`workshop-page-${page.index + 1}`}
          className="resume-template-page-shell"
          data-resume-template-page-shell="true"
          data-resume-template-page-index={page.index + 1}
          style={{
            width: `${shellPageWidthPx}px`,
            minHeight: `${shellPageHeightPx}px`,
            height: `${shellPageHeightPx}px`,
            boxSizing: "border-box",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            className="resume-template-page-canvas"
            style={{
              width: `${A4_PAGE_WIDTH_PX}px`,
              minHeight: `${A4_PAGE_HEIGHT_PX}px`,
              height: `${A4_PAGE_HEIGHT_PX}px`,
              boxSizing: "border-box",
              background: "var(--paper)",
              boxShadow:
                "0 1px 2px rgba(20, 20, 20, 0.06), 0 18px 36px rgba(20, 20, 20, 0.08)",
              transform: `scale(${previewScale})`,
              transformOrigin: "top left",
              position: "absolute",
              top: 0,
              left: 0,
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
