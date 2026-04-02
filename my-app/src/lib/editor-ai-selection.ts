export type EditorSelectionAnchor = {
  left: number;
  top: number;
  bottom: number;
};

export const INLINE_AI_TOOLBAR_SELECTOR = "[data-inline-ai-toolbar='true']";

export function isInlineAiToolbarActiveElement(
  activeElement: Element | null | undefined =
    typeof document !== "undefined" ? document.activeElement : null,
): boolean {
  if (!activeElement || typeof activeElement.closest !== "function") {
    return false;
  }

  return Boolean(activeElement.closest(INLINE_AI_TOOLBAR_SELECTOR));
}

export function getDomSelectionState(
  root: HTMLElement | null | undefined,
): { text: string; anchor: EditorSelectionAnchor } | null {
  if (!root || typeof window === "undefined") return null;

  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return null;
  }

  const text = selection.toString().trim();
  if (!text) return null;

  const range = selection.getRangeAt(0);
  const commonNode = range.commonAncestorContainer;
  const commonElement =
    commonNode.nodeType === Node.ELEMENT_NODE
      ? (commonNode as HTMLElement)
      : commonNode.parentElement;

  if (commonElement && !root.contains(commonElement)) {
    return null;
  }

  const rangeRect = range.getBoundingClientRect();
  const rect = mergeClientRects(
    Array.from(range.getClientRects()).filter(
      (clientRect) => clientRect.width > 0 || clientRect.height > 0,
    ),
    rangeRect,
  );

  if (!rect) return null;

  return {
    text,
    anchor: {
      left: rect.left + window.scrollX + rect.width / 2,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
    },
  };
}

export function getTextareaSelectionState(
  textarea: HTMLTextAreaElement | null | undefined,
): { text: string; anchor: EditorSelectionAnchor; start: number; end: number } | null {
  if (!textarea || typeof window === "undefined") return null;

  const start = textarea.selectionStart ?? 0;
  const end = textarea.selectionEnd ?? 0;
  if (end <= start) return null;

  const text = textarea.value.slice(start, end).trim();
  if (!text) return null;

  return {
    text,
    anchor: measureTextareaSelectionAnchor(textarea, start, end),
    start,
    end,
  };
}

function measureTextareaSelectionAnchor(
  textarea: HTMLTextAreaElement,
  start: number,
  end: number,
): EditorSelectionAnchor {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const beforeSelection = document.createTextNode(textarea.value.slice(0, start));
  const selectionSpan = document.createElement("span");
  const properties = [
    "boxSizing",
    "width",
    "height",
    "overflowX",
    "overflowY",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "fontFamily",
    "fontSize",
    "fontStyle",
    "fontWeight",
    "letterSpacing",
    "lineHeight",
    "textTransform",
    "textIndent",
    "textAlign",
    "whiteSpace",
    "wordSpacing",
  ] as const;

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflow = "hidden";

  const textareaRect = textarea.getBoundingClientRect();
  mirror.style.top = `${textareaRect.top + window.scrollY}px`;
  mirror.style.left = `${textareaRect.left + window.scrollX}px`;

  for (const property of properties) {
    (mirror.style as any)[property] = computed[property];
  }

  selectionSpan.textContent = textarea.value.slice(start, end) || "\u200b";
  mirror.appendChild(beforeSelection);
  mirror.appendChild(selectionSpan);
  document.body.appendChild(mirror);
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;

  const rect = selectionSpan.getBoundingClientRect();
  document.body.removeChild(mirror);

  return {
    left: rect.left + window.scrollX + rect.width / 2,
    top: rect.top + window.scrollY,
    bottom: rect.bottom + window.scrollY,
  };
}

function mergeClientRects(
  rects: DOMRect[],
  fallbackRect: DOMRect,
): DOMRect | null {
  if (rects.length === 0) {
    if (fallbackRect.width > 0 || fallbackRect.height > 0) {
      return fallbackRect;
    }

    return null;
  }

  let left = rects[0].left;
  let right = rects[0].right;
  let top = rects[0].top;
  let bottom = rects[0].bottom;

  for (const rect of rects.slice(1)) {
    left = Math.min(left, rect.left);
    right = Math.max(right, rect.right);
    top = Math.min(top, rect.top);
    bottom = Math.max(bottom, rect.bottom);
  }

  return new DOMRect(left, top, right - left, bottom - top);
}
