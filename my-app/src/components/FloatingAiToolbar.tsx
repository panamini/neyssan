import React from "react";
import { motion } from "framer-motion";
import { BodyPortal } from "@/components/ui/body-portal";
import {
  ArrowLeft,
  CornersIn,
  PenNib,
  SendHorizontal,
  Sparkle,
  TextT,
  Wrench,
} from "@/lib/icons";
import {
  getVisibleToolbarAiActions,
  VISIBLE_TOOLBAR_AI_ACTIONS,
  type AiActionDefinition,
  type AiActionId,
} from "@/lib/ai/interactionRulebook";
import {
  useDocumentAiSurfacePosition,
  type DocumentAiSurfacePosition,
  type DocumentAiSurfacePlacementStrategy,
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
const TOOLBAR_LAYOUT_TRANSITION = {
  type: "spring",
  stiffness: 200,
  damping: 24,
  mass: 0.8,
} as const;
const COLLAPSED_SHELL_WIDTH = 36;
const INITIAL_TOOLBAR_WIDTH = 220;
const INITIAL_TOOLBAR_HEIGHT = 48;
const COLLAPSED_DENSITY_MEDIA_QUERY = "(max-width: 420px)";

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

const AI_ACTION_ICONS: Partial<Record<InlineAiActionId, React.ReactNode>> = {
  rewrite: <PenNib size={14} aria-hidden="true" />,
  shorten: <CornersIn size={14} aria-hidden="true" />,
  fix_grammar: <Wrench size={14} aria-hidden="true" />,
  custom: <Sparkle size={14} aria-hidden="true" />,
};

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
  placementStrategy?: DocumentAiSurfacePlacementStrategy;
  children: (args: { isPositionReady: boolean }) => React.ReactNode;
};

type ToolbarMetrics = {
  actionWidth: number;
  actionHeight: number;
  compactFormatWidth: number;
  compactFormatHeight: number;
  wideFormatWidth: number;
  wideFormatHeight: number;
  promptWidth: number;
  promptHeight: number;
  panelWidth: number;
  panelHeight: number;
};

const EMPTY_METRICS: ToolbarMetrics = {
  actionWidth: 0,
  actionHeight: 0,
  compactFormatWidth: 0,
  compactFormatHeight: 0,
  wideFormatWidth: 0,
  wideFormatHeight: 0,
  promptWidth: 0,
  promptHeight: 0,
  panelWidth: 0,
  panelHeight: 0,
};

function resolveCssLength(
  element: HTMLElement | null,
  cssVariable: string,
  fallback: number,
): number {
  if (!element || typeof window === "undefined") {
    return fallback;
  }

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

function getBoxChromeSize(element: HTMLElement | null): {
  horizontal: number;
  vertical: number;
} {
  if (!element || typeof window === "undefined") {
    return { horizontal: 0, vertical: 0 };
  }

  const style = window.getComputedStyle(element);
  const read = (value: string): number => {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
  };

  return {
    horizontal:
      read(style.paddingLeft) +
      read(style.paddingRight) +
      read(style.borderLeftWidth) +
      read(style.borderRightWidth),
    vertical:
      read(style.paddingTop) +
      read(style.paddingBottom) +
      read(style.borderTopWidth) +
      read(style.borderBottomWidth),
  };
}

function getInlineGap(element: HTMLElement | null, fallback: number): number {
  if (!element || typeof window === "undefined") {
    return fallback;
  }

  const style = window.getComputedStyle(element);
  const parsed = Number.parseFloat(style.columnGap || style.gap);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function isSameMetrics(current: ToolbarMetrics, next: ToolbarMetrics): boolean {
  return (
    current.actionWidth === next.actionWidth &&
    current.actionHeight === next.actionHeight &&
    current.compactFormatWidth === next.compactFormatWidth &&
    current.compactFormatHeight === next.compactFormatHeight &&
    current.wideFormatWidth === next.wideFormatWidth &&
    current.wideFormatHeight === next.wideFormatHeight &&
    current.promptWidth === next.promptWidth &&
    current.promptHeight === next.promptHeight &&
    current.panelWidth === next.panelWidth &&
    current.panelHeight === next.panelHeight
  );
}

function readCollapsedSelectionToolbarDensity(): boolean {
  if (typeof window === "undefined") return false;
  if (typeof window.matchMedia === "function") {
    return window.matchMedia(COLLAPSED_DENSITY_MEDIA_QUERY).matches;
  }
  return window.innerWidth <= 420;
}

function useCollapsedSelectionToolbarDensity(open: boolean): boolean {
  const [isCollapsedDensity, setIsCollapsedDensity] = React.useState(() =>
    readCollapsedSelectionToolbarDensity(),
  );

  React.useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const update = () => {
      setIsCollapsedDensity(readCollapsedSelectionToolbarDensity());
    };
    update();

    if (typeof window.matchMedia !== "function") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }

    const mediaQuery = window.matchMedia(COLLAPSED_DENSITY_MEDIA_QUERY);
    mediaQuery.addEventListener?.("change", update);
    return () => mediaQuery.removeEventListener?.("change", update);
  }, [open]);

  return isCollapsedDensity;
}

export function FloatingSelectionToolbarShell({
  anchor,
  open,
  desiredSurfaceSize,
  panelRef,
  contentReady = true,
  onClose,
  onSurfacePlacementChange,
  placementStrategy = "selectionAnchor",
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
    placementStrategy,
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
          ref={panelRef as React.Ref<HTMLDivElement>}
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
            width: isPositionReady
              ? desiredSurfaceSize.width
              : desiredSurfaceSize.minWidth,
            zIndex: 11000,
            visibility: isPositionReady ? "visible" : "hidden",
            pointerEvents: isPositionReady ? "auto" : "none",
            overflow: "hidden",
          }}
          initial={{ opacity: 0 }}
          animate={{
            opacity: isPositionReady ? 1 : 0,
            width: isPositionReady
              ? desiredSurfaceSize.width
              : desiredSurfaceSize.minWidth,
          }}
          transition={{
            opacity: TOOLBAR_FADE_TRANSITION,
            width: TOOLBAR_LAYOUT_TRANSITION,
          }}
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
  const isCollapsedDensity = useCollapsedSelectionToolbarDensity(open);

  const panelRef = React.useRef<HTMLDivElement | null>(null);
  const actionShellRef = React.useRef<HTMLDivElement | null>(null);
  const compactFormatShellRef = React.useRef<HTMLDivElement | null>(null);
  const wideFormatShellRef = React.useRef<HTMLDivElement | null>(null);
  const promptShellRef = React.useRef<HTMLDivElement | null>(null);
  const askInputRef = React.useRef<HTMLInputElement | null>(null);
  const lastFormattingActionsRef = React.useRef<FloatingSelectionToolbarAction[]>([]);

  const isAskOpen = activeActionId === "custom";
  const isPromptLoading = isLoading && pendingActionId === "custom";
  const toolbarActions = React.useMemo(
    () =>
      includeJobContextActions
        ? getVisibleToolbarAiActions({ includeJobContextActions: true })
        : INLINE_AI_ACTIONS,
    [includeJobContextActions],
  );
  const liveFormattingActions =
    formattingActions.length > 0
      ? formattingActions
      : registeredFormattingActions;
  const resolvedFormattingActions =
    liveFormattingActions.length > 0 || open
      ? liveFormattingActions
      : lastFormattingActionsRef.current;
  const hasFormattingActions = resolvedFormattingActions.length > 0;

  React.useEffect(() => {
    if (open && liveFormattingActions.length > 0) {
      lastFormattingActionsRef.current = liveFormattingActions;
    }
  }, [liveFormattingActions, open]);

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
    const toolbarGap = getInlineGap(panel, compactGap);
    const chromeSize = getBoxChromeSize(panel);
    const actionSize = getMeasuredSize(actionShellRef.current);
    const compactFormatSize = hasFormattingActions
      ? getMeasuredSize(compactFormatShellRef.current)
      : { width: 0, height: 0 };
    const wideFormatSize = hasFormattingActions
      ? getMeasuredSize(wideFormatShellRef.current)
      : { width: 0, height: 0 };
    const promptSize = isAskOpen
      ? getMeasuredSize(promptShellRef.current)
      : { width: 0, height: 0 };
    const visibleCompactSize =
      compactMode === "format" && hasFormattingActions
        ? compactFormatSize
        : actionSize;
    const visibleGroupCount =
      (wideFormatSize.width > 0 ? 1 : 0) +
      (visibleCompactSize.width > 0 ? 1 : 0) +
      (promptSize.width > 0 ? 1 : 0);
    const contentWidth =
      chromeSize.horizontal +
      wideFormatSize.width +
      visibleCompactSize.width +
      promptSize.width +
      Math.max(0, visibleGroupCount - 1) * toolbarGap;
    const contentHeight =
      chromeSize.vertical +
      Math.max(
        wideFormatSize.height,
        visibleCompactSize.height,
        promptSize.height,
      );
    const nextMetrics: ToolbarMetrics = {
      actionWidth: actionSize.width,
      actionHeight: actionSize.height,
      compactFormatWidth: compactFormatSize.width,
      compactFormatHeight: compactFormatSize.height,
      wideFormatWidth: wideFormatSize.width,
      wideFormatHeight: wideFormatSize.height,
      promptWidth: promptSize.width,
      promptHeight: promptSize.height,
      panelWidth: contentWidth,
      panelHeight: contentHeight,
    };

    setMetrics((current) =>
      isSameMetrics(current, nextMetrics) ? current : nextMetrics,

    );
  }, [anchor, compactMode, hasFormattingActions, isAskOpen]);

  React.useEffect(() => {
    if (open) {
      return undefined;
    }

    const timeout = window.setTimeout(() => {
      setActiveActionId(DEFAULT_ACTION_ID);
      setCompactMode("ai");
      setCustomInstruction("");
      setMetrics(EMPTY_METRICS);
      setRegisteredFormattingActions([]);
      lastFormattingActionsRef.current = [];
    }, TOOLBAR_FADE_TRANSITION.duration * 1000);

    return () => window.clearTimeout(timeout);
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
    if (compactFormatShellRef.current) {
      resizeObserver?.observe(compactFormatShellRef.current);
    }
    if (wideFormatShellRef.current) {
      resizeObserver?.observe(wideFormatShellRef.current);
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
  }, [anchor, open, compactMode, hasFormattingActions, isAskOpen, updateMetrics]);

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
  const compactViewportWidth =
    compactMode === "format" && hasFormattingActions
      ? metrics.compactFormatWidth
      : metrics.actionWidth;
  const compactTrackX =
    compactMode === "format" && hasFormattingActions
      ? -(metrics.actionWidth + resolveCssLength(panelRef.current!, "--s1", 4))
      : 0;

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
      placementStrategy={
        isCollapsedDensity ? "documentBottomCenter" : "selectionAnchor"
      }
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
              ref={wideFormatShellRef}
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

          <motion.div
            data-inline-ai-toolbar="true"
            data-selection-toolbar-mode={compactMode}
            style={{
              display: "inline-flex",
              overflow: "hidden",
              flex: "0 0 auto",
              width: compactViewportWidth || "auto",
            }}
            animate={{
              width: compactViewportWidth || "auto",
            }}
            transition={TOOLBAR_LAYOUT_TRANSITION}
          >
            <motion.div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "var(--s1)",
                flex: "0 0 auto",
              }}
              animate={{ x: compactTrackX }}
              transition={TOOLBAR_LAYOUT_TRANSITION}
            >
              <div
                ref={actionShellRef}
                className="ds-ai-toolbar__actions"
                data-inline-ai-toolbar="true"
                aria-hidden={compactMode === "format" ? "true" : undefined}
                style={{
                  display: "inline-flex",
                  flex: "0 0 auto",
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
                          className="ds-ai-toolbar__btn ds-ai-toolbar__btn--ai-action"
                          onClick={() => handlePresetAction(action)}
                          onMouseDown={(event) => {
                            event.preventDefault();
                          }}
                          disabled={isLoading}
                          tabIndex={compactMode === "format" ? -1 : undefined}
                          aria-busy={isActionLoading || undefined}
                          aria-label={action.label}
                          aria-pressed={isActive}
                          title={action.label}
                        >
                          <span
                            className="ds-ai-toolbar__ai-icon"
                            aria-hidden="true"
                          >
                            {AI_ACTION_ICONS[action.id as InlineAiActionId] ??
                              action.label}
                          </span>
                          <span className="ds-ai-toolbar__ai-label">
                            {action.label}
                          </span>
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
                      tabIndex={compactMode === "format" ? -1 : undefined}
                      aria-label={compactFormattingLabel}
                      title={compactFormattingLabel}
                    >
                      <TextT size={14} aria-hidden="true" />
                      <span className="ds-ai-toolbar__btn-label">
                        {compactFormattingLabel}
                      </span>
                    </button>
                  </>
                ) : null}
              </div>

              {hasFormattingActions ? (
                <div
                  ref={compactFormatShellRef}
                  className="ds-ai-toolbar__compact-format-actions"
                  data-inline-ai-toolbar="true"
                  data-selection-toolbar-mode={compactMode}
                  role="group"
                  aria-label="Text formatting"
                  aria-hidden={compactMode === "format" ? undefined : "true"}
                  style={{
                    display: "inline-flex",
                    flex: "0 0 auto",
                  }}
                >
                  <button
                    type="button"
                    className="ds-ai-toolbar__btn ds-ai-toolbar__btn--back"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setCompactMode("ai")}
                    tabIndex={compactMode === "format" ? undefined : -1}
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
                      tabIndex={compactMode === "format" ? undefined : -1}
                      aria-label={action.label}
                      aria-pressed={action.active}
                      title={action.title ?? action.label}
                    >
                      {action.icon ?? action.label}
                    </button>
                  ))}
                </div>
              ) : null}
            </motion.div>
          </motion.div>

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
