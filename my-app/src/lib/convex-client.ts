/* Robust Convex client bootstrap that tolerates partial test mocks and missing/invalid env.
 * Some test files mock 'convex/react' without exporting ConvexReactClient.
 * Provide a safe fallback stub to avoid constructor errors during tests.
 */
import * as ConvexReact from "convex/react";

/* Validate that a URL is absolute. */
function isValidAbsoluteURL(url: string | undefined): boolean {
  if (!url) return false;
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/* Prefer the real ConvexReactClient when available and when the URL is valid; otherwise use a stub. */
let _Ctor: any;

if (isValidAbsoluteURL((import.meta as any)?.env?.VITE_CONVEX_URL)) {
  // Only attempt to access the ConvexReactClient export when URL is valid to avoid throwing in tests
  // that partially mock 'convex/react' without this export.
  let RealCtor: any = null;
  try {
    // Access may throw under Vitest proxy when the export is not defined; guard with try/catch.
    RealCtor = (ConvexReact as any).ConvexReactClient;
  } catch {
    RealCtor = null;
  }
  if (typeof RealCtor === "function") {
    _Ctor = RealCtor;
  } else {
    _Ctor = class ConvexReactClientStub {
      constructor(_url?: string) {
        console.warn(
          "[convexClient] ConvexReactClient unavailable; using stub client."
        );
      }
      public async query(_q?: unknown): Promise<unknown> {
        console.warn("[convexClient] stub client query() invoked; returning null.");
        return null;
      }
      public async setAuth(_auth: unknown): Promise<void> {
        console.warn("[convexClient] stub client setAuth() invoked; doing nothing.");
        return;
      }
      public async clearAuth(): Promise<void> {
        console.warn("[convexClient] stub client clearAuth() invoked; doing nothing.");
        return;
      }
    };
  }
} else {
  // No valid URL -> never touch ConvexReact to avoid mock-proxy get traps
  _Ctor = class ConvexReactClientStub {
    constructor(_url?: string) {
      console.warn(
        "[convexClient] VITE_CONVEX_URL is missing or invalid; using stub client."
      );
    }
    public async query(_q?: unknown): Promise<unknown> {
      console.warn("[convexClient] stub client query() invoked; returning null.");
      return null;
    }
    public async setAuth(_auth: unknown): Promise<void> {
      console.warn("[convexClient] stub client setAuth() invoked; doing nothing.");
      return;
    }
    public async clearAuth(): Promise<void> {
      console.warn("[convexClient] stub client clearAuth() invoked; doing nothing.");
      return;
    }
  };
}

export const convexClient = new _Ctor((import.meta as any)?.env?.VITE_CONVEX_URL);
