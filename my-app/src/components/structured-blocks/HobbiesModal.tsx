import React, { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Plus, X } from "@/lib/icons";

import type { IHobbyItem } from "../../types/cvDocument";
import { Button } from "../ui/button";
import { CvModalShell } from "./CvModalShell";

type HobbiesModalProps = {
  open: boolean;
  items: IHobbyItem[];
  initialItemId?: string;
  recoveryNotes?: string[];
  onDismissRecoveryNotes?: () => void;
  suggestedItems?: string[];
  onAcceptSuggestion?: (name: string) => void;
  onDismissSuggestion?: (name: string) => void;
  onClose: () => void;
  onSave: (next: IHobbyItem[]) => void;
};

function createHobbyItem(): IHobbyItem {
  return {
    id: `hobby-${Math.random().toString(36).slice(2, 10)}`,
    name: "",
  };
}

function normalizeHobbyName(value: string): string {
  return value.trim().toLocaleLowerCase();
}

function dedupeHobbyItems(items: IHobbyItem[]): IHobbyItem[] {
  const seen = new Set<string>();
  const next: IHobbyItem[] = [];

  items.forEach((item) => {
    const name = String(item.name ?? "").trim();
    const normalized = normalizeHobbyName(name);
    if (!normalized || seen.has(normalized)) {
      return;
    }
    seen.add(normalized);
    next.push({
      id: String(item.id ?? createHobbyItem().id),
      name,
    });
  });

  return next;
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    fromIndex >= items.length ||
    toIndex < 0 ||
    toIndex >= items.length ||
    fromIndex === toIndex
  ) {
    return items;
  }

  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function HobbiesModal({
  open,
  items,
  initialItemId,
  recoveryNotes = [],
  onDismissRecoveryNotes,
  suggestedItems = [],
  onAcceptSuggestion,
  onDismissSuggestion,
  onClose,
  onSave,
}: HobbiesModalProps) {
  const [rows, setRows] = useState<IHobbyItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});
  const lastSeedRef = useRef<string | null>(null);

  useEffect(() => {
    if (!open) return;

    try {
      const nextSeed = JSON.stringify(items ?? []);
      if (lastSeedRef.current === nextSeed) {
        return;
      }
      lastSeedRef.current = nextSeed;
      setRows(
        JSON.parse(nextSeed).map((item: IHobbyItem, index: number) => ({
          id: String(item?.id ?? `hobby-${index}`),
          name: String(item?.name ?? "").trim(),
        })) as IHobbyItem[],
      );
    } catch {
      setRows(
        (items ?? []).map((item, index) => ({
          id: String(item?.id ?? `hobby-${index}`),
          name: String(item?.name ?? "").trim(),
        })),
      );
    }
  }, [items, open]);

  useEffect(() => {
    if (!open || !initialItemId) return;

    window.setTimeout(() => {
      inputRefs.current[initialItemId]?.focus();
    }, 40);
  }, [initialItemId, open, rows]);

  const canSave = useMemo(
    () => rows.every((row) => String(row.name ?? "").trim().length > 0),
    [rows],
  );

  function updateRow(index: number, patch: Partial<IHobbyItem>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function handleAdd() {
    setRows((current) => [...current, createHobbyItem()]);
  }

  function handleRemove(index: number) {
    setRows((current) => current.filter((_, rowIndex) => rowIndex !== index));
  }

  function handleMove(index: number, direction: "up" | "down") {
    setRows((current) =>
      moveItem(current, index, direction === "up" ? index - 1 : index + 1),
    );
  }

  function handleAcceptSuggestion(name: string) {
    const cleanName = String(name ?? "").trim();
    if (!cleanName) return;

    setRows((current) => {
      const exists = current.some(
        (row) => normalizeHobbyName(String(row.name ?? "")) === normalizeHobbyName(cleanName),
      );
      if (exists) {
        return current;
      }

      return [
        ...current,
        {
          ...createHobbyItem(),
          name: cleanName,
        },
      ];
    });
    onAcceptSuggestion?.(cleanName);
  }

  async function handleSave() {
    setIsSaving(true);
    try {
      onSave(
        dedupeHobbyItems(
          rows.map((row) => ({
            id: String(row.id ?? createHobbyItem().id),
            name: String(row.name ?? "").trim(),
          })),
        ),
      );
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
        aria-label="Edit hobbies"
        className="dasti-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b [border-color:var(--color-border)]">
          <div>
            <h2 className="text-lg font-semibold">Edit hobbies</h2>
            <p className="text-sm [color:var(--tm2)]">
              Add, remove, reorder, and refine hobbies as lightweight tags.
            </p>
          </div>
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

          <div className="flex items-center justify-between gap-3">
            <p className="text-sm [color:var(--tm2)]">
              Keep this section to simple interests only. No levels or scoring.
            </p>
            <Button
              type="button"
              onClick={handleAdd}
              variant="ghost"
              size="sm"
              ariaLabel="Add hobby"
              className="gap-1"
            >
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>

          {suggestedItems.length > 0 ? (
            <div className="space-y-2">
              <div className="text-xs [color:var(--tg2)]">Suggested interests</div>
              <div className="flex flex-wrap gap-2">
                {suggestedItems.map((item) => (
                  <div
                    key={item}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2 py-1 text-xs"
                    style={{
                      borderStyle: "dashed",
                      borderColor: "var(--color-border-strong)",
                      background:
                        "color-mix(in srgb, var(--sf1) 88%, transparent)",
                      color: "var(--tm2)",
                    }}
                  >
                    <span style={{ color: "var(--ti)" }}>{item}</span>
                    <button
                      type="button"
                      onClick={() => handleAcceptSuggestion(item)}
                      className="dasti-icon-button dasti-icon-button--compact"
                      aria-label={`Add suggested hobby ${item}`}
                      title={`Add ${item}`}
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDismissSuggestion?.(item)}
                      className="dasti-icon-button dasti-icon-button--compact"
                      aria-label={`Dismiss suggested hobby ${item}`}
                      title={`Dismiss ${item}`}
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
              No hobbies yet. Add your first hobby.
            </div>
          ) : (
            <div className="space-y-2">
              {rows.map((row, index) => (
                <div
                  key={row.id ?? `row-${index}`}
                  className="group grid items-center gap-2"
                  style={{ gridTemplateColumns: "minmax(0, 1fr) auto" }}
                >
                  <label className="sr-only" htmlFor={`hobby-name-${index}`}>
                    Hobby name
                  </label>
                  <input
                    id={`hobby-name-${index}`}
                    ref={(node) => {
                      inputRefs.current[String(row.id ?? `row-${index}`)] = node;
                    }}
                    className="w-full min-w-0 px-2 py-1 text-sm [background:var(--sfr)] border border-[color:var(--color-border-strong)] rounded-[var(--radius-control)] focus:border-[color:var(--ti)] outline-none dasti-field-no-glow"
                    placeholder="Hobby name"
                    value={row.name ?? ""}
                    onChange={(event) =>
                      updateRow(index, { name: event.target.value })
                    }
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleMove(index, "up")}
                      className="dasti-icon-button dasti-icon-button--compact"
                      aria-label={`Move ${row.name || "hobby"} up`}
                      title="Move up"
                      disabled={index === 0}
                    >
                      <ArrowUp className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleMove(index, "down")}
                      className="dasti-icon-button dasti-icon-button--compact"
                      aria-label={`Move ${row.name || "hobby"} down`}
                      title="Move down"
                      disabled={index === rows.length - 1}
                    >
                      <ArrowDown className="w-3.5 h-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemove(index)}
                      className="dasti-modal-close flex-shrink-0 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity"
                      aria-label={`Remove ${row.name || "hobby"}`}
                      title={`Remove ${row.name || "hobby"}`}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSave()}
              disabled={isSaving || !canSave}
              ariaLabel="Save hobbies"
            >
              Save hobbies
            </Button>
          </div>
        </div>
      </div>
    </CvModalShell>
  );
}

export default HobbiesModal;
