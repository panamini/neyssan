import React from "react";
import { Button, Pill, ToneBadge } from "../ui";
import { Menu, type MenuSection } from "../ui/menu";

type ProposalRailVariableField = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

type ProposalRailCvOption = {
  id: string;
  title: string;
  description: string | null;
  selected: boolean;
};

type ProposalRailProps = {
  jobTitle: string;
  company: string | null;
  location: string | null;
  sourceLabel: string | null;
  keywords: string[];
  sourceCvTitle: string | null;
  sourceCvMeta: string | null;
  toneLabel: string;
  toneValue: "auto" | "warm" | "formal" | "natural";
  lengthLabel: string;
  styleLabel: string;
  aiStream: React.ReactNode;
  variableFields: ProposalRailVariableField[];
  hasProposalContent: boolean;
  generateLabel: string;
  generateDisabled: boolean;
  generateState: "idle" | "loading" | "success" | "error";
  onGenerateDraft: () => void;
  cvOptions: ProposalRailCvOption[];
  onSelectCv: (cvId: string) => void;
  onClearCv: () => void;
  onCreateCv: () => void;
  onImportCv: () => void;
};

export function ProposalRail({
  jobTitle,
  company,
  location,
  sourceLabel,
  keywords,
  sourceCvTitle,
  sourceCvMeta,
  toneLabel,
  toneValue,
  lengthLabel,
  styleLabel,
  aiStream,
  variableFields,
  hasProposalContent,
  generateLabel,
  generateDisabled,
  generateState,
  onGenerateDraft,
  cvOptions,
  onSelectCv,
  onClearCv,
  onCreateCv,
  onImportCv,
}: ProposalRailProps): JSX.Element {
  const visibleKeywords = keywords.slice(0, 3);
  const cvMenuSections = React.useMemo<MenuSection[]>(() => {
    const cvItems = cvOptions.map((option) => ({
      id: option.id,
      role: "menuitemradio" as const,
      selected: option.selected,
      label: option.title,
      description: option.description ?? "Saved CV.",
      icon: <span className="dasti-proposal-skeleton-rail__cv-menu-thumb" />,
      onSelect: () => onSelectCv(option.id),
    }));

    return [
      {
        items: [
          {
            id: "create-cv",
            label: "Create new CV",
            onSelect: onCreateCv,
          },
          {
            id: "import-cv",
            label: "Import new CV",
            onSelect: onImportCv,
          },
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
                  description: "Create or import a CV first.",
                  disabled: true,
                },
              ],
      },
      ...(sourceCvTitle
        ? [
            {
              items: [
                {
                  id: "detach-cv",
                  label: "Remove attached CV",
                  onSelect: onClearCv,
                },
              ],
            },
          ]
        : []),
    ];
  }, [cvOptions, onClearCv, onCreateCv, onImportCv, onSelectCv, sourceCvTitle]);

  return (
    <aside className="forge__rail dasti-proposal-skeleton-rail" aria-label="Proposal rail">
      <section className="forge__rail-section dasti-proposal-skeleton-rail__section">
        <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Job context</div>
        <div className="forge__rail-title dasti-proposal-skeleton-rail__title">
          {jobTitle || "Untitled role"}
        </div>
        <div className="dasti-proposal-skeleton-rail__meta">
          {[company, location, sourceLabel].filter(Boolean).join(" · ") ||
            "Add a job brief to ground the proposal."}
        </div>
        {visibleKeywords.length > 0 ? (
          <div className="dasti-proposal-skeleton-rail__pills">
            {visibleKeywords.map((keyword) => (
              <Pill key={keyword} tone="accent">
                {keyword}
              </Pill>
            ))}
            {keywords.length > visibleKeywords.length ? (
              <Pill tone="neutral">+{keywords.length - visibleKeywords.length}</Pill>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="forge__rail-section dasti-proposal-skeleton-rail__section">
        <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Source CV</div>
        <Menu
          ariaLabel="Source CV"
          align="start"
          side="bottom"
          matchTriggerWidth
          sections={cvMenuSections}
          trigger={
            <button
              type="button"
              className="ds-btn ds-btn--md ds-btn--secondary dasti-proposal-skeleton-rail__cv-button"
            >
              <span className="dasti-proposal-skeleton-rail__cv-thumb" />
              <span>
                <strong>{sourceCvTitle ? "Selected CV" : "Choose a CV"}</strong>
                <small>{sourceCvMeta || "Attach one to personalize the draft."}</small>
              </span>
              <span className="dasti-proposal-skeleton-rail__cv-caret" aria-hidden="true">
                ▾
              </span>
            </button>
          }
        />
        <details className="dasti-proposal-skeleton-rail__draft-setup">
          <summary>Draft setup</summary>
          <div className="dasti-proposal-skeleton-rail__draft-setup-body">
            <dl className="dasti-proposal-skeleton-rail__settings">
              <div>
                <dt>Role</dt>
                <dd>{jobTitle || "Untitled role"}</dd>
              </div>
              <div>
                <dt>CV</dt>
                <dd>{sourceCvTitle || "Not attached"}</dd>
              </div>
              <div>
                <dt>Tone</dt>
                <dd>{toneLabel}</dd>
              </div>
            </dl>
            <Button
              type="button"
              variant="primary"
              size="md"
              disabled={generateDisabled}
              data-state={generateState}
              onClick={onGenerateDraft}
            >
              {generateLabel}
            </Button>
          </div>
        </details>
      </section>

      <section className="forge__rail-section dasti-proposal-skeleton-rail__section">
        {aiStream}
      </section>

      <section className="forge__rail-section dasti-proposal-skeleton-rail__section">
        <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Tone</div>
        <div className="dasti-proposal-skeleton-rail__pills">
          <ToneBadge tone={toneValue}>{toneLabel}</ToneBadge>
        </div>
      </section>

      <section className="forge__rail-section dasti-proposal-skeleton-rail__section">
        <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Variables</div>
        {hasProposalContent ? (
          <div className="dasti-proposal-skeleton-rail__variables">
            {variableFields.map((field) => (
              <label
                key={field.id}
                className="dasti-proposal-skeleton-rail__variable-field"
              >
                <span>{field.label}</span>
                {field.multiline ? (
                  <textarea
                    className="ds-field ds-field--textarea"
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                  />
                ) : (
                  <input
                    className="ds-field"
                    value={field.value}
                    placeholder={field.placeholder}
                    onChange={(event) => field.onChange(event.target.value)}
                    onBlur={field.onBlur}
                  />
                )}
              </label>
            ))}
          </div>
        ) : (
          <p className="dasti-proposal-skeleton-rail__hint">
            Generate a draft to edit document variables here.
          </p>
        )}
      </section>

      <section className="forge__rail-section dasti-proposal-skeleton-rail__section">
        <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Ask AI</div>
        <div className="dasti-proposal-skeleton-rail__hint">
          Select text in the paper for sentence-level rewrite, shorten, fix, or
          ask actions.
        </div>
      </section>

      <section className="forge__rail-section dasti-proposal-skeleton-rail__section">
        <div className="forge__rail-label dasti-proposal-skeleton-rail__label">Settings</div>
        <dl className="dasti-proposal-skeleton-rail__settings">
          <div>
            <dt>Length</dt>
            <dd>{lengthLabel}</dd>
          </div>
          <div>
            <dt>Style</dt>
            <dd>{styleLabel}</dd>
          </div>
        </dl>
      </section>
    </aside>
  );
}

export default ProposalRail;
