import React, { useEffect, useRef, useState } from "react";
import { useAction } from "convex/react";
import type { IAchievementItem } from "../../types/cvDocument";
import { api } from "../../../convex/_generated/api";
import { X, Plus, Loader2, Wand2 } from "@/lib/icons";
import { Button } from "../ui/button";
import { useToast } from "../ui/toast";
import { CvModalShell } from "./CvModalShell";
import { useCvAiCapabilities } from "../../hooks/use-cv-ai-capabilities";

interface AchievementsModalProps {
  open: boolean;
  items: IAchievementItem[];
  initialItemId?: string;
  appendBlankOnOpen?: boolean;
  onClose: () => void;
  onSave: (next: IAchievementItem[]) => void;
}

function newAchievement(): IAchievementItem {
  const id = `ach-${Math.random().toString(36).slice(2, 10)}`;
  return { id, text: "" };
}

const ACHIEVEMENT_TEXTAREA_MAX_HEIGHT = 132;

function AchievementAiDiffCard({
  before,
  after,
  onAccept,
  onDiscard,
}: {
  before: string;
  after: string;
  onAccept: () => void;
  onDiscard: () => void;
}) {
  return (
    <div className="dasti-achievements-modal__diff-card">
      <div className="dasti-achievements-modal__diff-label">
        Suggested rewrite
      </div>
      <div className="dasti-achievements-modal__diff-before">
        {before.trim() || "No existing content."}
      </div>
      <div className="dasti-achievements-modal__diff-after">{after.trim()}</div>
      <div className="dasti-achievements-modal__diff-actions">
        <button
          type="button"
          className="dasti-button dasti-button--accent dasti-button--sm"
          onClick={onAccept}
        >
          Accept
        </button>
        <button
          type="button"
          className="dasti-button dasti-button--secondary dasti-button--sm"
          onClick={onDiscard}
        >
          Discard
        </button>
      </div>
    </div>
  );
}

export function AchievementsModal({
  open,
  items,
  initialItemId,
  appendBlankOnOpen = false,
  onClose,
  onSave,
}: AchievementsModalProps) {
  const runCvSectionAiAction = useAction(
    (api.functions as any).runCvSectionAiAction,
  );
  const cvAiCapabilities = useCvAiCapabilities();
  const { showToast } = useToast();
  const [rows, setRows] = useState<IAchievementItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [savedTick, setSavedTick] = useState<string | null>(null);
  const [isClearConfirming, setIsClearConfirming] = useState(false);
  const [aiLoadingId, setAiLoadingId] = useState<string | null>(null);
  const [aiDiffs, setAiDiffs] = useState<
    Record<string, { before: string; after: string }>
  >({});
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});
  const handledInitialFocusRef = useRef<string | null>(null);
  const activeRowIdRef = useRef<string | null>(null);

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
      handledInitialFocusRef.current = null;
      setIsClearConfirming(false);
      setAiLoadingId(null);
      setAiDiffs({});
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

  React.useLayoutEffect(() => {
    if (!open) return;

    const activeRowId = activeRowIdRef.current;
    if (!activeRowId) return;

    const target = textareaRefs.current[activeRowId];
    if (!target || document.activeElement === target) {
      return;
    }

    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  }, [open, rows]);

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

  async function handleRunAchievementAi(idx: number) {
    if (!cvAiCapabilities.isSupported("improve_achievement_line")) {
      showToast("Achievement AI unavailable", {
        variant: "warning",
        description: cvAiCapabilities.staleMessage,
      });
      return;
    }

    const row = rows[idx];
    const rowId = String(row?.id ?? "");
    const currentText = String(row?.text ?? "").trim();
    if (!rowId || !currentText) return;

    try {
      setAiLoadingId(rowId);
      const result = await runCvSectionAiAction({
        action: "improve_achievement_line",
        existingText: currentText,
      });
      const nextText =
        result?.kind === "text" && typeof result.text === "string"
          ? result.text.trim()
          : "";
      if (!nextText) return;

      setAiDiffs((current) => ({
        ...current,
        [rowId]: {
          before: currentText,
          after: nextText,
        },
      }));
    } catch (error) {
      console.error(
        "[AchievementsModal] improve_achievement_line failed",
        error,
      );
      const rawMessage =
        error instanceof Error ? error.message : String(error ?? "");
      showToast("Achievement AI unavailable", {
        variant: "error",
        description: /ArgumentValidationError/i.test(rawMessage)
          ? "The CV AI backend schema is stale. Run `npx convex codegen` or restart `npx convex dev`, then reload the page."
          : "This achievement could not be improved right now.",
      });
    } finally {
      setAiLoadingId(null);
    }
  }

  function handleAcceptAiDiff(rowId: string) {
    const diff = aiDiffs[rowId];
    if (!diff) return;
    setRows((prev) =>
      prev.map((row) =>
        String(row.id ?? "") === rowId ? { ...row, text: diff.after } : row,
      ),
    );
    setAiDiffs((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
    window.requestAnimationFrame(() => {
      syncTextareaHeight(rowId);
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
    <CvModalShell
      open={open}
      onClose={onClose}
      onBackdropClick={() => (isSaving ? undefined : onClose())}
    >
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
            {cvAiCapabilities.status === "stale" &&
            !cvAiCapabilities.isSupported("improve_achievement_line") ? (
              <div className="dasti-hint" role="status">
                {cvAiCapabilities.staleMessage}
              </div>
            ) : null}

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
                        if (
                          !node ||
                          !open ||
                          !initialItemId ||
                          rowId !== String(initialItemId) ||
                          handledInitialFocusRef.current === rowId
                        ) {
                          return;
                        }

                        window.setTimeout(() => {
                          if (handledInitialFocusRef.current === rowId) {
                            return;
                          }

                          handledInitialFocusRef.current = rowId;
                          node.focus();
                        }, 0);
                      }}
                      id={`achievement-text-${idx}`}
                      className="dasti-field dasti-achievements-modal__textarea"
                      placeholder="Reduced stock loss by 15% through tighter floor controls."
                      value={rowText}
                      rows={1}
                      onFocus={() => {
                        activeRowIdRef.current = rowId;
                      }}
                      onChange={(e) => {
                        activeRowIdRef.current = rowId;
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
                        className="dasti-icon-button dasti-achievements-modal__ai-action"
                        onClick={() => void handleRunAchievementAi(idx)}
                        disabled={
                          !cvAiCapabilities.isSupported(
                            "improve_achievement_line",
                          ) ||
                          aiLoadingId === rowId ||
                          rowText.trim().length === 0
                        }
                        aria-label="Improve achievement with AI"
                        data-toolbar-tooltip="Improve"
                      >
                        {aiLoadingId === rowId ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Wand2 className="w-3.5 h-3.5" />
                        )}
                      </button>

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

                  {aiDiffs[rowId] ? (
                    <AchievementAiDiffCard
                      before={aiDiffs[rowId].before}
                      after={aiDiffs[rowId].after}
                      onAccept={() => handleAcceptAiDiff(rowId)}
                      onDiscard={() =>
                        setAiDiffs((current) => {
                          const next = { ...current };
                          delete next[rowId];
                          return next;
                        })
                      }
                    />
                  ) : null}
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
    </CvModalShell>
  );
}

export default AchievementsModal;
