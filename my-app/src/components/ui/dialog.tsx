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
const DIALOG_FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const focusFrameRef = React.useRef<number | null>(null);
  const dialogRef = React.useRef<HTMLDivElement | null>(null);
  const restoreFocusRef = React.useRef<HTMLElement | null>(null);

  React.useEffect(() => {
    if (open) {
      if (!restoreFocusRef.current && document.activeElement instanceof HTMLElement) {
        restoreFocusRef.current = document.activeElement;
      }
      return;
    }

    const elementToRestore = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (elementToRestore && elementToRestore.isConnected) {
      elementToRestore.focus();
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || !isVisible) return;

    focusFrameRef.current = requestAnimationFrame(() => {
      const dialog = dialogRef.current;
      if (!dialog) return;
      const firstFocusable = dialog.querySelector<HTMLElement>(
        DIALOG_FOCUSABLE_SELECTOR,
      );
      (firstFocusable ?? dialog).focus();
    });

    return () => {
      if (focusFrameRef.current) cancelAnimationFrame(focusFrameRef.current);
    };
  }, [isVisible, open]);

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

  const handleDialogKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Tab") return;

    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(DIALOG_FOCUSABLE_SELECTOR),
    );
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
    if (event.shiftKey && (currentIndex <= 0 || currentIndex === -1)) {
      event.preventDefault();
      focusable[focusable.length - 1].focus();
    } else if (!event.shiftKey && currentIndex === focusable.length - 1) {
      event.preventDefault();
      focusable[0].focus();
    }
  };

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
          ref={dialogRef}
          className={clsx(
            "ds-dialog",
            size !== "md" && `ds-dialog--${size}`,
            className,
          )}
          data-state={surfaceState}
          role="dialog"
          aria-modal="true"
          aria-labelledby={title ? "dialog-title" : undefined}
          tabIndex={-1}
          onKeyDown={handleDialogKeyDown}
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
