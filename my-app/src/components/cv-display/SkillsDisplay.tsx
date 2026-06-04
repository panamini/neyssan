import React from "react";
import type { ISkillItem, Level, SkillCategory } from "../../types/cvDocument";

interface SkillsDisplayProps {
  items: ISkillItem[];
  categories?: SkillCategory[];
  className?: string;
  showHeadings?: boolean;
  compact?: boolean; // when true, render smaller chips
}

function levelLabel(level: Level | undefined): string | undefined {
  return level ? String(level) : undefined;
}

function SkillPill({ item, compact }: { item: ISkillItem; compact: boolean }) {
  const name = String(item.name ?? "").trim() || "Untitled";
  const isDefaultLevel = String(item.level ?? "Intermediate") === "Intermediate";
  const lvl = isDefaultLevel ? undefined : levelLabel(item.level);
  return (
    <li key={String(item.id ?? name)}>
      <span
        className={[
          "inline-flex items-center gap-1 rounded-full border border-[color:var(--color-border)]",
          compact
            ? "px-2 py-0.5 text-xs"
            : "px-2.5 py-1 text-xs sm:text-sm",
          "bg-background",
        ].join(" ")}
        aria-label={lvl ? `${name}, ${lvl}` : name}
        title={lvl ? `${name} • ${lvl}` : name}
      >
        <span className="font-medium">{name}</span>
        {lvl ? (
          <>
            <span className="opacity-60" aria-hidden>
              •
            </span>
            <span className="opacity-80">{lvl}</span>
          </>
        ) : null}
      </span>
    </li>
  );
}

export function SkillsDisplay({
  items,
  categories = [],
  className,
  showHeadings = true,
  compact = false,
}: SkillsDisplayProps): JSX.Element {
  const categoryById = new Map(
    categories
      .filter((category) => category.id && category.label.trim())
      .map((category) => [category.id, category]),
  );
  const hasCategories = categoryById.size > 0;
  const grouped = categories
    .filter((category) => categoryById.has(category.id))
    .map((category) => ({
      category,
      items: items.filter((item) => item.categoryId === category.id),
    }))
    .filter((group) => group.items.length > 0);
  const uncategorized = items.filter(
    (item) => !item.categoryId || !categoryById.has(item.categoryId),
  );

  return (
    <section
      aria-label="Skills"
      className={["w-full", className ?? ""].join(" ").trim()}
    >
      <div className="space-y-3">
        {(hasCategories ? grouped : [{ category: null, items }]).map((group) => {
          const label = group.category?.label ?? "Skills";
          return (
            <div key={group.category?.id ?? "__flat__"} className="space-y-1">
              {showHeadings && group.category ? (
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{group.category.label}</h3>
                  <span className="text-xs text-muted">({group.items.length})</span>
                </div>
              ) : null}
              <ul className="flex flex-wrap gap-2" aria-label={`${label} skills`}>
                {group.items.map((item) => (
                  <SkillPill key={String(item.id ?? item.name)} item={item} compact={compact} />
                ))}
              </ul>
            </div>
          );
        })}
        {hasCategories && uncategorized.length > 0 ? (
          <div className="space-y-1">
            {showHeadings ? (
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold">Other Skills</h3>
                <span className="text-xs text-muted">({uncategorized.length})</span>
              </div>
            ) : null}
            <ul className="flex flex-wrap gap-2" aria-label="Other Skills skills">
              {uncategorized.map((item) => (
                <SkillPill key={String(item.id ?? item.name)} item={item} compact={compact} />
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}

export default SkillsDisplay;
