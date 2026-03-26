import React from "react";
import type { ILanguageItem } from "../../types/cvDocument";

export interface LanguagesDisplayProps {
  items: ILanguageItem[];
  compact?: boolean;
  className?: string;
}

/**
 * LanguagesDisplay
 * Minimal read-only renderer for languages list.
 * Renders each language as: "name • level"
 * - compact=true: tighter spacing and smaller font.
 * - No buckets, sorting, pinning, or complex inline editing.
 */
export function LanguagesDisplay({
  items,
  compact = false,
  className,
}: LanguagesDisplayProps): JSX.Element {
  if (!Array.isArray(items) || items.length === 0) {
    return <p className="text-sm [color:var(--tg2)]">No languages yet.</p>;
  }

  const itemBase =
    "flex items-center justify-between rounded border [border-color:var(--color-border)] [background:var(--sfr)]";
  const itemPadding = compact ? "px-2 py-1" : "px-3 py-2";
  const itemText = compact ? "text-sm" : "text-base";

  return (
    <div className={["space-y-2", className].filter(Boolean).join(" ")}>
      {items.map((lang, idx) => {
        const key = lang.id ?? `lang-${idx}`;
        const name = String(lang.name ?? "").trim();
        const level = String(lang.level ?? "").trim();
        return (
          <div key={key} className={[itemBase, itemPadding].join(" ")}>
            <span className={["[color:var(--ti)]", itemText].join(" ")}>
              {name || "Language"}
            </span>
            {level ? (
              <span
                className={[
                  "ml-3 shrink-0 rounded-md [background:var(--sf2)] [color:var(--tm2)]",
                  compact ? "px-2 py-0.5 text-xs" : "px-2.5 py-1 text-sm",
                ].join(" ")}
                aria-label={`${name || "Language"} level`}
              >
                {level}
              </span>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export default LanguagesDisplay;