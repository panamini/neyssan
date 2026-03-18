import React from "react";

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
    options.findIndex((o) => o.value === value)
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
        if (options[options.length - 1]) onChange(options[options.length - 1].value);
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
      className={[
        "inline-flex flex-wrap items-center gap-1 rounded-md p-1",
        "bg-background border border-[color:var(--bo)]",
        disabled ? "opacity-60 cursor-not-allowed" : "",
        className ?? "",
      ].join(" ")}
      {...aria}
    >
      {options.map((opt, idx) => {
        const isChecked = opt.value === value;
        const tabIndex = isChecked || currentIndex === -1 && idx === 0 ? 0 : -1;
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
            className={[
              "px-2.5 py-1 text-xs sm:text-sm rounded-md [transition:background_.12s_var(--ez),color_.12s_var(--ez),border-color_.12s_var(--ez)]",
              "focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1",
              isChecked
                ? "bg-primary text-foreground"
                : "bg-transparent text-muted hover:opacity-90",
            ].join(" ")}
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