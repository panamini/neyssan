export interface TelemetryEntry {
  event: string;
  timestamp: number;
  payload?: Record<string, unknown>;
}

const telemetryStore: TelemetryEntry[] = [];

/**
 * Record a lightweight telemetry event. This intentionally keeps implementation
 * minimal (in-memory + console) so it's safe in tests and local dev. Can be
 * extended later to push to a real telemetry backend.
 */
export function recordTelemetry(event: string, payload?: Record<string, unknown>) {
  const entry: TelemetryEntry = {
    event,
    timestamp: Date.now(),
    payload: payload ?? {}
  };
  telemetryStore.push(entry);
  // Also log to console at debug level for easy inspection in CI logs
  try {
    console.debug(`[telemetry] ${event}`, entry.payload ?? {});
  } catch {
    // no-op if console unavailable
  }
}

/**
 * Return a shallow copy of recorded telemetry events. Used in unit tests to
 * assert expected adapter/fallback behaviour.
 */
export function getTelemetry(): TelemetryEntry[] {
  return telemetryStore.slice();
}

/**
 * Clear telemetry store (test helper).
 */
export function clearTelemetry() {
  telemetryStore.length = 0;
}