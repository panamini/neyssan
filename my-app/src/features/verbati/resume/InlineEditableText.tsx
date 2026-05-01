import React from "react";

export type ActivePaperEditTarget = {
  sectionId: string;
  sectionType: string;
  fieldPath: string;
  fieldKind: "paragraph" | "heading" | "bullet" | "chip" | "date" | "meta";
  itemIndex?: number;
  bulletIndex?: number;
  chipIndex?: number;
};

export type ResumeInlineEditing = {
  enabled: boolean;
  activeTarget: ActivePaperEditTarget | null;
  onActivate: (target: ActivePaperEditTarget) => void;
  onDeactivate: (target?: ActivePaperEditTarget) => void;
  onSummaryChange: (text: string) => void;
  onTextSectionChange: (sectionId: string, text: string) => void;
  onFieldChange?: (target: ActivePaperEditTarget, text: string) => void;
  onAddItem?: (request: {
    sectionId: string;
    sectionType: string;
    itemKind:
      | "skill"
      | "language"
      | "hobby"
      | "achievement"
      | "certification"
      | "affiliation"
      | "project"
      | "experience"
      | "education"
      | "bullet"
      | "paragraph"
      | "profile-contact";
    parentItemId?: string;
  }) => void;
};

export type InlineEditableTag = "p" | "span" | "h1" | "h2" | "h3" | "div";

type InlineEditableTextProps = Omit<
  React.HTMLAttributes<HTMLElement>,
  "children" | "contentEditable" | "onInput" | "onPaste"
> & {
  as?: InlineEditableTag;
  value: string;
  editable: boolean;
  editTarget: ActivePaperEditTarget;
  onActivate: (target: ActivePaperEditTarget) => void;
  onDeactivate?: ((target?: ActivePaperEditTarget) => void) | undefined;
  ariaLabel: string;
  onPlainTextChange: (text: string) => void;
};

function insertPlainTextAtSelection(text: string): boolean {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return false;
  }

  selection.deleteFromDocument();
  const range = selection.getRangeAt(0);
  const textNode = document.createTextNode(text);
  range.insertNode(textNode);
  range.setStartAfter(textNode);
  range.setEndAfter(textNode);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

export function InlineEditableText({
  as = "p",
  value,
  editable,
  editTarget,
  onActivate,
  onDeactivate,
  ariaLabel,
  onPlainTextChange,
  onClick,
  onMouseDown,
  onPointerDown,
  onKeyDown,
  ...props
}: InlineEditableTextProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const isFocusedRef = React.useRef(false);
  const [editState, setEditState] = React.useState<"idle" | "focus">("idle");

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node || (editable && isFocusedRef.current)) {
      return;
    }

    if (node.textContent !== value) {
      node.textContent = value;
    }
  }, [editable, value]);

  const handleInput = React.useCallback(() => {
    onActivate(editTarget);
    onPlainTextChange(ref.current?.textContent ?? "");
  }, [editTarget, onActivate, onPlainTextChange]);

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLElement>) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      if (!insertPlainTextAtSelection(text)) {
        ref.current?.append(document.createTextNode(text));
      }
      onPlainTextChange(ref.current?.textContent ?? "");
    },
    [onPlainTextChange],
  );

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (editable) {
        event.stopPropagation();
      }
      onActivate(editTarget);
      onClick?.(event);
    },
    [editTarget, editable, onActivate, onClick],
  );

  const handleMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLElement>) => {
      if (editable) {
        event.stopPropagation();
        event.currentTarget.focus({ preventScroll: true });
      }
      onMouseDown?.(event);
    },
    [editable, onMouseDown],
  );

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLElement>) => {
      if (editable) {
        event.stopPropagation();
        event.currentTarget.focus({ preventScroll: true });
      }
      onPointerDown?.(event);
    },
    [editable, onPointerDown],
  );

  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (editable && event.key === "Escape") {
        event.currentTarget.blur();
      }
      onKeyDown?.(event);
    },
    [editable, onKeyDown],
  );

  const Component = as as React.ElementType<any>;
  const componentRef = ref as React.Ref<any>;

  if (!editable) {
    return (
      <Component
        {...props}
        ref={componentRef}
        tabIndex={props.tabIndex}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onPointerDown={handlePointerDown}
      >
        {value}
      </Component>
    );
  }

  return (
    <Component
      {...props}
      ref={componentRef}
      contentEditable="plaintext-only"
      suppressContentEditableWarning
      role="textbox"
      tabIndex={0}
      aria-label={ariaLabel}
      data-resume-inline-editable="true"
      data-inline-paper-editable="true"
      data-inline-edit-state={editState}
      data-paper-section-id={editTarget.sectionId}
      data-paper-section-type={editTarget.sectionType}
      data-paper-field-path={editTarget.fieldPath}
      data-paper-field-kind={editTarget.fieldKind}
      data-paper-item-index={editTarget.itemIndex}
      data-paper-bullet-index={editTarget.bulletIndex}
      data-paper-chip-index={editTarget.chipIndex}
      onFocus={() => {
        isFocusedRef.current = true;
        setEditState("focus");
        onActivate(editTarget);
        if (ref.current && ref.current.textContent !== value) {
          ref.current.textContent = value;
        }
      }}
      onBlur={() => {
        isFocusedRef.current = false;
        if (ref.current && !ref.current.textContent?.trim()) {
          ref.current.textContent = "";
        }
        setEditState("idle");
        onDeactivate?.(editTarget);
      }}
      onInput={handleInput}
      onPaste={handlePaste}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
    />
  );
}
