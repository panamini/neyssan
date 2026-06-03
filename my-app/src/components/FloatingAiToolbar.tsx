import React from "react";
import { motion } from "framer-motion";
import { BodyPortal } from "@/components/ui/body-portal";
import { ArrowLeft, Pencil, SendHorizontal } from "@/lib/icons";
import {
  getVisibleToolbarAiActions,
  VISIBLE_TOOLBAR_AI_ACTIONS,
  type AiActionDefinition,
  type AiActionId,
} from "@/lib/ai/interactionRulebook";
import {
  useDocumentAiSurfacePosition,
  type DocumentAiSurfacePosition,
} from "@/lib/document-ai-surface-position";
import {
  getInlinePaperFormattingActionsForSelection,
  type EditorSelectionAnchor,
} from "@/lib/editor-ai-selection";

const SELECTION_VISIBLE_ACTION_IDS = [
  "rewrite",
  "shorten",
  "fix_grammar",
  "custom",
] as const satisfies readonly AiActionId[];

export const INLINE_AI_ACTIONS = SELECTION_VISIBLE_ACTION_IDS.flatMap((actionId) => {
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
  formattingActions?: FloatingSelectionToolbarAction[];
  compactFormattingLabel?: string;
  onClose: () => void;
  onRunAction: (actionId: InlineAiActionId, instruction: string) => void;
  onSurfacePlacementChange?: (
    position: DocumentAiSurfacePosition | null,
  ) => void;
};

export type FloatingSelectionToolbarAction = {
  id: string;
  label: string;
  title?: string;
  icon?: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  onRun: () => void;
  onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

type FloatingSelectionToolbarShellProps = {
  anchor: EditorSelectionAnchor | null;
  open: boolean;
  desiredSurfaceSize: {
    width: number;
    height: number;
    minWidth: number;
    minHeight: number;
  };
  panelRef: React.RefObject<HTMLDivElement | null>;
  contentReady?: boolean;
  onClose: () => void;
  onSurfacePlacementChange?: (
    position: DocumentAiSurfacePosition | null,
  ) => void;
  children: (args: { isPositionReady: boolean }) => React.ReactNode;
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

export function FloatingSelectionToolbarShell({
  anchor,
  open,
  desiredSurfaceSize,
  panelRef,
  contentReady = true,
  onClose,
  onSurfacePlacementChange,
  children,
}: FloatingSelectionToolbarShellProps) {
  const [hasMeasuredInitialMetrics, setHasMeasuredInitialMetrics] =
    React.useState(false);
  const [isToolbarMounted, setIsToolbarMounted] = React.useState(() =>
    Boolean(open && anchor),
  );
  const lastAnchorRef = React.useRef<EditorSelectionAnchor | null>(anchor);

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
      setHasMeasuredInitialMetrics(false);
    }
  }, [open]);

  React.useLayoutEffect(() => {
    if (!open || !anchor) {
      return undefined;
    }

    setHasMeasuredInitialMetrics(true);
    const frame = window.requestAnimationFrame(() => {
      setHasMeasuredInitialMetrics(true);
    });

    return () => window.cancelAnimationFrame(frame);
  }, [anchor, open, desiredSurfaceSize]);

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
  }, [onClose, open, panelRef]);

  const renderAnchor = open && anchor ? anchor : lastAnchorRef.current;
  const position = useDocumentAiSurfacePosition({
    anchor,
    desiredSurfaceSize,
    mode: "toolbar",
    enabled: open && anchor !== null,
  });
  const shouldRenderToolbar = isToolbarMounted && renderAnchor !== null;
  const isPositionReady =
    open &&
    anchor !== null &&
    position !== null &&
    hasMeasuredInitialMetrics &&
    contentReady;

  React.useEffect(() => {
    onSurfacePlacementChange?.(isPositionReady ? position : null);
  }, [isPositionReady, onSurfacePlacementChange, position]);

  return (
    <BodyPortal>
      {shouldRenderToolbar && renderAnchor ? (
        <motion.div
          ref={panelRef}
          className="ds-ai-toolbar"
          data-inline-ai-toolbar="true"
          data-selection-toolbar="true"
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
          {children({ isPositionReady })}
        </motion.div>
      ) : null}
    </BodyPortal>
  );
}

export function FloatingAiToolbar({
  anchor,
  open,
  isLoading = false,
  pendingActionId = null,
  includeJobContextActions = false,
  formattingActions = [],
  compactFormattingLabel = "Edit",
  onClose,
  onRunAction,
  onSurfacePlacementChange,
}: FloatingAiToolbarProps) {
  const [activeActionId, setActiveActionId] =
    React.useState<InlineAiActionId>(DEFAULT_ACTION_ID);
  const [compactMode, setCompactMode] = React.useState<"ai" | "format">("ai");
  const [customInstruction, setCustomInstruction] = React.useState("");
  const [askPlaceholder, setAskPlaceholder] = React.useState<string>(
    ASK_SUGGESTIONS[0],
  );
  const [metrics, setMetrics] = React.useState<ToolbarMetrics>(EMPTY_METRICS);
  const [registeredFormattingActions, setRegisteredFormattingActions] =
    React.useState<FloatingSelectionToolbarAction[]>([]);

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const actionShellRef = React.useRef<HTMLDivElement | null>(null);
  const promptShellRef = React.useRef<HTMLDivElement | null>(null);
  const askInputRef = React.useRef<HTMLInputElement | null>(null);

  const isAskOpen = activeActionId === "custom";
  const isPromptLoading = isLoading && pendingActionId === "custom";
  const toolbarActions = React.useMemo(
    () =>
      includeJobContextActions
        ? getVisibleToolbarAiActions({ includeJobContextActions: true })
        : INLINE_AI_ACTIONS,
    [includeJobContextActions],
  );
  const resolvedFormattingActions =
    formattingActions.length > 0
      ? formattingActions
      : registeredFormattingActions;
  const hasFormattingActions = resolvedFormattingActions.length > 0;

  const refreshRegisteredFormattingActions = React.useCallback(() => {
    if (formattingActions.length > 0 || typeof window === "undefined") {
      setRegisteredFormattingActions([]);
      return;
    }

    setRegisteredFormattingActions(
      getInlinePaperFormattingActionsForSelection(),
    );
  }, [formattingActions.length]);

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
    if (!open) {
      setActiveActionId(DEFAULT_ACTION_ID);
      setCompactMode("ai");
      setCustomInstruction("");
      setMetrics(EMPTY_METRICS);
      setRegisteredFormattingActions([]);
    }
  }, [open]);

  React.useEffect(() => {
    if (!open || !anchor) {
      return undefined;
    }

    refreshRegisteredFormattingActions();
    document.addEventListener("selectionchange", refreshRegisteredFormattingActions);

    return () => {
      document.removeEventListener(
        "selectionchange",
        refreshRegisteredFormattingActions,
      );
    };
  }, [anchor, open, refreshRegisteredFormattingActions]);

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

  const handleFormattingAction = React.useCallback(
    (action: FloatingSelectionToolbarAction) => {
      action.onRun();
      setCompactMode("ai");
      window.setTimeout(() => {
        refreshRegisteredFormattingActions();
        updateMetrics();
      }, 0);
    },
    [refreshRegisteredFormattingActions, updateMetrics],
  );

  const submitCustomInstruction = React.useCallback(() => {
    const trimmedInstruction = customInstruction.trim();
    if (!trimmedInstruction || isLoading) return;
    onRunAction("custom", trimmedInstruction);
  }, [customInstruction, isLoading, onRunAction]);

  const desiredSurfaceSize = React.useMemo(
    () => ({
      width: Math.max(metrics.panelWidth, INITIAL_TOOLBAR_WIDTH),
      height: Math.max(metrics.panelHeight, INITIAL_TOOLBAR_HEIGHT),
      minWidth: COLLAPSED_SHELL_WIDTH,
      minHeight: 36,
    }),
    [metrics.panelHeight, metrics.panelWidth],
  );
  const hasMeasuredToolbarMetrics =
    metrics.panelWidth > 0 && metrics.panelHeight > 0;

  React.useEffect(() => {
    if (!isAskOpen || !open || isPromptLoading || !hasMeasuredToolbarMetrics) return;

    askInputRef.current?.focus({ preventScroll: true });
  }, [hasMeasuredToolbarMetrics, isAskOpen, isPromptLoading, open]);

  return (
    <FloatingSelectionToolbarShell
      anchor={anchor}
      open={open}
      desiredSurfaceSize={desiredSurfaceSize}
      panelRef={panelRef}
      contentReady={hasMeasuredToolbarMetrics}
      onClose={onClose}
      onSurfacePlacementChange={(position) => {
        onSurfacePlacementChange?.(
          position && hasMeasuredToolbarMetrics ? position : null,
        );
      }}
    >
      {() => (
        <>
          {hasFormattingActions ? (
            <div
              className="ds-ai-toolbar__format-actions"
              data-inline-ai-toolbar="true"
              data-selection-toolbar-format="wide"
              role="group"
              aria-label="Text formatting"
            >
              {resolvedFormattingActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="ds-ai-toolbar__btn ds-ai-toolbar__btn--icon"
                  onMouseDown={(event) => {
                    action.onMouseDown?.(event);
                    event.preventDefault();
                  }}
                  onClick={() => handleFormattingAction(action)}
                  disabled={action.disabled}
                  aria-label={action.label}
                  aria-pressed={action.active}
                  title={action.title ?? action.label}
                >
                  {action.icon ?? action.label}
                </button>
              ))}
              <span className="ds-ai-toolbar__divider" aria-hidden="true" />
            </div>
          ) : null}

          <div
            ref={actionShellRef}
            className="ds-ai-toolbar__actions"
            data-inline-ai-toolbar="true"
            data-selection-toolbar-mode={compactMode}
            style={{
              display: compactMode === "format" ? "none" : "inline-flex",
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
            {hasFormattingActions ? (
              <>
                <span
                  className="ds-ai-toolbar__divider ds-ai-toolbar__divider--compact-edit"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  className="ds-ai-toolbar__btn ds-ai-toolbar__btn--edit"
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => {
                    setActiveActionId(DEFAULT_ACTION_ID);
                    setCompactMode("format");
                  }}
                  aria-label={compactFormattingLabel}
                  title={compactFormattingLabel}
                >
                  <Pencil size={14} aria-hidden="true" />
                  <span className="ds-ai-toolbar__btn-label">
                    {compactFormattingLabel}
                  </span>
                </button>
              </>
            ) : null}
          </div>

          {hasFormattingActions ? (
            <div
              className="ds-ai-toolbar__compact-format-actions"
              data-inline-ai-toolbar="true"
              data-selection-toolbar-mode={compactMode}
              role="group"
              aria-label="Text formatting"
              style={{
                display: compactMode === "format" ? "inline-flex" : "none",
              }}
            >
              <button
                type="button"
                className="ds-ai-toolbar__btn ds-ai-toolbar__btn--back"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => setCompactMode("ai")}
                aria-label="Back to AI"
                title="Back to AI"
              >
                <ArrowLeft size={14} aria-hidden="true" />
                <span className="ds-ai-toolbar__btn-label">AI</span>
              </button>
              <span className="ds-ai-toolbar__divider" aria-hidden="true" />
              {resolvedFormattingActions.map((action) => (
                <button
                  key={action.id}
                  type="button"
                  className="ds-ai-toolbar__btn ds-ai-toolbar__btn--icon"
                  onMouseDown={(event) => {
                    action.onMouseDown?.(event);
                    event.preventDefault();
                  }}
                  onClick={() => handleFormattingAction(action)}
                  disabled={action.disabled}
                  aria-label={action.label}
                  aria-pressed={action.active}
                  title={action.title ?? action.label}
                >
                  {action.icon ?? action.label}
                </button>
              ))}
            </div>
          ) : null}

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
        </>
      )}
    </FloatingSelectionToolbarShell>
  );
}

export default FloatingAiToolbar;
