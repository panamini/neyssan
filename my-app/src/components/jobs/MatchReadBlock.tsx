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
    | "requirements_missing"
    | "structured_pending";
};

type JobMatchReview = {
  verdict:
    | "strong_lead"
    | "possible_lead"
    | "probably_skip"
    | "not_enough_signal";
  score?: number | null;
  confidence: number;
  one_liner: string;
  why_this_may_interest_you: string[];
  watch_out: string[];
  suggested_next_step:
    | "apply"
    | "apply_if_requirement_true"
    | "improve_profile_first"
    | "skip"
    | "review_manually";
  missing_or_unclear_requirements: Array<{
    requirement: string;
    severity: "minor" | "important" | "blocking" | "unclear";
    reason: string;
  }>;
  evidence: Array<{
    job_signal: string;
    profile_signal: string;
    explanation: string;
  }>;
};

function renderDetailItems(items: readonly string[], keyPrefix: string) {
  if (items.length === 1) {
    return <p className="dasti-jobs-detail-section__paragraph">{items[0]}</p>;
  }

  return (
    <ul className="dasti-jobs-detail-section__list">
      {items.map((item) => (
        <li
          key={`${keyPrefix}-${item}`}
          className="dasti-jobs-detail-section__item"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

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

function formatSuggestedNextStepLabel(
  nextStep: JobMatchReview["suggested_next_step"],
): string {
  switch (nextStep) {
    case "apply":
      return "Apply";
    case "apply_if_requirement_true":
      return "Apply if true";
    case "improve_profile_first":
      return "Improve profile first";
    case "skip":
      return "Skip";
    case "review_manually":
      return "Review manually";
  }
}

function formatReviewScore(score: JobMatchReview["score"]): string | null {
  return typeof score === "number" && Number.isFinite(score)
    ? `${Math.round(score)}%`
    : null;
}

function hasUsableMatchReview(
  matchReview: JobMatchReview | null | undefined,
): matchReview is JobMatchReview {
  if (!matchReview) {
    return false;
  }
  if (matchReview.verdict === "not_enough_signal") {
    return false;
  }
  if (
    matchReview.verdict === "probably_skip" &&
    (matchReview.score ?? 0) <= 0
  ) {
    return false;
  }
  return true;
}

export function MatchReadBlock({
  matchRead,
  matchReview = null,
  visibleRequirements = [],
  jobTitle = null,
  jobCompany = null,
  jobLocation = null,
  onRefreshMatch,
}: {
  matchRead: MatchRead;
  matchReview?: JobMatchReview | null;
  visibleRequirements?: string[];
  jobTitle?: string | null;
  jobCompany?: string | null;
  jobLocation?: string | null;
  onRefreshMatch?: () => void;
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

  if (hasUsableMatchReview(matchReview)) {
    const tierLabel = formatTierLabel(matchRead.tier);
    const reviewScoreLabel = formatReviewScore(matchReview.score);
    const titleLabel = reviewScoreLabel
      ? `${tierLabel} · ${reviewScoreLabel}`
      : tierLabel;
    const oneLiner = matchReview.one_liner.trim();
    const whyItems = matchReview.why_this_may_interest_you
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 3);
    const watchOutItems = matchReview.watch_out
      .map((item) => item.trim())
      .filter(Boolean)
      .slice(0, 2);

    return (
      <section
        id="job-match"
        className="dasti-proposal-sheet dasti-match-read"
        aria-label="Match"
      >
        <div className="dasti-proposal-sheet__header dasti-match-read__header">
          <div className="dasti-stack dasti-match-read__copy">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">{titleLabel}</div>
            {oneLiner ? (
              <p className="dasti-empty-state__subtitle">{oneLiner}</p>
            ) : null}
            <div className="dasti-match-read__stats">
              <span className="dasti-match-read__stat">
                <span className="dasti-match-read__stat-label">Next</span>
                <span className="dasti-match-read__stat-value">
                  {formatSuggestedNextStepLabel(
                    matchReview.suggested_next_step,
                  )}
                </span>
              </span>
            </div>
          </div>
          <div className="dasti-match-read__actions">
            {onRefreshMatch ? (
              <button
                type="button"
                className="dasti-button dasti-button--sm dasti-button--pill dasti-button--ghost"
                onClick={onRefreshMatch}
              >
                Refresh match
              </button>
            ) : null}
          </div>
        </div>

        {whyItems.length > 0 || watchOutItems.length > 0 ? (
          <div className="dasti-brief-card__summary dasti-match-read__details">
            {whyItems.length > 0 ? (
              <div className="dasti-brief-card__summary-block">
                <div className="dasti-brief-card__summary-label">
                  Why this may interest you
                </div>
                <div className="dasti-jobs-detail-section__stack">
                  {renderDetailItems(whyItems, "match-review-why")}
                </div>
              </div>
            ) : null}

            {watchOutItems.length > 0 ? (
              <div className="dasti-brief-card__summary-block">
                <div className="dasti-brief-card__summary-label">Watch out</div>
                <div className="dasti-jobs-detail-section__stack">
                  {renderDetailItems(watchOutItems, "match-review-watch")}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </section>
    );
  }

  if (matchRead.fallback === "parse_failed") {
    return (
      <section className="dasti-proposal-sheet" aria-label="Match">
        <div className="dasti-proposal-sheet__header">
          <div className="dasti-stack">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">Match unavailable</div>
            <p className="dasti-empty-state__subtitle">
              Job parse failed. Re-import.
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
            <div className="dasti-empty-state__title">No resume signal</div>
            <p className="dasti-empty-state__subtitle">
              {hasResolvedProfile
                ? "Resume has no keywords yet."
                : "Resume did not load."}
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
            <div className="dasti-empty-state__title">Resume too thin</div>
            <p className="dasti-empty-state__subtitle">
              Add summary, skills, or experience.
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
            <div className="dasti-empty-state__title">Match unavailable</div>
            <p className="dasti-empty-state__subtitle">
              Job has no requirements.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (
    matchRead.fallback === "structured_pending" ||
    (matchRead.method === "keyword-overlap" && matchRead.fallback === "none")
  ) {
    return (
      <section className="dasti-proposal-sheet" aria-label="Match">
        <div className="dasti-proposal-sheet__header">
          <div className="dasti-stack">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">Match pending</div>
            <p className="dasti-empty-state__subtitle">
              Structured job extraction is not ready yet. Refresh match to queue
              it.
            </p>
          </div>
          <div className="dasti-match-read__actions">
            {onRefreshMatch ? (
              <button
                type="button"
                className="dasti-button dasti-button--sm dasti-button--pill dasti-button--ghost"
                onClick={onRefreshMatch}
              >
                Refresh match
              </button>
            ) : null}
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
              <span className="dasti-match-read__stat-label">Matched</span>
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
                <span className="dasti-match-read__stat-label">Missing</span>
                <span className="dasti-match-read__stat-value">
                  {visibleMissingRequirements.length}
                </span>
              </button>
            ) : null}
          </div>
        </div>
        <div className="dasti-match-read__actions">
          {onRefreshMatch ? (
            <button
              type="button"
              className="dasti-button dasti-button--sm dasti-button--pill dasti-button--ghost"
              onClick={onRefreshMatch}
            >
              Refresh match
            </button>
          ) : null}
          <button
            type="button"
            className="dasti-button dasti-button--sm dasti-button--pill dasti-button--ghost"
            onClick={() => setIsExpanded((current) => !current)}
          >
            {isExpanded ? "Close match" : "Open match"}
          </button>
        </div>
      </div>

      {isExpanded ? (
        <div className="dasti-brief-card__summary dasti-match-read__details">
          {matchRead.matched.length > 0 ? (
            <div className="dasti-brief-card__summary-block">
              <div className="dasti-brief-card__summary-label">Matched</div>
              <div className="dasti-jobs-detail-section__stack">
                {matchRead.matched.map((item) => (
                  <div
                    key={`matched-${item}`}
                    className="dasti-jobs-detail-section__item"
                  >
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
                  <div
                    key={`missing-${item}`}
                    className="dasti-jobs-detail-section__item"
                  >
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
