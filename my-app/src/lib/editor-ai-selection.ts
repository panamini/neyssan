import type React from "react";

export type EditorSelectionAnchor = {
  left: number;
  top: number;
  bottom: number;
  leftEdge?: number;
  rightEdge?: number;
  width?: number;
  height?: number;
  lineCount?: number;
  aboveCenter?: number;
  aboveLeft?: number;
  aboveRight?: number;
  aboveLineHeight?: number;
  belowCenter?: number;
  belowLeft?: number;
  belowRight?: number;
  belowLineHeight?: number;
  focusCenter?: number;
  focusLeft?: number;
  focusRight?: number;
  focusTop?: number;
  focusBottom?: number;
  focusLineHeight?: number;
  containerLeft?: number;
  containerRight?: number;
  containerTop?: number;
  containerBottom?: number;
};

export const INLINE_AI_TOOLBAR_SELECTOR = "[data-inline-ai-toolbar='true']";
export const INLINE_PAPER_EDITABLE_SELECTOR =
  '[data-inline-paper-editable="true"]';
export const INLINE_PAPER_FORMATTING_KEY_ATTR =
  "data-inline-paper-formatting-key";
export const INLINE_PAPER_FORMATTING_SELECTOR = `[${INLINE_PAPER_FORMATTING_KEY_ATTR}]`;

export type InlinePaperFormattingAction = {
  id: string;
  label: string;
  title?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onRun: () => void;
  onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const inlinePaperFormattingProviders = new Map<
  string,
  () => InlinePaperFormattingAction[]
>();

export function registerInlinePaperFormattingProvider(
  key: string,
  provider: () => InlinePaperFormattingAction[],
): () => void {
  inlinePaperFormattingProviders.set(key, provider);
  return () => {
    if (inlinePaperFormattingProviders.get(key) === provider) {
      inlinePaperFormattingProviders.delete(key);
    }
  };
}

function closestInlinePaperFormattingElement(
  node: Node | null | undefined,
): HTMLElement | null {
  const element =
    node instanceof Element
      ? node
      : node?.parentElement instanceof HTMLElement
        ? node.parentElement
        : null;

  return element?.closest<HTMLElement>(INLINE_PAPER_FORMATTING_SELECTOR) ?? null;
}

export function getInlinePaperFormattingActionsForSelection(
  selection: Selection | null | undefined =
    typeof window !== "undefined" ? window.getSelection() : null,
): InlinePaperFormattingAction[] {
  if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
    return [];
  }

  const range = selection.getRangeAt(0);
  const candidates = [
    selection.focusNode,
    selection.anchorNode,
    range.startContainer,
    range.endContainer,
    range.commonAncestorContainer,
  ]
    .map(closestInlinePaperFormattingElement)
    .filter((element): element is HTMLElement => Boolean(element));
  const uniqueCandidates = Array.from(new Set(candidates));

  if (uniqueCandidates.length !== 1) {
    return [];
  }

  const key = uniqueCandidates[0].getAttribute(
    INLINE_PAPER_FORMATTING_KEY_ATTR,
  );
  if (!key) {
    return [];
  }

  return inlinePaperFormattingProviders.get(key)?.() ?? [];
}

let pointerTrackingInitialized = false;
let primaryPointerPressed = false;

function ensurePointerTracking(): void {
  if (pointerTrackingInitialized || typeof document === "undefined") {
    return;
  }

  pointerTrackingInitialized = true;
  document.addEventListener("pointerdown", (event) => {
    if (event.isPrimary !== false) {
      primaryPointerPressed = true;
    }
  });
  document.addEventListener("pointerup", () => {
    primaryPointerPressed = false;
  });
  document.addEventListener("pointercancel", () => {
    primaryPointerPressed = false;
  });
  window.addEventListener("blur", () => {
    primaryPointerPressed = false;
  });
}

export function isPrimaryPointerPressed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  ensurePointerTracking();
  return primaryPointerPressed;
}

export function isInlineAiToolbarActiveElement(
  activeElement: Element | null | undefined =
    typeof document !== "undefined" ? document.activeElement : null,
): boolean {
  if (!activeElement || typeof activeElement.closest !== "function") {
    return false;
  }

  return Boolean(activeElement.closest(INLINE_AI_TOOLBAR_SELECTOR));
}

function closestInlinePaperEditable(
  node: Node | null | undefined,
  root: HTMLElement,
): HTMLElement | null {
  const element =
    node instanceof Element
      ? node
      : node?.parentElement instanceof HTMLElement
        ? node.parentElement
        : null;
  const editable =
    element?.closest<HTMLElement>(INLINE_PAPER_EDITABLE_SELECTOR) ?? null;

  return editable && root.contains(editable) ? editable : null;
}

export function findInlinePaperEditableForSelection(
  root: HTMLElement | null | undefined,
  selection: Selection | null | undefined =
    typeof window !== "undefined" ? window.getSelection() : null,
): HTMLElement | null {
  if (!root || !selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0);
  const candidateNodes = [
    selection.focusNode,
    selection.anchorNode,
    range.startContainer,
    range.endContainer,
    range.commonAncestorContainer,
  ];
  const candidates = Array.from(
    new Set(
      candidateNodes
        .map((node) => closestInlinePaperEditable(node, root))
        .filter((element): element is HTMLElement => Boolean(element)),
    ),
  );

  if (candidates.length === 1) {
    return candidates[0];
  }

  const intersecting = Array.from(
    root.querySelectorAll<HTMLElement>(INLINE_PAPER_EDITABLE_SELECTOR),
  ).filter((element) => {
    try {
      return range.intersectsNode(element);
    } catch {
      return false;
    }
  });

  const uniqueIntersecting = Array.from(new Set(intersecting));
  if (uniqueIntersecting.length === 1) {
    return uniqueIntersecting[0];
  }

  return null;
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
  return getDomRangeSelectionState(root, range, text, {
    focusNode: selection.focusNode,
    focusOffset: selection.focusOffset,
    isBackward: isSelectionBackward(selection),
  });
}

export function getDomRangeSelectionState(
  root: HTMLElement | null | undefined,
  range: Range | null | undefined,
  text: string,
  focus?: {
    focusNode?: Node | null;
    focusOffset?: number;
    isBackward?: boolean;
  },
): { text: string; anchor: EditorSelectionAnchor } | null {
  if (!root || !range || typeof window === "undefined") return null;

  const trimmedText = text.trim();
  if (!trimmedText) return null;

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

  const clientRects = Array.from(range.getClientRects()).filter(
    (clientRect) => clientRect.width > 0 || clientRect.height > 0,
  );
  const sortedRects = [...clientRects].sort((a, b) => {
    if (Math.abs(a.top - b.top) > 1) {
      return a.top - b.top;
    }

    return a.left - b.left;
  });
  const firstLineRect = sortedRects[0] ?? rect;
  const lastLineRect = sortedRects[sortedRects.length - 1] ?? rect;
  const containerRect = root.getBoundingClientRect();
  const focusRect =
    measureCollapsedSelectionRect(focus?.focusNode ?? null, focus?.focusOffset ?? 0) ??
    (focus?.isBackward ? firstLineRect : lastLineRect);

  return {
    text: trimmedText,
    anchor: {
      left: rect.left + window.scrollX + rect.width / 2,
      top: rect.top + window.scrollY,
      bottom: rect.bottom + window.scrollY,
      leftEdge: rect.left + window.scrollX,
      rightEdge: rect.right + window.scrollX,
      width: rect.width,
      height: rect.height,
      lineCount: sortedRects.length || 1,
      aboveCenter:
        firstLineRect.left + window.scrollX + firstLineRect.width / 2,
      aboveLeft: firstLineRect.left + window.scrollX,
      aboveRight: firstLineRect.right + window.scrollX,
      aboveLineHeight: firstLineRect.height,
      belowCenter:
        lastLineRect.left + window.scrollX + lastLineRect.width / 2,
      belowLeft: lastLineRect.left + window.scrollX,
      belowRight: lastLineRect.right + window.scrollX,
      belowLineHeight: lastLineRect.height,
      focusCenter: focusRect.left + window.scrollX + focusRect.width / 2,
      focusLeft: focusRect.left + window.scrollX,
      focusRight: focusRect.right + window.scrollX,
      focusTop: focusRect.top + window.scrollY,
      focusBottom: focusRect.bottom + window.scrollY,
      focusLineHeight: focusRect.height,
      containerLeft: containerRect.left + window.scrollX,
      containerRight: containerRect.right + window.scrollX,
      containerTop: containerRect.top + window.scrollY,
      containerBottom: containerRect.bottom + window.scrollY,
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
    "wordBreak",
    "overflowWrap",
    "wordSpacing",
    "tabSize",
    "direction",
    "scrollbarGutter",
  ] as const;

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.pointerEvents = "none";
  mirror.style.whiteSpace = "pre-wrap";
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
  const lineCount = Math.max(1, textarea.value.slice(start, end).split("\n").length);
  document.body.removeChild(mirror);

  return {
    left: rect.left + window.scrollX + rect.width / 2,
    top: rect.top + window.scrollY,
    bottom: rect.bottom + window.scrollY,
    leftEdge: rect.left + window.scrollX,
    rightEdge: rect.right + window.scrollX,
    width: rect.width,
    height: rect.height,
    lineCount,
    aboveCenter: rect.left + window.scrollX + rect.width / 2,
    aboveLeft: rect.left + window.scrollX,
    aboveRight: rect.right + window.scrollX,
    aboveLineHeight: rect.height,
    belowCenter: rect.left + window.scrollX + rect.width / 2,
    belowLeft: rect.left + window.scrollX,
    belowRight: rect.right + window.scrollX,
    belowLineHeight: rect.height,
    focusCenter: rect.left + window.scrollX + rect.width / 2,
    focusLeft: rect.left + window.scrollX,
    focusRight: rect.right + window.scrollX,
    focusTop: rect.top + window.scrollY,
    focusBottom: rect.bottom + window.scrollY,
    focusLineHeight: rect.height,
    containerLeft: textareaRect.left + window.scrollX,
    containerRight: textareaRect.right + window.scrollX,
    containerTop: textareaRect.top + window.scrollY,
    containerBottom: textareaRect.bottom + window.scrollY,
  };
}

function measureCollapsedSelectionRect(
  node: Node | null,
  offset: number,
): DOMRect | null {
  if (!node) {
    return null;
  }

  try {
    const range = document.createRange();
    range.setStart(node, offset);
    range.setEnd(node, offset);
    const rects = Array.from(range.getClientRects()).filter(
      (rect) => rect.width > 0 || rect.height > 0,
    );
    const rect = rects[0] ?? range.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      return rect;
    }
  } catch {
    return null;
  }

  return null;
}

function isSelectionBackward(selection: Selection): boolean {
  if (!selection.anchorNode || !selection.focusNode) {
    return false;
  }

  try {
    const probe = document.createRange();
    probe.setStart(selection.anchorNode, selection.anchorOffset);
    probe.setEnd(selection.focusNode, selection.focusOffset);
    return probe.collapsed;
  } catch {
    return false;
  }
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
