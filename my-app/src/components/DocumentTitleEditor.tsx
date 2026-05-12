import React from "react";

export type DocumentTitleEditorProps = {
  documentTitle: string;
  titlePlaceholder: string;
  onTitleCommit: (nextTitle: string) => void;
  ariaLabel?: string;
  disabled?: boolean;
  className?: string;
};

export function DocumentTitleEditor({
  documentTitle,
  titlePlaceholder,
  onTitleCommit,
  ariaLabel = "Document title",
  disabled = false,
  className,
}: DocumentTitleEditorProps): JSX.Element {
  const normalizedTitle = documentTitle.trim();
  const fallbackTitle = titlePlaceholder.trim() || "Untitled document";
  const displayTitle = normalizedTitle || fallbackTitle;
  const [editing, setEditing] = React.useState(false);
  const [draftTitle, setDraftTitle] = React.useState(documentTitle);
  const inputRef = React.useRef<HTMLInputElement | null>(null);
  const committedRef = React.useRef(false);

  React.useEffect(() => {
    if (!editing) {
      setDraftTitle(documentTitle);
    }
  }, [documentTitle, editing]);

  React.useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const startEditing = React.useCallback(() => {
    if (disabled) return;
    committedRef.current = false;
    setDraftTitle(documentTitle);
    setEditing(true);
  }, [disabled, documentTitle]);

  const commitTitle = React.useCallback(() => {
    if (committedRef.current) return;
    committedRef.current = true;
    setEditing(false);
    onTitleCommit(draftTitle.trim());
  }, [draftTitle, onTitleCommit]);

  const cancelEditing = React.useCallback(() => {
    committedRef.current = true;
    setDraftTitle(documentTitle);
    setEditing(false);
  }, [documentTitle]);

  const rootClassName = [
    "document-title-editor",
    className,
    editing ? "document-title-editor--editing" : null,
  ]
    .filter(Boolean)
    .join(" ");

  if (editing) {
    return (
      <span className={rootClassName}>
        <input
          ref={inputRef}
          type="text"
          className="document-title-editor__input"
          value={draftTitle}
          aria-label={ariaLabel}
          placeholder={titlePlaceholder}
          onChange={(event) => setDraftTitle(event.target.value)}
          onBlur={commitTitle}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitTitle();
            } else if (event.key === "Escape") {
              event.preventDefault();
              cancelEditing();
            }
          }}
        />
      </span>
    );
  }

  return (
    <span className={rootClassName}>
      <button
        type="button"
        className="document-title-editor__trigger"
        aria-label={`Edit ${ariaLabel}`}
        title={displayTitle}
        disabled={disabled}
        onClick={startEditing}
      >
        <span className="document-title-editor__text">{displayTitle}</span>
      </button>
    </span>
  );
}

export default DocumentTitleEditor;
