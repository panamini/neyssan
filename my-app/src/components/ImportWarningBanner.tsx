import React from "react";

import { Gear } from "@/lib/icons";

type ImportWarningBannerProps = {
  signalCount: number;
  onReview: () => void;
  onDismiss: () => void;
  reviewLabel?: string;
  isExiting?: boolean;
  recoveryAction?: {
    label: string;
    onClick: () => void;
  } | null;
};

export default function ImportWarningBanner({
  signalCount,
  onReview,
  onDismiss,
  reviewLabel = "Review flagged fields",
  isExiting = false,
  recoveryAction = null,
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
          Resume needs review.
        </p>
        <p className="dasti-import-warning-banner__summary">
          {signalCount} {issueLabel} flagged. Review before export.
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
        {recoveryAction ? (
          <button
            type="button"
            className="dasti-import-warning-banner__recovery"
            onClick={recoveryAction.onClick}
          >
            <Gear size={14} strokeWidth={1.8} aria-hidden="true" />
            {recoveryAction.label}
          </button>
        ) : null}
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
