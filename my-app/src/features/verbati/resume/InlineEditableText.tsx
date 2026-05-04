import React from "react";
import type { RemirrorJSON } from "remirror";

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
  onFieldDocChange?: (target: ActivePaperEditTarget, doc: RemirrorJSON) => void;
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
  "children" | "contentEditable" | "onBeforeInput" | "onInput" | "onPaste"
> & {
  as?: InlineEditableTag;
  value: string;
  editable: boolean;
  editTarget: ActivePaperEditTarget;
  onActivate: (target: ActivePaperEditTarget) => void;
  onDeactivate?: ((target?: ActivePaperEditTarget) => void) | undefined;
  ariaLabel: string;
  onPlainTextChange: (text: string) => void;
  onBeforeInput?: React.FormEventHandler<HTMLElement>;
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
  const caretNode = document.createTextNode("");
  textNode.parentNode?.insertBefore(caretNode, textNode.nextSibling);
  range.setStart(caretNode, 0);
  range.setEnd(caretNode, 0);
  selection.removeAllRanges();
  selection.addRange(range);
  return true;
}

function readEditablePlainText(node: HTMLElement | null): string {
  if (!node) return "";
  if (typeof node.innerText === "string") {
    return node.innerText.replace(/\u200B/g, "").replace(/\r/g, "\n");
  }
  return (node.textContent ?? "").replace(/\u200B/g, "");
}

function insertLineBreakAtSelection(): boolean {
  return insertPlainTextAtSelection("\n");
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
  onBeforeInput,
  onKeyDown,
  style,
  ...props
}: InlineEditableTextProps) {
  const ref = React.useRef<HTMLElement | null>(null);
  const isFocusedRef = React.useRef(false);
  const [editState, setEditState] = React.useState<"idle" | "focus">("idle");
  const [draftValue, setDraftValue] = React.useState(value);
  const preservesLineBreaks =
    editTarget.fieldKind === "paragraph" &&
    (editTarget.sectionType === "summary" ||
      editTarget.fieldPath.endsWith(".responsibilities"));
  const mergedStyle = preservesLineBreaks
    ? ({ whiteSpace: "pre-wrap", ...style } satisfies React.CSSProperties)
    : style;

  React.useLayoutEffect(() => {
    const node = ref.current;
    if (!node || (editable && isFocusedRef.current)) {
      return;
    }

    if (node instanceof HTMLTextAreaElement) {
      if (node.value !== value) {
        node.value = value;
      }
      node.style.height = "auto";
      node.style.height = `${node.scrollHeight}px`;
      return;
    }

    if (node.textContent !== value) {
      node.textContent = value;
    }
  }, [editable, value]);

  React.useEffect(() => {
    if (!isFocusedRef.current) {
      setDraftValue(value);
    }
  }, [value]);

  const handleInput = React.useCallback(() => {
    onActivate(editTarget);
    onPlainTextChange(readEditablePlainText(ref.current));
  }, [editTarget, onActivate, onPlainTextChange]);

  const handlePaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLElement>) => {
      event.preventDefault();
      const text = event.clipboardData.getData("text/plain");
      if (!insertPlainTextAtSelection(text)) {
        ref.current?.append(document.createTextNode(text));
      }
      onPlainTextChange(readEditablePlainText(ref.current));
    },
    [onPlainTextChange],
  );

  const insertEditableLineBreak = React.useCallback(() => {
    if (!insertLineBreakAtSelection()) {
      insertPlainTextAtSelection("\n");
    }
    onActivate(editTarget);
  }, [editTarget, onActivate]);

  const handleBeforeInput = React.useCallback(
    (event: React.FormEvent<HTMLElement>) => {
      const inputType = (
        event.nativeEvent as InputEvent | undefined
      )?.inputType;
      if (
        editable &&
        preservesLineBreaks &&
        (inputType === "insertParagraph" || inputType === "insertLineBreak")
      ) {
        event.preventDefault();
        insertEditableLineBreak();
        return;
      }
      onBeforeInput?.(event);
    },
    [editable, insertEditableLineBreak, onBeforeInput, preservesLineBreaks],
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
      if (
        editable &&
        preservesLineBreaks &&
        event.key === "Enter" &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey
      ) {
        event.preventDefault();
        insertEditableLineBreak();
        return;
      }
      onKeyDown?.(event);
    },
    [editable, insertEditableLineBreak, onKeyDown, preservesLineBreaks],
  );

  const Component = as as React.ElementType<any>;
  const componentRef = ref as React.Ref<any>;
  const resizeTextArea = React.useCallback((node: HTMLTextAreaElement) => {
    node.style.height = "auto";
    node.style.height = `${node.scrollHeight}px`;
  }, []);

  React.useLayoutEffect(() => {
    if (!editable || editState !== "focus") return;
    const node = ref.current;
    if (!node) return;
    if (!(node instanceof HTMLTextAreaElement) && node.textContent !== value) {
      node.textContent = value;
    }
    if (document.activeElement !== node) {
      node.focus({ preventScroll: true });
    }
    if (node instanceof HTMLTextAreaElement) {
      const length = node.value.length;
      node.setSelectionRange(length, length);
      resizeTextArea(node);
      return;
    }
    const selection = window.getSelection();
    if (selection && node.childNodes.length > 0) {
      const range = document.createRange();
      range.selectNodeContents(node);
      range.collapse(false);
      selection.removeAllRanges();
      selection.addRange(range);
    }
  }, [editable, editState, resizeTextArea, value]);

  if (!editable) {
    return (
      <Component
        {...props}
        ref={componentRef}
        tabIndex={props.tabIndex}
        style={mergedStyle}
        onClick={handleClick}
        onMouseDown={handleMouseDown}
        onPointerDown={handlePointerDown}
      >
        {value}
      </Component>
    );
  }

  if (preservesLineBreaks) {
    const textareaValue = editState === "focus" ? draftValue : value;
    return (
      <textarea
        {...(props as React.TextareaHTMLAttributes<HTMLTextAreaElement>)}
        ref={ref as React.Ref<HTMLTextAreaElement>}
        value={textareaValue}
        rows={1}
        role="textbox"
        aria-label={ariaLabel}
        aria-multiline
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
        onFocus={(event) => {
          isFocusedRef.current = true;
          setDraftValue(event.currentTarget.value || value);
          setEditState("focus");
          onActivate(editTarget);
          resizeTextArea(event.currentTarget);
        }}
        onBlur={(event) => {
          isFocusedRef.current = false;
          const nextText = event.currentTarget.value;
          setDraftValue(nextText);
          if (nextText !== value) {
            onPlainTextChange(nextText);
          }
          if (!event.currentTarget.value.trim()) {
            event.currentTarget.value = "";
          }
          setEditState("idle");
          onDeactivate?.(editTarget);
        }}
        onChange={(event) => {
          const nextText = event.currentTarget.value;
          setDraftValue(nextText);
          onActivate(editTarget);
          resizeTextArea(event.currentTarget);
          onPlainTextChange(nextText);
        }}
        onClick={handleClick as React.MouseEventHandler<HTMLTextAreaElement>}
        onMouseDown={handleMouseDown as React.MouseEventHandler<HTMLTextAreaElement>}
        onPointerDown={handlePointerDown as React.PointerEventHandler<HTMLTextAreaElement>}
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.currentTarget.blur();
          }
          onKeyDown?.(event as unknown as React.KeyboardEvent<HTMLElement>);
        }}
        style={{
          ...mergedStyle,
          width: "100%",
          minWidth: 0,
          padding: 0,
          border: 0,
          outline: 0,
          resize: "none",
          overflow: "hidden",
          background: "transparent",
          color: "inherit",
          font: "inherit",
        }}
      />
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
      aria-multiline={preservesLineBreaks ? true : undefined}
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
        const text = readEditablePlainText(ref.current);
        if (text !== value) {
          onPlainTextChange(text);
        }
        if (ref.current && !text.trim()) {
          ref.current.textContent = "";
        }
        setEditState("idle");
        onDeactivate?.(editTarget);
      }}
      onBeforeInput={handleBeforeInput}
      onInput={handleInput}
      onPaste={handlePaste}
      onClick={handleClick}
      onMouseDown={handleMouseDown}
      onPointerDown={handlePointerDown}
      onKeyDown={handleKeyDown}
      style={mergedStyle}
    />
  );
}
