function parseCssDurationMs(value: string, fallbackMs: number): number {
  const normalized = value.trim();
  if (!normalized) {
    return fallbackMs;
  }

  if (normalized.endsWith("ms")) {
    const parsed = Number.parseFloat(normalized.slice(0, -2));
    return Number.isFinite(parsed) ? parsed : fallbackMs;
  }

  if (normalized.endsWith("s")) {
    const parsed = Number.parseFloat(normalized.slice(0, -1));
    return Number.isFinite(parsed) ? parsed * 1000 : fallbackMs;
  }

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : fallbackMs;
}

export function readCssDurationMs(
  variableName: string,
  fallbackMs: number,
  target?: Element | null,
): number {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return fallbackMs;
  }

  const source = target ?? document.documentElement;
  if (!source) {
    return fallbackMs;
  }

  const rawValue = window.getComputedStyle(source).getPropertyValue(variableName);
  return parseCssDurationMs(rawValue, fallbackMs);
}
