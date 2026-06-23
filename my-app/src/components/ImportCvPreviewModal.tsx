/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
/* eslint-disable @typescript-eslint/no-misused-promises -- Existing async UI handlers are preserved for this release-gate cleanup; convert to explicit void wrappers in a focused follow-up. */
import React, { useEffect, useCallback, useState, useRef } from "react";
import type { CvDocument } from "../schemas/cvDocument.schema";
import { useCvLibrary } from "../contexts/CvLibraryContext";
import { Button } from "./ui/button";
import { X, FileText, Loader2 } from "@/lib/icons";

interface Props {
  isOpen: boolean;
  document: CvDocument;
  onClose: () => void;
  onReplace?: (doc: CvDocument) => void;
}

/**
 * ImportCvPreviewModal
 *
 * Lightweight preview modal that shows a simplified view of the provided
 * normalized CvDocument (sections + top blocks). Users can Cancel or Replace CV.
 *
 * On "Replace CV" the modal calls CvLibraryContext.importCv(doc) and closes on success.
 *
 * Accessibility improvements:
 * - Closes on Escape key
 * - Tries to restore focus to previously focused element when closed
 * - Focuses modal content when opened
 */
export function ImportCvPreviewModal(props: Props): JSX.Element | null {
  const { isOpen, document, onClose, onReplace } = props;
  const { importCv } = useCvLibrary();
  const [isReplacing, setIsReplacing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDivElement | null>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Reset state when modal closes
  useEffect(() => {
    if (!isOpen) {
      setError(null);
      setIsReplacing(false);
    }
  }, [isOpen]);

  // Escape key to close + focus management
  useEffect(() => {
    if (!isOpen) return undefined;
    previouslyFocusedRef.current =
      document && (window.document.activeElement as HTMLElement);
    // focus the modal container for keyboard users
    setTimeout(() => {
      modalRef.current?.focus();
    }, 0);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("keydown", handleKey);
      // restore focus
      try {
        previouslyFocusedRef.current?.focus();
      } catch {
        // ignore
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onClose]);

  const handleReplace = useCallback(async () => {
    setError(null);
    setIsReplacing(true);
    try {
      await importCv(document);
      if (typeof onReplace === "function") onReplace(document);
      onClose();
    } catch (err: any) {
      setError(String(err?.message ?? err ?? "Failed to replace CV"));
    } finally {
      setIsReplacing(false);
    }
  }, [importCv, document, onClose, onReplace]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="import-cv-preview-title"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="fixed inset-0"
        onClick={onClose}
        style={{
          background: "var(--dialog-backdrop-bg)",
          backdropFilter: "blur(var(--dialog-backdrop-blur))",
          WebkitBackdropFilter: "blur(var(--dialog-backdrop-blur))",
        }}
      />
      <div
        ref={modalRef}
        className="relative w-full max-w-2xl mx-4 overflow-hidden [border-radius:var(--radius-surface)] [box-shadow:var(--shc)] [background:var(--sfr)]"
        tabIndex={0}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-muted-foreground" />
            <h3 id="import-cv-preview-title" className="text-sm font-semibold">
              Import preview — {document.title ?? "Untitled"}
            </h3>
          </div>
          <button
            aria-label="Close preview"
            onClick={onClose}
            className="p-2 rounded hover:bg-accent/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto p-4 space-y-4">
          {document.sections.length === 0 && (
            <div className="text-sm text-muted-foreground">
              No sections found in this import.
            </div>
          )}

          {document.sections.map((s) => (
            <div key={s.id} className="p-3 border rounded bg-muted/5">
              <div className="flex items-center justify-between">
                <div className="text-sm font-medium">
                  {s.title || "Untitled section"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {(s.blocks ?? []).length} blocks
                </div>
              </div>
              <div className="mt-2 space-y-2">
                {(s.blocks ?? []).slice(0, 3).map((b) => (
                  <div key={b.id} className="p-2 rounded bg-background">
                    <div className="text-xs font-medium truncate">
                      {(b as any).title ?? "Block"}
                    </div>
                    <div className="mt-1 text-xs truncate text-muted-foreground">
                      {(b as any).plainText ??
                        (typeof (b as any).content === "string"
                          ? (b as any).content
                          : JSON.stringify((b as any).content).slice(0, 140))}
                    </div>
                  </div>
                ))}
                {(s.blocks ?? []).length > 3 && (
                  <div className="text-xs text-muted-foreground">
                    +{(s.blocks ?? []).length - 3} more
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t">
          {error && <div className="mr-auto text-xs text-red-500">{error}</div>}
          <Button variant="secondary" onClick={onClose} disabled={isReplacing}>
            Cancel
          </Button>
          <Button
            onClick={handleReplace}
            disabled={isReplacing}
            className="ml-2"
          >
            {isReplacing ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
                Replacing…
              </span>
            ) : (
              "Replace CV"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
