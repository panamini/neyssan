import React from "react";
import { RotateCcw } from "@/lib/icons";
import {
  resolveVisibleJobVerdict,
  type VisibleJobMatchReviewInput,
} from "../../lib/jobs/visibleJobVerdict";

type MatchTier = "strong" | "partial" | "weak" | "unknown";
export type MatchReviewVerdict =
  | "strong_lead"
  | "possible_lead"
  | "probably_skip"
  | "not_enough_signal";

export type JobMatchPanelProps = {
  tier: MatchTier;
  matched: string[];
  missing: string[];
  profileLabel: string;
  oneLiner?: string | null;
  matchReview?: VisibleJobMatchReviewInput;
  suggestedNextStep?: string | null;
  whyItems?: string[];
  watchOutItems?: string[];
  jobLocation?: string | null;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onRefreshMatch?: () => void;
};

function formatSuggestedNextStep(nextStep?: string | null): string {
  switch (nextStep) {
    case "apply":
      return "Apply.";
    case "apply_if_requirement_true":
      return "Apply if the requirement checks out.";
    case "improve_profile_first":
      return "Improve the CV first.";
    case "skip":
      return "Skip this one.";
    case "review_manually":
      return "Review manually.";
    default:
      return "Review the match before drafting.";
  }
}

function formatVerdictHeadline(label: string, nextStep?: string | null): string {
  if (label === "Probably skip") {
    return "Probably skip.";
  }

  switch (nextStep) {
    case "apply":
      return `${label} — apply.`;
    case "apply_if_requirement_true":
      return `${label} — verify first.`;
    case "improve_profile_first":
      return `${label} — improve CV.`;
    case "skip":
      return `${label} — skip.`;
    default:
      return `${label} — review.`;
  }
}

function formatSentence(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "Not enough signal yet.";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
}

export function JobMatchPanel({
  tier,
  matched,
  missing,
  profileLabel,
  oneLiner,
  matchReview,
  suggestedNextStep,
  whyItems = [],
  watchOutItems = [],
  jobLocation,
  isExpanded,
  onToggleExpanded,
  onRefreshMatch,
}: JobMatchPanelProps): JSX.Element {
  const { label: verdictLabel, tone } = resolveVisibleJobVerdict(
    {
      matchReview,
      matchRead: { tier },
      matchTier: tier,
    },
  );
  const skillsCopy =
    matched.length > 0
      ? `${matched.slice(0, 3).join(", ")} — strong overlap.`
      : "No clear skill overlap yet.";
  const seniorityCopy = whyItems[0]
    ? formatSentence(whyItems[0])
    : "Profile suggests sufficient seniority.";
  const locationCopy = jobLocation?.trim()
    ? `${jobLocation.trim()} · match.`
    : "Location unavailable.";
  const gapCopy =
    missing.length > 0 ? formatSentence(`${missing[0]} needs review`) : "No major gap flagged.";
  const watchOutCopy = watchOutItems[0] ? formatSentence(watchOutItems[0]) : gapCopy;
  const explanation =
    oneLiner?.trim() ||
    `${formatSuggestedNextStep(suggestedNextStep)} ${gapCopy}`;

  return (
    <section
      id="job-match"
      className="dasti-proposal-sheet dasti-match-read dasti-job-match-panel jobs__match"
      aria-label="Match"
      data-expanded={isExpanded ? "true" : "false"}
    >
      <div className="dasti-proposal-sheet__header dasti-match-read__header">
        <div className="dasti-job-match-panel__header-line">
          <div className="ds-card__eyebrow">Verdict</div>
          {onRefreshMatch ? (
            <button
              type="button"
              className="dasti-job-match-panel__refresh"
              onClick={onRefreshMatch}
            >
              <RotateCcw size={14} strokeWidth={1.8} aria-hidden="true" />
              Refresh match
            </button>
          ) : null}
        </div>
        <div className="dasti-stack dasti-match-read__copy">
          <div
            className={[
              "ds-verdict",
              `ds-verdict--${tone}`,
              "dasti-job-match-panel__verdict",
            ].join(" ")}
          >
            <span className="ds-verdict__dot" aria-hidden="true" />
            {formatVerdictHeadline(verdictLabel, suggestedNextStep)}
          </div>
          <p className="dasti-job-match-panel__explanation">{explanation}</p>
        </div>
      </div>

      <dl className="verdict-grid dasti-job-match-panel__rows">
        <dt>Skills</dt>
        <dd>
          <span>{skillsCopy}</span>
        </dd>
        <dt>Seniority</dt>
        <dd>
          <span>{seniorityCopy}</span>
        </dd>
        <dt>Location</dt>
        <dd>
          <span>{locationCopy}</span>
        </dd>
        <dt>Gap</dt>
        <dd>
          <span>{watchOutCopy}</span>
        </dd>
      </dl>

      <button
        type="button"
        className="ds-btn ds-btn--sm ds-btn--accent dasti-job-match-panel__breakdown"
        onClick={onToggleExpanded}
      >
        {isExpanded ? "Hide breakdown" : "See full breakdown"}
      </button>

      {isExpanded ? (
        <div className="dasti-brief-card__summary dasti-match-read__details">
          {matched.length > 0 ? (
            <div className="dasti-brief-card__summary-block">
              <div className="dasti-brief-card__summary-label">Matched</div>
              <div className="dasti-jobs-detail-section__stack">
                {matched.map((item) => (
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

          {missing.length > 0 ? (
            <div className="dasti-brief-card__summary-block">
              <div className="dasti-brief-card__summary-label">Missing</div>
              <div className="dasti-jobs-detail-section__stack">
                {missing.map((item) => (
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
              {profileLabel} · Job requirements
            </p>
          </div>
        </div>
      ) : null}
    </section>
  );
}
