import React, { useEffect, useMemo, useRef, useState } from "react";
import type { ILanguageItem, Level } from "../../types/cvDocument";
import { X, Plus } from "@/lib/icons";
import { Button } from "../ui/button";
import { CvModalShell } from "./CvModalShell";

interface LanguagesModalProps {
  open: boolean;
  items: ILanguageItem[];
  initialItemId?: string;
  onClose: () => void;
  onSave: (next: ILanguageItem[]) => void;
}

const LEVELS: Level[] = [
  "Beginner",
  "Elementary",
  "Intermediate",
  "Advanced",
  "Fluent",
];

function newLanguage(): ILanguageItem {
  const id = `lang-${Math.random().toString(36).slice(2, 10)}`;
  return { id, name: "", level: "Intermediate" };
}

export function LanguagesModal({
  open,
  items,
  initialItemId,
  onClose,
  onSave,
}: LanguagesModalProps) {
  const [rows, setRows] = useState<ILanguageItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  useEffect(() => {
    if (!open || !initialItemId) return;

    window.setTimeout(() => {
      inputRefs.current[initialItemId]?.focus();
    }, 40);
  }, [initialItemId, open, rows]);

  const canSave = useMemo(() => {
    return rows.every(
      (r) =>
        typeof r.name === "string" &&
        r.name.trim().length > 0 &&
        LEVELS.includes(r.level),
    );
  }, [rows]);

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
    <CvModalShell
      open={open}
      onClose={onClose}
      onBackdropClick={() => (isSaving ? undefined : onClose())}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit languages"
        className="dasti-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b [border-color:var(--color-border)]">
          <h2 className="text-lg font-semibold">Edit languages</h2>
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
              Add, remove, or edit languages and proficiency
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              variant="ghost"
              size="sm"
              ariaLabel="Add language"
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {rows.length === 0 ? (
              <div className="px-3 py-2 text-sm rounded [color:var(--tg2)] [background:var(--sf1)]">
                No languages yet. Add your first language.
              </div>
            ) : (
              rows.map((row, idx) => (
                <div
                  key={row.id ?? `row-${idx}`}
                  className="group flex items-center gap-2"
                >
                  {/* Level dots — LEFT */}
                  <div
                    className="flex items-center gap-1.5 flex-shrink-0"
                    role="group"
                    aria-label="Language level"
                    style={{ width: 88 }}
                  >
                    {(["Beginner", "Intermediate", "Fluent"] as Level[]).map(
                      (lvl, di) => {
                        const activeIdx = [
                          "Beginner",
                          "Intermediate",
                          "Fluent",
                        ].indexOf(row.level as string);
                        const filled = di <= activeIdx;
                        return (
                          <button
                            key={lvl}
                            type="button"
                            title={lvl}
                            aria-label={lvl}
                            onClick={() => updateRow(idx, { level: lvl })}
                            style={{
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              padding: 0,
                              cursor: "pointer",
                              flexShrink: 0,
                              border: "1.5px solid",
                              borderColor: filled
                                ? "var(--ac)"
                                : "var(--color-border-strong)",
                              background: filled ? "var(--ac)" : "transparent",
                            }}
                          />
                        );
                      },
                    )}
                    <span
                      style={{
                        fontSize: 10,
                        color: "var(--tg2)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {(
                        {
                          Beginner: "Beginner",
                          Intermediate: "Mid",
                          Fluent: "Fluent",
                        } as Record<string, string>
                      )[row.level as string] ?? String(row.level ?? "")}
                    </span>
                  </div>
                  {/* Name input — CENTER (flex-1) */}
                  <label className="sr-only" htmlFor={`language-name-${idx}`}>
                    Language name
                  </label>
                  <input
                    id={`language-name-${idx}`}
                    ref={(node) => {
                      inputRefs.current[String(row.id ?? `row-${idx}`)] = node;
                    }}
                    className="flex-1 min-w-0 px-2 py-1 text-sm [background:var(--sfr)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow"
                    placeholder="Language name"
                    value={row.name ?? ""}
                    onChange={(e) => updateRow(idx, { name: e.target.value })}
                  />
                  {/* Delete — RIGHT */}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="dasti-modal-close flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                    aria-label={`Remove ${row.name || "language"}`}
                    title={`Remove ${row.name || "language"}`}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSave()}
              disabled={isSaving || !canSave}
              ariaLabel="Save languages"
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </CvModalShell>
  );
}

export default LanguagesModal;
