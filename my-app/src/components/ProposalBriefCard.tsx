import React from "react";
import { ChevronDown } from "@/lib/icons";

type ProposalBriefCardProps = {
  documentTitle: string;
  jobDescription: string;
  onToggleBrief: () => void;
  variant?: "card" | "compact";
};

export function ProposalBriefCard({
  documentTitle,
  jobDescription,
  onToggleBrief,
  variant = "card",
}: ProposalBriefCardProps): JSX.Element {
  const hasSummary = Boolean(jobDescription);
  const isCompact = variant === "compact";

  return (
    <div
      className={[
        "dasti-proposal-sheet",
        "dasti-brief-card",
        isCompact ? "dasti-brief-card--compact" : null,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={[
          "dasti-proposal-sheet__header",
          "dasti-proposal-sheet__header--brief",
          isCompact ? "dasti-proposal-sheet__header--brief-compact" : null,
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="dasti-proposal-sheet__heading dasti-proposal-sheet__heading--full">
          <div className="dasti-proposal-compose-shell__header-row">
            <h2 className="dasti-brief-card__document-title">
              {documentTitle || "Untitled Proposal"}
            </h2>
            <button
              type="button"
              className="dasti-brief-card__dismiss"
              onClick={onToggleBrief}
              aria-label="Expand"
            >
              <ChevronDown size={14} strokeWidth={1.7} aria-hidden="true" />
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
