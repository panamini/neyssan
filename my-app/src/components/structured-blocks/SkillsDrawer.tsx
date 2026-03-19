import React from "react";
import type { ISkillItem, Level } from "../../types/cvDocument";

interface SkillsDrawerProps {
  open: boolean;
  items: ISkillItem[];
  onClose: () => void;
  onApply?: (next: ISkillItem[]) => void;
}

type TabKey = "manage" | "ai";
type Bucket = "core" | "secondary" | "familiar";

const LEVELS: Level[] = ["Beginner", "Elementary", "Intermediate", "Advanced", "Fluent"];

function toBucket(raw: ISkillItem["bucket"] | undefined): Bucket {
  return raw === "core" || raw === "familiar" ? raw : "secondary";
}

function groupByBucket(items: ISkillItem[]) {
  const out: Record<Bucket, ISkillItem[]> = { core: [], secondary: [], familiar: [] };
  for (const it of items) {
    out[toBucket(it.bucket)].push(it);
  }
  return out;
}

function idOf(it: ISkillItem): string {
  return String(it.id ?? it.name);
}

function BucketBadge({ bucket }: { bucket: Bucket }) {
  const label = bucket === "core" ? "Core" : bucket === "familiar" ? "Familiar" : "Secondary";
  const color =
    bucket === "core"
      ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300"
      : bucket === "familiar"
      ? "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300"
      : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300";
  return <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full ${color}`}>{label}</span>;
}

export function SkillsDrawer({ open, items, onClose, onApply }: SkillsDrawerProps): JSX.Element | null {
  const [tab, setTab] = React.useState<TabKey>("manage");
  const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
  const [levelChoice, setLevelChoice] = React.useState<Level>("Intermediate");
  const [isDeleteConfirming, setIsDeleteConfirming] = React.useState(false);

  // Anchor for shift-click range selection
  const anchorRef = React.useRef<{ bucket: Bucket; index: number } | null>(null);

  React.useEffect(() => {
    if (!open) return;
    // Drop selections that no longer exist in the latest items array
    const ids = new Set(items.map(idOf));
    setSelected((prev) => {
      const next = new Set<string>();
      for (const id of prev) if (ids.has(id)) next.add(id);
      return next;
    });
  }, [open, items]);

  if (!open) return null;

  const groups = groupByBucket(items);
  const order: Bucket[] = ["core", "secondary", "familiar"];
  const totalSelected = selected.size;
  const bulkDisabled = !onApply || totalSelected === 0;

  function toggleOne(id: string, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  function isBucketAllSelected(bucket: Bucket): boolean {
    const list = groups[bucket];
    if (list.length === 0) return false;
    return list.every((it) => selected.has(idOf(it)));
  }

  function isBucketSomeSelected(bucket: Bucket): boolean {
    const list = groups[bucket];
    return list.some((it) => selected.has(idOf(it)));
  }

  function toggleBucket(bucket: Bucket, checked: boolean) {
    const list = groups[bucket];
    setSelected((prev) => {
      const next = new Set(prev);
      for (const it of list) {
        const id = idOf(it);
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  function mutate(mutator: (list: ISkillItem[]) => ISkillItem[]) {
    if (!onApply) return;
    const cloned = items.map((it) => ({ ...it }));
    const next = mutator(cloned);
    onApply(next);
  }

  function handleMoveSelected(target: Bucket) {
    mutate((list) =>
      list.map((it) => (selected.has(idOf(it)) ? { ...it, bucket: target } : it))
    );
  }

  function handleSetLevelSelected(level: Level) {
    mutate((list) =>
      list.map((it) => (selected.has(idOf(it)) ? { ...it, level } : it))
    );
  }

  function handleDeleteSelected() {
    if (!onApply || selected.size === 0) return;
    mutate((list) => list.filter((it) => !selected.has(idOf(it))));
    setSelected(new Set());
    setIsDeleteConfirming(false);
  }

  // Shift-click range selection logic
  function toggleRange(bucket: Bucket, list: ISkillItem[], index: number, nextChecked: boolean) {
    const anchor = anchorRef.current;
    if (!anchor || anchor.bucket !== bucket) {
      // No valid anchor in this bucket; set current as anchor and toggle single
      anchorRef.current = { bucket, index };
      const id = idOf(list[index]);
      toggleOne(id, nextChecked);
      return;
    }
    const start = Math.min(anchor.index, index);
    const end = Math.max(anchor.index, index);
    setSelected((prev) => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) {
        const id = idOf(list[i]);
        if (nextChecked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  }

  return (
    <div
      className="fixed inset-0 z-[10010]"
      onMouseDownCapture={(e) => e.stopPropagation()}
      onPointerDownCapture={(e) => e.stopPropagation()}
    >
      {/* overlay */}
      <div className="absolute inset-0" aria-hidden onClick={onClose}  style={{ background: 'hsla(30,12%,11%,.32)', backdropFilter: 'blur(8px)' }} />

      {/* panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Manage Skills"
        className="absolute inset-y-0 right-0 flex w-full max-w-md border-l [box-shadow:var(--shc)] [background:var(--sfr)] text-foreground border-[color:var(--bo)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col w-full h-full">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--bo)]">
            <h2 className="text-base font-semibold">Manage Skills</h2>
            <button
              type="button"
              onClick={onClose}
              className="px-2 py-1 text-sm rounded hover:[background:var(--as)] focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)]"
              aria-label="Close"
            >
              Close
            </button>
          </div>

          {/* tabs */}
          <div className="px-4 pt-3">
            <div role="tablist" aria-label="Skills views" className="inline-flex gap-2 p-1 border rounded-md border-[color:var(--bo)]">
              <button
                role="tab"
                aria-selected={tab === "manage"}
                tabIndex={tab === "manage" ? 0 : -1}
                onClick={() => setTab("manage")}
                className={[
                  "px-3 py-1.5 text-sm rounded-md focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]",
                  tab === "manage" ? "[background:var(--ac)] [color:var(--op)]" : "[color:var(--tm2)] hover:[background:var(--sf2)]",
                ].join(" ")}
              >
                Manage
              </button>
              <button
                role="tab"
                aria-selected={tab === "ai"}
                tabIndex={tab === "ai" ? 0 : -1}
                onClick={() => setTab("ai")}
                className={[
                  "px-3 py-1.5 text-sm rounded-md focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]",
                  tab === "ai" ? "[background:var(--ac)] [color:var(--op)]" : "[color:var(--tm2)] hover:[background:var(--sf2)]",
                ].join(" ")}
              >
                AI Suggestions
              </button>
            </div>
          </div>

          {/* content */}
          <div className="flex-1 p-4 overflow-auto">
            {tab === "manage" ? (
              <div className="space-y-6">
                {/* Bulk actions bar */}
                <div className="flex items-center justify-between px-3 py-2 border rounded border-[color:var(--bo)] bg-background">
                  <div className="text-sm">
                    {totalSelected > 0 ? (
                      <span>{totalSelected} selected</span>
                    ) : (
                      <span className="text-muted">Select items to enable bulk actions</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      aria-label="Choose level"
                      className="px-2 py-1 text-sm border rounded border-[color:var(--bo)] bg-background"
                      value={levelChoice}
                      onChange={(e) => setLevelChoice(e.target.value as Level)}
                    >
                      {LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>
                          {lvl}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleSetLevelSelected(levelChoice)}
                      disabled={bulkDisabled}
                      className="px-2 py-1 text-sm border rounded border-[color:var(--bo)] disabled:opacity-50 hover:opacity-90"
                      title="Set level for selected"
                    >
                      Set level
                    </button>
                    <div className="w-px h-5 bg-accent/60" aria-hidden />
                    <button
                      type="button"
                      onClick={() => handleMoveSelected("core")}
                      disabled={bulkDisabled}
                      className="px-2 py-1 text-sm border rounded border-[color:var(--bo)] disabled:opacity-50 hover:opacity-90"
                      title="Move to Core"
                    >
                      To Core
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSelected("secondary")}
                      disabled={bulkDisabled}
                      className="px-2 py-1 text-sm border rounded border-[color:var(--bo)] disabled:opacity-50 hover:opacity-90"
                      title="Move to Secondary"
                    >
                      To Secondary
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMoveSelected("familiar")}
                      disabled={bulkDisabled}
                      className="px-2 py-1 text-sm border rounded border-[color:var(--bo)] disabled:opacity-50 hover:opacity-90"
                      title="Move to Familiar"
                    >
                      To Familiar
                    </button>
                    <div className="w-px h-5 bg-accent/60" aria-hidden />
                    {isDeleteConfirming ? (
                      <span className="sb-doc-confirm" style={{ gap: "var(--s2)" }}>
                        <span className="sb-doc-confirm__label" style={{ fontSize: "var(--tx)" }}>Delete {selected.size}?</span>
                        <button type="button" className="sb-doc-confirm__yes" onClick={handleDeleteSelected}>Delete</button>
                        <button type="button" className="sb-doc-confirm__no" onClick={() => setIsDeleteConfirming(false)}>Cancel</button>
                      </span>
                    ) : (
                    <button
                      type="button"
                      onClick={() => setIsDeleteConfirming(true)}
                      disabled={bulkDisabled}
                      className="px-2 py-1 text-sm border rounded border-[color:var(--bo)] disabled:opacity-50 hover:opacity-90"
                      title="Delete selected"
                    >
                      Delete
                    </button>
                    )}
                  </div>
                </div>

                {order.map((bkt) => {
                  const list = groups[bkt];
                  if (!list || list.length === 0) return null;
                  const all = isBucketAllSelected(bkt);
                  const some = isBucketSomeSelected(bkt);
                  return (
                    <div key={bkt}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            aria-label={`Select all in ${bkt}`}
                            className="w-4 h-4 accent-[var(--primary)]"
                            checked={all}
                            ref={(el) => {
                              if (el) el.indeterminate = !all && some;
                            }}
                            onChange={(e) => toggleBucket(bkt, e.target.checked)}
                          />
                          <BucketBadge bucket={bkt} />
                          <span className="text-sm opacity-70">
                            {list.length} item{list.length !== 1 ? "s" : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => toggleBucket(bkt, true)}
                            className="px-2 py-1 text-xs border rounded border-[color:var(--bo)] hover:opacity-90"
                            title="Select all in bucket"
                          >
                            Select all
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleBucket(bkt, false)}
                            className="px-2 py-1 text-xs border rounded border-[color:var(--bo)] hover:opacity-90"
                            title="Clear bucket selection"
                          >
                            Clear
                          </button>
                        </div>
                      </div>
                      <div className="border divide-y rounded divide-[color:var(--bo)] border-[color:var(--bo)]">
                        {list.map((it, idx) => {
                          const id = idOf(it);
                          const bucket = toBucket(it.bucket);
                          const checked = selected.has(id);
                          return (
                            <label key={id} className="flex items-center justify-between gap-3 px-3 py-2">
                              <div className="flex items-center min-w-0 gap-3">
                                <input
                                  type="checkbox"
                                  className="w-4 h-4 accent-[var(--primary)]"
                                  aria-label={`Select ${it.name}`}
                                  checked={checked}
                                  onChange={(e) => {
                                    // Default toggle when not using shift; anchor is set on change
                                    anchorRef.current = { bucket, index: idx };
                                    toggleOne(id, e.target.checked);
                                  }}
                                  onClick={(e) => {
                                    // Support shift-click range selection
                                    const ev = e as React.MouseEvent<HTMLInputElement>;
                                    if (!ev.shiftKey) return;
                                    ev.preventDefault();
                                    // Determine intended next checked state based on current selection
                                    const nextChecked = !checked;
                                    toggleRange(bucket, list, idx, nextChecked);
                                  }}
                                  onKeyDown={(e) => {
                                    // Keyboard: Shift + Space/Enter for range toggle
                                    if ((e.key === " " || e.key === "Enter") && e.shiftKey) {
                                      e.preventDefault();
                                      const nextChecked = !checked;
                                      toggleRange(bucket, list, idx, nextChecked);
                                    }
                                  }}
                                />
                                <div className="min-w-0">
                                  <div className="text-sm font-medium truncate">{it.name || "Untitled"}</div>
                                  <div className="text-xs text-muted">Level: {it.level}</div>
                                </div>
                              </div>
                              <BucketBadge bucket={bucket} />
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {items.length === 0 ? (
                  <div className="px-3 py-2 text-sm border rounded border-[color:var(--bo)] text-muted">
                    No skills yet. Add skills from the section or import suggestions.
                  </div>
                ) : null}
              </div>
            ) : (
              <div className="space-y-2">
                <div className="px-3 py-2 text-sm border rounded border-[color:var(--bo)] text-muted">
                  AI suggestions will appear here. Connect to your profile and job history to get recommended skills with levels.
                </div>
                <div className="px-3 py-2 text-xs text-muted">Placeholder only — no data is fetched yet.</div>
              </div>
            )}
          </div>

          {/* footer */}
          <div className="flex items-center justify-between gap-2 px-4 py-3 border-t border-[color:var(--bo)]">
            <div className="text-xs text-muted">{totalSelected > 0 ? `${totalSelected} selected` : "\u00A0"}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-2 rounded [background:var(--sf2)] hover:brightness-95 focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)]"
              >
                Close
              </button>
              <button
                type="button"
                disabled
                className="px-3 py-2 rounded cursor-not-allowed bg-primary text-foreground opacity-60"
                aria-disabled="true"
                title="All changes apply immediately"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SkillsDrawer;