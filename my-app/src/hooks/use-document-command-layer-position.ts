import React from "react";
import {
  computeDocumentCommandLayerLayout,
  type CommandLayerAskMode,
  type CommandLayerDraftLabelMode,
  type CommandLayerModeControlMode,
  type CommandLayerToolbarMode,
} from "@/lib/document-command-layer-layout";

export type DocumentCommandLayerPositionStyle = React.CSSProperties & {
  [key: `--${string}`]: string;
};

type DocumentCommandLayerPositionOptions = {
  stageRef: React.RefObject<HTMLElement | null>;
  paperRef: React.RefObject<HTMLElement | null>;
  paperAnchorSelector: string;
  commandCanvasSelector?: string;
  cssVarPrefix: string;
  toolbarSelector?: string;
  toolbarNaturalWidth: number;
  toolbarMinWidth: number;
  toolbarHeight: number;
  askHandle: {
    iconWidth: number;
    height: number;
  };
  safeMargin: number;
  gap: number;
  askOffsetFromPaperTop: number;
  refreshKey?: unknown;
};

type DocumentCommandLayerPositionState = {
  style: DocumentCommandLayerPositionStyle;
  toolbarMode: CommandLayerToolbarMode;
  draftLabelMode: CommandLayerDraftLabelMode;
  modeControlMode: CommandLayerModeControlMode;
  askMode: CommandLayerAskMode;
  commandLayerSticky: boolean;
};

function readCssPixelVariable(styles: CSSStyleDeclaration, name: string) {
  const rawValue = styles.getPropertyValue(name).trim();
  if (!rawValue) return 0;
  const parsedValue = Number.parseFloat(rawValue);
  if (!Number.isFinite(parsedValue)) return 0;
  if (rawValue.endsWith("mm")) return (parsedValue * 96) / 25.4;
  if (rawValue.endsWith("cm")) return (parsedValue * 96) / 2.54;
  if (rawValue.endsWith("in")) return parsedValue * 96;
  if (rawValue.endsWith("pt")) return (parsedValue * 96) / 72;
  if (rawValue.endsWith("pc")) return parsedValue * 16;
  return parsedValue;
}

function styleEntryMatches(
  current: DocumentCommandLayerPositionStyle,
  key: `--${string}`,
  value: string,
) {
  return current[key] === value;
}

export function useDocumentCommandLayerPosition({
  stageRef,
  paperRef,
  paperAnchorSelector,
  commandCanvasSelector,
  cssVarPrefix,
  toolbarSelector,
  toolbarNaturalWidth,
  toolbarMinWidth,
  toolbarHeight,
  askHandle,
  safeMargin,
  gap,
  askOffsetFromPaperTop,
  refreshKey,
}: DocumentCommandLayerPositionOptions): DocumentCommandLayerPositionState {
  const [style, setStyle] = React.useState<DocumentCommandLayerPositionStyle>(
    {},
  );
  const [toolbarMode, setToolbarMode] =
    React.useState<CommandLayerToolbarMode>("wide");
  const [draftLabelMode, setDraftLabelMode] =
    React.useState<CommandLayerDraftLabelMode>("full");
  const [modeControlMode, setModeControlMode] =
    React.useState<CommandLayerModeControlMode>("split");
  const [askMode, setAskMode] = React.useState<CommandLayerAskMode>("iconOnly");
  const [commandLayerSticky, setCommandLayerSticky] = React.useState(false);

  React.useLayoutEffect(() => {
    if (typeof window === "undefined") return undefined;

    let frameId: number | null = null;
    const updateCommandLayerAnchor = () => {
      frameId = null;
      const stage = stageRef.current;
      const paper = paperRef.current;
      if (!stage || !paper) return;

      const anchor =
        paper.querySelector<HTMLElement>(paperAnchorSelector) ?? paper;
      const stageRect = stage.getBoundingClientRect();
      const commandCanvas = commandCanvasSelector
        ? stage.closest<HTMLElement>(commandCanvasSelector) ?? stage
        : stage;
      const commandCanvasRect = commandCanvas.getBoundingClientRect();
      const anchorCandidates = Array.from(
        paper.querySelectorAll<HTMLElement>(paperAnchorSelector),
      );
      const stickyTokens = window.getComputedStyle(document.documentElement);
      const stickyTopViewport =
        readCssPixelVariable(stickyTokens, "--header-height") +
        readCssPixelVariable(stickyTokens, "--space-2");
      const measuredToolbarHeight = toolbarSelector
        ? stage
            .querySelector<HTMLElement>(toolbarSelector)
            ?.getBoundingClientRect().height ?? 0
        : 0;
      const effectiveToolbarHeight =
        measuredToolbarHeight > 0 && measuredToolbarHeight < 96
          ? measuredToolbarHeight
          : toolbarHeight;
      const anchorRect =
        (anchorCandidates.length > 0
          ? anchorCandidates
              .map((candidate) => {
                const rect = candidate.getBoundingClientRect();
                const visibleBlock =
                  Math.min(rect.bottom, window.innerHeight) -
                  Math.max(rect.top, stickyTopViewport);
                return {
                  rect,
                  score: Math.max(0, visibleBlock) * Math.max(0, rect.width),
                  distance: Math.abs(rect.top - stickyTopViewport),
                };
              })
              .sort((a, b) => b.score - a.score || a.distance - b.distance)[0]
              ?.rect
          : null) ?? anchor.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const visibleCanvasLeft = Math.max(commandCanvasRect.left, 0);
      const visibleCanvasRight = viewportWidth;
      const visibleCanvasTop = Math.max(commandCanvasRect.top, 0);
      const visibleCanvasBottom = Math.min(
        commandCanvasRect.bottom,
        window.innerHeight,
      );
      const paperRect = {
        left: anchorRect.left - stageRect.left,
        top: anchorRect.top - stageRect.top,
        width: anchorRect.width,
        height: anchorRect.height,
      };
      const canvasRect = {
        left: visibleCanvasLeft - stageRect.left,
        top: visibleCanvasTop - stageRect.top,
        width: Math.max(0, visibleCanvasRight - visibleCanvasLeft),
        height: Math.max(0, visibleCanvasBottom - visibleCanvasTop),
      };

      if (
        paperRect.width <= 0 ||
        canvasRect.width <= 0 ||
        !Number.isFinite(paperRect.width) ||
        !Number.isFinite(paperRect.left) ||
        !Number.isFinite(paperRect.top)
      ) {
        setStyle({});
        setToolbarMode("wide");
        setDraftLabelMode("full");
        setModeControlMode("split");
        setAskMode("iconOnly");
        setCommandLayerSticky(false);
        return;
      }

      const commandLayer = computeDocumentCommandLayerLayout({
        canvasRect,
        paperRect,
        zoom: 1,
        toolbarNaturalWidth,
        toolbarMinWidth,
        toolbarHeight: effectiveToolbarHeight,
        stickyTop: stickyTopViewport - stageRect.top,
        askHandle,
        safeMargin,
        gap,
        askOffsetFromPaperTop,
        viewportWidth,
      });

      setToolbarMode(commandLayer.toolbarMode);
      setDraftLabelMode(commandLayer.draftLabelMode);
      setModeControlMode(commandLayer.modeControlMode);
      setAskMode(commandLayer.askMode);
      setCommandLayerSticky(commandLayer.toolbarSticky);

      setStyle((current) => {
        const entries = {
          [`--${cssVarPrefix}-toolbar-paper-left`]: `${Math.max(0, paperRect.left)}px`,
          [`--${cssVarPrefix}-toolbar-paper-width`]: `${paperRect.width}px`,
          [`--${cssVarPrefix}-command-toolbar-left`]: `${commandLayer.toolbarRect.left}px`,
          [`--${cssVarPrefix}-command-toolbar-top`]: `${commandLayer.toolbarRect.top}px`,
          [`--${cssVarPrefix}-command-toolbar-inline-start`]: `${stageRect.left + commandLayer.toolbarRect.left}px`,
          [`--${cssVarPrefix}-command-toolbar-block-start`]: `${stageRect.top + commandLayer.toolbarRect.top}px`,
          [`--${cssVarPrefix}-command-toolbar-width`]: `${commandLayer.toolbarRect.width}px`,
          [`--${cssVarPrefix}-command-toolbar-min-width`]: `${toolbarMinWidth}px`,
          [`--${cssVarPrefix}-ask-handle-inline-start`]: `${stageRect.left + commandLayer.askRect.left}px`,
          [`--${cssVarPrefix}-ask-handle-block-start`]: `${stageRect.top + commandLayer.askRect.top}px`,
        } as const;
        const unchanged = Object.entries(entries).every(([key, value]) =>
          styleEntryMatches(current, key as `--${string}`, value),
        );
        return unchanged ? current : entries;
      });
    };
    const scheduleCommandLayerAnchorUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateCommandLayerAnchor);
    };

    scheduleCommandLayerAnchorUpdate();

    const resizeObserver =
      typeof ResizeObserver === "undefined"
        ? null
        : new ResizeObserver(scheduleCommandLayerAnchorUpdate);
    if (stageRef.current) resizeObserver?.observe(stageRef.current);
    const commandCanvas = commandCanvasSelector
      ? stageRef.current?.closest<HTMLElement>(commandCanvasSelector)
      : null;
    if (commandCanvas && commandCanvas !== stageRef.current) {
      resizeObserver?.observe(commandCanvas);
    }
    if (paperRef.current) resizeObserver?.observe(paperRef.current);
    const anchor =
      paperRef.current?.querySelector<HTMLElement>(paperAnchorSelector);
    if (anchor) resizeObserver?.observe(anchor);

    window.addEventListener("resize", scheduleCommandLayerAnchorUpdate);
    window.addEventListener("scroll", scheduleCommandLayerAnchorUpdate, true);

    return () => {
      if (frameId !== null) window.cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleCommandLayerAnchorUpdate);
      window.removeEventListener(
        "scroll",
        scheduleCommandLayerAnchorUpdate,
        true,
      );
    };
  }, [
    askHandle,
    askOffsetFromPaperTop,
    commandCanvasSelector,
    cssVarPrefix,
    gap,
    paperAnchorSelector,
    paperRef,
    refreshKey,
    safeMargin,
    stageRef,
    toolbarHeight,
    toolbarSelector,
    toolbarMinWidth,
    toolbarNaturalWidth,
  ]);

  return {
    style,
    toolbarMode,
    draftLabelMode,
    modeControlMode,
    askMode,
    commandLayerSticky,
  };
}
