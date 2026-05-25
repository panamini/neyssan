import React from "react";
import type { EditorSelectionAnchor } from "./editor-ai-selection";

export type DocumentAiSurfacePlacement =
  | "above"
  | "below"
  | "right"
  | "left"
  | "center"
  | "sheet";

export type DocumentAiSurfaceState = "toolbar" | "loading" | "result" | "applied";
export type DocumentAiSurfaceMode = "popover" | "sheet";
export type DocumentAiSurfaceBreakpoint = "desktop" | "narrow";

export type DocumentAiSurfaceRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

export type DocumentAiSurfaceSize = {
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
};

export type DocumentAiSurfacePosition = {
  placement: DocumentAiSurfacePlacement;
  left: number;
  top: number;
  maxWidth: number;
  maxHeight: number;
  clamped: boolean;
  mode: DocumentAiSurfaceMode;
};

export type DocumentAiSurfacePositionInput = {
  anchor?: EditorSelectionAnchor | null;
  visibleStageRect?: DocumentAiSurfaceRect | null;
  paperRect?: DocumentAiSurfaceRect | null;
  topIslandRect?: DocumentAiSurfaceRect | null;
  leftDrawerRect?: DocumentAiSurfaceRect | null;
  viewportRect: DocumentAiSurfaceRect;
  desiredSurfaceSize: DocumentAiSurfaceSize;
  mode: DocumentAiSurfaceState;
  breakpoint: DocumentAiSurfaceBreakpoint;
  preferredPlacement?: DocumentAiSurfacePlacement | null;
  preferredSurfaceCenterX?: number | null;
  safeMargin?: number;
  gap?: number;
  edgePadding?: number;
};

type Bounds = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
  height: number;
};

const DEFAULT_SAFE_MARGIN = 12;
const DEFAULT_GAP = 8;
const DEFAULT_EDGE_PADDING = 4;
const DOCUMENT_OVERFLOW_ALLOWANCE = 160;
const SHEET_MAX_VIEWPORT_RATIO = 0.78;
const RESULT_MIN_CONNECTED_HEIGHT = 156;

export function documentAiSurfaceRectFromDom(
  rect: DOMRect | ClientRect,
  scrollX = 0,
  scrollY = 0,
): DocumentAiSurfaceRect {
  return {
    left: rect.left + scrollX,
    top: rect.top + scrollY,
    right: rect.right + scrollX,
    bottom: rect.bottom + scrollY,
    width: rect.width,
    height: rect.height,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), Math.max(min, max));
}

function finiteOr(value: number | undefined, fallback: number): number {
  return Number.isFinite(value) ? Number(value) : fallback;
}

function normalizeRect(rect: DocumentAiSurfaceRect | null | undefined) {
  if (!rect || rect.width <= 0 || rect.height <= 0) return null;
  return rect;
}

function buildBounds({
  visibleStageRect,
  paperRect,
  topIslandRect,
  leftDrawerRect,
  viewportRect,
  safeMargin,
  allowDocumentOverflow = false,
}: Pick<
  DocumentAiSurfacePositionInput,
  | "visibleStageRect"
  | "paperRect"
  | "topIslandRect"
  | "leftDrawerRect"
  | "viewportRect"
> & { safeMargin: number; allowDocumentOverflow?: boolean }): Bounds {
  const stage = normalizeRect(visibleStageRect) ?? normalizeRect(paperRect);
  const drawer = normalizeRect(leftDrawerRect);
  const topIsland = normalizeRect(topIslandRect);
  const viewportLeft = viewportRect.left + safeMargin;
  const viewportRight = viewportRect.right - safeMargin;
  const viewportTop = viewportRect.top + safeMargin;
  const viewportBottom = viewportRect.bottom - safeMargin;
  const stageHorizontalAllowance = stage && allowDocumentOverflow
    ? Math.min(DOCUMENT_OVERFLOW_ALLOWANCE, viewportRect.width * 0.14)
    : 0;
  const stageVerticalAllowance = 0;
  const left = Math.max(
    viewportLeft,
    stage
      ? stage.left - stageHorizontalAllowance + DEFAULT_EDGE_PADDING
      : viewportLeft,
    drawer ? drawer.right + safeMargin : viewportLeft,
  );
  const right = Math.min(
    viewportRight,
    stage
      ? stage.right + stageHorizontalAllowance - DEFAULT_EDGE_PADDING
      : viewportRight,
  );
  const top = Math.max(
    viewportTop,
    stage ? stage.top - stageVerticalAllowance + DEFAULT_EDGE_PADDING : viewportTop,
    topIsland ? topIsland.bottom + safeMargin : viewportTop,
  );
  const bottom = Math.min(
    viewportBottom,
    stage
      ? stage.bottom + stageVerticalAllowance - DEFAULT_EDGE_PADDING
      : viewportBottom,
  );

  if (right <= left || bottom <= top) {
    return {
      left: viewportLeft,
      right: viewportRight,
      top: viewportTop,
      bottom: viewportBottom,
      width: Math.max(0, viewportRight - viewportLeft),
      height: Math.max(0, viewportBottom - viewportTop),
    };
  }

  return {
    left,
    right,
    top,
    bottom,
    width: right - left,
    height: bottom - top,
  };
}

function getAnchorGeometry(anchor: EditorSelectionAnchor) {
  const selectionLeft = finiteOr(anchor.leftEdge, anchor.left);
  const selectionRight = finiteOr(anchor.rightEdge, anchor.left);
  const hasSelectionHorizontalBounds =
    Number.isFinite(anchor.leftEdge) && Number.isFinite(anchor.rightEdge);
  const focusCenter = anchor.focusCenter;
  const focusMatchesSelection =
    !hasSelectionHorizontalBounds ||
    typeof focusCenter !== "number" ||
    (focusCenter >= selectionLeft - DEFAULT_EDGE_PADDING &&
      focusCenter <= selectionRight + DEFAULT_EDGE_PADDING);
  const focusTop =
    anchor.focusTop ??
    (anchor.belowLineHeight
      ? (anchor.bottom ?? anchor.top) - anchor.belowLineHeight
      : anchor.top);
  const focusBottom =
    anchor.focusBottom ??
    (anchor.focusLineHeight
      ? focusTop + anchor.focusLineHeight
      : anchor.bottom ?? anchor.top);
  const focusLineHeight = Math.max(
    DEFAULT_EDGE_PADDING,
    anchor.focusLineHeight ??
      anchor.belowLineHeight ??
      anchor.height ??
      DEFAULT_EDGE_PADDING,
  );
  const isBlockSelection =
    (anchor.lineCount ?? 1) > 1 ||
    (anchor.height ?? 0) > focusLineHeight * 1.5;
  const top = isBlockSelection
    ? anchor.top
    : focusMatchesSelection
      ? focusTop
      : anchor.top;
  const bottom = isBlockSelection
    ? anchor.bottom ?? focusBottom
    : focusMatchesSelection
      ? focusBottom
      : anchor.bottom ?? focusBottom;

  return {
    top,
    bottom,
    centerY: top + Math.max(1, bottom - top) / 2,
    isBlockSelection,
    focusMatchesSelection,
  };
}

export function computeDocumentAiSurfaceHorizontalLeft({
  surfaceWidth,
  boundsLeft,
  boundsRight,
  preferredCenter,
  preferredLeftEdge,
  preferredRightEdge,
  selectionWidth,
  edgePadding = DEFAULT_EDGE_PADDING,
}: {
  surfaceWidth: number;
  boundsLeft: number;
  boundsRight: number;
  preferredCenter: number;
  preferredLeftEdge: number;
  preferredRightEdge: number;
  selectionWidth: number;
  edgePadding?: number;
}): number {
  const maxLeft = boundsRight - surfaceWidth;
  const centeredLeft = clamp(
    preferredCenter - surfaceWidth / 2,
    boundsLeft,
    maxLeft,
  );
  const startAlignedLeft = clamp(
    preferredLeftEdge - edgePadding,
    boundsLeft,
    maxLeft,
  );
  const endAlignedLeft = clamp(
    preferredRightEdge - surfaceWidth + edgePadding,
    boundsLeft,
    maxLeft,
  );
  const shortSelection = selectionWidth <= surfaceWidth * 0.34;
  const nearLeadingEdge = preferredCenter - boundsLeft < surfaceWidth * 0.42;
  const nearTrailingEdge = boundsRight - preferredCenter < surfaceWidth * 0.42;

  if (!shortSelection) return centeredLeft;
  if (nearLeadingEdge && !nearTrailingEdge) return startAlignedLeft;
  if (nearTrailingEdge && !nearLeadingEdge) return endAlignedLeft;
  return centeredLeft;
}

function resultMinimumHeight(input: DocumentAiSurfacePositionInput): number {
  if (input.mode === "toolbar") return input.desiredSurfaceSize.height;
  return Math.min(
    input.desiredSurfaceSize.height,
    Math.max(input.desiredSurfaceSize.minHeight ?? RESULT_MIN_CONNECTED_HEIGHT, 1),
  );
}

function choosePlacement(args: {
  input: DocumentAiSurfacePositionInput;
  bounds: Bounds;
  anchor: ReturnType<typeof getAnchorGeometry>;
  targetLeft: number;
  targetRight: number;
  surfaceWidth: number;
  gap: number;
}): Exclude<DocumentAiSurfacePlacement, "sheet"> {
  const { input, bounds, anchor, targetLeft, targetRight, surfaceWidth, gap } =
    args;
  const minHeight = resultMinimumHeight(input);
  const minWidth = Math.min(
    input.desiredSurfaceSize.minWidth ?? Math.min(surfaceWidth, 320),
    surfaceWidth,
  );
  const aboveSpace = anchor.top - bounds.top - gap;
  const belowSpace = bounds.bottom - anchor.bottom - gap;
  const rightSpace = bounds.right - targetRight - gap;
  const leftSpace = targetLeft - bounds.left - gap;
  const canPlace = (placement: DocumentAiSurfacePlacement) => {
    if (placement === "above") return aboveSpace >= minHeight;
    if (placement === "below") return belowSpace >= minHeight;
    if (placement === "right") return rightSpace >= minWidth;
    if (placement === "left") return leftSpace >= minWidth;
    return placement === "center";
  };

  if (
    input.mode === "toolbar" &&
    input.preferredPlacement &&
    input.preferredPlacement !== "sheet" &&
    canPlace(input.preferredPlacement)
  ) {
    return input.preferredPlacement;
  }

  if (input.mode !== "toolbar") {
    if (belowSpace >= minHeight) return "below";
    if (aboveSpace >= minHeight) return "above";
    if (rightSpace >= minWidth) return "right";
    if (leftSpace >= minWidth) return "left";
    return "center";
  }

  if (aboveSpace >= minHeight) return "above";
  if (belowSpace >= minHeight) return "below";
  if (rightSpace >= minWidth) return "right";
  if (leftSpace >= minWidth) return "left";
  return "center";
}

export function computeDocumentAiSurfacePlacement(
  input: DocumentAiSurfacePositionInput,
): DocumentAiSurfacePosition {
  const safeMargin = input.safeMargin ?? DEFAULT_SAFE_MARGIN;
  const gap = input.gap ?? DEFAULT_GAP;
  const edgePadding = input.edgePadding ?? DEFAULT_EDGE_PADDING;
  const desiredWidth = Math.max(1, input.desiredSurfaceSize.width);
  const desiredHeight = Math.max(1, input.desiredSurfaceSize.height);

  if (input.breakpoint === "narrow") {
    const maxWidth = Math.max(1, input.viewportRect.width - safeMargin * 2);
    const maxHeight = Math.max(
      1,
      Math.min(desiredHeight, input.viewportRect.height * SHEET_MAX_VIEWPORT_RATIO),
    );
    return {
      placement: "sheet",
      left: input.viewportRect.left + safeMargin,
      top: input.viewportRect.bottom - maxHeight - safeMargin,
      maxWidth,
      maxHeight,
      clamped: maxWidth < desiredWidth || maxHeight < desiredHeight,
      mode: "sheet",
    };
  }

  const anchor = input.anchor;
  const anchorStageRect =
    anchor &&
    typeof anchor.containerLeft === "number" &&
    typeof anchor.containerRight === "number" &&
    typeof anchor.containerTop === "number" &&
    typeof anchor.containerBottom === "number"
      ? {
          left: anchor.containerLeft,
          top: anchor.containerTop,
          right: anchor.containerRight,
          bottom: anchor.containerBottom,
          width: anchor.containerRight - anchor.containerLeft,
          height: anchor.containerBottom - anchor.containerTop,
        }
      : null;
  const bounds = buildBounds({
    visibleStageRect: input.visibleStageRect ?? anchorStageRect,
    paperRect: input.paperRect,
    topIslandRect: input.topIslandRect,
    leftDrawerRect: input.leftDrawerRect,
    viewportRect: input.viewportRect,
    safeMargin,
    allowDocumentOverflow: input.mode !== "toolbar",
  });
  const surfaceWidth = Math.max(
    1,
    Math.min(desiredWidth, Math.max(1, bounds.width)),
  );

  if (!anchor) {
    const maxHeight = Math.max(1, Math.min(desiredHeight, bounds.height));
    const desiredLeft = bounds.left + Math.max(0, bounds.width - surfaceWidth) / 2;
    const desiredTop = bounds.top + Math.max(0, bounds.height - maxHeight) / 2;
    const left = clamp(desiredLeft, bounds.left, bounds.right - surfaceWidth);
    const top = clamp(desiredTop, bounds.top, bounds.bottom - maxHeight);
    return {
      placement: "center",
      left,
      top,
      maxWidth: surfaceWidth,
      maxHeight,
      clamped:
        Math.round(left) !== Math.round(desiredLeft) ||
        Math.round(top) !== Math.round(desiredTop) ||
        surfaceWidth < desiredWidth ||
        maxHeight < desiredHeight,
      mode: "popover",
    };
  }

  const anchorGeometry = getAnchorGeometry(anchor);
  const targetLeft = finiteOr(anchor.leftEdge, finiteOr(anchor.focusLeft, anchor.left));
  const targetRight = finiteOr(anchor.rightEdge, finiteOr(anchor.focusRight, anchor.left));
  const placement = choosePlacement({
    input,
    bounds,
    anchor: anchorGeometry,
    targetLeft,
    targetRight,
    surfaceWidth,
    gap,
  });
  const horizontal = {
    preferredLeftEdge: targetLeft,
    preferredRightEdge: targetRight,
    preferredCenter: targetLeft + Math.max(1, targetRight - targetLeft) / 2,
    activeSpanWidth: Math.max(DEFAULT_EDGE_PADDING, targetRight - targetLeft),
  };
  const preferredSurfaceCenterX =
    input.mode !== "toolbar" &&
    typeof input.preferredSurfaceCenterX === "number" &&
    Number.isFinite(input.preferredSurfaceCenterX)
      ? input.preferredSurfaceCenterX
      : null;
  const leftForVerticalPlacement =
    preferredSurfaceCenterX !== null
      ? clamp(
          preferredSurfaceCenterX - surfaceWidth / 2,
          bounds.left,
          bounds.right - surfaceWidth,
        )
      : computeDocumentAiSurfaceHorizontalLeft({
          surfaceWidth,
          boundsLeft: bounds.left,
          boundsRight: bounds.right,
          preferredCenter: horizontal.preferredCenter,
          preferredLeftEdge: horizontal.preferredLeftEdge,
          preferredRightEdge: horizontal.preferredRightEdge,
          selectionWidth: horizontal.activeSpanWidth,
          edgePadding,
        });
  const sideMaxHeight = Math.max(1, Math.min(desiredHeight, bounds.height));
  const maxHeight =
    placement === "above"
      ? Math.max(1, Math.min(desiredHeight, anchorGeometry.top - bounds.top - gap))
      : placement === "below"
        ? Math.max(1, Math.min(desiredHeight, bounds.bottom - anchorGeometry.bottom - gap))
        : sideMaxHeight;
  const desiredLeft =
    placement === "right"
      ? targetRight + gap
      : placement === "left"
        ? targetLeft - gap - surfaceWidth
        : placement === "center"
          ? bounds.left + Math.max(0, bounds.width - surfaceWidth) / 2
          : leftForVerticalPlacement;
  const desiredTop =
    placement === "above"
      ? anchorGeometry.top - gap - maxHeight
      : placement === "below"
        ? anchorGeometry.bottom + gap
        : placement === "center"
          ? bounds.top + Math.max(0, bounds.height - maxHeight) / 2
          : anchorGeometry.centerY - maxHeight / 2;
  const left = clamp(desiredLeft, bounds.left, bounds.right - surfaceWidth);
  const top = clamp(desiredTop, bounds.top, bounds.bottom - maxHeight);

  return {
    placement,
    left,
    top,
    maxWidth: surfaceWidth,
    maxHeight,
    clamped:
      Math.round(left) !== Math.round(desiredLeft) ||
      Math.round(top) !== Math.round(desiredTop) ||
      surfaceWidth < desiredWidth ||
      maxHeight < desiredHeight,
    mode: "popover",
  };
}

const STAGE_SELECTOR = [
  ".dasti-cv-paper-stage",
  ".dasti-doc-viewport--resume-panel[data-document-stage='true']",
  ".dasti-document-stage__canvas[data-document-page='true']",
].join(",");
const PAPER_SELECTOR = [
  "[data-document-page='true']",
  ".dasti-document-stage__canvas",
  ".cv-document-paper",
].join(",");
const TOP_ISLAND_SELECTOR = [
  "[data-testid='cv-toolbar']",
  ".forge__stage-bar",
  ".dasti-proposal-skeleton-stage__bar",
].join(",");
const LEFT_DRAWER_SELECTOR = ".forge-template-panel";

function firstVisibleRect(selector: string): DocumentAiSurfaceRect | null {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }
  for (const element of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    return documentAiSurfaceRectFromDom(rect, window.scrollX, window.scrollY);
  }
  return null;
}

function leftDrawerRect(): DocumentAiSurfaceRect | null {
  if (typeof document === "undefined" || typeof window === "undefined") {
    return null;
  }
  const viewportMidpoint = window.innerWidth / 2;
  for (const element of Array.from(
    document.querySelectorAll<HTMLElement>(LEFT_DRAWER_SELECTOR),
  )) {
    const style = window.getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") continue;
    const rect = element.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) continue;
    if (rect.left > viewportMidpoint) continue;
    return documentAiSurfaceRectFromDom(rect, window.scrollX, window.scrollY);
  }
  return null;
}

function viewportRect(): DocumentAiSurfaceRect {
  return {
    left: window.scrollX,
    top: window.scrollY,
    right: window.scrollX + window.innerWidth,
    bottom: window.scrollY + window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
  };
}

export function useDocumentAiSurfacePosition({
    anchor,
    desiredSurfaceSize,
    mode,
    preferredPlacement = null,
    preferredSurfaceCenterX = null,
    enabled = true,
  safeMargin = DEFAULT_SAFE_MARGIN,
  gap = DEFAULT_GAP,
  edgePadding = DEFAULT_EDGE_PADDING,
}: {
  anchor?: EditorSelectionAnchor | null;
  desiredSurfaceSize: DocumentAiSurfaceSize;
  mode: DocumentAiSurfaceState;
  preferredPlacement?: DocumentAiSurfacePlacement | null;
  preferredSurfaceCenterX?: number | null;
  enabled?: boolean;
  safeMargin?: number;
  gap?: number;
  edgePadding?: number;
}): DocumentAiSurfacePosition | null {
  const [, forceUpdate] = React.useReducer((value: number) => value + 1, 0);

  React.useLayoutEffect(() => {
    if (!enabled || typeof window === "undefined") return undefined;
    const update = () => forceUpdate();
    const frame = window.requestAnimationFrame(update);
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [
    anchor,
    desiredSurfaceSize.height,
    desiredSurfaceSize.minHeight,
    desiredSurfaceSize.minWidth,
    desiredSurfaceSize.width,
    enabled,
    mode,
    preferredPlacement,
  ]);

  return React.useMemo(() => {
    if (!enabled || typeof window === "undefined") return null;
    return computeDocumentAiSurfacePlacement({
      anchor,
      visibleStageRect: firstVisibleRect(STAGE_SELECTOR),
      paperRect: firstVisibleRect(PAPER_SELECTOR),
      topIslandRect: firstVisibleRect(TOP_ISLAND_SELECTOR),
      leftDrawerRect: leftDrawerRect(),
      viewportRect: viewportRect(),
      desiredSurfaceSize,
      mode,
      breakpoint: window.innerWidth <= 760 ? "narrow" : "desktop",
      preferredPlacement,
      preferredSurfaceCenterX,
      safeMargin,
      gap,
      edgePadding,
    });
  }, [
    anchor,
    desiredSurfaceSize,
    edgePadding,
    enabled,
    gap,
    mode,
    preferredPlacement,
    preferredSurfaceCenterX,
    safeMargin,
  ]);
}
