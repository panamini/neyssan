import React from "react";
import { ChevronDown } from "@/lib/icons";

type ProposalBriefCardProps = {
  documentTitle: string;
  jobDescription: string;
  onToggleBrief: () => void;
};

export function ProposalBriefCard({
  documentTitle,
  jobDescription,
  onToggleBrief,
}: ProposalBriefCardProps): JSX.Element {
  const hasSummary = Boolean(jobDescription);

  return (
    <div className="dasti-proposal-sheet dasti-brief-card">
      <div className="dasti-proposal-sheet__header dasti-proposal-sheet__header--brief">
        <div className="dasti-proposal-sheet__heading dasti-proposal-sheet__heading--full">
          <div className="dasti-proposal-compose-shell__header-row">
            <h2 className="dasti-brief-card__document-title">
              {documentTitle || "Untitled Proposal"}
            </h2>
            <button
              type="button"
              className="dasti-brief-card__dismiss"
              onClick={onToggleBrief}
              aria-label="Edit brief"
              title="Edit brief"
            >
              <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
      {hasSummary ? (
        <div className="dasti-brief-card__summary">
          {jobDescription ? (
            <p className="dasti-brief-card__description">{jobDescription}</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
