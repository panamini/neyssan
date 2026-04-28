import React, { useEffect, useMemo, useRef, useState } from "react";
import { useAction } from "convex/react";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import {
  BoldExtension,
  ItalicExtension,
  UnderlineExtension,
  BulletListExtension,
  OrderedListExtension,
  ListItemExtension,
  ParagraphExtension,
  HistoryExtension,
  HardBreakExtension,
  PlaceholderExtension,
} from "remirror/extensions";
import type { RemirrorJSON } from "remirror";
import type { ISummaryItem } from "../../types/cvDocument";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import { api } from "../../../convex/_generated/api";
import { EditorToolbar } from "../remirror-editor/components/EditorToolbar";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { X } from "@/lib/icons";
import { TextSelection } from "prosemirror-state";
import { docToPlainText } from "../remirror-editor/utils/text";
import { Button } from "../ui/button";
import { CvModalShell } from "./CvModalShell";
import FloatingAiToolbar, { type InlineAiActionId } from "../FloatingAiToolbar";
import AiSuggestionCard from "../ai/AiSuggestionCard";
import {
  createAiUndoSnapshot,
  normalizeEditorAiTextResult,
  restoreAiUndoSnapshot,
  type AiUndoSnapshot,
} from "../../lib/ai/applyAiSuggestion";
import {
  createAiInteractionId,
  recordAiInteractionEvent,
} from "../../lib/ai/aiInteractionTelemetry";
import type { AiApplyMode, AiOutputMode } from "../../lib/ai/interactionRulebook";
import {
  getDomSelectionState,
  isInlineAiToolbarActiveElement,
  isPrimaryPointerPressed,
} from "../../lib/editor-ai-selection";

interface SummaryModalProps {
  open: boolean;
  sectionId: string;
  item: ISummaryItem | null;
  recoveryNotes?: string[];
  onDismissRecoveryNotes?: () => void;
  onClose: () => void;
}

type InlineAiSuggestionState = {
  actionId: InlineAiActionId;
  actionLabel: string;
  interactionId: string;
  applyMode: AiApplyMode;
  outputMode: AiOutputMode;
  beforeText: string;
  afterText: string;
  from: number;
  to: number;
  status: "preview" | "accepted";
  undoSnapshot?: AiUndoSnapshot<RemirrorJSON>;
};

export function SummaryModal({
  open,
  sectionId,
  item,
  recoveryNotes = [],
  onDismissRecoveryNotes,
  onClose,
}: SummaryModalProps) {
  const { updateStructuredItem } = useCvLibrary();
  const transformEditorSelectionAction = useAction(
    (api.functions as any).transformEditorSelection,
  );
  const [isSaving, setIsSaving] = useState(false);
  const [isClearConfirming, setIsClearConfirming] = useState(false);
  const [inlineSelectionState, setInlineSelectionState] = useState<{
    text: string;
    anchor: { left: number; top: number; bottom: number };
    from: number;
    to: number;
  } | null>(null);
  const [isApplyingInlineAi, setIsApplyingInlineAi] = useState(false);
  const [pendingInlineAiActionId, setPendingInlineAiActionId] =
    useState<InlineAiActionId | null>(null);
  const [inlineAiSuggestion, setInlineAiSuggestion] =
    useState<InlineAiSuggestionState | null>(null);
  const selectionDebounceRef = useRef<number | null>(null);

  // Initialize Remirror doc once when opened
  // Treat UI placeholder docs as empty so clicking "Start typing here" opens a blank editor.
  function normalizePlaceholder(s: string): string {
    return s
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[.,…!?:\-]/g, "")
      .trim();
  }
  const PLACEHOLDER_BASES = ["start typing here", "start typing"] as const;
  function isPlaceholderString(s: string): boolean {
    const norm = normalizePlaceholder(s);
    // Fast exact/startswith checks for common cases
    for (const base of PLACEHOLDER_BASES) {
      if (norm === base) return true;
      if (norm.startsWith(base) && norm.length <= base.length + 10) return true;
      if (norm.includes(base)) return true;
    }
    // Match cases where the words appear in order but with stray characters (e.g. "start typing hereE..")
    try {
      const wordRegex = /\bstart\b.*\btyping\b.*\bhere\b/;
      if (wordRegex.test(norm)) return true;
    } catch {
      /* noop */
    }
    return false;
  }
  function isPlaceholderDoc(doc: RemirrorJSON): boolean {
    try {
      const t = String(docToPlainText(doc) || "");
      return isPlaceholderString(t);
    } catch {
      return false;
    }
  }
  /**
   * Safely extract plain text from a node (defensive).
   * Works with Remirror/ProseMirror json node shapes.
   */
  function getNodePlainText(node: any): string {
    if (!node) return "";
    if (node.type === "text") return String(node.text ?? "");
    if (!Array.isArray(node.content)) return "";
    return node.content.map((c: any) => getNodePlainText(c)).join(" ");
  }

  /**
   * Deep-sanitize a RemirrorJSON document by removing nodes that
   * consist solely of placeholder-like text. This prevents legacy
   * stored placeholder strings from appearing as editable content.
   */
  function deepSanitize(raw: unknown): RemirrorJSON {
    const doc = ensureRemirrorDoc(raw as any);
    try {
      const content = Array.isArray((doc as any).content)
        ? (doc as any).content
        : [];
      const filtered = content.filter((node: any) => {
        try {
          const txt = String(getNodePlainText(node) || "")
            .replace(/\s+/g, " ")
            .trim();
          return !isPlaceholderString(txt);
        } catch {
          return true;
        }
      });
      if (filtered.length === 0) return ensureRemirrorDoc(undefined as any);
      return { ...doc, content: filtered } as RemirrorJSON;
    } catch {
      return ensureRemirrorDoc(undefined as any);
    }
  }

  function sanitizeInitial(raw: unknown): RemirrorJSON {
    return deepSanitize(raw);
  }

  function sanitizeDocForPersist(doc: RemirrorJSON): RemirrorJSON {
    return deepSanitize(doc);
  }

  const initialDocRef = useRef<RemirrorJSON>(sanitizeInitial(item?.summary));
  useEffect(() => {
    if (!open) return;
    initialDocRef.current = sanitizeInitial(item?.summary);
    setIsClearConfirming(false);
  }, [open, item?.summary]);

  const extensions = useMemo(
    () => [
      new ParagraphExtension(),
      new HistoryExtension({}),
      new HardBreakExtension({}),
      new BoldExtension({}),
      new ItalicExtension({}),
      new UnderlineExtension({}),
      new BulletListExtension({}),
      new OrderedListExtension({}),
      new ListItemExtension({}),
      // Use Remirror's built-in placeholder extension so placeholder text is never editable content.
      new PlaceholderExtension({ placeholder: "Start typing here..." }),
    ],
    [],
  );
  const { manager, state, onChange } = useRemirror({
    extensions: () => extensions as any,
    content: initialDocRef.current as any,
    onError: () => initialDocRef.current as any,
  });

  // No UI overlay state required — PlaceholderExtension provides the native placeholder behavior.

  // Forward Remirror onChange — no overlay state management needed.
  const baseOnChange = onChange;
  const handleChange = React.useCallback(
    (param: unknown) => {
      baseOnChange(param as any);
    },
    [baseOnChange],
  );

  useEffect(() => {
    if (!open) {
      setInlineSelectionState(null);
      setInlineAiSuggestion(null);
    }
  }, [open]);

  useEffect(() => {
    return () => {
      if (selectionDebounceRef.current !== null) {
        window.clearTimeout(selectionDebounceRef.current);
      }
    };
  }, []);

  const runSelectionCheck = React.useCallback(() => {
    if (isPrimaryPointerPressed()) {
      return;
    }
    const view = (manager as any)?.view;
    const selection = view?.state?.selection;
    const nextSelection = getDomSelectionState(
      view?.dom as HTMLElement | null,
    );

    if (!nextSelection || !selection || selection.empty) {
      if (isInlineAiToolbarActiveElement()) {
        return;
      }
      setInlineSelectionState(null);
      return;
    }

    setInlineSelectionState({
      ...nextSelection,
      from: selection.from,
      to: selection.to,
    });
  }, [manager]);

  const scheduleSelectionCheck = React.useCallback((immediate = false) => {
    if (selectionDebounceRef.current !== null) {
      window.clearTimeout(selectionDebounceRef.current);
    }

    if (immediate) {
      runSelectionCheck();
      return;
    }

    selectionDebounceRef.current = window.setTimeout(() => {
      selectionDebounceRef.current = null;
      runSelectionCheck();
    }, 90);
  }, [runSelectionCheck]);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleSelectionChange = () => {
      scheduleSelectionCheck();
    };
    const handlePointerUp = () => {
      scheduleSelectionCheck();
    };

    document.addEventListener("selectionchange", handleSelectionChange);
    document.addEventListener("pointerup", handlePointerUp);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
      document.removeEventListener("pointerup", handlePointerUp);
    };
  }, [open, scheduleSelectionCheck]);

  useEffect(() => {
    if (!open || !inlineSelectionState) {
      return undefined;
    }

    const view = (manager as any)?.view;
    const root = view?.dom as HTMLElement | null;
    const handleReposition = () => {
      scheduleSelectionCheck(true);
    };
    const resizeObserver =
      root && typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleReposition)
        : null;

    if (root) {
      resizeObserver?.observe(root);
    }

    window.addEventListener("resize", handleReposition);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", handleReposition);
    };
  }, [inlineSelectionState, manager, open, scheduleSelectionCheck]);

  const handleRunInlineAiAction = React.useCallback(
    async (actionId: InlineAiActionId, instruction: string) => {
      if (!inlineSelectionState) return;

      const view = (manager as any)?.view;
      if (!view) return;

      const interactionId = createAiInteractionId();
      recordAiInteractionEvent({
        name: "ai_started",
        interactionId,
        surface: "summary_modal",
        actionId,
      });

      try {
        setPendingInlineAiActionId(actionId);
        setIsApplyingInlineAi(true);
        const result = await transformEditorSelectionAction({
          mode: actionId,
          instruction,
          selectedText: inlineSelectionState.text,
        });
        const normalizedResult = normalizeEditorAiTextResult(result, actionId);

        if (!normalizedResult) {
          recordAiInteractionEvent({
            name: "ai_failed",
            interactionId,
            surface: "summary_modal",
            actionId,
            errorKind: "empty_result",
          });
          return;
        }

        recordAiInteractionEvent({
          name: "ai_completed",
          interactionId,
          surface: "summary_modal",
          actionId: normalizedResult.actionId,
          applyMode: normalizedResult.applyMode,
          outputMode: normalizedResult.outputMode,
        });

        const suggestionBase = {
          actionId: normalizedResult.actionId,
          actionLabel: normalizedResult.actionLabel,
          interactionId,
          applyMode: normalizedResult.applyMode,
          outputMode: normalizedResult.outputMode,
          beforeText: inlineSelectionState.text,
          afterText: normalizedResult.text,
          from: inlineSelectionState.from,
          to: inlineSelectionState.to,
        };

        if (normalizedResult.applyMode === "preview_required") {
          setInlineAiSuggestion({
            ...suggestionBase,
            status: "preview",
          });
          setInlineSelectionState(null);
          return;
        }

        const beforeDoc = view.state.doc.toJSON() as RemirrorJSON;
        const tr = view.state.tr.insertText(
          normalizedResult.text,
          inlineSelectionState.from,
          inlineSelectionState.to,
        );
        view.dispatch(tr);
        view.focus();
        setInlineSelectionState(null);
        const afterDoc = view.state.doc.toJSON() as RemirrorJSON;
        setInlineAiSuggestion({
          ...suggestionBase,
          status: "accepted",
          undoSnapshot: createAiUndoSnapshot(beforeDoc, afterDoc),
        });
        recordAiInteractionEvent({
          name: "ai_accepted",
          interactionId,
          surface: "summary_modal",
          actionId: normalizedResult.actionId,
          applyMode: normalizedResult.applyMode,
          outputMode: normalizedResult.outputMode,
        });
      } catch (error) {
        recordAiInteractionEvent({
          name: "ai_failed",
          interactionId,
          surface: "summary_modal",
          actionId,
          errorKind: "request_failed",
        });
        throw error;
      } finally {
        setIsApplyingInlineAi(false);
        setPendingInlineAiActionId(null);
      }
    },
    [inlineSelectionState, manager, transformEditorSelectionAction],
  );

  const handleAcceptInlineAiSuggestion = React.useCallback(() => {
    if (!inlineAiSuggestion) return;

    const view = (manager as any)?.view;
    if (!view) return;

    const beforeDoc = view.state.doc.toJSON() as RemirrorJSON;
    const tr = view.state.tr.insertText(
      inlineAiSuggestion.afterText,
      inlineAiSuggestion.from,
      inlineAiSuggestion.to,
    );
    view.dispatch(tr);
    view.focus();
    const afterDoc = view.state.doc.toJSON() as RemirrorJSON;
    setInlineAiSuggestion({
      ...inlineAiSuggestion,
      status: "accepted",
      undoSnapshot: createAiUndoSnapshot(beforeDoc, afterDoc),
    });
    recordAiInteractionEvent({
      name: "ai_accepted",
      interactionId: inlineAiSuggestion.interactionId,
      surface: "summary_modal",
      actionId: inlineAiSuggestion.actionId,
      applyMode: inlineAiSuggestion.applyMode,
      outputMode: inlineAiSuggestion.outputMode,
    });
  }, [inlineAiSuggestion, manager]);

  const handleUndoInlineAiSuggestion = React.useCallback(() => {
    if (!inlineAiSuggestion?.undoSnapshot) return;

    const view = (manager as any)?.view;
    const restoredDoc = restoreAiUndoSnapshot(inlineAiSuggestion.undoSnapshot);
    const nextState =
      (manager as any)?.createState?.({ content: restoredDoc as any }) ??
      undefined;

    if (view && nextState && typeof view.updateState === "function") {
      view.updateState(nextState);
      view.focus();
    }

    setInlineAiSuggestion(null);
    recordAiInteractionEvent({
      name: "ai_undone",
      interactionId: inlineAiSuggestion.interactionId,
      surface: "summary_modal",
      actionId: inlineAiSuggestion.actionId,
      applyMode: inlineAiSuggestion.applyMode,
      outputMode: inlineAiSuggestion.outputMode,
    });
  }, [inlineAiSuggestion, manager]);

  const handleDiscardInlineAiSuggestion = React.useCallback(() => {
    if (!inlineAiSuggestion) return;
    recordAiInteractionEvent({
      name: "ai_discarded",
      interactionId: inlineAiSuggestion.interactionId,
      surface: "summary_modal",
      actionId: inlineAiSuggestion.actionId,
      applyMode: inlineAiSuggestion.applyMode,
      outputMode: inlineAiSuggestion.outputMode,
    });
    setInlineAiSuggestion(null);
  }, [inlineAiSuggestion]);

  // Keep hook order stable across renders; effect is a no-op when closed.
  useEffect(() => {
    if (!open) return;
    const view = (manager as any)?.view;
    if (!view) return;
    // Defer to next frame to ensure DOM is mounted
    const id = window.requestAnimationFrame(() => {
      try {
        const { state, dispatch } = view;
        const tr = state.tr.setSelection(TextSelection.atEnd(state.doc));
        dispatch(tr);
        view.focus();
      } catch {
        /* noop */
      }
    });
    return () => {
      try {
        window.cancelAnimationFrame(id);
      } catch {
        /* noop */
      }
    };
  }, [open, manager]);

  // PlaceholderExtension handles focus/typing disappearance; no DOM focus listeners required.

  // Normalize placeholder-like content stored in data to an empty doc so users don't see/edit it as real text.
  // We rely on PlaceholderExtension for placeholder UI behavior; no local emptiness state required.
  useEffect(() => {
    if (!open) return;
    const view = (manager as any)?.view;
    if (!view) return;
    try {
      const raw = view.state?.doc?.toJSON?.() as RemirrorJSON | undefined;
      if (raw && isPlaceholderDoc(raw)) {
        const empty = ensureRemirrorDoc(undefined as any);
        const newState =
          (manager as any).createState?.({ content: empty as any }) ??
          undefined;
        if (newState && typeof view.updateState === "function") {
          view.updateState(newState);
        }
      }
    } catch {
      /* noop */
    }
  }, [open, manager]);

  async function handleSave() {
    const itemId = String((item as any)?.id ?? "");
    if (!itemId) {
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      const view = (manager as any)?.view;
      const rawDoc: RemirrorJSON =
        view?.state?.doc?.toJSON?.() ?? ensureRemirrorDoc(undefined as any);
      const doc: RemirrorJSON = sanitizeDocForPersist(rawDoc);
      updateStructuredItem(String(sectionId), itemId, { summary: doc });
    } finally {
      setIsSaving(false);
      onClose();
    }
  }

  function handleClear() {
    const itemId = String((item as any)?.id ?? "");
    if (!itemId) {
      onClose();
      return;
    }

    updateStructuredItem(String(sectionId), itemId, {
      summary: ensureRemirrorDoc(undefined as any),
    });
    setIsClearConfirming(false);
    onClose();
  }

  return (
    <CvModalShell
      open={open}
      onClose={onClose}
      onBackdropClick={() => (isSaving ? undefined : onClose())}
    >
      {inlineSelectionState ? (
        <FloatingAiToolbar
          open
          anchor={inlineSelectionState.anchor}
          isLoading={isApplyingInlineAi}
          pendingActionId={pendingInlineAiActionId}
          onClose={() => setInlineSelectionState(null)}
          onRunAction={handleRunInlineAiAction}
        />
      ) : null}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit summary"
        className="dasti-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="dasti-modal-header">
          <div className="dasti-modal-heading">
            <h2 className="dasti-modal-title">Edit summary</h2>
            <p className="dasti-modal-subtitle">
              Profile narrative and positioning
            </p>
          </div>

          <button
            type="button"
            onClick={() => (isSaving ? null : onClose())}
            aria-label="Close"
            className="dasti-modal-close"
            disabled={isSaving}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="dasti-modal-body">
          {recoveryNotes.length > 0 ? (
            <section className="dasti-zone">
              <div className="dasti-recovery-note-stack__header">
                <span className="dasti-recovery-note__label">Recovered note</span>
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
              <div className="dasti-recovery-note-list">
                {recoveryNotes.map((note) => (
                  <div key={note} className="dasti-recovery-note">
                    <p className="cv-entry-body">{note}</p>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          {inlineAiSuggestion ? (
            <section className="dasti-zone">
              <AiSuggestionCard
                compact
                actionLabel={inlineAiSuggestion.actionLabel}
                beforeText={inlineAiSuggestion.beforeText}
                afterText={inlineAiSuggestion.afterText}
                status={inlineAiSuggestion.status}
                onAccept={handleAcceptInlineAiSuggestion}
                onDiscard={handleDiscardInlineAiSuggestion}
                onUndo={handleUndoInlineAiSuggestion}
              />
            </section>
          ) : null}
          <section className="dasti-zone">
            <div className="dasti-rich dasti-rich--cv-reading-measure">
              <Remirror
                manager={manager}
                initialContent={state}
                onChange={handleChange}
              >
                <div
                  className="rich-content"
                  onPointerUp={scheduleSelectionCheck}
                  onKeyUp={scheduleSelectionCheck}
                >
                  <EditorToolbar position="top" />
                  <EditorComponent />
                </div>
              </Remirror>
            </div>
          </section>
        </div>

        <div className="dasti-modal-footer">
          <div className="dasti-modal-footer-note">
            Used in your resume header and exports.
          </div>

          <div className="dasti-modal-actions">
            {isClearConfirming ? (
              <span className="sb-doc-confirm" style={{ gap: "var(--s2)" }}>
                <span
                  className="sb-doc-confirm__label"
                  style={{ fontSize: "var(--tx)" }}
                >
                  Clear?
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
                Clear
              </Button>
            )}
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSave()}
              disabled={isSaving}
              ariaLabel="Save summary"
            >
              Save
            </Button>
          </div>
        </div>
      </div>
    </CvModalShell>
  );
}

export default SummaryModal;
