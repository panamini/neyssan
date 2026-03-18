/**
 * Feature flags and environment helpers.
 * Vite exposes import.meta.env.VITE_... at runtime; Vitest uses test.env in vitest.config.ts.
 * We also fall back to process.env for SSR/tests.
 */

function readEnv(key: string): string | undefined {
  try {
    // Vite runtime
    const vite = (import.meta as unknown as { env?: Record<string, string | undefined> })?.env;
    if (vite && typeof vite[key] !== "undefined") return vite[key];
  } catch {
    // ignore
  }
  try {
    // Vitest/Node
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodeEnv = (typeof process !== "undefined" ? (process as any).env : undefined) as Record<string, string | undefined> | undefined;
    if (nodeEnv && typeof nodeEnv[key] !== "undefined") return nodeEnv[key];
  } catch {
    // ignore
  }
  return undefined;
}

function toBool(val: unknown, fallback = false): boolean {
  if (typeof val === "string") {
    const v = val.trim().toLowerCase();
    if (v === "1" || v === "true" || v === "on" || v === "yes") return true;
    if (v === "0" || v === "false" || v === "off" || v === "no") return false;
  }
  if (typeof val === "number") return val !== 0;
  if (typeof val === "boolean") return val;
  return fallback;
}

/**
 * isV1SectionsEnabled
 * - enables v1 typed sections (Profile, Summary, Skills, Languages) UI wiring
 * - defaults to true in development/test if undefined
 */
export function isV1SectionsEnabled(): boolean {
  const raw = readEnv("VITE_V1_SECTIONS");
  // Default ON in dev/test if not explicitly set; OFF in production unless explicitly enabled
  const isDev = toBool(readEnv("DEV") ?? (readEnv("NODE_ENV") === "development"));
  const isTest = readEnv("VITEST") === "true" || readEnv("NODE_ENV") === "test";
  if (typeof raw === "undefined" || raw === null) return isDev || isTest;
  return toBool(raw, false);
}