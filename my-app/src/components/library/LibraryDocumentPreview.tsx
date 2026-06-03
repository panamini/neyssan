import React from "react";

import { ProposalDocumentRenderer } from "../proposal-render/ProposalDocumentRenderer";
import ResumePage from "../../features/verbati/resume/ResumePage";
import ResumeTemplateRenderer from "../../features/verbati/resume/ResumeTemplateRenderer";
import { resolveVerbatiStyle } from "../../features/verbati/style";
import { A4_PAGE_HEIGHT_PX, A4_PAGE_WIDTH_PX } from "../../lib/document-stage";
import { buildStyledResumePrintSource } from "../../lib/document-export-models";
import {
  resolvePreviewCanonicalAppearance,
  serializeProposalDocumentThemeVars,
} from "../../lib/layout/documentAppearance";
import { getProposalDocumentTypography } from "../../lib/proposal-document-typography";
import type { LibraryItem } from "../../lib/application-library";
import { EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID } from "../../lib/layout/resumeTemplates";
import type { CvDocument } from "../../types/cvDocument";

const DRAWER_THUMBNAIL_WIDTH_PX = 136;
const DRAWER_THUMBNAIL_SCALE = DRAWER_THUMBNAIL_WIDTH_PX / A4_PAGE_WIDTH_PX;
const DRAWER_TILE_PREVIEW_SCALE = 0.18;

const LIBRARY_PROPOSAL_PREVIEW_STYLE = resolveVerbatiStyle({
  familyId: "workshop",
  typography: "geist-baskervville",
  palette: "sauge",
});

function isLibrarySummaryOnlyCv(cv: CvDocument | null | undefined): boolean {
  return Boolean(
    (cv?.metadata as { librarySummaryOnly?: boolean } | undefined)
      ?.librarySummaryOnly,
  );
}

function proposalContext(item: LibraryItem): string {
  if (item.type === "cv") return "CV profile";
  return [
    item.jobId || item.jobTitle ? "Job linked" : null,
    item.linkedCvTitle
      ? `CV: ${item.linkedCvTitle}`
      : item.linkedCvId
        ? "CV linked"
        : null,
  ]
    .filter(Boolean)
    .join(" · ") || "Proposal";
}

export function DrawerDocumentThumbnail({
  item,
  cvDocument,
}: {
  item: LibraryItem;
  cvDocument?: CvDocument | null;
}): JSX.Element {
  const document = cvDocument ?? item.cvDocument ?? null;
  const context = proposalContext(item);

  return (
    <span
      className="forge-template-card__preview forge-rail-thumbnail"
      data-kind={item.type}
      aria-hidden="true"
    >
      <span
        className="forge-template-card__page forge-rail-thumbnail__page"
        style={
          {
            width: A4_PAGE_WIDTH_PX,
            height: A4_PAGE_HEIGHT_PX,
            transform: `scale(${DRAWER_THUMBNAIL_SCALE})`,
          } as React.CSSProperties
        }
      >
        {item.type === "proposal" ? (
          <ProposalDocumentRenderer
            content={item.content ?? item.subtitle ?? item.title}
            proposalType="cover_letter"
            templateId="workshop_proposal_margin"
            railTitle={item.title}
            railMeta={context}
            documentTitle={item.title}
            documentMeta={context}
            documentTypography={getProposalDocumentTypography(
              "direct",
              LIBRARY_PROPOSAL_PREVIEW_STYLE,
            )}
            pageWidth={A4_PAGE_WIDTH_PX}
            stylePreset={LIBRARY_PROPOSAL_PREVIEW_STYLE}
            documentThemeVars={serializeProposalDocumentThemeVars(
              resolvePreviewCanonicalAppearance(LIBRARY_PROPOSAL_PREVIEW_STYLE),
            )}
          />
        ) : document && !isLibrarySummaryOnlyCv(document) ? (
          <LibraryCvThumbnailPage cvDocument={document} />
        ) : null}
      </span>
    </span>
  );
}

export function DrawerDocumentTile({
  item,
  cvDocument,
  badge,
  actionPill,
}: {
  item: LibraryItem;
  cvDocument?: CvDocument | null;
  badge?: string | null;
  actionPill?: React.ReactNode;
}): JSX.Element {
  const document = cvDocument ?? item.cvDocument ?? null;
  const context = proposalContext(item);

  return (
    <span className="forge-rail-document-tile" data-kind={item.type}>
      <span className="forge-rail-document-tile__preview" aria-hidden="true">
        <span
          className="forge-rail-document-tile__page"
          style={
            {
              width: A4_PAGE_WIDTH_PX,
              height: A4_PAGE_HEIGHT_PX,
              transform: `scale(${DRAWER_TILE_PREVIEW_SCALE})`,
            } as React.CSSProperties
          }
        >
          {item.type === "proposal" ? (
            <ProposalDocumentRenderer
              content={item.content ?? item.subtitle ?? item.title}
              proposalType="cover_letter"
              templateId="workshop_proposal_margin"
              railTitle={item.title}
              railMeta={context}
              documentTitle={item.title}
              documentMeta={context}
              documentTypography={getProposalDocumentTypography(
                "direct",
                LIBRARY_PROPOSAL_PREVIEW_STYLE,
              )}
              pageWidth={A4_PAGE_WIDTH_PX}
              stylePreset={LIBRARY_PROPOSAL_PREVIEW_STYLE}
              documentThemeVars={serializeProposalDocumentThemeVars(
                resolvePreviewCanonicalAppearance(LIBRARY_PROPOSAL_PREVIEW_STYLE),
              )}
            />
          ) : document && !isLibrarySummaryOnlyCv(document) ? (
            <LibraryCvThumbnailPage cvDocument={document} />
          ) : null}
        </span>
        {badge ? (
          <span className="forge-rail-document-tile__badge">{badge}</span>
        ) : null}
        {actionPill ? (
          <span className="forge-rail-drawer__thumb-affordance">
            {actionPill}
          </span>
        ) : null}
      </span>
      <span className="forge-rail-document-tile__caption">
        <strong>{item.title}</strong>
        <span>{context}</span>
      </span>
    </span>
  );
}

export function LibraryCvThumbnailPage({
  cvDocument,
}: {
  cvDocument: CvDocument;
}): JSX.Element | null {
  const preview = React.useMemo(() => {
    if (isLibrarySummaryOnlyCv(cvDocument)) return null;
    const source = buildStyledResumePrintSource({ currentCv: cvDocument });
    return source
      ? {
          data: source.resumeData,
          stylePreset: source.stylePreset,
          resumeTemplateId: source.resumeTemplateId,
          rendererVariantId: source.rendererVariantId,
          pageSize: source.pageSize,
          committedPages: source.committedPages?.slice(0, 1),
        }
      : null;
  }, [cvDocument]);

  if (!preview) return null;

  return (
    preview.resumeTemplateId === EDITORIAL_SIDEBAR_RESUME_TEMPLATE_ID ? (
      <ResumePage
        data={preview.data}
        mode={preview.rendererVariantId}
        stylePreset={preview.stylePreset}
        pageSize={preview.pageSize}
      />
    ) : (
      <ResumeTemplateRenderer
        data={preview.data}
        stylePreset={preview.stylePreset}
        resumeTemplateId={preview.resumeTemplateId}
        committedPages={preview.committedPages}
      />
    )
  );
}

export function DrawerUnavailableThumbnail({
  label = "Preview unavailable",
}: {
  label?: string;
}): JSX.Element {
  return (
    <span className="forge-rail-document-tile" data-kind="unavailable">
      <span className="forge-rail-document-tile__preview forge-rail-thumbnail--unavailable">
        <span>{label}</span>
      </span>
    </span>
  );
}
