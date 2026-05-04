import React from "react";
import { Button } from "../ui";

type CvReviewBannerProps = {
  issueCount: number;
  summary: string;
  onOpenReview: () => void;
  onDismiss: () => void;
};

export function CvReviewBanner({
  issueCount,
  summary,
  onOpenReview,
  onDismiss,
}: CvReviewBannerProps): JSX.Element | null {
  if (issueCount <= 0) return null;

  return (
    <div className="dasti-cv-review-banner" role="status">
      <div className="dasti-cv-review-banner__icon" aria-hidden="true">
        !
      </div>
      <div className="dasti-cv-review-banner__body">
        <div className="dasti-cv-review-banner__title">
          Quick review needed.
        </div>
        <div className="dasti-cv-review-banner__desc">
          {issueCount} {issueCount === 1 ? "section needs" : "sections need"}{" "}
          confirmation. {summary}
        </div>
        <div className="dasti-cv-review-banner__actions">
          <Button type="button" size="sm" variant="secondary" onClick={onOpenReview}>
            Open import review
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}

export default CvReviewBanner;
