import React from "react";
import { LayoutGroup, motion } from "framer-motion";
import { BodyPortal } from "@/components/ui/body-portal";
import { Loader2, SendHorizontal, Wand2 } from "@/lib/icons";

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

export type InlineAiActionId =
  | (typeof INLINE_AI_ACTIONS)[number]["id"]
  | "custom";

type FloatingAiToolbarProps = {
  anchor: { left: number; top: number; bottom?: number } | null;
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
  const [position, setPosition] = React.useState<{
    left: number;
    top: number;
    placement: "above" | "below";
  } | null>(null);
  const panelRef = React.useRef<HTMLDivElement | null>(null);

  const updatePosition = React.useCallback(() => {
    if (!anchor || !panelRef.current || typeof window === "undefined") {
      return;
    }

    const panel = panelRef.current;
    const margin = 16;
    const gap = 10;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const viewportLeft = window.scrollX + margin;
    const viewportTop = window.scrollY + margin;
    const viewportRight = window.scrollX + window.innerWidth - margin;
    const viewportBottom = window.scrollY + window.innerHeight - margin;

    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), Math.max(min, max));

    const maxLeft = viewportRight - width;
    const maxTop = viewportBottom - height;
    let left = clamp(anchor.left - width / 2, viewportLeft, maxLeft);
    let top = anchor.top - height - gap;
    let placement: "above" | "below" = "above";

    if (top < viewportTop) {
      top = (anchor.bottom ?? anchor.top) + gap;
      placement = "below";
    }

    top = clamp(top, viewportTop, maxTop);
    left = clamp(left, viewportLeft, maxLeft);

    setPosition({ left, top, placement });
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
      setActiveActionId(
        pendingActionId === "custom" ? "ask" : pendingActionId,
      );
    }
  }, [pendingActionId]);

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
  const promptPlaceholder = "Tell AI what to change";

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
          zIndex: 11000,
        }}
        initial={{
          opacity: 0,
          scale: 0.985,
          y: position?.placement === "below" ? -6 : -10,
        }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.22, ease: MOTION_EASE }}
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
        <div className="dasti-inline-ai-toolbar__ribbon dasti-inline-ai-toolbar__ribbon--actions">
          <LayoutGroup id="inline-ai-toolbar-actions">
            <div className="dasti-inline-ai-toolbar__actions">
              {INLINE_AI_ACTIONS.map((action) => {
                const isActionLoading = isLoading && pendingActionId === action.id;
                const isActive = activeActionId === action.id;
                return (
                  <button
                    key={action.id}
                    type="button"
                    className={
                      isActionLoading
                        ? "dasti-inline-ai-toolbar__action dasti-inline-ai-toolbar__action--pending"
                        : "dasti-inline-ai-toolbar__action"
                    }
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
              <span className="dasti-inline-ai-toolbar__prompt-icon" aria-hidden="true">
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
                placeholder={promptPlaceholder}
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
                <SendHorizontal size={15} strokeWidth={1.8} aria-hidden="true" />
              )}
            </button>
          </motion.div>
        ) : null}
      </motion.div>
    </BodyPortal>
  );
}

export default FloatingAiToolbar;
