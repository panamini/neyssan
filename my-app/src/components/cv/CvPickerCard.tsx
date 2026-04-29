import React from "react";
import clsx from "clsx";
import { ArrowRight } from "@/lib/icons";

import {
  formatCvDisplaySubtitle,
} from "../../lib/proposal-personalization";
import { formatUiDate } from "../../lib/ui-date";

export type CvPickerCardOption = {
  id: string;
  title: string;
  updatedAt?: string;
  createdAt?: string;
  profileName?: string;
  desiredPosition?: string;
  email?: string;
  phone?: string;
  linkedin?: string;
  website?: string;
};

type CvPickerCardProps = {
  actionLabel?: string;
  compact?: boolean;
  onAction?: (id: string) => void;
  onSelect?: (id: string) => void;
  option: CvPickerCardOption;
  selected?: boolean;
};

export function CvPickerCard({
  actionLabel,
  compact = false,
  onAction,
  onSelect,
  option,
  selected,
}: CvPickerCardProps): JSX.Element {
  const chooserDateSource = option.updatedAt ?? option.createdAt ?? null;
  const chooserDate = formatUiDate(chooserDateSource);
  const cardClassName = clsx(
    "ds-card dasti-doc-card dasti-doc-card--library dasti-doc-card--chooser dasti-doc-card--cv-library",
    compact && "dasti-doc-card--compact",
    selected && "ds-card--elevated dasti-doc-card--selected",
  );
  const footerClassName = clsx(
    "ds-card__footer dasti-doc-card__footer dasti-doc-card__footer--chooser dasti-doc-card__footer--stamp-only",
    onAction && "dasti-doc-card__footer--chooser-action",
  );
  const cardBody = (
    <div className="dasti-doc-card__stack">
      <div className="dasti-doc-card__header">
        <div className="dasti-doc-card__title-frame">
          <h3 className="ds-card__title dasti-doc-card__title">{option.title}</h3>
        </div>
      </div>

      <div className="ds-card__body dasti-doc-card__meta">
        {formatCvDisplaySubtitle({
          title: option.title,
          profileName: option.profileName,
          desiredPosition: option.desiredPosition,
          email: option.email,
          linkedin: option.linkedin,
          website: option.website,
          phone: option.phone,
        }) || "Draft resume"}
      </div>

      <div className={footerClassName}>
        <div className="dasti-doc-card__stamp">{chooserDate ?? ""}</div>
        {actionLabel && onAction ? (
          <button
            type="button"
            className="dasti-icon-button dasti-doc-card__action-arrow"
            aria-label={actionLabel}
            onClick={(event) => {
              event.stopPropagation();
              onAction(option.id);
            }}
          >
            <ArrowRight size={16} strokeWidth={1.9} aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );

  return (
    onSelect ? (
      <button
        type="button"
        className={cardClassName}
        data-interactive="true"
        aria-pressed={selected}
        onClick={() => onSelect(option.id)}
      >
        {cardBody}
      </button>
    ) : (
      <div className={cardClassName}>{cardBody}</div>
    )
  );
}
