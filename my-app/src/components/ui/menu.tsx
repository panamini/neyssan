"use client";

import React from "react";
import clsx from "clsx";
import { BodyPortal } from "@/components/ui/body-portal";

export type MenuItemTone = "neutral" | "danger";

export interface MenuItem {
  id: string;
  label: React.ReactNode;
  icon?: React.ReactNode;
  shortcut?: string;
  tone?: MenuItemTone;
  disabled?: boolean;
  description?: React.ReactNode;
  ariaLabel?: string;
  selected?: boolean;
  role?: "menuitem" | "menuitemradio";
  onSelect?: () => void;
}

export interface MenuSection {
  label?: string;
  items: MenuItem[];
}

export interface MenuProps {
  trigger: React.ReactElement;
  sections: MenuSection[];
  align?: "start" | "end";
  side?: "top" | "bottom";
  ariaLabel?: string;
  menuClassName?: string;
  matchTriggerWidth?: boolean;
}

const MENU_EXIT_DURATION = 140;
let closeActiveMenu: (() => void) | null = null;

function enabledItemIndexes(sections: MenuSection[]) {
  const indexes: Array<{ sectionIndex: number; itemIndex: number }> = [];
  sections.forEach((section, sectionIndex) => {
    section.items.forEach((item, itemIndex) => {
      if (!item.disabled) indexes.push({ sectionIndex, itemIndex });
    });
  });
  return indexes;
}

function getMenuItemId(menuId: string, sectionIndex: number, itemIndex: number) {
  return `${menuId}-item-${sectionIndex}-${itemIndex}`;
}

function mergeRefs<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return (node) => {
    refs.forEach((ref) => {
      if (!ref) return;
      if (typeof ref === "function") {
        ref(node);
      } else {
        (ref as React.MutableRefObject<T | null>).current = node;
      }
    });
  };
}

export function Menu({
  trigger,
  sections,
  align = "start",
  side = "bottom",
  ariaLabel,
  menuClassName,
  matchTriggerWidth = false,
}: MenuProps): JSX.Element {
  const menuId = React.useId();
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const menuRef = React.useRef<HTMLDivElement | null>(null);
  const closeTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [open, setOpen] = React.useState(false);
  const [visible, setVisible] = React.useState(false);
  const [menuState, setMenuState] = React.useState<"closed" | "open">(
    "closed",
  );
  const [highlightedIndex, setHighlightedIndex] = React.useState(0);
  const [position, setPosition] = React.useState<{
    top: number;
    left: number;
    width?: number;
    maxHeight?: number;
  }>({ top: 0, left: 0 });
  const enabledIndexes = React.useMemo(
    () => enabledItemIndexes(sections),
    [sections],
  );

  const closeMenu = React.useCallback(() => {
    setOpen(false);
  }, []);

  React.useEffect(() => {
    return () => {
      if (closeActiveMenu === closeMenu) closeActiveMenu = null;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, [closeMenu]);

  const updatePosition = React.useCallback(() => {
    const triggerNode = triggerRef.current;
    const menuNode = menuRef.current;
    if (!triggerNode || !menuNode) return;

    const triggerRect = triggerNode.getBoundingClientRect();
    const menuRect = menuNode.getBoundingClientRect();
    const gap = 8;
    const viewportInset = 8;
    const availableTop = Math.max(0, triggerRect.top - gap - viewportInset);
    const availableBottom = Math.max(
      0,
      window.innerHeight - triggerRect.bottom - gap - viewportInset,
    );
    const maxHeight = side === "top" ? availableTop : availableBottom;
    const menuHeight = Math.min(menuRect.height, maxHeight || menuRect.height);
    const nextTop =
      side === "top"
        ? triggerRect.top - menuHeight - gap
        : triggerRect.bottom + gap;
    const nextLeft =
      align === "end"
        ? triggerRect.right - menuRect.width
        : triggerRect.left;

    setPosition({
      top: Math.max(
        viewportInset,
        Math.min(nextTop, window.innerHeight - menuHeight - viewportInset),
      ),
      left: Math.max(
        viewportInset,
        Math.min(nextLeft, window.innerWidth - menuRect.width - viewportInset),
      ),
      width: matchTriggerWidth ? triggerRect.width : undefined,
      maxHeight,
    });
  }, [align, matchTriggerWidth, side]);

  React.useEffect(() => {
    if (open) {
      if (closeActiveMenu && closeActiveMenu !== closeMenu) closeActiveMenu();
      closeActiveMenu = closeMenu;
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setVisible(true);
      setMenuState("closed");
      setPosition((current) => ({ ...current, maxHeight: undefined }));
      requestAnimationFrame(() => {
        updatePosition();
        setMenuState("open");
      });
      const selectedIndex = enabledIndexes.findIndex(({ sectionIndex, itemIndex }) => {
        return sections[sectionIndex]?.items[itemIndex]?.selected;
      });
      setHighlightedIndex(selectedIndex >= 0 ? selectedIndex : 0);
    } else if (visible) {
      setMenuState("closed");
      closeTimerRef.current = setTimeout(() => {
        setVisible(false);
      }, MENU_EXIT_DURATION);
    }
  }, [closeMenu, enabledIndexes, open, sections, updatePosition, visible]);

  React.useEffect(() => {
    if (!visible || typeof document === "undefined") return;

    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (triggerRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      closeMenu();
    }

    function handleResize() {
      updatePosition();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleResize, true);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleResize, true);
    };
  }, [closeMenu, updatePosition, visible]);

  function activateHighlighted() {
    const index = enabledIndexes[highlightedIndex];
    if (!index) return;
    const item = sections[index.sectionIndex]?.items[index.itemIndex];
    if (!item || item.disabled) return;
    item.onSelect?.();
    closeMenu();
    triggerRef.current?.focus({ preventScroll: true });
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape" || event.key === "Tab") {
      event.preventDefault();
      closeMenu();
      triggerRef.current?.focus({ preventScroll: true });
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) =>
        enabledIndexes.length === 0 ? 0 : (index + 1) % enabledIndexes.length,
      );
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) =>
        enabledIndexes.length === 0
          ? 0
          : (index - 1 + enabledIndexes.length) % enabledIndexes.length,
      );
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      activateHighlighted();
    }
  }

  const triggerElement = React.cloneElement(trigger, {
    "aria-controls": visible ? menuId : undefined,
    "aria-expanded": open,
    "aria-haspopup": "menu",
    onClick: (event: React.MouseEvent) => {
      trigger.props.onClick?.(event);
      if (!event.defaultPrevented) setOpen((next) => !next);
    },
    onKeyDown: (event: React.KeyboardEvent) => {
      trigger.props.onKeyDown?.(event);
      if (event.defaultPrevented) return;
      if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        setOpen(true);
      }
    },
    ref: mergeRefs((trigger as any).ref, triggerRef),
  });

  return (
    <>
      {triggerElement}
      {visible ? (
        <BodyPortal>
          <div
            id={menuId}
            ref={menuRef}
            className={clsx("ds-menu", menuClassName)}
            data-state={menuState}
            role="menu"
            aria-label={ariaLabel}
            aria-activedescendant={
              enabledIndexes[highlightedIndex]
                ? getMenuItemId(
                    menuId,
                    enabledIndexes[highlightedIndex].sectionIndex,
                    enabledIndexes[highlightedIndex].itemIndex,
                  )
                : undefined
            }
            tabIndex={-1}
            style={{
              top: position.top,
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
            }}
            onKeyDown={handleMenuKeyDown}
          >
            {sections.map((section, sectionIndex) => (
              <React.Fragment key={`${menuId}-section-${sectionIndex}`}>
                {section.label ? (
                  <div className="ds-menu__label">{section.label}</div>
                ) : null}
                {section.items.map((item, itemIndex) => {
                  const enabledIndex = enabledIndexes.findIndex(
                    (index) =>
                      index.sectionIndex === sectionIndex &&
                      index.itemIndex === itemIndex,
                  );
                  const highlighted = enabledIndex === highlightedIndex;
                  return (
                    <button
                      id={getMenuItemId(menuId, sectionIndex, itemIndex)}
                      key={item.id}
                      type="button"
                      role={item.role ?? "menuitem"}
                      aria-label={
                        item.ariaLabel ??
                        (typeof item.label === "string" ? item.label : undefined)
                      }
                      aria-checked={
                        item.role === "menuitemradio"
                          ? Boolean(item.selected)
                          : undefined
                      }
                      disabled={item.disabled}
                      className={clsx(
                        "ds-menu__item",
                        item.tone === "danger" && "ds-menu__item--danger",
                        item.description && "ds-menu__item--with-description",
                      )}
                      data-highlighted={highlighted ? "" : undefined}
                      onMouseEnter={() => {
                        if (enabledIndex >= 0) setHighlightedIndex(enabledIndex);
                      }}
                      onClick={() => {
                        item.onSelect?.();
                        closeMenu();
                        triggerRef.current?.focus({ preventScroll: true });
                      }}
                    >
                      {item.icon ? (
                        <span className="ds-menu__icon" aria-hidden="true">
                          {item.icon}
                        </span>
                      ) : null}
                      <span className="ds-menu__label-text">
                        <span className="ds-menu__label-primary">
                          {item.label}
                        </span>
                        {item.description ? (
                          <span className="ds-menu__description">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                      {item.shortcut ? (
                        <span className="ds-menu__shortcut">{item.shortcut}</span>
                      ) : null}
                    </button>
                  );
                })}
                {sectionIndex < sections.length - 1 ? (
                  <div className="ds-menu__separator" aria-hidden="true" />
                ) : null}
              </React.Fragment>
            ))}
          </div>
        </BodyPortal>
      ) : null}
    </>
  );
}
