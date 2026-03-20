import React, { useEffect, useMemo, useRef, useState } from "react";
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
import { EditorToolbar } from "../remirror-editor/components/EditorToolbar";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { X } from "lucide-react";
import { TextSelection } from "prosemirror-state";
import { docToPlainText } from "../remirror-editor/utils/text";
import { Button } from "../ui/button";

interface SummaryModalProps {
  open: boolean;
  sectionId: string;
  item: ISummaryItem | null;
  onClose: () => void;
}

export function SummaryModal({ open, sectionId, item, onClose }: SummaryModalProps) {
  const { updateStructuredItem } = useCvLibrary();
  const [isSaving, setIsSaving] = useState(false);
  const [isClearConfirming, setIsClearConfirming] = useState(false);

  // Initialize Remirror doc once when opened
  // Treat UI placeholder docs as empty so clicking "Start typing here" opens a blank editor.
  function normalizePlaceholder(s: string): string {
    return s.toLowerCase().replace(/\s+/g, " ").replace(/[.,…!?:\-]/g, "").trim();
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
      const content = Array.isArray((doc as any).content) ? (doc as any).content : [];
      const filtered = content.filter((node: any) => {
        try {
          const txt = String(getNodePlainText(node) || "").replace(/\s+/g, " ").trim();
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
    []
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
    [baseOnChange]
  );

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

  if (!open) return null;

  async function handleSave() {
    const itemId = String((item as any)?.id ?? "");
    if (!itemId) {
      onClose();
      return;
    }
    setIsSaving(true);
    try {
      const view = (manager as any)?.view;
      const rawDoc: RemirrorJSON = view?.state?.doc?.toJSON?.() ?? ensureRemirrorDoc(undefined as any);
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

    updateStructuredItem(String(sectionId), itemId, { summary: ensureRemirrorDoc(undefined as any) });
    setIsClearConfirming(false);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4" onMouseDownCapture={(e) => e.stopPropagation()}>
      <div
        className="absolute inset-0"
        onClick={() => (isSaving ? null : onClose())}
        style={{ background: "hsla(30,12%,11%,.32)", backdropFilter: "blur(8px) saturate(1.2)" }}
      />
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
            <p className="dasti-modal-subtitle">Profile narrative and positioning</p>
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
          <section className="dasti-zone">
            <div className="dasti-rich">
              <Remirror manager={manager} initialContent={state} onChange={handleChange}>
                <div className="rich-content">
                  <EditorToolbar position="top" />
                  <EditorComponent />
                </div>
              </Remirror>
            </div>

            <div className="dasti-hint">Keep this short, specific, and aligned with the target role.</div>
          </section>
        </div>

        <div className="dasti-modal-footer">
          <div className="dasti-modal-footer-note">Used in your resume header and exports.</div>

          <div className="dasti-modal-actions">
            {isClearConfirming ? (
              <span className="sb-doc-confirm" style={{ gap: "var(--s2)" }}>
                <span className="sb-doc-confirm__label" style={{ fontSize: "var(--tx)" }}>Clear?</span>
                <button type="button" className="sb-doc-confirm__yes" onClick={handleClear}>
                  Clear
                </button>
                <button type="button" className="sb-doc-confirm__no" onClick={() => setIsClearConfirming(false)}>
                  Cancel
                </button>
              </span>
            ) : (
              <Button type="button" variant="secondary" onClick={() => setIsClearConfirming(true)} disabled={isSaving}>
                Clear
              </Button>
            )}
            <Button type="button" variant="primary" onClick={() => void handleSave()} disabled={isSaving} ariaLabel="Save summary">
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default SummaryModal;
