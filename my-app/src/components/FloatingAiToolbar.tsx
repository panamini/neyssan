import React from "react";
import { LayoutGroup, motion } from "framer-motion";
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

// The 4 actions shown in the toolbar (Clarify, Strengthen, Fix are available
// via the full INLINE_AI_ACTIONS array but not surfaced in the toolbar UI)
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
  preferStartAlign = false,
}: {
  panelWidth: number;
  boundsMin: number;
  boundsMax: number;
  preferredCenter: number;
  preferredLeftEdge: number;
  preferredRightEdge: number;
  selectionWidth: number;
  edgePadding: number;
  preferStartAlign?: boolean;
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

  if (preferStartAlign) {
    if (nearTrailingEdge && !nearLeadingEdge) {
      return endAlignedLeft;
    }
    return startAlignedLeft;
  }

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
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const updatePosition = React.useCallback(() => {
    if (!anchor || !panelRef.current || typeof window === "undefined") {
      return;
    }

    const panel = panelRef.current;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const margin = resolveCssLength(panel, "--space-3", 12);
    const compactGap = resolveCssLength(panel, "--space-1", 4);
    const baseGap = resolveCssLength(panel, "--space-2", compactGap * 2);
    const controlSize = resolveCssLength(panel, "--control-md", 36);
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

    const preferredCenter = isBlockSelection
      ? anchor.containerLeft != null && anchor.containerRight != null
        ? anchor.containerLeft + (anchor.containerRight - anchor.containerLeft) / 2
        : anchor.left
      : anchor.focusCenter ??
        (placement === "above"
          ? anchor.aboveCenter ?? anchor.left
          : anchor.belowCenter ?? anchor.left);
    const preferredLeftEdge = isBlockSelection
      ? anchor.leftEdge ?? anchor.aboveLeft ?? anchor.left
      : anchor.focusLeft ??
        (placement === "above"
          ? anchor.aboveLeft ?? anchor.leftEdge ?? anchor.left
          : anchor.belowLeft ?? anchor.leftEdge ?? anchor.left);
    const preferredRightEdge = isBlockSelection
      ? anchor.rightEdge ?? anchor.belowRight ?? anchor.left
      : anchor.focusRight ??
        (placement === "above"
          ? anchor.aboveRight ?? anchor.rightEdge ?? anchor.left
          : anchor.belowRight ?? anchor.rightEdge ?? anchor.left);
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
      preferStartAlign: isBlockSelection,
    });

    top = clamp(top, verticalMin, maxTop);
    const left = clamp(desiredLeft, horizontalMin, maxLeft);
    const pointerOffset = clamp(
      preferredCenter - left,
      compactGap * 2,
      width - compactGap * 2,
    );

    setPosition({ left, top, placement, pointerOffset });
  }, [anchor]);

  React.useEffect(() => {
    if (!open) {
      setActiveActionId(DEFAULT_ACTION_ID);
      setCustomInstruction("");
      setPosition(null);
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

    const update = () => {
      updatePosition();
    };

    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, open, updatePosition]);

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

  if (!open || !anchor) return null;

  const isAskOpen = activeActionId === "ask";
  const isPromptLoading = isLoading && pendingActionId === "custom";

  return (
    <BodyPortal>
      <motion.div
        ref={panelRef}
        className="dasti-inline-ai-toolbar"
        data-inline-ai-toolbar="true"
        data-placement={position?.placement ?? "above"}
        role="toolbar"
        aria-label="Selected text actions"
        style={{
          position: "absolute",
          left: position?.left ?? anchor.left,
          top: position?.top ?? anchor.top,
          ["--dasti-inline-ai-toolbar-pointer-offset" as string]: position
            ? `${position.pointerOffset}px`
            : "50%",
          zIndex: 11000,
        }}
        initial={{
          opacity: 0,
          scale: 0.95,
          y: position?.placement === "below" ? -4 : -6,
        }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.12, ease: MOTION_EASE }}
        onPointerDownCapture={(event) => {
          const target = event.target as HTMLElement | null;
          if (
            target?.closest("input, textarea, select, [contenteditable='true']")
          ) {
            return;
          }

          event.preventDefault();
        }}
      >
        <div className="dasti-inline-ai-toolbar__shadow" aria-hidden="true" />
        <div className="dasti-inline-ai-toolbar__ribbon dasti-inline-ai-toolbar__ribbon--actions">
          <LayoutGroup id="inline-ai-toolbar-actions">
            <div className="dasti-inline-ai-toolbar__actions">
              {VISIBLE_TOOLBAR_IDS.map((id) => {
                const action = INLINE_AI_ACTIONS.find((a) => a.id === id)!;
                const Icon = TOOLBAR_ICONS[id];
                const isAskAction = id === "ask";
                const isPrimary = id === "make_human";
                const isActionLoading =
                  isLoading && pendingActionId === action.id;
                const isActive = activeActionId === action.id;
                return (
                  <React.Fragment key={action.id}>
                    {isAskAction ? (
                      <span
                        className="dasti-inline-ai-toolbar__action-divider"
                        aria-hidden="true"
                      />
                    ) : null}
                    <button
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
                      onClick={() => handlePresetAction(action)}
                      onMouseDown={(event) => {
                        event.preventDefault();
                      }}
                      disabled={isLoading}
                      aria-busy={isActionLoading || undefined}
                      aria-pressed={isActive}
                    >
                      {isActive ? (
                        <motion.span
                          layoutId="dasti-inline-ai-toolbar-pill"
                          className="dasti-inline-ai-toolbar__action-pill"
                          transition={{ duration: 0.18, ease: MOTION_EASE }}
                        />
                      ) : null}
                      <Icon size={14} strokeWidth={1.7} aria-hidden="true" />
                      <span className="dasti-inline-ai-toolbar__action-label">
                        {action.label}
                      </span>
                      {isActionLoading ? (
                        <Loader2
                          size={12}
                          strokeWidth={1.8}
                          aria-hidden="true"
                          className="dasti-inline-ai-toolbar__action-spinner animate-spin"
                        />
                      ) : null}
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </LayoutGroup>
        </div>

        {isAskOpen ? (
          <motion.div
            className="dasti-inline-ai-toolbar__ribbon dasti-inline-ai-toolbar__ribbon--prompt"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.18, ease: MOTION_EASE }}
          >
            <label className="dasti-inline-ai-toolbar__prompt-shell">
              <span
                className="dasti-inline-ai-toolbar__prompt-icon"
                aria-hidden="true"
              >
                <Wand2 size={15} strokeWidth={1.7} />
              </span>
              <span className="sr-only">Ask AI</span>
              <input
                type="text"
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
            </label>

            <button
              type="button"
              className="dasti-inline-ai-toolbar__apply dasti-inline-ai-toolbar__apply--icon"
              onClick={() => onRunAction("custom", customInstruction.trim())}
              onMouseDown={(event) => {
                event.preventDefault();
              }}
              disabled={isLoading || !customInstruction.trim()}
              aria-busy={isPromptLoading || undefined}
              aria-label={isPromptLoading ? "Sending request" : "Send request"}
            >
              {isPromptLoading ? (
                <Loader2
                  size={15}
                  strokeWidth={1.8}
                  aria-hidden="true"
                  className="animate-spin"
                />
              ) : (
                <SendHorizontal
                  size={15}
                  strokeWidth={1.8}
                  aria-hidden="true"
                />
              )}
            </button>
          </motion.div>
        ) : null}
      </motion.div>
    </BodyPortal>
  );
}

export default FloatingAiToolbar;
