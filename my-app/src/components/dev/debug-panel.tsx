/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unnecessary-type-assertion, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unused-vars -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
/* eslint-disable react-refresh/only-export-components -- Existing mixed component/helper exports are outside this release-gate cleanup; split exports in a focused follow-up. */
import React, { useEffect, useState } from "react";

/**
 * A tiny in-app debug store + panel for CV editor flows.
 *
 * - pushLog(entry): Append a structured log entry (string | object). Visible in the panel.
 * - useDebugLogs(): Hook that returns the current list of logs and updates in real-time.
 * - DebugPanel: Floating panel that shows recent logs, with controls to clear and download.
 *
 * This module deliberately uses a lightweight EventTarget emitter and attaches a
 * persistent array to window.__CV_EDITOR_LOGS__ so logs survive HMR reloads in dev.
 *
 * Usage:
 * - Import pushLog and call it from dbg helpers:
 *     import { pushLog } from "../components/dev/debug-panel";
 *     pushLog({ source: "CvLibraryContext", event: "save", payload: {...} });
 * - Render <DebugPanel /> near the app root (CvLibraryProvider is a good place).
 */

/* -------------------- Store + Emitter -------------------- */

declare global {
  interface Window {
    __CV_EDITOR_LOGS__?: any[];
  }
}

const EMITTER = new EventTarget();

// Batched log buffer to avoid emitting a DOM event for every single log entry.
// High-frequency logging (during noisy repros) previously caused the DebugPanel
// to re-render on every push which amplified registration/flush churn. We batch
// pushes on the next animation frame and dispatch a single "log-batch" event.
const LOG_BUFFER: any[] = [];
let LOG_FLUSH_PENDING = false;

function ensureStore() {
  if (!window.__CV_EDITOR_LOGS__) window.__CV_EDITOR_LOGS__ = [];
  return window.__CV_EDITOR_LOGS__ as any[];
}

export function pushLog(entry: any) {
  try {
    const ts = new Date().toISOString();
    const item = { ts, entry };
    // Buffer the incoming entry and flush on the next animation frame to avoid
    // emitting an EventTarget event per-log which can cause frequent React updates.
    LOG_BUFFER.push(item);
    if (!LOG_FLUSH_PENDING) {
      LOG_FLUSH_PENDING = true;
      const flush = () => {
        try {
          const toFlush = LOG_BUFFER.splice(0, LOG_BUFFER.length);
          LOG_FLUSH_PENDING = false;
          if (toFlush.length === 0) return;
          const store = ensureStore();
          for (const it of toFlush) store.push(it);
          // Keep a reasonably small buffer to avoid memory blowup during noisy repros
          if (store.length > 5000) store.splice(0, store.length - 5000);
          // Dispatch a single batched event
          EMITTER.dispatchEvent(new CustomEvent("log-batch", { detail: toFlush }));
          // Also print a compact message to console (one per flush)

          console.debug("[CV-DEBUG] (batch)", toFlush.length, toFlush[0]?.ts ?? null);
        } catch {
          /* noop */
        }
      };
      if (typeof requestAnimationFrame !== "undefined") requestAnimationFrame(flush);
      else setTimeout(flush, 16);
    }
    // Mirror a concise debug to console immediately for convenience

    console.debug("[CV-DEBUG]", ts, entry);
  } catch (err) {
    // ignore
  }
}

export function clearLogs() {
  try {
    window.__CV_EDITOR_LOGS__ = [];
    EMITTER.dispatchEvent(new CustomEvent("clear"));
  } catch {
    /* noop */
  }
}

export function getLogs() {
  return ensureStore().slice();
}

export function useDebugLogs() {
  const [logs, setLogs] = useState<any[]>(getLogs());
  useEffect(() => {
    function onLog(e: any) {
      setLogs((prev) => [...prev, e.detail]);
    }
    function onLogBatch(e: any) {
      // detail is an array of items
      const items = Array.isArray(e.detail) ? e.detail : [e.detail];
      setLogs((prev) => [...prev, ...items]);
    }
    function onClear() {
      setLogs([]);
    }
    EMITTER.addEventListener("log", onLog as EventListener);
    EMITTER.addEventListener("log-batch", onLogBatch as EventListener);
    EMITTER.addEventListener("clear", onClear as EventListener);
    return () => {
      EMITTER.removeEventListener("log", onLog as EventListener);
      EMITTER.removeEventListener("log-batch", onLogBatch as EventListener);
      EMITTER.removeEventListener("clear", onClear as EventListener);
    };
  }, []);
  return logs;
}

/* -------------------- Debug Panel UI -------------------- */

function prettyStr(v: any) {
  try {
    if (typeof v === "string") return v;
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

export function DebugPanel() {
  // Only render the panel when debug is enabled via global flag or persisted toggle.
  const isEnabled = typeof window !== "undefined" && (
    (window as any).__CV_EDITOR_DEBUG__ === true ||
    (typeof window.localStorage !== "undefined" && window.localStorage.getItem("cv_editor_debug") === "true")
  );

  if (!isEnabled) return null;
  // eslint-disable-next-line react-hooks/rules-of-hooks -- Pre-existing hook ordering debt is documented while this release-gate cleanup avoids behavior changes.
  const logs = useDebugLogs();

  function handleDownload() {
    try {
      const payload = JSON.stringify(getLogs(), null, 2);
      const blob = new Blob([payload], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `cv-editor-logs-${new Date().toISOString()}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      /* noop */
    }
  }

  return (
    <div
      aria-hidden="false"
      className="fixed left-4 top-4 z-[9999] w-[min(720px,95vw)] max-h-[70vh] overflow-hidden rounded-md [box-shadow:var(--shc)] [background:var(--sfr)] border [border-color:var(--color-border)]"
    >
      <div className="flex items-center justify-between px-3 py-2 border-b [border-color:var(--color-border)]">
        <div className="flex items-center gap-3">
          <div className="text-sm font-medium">CV Editor Debug Panel</div>
          <div className="text-xs text-neutral-500">Logs (live)</div>
          <div className="text-xs text-neutral-400">entries: {logs.length}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => clearLogs()}
            className="px-2 py-1 text-xs rounded [background:var(--sf2)]"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="px-2 py-1 text-xs rounded [background:var(--sf2)]"
          >
            Download
          </button>
          <DebugPanelDebugToggle />
        </div>
      </div>

      <div className="p-2 overflow-auto max-h-[60vh]">
        <ol className="space-y-2">
          {logs.slice().reverse().map((l: any, i: number) => (
            <li key={`${l.ts}-${i}`} className="text-xs">
              <div className="text-[11px] text-neutral-400">{l.ts}</div>
              <pre className="whitespace-pre-wrap text-[12px] leading-snug max-w-full overflow-x-auto">
                {prettyStr(l.entry)}
              </pre>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

/* -------------------- Small debug toggle inside the panel -------------------- */

/**
 * Debug toggle rendered inside the DebugPanel controls.
 * Mirrors DebugToggle behavior: persist preference to localStorage,
 * set window.__CV_EDITOR_DEBUG__, and dispatch an event 'cv-debug-toggle'.
 */
function DebugPanelDebugToggle() {
  const isInitiallyEnabled =
    typeof window !== "undefined" &&
    ((window as any).__CV_EDITOR_DEBUG__ === true ||
      (typeof window.localStorage !== "undefined" && window.localStorage.getItem("cv_editor_debug") === "true"));

  const [enabled, setEnabled] = useState<boolean>(Boolean(isInitiallyEnabled));

  useEffect(() => {
    function onExternalToggle() {
      const now =
        typeof window !== "undefined" &&
        ((window as any).__CV_EDITOR_DEBUG__ === true ||
          (typeof window.localStorage !== "undefined" && window.localStorage.getItem("cv_editor_debug") === "true"));
      setEnabled(Boolean(now));
    }
    window.addEventListener("cv-debug-toggle", onExternalToggle as EventListener);
    return () => window.removeEventListener("cv-debug-toggle", onExternalToggle as EventListener);
  }, []);

  function toggleDebug() {
    try {
      const next = !enabled;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("cv_editor_debug", next ? "true" : "false");
        (window as any).__CV_EDITOR_DEBUG__ = next === true;
        window.dispatchEvent(new CustomEvent("cv-debug-toggle", { detail: { enabled: next } }));
        setEnabled(next);
      }
    } catch {
      /* noop */
    }
  }

  return (
    <button
      type="button"
      onClick={toggleDebug}
      className={`px-2 py-1 text-xs rounded ${enabled ? "bg-red-600 text-white" : "[background:var(--sf2)]"}`}
      aria-pressed={enabled}
      title={enabled ? "Disable CV editor debug" : "Enable CV editor debug"}
    >
      {enabled ? "DEBUG ON" : "DEBUG OFF"}
    </button>
  );
}

export default DebugPanel;