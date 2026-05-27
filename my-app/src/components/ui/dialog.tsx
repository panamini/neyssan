"use client";

import React from "react";
import clsx from "clsx";
import { X } from "@/lib/icons";
import { useCloseOnEscape } from "@/hooks/use-close-on-escape";
import { BodyPortal } from "@/components/ui/body-portal";
import { IconButton } from "@/components/ui/icon-button";
import { translateUi } from "@/lib/i18n";
import { useUiLanguagePreference } from "@/lib/ui-preferences";

const DIALOG_EXIT_DURATION = 160;

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  size?: "sm" | "md" | "lg";
}

function DialogRootComponent({
  open,
  onClose,
  title,
  children,
  className,
  size = "md",
}: DialogProps) {
  const { resolvedLanguage } = useUiLanguagePreference();
  const closeLabel = translateUi(resolvedLanguage, "common.close");
  const [isVisible, setIsVisible] = React.useState(open);
  const [surfaceState, setSurfaceState] = React.useState<"closing" | "open">(
    open ? "open" : "closing",
  );
  const exitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrameRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (open) {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      setIsVisible(true);
      setSurfaceState("closing");
      enterFrameRef.current = requestAnimationFrame(() => {
        setSurfaceState("open");
      });
    } else if (isVisible) {
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      setSurfaceState("closing");
      exitTimerRef.current = setTimeout(() => {
        setIsVisible(false);
      }, DIALOG_EXIT_DURATION);
    }
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
    };
  }, [isVisible, open]);

  useCloseOnEscape({ open, onClose });

  if (!isVisible) return null;

  return (
    <BodyPortal>
      <div className="dasti-dialog-root">
        <div
          className="ds-dialog-overlay"
          data-state={surfaceState}
          onClick={onClose}
          aria-hidden="true"
        />
        <div
          className={clsx(
            "ds-dialog",
            size !== "md" && `ds-dialog--${size}`,
            className,
          )}
          data-state={surfaceState}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "dialog-title" : undefined}
        >
          {title ? (
            <div className="ds-dialog__title" id="dialog-title">
              {title}
            </div>
          ) : null}
          <IconButton
            label={closeLabel}
            variant="ghost"
            onClick={onClose}
            className="ds-dialog__close"
          >
            <X size={16} />
          </IconButton>
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
  return <div className={clsx("ds-dialog__body", className)}>{children}</div>;
}

export interface DialogActionsProps {
  children: React.ReactNode;
  className?: string;
}

export function DialogActions({ children, className }: DialogActionsProps) {
  return <div className={clsx("ds-dialog__footer", className)}>{children}</div>;
}

function DialogTrigger({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}

function DialogTitle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("ds-dialog__title", className)} {...props}>
      {children}
    </div>
  );
}

function DialogDescription({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("ds-dialog__body", className)} {...props}>
      {children}
    </div>
  );
}

function DialogFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("ds-dialog__footer", className)} {...props}>
      {children}
    </div>
  );
}

export const Dialog = Object.assign(DialogRootComponent, {
  Root: DialogRootComponent,
  Trigger: DialogTrigger,
  Content: DialogContent,
  Title: DialogTitle,
  Description: DialogDescription,
  Footer: DialogFooter,
});
