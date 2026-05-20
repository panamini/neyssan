import React from "react";
import {
  ArrowSquareOut,
  Briefcase,
  ChevronDown,
  FilePdf,
  FileUser,
  PaperPlaneRight,
  X,
} from "../../lib/icons";
import type { FormValues } from "../ProposalInputForm.schemas";
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

type ProposalRailTypeOption = {
  id: FormValues["proposalType"];
  label: string;
  description?: string;
  selected: boolean;
};

export type ProposalRailTab = "draft" | "ask";

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
  proposalTypeLabel: string;
  proposalTypeOptions: ProposalRailTypeOption[];
  onSelectProposalType: (proposalType: FormValues["proposalType"]) => void;
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
  generateLabel: string;
  generateDisabled: boolean;
  generateState: string;
  onGenerateDraft: () => void;
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
  activeTab?: ProposalRailTab;
  onActiveTabChange?: (tab: ProposalRailTab) => void;
  hideTabs?: boolean;
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
  proposalTypeLabel,
  proposalTypeOptions,
  onSelectProposalType,
  toneLabel,
  toneOptions,
  onSelectTone,
  lengthOptions,
  onSelectLength,
  aiStream,
  generateLabel,
  generateDisabled,
  generateState,
  onGenerateDraft,
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
  activeTab: controlledActiveTab,
  onActiveTabChange,
  hideTabs = false,
}: ProposalRailProps): JSX.Element {
  const [uncontrolledActiveTab, setUncontrolledActiveTab] = React.useState<ProposalRailTab>("draft");
  const activeTab = controlledActiveTab ?? uncontrolledActiveTab;
  const setActiveTab = React.useCallback((tab: ProposalRailTab) => {
    setUncontrolledActiveTab(tab);
    onActiveTabChange?.(tab);
  }, [onActiveTabChange]);
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
      setJobContextOpen(!hideTabs);
    }
  }, [hasActiveJobContext, hideTabs]);

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

  const proposalTypeMenuSections = React.useMemo<MenuSection[]>(
    () => [
      {
        label: "Document type",
        items: proposalTypeOptions.map((option) => ({
          id: option.id,
          role: "menuitemradio" as const,
          selected: option.selected,
          label: option.label,
          description: option.description,
          onSelect: () => onSelectProposalType(option.id),
        })),
      },
    ],
    [onSelectProposalType, proposalTypeOptions],
  );

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
      side={size === "sm" ? "top" : "bottom"}
      matchTriggerWidth={size === "md"}
      menuClassName={
        hideTabs && size === "sm"
          ? "dasti-proposal-skeleton-rail__composer-menu"
          : undefined
      }
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
      side={size === "sm" ? "top" : "bottom"}
      matchTriggerWidth={size === "md"}
      menuClassName={
        hideTabs && size === "sm"
          ? "dasti-proposal-skeleton-rail__composer-menu"
          : undefined
      }
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

  const renderDraftToneSelect = () => (
    <Menu
      ariaLabel="Tone"
      align="start"
      side="bottom"
      matchTriggerWidth
      sections={toneMenuSections}
      trigger={
        <button
          type="button"
          className="dasti-proposal-skeleton-rail__setup-row dasti-proposal-skeleton-rail__setup-row--button dasti-toolbar-tooltip-trigger--above"
          data-toolbar-tooltip={selectedToneOption?.description ?? "Proposal tone"}
        >
          <span className="dasti-proposal-skeleton-rail__setup-label">Tone</span>
          <span className="dasti-proposal-skeleton-rail__setup-value">
            {toneLabel}
          </span>
          <ChevronDown className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
        </button>
      }
    />
  );

  return (
    <aside
      className={`forge__rail dasti-proposal-skeleton-rail${hideTabs ? " dasti-proposal-skeleton-rail--composer" : ""}`}
      aria-label="Proposal rail"
    >
      {hideTabs ? null : (
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
      )}

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
                  className="dasti-toolbar-tooltip-trigger--above"
                  data-toolbar-tooltip="Choose or paste a job."
                  onClick={onOpenJobs}
                  iconLeft={<Briefcase size={14} strokeWidth={1.8} />}
                >
                  Choose from Job Forge
                </Button>
                <p className="dasti-proposal-skeleton-rail__helper">
                  Paste a job offer below. I’ll use it with the selected CV, tone, and document type to generate a first proposal.
                </p>
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
        <div className="dasti-proposal-skeleton-rail__draft-head">
          <div>
            <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Draft</div>
            <p className="dasti-proposal-skeleton-rail__helper">
              {hasActiveJobContext
                ? "Tune the draft, then generate from this job and CV."
                : "Choose or paste a job offer, then generate a first proposal."}
            </p>
          </div>
          <div className="dasti-proposal-skeleton-rail__job-top-actions">
            <Button type="button" variant="ghost" size="sm" onClick={onOpenJobs}>
              {hasActiveJobContext ? "Change job" : "Choose job"}
            </Button>
            {hasActiveJobContext && onClearJobContext ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label={jobContextOpen ? "Clear job context" : "Clear job"}
                onClick={onClearJobContext}
              >
                Clear
              </Button>
            ) : null}
          </div>
        </div>
        <div className="dasti-proposal-skeleton-rail__draft-setup">
          <div className="dasti-proposal-skeleton-rail__draft-setup-body">
            <Menu
              ariaLabel="Document type"
              align="start"
              side="bottom"
              matchTriggerWidth
              sections={proposalTypeMenuSections}
              trigger={
                <button
                  type="button"
                  aria-label="Document type"
                  className="dasti-proposal-skeleton-rail__setup-row dasti-proposal-skeleton-rail__setup-row--button"
                >
                  <span className="dasti-proposal-skeleton-rail__setup-label">Type</span>
                  <span className="dasti-proposal-skeleton-rail__setup-value">
                    {proposalTypeLabel || "Letter"}
                  </span>
                  <ChevronDown className="dasti-proposal-skeleton-rail__chevron" aria-hidden="true" />
                </button>
              }
            />
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
                    className="dasti-proposal-skeleton-rail__setup-row dasti-proposal-skeleton-rail__setup-row--button dasti-proposal-skeleton-rail__attached-button"
                    title="Choose the CV used for this draft."
                  >
                    <span className="dasti-proposal-skeleton-rail__setup-label">Attached</span>
                    <span className="dasti-proposal-skeleton-rail__setup-copy">
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
              {renderDraftToneSelect()}
            </div>
            <Button
              type="button"
              variant="primary"
              size="md"
              title="Generate a draft from this job and CV."
              disabled={generateDisabled}
              data-state={generateState}
              onClick={onGenerateDraft}
              iconLeft={<PaperPlaneRight size={15} strokeWidth={1.8} />}
            >
              {generateLabel}
            </Button>
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
          iconLeft={<PaperPlaneRight size={15} strokeWidth={1.8} />}
        >
          {askAiBusy ? "Applying…" : "Send"}
        </Button>
      </section>
      ) : null}

    </aside>
  );
}

export default ProposalRail;
