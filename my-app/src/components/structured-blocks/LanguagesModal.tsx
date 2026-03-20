import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ILanguageItem, Level } from "../../types/cvDocument";
import { X, Plus, Trash2 } from "lucide-react";

interface LanguagesModalProps {
  open: boolean;
  items: ILanguageItem[];
  onClose: () => void;
  onSave: (next: ILanguageItem[]) => void;
}

const LEVELS: Level[] = ["Beginner", "Elementary", "Intermediate", "Advanced", "Fluent"];

function newLanguage(): ILanguageItem {
  const id = `lang-${Math.random().toString(36).slice(2, 10)}`;
  return { id, name: "", level: "Intermediate" };
}

export function LanguagesModal({ open, items, onClose, onSave }: LanguagesModalProps) {
  const [rows, setRows] = useState<ILanguageItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Seed rows only when the modal opens or when the real items content changes.
  // Prevents resetting the input on each parent render (which caused single-character typing).
  const lastSeedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) return;
    try {
      const nextStr = JSON.stringify(items ?? []);
      if (lastSeedRef.current === nextStr) return;
      lastSeedRef.current = nextStr;
      setRows(JSON.parse(nextStr) as ILanguageItem[]);
    } catch {
      // Fallback to safe clone on failure
      setRows(JSON.parse(JSON.stringify(items ?? [])) as ILanguageItem[]);
    }
  }, [open, items]);

  const canSave = useMemo(() => {
    return rows.every((r) => typeof r.name === "string" && r.name.trim().length > 0 && LEVELS.includes(r.level));
  }, [rows]);

  if (!open) return null;

  function updateRow(idx: number, patch: Partial<ILanguageItem>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function handleAdd() {
    setRows((prev) => [...prev, newLanguage()]);
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
        aria-label="Edit languages"
        className="relative w-full max-w-2xl [background:var(--sfr)] border border-[color:var(--bm)] [border-radius:var(--rl)] [box-shadow:var(--shc)] overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-bo">
          <h2 className="text-lg font-semibold">Edit languages</h2>
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
            <div className="text-sm [color:var(--tm2)]">Add, remove, or edit languages and proficiency</div>
            <button
              type="button"
              onClick={handleAdd}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm rounded [background:var(--ac)] [color:var(--op)] hover:brightness-110 focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              aria-label="Add language"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>

          <div className="space-y-2">
            {rows.length === 0 ? (
              <div className="px-3 py-2 text-sm rounded [color:var(--tg2)] [background:var(--sf1)]">No languages yet. Add your first language.</div>
            ) : (
              rows.map((row, idx) => (
                <div key={row.id ?? `row-${idx}`} className="grid items-center grid-cols-12 gap-2">
                  <div className="col-span-5">
                    <label className="text-xs sr-only [color:var(--tg2)]" htmlFor={`language-name-${idx}`}>Language name</label>
                    <input
                      id={`language-name-${idx}`}
                      className="w-full px-2 py-1 text-sm [background:var(--sfr)] border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                      placeholder="e.g., English"
                      value={row.name ?? ""}
                      onChange={(e) => updateRow(idx, { name: e.target.value })}
                    />
                  </div>
                  <div className="col-span-6 flex items-center gap-1.5" role="group" aria-label="Language level">
                    {(["Beginner", "Intermediate", "Fluent"] as Level[]).map((lvl, di) => {
                      const activeIdx = ["Beginner", "Intermediate", "Fluent"].indexOf(row.level as string);
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
                    <span style={{ fontSize: 10, color: "var(--tg2)", marginLeft: 2 }}>
                      {String(row.level ?? "")}
                    </span>
                  </div>
                  <div className="flex items-center justify-end col-span-1">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="p-1 rounded hover:[background:var(--erb)]"
                      aria-label={`Remove ${row.name || "language"}`}
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

export default LanguagesModal;