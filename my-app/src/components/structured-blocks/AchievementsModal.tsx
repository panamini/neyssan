import React, { useEffect, useRef, useState } from "react";
import type { IAchievementItem } from "../../types/cvDocument";
import { X, Plus } from "@/lib/icons";
import { Button } from "../ui/button";
import { useCloseOnEscape } from "../../hooks/use-close-on-escape";
import { BodyPortal } from "@/components/ui/body-portal";

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

const ACHIEVEMENT_TEXTAREA_MAX_HEIGHT = 132;

export function AchievementsModal({
  open,
  items,
  appendBlankOnOpen = false,
  onClose,
  onSave,
}: AchievementsModalProps) {
  const [rows, setRows] = useState<IAchievementItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedTick, setSavedTick] = useState<string | null>(null);
  const [isClearConfirming, setIsClearConfirming] = useState(false);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  useCloseOnEscape({ open, onClose, disabled: isSaving });

  const openerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (open) {
      try {
        openerRef.current =
          (document.activeElement as HTMLElement | null) ?? null;
      } catch {
        openerRef.current = null;
      }
    }
  }, [open]);

  const lastSeedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!open) {
      lastSeedRef.current = null;
      setIsClearConfirming(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    try {
      const nextSeedKey = JSON.stringify({
        items: items ?? [],
        appendBlankOnOpen,
      });
      if (lastSeedRef.current === nextSeedKey) return;
      lastSeedRef.current = nextSeedKey;

      const baseRows = JSON.parse(
        JSON.stringify(items ?? []),
      ) as IAchievementItem[];
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
            const el = document.getElementById(
              `achievement-text-${focusIndex}`,
            ) as HTMLTextAreaElement | null;
            el?.focus();
          } catch {
            /* noop */
          }
        }, 50);
      }
    } catch {
      const fallbackRows =
        items && items.length > 0 ? [...items] : [newAchievement()];
      if (appendBlankOnOpen) {
        fallbackRows.push(newAchievement());
      }
      setRows(fallbackRows);
    }
  }, [open, items, appendBlankOnOpen]);

  const syncTextareaHeight = React.useCallback((rowId: string) => {
    const node = textareaRefs.current[rowId];
    if (!node) return;
    node.style.height = "0px";
    const nextHeight = Math.min(
      Math.max(node.scrollHeight, 42),
      ACHIEVEMENT_TEXTAREA_MAX_HEIGHT,
    );
    node.style.height = `${nextHeight}px`;
    node.style.overflowY =
      node.scrollHeight > ACHIEVEMENT_TEXTAREA_MAX_HEIGHT ? "auto" : "hidden";
  }, []);

  React.useLayoutEffect(() => {
    if (!open) return;
    rows.forEach((row, idx) => {
      syncTextareaHeight(String(row.id ?? idx));
    });
  }, [open, rows, syncTextareaHeight]);

  if (!open) return null;

  function updateRow(
    idx: number,
    patch: Partial<IAchievementItem>,
    tick?: boolean,
  ) {
    setRows((prev) => {
      const next = prev.map((row, rowIdx) =>
        rowIdx === idx ? { ...row, ...patch } : row,
      );
      if (tick) {
        const id = String(next[idx]?.id ?? idx);
        setSavedTick(id);
        window.setTimeout(
          () => setSavedTick((current) => (current === id ? null : current)),
          1000,
        );
      }
      return next;
    });
  }

  function handleAdd() {
    setRows((prev) => {
      const next = [...prev, newAchievement()];
      window.setTimeout(() => {
        try {
          const el = document.getElementById(
            `achievement-text-${next.length - 1}`,
          ) as HTMLTextAreaElement | null;
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
      const next = prev.filter((_, rowIdx) => rowIdx !== idx);
      if (next.length === 0) {
        window.setTimeout(() => {
          try {
            const el = document.getElementById(
              "achievement-text-0",
            ) as HTMLTextAreaElement | null;
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
      const next = rows
        .map((row) => ({ ...row, text: String(row.text ?? "").trim() }))
        .filter((row) => row.text.length > 0);
      onSave(next);
    } finally {
      setIsSaving(false);
      try {
        onClose();
      } finally {
        try {
          openerRef.current?.focus();
        } catch {
          /* noop */
        }
      }
    }
  }

  function handleClear() {
    setRows([newAchievement()]);
    setIsClearConfirming(false);
    onSave([]);
    onClose();
  }

  return (
    <BodyPortal>
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center p-4"
        onMouseDownCapture={(e) => e.stopPropagation()}
      >
        <div
          className="absolute inset-0 backdrop-blur-[8px]"
          onClick={() => (isSaving ? null : onClose())}
          aria-hidden
          style={{
            background: "hsla(30,12%,11%,.32)",
            backdropFilter: "blur(8px)",
          }}
        />
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Edit achievements"
          className="dasti-modal dasti-achievements-modal"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="dasti-modal-header dasti-achievements-modal__header">
            <div className="dasti-modal-heading">
              <h2 className="dasti-modal-title dasti-achievements-modal__title">
                Edit achievements
              </h2>
              <p className="dasti-modal-subtitle dasti-achievements-modal__subtitle">
                Outcome-led lines for measurable wins
              </p>
            </div>
            <div className="dasti-achievements-modal__toolbar">
              <Button
                type="button"
                variant="secondary"
                onClick={handleAdd}
                ariaLabel="Add achievement"
              >
                <Plus className="w-4 h-4" />
                Add achievement
              </Button>
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
          </div>

          <div className="dasti-modal-body dasti-achievements-modal__body">
            <div className="dasti-achievements-modal__list">
              {rows.map((row, idx) => {
                const rowId = String(row.id ?? idx);
                const rowText = String(row.text ?? "");

                return (
                  <article
                    key={row.id ?? `row-${idx}`}
                    className={[
                      "dasti-achievements-modal__entry",
                      savedTick === rowId
                        ? "dasti-achievements-modal__entry--saved"
                        : "",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <div className="dasti-achievements-modal__entry-main">
                      <label
                        className="sr-only"
                        htmlFor={`achievement-text-${idx}`}
                      >
                        Achievement {idx + 1}
                      </label>
                      <textarea
                        ref={(node) => {
                          textareaRefs.current[rowId] = node;
                        }}
                        id={`achievement-text-${idx}`}
                        className="dasti-field dasti-achievements-modal__textarea"
                        placeholder="Reduced stock loss by 15% through tighter floor controls."
                        value={rowText}
                        rows={1}
                        onChange={(e) => {
                          updateRow(idx, { text: e.target.value });
                          window.requestAnimationFrame(() => {
                            syncTextareaHeight(rowId);
                          });
                        }}
                        onBlur={() => updateRow(idx, {}, true)}
                        style={{
                          resize: "none",
                          whiteSpace: "pre-wrap",
                        }}
                      />

                      <div className="dasti-achievements-modal__entry-actions">
                        <button
                          type="button"
                          onClick={() => handleRemove(idx)}
                          className="dasti-icon-button dasti-achievements-modal__remove"
                          aria-label={`Remove achievement ${idx + 1}`}
                          data-toolbar-tooltip="Delete"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>

          <div className="dasti-modal-footer dasti-achievements-modal__footer">
            <div className="dasti-modal-actions">
              {isClearConfirming ? (
                <span className="sb-doc-confirm" style={{ gap: "var(--s2)" }}>
                  <span
                    className="sb-doc-confirm__label"
                    style={{ fontSize: "var(--tx)" }}
                  >
                    Clear all?
                  </span>
                      <button
                        type="button"
                        className="sb-doc-confirm__yes"
                        onClick={handleClear}
                      >
                        Clear
                      </button>
                  <button
                    type="button"
                    className="sb-doc-confirm__no"
                    onClick={() => setIsClearConfirming(false)}
                  >
                    Cancel
                  </button>
                </span>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsClearConfirming(true)}
                  disabled={isSaving}
                >
                  Clear all
                </Button>
              )}
              <Button
                type="button"
                variant="primary"
                onClick={() => void handleSave()}
                disabled={isSaving}
                ariaLabel="Save achievements"
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      </div>
    </BodyPortal>
  );
}

export default AchievementsModal;
