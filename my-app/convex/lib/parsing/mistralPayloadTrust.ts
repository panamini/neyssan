import type { AuthoritativeResume } from "../../../src/lib/authoritative-resume";

type MistralPayload = {
  diagnostics?: unknown;
  normalized?: unknown;
  result?: {
    diagnostics?: unknown;
    normalized?: unknown;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function buildDiagnosticsEnvelope(
  payload: MistralPayload | null | undefined,
): Record<string, unknown> {
  return {
    ...(asRecord(payload?.diagnostics) ?? {}),
    ...(asRecord(payload?.result?.diagnostics) ?? {}),
  };
}

function extractTrustedMistralNormalizedPayload(
  payload: MistralPayload | null | undefined,
): Record<string, unknown> | null {
  return (
    asRecord(payload?.result?.normalized) ??
    asRecord(payload?.normalized) ??
    null
  );
}

function normalizedDiagnosticValue(value: unknown): string {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export function buildAuthoritativeResumeEnvelope(
  payload: MistralPayload | null | undefined,
): AuthoritativeResume | null {
  const diagnostics = buildDiagnosticsEnvelope(payload);
  const routeLooksLikeMistral =
    normalizedDiagnosticValue(diagnostics.ocr_engine) === "mistral" ||
    normalizedDiagnosticValue(diagnostics.mistral_runtime) === "mistral" ||
    normalizedDiagnosticValue(diagnostics.mistral_runtime) === "local_fallback";
  if (!routeLooksLikeMistral) {
    return null;
  }

  const fallbackToLegacy = diagnostics.mistral_fallback === true;
  const normalized = fallbackToLegacy
    ? null
    : extractTrustedMistralNormalizedPayload(payload);

  return {
    source: "mistral_v3",
    trusted: !fallbackToLegacy && Boolean(normalized),
    fallbackToLegacy,
    normalized,
  };
}

export function isMistralPayloadSelectable(
  payload: MistralPayload | null | undefined,
  { ocrChars, rawSectionsLen }: { ocrChars: number; rawSectionsLen: number },
): boolean {
  return (
    buildAuthoritativeResumeEnvelope(payload)?.trusted === true &&
    (rawSectionsLen > 0 || ocrChars >= 200)
  );
}
