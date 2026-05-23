import React from "react";
import { ArrowLeft } from "@/lib/icons";
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
  primaryActionLabel?: string;
  onAccept: () => void;
  onDiscard: () => void;
  onCopy?: () => void;
  onInsertAfter?: () => void;
  onRetry?: () => void;
  onUndo?: () => void;
};

const MOBILE_BREAKPOINT = 760;
const OVERLAY_MIN_WIDTH = 320;
const OVERLAY_MAX_WIDTH = 416;
const VIEWPORT_GAP = 16;
const TARGET_GAP = 12;
const ESTIMATED_POPOVER_HEIGHT = 300;

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

function resolveMode(): "sheet" | "popover" {
  if (typeof window === "undefined") return "popover";
  return window.innerWidth <= MOBILE_BREAKPOINT ? "sheet" : "popover";
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

type PopoverPosition = {
  style: React.CSSProperties;
  placement: "above" | "below" | "right";
};

function computePopoverPosition(
  anchor: EditorSelectionAnchor | null | undefined,
): PopoverPosition | undefined {
  if (typeof window === "undefined") return undefined;

  const viewportLeft = window.scrollX + VIEWPORT_GAP;
  const viewportRight = window.scrollX + window.innerWidth - VIEWPORT_GAP;
  const viewportTop = window.scrollY + VIEWPORT_GAP;
  const viewportBottom = window.scrollY + window.innerHeight - VIEWPORT_GAP;
  const stageLeft = anchor?.containerLeft ?? viewportLeft;
  const stageRight = anchor?.containerRight ?? viewportRight;
  const stageTop = anchor?.containerTop ?? viewportTop;
  const stageBottom = anchor?.containerBottom ?? viewportBottom;
  const leftBound = Math.max(viewportLeft, Math.min(stageLeft, viewportRight));
  const rightBound = Math.min(
    viewportRight,
    Math.max(stageRight, viewportLeft),
  );
  const topBound = Math.max(viewportTop, Math.min(stageTop, viewportBottom));
  const bottomBound = Math.min(
    viewportBottom,
    Math.max(stageBottom, viewportTop),
  );
  const availableWidth = Math.max(0, rightBound - leftBound);
  const estimatedHeight = Math.min(
    ESTIMATED_POPOVER_HEIGHT,
    Math.max(240, window.innerHeight * 0.48),
  );
  const width = Math.max(
    Math.min(OVERLAY_MIN_WIDTH, viewportRight - viewportLeft),
    Math.min(OVERLAY_MAX_WIDTH, availableWidth || viewportRight - viewportLeft),
  );

  if (!anchor) {
    const fallbackLeft = window.innerWidth / 2 - width / 2 + window.scrollX;
    const fallbackTop = VIEWPORT_GAP + window.scrollY;
    return {
      placement: "below",
      style: {
        width,
        left: clamp(fallbackLeft, viewportLeft, viewportRight - width),
        top: clamp(fallbackTop, topBound, bottomBound - estimatedHeight),
      },
    };
  }

  const preferredCenter =
    anchor.focusCenter ??
    anchor.belowCenter ??
    anchor.aboveCenter ??
    anchor.left;
  const anchorTop = anchor.focusTop ?? anchor.top;
  const anchorBottom = anchor.focusBottom ?? anchor.bottom ?? anchor.top;
  const anchorCenterY = anchorTop + Math.max(1, anchorBottom - anchorTop) / 2;
  const anchorRight = anchor.focusRight ?? anchor.rightEdge ?? preferredCenter;
  const roomBelow = bottomBound - anchorBottom;
  const roomAbove = anchorTop - topBound;
  const roomRight = rightBound - anchorRight - TARGET_GAP;
  const belowFits = roomBelow >= estimatedHeight;
  const aboveFits = roomAbove >= estimatedHeight;
  const shouldPlaceRight = !belowFits && !aboveFits && roomRight >= width;
  const placement: PopoverPosition["placement"] = shouldPlaceRight
    ? "right"
    : belowFits || roomBelow >= roomAbove
      ? "below"
      : "above";
  const left =
    placement === "right"
      ? clamp(anchorRight + TARGET_GAP, leftBound, rightBound - width)
      : clamp(preferredCenter - width / 2, leftBound, rightBound - width);
  const top =
    placement === "right"
      ? clamp(
          anchorCenterY - estimatedHeight / 2,
          topBound,
          bottomBound - estimatedHeight,
        )
      : placement === "above"
        ? clamp(
            anchorTop - TARGET_GAP - estimatedHeight,
            topBound,
            bottomBound - estimatedHeight,
          )
        : clamp(anchorBottom + TARGET_GAP, topBound, bottomBound - 180);
  return {
    placement,
    style: {
      width,
      left,
      top,
    },
  };
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
  primaryActionLabel = "Replace",
  onAccept,
  onDiscard,
  onRetry,
  onUndo,
}: CvAiReviewOverlayProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const previousFocusRef = React.useRef<HTMLElement | null>(null);
  const [mode, setMode] = React.useState<"popover" | "sheet">(resolveMode);
  const [, forcePositionUpdate] = React.useReducer(
    (value: number) => value + 1,
    0,
  );

  React.useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const handleResize = () => {
      setMode(resolveMode());
      forcePositionUpdate();
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [open]);

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
  const headerLabel = `${headerActionLabel} · ${targetLabel}`;
  const primaryActionAriaLabel = buildPrimaryActionAriaLabel(
    primaryActionLabel,
    targetLabel,
  );
  const popoverPosition =
    mode === "popover" ? computePopoverPosition(anchor) : undefined;
  const placement =
    mode === "sheet" ? "sheet" : popoverPosition?.placement ?? "below";

  return (
    <BodyPortal>
      <div
        className="dasti-cv-ai-review-layer"
        data-cv-ai-review-layer="true"
        data-cv-ai-review-mode={mode}
        data-cv-ai-review-placement={placement}
        data-cv-ai-review-target-section-id={target.sectionId}
        data-cv-ai-review-section-type={target.sectionType}
        data-cv-ai-review-target-item-id={target.itemId}
        data-cv-ai-review-field-path={target.fieldPath}
        data-cv-ai-review-action-id={actionId}
        data-cv-ai-review-interaction-id={interactionId}
        data-cv-ai-review-tokenized="true"
      >
        {mode === "sheet" ? (
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
          style={popoverPosition?.style}
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
              {targetLabel ? (
                <span
                  className="dasti-cv-ai-review__target-label"
                  data-cv-ai-review-visible-target="true"
                >
                  {targetLabel}
                </span>
              ) : null}
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
