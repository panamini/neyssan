import React, { useEffect, useMemo, useState } from "react";
import type { ISkillItem, Level } from "../../types/cvDocument";
import { X, Plus, Trash2 } from "lucide-react";

interface SkillsModalProps {
  open: boolean;
  items: ISkillItem[];
  onClose: () => void;
  onSave: (next: ISkillItem[]) => void;
}

const LEVELS: Level[] = ["Beginner", "Elementary", "Intermediate", "Advanced", "Fluent"];

function newSkill(): ISkillItem {
  // Deliberately avoid uuid import here to keep modal self-contained; caller will reconcile ids on save if needed.
  const id = `sk-${Math.random().toString(36).slice(2, 10)}`;
  return { id, name: "", level: "Intermediate" };
}

export function SkillsModal({ open, items, onClose, onSave }: SkillsModalProps) {
  const [rows, setRows] = useState<ISkillItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    // Deep clone to avoid mutating props
    setRows(JSON.parse(JSON.stringify(items ?? [])) as ISkillItem[]);
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
      <div className="absolute inset-0 bg-black/40" onClick={() => (isSaving ? null : onClose())} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit skills"
        className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-lg shadow-lg overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold">Edit skills</h2>
          <button
            type="button"
            onClick={() => (isSaving ? null : onClose())}
            aria-label="Close"
            className="p-1 rounded hover:bg-neutral-100 dark:hover:bg-slate-800 disabled:opacity-50"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-neutral-600 dark:text-slate-400">Add, remove, or edit your skills and levels</div>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm text-[var(--foreground)] rounded bg-[var(--primary)] hover:opacity-90"
              aria-label="Add skill"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div className="space-y-2">
            {rows.length === 0 ? (
              <div className="px-3 py-2 text-sm rounded text-neutral-500 bg-neutral-50 dark:bg-slate-800">No skills yet. Add your first skill.</div>
            ) : (
              rows.map((row, idx) => (
                <div key={row.id ?? `row-${idx}`} className="grid items-center grid-cols-12 gap-2">
                  <div className="col-span-7">
                    <label className="text-xs sr-only text-neutral-500" htmlFor={`skill-name-${idx}`}>Skill name</label>
                    <input
                      id={`skill-name-${idx}`}
                      className="w-full px-2 py-1 text-sm bg-transparent border rounded"
                      placeholder="e.g., React"
                      value={row.name ?? ""}
                      onChange={(e) => updateRow(idx, { name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-4">
                    <label className="text-xs sr-only text-neutral-500" htmlFor={`skill-level-${idx}`}>Skill level</label>
                    <select
                      id={`skill-level-${idx}`}
                      className="w-full px-2 py-1 text-sm bg-transparent border rounded"
                      value={row.level}
                      onChange={(e) => updateRow(idx, { level: e.target.value as Level })}
                    >
                      {LEVELS.map((lvl) => (
                        <option key={lvl} value={lvl}>{lvl}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-end col-span-1">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900"
                      aria-label={`Remove ${row.name || "skill"}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => (isSaving ? null : onClose())}
              className="px-3 py-2 rounded bg-neutral-100 dark:bg-slate-800 disabled:opacity-50"
              disabled={isSaving}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              className="px-3 py-2 text-[var(--foreground)] rounded bg-[var(--primary)] disabled:opacity-50"
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