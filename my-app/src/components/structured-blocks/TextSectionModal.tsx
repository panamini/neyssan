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

import { X } from "@/lib/icons";

import { ensureRemirrorDoc } from "../remirror-editor/utils/conversion";
import { EditorToolbar } from "../remirror-editor/components/EditorToolbar";
import { Button } from "../ui/button";
import { CvModalShell } from "./CvModalShell";

type TextSectionModalProps = {
  open: boolean;
  title: string;
  description?: string;
  placeholder?: string;
  initialContent?: RemirrorJSON | null;
  saveLabel?: string;
  onClose: () => void;
  onSave: (nextDoc: RemirrorJSON) => void;
};

export function TextSectionModal({
  open,
  title,
  description = "Capture supporting details in a single rich text section.",
  placeholder = "Start typing here...",
  initialContent,
  saveLabel = "Save",
  onClose,
  onSave,
}: TextSectionModalProps) {
  const [isSaving, setIsSaving] = useState(false);
  const initialDocRef = useRef<RemirrorJSON>(
    ensureRemirrorDoc(initialContent as any),
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    initialDocRef.current = ensureRemirrorDoc(initialContent as any);
  }, [initialContent, open]);

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
      new PlaceholderExtension({ placeholder }),
    ],
    [placeholder],
  );

  const { manager, state, onChange } = useRemirror({
    extensions: () => extensions as any,
    content: initialDocRef.current as any,
    onError: () => initialDocRef.current as any,
  });

  const handleChange = React.useCallback(
    (param: unknown) => {
      onChange(param as any);
    },
    [onChange],
  );

  async function handleSave() {
    setIsSaving(true);
    try {
      const view = (manager as any)?.view;
      const nextDoc =
        (view?.state?.doc?.toJSON?.() as RemirrorJSON | undefined) ??
        ensureRemirrorDoc(undefined as any);
      onSave(ensureRemirrorDoc(nextDoc as any));
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
        aria-label={`Edit ${title}`}
        className="dasti-modal"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b [border-color:var(--color-border)]">
          <div>
            <h2 className="text-lg font-semibold">{`Edit ${title}`}</h2>
            <p className="text-sm [color:var(--tm2)]">{description}</p>
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
          <div className="border rounded-[var(--radius-card)] [border-color:var(--color-border)] [background:var(--sf1)] p-3">
            <Remirror
              manager={manager}
              initialContent={state}
              onChange={handleChange}
            >
              <EditorToolbar position="top" />
              <EditorComponent />
            </Remirror>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="primary"
              onClick={() => void handleSave()}
              disabled={isSaving}
              ariaLabel={saveLabel}
            >
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>
    </CvModalShell>
  );
}

export default TextSectionModal;
