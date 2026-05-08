import React from "react";

import { A4_PAGE_HEIGHT_PX, A4_PAGE_WIDTH_PX } from "../../../lib/document-stage";
import { normalizeResumePreviewTokens } from "../../../lib/layout/documentTokenNormalizer";
import {
  WORKSHOP_RESUME_ONECOL_TEMPLATE_ID,
  isWorkshopResumeTemplateId,
  isWorkshopTwoColumnResumeTemplateId,
  getResumeTemplateDefinition,
  type ResumeTemplateDefinition,
  type ResumeTemplateId,
} from "../../../lib/layout/resumeTemplates";
import { serializeResumePreviewVars } from "../../../lib/layout/documentTokenSerializers";
import {
  planWorkshopResumePages,
  type WorkshopResumeCommittedPage,
} from "../../../lib/resume/resumePagination";
import type { DocumentStageLayout } from "../../../hooks/use-document-stage-layout";
import type { ResumeActiveTarget } from "../resumeLinking";
import type { VerbatiStylePreset } from "../types";
import { buildVerbatiThemeVars } from "../style";
import ResumeOneColAtsPage, {
  type ResumePaperAiState,
  type ResumeSectionActions,
} from "./ResumeOneColAtsPage";
import ResumeTwoColAtsPage from "./ResumeTwoColAtsPage";
import type { ResumeData } from "./resume.types";
import type { ResumeInlineEditing } from "./InlineEditableText";

export const WORKSHOP_TEMPLATE_RENDERER_ID = WORKSHOP_RESUME_ONECOL_TEMPLATE_ID;
export const RESUME_TEMPLATE_PAGE_GAP_PX = 24;

const WORKSHOP_PREVIEW_THEME_VAR_NAMES = [
  "--font-heading-family",
  "--font-body-family",
  "--color-text",
  "--color-text-muted",
  "--color-text-subtle",
  "--color-border-strong",
  "--color-accent",
  "--color-accent-hover",
  "--color-accent-soft",
  "--color-on-accent",
  "--paper",
] as const;

const WORKSHOP_PREVIEW_LAYOUT_VAR_NAMES = [
  "--page-width",
  "--page-height",
  "--margin-top",
  "--margin-right",
  "--margin-bottom",
  "--margin-left",
  "--sidebar-width",
  "--gutter-width",
  "--main-width",
  "--header-row-gap",
  "--header-summary-width",
  "--header-bottom-padding",
  "--display-size-adjust",
  "--title-size-adjust",
  "--body-size-adjust",
  "--body-sm-size-adjust",
  "--text-display-size",
  "--text-display-line",
  "--text-title-size",
  "--text-title-line",
  "--text-body-size",
  "--text-body-line",
  "--text-body-sm-size",
  "--text-body-sm-line",
  "--text-caption-size",
  "--text-caption-line",
  "--text-meta-size",
  "--text-meta-line",
  "--body-row-gap",
  "--main-heading-margin",
  "--workshop-section-title-reduction",
  "--workshop-experience-heading-size-adjust",
  "--workshop-experience-heading-line-height",
  "--flow-list-indent",
  "--experience-bullets-padding",
  "--skill-gap",
  "--skill-pad-inline",
  "--skill-pad-block",
  "--project-gap",
  "--project-padding",
  "--education-gap",
] as const;

type ResumeTemplateRendererProps = {
  data: ResumeData;
  stylePreset: VerbatiStylePreset;
  resumeTemplateId: ResumeTemplateId;
  committedPages?: WorkshopResumeCommittedPage[];
  activeTarget?: ResumeActiveTarget | null;
  inlineEditing?: ResumeInlineEditing | null;
  sectionActions?: ResumeSectionActions | null;
  paperAi?: ResumePaperAiState | null;
  stageLayout?: DocumentStageLayout;
  onStablePageCountChange?: ((pageCount: number) => void) | undefined;
};

function pickCssVars(
  source: Record<string, string | undefined>,
  names: readonly string[],
): Record<string, string> {
  return names.reduce<Record<string, string>>((result, name) => {
    const value = source[name];
    if (typeof value === "string" && value.length > 0) {
      result[name] = value;
    }
    return result;
  }, {});
}

function buildTemplatePreviewVars(
  templateDefinition: ResumeTemplateDefinition,
  stylePreset: VerbatiStylePreset,
) {
  const previewTokens = normalizeResumePreviewTokens({
    resumeTemplateId: templateDefinition.id,
    template: templateDefinition,
    stylePreset,
  });
  const themeVars = pickCssVars(
    buildVerbatiThemeVars(stylePreset) as Record<string, string | undefined>,
    WORKSHOP_PREVIEW_THEME_VAR_NAMES,
  );
  const layoutVars = pickCssVars(
    serializeResumePreviewVars(previewTokens),
    WORKSHOP_PREVIEW_LAYOUT_VAR_NAMES,
  );

  return {
    ...themeVars,
    ...layoutVars,
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
  inlineEditing = null,
  sectionActions = null,
  paperAi = null,
  stageLayout,
  onStablePageCountChange,
}: ResumeTemplateRendererProps) {
  const templateDefinition = getResumeTemplateDefinition(resumeTemplateId);
  const isWorkshopTemplateRenderer =
    isWorkshopResumeTemplateId(resumeTemplateId) &&
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
        ? buildTemplatePreviewVars(templateDefinition, stylePreset)
        : null,
    [isWorkshopTemplateRenderer, stylePreset, templateDefinition],
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
            {isWorkshopTwoColumnResumeTemplateId(templateDefinition.id) ? (
              <ResumeTwoColAtsPage
                data={data}
                page={page}
                template={templateDefinition}
                activeTarget={activeTarget}
                inlineEditing={inlineEditing}
                sectionActions={sectionActions}
                paperAi={paperAi}
              />
            ) : (
              <ResumeOneColAtsPage
                data={data}
                page={page}
                template={templateDefinition}
                activeTarget={activeTarget}
                inlineEditing={inlineEditing}
                sectionActions={sectionActions}
                paperAi={paperAi}
              />
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ResumeTemplateRenderer;
