import React from "react";
import {
  useCommands,
  useActive,
  useChainedCommands,
  useEditorView,
} from "@remirror/react";
import {
  BoldExtension,
  ItalicExtension,
  UnderlineExtension,
} from "remirror/extensions";
import { Bold, Italic, List, Underline } from "@/lib/icons";

export type EditorFormattingActionId = "bold" | "italic" | "underline" | "list";

export type EditorFormattingAction = {
  id: EditorFormattingActionId;
  label: string;
  title: string;
  icon: React.ReactNode;
  active: boolean;
  run: () => void;
  onMouseDown: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

export function useEditorFormattingActions(options?: {
  showLists?: boolean;
}): EditorFormattingAction[] {
  const showLists = options?.showLists ?? true;

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
  const editorView = useEditorView() as any;
  const latestSelectionRef = React.useRef<any>(null);

  const rememberEditorSelection = React.useCallback(() => {
    latestSelectionRef.current = editorView?.state?.selection ?? null;
  }, [editorView]);

  const preventToolbarMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      rememberEditorSelection();
      event.preventDefault();
    },
    [rememberEditorSelection],
  );

  const restoreEditorSelection = React.useCallback(() => {
    const selection = latestSelectionRef.current;
    if (!editorView || !selection) return;

    try {
      const transaction = editorView.state?.tr?.setSelection?.(selection);
      if (transaction) {
        editorView.dispatch(transaction);
      }
    } catch {
      // Ignore stale selections; the command fallback below will use current state.
    }
  }, [editorView]);

  const runMarkCommand = React.useCallback(
    (commandName: "toggleBold" | "toggleItalic" | "toggleUnderline", fallback?: () => void) => {
      restoreEditorSelection();
      try {
        editorView?.focus?.();
      } catch {
        // noop
      }

      try {
        if (
          chain &&
          typeof chain.focus === "function" &&
          typeof chain[commandName] === "function"
        ) {
          chain.focus()[commandName]().run();
          return;
        }
      } catch {
        /* fall through to direct command */
      }

      focus?.();
      fallback?.();
    },
    [chain, editorView, focus, restoreEditorSelection],
  );

  const runListCommand = React.useCallback(() => {
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
  }, [chain, focus, toggleBulletList, toggleList]);

  return React.useMemo(() => {
    const actions: EditorFormattingAction[] = [
      {
        id: "bold",
        label: "Toggle bold",
        title: "Bold",
        icon: <Bold size={16} />,
        active: typeof active.bold === "function" && active.bold(),
        run: () => runMarkCommand("toggleBold", toggleBold),
        onMouseDown: preventToolbarMouseDown,
      },
      {
        id: "italic",
        label: "Toggle italic",
        title: "Italic",
        icon: <Italic size={16} />,
        active: typeof active.italic === "function" && active.italic(),
        run: () => runMarkCommand("toggleItalic", toggleItalic),
        onMouseDown: preventToolbarMouseDown,
      },
      {
        id: "underline",
        label: "Toggle underline",
        title: "Underline",
        icon: <Underline size={16} />,
        active: typeof active.underline === "function" && active.underline(),
        run: () => runMarkCommand("toggleUnderline", toggleUnderline),
        onMouseDown: preventToolbarMouseDown,
      },
    ];

    if (showLists) {
      actions.push({
        id: "list",
        label: "Toggle bullet list",
        title: "Bullet list",
        icon: <List size={16} />,
        active: typeof active.bulletList === "function" && active.bulletList(),
        run: runListCommand,
        onMouseDown: preventToolbarMouseDown,
      });
    }

    return actions;
  }, [
    active,
    preventToolbarMouseDown,
    runListCommand,
    runMarkCommand,
    showLists,
    toggleBold,
    toggleItalic,
    toggleUnderline,
  ]);
}

export const EditorToolbar: React.FC<{
  position?: "top" | "bottom";
  showLists?: boolean;
}> = ({
  position = "top",
  showLists = true,
}) => {
  const formattingActions = useEditorFormattingActions({ showLists });

  const buttonStyle =
    "inline-flex items-center justify-center p-2 rounded-[var(--radius-control)] [color:var(--tm2)] transition-colors hover:[background:var(--sf2)] hover:[color:var(--ti)]";
  const activeButtonStyle = "[background:var(--sf2)] [color:var(--ti)]";
  const containerBase =
    "flex items-center p-1 space-x-1 [background:var(--sf1)] [color:var(--tm2)] [border-color:var(--color-border)]";
  const containerClass =
    position === "bottom"
      ? `${containerBase} border-t rounded-b-md`
      : `${containerBase} border-b rounded-t-md`;

  const dividerStyle =
    "w-px self-stretch mx-1 [background:var(--color-border)] opacity-60 shrink-0";
  const markActions = formattingActions.filter((action) => action.id !== "list");
  const listAction = formattingActions.find((action) => action.id === "list");

  return (
    <div className={containerClass}>
      {/* Zone 1 — Text formatting */}
      <div
        className="flex items-center"
        role="group"
        aria-label="Text formatting"
      >
        {markActions.map((action) => (
          <button
            key={action.id}
            onMouseDown={action.onMouseDown}
            onPointerDown={action.onMouseDown as any}
            onClick={action.run}
            className={`${buttonStyle} ${action.active ? activeButtonStyle : ""}`}
            aria-label={action.label}
            title={action.title}
            type="button"
          >
            {action.icon}
          </button>
        ))}
      </div>

      {listAction ? (
        <>
          {/* Divider */}
          <span className={dividerStyle} aria-hidden="true" />

          {/* Zone 2 — Structure */}
          <div className="flex items-center" role="group" aria-label="Structure">
            <button
              onMouseDown={listAction.onMouseDown}
              onPointerDown={listAction.onMouseDown as any}
              onClick={listAction.run}
              className={`${buttonStyle} ${listAction.active ? activeButtonStyle : ""}`}
              aria-label={listAction.label}
              title={listAction.title}
              type="button"
            >
              {listAction.icon}
            </button>
          </div>
        </>
      ) : null}
    </div>
  );
};
