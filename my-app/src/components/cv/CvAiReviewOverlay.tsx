import React from "react";
import { ArrowLeft } from "@/lib/icons";
import {
  useCvAiSurfacePosition,
  type CvAiSurfacePlacement,
  type CvAiSurfacePosition,
} from "@/lib/cv-ai-surface-position";
import BodyPortal from "../ui/body-portal";
import type { EditorSelectionAnchor } from "../../lib/editor-ai-selection";

export type CvAiReviewTarget = {
  sectionId: string;
  sectionType: string;
  sectionLabel: string;
  itemId?: string;
  itemLabel?: string;
  fieldPath?: string;
  fieldKind?: "paragraph" | "heading" | "bullet" | "chip" | "date" | "meta";
  selectedText?: string;
};

export type CvAiReviewState = "loading" | "ready" | "error" | "accepted";

type CvAiReviewOverlayProps = {
  open: boolean;
  target: CvAiReviewTarget;
  state: CvAiReviewState;
  beforeText: string;
  afterText: string;
  errorMessage?: string;
  actionId?: string;
  interactionId?: string;
  anchor?: EditorSelectionAnchor | null;
  preferredPlacement?: CvAiSurfacePlacement | null;
  preferredSurfacePosition?: CvAiSurfacePosition | null;
  primaryActionLabel?: string;
  onAccept: () => void;
  onDiscard: () => void;
  onCopy?: () => void;
  onInsertAfter?: () => void;
  onRetry?: () => void;
  onUndo?: () => void;
};

const OVERLAY_MAX_WIDTH = 420;
const ESTIMATED_POPOVER_HEIGHT = 320;
const OVERLAY_MIN_WIDTH = 320;
const OVERLAY_MIN_HEIGHT = 156;
const OVERLAY_HEADER_HEIGHT = 48;
const OVERLAY_ACTIONS_HEIGHT = 54;
const OVERLAY_BODY_VERTICAL_PADDING = 20;
const OVERLAY_BODY_LINE_HEIGHT = 18;

function buildTargetLabel(target: CvAiReviewTarget): string {
  return [target.sectionLabel, target.itemLabel].filter(Boolean).join(" · ");
}

function buildHeaderActionLabel(
  target: CvAiReviewTarget,
  actionId: string | undefined,
  primaryActionLabel: string,
): string {
  const normalizedAction = String(actionId ?? "").toLowerCase();
  const normalizedPrimary = primaryActionLabel.toLowerCase();
  const fieldPath = String(target.fieldPath ?? "").toLowerCase();

  if (normalizedAction === "rewrite") return "Rewrite";
  if (normalizedAction === "shorten") return "Shorten";
  if (normalizedAction === "fix" || normalizedAction === "fix_grammar") {
    return "Fix grammar";
  }
  if (normalizedAction === "clarify") return "Clarify";
  if (normalizedAction === "strengthen") return "Strengthen";
  if (normalizedAction === "expand") return "Expand";
  if (normalizedAction === "tailor_to_job") return "Tailor";
  if (
    normalizedAction.includes("responsibil") ||
    normalizedPrimary.includes("responsibil") ||
    fieldPath.includes("responsibil")
  ) {
    return "Responsibilities";
  }
  if (target.sectionType === "education") return "Wording";
  if (target.sectionType === "project" || target.sectionType === "projects") {
    return "Project";
  }
  if (normalizedAction.includes("custom") || normalizedPrimary === "replace") {
    return "Wording";
  }

  return primaryActionLabel.replace(/^Replace\s+/i, "") || "Wording";
}

function buildPrimaryActionAriaLabel(
  primaryActionLabel: string,
  targetLabel: string,
): string {
  return targetLabel
    ? `${primaryActionLabel} in ${targetLabel}`
    : primaryActionLabel;
}

function estimateTextLineCount(text: string): number {
  const normalized = text.trim();
  if (!normalized) return 1;
  const explicitLines = normalized.split(/\r?\n/);
  return explicitLines.reduce((total, line) => {
    return total + Math.max(1, Math.ceil(line.length / 68));
  }, 0);
}

function estimateCvAiReviewSurfaceHeight({
  state,
  afterText,
  errorMessage,
}: {
  state: CvAiReviewState;
  afterText: string;
  errorMessage?: string;
}): number {
  if (state === "loading") return 112;
  if (state === "accepted") return 118;
  if (state === "error") {
    const lines = estimateTextLineCount(
      errorMessage ?? "AI suggestion is unavailable.",
    );
    return Math.min(
      ESTIMATED_POPOVER_HEIGHT,
      OVERLAY_HEADER_HEIGHT +
        OVERLAY_BODY_VERTICAL_PADDING +
        lines * OVERLAY_BODY_LINE_HEIGHT +
        OVERLAY_ACTIONS_HEIGHT,
    );
  }

  const lines = estimateTextLineCount(afterText);
  return Math.min(
    ESTIMATED_POPOVER_HEIGHT,
    Math.max(
      OVERLAY_MIN_HEIGHT,
      OVERLAY_HEADER_HEIGHT +
        OVERLAY_BODY_VERTICAL_PADDING +
        lines * OVERLAY_BODY_LINE_HEIGHT +
        OVERLAY_ACTIONS_HEIGHT,
    ),
  );
}

export function CvAiReviewOverlay({
  open,
  target,
  state,
  beforeText,
  afterText,
  errorMessage,
  actionId,
  interactionId,
  anchor = null,
  preferredPlacement = null,
  preferredSurfacePosition = null,
  primaryActionLabel = "Replace",
  onAccept,
  onDiscard,
  onRetry,
  onUndo,
}: CvAiReviewOverlayProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const surfaceState =
    state === "loading"
      ? "loading"
      : state === "accepted"
        ? "applied"
        : "result";
  const estimatedSurfaceHeight = estimateCvAiReviewSurfaceHeight({
    state,
    afterText,
    errorMessage,
  });
  const surfacePosition = useCvAiSurfacePosition({
    anchor,
    desiredSurfaceSize: {
      width: OVERLAY_MAX_WIDTH,
      height: estimatedSurfaceHeight,
      minWidth: OVERLAY_MIN_WIDTH,
      minHeight: OVERLAY_MIN_HEIGHT,
    },
    mode: surfaceState,
    preferredPlacement,
    preferredSurfaceCenterX: preferredSurfacePosition
      ? preferredSurfacePosition.left + preferredSurfacePosition.maxWidth / 2
      : null,
    enabled: open,
  });

  React.useEffect(() => {
    if (!open) return;
    previousFocusRef.current =
      typeof document !== "undefined" &&
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    window.requestAnimationFrame(() => panelRef.current?.focus());
    return () => {
      previousFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [open]);

  React.useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onDiscard();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onDiscard, open]);

  if (!open) return null;

  const targetLabel = buildTargetLabel(target);
  const headerActionLabel = buildHeaderActionLabel(
    target,
    actionId,
    primaryActionLabel,
  );
  const headerLabel = headerActionLabel;
  const primaryActionAriaLabel = buildPrimaryActionAriaLabel(
    primaryActionLabel,
    targetLabel,
  );
  const surfaceMode = surfacePosition?.mode ?? "popover";
  const placement =
    surfaceMode === "sheet" ? "sheet" : surfacePosition?.placement ?? "below";
  const surfaceStyle: React.CSSProperties | undefined = surfacePosition
    ? {
        width: surfacePosition.maxWidth,
        maxHeight: surfacePosition.maxHeight,
        left: surfacePosition.left,
        top: surfacePosition.top,
      }
    : undefined;

  return (
    <BodyPortal>
      <div
        className="dasti-cv-ai-review-layer"
        data-cv-ai-surface-group="true"
        data-cv-ai-surface-state={surfaceState}
        data-cv-ai-surface-placement={placement}
        data-cv-ai-surface-clamped={
          surfacePosition?.clamped ? "true" : "false"
        }
        data-cv-ai-surface-mode={surfaceMode}
        data-cv-ai-review-layer="true"
        data-cv-ai-review-mode={surfaceMode}
        data-cv-ai-review-placement={placement}
        data-cv-ai-popup-mode={surfaceMode}
        data-cv-ai-popup-placement={placement}
        data-cv-ai-popup-clamped={
          surfaceMode === "popover" && surfacePosition?.clamped
            ? "true"
            : "false"
        }
        data-cv-ai-review-target-section-id={target.sectionId}
        data-cv-ai-review-section-type={target.sectionType}
        data-cv-ai-review-target-item-id={target.itemId}
        data-cv-ai-review-field-path={target.fieldPath}
        data-cv-ai-review-action-id={actionId}
        data-cv-ai-review-interaction-id={interactionId}
        data-cv-ai-review-tokenized="true"
      >
        {surfaceMode === "sheet" ? (
          <button
            type="button"
            className="dasti-cv-ai-review-layer__scrim"
            aria-label="Dismiss AI review"
            onClick={onDiscard}
          />
        ) : null}
        <div
          ref={panelRef}
          className="dasti-cv-ai-review"
          data-cv-ai-review-surface="true"
          role="dialog"
          aria-modal="false"
          aria-label={`AI review for ${targetLabel}`}
          tabIndex={-1}
          style={surfaceStyle}
        >
          <div
            className="dasti-cv-ai-review__toolbar"
            data-cv-ai-review-toolbar="true"
          >
            <button
              type="button"
              className="dasti-cv-ai-review__icon-button"
              aria-label="Back from AI review"
              onClick={onDiscard}
            >
              <ArrowLeft size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
            <h2 className="dasti-cv-ai-review__title" title={headerLabel}>
              <span className="dasti-cv-ai-review__action-label">
                {headerActionLabel}
              </span>
            </h2>
          </div>

          <div
            className="dasti-cv-ai-review__body"
            data-cv-ai-review-body="true"
          >
            {state === "loading" ? (
              <div
                className="dasti-cv-ai-review__status"
                role="status"
                aria-live="polite"
              >
                Generating suggestion<span className="ds-btn__period">.</span>
              </div>
            ) : state === "error" ? (
              <div className="dasti-cv-ai-review__status" role="alert">
                {errorMessage ?? "AI suggestion is unavailable."}
              </div>
            ) : state === "accepted" ? (
              <div
                className="dasti-cv-ai-review__accepted"
                role="status"
                aria-live="polite"
              >
                <span>Applied.</span>
                {onUndo ? (
                  <button
                    type="button"
                    className="dasti-cv-ai-review__undo"
                    onClick={onUndo}
                  >
                    Undo
                  </button>
                ) : null}
              </div>
            ) : (
              <div
                className="dasti-cv-ai-review__result"
                aria-label="Suggested rewrite"
              >
                {afterText}
              </div>
            )}
          </div>

          {state === "ready" || (state === "error" && onRetry) ? (
            <div className="dasti-cv-ai-review__actions">
              {state === "error" && onRetry ? (
                <button
                  type="button"
                  className="ds-btn ds-btn--primary dasti-cv-ai-review__action dasti-cv-ai-review__action--primary"
                  onClick={onRetry}
                >
                  Try again
                </button>
              ) : null}
              {state === "ready" ? (
                <button
                  type="button"
                  className="ds-btn ds-btn--primary dasti-cv-ai-review__action dasti-cv-ai-review__action--primary"
                  aria-label={primaryActionAriaLabel}
                  title={primaryActionAriaLabel}
                  onClick={onAccept}
                >
                  {primaryActionLabel}
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </BodyPortal>
  );
}

export default CvAiReviewOverlay;
