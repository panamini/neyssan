import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { ResumeTemplateRenderer } from "../features/verbati/resume/ResumeTemplateRenderer";
import { resumeMock, resumeMockOnecol } from "../features/verbati/resume/resume.mock";
import { resolveVerbatiStyle } from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { ProposalDocumentRenderer } from "../components/proposal-render/ProposalDocumentRenderer";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";
import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import { A4_PAGE_WIDTH_PX } from "../lib/document-stage";
import { buildStyledResumePrintSource } from "../lib/document-export-models";
import {
  resolvePreviewCanonicalAppearance,
  serializeProposalDocumentThemeVars,
} from "../lib/layout/documentAppearance";
import { getResumeTemplateDefinition } from "../lib/layout/resumeTemplates";
import { planWorkshopResumePages } from "../lib/resume/resumePagination";
import { createProposalWorkspaceResetState } from "../lib/proposal-workspace-state";
import { templatePreviewApplicant, templatePreviewProposal } from "./templatePreviewSamples";
import type { CvDocument } from "../types/cvDocument";
import { translateUi, type UiMessageKey } from "../lib/i18n";
import { useUiLanguagePreference } from "../lib/ui-preferences";

const TEMPLATE_FILTERS = ["cover letters", "resume"] as const;
type TemplateFilter = (typeof TEMPLATE_FILTERS)[number];

export type TemplateFamily =
  | "workshop-onecol"
  | "workshop-twocol"
  | "minimal"
  | "bold"
  | "letterpress";

type TemplateCard = {
  id: string;
  name: string;
  kind: "Cover letter" | "Resume";
  family: TemplateFamily;
  description: string;
};

type ResumeTemplateIntent = "minimal" | "french";
type CoverLetterTemplateIntent = "minimal" | "direct" | "editorial";

const TEMPLATES: TemplateCard[] = [
  {
    id: "workshop-one-column-resume",
    name: "Minimal",
    kind: "Resume",
    family: "workshop-onecol",
    description: "Clean, readable, safe.",
  },
  {
    id: "workshop-two-column-resume",
    name: "French",
    kind: "Resume",
    family: "workshop-twocol",
    description: "Structured European layout.",
  },
  {
    id: "minimal-letter",
    name: "Minimal",
    kind: "Cover letter",
    family: "minimal",
    description: "Quiet spacing, clear hierarchy.",
  },
  {
    id: "bold-letter",
    name: "French",
    kind: "Cover letter",
    family: "bold",
    description: "Sharper opening, direct tone.",
  },
  {
    id: "letterpress-letter",
    name: "Editorial",
    kind: "Cover letter",
    family: "letterpress",
    description: "Warmer, more personal.",
  },
];

const TEMPLATE_STYLE_PRESETS: Record<TemplateFamily, VerbatiStylePreset> = {
  "workshop-onecol": resolveVerbatiStyle({
    familyId: "workshop",
    typography: "geist-baskervville",
    palette: "sauge",
    resumeTemplateId: "workshop_resume_onecol_ats",
  }),
  "workshop-twocol": resolveVerbatiStyle({
    familyId: "workshop",
    typography: "geist-baskervville",
    palette: "sauge",
    resumeTemplateId: "workshop_resume_twocol_ats",
  }),
  minimal: resolveVerbatiStyle({
    familyId: "workshop",
    typography: "geist-baskervville",
    palette: "sauge",
  }),
  bold: resolveVerbatiStyle({
    familyId: "modernist",
    typography: "ledger-sans",
    palette: "ink",
  }),
  letterpress: resolveVerbatiStyle({
    familyId: "quire",
    typography: "quiet-editorial",
    palette: "terre",
  }),
};

const PROPOSAL_PREVIEW_TEMPLATES: Partial<Record<TemplateFamily, ProposalTemplateId>> = {
  minimal: "workshop_proposal_margin",
  bold: "modernist_signal",
  letterpress: "quire_margin",
};

function filterMatches(template: TemplateCard, filter: TemplateFilter): boolean {
  if (filter === "cover letters") return template.kind === "Cover letter";
  return template.kind === "Resume";
}

function filterLabelI18n(
  filter: TemplateFilter,
  t: (key: UiMessageKey) => string,
): string {
  return filter === "resume"
    ? t("templates.resume")
    : t("templates.coverLetters");
}

function getResumeTemplateIntent(
  family: TemplateFamily,
): ResumeTemplateIntent | null {
  if (family === "workshop-onecol") return "minimal";
  if (family === "workshop-twocol") return "french";
  return null;
}

function getCoverLetterTemplateIntent(
  family: TemplateFamily,
): CoverLetterTemplateIntent | null {
  if (family === "minimal") return "minimal";
  if (family === "bold") return "direct";
  if (family === "letterpress") return "editorial";
  return null;
}

export function TemplateDocumentPreview({
  kind,
  family,
  previewCv,
}: {
  kind: TemplateCard["kind"];
  family: TemplateFamily;
  previewCv?: CvDocument | null;
}): JSX.Element {
  const stylePreset = TEMPLATE_STYLE_PRESETS[family];

  if (kind === "Resume") {
    const resumeTemplateId =
      family === "workshop-onecol"
        ? "workshop_resume_onecol_ats"
        : "workshop_resume_twocol_ats";
    const cvPreviewSource = previewCv
      ? buildStyledResumePrintSource({ currentCv: previewCv })
      : null;
    const previewData =
      cvPreviewSource?.resumeData ??
      (family === "workshop-onecol" ? resumeMockOnecol : resumeMock);
    const resolvedStylePreset = cvPreviewSource?.stylePreset ?? stylePreset;
    const resolvedResumeTemplateId =
      cvPreviewSource?.resumeTemplateId ?? resumeTemplateId;
    const previewPages =
      cvPreviewSource?.committedPages ??
      planWorkshopResumePages({
        data: previewData,
        template: getResumeTemplateDefinition(resolvedResumeTemplateId),
        stylePreset: resolvedStylePreset,
      }).committedPages;
    const firstPreviewPage = previewPages?.[0];

    return (
      <ResumeTemplateRenderer
        data={previewData}
        stylePreset={resolvedStylePreset}
        resumeTemplateId={resolvedResumeTemplateId}
        committedPages={firstPreviewPage ? [firstPreviewPage] : undefined}
      />
    );
  }

  return (
    <ProposalDocumentRenderer
      content={templatePreviewProposal.content}
      proposalType="cover_letter"
      templateId={PROPOSAL_PREVIEW_TEMPLATES[family] ?? "workshop_proposal_margin"}
      railTitle={templatePreviewProposal.railTitle}
      railMeta={templatePreviewProposal.railMeta}
      contactLine={templatePreviewProposal.contactLine}
      letterDate={templatePreviewProposal.letterDate}
      recipientDetails={templatePreviewProposal.recipientDetails}
      documentTitle={templatePreviewProposal.documentTitle}
      documentMeta={templatePreviewProposal.documentMeta}
      applicantHeader={templatePreviewApplicant}
      headerVisibility={templatePreviewProposal.headerVisibility}
      documentTypography={getProposalDocumentTypography("direct", stylePreset)}
      pageWidth={A4_PAGE_WIDTH_PX}
      stylePreset={stylePreset}
      documentThemeVars={serializeProposalDocumentThemeVars(
        resolvePreviewCanonicalAppearance(stylePreset),
      )}
    />
  );
}

export function TemplatesPage(): JSX.Element {
  const navigate = useNavigate();
  const { resolvedLanguage } = useUiLanguagePreference();
  const t = React.useCallback(
    (key: UiMessageKey) => translateUi(resolvedLanguage, key),
    [resolvedLanguage],
  );
  const { currentCv, cvs } = useCvLibrary();
  const [activeFilter, setActiveFilter] = React.useState<TemplateFilter>("cover letters");
  const previewCv = React.useMemo(() => currentCv ?? cvs[0] ?? null, [currentCv, cvs]);
  const visibleTemplates = React.useMemo(
    () => TEMPLATES.filter((template) => filterMatches(template, activeFilter)),
    [activeFilter],
  );
  const handleUseTemplate = React.useCallback(
    (template: TemplateCard) => {
      if (template.kind === "Resume") {
        const templateIntent = getResumeTemplateIntent(template.family);
        navigate(
          `/cv?cvForgeAction=createBlank${
            templateIntent ? `&templateId=${templateIntent}` : ""
          }`,
        );
        return;
      }

      const templateIntent = getCoverLetterTemplateIntent(template.family);
      navigate(`/proposal${templateIntent ? `?templateId=${templateIntent}` : ""}`, {
        state: createProposalWorkspaceResetState(),
      });
    },
    [navigate],
  );

  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-templates-page">
        <div className="dasti-page-header dasti-templates-page__head">
          <div className="dasti-stack">
            <h1 className="dasti-stack__title page-head__title">
              {t("templates.title")}
            </h1>
            <p className="dasti-stack__subtitle page-head__sub">
              {t("templates.subtitle")}
            </p>
          </div>
          <div className="dasti-page-actions">
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={() => navigate("/settings?tab=docstyle")}
            >
              Customize style
            </Button>
          </div>
        </div>

        <div className="dasti-template-filter">
          <div className="library-tabs" role="tablist" aria-label={t("templates.type")}>
            {TEMPLATE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter}
                data-active={activeFilter === filter ? "true" : undefined}
                onClick={() => setActiveFilter(filter)}
              >
                {filterLabelI18n(filter, t)}
              </button>
            ))}
          </div>
        </div>

        <div
          className="dasti-template-grid"
          data-template-filter={activeFilter}
          aria-label={t("templates.templates")}
        >
          {visibleTemplates.map((template) => {
            const useTemplateLabel = `Use ${template.name} template`;

            return (
              <article
                key={template.id}
                role="button"
                tabIndex={0}
                className={`dasti-template-card dasti-template-card--${template.family}`}
                aria-label={useTemplateLabel}
                onClick={() => handleUseTemplate(template)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  handleUseTemplate(template);
                }}
              >
                <span className="dasti-template-card__head">
                  <span className="dasti-template-card__title-line">
                    <span className="dasti-template-card__title">{template.name}</span>
                    <span className="dasti-template-card__kind">{template.kind}</span>
                  </span>
                  <span className="dasti-template-card__description">{template.description}</span>
                </span>
                <span className="dasti-template-card__preview" aria-hidden="true">
                  <span className="dasti-template-card__document-scale" data-testid="template-document-preview">
                    <TemplateDocumentPreview
                      kind={template.kind}
                      family={template.family}
                      previewCv={previewCv}
                    />
                  </span>
                </span>
              </article>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export default TemplatesPage;
