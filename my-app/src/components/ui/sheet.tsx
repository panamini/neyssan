"use client";

import React from "react";
import clsx from "clsx";
import { X } from "@/lib/icons";
import { BodyPortal } from "@/components/ui/body-portal";
import { translateUi } from "@/lib/i18n";
import { useUiLanguagePreference } from "@/lib/ui-preferences";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  side?: "right" | "bottom";
  title: string;
  titleHidden?: boolean;
  description?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  rootClassName?: string;
  overlayClassName?: string;
  bodyClassName?: string;
  footerClassName?: string;
  modal?: boolean;
}

const SHEET_EXIT_DURATION = 220;

function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(
    root.querySelectorAll<HTMLElement>(
      [
        "a[href]",
        "button:not([disabled])",
        "textarea:not([disabled])",
        "input:not([disabled])",
        "select:not([disabled])",
        "[tabindex]:not([tabindex='-1'])",
      ].join(","),
    ),
  ).filter((element) => !element.hasAttribute("disabled"));
}

export function Sheet({
  open,
  onOpenChange,
  side = "right",
  title,
  titleHidden = false,
  description,
  children,
  footer,
  ariaLabel,
  className,
  rootClassName,
  overlayClassName,
  bodyClassName,
  footerClassName,
  modal = true,
}: SheetProps): JSX.Element | null {
  const { resolvedLanguage } = useUiLanguagePreference();
  const closePanelLabel = translateUi(resolvedLanguage, "common.closePanel");
  const titleId = React.useId();
  const descriptionId = React.useId();
  const panelRef = React.useRef<HTMLElement | null>(null);
  const returnFocusRef = React.useRef<HTMLElement | null>(null);
  const onOpenChangeRef = React.useRef(onOpenChange);
  const exitTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const enterFrameRef = React.useRef<number | null>(null);
  const [isVisible, setIsVisible] = React.useState(open);
  const [surfaceState, setSurfaceState] = React.useState<"closed" | "open">(
    open ? "open" : "closed",
  );

  React.useEffect(() => {
    onOpenChangeRef.current = onOpenChange;
  }, [onOpenChange]);

  React.useEffect(() => {
    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      setIsVisible(true);
      setSurfaceState("closed");
      enterFrameRef.current = requestAnimationFrame(() => {
        setSurfaceState("open");
      });
      return;
    }

    if (isVisible) {
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
      setSurfaceState("closed");
      exitTimerRef.current = setTimeout(() => {
        setIsVisible(false);
        returnFocusRef.current?.focus?.({ preventScroll: true });
      }, SHEET_EXIT_DURATION);
    }
  }, [isVisible, open]);

  React.useEffect(() => {
    return () => {
      if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
      if (enterFrameRef.current) cancelAnimationFrame(enterFrameRef.current);
    };
  }, []);

  React.useEffect(() => {
    if (!open) return undefined;

    const focusFrame = modal
      ? requestAnimationFrame(() => {
          panelRef.current?.focus?.({ preventScroll: true });
        })
      : null;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }

      if (event.key !== "Tab") return;
      if (!modal) return;
      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus?.({ preventScroll: true });
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      if (focusFrame !== null) cancelAnimationFrame(focusFrame);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [modal, open]);

  if (!isVisible) return null;

  const isBottom = side === "bottom";
  const panelClassName = isBottom ? "ds-bottom-sheet" : "ds-sheet";

  return (
    <BodyPortal>
      <div
        className={clsx("ds-sheet-root", rootClassName)}
        data-modal={modal ? "true" : "false"}
        data-side={side}
      >
        {modal ? (
          <button
            type="button"
            className={clsx("ds-sheet__overlay", overlayClassName)}
            data-state={surfaceState}
            onClick={() => onOpenChange(false)}
            aria-label={closePanelLabel}
          />
        ) : (
          <div
            className={clsx("ds-sheet__overlay", overlayClassName)}
            data-state={surfaceState}
            aria-hidden="true"
          />
        )}
        <aside
          ref={panelRef}
          className={clsx(panelClassName, className)}
          data-state={surfaceState}
          role="dialog"
          aria-modal={modal ? "true" : undefined}
          data-title-hidden={titleHidden ? "true" : undefined}
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : titleId}
          aria-describedby={description ? descriptionId : undefined}
          tabIndex={-1}
        >
          {isBottom ? (
            <div className="ds-bottom-sheet__handle" aria-hidden="true" />
          ) : null}
          <header
            className={
              isBottom ? "ds-bottom-sheet__header" : "ds-sheet__header"
            }
          >
            <div>
              <h3
                id={titleId}
                className={clsx(
                  "ds-sheet__title",
                  titleHidden ? "ds-sheet__title--hidden" : null,
                )}
              >
                {title}
              </h3>
              {description ? (
                <p id={descriptionId} className="ds-sheet__description">
                  {description}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              className="ds-sheet__close"
              aria-label={closePanelLabel}
              onClick={() => onOpenChange(false)}
            >
              <X size={16} strokeWidth={1.8} aria-hidden="true" />
            </button>
          </header>
          <div
            className={clsx(
              isBottom ? "ds-bottom-sheet__body" : "ds-sheet__body",
              bodyClassName,
            )}
          >
            {children}
          </div>
          {footer ? (
            <footer
              className={clsx(
                isBottom ? "ds-bottom-sheet__footer" : "ds-sheet__footer",
                footerClassName,
              )}
            >
              {footer}
            </footer>
          ) : null}
        </aside>
      </div>
    </BodyPortal>
  );
}
