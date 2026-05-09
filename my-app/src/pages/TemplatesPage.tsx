import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../components/ui";
import { Check } from "../lib/icons";
import { ResumeTemplateRenderer } from "../features/verbati/resume/ResumeTemplateRenderer";
import { resumeMock, resumeMockOnecol } from "../features/verbati/resume/resume.mock";
import { resolveVerbatiStyle } from "../features/verbati/style";
import type { VerbatiStylePreset } from "../features/verbati/types";
import { ProposalDocumentRenderer } from "../components/proposal-render/ProposalDocumentRenderer";
import { getProposalDocumentTypography } from "../lib/proposal-document-typography";
import type { ProposalTemplateId } from "../../convex/lib/proposals/renderTemplates";
import { A4_PAGE_WIDTH_PX } from "../lib/document-stage";
import {
  resolvePreviewCanonicalAppearance,
  serializeProposalDocumentThemeVars,
} from "../lib/layout/documentAppearance";
import { getResumeTemplateDefinition } from "../lib/layout/resumeTemplates";
import { planWorkshopResumePages } from "../lib/resume/resumePagination";
import { templatePreviewApplicant, templatePreviewProposal } from "./templatePreviewSamples";

const TEMPLATE_FILTERS = ["cover letters", "resume"] as const;
type TemplateFilter = (typeof TEMPLATE_FILTERS)[number];

type TemplateFamily =
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

const TEMPLATES: TemplateCard[] = [
  {
    id: "workshop-one-column-resume",
    name: "Workshop one-col",
    kind: "Resume",
    family: "workshop-onecol",
    description: "Planner-backed Workshop resume with a focused single-column ATS page.",
  },
  {
    id: "workshop-two-column-resume",
    name: "Workshop two-col",
    kind: "Resume",
    family: "workshop-twocol",
    description: "Planner-backed Workshop resume with a 17/18-inspired two-column grid.",
  },
  {
    id: "minimal-letter",
    name: "Minimal",
    kind: "Cover letter",
    family: "minimal",
    description: "A clean letter with quiet spacing and straightforward hierarchy.",
  },
  {
    id: "bold-letter",
    name: "Bold",
    kind: "Cover letter",
    family: "bold",
    description: "A sharper letter direction for confident, product-led applications.",
  },
  {
    id: "letterpress-letter",
    name: "Letterpress",
    kind: "Cover letter",
    family: "letterpress",
    description: "A warmer editorial letter style for narrative applications.",
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

function filterLabel(filter: TemplateFilter): string {
  return filter === "resume" ? "Resume" : "Cover letters";
}

function TemplateDocumentPreview({
  kind,
  family,
}: {
  kind: TemplateCard["kind"];
  family: TemplateFamily;
}): JSX.Element {
  const stylePreset = TEMPLATE_STYLE_PRESETS[family];

  if (kind === "Resume") {
    const resumeTemplateId =
      family === "workshop-onecol"
        ? "workshop_resume_onecol_ats"
        : "workshop_resume_twocol_ats";
    const previewData = family === "workshop-onecol" ? resumeMockOnecol : resumeMock;
    const previewPages = planWorkshopResumePages({
      data: previewData,
      template: getResumeTemplateDefinition(resumeTemplateId),
      stylePreset,
    }).committedPages;
    const firstPreviewPage = previewPages[0];

    return (
      <ResumeTemplateRenderer
        data={previewData}
        stylePreset={stylePreset}
        resumeTemplateId={resumeTemplateId}
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
  const [activeFilter, setActiveFilter] = React.useState<TemplateFilter>("cover letters");
  const [selectedTemplateId, setSelectedTemplateId] = React.useState("minimal-letter");
  const visibleTemplates = React.useMemo(
    () => TEMPLATES.filter((template) => filterMatches(template, activeFilter)),
    [activeFilter],
  );

  return (
    <div className="dasti-page-scroll">
      <div className="dasti-page-shell dasti-templates-page">
        <div className="dasti-page-header dasti-templates-page__head">
          <div className="dasti-stack">
            <h1 className="dasti-stack__title page-head__title">Templates</h1>
            <p className="dasti-stack__subtitle page-head__sub">
              Pick a starting point. Customize fonts and accent in document style.
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
          <div className="library-tabs" role="tablist" aria-label="Template type">
            {TEMPLATE_FILTERS.map((filter) => (
              <button
                key={filter}
                type="button"
                role="tab"
                aria-selected={activeFilter === filter}
                data-active={activeFilter === filter ? "true" : undefined}
                onClick={() => setActiveFilter(filter)}
              >
                {filterLabel(filter)}
              </button>
            ))}
          </div>
        </div>

        <div className="dasti-template-grid" data-template-filter={activeFilter} aria-label="Templates">
          {visibleTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              className={`dasti-template-card dasti-template-card--${template.family}`}
              data-selected={selectedTemplateId === template.id ? "true" : "false"}
              onClick={() => {
                setSelectedTemplateId(template.id);
                navigate(template.kind === "Resume" ? "/cv" : "/proposal");
              }}
            >
              {selectedTemplateId === template.id ? (
                <span className="dasti-template-card__check" aria-label="Selected">
                  <Check size={13} strokeWidth={2.4} aria-hidden="true" />
                </span>
              ) : null}
              <span className="dasti-template-card__title">{template.name}</span>
              <span className="dasti-template-card__description">{template.description}</span>
              <span className="dasti-template-card__preview" aria-hidden="true">
                <span className="dasti-template-card__document-scale" data-testid="template-document-preview">
                  <TemplateDocumentPreview kind={template.kind} family={template.family} />
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export default TemplatesPage;
