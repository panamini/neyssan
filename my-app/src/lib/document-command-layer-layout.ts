export type CommandLayerRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type CommandLayerToolbarMode =
  | "wide"
  | "medium"
  | "compact"
  | "ultraCompact";
export type CommandLayerDraftLabelMode = "full" | "short" | "iconOnly";
export type CommandLayerModeControlMode = "split" | "toggle";
export type CommandLayerAskMode = "iconOnly" | "edgeTab";

export type ComputeDocumentCommandLayerLayoutInput = {
  canvasRect: CommandLayerRect;
  paperRect: CommandLayerRect;
  zoom: number;
  toolbarNaturalWidth: number;
  toolbarMinWidth: number;
  toolbarHeight: number;
  askHandle: {
    iconWidth: number;
    height: number;
  };
  safeMargin: number;
  gap: number;
  topOffset: number;
  viewportWidth?: number;
};

export type DocumentCommandLayerLayout = {
  toolbarMode: CommandLayerToolbarMode;
  draftLabelMode: CommandLayerDraftLabelMode;
  modeControlMode: CommandLayerModeControlMode;
  askMode: CommandLayerAskMode;
  toolbarRect: CommandLayerRect;
  askRect: CommandLayerRect;
  askOutsidePaper: boolean;
  askConstrained: boolean;
  toolbarClamped: boolean;
};

const TOOLBAR_WIDE_MIN = 640;
const TOOLBAR_MEDIUM_MIN = 520;
const TOOLBAR_COMPACT_MIN = 360;
const DRAFT_FULL_MIN_AVAILABLE_WIDTH = 520;
const DRAFT_FULL_MIN_PAPER_WIDTH = 640;
const DRAFT_SHORT_MIN_AVAILABLE_WIDTH = 360;
const DRAFT_ICON_VIEWPORT_MAX_WIDTH = 520;
const ASK_EDGE_INSET = 8;
const ASK_EDGE_VIEWPORT_ANCHOR_MAX_WIDTH = 520;

function right(rect: CommandLayerRect) {
  return rect.left + rect.width;
}

function bottom(rect: CommandLayerRect) {
  return rect.top + rect.height;
}

function centerX(rect: CommandLayerRect) {
  return rect.left + rect.width / 2;
}

function clamp(value: number, min: number, max: number) {
  if (max < min) return min;
  return Math.min(Math.max(value, min), max);
}

function intersects(a: CommandLayerRect, b: CommandLayerRect) {
  return (
    a.left < right(b) &&
    right(a) > b.left &&
    a.top < bottom(b) &&
    bottom(a) > b.top
  );
}

function toolbarModeFor(width: number): CommandLayerToolbarMode {
  if (width >= TOOLBAR_WIDE_MIN) return "wide";
  if (width >= TOOLBAR_MEDIUM_MIN) return "medium";
  if (width >= TOOLBAR_COMPACT_MIN) return "compact";
  return "ultraCompact";
}

function draftLabelModeFor({
  availableWidth,
  paperWidth,
  viewportWidth,
  toolbarMode,
}: {
  availableWidth: number;
  paperWidth: number;
  viewportWidth?: number;
  toolbarMode: CommandLayerToolbarMode;
}): CommandLayerDraftLabelMode {
  // These thresholds are command geometry, not typography hacks:
  // full label needs room for all toolbar groups; short label is allowed only
  // above the minimum compact command width; ultra/narrow windows are icon-only.
  if (toolbarMode === "ultraCompact") return "iconOnly";
  if (viewportWidth !== undefined && viewportWidth < DRAFT_ICON_VIEWPORT_MAX_WIDTH) {
    return "iconOnly";
  }
  if (
    availableWidth >= DRAFT_FULL_MIN_AVAILABLE_WIDTH &&
    paperWidth >= DRAFT_FULL_MIN_PAPER_WIDTH
  ) {
    return "full";
  }
  if (availableWidth >= DRAFT_SHORT_MIN_AVAILABLE_WIDTH) return "short";
  return "iconOnly";
}

export function computeDocumentCommandLayerLayout(
  input: ComputeDocumentCommandLayerLayoutInput,
): DocumentCommandLayerLayout {
  const canvasSafeLeft = input.canvasRect.left + input.safeMargin;
  const canvasSafeRight = right(input.canvasRect) - input.safeMargin;
  const edgeTabSafeRight = canvasSafeRight;
  const canvasSafeWidth = Math.max(0, canvasSafeRight - canvasSafeLeft);
  const paperCenterX = centerX(input.paperRect);
  const unclampedToolbarWidth = Math.max(
    input.toolbarMinWidth,
    Math.min(input.toolbarNaturalWidth, Math.max(input.paperRect.width, input.toolbarMinWidth)),
  );
  const toolbarWidth =
    canvasSafeWidth >= input.toolbarMinWidth
      ? Math.min(unclampedToolbarWidth, canvasSafeWidth)
      : input.toolbarMinWidth;
  const desiredToolbarLeft = paperCenterX - toolbarWidth / 2;
  const toolbarLeft = clamp(
    desiredToolbarLeft,
    canvasSafeLeft,
    canvasSafeRight - toolbarWidth,
  );
  const toolbarRect = {
    left: toolbarLeft,
    top: Math.max(input.canvasRect.top, input.paperRect.top - input.gap - input.toolbarHeight),
    width: toolbarWidth,
    height: input.toolbarHeight,
  };
  const toolbarClamped = Math.abs(toolbarLeft - desiredToolbarLeft) > 0.5;
  const toolbarMode = toolbarModeFor(toolbarWidth);
  const draftLabelMode = draftLabelModeFor({
    availableWidth: toolbarWidth,
    paperWidth: input.paperRect.width,
    viewportWidth: input.viewportWidth,
    toolbarMode,
  });
  const modeControlMode: CommandLayerModeControlMode =
    toolbarMode === "ultraCompact" ? "toggle" : "split";

  const iconAskLeft = right(input.paperRect) + input.gap;
  const askTop = input.paperRect.top + input.topOffset;
  const iconAskFits =
    iconAskLeft + input.askHandle.iconWidth <= canvasSafeRight;

  let askMode: CommandLayerAskMode;
  let askWidth: number;
  let askLeft: number;
  let askOutsidePaper: boolean;

  if (iconAskFits) {
    askMode = "iconOnly";
    askWidth = input.askHandle.iconWidth;
    askLeft = iconAskLeft;
    askOutsidePaper = true;
  } else {
    askMode = "edgeTab";
    askWidth = input.askHandle.iconWidth;
    const edgeTabMaxLeft = Math.max(canvasSafeLeft, edgeTabSafeRight - askWidth);
    const edgeTabPreferredLeft =
      input.canvasRect.width < ASK_EDGE_VIEWPORT_ANCHOR_MAX_WIDTH
        ? edgeTabMaxLeft
        : Math.min(right(input.paperRect) - askWidth - ASK_EDGE_INSET, edgeTabMaxLeft);
    askLeft = clamp(
      edgeTabPreferredLeft,
      canvasSafeLeft,
      edgeTabMaxLeft,
    );
    askOutsidePaper = askLeft >= right(input.paperRect) + input.gap - 0.5;
  }

  let askRect = {
    left: askLeft,
    top: askTop,
    width: askWidth,
    height: input.askHandle.height,
  };

  if (intersects(askRect, toolbarRect)) {
    askMode = "edgeTab";
    askWidth = input.askHandle.iconWidth;
    const edgeTabMaxLeft = Math.max(canvasSafeLeft, edgeTabSafeRight - askWidth);
    askLeft = clamp(
      Math.min(right(input.paperRect) - askWidth - ASK_EDGE_INSET, edgeTabMaxLeft),
      canvasSafeLeft,
      edgeTabMaxLeft,
    );
    askRect = {
      left: askLeft,
      top: Math.max(input.paperRect.top + input.topOffset, bottom(toolbarRect) + input.gap),
      width: askWidth,
      height: input.askHandle.height,
    };
    askOutsidePaper = askLeft >= right(input.paperRect) + input.gap - 0.5;
  }

  return {
    toolbarMode,
    draftLabelMode,
    modeControlMode,
    askMode,
    toolbarRect,
    askRect,
    askOutsidePaper,
    askConstrained: askMode === "edgeTab",
    toolbarClamped,
  };
}
