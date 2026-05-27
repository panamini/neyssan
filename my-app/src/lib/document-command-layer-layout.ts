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
export type CommandLayerToolbarDensity = "compact" | "ultra" | undefined;
export type CommandLayerLabelDensity = "full" | "short" | "icon";

export type ComputeDocumentCommandLayerLayoutInput = {
  canvasRect: CommandLayerRect;
  paperRect: CommandLayerRect;
  zoom: number;
  toolbarNaturalWidth: number;
  toolbarMinWidth: number;
  toolbarHeight: number;
  toolbarTop?: number;
  stickyTop: number;
  askHandle: {
    iconWidth: number;
    height: number;
  };
  safeMargin: number;
  gap: number;
  askOffsetFromPaperTop: number;
  viewportWidth?: number;
};

export type DocumentCommandLayerLayout = {
  toolbarMode: CommandLayerToolbarMode;
  draftLabelMode: CommandLayerDraftLabelMode;
  modeControlMode: CommandLayerModeControlMode;
  askMode: CommandLayerAskMode;
  commandLayerY: number;
  toolbarRect: CommandLayerRect;
  askRect: CommandLayerRect;
  askOutsidePaper: boolean;
  askConstrained: boolean;
  toolbarSticky: boolean;
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
const ASK_COMPACT_PAPER_WIDTH = 360;

function askPaperGapFor(paperWidth: number, gap: number) {
  if (paperWidth >= ASK_COMPACT_PAPER_WIDTH) return gap;
  return Math.min(4, gap);
}

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

export function getCommandLayerToolbarDensity(
  toolbarMode: CommandLayerToolbarMode,
): CommandLayerToolbarDensity {
  if (toolbarMode === "wide" || toolbarMode === "medium") return undefined;
  return toolbarMode === "ultraCompact" ? "ultra" : "compact";
}

export function getCommandLayerLabelDensity(
  labelMode: CommandLayerDraftLabelMode,
): CommandLayerLabelDensity {
  return labelMode === "iconOnly" ? "icon" : labelMode;
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
  if (
    viewportWidth !== undefined &&
    viewportWidth < DRAFT_ICON_VIEWPORT_MAX_WIDTH
  ) {
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
  const paperCenterX = centerX(input.paperRect);
  const unclampedToolbarWidth = Math.max(
    input.toolbarMinWidth,
    Math.min(
      input.toolbarNaturalWidth,
      Math.max(input.paperRect.width, input.toolbarMinWidth),
    ),
  );
  const toolbarTopAnchor = input.toolbarTop ?? input.paperRect.top;
  const commandLayerNormalY =
    toolbarTopAnchor - input.gap - input.toolbarHeight;
  const commandLayerSticky = commandLayerNormalY < input.stickyTop;
  const commandLayerY = Math.max(commandLayerNormalY, input.stickyTop);

  const makeToolbarPlacement = (toolbarSafeRight: number) => {
    const toolbarSafeWidth = Math.max(0, toolbarSafeRight - canvasSafeLeft);
    const toolbarWidth =
      toolbarSafeWidth >= input.toolbarMinWidth
        ? Math.min(unclampedToolbarWidth, toolbarSafeWidth)
        : input.toolbarMinWidth;
    const desiredToolbarLeft = paperCenterX - toolbarWidth / 2;
    const toolbarLeft = clamp(
      desiredToolbarLeft,
      canvasSafeLeft,
      toolbarSafeRight - toolbarWidth,
    );
    return {
      desiredLeft: desiredToolbarLeft,
      rect: {
        left: toolbarLeft,
        top: commandLayerY,
        width: toolbarWidth,
        height: input.toolbarHeight,
      },
    };
  };

  let toolbarPlacement = makeToolbarPlacement(canvasSafeRight);
  let toolbarRect = toolbarPlacement.rect;

  const askTop = Math.max(
    input.paperRect.top + input.askOffsetFromPaperTop,
    input.stickyTop,
  );
  const askPaperGap = askPaperGapFor(input.paperRect.width, input.gap);

  const placeAsk = () => {
    const paperSideAskLeft = right(input.paperRect) + askPaperGap;
    const canUsePaperSide =
      paperSideAskLeft + input.askHandle.iconWidth <= canvasSafeRight;
    if (canUsePaperSide) {
      return {
        mode: "iconOnly" as const,
        width: input.askHandle.iconWidth,
        left: paperSideAskLeft,
        outsidePaper: true,
      };
    }

    const edgeTabInset = Math.max(input.gap, ASK_EDGE_INSET);
    const edgeTabMaxLeft = Math.max(
      canvasSafeLeft,
      edgeTabSafeRight - input.askHandle.iconWidth - edgeTabInset,
    );
    const edgeTabPreferredLeft = paperSideAskLeft;
    const edgeTabLeft = clamp(
      edgeTabPreferredLeft,
      canvasSafeLeft,
      edgeTabMaxLeft,
    );
    return {
      mode: "edgeTab" as const,
      width: input.askHandle.iconWidth,
      left: edgeTabLeft,
      outsidePaper: edgeTabLeft >= right(input.paperRect) + askPaperGap - 0.5,
    };
  };

  let askPlacement = placeAsk();
  let askRect = {
    left: askPlacement.left,
    top: askTop,
    width: askPlacement.width,
    height: input.askHandle.height,
  };

  if (intersects(askRect, toolbarRect)) {
    const rightOfToolbarAskLeft = right(toolbarRect) + input.gap;
    if (rightOfToolbarAskLeft + input.askHandle.iconWidth <= canvasSafeRight) {
      askPlacement = {
        mode: "iconOnly" as const,
        width: input.askHandle.iconWidth,
        left: rightOfToolbarAskLeft,
        outsidePaper: rightOfToolbarAskLeft >= right(input.paperRect),
      };
    }
    askRect = {
      left: askPlacement.left,
      top: askTop,
      width: askPlacement.width,
      height: input.askHandle.height,
    };
  }

  if (intersects(askRect, toolbarRect)) {
    const leftOfToolbarAskLeft = toolbarRect.left - input.gap - askRect.width;
    if (leftOfToolbarAskLeft >= canvasSafeLeft) {
      askPlacement = {
        mode: "edgeTab" as const,
        width: input.askHandle.iconWidth,
        left: leftOfToolbarAskLeft,
        outsidePaper: false,
      };
      askRect = {
        left: askPlacement.left,
        top: askTop,
        width: askPlacement.width,
        height: input.askHandle.height,
      };
    }
  }

  if (intersects(askRect, toolbarRect)) {
    askRect = {
      ...askRect,
      top: toolbarRect.top + toolbarRect.height + input.gap,
    };
  }

  const askMode: CommandLayerAskMode = askPlacement.mode;
  const askOutsidePaper = askPlacement.outsidePaper;
  const toolbarClamped =
    Math.abs(toolbarRect.left - toolbarPlacement.desiredLeft) > 0.5;
  const toolbarMode = toolbarModeFor(toolbarRect.width);
  const draftLabelMode = draftLabelModeFor({
    availableWidth: toolbarRect.width,
    paperWidth: input.paperRect.width,
    viewportWidth: input.viewportWidth,
    toolbarMode,
  });
  const modeControlMode: CommandLayerModeControlMode =
    toolbarMode === "ultraCompact" ? "toggle" : "split";

  return {
    toolbarMode,
    draftLabelMode,
    modeControlMode,
    askMode,
    commandLayerY,
    toolbarRect,
    askRect,
    askOutsidePaper,
    askConstrained: askMode === "edgeTab",
    toolbarSticky: commandLayerSticky,
    toolbarClamped,
  };
}
