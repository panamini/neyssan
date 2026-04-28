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

  return (
    <section
      role="region"
      aria-label={resolvedTitle}
      style={{
        display: "grid",
        gap: compact ? "var(--s2)" : "var(--s3)",
        padding: compact ? "var(--s2)" : "var(--s3)",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--color-border)",
        background: "var(--sfr)",
        boxShadow: "0 1px 2px color-mix(in srgb, var(--shadow-color) 12%, transparent)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--s2)",
        }}
      >
        <div
          style={{
            fontSize: "var(--tx)",
            fontWeight: 650,
            color: "var(--ti)",
          }}
        >
          {resolvedTitle}
        </div>
        {status === "accepted" ? (
          <span
            style={{
              fontSize: "var(--ts)",
              color: "var(--tm2)",
            }}
          >
            Applied
          </span>
        ) : null}
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--s2)",
          gridTemplateColumns: compact ? "1fr" : "repeat(2, minmax(0, 1fr))",
        }}
      >
        <TextPanel label="Before" text={beforeText || "No existing content."} muted />
        <TextPanel label="After" text={afterText} />
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          gap: "var(--s2)",
          flexWrap: "wrap",
        }}
      >
        {status === "preview" ? (
          <>
            <button
              type="button"
              className="dasti-button dasti-button--secondary dasti-button--sm"
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
            className="dasti-button dasti-button--secondary dasti-button--sm"
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
  muted = false,
}: {
  label: string;
  text: string;
  muted?: boolean;
}) {
  return (
    <div style={{ display: "grid", gap: "var(--s1)" }}>
      <div
        style={{
          fontSize: "var(--ts)",
          fontWeight: 600,
          color: "var(--tm2)",
        }}
      >
        {label}
      </div>
      <div
        style={{
          minHeight: "2.25rem",
          whiteSpace: "pre-wrap",
          fontSize: "var(--tx)",
          lineHeight: "var(--lx)",
          color: muted ? "var(--tm2)" : "var(--ti)",
          textDecoration: muted ? "line-through" : undefined,
        }}
      >
        {text}
      </div>
    </div>
  );
}

export default AiSuggestionCard;
