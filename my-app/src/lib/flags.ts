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

/**
 * Controls whether local CV editor debug entrypoints should be visible.
 * - visible by default in development
 * - hidden in production unless explicitly enabled
 */
export function isCvEditorDebugUiEnabled(): boolean {
  const explicit = readEnv("VITE_ENABLE_CV_DEBUG_UI");
  if (typeof explicit !== "undefined" && explicit !== null) {
    return toBool(explicit, false);
  }

  const nodeEnv = readEnv("NODE_ENV");
  if (nodeEnv === "production") {
    return false;
  }

  const rawDev = readEnv("DEV");
  return toBool(rawDev, false) || nodeEnv === "development";
}

/**
 * Controls whether the workshop family is visible in user-facing selectors.
 * Persisted workshop styles must still render through the legacy-safe path even
 * when this flag is disabled.
 */
export function isWorkshopFamilyEnabled(): boolean {
  // Keep a static import.meta.env access for Vite replacement.
  const viteRaw = import.meta.env?.VITE_ENABLE_WORKSHOP_FAMILY;
  if (typeof viteRaw !== "undefined") {
    return toBool(viteRaw, false);
  }
  return toBool(readEnv("VITE_ENABLE_WORKSHOP_FAMILY"), false);
}
