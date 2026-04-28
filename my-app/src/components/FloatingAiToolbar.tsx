import React from "react";
import { motion } from "framer-motion";
import { BodyPortal } from "@/components/ui/body-portal";
import {
  VISIBLE_TOOLBAR_AI_ACTIONS,
  type AiActionDefinition,
  type AiActionId,
} from "@/lib/ai/interactionRulebook";
import type { EditorSelectionAnchor } from "@/lib/editor-ai-selection";

const DS4_VISIBLE_ACTION_IDS = [
  "rewrite",
  "shorten",
  "fix_grammar",
  "custom",
] as const satisfies readonly AiActionId[];

export const INLINE_AI_ACTIONS = DS4_VISIBLE_ACTION_IDS.flatMap((actionId) => {
  const action = VISIBLE_TOOLBAR_AI_ACTIONS.find(({ id }) => id === actionId);
  return action ? [action] : [];
});

const DEFAULT_ACTION_ID = "rewrite";
const MOTION_EASE = [0.22, 1, 0.36, 1] as const;
const TOOLBAR_FADE_TRANSITION = {
  duration: 0.18,
  ease: MOTION_EASE,
} as const;
const COLLAPSED_SHELL_WIDTH = 36;

const ASK_SUGGESTIONS = [
  "Make this more persuasive…",
  "Make it sound more confident…",
  "Rephrase without buzzwords…",
  "Make this opener more memorable…",
  "Soften the tone slightly…",
  "Make this achievement more specific…",
  "Remove the corporate jargon…",
  "Make this closing stronger…",
  "Tighten this without losing meaning…",
  "Make it sound less robotic…",
] as const;

export type InlineAiActionId = AiActionId;

type FloatingAiToolbarProps = {
  anchor: EditorSelectionAnchor | null;
  open: boolean;
  isLoading?: boolean;
  pendingActionId?: InlineAiActionId | null;
  includeJobContextActions?: boolean;
  onClose: () => void;
  onRunAction: (actionId: InlineAiActionId, instruction: string) => void;
};

type ToolbarMetrics = {
  actionWidth: number;
  actionHeight: number;
  promptWidth: number;
  promptHeight: number;
  panelWidth: number;
  panelHeight: number;
};

const EMPTY_METRICS: ToolbarMetrics = {
  actionWidth: 0,
  actionHeight: 0,
  promptWidth: 0,
  promptHeight: 0,
  panelWidth: 0,
  panelHeight: 0,
};

function resolveCssLength(
  element: HTMLElement,
  cssVariable: string,
  fallback: number,
): number {
  const value = window
    .getComputedStyle(element)
    .getPropertyValue(cssVariable)
    .trim();
  const parsed = Number.parseFloat(value);

  return Number.isFinite(parsed) ? parsed : fallback;
}

function computeToolbarLeft({
  panelWidth,
  boundsMin,
  boundsMax,
  preferredCenter,
  preferredLeftEdge,
  preferredRightEdge,
  selectionWidth,
  edgePadding,
}: {
  panelWidth: number;
  boundsMin: number;
  boundsMax: number;
  preferredCenter: number;
  preferredLeftEdge: number;
  preferredRightEdge: number;
  selectionWidth: number;
  edgePadding: number;
}): number {
  const clamp = (value: number, min: number, max: number) =>
    Math.min(Math.max(value, min), Math.max(min, max));
  const maxLeft = boundsMax - panelWidth;
  const centeredLeft = clamp(
    preferredCenter - panelWidth / 2,
    boundsMin,
    maxLeft,
  );
  const startAlignedLeft = clamp(
    preferredLeftEdge - edgePadding,
    boundsMin,
    maxLeft,
  );
  const endAlignedLeft = clamp(
    preferredRightEdge - panelWidth + edgePadding,
    boundsMin,
    maxLeft,
  );
  const shortSelection = selectionWidth <= panelWidth * 0.34;
  const nearLeadingEdge = preferredCenter - boundsMin < panelWidth * 0.42;
  const nearTrailingEdge = boundsMax - preferredCenter < panelWidth * 0.42;

  if (!shortSelection) {
    return centeredLeft;
  }

  if (nearLeadingEdge && !nearTrailingEdge) {
    return startAlignedLeft;
  }

  if (nearTrailingEdge && !nearLeadingEdge) {
    return endAlignedLeft;
  }

  return centeredLeft;
}

function getMeasuredSize(element: HTMLElement | null): {
  width: number;
  height: number;
} {
  if (!element) {
    return { width: 0, height: 0 };
  }

  return {
    width: Math.max(element.scrollWidth, element.offsetWidth),
    height: Math.max(element.scrollHeight, element.offsetHeight),
  };
}

function isSameMetrics(current: ToolbarMetrics, next: ToolbarMetrics): boolean {
  return (
    current.actionWidth === next.actionWidth &&
    current.actionHeight === next.actionHeight &&
    current.promptWidth === next.promptWidth &&
    current.promptHeight === next.promptHeight
  );
}

export function FloatingAiToolbar({
  anchor,
  open,
  isLoading = false,
  pendingActionId = null,
  includeJobContextActions = false,
  onClose,
  onRunAction,
}: FloatingAiToolbarProps) {
  const [activeActionId, setActiveActionId] =
    React.useState<InlineAiActionId>(DEFAULT_ACTION_ID);
  const [customInstruction, setCustomInstruction] = React.useState("");
  const [askPlaceholder, setAskPlaceholder] = React.useState(
    ASK_SUGGESTIONS[0],
  );
  const [position, setPosition] = React.useState<{
    left: number;
    top: number;
    placement: "above" | "below";
    pointerOffset: number;
  } | null>(null);
  const [metrics, setMetrics] = React.useState<ToolbarMetrics>(EMPTY_METRICS);
  const [isToolbarMounted, setIsToolbarMounted] = React.useState(() =>
    Boolean(open && anchor),
  );

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const actionShellRef = React.useRef<HTMLDivElement | null>(null);
  const promptShellRef = React.useRef<HTMLDivElement | null>(null);
  const lastAnchorRef = React.useRef<EditorSelectionAnchor | null>(anchor);

  const isAskOpen = activeActionId === "custom";
  const isPromptLoading = isLoading && pendingActionId === "custom";
  const toolbarActions = React.useMemo(() => INLINE_AI_ACTIONS, []);

  const updatePosition = React.useCallback(() => {
    if (!anchor || !panelRef.current || typeof window === "undefined") {
      return;
    }

    const panel = panelRef.current;
    const compactGap = resolveCssLength(panel, "--s1", 4);
    const baseGap = resolveCssLength(panel, "--s2", compactGap * 2);
    const margin = resolveCssLength(panel, "--s3", 12);
    const controlSize = resolveCssLength(panel, "--control-md", 36);
    const actionSize = getMeasuredSize(actionShellRef.current);
    const promptSize = isAskOpen
      ? getMeasuredSize(promptShellRef.current)
      : { width: 0, height: 0 };
    const panelSize = getMeasuredSize(panel);
    const askInlineGap = isAskOpen && promptSize.width > 0 ? compactGap : 0;
    const contentWidth = actionSize.width + askInlineGap + promptSize.width;
    const nextMetrics: ToolbarMetrics = {
      actionWidth: actionSize.width,
      actionHeight: actionSize.height,
      promptWidth: promptSize.width,
      promptHeight: promptSize.height,
      panelWidth: Math.max(panelSize.width, contentWidth),
      panelHeight: Math.max(
        panelSize.height,
        actionSize.height,
        promptSize.height,
      ),
    };

    setMetrics((current) =>
      isSameMetrics(current, nextMetrics) ? current : nextMetrics,
    );

    if (actionSize.width <= 0 || actionSize.height <= 0) {
      return;
    }

    const width = Math.max(nextMetrics.panelWidth, COLLAPSED_SHELL_WIDTH);
    const height = Math.max(nextMetrics.panelHeight, controlSize);
    const viewportLeft = window.scrollX + margin;
    const viewportTop = window.scrollY + margin;
    const viewportRight = window.scrollX + window.innerWidth - margin;
    const viewportBottom = window.scrollY + window.innerHeight - margin;

    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), Math.max(min, max));

    const horizontalMin = Math.max(
      viewportLeft,
      (anchor.containerLeft ?? viewportLeft) + compactGap,
    );
    const horizontalMax = Math.min(
      viewportRight,
      (anchor.containerRight ?? viewportRight) - compactGap,
    );
    const verticalMin = Math.max(
      viewportTop,
      (anchor.containerTop ?? viewportTop) + compactGap,
    );
    const verticalMax = Math.min(
      viewportBottom,
      (anchor.containerBottom ?? viewportBottom) - compactGap,
    );

    const maxLeft = horizontalMax - width;
    const maxTop = verticalMax - height;
    const selectionLeftBound = anchor.leftEdge;
    const selectionRightBound = anchor.rightEdge;
    const hasSelectionHorizontalBounds =
      typeof selectionLeftBound === "number" &&
      typeof selectionRightBound === "number";
    const focusCenter = anchor.focusCenter;
    const focusMatchesSelection =
      !hasSelectionHorizontalBounds ||
      typeof focusCenter !== "number" ||
      (focusCenter >= selectionLeftBound - compactGap &&
        focusCenter <= selectionRightBound + compactGap);
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
      compactGap,
      anchor.focusLineHeight ??
        anchor.belowLineHeight ??
        anchor.height ??
        compactGap,
    );
    const isBlockSelection =
      (anchor.lineCount ?? 1) > 1 ||
      (anchor.height ?? 0) > focusLineHeight * 1.5;
    const aboveGap = baseGap;
    const belowGap = baseGap;
    const anchorTop = isBlockSelection
      ? anchor.top
      : focusMatchesSelection
        ? focusTop
        : anchor.top;
    const anchorBottom = isBlockSelection
      ? anchor.bottom ?? focusBottom
      : focusMatchesSelection
        ? focusBottom
        : anchor.bottom ?? focusBottom;
    const preferredAboveTop = anchorTop - height - aboveGap;
    const preferredBelowTop = anchorBottom + belowGap;
    const hasRoomAbove = preferredAboveTop >= verticalMin;
    const hasRoomBelow = preferredBelowTop <= maxTop;
    const roomAbove = anchorTop - verticalMin;
    const roomBelow = verticalMax - anchorBottom;

    let placement: "above" | "below" = hasRoomAbove
      ? "above"
      : hasRoomBelow
        ? "below"
        : roomAbove >= roomBelow
          ? "above"
          : "below";

    let top = placement === "above" ? preferredAboveTop : preferredBelowTop;

    if (placement === "above" && top < verticalMin && hasRoomBelow) {
      placement = "below";
      top = preferredBelowTop;
    } else if (placement === "below" && top > maxTop && hasRoomAbove) {
      placement = "above";
      top = preferredAboveTop;
    }

    const useFocusHorizontalAnchor = isBlockSelection || focusMatchesSelection;
    const lineLeft =
      placement === "above"
        ? anchor.aboveLeft ?? anchor.leftEdge ?? anchor.left
        : anchor.belowLeft ?? anchor.leftEdge ?? anchor.left;
    const lineRight =
      placement === "above"
        ? anchor.aboveRight ?? anchor.rightEdge ?? anchor.left
        : anchor.belowRight ?? anchor.rightEdge ?? anchor.left;
    const lineCenter =
      placement === "above"
        ? anchor.aboveCenter ?? anchor.left
        : anchor.belowCenter ?? anchor.left;
    const preferredLeftEdge = useFocusHorizontalAnchor
      ? anchor.focusLeft ?? lineLeft
      : lineLeft;
    const preferredRightEdge = useFocusHorizontalAnchor
      ? anchor.focusRight ?? anchor.rightEdge ?? lineRight
      : lineRight;
    const preferredCenter = useFocusHorizontalAnchor
      ? anchor.focusCenter ??
        preferredLeftEdge + (preferredRightEdge - preferredLeftEdge) / 2
      : lineCenter;
    const activeSpanWidth = Math.max(
      compactGap,
      preferredRightEdge - preferredLeftEdge,
    );
    const desiredLeft = computeToolbarLeft({
      panelWidth: width,
      boundsMin: horizontalMin,
      boundsMax: horizontalMax,
      preferredCenter,
      preferredLeftEdge,
      preferredRightEdge,
      selectionWidth: activeSpanWidth,
      edgePadding: compactGap,
    });

    top = clamp(top, verticalMin, maxTop);
    const left = clamp(desiredLeft, horizontalMin, maxLeft);
    const pointerOffset = clamp(
      preferredCenter - left,
      compactGap * 2,
      width - compactGap * 2,
    );

    setPosition({ left, top, placement, pointerOffset });
  }, [anchor, isAskOpen]);

  React.useEffect(() => {
    if (anchor) {
      lastAnchorRef.current = anchor;
    }
  }, [anchor]);

  React.useEffect(() => {
    if (open && anchor) {
      setIsToolbarMounted(true);
      return undefined;
    }

    if (!isToolbarMounted) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setIsToolbarMounted(false);
    }, TOOLBAR_FADE_TRANSITION.duration * 1000);

    return () => {
      window.clearTimeout(timeout);
    };
  }, [anchor, isToolbarMounted, open]);

  React.useEffect(() => {
    if (!open) {
      setActiveActionId(DEFAULT_ACTION_ID);
      setCustomInstruction("");
      setPosition(null);
      setMetrics(EMPTY_METRICS);
    }
  }, [open]);

  React.useEffect(() => {
    if (pendingActionId) {
      setActiveActionId(pendingActionId);
    }
  }, [pendingActionId]);

  React.useEffect(() => {
    if (activeActionId === "custom") {
      const idx = Math.floor(Math.random() * ASK_SUGGESTIONS.length);
      setAskPlaceholder(ASK_SUGGESTIONS[idx]);
    }
  }, [activeActionId]);

  React.useLayoutEffect(() => {
    if (!open || !anchor) {
      return undefined;
    }

    setPosition(null);

    const update = () => {
      updatePosition();
    };

    update();

    const resizeObserver =
      typeof ResizeObserver !== "undefined" ? new ResizeObserver(update) : null;

    if (actionShellRef.current) {
      resizeObserver?.observe(actionShellRef.current);
    }
    if (promptShellRef.current) {
      resizeObserver?.observe(promptShellRef.current);
    }

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, open, isAskOpen, updatePosition]);

  React.useEffect(() => {
    if (!open) return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      onClose();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, open]);

  const handlePresetAction = React.useCallback(
    (action: AiActionDefinition) => {
      if (action.id === "custom") {
        setActiveActionId((current) =>
          current === "custom" ? DEFAULT_ACTION_ID : "custom",
        );
        return;
      }

      setActiveActionId(action.id);
      onRunAction(action.id, action.instruction);
    },
    [onRunAction],
  );

  const renderAnchor = open && anchor ? anchor : lastAnchorRef.current;
  const shouldRenderToolbar = isToolbarMounted && renderAnchor !== null;
  const isPositionReady =
    open && anchor !== null && position !== null && metrics.panelWidth > 0;

  return (
    <BodyPortal>
      {shouldRenderToolbar && renderAnchor ? (
        <motion.div
          ref={panelRef}
          className="ds-ai-toolbar"
          data-inline-ai-toolbar="true"
          data-state={isPositionReady ? "open" : "closing"}
          data-placement={position?.placement ?? "above"}
          role="toolbar"
          aria-label="Selected text actions"
          style={{
            position: "absolute",
            left: position?.left ?? renderAnchor.left,
            top: position?.top ?? renderAnchor.top,
            zIndex: 11000,
            visibility: isPositionReady ? "visible" : "hidden",
            pointerEvents: isPositionReady ? "auto" : "none",
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: isPositionReady ? 1 : 0 }}
          transition={TOOLBAR_FADE_TRANSITION}
          onPointerDownCapture={(event) => {
            const target = event.target as HTMLElement | null;
            if (
              target?.closest(
                "input, textarea, select, [contenteditable='true']",
              )
            ) {
              return;
            }

            event.preventDefault();
          }}
        >
          <div
            ref={actionShellRef}
            className="ds-ai-toolbar__actions"
            data-inline-ai-toolbar="true"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "var(--s1)",
            }}
          >
            {toolbarActions.map((action) => {
              const isAskAction = action.id === "custom";
              const isActionLoading =
                isLoading && pendingActionId === action.id;
              const isActive = activeActionId === action.id;

              return (
                <React.Fragment key={action.id}>
                  {isAskAction ? (
                    <span
                      className="ds-ai-toolbar__divider"
                      aria-hidden="true"
                    />
                  ) : null}

                  {isAskOpen && isAskAction ? null : (
                    <button
                      type="button"
                      className="ds-ai-toolbar__btn"
                      onClick={() => handlePresetAction(action)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      disabled={isLoading}
                      aria-busy={isActionLoading || undefined}
                      aria-pressed={isActive}
                    >
                      {action.label}
                      {isActionLoading ? (
                        <span className="ds-btn__period" aria-hidden="true">
                          .
                        </span>
                      ) : null}
                    </button>
                  )}
                </React.Fragment>
              );
            })}
          </div>

          {isAskOpen ? (
            <div
              ref={promptShellRef}
              className="ds-ask-ai"
              data-loading={isPromptLoading || undefined}
              data-inline-ai-toolbar="true"
            >
              <label style={{ display: "contents" }}>
                <span className="sr-only">Ask AI</span>
                <input
                  type="text"
                  aria-label="Ask AI"
                  value={customInstruction}
                  onChange={(event) => setCustomInstruction(event.target.value)}
                  onFocus={() => setActiveActionId("custom")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && customInstruction.trim()) {
                      event.preventDefault();
                      onRunAction("custom", customInstruction.trim());
                    } else if (event.key === "Enter") {
                      event.preventDefault();
                    } else if (event.key === "Escape") {
                      event.preventDefault();
                      event.stopPropagation();
                      setActiveActionId(DEFAULT_ACTION_ID);
                    }
                  }}
                  placeholder={isPromptLoading ? "Asking." : askPlaceholder}
                  className="ds-ask-ai__input"
                  disabled={isLoading}
                />
              </label>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </BodyPortal>
  );
}

export default FloatingAiToolbar;
