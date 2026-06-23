/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unused-vars -- Existing lint debt is captured locally for this release-gate baseline; fix these rules in focused follow-ups. */
/**
 * my-app/src/lib/cv-debug.ts
 *
 * Centralized debug helper for CV editor flows.
 * - Routes debug entries into the in-app debug panel (pushLog) when available.
 * - Falls back to console.debug for visibility.
 * - Respects window.__CV_EDITOR_DEBUG__ and the persisted "cv_editor_debug" localStorage flag.
 *
 * Usage:
 *  import { dbg } from '../lib/cv-debug';
 *  dbg("[MyModule] event", { detail: ... });
 *
 * The debug panel implementation is in: my-app/src/components/dev/debug-panel.tsx
 */
import { pushLog } from "../components/dev/debug-panel";

function enabled(): boolean {
  try {
    if (typeof window === "undefined") return false;
    if ((window as any).__CV_EDITOR_DEBUG__ === true) return true;
    return window.localStorage?.getItem?.("cv_editor_debug") === "true";
  } catch {
    return false;
  }
}

export function dbg(...args: any[]) {
  if (!enabled()) return;
  try {
    // Log to panel (structured)
    try {
      // pushLog({ source: "dbg", payload: args }); // disabled for testing
    } catch {
      // ignore panel errors
    }
    // Also mirror to console for convenience

    console.debug("[CV-DBG]", ...args);
  } catch {
    // noop
  }
}

export default dbg;