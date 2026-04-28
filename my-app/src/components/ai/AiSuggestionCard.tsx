import React from "react";

type AiSuggestionCardStatus = "preview" | "accepted";

type AiSuggestionCardProps = {
  actionLabel: string;
  title?: string;
  beforeText: string;
  afterText: string;
  status?: AiSuggestionCardStatus;
  compact?: boolean;
  isApplying?: boolean;
  onAccept?: () => void;
  onDiscard?: () => void;
  onUndo?: () => void;
};

export function AiSuggestionCard({
  actionLabel,
  title,
  beforeText,
  afterText,
  status = "preview",
  compact = false,
  isApplying = false,
  onAccept,
  onDiscard,
  onUndo,
}: AiSuggestionCardProps) {
  const resolvedTitle = title ?? `${actionLabel} suggestion`;
  const statusLabel = isApplying
    ? "Applying"
    : status === "accepted"
      ? "Applied"
      : "Needs review";
  const isAcceptedStatus = status === "accepted" && !isApplying;
  const statusStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    minHeight: "20px",
    padding: "0 var(--s2)",
    borderRadius: "var(--radius-pill)",
    border: isAcceptedStatus
      ? "1px solid color-mix(in srgb, var(--color-success) 10%, var(--color-border))"
      : "1px solid color-mix(in srgb, var(--color-border) 78%, transparent)",
    background: isAcceptedStatus
      ? "color-mix(in srgb, var(--color-success-soft) 26%, transparent)"
      : "color-mix(in srgb, var(--sf2) 48%, transparent)",
    color: isAcceptedStatus ? "var(--color-success-ink)" : "var(--tm2)",
    fontSize: "10px",
    fontWeight: 650,
    lineHeight: 1,
    whiteSpace: "nowrap",
  };

  return (
    <section
      role="region"
      aria-label={resolvedTitle}
      aria-busy={isApplying || undefined}
      style={{
        display: "grid",
        gap: compact ? "var(--s2)" : "var(--s3)",
        padding: compact ? "var(--s2)" : "var(--s3)",
        borderRadius: "calc(var(--radius-card) - 4px)",
        border:
          status === "accepted"
            ? "1px solid color-mix(in srgb, var(--color-success) 6%, var(--color-border))"
            : "1px solid color-mix(in srgb, var(--color-border) 86%, transparent)",
        background: "var(--sfr)",
        boxShadow:
          "0 1px 2px color-mix(in srgb, var(--shadow-color) 10%, transparent)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--s3)",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "grid",
            gap: "var(--s1)",
            minWidth: 0,
          }}
        >
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.1em",
              lineHeight: 1.2,
              textTransform: "uppercase",
              color: "var(--color-accent-hover)",
            }}
          >
            AI draft
          </div>
          <div
            style={{
              fontSize: "var(--ts)",
              fontWeight: 650,
              lineHeight: "var(--ls)",
              color: "var(--ti)",
            }}
          >
            {resolvedTitle}
          </div>
        </div>
        <span aria-live="polite" style={statusStyle}>
          {statusLabel}
        </span>
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--s2)",
          gridTemplateColumns: compact
            ? "1fr"
            : "minmax(0, 0.95fr) minmax(0, 1.05fr)",
        }}
      >
        <TextPanel
          label="Current"
          text={beforeText || "No existing content."}
          variant="before"
        />
        <TextPanel
          label="Proposed"
          text={afterText}
          variant={status === "accepted" ? "accepted" : "after"}
        />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--s1)",
          flexWrap: "wrap",
          paddingTop: "var(--s1)",
        }}
      >
        {status === "preview" ? (
          <>
            <button
              type="button"
              className="dasti-button dasti-button--ghost dasti-button--sm"
              onClick={onDiscard}
              disabled={isApplying}
            >
              Discard
            </button>
            <button
              type="button"
              className="dasti-button dasti-button--accent dasti-button--sm"
              onClick={onAccept}
              disabled={isApplying}
            >
              Accept
            </button>
          </>
        ) : (
          <button
            type="button"
            className="dasti-button dasti-button--ghost dasti-button--sm"
            onClick={onUndo}
            disabled={isApplying}
          >
            Undo
          </button>
        )}
      </div>
    </section>
  );
}

function TextPanel({
  label,
  text,
  variant,
}: {
  label: string;
  text: string;
  variant: "before" | "after" | "accepted";
}) {
  const isBefore = variant === "before";
  const isAccepted = variant === "accepted";
  const panelStyle: React.CSSProperties = {
    display: "grid",
    gap: "var(--s1)",
    minWidth: 0,
    paddingLeft: "var(--s2)",
    borderLeft: isBefore
      ? "2px solid color-mix(in srgb, var(--color-border) 72%, transparent)"
      : isAccepted
        ? "2px solid color-mix(in srgb, var(--color-success) 24%, transparent)"
        : "2px solid color-mix(in srgb, var(--color-accent) 34%, transparent)",
  };
  const textStyle: React.CSSProperties = {
    minHeight: "1.75rem",
    whiteSpace: "pre-wrap",
    fontSize: "var(--tx)",
    lineHeight: "var(--lx)",
    color: isBefore ? "var(--tm2)" : "var(--ti)",
    overflowWrap: "anywhere",
    padding: isBefore ? undefined : "var(--s1) var(--s2)",
    borderRadius: isBefore ? undefined : "calc(var(--radius-card) - 8px)",
    background: isBefore
      ? undefined
      : isAccepted
        ? "color-mix(in srgb, var(--color-success-soft) 16%, transparent)"
        : "color-mix(in srgb, var(--color-accent-pale) 22%, transparent)",
  };

  return (
    <div role="group" aria-label={`${label} text`} style={panelStyle}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s2)",
        }}
      >
        <span
          style={{
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.08em",
            lineHeight: 1.2,
            textTransform: "uppercase",
            color: isBefore
              ? "var(--tm2)"
              : isAccepted
                ? "var(--color-success-ink)"
                : "var(--color-accent-hover)",
          }}
        >
          {label}
        </span>
      </div>
      <div style={textStyle}>{text}</div>
    </div>
  );
}

export default AiSuggestionCard;
