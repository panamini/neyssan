import React from "react";
import clsx from "clsx";

import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/ui/status-badge";
import { DiffBlock, type DiffMode } from "./DiffBlock";

type AiSuggestionCardStatus = "preview" | "accepted";
type AiSuggestionCardState = "loading" | "ready" | "error";
type AiSuggestionCardMode = "default" | "compact" | "list";

type AiSuggestionCardProps = {
  actionLabel: string;
  title?: string;
  beforeText: string;
  afterText: string;
  status?: AiSuggestionCardStatus;
  state?: AiSuggestionCardState;
  mode?: AiSuggestionCardMode;
  compact?: boolean;
  isApplying?: boolean;
  errorMessage?: string;
  onAccept?: () => void;
  onDiscard?: () => void;
  onDismiss?: () => void;
  onRetry?: () => void;
  onUndo?: () => void;
};

function overlineForAction(actionLabel: string) {
  return `AI · ${actionLabel.trim().toUpperCase()}`;
}

function resolveDiffMode(beforeText: string, afterText: string): DiffMode {
  if (beforeText && afterText) return "replace";
  if (afterText) return "add";
  return "remove";
}

function splitListText(text: string) {
  return text
    .split(/\r?\n/)
    .map((line) => line.replace(/^[-*•]\s*/, "").trim())
    .filter(Boolean);
}

function DiffArea({
  beforeText,
  afterText,
  mode,
}: {
  beforeText: string;
  afterText: string;
  mode: AiSuggestionCardMode;
}) {
  if (mode === "list") {
    const beforeItems = splitListText(beforeText);
    const afterItems = splitListText(afterText);
    const maxLength = Math.max(beforeItems.length, afterItems.length);

    return (
      <ul className="ds-ai-card__body" aria-label="Suggested changes">
        {Array.from({ length: maxLength }, (_, index) => {
          const before = beforeItems[index] ?? "";
          const after = afterItems[index] ?? "";
          const diffMode = resolveDiffMode(before, after);

          return (
            <li key={`${before}-${after}-${index}`}>
              <DiffBlock mode={diffMode} before={before} after={after} />
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <DiffBlock
      mode={resolveDiffMode(beforeText, afterText)}
      before={beforeText || undefined}
      after={afterText || undefined}
    />
  );
}

export function AiSuggestionCard({
  actionLabel,
  title,
  beforeText,
  afterText,
  status = "preview",
  state,
  mode = "default",
  compact = false,
  isApplying = false,
  errorMessage,
  onAccept,
  onDiscard,
  onDismiss,
  onRetry,
  onUndo,
}: AiSuggestionCardProps) {
  const resolvedState: AiSuggestionCardState = state ?? "ready";
  const resolvedMode: AiSuggestionCardMode = compact ? "compact" : mode;
  const resolvedTitle = title ?? `${actionLabel} suggestion`;
  const isAccepted = status === "accepted" && !isApplying;
  const statusLabel = isApplying
    ? "Applying."
    : isAccepted
      ? "Applied."
      : resolvedState === "error"
        ? "Needs review."
        : "Needs review.";

  return (
    <section
      role="region"
      aria-label={resolvedTitle}
      aria-busy={isApplying || resolvedState === "loading" || undefined}
      className={clsx(
        "ds-ai-card",
        resolvedMode === "compact" && "ds-ai-card--compact",
      )}
      data-state="open"
    >
      <div className="ds-ai-card__body">
        {resolvedMode === "compact" ? null : (
          <div className="ds-ai-card__overline">
            {overlineForAction(actionLabel)}
          </div>
        )}
        <div className="ds-ai-card__title">{resolvedTitle}</div>
      </div>

      <StatusBadge
        tone={isAccepted ? "success" : resolvedState === "error" ? "danger" : "accent"}
        pulsing={isApplying || resolvedState === "loading"}
      >
        {statusLabel}
      </StatusBadge>

      {resolvedState === "loading" || isApplying ? (
        <div className="ds-ai-card__loading">
          Reading
          <span className="ds-btn__period" aria-hidden="true">
            .
          </span>
        </div>
      ) : resolvedState === "error" ? (
        <div className="ds-ai-card__error">
          {errorMessage ?? "Couldn't finish."}
        </div>
      ) : (
        <DiffArea
          beforeText={beforeText}
          afterText={afterText}
          mode={resolvedMode}
        />
      )}

      <div className="ds-ai-card__footer">
        {resolvedState === "loading" || isApplying ? (
          <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
            Cancel
          </Button>
        ) : resolvedState === "error" ? (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onDiscard}>
              Dismiss
            </Button>
            {onRetry ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={onRetry}
              >
                Try again
              </Button>
            ) : null}
          </>
        ) : status === "preview" ? (
          <>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onDiscard}
            >
              Discard
            </Button>
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={onAccept}
            >
              Accept
            </Button>
          </>
        ) : (
          <>
            <Button type="button" variant="ghost" size="sm" onClick={onUndo}>
              Undo
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={onDismiss}>
              Close
            </Button>
          </>
        )}
      </div>
    </section>
  );
}

export default AiSuggestionCard;
