"use client";

import React from "react";
import clsx from "clsx";
import { X } from "@/lib/icons";
import { BodyPortal } from "@/components/ui/body-portal";
import { translateUi } from "@/lib/i18n";
import { useUiLanguagePreference } from "@/lib/ui-preferences";

type IslandPanelAction = {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  ariaLabel?: string;
  icon?: React.ReactNode;
  title?: string;
};

export interface IslandPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  meta?: string;
  children: React.ReactNode;
  ariaLabel?: string;
  saveAction?: IslandPanelAction;
  discardAction?: IslandPanelAction;
  className?: string;
  rootClassName?: string;
  overlayClassName?: string;
  bodyClassName?: string;
  showCloseButton?: boolean;
}

const ISLAND_PANEL_EXIT_DURATION = 180;

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

export function IslandPanel({
  open,
  onOpenChange,
  title,
  meta,
  children,
  ariaLabel,
  saveAction,
  discardAction,
  className,
  rootClassName,
  overlayClassName,
  bodyClassName,
  showCloseButton = true,
}: IslandPanelProps): JSX.Element | null {
  const { resolvedLanguage } = useUiLanguagePreference();
  const closePanelLabel = translateUi(resolvedLanguage, "common.closePanel");
  const titleId = React.useId();
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
      }, ISLAND_PANEL_EXIT_DURATION);
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

    const focusFrame = requestAnimationFrame(() => {
      panelRef.current?.focus?.({ preventScroll: true });
    });

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (panelRef.current?.contains(target)) return;
      onOpenChangeRef.current(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChangeRef.current(false);
        return;
      }

      if (event.key !== "Tab") return;
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

    document.addEventListener("pointerdown", handlePointerDown, true);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(focusFrame);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  if (!isVisible) return null;

  return (
    <BodyPortal>
      <div className={clsx("ds-island-panel-root", rootClassName)}>
        <div
          className={clsx("ds-island-panel__overlay", overlayClassName)}
          data-state={surfaceState}
          aria-hidden="true"
        />
        <aside
          ref={panelRef}
          className={clsx("ds-island-panel", className)}
          data-state={surfaceState}
          role="dialog"
          aria-label={ariaLabel}
          aria-labelledby={ariaLabel ? undefined : titleId}
          tabIndex={-1}
        >
          <header className="ds-island-panel__header">
            <div className="ds-island-panel__microbar">
              <div className="ds-island-panel__heading">
                <h3 id={titleId} className="ds-island-panel__title">
                  {title}
                </h3>
                {meta ? <span className="ds-island-panel__meta">{meta}</span> : null}
              </div>
              <div className="ds-island-panel__actions">
              {discardAction ? (
                <button
                  type="button"
                  className={clsx(
                    "ds-island-panel__action ds-island-panel__action--discard",
                    discardAction.icon && "ds-island-panel__action--icon",
                  )}
                  onClick={discardAction.onClick}
                  disabled={discardAction.disabled}
                  aria-label={discardAction.ariaLabel}
                  title={discardAction.title}
                >
                  {discardAction.icon ?? discardAction.label}
                </button>
              ) : null}
              {saveAction ? (
                <button
                  type="button"
                  className="ds-island-panel__action ds-island-panel__action--save"
                  onClick={saveAction.onClick}
                  disabled={saveAction.disabled}
                  aria-label={saveAction.ariaLabel}
                >
                  {saveAction.label}
                </button>
              ) : null}
              {showCloseButton ? (
                <button
                  type="button"
                  className="ds-island-panel__close"
                  aria-label={closePanelLabel}
                  onClick={() => onOpenChange(false)}
                >
                  <X size={16} strokeWidth={1.8} aria-hidden="true" />
                </button>
              ) : null}
              </div>
            </div>
          </header>
          <div className={clsx("ds-island-panel__body", bodyClassName)}>
            {children}
          </div>
        </aside>
      </div>
    </BodyPortal>
  );
}
