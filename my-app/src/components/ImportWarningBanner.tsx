import React from "react";

type ImportWarningBannerProps = {
  signalCount: number;
  onReview: () => void;
  onDismiss: () => void;
  reviewLabel?: string;
  isExiting?: boolean;
};

export default function ImportWarningBanner({
  signalCount,
  onReview,
  onDismiss,
  reviewLabel = "Review flagged fields",
  isExiting = false,
}: ImportWarningBannerProps): JSX.Element {
  const issueLabel = signalCount === 1 ? "issue" : "issues";

  return (
    <section
      className="dasti-import-warning-banner"
      aria-label="Import warning"
      role="status"
      data-visibility={isExiting ? "hidden" : "visible"}
    >
      <div className="dasti-import-warning-banner__body">
        <div className="dasti-import-warning-banner__eyebrow">Import check</div>
        <p className="dasti-import-warning-banner__title">
          Imported CV needs review
        </p>
        <p className="dasti-import-warning-banner__summary">
          {signalCount} {issueLabel} flagged. Review before proposals or export.
        </p>
      </div>
      <div className="dasti-import-warning-banner__actions">
        <button
          type="button"
          className="dasti-import-warning-banner__review"
          onClick={onReview}
        >
          {reviewLabel}
        </button>
        <button
          type="button"
          className="dasti-import-warning-banner__dismiss"
          onClick={onDismiss}
        >
          Dismiss
        </button>
      </div>
    </section>
  );
}
