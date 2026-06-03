import React from "react";
import { ChevronDown } from "../../lib/icons";
import type { ClosingOptionGroup } from "../../lib/proposal-closing";

export type ProposalHeadingField = {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  closingOptionGroups?: ClosingOptionGroup[];
  onChange: (value: string) => void;
  onBlur?: () => void;
};

type ProposalHeadingFieldsProps = {
  variableFields: ProposalHeadingField[];
};

type PendingSelection = {
  start: number;
  end: number;
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
      "contact-linkedin",
      "contact-location",
      "contact-website",
      "contact-line",
    ],
  },
  {
    id: "recipient",
    label: "Recipient details",
    fieldIds: [
      "recipient-name",
      "recipient-role",
      "recipient-company",
      "recipient-email",
      "recipient-address",
      "recipient-city",
      "recipient-details",
    ],
  },
  {
    id: "letter-formulas",
    label: "Letter details",
    fieldIds: ["proposal-subject", "letter-date", "salutation", "signature-signoff"],
  },
] as const;

function ProposalHeadingTextField({
  field,
}: {
  field: ProposalHeadingField;
}): JSX.Element {
  const closingListId = React.useId();
  const fieldRef = React.useRef<HTMLInputElement | HTMLTextAreaElement | null>(
    null,
  );
  const pendingSelectionRef = React.useRef<PendingSelection | null>(null);
  const [isClosingPickerOpen, setIsClosingPickerOpen] = React.useState(false);
  const hasClosingOptions = Boolean(field.closingOptionGroups);
  const closingOptions = React.useMemo(() => {
    const seenOptions = new Set<string>();

    return (field.closingOptionGroups ?? []).flatMap((group) =>
      group.options.flatMap((option) => {
        if (seenOptions.has(option)) {
          return [];
        }

        seenOptions.add(option);

        return [
          {
            option,
            recommended:
              group.id === "recommended" ||
              group.label.toLowerCase() === "recommended",
          },
        ];
      }),
    );
  }, [field.closingOptionGroups]);
  const textareaRows = field.multiline
    ? Math.max(
        3,
        field.value.split("\n").length,
        (field.placeholder ?? "").split("\n").length,
      )
    : undefined;

  React.useLayoutEffect(() => {
    const pendingSelection = pendingSelectionRef.current;
    const input = fieldRef.current;
    if (!pendingSelection || !input || document.activeElement !== input) {
      return;
    }

    const maxSelection = input.value.length;
    input.setSelectionRange(
      Math.min(pendingSelection.start, maxSelection),
      Math.min(pendingSelection.end, maxSelection),
    );
    pendingSelectionRef.current = null;
  }, [field.value]);

  const handleChange = React.useCallback(
    (
      event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      const target = event.currentTarget;
      const fallbackSelection = target.value.length;
      pendingSelectionRef.current = {
        start: target.selectionStart ?? fallbackSelection,
        end: target.selectionEnd ?? target.selectionStart ?? fallbackSelection,
      };
      field.onChange(target.value);
    },
    [field],
  );

  const handleClosingOptionClick = React.useCallback(
    (option: string) => {
      pendingSelectionRef.current = null;
      field.onChange(option);
      setIsClosingPickerOpen(false);
    },
    [field],
  );

  const handleClosingKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (event.key === "Escape") {
        setIsClosingPickerOpen(false);
      }
    },
    [],
  );

  const inputControl = field.multiline ? (
    <textarea
      ref={(node) => {
        fieldRef.current = node;
      }}
      className="ds-field ds-field--textarea"
      aria-label={field.label}
      value={field.value}
      placeholder={field.placeholder}
      rows={textareaRows}
      onChange={handleChange}
      onBlur={field.onBlur}
    />
  ) : (
    <input
      ref={(node) => {
        fieldRef.current = node;
      }}
      className="ds-field"
      aria-label={field.label}
      value={field.value}
      placeholder={field.placeholder}
      onChange={handleChange}
      onBlur={field.onBlur}
    />
  );

  return (
    <div
      className={[
        "dasti-proposal-skeleton-rail__variable-field",
        field.multiline
          ? "dasti-proposal-skeleton-rail__variable-field--wide"
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
      onKeyDown={hasClosingOptions ? handleClosingKeyDown : undefined}
    >
      {hasClosingOptions ? (
        <div
          className="dasti-proposal-skeleton-rail__closing-combobox"
          aria-label="Closing formula"
        >
          <label className="dasti-proposal-skeleton-rail__closing-field-shell">
            {inputControl}
            <button
              type="button"
              className="dasti-proposal-skeleton-rail__closing-field-trigger"
              aria-label="Choose closing formula"
              aria-expanded={isClosingPickerOpen}
              aria-controls={closingListId}
              onClick={() => setIsClosingPickerOpen((isOpen) => !isOpen)}
            >
              <ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </label>
          {isClosingPickerOpen ? (
            <div
              id={closingListId}
              className="dasti-proposal-skeleton-rail__closing-picker"
              aria-label="Closing formula options"
            >
              {closingOptions.map(({ option, recommended }) => (
                <button
                  key={option}
                  type="button"
                  className={[
                    "dasti-proposal-skeleton-rail__closing-option",
                    option === field.value
                      ? "dasti-proposal-skeleton-rail__closing-option--active"
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                  aria-label={option}
                  aria-pressed={option === field.value}
                  onClick={() => handleClosingOptionClick(option)}
                >
                  <span>{option}</span>
                  {recommended ? (
                    <small className="dasti-proposal-skeleton-rail__closing-recommended">
                      Recommended
                    </small>
                  ) : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <label className="dasti-proposal-skeleton-rail__variable-field-label">
          {inputControl}
        </label>
      )}
    </div>
  );
}

function renderVariableField(field: ProposalHeadingField): JSX.Element {
  return <ProposalHeadingTextField key={field.id} field={field} />;
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
