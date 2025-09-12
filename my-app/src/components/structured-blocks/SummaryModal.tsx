import React, { useEffect, useMemo, useRef, useState } from "react";
import { Remirror, useRemirror, EditorComponent } from "@remirror/react";
import { BoldExtension, ItalicExtension, UnderlineExtension } from "remirror/extensions";
import type { RemirrorJSON } from "remirror";
import type { ISummaryItem } from "../../types/cvDocument";
import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import { useCvLibrary } from "../../contexts/CvLibraryContext";
import { X } from "lucide-react";

interface SummaryModalProps {
  open: boolean;
  sectionId: string;
  item: ISummaryItem | null;
  onClose: () => void;
}

export function SummaryModal({ open, sectionId, item, onClose }: SummaryModalProps) {
  const { updateStructuredItem } = useCvLibrary();
  const [isSaving, setIsSaving] = useState(false);

  // Initialize Remirror doc once when opened
  const initialDocRef = useRef<RemirrorJSON>(ensureRemirrorDoc(item?.summary as any));
  useEffect(() => {
    if (!open) return;
    initialDocRef.current = ensureRemirrorDoc(item?.summary as any);
  }, [open, item?.summary]);

  const extensions = useMemo(() => [new BoldExtension({}), new ItalicExtension({}), new UnderlineExtension({})], []);
  const { manager, state, onChange } = useRemirror({
    extensions: () => extensions as any,
    content: initialDocRef.current as any,
    onError: () => initialDocRef.current as any,
  });

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
      const doc: RemirrorJSON = view?.state?.doc?.toJSON?.() ?? ensureRemirrorDoc(undefined as any);
      updateStructuredItem(String(sectionId), itemId, { summary: doc });
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
        aria-label="Edit summary"
        className="relative w-full max-w-3xl bg-white dark:bg-slate-900 rounded-lg shadow-lg overflow-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b dark:border-slate-700">
          <h2 className="text-lg font-semibold">Edit summary</h2>
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

        <div className="p-4 space-y-3">
          <div>
            <label className="text-xs text-neutral-500">Summary</label>
            <div className="mt-2 border rounded">
              <Remirror manager={manager} initialContent={state} onChange={onChange}>
                <div className="p-2">
                  <EditorComponent />
                </div>
              </Remirror>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 mt-2">
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
              className="px-3 py-2 text-white rounded bg-[var(--primary)] disabled:opacity-50"
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

export default SummaryModal;