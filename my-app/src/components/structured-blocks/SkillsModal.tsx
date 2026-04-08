import React, { useEffect, useMemo, useState } from "react";
import type { ISkillItem, Level } from "../../types/cvDocument";
import { X, Plus } from "@/lib/icons";
import { LEVELS } from "../ui/levelLabels";
import { Button } from "../ui/button";
import { CvModalShell } from "./CvModalShell";

interface SkillsModalProps {
  open: boolean;
  items: ISkillItem[];
  recoveryNotes?: string[];
  onDismissRecoveryNotes?: () => void;
  suggestedItems?: string[];
  onAcceptSuggestion?: (name: string) => void;
  onDismissSuggestion?: (name: string) => void;
  onClose: () => void;
  onSave: (next: ISkillItem[]) => void;
  title?: string;
  description?: string;
  emptyLabel?: string;
  itemLabel?: string;
  suggestionLabel?: string;
  saveLabel?: string;
}

function newSkill(): ISkillItem {
  // Deliberately avoid uuid import here to keep modal self-contained; caller will reconcile ids on save if needed.
  const id = `sk-${Math.random().toString(36).slice(2, 10)}`;
  return { id, name: "", level: "Intermediate" };
}

export function SkillsModal({
  open,
  items,
  recoveryNotes = [],
  onDismissRecoveryNotes,
  suggestedItems = [],
  onAcceptSuggestion,
  onDismissSuggestion,
  onClose,
  onSave,
  title = "Edit skills",
  description = "Add, remove, or edit your skills and levels",
  emptyLabel = "No skills yet. Add your first skill.",
  itemLabel = "skill",
  suggestionLabel = "Suggested from experience",
  saveLabel = "Save skills",
}: SkillsModalProps) {
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
    return rows.every(
      (r) =>
        typeof r.name === "string" &&
        r.name.trim().length > 0 &&
        LEVELS.includes(r.level),
    );
  }, [rows]);

  function updateRow(idx: number, patch: Partial<ISkillItem>) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function handleAdd() {
    setRows((prev) => [...prev, newSkill()]);
  }

  function handleRemove(idx: number) {
    setRows((prev) => prev.filter((_, i) => i !== idx));
  }

  function handleAcceptSuggestion(name: string) {
    const cleanName = String(name ?? "").trim();
    if (!cleanName) return;

    setRows((prev) => {
      const alreadyPresent = prev.some(
        (row) =>
          String(row.name ?? "")
            .trim()
            .toLocaleLowerCase() === cleanName.toLocaleLowerCase(),
      );
      if (alreadyPresent) {
        return prev;
      }
      return [...prev, { ...newSkill(), name: cleanName }];
    });
    onAcceptSuggestion?.(cleanName);
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
        aria-label={title}
        className="dasti-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b [border-color:var(--color-border)]">
          <h2 className="text-lg font-semibold">{title}</h2>
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
          {recoveryNotes.length > 0 ? (
            <div className="dasti-recovery-inline">
              <span className="dasti-recovery-inline__label">Recovered</span>
              <div className="dasti-recovery-inline__tokens">
                {recoveryNotes.map((note) => (
                  <span key={note} className="dasti-recovery-inline__token">
                    {note}
                  </span>
                ))}
              </div>
              {onDismissRecoveryNotes ? (
                <button
                  type="button"
                  className="dasti-recovery-inline__dismiss"
                  aria-label="Dismiss recovered notes"
                  onClick={onDismissRecoveryNotes}
                >
                  <X className="w-3 h-3" aria-hidden />
                </button>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <div className="text-sm [color:var(--tm2)]">
              {description}
            </div>
            <Button
              type="button"
              onClick={handleAdd}
              variant="ghost"
              size="sm"
              ariaLabel="Add skill"
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          <div className="space-y-2">
            {suggestedItems.length > 0 ? (
              <div className="space-y-2">
                <div className="text-xs [color:var(--tg2)]">
                  {suggestionLabel}
                </div>
                <div className="flex flex-wrap gap-2">
                  {suggestedItems.map((skill) => (
                    <div
                      key={skill}
                      className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs"
                      style={{
                        borderStyle: "dashed",
                        borderColor: "var(--color-border-strong)",
                        background:
                          "color-mix(in srgb, var(--sf1) 88%, transparent)",
                        color: "var(--tm2)",
                      }}
                    >
                      <span style={{ color: "var(--ti)" }}>{skill}</span>
                      <button
                        type="button"
                        onClick={() => handleAcceptSuggestion(skill)}
                        className="dasti-icon-button dasti-icon-button--compact"
                        aria-label={`Add suggested ${itemLabel} ${skill}`}
                        title={`Add ${skill}`}
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDismissSuggestion?.(skill)}
                        className="dasti-icon-button dasti-icon-button--compact"
                        aria-label={`Dismiss suggested ${itemLabel} ${skill}`}
                        title={`Dismiss ${skill}`}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
            {rows.length === 0 ? (
              <div className="px-3 py-2 text-sm rounded [color:var(--tg2)] [background:var(--sf1)]">
                {emptyLabel}
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
                    aria-label="Skill level"
                    style={{ width: 88 }}
                  >
                    {(["Beginner", "Intermediate", "Advanced"] as Level[]).map(
                      (lvl, di) => {
                        const activeIdx = [
                          "Beginner",
                          "Intermediate",
                          "Advanced",
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
                          Advanced: "Expert",
                        } as Record<string, string>
                      )[row.level as string] ?? String(row.level ?? "")}
                    </span>
                  </div>
                  {/* Name input — CENTER (flex-1) */}
                  <label className="sr-only" htmlFor={`skill-name-${idx}`}>
                    Skill name
                  </label>
                  <input
                    id={`skill-name-${idx}`}
                    className="flex-1 min-w-0 px-2 py-1 text-sm [background:var(--sfr)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-control)] focus:border-[color:var(--ac)] focus:[box-shadow:0_0_0_3px_var(--fr)] outline-none"
                    placeholder="Skill name"
                    value={row.name ?? ""}
                    onChange={(e) => updateRow(idx, { name: e.target.value })}
                  />
                  {/* Delete — RIGHT */}
                  <button
                    type="button"
                    onClick={() => handleRemove(idx)}
                    className="dasti-modal-close flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                    aria-label={`Remove ${row.name || itemLabel}`}
                    title={`Remove ${row.name || itemLabel}`}
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
              ariaLabel={saveLabel}
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </CvModalShell>
  );
}

export default SkillsModal;
