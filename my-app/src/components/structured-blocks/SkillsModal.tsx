import React, { useEffect, useMemo, useState } from "react";
import type { ISkillItem, Level } from "../../types/cvDocument";
import { X, Plus, Trash2 } from "lucide-react";
import { LEVELS } from "../ui/levelLabels";

interface SkillsModalProps {
  open: boolean;
  items: ISkillItem[];
  onClose: () => void;
  onSave: (next: ISkillItem[]) => void;
}


function newSkill(): ISkillItem {
  // Deliberately avoid uuid import here to keep modal self-contained; caller will reconcile ids on save if needed.
  const id = `sk-${Math.random().toString(36).slice(2, 10)}`;
  return { id, name: "", level: "Intermediate" };
}

export function SkillsModal({ open, items, onClose, onSave }: SkillsModalProps) {
  const [rows, setRows] = useState<ISkillItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Seed rows only when the modal opens or when the real items content changes.
  // Prevents resetting the input on each parent render (which caused single-character typing).
  const lastSeedRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    try {
      const nextStr = JSON.stringify(items ?? []);
      if (lastSeedRef.current === nextStr) return;
      lastSeedRef.current = nextStr;
      setRows(JSON.parse(nextStr) as ISkillItem[]);
    } catch {
      // Fallback to safe clone on failure
      setRows(JSON.parse(JSON.stringify(items ?? [])) as ISkillItem[]);
    }
  }, [open, items]);

  const canSave = useMemo(() => {
    return rows.every((r) => typeof r.name === "string" && r.name.trim().length > 0 && LEVELS.includes(r.level));
  }, [rows]);

  if (!open) return null;

  function updateRow(idx: number, patch: Partial<ISkillItem>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function handleAdd() {
    setRows((prev) => [...prev, newSkill()]);
  }

  function handleRemove(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      const next = rows
        .map((r) => ({ ...r, name: String(r.name ?? "").trim() }))
        .filter((r) => r.name.length > 0);
      onSave(next);
    } finally {
      setIsSaving(false);
      onClose();
    }
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onMouseDownCapture={(e) => e.stopPropagation()}>
      <div className="absolute inset-0" onClick={() => (isSaving ? null : onClose())}  style={{ background: 'hsla(30,12%,11%,.32)', backdropFilter: 'blur(8px)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit skills"
        className="relative w-full max-w-2xl [background:var(--sfr)] border border-[color:var(--bm)] [border-radius:var(--rl)] [box-shadow:var(--shc)] overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-bo">
          <h2 className="text-lg font-semibold">Edit skills</h2>
          <button
            type="button"
            onClick={() => (isSaving ? null : onClose())}
            aria-label="Close"
            className="p-1 rounded hover:[background:var(--sf2)] disabled:opacity-50"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm [color:var(--tm2)]">Add, remove, or edit your skills and levels</div>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded [background:var(--ac)] [color:var(--op)] hover:brightness-110 focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              aria-label="Add skill"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div className="space-y-2">
            {rows.length === 0 ? (
              <div className="px-3 py-2 text-sm rounded [color:var(--tg2)] [background:var(--sf1)]">No skills yet. Add your first skill.</div>
            ) : (
              rows.map((row, idx) => (
                <div key={row.id ?? `row-${idx}`} className="flex items-center gap-2">
                  {/* Level dots — LEFT */}
                  <div className="flex items-center gap-1.5 flex-shrink-0" role="group" aria-label="Skill level" style={{ width: 88 }}>
                    {(["Beginner", "Intermediate", "Advanced"] as Level[]).map((lvl, di) => {
                      const activeIdx = ["Beginner", "Intermediate", "Advanced"].indexOf(row.level as string);
                      const filled = di <= activeIdx;
                      return (
                        <button
                          key={lvl}
                          type="button"
                          title={lvl}
                          aria-label={lvl}
                          onClick={() => updateRow(idx, { level: lvl })}
                          style={{
                            width: 10, height: 10, borderRadius: "50%", padding: 0,
                            cursor: "pointer", flexShrink: 0, border: "1.5px solid",
                            borderColor: filled ? "var(--ac)" : "var(--bo)",
                            background: filled ? "var(--ac)" : "transparent",
                          }}
                        />
                      );
                    })}
                    <span style={{ fontSize: 10, color: "var(--tg2)", whiteSpace: "nowrap" }}>
                      {({ Beginner: "Beginner", Intermediate: "Mid", Advanced: "Expert" } as Record<string, string>)[row.level as string] ?? String(row.level ?? "")}
                    </span>
                  </div>
                  {/* Name input — CENTER (flex-1) */}
                  <label className="sr-only" htmlFor={`skill-name-${idx}`}>Skill name</label>
                  <input
                    id={`skill-name-${idx}`}
                    className="flex-1 min-w-0 px-2 py-1 text-sm [background:var(--sfr)] border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                    placeholder="Skill name"
                    value={row.name ?? ""}
                    onChange={(e) => updateRow(idx, { name: e.target.value })}
                  />
                  {/* Delete — RIGHT */}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="flex-shrink-0 p-1 rounded hover:[background:var(--erb)]"
                    aria-label={`Remove ${row.name || "skill"}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => (isSaving ? null : onClose())}
              className="px-3 py-2 rounded [background:var(--sf2)] disabled:opacity-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="px-3 py-2 rounded [background:var(--ac)] [color:var(--op)] hover:brightness-110 disabled:opacity-50 focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              disabled={isSaving || !canSave}
              aria-busy={isSaving}
            >
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SkillsModal;
