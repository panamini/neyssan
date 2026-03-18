import React from 'react';
import { useCommands, useActive, useChainedCommands } from '@remirror/react';
import { BoldExtension, ItalicExtension, UnderlineExtension } from 'remirror/extensions';

export const EditorToolbar: React.FC<{ position?: 'top' | 'bottom' }> = ({ position = 'top' }) => {
  // Include list fallback command when toggleBulletList is not wired by the manager
  const { toggleBold, toggleItalic, toggleUnderline, toggleBulletList, toggleList, focus } = useCommands() as any;
  const chain = useChainedCommands() as any;
  const active = useActive();

  const buttonStyle = "p-2 rounded hover:[background:var(--sf2)]";
  const activeButtonStyle = "[background:var(--sf2)]";
  const containerBase = "flex items-center p-1 space-x-1 [background:var(--sf1)] border-bo";
  const containerClass = position === 'bottom'
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
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bold"><path d="M14 12a4 4 0 0 0 0-8H6v8"/><path d="M15 20a4 4 0 0 0 0-8H6v8Z"/></svg>
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
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-italic"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
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
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-underline"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/></svg>
      </button>
      <button
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => {
          // Prefer chained commands with focus BEFORE toggling
          try {
            if (chain && typeof chain.focus === 'function' && typeof chain.toggleBulletList === 'function') {
              chain.focus().toggleBulletList().run();
              return;
            }
          } catch {
            /* fall through to fallback */
          }

          // Fallback to direct commands if chaining is unavailable
          try {
            focus?.();
            if (typeof toggleBulletList === 'function') {
              toggleBulletList();
              return;
            }
            if (typeof toggleList === 'function') {
              // Some remirror versions expose a generic toggleList({ type: 'bullet' })
              toggleList({ type: 'bullet' });
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
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-list">
          <line x1="10" y1="6" x2="21" y2="6"></line>
          <line x1="10" y1="12" x2="21" y2="12"></line>
          <line x1="10" y1="18" x2="21" y2="18"></line>
          <circle cx="4" cy="6" r="1"></circle>
          <circle cx="4" cy="12" r="1"></circle>
          <circle cx="4" cy="18" r="1"></circle>
        </svg>
      </button>
    </div>
  );
};