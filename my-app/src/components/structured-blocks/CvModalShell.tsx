import React from "react";
import clsx from "clsx";
import { BodyPortal } from "@/components/ui/body-portal";
import { useCloseOnEscape } from "../../hooks/use-close-on-escape";

// Keep JS unmount timing aligned with the shared CSS transition so the
// close animation can complete before the portal disappears.
const EXIT_DURATION = 220;

interface CvModalShellProps {
  open: boolean;
  onClose: () => void;
  /** Override backdrop click handler (e.g. disabled while saving) */
  onBackdropClick?: () => void;
  children: React.ReactNode;
  /** Extra event capture handlers on the root container */
  stopPropagation?: boolean;
}

/**
 * Shared animated wrapper for all CV-forge modal sheets.
 * Handles portal, backdrop overlay, enter/exit animations.
 * Each modal owns its own `dasti-modal` panel rendering as children.
 */
export function CvModalShell({
  open,
  onClose,
  onBackdropClick,
  children,
  stopPropagation = true,
}: CvModalShellProps) {
  const [isVisible, setIsVisible] = React.useState(open);
  const [surfaceState, setSurfaceState] = React.useState<"closed" | "open">(
    open ? "closed" : "closed",
  );
  const exitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (open) {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      setIsVisible(true);
      setSurfaceState("closed");
      enterFrameRef.current = requestAnimationFrame(() => {
        setSurfaceState("open");
      });
    } else if (isVisible) {
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      setSurfaceState("closed");
      exitTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, EXIT_DURATION);
    }
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
    };
  }, [open]);

  useCloseOnEscape({ open, onClose });

  if (!isVisible) return null;

  const backdropHandler = onBackdropClick ?? onClose;

  return (
    <BodyPortal>
      <div
        className={clsx(
          "dasti-dialog-root fixed inset-0 z-[10000] flex items-center justify-center p-4",
        )}
        data-state={surfaceState}
        onMouseDownCapture={
          stopPropagation ? (e) => e.stopPropagation() : undefined
        }
        onPointerDownCapture={
          stopPropagation ? (e) => e.stopPropagation() : undefined
        }
      >
        <div
          className="dasti-dialog-overlay absolute inset-0"
          onClick={backdropHandler}
          aria-hidden
          style={{
            background: "hsla(30,12%,11%,.45)",
            backdropFilter: "blur(6px) saturate(1.2)",
            WebkitBackdropFilter: "blur(6px) saturate(1.2)",
          }}
        />
        <div className="dasti-dialog-panel-shell">{children}</div>
      </div>
    </BodyPortal>
  );
}
