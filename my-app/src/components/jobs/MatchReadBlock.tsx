import React from "react";
import { selectVisibleMissingRequirements } from "../../lib/jobs/visibleMissingRequirements";

type MatchRead = {
  tier: "strong" | "partial" | "weak" | "unknown";
  score: number | null;
  scoreVisible: boolean;
  confidence: "high" | "medium" | "low";
  matched: string[];
  missing: string[];
  basedOn: {
    profileId: string;
    profileLabel: string;
    jobId: string;
  };
  computedAt: number;
  method: "keyword-overlap" | "llm";
  fallback:
    | "none"
    | "profile_missing"
    | "profile_insufficient"
    | "parse_failed"
    | "requirements_missing";
};

function formatTierLabel(tier: MatchRead["tier"]): string {
  if (tier === "strong") {
    return "Strong";
  }
  if (tier === "partial") {
    return "Partial";
  }
  if (tier === "weak") {
    return "Weak";
  }
  return "Unknown";
}

function formatMatchDate(computedAt: number): string | null {
  if (!Number.isFinite(computedAt) || computedAt <= 0) {
    return null;
  }

  const date = new Date(computedAt);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

export function MatchReadBlock({
  matchRead,
  visibleRequirements = [],
  jobTitle = null,
  jobCompany = null,
  jobLocation = null,
}: {
  matchRead: MatchRead;
  visibleRequirements?: string[];
  jobTitle?: string | null;
  jobCompany?: string | null;
  jobLocation?: string | null;
}): JSX.Element {
  const [isExpanded, setIsExpanded] = React.useState(false);
  const visibleMissingRequirements = selectVisibleMissingRequirements({
    missing: matchRead.missing,
    visibleRequirements,
    jobTitle,
    jobCompany,
    jobLocation,
  });
  const scoreLabel =
    matchRead.scoreVisible && matchRead.score !== null
      ? `${formatTierLabel(matchRead.tier)} · ${matchRead.score}%`
      : formatTierLabel(matchRead.tier);
  const computedDateLabel = formatMatchDate(matchRead.computedAt);

  if (matchRead.fallback === "parse_failed") {
    return (
      <section className="dasti-proposal-sheet" aria-label="Match">
        <div className="dasti-proposal-sheet__header">
          <div className="dasti-stack">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">Posting Needs Work</div>
            <p className="dasti-empty-state__subtitle">
              Review imported posting.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (matchRead.fallback === "profile_missing") {
    const hasResolvedProfile = matchRead.basedOn.profileId.trim().length > 0;
    return (
      <section className="dasti-proposal-sheet" aria-label="Match">
        <div className="dasti-proposal-sheet__header">
          <div className="dasti-stack">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">
              Resume Needs Work
            </div>
            <p className="dasti-empty-state__subtitle">
              {hasResolvedProfile
                ? "Resume has no match data."
                : "Attach a resume."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (matchRead.fallback === "profile_insufficient") {
    return (
      <section className="dasti-proposal-sheet" aria-label="Match">
        <div className="dasti-proposal-sheet__header">
          <div className="dasti-stack">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">
              Resume Needs Work
            </div>
            <p className="dasti-empty-state__subtitle">
              Resume has placeholder content.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (matchRead.fallback === "requirements_missing") {
    return (
      <section className="dasti-proposal-sheet" aria-label="Match">
        <div className="dasti-proposal-sheet__header">
          <div className="dasti-stack">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">No Requirements</div>
            <p className="dasti-empty-state__subtitle">
              Review imported posting.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section
      id="job-match"
      className="dasti-proposal-sheet dasti-match-read"
      aria-label="Match"
      data-expanded={isExpanded ? "true" : "false"}
    >
      <div className="dasti-proposal-sheet__header dasti-match-read__header">
        <div className="dasti-stack dasti-match-read__copy">
          <div className="dasti-brief-card__summary-label">Match</div>
          <div className="dasti-empty-state__title">{scoreLabel}</div>
          <div className="dasti-match-read__stats">
            <span className="dasti-match-read__stat">
              <span className="dasti-match-read__stat-label">
                Found in Resume
              </span>
              <span className="dasti-match-read__stat-value">
                {matchRead.matched.length}
              </span>
            </span>
            {visibleMissingRequirements.length > 0 ? (
              <button
                type="button"
                className="dasti-match-read__stat dasti-match-read__stat--button dasti-match-read__stat--warning"
                onClick={() => setIsExpanded(true)}
              >
                <span className="dasti-match-read__stat-label">
                  Missing from Resume
                </span>
                <span className="dasti-match-read__stat-value">
                  {visibleMissingRequirements.length}
                </span>
              </button>
            ) : null}
            {computedDateLabel ? (
              <span className="dasti-match-read__stat dasti-match-read__stat--muted">
                <span className="dasti-match-read__stat-label">Checked</span>
                <span className="dasti-match-read__stat-value">
                {computedDateLabel}
                </span>
              </span>
            ) : null}
          </div>
          <p className="dasti-empty-state__subtitle">
            Compared with {matchRead.basedOn.profileLabel} · {matchRead.confidence} confidence
          </p>
        </div>
        <button
          type="button"
          className="dasti-button dasti-button--sm dasti-button--pill dasti-button--ghost"
          onClick={() => setIsExpanded((current) => !current)}
        >
          {isExpanded ? "Close Match" : "Open Match"}
        </button>
      </div>

      {isExpanded ? (
      <div className="dasti-brief-card__summary dasti-match-read__details">
        {matchRead.matched.length > 0 ? (
          <div className="dasti-brief-card__summary-block">
            <div className="dasti-brief-card__summary-label">Matched</div>
            <div className="dasti-jobs-detail-section__stack">
              {matchRead.matched.map((item) => (
                <div key={`matched-${item}`} className="dasti-jobs-detail-section__item">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {visibleMissingRequirements.length > 0 ? (
          <div className="dasti-brief-card__summary-block">
            <div className="dasti-brief-card__summary-label">Missing</div>
            <div className="dasti-jobs-detail-section__stack">
              {visibleMissingRequirements.map((item) => (
                <div key={`missing-${item}`} className="dasti-jobs-detail-section__item">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <div className="dasti-brief-card__summary-block">
          <div className="dasti-brief-card__summary-label">Based on</div>
          <p className="dasti-brief-card__summary-copy">
            {matchRead.basedOn.profileLabel} · Job requirements
          </p>
        </div>
      </div>
      ) : null}
    </section>
  );
}
