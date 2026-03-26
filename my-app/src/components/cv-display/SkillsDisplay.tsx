import React from "react";
import type { ISkillItem, Level } from "../../types/cvDocument";

interface SkillsDisplayProps {
  items: ISkillItem[];
  className?: string;
  showHeadings?: boolean;
  compact?: boolean; // when true, render smaller chips
}

type Bucket = "core" | "secondary" | "familiar";

const ORDER: Bucket[] = ["core", "secondary", "familiar"];
const LABELS: Record<Bucket, string> = {
  core: "Core",
  secondary: "Secondary",
  familiar: "Familiar",
};

function toBucket(raw: ISkillItem["bucket"] | undefined): Bucket {
  return raw === "core" || raw === "familiar" ? raw : "secondary";
}

function groupByBucket(items: ISkillItem[]) {
  const out: Record<Bucket, ISkillItem[]> = {
    core: [],
    secondary: [],
    familiar: [],
  };
  for (const it of items) {
    out[toBucket(it.bucket)].push(it);
  }
  return out;
}

function levelLabel(level: Level | undefined): string | undefined {
  return level ? String(level) : undefined;
}

export function SkillsDisplay({
  items,
  className,
  showHeadings = true,
  compact = false,
}: SkillsDisplayProps): JSX.Element {
  const groups = groupByBucket(items);

  return (
    <section
      aria-label="Skills"
      className={["w-full", className ?? ""].join(" ").trim()}
    >
      <div className="space-y-3">
        {ORDER.map((bucket) => {
          const list = groups[bucket];
          if (!Array.isArray(list) || list.length === 0) return null;

          return (
            <div key={bucket} className="space-y-1">
              {showHeadings ? (
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold">{LABELS[bucket]}</h3>
                  <span className="text-xs text-muted">({list.length})</span>
                </div>
              ) : null}

              <ul
                className="flex flex-wrap gap-2"
                aria-label={`${LABELS[bucket]} skills`}
              >
                {list.map((it) => {
                  const name = String(it.name ?? "").trim() || "Untitled";
                  // Hide default Intermediate level badge; show only when non-default
                  const isDefaultLevel =
                    String(it.level ?? "Intermediate") === "Intermediate";
                  const lvl = isDefaultLevel ? undefined : levelLabel(it.level);
                  return (
                    <li key={String(it.id ?? name)}>
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
                })}
              </ul>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export default SkillsDisplay;
