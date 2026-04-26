import React from "react";
import { motion } from "framer-motion";
import { BodyPortal } from "@/components/ui/body-portal";
import { Check, Loader2, Minus, Pen, SendHorizontal, Wand2 } from "@/lib/icons";
import type { EditorSelectionAnchor } from "@/lib/editor-ai-selection";

export const INLINE_AI_ACTIONS = [
  {
    id: "make_human",
    label: "Rewrite",
    instruction:
      "Make this selection sound more human and natural while staying credible and professional.",
  },
  {
    id: "shorten",
    label: "Shorten",
    instruction:
      "Shorten this selection while preserving the strongest meaning and proof.",
  },
  {
    id: "lengthen",
    label: "Expand",
    instruction:
      "Make this selection a little longer and fuller while keeping the same core meaning.",
  },
  {
    id: "make_clearer",
    label: "Clarify",
    instruction:
      "Make this selection clearer, easier to scan, and more direct without changing its meaning.",
  },
  {
    id: "make_persuasive",
    label: "Strengthen",
    instruction:
      "Make this selection more persuasive and convincing without exaggerating or inventing facts.",
  },
  {
    id: "fix_grammar",
    label: "Fix",
    instruction:
      "Fix grammar, spelling, punctuation, and phrasing issues in this selection.",
  },
  {
    id: "ask",
    label: "Ask",
    instruction: "",
  },
] as const;

const DEFAULT_ACTION_ID = "make_human";
const MOTION_EASE = [0.22, 1, 0.36, 1] as const;
const TOOLBAR_FADE_TRANSITION = {
  duration: 0.18,
  ease: MOTION_EASE,
} as const;
const COLLAPSED_SHELL_WIDTH = 36;

const VISIBLE_TOOLBAR_IDS = [
  "make_human",
  "shorten",
  "fix_grammar",
  "ask",
] as const;
type VisibleToolbarId = (typeof VISIBLE_TOOLBAR_IDS)[number];

const TOOLBAR_ICONS: Record<
  VisibleToolbarId,
  React.ComponentType<{
    size?: number;
    strokeWidth?: number;
    className?: string;
    "aria-hidden"?: boolean | "true";
  }>
> = {
  make_human: Wand2,
  shorten: Minus,
  fix_grammar: Check,
  ask: Pen,
};

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

export type InlineAiActionId =
  | (typeof INLINE_AI_ACTIONS)[number]["id"]
  | "custom";

type FloatingAiToolbarProps = {
  anchor: EditorSelectionAnchor | null;
  open: boolean;
  isLoading?: boolean;
  pendingActionId?: InlineAiActionId | null;
  onClose: () => void;
  onRunAction: (actionId: InlineAiActionId, instruction: string) => void;
};

type ToolbarMetrics = {
  actionWidth: number;
  actionHeight: number;
  promptWidth: number;
  promptHeight: number;
};

const EMPTY_METRICS: ToolbarMetrics = {
  actionWidth: 0,
  actionHeight: 0,
  promptWidth: 0,
  promptHeight: 0,
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

function getButtonGlowBoxShadow(active: boolean): string {
  if (active) {
    return [
      "inset 0 1px 0 color-mix(in srgb, var(--op) 12%, transparent)",
      "0 1px 2px color-mix(in srgb, var(--shadow-color) 24%, transparent)",
      "0 0 18px color-mix(in srgb, var(--ac) 10%, transparent)",
    ].join(", ");
  }

  return [
    "0 0 0 1px var(--proposal-chrome-control-border)",
    "0 0 16px color-mix(in srgb, var(--ac) 10%, transparent)",
    "inset 0 1px 0 color-mix(in srgb, var(--color-surface-raised) 22%, transparent)",
  ].join(", ");
}

function getButtonBaseStyle(
  isPressed: boolean,
): React.CSSProperties | undefined {
  if (!isPressed) {
    return undefined;
  }

  return {
    background: "var(--ac)",
    borderColor: "color-mix(in srgb, var(--ac) 54%, transparent)",
    color: "var(--op)",
    boxShadow: getButtonGlowBoxShadow(true),
  };
}

function getButtonHoverStyle(isPressed: boolean): React.CSSProperties {
  return isPressed
    ? {
        boxShadow: getButtonGlowBoxShadow(true),
      }
    : {
        background: "var(--proposal-chrome-control-hover-bg)",
        borderColor: "var(--proposal-chrome-control-active-border)",
        boxShadow: getButtonGlowBoxShadow(false),
      };
}

export function FloatingAiToolbar({
  anchor,
  open,
  isLoading = false,
  pendingActionId = null,
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

  const isAskOpen = activeActionId === "ask";
  const isPromptLoading = isLoading && pendingActionId === "custom";

  const updatePosition = React.useCallback(() => {
    if (!anchor || !panelRef.current || typeof window === "undefined") {
      return;
    }

    const panel = panelRef.current;
    const actionSize = getMeasuredSize(actionShellRef.current);
    const promptSize = isAskOpen
      ? getMeasuredSize(promptShellRef.current)
      : { width: 0, height: 0 };
    const nextMetrics: ToolbarMetrics = {
      actionWidth: actionSize.width,
      actionHeight: actionSize.height,
      promptWidth: promptSize.width,
      promptHeight: promptSize.height,
    };

    setMetrics((current) =>
      isSameMetrics(current, nextMetrics) ? current : nextMetrics,
    );

    if (actionSize.width <= 0 || actionSize.height <= 0) {
      return;
    }

    const compactGap = resolveCssLength(panel, "--space-1", 4);
    const baseGap = resolveCssLength(panel, "--space-2", compactGap * 2);
    const margin = resolveCssLength(panel, "--space-3", 12);
    const controlSize = resolveCssLength(panel, "--control-md", 36);
    const stackedGap = compactGap / 2;
    const width = Math.max(actionSize.width, promptSize.width, 1);
    const height =
      actionSize.height +
      (isAskOpen && promptSize.height > 0 ? stackedGap + promptSize.height : 0);
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
    const aboveLineHeight = Math.max(
      compactGap,
      anchor.aboveLineHeight ?? focusLineHeight,
    );
    const belowLineHeight = Math.max(
      compactGap,
      anchor.belowLineHeight ?? focusLineHeight,
    );
    const aboveGap = baseGap + Math.min(controlSize, aboveLineHeight);
    const belowGap = baseGap + Math.min(controlSize, belowLineHeight);
    const anchorTop = isBlockSelection ? anchor.top : focusTop;
    const anchorBottom = isBlockSelection
      ? anchor.bottom ?? focusBottom
      : focusBottom;
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

    const preferredLeftEdge = isBlockSelection
      ? anchor.focusLeft ?? anchor.leftEdge ?? anchor.aboveLeft ?? anchor.left
      : anchor.focusLeft ??
        (placement === "above"
          ? anchor.aboveLeft ?? anchor.leftEdge ?? anchor.left
          : anchor.belowLeft ?? anchor.leftEdge ?? anchor.left);
    const preferredRightEdge = isBlockSelection
      ? anchor.focusRight ??
        anchor.rightEdge ??
        anchor.belowRight ??
        anchor.right ??
        anchor.left
      : anchor.focusRight ??
        (placement === "above"
          ? anchor.aboveRight ?? anchor.rightEdge ?? anchor.left
          : anchor.belowRight ?? anchor.rightEdge ?? anchor.left);
    const preferredCenter = isBlockSelection
      ? anchor.focusCenter ??
        preferredLeftEdge + (preferredRightEdge - preferredLeftEdge) / 2
      : anchor.focusCenter ??
        (placement === "above"
          ? anchor.aboveCenter ?? anchor.left
          : anchor.belowCenter ?? anchor.left);
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
      setActiveActionId(pendingActionId === "custom" ? "ask" : pendingActionId);
    }
  }, [pendingActionId]);

  React.useEffect(() => {
    if (activeActionId === "ask") {
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
    (action: (typeof INLINE_AI_ACTIONS)[number]) => {
      if (action.id === "ask") {
        setActiveActionId((current) =>
          current === "ask" ? DEFAULT_ACTION_ID : "ask",
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
    open && anchor !== null && position !== null && metrics.actionWidth > 0;
  const panelWidth = Math.max(
    metrics.actionWidth,
    isAskOpen ? metrics.promptWidth : 0,
    COLLAPSED_SHELL_WIDTH,
  );

  return (
    <BodyPortal>
      {shouldRenderToolbar && renderAnchor ? (
        <motion.div
          ref={panelRef}
          className="dasti-inline-ai-toolbar"
          data-inline-ai-toolbar="true"
          data-placement={position?.placement ?? "above"}
          role="toolbar"
          aria-label="Selected text actions"
          style={{
            position: "absolute",
            left: position?.left ?? renderAnchor.left,
            top: position?.top ?? renderAnchor.top,
            width: `${panelWidth}px`,
            ["--dasti-inline-ai-toolbar-pointer-offset" as string]: position
              ? `${position.pointerOffset}px`
              : "50%",
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
          <div className="dasti-inline-ai-toolbar__shadow" aria-hidden="true" />

          <motion.div
            ref={actionShellRef}
            className="dasti-inline-ai-toolbar__ribbon dasti-inline-ai-toolbar__ribbon--actions"
            data-inline-ai-toolbar="true"
            style={{ overflow: "hidden", justifySelf: "center" }}
          >
            <motion.div
              className="dasti-inline-ai-toolbar__actions"
              initial={false}
              animate={{ opacity: 1 }}
              transition={TOOLBAR_FADE_TRANSITION}
            >
              {VISIBLE_TOOLBAR_IDS.map((id) => {
                const action = INLINE_AI_ACTIONS.find(
                  (item) => item.id === id,
                )!;
                const Icon = TOOLBAR_ICONS[id];
                const isAskAction = id === "ask";
                const isPrimary = id === "make_human";
                const isActionLoading =
                  isLoading && pendingActionId === action.id;
                const isActive = activeActionId === action.id;
                const isPressed = isActive || isActionLoading;

                return (
                  <React.Fragment key={action.id}>
                    {isAskAction ? (
                      <motion.span
                        className="dasti-inline-ai-toolbar__action-divider"
                        aria-hidden="true"
                        initial={false}
                        animate={{ opacity: 1 }}
                        transition={TOOLBAR_FADE_TRANSITION}
                      />
                    ) : null}

                    <motion.button
                      type="button"
                      className={[
                        "dasti-inline-ai-toolbar__action",
                        isActionLoading
                          ? "dasti-inline-ai-toolbar__action--pending"
                          : "",
                        isPrimary
                          ? "dasti-inline-ai-toolbar__action--primary"
                          : "",
                        isAskAction
                          ? "dasti-inline-ai-toolbar__action--ghost"
                          : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      initial={false}
                      animate={{ opacity: 1 }}
                      transition={TOOLBAR_FADE_TRANSITION}
                      whileHover={
                        isLoading ? undefined : getButtonHoverStyle(isPressed)
                      }
                      style={getButtonBaseStyle(isPressed)}
                      onClick={() => handlePresetAction(action)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      disabled={isLoading}
                      aria-busy={isActionLoading || undefined}
                      aria-pressed={isActive}
                    >
                      <Icon size={14} strokeWidth={1.2} aria-hidden="true" />
                      <span className="dasti-inline-ai-toolbar__action-label">
                        {action.label}
                      </span>
                      {isActionLoading ? (
                        <Loader2
                          size={12}
                          strokeWidth={1.2}
                          aria-hidden="true"
                          className="dasti-inline-ai-toolbar__action-spinner animate-spin"
                        />
                      ) : null}
                    </motion.button>
                  </React.Fragment>
                );
              })}
            </motion.div>
          </motion.div>

          {isAskOpen ? (
            <motion.div
              ref={promptShellRef}
              className="dasti-inline-ai-toolbar__ribbon dasti-inline-ai-toolbar__ribbon--prompt"
              data-inline-ai-toolbar="true"
              style={{ overflow: "hidden", justifySelf: "center" }}
            >
              <motion.label
                className="dasti-inline-ai-toolbar__prompt-shell"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={TOOLBAR_FADE_TRANSITION}
              >
                <span
                  className="dasti-inline-ai-toolbar__prompt-icon"
                  aria-hidden="true"
                >
                  <Wand2 size={15} strokeWidth={1.2} />
                </span>
                <span className="sr-only">Ask AI</span>
                <input
                  type="text"
                  aria-label="Ask AI"
                  value={customInstruction}
                  onChange={(event) => setCustomInstruction(event.target.value)}
                  onFocus={() => setActiveActionId("ask")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && customInstruction.trim()) {
                      event.preventDefault();
                      onRunAction("custom", customInstruction.trim());
                    }
                  }}
                  placeholder={askPlaceholder}
                  className="dasti-inline-ai-toolbar__prompt-field"
                  disabled={isLoading}
                />
              </motion.label>

              <motion.button
                type="button"
                className="dasti-inline-ai-toolbar__apply dasti-inline-ai-toolbar__apply--icon"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={TOOLBAR_FADE_TRANSITION}
                whileHover={
                  isLoading || !customInstruction.trim()
                    ? undefined
                    : {
                        boxShadow: getButtonGlowBoxShadow(false),
                      }
                }
                onClick={() => onRunAction("custom", customInstruction.trim())}
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                disabled={isLoading || !customInstruction.trim()}
                aria-busy={isPromptLoading || undefined}
                aria-label={
                  isPromptLoading ? "Sending request" : "Send request"
                }
              >
                {isPromptLoading ? (
                  <Loader2
                    size={15}
                    strokeWidth={1.2}
                    aria-hidden="true"
                    className="animate-spin"
                  />
                ) : (
                  <SendHorizontal
                    size={15}
                    strokeWidth={1.2}
                    aria-hidden="true"
                  />
                )}
              </motion.button>
            </motion.div>
          ) : null}
        </motion.div>
      ) : null}
    </BodyPortal>
  );
}

export default FloatingAiToolbar;
