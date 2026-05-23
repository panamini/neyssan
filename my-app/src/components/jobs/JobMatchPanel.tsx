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
  const { label: verdictLabel, tone } = resolveVisibleJobVerdict({
    matchReview,
    matchRead: { tier },
    matchTier: tier,
  });
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
    missing.length > 0
      ? formatSentence(`${missing[0]} needs review`)
      : "No major gap flagged.";
  const watchOutCopy = watchOutItems[0]
    ? formatSentence(watchOutItems[0])
    : gapCopy;
  const gapAndLogisticsCopy = `${watchOutCopy} ${locationCopy}`;
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
          <div className="ds-card__eyebrow">Compatibility analysis</div>
          <div className="dasti-job-match-panel__header-actions">
            <div
              className={[
                "ds-verdict",
                `ds-verdict--${tone}`,
                "dasti-job-match-panel__verdict-badge",
              ].join(" ")}
              aria-label={`Current match: ${verdictLabel}`}
            >
              <span className="ds-verdict__dot" aria-hidden="true" />
              {verdictLabel}
            </div>
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
        </div>
        <div className="dasti-stack dasti-match-read__copy">
          <p
            className={`dasti-job-match-panel__explanation dasti-job-match-panel__explanation--${tone}`}
          >
            {explanation}
          </p>
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
        <dt>Gaps</dt>
        <dd>
          <span>{gapAndLogisticsCopy}</span>
        </dd>
      </dl>

      <button
        type="button"
        className="ds-btn ds-btn--sm dasti-job-match-panel__breakdown"
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
              <ul className="dasti-job-match-panel__missing-list">
                {missing.map((item) => (
                  <li
                    key={`missing-${item}`}
                    className="dasti-jobs-detail-section__item"
                  >
                    {item}
                  </li>
                ))}
              </ul>
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
