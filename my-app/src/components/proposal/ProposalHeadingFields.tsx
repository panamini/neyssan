import React from "react";

export type ProposalHeadingField = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
};

type ProposalHeadingFieldsProps = {
  variableFields: ProposalHeadingField[];
};

const HEADING_FIELD_GROUPS = [
  {
    id: "applicant",
    label: "Applicant details",
    fieldIds: [
      "applicant-name",
      "applicant-role",
      "applicant-company",
      "contact-email",
      "contact-phone",
      "contact-location",
      "contact-linkedin",
      "contact-website",
      "contact-line",
    ],
  },
  {
    id: "recipient",
    label: "Recipient details",
    fieldIds: ["recipient-details"],
  },
  {
    id: "letter-formulas",
    label: "Letter details",
    fieldIds: ["proposal-subject", "letter-date", "salutation"],
  },
] as const;

function renderVariableField(field: ProposalHeadingField): JSX.Element {
  const textareaRows = field.multiline
    ? Math.max(
        3,
        field.value.split("\n").length,
        (field.placeholder ?? "").split("\n").length,
      )
    : undefined;

  return (
    <label
      key={field.id}
      className={[
        "dasti-proposal-skeleton-rail__variable-field",
        field.multiline
          ? "dasti-proposal-skeleton-rail__variable-field--wide"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {field.multiline ? (
        <textarea
          className="ds-field ds-field--textarea"
          aria-label={field.label}
          value={field.value}
          placeholder={field.placeholder}
          rows={textareaRows}
          onChange={(event) => field.onChange(event.target.value)}
          onBlur={field.onBlur}
        />
      ) : (
        <input
          className="ds-field"
          aria-label={field.label}
          value={field.value}
          placeholder={field.placeholder}
          onChange={(event) => field.onChange(event.target.value)}
          onBlur={field.onBlur}
        />
      )}
    </label>
  );
}

export function ProposalHeadingFields({
  variableFields,
}: ProposalHeadingFieldsProps): JSX.Element {
  const headingFieldGroups = HEADING_FIELD_GROUPS.map((group) => ({
    ...group,
    fields: group.fieldIds
      .map((fieldId) => variableFields.find((field) => field.id === fieldId))
      .filter((field): field is ProposalHeadingField => Boolean(field)),
  })).filter((group) => group.fields.length > 0);

  const groupedHeadingFieldIds = new Set(
    headingFieldGroups.flatMap((group) =>
      group.fields.map((field) => field.id),
    ),
  );
  const remainingHeadingFields = variableFields.filter(
    (field) => !groupedHeadingFieldIds.has(field.id),
  );

  return (
    <div className="dasti-proposal-heading-fields dasti-proposal-skeleton-rail__header-details">
      <div className="dasti-proposal-skeleton-rail__drawer-body">
        {variableFields.length > 0 ? (
          <div className="dasti-proposal-skeleton-rail__variables">
            {headingFieldGroups.map((group) => (
              <div
                key={group.id}
                className={`dasti-proposal-skeleton-rail__variable-group dasti-proposal-skeleton-rail__variable-group--${group.id}`}
              >
                <div className="dasti-proposal-skeleton-rail__variable-group-title">
                  {group.label}
                </div>
                <div className="dasti-proposal-skeleton-rail__variable-group-fields">
                  {group.fields.map(renderVariableField)}
                </div>
              </div>
            ))}
            {remainingHeadingFields.length > 0 ? (
              <div className="dasti-proposal-skeleton-rail__variable-group">
                <div className="dasti-proposal-skeleton-rail__variable-group-title">
                  Other heading fields
                </div>
                <div className="dasti-proposal-skeleton-rail__variable-group-fields">
                  {remainingHeadingFields.map(renderVariableField)}
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="dasti-proposal-skeleton-rail__hint">
            Generate a draft to edit document header details here.
          </p>
        )}
      </div>
    </div>
  );
}

export default ProposalHeadingFields;
