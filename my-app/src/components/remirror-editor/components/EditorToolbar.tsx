import React from "react";
import { useCommands, useActive, useChainedCommands } from "@remirror/react";
import {
  BoldExtension,
  ItalicExtension,
  UnderlineExtension,
} from "remirror/extensions";
import { Bold, Italic, List, Underline } from "@/lib/icons";

export const EditorToolbar: React.FC<{ position?: "top" | "bottom" }> = ({
  position = "top",
}) => {
  // Include list fallback command when toggleBulletList is not wired by the manager
  const {
    toggleBold,
    toggleItalic,
    toggleUnderline,
    toggleBulletList,
    toggleList,
    focus,
  } = useCommands() as any;
  const chain = useChainedCommands() as any;
  const active = useActive();

  const buttonStyle =
    "inline-flex items-center justify-center p-2 rounded-[var(--radius-control)] [color:var(--tm2)] transition-colors hover:[background:var(--sf2)] hover:[color:var(--ti)]";
  const activeButtonStyle = "[background:var(--sf2)] [color:var(--ti)]";
  const containerBase =
    "flex items-center p-1 space-x-1 [background:var(--sf1)] [color:var(--tm2)] [border-color:var(--color-border)]";
  const containerClass =
    position === "bottom"
      ? `${containerBase} border-t rounded-b-md`
      : `${containerBase} border-b rounded-t-md`;

  return (
    <div className={containerClass}>
      <button
        onClick={() => {
          // Focus first so the command applies to the current selection
          focus?.();
          toggleBold?.();
        }}
        className={`${buttonStyle} ${typeof active.bold === "function" && active.bold() ? activeButtonStyle : ""}`}
        aria-label="Toggle bold"
        type="button"
      >
        <Bold size={16} />
      </button>
      <button
        onClick={() => {
          focus?.();
          toggleItalic?.();
        }}
        className={`${buttonStyle} ${typeof active.italic === "function" && active.italic() ? activeButtonStyle : ""}`}
        aria-label="Toggle italic"
        type="button"
      >
        <Italic size={16} />
      </button>
      <button
        onClick={() => {
          focus?.();
          toggleUnderline?.();
        }}
        className={`${buttonStyle} ${typeof active.underline === "function" && active.underline() ? activeButtonStyle : ""}`}
        aria-label="Toggle underline"
        type="button"
      >
        <Underline size={16} />
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          // Prefer chained commands with focus BEFORE toggling
          try {
            if (
              chain &&
              typeof chain.focus === "function" &&
              typeof chain.toggleBulletList === "function"
            ) {
              chain.focus().toggleBulletList().run();
              return;
            }
          } catch {
            /* fall through to fallback */
          }

          // Fallback to direct commands if chaining is unavailable
          try {
            focus?.();
            if (typeof toggleBulletList === "function") {
              toggleBulletList();
              return;
            }
            if (typeof toggleList === "function") {
              // Some remirror versions expose a generic toggleList({ type: 'bullet' })
              toggleList({ type: "bullet" });
            }
          } catch {
            /* noop */
          }
        }}
        className={`${buttonStyle} ${typeof active.bulletList === "function" && active.bulletList() ? activeButtonStyle : ""}`}
        aria-label="Toggle bullet list"
        type="button"
        title="Bullet list"
      >
        <List size={16} />
      </button>
    </div>
  );
};
