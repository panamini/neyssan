export type EditorSelectionAnchor = {
  left: number;
  top: number;
};

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

  const endpointRect = readSelectionEndpointRect(selection, root);
  const clientRects = Array.from(
    (endpointRect ? [endpointRect] : Array.from(range.getClientRects())).filter(
      (rect) => rect.width > 0 || rect.height > 0,
    ),
  );
  const rect =
    clientRects[clientRects.length - 1] ??
    (range.getBoundingClientRect().width > 0
      ? range.getBoundingClientRect()
      : null);

  if (!rect) return null;

  return {
    text,
    anchor: {
      left: rect.right + window.scrollX,
      top: rect.bottom + window.scrollY,
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

  const rawText = textarea.value.slice(start, end);
  const text = rawText.trim();
  if (!text) return null;

  const anchorIndex =
    textarea.selectionDirection === "backward" ? start : end;
  return {
    text,
    anchor: measureTextareaAnchor(textarea, anchorIndex),
    start,
    end,
  };
}

function readSelectionEndpointRect(
  selection: Selection,
  root: HTMLElement,
): DOMRect | null {
  const focusNode = selection.focusNode;
  if (!focusNode) {
    return null;
  }

  const focusElement =
    focusNode.nodeType === Node.ELEMENT_NODE
      ? (focusNode as HTMLElement)
      : focusNode.parentElement;

  if (focusElement && !root.contains(focusElement)) {
    return null;
  }

  try {
    const endpointRange = document.createRange();
    const safeOffset = getSafeSelectionOffset(focusNode, selection.focusOffset);
    endpointRange.setStart(focusNode, safeOffset);
    endpointRange.setEnd(focusNode, safeOffset);

    const clientRects = Array.from(endpointRange.getClientRects()).filter(
      (rect) => rect.width > 0 || rect.height > 0,
    );
    const boundingRect = endpointRange.getBoundingClientRect();
    return (
      clientRects[clientRects.length - 1] ??
      (boundingRect.width > 0 || boundingRect.height > 0
        ? boundingRect
        : null)
    );
  } catch {
    return null;
  }
}

function getSafeSelectionOffset(node: Node, offset: number): number {
  if (node.nodeType === Node.TEXT_NODE) {
    return Math.min(Math.max(offset, 0), node.textContent?.length ?? 0);
  }

  return Math.min(Math.max(offset, 0), node.childNodes.length);
}

function measureTextareaAnchor(
  textarea: HTMLTextAreaElement,
  end: number,
): EditorSelectionAnchor {
  const computed = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");
  const caretSpan = document.createElement("span");
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

  mirror.textContent = textarea.value.slice(0, end);
  caretSpan.textContent = "\u200b";
  mirror.appendChild(caretSpan);
  document.body.appendChild(mirror);
  mirror.scrollTop = textarea.scrollTop;
  mirror.scrollLeft = textarea.scrollLeft;

  const rect = caretSpan.getBoundingClientRect();
  document.body.removeChild(mirror);

  return {
    left: rect.right + window.scrollX,
    top: rect.bottom + window.scrollY,
  };
}
