import React from "react";
import {
  ArrowSquareOut,
  Briefcase,
  ChevronDown,
  FilePdf,
  FileUser,
  FloppyDisk,
  Plus,
  TrashSimple,
  X,
} from "../../lib/icons";
import type { ProposalTemplateBundleId } from "../../lib/proposal-template-bundles";
import type { ProposalTemplateId } from "../../../convex/lib/proposals/renderTemplates";
import type { ProposalPaletteId } from "../../lib/proposal-style-display";
import { getProposalExtensionSourceLinks } from "../../lib/proposal-source-platforms";
import type { VerbatiStylePreset } from "../../features/verbati/types";
import { Button } from "../ui";
import { Menu, type MenuSection } from "../ui/menu";
export { PROPOSAL_STYLE_OPTIONS } from "./ProposalDesignFields";

type ProposalRailCvOption = {
  id: string;
  title: string;
  description: string | null;
  selected: boolean;
};

type ProposalRailToneOption = {
  id: string | null;
  label: string;
  description: string;
  tone: "auto" | "warm" | "formal" | "natural";
  selected: boolean;
};

type ProposalRailLengthOption = {
  id: "short" | "medium" | "long";
  label: string;
  description: string;
  selected: boolean;
};

type ProposalRailTab = "draft" | "ask";

export type ProposalRailJobMatchSummary = {
  label: string;
  tone: "strong" | "worth" | "maybe" | "skip";
  detail: string | null;
};

type ProposalRailProps = {
  jobTitle: string;
  company: string | null;
  location: string | null;
  jobHref: string | null;
  sourceLabel: string | null;
  sourceUrl: string | null;
  jobSummary: string | null;
  jobMatch: ProposalRailJobMatchSummary | null;
  sourceCvTitle: string | null;
  sourceCvMeta: string | null;
  draftTitle: string;
  draftTitlePlaceholder: string;
  onDraftTitleChange: (value: string) => void;
  onDraftTitleCommit: () => void;
  toneLabel: string;
  toneOptions: ProposalRailToneOption[];
  onSelectTone: (toneId: string | null) => void;
  lengthOptions: ProposalRailLengthOption[];
  onSelectLength: (lengthId: ProposalRailLengthOption["id"]) => void;
  proposalTemplateId?: ProposalTemplateId | null;
  onSelectProposalLayout?: (templateId: ProposalTemplateId) => void;
  stylePreset: VerbatiStylePreset;
  styleTemplateBundleBaseStyle?: VerbatiStylePreset | null;
  styleTemplateBundleId: ProposalTemplateBundleId | null;
  onSelectStyleBundle: (bundleId: ProposalTemplateBundleId) => void;
  onResetStyleBundle?: (bundleId: ProposalTemplateBundleId) => void;
  onSelectStyleTypography: (typography: VerbatiStylePreset["typography"]) => void;
  onSelectStylePalette: (palette: ProposalPaletteId) => void;
  onSelectStyleFixedAccent?: (hex: string) => void;
  onSelectStyleCustomAccent: (hex: string) => void;
  onClearStyleCustomAccent?: () => void;
  signaturePresent?: boolean;
  handwrittenSignatureAvailable?: boolean;
  handwrittenSignatureEnabled?: boolean;
  onChooseSignature?: () => void;
  onToggleSignature?: (enabled: boolean) => void;
  onToggleHandwrittenSignature?: (enabled: boolean) => void;
  aiStream: React.ReactNode;
  hasProposalContent: boolean;
  generateLabel: string;
  generateDisabled: boolean;
  generateState: "idle" | "loading" | "success" | "error";
  onGenerateDraft: () => void;
  onNewProposal?: () => void;
  onSaveToLibrary?: () => void;
  onDeleteProposal?: () => void;
  cvOptions: ProposalRailCvOption[];
  onSelectCv: (cvId: string) => void;
  onClearCv: () => void;
  onCreateCv: () => void;
  onImportCv: () => void;
  jobOfferText?: string;
  onJobOfferTextChange?: (value: string) => void;
  onJobOfferTextCommit?: () => void;
  onOpenJobs?: () => void;
  onClearJobContext?: () => void;
  askAiValue: string;
  askAiBusy: boolean;
  askAiDisabled: boolean;
  askAiPlaceholder: string;
  askAiHint: string;
  onAskAiChange: (value: string) => void;
  onAskAiSubmit: () => void;
};

export function ProposalRail({
  jobTitle,
  company,
  location,
  jobHref,
  sourceLabel,
  sourceUrl,
  jobSummary,
  jobMatch,
  sourceCvTitle,
  sourceCvMeta,
  draftTitle,
  draftTitlePlaceholder,
  onDraftTitleChange,
  onDraftTitleCommit,
  toneLabel,
  toneOptions,
  onSelectTone,
  lengthOptions,
  onSelectLength,
  aiStream,
  hasProposalContent,
  generateLabel,
  generateDisabled,
  generateState,
  onGenerateDraft,
  onNewProposal,
  onSaveToLibrary,
  onDeleteProposal,
  cvOptions,
  onSelectCv,
  onClearCv,
  onCreateCv,
  onImportCv,
  jobOfferText = "",
  onJobOfferTextChange,
  onJobOfferTextCommit,
  onOpenJobs,
  onClearJobContext,
  askAiValue,
  askAiBusy,
  askAiDisabled,
  askAiPlaceholder,
  askAiHint,
  onAskAiChange,
  onAskAiSubmit,
}: ProposalRailProps): JSX.Element {
  const [activeTab, setActiveTab] = React.useState<ProposalRailTab>("draft");
  const [jobContextOpen, setJobContextOpen] = React.useState(false);
  const [jobTextEditing, setJobTextEditing] = React.useState(false);
  const jobOfferTextareaRef = React.useRef<HTMLTextAreaElement | null>(null);
  const jobMeta = [company, location].filter(Boolean).join(" · ");
  const compactJobSummary = jobSummary?.trim() || jobMeta || null;
  const trimmedJobOfferText = jobOfferText.trim();
  const hasPastedJobText = Boolean(jobOfferText.trim());
  const hasLoadedJobContext = Boolean(
    jobTitle?.trim() || compactJobSummary || jobHref || sourceUrl,
  );
  const hasActiveJobContext = Boolean(
    hasLoadedJobContext || hasPastedJobText,
  );
  const jobContextState = hasLoadedJobContext ? "loaded" : hasPastedJobText ? "pasted" : "empty";
  const jobContextTitle =
    jobContextState === "loaded" ? jobTitle?.trim() || "Untitled job offer"
    : jobContextState === "pasted" ? "Job offer added"
    : "No job loaded";
  const loadedJobMeta = [company, sourceLabel, location].filter(Boolean).join(" · ");
  const jobSiteLinks = React.useMemo(() => getProposalExtensionSourceLinks(), []);

  React.useEffect(() => {
    if (!hasActiveJobContext) {
      setJobContextOpen(true);
    }
  }, [hasActiveJobContext]);

  React.useEffect(() => {
    if (jobContextState !== "pasted") {
      setJobTextEditing(false);
    }
  }, [jobContextState]);

  React.useEffect(() => {
    if (jobTextEditing) {
      jobOfferTextareaRef.current?.focus();
    }
  }, [jobTextEditing]);

  const cvMenuSections = React.useMemo<MenuSection[]>(() => {
    const cvItems = cvOptions.map((option) => ({
      id: option.id,
      role: "menuitemradio" as const,
      selected: option.selected,
      label: option.title,
      onSelect: () => onSelectCv(option.id),
    }));

    return [
      {
        items: [
          {
            id: "create-cv",
            label: "Create new CV",
            icon: <FileUser size={15} strokeWidth={1.8} />,
            onSelect: onCreateCv,
          },
          {
            id: "import-cv",
            label: "Import PDF",
            icon: <FilePdf size={15} strokeWidth={1.8} />,
            onSelect: onImportCv,
          },
          ...(sourceCvTitle
            ? [
                {
                  id: "detach-cv",
                  label: "Remove attached CV",
                  icon: <X size={15} strokeWidth={1.9} />,
                  onSelect: onClearCv,
                },
              ]
            : []),
        ],
      },
      {
        label: "Pick a CV",
        items:
          cvItems.length > 0
            ? cvItems
            : [
                {
                  id: "no-cvs",
                  label: "No CVs available",
                  description: "Create or import a PDF first.",
                  disabled: true,
                },
              ],
      },
    ];
  }, [cvOptions, onClearCv, onCreateCv, onImportCv, onSelectCv, sourceCvTitle]);

  const selectedToneOption =
    toneOptions.find((option) => option.selected) ?? toneOptions[0] ?? null;
  const selectedLengthOption =
    lengthOptions.find((option) => option.selected) ?? lengthOptions[1] ?? lengthOptions[0] ?? null;

  const toneMenuSections = React.useMemo<MenuSection[]>(
    () => [
      {
        label: "Tone",
        items: toneOptions.map((option) => ({
          id: option.id ?? "auto",
          role: "menuitemradio" as const,
          selected: option.selected,
          label: option.label,
          description: option.description,
          onSelect: () => onSelectTone(option.id),
        })),
      },
    ],
    [onSelectTone, toneOptions],
  );

  const lengthMenuSections = React.useMemo<MenuSection[]>(
    () => [
      {
        label: "Length",
        items: lengthOptions.map((option) => ({
          id: option.id,
          role: "menuitemradio" as const,
          selected: option.selected,
          label: option.label,
          ariaLabel: `${option.label} proposal length`,
          onSelect: () => onSelectLength(option.id),
        })),
      },
    ],
    [lengthOptions, onSelectLength],
  );

  const renderLengthSelect = (size: "sm" | "md") => (
    <Menu
      ariaLabel="Length"
      align="start"
      side="bottom"
      matchTriggerWidth={size === "md"}
      sections={lengthMenuSections}
      trigger={
        <button
          type="button"
          id={size === "sm" ? "proposal-rail-ask-length" : "proposal-rail-draft-length"}
          className={`ds-btn ds-btn--${size} ds-btn--secondary dasti-proposal-skeleton-rail__length-select dasti-toolbar-tooltip-trigger--above`}
          data-toolbar-tooltip={selectedLengthOption?.description ?? "Proposal length"}
        >
          <span>{selectedLengthOption?.label ?? "Standard"}</span>
          <ChevronDown className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
        </button>
      }
    />
  );

  const renderToneSelect = (size: "sm" | "md") => (
    <Menu
      ariaLabel="Tone"
      align={size === "sm" ? "end" : "start"}
      side="bottom"
      matchTriggerWidth={size === "md"}
      sections={toneMenuSections}
      trigger={
        <button
          type="button"
          className={`ds-btn ds-btn--${size} ds-btn--secondary dasti-proposal-skeleton-rail__tone-select dasti-toolbar-tooltip-trigger--above`}
          data-toolbar-tooltip={selectedToneOption?.description ?? "Proposal tone"}
        >
          <span>{toneLabel}</span>
          <ChevronDown className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
        </button>
      }
    />
  );

  return (
    <aside className="forge__rail dasti-proposal-skeleton-rail" aria-label="Proposal rail">
      <div className="dasti-proposal-skeleton-rail__tabs" role="tablist" aria-label="Proposal tools">
        {[
          ["draft", "Draft"],
          ["ask", "Ask"],
        ].map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={activeTab === id}
            className="dasti-proposal-skeleton-rail__tab"
            data-active={activeTab === id ? "true" : undefined}
            onClick={() => setActiveTab(id as ProposalRailTab)}
          >
            {label}
          </button>
        ))}
      </div>

      {aiStream ? <div className="dasti-proposal-skeleton-rail__process">{aiStream}</div> : null}

      {activeTab === "draft" ? (
        <>
      <section className="forge__rail-section dasti-proposal-skeleton-rail__section dasti-proposal-skeleton-rail__job-context">
        <button
          type="button"
          className="dasti-proposal-skeleton-rail__summary-row dasti-proposal-skeleton-rail__summary-row--job"
          aria-expanded={jobContextOpen}
          aria-controls="proposal-rail-job-context"
          onClick={() => setJobContextOpen((current) => !current)}
        >
          <span className="dasti-proposal-skeleton-rail__summary-copy">
            <span className="forge__rail-label dasti-proposal-skeleton-rail__label">Job context</span>
            <span className="forge__rail-title dasti-proposal-skeleton-rail__title">
              {jobContextTitle}
            </span>
            {jobContextState === "pasted" ? (
              <span className="dasti-proposal-skeleton-rail__summary-text">
                Pasted context
              </span>
            ) : compactJobSummary ? (
              <span className="dasti-proposal-skeleton-rail__summary-text">
                {compactJobSummary}
              </span>
            ) : !hasLoadedJobContext ? (
              <span className="dasti-proposal-skeleton-rail__summary-text">
                Capture, paste, or choose a job.
              </span>
            ) : null}
          </span>
          <ChevronDown className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
        </button>
        {jobContextOpen ? (
          <div id="proposal-rail-job-context" className="dasti-proposal-skeleton-rail__drawer-body">
            {jobContextState === "empty" ? (
              <div className="dasti-proposal-skeleton-rail__empty-job-context">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={onOpenJobs}
                  iconLeft={<Briefcase size={14} strokeWidth={1.8} />}
                >
                  Choose from Job Forge
                </Button>
                <textarea
                  ref={jobOfferTextareaRef}
                  className="ds-field ds-field--textarea dasti-proposal-skeleton-rail__job-offer-input"
                  value={jobOfferText}
                  placeholder="Paste a job offer..."
                  aria-label="Paste a job offer"
                  onChange={(event) => {
                    setJobTextEditing(true);
                    onJobOfferTextChange?.(event.target.value);
                  }}
                  onBlur={onJobOfferTextCommit}
                />
                <div className="dasti-proposal-skeleton-rail__job-sites-label">Open job sites</div>
                <div className="dasti-proposal-skeleton-rail__job-site-tokens" aria-label="Job sites">
                  {jobSiteLinks.map((site) => (
                    <a
                      key={site.label}
                      href={site.href}
                      target="_blank"
                      rel="noreferrer"
                      className="dasti-proposal-skeleton-rail__job-site-token"
                    >
                      {site.label}
                    </a>
                  ))}
                </div>
              </div>
            ) : null}
            {jobContextState === "pasted" ? (
              <div className="dasti-proposal-skeleton-rail__active-job-context">
                <div className="dasti-proposal-skeleton-rail__job-context-meta">
                  Pasted context
                </div>
                {jobTextEditing ? (
                  <textarea
                    ref={jobOfferTextareaRef}
                    className="ds-field ds-field--textarea dasti-proposal-skeleton-rail__job-offer-input"
                    value={jobOfferText}
                    placeholder="Paste a job offer..."
                    aria-label="Edit pasted job offer"
                    onChange={(event) => onJobOfferTextChange?.(event.target.value)}
                    onBlur={onJobOfferTextCommit}
                  />
                ) : (
                  <p className="dasti-proposal-skeleton-rail__job-preview">
                    {trimmedJobOfferText}
                  </p>
                )}
                <div className="dasti-proposal-skeleton-rail__job-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setJobTextEditing((current) => !current)}
                  >
                    {jobTextEditing ? "Preview" : "Edit job text"}
                  </Button>
                  {onClearJobContext ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      aria-label="Clear job context"
                      onClick={onClearJobContext}
                    >
                      Clear
                    </Button>
                  ) : null}
                </div>
              </div>
            ) : null}
            {jobContextState === "loaded" ? (
              <div className="dasti-proposal-skeleton-rail__active-job-context">
                {loadedJobMeta ? (
                  <div className="dasti-proposal-skeleton-rail__job-context-meta">
                    {loadedJobMeta}
                  </div>
                ) : null}
                {compactJobSummary ? (
                  <p className="dasti-proposal-skeleton-rail__job-preview">
                    {compactJobSummary}
                  </p>
                ) : null}
              </div>
            ) : null}
            {jobHref || sourceUrl ? (
              <div className="dasti-proposal-skeleton-rail__job-links">
                {sourceUrl ? (
                  <a
                    href={sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="dasti-proposal-skeleton-rail__job-link"
                    aria-label={`Open original job offer${sourceLabel ? ` on ${sourceLabel}` : ""}`}
                    title={`Open original job offer${sourceLabel ? ` on ${sourceLabel}` : ""}`}
                  >
                    <span>Source</span>
                    <ArrowSquareOut className="dasti-proposal-skeleton-rail__link-icon" aria-hidden="true" />
                  </a>
                ) : null}
                {jobHref ? (
                  <a href={jobHref} className="dasti-proposal-skeleton-rail__job-link">
                    <span>Job page</span>
                    <Briefcase className="dasti-proposal-skeleton-rail__link-icon" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
            ) : null}
            {jobContextState === "loaded" ? (
              <div className="dasti-proposal-skeleton-rail__job-actions">
                {onOpenJobs ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onOpenJobs}
                  >
                    Change job
                  </Button>
                ) : null}
                {onClearJobContext ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    aria-label="Clear job context"
                    onClick={onClearJobContext}
                  >
                    Clear
                  </Button>
                ) : null}
              </div>
            ) : null}
            {jobMatch ? (
              <div className={`dasti-proposal-skeleton-rail__match dasti-proposal-skeleton-rail__match--${jobMatch.tone}`}>
                <span className="dasti-proposal-skeleton-rail__match-dot" aria-hidden="true" />
                <span>
                  <strong>{jobMatch.label}</strong>
                  {jobMatch.detail ? <small>{jobMatch.detail}</small> : null}
                </span>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="forge__rail-section dasti-proposal-skeleton-rail__section">
        <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Draft</div>
        <div className="dasti-proposal-skeleton-rail__draft-setup">
          <div className="dasti-proposal-skeleton-rail__draft-setup-body">
            <label className="dasti-proposal-skeleton-rail__variable-field">
              <input
                className="ds-field"
                value={draftTitle}
                placeholder={draftTitlePlaceholder}
                title="Name this draft."
                onChange={(event) => onDraftTitleChange(event.target.value)}
                onBlur={onDraftTitleCommit}
                aria-label="Draft title"
              />
            </label>
            <div className="dasti-proposal-skeleton-rail__control-stack">
              <Menu
                ariaLabel={sourceCvTitle ? "Source CV" : "Pick a CV"}
                align="start"
                side="left"
                mobileMode="sheet"
                menuClassName="dasti-proposal-skeleton-rail__cv-action-menu"
                sections={cvMenuSections}
                trigger={
                  <button
                    type="button"
                    className="ds-btn ds-btn--md ds-btn--secondary dasti-proposal-skeleton-rail__cv-button"
                    title="Choose the CV used for this draft."
                  >
                    <span>
                      <strong>{sourceCvTitle || "Pick a CV"}</strong>
                      {sourceCvMeta ? <small>{sourceCvMeta}</small> : null}
                    </span>
                    <span className="dasti-proposal-skeleton-rail__cv-caret" aria-hidden="true">
                      <ChevronDown className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
                    </span>
                  </button>
                }
              />
            </div>
            <div className="dasti-proposal-skeleton-rail__control-stack">
              {renderToneSelect("md")}
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              title="Generate a draft from this job and CV."
              disabled={generateDisabled}
              data-state={generateState}
              onClick={onGenerateDraft}
            >
              {generateLabel}
            </Button>
            {onNewProposal || onSaveToLibrary || onDeleteProposal ? (
              <div
                className="dasti-proposal-skeleton-rail__draft-actions"
                role="group"
                aria-label="Draft actions"
              >
                {onNewProposal ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onNewProposal}
                    iconLeft={<Plus size={14} strokeWidth={1.8} />}
                  >
                    New proposal
                  </Button>
                ) : null}
                {onSaveToLibrary ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onSaveToLibrary}
                    disabled={!hasProposalContent}
                    aria-label="Save proposal to library"
                    title="Save proposal to library"
                    iconLeft={<FloppyDisk size={14} strokeWidth={1.8} />}
                  >
                    Save to library
                  </Button>
                ) : null}
                {onDeleteProposal ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={onDeleteProposal}
                    disabled={!hasProposalContent}
                    iconLeft={<TrashSimple size={14} strokeWidth={1.8} />}
                  >
                    Delete proposal
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </section>
        </>
      ) : null}

      {activeTab === "ask" ? (
      <section className="forge__rail-section dasti-proposal-skeleton-rail__section dasti-proposal-skeleton-rail__ask-section dasti-toolbar--surface-tooltips">
        <div className="dasti-proposal-skeleton-rail__ask-header">
          <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Ask</div>
        </div>
        <div className="dasti-proposal-skeleton-rail__ask-hub">
          <label
            className="dasti-proposal-skeleton-rail__ask-field dasti-toolbar-tooltip-trigger--above"
            data-toolbar-tooltip="Describe the change you want to apply to the current draft."
          >
            <span className="sr-only">Ask AI</span>
            <textarea
              className="ds-field ds-field--textarea"
              value={askAiValue}
              placeholder={askAiPlaceholder}
              disabled={askAiDisabled || askAiBusy}
              onChange={(event) => onAskAiChange(event.target.value)}
            />
          </label>
          <div className="dasti-proposal-skeleton-rail__ask-controls">
            {renderLengthSelect("sm")}
            {renderToneSelect("sm")}
          </div>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          data-toolbar-tooltip={askAiHint}
          disabled={askAiDisabled || askAiBusy || !askAiValue.trim()}
          onClick={onAskAiSubmit}
        >
          {askAiBusy ? "Applying…" : "Send"}
        </Button>
      </section>
      ) : null}

    </aside>
  );
}

export default ProposalRail;
