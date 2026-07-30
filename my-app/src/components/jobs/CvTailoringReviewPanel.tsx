import React from "react";
import { isClaimBackedResumeVariantPlanAction } from "../../modules/resume-variant-plan/planRules";
import type {
  ResumeVariantPlanActionV1,
  ResumeVariantPlanPriorityV1,
  ResumeVariantPlanReviewStateV1,
  ResumeVariantPlanSectionV1,
  ResumeVariantPlanWarningCategoryV1,
  ResumeVariantPlanWarningSeverityV1,
} from "../../modules/resume-variant-plan/schema";

export type CvTailoringReviewItemDtoV1 = Readonly<{
  id: string;
  section: ResumeVariantPlanSectionV1;
  action: ResumeVariantPlanActionV1;
  priority: ResumeVariantPlanPriorityV1;
  reviewState: ResumeVariantPlanReviewStateV1;
  displayLabel: string;
  demandIds: readonly string[];
  sourceCvItemReferenceIds: readonly string[];
  reason: string;
}>;

export type AutoCvTailoringReviewDtoV1 = Readonly<{
  mode: "auto_recommended";
  sourceCv: Readonly<{
    id: string;
    contextHash: string;
  }>;
  plan: Readonly<{
    id: string;
    blocked: boolean;
    blockedReason?: string;
    requiredDemandIds: readonly string[];
    items: readonly CvTailoringReviewItemDtoV1[];
    warnings: readonly Readonly<{
      id: string;
      category: ResumeVariantPlanWarningCategoryV1;
      severity: ResumeVariantPlanWarningSeverityV1;
      reason: string;
    }>[];
  }>;
}>;

export type CvTailoringReviewDtoV1 =
  | AutoCvTailoringReviewDtoV1
  | Readonly<{
      mode: "full_source_cv";
      sourceCv: Readonly<{
        id: string;
        contextHash: string;
      }>;
      plan: null;
    }>;

type CvTailoringReviewPanelProps = {
  review: AutoCvTailoringReviewDtoV1;
  selectedItemIds: ReadonlySet<string>;
  hasMissingRequiredDemandCoverage: boolean;
  isBusy: boolean;
  errorMessage: string | null;
  materializedResumeName: string | null;
  onToggleItem: (itemId: string, checked: boolean) => void;
  onCreate: () => void;
  onReload: () => void;
  onClose: () => void;
  onContinueToProposal: () => void;
};

const SECTION_LABELS: Record<ResumeVariantPlanSectionV1, string> = {
  profile: "Profile",
  summary: "Summary",
  skills: "Skills",
  experience: "Experience",
  education: "Education",
  languages: "Languages",
  certifications: "Certifications",
  achievements: "Achievements",
  projects: "Projects",
  portfolio: "Portfolio",
  other: "Other",
};

export function CvTailoringReviewPanel({
  review,
  selectedItemIds,
  hasMissingRequiredDemandCoverage,
  isBusy,
  errorMessage,
  materializedResumeName,
  onToggleItem,
  onCreate,
  onReload,
  onClose,
  onContinueToProposal,
}: CvTailoringReviewPanelProps): JSX.Element {
  const groupedItems = React.useMemo(() => {
    const groups = new Map<
      ResumeVariantPlanSectionV1,
      CvTailoringReviewItemDtoV1[]
    >();
    for (const item of review.plan.items) {
      const group = groups.get(item.section) ?? [];
      group.push(item);
      groups.set(item.section, group);
    }
    return [...groups.entries()];
  }, [review.plan.items]);
  const hasNoItems = review.plan.items.length === 0;
  const createDisabled =
    isBusy ||
    review.plan.blocked ||
    hasNoItems ||
    hasMissingRequiredDemandCoverage ||
    Boolean(errorMessage);

  return (
    <section
      className="dasti-cv-tailoring-review"
      aria-labelledby="cv-tailoring-review-title"
    >
      <div className="dasti-cv-tailoring-review__header">
        <div>
          <p className="dasti-cv-tailoring-review__eyebrow">
            Resume tailoring
          </p>
          <h2 id="cv-tailoring-review-title">Review recommendations</h2>
          <p className="dasti-cv-tailoring-review__intro">
            Keep the evidence you want in this job-specific resume.
          </p>
        </div>
        <button
          type="button"
          className="dasti-button dasti-button--pill dasti-button--sm"
          aria-label="Close resume review"
          onClick={onClose}
          disabled={isBusy}
        >
          Close
        </button>
      </div>

      {review.plan.blocked ? (
        <div className="dasti-cv-tailoring-review__alert" role="alert">
          {review.plan.blockedReason ??
            "This review is blocked. Reload the recommendations to continue."}
        </div>
      ) : null}
      {errorMessage ? (
        <div className="dasti-cv-tailoring-review__alert" role="alert">
          {errorMessage}
        </div>
      ) : null}
      {hasNoItems ? (
        <div className="dasti-cv-tailoring-review__alert" role="alert">
          No resume items are available to tailor. Attach a resume with
          experience, education, or skills, then reload recommendations.
        </div>
      ) : null}
      {hasMissingRequiredDemandCoverage ? (
        <p className="dasti-cv-tailoring-review__coverage" role="status">
          Keep at least one recommendation for every required job need.
        </p>
      ) : null}

      {materializedResumeName ? (
        <div className="dasti-cv-tailoring-review__success" role="status">
          <strong>Tailored resume ready</strong>
          <span>{materializedResumeName}</span>
        </div>
      ) : (
        <div className="dasti-cv-tailoring-review__groups">
          {groupedItems.map(([section, items]) => (
            <fieldset
              key={section}
              className="dasti-cv-tailoring-review__group"
            >
              <legend>{SECTION_LABELS[section]}</legend>
              {items.map((item) => {
                const selectable =
                  isClaimBackedResumeVariantPlanAction(item.action);
                const settled = item.reviewState !== "pending";
                const checked =
                  item.reviewState === "accepted" ||
                  (item.reviewState === "pending" &&
                    selectedItemIds.has(item.id));
                return (
                  <label
                    key={item.id}
                    className="dasti-cv-tailoring-review__item"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!selectable || settled || isBusy}
                      onChange={(event) =>
                        onToggleItem(item.id, event.target.checked)
                      }
                    />
                    <span className="dasti-cv-tailoring-review__item-copy">
                      <span className="dasti-cv-tailoring-review__item-label">
                        {item.displayLabel}
                      </span>
                      <span className="dasti-cv-tailoring-review__item-meta">
                        {item.priority}
                        {settled ? ` · ${item.reviewState}` : ""}
                      </span>
                      {item.reason ? (
                        <span className="dasti-cv-tailoring-review__reason">
                          {item.reason}
                        </span>
                      ) : null}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          ))}
        </div>
      )}

      {review.plan.warnings.length > 0 ? (
        <div className="dasti-cv-tailoring-review__warnings">
          <strong>Review notes</strong>
          <ul>
            {review.plan.warnings.map((warning) => (
              <li key={warning.id}>{warning.reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="dasti-cv-tailoring-review__footer">
        {review.plan.blocked || hasNoItems || errorMessage ? (
          <button
            type="button"
            className="dasti-button dasti-button--pill"
            onClick={onReload}
            disabled={isBusy}
          >
            Reload recommendations
          </button>
        ) : null}
        {materializedResumeName ? (
          <button
            type="button"
            className="dasti-button dasti-button--pill dasti-button--primary"
            onClick={onContinueToProposal}
          >
            Continue to proposal
          </button>
        ) : (
          <button
            type="button"
            className="dasti-button dasti-button--pill dasti-button--primary"
            onClick={onCreate}
            disabled={createDisabled}
          >
            {isBusy ? "Preparing resume…" : "Create tailored resume"}
          </button>
        )}
      </div>
    </section>
  );
}
