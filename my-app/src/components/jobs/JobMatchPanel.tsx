import React from "react";

type MatchTier = "strong" | "partial" | "weak" | "unknown";
type MatchReviewVerdict =
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
  reviewVerdict?: MatchReviewVerdict | null;
  suggestedNextStep?: string | null;
  whyItems?: string[];
  watchOutItems?: string[];
  jobLocation?: string | null;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  onRefreshMatch?: () => void;
};

function resolveVerdictLabel(
  tier: MatchTier,
  reviewVerdict?: MatchReviewVerdict | null,
): string {
  switch (reviewVerdict) {
    case "strong_lead":
      return "Strong match";
    case "possible_lead":
      return "Worth a shot";
    case "probably_skip":
      return "Probably skip";
    case "not_enough_signal":
      return "Maybe";
    default:
      break;
  }

  switch (tier) {
    case "strong":
      return "Strong match";
    case "partial":
      return "Worth a shot";
    case "weak":
      return "Probably skip";
    case "unknown":
      return "Maybe";
  }
}

function resolveVerdictTone(
  tier: MatchTier,
  reviewVerdict?: MatchReviewVerdict | null,
): "strong" | "worth" | "maybe" | "skip" {
  if (reviewVerdict === "strong_lead") return "strong";
  if (reviewVerdict === "possible_lead") return "worth";
  if (reviewVerdict === "probably_skip") return "skip";
  if (reviewVerdict === "not_enough_signal") return "maybe";

  if (tier === "strong") return "strong";
  if (tier === "partial") return "worth";
  if (tier === "weak") return "skip";
  return "maybe";
}

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

export function JobMatchPanel({
  tier,
  matched,
  missing,
  profileLabel,
  oneLiner,
  reviewVerdict,
  suggestedNextStep,
  whyItems = [],
  watchOutItems = [],
  jobLocation,
  isExpanded,
  onToggleExpanded,
  onRefreshMatch,
}: JobMatchPanelProps): JSX.Element {
  const verdictLabel = resolveVerdictLabel(tier, reviewVerdict);
  const tone = resolveVerdictTone(tier, reviewVerdict);
  const skillsCopy =
    matched.length > 0
      ? `${matched.slice(0, 3).join(", ")} — overlap.`
      : "No clear skill overlap yet.";
  const gapCopy =
    missing.length > 0 ? `${missing[0]} needs review.` : "No major gap flagged.";
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
        <div className="dasti-stack dasti-match-read__copy">
          <div className="dasti-brief-card__summary-label">Verdict</div>
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
          <p className="dasti-empty-state__subtitle">{explanation}</p>
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

      <div className="dasti-job-match-panel__rows">
        <div className="dasti-job-match-panel__row">
          <span>Skills</span>
          <span>{skillsCopy}</span>
        </div>
        <div className="dasti-job-match-panel__row">
          <span>Seniority</span>
          <span>{whyItems[0] ?? `${profileLabel} has usable signal.`}</span>
        </div>
        <div className="dasti-job-match-panel__row">
          <span>Location</span>
          <span>{jobLocation?.trim() || "Location unavailable."}</span>
        </div>
        <div className="dasti-job-match-panel__row">
          <span>Gap</span>
          <span>{watchOutItems[0] ?? gapCopy}</span>
        </div>
      </div>

      <button
        type="button"
        className="dasti-button dasti-button--sm dasti-button--pill dasti-button--ghost dasti-job-match-panel__breakdown"
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
