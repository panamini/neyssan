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
  const previousBodyOverflowRef = React.useRef<string | null>(null);
  const previousDocumentOverflowRef = React.useRef<string | null>(null);

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- Pre-existing dependency contract is preserved for this release-gate cleanup.
  }, [open]);

  React.useEffect(() => {
    if (!open || typeof document === "undefined") {
      return undefined;
    }

    if (previousBodyOverflowRef.current === null) {
      previousBodyOverflowRef.current = document.body.style.overflow;
    }
    if (previousDocumentOverflowRef.current === null) {
      previousDocumentOverflowRef.current =
        document.documentElement.style.overflow;
    }

    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflowRef.current ?? "";
      document.documentElement.style.overflow =
        previousDocumentOverflowRef.current ?? "";
      previousBodyOverflowRef.current = null;
      previousDocumentOverflowRef.current = null;
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
        data-no-pan="true"
        data-state={surfaceState}
        onMouseDownCapture={
          stopPropagation ? (e) => e.stopPropagation() : undefined
        }
        onPointerDownCapture={
          stopPropagation ? (e) => e.stopPropagation() : undefined
        }
        onWheelCapture={stopPropagation ? (e) => e.stopPropagation() : undefined}
      >
        <div
          className="dasti-dialog-overlay absolute inset-0"
          data-no-pan="true"
          onClick={backdropHandler}
          aria-hidden
          style={{
            background: "var(--dialog-backdrop-bg-strong)",
            backdropFilter:
              "blur(var(--dialog-backdrop-blur)) saturate(1.2)",
            WebkitBackdropFilter:
              "blur(var(--dialog-backdrop-blur)) saturate(1.2)",
          }}
        />
        <div className="dasti-dialog-panel-shell" data-no-pan="true">
          {children}
        </div>
      </div>
    </BodyPortal>
  );
}
