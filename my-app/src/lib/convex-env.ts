/*
 * Central helpers for reading Convex environment variables in both browser (Vite)
 * and server/test contexts. Vite replaces import.meta.env.* at build time, but
 * test runners may rely on process.env. These helpers abstract away the guards so
 * callers can simply consume typed values.
 */

function resolveImportMetaEnv(): Record<string, string | undefined> | undefined {
  try {
    if (typeof import.meta !== "undefined" && (import.meta as any)?.env) {
      return (import.meta as any).env as Record<string, string | undefined>;
    }
  } catch {
    // ignore — falls back to process.env below
  }
  return undefined;
}

function resolveProcessEnv(): Record<string, string | undefined> | undefined {
  if (typeof process !== "undefined" && (process as any)?.env) {
    return (process as any).env as Record<string, string | undefined>;
  }
  return undefined;
}

const importMetaEnv = resolveImportMetaEnv();
const processEnv = resolveProcessEnv();

export function getConvexUrl(): string | undefined {
  return (
    importMetaEnv?.VITE_CONVEX_URL ??
    importMetaEnv?.NEXT_PUBLIC_CONVEX_URL ??
    processEnv?.VITE_CONVEX_URL ??
    processEnv?.NEXT_PUBLIC_CONVEX_URL ??
    undefined
  );
}

export function getConvexDeployment(): string | undefined {
  return (
    importMetaEnv?.CONVEX_DEPLOYMENT ??
    processEnv?.CONVEX_DEPLOYMENT ??
    undefined
  );
}
