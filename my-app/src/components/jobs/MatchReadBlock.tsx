import React from "react";
import { RotateCcw } from "@/lib/icons";
import { selectVisibleMissingRequirements } from "../../lib/jobs/visibleMissingRequirements";
import { hasUsableMatchReview } from "../../lib/jobs/visibleJobVerdict";
import { JobMatchPanel } from "./JobMatchPanel";

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
  if (hasUsableMatchReview(matchReview)) {
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
      <JobMatchPanel
        tier={matchRead.tier}
        matched={matchRead.matched}
        missing={visibleMissingRequirements}
        profileLabel={matchRead.basedOn.profileLabel}
        oneLiner={oneLiner}
        matchReview={matchReview}
        suggestedNextStep={matchReview.suggested_next_step}
        whyItems={whyItems}
        watchOutItems={watchOutItems}
        jobLocation={jobLocation}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded((current) => !current)}
        onRefreshMatch={onRefreshMatch}
      />
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
                <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
                Refresh match
              </button>
            ) : null}
          </div>
        </div>
      </section>
    );
  }

  return (
    <JobMatchPanel
      tier={matchRead.tier}
      matched={matchRead.matched}
      missing={visibleMissingRequirements}
      profileLabel={matchRead.basedOn.profileLabel}
      suggestedNextStep={null}
      jobLocation={jobLocation}
      isExpanded={isExpanded}
      onToggleExpanded={() => setIsExpanded((current) => !current)}
      onRefreshMatch={onRefreshMatch}
    />
  );
}
