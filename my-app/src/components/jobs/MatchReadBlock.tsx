import React from "react";

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

export function MatchReadBlock({
  matchRead,
}: {
  matchRead: MatchRead;
}): JSX.Element {
  if (matchRead.fallback === "parse_failed") {
    return (
      <section className="dasti-proposal-sheet" aria-label="Match read">
        <div className="dasti-proposal-sheet__header">
          <div className="dasti-stack">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">Match unavailable</div>
            <p className="dasti-empty-state__subtitle">
              Job parsing needs attention before fit can be computed.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (matchRead.fallback === "profile_missing") {
    const hasResolvedProfile = matchRead.basedOn.profileId.trim().length > 0;
    return (
      <section className="dasti-proposal-sheet" aria-label="Match read">
        <div className="dasti-proposal-sheet__header">
          <div className="dasti-stack">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">
              No scoring profile data available
            </div>
            <p className="dasti-empty-state__subtitle">
              {hasResolvedProfile
                ? "The attached resume is available, but it has no usable skills or keywords for match scoring yet."
                : "The attached resume could not be resolved to usable skills or keywords for match scoring yet."}
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (matchRead.fallback === "profile_insufficient") {
    return (
      <section className="dasti-proposal-sheet" aria-label="Match read">
        <div className="dasti-proposal-sheet__header">
          <div className="dasti-stack">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">
              Insufficient profile data
            </div>
            <p className="dasti-empty-state__subtitle">
              The attached resume only has placeholder or minimal content, so
              match scoring is not reliable yet.
            </p>
          </div>
        </div>
      </section>
    );
  }

  if (matchRead.fallback === "requirements_missing") {
    return (
      <section className="dasti-proposal-sheet" aria-label="Match read">
        <div className="dasti-proposal-sheet__header">
          <div className="dasti-stack">
            <div className="dasti-brief-card__summary-label">Match</div>
            <div className="dasti-empty-state__title">Match unavailable</div>
            <p className="dasti-empty-state__subtitle">
              We could not find enough job requirements to compute fit yet.
            </p>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="dasti-proposal-sheet" aria-label="Match read">
      <div className="dasti-proposal-sheet__header">
        <div className="dasti-stack">
          <div className="dasti-brief-card__summary-label">Match</div>
          <div className="dasti-empty-state__title">
            {formatTierLabel(matchRead.tier)}
            {matchRead.scoreVisible && matchRead.score !== null
              ? ` · ${matchRead.score}%`
              : ""}
          </div>
          <p className="dasti-empty-state__subtitle">
            Confidence: {matchRead.confidence}
          </p>
        </div>
      </div>

      <div className="dasti-brief-card__summary">
        {matchRead.matched.length > 0 ? (
          <div className="dasti-brief-card__summary-block">
            <div className="dasti-brief-card__summary-label">Why</div>
            <div className="dasti-jobs-detail-section__stack">
              {matchRead.matched.map((item) => (
                <div key={`matched-${item}`} className="dasti-jobs-detail-section__item">
                  {item}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {matchRead.missing.length > 0 ? (
          <div className="dasti-brief-card__summary-block">
            <div className="dasti-brief-card__summary-label">Missing</div>
            <div className="dasti-jobs-detail-section__stack">
              {matchRead.missing.map((item) => (
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
    </section>
  );
}
