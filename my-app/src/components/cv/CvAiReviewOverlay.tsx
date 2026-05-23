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
const OVERLAY_MAX_WIDTH = 420;
const OVERLAY_MIN_HEIGHT = 220;
const ESTIMATED_POPOVER_HEIGHT = 320;
const STAGE_SELECTOR = [
  ".dasti-cv-paper-stage",
  ".dasti-doc-viewport--resume-panel[data-document-stage='true']",
  ".dasti-document-stage__canvas[data-document-page='true']",
].join(",");
const TOP_ISLAND_SELECTOR = [
  "[data-testid='cv-toolbar']",
  ".forge__stage-bar",
  ".dasti-proposal-skeleton-stage__bar",
].join(",");

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

function readCssLengthPx(name: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  const source =
    document.querySelector(".dasti-cv-skeleton-forge") ??
    document.documentElement;
  const value = window.getComputedStyle(source).getPropertyValue(name).trim();
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function readDocumentRect(selector: string): DOMRect | null {
  if (typeof document === "undefined") return null;
  return (
    document.querySelector<HTMLElement>(selector)?.getBoundingClientRect() ??
    null
  );
}

type PopoverPosition = {
  style: React.CSSProperties;
  placement: "above" | "below" | "right" | "left" | "center";
  clamped: boolean;
};

function computePopoverPosition(
  anchor: EditorSelectionAnchor | null | undefined,
): PopoverPosition | undefined {
  if (typeof window === "undefined") return undefined;

  const safeMargin = readCssLengthPx("--space-3", 16);
  const targetGap = readCssLengthPx("--space-3", 12);
  const stageRect = readDocumentRect(STAGE_SELECTOR);
  const topIslandRect = readDocumentRect(TOP_ISLAND_SELECTOR);
  const viewportLeft = window.scrollX + safeMargin;
  const viewportRight = window.scrollX + window.innerWidth - safeMargin;
  const viewportTop = window.scrollY + safeMargin;
  const viewportBottom = window.scrollY + window.innerHeight - safeMargin;
  const stageLeft =
    anchor?.containerLeft ??
    (stageRect ? stageRect.left + window.scrollX : viewportLeft);
  const stageRight =
    anchor?.containerRight ??
    (stageRect ? stageRect.right + window.scrollX : viewportRight);
  const stageTop =
    anchor?.containerTop ??
    (stageRect ? stageRect.top + window.scrollY : viewportTop);
  const stageBottom =
    anchor?.containerBottom ??
    (stageRect ? stageRect.bottom + window.scrollY : viewportBottom);
  const topIslandBottom = topIslandRect
    ? topIslandRect.bottom + window.scrollY + safeMargin
    : viewportTop;
  const leftBound = Math.max(viewportLeft, Math.min(stageLeft, viewportRight));
  const rightBound = Math.min(viewportRight, Math.max(stageRight, viewportLeft));
  const topBound = Math.max(
    viewportTop,
    topIslandBottom,
    Math.min(stageTop, viewportBottom),
  );
  const bottomBound = Math.min(viewportBottom, Math.max(stageBottom, viewportTop));
  const availableWidth = Math.max(0, rightBound - leftBound);
  const availableHeight = Math.max(0, bottomBound - topBound);
  const estimatedHeight = Math.min(
    ESTIMATED_POPOVER_HEIGHT,
    Math.max(OVERLAY_MIN_HEIGHT, availableHeight),
  );
  const height = Math.min(
    estimatedHeight,
    Math.max(OVERLAY_MIN_HEIGHT, availableHeight),
  );
  const width = Math.min(
    OVERLAY_MAX_WIDTH,
    Math.max(0, availableWidth),
  );
  const usableWidth = Math.max(0, width);
  const minUsableWidth = Math.min(OVERLAY_MIN_WIDTH, availableWidth);

  if (!anchor) {
    const desiredLeft = leftBound + Math.max(0, availableWidth - usableWidth) / 2;
    const desiredTop = topBound + Math.max(0, availableHeight - height) / 2;
    const left = clamp(desiredLeft, leftBound, rightBound - usableWidth);
    const top = clamp(desiredTop, topBound, bottomBound - height);
    return {
      placement: "center",
      clamped: left !== desiredLeft || top !== desiredTop,
      style: {
        width: usableWidth,
        maxHeight: height,
        left,
        top,
      },
    };
  }

  const targetLeft = anchor.leftEdge ?? anchor.focusLeft ?? anchor.left;
  const targetRight = anchor.rightEdge ?? anchor.focusRight ?? anchor.left;
  const anchorTop = anchor.focusTop ?? anchor.top;
  const anchorBottom = anchor.focusBottom ?? anchor.bottom ?? anchor.top;
  const targetCenterX = targetLeft + Math.max(1, targetRight - targetLeft) / 2;
  const targetCenterY = anchorTop + Math.max(1, anchorBottom - anchorTop) / 2;
  const rightSpace = rightBound - targetRight - targetGap;
  const belowSpace = bottomBound - anchorBottom - targetGap;
  const aboveSpace = anchorTop - topBound - targetGap;
  const leftSpace = targetLeft - leftBound - targetGap;
  const canPlaceRight = rightSpace >= minUsableWidth;
  const canPlaceBelow = belowSpace >= OVERLAY_MIN_HEIGHT;
  const canPlaceAbove = aboveSpace >= OVERLAY_MIN_HEIGHT;
  const canPlaceLeft = leftSpace >= minUsableWidth;
  const placement: PopoverPosition["placement"] = canPlaceRight
    ? "right"
    : canPlaceBelow
      ? "below"
      : canPlaceAbove
        ? "above"
        : canPlaceLeft
          ? "left"
          : "center";
  const desiredLeft =
    placement === "right"
      ? targetRight + targetGap
      : placement === "left"
        ? targetLeft - targetGap - usableWidth
        : placement === "center"
          ? targetCenterX < leftBound + availableWidth / 2
            ? rightBound - usableWidth
            : leftBound
          : targetCenterX - usableWidth / 2;
  const desiredTop =
    placement === "below"
      ? anchorBottom + targetGap
      : placement === "above"
        ? anchorTop - targetGap - height
        : placement === "center"
          ? targetCenterY < topBound + availableHeight / 2
            ? Math.min(anchorBottom + targetGap, bottomBound - height)
            : Math.max(anchorTop - targetGap - height, topBound)
          : targetCenterY - height / 2;
  const left = clamp(desiredLeft, leftBound, rightBound - usableWidth);
  const top = clamp(desiredTop, topBound, bottomBound - height);

  return {
    placement,
    clamped:
      Math.round(left) !== Math.round(desiredLeft) ||
      Math.round(top) !== Math.round(desiredTop) ||
      usableWidth < OVERLAY_MAX_WIDTH,
    style: {
      width: usableWidth,
      maxHeight: height,
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
        data-cv-ai-popup-mode={mode}
        data-cv-ai-popup-placement={placement}
        data-cv-ai-popup-clamped={
          mode === "popover" && popoverPosition?.clamped ? "true" : "false"
        }
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
