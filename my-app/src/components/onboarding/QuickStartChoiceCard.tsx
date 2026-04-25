import React from "react";
import { Loader2 } from "@/lib/icons";

type Props = {
  label: string;
  hint: string;
  onClick: () => void;
  disabled?: boolean;
  loading?: boolean;
  meta?: string | null;
  expandedContent?: React.ReactNode;
  selected?: boolean;
  testId?: string;
  primaryAction?: boolean;
  className?: string;
};

export function QuickStartChoiceCard({
  label,
  hint,
  onClick,
  disabled = false,
  loading = false,
  meta = null,
  expandedContent,
  selected = false,
  testId,
  primaryAction = false,
  className,
}: Props): JSX.Element {
  return (
    <div
      className={["dasti-quick-start-choice", className].filter(Boolean).join(" ")}
      data-quick-start-selected={selected ? "true" : undefined}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={expandedContent ? selected : undefined}
        aria-busy={loading || undefined}
        disabled={disabled || loading}
        data-quick-start-primary-action={primaryAction ? "true" : undefined}
        data-testid={testId}
        className="dasti-quick-start-choice__button"
      >
        <div className="dasti-quick-start-choice__body">
          <div className="dasti-quick-start-choice__title-row">
            {loading ? (
              <Loader2
                size={15}
                className="animate-spin dasti-quick-start-choice__loader"
                aria-hidden="true"
              />
            ) : null}
            <div className="dasti-quick-start-choice__title">{label}</div>
          </div>
          <div className="dasti-quick-start-choice__hint">{hint}</div>
          {meta ? <div className="dasti-quick-start-choice__meta">{meta}</div> : null}
        </div>
      </button>
      {selected && expandedContent ? (
        <div className="dasti-quick-start-choice__expanded">{expandedContent}</div>
      ) : null}
    </div>
  );
}
