import React from "react";
import clsx from "clsx";

export interface ISegmentedOption<T extends string> {
  value: T;
  label: string;
  ariaLabel?: string;
}

export interface ISegmentedRadioProps<T extends string> {
  id?: string;
  name?: string;
  value: T;
  options: ISegmentedOption<T>[];
  onChange: (next: T) => void;
  disabled?: boolean;
  className?: string;
  "aria-labelledby"?: string;
  "aria-label"?: string;
}

/**
 * Accessible segmented radio control.
 * - role="radiogroup" container
 * - Each segment is role="radio" with aria-checked
 * - Roving tabindex (only the checked item is tabbable)
 * - ArrowLeft/ArrowRight move selection; Home/End jump
 * - Uses CSS variables and Tailwind classes; mobile-friendly wrapping
 *
 * Design tokens: relies on --background, --foreground, --accent, --primary for colors.
 */
export function SegmentedRadio<T extends string>({
  id,
  name,
  value,
  options,
  onChange,
  disabled = false,
  className,
  ...aria
}: ISegmentedRadioProps<T>): JSX.Element {
  const currentIndex = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );

  function move(delta: number) {
    if (disabled || options.length === 0) return;
    const nextIndex = (currentIndex + delta + options.length) % options.length;
    const next = options[nextIndex]?.value;
    if (next) onChange(next);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (disabled) return;
    switch (e.key) {
      case "ArrowRight":
      case "Right":
        e.preventDefault();
        move(1);
        break;
      case "ArrowLeft":
      case "Left":
        e.preventDefault();
        move(-1);
        break;
      case "Home":
        e.preventDefault();
        if (options[0]) onChange(options[0].value);
        break;
      case "End":
        e.preventDefault();
        if (options[options.length - 1])
          onChange(options[options.length - 1].value);
        break;
      case " ":
      case "Enter":
        // Space/Enter on the focused segment should toggle selection; handled at button-level
        break;
      default:
        break;
    }
  }

  return (
    <div
      id={id}
      role="radiogroup"
      aria-disabled={disabled || undefined}
      onKeyDown={handleKeyDown}
      className={clsx(
        "dasti-segmented-control",
        disabled && "opacity-60 cursor-not-allowed",
        className,
      )}
      {...aria}
    >
      {options.map((opt, idx) => {
        const isChecked = opt.value === value;
        const tabIndex =
          isChecked || (currentIndex === -1 && idx === 0) ? 0 : -1;
        // Derive a stable input-like name for SR friendliness (not a real input)
        const srName = name ?? id ?? "segmented-radio";
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isChecked}
            aria-label={opt.ariaLabel ?? opt.label}
            tabIndex={tabIndex}
            disabled={disabled}
            onClick={() => {
              if (!disabled) onChange(opt.value);
            }}
            className={clsx(
              "dasti-segmented-control__button",
              isChecked && "dasti-segmented-control__button--active",
            )}
            data-segment-name={srName}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedRadio;
