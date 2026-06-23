/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
import React from "react";

/**
 * DebugToggle
 *
 * Small development-only floating toggle that enables/disables the CV editor
 * debug logs without having to type into the browser console. It stores the
 * preference in localStorage under "cv_editor_debug" and sets the global
 * window.__CV_EDITOR_DEBUG__ flag.
 *
 * Usage: Render this component somewhere high in the app (we mount it inside
 * CvLibraryProvider). It intentionally forces a reload after changing the flag
 * so the file-level DEBUG constants (which are evaluated at module load) pick
 * up the change.
 */
export function DebugToggle() {
  // Read persisted setting (string "true" or "false") — guard when localStorage is unavailable in tests/SSR
  let stored: string | null = null;
  try {
    stored = typeof window !== "undefined" && (window as any).localStorage
      ? (window as any).localStorage.getItem("cv_editor_debug")
      : null;
  } catch {
    stored = null;
  }
  const enabled =
    stored === "true" ||
    (typeof window !== "undefined" && (window as any).__CV_EDITOR_DEBUG__ === true);

  function toggle() {
    try {
      const next = !enabled;
      if (typeof window !== "undefined" && (window as any).localStorage) {
        (window as any).localStorage.setItem("cv_editor_debug", next ? "true" : "false");
        (window as any).__CV_EDITOR_DEBUG__ = next === true;
        // Broadcast an event so host UI can react and mount the debug panel without a full reload.
        window.dispatchEvent(new CustomEvent("cv-debug-toggle", { detail: { enabled: next } }));
      }
    } catch {
      /* noop */
    }
  }

  // Small floating button (development convenience).
  return (
    <div className="fixed z-50 bottom-4 right-4">
      <button
        type="button"
        onClick={toggle}
        aria-label="Toggle CV editor debug"
        title="Toggle CV editor debug"
        className={`inline-flex items-center px-3 py-2 rounded-md text-sm font-medium shadow ${
          enabled ? "bg-red-600 text-white" : "[background:var(--sf2)] [color:var(--ti)]"
        }`}
        aria-pressed={enabled}
      >
        <span className="mr-2" aria-hidden>
          {enabled ? "🐞 ON" : "🐞 OFF"}
        </span>
        <span className="hidden sm:inline">{enabled ? "Editor debug (reload)" : "Enable debug"}</span>
      </button>
    </div>
  );
}

export default DebugToggle;
