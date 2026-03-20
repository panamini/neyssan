import React, { useEffect, useMemo, useRef, useState } from "react";
import type { IAchievementItem } from "../../types/cvDocument";
import { X, Plus, Check } from "lucide-react";

interface AchievementsModalProps {
  open: boolean;
  items: IAchievementItem[];
  appendBlankOnOpen?: boolean;
  onClose: () => void;
  onSave: (next: IAchievementItem[]) => void;
}

function newAchievement(): IAchievementItem {
  const id = `ach-${Math.random().toString(36).slice(2, 10)}`;
  return { id, text: "" };
}

export function AchievementsModal({ open, items, appendBlankOnOpen = false, onClose, onSave }: AchievementsModalProps) {
  const [rows, setRows] = useState<IAchievementItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedTick, setSavedTick] = useState<string | null>(null);

  // Focus restore: remember the element that opened the modal and restore focus to it on close
  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      try {
        openerRef.current = (document.activeElement as HTMLElement | null) ?? null;
      } catch {
        openerRef.current = null;
      }
    }
  }, [open]);

  // Seed rows only when the modal opens or when the real items content changes
  const lastSeedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      lastSeedRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    try {
      const nextSeedKey = JSON.stringify({ items: items ?? [], appendBlankOnOpen });
      if (lastSeedRef.current === nextSeedKey) return;
      lastSeedRef.current = nextSeedKey;

      const baseRows = JSON.parse(JSON.stringify(items ?? [])) as IAchievementItem[];
      const nextRows = baseRows.length > 0 ? baseRows : [newAchievement()];
      let focusIndex = baseRows.length > 0 ? -1 : 0;

      if (appendBlankOnOpen) {
        nextRows.push(newAchievement());
        focusIndex = nextRows.length - 1;
      }

      setRows(nextRows);

      if (focusIndex >= 0) {
        window.setTimeout(() => {
          try {
            const el = document.getElementById(`achievement-text-${focusIndex}`) as HTMLInputElement | null;
            el?.focus();
          } catch {
            /* noop */
          }
        }, 50);
      }
    } catch {
      const fallbackRows = items && items.length > 0 ? [...items] : [newAchievement()];
      if (appendBlankOnOpen) {
        fallbackRows.push(newAchievement());
      }
      setRows(fallbackRows);
    }
  }, [open, items, appendBlankOnOpen]);


  if (!open) return null;

  function updateRow(idx: number, patch: Partial<IAchievementItem>, tick?: boolean) {
    setRows((prev) => {
      const next = prev.map((r, i) => (i === idx ? { ...r, ...patch } : r));
      if (tick) {
        const id = String(next[idx]?.id ?? idx);
        setSavedTick(id);
        window.setTimeout(() => setSavedTick((s) => (s === id ? null : s)), 1000);
      }
      return next;
    });
  }

  function handleAdd() {
    setRows((prev) => {
      const next = [...prev, newAchievement()];
      // Focus the newly created input after React renders it.
      setTimeout(() => {
        try {
          const el = document.getElementById(`achievement-text-${next.length - 1}`) as HTMLInputElement | null;
          el?.focus();
        } catch {
          /* noop */
        }
      }, 30);
      return next;
    });
  }

  function handleRemove(idx: number) {
    setRows((prev) => {
      const next = prev.filter((_, i) => i !== idx);
      if (next.length === 0) {
        window.setTimeout(() => {
          try {
            const el = document.getElementById("achievement-text-0") as HTMLInputElement | null;
            el?.focus();
          } catch {
            /* noop */
          }
        }, 30);
        return [newAchievement()];
      }
      return next;
    });
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      // Trim and drop empty rows on save (user expects empty inputs to be ignored)
      const next = rows
        .map((r) => ({ ...r, text: String(r.text ?? "").trim() }))
        .filter((r) => r.text.length > 0);
      onSave(next);
    } finally {
      setIsSaving(false);
      try {
        onClose();
      } finally {
        // restore focus to opener
        try {
          openerRef.current?.focus();
        } catch {
          /* noop */
        }
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
      onMouseDownCapture={(e) => e.stopPropagation()}
    >
      <div
        className="absolute inset-0 backdrop-blur-[8px]"
        onClick={() => (isSaving ? null : onClose())}
        aria-hidden
        style={{ background: 'hsla(30,12%,11%,.32)', backdropFilter: 'blur(8px)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit achievements"
        className="relative w-full max-w-2xl [background:var(--sfr)] border border-[color:var(--bm)] [border-radius:var(--rl)] [box-shadow:var(--shc)] overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-bo">
          <h2 className="text-lg font-semibold">Edit achievements</h2>
          <button
            type="button"
            onClick={() => (isSaving ? null : onClose())}
            aria-label="Close"
            className="dasti-modal-close disabled:opacity-50"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm [color:var(--tm2)]">
              Add, remove, or edit achievements (bullets or short sentences)
            </div>
            <button
              type="button"
              onClick={handleAdd}
              className="dasti-modal-close"
              aria-label="Add achievement"
              title="Add achievement"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          <div className="space-y-2">
            {rows.length === 0 ? (
              <div className="px-3 py-2 text-sm rounded [color:var(--tg2)] [background:var(--sf1)]">
                No achievements yet. Add your first item.
              </div>
            ) : (
              rows.map((row, idx) => (
                <div
                  key={row.id ?? `row-${idx}`}
                  className="group grid items-start gap-2"
                  style={{ gridTemplateColumns: "minmax(0, 1fr) var(--hs)" }}
                >
                  <div className="min-w-0">
                    <label className="text-xs sr-only [color:var(--tg2)]" htmlFor={`achievement-text-${idx}`}>
                      Achievement text
                    </label>
                    <input
                      id={`achievement-text-${idx}`}
                      className="w-full px-2 py-1 text-sm [background:var(--sfr)] border border-[color:var(--bm)] rounded-[var(--rs)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                      placeholder="e.g., Increased conversion rate by 15% in Q2"
                      value={row.text ?? ""}
                      onChange={(e) => updateRow(idx, { text: e.target.value })}
                      onBlur={() => updateRow(idx, {}, true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          updateRow(idx, {}, true);
                          const next = document.getElementById(`achievement-text-${idx + 1}`) as HTMLInputElement | null;
                          next?.focus();
                        }
                      }}
                    />
                    <div
                      className={[
                        "flex items-center gap-1 mt-1 text-xs transition-opacity",
                        savedTick && String(savedTick) === String(row.id ?? idx) ? "opacity-100" : "opacity-0",
                      ].join(" ")}
                      aria-live="polite"
                    >
                      <Check className="w-3 h-3" /> Saved
                    </div>
                  </div>
                  <div className="flex items-start justify-end">
                    <button
                      type="button"
                      onClick={() => handleRemove(idx)}
                      className="dasti-modal-close opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                      aria-label={`Remove achievement ${idx + 1}`}
                      title={`Remove achievement ${idx + 1}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={() => void handleSave()}
              className="px-3 py-2 rounded [background:var(--ac)] [color:var(--op)] hover:brightness-110 disabled:opacity-50 focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
              disabled={isSaving}
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

export default AchievementsModal;
