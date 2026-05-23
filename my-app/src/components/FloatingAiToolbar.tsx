import React from "react";
import { motion } from "framer-motion";
import { BodyPortal } from "@/components/ui/body-portal";
import { SendHorizontal } from "@/lib/icons";
import {
  getVisibleToolbarAiActions,
  VISIBLE_TOOLBAR_AI_ACTIONS,
  type AiActionDefinition,
  type AiActionId,
} from "@/lib/ai/interactionRulebook";
import {
  useCvAiSurfacePosition,
  type CvAiSurfacePosition,
} from "@/lib/cv-ai-surface-position";
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
const INITIAL_TOOLBAR_WIDTH = 220;
const INITIAL_TOOLBAR_HEIGHT = 48;

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
  onSurfacePlacementChange?: (position: CvAiSurfacePosition | null) => void;
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
  onSurfacePlacementChange,
}: FloatingAiToolbarProps) {
  const [activeActionId, setActiveActionId] =
    React.useState<InlineAiActionId>(DEFAULT_ACTION_ID);
  const [customInstruction, setCustomInstruction] = React.useState("");
  const [askPlaceholder, setAskPlaceholder] = React.useState<string>(
    ASK_SUGGESTIONS[0],
  );
  const [metrics, setMetrics] = React.useState<ToolbarMetrics>(EMPTY_METRICS);
  const [hasMeasuredInitialMetrics, setHasMeasuredInitialMetrics] =
    React.useState(false);
  const [isToolbarMounted, setIsToolbarMounted] = React.useState(() =>
    Boolean(open && anchor),
  );

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const actionShellRef = React.useRef<HTMLDivElement | null>(null);
  const promptShellRef = React.useRef<HTMLDivElement | null>(null);
  const askInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastAnchorRef = React.useRef<EditorSelectionAnchor | null>(anchor);

  const isAskOpen = activeActionId === "custom";
  const isPromptLoading = isLoading && pendingActionId === "custom";
  const toolbarActions = React.useMemo(
    () =>
      includeJobContextActions
        ? getVisibleToolbarAiActions({ includeJobContextActions: true })
        : INLINE_AI_ACTIONS,
    [includeJobContextActions],
  );

  const updateMetrics = React.useCallback(() => {
    if (!panelRef.current || typeof window === "undefined") {
      return;
    }

    const panel = panelRef.current;
    const compactGap = resolveCssLength(panel, "--s1", 4);
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
      setMetrics(EMPTY_METRICS);
      setHasMeasuredInitialMetrics(false);
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

    const update = () => {
      updateMetrics();
    };

    update();
    setHasMeasuredInitialMetrics(true);
    const frame = window.requestAnimationFrame(update);

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
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [anchor, open, isAskOpen, updateMetrics]);

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
        setActiveActionId((current) => {
          if (current === "custom") {
            window.setTimeout(() => {
              askInputRef.current?.focus({ preventScroll: true });
            }, 0);
            return "custom";
          }
          return "custom";
        });
        return;
      }

      setActiveActionId(action.id);
      onRunAction(action.id, action.instruction);
    },
    [onRunAction],
  );

  const submitCustomInstruction = React.useCallback(() => {
    const trimmedInstruction = customInstruction.trim();
    if (!trimmedInstruction || isLoading) return;
    onRunAction("custom", trimmedInstruction);
  }, [customInstruction, isLoading, onRunAction]);

  const renderAnchor = open && anchor ? anchor : lastAnchorRef.current;
  const desiredSurfaceSize = React.useMemo(
    () => ({
      width: Math.max(metrics.panelWidth, INITIAL_TOOLBAR_WIDTH),
      height: Math.max(metrics.panelHeight, INITIAL_TOOLBAR_HEIGHT),
      minWidth: COLLAPSED_SHELL_WIDTH,
      minHeight: 36,
    }),
    [metrics.panelHeight, metrics.panelWidth],
  );
  const position = useCvAiSurfacePosition({
    anchor,
    desiredSurfaceSize,
    mode: "toolbar",
    enabled: open && anchor !== null,
  });
  const shouldRenderToolbar = isToolbarMounted && renderAnchor !== null;
  const hasMeasuredToolbarMetrics =
    metrics.panelWidth > 0 && metrics.panelHeight > 0;
  const isPositionReady =
    open &&
    anchor !== null &&
    position !== null &&
    hasMeasuredInitialMetrics &&
    hasMeasuredToolbarMetrics;

  React.useEffect(() => {
    onSurfacePlacementChange?.(isPositionReady ? position : null);
  }, [isPositionReady, onSurfacePlacementChange, position]);

  React.useEffect(() => {
    if (!isAskOpen || !isPositionReady || isPromptLoading) return;

    askInputRef.current?.focus({ preventScroll: true });
  }, [isAskOpen, isPositionReady, isPromptLoading]);

  return (
    <BodyPortal>
      {shouldRenderToolbar && renderAnchor ? (
        <motion.div
          ref={panelRef}
          className="ds-ai-toolbar"
          data-inline-ai-toolbar="true"
          data-cv-ai-surface-group="true"
          data-cv-ai-surface-state="toolbar"
          data-cv-ai-surface-placement={position?.placement ?? "above"}
          data-cv-ai-surface-clamped={position?.clamped ? "true" : "false"}
          data-cv-ai-surface-mode={position?.mode ?? "popover"}
          data-state={isPositionReady ? "open" : "closing"}
          data-placement={position?.placement ?? "above"}
          role="toolbar"
          aria-label="Selected text actions"
          style={{
            position: "absolute",
            left: isPositionReady && position ? position.left : renderAnchor.left,
            top: isPositionReady && position ? position.top : renderAnchor.top,
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
                  ref={askInputRef}
                  type="text"
                  aria-label="Ask AI"
                  value={customInstruction}
                  onChange={(event) => setCustomInstruction(event.target.value)}
                  onFocus={() => setActiveActionId("custom")}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && customInstruction.trim()) {
                      event.preventDefault();
                      submitCustomInstruction();
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
              <button
                type="button"
                className="ds-ask-ai__send"
                aria-label="Send"
                onMouseDown={(event) => {
                  event.preventDefault();
                }}
                onClick={submitCustomInstruction}
                disabled={!customInstruction.trim() || isLoading}
              >
                <SendHorizontal size={14} aria-hidden="true" />
              </button>
            </div>
          ) : null}
        </motion.div>
      ) : null}
    </BodyPortal>
  );
}

export default FloatingAiToolbar;
