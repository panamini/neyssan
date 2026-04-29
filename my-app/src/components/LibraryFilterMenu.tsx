import React from "react";
import { Check, ChevronDown } from "@/lib/icons";
import { ToneBadge, type ToneBadgeTone } from "./ui/tone-badge";

export type LibraryFilterMenuOption<TValue extends string> = {
  value: TValue;
  label: string;
  description?: string;
  tone?: ToneBadgeTone;
};

type LibraryFilterMenuProps<TValue extends string> = {
  label: string;
  value: TValue;
  options: ReadonlyArray<LibraryFilterMenuOption<TValue>>;
  onChange: (value: TValue) => void;
};

export function LibraryFilterMenu<TValue extends string>({
  label,
  value,
  options,
  onChange,
}: LibraryFilterMenuProps<TValue>): JSX.Element {
  const [isOpen, setIsOpen] = React.useState(false);
  const rootRef = React.useRef<HTMLDivElement | null>(null);
  const menuId = React.useId();
  const activeOption =
    options.find((option) => option.value === value) ?? options[0];

  React.useEffect(() => {
    if (!isOpen || typeof document === "undefined") return;

    function handleMouseDown(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target)) return;
      setIsOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleMouseDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleMouseDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div className="dasti-proposal-library-filter-menu" ref={rootRef}>
      <button
        type="button"
        className="dasti-proposal-library-filter-menu__trigger"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        aria-controls={isOpen ? menuId : undefined}
        onClick={() => setIsOpen((open) => !open)}
      >
        <span className="dasti-proposal-library-filter-menu__trigger-label">
          {activeOption?.tone ? (
            <ToneBadge tone={activeOption.tone}>{activeOption.label}</ToneBadge>
          ) : (
            (activeOption?.label ?? label)
          )}
        </span>
        <ChevronDown
          className="dasti-proposal-library-filter-menu__chevron"
          size={14}
          strokeWidth={1.8}
          aria-hidden="true"
        />
      </button>

      {isOpen ? (
        <div
          id={menuId}
          className="dasti-proposal-library-filter-menu__drawer dasti-proposal-chrome-drawer dasti-proposal-chrome-drawer--stack"
          role="menu"
          aria-label={label}
        >
          {options.map((option) => {
            const active = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={active}
                aria-label={option.label}
                className={[
                  "dasti-proposal-chrome-option",
                  "dasti-proposal-library-filter-menu__option",
                  active ? "dasti-proposal-chrome-option--active" : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
                onClick={() => {
                  onChange(option.value);
                  setIsOpen(false);
                }}
              >
                <span
                  className="dasti-proposal-chrome-option__icon"
                  aria-hidden="true"
                >
                  {active ? <Check size={14} strokeWidth={2.2} /> : null}
                </span>
                <span className="dasti-proposal-chrome-option__copy">
                  <span className="dasti-proposal-chrome-option__title">
                    {option.tone ? (
                      <ToneBadge tone={option.tone}>{option.label}</ToneBadge>
                    ) : (
                      option.label
                    )}
                  </span>
                  {option.description ? (
                    <span className="dasti-proposal-chrome-option__description">
                      {option.description}
                    </span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
