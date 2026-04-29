import React from "react";
import { Button, Pill, ToneBadge } from "../ui";

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
  toolbar: React.ReactNode;
  composePanel: React.ReactNode;
  onOpenCvPicker: () => void;
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
  toolbar,
  composePanel,
  onOpenCvPicker,
}: ProposalRailProps): JSX.Element {
  const visibleKeywords = keywords.slice(0, 3);

  return (
    <aside className="dasti-proposal-skeleton-rail" aria-label="Proposal rail">
      <section className="dasti-proposal-skeleton-rail__section">
        <div className="dasti-proposal-skeleton-rail__label">Job context</div>
        <div className="dasti-proposal-skeleton-rail__title">
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

      <section className="dasti-proposal-skeleton-rail__section">
        <div className="dasti-proposal-skeleton-rail__label">Source CV</div>
        <Button
          type="button"
          variant="secondary"
          size="md"
          className="dasti-proposal-skeleton-rail__cv-button"
          onClick={onOpenCvPicker}
        >
          <span className="dasti-proposal-skeleton-rail__cv-thumb" />
          <span>
            <strong>{sourceCvTitle ? "Selected CV" : "Choose a CV"}</strong>
            <small>{sourceCvMeta || "Attach one to personalize the draft."}</small>
          </span>
        </Button>
        {toolbar ? (
          <div className="dasti-proposal-skeleton-rail__toolbar">
            {toolbar}
          </div>
        ) : null}
      </section>

      <section className="dasti-proposal-skeleton-rail__section">
        {aiStream}
      </section>

      <section className="dasti-proposal-skeleton-rail__section">
        <div className="dasti-proposal-skeleton-rail__label">Tone</div>
        <div className="dasti-proposal-skeleton-rail__pills">
          <ToneBadge tone={toneValue}>{toneLabel}</ToneBadge>
          <ToneBadge tone="formal">Formal</ToneBadge>
          <ToneBadge tone="natural">Natural</ToneBadge>
        </div>
      </section>

      <section className="dasti-proposal-skeleton-rail__section">
        <div className="dasti-proposal-skeleton-rail__label">Variables</div>
        {composePanel}
      </section>

      <section className="dasti-proposal-skeleton-rail__section">
        <div className="dasti-proposal-skeleton-rail__label">Ask AI</div>
        <textarea
          className="ds-field ds-field--textarea dasti-proposal-skeleton-rail__ask"
          placeholder="Ask for a whole-proposal revision."
          aria-label="Ask AI about the whole proposal"
        />
        <Button type="button" variant="primary" size="md">
          Send
        </Button>
        <div className="dasti-proposal-skeleton-rail__hint">
          Select text in the paper for sentence-level rewrite, shorten, fix, or
          ask actions.
        </div>
      </section>

      <section className="dasti-proposal-skeleton-rail__section">
        <div className="dasti-proposal-skeleton-rail__label">Settings</div>
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
