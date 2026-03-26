import { useCallback, useMemo } from "react";

interface Section {
  id: string;
  title: string;
  content: string;
  dismissed?: boolean;
}

interface CVDocumentReviewerProps {
  sections: Section[];
  /**
   * Called when the user dismisses (trashes) a section.
   * Should be non-destructive at caller-side (the component only signals intent).
   */
  onDismiss?: (sectionId: string) => void;
  /**
   * Called when the user wants to undo a dismissal. The host should restore
   * the section from its own snapshot/undo stack.
   */
  onUndo?: (sectionId: string) => void;
  /**
   * Called when the user edits the content of a section.
   * Parent should update its state (reviewerSections) to persist the edit.
   */
  onEdit?: (sectionId: string, newContent: string) => void;
  className?: string;
}

/**
 * CVDocumentReviewer
 *
 * - Lightweight, accessible placeholder for the "Flow B" document review UI.
 * - Renders a single scrollable view of sections with sticky section headers.
 * - Exposes onDismiss / onUndo hooks so the host can implement a session-scoped undo stack.
 *
 * This component is intentionally minimal so it can be wired into the ProfileReviewModal
 * quickly. Visual and interaction polish (inline editing, sticky header variations,
 * section re-ordering) will be implemented in Phase 1.2.
 */
export function CVDocumentReviewer({
  sections,
  onDismiss,
  onUndo,
  onEdit,
  className = "",
}: CVDocumentReviewerProps) {
  const visibleSections = useMemo(
    () => sections.filter((s) => !s.dismissed),
    [sections],
  );

  const handleDismiss = useCallback(
    (id: string) => {
      if (onDismiss) onDismiss(id);
    },
    [onDismiss],
  );

  const handleUndo = useCallback(
    (id: string) => {
      if (onUndo) onUndo(id);
    },
    [onUndo],
  );

  return (
    <div
      className={`flex flex-col h-full w-full bg-[var(--background)] text-[var(--foreground)] ${className}`}
      aria-label="CV Document Reviewer"
    >
      <header
        className="flex items-center justify-between px-4 py-3 border-b border-[color:var(--color-border)] [background:var(--sfr)]"
        style={{ height: "var(--header-height)" }}
      >
        <h2 className="text-lg font-semibold" aria-hidden>
          CV Document Reviewer
        </h2>
        <div className="text-sm text-[var(--text-muted)]">Review mode</div>
      </header>

      <div
        className="p-4 overflow-auto cv-reviewer custom-scrollbar"
        style={{ maxHeight: `calc(100% - var(--header-height))` }}
        role="list"
        aria-label="CV sections"
      >
        {visibleSections.length === 0 && (
          <div className="p-6 text-center text-[var(--text-muted)]">
            No sections to review
          </div>
        )}

        {sections.map((section) => (
          <article
            key={section.id}
            role="listitem"
            className="mb-6 rounded-md border border-[color:var(--color-border)] [background:var(--sfr)]"
            aria-hidden={section.dismissed ? "true" : "false"}
          >
            <div
              className="sticky top-0 z-10 flex items-center justify-between gap-4 px-4 py-2 [background:var(--sfr)] border-b border-[color:var(--color-border)]"
              style={{ backdropFilter: "blur(2px)" }}
            >
              <h3 className="text-sm font-medium">{section.title}</h3>

              <div className="flex items-center gap-2">
                {!section.dismissed && (
                  <button
                    className="px-2 py-1 rounded-md [color:var(--op)] [background:var(--ac)] hover:brightness-110 focus:outline-none focus-visible:[box-shadow:0_0_0_3px_var(--fr)]"
                    aria-label={`Dismiss section ${section.title}`}
                    onClick={() => handleDismiss(section.id)}
                  >
                    Dismiss
                  </button>
                )}

                {section.dismissed && (
                  <button
                    className="px-2 py-1 rounded-md [color:var(--ti)] [background:var(--sfr)] border border-[color:var(--color-border)] hover:[background:var(--as)] focus:outline-none focus:[box-shadow:0_0_0_3px_var(--fr)]"
                    aria-label={`Undo dismiss for ${section.title}`}
                    onClick={() => handleUndo(section.id)}
                  >
                    Undo
                  </button>
                )}
              </div>
            </div>

            <div className="p-4">
              <div
                className="max-w-full text-sm"
                aria-label={`${section.title} content`}
              >
                {onEdit ? (
                  <div
                    contentEditable
                    suppressContentEditableWarning
                    onInput={(e) =>
                      onEdit(
                        section.id,
                        String(
                          (e.currentTarget as HTMLElement).textContent ?? "",
                        ),
                      )
                    }
                    onBlur={(e) =>
                      onEdit(
                        section.id,
                        String(
                          (e.currentTarget as HTMLElement).textContent ?? "",
                        ),
                      )
                    }
                    className="min-h-[48px] w-full whitespace-pre-wrap focus:outline-none"
                    role="textbox"
                    aria-label={`Edit ${section.title}`}
                    dangerouslySetInnerHTML={{
                      __html: String(section.content ?? "").replace(
                        /\n/g,
                        "<br/>",
                      ),
                    }}
                  />
                ) : (
                  section.content.split("\n").map((line, idx) => (
                    <p key={idx} className="mb-2">
                      {line}
                    </p>
                  ))
                )}
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
