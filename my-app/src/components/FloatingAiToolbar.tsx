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
  width: number;
  height: number;
};

const DEFAULT_ACTION_ID = "make_human";
const MOTION_EASE = [0.22, 1, 0.36, 1] as const;
const WIDTH_SPRING = {
  type: "spring" as const,
  stiffness: 300,
  damping: 32,
};
const CLOSED_CLIP_PATH = "inset(0 50% 0 50% round 999px)";
const OPEN_CLIP_PATH = "inset(0 0% 0 0 round 999px)";
const COLLAPSED_SHELL_WIDTH = 56;
const EMPTY_METRICS: ToolbarMetrics = { width: 0, height: 0 };

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

function getMeasuredSize(element: HTMLElement | null): ToolbarMetrics {
  if (!element) {
    return EMPTY_METRICS;
  }

  return {
    width: Math.max(element.scrollWidth, element.offsetWidth),
    height: Math.max(element.scrollHeight, element.offsetHeight),
  };
}

function isSameMetrics(current: ToolbarMetrics, next: ToolbarMetrics): boolean {
  return current.width === next.width && current.height === next.height;
}

function getHoverGlow(): string {
  return [
    "0 0 15px rgba(255,255,255,0.05)",
    "0 1px 2px color-mix(in srgb, var(--shadow-color) 14%, transparent)",
    "inset 0 1px 0 color-mix(in srgb, white 12%, transparent)",
  ].join(", ");
}

function getPressedStyle(): React.CSSProperties {
  return {
    background:
      "color-mix(in srgb, var(--color-text) 88%, var(--color-accent) 12%)",
    borderColor: "color-mix(in srgb, var(--color-text) 18%, transparent)",
    color: "var(--color-on-accent)",
    boxShadow: [
      "inset 0 1px 0 color-mix(in srgb, white 8%, transparent)",
      "0 0 15px rgba(255,255,255,0.04)",
      "0 1px 2px color-mix(in srgb, var(--shadow-color) 20%, transparent)",
    ].join(", "),
  };
}

function getHoverStyle(isPressed: boolean): React.CSSProperties {
  if (isPressed) {
    return {
      boxShadow: getHoverGlow(),
    };
  }

  return {
    background: "color-mix(in srgb, var(--color-surface) 56%, transparent)",
    borderColor: "color-mix(in srgb, var(--color-border) 48%, transparent)",
    boxShadow: getHoverGlow(),
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

  const shellRef = React.useRef<HTMLDivElement | null>(null);

  const isAskOpen = activeActionId === "ask";
  const isPromptLoading = isLoading && pendingActionId === "custom";

  const updatePosition = React.useCallback(() => {
    if (!anchor || !shellRef.current || typeof window === "undefined") {
      return;
    }

    const shell = shellRef.current;
    const measured = getMeasuredSize(shell);

    setMetrics((current) =>
      isSameMetrics(current, measured) ? current : measured,
    );

    if (measured.width <= 0 || measured.height <= 0) {
      return;
    }

    const margin = resolveCssLength(shell, "--space-3", 12);
    const compactGap = resolveCssLength(shell, "--space-1", 4);
    const baseGap = resolveCssLength(shell, "--space-2", compactGap * 2);
    const controlSize = resolveCssLength(shell, "--control-md", 36);
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

    const maxLeft = horizontalMax - measured.width;
    const maxTop = verticalMax - measured.height;
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
    const preferredAboveTop = anchorTop - measured.height - aboveGap;
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
      ? anchor.focusLeft ??
        anchor.leftEdge ??
        anchor.aboveLeft ??
        anchor.left
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
      panelWidth: measured.width,
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
      measured.width - compactGap * 2,
    );

    setPosition({ left, top, placement, pointerOffset });
  }, [anchor]);

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

    if (shellRef.current) {
      resizeObserver?.observe(shellRef.current);
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
      if (shellRef.current?.contains(event.target as Node)) return;
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

  if (!open || !anchor) return null;

  const isPositionReady = position !== null && metrics.width > 0;

  return (
    <BodyPortal>
      <motion.div
        className="dasti-inline-ai-toolbar"
        data-inline-ai-toolbar="true"
        data-placement={position?.placement ?? "above"}
        role="toolbar"
        aria-label="Selected text actions"
        style={{
          position: "absolute",
          left: position?.left ?? anchor.left,
          top: position?.top ?? anchor.top,
          zIndex: 11000,
          visibility: isPositionReady ? "visible" : "hidden",
          pointerEvents: isPositionReady ? "auto" : "none",
          transformOrigin: "50% 50%",
          ["--dasti-inline-ai-toolbar-pointer-offset" as string]: position
            ? `${position.pointerOffset}px`
            : "50%",
        }}
        initial={false}
        animate={{
          opacity: isPositionReady ? 1 : 0,
          y: isPositionReady ? 0 : 4,
          scale: isPositionReady ? 1 : 0.985,
        }}
        transition={{
          duration: 0.22,
          ease: MOTION_EASE,
        }}
      >
        <motion.div
          ref={shellRef}
          className="dasti-inline-ai-toolbar__ribbon"
          data-inline-ai-toolbar="true"
          initial={false}
          animate={{
            width: isPositionReady
              ? Math.max(metrics.width, COLLAPSED_SHELL_WIDTH)
              : COLLAPSED_SHELL_WIDTH,
            clipPath: isPositionReady ? OPEN_CLIP_PATH : CLOSED_CLIP_PATH,
          }}
          transition={{
            width: WIDTH_SPRING,
            clipPath: { duration: 0.28, ease: MOTION_EASE },
          }}
          onPointerDownCapture={(event) => {
            const target = event.target as HTMLElement | null;
            if (
              target?.closest("input, textarea, select, [contenteditable='true']")
            ) {
              return;
            }

            event.preventDefault();
          }}
          style={{
            overflow: "hidden",
            minHeight: "56px",
            borderRadius: "999px",
            boxShadow: [
              "inset 0 1px 0 color-mix(in srgb, white 40%, transparent)",
              "0 12px 32px color-mix(in srgb, var(--shadow-color) 16%, transparent)",
              "0 4px 12px color-mix(in srgb, var(--shadow-color) 10%, transparent)",
            ].join(", "),
          }}
        >
          <div
            className="dasti-inline-ai-toolbar__shadow"
            aria-hidden="true"
            style={{
              insetInline: "22%",
              insetBlockEnd: "-14px",
              height: "22px",
              opacity: 0.22,
              filter: "blur(18px)",
            }}
          />

          <motion.div
            className="dasti-inline-ai-toolbar__actions"
            initial={false}
            animate={{
              opacity: isPositionReady ? 1 : 0,
              y: isPositionReady ? 0 : 4,
            }}
            transition={{
              delay: 0.08,
              duration: 0.2,
              ease: MOTION_EASE,
            }}
            style={{
              minHeight: "56px",
              gap: "6px",
              paddingInline: "8px",
            }}
          >
            {VISIBLE_TOOLBAR_IDS.map((id, index) => {
              const action = INLINE_AI_ACTIONS.find((item) => item.id === id)!;
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
                      animate={{
                        opacity: isPositionReady ? 1 : 0,
                        y: isPositionReady ? 0 : 4,
                      }}
                      transition={{
                        delay: 0.1 + index * 0.02,
                        duration: 0.18,
                        ease: MOTION_EASE,
                      }}
                      style={{
                        marginBlock: "12px",
                        background:
                          "color-mix(in srgb, var(--color-border) 54%, transparent)",
                      }}
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
                    animate={{
                      opacity: isPositionReady ? 1 : 0,
                      y: isPositionReady ? 0 : 4,
                    }}
                    transition={{
                      delay: 0.1 + index * 0.02,
                      duration: 0.18,
                      ease: MOTION_EASE,
                    }}
                    whileHover={
                      isLoading ? undefined : getHoverStyle(isPressed)
                    }
                    onClick={() => handlePresetAction(action)}
                    onMouseDown={(event) => {
                      event.preventDefault();
                    }}
                    disabled={isLoading}
                    aria-busy={isActionLoading || undefined}
                    aria-pressed={isActive}
                    style={{
                      ...(isPressed ? getPressedStyle() : {}),
                      ...(isPressed
                        ? {}
                        : {
                            background: "transparent",
                            boxShadow: "none",
                            color: isAskAction
                              ? "color-mix(in srgb, var(--tm2) 88%, var(--ti) 12%)"
                              : "color-mix(in srgb, var(--ti) 78%, var(--tm2) 22%)",
                          }),
                      minHeight: "44px",
                      paddingInline: "14px",
                      borderRadius: "999px",
                      borderColor: isPressed
                        ? "color-mix(in srgb, var(--color-text) 18%, transparent)"
                        : "transparent",
                      transition:
                        "background var(--duration-fast) var(--ease-standard), border-color var(--duration-fast) var(--ease-standard), color var(--duration-fast) var(--ease-standard), box-shadow var(--duration-fast) var(--ease-standard)",
                    }}
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

            {isAskOpen ? (
              <motion.div
                initial={false}
                animate={{
                  opacity: isPositionReady ? 1 : 0,
                  x: isPositionReady ? 0 : -6,
                }}
                transition={{
                  delay: 0.16,
                  duration: 0.2,
                  ease: MOTION_EASE,
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  minWidth: 0,
                  gap: "8px",
                  paddingInlineStart: "6px",
                  marginInlineStart: "2px",
                  borderInlineStart:
                    "1px solid color-mix(in srgb, var(--color-border) 46%, transparent)",
                }}
              >
                <span
                  className="dasti-inline-ai-toolbar__prompt-icon"
                  aria-hidden="true"
                  style={{
                    color: "color-mix(in srgb, var(--tm2) 70%, var(--ti) 30%)",
                  }}
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
                  style={{
                    minWidth: "clamp(180px, 22vw, 280px)",
                    height: "44px",
                    background: "transparent",
                    color: "var(--color-text)",
                    fontSize: "var(--text-body-size)",
                    lineHeight: "var(--text-body-line)",
                  }}
                />
                <motion.button
                  type="button"
                  className="dasti-inline-ai-toolbar__apply dasti-inline-ai-toolbar__apply--icon"
                  initial={false}
                  animate={{
                    opacity: isPositionReady ? 1 : 0,
                    x: isPositionReady ? 0 : -4,
                  }}
                  transition={{
                    delay: 0.2,
                    duration: 0.18,
                    ease: MOTION_EASE,
                  }}
                  whileHover={
                    isLoading || !customInstruction.trim()
                      ? undefined
                      : {
                          boxShadow: getHoverGlow(),
                        }
                  }
                  onClick={() => onRunAction("custom", customInstruction.trim())}
                  onMouseDown={(event) => {
                    event.preventDefault();
                  }}
                  disabled={isLoading || !customInstruction.trim()}
                  aria-busy={isPromptLoading || undefined}
                  aria-label={isPromptLoading ? "Sending request" : "Send request"}
                  style={{
                    inlineSize: "44px",
                    minHeight: "44px",
                    paddingInline: 0,
                    borderRadius: "999px",
                    borderColor:
                      "color-mix(in srgb, var(--color-border) 42%, transparent)",
                    background:
                      "color-mix(in srgb, var(--color-surface) 52%, transparent)",
                    boxShadow: "none",
                  }}
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
        </motion.div>
      </motion.div>
    </BodyPortal>
  );
}

export default FloatingAiToolbar;
