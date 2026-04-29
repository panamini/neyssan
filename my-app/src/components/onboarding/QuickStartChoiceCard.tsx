import React from "react";
import { Loader2, X } from "@/lib/icons";
import { BodyPortal } from "@/components/ui/body-portal";
import { useCloseOnEscape } from "@/hooks/use-close-on-escape";

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
  expandedPlacement?: "inline" | "centered";
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
  expandedPlacement = "inline",
}: Props): JSX.Element {
  const showExpanded = selected && Boolean(expandedContent);
  return (
    <div
      className={["ds-card", "dasti-quick-start-choice", className]
        .filter(Boolean)
        .join(" ")}
      data-interactive={disabled || loading ? undefined : "true"}
      data-state={loading ? "loading" : undefined}
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
            <div className="ds-card__title dasti-quick-start-choice__title">
              {label}
            </div>
          </div>
          <div className="ds-card__body dasti-quick-start-choice__hint">
            {hint}
          </div>
          {meta ? <div className="dasti-quick-start-choice__meta">{meta}</div> : null}
        </div>
      </button>
      {showExpanded && expandedPlacement === "inline" ? (
        <div className="dasti-quick-start-choice__expanded">{expandedContent}</div>
      ) : null}
      {showExpanded && expandedPlacement === "centered" ? (
        <CenteredQuickStartDrawer title={label} onClose={onClick}>
          {expandedContent}
        </CenteredQuickStartDrawer>
      ) : null}
    </div>
  );
}

function CenteredQuickStartDrawer({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}): JSX.Element | null {
  useCloseOnEscape({
    open: true,
    onClose,
  });

  return (
    <BodyPortal>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="dasti-dialog-root fixed inset-0 z-[10000] flex items-center justify-center p-4"
      >
        <div
          className="dasti-dialog-overlay fixed inset-0"
          style={{
            background: "var(--dialog-backdrop-bg-strong)",
            backdropFilter: "blur(var(--dialog-backdrop-blur)) saturate(1.2)",
            WebkitBackdropFilter:
              "blur(var(--dialog-backdrop-blur)) saturate(1.2)",
          }}
          onClick={onClose}
          aria-hidden="true"
        />
        <div className="dasti-dialog-panel relative isolate [background:var(--sfr)] border [border-color:var(--color-border)] [border-radius:var(--radius-surface)] [box-shadow:var(--shc)] w-full overflow-hidden [max-width:var(--modal-max-width)]">
          <div
            className="flex items-start justify-between gap-4 border-b px-6 py-5 [border-color:var(--color-border)]"
            style={{
              background: "var(--frost-bg)",
              backdropFilter: "blur(12px) saturate(1.4)",
              WebkitBackdropFilter: "blur(12px) saturate(1.4)",
            }}
          >
            <div className="min-w-0">
              <h2
                className="text-[var(--tm)] font-semibold leading-[var(--ll)] text-foreground"
                style={{
                  fontFamily:
                    "var(--proposal-ui-heading-trial-font, var(--font-body-family))",
                }}
              >
                {title}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-[var(--hs)] min-w-[var(--hs)] items-center justify-center border border-transparent bg-transparent px-2 [border-radius:var(--radius-control)] [color:var(--tm2)] transition-colors hover:[background:var(--sf2)] hover:[color:var(--ti)]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="px-6 py-4 text-foreground">{children}</div>
        </div>
      </div>
    </BodyPortal>
  );
}
