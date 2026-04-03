"use client";

import React from "react";
import clsx from "clsx";
import { X } from "@/lib/icons";
import { useCloseOnEscape } from "@/hooks/use-close-on-escape";
import { BodyPortal } from "@/components/ui/body-portal";

const DIALOG_EXIT_DURATION = 150;

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: DialogProps) {
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
      }, DIALOG_EXIT_DURATION);
    }
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
    };
  }, [open]);

  useCloseOnEscape({ open, onClose });

  if (!isVisible) return null;

  return (
    <BodyPortal>
      <div
        className={clsx(
          "dasti-dialog-root fixed inset-0 z-[10000] flex items-center justify-center p-4",
        )}
        data-state={surfaceState}
      >
        <div
          className="dasti-dialog-overlay fixed inset-0 backdrop-blur-[6px] saturate-120"
          style={{ background: "hsla(30,12%,11%,.45)" }}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className={clsx(
            "dasti-dialog-panel relative isolate [background:var(--sfr)] border [border-color:var(--color-border)] [border-radius:var(--radius-surface)] [box-shadow:var(--shc)] w-full overflow-hidden [max-width:var(--modal-max-width)]",
            className,
          )}
        >
          {title && (
            <div
              className="flex items-start justify-between gap-4 border-b px-6 py-5 [border-color:var(--color-border)]"
              style={{
                background: "var(--frost-bg)",
                backdropFilter: "blur(12px) saturate(1.4)",
                WebkitBackdropFilter: "blur(12px) saturate(1.4)",
              }}
            >
              <div className="min-w-0">
                <h2 className="font-['Fraunces'] text-[var(--tm)] font-semibold leading-[var(--ll)] text-foreground">
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
          )}
          {children}
        </div>
      </div>
    </BodyPortal>
  );
}

export interface DialogContentProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogContent({ children, className }: DialogContentProps) {
  return (
    <div className={clsx("px-6 py-4 text-foreground", className)}>
      {children}
    </div>
  );
}

export interface DialogActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogActions({ children, className }: DialogActionsProps) {
  return (
    <div
      className={clsx(
        "flex justify-end gap-3 border-t px-6 py-4 [border-color:var(--color-border)]",
        className,
      )}
    >
      {children}
    </div>
  );
}
