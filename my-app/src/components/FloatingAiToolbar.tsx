import React from "react";
import { BodyPortal } from "@/components/ui/body-portal";
import { Loader2 } from "@/lib/icons";

export const INLINE_AI_ACTIONS = [
  {
    id: "make_human",
    label: "Make It Human",
    instruction:
      "Make this selection sound more human and natural while staying credible and professional.",
  },
  {
    id: "make_clearer",
    label: "Make It Clearer",
    instruction:
      "Make this selection clearer, easier to scan, and more direct without changing its meaning.",
  },
  {
    id: "make_persuasive",
    label: "Make It Persuasive",
    instruction:
      "Make this selection more persuasive and convincing without exaggerating or inventing facts.",
  },
  {
    id: "shorten",
    label: "Shorten",
    instruction:
      "Shorten this selection while preserving the strongest meaning and proof.",
  },
  {
    id: "lengthen",
    label: "Make It Longer",
    instruction:
      "Make this selection a little longer and fuller while keeping the same core meaning.",
  },
  {
    id: "fix_grammar",
    label: "Fix Grammar",
    instruction:
      "Fix grammar, spelling, punctuation, and phrasing issues in this selection.",
  },
] as const;

export type InlineAiActionId = (typeof INLINE_AI_ACTIONS)[number]["id"] | "custom";

type FloatingAiToolbarProps = {
  anchor: { left: number; top: number } | null;
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
  const [isCustomOpen, setIsCustomOpen] = React.useState(false);
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
    const gap = 8;
    const width = panel.offsetWidth;
    const height = panel.offsetHeight;
    const viewportLeft = window.scrollX + margin;
    const viewportTop = window.scrollY + margin;
    const viewportRight = window.scrollX + window.innerWidth - margin;
    const viewportBottom = window.scrollY + window.innerHeight - margin;

    const clamp = (value: number, min: number, max: number) =>
      Math.min(Math.max(value, min), Math.max(min, max));

    const maxLeft = viewportRight - width;
    let left = clamp(anchor.left + 2, viewportLeft, maxLeft);

    const maxTop = viewportBottom - height;
    let top = anchor.top + gap;
    let placement: "above" | "below" = "below";

    if (top > maxTop) {
      top = anchor.top - height - gap;
      placement = "above";
    }

    top = clamp(top, viewportTop, maxTop);
    left = clamp(left, viewportLeft, maxLeft);

    setPosition({ left, top, placement });
  }, [anchor]);

  React.useEffect(() => {
    if (!open) {
      setIsCustomOpen(false);
      setCustomInstruction("");
      setPosition(null);
    }
  }, [open]);

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
  }, [anchor, isCustomOpen, open, updatePosition]);

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

  if (!open || !anchor) return null;

  const isCustomLoading = isLoading && pendingActionId === "custom";

  return (
    <BodyPortal>
      <div
        ref={panelRef}
        className="dasti-inline-ai-toolbar"
        data-placement={position?.placement ?? "below"}
        role="toolbar"
        aria-label="Selection rewrite tools"
        style={{
          position: "absolute",
          left: position?.left ?? anchor.left,
          top: position?.top ?? anchor.top,
          zIndex: 11000,
        }}
      >
        <div className="dasti-inline-ai-toolbar__eyebrow">
          Rewrite Selection
        </div>
        <div className="dasti-inline-ai-toolbar__actions">
          {INLINE_AI_ACTIONS.map((action) => {
            const isActionLoading = isLoading && pendingActionId === action.id;
            return (
              <button
                key={action.id}
                type="button"
                className={
                  isActionLoading
                    ? "dasti-inline-ai-toolbar__action dasti-inline-ai-toolbar__action--pending"
                    : "dasti-inline-ai-toolbar__action"
                }
                onClick={() => onRunAction(action.id, action.instruction)}
                disabled={isLoading}
                aria-busy={isActionLoading || undefined}
              >
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
          <button
            type="button"
            className={
              isCustomOpen
                ? "dasti-inline-ai-toolbar__action dasti-inline-ai-toolbar__action--custom dasti-inline-ai-toolbar__action--active"
                : "dasti-inline-ai-toolbar__action dasti-inline-ai-toolbar__action--custom"
            }
            onClick={() => setIsCustomOpen((current) => !current)}
            disabled={isLoading}
          >
            Ask AI
          </button>
        </div>

        {isCustomOpen ? (
          <div className="dasti-inline-ai-toolbar__prompt">
            <input
              type="text"
              value={customInstruction}
              onChange={(event) => setCustomInstruction(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && customInstruction.trim()) {
                  event.preventDefault();
                  onRunAction("custom", customInstruction.trim());
                }
              }}
              placeholder="Tell AI what to change"
              className="dasti-field dasti-field--sm dasti-inline-ai-toolbar__prompt-field"
              disabled={isLoading}
            />
            <button
              type="button"
              className="dasti-inline-ai-toolbar__apply"
              onClick={() => onRunAction("custom", customInstruction.trim())}
              disabled={isLoading || !customInstruction.trim()}
              aria-busy={isCustomLoading || undefined}
            >
              {isCustomLoading ? (
                <>
                  <Loader2
                    size={13}
                    strokeWidth={1.8}
                    aria-hidden="true"
                    className="animate-spin"
                  />
                  Asking...
                </>
              ) : (
                "Ask AI"
              )}
            </button>
          </div>
        ) : null}
      </div>
    </BodyPortal>
  );
}

export default FloatingAiToolbar;
