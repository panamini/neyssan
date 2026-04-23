import React from "react";
import clsx from "clsx";

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
  onSelect: (id: string) => void;
  option: CvPickerCardOption;
  selected: boolean;
};

export function CvPickerCard({
  onSelect,
  option,
  selected,
}: CvPickerCardProps): JSX.Element {
  const chooserDateSource = option.updatedAt ?? option.createdAt ?? null;
  const chooserDate = formatUiDate(chooserDateSource);

  return (
    <button
      type="button"
      className={clsx(
        "dasti-doc-card dasti-doc-card--library dasti-doc-card--chooser dasti-doc-card--cv-library",
        selected && "dasti-doc-card--selected",
      )}
      aria-pressed={selected}
      onClick={() => onSelect(option.id)}
    >
      <div className="dasti-doc-card__stack">
        <div className="dasti-doc-card__header">
          <div className="dasti-doc-card__title-frame">
            <h3 className="dasti-doc-card__title">{option.title}</h3>
          </div>
        </div>

        <div className="dasti-doc-card__meta">
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

        <div className="dasti-doc-card__footer dasti-doc-card__footer--chooser dasti-doc-card__footer--stamp-only">
          <div className="dasti-doc-card__stamp">{chooserDate ?? ""}</div>
        </div>
      </div>
    </button>
  );
}
