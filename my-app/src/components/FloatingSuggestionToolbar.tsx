import React from "react";
import { motion } from "framer-motion";
import { BodyPortal } from "@/components/ui/body-portal";
import type { EditorSelectionAnchor } from "@/lib/editor-ai-selection";

type FloatingSuggestionToolbarProps = {
  anchor: EditorSelectionAnchor | null;
  open: boolean;
  state: "preview" | "accepted";
  onAccept: () => void;
  onDiscard: () => void;
  onUndo: () => void;
  onClose: () => void;
};

const TOOLBAR_FADE_TRANSITION = {
  duration: 0.18,
  ease: [0.22, 1, 0.36, 1],
} as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

export function FloatingSuggestionToolbar({
  anchor,
  open,
  state,
  onAccept,
  onDiscard,
  onUndo,
  onClose,
}: FloatingSuggestionToolbarProps) {
  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = React.useState<{
    center: number;
    top: number;
    placement: "above" | "below";
  } | null>(null);

  const updatePosition = React.useCallback(() => {
    if (!anchor || !panelRef.current || typeof window === "undefined") return;

    const panel = panelRef.current;
    const styles = window.getComputedStyle(panel);
    const gap = Number.parseFloat(styles.getPropertyValue("--s2")) || 8;
    const margin = Number.parseFloat(styles.getPropertyValue("--s3")) || 12;
    const width = Math.max(panel.scrollWidth, panel.offsetWidth, 36);
    const height = Math.max(panel.scrollHeight, panel.offsetHeight, 36);
    const viewportLeft = window.scrollX + margin;
    const viewportTop = window.scrollY + margin;
    const viewportRight = window.scrollX + window.innerWidth - margin;
    const viewportBottom = window.scrollY + window.innerHeight - margin;
    const horizontalMin = Math.max(
      viewportLeft,
      (anchor.containerLeft ?? viewportLeft) + gap / 2,
    );
    const horizontalMax = Math.min(
      viewportRight,
      (anchor.containerRight ?? viewportRight) - gap / 2,
    );
    const verticalMin = Math.max(
      viewportTop,
      (anchor.containerTop ?? viewportTop) + gap / 2,
    );
    const verticalMax = Math.min(
      viewportBottom,
      (anchor.containerBottom ?? viewportBottom) - height - gap,
    );
    const preferredCenter =
      anchor.aboveCenter ?? anchor.belowCenter ?? anchor.left;
    const preferredAboveTop = anchor.top - height - gap;
    const preferredBelowTop = anchor.bottom + gap;
    const hasRoomAbove = preferredAboveTop >= verticalMin;
    const placement = hasRoomAbove ? "above" : "below";
    const top = clamp(
      placement === "above" ? preferredAboveTop : preferredBelowTop,
      verticalMin,
      verticalMax,
    );
    const center = clamp(
      preferredCenter,
      horizontalMin + width / 2,
      horizontalMax - width / 2,
    );

    setPosition({ center, top, placement });
  }, [anchor]);

  React.useLayoutEffect(() => {
    if (!open || !anchor) {
      setPosition(null);
      return undefined;
    }

    updatePosition();
    const frame = window.requestAnimationFrame(updatePosition);
    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(updatePosition)
        : null;
    if (panelRef.current) resizeObserver?.observe(panelRef.current);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [anchor, open, updatePosition]);

  if (!open || !anchor) return null;

  const fallbackCenter = anchor.aboveCenter ?? anchor.belowCenter ?? anchor.left;

  return (
    <BodyPortal>
      <motion.div
        ref={panelRef}
        className="ds-ai-toolbar"
        data-inline-ai-toolbar="true"
        data-inline-ai-suggestion-toolbar="true"
        data-state="open"
        data-placement={position?.placement ?? "above"}
        role="toolbar"
        aria-label="Suggestion actions"
        style={{
          position: "absolute",
          left: position?.center ?? fallbackCenter,
          top: position?.top ?? anchor.top,
          translate: "-50% 0",
          zIndex: 11000,
          visibility: "visible",
          pointerEvents: "auto",
        }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={TOOLBAR_FADE_TRANSITION}
        onPointerDownCapture={(event) => event.preventDefault()}
      >
        <div
          className="ds-ai-toolbar__actions"
          data-inline-ai-toolbar="true"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "var(--s1)",
          }}
        >
          {state === "accepted" ? (
            <>
            <span className="ds-status ds-status--success dasti-proposal-inline-proofing__status">
              <span className="ds-status__dot" aria-hidden="true" />
              Applied.
            </span>
            <button type="button" className="ds-ai-toolbar__btn" onClick={onUndo}>
              Undo
            </button>
            <button type="button" className="ds-ai-toolbar__btn" onClick={onClose}>
              Close
            </button>
            </>
          ) : (
            <>
            <button type="button" className="ds-ai-toolbar__btn" onClick={onDiscard}>
              Discard
            </button>
            <button
              type="button"
              className="ds-ai-toolbar__btn"
              aria-pressed="true"
              onClick={onAccept}
            >
              Accept
            </button>
            </>
          )}
        </div>
      </motion.div>
    </BodyPortal>
  );
}

export default FloatingSuggestionToolbar;
