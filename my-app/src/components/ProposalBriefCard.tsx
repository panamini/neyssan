import React from "react";
import { ArrowSquareOut, ChevronDown } from "@/lib/icons";

type ProposalBriefCardProps = {
  documentTitle: string;
  jobDescription: string;
  onToggleBrief: () => void;
  variant?: "card" | "compact";
  sourceUrl?: string | null;
  sourcePlatform?: string | null;
};

function formatBriefSourceLabel(platform: string | null | undefined, sourceUrl: string | null | undefined): string | null {
  const p = String(platform ?? "").trim();
  if (p) {
    if (/linkedin/i.test(p)) return "LinkedIn";
    if (/indeed/i.test(p)) return "Indeed";
    if (!/^web$/i.test(p) && !/^site$/i.test(p) && !/^website$/i.test(p)) {
      const capitalized = p.charAt(0).toUpperCase() + p.slice(1).toLowerCase();
      return capitalized;
    }
  }
  if (!sourceUrl) return null;
  try {
    const hostname = new URL(sourceUrl).hostname.replace(/^www\./i, "");
    if (/linkedin/i.test(hostname)) return "LinkedIn";
    if (/indeed/i.test(hostname)) return "Indeed";
    return hostname;
  } catch {
    return "External source";
  }
}

export function ProposalBriefCard({
  documentTitle,
  jobDescription,
  onToggleBrief,
  variant = "card",
  sourceUrl = null,
  sourcePlatform = null,
}: ProposalBriefCardProps): JSX.Element {
  const hasSummary = Boolean(jobDescription);
  const isCompact = variant === "compact";
  const sourceLabel = formatBriefSourceLabel(sourcePlatform, sourceUrl);

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
          {sourceLabel ? (
            <div className="dasti-brief-card__source-row">
              <span className="dasti-brief-card__source-kicker">From</span>
              {sourceUrl ? (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="dasti-brief-card__source-link"
                  aria-label={`Open original job offer on ${sourceLabel}`}
                >
                  <span className="dasti-brief-card__source-link-label">{sourceLabel}</span>
                  <ArrowSquareOut size={12} strokeWidth={1.8} aria-hidden="true" />
                </a>
              ) : (
                <span className="dasti-brief-card__source-link-label">{sourceLabel}</span>
              )}
            </div>
          ) : null}
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
