import React from 'react';
import { useCommands, useActive } from '@remirror/react';
import { BoldExtension, ItalicExtension, UnderlineExtension } from 'remirror/extensions';

export const EditorToolbar: React.FC = () => {
  const { toggleBold, toggleItalic, toggleUnderline, focus } = useCommands();
  const active = useActive();

  const buttonStyle = "p-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700";
  const activeButtonStyle = "bg-gray-200 dark:bg-gray-700";

  return (
    <div className="flex items-center p-1 space-x-1 bg-gray-100 border-b border-gray-200 rounded-t-md dark:bg-gray-900 dark:border-gray-700">
      <button
        onClick={() => {
          toggleBold();
          focus();
        }}
        className={`${buttonStyle} ${typeof active.bold === "function" && active.bold() ? activeButtonStyle : ""}`}
        aria-label="Toggle bold"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-bold"><path d="M14 12a4 4 0 0 0 0-8H6v8"/><path d="M15 20a4 4 0 0 0 0-8H6v8Z"/></svg>
      </button>
      <button
        onClick={() => {
          toggleItalic();
          focus();
        }}
        className={`${buttonStyle} ${typeof active.italic === "function" && active.italic() ? activeButtonStyle : ""}`}
        aria-label="Toggle italic"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-italic"><line x1="19" x2="10" y1="4" y2="4"/><line x1="14" x2="5" y1="20" y2="20"/><line x1="15" x2="9" y1="4" y2="20"/></svg>
      </button>
      <button
        onClick={() => {
          toggleUnderline();
          focus();
        }}
        className={`${buttonStyle} ${typeof active.underline === "function" && active.underline() ? activeButtonStyle : ""}`}
        aria-label="Toggle underline"
        type="button"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-underline"><path d="M6 4v6a6 6 0 0 0 12 0V4"/><path d="M4 20h16"/></svg>
      </button>
    </div>
  );
};