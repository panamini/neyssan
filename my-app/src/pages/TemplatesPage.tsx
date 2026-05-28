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
  | "letterpress"
  | "director-letterhead"
  | "volk-letterhead"
  | "film-foto-letterhead";

type TemplateCard = {
  id: string;
  name: string;
  kind: "Cover letter" | "Resume";
  family: TemplateFamily;
  descriptionKey: UiMessageKey;
};

type ResumeTemplateIntent = "minimal" | "french";
type CoverLetterTemplateIntent = "minimal" | "direct" | "editorial";
type TemplateRouteIntent = ResumeTemplateIntent | CoverLetterTemplateIntent | ProposalTemplateId;

const TEMPLATES: TemplateCard[] = [
  {
    id: "workshop-one-column-resume",
    name: "Minimal",
    kind: "Resume",
    family: "workshop-onecol",
    descriptionKey: "templates.description.workshopOneColumnResume",
  },
  {
    id: "workshop-two-column-resume",
    name: "French",
    kind: "Resume",
    family: "workshop-twocol",
    descriptionKey: "templates.description.workshopTwoColumnResume",
  },
  {
    id: "minimal-letter",
    name: "Minimal",
    kind: "Cover letter",
    family: "minimal",
    descriptionKey: "templates.description.minimalLetter",
  },
  {
    id: "bold-letter",
    name: "French",
    kind: "Cover letter",
    family: "bold",
    descriptionKey: "templates.description.boldLetter",
  },
  {
    id: "letterpress-letter",
    name: "Editorial",
    kind: "Cover letter",
    family: "letterpress",
    descriptionKey: "templates.description.letterpressLetter",
  },
  {
    id: "director-letterhead",
    name: "Director Letterhead",
    kind: "Cover letter",
    family: "director-letterhead",
    descriptionKey: "templates.description.minimalLetter",
  },
  {
    id: "volk-letterhead",
    name: "Volk Letterhead",
    kind: "Cover letter",
    family: "volk-letterhead",
    descriptionKey: "templates.description.boldLetter",
  },
  {
    id: "film-foto-letterhead",
    name: "Film und Foto Letterhead",
    kind: "Cover letter",
    family: "film-foto-letterhead",
    descriptionKey: "templates.description.letterpressLetter",
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
  "director-letterhead": resolveVerbatiStyle({
    familyId: "workshop",
    typography: "expert",
    palette: "terre",
  }),
  "volk-letterhead": resolveVerbatiStyle({
    familyId: "workshop",
    typography: "expert",
    palette: "ochre",
  }),
  "film-foto-letterhead": resolveVerbatiStyle({
    familyId: "workshop",
    typography: "expert",
    palette: "terre",
  }),
};

const PROPOSAL_PREVIEW_TEMPLATES: Partial<Record<TemplateFamily, ProposalTemplateId>> = {
  minimal: "workshop_proposal_margin",
  bold: "modernist_signal",
  letterpress: "quire_margin",
  "director-letterhead": "director-letterhead",
  "volk-letterhead": "volk-letterhead",
  "film-foto-letterhead": "film-foto-letterhead",
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

function templateKindLabelI18n(
  kind: TemplateCard["kind"],
  t: (key: UiMessageKey) => string,
): string {
  return kind === "Resume" ? t("templates.resume") : t("templates.coverLetter");
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

function getCoverLetterRouteTemplateIntent(
  template: TemplateCard,
): TemplateRouteIntent | null {
  const styleSlotIntent = getCoverLetterTemplateIntent(template.family);
  if (styleSlotIntent) return styleSlotIntent;

  const directTemplateId = PROPOSAL_PREVIEW_TEMPLATES[template.family] ?? null;
  return directTemplateId && template.family.includes("letterhead")
    ? directTemplateId
    : null;
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
  const [selectedTemplate, setSelectedTemplate] =
    React.useState<TemplateCard | null>(null);
  const closePreviewButtonRef = React.useRef<HTMLButtonElement | null>(null);
  const previewCv = React.useMemo(() => currentCv ?? cvs[0] ?? null, [currentCv, cvs]);
  const visibleTemplates = React.useMemo(
    () => TEMPLATES.filter((template) => filterMatches(template, activeFilter)),
    [activeFilter],
  );

  React.useEffect(() => {
    if (!selectedTemplate) return;
    closePreviewButtonRef.current?.focus();
  }, [selectedTemplate]);

  React.useEffect(() => {
    if (!selectedTemplate) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedTemplate(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedTemplate]);

  const handleSelectTemplate = React.useCallback((template: TemplateCard) => {
    setSelectedTemplate(template);
  }, []);

  const handleCloseTemplatePreview = React.useCallback(() => {
    setSelectedTemplate(null);
  }, []);

  const handleCreateFromTemplate = React.useCallback(
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

      const templateIdParam = getCoverLetterRouteTemplateIntent(template);
      navigate(`/proposal${templateIdParam ? `?templateId=${templateIdParam}` : ""}`, {
        state: createProposalWorkspaceResetState(),
      });
    },
    [navigate],
  );

  const handleApplyTemplate = React.useCallback(
    (template: TemplateCard) => {
      if (template.kind === "Resume") {
        // TODO: Add a CvForge route/state action that applies a template to the
        // current CV without creating a blank document before enabling this.
        return;
      }

      const templateIdParam = getCoverLetterRouteTemplateIntent(template);
      navigate(`/proposal${templateIdParam ? `?templateId=${templateIdParam}` : ""}`);
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
              {t("templates.customizeStyle")}
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
                aria-pressed={selectedTemplate?.id === template.id}
                data-selected={selectedTemplate?.id === template.id ? "true" : undefined}
                onClick={() => handleSelectTemplate(template)}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  handleSelectTemplate(template);
                }}
              >
                <span className="dasti-template-card__preview" aria-hidden="true">
                  <span className="dasti-template-card__document-scale" data-testid="template-document-preview">
                    <TemplateDocumentPreview
                      kind={template.kind}
                      family={template.family}
                      previewCv={previewCv}
                    />
                  </span>
                </span>
                <span className="dasti-template-card__head">
                  <span className="dasti-template-card__title-line">
                    <span className="dasti-template-card__title">{template.name}</span>
                    <span className="dasti-template-card__kind">
                      {templateKindLabelI18n(template.kind, t)}
                    </span>
                  </span>
                </span>
              </article>
            );
          })}
        </div>

        {selectedTemplate ? (
          <div
            className="dasti-template-preview"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) {
                handleCloseTemplatePreview();
              }
            }}
          >
            <section
              className="dasti-template-preview__panel"
              role="dialog"
              aria-modal="true"
              aria-labelledby="template-preview-title"
              aria-describedby="template-preview-description"
            >
              <div className="dasti-template-preview__body">
                <div className="dasti-template-preview__copy">
                  <span className="dasti-template-preview__kind">
                    {templateKindLabelI18n(selectedTemplate.kind, t)}
                  </span>
                  <h2 id="template-preview-title">
                    {selectedTemplate.name}
                  </h2>
                  <p id="template-preview-description">
                    {t(selectedTemplate.descriptionKey)}
                  </p>
                </div>
                <div
                  className="dasti-template-preview__document"
                  data-testid="selected-template-document-preview"
                  aria-hidden="true"
                >
                  <TemplateDocumentPreview
                    kind={selectedTemplate.kind}
                    family={selectedTemplate.family}
                    previewCv={previewCv}
                  />
                </div>
              </div>
              <div className="dasti-template-preview__actions">
                <button
                  ref={closePreviewButtonRef}
                  type="button"
                  onClick={handleCloseTemplatePreview}
                  className="ds-btn ds-btn--md ds-btn--ghost dasti-template-preview__close"
                >
                  {t("templates.preview.close")}
                </button>
                <Button
                  type="button"
                  variant="secondary"
                  size="md"
                  onClick={() => handleApplyTemplate(selectedTemplate)}
                  disabled={selectedTemplate.kind === "Resume"}
                >
                  {selectedTemplate.kind === "Resume"
                    ? t("templates.preview.applyCurrentCv")
                    : t("templates.preview.applyCurrentProposal")}
                </Button>
                <Button
                  type="button"
                  variant="primary"
                  size="md"
                  onClick={() => handleCreateFromTemplate(selectedTemplate)}
                >
                  {selectedTemplate.kind === "Resume"
                    ? t("templates.preview.createNewCv")
                    : t("templates.preview.createNewProposal")}
                </Button>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default TemplatesPage;
